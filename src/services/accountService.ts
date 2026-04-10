

'use client';

import { db } from '@/lib/firebase';
import { Account, Transaction } from '@/types';
import { collection, addDoc, doc, updateDoc, deleteDoc, query, onSnapshot, where, orderBy, getDoc, Timestamp, runTransaction } from 'firebase/firestore';
import { addTransaction as createTransaction } from './transactionService';
import { format as formatFns } from 'date-fns';

const getAccountsCollection = () => {
    if (!db) return null;
    return collection(db, 'accounts');
}

const getTransactionsCollection = () => {
    if (!db) return null;
    return collection(db, 'transactions');
}


export function subscribeToAccounts(
  onUpdate: (accounts: Account[]) => void,
  onError: (error: Error) => void
) {
  const accountsCollection = getAccountsCollection();
  if (!accountsCollection) {
      onError(new Error("Firebase is not configured."));
      return () => {};
  }
  const q = query(accountsCollection);
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const accounts = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id,
            name: data.name || '',
            balance: data.balance || 0,
            chargeRules: Array.isArray(data.chargeRules) ? data.chargeRules.map(rule => ({ ...rule })) : [],
            receivingNumbers: Array.isArray(data.receivingNumbers) ? data.receivingNumbers.map(num => ({ ...num })) : [],
        } as Account;
    });
    onUpdate(accounts);
  }, (error) => {
    console.error("Error listening to accounts snapshot:", error);
    onError(error as Error);
  });

  return unsubscribe;
}

export function subscribeToTransfers(
    onUpdate: (transfers: Transaction[]) => void,
    onError: (error: Error) => void
) {
    const transactionsCollection = getTransactionsCollection();
    if (!transactionsCollection) {
        onError(new Error("Firebase is not configured."));
        return () => {};
    }
    const q = query(transactionsCollection, where('type', '==', 'transfer'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
        const transfers = snapshot.docs.map(doc => {
            const data = doc.data();
            let dateStr = '';
            if (data.date) {
                if ((data.date as Timestamp).toDate) { // Firestore Timestamp
                    dateStr = formatFns((data.date as Timestamp).toDate(), 'yyyy-MM-dd');
                } else if (typeof data.date === 'string') {
                    dateStr = data.date.split('T')[0];
                }
            }
            return { id: doc.id, ...data, date: dateStr } as Transaction;
        });
        // Sort by date descending on the client
        transfers.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        onUpdate(transfers);
    }, (error) => onError(error as Error));
    
    return unsubscribe;
}

export async function addAccount(account: Omit<Account, 'id'>): Promise<void> {
  const accountsCollection = getAccountsCollection();
  if (!accountsCollection) throw new Error("Firebase is not configured.");
  await addDoc(accountsCollection, {
    name: account.name,
    balance: account.balance || 0,
    chargeRules: account.chargeRules || [],
    receivingNumbers: account.receivingNumbers || [],
  });
}

export async function updateAccount(id: string, account: Partial<Omit<Account, 'id'>>): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const accountDoc = doc(db, 'accounts', id);

  await runTransaction(db, async (transaction) => {
    const accSnap = await transaction.get(accountDoc);
    if (!accSnap.exists()) {
      throw "Account does not exist!";
    }
    
    const oldBalance = accSnap.data().balance || 0;
    const newBalance = oldBalance + (account.balance || 0);

    const updateData: Partial<Account> = {
      name: account.name,
      chargeRules: account.chargeRules,
      receivingNumbers: account.receivingNumbers,
      balance: newBalance,
    };
    
    // If the balance was changed, we don't want to just overwrite it.
    // Instead we create a transaction to reflect that change.
    if (account.balance) {
      delete updateData.balance; // Don't update balance directly on the account
    }

    transaction.update(accountDoc, updateData);

    if (account.balance) {
      await createTransaction({
        date: new Date().toISOString().split('T')[0],
        description: `Manual Balance Update by Admin`,
        amount: Math.abs(account.balance),
        type: account.balance > 0 ? 'income' : 'spent',
        accountId: id,
        enabled: true,
      });
    }

  });
}

export async function deleteAccount(id: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  // Ideally, first check if there are transactions associated with this account.
  // For now, we'll just delete it.
  const accountDoc = doc(db, 'accounts', id);
  await deleteDoc(accountDoc);
}


    