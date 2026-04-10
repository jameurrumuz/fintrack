
'use client';

import { db } from '@/lib/firebase';
import type { Project } from '@/types'; // Assuming Project type will be added to types
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, Timestamp, getDocs, setDoc
} from 'firebase/firestore';

const projectsCollectionRef = () => db ? collection(db, 'custom_projects') : null;

// Helper to convert Firestore Timestamps
const mapDocToProject = (doc: any): Project => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        transactions: (data.transactions || []).map((t: any) => ({
            ...t,
            date: t.date,
        })),
    } as Project;
};


// Subscribe to all projects
export function subscribeToProjects(
  onUpdate: (projects: Project[]) => void,
  onError: (error: Error) => void
) {
  const projectsCollection = projectsCollectionRef();
  if (!projectsCollection) {
    onError(new Error("Firebase not configured."));
    return () => {};
  }
  const q = query(projectsCollection, orderBy('name', 'asc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToProject));
  }, (error) => onError(error as Error));
}

// Add a new project
export async function addProject(project: Omit<Project, 'id'>): Promise<string> {
  const projectsCollection = projectsCollectionRef();
  if (!projectsCollection) throw new Error("Firebase not configured.");
  const docRef = await addDoc(projectsCollection, project);
  return docRef.id;
}

// Update an existing project
export async function updateProject(id: string, project: Partial<Omit<Project, 'id'>>): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const projectDoc = doc(db, 'custom_projects', id);
  await updateDoc(projectDoc, project);
}

// Delete a project
export async function deleteProject(id: string): Promise<void> {
    if (!db) throw new Error("Firebase is not configured.");
    const projectDoc = doc(db, 'custom_projects', id);
  await deleteDoc(projectDoc);
}
