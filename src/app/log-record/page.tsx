

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, BookOpen, Save, Calendar, BarChart2, Mail } from 'lucide-react';
import type { Transaction, Account, Party, LogRecord } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToParties } from '@/services/partyService';
import { addLogRecord, subscribeToLogRecords } from '@/services/logRecordService';
import { useToast } from '@/hooks/use-toast';
import { formatAmount, formatDate, getPartyBalanceEffect, getEffectiveAmount } from '@/lib/utils';
import { format as formatFns, startOfDay, endOfDay } from 'date-fns';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


export default function LogRecordPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [savedLogs, setSavedLogs] = useState<LogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(formatFns(new Date(), 'yyyy-MM-dd'));
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const unsubTransactions = subscribeToAllTransactions(setTransactions, console.error);
    const unsubAccounts = subscribeToAccounts(setAccounts, console.error);
    const unsubParties = subscribeToParties(setParties, console.error);
    const unsubLogs = subscribeToLogRecords(setSavedLogs, console.error);

    const timer = setTimeout(() => setLoading(false), 800);

    return () => {
      unsubTransactions();
      unsubAccounts();
      unsubParties();
      unsubLogs();
      clearTimeout(timer);
    };
  }, []);
  
  const dailyReport = useMemo(() => {
    const dateTxs = transactions.filter(t => t.date === selectedDate && t.enabled);

    const summary = dateTxs.reduce((acc, tx) => {
        if(tx.type === 'sale' || tx.type === 'credit_sale') acc.totalSales += tx.amount;
        if(tx.type === 'purchase' || tx.type === 'credit_purchase') acc.totalPurchases += tx.amount;
        if(tx.type === 'income') acc.totalIncome += tx.amount;
        if(tx.type === 'spent') acc.totalExpense += tx.amount;
        return acc;
    }, { totalSales: 0, totalPurchases: 0, totalIncome: 0, totalExpense: 0 });

    const netCashFlow = summary.totalIncome - summary.totalExpense;

    return { summary: {...summary, netCashFlow }, transactions: dateTxs };
  }, [transactions, selectedDate]);
  
 const { accountBalances, partyBalances } = useMemo(() => {
    const transactionsUntilSelectedDate = transactions.filter(t => t.date <= selectedDate && t.enabled);
    
    // Calculate Account Balances as of selectedDate
    const calculatedAccountBalances: { [id: string]: number } = {};
    accounts.forEach(acc => calculatedAccountBalances[acc.id] = 0);

    transactionsUntilSelectedDate.forEach(tx => {
       const txEffect = getEffectiveAmount(tx);
        // Direct transaction account
        if (tx.accountId && calculatedAccountBalances[tx.accountId] !== undefined) {
             if (tx.type !== 'sale' && tx.type !== 'credit_sale') {
                calculatedAccountBalances[tx.accountId] += txEffect;
            }
        }
        // Payments from a sale
        if (tx.payments) {
            tx.payments.forEach(p => {
                if (calculatedAccountBalances[p.accountId] !== undefined) {
                    calculatedAccountBalances[p.accountId] += p.amount;
                }
            });
        }
        // Transfers
        if (tx.type === 'transfer' && tx.fromAccountId && tx.toAccountId) {
            if (calculatedAccountBalances[tx.fromAccountId] !== undefined) {
                calculatedAccountBalances[tx.fromAccountId] -= tx.amount;
            }
            if (calculatedAccountBalances[tx.toAccountId] !== undefined) {
                calculatedAccountBalances[tx.toAccountId] += tx.amount;
            }
        }
    });

    const finalAccountBalances = accounts.map(acc => ({
        id: acc.id,
        name: acc.name,
        balance: calculatedAccountBalances[acc.id] || 0
    }));

    // Calculate Party Balances as of selectedDate
    const calculatedPartyBalances: { [id: string]: number } = {};
    parties.forEach(p => calculatedPartyBalances[p.id] = 0);
    
    transactionsUntilSelectedDate.forEach(tx => {
        if (tx.partyId) {
            const effect = getPartyBalanceEffect(tx, false);
            if(calculatedPartyBalances[tx.partyId] !== undefined) {
                calculatedPartyBalances[tx.partyId] += effect;
            }
        }
    });

    const finalPartyBalances = parties.map(p => ({
        id: p.id,
        name: p.name,
        balance: calculatedPartyBalances[p.id] || 0
    }));

    return { accountBalances: finalAccountBalances, partyBalances: finalPartyBalances };

  }, [accounts, parties, transactions, selectedDate]);


  const handleSaveLog = async () => {
    setIsSaving(true);
    try {
        const logToSave: Omit<LogRecord, 'id'> = {
            date: selectedDate,
            summary: dailyReport.summary,
            accountBalances,
            partyBalances,
            transactions: dailyReport.transactions,
        };
        await addLogRecord(logToSave);
        toast({ title: 'Success', description: `Log for ${selectedDate} has been saved.` });
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    } finally {
        setIsSaving(false);
    }
  }
  
  const handleSendEmail = () => {
    const subject = `Daily Log Report for ${formatDate(selectedDate)}`;
    
    let body = `--- Daily Summary ---\n`;
    body += `Total Sales: ${formatAmount(dailyReport.summary.totalSales)}\n`;
    body += `Total Purchases: ${formatAmount(dailyReport.summary.totalPurchases)}\n`;
    body += `Other Income: ${formatAmount(dailyReport.summary.totalIncome)}\n`;
    body += `Other Expense: ${formatAmount(dailyReport.summary.totalExpense)}\n\n`;

    body += `--- Account Balances ---\n`;
    accountBalances.forEach(acc => {
        body += `${acc.name}: ${formatAmount(acc.balance)}\n`;
    });
    body += `\n`;

    body += `--- Party Balances ---\n`;
    partyBalances.filter(p => p.balance !== 0).forEach(p => {
        body += `${p.name}: ${formatAmount(p.balance)}\n`;
    });
    body += `\n`;
    
    body += `--- Today's Transactions ---\n`;
    dailyReport.transactions.forEach(tx => {
        body += `${tx.description} | ${getPartyName(tx.partyId)} | ${getAccountName(tx.accountId)} | ${tx.type} | ${formatAmount(tx.amount)}\n`;
    });

    const mailtoLink = `mailto:jameurrumuz@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailtoLink;
  };


  const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || '-';
  const getAccountName = (accountId?: string) => accounts.find(a => a.id === accountId)?.name || '-';

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <BookOpen /> Daily Log Record
          </CardTitle>
          <CardDescription>
            View and save a snapshot of today's financial activities.
          </CardDescription>
        </CardHeader>
      </Card>
      
      <Tabs defaultValue="today">
        <TabsList>
            <TabsTrigger value="today">Today's Log</TabsTrigger>
            <TabsTrigger value="history">Saved Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
             <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                       <div className="flex items-center gap-4">
                           <Label htmlFor="log-date">Select Date</Label>
                           <Input 
                                id="log-date"
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-auto"
                           />
                       </div>
                        <div className="flex gap-2">
                           <Button onClick={handleSendEmail} variant="outline">
                             <Mail className="mr-2 h-4 w-4"/> Send Email
                           </Button>
                           <Button onClick={handleSaveLog} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                            Save Today's Log
                           </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? <div className="flex justify-center h-48 items-center"><Loader2 className="animate-spin h-8 w-8"/></div> : (
                        <>
                           <Card className="bg-muted/30">
                                <CardHeader><CardTitle className="text-lg flex items-center gap-2"><BarChart2/>Today's Summary</CardTitle></CardHeader>
                                <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                     <div className="p-3 bg-green-50 rounded-lg"><p className="text-sm text-green-600">Total Sales</p><p className="font-bold text-xl text-green-700">{formatAmount(dailyReport.summary.totalSales)}</p></div>
                                     <div className="p-3 bg-red-50 rounded-lg"><p className="text-sm text-red-600">Total Purchases</p><p className="font-bold text-xl text-red-700">{formatAmount(dailyReport.summary.totalPurchases)}</p></div>
                                     <div className="p-3 bg-blue-50 rounded-lg"><p className="text-sm text-blue-600">Other Income</p><p className="font-bold text-xl text-blue-700">{formatAmount(dailyReport.summary.totalIncome)}</p></div>
                                     <div className="p-3 bg-orange-50 rounded-lg"><p className="text-sm text-orange-600">Other Expense</p><p className="font-bold text-xl text-orange-700">{formatAmount(dailyReport.summary.totalExpense)}</p></div>
                                </CardContent>
                           </Card>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-semibold mb-2">Account Balances (as of {formatDate(selectedDate)})</h3>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                                        <TableBody>{accountBalances.map(acc => <TableRow key={acc.id}><TableCell>{acc.name}</TableCell><TableCell className="text-right">{formatAmount(acc.balance)}</TableCell></TableRow>)}</TableBody>
                                    </Table>
                                </div>
                                <div>
                                    <h3 className="font-semibold mb-2">Party Balances (as of {formatDate(selectedDate)})</h3>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Party</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                                        <TableBody>{partyBalances.map(p => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell className="text-right">{formatAmount(p.balance)}</TableCell></TableRow>)}</TableBody>
                                    </Table>
                                </div>
                           </div>
                           <div>
                                <h3 className="font-semibold mb-2">Today's Transactions</h3>
                                <Table>
                                    <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Party</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead>Via</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                    <TableBody>
                                        {dailyReport.transactions.map(tx => (
                                            <TableRow key={tx.id}>
                                                <TableCell>{tx.description}</TableCell>
                                                <TableCell>{getPartyName(tx.partyId)}</TableCell>
                                                <TableCell>{getAccountName(tx.accountId)}</TableCell>
                                                <TableCell>{tx.type}</TableCell>
                                                <TableCell>{tx.via || '-'}</TableCell>
                                                <TableCell className="text-right">{formatAmount(tx.amount)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                           </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="history">
             <Card>
                <CardHeader>
                    <CardTitle>Saved Logs</CardTitle>
                </CardHeader>
                <CardContent>
                    <Accordion type="single" collapsible>
                        {savedLogs.map(log => (
                            <AccordionItem key={log.id} value={log.id}>
                                <AccordionTrigger>Log for {formatDate(log.date)}</AccordionTrigger>
                                <AccordionContent className="space-y-4">
                                    <Card>
                                        <CardHeader><CardTitle>Summary</CardTitle></CardHeader>
                                        <CardContent className="grid grid-cols-4 gap-4">
                                            <div><p className="text-sm">Sales</p><p className="font-bold">{formatAmount(log.summary.totalSales)}</p></div>
                                            <div><p className="text-sm">Purchases</p><p className="font-bold">{formatAmount(log.summary.totalPurchases)}</p></div>
                                            <div><p className="text-sm">Income</p><p className="font-bold">{formatAmount(log.summary.totalIncome)}</p></div>
                                            <div><p className="text-sm">Expense</p><p className="font-bold">{formatAmount(log.summary.totalExpense)}</p></div>
                                        </CardContent>
                                    </Card>
                                    <div className="grid grid-cols-2 gap-4">
                                        <Card><CardHeader><CardTitle>Account Balances</CardTitle></CardHeader><CardContent><Table><TableBody>{log.accountBalances.map(a => <TableRow key={a.id}><TableCell>{a.name}</TableCell><TableCell className="text-right">{formatAmount(a.balance)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
                                        <Card><CardHeader><CardTitle>Party Balances</CardTitle></CardHeader><CardContent><Table><TableBody>{log.partyBalances.map(p => <TableRow key={p.id}><TableCell>{p.name}</TableCell><TableCell className="text-right">{formatAmount(p.balance)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
                                    </div>
                                    <div className="mt-4">
                                        <h4 className="font-semibold mb-2">Transactions on {formatDate(log.date)}</h4>
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Party</TableHead><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead>Via</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {log.transactions.map(tx => (
                                                    <TableRow key={tx.id}>
                                                        <TableCell>{tx.description}</TableCell>
                                                        <TableCell>{getPartyName(tx.partyId)}</TableCell>
                                                        <TableCell>{getAccountName(tx.accountId)}</TableCell>
                                                        <TableCell>{tx.type}</TableCell>
                                                        <TableCell>{tx.via || '-'}</TableCell>
                                                        <TableCell className="text-right">{formatAmount(tx.amount)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

    

