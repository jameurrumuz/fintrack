
'use client';

import { db } from '@/lib/firebase';
import type { FitnessLog } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy, Timestamp, setDoc, getDocs
} from 'firebase/firestore';

const fitnessLogsCollectionRef = () => db ? collection(db, 'fitness_logs') : null;

// Subscribe to logs for a specific user
export function subscribeToFitnessLogs(
  userId: string,
  onUpdate: (logs: FitnessLog[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = fitnessLogsCollectionRef();
  if (!collectionRef) {
    onError(new Error("Firebase not configured"));
    return () => {};
  }
  // Removed orderBy from the query to avoid needing a composite index.
  const q = query(
    collectionRef, 
    where('user_id', '==', userId)
  );

  return onSnapshot(q, (snapshot) => {
    const logs = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
      } as FitnessLog;
    });
    // Sorting is now done on the client side after data is received.
    logs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onUpdate(logs);
  }, (error) => onError(error as Error));
}

// Save or update a log for a specific date
export async function saveFitnessLog(log: Omit<FitnessLog, 'id' | 'total_kcal'>) {
    const collectionRef = fitnessLogsCollectionRef();
    if (!collectionRef) throw new Error("Firebase is not configured.");

    const q = query(
        collectionRef,
        where('user_id', '==', log.user_id),
        where('date', '==', log.date)
    );
    
    const docData = {
        date: log.date,
        user_id: log.user_id,
        foods: log.foods || [],
        walk_mins: log.walk_mins || 0,
        total_points: log.total_points,
    };

    const existingLogSnap = await getDocs(q);
    if (!existingLogSnap.empty) {
        // Update existing log for the day
        const docRef = existingLogSnap.docs[0].ref;
        await updateDoc(docRef, docData);
    } else {
        // Add new log for the day
        await addDoc(collectionRef, docData);
    }
}

// Delete a log
export async function deleteFitnessLog(id: string): Promise<void> {
  if(!db) throw new Error("Firebase not configured.");
  const docRef = doc(db, 'fitness_logs', id);
  await deleteDoc(docRef);
}
