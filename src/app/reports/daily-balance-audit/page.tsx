

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2, ArrowDown, ArrowUp, DollarSign, BookOpen, History, ChevronLeft, ChevronRight, MoreVertical, Edit, Trash2, FilePlus } from 'lucide-react';
import type { Transaction, Account, Party, AppSettings, InventoryItem } from '@/types';
import { subscribeToAllTransactions, updateTransaction, toggleTransaction, addTransaction } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { formatDate, formatAmount, getEffectiveAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format as formatFns, startOfMonth, addDays, parseISO } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import PartyTransactionEditDialog from '@/components/PartyTransactionEditDialog';


export default function DailyBalanceAuditReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => {
    return {
        date: new Date(),
        accountId: '',
    };
  });
  const { toast } = useToast();
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [isBadLedgerOpen, setIsBadLedgerOpen] = useState(false);
  const [badLedgerType, setBadLedgerType] = useState<'spent' | 'income' | 'transfer'>('spent');
  const [badLedgerAmount, setBadLedgerAmount] = useState<number | ''>('');
  const [badLedgerDesc, setBadLedgerDesc] = useState('');
  const [transferToAccount, setTransferToAccount] = useState('');


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
    const unsubAccounts = subscribeToAccounts((accs) => {
        setAccounts(accs);
        if (accs.length > 0 && !filters.accountId) {
            const cashAccount = accs.find(a => a.name.toLowerCase().includes('cash')) || accs[0];
            setFilters(f => ({ ...f, accountId: cashAccount.id }));
        }
    }, (err) => {
        toast({ variant: 'destructive', title: 'Error fetching accounts', description: err.message });
        setLoading(false);
    });
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error fetching parties', description: err.message }));
    const unsubInventory = subscribeToInventoryItems(setInventoryItems, (err) => toast({ variant: 'destructive', title: 'Error fetching inventory', description: err.message }));
    getAppSettings().then(setAppSettings);


    const timer = setTimeout(() => setLoading(false), 1500);

    return () => {
      unsubTransactions();
      unsubAccounts();
      unsubParties();
      unsubInventory();
      clearTimeout(timer);
    };
  }, [toast]);

  const { reportData, openingBalance, closingBalance, totalInflow, totalOutflow } = useMemo(() => {
    if (!filters.accountId || !filters.date) {
        return { reportData: [], openingBalance: 0, closingBalance: 0, totalInflow: 0, totalOutflow: 0 };
    }
    
    const getAccountEffect = (tx: Transaction, accountId: string): number => {
        if (!tx.enabled) return 0;
        
        let effect = 0;
        // Transfer
        if (tx.type === 'transfer') {
            if (tx.fromAccountId === accountId) effect -= tx.amount;
            if (tx.toAccountId === accountId) effect += tx.amount;
        } 
        // Sale with multiple payments
        else if ((tx.type === 'sale' || tx.type === 'credit_sale') && tx.payments && tx.payments.length > 0) {
             const payment = tx.payments.find(p => p.accountId === accountId);
             if (payment) {
                 // For a sale, a payment is money IN to the account
                effect = payment.amount;
             }
        } 
        // Simple transaction
        else if (tx.accountId === accountId) {
            effect = getEffectiveAmount(tx);
        }
        return effect;
    }

    const selectedDateStr = formatFns(filters.date, 'yyyy-MM-dd');
    
    const sortedTransactions = [...transactions]
        .filter(t => t.enabled)
        .sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            
            const timeA = (a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : new Date(a.createdAt || 0).getTime();
            const timeB = (b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : new Date(b.createdAt || 0).getTime();
            
            if (isNaN(timeA) || isNaN(timeB)) return 0;
            return timeA - timeB;
        });
        
    let openingBal = 0;
    
    sortedTransactions.forEach(t => {
        if (t.date < selectedDateStr) {
             if(t.involvedAccounts?.includes(filters.accountId)){
                openingBal += getAccountEffect(t, filters.accountId);
             }
        }
    });

    const dailyTransactions = sortedTransactions.filter(t => 
        t.date === selectedDateStr && t.involvedAccounts?.includes(filters.accountId)
    );

    let currentBalance = openingBal;
    let totalInflow = 0;
    let totalOutflow = 0;

    const reportData = dailyTransactions.map(t => {
        const effect = getAccountEffect(t, filters.accountId);
        
        let cashIn = 0;
        let cashOut = 0;

        if (effect > 0) cashIn = effect;
        else cashOut = Math.abs(effect);
        
        totalInflow += cashIn;
        totalOutflow += cashOut;
        currentBalance += effect;
        
        return {
            ...t,
            cashIn,
            cashOut,
            balance: currentBalance,
        };
    }).filter(item => item.cashIn > 0 || item.cashOut > 0) as (Transaction & { cashIn: number; cashOut: number; balance: number; })[];

    return { reportData, openingBalance: openingBal, closingBalance: currentBalance, totalInflow, totalOutflow };
  }, [transactions, filters]);


  const { negativeBalanceDates } = useMemo(() => {
    if (!filters.accountId) return { negativeBalanceDates: [] };

    const accountTxs = transactions
        .filter(t => t.enabled && t.involvedAccounts?.includes(filters.accountId))
        .sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return (new Date(a.createdAt || 0).getTime()) - (new Date(b.createdAt || 0).getTime());
        });
    
    const dailyBalances = new Map<string, number>();
    let runningBalance = 0;

    for (const tx of accountTxs) {
        let effect = 0;
        if (tx.type === 'transfer') {
            if (tx.fromAccountId === filters.accountId) effect = -tx.amount;
            if (tx.toAccountId === filters.accountId) effect = tx.amount;
        } else if (tx.payments?.length) { // Sales with payments
             const payment = tx.payments.find(p => p.accountId === filters.accountId);
             if (payment) effect = getEffectiveAmount({ ...tx, type: 'receive', amount: payment.amount });
        } else if (tx.accountId === filters.accountId) { // Simple transactions
            effect = getEffectiveAmount(tx);
        }
        
        if (effect !== 0) {
          runningBalance += effect;
          dailyBalances.set(tx.date, runningBalance);
        }
    }
    
    const negativeDates = Array.from(dailyBalances.entries())
        .filter(([_, balance]) => balance < 0)
        .map(([date, balance]) => ({ date, balance }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
    return { negativeBalanceDates: negativeDates };
  }, [transactions, filters.accountId]);

  const handlePrint = () => window.print();

  const handleDateChange = (days: number) => {
    setFilters(f => {
      const newDate = new Date(f.date);
      newDate.setDate(newDate.getDate() + days);
      return { ...f, date: newDate };
    });
  };

  const handleUpdate = async (data: Omit<Transaction, 'id' | 'enabled'>) => {
    if (!editingTransaction) return;
    try {
      await updateTransaction(editingTransaction.id, data);
      if (data.date && formatFns(new Date(data.date), 'yyyy-MM-dd') !== formatFns(filters.date, 'yyyy-MM-dd')) {
        setFilters(f => ({ ...f, date: new Date(data.date as Date) }));
        toast({ title: 'Date Changed', description: `Report view updated to ${formatDate(data.date as Date)}.`});
      }
      toast({ title: "Success", description: "Transaction updated successfully." });
      setEditingTransaction(null);
    } catch (error: any) {
      console.error("Failed to update transaction", error);
      toast({ variant: 'destructive', title: "Error", description: `Could not update transaction: ${error.message}` });
    }
  };

  const handleDelete = async (id: string) => {
      try {
        await toggleTransaction(id, false);
        toast({ title: 'Transaction Disabled', description: 'The transaction has been moved to the activity log.'});
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Error', description: 'Could not disable the transaction.' });
      }
  };
  
  const handleSaveBadLedger = async () => {
    if (!badLedgerAmount || badLedgerAmount <= 0) {
        toast({ variant: 'destructive', title: 'Invalid Amount' });
        return;
    }

    const description = badLedgerDesc.trim() || `Bad Ledger Entry (${badLedgerType})`;

    try {
        if (badLedgerType === 'transfer') {
            if (!transferToAccount) {
                toast({ variant: 'destructive', title: 'Select transfer account' });
                return;
            }
            await addTransaction({
                date: formatFns(filters.date, 'yyyy-MM-dd'),
                type: 'transfer',
                amount: Number(badLedgerAmount),
                fromAccountId: filters.accountId,
                toAccountId: transferToAccount,
                description,
                enabled: true,
            });
        } else {
            await addTransaction({
                date: formatFns(filters.date, 'yyyy-MM-dd'),
                type: badLedgerType,
                amount: Number(badLedgerAmount),
                accountId: filters.accountId,
                description,
                enabled: true,
            });
        }
        toast({ title: 'Success', description: 'Bad ledger entry created.' });
        setIsBadLedgerOpen(false);
        setBadLedgerAmount('');
        setBadLedgerDesc('');
        setTransferToAccount('');
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  
  const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || '';
  const getAccountName = (accountId?: string) => accounts.find(a => a.id === accountId)?.name || '';


  return (
    <>
      <style>{`
        @page {
          size: A4;
          margin: 1.5cm;
        }
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none; }
           .print-area table th, .print-area table td {
            padding: 4px 8px;
            font-size: 10pt;
          }
          .print-area table thead {
            background-color: #f2f2f2 !important;
          }
        }
      `}</style>
      <div className="no-print mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>

        <PartyTransactionEditDialog
            transaction={editingTransaction}
            parties={parties}
            accounts={accounts}
            inventoryItems={inventoryItems}
            onOpenChange={(isOpen) => !isOpen && setEditingTransaction(null)}
            onSave={handleUpdate}
            appSettings={appSettings}
      />
      
       <Dialog open={isBadLedgerOpen} onOpenChange={setIsBadLedgerOpen}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Add Bad Ledger Entry</DialogTitle>
                    <DialogDescription>
                        For: {accounts.find(a => a.id === filters.accountId)?.name} on {formatDate(filters.date)}
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1">
                        <Label>Type</Label>
                        <Select value={badLedgerType} onValueChange={(v) => setBadLedgerType(v as any)}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="income">Sale / Income</SelectItem>
                                <SelectItem value="spent">Expense</SelectItem>
                                <SelectItem value="transfer">Transfer</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1">
                        <Label>Amount</Label>
                        <Input type="number" value={badLedgerAmount} onChange={e => setBadLedgerAmount(Number(e.target.value))} placeholder="0.00" />
                    </div>
                     <div className="space-y-1">
                        <Label>Description</Label>
                        <Input value={badLedgerDesc} onChange={e => setBadLedgerDesc(e.target.value)} placeholder="e.g., Unaccounted cash" />
                    </div>
                    {badLedgerType === 'transfer' && (
                        <div className="space-y-1">
                            <Label>To Account</Label>
                            <Select value={transferToAccount} onValueChange={setTransferToAccount}>
                                <SelectTrigger><SelectValue placeholder="Select account..."/></SelectTrigger>
                                <SelectContent>
                                    {accounts.filter(a => a.id !== filters.accountId).map(acc => (
                                        <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setIsBadLedgerOpen(false)}>Cancel</Button>
                    <Button onClick={handleSaveBadLedger}>Save Entry</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>


      <div className="print-area">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><BookOpen /> Daily Balance Audit</CardTitle>
                <CardDescription>Review daily balances to find discrepancies.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border rounded-lg no-print items-end">
              <div className="space-y-1">
                  <Label>Account</Label>
                  <Select value={filters.accountId} onValueChange={v => setFilters({...filters, accountId: v})}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                          {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                      </SelectContent>
                  </Select>
              </div>
              <div className="flex gap-2 items-end">
                <Button variant="outline" size="icon" onClick={() => handleDateChange(-1)}>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="space-y-1 flex-grow">
                  <Label>Date</Label>
                  <DatePicker value={filters.date} onChange={d => setFilters({...filters, date: d as Date})} />
                </div>
                <Button variant="outline" size="icon" onClick={() => handleDateChange(1)}>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="icon" title="View Negative Balance History">
                            <History className="h-4 w-4" />
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Negative Balance History</DialogTitle>
                            <DialogDescription>Dates when this account had a negative balance.</DialogDescription>
                        </DialogHeader>
                        <div className="max-h-96 overflow-y-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Closing Balance</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {negativeBalanceDates.length > 0 ? negativeBalanceDates.map(({ date, balance }) => (
                                        <TableRow 
                                            key={date} 
                                            className="cursor-pointer" 
                                            onClick={() => {
                                                setFilters(f => ({ ...f, date: new Date(date) }));
                                                setIsHistoryDialogOpen(false);
                                            }}
                                        >
                                            <TableCell>{formatDate(date)}</TableCell>
                                            <TableCell className="text-right font-mono text-red-600">{formatAmount(balance)}</TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={2} className="text-center h-24">No negative balance history found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </DialogContent>
                </Dialog>
                <Button variant="outline" size="icon" title="Add Bad Ledger Entry" onClick={() => setIsBadLedgerOpen(true)}>
                    <FilePlus className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                  <Card><CardHeader className="p-3"><CardTitle className="text-sm font-medium">Opening Balance</CardTitle><CardDescription className="text-lg font-bold">{formatAmount(openingBalance)}</CardDescription></CardHeader></Card>
                  <Card><CardHeader className="p-3"><CardTitle className="text-sm font-medium text-green-600">Total Inflow</CardTitle><CardDescription className="text-lg font-bold text-green-600">{formatAmount(totalInflow)}</CardDescription></CardHeader></Card>
                  <Card><CardHeader className="p-3"><CardTitle className="text-sm font-medium text-red-600">Total Outflow</CardTitle><CardDescription className="text-lg font-bold text-red-600">{formatAmount(totalOutflow)}</CardDescription></CardHeader></Card>
                  <Card><CardHeader className="p-3"><CardTitle className="text-sm font-medium">Closing Balance</CardTitle><CardDescription className="text-lg font-bold">{formatAmount(closingBalance)}</CardDescription></CardHeader></Card>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Inflow</TableHead>
                    <TableHead className="text-right">Outflow</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right no-print">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                  ) : reportData.length > 0 ? (
                    reportData.map(item => (
                          <TableRow key={item.id}>
                              <TableCell>{formatDate(item.date)}</TableCell>
                              <TableCell>
                                <p>{item.description}</p>
                                <div className="text-xs text-muted-foreground">
                                    {item.type === 'transfer'
                                    ? `${getAccountName(item.fromAccountId)} → ${getAccountName(item.toAccountId)}`
                                    : getPartyName(item.partyId)
                                    }
                                </div>
                               </TableCell>
                              <TableCell className="text-right font-mono text-green-600">{item.cashIn > 0 ? formatAmount(item.cashIn) : '-'}</TableCell>
                              <TableCell className="text-right font-mono text-red-600">{item.cashOut > 0 ? formatAmount(item.cashOut) : '-'}</TableCell>
                              <TableCell className="text-right font-mono">{formatAmount(item.balance)}</TableCell>
                              <TableCell className="text-right no-print">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                      <DropdownMenuItem onClick={() => setEditingTransaction(item)}>
                                          <Edit className="mr-2 h-4 w-4"/> Edit
                                      </DropdownMenuItem>
                                       <AlertDialog>
                                          <AlertDialogTrigger asChild>
                                              <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive">
                                                  <Trash2 className="mr-2 h-4 w-4"/> Disable
                                              </DropdownMenuItem>
                                          </AlertDialogTrigger>
                                          <AlertDialogContent>
                                              <AlertDialogHeader>
                                                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                  <AlertDialogDescription>
                                                      This will disable the transaction. You can re-enable it from the Activity Log.
                                                  </AlertDialogDescription>
                                              </AlertDialogHeader>
                                              <AlertDialogFooter>
                                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                  <AlertDialogAction onClick={() => handleDelete(item.id)}>Disable</AlertDialogAction>
                                              </AlertDialogFooter>
                                          </AlertDialogContent>
                                      </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </TableCell>
                          </TableRow>
                      ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No transactions found for this day.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}


