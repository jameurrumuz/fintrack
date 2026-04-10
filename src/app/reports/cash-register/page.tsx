
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2 } from 'lucide-react';
import type { Transaction, Account } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { formatDate, formatAmount, getEffectiveAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Banknote } from 'lucide-react';
import { format as formatFns, startOfMonth } from 'date-fns';

export default function CashRegisterReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    return {
        dateFrom: formatFns(monthStart, 'yyyy-MM-dd'),
        dateTo: formatFns(today, 'yyyy-MM-dd'),
    };
  });
  const { toast } = useToast();

  useEffect(() => {
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubAccounts = subscribeToAccounts(setAccounts, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    
    setLoading(false);

    return () => {
      unsubTransactions();
      unsubAccounts();
    };
  }, [toast]);

  const cashAccountId = useMemo(() => {
    return accounts.find(a => a.name.toLowerCase() === 'cash')?.id;
  }, [accounts]);

  const { reportData, openingBalance, closingBalance, totalIn, totalOut } = useMemo(() => {
    if (!cashAccountId) return { reportData: [], openingBalance: 0, closingBalance: 0, totalIn: 0, totalOut: 0 };

    const sortedTransactions = transactions
      .filter(t => t.involvedAccounts?.includes(cashAccountId))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    let openingBal = 0;
    sortedTransactions.forEach(t => {
      if (filters.dateFrom && t.date < filters.dateFrom) {
        if (!t.enabled) return;
        if (t.type === 'transfer') {
            if (t.fromAccountId === cashAccountId) openingBal -= t.amount;
            if (t.toAccountId === cashAccountId) openingBal += t.amount;
        } else if (t.accountId === cashAccountId) {
            openingBal += getEffectiveAmount(t);
        } else if (t.payments?.some(p => p.accountId === cashAccountId)) {
            const cashPayment = t.payments.find(p => p.accountId === cashAccountId);
            if(cashPayment) {
                 openingBal += getEffectiveAmount({...t, amount: cashPayment.amount});
            }
        }
      }
    });

    const filtered = sortedTransactions.filter(t => {
        if (filters.dateFrom && t.date < filters.dateFrom) return false;
        if (filters.dateTo && t.date > filters.dateTo) return false;
        return true;
    });

    let currentBalance = openingBal;
    let totalIn = 0;
    let totalOut = 0;
    
    const reportData = filtered.map(t => {
        if (!t.enabled) return { ...t, cashIn: 0, cashOut: 0, balance: currentBalance };

        let cashIn = 0;
        let cashOut = 0;

        if (t.type === 'transfer') {
            if (t.toAccountId === cashAccountId) cashIn = t.amount;
            if (t.fromAccountId === cashAccountId) cashOut = t.amount;
        } else if (t.accountId === cashAccountId) {
            const effect = getEffectiveAmount(t);
            if (effect > 0) cashIn = effect;
            else cashOut = Math.abs(effect);
        } else if (t.payments?.some(p => p.accountId === cashAccountId)) {
            const cashPayment = t.payments.find(p => p.accountId === cashAccountId);
            if(cashPayment) {
                 const effect = getEffectiveAmount({...t, amount: cashPayment.amount});
                 if (effect > 0) cashIn = effect;
                 else cashOut = Math.abs(effect);
            }
        }
        
        currentBalance += cashIn - cashOut;
        totalIn += cashIn;
        totalOut += cashOut;
        
        return {
            ...t,
            cashIn,
            cashOut,
            balance: currentBalance,
        };
    }).filter(item => item.cashIn > 0 || item.cashOut > 0) as (Transaction & { cashIn: number; cashOut: number; balance: number; })[];
    
    return { reportData, openingBalance: openingBal, closingBalance: currentBalance, totalIn, totalOut };
  }, [transactions, filters, cashAccountId]);

  const handlePrint = () => window.print();

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; }
          .no-print { display: none; }
        }
      `}</style>
      <div className="no-print mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>

      <Card className="print-area">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Banknote/>Cash Register Report</CardTitle>
              <CardDescription>A detailed view of all cash transactions.</CardDescription>
            </div>
            <div className="flex gap-2 no-print">
              <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
              <Button disabled><Share2 className="mr-2 h-4 w-4" /> Share</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border rounded-lg no-print">
            <div className="space-y-1"><Label>From</Label><Input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} /></div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Cash In</TableHead>
                  <TableHead className="text-right">Cash Out</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                ) : (
                  <>
                    <TableRow>
                        <TableCell colSpan={4} className="font-bold">Opening Balance</TableCell>
                        <TableCell className="text-right font-bold font-mono">{formatAmount(openingBalance)}</TableCell>
                    </TableRow>
                    {reportData.map(item => (
                        <TableRow key={item.id}>
                            <TableCell>{formatDate(item.date)}</TableCell>
                            <TableCell>{item.description}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{item.cashIn > 0 ? formatAmount(item.cashIn) : '-'}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{item.cashOut > 0 ? formatAmount(item.cashOut) : '-'}</TableCell>
                            <TableCell className="text-right font-mono">{formatAmount(item.balance)}</TableCell>
                        </TableRow>
                    ))}
                  </>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                    <TableCell colSpan={2} className="font-bold text-right">Totals</TableCell>
                    <TableCell className="text-right font-bold font-mono text-green-600">{formatAmount(totalIn)}</TableCell>
                    <TableCell className="text-right font-bold font-mono text-red-600">{formatAmount(totalOut)}</TableCell>
                    <TableCell className="text-right font-bold font-mono">{formatAmount(closingBalance)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
