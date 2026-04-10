
import { db } from '@/lib/firebase';
import type { CustomStatement } from '@/types';
import { 
  collection, doc, addDoc, onSnapshot, query, orderBy, Timestamp, where
} from 'firebase/firestore';

const getStatementsCollection = () => {
    if (!db) return null;
    return collection(db, 'custom_statements');
}

export async function saveStatement(statement: Omit<CustomStatement, 'id'>): Promise<string> {
  const statementsCollection = getStatementsCollection();
  if (!statementsCollection) throw new Error('Firebase is not configured.');
  
  const docData = {
    ...statement,
    statementDate: new Date(statement.statementDate),
  };

  const docRef = await addDoc(statementsCollection, docData);
  return docRef.id;
}

export function subscribeToStatements(
  partyId: string,
  onUpdate: (statements: CustomStatement[]) => void,
  onError: (error: Error) => void
) {
  const statementsCollection = getStatementsCollection();
  if (!statementsCollection) {
    onError(new Error('Firebase not configured.'));
    return () => {};
  }

  const q = query(
    statementsCollection, 
    where('partyId', '==', partyId)
  );

  const unsubscribe = onSnapshot(q, (snapshot) => {
    const statements = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        statementDate: (data.statementDate as Timestamp)?.toDate ? (data.statementDate as Timestamp).toDate().toISOString() : new Date().toISOString(),
      } as CustomStatement;
    });
    // Sort on the client-side
    statements.sort((a, b) => new Date(b.statementDate).getTime() - new Date(a.statementDate).getTime());
    onUpdate(statements);
  }, (error) => {
    console.error("Error listening to statements snapshot:", error);
    onError(error as Error);
  });

  return unsubscribe;
}
