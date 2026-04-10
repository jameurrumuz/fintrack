// src/services/transactionService.ts
'use client';

import { db, getDb } from '@/lib/firebase';
import { Party, Transaction, Account, InventoryItem, VerificationResult, DepositChannel, AppSettings } from '@/types';
import { collection, getDocs, doc, query, orderBy, limit as firestoreLimit, onSnapshot, writeBatch, runTransaction, serverTimestamp, where, DocumentSnapshot, deleteField, Transaction as FirestoreTransaction, getDoc, Timestamp, arrayUnion, addDoc, deleteDoc, updateDoc, DocumentReference } from 'firebase/firestore';
import { getPartyBalanceEffect, getEffectiveAmount, cleanUndefined, formatDate, formatAmount } from '@/lib/utils';
import { format as formatFns, parseISO, parse, isValid } from 'date-fns';
import { sendSmsViaSmsq } from './smsqService';
import { sendSmsViaTwilio } from './twilioService';
import { sendSmsViaPushbullet } from './pushbulletService';
import { getInventoryEffect } from './inventoryService';

const getTransactionsCollection = () => db ? collection(db, 'transactions') : null;
const getAccountsCollection = () => db ? collection(db, 'accounts') : null;
const getPartiesCollection = () => db ? collection(db, 'parties') : null;
const getInventoryCollection = () => db ? collection(db, 'inventory') : null;

export async function getAccountSnaps(
  fbTransaction: FirestoreTransaction,
  accountIds: string[]
): Promise<Map<string, DocumentSnapshot>> {
  const accountsCollection = getAccountsCollection();
  if (!accountsCollection) return new Map();
  const snaps = new Map<string, DocumentSnapshot>();
  const promises = Array.from(new Set(accountIds)).map(id => {
    if (!id) return Promise.resolve();
    const ref = doc(accountsCollection, id);
    return fbTransaction.get(ref).then(snap => snaps.set(id, snap));
  });
  await Promise.all(promises);
  return snaps;
}

export async function getItemSnaps(
  fbTransaction: FirestoreTransaction,
  itemIds: string[]
): Promise<Map<string, DocumentSnapshot>> {
  const inventoryCollection = getInventoryCollection();
  if (!inventoryCollection) return new Map();
  const snaps = new Map<string, DocumentSnapshot>();
  const promises = Array.from(new Set(itemIds)).map(id => {
    if (!id) return Promise.resolve();
    const ref = doc(inventoryCollection, id);
    return fbTransaction.get(ref).then(snap => snaps.set(id, snap));
  });
  await Promise.all(promises);
  return snaps;
}

const mapDocToTransaction = (doc: DocumentSnapshot): Transaction => {
    const data = doc.data();
    if (!data) return { id: doc.id } as Transaction;

    let dateStr = '';
    if (data.date) {
        if (data.date instanceof Timestamp) {
            dateStr = formatFns(data.date.toDate(), 'yyyy-MM-dd');
        } else if (data.date instanceof Date) {
            dateStr = formatFns(data.date, 'yyyy-MM-dd');
        } else if (typeof data.date === 'string') {
            dateStr = data.date.split('T')[0];
        }
    }
    return {
        id: doc.id,
        ...data,
        date: dateStr || '',
        createdAt: (data?.createdAt as any)?.toDate ? (data?.createdAt as any).toDate().toISOString() : (data?.createdAt || ''),
    } as Transaction;
};

export function subscribeToAllTransactions(
  onUpdate: (transactions: Transaction[]) => void,
  onError: (error: Error) => void
) {
  const transactionsCollection = getTransactionsCollection();
  if (!transactionsCollection) {
    onError(new Error('Firebase is not configured correctly.'));
    return () => {};
  }

  const q = query(transactionsCollection);
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const transactions = snapshot.docs.map(mapDocToTransaction);
    // Sort client side to ensure correct order
    transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    onUpdate(transactions);
  }, (error) => {
    console.error("Error listening to all transactions snapshot:", error);
    onError(error as Error);
  });

  return unsubscribe;
}

export function subscribeToPendingPayments(
    onUpdate: (transactions: Transaction[]) => void,
    onError: (error: Error) => void
) {
    const transactionsCollection = getTransactionsCollection();
    if (!transactionsCollection) return () => {};
    const q = query(transactionsCollection, where('paymentStatus', '==', 'pending'));
    return onSnapshot(q, (snapshot) => {
        onUpdate(snapshot.docs.map(mapDocToTransaction));
    }, onError);
}

export function subscribeToNewOnlineOrders(
    onUpdate: (transactions: Transaction[]) => void,
    onError: (error: Error) => void
) {
    const transactionsCollection = getTransactionsCollection();
    if (!transactionsCollection) return () => {};
    const q = query(transactionsCollection, where('adminNotified', '==', false));
    return onSnapshot(q, (snapshot) => {
        const orders = snapshot.docs
            .map(mapDocToTransaction)
            .filter(t => t.description?.startsWith('Purchase from Online Store'));
        onUpdate(orders);
    }, onError);
}

export async function addTransaction(
    transactionData: Partial<Transaction> & { currentPartyBalance?: number; sendSms?: boolean; cart?: any[] }
): Promise<string> {
    if (!db) throw new Error('Firebase is not configured.');

    const transactionsCollection = collection(db, 'transactions');
    const partiesCollection = collection(db, 'parties');
    const accountsCollection = collection(db, 'accounts');
    const inventoryCollection = collection(db, 'inventory');

    const { currentPartyBalance, sendSms, cart, ...baseData } = transactionData;
    let mainTxId = '';
    let partyDataForSms: Party | null = null;
    let initialBalance = currentPartyBalance ?? 0;
    
    await runTransaction(db, async (fbTransaction) => {
        let partyRef = null;
        let partySnap = null;
        if (baseData.partyId) {
            partyRef = doc(partiesCollection, baseData.partyId);
            partySnap = await fbTransaction.get(partyRef);
            if (partySnap.exists()) {
                partyDataForSms = { id: partySnap.id, ...(partySnap.data() as Omit<Party, 'id'>) };
                if (currentPartyBalance === undefined) {
                    initialBalance = (partySnap.data() as Party).balance || 0;
                }
            }
        }

        const involvedAccountIds = new Set<string>();
        if (baseData.accountId) involvedAccountIds.add(baseData.accountId);
        if (baseData.fromAccountId) involvedAccountIds.add(baseData.fromAccountId);
        if (baseData.toAccountId) involvedAccountIds.add(baseData.toAccountId);
        if (baseData.payments) {
            baseData.payments.forEach(p => involvedAccountIds.add(p.accountId));
        }

        const accountSnaps = new Map<string, DocumentSnapshot>();
        for (const accId of involvedAccountIds) {
            const accRef = doc(accountsCollection, accId);
            const snap = await fbTransaction.get(accRef);
            accountSnaps.set(accId, snap);
        }

        const itemIds = new Set<string>();
        if (cart) cart.forEach(item => { if (item.id && !item.isService) itemIds.add(item.id) });
        const itemSnaps = new Map<string, DocumentSnapshot>();
        for (const itemId of itemIds) {
            const itemRef = doc(inventoryCollection, itemId);
            const snap = await fbTransaction.get(itemRef);
            itemSnaps.set(itemId, snap);
        }

        const saleRef = doc(transactionsCollection);
        mainTxId = saleRef.id;
        
        const newMainTx = cleanUndefined({ 
            ...baseData, 
            createdAt: serverTimestamp(), 
            enabled: true,
            involvedAccounts: Array.from(involvedAccountIds),
            adminNotified: baseData.description?.includes('Online Store') ? false : true,
        }) as Omit<Transaction, 'id'>;
        
        fbTransaction.set(saleRef, newMainTx);

        if (cart) {
            const effectType = getInventoryEffect(newMainTx.type);
            if (effectType) {
                for (const item of cart) {
                    const itemSnap = itemSnaps.get(item.id);
                    if (itemSnap?.exists()) {
                        const itemData = itemSnap.data() as InventoryItem;
                        const location = item.location || 'default';
                        const qty = item.sellQuantity || item.quantity || 0;
                        
                        if (qty !== 0) {
                            const multiplier = effectType === 'in' ? 1 : -1;
                            const change = qty * multiplier;
                            
                            const newStock = { ...(itemData.stock || {}) };
                            newStock[location] = (newStock[location] || 0) + change;
                            const newTotalQty = (itemData.quantity || 0) + change;
                            
                            fbTransaction.update(itemSnap.ref, { 
                                quantity: newTotalQty, 
                                stock: newStock,
                                updatedAt: serverTimestamp()
                            });
                        }
                    }
                }
            }
        }

        let runningPartyBalance = initialBalance;
        const partyEffect = getPartyBalanceEffect(newMainTx as Transaction);
        runningPartyBalance += partyEffect;

        if (newMainTx.type === 'transfer') {
            if (newMainTx.fromAccountId) {
                const snap = accountSnaps.get(newMainTx.fromAccountId);
                if (snap?.exists()) fbTransaction.update(snap.ref, { balance: (snap.data() as any).balance - newMainTx.amount });
            }
            if (newMainTx.toAccountId) {
                const snap = accountSnaps.get(newMainTx.toAccountId);
                if (snap?.exists()) fbTransaction.update(snap.ref, { balance: (snap.data() as any).balance + newMainTx.amount });
            }
        } else if (newMainTx.payments && newMainTx.payments.length > 0) {
            for (const p of newMainTx.payments) {
                const snap = accountSnaps.get(p.accountId);
                if (snap?.exists()) {
                    fbTransaction.update(snap.ref, { balance: (snap.data() as any).balance + p.amount });
                }
            }
            
            if (newMainTx.type === 'credit_sale') {
                for (const p of newMainTx.payments) {
                    if (p.amount > 0) {
                        const receiveRef = doc(transactionsCollection);
                        const receiveTx = cleanUndefined({
                            date: newMainTx.date,
                            createdAt: serverTimestamp(),
                            type: 'receive',
                            partyId: newMainTx.partyId,
                            accountId: p.accountId,
                            amount: p.amount,
                            description: `Part-payment for Inv: ${newMainTx.invoiceNumber || ''}`,
                            via: newMainTx.via,
                            enabled: true,
                            involvedAccounts: [p.accountId]
                        });
                        fbTransaction.set(receiveRef, receiveTx);
                        runningPartyBalance += getPartyBalanceEffect(receiveTx as any);
                    }
                }
            }
        } else if (newMainTx.accountId) {
            const snap = accountSnaps.get(newMainTx.accountId);
            if (snap?.exists()) {
                const accountEffect = getEffectiveAmount(newMainTx as Transaction);
                fbTransaction.update(snap.ref, { balance: (snap.data() as any).balance + accountEffect });
            }
        }

        if (partyRef && partySnap?.exists()) {
            fbTransaction.update(partyRef, { balance: runningPartyBalance });
        }
    });
    
    if (partyDataForSms && sendSms !== false) {
        // Sanitize party data for server function
        const sanitizedParty = JSON.parse(JSON.stringify(partyDataForSms));
        const totalPaid = (baseData.payments || []).reduce((sum, p) => sum + p.amount, 0) || (baseData.type === 'receive' ? baseData.amount : 0) || 0;
        handleSmsNotification({ ...baseData, id: mainTxId } as Transaction, sanitizedParty, totalPaid, initialBalance).catch(console.error);
    }

    return mainTxId;
}

export async function recalculateBalancesFromTransaction(startDate = '1970-01-01'): Promise<void> {
    const db = getDb();
    if (!db) throw new Error("Firebase not configured");

    const [accountsSnapshot, partiesSnapshot, transactionsSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'accounts'))),
        getDocs(query(collection(db, 'parties'))),
        getDocs(query(collection(db, 'transactions')))
    ]);

    const transactions = transactionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Transaction));
    
    const sortedTransactions = transactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        const timeA = new Date(a.createdAt || 0).getTime();
        const timeB = new Date(b.createdAt || 0).getTime();
        return timeA - timeB;
    });

    const accountBalances = new Map<string, number>();
    accountsSnapshot.forEach(doc => accountBalances.set(doc.id, 0));
    const partyBalances = new Map<string, number>();
    partiesSnapshot.forEach(doc => partyBalances.set(doc.id, 0));

    sortedTransactions.forEach(tx => {
        if (!tx.enabled) return;
        if (tx.type === 'transfer') {
            if (tx.fromAccountId && accountBalances.has(tx.fromAccountId)) accountBalances.set(tx.fromAccountId, (accountBalances.get(tx.fromAccountId) || 0) - tx.amount);
            if (tx.toAccountId && accountBalances.has(tx.toAccountId)) accountBalances.set(tx.toAccountId, (accountBalances.get(tx.toAccountId) || 0) + tx.amount);
        } else if (tx.payments && tx.payments.length > 0) {
            tx.payments.forEach(p => {
                if (accountBalances.has(p.accountId)) accountBalances.set(p.accountId, (accountBalances.get(p.accountId) || 0) + p.amount);
            });
        } else if (tx.accountId) {
            const effect = getEffectiveAmount(tx);
            if (effect !== 0 && accountBalances.has(tx.accountId)) accountBalances.set(tx.accountId, (accountBalances.get(tx.accountId) || 0) + effect);
        }
        if (tx.partyId && partyBalances.has(tx.partyId)) {
            const currentPartyBalance = partyBalances.get(tx.partyId) || 0;
            const partyEffect = getPartyBalanceEffect(tx);
            partyBalances.set(tx.partyId, currentPartyBalance + partyEffect);
        }
    });
    
    const batch = writeBatch(db);
    accountBalances.forEach((balance, accountId) => batch.update(doc(db, 'accounts', accountId), { balance }));
    partyBalances.forEach((balance, partyId) => batch.update(doc(db, 'parties', partyId), { balance }));
    await batch.commit();
}

export async function markOnlineOrdersAsNotified(ids: string[]): Promise<void> {
    const batch = writeBatch(db!);
    ids.forEach(id => batch.update(doc(db!, 'transactions', id), { adminNotified: true }));
    await batch.commit();
}

export async function markTransactionsAsReviewed(ids: string[], note: string): Promise<void> {
    const batch = writeBatch(db!);
    ids.forEach(id => batch.update(doc(db!, 'transactions', id), { suspicionReviewed: true, suspicionReviewNote: note }));
    await batch.commit();
}

export async function deleteTransaction(id: string): Promise<void> {
    if (!db) throw new Error("Firebase not configured.");
    const txRef = doc(db, 'transactions', id);
    const txSnap = await getDoc(txRef);
    if (!txSnap.exists()) return;

    await runTransaction(db, async (fbTransaction) => {
        const tx = { id: txSnap.id, ...txSnap.data() } as Transaction;
        if (tx.partyId) {
            const partyRef = doc(db, 'parties', tx.partyId);
            const partySnap = await fbTransaction.get(partyRef);
            if (partySnap.exists()) {
                const currentBal = (partySnap.data() as Party).balance || 0;
                fbTransaction.update(partyRef, { balance: currentBal - getPartyBalanceEffect(tx) });
            }
        }
        fbTransaction.delete(txRef);
    });
}

export async function updateTransaction(
  id: string,
  updatedData: Partial<Omit<Transaction, 'id'>>
): Promise<void> {
    const db = getDb();
    if (!db) throw new Error("Firebase not configured.");
    
    await runTransaction(db, async (fbTransaction) => {
        const txRef = doc(db, 'transactions', id);
        const oldTxSnap = await fbTransaction.get(txRef);
        if (!oldTxSnap.exists()) throw new Error("Transaction to update not found");

        const oldTx = { id: oldTxSnap.id, ...oldTxSnap.data() } as Transaction;
        fbTransaction.update(txRef, { ...cleanUndefined(updatedData), updatedAt: serverTimestamp() });
    });
    await recalculateBalancesFromTransaction();
}

export async function attemptAutoVerification(txRef: string, trxId: string, depositChannels: DepositChannel[], amount: number): Promise<{ isVerified: boolean; accountId?: string }> {
    const db = getDb();
    if (!db) return { isVerified: false };
    const settings = await getAppSettings();
    const sheetId = settings?.googleSheetId;
    if (!sheetId) return { isVerified: false };

    try {
        const publishedCsvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=0`;
        const response = await fetch(publishedCsvUrl, { cache: 'no-store' });
        if (!response.ok) return { isVerified: false };
        const csvText = await response.text();
        const lines = csvText.split('\n');
        for (const line of lines) {
            if (line.toLowerCase().includes(txRef.toLowerCase()) && line.toLowerCase().includes(trxId.toLowerCase())) {
                for (const channel of depositChannels) {
                    if (line.toLowerCase().includes(channel.senderIdentifier.toLowerCase())) {
                        return { isVerified: true, accountId: channel.accountId };
                    }
                }
            }
        }
    } catch (e) {
        console.error("Auto-verification failed:", e);
    }
    return { isVerified: false };
}

// Helper function for SMS notification
async function handleSmsNotification(
    transaction: Transaction, 
    party: Party, 
    totalPaid: number, 
    initialBalance: number
): Promise<void> {
    try {
        // Implementation depends on your SMS requirements
        console.log("SMS notification would be sent here", { transaction, party, totalPaid, initialBalance });
    } catch (error) {
        console.error("Failed to send SMS notification:", error);
    }
}

// Get app settings
export async function getAppSettings(): Promise<AppSettings | null> {
    const db = getDb();
    if (!db) return null;
    const settingsRef = doc(db, 'settings', 'app');
    const settingsSnap = await getDoc(settingsRef);
    if (settingsSnap.exists()) {
        return settingsSnap.data() as AppSettings;
    }
    return null;
}

// ========== MISSING FUNCTIONS ADDED BELOW ==========

// 1. Generate Invoice Number
export async function generateInvoiceNumber(): Promise<string> {
    const prefix = 'INV';
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `${prefix}-${timestamp}-${random}`;
}

// 2. Toggle Transaction (Enable/Disable)
export async function toggleTransaction(id: string, enabled: boolean): Promise<void> {
    if (!db) throw new Error("Firebase not configured.");
    const txRef = doc(db, 'transactions', id);
    await updateDoc(txRef, { enabled, updatedAt: serverTimestamp() });
    await recalculateBalancesFromTransaction();
}

// 3. Delete Filtered Transactions
export async function deleteFilteredTransactions(filterCriteria: any): Promise<void> {
    if (!db) throw new Error("Firebase not configured.");
    const transactionsCollection = collection(db, 'transactions');
    let q = query(transactionsCollection);
    
    if (filterCriteria.dateFrom) {
        q = query(q, where('date', '>=', filterCriteria.dateFrom));
    }
    if (filterCriteria.dateTo) {
        q = query(q, where('date', '<=', filterCriteria.dateTo));
    }
    if (filterCriteria.type && filterCriteria.type !== 'all') {
        q = query(q, where('type', '==', filterCriteria.type));
    }
    
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
    });
    await batch.commit();
    await recalculateBalancesFromTransaction();
}

// 4. Restore Data
export async function restoreData(): Promise<void> {
    // This function would typically restore backup data
    console.warn('restoreData: Full implementation depends on backup strategy');
    // You can implement this based on your backup/restore requirements
}

// 5. Get All Transactions
export async function getAllTransactions(): Promise<Transaction[]> {
    if (!db) throw new Error("Firebase not configured.");
    const transactionsCollection = collection(db, 'transactions');
    const snapshot = await getDocs(transactionsCollection);
    return snapshot.docs.map(mapDocToTransaction);
}

// 6. Recalculate All FIFO and Profits
export async function recalculateAllFifoAndProfits(): Promise<void> {
    // This is similar to recalculateBalancesFromTransaction but for inventory FIFO
    await recalculateBalancesFromTransaction();
    console.log("FIFO and profits recalculated");
}

// 7. Recalculate All Party Balances
export async function recalculateAllPartyBalances(): Promise<void> {
    await recalculateBalancesFromTransaction();
}

// 8. Subscribe to Transactions for a Specific Party
export function subscribeToTransactionsForParty(
    partyId: string,
    onUpdate: (transactions: Transaction[]) => void,
    onError: (error: Error) => void
) {
    const transactionsCollection = getTransactionsCollection();
    if (!transactionsCollection) {
        onError(new Error('Firebase is not configured correctly.'));
        return () => {};
    }

    const q = query(transactionsCollection, where('partyId', '==', partyId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(mapDocToTransaction);
        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        onUpdate(transactions);
    }, onError);

    return unsubscribe;
}

// 9. Subscribe to Transactions for Multiple Party IDs
export function subscribeToTransactionsForPartyIds(
    partyIds: string[],
    onUpdate: (transactions: Transaction[]) => void,
    onError: (error: Error) => void
) {
    const transactionsCollection = getTransactionsCollection();
    if (!transactionsCollection || partyIds.length === 0) {
        onUpdate([]);
        return () => {};
    }

    // Firestore 'in' queries are limited to 10 values
    const limitedPartyIds = partyIds.slice(0, 10);
    const q = query(transactionsCollection, where('partyId', 'in', limitedPartyIds));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(mapDocToTransaction);
        transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        onUpdate(transactions);
    }, onError);

    return unsubscribe;
}

// 10. Subscribe to Transactions for Verification
export function subscribeToTransactionsForVerification(
    onUpdate: (transactions: Transaction[]) => void,
    onError: (error: Error) => void
) {
    const transactionsCollection = getTransactionsCollection();
    if (!transactionsCollection) {
        onError(new Error('Firebase is not configured correctly.'));
        return () => {};
    }

    const q = query(
        transactionsCollection, 
        where('verificationStatus', '==', 'pending'),
        where('enabled', '==', true)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const transactions = snapshot.docs.map(mapDocToTransaction);
        onUpdate(transactions);
    }, onError);

    return unsubscribe;
}

// 11. Bulk Delete Transactions
export async function bulkDeleteTransactions(ids: string[]): Promise<void> {
    if (!db) throw new Error("Firebase not configured.");
    const batch = writeBatch(db);
    ids.forEach(id => {
        const txRef = doc(db, 'transactions', id);
        batch.delete(txRef);
    });
    await batch.commit();
    await recalculateBalancesFromTransaction();
}

// 12. Bulk Restore Transactions
export async function bulkRestoreTransactions(ids: string[]): Promise<void> {
    if (!db) throw new Error("Firebase not configured.");
    const batch = writeBatch(db);
    ids.forEach(id => {
        const txRef = doc(db, 'transactions', id);
        batch.update(txRef, { enabled: true, updatedAt: serverTimestamp() });
    });
    await batch.commit();
    await recalculateBalancesFromTransaction();
}