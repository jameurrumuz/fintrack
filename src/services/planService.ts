

import { db } from '@/lib/firebase';
import type { PlanEntry, PlanProject } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, where
} from 'firebase/firestore';

const getPlanProjectsCollection = () => {
    if (!db) return null;
    return collection(db, 'planProjects');
}
const getPlanEntriesCollection = () => {
    if (!db) return null;
    return collection(db, 'planEntries');
}

// --- Projects ---
export function subscribeToPlanProjects(
  onUpdate: (projects: PlanProject[]) => void,
  onError: (error: Error) => void
) {
  const planProjectsCollection = getPlanProjectsCollection();
  if (!planProjectsCollection) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  const q = query(planProjectsCollection, orderBy('name'));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const projects = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanProject));
    onUpdate(projects);
  }, (error) => onError(error as Error));
  return unsubscribe;
}

export async function addPlanProject(project: Omit<PlanProject, 'id'>): Promise<string> {
    const projectsCollection = getPlanProjectsCollection();
    if (!projectsCollection) throw new Error("Firebase not configured.");
    const docRef = await addDoc(projectsCollection, project);
    return docRef.id;
}

export async function updatePlanProject(id: string, data: Partial<Omit<PlanProject, 'id'>>): Promise<void> {
    if(!db) throw new Error("Firebase not configured.");
    const projectDoc = doc(db, 'planProjects', id);
    await updateDoc(projectDoc, data);
}

export async function deletePlanProject(id: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured.");
    const projectDoc = doc(db, 'planProjects', id);
    await deleteDoc(projectDoc);
}


// --- Entries ---
export function subscribeToPlanEntries(
  planId: string | null,
  onUpdate: (entries: PlanEntry[]) => void,
  onError: (error: Error) => void
) {
  const planEntriesCollection = getPlanEntriesCollection();
  if (!planEntriesCollection) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  
  // If planId is provided, filter by it. Otherwise, fetch all entries.
  const q = planId 
    ? query(planEntriesCollection, where('planId', '==', planId))
    : query(planEntriesCollection);

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanEntry));
    entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onUpdate(entries);
  }, (error) => {
    console.error(`Error listening to plan entries:`, error);
    onError(error as Error);
  });
  return unsubscribe;
}

export function subscribeToOrphanPlanEntries(
  onUpdate: (entries: PlanEntry[]) => void,
  onError: (error: Error) => void
) {
  const planEntriesCollection = getPlanEntriesCollection();
  if (!planEntriesCollection) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  // Query for entries that do NOT have a planId field.
  const q = query(planEntriesCollection, where('planId', '==', null));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const entries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PlanEntry));
    onUpdate(entries);
  }, (error) => {
    console.error(`Error listening for orphan plan entries`, error);
    onError(error as Error);
  });
  return unsubscribe;
}


export async function addPlanEntry(entry: Omit<PlanEntry, 'id'>): Promise<string> {
  const planEntriesCollection = getPlanEntriesCollection();
  if (!planEntriesCollection) throw new Error('Firebase is not configured.');
  const docRef = await addDoc(planEntriesCollection, entry);
  return docRef.id;
}

export async function updatePlanEntry(id: string, entry: Partial<Omit<PlanEntry, 'id'>>): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  const entryDoc = doc(db, 'planEntries', id);
  await updateDoc(entryDoc, entry);
}

export async function deletePlanEntry(id: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  const entryDoc = doc(db, 'planEntries', id);
  await deleteDoc(entryDoc);
}
