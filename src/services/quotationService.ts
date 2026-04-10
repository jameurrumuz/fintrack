
import { db } from '@/lib/firebase';
import type { Quotation } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp, getDocs, getDoc, serverTimestamp
} from 'firebase/firestore';

const quotationsCollectionRef = () => db ? collection(db, 'quotations') : null;

// Helper to convert Firestore Timestamps
const mapDocToQuotation = (doc: any): Quotation => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        date: data.date,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
    } as Quotation;
};

export async function getQuotationById(id: string): Promise<Quotation | null> {
    if(!db) throw new Error("Firebase not configured");
    const docRef = doc(db, 'quotations', id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
        return mapDocToQuotation(docSnap);
    }
    return null;
}

// Subscribe to all quotations
export function subscribeToQuotations(
  onUpdate: (quotations: Quotation[]) => void,
  onError: (error: Error) => void
) {
  const quotationsCollection = quotationsCollectionRef();
  if (!quotationsCollection) {
      onError(new Error("Firebase not configured"));
      return () => {};
  }
  const q = query(quotationsCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToQuotation));
  }, (error) => onError(error as Error));
}

// Add a new quotation
export async function addQuotation(quotation: Omit<Quotation, 'id'>): Promise<string> {
    const quotationsCollection = quotationsCollectionRef();
    if (!quotationsCollection) throw new Error("Firebase not configured");
    const docData = {
    ...quotation,
    createdAt: serverTimestamp(),
  };
  
  const docRef = await addDoc(quotationsCollection, docData);
  return docRef.id;
}

// Update an existing quotation
export async function updateQuotation(id: string, quotation: Partial<Omit<Quotation, 'id'>>): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const quotationDoc = doc(db, 'quotations', id);
  await updateDoc(quotationDoc, quotation);
}

// Delete a quotation
export async function deleteQuotation(id: string): Promise<void> {
    if(!db) throw new Error("Firebase not configured");
    await deleteDoc(doc(db, 'quotations', id));
}
