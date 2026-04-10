
'use client';

import { db } from '@/lib/firebase';
import type { FamilyRegistration } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, Timestamp,
  serverTimestamp
} from 'firebase/firestore';

const getFamilyRegistrationsCollection = () => {
    if (!db) return null;
    return collection(db, 'family_registrations');
}

const mapDocToRegistration = (doc: any): FamilyRegistration => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        dob: (data.dob as Timestamp)?.toDate ? (data.dob as Timestamp).toDate().toISOString() : data.dob,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
    } as FamilyRegistration;
};

export function subscribeToFamilyRegistrations(
  onUpdate: (registrations: FamilyRegistration[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = getFamilyRegistrationsCollection();
  if (!collectionRef) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  const q = query(collectionRef, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToRegistration));
  }, (error) => onError(error as Error));
}

export async function addFamilyRegistration(registration: Omit<FamilyRegistration, 'id' | 'createdAt'>): Promise<string> {
  const collectionRef = getFamilyRegistrationsCollection();
  if (!collectionRef) throw new Error('Firebase is not configured.');
  
  const docData = {
    ...registration,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(collectionRef, docData);
  return docRef.id;
}

export async function updateFamilyRegistration(id: string, data: Partial<Omit<FamilyRegistration, 'id' | 'createdAt'>>): Promise<void> {
  const collectionRef = getFamilyRegistrationsCollection();
  if (!collectionRef) throw new Error('Firebase is not configured.');
  const docRef = doc(collectionRef, id);
  await updateDoc(docRef, data);
}

export async function deleteFamilyRegistration(id: string): Promise<void> {
  const collectionRef = getFamilyRegistrationsCollection();
  if (!collectionRef) throw new Error('Firebase is not configured.');
  const docRef = doc(collectionRef, id);
  await deleteDoc(docRef);
}
