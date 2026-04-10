
import { db } from '@/lib/firebase';
import type { Note } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp, where,
  serverTimestamp
} from 'firebase/firestore';
import { cleanUndefined } from '@/lib/utils';

const notesCollectionRef = () => db ? collection(db, 'notes') : null;

const mapDocToNote = (doc: any): Note => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
        updatedAt: (data.updatedAt as Timestamp)?.toDate ? (data.updatedAt as Timestamp).toDate().toISOString() : new Date().toISOString(),
        date: (data.date as Timestamp)?.toDate ? (data.date as Timestamp).toDate().toISOString() : data.date,
    } as Note;
};

export function subscribeToNotes(
  onUpdate: (notes: Note[]) => void,
  onError: (error: Error) => void
) {
  const notesCollection = notesCollectionRef();
  if (!notesCollection) {
    onError(new Error('Firebase not configured'));
    return () => {};
  }
  const q = query(notesCollection, orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const notes = snapshot.docs.map(mapDocToNote);
    // Sort pinned notes to the top client-side
    const sortedNotes = notes.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0; // Keep original sort for items with same pin status
    });
    onUpdate(sortedNotes);
  }, (error) => onError(error as Error));
}

export function subscribeToNotesForParty(
  partyId: string,
  onUpdate: (notes: Note[]) => void,
  onError: (error: Error) => void
) {
  const notesCollection = notesCollectionRef();
  if (!notesCollection) {
    onError(new Error('Firebase not configured'));
    return () => {};
  }
  // The composite query with `where` and `orderBy` requires a Firestore index.
  // To avoid this, we query only by partyId and sort on the client.
  const q = query(notesCollection, where('partyId', '==', partyId));
  
  return onSnapshot(q, (snapshot) => {
    const notes = snapshot.docs.map(mapDocToNote);
    // Sort by date descending on the client-side
    notes.sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());
    onUpdate(notes);
  }, (error) => onError(error as Error));
}

export async function addNote(note: Partial<Omit<Note, 'id'>>): Promise<string> {
  const notesCollection = notesCollectionRef();
  if (!notesCollection) throw new Error('Firebase not configured');
  const now = serverTimestamp();
  const docData = {
      ...note,
      createdAt: now,
      updatedAt: now,
      date: note.date ? new Date(note.date) : now,
      items: note.items || [], // Ensure items is an empty array if not present
  };

  const cleanData = cleanUndefined(docData);
  if (cleanData.items && cleanData.items.length > 0) {
    delete cleanData.content; // remove content if items is present
  }


  const docRef = await addDoc(notesCollection, cleanData);
  return docRef.id;
}

export async function updateNote(id: string, note: Partial<Omit<Note, 'id'>>): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const noteDoc = doc(db, 'notes', id);
  
  const dataToUpdate: Record<string, any> = { ...note, updatedAt: serverTimestamp() };
  
  if (note.date) dataToUpdate.date = new Date(note.date);
  
  // Explicitly handle setting imageUrl to an empty string to delete it.
  if (note.imageUrl === '') {
      dataToUpdate.imageUrl = null; // Or use deleteField() if you prefer
  }
  
  const cleanData = cleanUndefined(dataToUpdate);
  delete cleanData.createdAt; // Prevent createdAt from being updated

  await updateDoc(noteDoc, cleanData);
}


export async function deleteNote(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  await deleteDoc(doc(db, 'notes', id));
}
