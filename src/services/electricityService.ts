
import { db } from '@/lib/firebase';
import type { ElectricityInfo, MeterReading, ExpenseHistoryEntry, Transaction } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp, arrayUnion, arrayRemove, runTransaction
} from 'firebase/firestore';
import { addTransaction } from './transactionService';
import { formatDate } from '@/lib/utils';

const metersCollectionRef = () => db ? collection(db, 'electricityMeters') : null;

// Subscribe to all meters
export function subscribeToElectricityMeters(
  onUpdate: (meters: ElectricityInfo[]) => void,
  onError: (error: Error) => void
) {
  const metersCollection = metersCollectionRef();
  if (!metersCollection) {
      onError(new Error('Firebase not configured.'));
      return () => {};
  }
  const q = query(metersCollection, orderBy('label', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const meters = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            ...data,
            readings: (data.readings || []).map((r: any) => ({
                ...r,
                date: (r.date as Timestamp)?.toDate ? (r.date as Timestamp).toDate().toISOString() : r.date,
            })),
            expenseHistory: (data.expenseHistory || []).map((h: any) => ({
                ...h,
                postedAt: (h.postedAt as Timestamp)?.toDate ? (h.postedAt as Timestamp).toDate().toISOString() : h.postedAt,
            })),
        } as ElectricityInfo;
    });
    onUpdate(meters);
  }, (error) => onError(error as Error));
}

// Add a new meter
export async function addElectricityMeter(meter: Omit<ElectricityInfo, 'id'>): Promise<string> {
  const metersCollection = metersCollectionRef();
  if (!metersCollection) throw new Error('Firebase not configured.');
  const docRef = await addDoc(metersCollection, meter);
  return docRef.id;
}

// Update an existing meter
export async function updateElectricityMeter(id: string, meter: Partial<Omit<ElectricityInfo, 'id'>>): Promise<void> {
  if (!db) throw new Error('Firebase not configured.');
  const meterDoc = doc(db, 'electricityMeters', id);
  await updateDoc(meterDoc, meter);
}

// Delete a meter
export async function deleteElectricityMeter(id: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured.');
    await deleteDoc(doc(db, 'electricityMeters', id));
}

// Add a new reading
export async function addMeterReading(meterId: string, reading: MeterReading): Promise<void> {
  if (!db) throw new Error('Firebase not configured.');
  const meterDoc = doc(db, 'electricityMeters', meterId);
  const readingWithDate = {
    ...reading,
    date: new Date(reading.date),
  }
  await updateDoc(meterDoc, {
    readings: arrayUnion(readingWithDate)
  });
}

// Update an existing reading
export async function updateMeterReading(meterId: string, updatedReading: MeterReading): Promise<void> {
  if (!db) throw new Error('Firebase not configured.');
  const meterDoc = doc(db, 'electricityMeters', meterId);

  await runTransaction(db, async (transaction) => {
    const meterSnap = await transaction.get(meterDoc);
    if (!meterSnap.exists()) throw new Error("Meter not found");

    const meterData = meterSnap.data() as ElectricityInfo;
    const readings = (meterData.readings || []).map(r => ({
      ...r,
      // Convert Firestore Timestamps to ISO strings for uniform processing
      date: (r.date as any)?.toDate ? (r.date as any).toDate().toISOString() : r.date,
    }));
    
    const index = readings.findIndex(r => r.id === updatedReading.id);
    if (index === -1) throw new Error("Reading not found");
    
    // Replace the old reading with the updated one
    readings[index] = { ...updatedReading };

    // Convert date strings back to Date objects for Firestore
    const readingsForFirestore = readings.map(r => ({
        ...r,
        date: new Date(r.date),
    }));
    
    transaction.update(meterDoc, { readings: readingsForFirestore });
  });
}

// Delete a reading
export async function deleteMeterReading(meterId: string, readingId: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured.');
    const meterRef = doc(db, 'electricityMeters', meterId);

    await runTransaction(db, async (transaction) => {
        const itemDoc = await transaction.get(meterRef);
        if (!itemDoc.exists()) {
            throw new Error("Item not found!");
        }

        const item = itemDoc.data() as ElectricityInfo;
        const readings = (item.readings || []).map(r => ({
            ...r,
            date: (r.date as any)?.toDate ? (r.date as any).toDate().toISOString() : r.date,
        }));
        
        const updatedReadings = readings.filter(record => record.id !== readingId);
        
        const readingsForFirestore = updatedReadings.map(r => ({
            ...r,
            date: new Date(r.date),
        }));

        transaction.update(meterRef, {
            readings: readingsForFirestore
        });
    });
}


// Post an expense and log it in the meter's history
export async function postElectricityExpense(meterId: string, expenseDetails: { fromDate: string; toDate: string; consumedAmount: number; currentBalance: number; }): Promise<void> {
    if (!db) throw new Error('Firebase not configured.');
    const meterDoc = doc(db, 'electricityMeters', meterId);

    // This will only log the expense in the meter's history, not create a separate transaction.
    const historyEntry: ExpenseHistoryEntry = {
        id: `exp-${Date.now()}`,
        fromDate: expenseDetails.fromDate,
        toDate: expenseDetails.toDate,
        consumedAmount: expenseDetails.consumedAmount,
        postedAt: new Date().toISOString(),
        currentBalance: expenseDetails.currentBalance,
    };

    await updateDoc(meterDoc, {
        expenseHistory: arrayUnion(historyEntry)
    });
}

export async function updateExpenseHistory(meterId: string, expenseId: string, updates: Partial<ExpenseHistoryEntry>): Promise<void> {
  if (!db) throw new Error('Firebase not configured.');
  const meterRef = doc(db, 'electricityMeters', meterId);

  await runTransaction(db, async (transaction) => {
    const meterDoc = await transaction.get(meterRef);
    if (!meterDoc.exists()) throw new Error("Meter not found.");

    const meterData = meterDoc.data() as ElectricityInfo;
    const history = [...(meterData.expenseHistory || [])];
    const index = history.findIndex(h => h.id === expenseId);
    if (index === -1) throw new Error("Expense record not found.");

    history[index] = { ...history[index], ...updates };
    transaction.update(meterRef, { expenseHistory: history });
  });
}

export async function deleteExpenseHistory(meterId: string, expenseId: string): Promise<void> {
    if (!db) throw new Error('Firebase not configured.');
    const meterRef = doc(db, 'electricityMeters', meterId);

    await runTransaction(db, async (transaction) => {
        const meterDoc = await transaction.get(meterRef);
        if (!meterDoc.exists()) throw new Error("Meter not found.");

        const meterData = meterDoc.data() as ElectricityInfo;
        const updatedHistory = (meterData.expenseHistory || []).filter(h => h.id !== expenseId);
        
        transaction.update(meterRef, { expenseHistory: updatedHistory });
    });
}
