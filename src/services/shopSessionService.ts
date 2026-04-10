
'use client';

import { db } from '@/lib/firebase';
import type { ShopDayReport } from '@/types';
import { 
  collection, doc, addDoc, onSnapshot, query, orderBy, Timestamp, serverTimestamp, getDocs, updateDoc, deleteDoc
} from 'firebase/firestore';

const shopReportsCollectionRef = () => db ? collection(db, 'shopDayReports') : null;

// Helper to convert Firestore Timestamps
const mapDocToReport = (doc: any): ShopDayReport => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        date: data.date,
        timestamp: (data.timestamp as Timestamp)?.toDate ? (data.timestamp as Timestamp).toDate().toISOString() : data.timestamp,
    } as ShopDayReport;
};

// Subscribe to all reports
export function subscribeToDailyReports(
  onUpdate: (reports: ShopDayReport[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = shopReportsCollectionRef();
  if (!collectionRef) {
      onError(new Error("Firebase not configured"));
      return () => {};
  }
  const q = query(collectionRef, orderBy('date', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToReport));
  }, (error) => onError(error as Error));
}

// Add a new report
export async function addDailyReport(report: Omit<ShopDayReport, 'id' | 'timestamp'> & { totalAmount: number }): Promise<string> {
  const collectionRef = shopReportsCollectionRef();
  if (!collectionRef) throw new Error("Firebase not configured");
  
  const docData = {
    ...report,
    timestamp: serverTimestamp(),
  };

  const docRef = await addDoc(collectionRef, docData);
  return docRef.id;
}


export async function updateDailyReport(id: string, reportData: Partial<Pick<ShopDayReport, 'physicalBalances' | 'totalAmount'>>): Promise<void> {
    if (!db) throw new Error('Firebase not configured.');
    const reportDoc = doc(db, 'shopDayReports', id);
    await updateDoc(reportDoc, reportData);
}

export async function deleteDailyReport(id: string): Promise<void> {
  if (!db) throw new Error("Firebase not configured.");
  const docRef = doc(db, 'shopDayReports', id);
  await deleteDoc(docRef);
}
