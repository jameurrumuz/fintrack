
import { db } from '@/lib/firebase';
import type { TruckGiftTrackRecord } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp,
  serverTimestamp
} from 'firebase/firestore';

const getRecordsCollection = () => {
    if (!db) return null;
    return collection(db, 'truck_gift_records');
}


// Helper to convert Firestore Timestamps
const mapDocToRecord = (doc: any): TruckGiftTrackRecord => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
        deliveryDate: data.deliveryDate ? ((data.deliveryDate as Timestamp)?.toDate ? (data.deliveryDate as Timestamp).toDate().toISOString() : data.deliveryDate) : undefined,
        giftDate: data.giftDate ? ((data.giftDate as Timestamp)?.toDate ? (data.giftDate as Timestamp).toDate().toISOString() : data.giftDate) : undefined,

    } as TruckGiftTrackRecord;
};

// Subscribe to all records
export function subscribeToTrackRecords(
  onUpdate: (records: TruckGiftTrackRecord[]) => void,
  onError: (error: Error) => void
) {
  const recordsCollection = getRecordsCollection();
  if (!recordsCollection) {
      onError(new Error("Firebase not configured"));
      return () => {};
  }
  const q = query(recordsCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToRecord));
  }, (error) => onError(error as Error));
}

// Add a new record
export async function addTrackRecord(record: Omit<TruckGiftTrackRecord, 'id' | 'createdAt'>): Promise<string> {
  const recordsCollection = getRecordsCollection();
  if (!recordsCollection) throw new Error('Firebase is not configured.');
  const now = serverTimestamp();
  const docData = {
      ...record,
      createdAt: now,
      deliveryDate: record.deliveryDate ? new Date(record.deliveryDate) : now,
      giftDate: record.giftDate ? new Date(record.giftDate) : undefined,
      customers: record.customers || [],
  };

  const docRef = await addDoc(recordsCollection, docData);
  return docRef.id;
}

// Update an existing record
export async function updateTrackRecord(id: string, record: Partial<Omit<TruckGiftTrackRecord, 'id' | 'createdAt'>>): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const recordDoc = doc(db, 'truck_gift_records', id);
  const dataToUpdate: any = { ...record };
  if (record.deliveryDate) dataToUpdate.deliveryDate = new Date(record.deliveryDate);
  if (record.giftDate) dataToUpdate.giftDate = new Date(record.giftDate);
  else dataToUpdate.giftDate = null; // To remove the date if emptied

  // Ensure customers field is handled correctly
  if (dataToUpdate.customers === undefined) {
    delete dataToUpdate.customers;
  }
  await updateDoc(recordDoc, dataToUpdate);
}

// Delete a record
export async function deleteTrackRecord(id: string): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  await deleteDoc(doc(db, 'truck_gift_records', id));
}
