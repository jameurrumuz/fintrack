

import { db } from '@/lib/firebase';
import type { WarisanCertificate } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { cleanUndefined } from '@/lib/utils';


const warisanCollectionRef = () => db ? collection(db, 'warisan_certificates') : null;

// Helper to convert Firestore Timestamps
const mapDocToCertificate = (doc: any): WarisanCertificate => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        issueDate: data.issueDate,
    } as WarisanCertificate;
};

// Subscribe to all certificates
export function subscribeToWarisanCertificates(
  onUpdate: (certificates: WarisanCertificate[]) => void,
  onError: (error: Error) => void
) {
  const collectionRef = warisanCollectionRef();
  if (!collectionRef) {
      onError(new Error("Firebase not configured"));
      return () => {};
  }
  const q = query(collectionRef, orderBy('issueDate', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToCertificate));
  }, (error) => onError(error as Error));
}

// Add a new certificate
export async function addWarisanCertificate(certificate: Omit<WarisanCertificate, 'id'>): Promise<string> {
  const collectionRef = warisanCollectionRef();
  if (!collectionRef) throw new Error("Firebase not configured");
  
  const docData = {
    ...certificate,
    createdAt: serverTimestamp(),
    issueDate: certificate.issueDate,
  };

  const cleanData = cleanUndefined(docData);
  const docRef = await addDoc(collectionRef, cleanData);
  return docRef.id;
}

// Update an existing certificate
export async function updateWarisanCertificate(id: string, certificate: Partial<Omit<WarisanCertificate, 'id'>>): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const docRef = doc(db, 'warisan_certificates', id);
  const dataToUpdate: Record<string, any> = { ...certificate };
  
  // Ensure date is a string if it's a Date object
  if (certificate.issueDate && certificate.issueDate instanceof Date) {
      dataToUpdate.issueDate = certificate.issueDate.toISOString().split('T')[0];
  }
  
  // Do not update the creation timestamp
  delete dataToUpdate.createdAt;
  
  const cleanData = cleanUndefined(dataToUpdate);

  await updateDoc(docRef, cleanData);
}

// Delete a certificate
export async function deleteWarisanCertificate(id: string): Promise<void> {
  if(!db) throw new Error("Firebase not configured");
  const docRef = doc(db, 'warisan_certificates', id);
  await deleteDoc(docRef);
}

