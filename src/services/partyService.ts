'use client';

import { db } from '@/lib/firebase';
import { Party, Transaction, Loan, ActivityLog } from '@/types';
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc, runTransaction, query, orderBy, onSnapshot, serverTimestamp, getDoc, setDoc, where, writeBatch, limit, DocumentReference, Transaction as FirestoreTransaction, Timestamp, arrayUnion } from 'firebase/firestore';
import { addTransaction as addTxService, updateTransaction, deleteTransaction, getAccountSnaps } from './transactionService';
import { getEffectiveAmount, cleanUndefined } from '@/lib/utils';


const getPartiesCollection = () => {
    if (!db) return null;
    return collection(db, 'parties');
}

const getOldDataLedgersCollection = () => {
    if (!db) return null;
    return collection(db, 'old_data_ledgers');
}


export function subscribeToParties(
  onUpdate: (parties: Party[]) => void,
  onError: (error: Error) => void
) {
  const partiesCollection = getPartiesCollection();
  if (!partiesCollection) {
    const error = new Error('Firebase is not configured correctly. Parties service cannot start.');
    onError(error);
    return () => {}; // Return a no-op unsubscribe function
  }
  
  const q = query(partiesCollection, orderBy('name', 'asc'));
  
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const parties = snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
            id: doc.id, 
            ...data,
            createdAt: (data.createdAt as Timestamp)?.toDate ? (data.createdAt as Timestamp).toDate().toISOString() : data.createdAt,
            updatedAt: (data.updatedAt as Timestamp)?.toDate ? (data.updatedAt as Timestamp).toDate().toISOString() : data.updatedAt,
            lastContacted: (data.lastContacted as Timestamp)?.toDate ? (data.lastContacted as Timestamp).toDate().toISOString() : data.lastContacted,
            lastSeen: (data.lastSeen as Timestamp)?.toDate ? (data.lastSeen as Timestamp).toDate().toISOString() : data.lastSeen,
            hasUnreadUserMessages: data.hasUnreadUserMessages || false,
        } as Party
    });
    onUpdate(parties);
  }, (error) => {
    console.error("Error listening to parties snapshot:", error);
    onError(error as Error);
  });

  return unsubscribe;
}

export function subscribeToViewableParties(
  staff: Party,
  onUpdate: (parties: Party[]) => void,
  onError: (error: Error) => void
) {
  const partiesCollection = getPartiesCollection();
  if (!partiesCollection) {
    const error = new Error('Firebase is not configured.');
    onError(error);
    return () => {};
  }
  
  const types = staff.viewablePartyTypes || [];
  const groups = staff.viewablePartyGroups || [];

  if (types.length === 0 && groups.length === 0) {
    // If no permissions are set, return no parties to be safe.
    onUpdate([]);
    return () => {};
  }

  let q;
  if (groups.length > 0) {
    q = query(partiesCollection, where('group', 'in', groups));
  } else {
    q = query(partiesCollection, where('partyType', 'in', types));
  }

  const unsubscribe = onSnapshot(q, (snapshot) => {
    let parties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Party));

    if (groups.length > 0 && types.length > 0) {
        parties = parties.filter(p => p.partyType && types.includes(p.partyType));
    }
    
    parties = parties.filter(p => p.partyType !== 'Staff');

    onUpdate(parties);
  }, (error) => {
    console.error("Error listening to viewable parties snapshot:", error);
    onError(error as Error);
  });

  return unsubscribe;
}

export async function addParty(party: Omit<Party, 'id'>): Promise<string> {
  const partiesCollection = getPartiesCollection();
  if (!partiesCollection) throw new Error('Firebase is not configured.');
  const now = serverTimestamp();
  const docRef = await addDoc(partiesCollection, {
      ...party,
      createdAt: now,
      updatedAt: now,
      lastContacted: now,
      sendSmsDefault: party.sendSmsDefault || false,
  });
  return docRef.id;
}


export async function updateParty(id: string, party: Partial<Omit<Party, 'id'>>): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  const partyDoc = doc(db, 'parties', id);
  const now = serverTimestamp();
  
  const updateData = { ...party, updatedAt: now, lastContacted: now };
  const cleanPartyData = cleanUndefined(updateData);
  
  if (cleanPartyData && Object.keys(cleanPartyData).length > 0) {
      delete cleanPartyData.createdAt;
      await updateDoc(partyDoc, cleanPartyData);
  }
}

export async function deleteParty(id: string): Promise<void> {
  if (!db) throw new Error('Firebase is not configured.');
  const partyDoc = doc(db, 'parties', id);
  await deleteDoc(partyDoc);
}

export async function updateLastContacted(partyId: string): Promise<void> {
    if (!db) throw new Error('Firebase is not configured.');
    const partyRef = doc(db, 'parties', partyId);
    await updateDoc(partyRef, { lastContacted: serverTimestamp() });
}

export async function saveOldLedgerData(partyId: string, newData: Record<string, string | number>[], overwrite = false): Promise<void> {
  const oldDataLedgersCollection = getOldDataLedgersCollection();
  if (!oldDataLedgersCollection || !db) throw new Error('Firebase is not configured.');
  
  const ledgerDocRef = doc(oldDataLedgersCollection, partyId);

  if (overwrite) {
      await setDoc(ledgerDocRef, { data: newData, lastUpdated: serverTimestamp() });
      return;
  }

  await runTransaction(db, async (transaction) => {
    const ledgerDoc = await transaction.get(ledgerDocRef);
    let existingData: Record<string, string | number>[] = [];
    
    if (ledgerDoc.exists()) {
      existingData = ledgerDoc.data().data || [];
    }

    const combinedData = [...existingData, ...newData];

    transaction.set(ledgerDocRef, { data: combinedData, lastUpdated: serverTimestamp() });
  });
}

export async function getOldLedgerData(partyId: string): Promise<Record<string, string | number>[] | null> {
    const oldDataLedgersCollection = getOldDataLedgersCollection();
    if (!oldDataLedgersCollection || !db) throw new Error('Firebase is not configured.');
    const ledgerDocRef = doc(oldDataLedgersCollection, partyId);
    const docSnap = await getDoc(ledgerDocRef);
    if (docSnap.exists()) {
        return docSnap.data().data as Record<string, string | number>[];
    }
    return null;
}

export async function updateOldLedgerEntry(partyId: string, entryIndex: number, updatedEntry: Record<string, any>): Promise<void> {
  const oldDataLedgersCollection = getOldDataLedgersCollection();
  if (!oldDataLedgersCollection || !db) throw new Error('Firebase is not configured.');

  const ledgerDocRef = doc(oldDataLedgersCollection, partyId);

  await runTransaction(db, async (transaction) => {
    const ledgerDoc = await transaction.get(ledgerDocRef);
    if (!ledgerDoc.exists()) {
      throw new Error("Old ledger data for this party does not exist.");
    }
    
    const data = ledgerDoc.data().data || [];
    if (entryIndex < 0 || entryIndex >= data.length) {
      throw new Error("Invalid entry index for update.");
    }

    data[entryIndex] = { ...data[entryIndex], ...updatedEntry };

    let currentBalance = entryIndex > 0 ? (Number(data[entryIndex-1]['Balance (৳)']) || 0) : 0;
     for (let i = entryIndex; i < data.length; i++) {
        const row = data[i];
        const credit = Number(row['credit'] || 0);
        const debit = Number(row['debit'] || 0);
        currentBalance += credit - debit;
        data[i]['Balance (৳)'] = currentBalance;
    }

    transaction.update(ledgerDocRef, { data, lastUpdated: serverTimestamp() });
  });
}

const createDisbursementTransaction = (partyId: string, loan: Loan): Omit<Transaction, 'id' | 'enabled'> => {
  if (loan.disbursementType === 'receive_in_account') {
    return {
       date: loan.startDate,
       description: `Loan disbursed (Loan #${loan.loanNumber})`,
       amount: loan.principal,
       type: 'receive',
       partyId: partyId,
       accountId: loan.disbursementAccountId,
       via: 'Personal',
       enabled: true,
     };
  } else { // credit_only
     return {
       date: loan.startDate,
       description: `Loan recorded as credit (Loan #${loan.loanNumber})`,
       amount: loan.principal,
       type: 'credit_purchase',
       partyId: partyId,
       via: 'Personal',
       enabled: true,
     };
  }
};

const createFeeTransaction = (partyId: string, loan: Loan): Omit<Transaction, 'id' | 'enabled'> | null => {
  if (loan.processingFee && loan.processingFee > 0) {
    return {
      date: loan.startDate,
      description: `Processing fee for Loan #${loan.loanNumber}`,
      amount: loan.processingFee,
      type: 'income',
      partyId: partyId,
      via: 'Personal',
      category: 'Loan Processing Fee',
      enabled: true,
    };
  }
  return null;
};

export async function saveLoanAndUpdateParty(partyId: string, loan: Omit<Loan, 'id'>): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");

  const partyRef = doc(db, 'parties', partyId);
  const transactionsCollectionRef = collection(db, 'transactions');
  const tempDocRef = doc(transactionsCollectionRef); 

  await runTransaction(db, async (fbTransaction) => {
    const partySnap = await fbTransaction.get(partyRef);
    if (!partySnap.exists()) {
      throw new Error("Party not found.");
    }
    
    const partyData = partySnap.data() as Party;
    const existingLoans = partyData.loans || [];
    let newLoanWithId: Loan = { ...loan, id: tempDocRef.id }; 

    if (newLoanWithId.repaymentType === 'interest_only_indefinite') {
        delete newLoanWithId.tenure;
        delete newLoanWithId.tenureUnit;
    }

    newLoanWithId = cleanUndefined(newLoanWithId);
    
    const principalTx = createDisbursementTransaction(partyId, newLoanWithId);
    const feeTx = createFeeTransaction(partyId, newLoanWithId);
    
    fbTransaction.update(partyRef, { loans: [...existingLoans, newLoanWithId] });
    
    const principalTxRef = doc(transactionsCollectionRef);
    fbTransaction.set(principalTxRef, { ...principalTx, involvedAccounts: principalTx.accountId ? [principalTx.accountId] : [] });
    
    if(feeTx) {
      const feeTxRef = doc(transactionsCollectionRef);
      fbTransaction.set(feeTxRef, { ...feeTx, involvedAccounts: feeTx.accountId ? [feeTx.accountId] : [] });
    }
  });
}


export async function updateLoanDetails(partyId: string, loanId: string, updatedLoanData: Loan): Promise<void> {
  if (!db) throw new Error("Firebase not configured");
  
  const partyRef = doc(db, 'parties', partyId);
  const txCol = collection(db, 'transactions');

  await runTransaction(db, async (transaction) => {
    const partySnap = await transaction.get(partyRef);
    if (!partySnap.exists()) throw new Error("Party not found.");
    
    const partyData = partySnap.data() as Party;
    const loans = [...(partyData.loans || [])];
    const oldLoanIndex = loans.findIndex(l => l.id === loanId);
    if (oldLoanIndex === -1) throw new Error("Loan not found.");
    
    loans[oldLoanIndex] = cleanUndefined({ ...loans[oldLoanIndex], ...updatedLoanData });
    transaction.update(partyRef, { loans });
  });
}


export async function deleteLoan(partyId: string, loanId: string): Promise<void> {
  if (!db) throw new Error("Firebase is not configured.");
  const partyRef = doc(db, 'parties', partyId);
  await runTransaction(db, async (fbTransaction) => {
    const partySnap = await fbTransaction.get(partyRef);
    if (!partySnap.exists()) throw new Error("Party not found.");
    const partyData = partySnap.data() as Party;
    const updatedLoans = (partyData.loans || []).filter(l => l.id !== loanId);
    fbTransaction.update(partyRef, { loans: updatedLoans });
  });
}


export async function markEmiAsPaid(partyId: string, loanId: string, installmentIndex: number, paymentDetails: any): Promise<void> {
    if (!db) throw new Error('Firebase is not configured.');

    if (paymentDetails.principal > 0) {
        const principalTx: Omit<Transaction, 'id' | 'enabled'> = {
            date: paymentDetails.paymentDate,
            description: `Principal for EMI #${paymentDetails.installment} (Loan #${paymentDetails.loanNumber})`,
            amount: paymentDetails.principal,
            type: 'give', 
            partyId: partyId,
            accountId: paymentDetails.accountId,
            via: 'Personal',
            enabled: true,
        };
        await addTxService(principalTx);
    }
    
    if (paymentDetails.interest > 0) {
        const interestTx: Omit<Transaction, 'id' | 'enabled'> = {
            date: paymentDetails.paymentDate,
            description: `Interest for EMI #${paymentDetails.installment} (Loan #${paymentDetails.loanNumber})`,
            amount: paymentDetails.interest,
            type: 'spent', 
            partyId: partyId,
            accountId: paymentDetails.accountId,
            via: 'Personal',
            category: 'Interest Expense',
            enabled: true,
        };
        await addTxService(interestTx);
    }

    await runTransaction(db, async (fbTransaction) => {
        const partyRef = doc(db, 'parties', partyId);
        const partySnap = await fbTransaction.get(partyRef);
        if (!partySnap.exists()) throw new Error("Party not found.");
        const partyData = partySnap.data() as Party;
        const loans = [...(partyData.loans || [])];
        const loanIndex = loans.findIndex(l => l.id === loanId);
        if (loanIndex === -1) throw new Error("Loan not found.");
        const loan = loans[loanIndex];
        loan.schedule[installmentIndex].status = 'paid';
        loan.schedule[installmentIndex].paidOn = paymentDetails.paymentDate;
        loan.schedule[installmentIndex].paymentDetails = {
            mode: paymentDetails.accountId,
            amount: paymentDetails.principal + paymentDetails.interest,
            principal: paymentDetails.principal,
            interest: paymentDetails.interest,
            description: paymentDetails.description
        };
        fbTransaction.update(partyRef, { loans });
    });
}

export async function editEmiPaymentTransactions(partyId: string, loanId: string, installmentIndex: number, paymentDetails: any): Promise<void> {
    // This is a complex update, for MVP we mark as unpaid first then paid again
    await deleteEmiPayment(partyId, loanId, installmentIndex);
    await markEmiAsPaid(partyId, loanId, installmentIndex, paymentDetails);
}


export async function deleteEmiPayment(partyId: string, loanId: string, installmentIndex: number): Promise<void> {
    if (!db) throw new Error('Firebase is not configured.');
    const partyRef = doc(db, 'parties', partyId);
    await runTransaction(db, async (fbTransaction) => {
        const partySnap = await fbTransaction.get(partyRef);
        if (!partySnap.exists()) throw new Error("Party not found.");
        const partyData = partySnap.data() as Party;
        const loans = [...(partyData.loans || [])];
        const loanIndex = loans.findIndex(l => l.id === loanId);
        if (loanIndex === -1) return;
        const loan = loans[loanIndex];
        if (loan.schedule[installmentIndex].status === 'paid') {
            loan.schedule[installmentIndex].status = 'unpaid';
            delete loan.schedule[installmentIndex].paidOn;
            delete loan.schedule[installmentIndex].paymentDetails;
            fbTransaction.update(partyRef, { loans });
        }
    });
}

export async function incrementServiceUsage(partyId: string, serviceId: string): Promise<void> {
    if (!db) throw new Error('Firebase is not configured.');
    const partyRef = doc(db, 'parties', partyId);
    await runTransaction(db, async (transaction) => {
        const partyDoc = await transaction.get(partyRef);
        if (!partyDoc.exists()) throw new Error("Party not found!");
        const currentUsage = partyDoc.data().serviceUsage?.[serviceId] || 0;
        transaction.update(partyRef, { [`serviceUsage.${serviceId}`]: currentUsage + 1 });
    });
}

export async function logActivity(partyId: string, action: ActivityLog['action'], details?: ActivityLog['details']) {
    if (!db) return;
    try {
        const partyRef = doc(db, 'parties', partyId);
        const newLogEntry = { id: `log-${Date.now()}`, timestamp: new Date().toISOString(), action, details: details || {} };
        await updateDoc(partyRef, { activity: arrayUnion(newLogEntry), lastSeen: serverTimestamp() });
    } catch (error) {
        console.error("Failed to log activity:", error);
    }
}
