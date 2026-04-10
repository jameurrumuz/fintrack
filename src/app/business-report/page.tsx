
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, ShoppingCart, Printer, Share2 } from 'lucide-react';
import type { Transaction, Party, AppSettings } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { getAppSettings } from '@/services/settingsService';
import { formatDate, formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format as formatFns, startOfMonth } from 'date-fns';

export default function BusinessReportPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
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
    };
  });
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    getAppSettings().then(setAppSettings);

    const timer = setTimeout(() => setLoading(false), 500);

    return () => {
      unsubTransactions();
      unsubParties();
      clearTimeout(timer);
    };
  }, [toast]);

  const { filteredSales, totalSalesValue } = useMemo(() => {
    const sales = transactions.filter(t => 
      (t.type === 'sale' || t.type === 'credit_sale') && t.enabled
    );

    const filtered = sales.filter(t => {
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      // Do not filter by 'via' to show all sales
      return true;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const total = filtered.reduce((sum, t) => sum + t.amount, 0);

    return { filteredSales: filtered, totalSalesValue: total };
  }, [transactions, filters]);

  const getPartyName = (partyId?: string) => {
    return parties.find(p => p.id === partyId)?.name || 'N/A';
  };
  
  const handlePrint = () => window.print();

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .print-area, .print-area * {
            visibility: visible;
          }
          .print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
      <div className="print-area">
        <Card>
          <CardHeader>
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2 text-2xl">
                        <ShoppingCart /> Business Sales Report
                    </CardTitle>
                    <CardDescription>
                        View and filter sales across all your business profiles.
                    </CardDescription>
                </div>
                <div className="flex gap-2 no-print">
                    <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
                    <Button disabled><Share2 className="mr-2 h-4 w-4" /> Share</Button>
                </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg no-print">
              <div className="space-y-1">
                <Label>From</Label>
                <Input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>To</Label>
                <Input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Business Profile</Label>
                <Select value={filters.via} onValueChange={v => setFilters({ ...filters, via: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select profile" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Profiles</SelectItem>
                    {appSettings?.businessProfiles.map(p => (
                      <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>
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
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead>Profile (Via)</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        <Loader2 className="animate-spin h-8 w-8 mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredSales.length > 0 ? (
                    filteredSales.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell>{formatDate(sale.date)}</TableCell>
                        <TableCell>{sale.invoiceNumber?.replace('INV-', '')}</TableCell>
                        <TableCell>{getPartyName(sale.partyId)}</TableCell>
                        <TableCell>{sale.items?.length || 0}</TableCell>
                        <TableCell>{filters.via === 'all' ? sale.via || 'N/A' : filters.via}</TableCell>
                        <TableCell className="text-right font-mono text-green-600">{formatAmount(sale.amount)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No sales found for the selected criteria.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-bold text-right">Total Sales</TableCell>
                    <TableCell className="font-bold text-right font-mono text-green-600">{formatAmount(totalSalesValue)}</TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
