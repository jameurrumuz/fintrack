
import { db } from '@/lib/firebase';
import type { StockAudit } from '@/types';
import { 
  collection, doc, addDoc, onSnapshot, query, orderBy, Timestamp, serverTimestamp
} from 'firebase/firestore';

const auditsCollectionRef = () => db ? collection(db, 'audits') : null;

// Function to save a new audit report
export async function saveAudit(audit: Omit<StockAudit, 'id'>): Promise<string> {
  const auditsCollection = auditsCollectionRef();
  if (!auditsCollection) throw new Error('Firebase not configured.');

  const docData = {
    ...audit,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(auditsCollection, docData);
  return docRef.id;
}

// Function to subscribe to all audit reports
export function subscribeToAudits(
  onUpdate: (audits: StockAudit[]) => void,
  onError: (error: Error) => void
) {
  const auditsCollection = auditsCollectionRef();
  if (!auditsCollection) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  const q = query(auditsCollection, orderBy('createdAt', 'desc'));

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const audits = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
      } as StockAudit;
    });
    onUpdate(audits);
  }, (error) => {
    console.error("Error listening to audits snapshot:", error);
    onError(error as Error);
  });

  return unsubscribe;
}
