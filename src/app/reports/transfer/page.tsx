
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2, ArrowRightLeft } from 'lucide-react';
import type { Transaction, Account } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { formatDate, formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format as formatFns, startOfMonth } from 'date-fns';

export default function TransferReport() {
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

  const { filteredTransactions, totalTransferred } = useMemo(() => {
    const transferTransactions = transactions.filter(t => t.type === 'transfer');
    const filtered = transferTransactions.filter(t => {
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);

    return { filteredTransactions: filtered, totalTransferred: total };
  }, [transactions, filters]);

  const getAccountName = (id?: string) => accounts.find(a => a.id === id)?.name || 'N/A';

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
              <CardTitle className="flex items-center gap-2"><ArrowRightLeft className="text-blue-500" />Transfer Report</CardTitle>
              <CardDescription>A log of all internal account-to-account transfers.</CardDescription>
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
                  <TableHead>From Account</TableHead>
                  <TableHead>To Account</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                ) : filteredTransactions.length > 0 ? (
                  filteredTransactions.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell>{getAccountName(t.fromAccountId)}</TableCell>
                      <TableCell>{getAccountName(t.toAccountId)}</TableCell>
                      <TableCell className="text-right font-mono">{formatAmount(t.amount)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={4} className="h-24 text-center">No transfers found for the selected criteria.</TableCell></TableRow>
                )}
              </TableBody>
               <TableFooter>
                <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">Total Transferred</TableCell>
                    <TableCell className="text-right font-bold font-mono">{formatAmount(totalTransferred)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
