
import { db } from '@/lib/firebase';
import type { TradeLicence } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { cleanUndefined } from '@/lib/utils';

const tradeLicencesCollectionRef = () => db ? collection(db, 'trade_licences') : null;

// Helper to convert Firestore Timestamps
const mapDocToTradeLicence = (doc: any): TradeLicence => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
    } as TradeLicence;
};

// Subscribe to all trade licences
export function subscribeToTradeLicences(
  onUpdate: (licences: TradeLicence[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = tradeLicencesCollectionRef();
  if (!collectionRef) {
      onError(new Error("Firebase not configured"));
      return () => {};
  }
  const q = query(collectionRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToTradeLicence));
  }, (error) => onError(error as Error));
}

// Add a new trade licence
export async function addTradeLicence(licence: Omit<TradeLicence, 'id' | 'createdAt'>): Promise<string> {
  const collectionRef = tradeLicencesCollectionRef();
  if (!collectionRef) throw new Error("Firebase not configured");
  
  const docData = {
    ...licence,
    createdAt: serverTimestamp(),
  };

  const cleanData = cleanUndefined(docData);
  const docRef = await addDoc(collectionRef, cleanData);
  return docRef.id;
}

// Update an existing trade licence
export async function updateTradeLicence(id: string, licence: Partial<Omit<TradeLicence, 'id' | 'createdAt'>>): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const docRef = doc(db, 'trade_licences', id);
  const dataToUpdate: Record<string, any> = { ...licence };
  
  const cleanData = cleanUndefined(dataToUpdate);
  await updateDoc(docRef, cleanData);
}

// Delete a trade licence
export async function deleteTradeLicence(id: string): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const docRef = doc(db, 'trade_licences', id);
  await deleteDoc(docRef);
}
