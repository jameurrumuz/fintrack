

import { db } from '@/lib/firebase';
import type { SmsLog } from '@/types';
import {
  collection, doc, addDoc, serverTimestamp,
  onSnapshot, query, orderBy, Timestamp, writeBatch
} from 'firebase/firestore';

const smsLogsCollectionRef = () => db ? collection(db, 'sms_logs') : null;

// Helper to check for non-GSM-7 characters
const hasUnicode = (text: string) => {
    // This regex checks for any character outside the basic GSM-7 character set
    // and its extensions. It's a simplified check.
    // eslint-disable-next-line no-control-regex
    return /[^\u0000-\u007F\u00A3\u00A5\u00E8\u00E9\u00F9\u00EC\u00F2\u00C7\u000A\u00D8\u00F8\u000D\u00C5\u00E5\u0394\u005F\u03A6\u0393\u039B\u03A9\u03A0\u03A8\u03A3\u0398\u039E\u00C6\u00E6\u00DF\u00C9\u0020\u0021\u0022\u0023\u00A4\u0025\u0026\u0027\u0028\u0029\u002A\u002B\u002C\u002D\u002E\u002F\u0030-\u0039\u003A\u003B\u003C\u003D\u003E\u003F\u00A1\u0041-\u005A\u0061-\u007A\u00C4\u00D6\u00D1\u00DC\u00A7\u00BF\u00E4\u00F6\u00F1\u00FC\u00E0]/.test(text);
};


// Helper to convert Firestore Timestamps
const mapDocToSmsLog = (doc: any): SmsLog => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
    } as SmsLog;
};

// Add a new log entry
export async function logSms(log: Omit<SmsLog, 'id' | 'createdAt' | 'segments'>): Promise<void> {
  const collectionRef = smsLogsCollectionRef();
  if (!collectionRef) {
    console.error("Firebase not configured, cannot log SMS.");
    return;
  }
  
  const isUnicode = hasUnicode(log.message);
  const singleSegmentLimit = isUnicode ? 70 : 160;
  const multiSegmentLimit = isUnicode ? 67 : 153;

  let segments = 1;
  if (log.message.length > singleSegmentLimit) {
      segments = Math.ceil(log.message.length / multiSegmentLimit);
  }

  const docData = {
    ...log,
    segments,
    isUnicode,
    isRead: log.status === 'success', // Mark successful messages as "read" by default
    createdAt: serverTimestamp(),
  };

  await addDoc(collectionRef, docData);
}

// Subscribe to all SMS logs
export function subscribeToSmsLogs(
  onUpdate: (logs: SmsLog[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = smsLogsCollectionRef();
  if (!collectionRef) {
    onError(new Error("Firebase not configured"));
    return () => {};
  }
  const q = query(collectionRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToSmsLog));
  }, (error) => onError(error as Error));
}

// Mark specific failed logs as read
export async function markFailedLogsAsRead(logIds: string[]): Promise<void> {
    const collectionRef = smsLogsCollectionRef();
    if (!db || !collectionRef) throw new Error("Firebase not configured.");
    
    const batch = writeBatch(db);
    logIds.forEach(id => {
        const docRef = doc(db, 'sms_logs', id);
        batch.update(docRef, { isRead: true });
    });
    
    await batch.commit();
}
