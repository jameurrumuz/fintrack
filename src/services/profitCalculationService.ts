
import { db } from '@/lib/firebase';
import type { ProfitCalculationProject } from '@/types';
import { 
  collection, doc, onSnapshot, query, setDoc, addDoc, updateDoc, deleteDoc, getDocs
} from 'firebase/firestore';

const projectsCollectionRef = () => db ? collection(db, 'profit_projects') : null;


// Subscribe to all projects
export function subscribeToProfitProjects(
  onUpdate: (projects: ProfitCalculationProject[]) => void,
  onError: (error: Error) => void
) {
    const projectsCollection = projectsCollectionRef();
    if (!projectsCollection) {
        onError(new Error('Firebase is not configured.'));
        return () => {};
    }
  const q = query(projectsCollection);
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProfitCalculationProject)));
  }, (error) => onError(error as Error));
}

// Add a new project
export async function addProfitProject(project: Omit<ProfitCalculationProject, 'id'>): Promise<string> {
  const projectsCollection = projectsCollectionRef();
  if (!projectsCollection) throw new Error('Firebase not configured.');
  const docRef = await addDoc(projectsCollection, project);
  return docRef.id;
}

// Update an existing project
export async function updateProfitProject(id: string, project: Partial<Omit<ProfitCalculationProject, 'id'>>): Promise<void> {
  if (!db) throw new Error('Firebase not configured.');
  const projectDoc = doc(db, 'profit_projects', id);
  await updateDoc(projectDoc, project);
}

// Delete a project
export async function deleteProfitProject(id: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured.');
  const projectDoc = doc(db, 'profit_projects', id);
  await deleteDoc(projectDoc);
}


// Function to save all projects at once (useful for initial migration or full updates)
export async function saveProfitProjects(projects: ProfitCalculationProject[]): Promise<void> {
  const projectsCollection = projectsCollectionRef();
  if (!db || !projectsCollection) throw new Error('Firebase not configured.');
  // This is a destructive save. It will overwrite whatever is in the collection.
  // A more robust solution might involve merging or updating individual documents.
  // For simplicity, we can just use setDoc with the document ID.

  const existingDocs = await getDocs(projectsCollection);
  const deletePromises = existingDocs.docs.map(doc => deleteDoc(doc.ref));
  await Promise.all(deletePromises);

  const savePromises = projects.map(project => {
    const docRef = doc(projectsCollection, project.id);
    return setDoc(docRef, project);
  });
  
  await Promise.all(savePromises);
}
