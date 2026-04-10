

'use client';

import { db } from '@/lib/firebase';
import type { Tour, Transaction } from '@/types';
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { addParty } from './partyService'; // Import addParty
import { addTransaction, deleteTransaction, deleteTransactionByDetails, updateTransactionByDetails } from './transactionService';

const toursCollectionRef = () => db ? collection(db, 'tours') : null;

// Helper to convert Firestore Timestamps
const mapDocToTour = (doc: any): Tour => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
        deposits: (data.deposits || []).map((d: any) => ({ ...d, createdAt: (d.createdAt as Timestamp)?.toDate ? (d.createdAt as Timestamp).toDate().toISOString() : d.createdAt })),
        expenses: (data.expenses || []).map((e: any) => ({ ...e, createdAt: (e.createdAt as Timestamp)?.toDate ? (e.createdAt as Timestamp).toDate().toISOString() : e.createdAt })),

    } as Tour;
};

// Subscribe to all tours
export function subscribeToTours(
  onUpdate: (tours: Tour[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = toursCollectionRef();
  if (!collectionRef) {
    onError(new Error("Firebase not configured"));
    return () => {};
  }
  const q = query(collectionRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToTour));
  }, (error) => onError(error as Error));
}

// Add a new tour and a corresponding party
export async function addTour(tour: Omit<Tour, 'id' | 'createdAt' | 'partyId'>): Promise<string> {
  const collectionRef = toursCollectionRef();
  if (!collectionRef) throw new Error("Firebase not configured");

  // Create a corresponding party for the tour
  const partyId = await addParty({
    name: `Tour: ${tour.name}`,
    partyType: 'Tour Project',
    status: `Tour created on ${new Date().toLocaleDateString()}`,
  });
  
  const docData = {
    ...tour,
    partyId, // Add the partyId to the tour document
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collectionRef, docData);
  return docRef.id;
}

// Update an existing tour
export async function updateTour(id: string, tour: Partial<Omit<Tour, 'id' | 'createdAt'>>): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const docRef = doc(db, 'tours', id);
  const dataToUpdate: Record<string, any> = { ...tour };
  
  // Convert date strings back to Date objects before sending to Firestore
  if (tour.deposits) {
    dataToUpdate.deposits = tour.deposits.map(d => ({...d, createdAt: new Date(d.createdAt)}));
  }
  if (tour.expenses) {
    dataToUpdate.expenses = tour.expenses.map(e => ({...e, createdAt: new Date(e.createdAt)}));
  }

  await updateDoc(docRef, dataToUpdate);
}

// Delete a tour
export async function deleteTour(id: string): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const docRef = doc(db, 'tours', id);
  await deleteDoc(docRef);
}
