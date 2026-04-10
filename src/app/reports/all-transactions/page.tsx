'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2, CheckCircle, AlertCircle } from 'lucide-react';
import type { Transaction, Account, Party, AppSettings } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToParties } from '@/services/partyService';
import { getAppSettings } from '@/services/settingsService';
import { formatDate, formatAmount, transactionTypeOptions } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format as formatFns, startOfMonth } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function AllTransactionsReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(() => {
    const today = new Date();
    const monthStart = startOfMonth(today);
    return {
        dateFrom: formatFns(monthStart, 'yyyy-MM-dd'),
        dateTo: formatFns(today, 'yyyy-MM-dd'),
        via: 'all',
        partyId: 'all',
        type: 'all',
    };
  });
  const { toast } = useToast();

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
    const unsubAccounts = subscribeToAccounts(setAccounts, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    getAppSettings().then(setAppSettings);

    return () => {
      unsubTransactions();
      unsubAccounts();
      unsubParties();
    };
  }, [toast]);

  const { filteredTransactions, totalAmount } = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      if (filters.via !== 'all' && t.via !== filters.via) return false;
      if (filters.partyId !== 'all' && t.partyId !== filters.partyId) return false;
      if (filters.type !== 'all' && t.type !== filters.type) return false;
      // Only show enabled transactions on this report
      return t.enabled;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    const total = filtered.reduce((sum, t) => sum + t.amount, 0);

    return { filteredTransactions: filtered, totalAmount: total };
  }, [transactions, filters]);

  const handlePrint = () => window.print();

  return (
    <>
       <style>{`
        @page {
          size: A4;
          margin: 1.5cm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-area { 
            visibility: visible; 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%;
            padding: 0;
            margin: 0;
          }
          .no-print { 
            display: none; 
          }
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

      <div className="print-area">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle>All Transactions Report</CardTitle>
                <CardDescription>A complete log of all recorded financial activities.</CardDescription>
              </div>
              <div className="flex gap-2 no-print">
                <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
                <Button disabled><Share2 className="mr-2 h-4 w-4" /> Share</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6 p-4 border rounded-lg no-print">
              <div className="space-y-1">
                <Label htmlFor="dateFrom">From</Label>
                <Input 
                  id="dateFrom"
                  type="date" 
                  value={filters.dateFrom} 
                  onChange={e => setFilters({...filters, dateFrom: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="dateTo">To</Label>
                <Input 
                  id="dateTo"
                  type="date" 
                  value={filters.dateTo} 
                  onChange={e => setFilters({...filters, dateTo: e.target.value})} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="via">Transaction Via</Label>
                <Select value={filters.via} onValueChange={v => setFilters({...filters, via: v})}>
                  <SelectTrigger id="via">
                    <SelectValue placeholder="Select via" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {appSettings?.businessProfiles.map(o => (
                      <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="party">Party</Label>
                <Select value={filters.partyId} onValueChange={v => setFilters({...filters, partyId: v})}>
                  <SelectTrigger id="party">
                    <SelectValue placeholder="Select party" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Parties</SelectItem>
                    {parties.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="type">Transaction Type</Label>
                <Select value={filters.type} onValueChange={v => setFilters({...filters, type: v})}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {transactionTypeOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Via</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                  ) : filteredTransactions.length > 0 ? (
                    filteredTransactions.map(t => (
                      <TableRow key={t.id}>
                        <TableCell>{formatDate(t.date)}</TableCell>
                        <TableCell>{t.description}</TableCell>
                        <TableCell>{t.partyId ? parties.find(p => p.id === t.partyId)?.name : 'N/A'}</TableCell>
                        <TableCell>{t.type}</TableCell>
                        <TableCell>{t.via || 'N/A'}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(t.amount)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow><TableCell colSpan={6} className="h-24 text-center">No transactions found for the selected criteria.</TableCell></TableRow>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-bold text-right">Total Amount</TableCell>
                    <TableCell className="font-bold text-right font-mono">{formatAmount(totalAmount)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
