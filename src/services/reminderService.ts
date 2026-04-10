

import { db } from '@/lib/firebase';
import type { Reminder } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp, where, writeBatch, getDocs, serverTimestamp
} from 'firebase/firestore';
import { deleteField } from 'firebase/firestore';
import { sendTelegramNotification } from '@/app/telegram-notification/actions';
import { format } from 'date-fns';


const getRemindersCollection = () => {
    if (!db) return null;
    return collection(db, 'reminders');
}

const mapDocToReminder = (doc: any): Reminder => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        dueDate: (data.dueDate as Timestamp)?.toDate ? (data.dueDate as Timestamp).toDate().toISOString() : data.dueDate,
        reminderDate: (data.reminderDate as Timestamp)?.toDate ? (data.reminderDate as Timestamp).toDate().toISOString() : data.reminderDate,
        reminderDates: (data.reminderDates || []).map((d: Timestamp | string) => typeof d === 'string' ? d : d.toDate().toISOString()),
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : data.createdAt,
    } as Reminder;
};

export async function checkAndSendReminders(): Promise<{ sent: number; failed: number }> {
    const collectionRef = getRemindersCollection();
    if (!collectionRef) {
        throw new Error("Firebase not configured for server-side execution.");
    }

    const now = new Date();
    // আমরা সেই রিমাইন্ডারগুলো খুঁজবো যেগুলোর স্ট্যাটাস 'pending' এবং dueDate বর্তমান সময়ের আগে বা সমান
    const q = query(
        collectionRef,
        where('status', '==', 'pending'),
        where('dueDate', '<=', now)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) {
        return { sent: 0, failed: 0 };
    }

    let sentCount = 0;
    let failedCount = 0;

    const reminderPromises = snapshot.docs.map(async (docSnap) => {
        const reminder = mapDocToReminder(docSnap);
        console.log(`Processing reminder for: ${reminder.partyName}`);

        const message = `🔔 <b>REMINDER</b>\n\n👤 <b>${reminder.partyName}</b>\n💰 Balance: ${reminder.dueAmount}\n📝 Note: ${reminder.notes || 'N/A'}\n⏰ Due: ${format(new Date(reminder.dueDate), 'PPp')}`;

        try {
            const result = await sendTelegramNotification(message, {
                priority: 'urgent',
                taskId: reminder.id,
            });

            if (result.success) {
                sentCount++;
                console.log(`Successfully sent reminder for ${reminder.partyName}.`);

                // --- লজিক আপডেট: পরবর্তী ডেট সেট করা ---
                const currentDueDate = new Date(reminder.dueDate);
                // reminderDates অ্যারে থেকে বর্তমান ডেটের পরের ডেটগুলো বের করি
                const futureDates = (reminder.reminderDates || [])
                    .map(d => new Date(d))
                    .filter(d => d > currentDueDate)
                    .sort((a, b) => a.getTime() - b.getTime());

                if (futureDates.length > 0) {
                    // যদি আরও ডেট বাকি থাকে, তাহলে dueDate আপডেট করি এবং স্ট্যাটাস pending রাখি
                    const nextDate = futureDates[0];
                    await updateDoc(docSnap.ref, { 
                        dueDate: nextDate,
                        lastSent: serverTimestamp()
                        // status 'pending' ই থাকবে
                    });
                    console.log(`Rescheduled next reminder for ${format(nextDate, 'PPp')}`);
                } else {
                    // আর কোনো ডেট বাকি না থাকলে sent মার্ক করি
                    await updateDoc(docSnap.ref, { status: 'sent', lastSent: serverTimestamp() });
                }

            } else {
                failedCount++;
                console.error(`Failed to send notification:`, result.error);
            }
        } catch (error) {
            failedCount++;
            console.error(`Error processing reminder ${reminder.id}:`, error);
        }
    });

    await Promise.all(reminderPromises);

    return { sent: sentCount, failed: failedCount };
}


export function subscribeToReminders(
  onUpdate: (reminders: Reminder[]) => void,
  onError: (error: Error) => void
) {
  const remindersCollection = getRemindersCollection();
  if (!remindersCollection) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  const q = query(remindersCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const notes = snapshot.docs.map(mapDocToReminder);
    // Sort pinned notes to the top client-side
    const sortedNotes = notes.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0; // Keep original sort for items with same pin status
    });
    onUpdate(sortedNotes);
  }, (error) => onError(error as Error));
}

export async function addReminder(reminder: Omit<Reminder, 'id'>): Promise<string> {
  const remindersCollection = getRemindersCollection();
  if (!remindersCollection) throw new Error('Firebase is not configured.');
  
  const docData = {
    ...reminder,
    dueDate: new Date(reminder.dueDate),
    reminderDates: (reminder.reminderDates || []).map(d => new Date(d)),
    createdAt: serverTimestamp(),
  };
  // remove the old single date field if present
  delete (docData as any).reminderDate;
  
  const docRef = await addDoc(remindersCollection, docData);
  return docRef.id;
}

export async function updateReminder(id: string, reminder: Partial<Omit<Reminder, 'id'>>): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  const reminderDoc = doc(db, 'reminders', id);
  const dataToUpdate: any = { ...reminder };

  if (reminder.dueDate) {
    dataToUpdate.dueDate = new Date(reminder.dueDate);
  }

  if (reminder.reminderDates) {
    dataToUpdate.reminderDates = reminder.reminderDates.map(d => new Date(d));
    dataToUpdate.reminderDate = deleteField(); // Remove old field
  }
  
  await updateDoc(reminderDoc, dataToUpdate);
}

export async function deleteReminder(id: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  const reminderDoc = doc(db, 'reminders', id);
  await deleteDoc(reminderDoc);
}

export async function clearAllReminders(): Promise<void> {
  const remindersCollection = getRemindersCollection();
  if (!remindersCollection || !db) {
    throw new Error("Firebase is not configured.");
  }
  
  const batch = writeBatch(db);
  const snapshot = await getDocs(remindersCollection);
  snapshot.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
}
