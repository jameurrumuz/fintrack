
import { db } from '@/lib/firebase';
import type { CostingProject } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp,
  serverTimestamp
} from 'firebase/firestore';

const costingCollectionRef = () => db ? collection(db, 'costingProjects') : null;


// Helper to convert Firestore Timestamps
const mapDocToProject = (doc: any): CostingProject => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : data.createdAt,
    } as CostingProject;
};

export function subscribeToCostingProjects(
  onUpdate: (projects: CostingProject[]) => void,
  onError: (error: Error) => void
) {
  const costingCollection = costingCollectionRef();
  if(!costingCollection) {
      onError(new Error('Firebase not configured'));
      return () => {};
  }
  const q = query(costingCollection, orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToProject));
  }, (error) => onError(error as Error));
}

export async function addCostingProject(project: Omit<CostingProject, 'id'>): Promise<string> {
  const costingCollection = costingCollectionRef();
  if(!costingCollection) throw new Error('Firebase not configured.');
  
  const docData = {
      ...project,
      createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(costingCollection, docData);
  return docRef.id;
}

// Update an existing project
export async function updateCostingProject(id: string, project: Partial<Omit<CostingProject, 'id' | 'createdAt'>>): Promise<void> {
  if(!db) throw new Error('Firebase not configured.');
  const projectDoc = doc(db, 'costingProjects', id);
  // Do not update createdAt field on existing documents
  const { createdAt, ...updateData } = project as any;
  await updateDoc(projectDoc, updateData);
}


// Delete a project
export async function deleteCostingProject(id: string): Promise<void> {
    if(!db) throw new Error('Firebase not configured.');
    await deleteDoc(doc(db, 'costingProjects', id));
}
