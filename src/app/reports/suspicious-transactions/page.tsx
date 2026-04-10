
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, AlertTriangle, Eye, CheckCircle, History } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Transaction, Party, InventoryItem, Account, AppSettings } from '@/types';
import { subscribeToAllTransactions, updateTransaction, markTransactionsAsReviewed } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { formatAmount, formatDate, getEffectiveAmount } from '@/lib/utils';
import { differenceInMinutes, parseISO } from 'date-fns';
import PartyTransactionEditDialog from '@/components/PartyTransactionEditDialog';
import { subscribeToAccounts } from '@/services/accountService';
import { getAppSettings } from '@/services/settingsService';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from '@/components/ui/badge';


const DUPLICATE_TIME_WINDOW = 5; // in minutes

interface SuspiciousEntry {
    transactions: Transaction[];
    reason: string;
    details: string;
    accountName?: string;
}

export default function SuspiciousTransactionsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [parties, setParties] = useState<Party[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [reviewingEntry, setReviewingEntry] = useState<SuspiciousEntry | null>(null);
    const [reviewNote, setReviewNote] = useState('');


    useEffect(() => {
        setLoading(true);
        const unsubTransactions = subscribeToAllTransactions(
            (data) => {
                setTransactions(data);
                setLoading(false);
            },
            (err) => {
                toast({ variant: 'destructive', title: 'Error', description: err.message });
                setLoading(false);
            }
        );
        const unsubParties = subscribeToParties(setParties, console.error);
        const unsubInventory = subscribeToInventoryItems(setInventory, console.error);
        const unsubAccounts = subscribeToAccounts(setAccounts, console.error);
        getAppSettings().then(setAppSettings);
        
        return () => {
            unsubTransactions();
            unsubParties();
            unsubInventory();
            unsubAccounts();
        };
    }, [toast]);
    
    const { potentialDuplicates, priceAnomalies, balanceFlips, reviewedEntries } = useMemo(() => {
        if (transactions.length === 0) return { potentialDuplicates: [], priceAnomalies: [], balanceFlips: [], reviewedEntries: [] };

        const unreviewedTransactions = transactions.filter(t => !t.suspicionReviewed);
        const reviewedTransactions = transactions.filter(t => t.suspicionReviewed);
        const accountMap = new Map(accounts.map(acc => [acc.id, acc.name]));

        // --- 1. Potential Duplicates ---
        const duplicatesMap = new Map<string, Transaction[]>();
        const sortedByTime = [...unreviewedTransactions].sort((a,b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());

        for (let i = 0; i < sortedByTime.length - 1; i++) {
            const tx1 = sortedByTime[i];
            for (let j = i + 1; j < sortedByTime.length; j++) {
                const tx2 = sortedByTime[j];
                
                const timeDiff = differenceInMinutes(new Date(tx2.createdAt || 0), new Date(tx1.createdAt || 0));
                if (timeDiff > DUPLICATE_TIME_WINDOW) break;

                const isSimilar = tx1.amount === tx2.amount && tx1.partyId === tx2.partyId && tx1.type === tx2.type && tx1.date === tx2.date;
                
                if (isSimilar) {
                    const key = `${tx1.date}-${tx1.partyId}-${tx1.amount}`;
                    const group = duplicatesMap.get(key) || [tx1];
                    if (!group.some(t => t.id === tx2.id)) {
                        group.push(tx2);
                    }
                    duplicatesMap.set(key, group);
                }
            }
        }
        const potentialDuplicates: SuspiciousEntry[] = Array.from(duplicatesMap.values())
            .filter(group => group.length > 1)
            .map(group => ({
                transactions: group,
                reason: 'Potential Duplicate Entry',
                details: `Multiple transactions with same amount, party, type, and date within a short time.`
            }));

        // --- 2. Price Anomalies ---
        const itemPriceHistory = new Map<string, { lastSalePrice: number; lastCost: number }>();
        const priceAnomalies: SuspiciousEntry[] = [];
        
        const sortedByDate = [...unreviewedTransactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        sortedByDate.forEach(tx => {
            if ((tx.type === 'sale' || tx.type === 'credit_sale' || tx.type === 'purchase' || tx.type === 'credit_purchase') && tx.items) {
                tx.items.forEach(item => {
                    const isSale = tx.type === 'sale' || tx.type === 'credit_sale';
                    const history = itemPriceHistory.get(item.id) || { lastSalePrice: 0, lastCost: 0 };
                    
                    const priceToCheck = isSale ? item.price : (item.cost || 0);
                    const lastPrice = isSale ? history.lastSalePrice : history.lastCost;

                    if (lastPrice > 0) {
                        const priceDifference = Math.abs(priceToCheck - lastPrice);

                        if (isSale) {
                            // Rule for sales: check if price increased or decreased by more than 10
                            if (priceDifference > 10) {
                                priceAnomalies.push({
                                    transactions: [tx],
                                    reason: `Significant Sale Price Change`,
                                    details: `${item.name}: Price changed from ${formatAmount(lastPrice)} to ${formatAmount(priceToCheck)}`
                                });
                            }
                        } else { // It's a purchase
                            // Rule for purchases: check only if price increased by more than 10
                            if (priceToCheck > lastPrice && priceDifference > 10) {
                                priceAnomalies.push({
                                    transactions: [tx],
                                    reason: `Significant Purchase Price Increase`,
                                    details: `${item.name}: Cost increased from ${formatAmount(lastPrice)} to ${formatAmount(priceToCheck)}`
                                });
                            }
                        }
                    }

                    // Update history for next iteration
                    if (isSale && item.price > 0) {
                        history.lastSalePrice = item.price;
                    } else if (!isSale && (item.cost || 0) > 0) {
                        history.lastCost = item.cost || 0;
                    }
                    itemPriceHistory.set(item.id, history);
                });
            }
        });
        
        // --- 3. Balance Flips ---
        const balanceFlips: SuspiciousEntry[] = [];
        const txsByAccount = new Map<string, Transaction[]>();

        unreviewedTransactions.forEach(tx => {
            const involved = tx.involvedAccounts || [];
            involved.forEach(accId => {
                if (!txsByAccount.has(accId)) txsByAccount.set(accId, []);
                txsByAccount.get(accId)!.push(tx);
            });
        });

        txsByAccount.forEach((accountTxs, accountId) => {
            const sortedAccountTxs = accountTxs.sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
            let runningBalance = 0;
            let lastTx: Transaction | null = null;
            for (const tx of sortedAccountTxs) {
                const prevBalance = runningBalance;
                const effect = getEffectiveAmount({ ...tx, accountId: accountId });
                runningBalance += effect;
                if (prevBalance >= 0 && runningBalance < 0) {
                    balanceFlips.push({
                        transactions: lastTx ? [lastTx, tx] : [tx],
                        reason: 'Account Balance Flip',
                        details: `Balance went from ${formatAmount(prevBalance)} to ${formatAmount(runningBalance)}.`,
                        accountName: accountMap.get(accountId)
                    });
                }
                lastTx = tx;
            }
        });

        // --- 4. Reviewed Entries ---
        const reviewedEntries: SuspiciousEntry[] = reviewedTransactions.map(tx => ({
            transactions: [tx],
            reason: `Reviewed: ${tx.suspicionReviewNote || 'No note'}`,
            details: `Originally flagged transaction.`
        }));

        return { potentialDuplicates, priceAnomalies, balanceFlips, reviewedEntries };
    }, [transactions, parties, inventory, accounts]);

    const handleUpdateTransaction = async (data: Omit<Transaction, 'id' | 'enabled'>) => {
        if (!editingTransaction) return;
        try {
          await updateTransaction(editingTransaction.id, { ...editingTransaction, ...data });
          toast({ title: "Success", description: "Transaction updated successfully." });
          setEditingTransaction(null);
        } catch (error: any) {
          console.error("Failed to update transaction", error);
          toast({ variant: 'destructive', title: "Error", description: `Could not update transaction: ${error.message}` });
        }
    };

    const handleMarkAsReviewed = async () => {
        if (!reviewingEntry) return;
        const ids = reviewingEntry.transactions.map(t => t.id);
        try {
            await markTransactionsAsReviewed(ids, reviewNote);
            toast({ title: "Marked as Reviewed", description: "This entry will now be hidden." });
            setReviewingEntry(null);
            setReviewNote('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not update the transactions.' });
        }
    };
    
    const quickNotes = [
        "Verified, not a duplicate.",
        "Two different entries.",
        "Data entry error, now corrected.",
        "Price change approved.",
    ];
    
    const SuspiciousList = ({ title, items }: { title: string, items: SuspiciousEntry[] }) => (
        <AccordionItem value={title}>
            <AccordionTrigger className="text-lg font-semibold">{title} ({items.length})</AccordionTrigger>
            <AccordionContent>
                {items.length > 0 ? (
                    <div className="space-y-4">
                        {items.map((item, index) => (
                             <Card key={index} className="bg-muted/40">
                                <CardHeader className="pb-2">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <CardTitle className="text-base">{item.reason}</CardTitle>
                                            <CardDescription>{item.details}</CardDescription>
                                            {item.accountName && <Badge variant="secondary" className="mt-1">{item.accountName}</Badge>}
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => setReviewingEntry(item)}>
                                            <CheckCircle className="mr-2 h-4 w-4"/>Mark as Reviewed
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {item.transactions.map(tx => (
                                                <TableRow key={tx.id}>
                                                    <TableCell>{formatDate(tx.date)}</TableCell>
                                                    <TableCell>{tx.description}</TableCell>
                                                    <TableCell className="text-right">{formatAmount(tx.amount)}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button variant="ghost" size="sm" onClick={() => setEditingTransaction(tx)}><Eye className="mr-2 h-4 w-4"/> View/Edit</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                             </Card>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground p-4 text-center">No issues found in this category.</p>
                )}
            </AccordionContent>
        </AccordionItem>
    );

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="mb-6">
                <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
            </div>
            
            <PartyTransactionEditDialog
                transaction={editingTransaction}
                parties={parties}
                accounts={accounts}
                inventoryItems={inventory}
                onOpenChange={(isOpen) => !isOpen && setEditingTransaction(null)}
                onSave={handleUpdateTransaction}
                appSettings={appSettings}
            />

             <Dialog open={!!reviewingEntry} onOpenChange={(open) => !open && setReviewingEntry(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Mark as Reviewed</DialogTitle>
                        <DialogDescription>Add an optional note to explain why this is being marked as reviewed (e.g., "Verified, not a duplicate").</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div>
                            <Label htmlFor="review-note">Review Note</Label>
                            <Input id="review-note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs text-muted-foreground">Quick Notes</Label>
                            <div className="flex flex-wrap gap-2">
                                {quickNotes.map(note => (
                                    <Button key={note} type="button" size="sm" variant="outline" onClick={() => setReviewNote(note)}>
                                        {note}
                                    </Button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button onClick={handleMarkAsReviewed}>Confirm & Mark</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl"><AlertTriangle className="text-orange-500"/>Suspicious Transactions</CardTitle>
                    <CardDescription>Review transactions that might be duplicates, have significant price changes, or other anomalies.</CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center items-center h-48"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : (
                         <Tabs defaultValue="pending">
                            <TabsList>
                                <TabsTrigger value="pending">Pending Review</TabsTrigger>
                                <TabsTrigger value="history">Reviewed History</TabsTrigger>
                            </TabsList>
                            <TabsContent value="pending" className="pt-4">
                                <Accordion type="multiple" defaultValue={['Potential Duplicates', 'Significant Price Changes', 'Account Balance Flip']} className="w-full">
                                    <SuspiciousList title="Potential Duplicates" items={potentialDuplicates} />
                                    <SuspiciousList title="Significant Price Changes" items={priceAnomalies} />
                                    <SuspiciousList title="Account Balance Flip" items={balanceFlips} />
                                </Accordion>
                            </TabsContent>
                            <TabsContent value="history" className="pt-4">
                                 <Table>
                                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Review Note</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {reviewedEntries.length > 0 ? reviewedEntries.map(entry => entry.transactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{formatDate(tx.date)}</TableCell>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell><Badge variant="secondary">{tx.suspicionReviewNote}</Badge></TableCell>
                                                <TableCell className="text-right">{formatAmount(tx.amount)}</TableCell>
                                            </TableRow>
                                        ))) : (
                                            <TableRow><TableCell colSpan={4} className="text-center h-24">No reviewed items yet.</TableCell></TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TabsContent>
                         </Tabs>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
