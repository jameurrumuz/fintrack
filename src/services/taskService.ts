
import { db } from '@/lib/firebase';
import type { Task } from '@/types';
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, orderBy, Timestamp, where 
} from 'firebase/firestore';

const getTasksCollection = () => {
    if (!db) return null;
    return collection(db, 'tasks');
}

// Helper to convert Firestore Timestamps in a task object
const mapDocToTask = (doc: any): Task => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        dueDate: (data.dueDate as Timestamp)?.toDate ? (data.dueDate as Timestamp).toDate().toISOString() : data.dueDate,
        createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : data.createdAt,
        reminder: (data.reminder as Timestamp)?.toDate ? (data.reminder as Timestamp).toDate().toISOString() : data.reminder,
        history: (data.history || []).map((h: any) => ({
            ...h,
            date: (h.date as Timestamp)?.toDate ? (h.date as Timestamp).toDate().toISOString() : h.date,
        })),
    } as Task;
};

// Subscribe to all tasks
export function subscribeToTasks(
  onUpdate: (tasks: Task[]) => void,
  onError: (error: Error) => void
) {
  const tasksCollection = getTasksCollection();
  if (!tasksCollection) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  const q = query(tasksCollection, orderBy('dueDate', 'asc'));
  return onSnapshot(q, (snapshot) => {
    onUpdate(snapshot.docs.map(mapDocToTask));
  }, (error) => onError(error as Error));
}

// Subscribe to tasks for a specific staff member
export function subscribeToTasksForStaff(
  staffId: string,
  onUpdate: (tasks: Task[]) => void,
  onError: (error: Error) => void
) {
  const tasksCollection = getTasksCollection();
  if (!tasksCollection) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }
  // Firestore requires a composite index for this query (assignedToId and dueDate).
  // A simpler approach for smaller datasets that avoids index creation is to
  // filter by staffId and sort on the client.
  const q = query(tasksCollection, where('assignedToId', '==', staffId));
  
  return onSnapshot(q, (snapshot) => {
    const tasks = snapshot.docs.map(mapDocToTask);
    tasks.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
    onUpdate(tasks);
  }, (error) => onError(error as Error));
}


// Add a new task
export async function addTask(task: Omit<Task, 'id' | 'createdAt' | 'history' | 'status'>): Promise<Task> {
  const tasksCollection = getTasksCollection();
  if (!tasksCollection) throw new Error('Firebase is not configured.');
  const newHistoryEntry = { date: new Date().toISOString(), action: 'created', comment: 'Task created', progress: task.progress };
  
  const newTaskData = { 
    ...task, 
    dueDate: new Date(task.dueDate), 
    createdAt: new Date(), 
    status: task.progress === 100 ? 'completed' : 'in-progress', 
    history: [newHistoryEntry] 
  };
  
  const docRef = await addDoc(tasksCollection, newTaskData as any);
  
  return { ...task, id: docRef.id, status: newTaskData.status, createdAt: newTaskData.createdAt.toISOString(), history: [newHistoryEntry] };
}


// Update an existing task
export async function updateTask(id: string, task: Partial<Omit<Task, 'id'>>): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  const taskDoc = doc(db, 'tasks', id);
  const dataToUpdate: any = { ...task };
  if (task.dueDate) dataToUpdate.dueDate = new Date(task.dueDate);
  if (task.reminder) dataToUpdate.reminder = new Date(task.reminder);
  else if (task.reminder === null) dataToUpdate.reminder = null; // Allow clearing reminder
  
  if (task.history) {
    dataToUpdate.history = task.history.map(h => ({...h, date: new Date(h.date) }));
  }
  
  // Logic to update status based on progress
  if (task.progress !== undefined) {
    if (task.progress >= 100 && task.status !== 'completed') {
        dataToUpdate.status = 'completed';
    } else if (task.progress < 100 && task.status === 'completed') {
        dataToUpdate.status = 'in-progress';
    }
  }
  
  await updateDoc(taskDoc, dataToUpdate);
}

// Delete a task
export async function deleteTask(id: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  await deleteDoc(doc(db, 'tasks', id));
}
