
'use client';

import { db } from '@/lib/firebase';
import type { LogRecord } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp
} from 'firebase/firestore';

const getLogRecordsCollection = () => {
    if (!db) return null;
    return collection(db, 'log_records');
}

const mapDocToLogRecord = (doc: any): LogRecord => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        date: data.date,
        transactions: (data.transactions || []).map((t: any) => ({
            ...t,
            date: t.date,
        })),
    } as LogRecord;
};

export function subscribeToLogRecords(
  onUpdate: (records: LogRecord[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = getLogRecordsCollection();
  if (!collectionRef) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  const q = query(collectionRef, orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToLogRecord));
  }, (error) => onError(error as Error));
}

export async function addLogRecord(record: Omit<LogRecord, 'id'>): Promise<string> {
  const collectionRef = getLogRecordsCollection();
  if (!collectionRef) throw new Error('Firebase is not configured.');
  
  const docRef = await addDoc(collectionRef, record);
  return docRef.id;
}
