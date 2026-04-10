

import { db } from '@/lib/firebase';
import type { EcareItem, ServiceRecord } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp, runTransaction, arrayUnion, arrayRemove, serverTimestamp 
} from 'firebase/firestore';

const ecareCollection = collection(db, 'ecareItems');

// Helper to convert Firestore Timestamps
const mapDocToEcareItem = (doc: any): EcareItem => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        purchaseDate: (data.purchaseDate as Timestamp)?.toDate ? (data.purchaseDate as Timestamp).toDate().toISOString() : data.purchaseDate,
        nextServiceDate: data.nextServiceDate ? ((data.nextServiceDate as Timestamp)?.toDate ? (data.nextServiceDate as Timestamp).toDate().toISOString() : data.nextServiceDate) : undefined,
        serviceHistory: (data.serviceHistory || []).map((h: any) => ({
            ...h,
            date: (h.date as Timestamp)?.toDate ? (h.date as Timestamp).toDate().toISOString() : h.date,
            nextServiceDate: h.nextServiceDate ? ((h.nextServiceDate as Timestamp)?.toDate ? (h.nextServiceDate as Timestamp).toDate().toISOString() : h.nextServiceDate) : undefined,
        }))
    } as EcareItem;
};


// Subscribe to all items
export function subscribeToEcareItems(
  onUpdate: (items: EcareItem[]) => void,
  onError: (error: Error) => void
) {
  const q = query(ecareCollection, orderBy('purchaseDate', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToEcareItem));
  }, (error) => onError(error as Error));
}

// Add new item
export async function addEcareItem(item: Omit<EcareItem, 'id'>): Promise<string> {
  const docData = {
      ...item,
      purchaseDate: new Date(item.purchaseDate),
  };

  const docRef = await addDoc(ecareCollection, docData);
  return docRef.id;
}

// Update existing item
export async function updateEcareItem(id: string, data: Partial<Omit<EcareItem, 'id' | 'serviceHistory'>>): Promise<void> {
  const itemDoc = doc(db, 'ecareItems', id);
  const updateData: Record<string, any> = { ...data };
  if(data.purchaseDate) updateData.purchaseDate = new Date(data.purchaseDate);
  if(data.nextServiceDate) updateData.nextServiceDate = new Date(data.nextServiceDate);
  
  await updateDoc(itemDoc, updateData);
}

// Delete item
export async function deleteEcareItem(id: string): Promise<void> {
  await deleteDoc(doc(db, 'ecareItems', id));
}

// Add a service record to an item
export async function addServiceRecord(itemId: string, record: ServiceRecord): Promise<void> {
  const itemDoc = doc(db, 'ecareItems', itemId);
  const recordWithDateObject = {
      ...record,
      date: new Date(record.date),
      nextServiceDate: record.nextServiceDate ? new Date(record.nextServiceDate) : undefined,
  };
  await updateDoc(itemDoc, {
    serviceHistory: arrayUnion(recordWithDateObject)
  });
}

// Delete a service record from an item
export async function deleteServiceRecord(itemId: string, serviceId: string): Promise<void> {
    const itemRef = doc(db, 'ecareItems', itemId);

    await runTransaction(db, async (transaction) => {
        const itemDoc = await transaction.get(itemRef);
        if (!itemDoc.exists()) {
            throw new Error("Item not found!");
        }

        const item = itemDoc.data() as EcareItem;
        const history = item.serviceHistory || [];
        
        const recordToDelete = history.find(record => record.id === serviceId);
        
        if (recordToDelete) {
            const recordToDeleteForFirebase = {
                ...recordToDelete,
                date: new Date(recordToDelete.date),
                nextServiceDate: recordToDelete.nextServiceDate ? new Date(recordToDelete.nextServiceDate) : undefined
            };
            await transaction.update(itemRef, {
                serviceHistory: arrayRemove(recordToDeleteForFirebase)
            });
        } else {
            console.warn("Service record not found for deletion.");
        }
    });
}
