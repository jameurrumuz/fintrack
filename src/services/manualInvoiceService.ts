
import { db } from '@/lib/firebase';
import type { ManualInvoice } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { cleanUndefined } from '@/lib/utils';

const manualInvoicesCollectionRef = () => db ? collection(db, 'manual_invoices') : null;

// Helper to convert Firestore Timestamps
const mapDocToManualInvoice = (doc: any): ManualInvoice => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        date: data.date,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
        items: (data.items || []).map((item: any) => ({
            ...item,
            date: (item.date as Timestamp)?.toDate ? (item.date as Timestamp).toDate() : new Date(item.date),
        }))
    } as ManualInvoice;
};

// Subscribe to all manual invoices
export function subscribeToManualInvoices(
  onUpdate: (invoices: ManualInvoice[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = manualInvoicesCollectionRef();
  if (!collectionRef) {
      onError(new Error("Firebase not configured"));
      return () => {};
  }
  const q = query(collectionRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToManualInvoice));
  }, (error) => onError(error as Error));
}

// Add a new manual invoice
export async function addManualInvoice(invoice: Omit<ManualInvoice, 'id' | 'createdAt'>): Promise<string> {
  const collectionRef = manualInvoicesCollectionRef();
  if (!collectionRef) throw new Error("Firebase not configured");
  
  const docData = {
    ...invoice,
    createdAt: serverTimestamp(),
  };

  const cleanData = cleanUndefined(docData);
  const docRef = await addDoc(collectionRef, cleanData);
  return docRef.id;
}

// Update an existing manual invoice
export async function updateManualInvoice(id: string, invoice: Partial<Omit<ManualInvoice, 'id' | 'createdAt'>>): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const docRef = doc(db, 'manual_invoices', id);
  const cleanData = cleanUndefined(invoice);
  await updateDoc(docRef, cleanData);
}

// Delete a manual invoice
export async function deleteManualInvoice(id: string): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const docRef = doc(db, 'manual_invoices', id);
  await deleteDoc(docRef);
}

