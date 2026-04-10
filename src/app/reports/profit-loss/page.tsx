'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2, TrendingUp, TrendingDown, BarChartHorizontal, CheckCircle, XCircle } from 'lucide-react';
import type { Transaction, AppSettings } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { getAppSettings } from '@/services/settingsService';
import { formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProfitLossReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    via: 'all',
  });
  const { toast } = useToast();

  useEffect(() => {
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    getAppSettings().then(setAppSettings);
    
    // Set default dates: start of month to today
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    setFilters({
        dateFrom: startOfMonth.toISOString().split('T')[0],
        dateTo: today.toISOString().split('T')[0],
        via: 'all',
    });

    setLoading(false);

    return () => {
      unsubTransactions();
    };
  }, [toast]);

  const {
    totalSales,
    totalPurchases,
    totalOtherIncome,
    totalOtherExpenses,
    tradingProfit,
    otherNet,
    netProfit,
  } = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      if (filters.via !== 'all' && t.via !== filters.via) return false;
      return t.enabled;
    });

    const totalSales = filtered.filter(t => t.type === 'sale' || t.type === 'credit_sale').reduce((sum, t) => sum + t.amount, 0);
    const totalPurchases = filtered.filter(t => t.type === 'purchase' || t.type === 'credit_purchase').reduce((sum, t) => sum + t.amount, 0);
    const totalOtherIncome = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);
    const totalOtherExpenses = filtered.filter(t => t.type === 'spent').reduce((sum, t) => sum + t.amount, 0);

    const tradingProfit = totalSales - totalPurchases;
    const otherNet = totalOtherIncome - totalOtherExpenses;
    const netProfit = tradingProfit + otherNet;

    return {
      totalSales,
      totalPurchases,
      totalOtherIncome,
      totalOtherExpenses,
      tradingProfit,
      otherNet,
      netProfit,
    };
  }, [transactions, filters]);

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
              <CardTitle className="flex items-center gap-2"><BarChartHorizontal />Profit / Loss Report</CardTitle>
              <CardDescription>Analyze business profitability for the selected period.</CardDescription>
            </div>
            <div className="flex gap-2 no-print">
              <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
              <Button disabled><Share2 className="mr-2 h-4 w-4" /> Share</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg no-print">
            <div className="space-y-1"><Label>From</Label><Input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} /></div>
            <div className="space-y-1"><Label>To</Label><Input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} /></div>
            <div className="space-y-1"><Label>Business Profile</Label>
                <Select value={filters.via} onValueChange={v => setFilters({...filters, via: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Profiles</SelectItem>
                        {appSettings?.businessProfiles.map(o => <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
             <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-green-700 text-base">Total Sales</CardTitle></CardHeader>
                <CardContent><p className="text-xl font-bold text-green-700">{formatAmount(totalSales)}</p></CardContent>
             </Card>
              <Card className="bg-red-50 border-red-200">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-red-700 text-base">Total Purchases</CardTitle></CardHeader>
                <CardContent><p className="text-xl font-bold text-red-700">{formatAmount(totalPurchases)}</p></CardContent>
             </Card>
             <Card className="bg-green-50 border-green-200">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-green-700 text-base">Other Income</CardTitle></CardHeader>
                <CardContent><p className="text-xl font-bold text-green-700">{formatAmount(totalOtherIncome)}</p></CardContent>
             </Card>
              <Card className="bg-red-50 border-red-200">
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-red-700 text-base">Other Expenses</CardTitle></CardHeader>
                <CardContent><p className="text-xl font-bold text-red-700">{formatAmount(totalOtherExpenses)}</p></CardContent>
             </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-2">Trading Summary</h3>
              <div className="rounded-md border">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>Total Sales</TableCell>
                      <TableCell className="text-right font-mono">{formatAmount(totalSales)}</TableCell>
                    </TableRow>
                     <TableRow>
                      <TableCell>Total Purchases</TableCell>
                      <TableCell className="text-right font-mono">(-){formatAmount(totalPurchases)}</TableCell>
                    </TableRow>
                  </TableBody>
                  <TableFooter>
                    <TableRow className={tradingProfit >= 0 ? "bg-green-100" : "bg-red-100"}>
                      <TableCell className="font-bold">Trading Profit / Loss</TableCell>
                      <TableCell className="text-right font-bold font-mono">{formatAmount(tradingProfit)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
             <div>
              <h3 className="text-lg font-semibold mb-2">Other Income/Expense Summary</h3>
              <div className="rounded-md border">
                <Table>
                  <TableBody>
                    <TableRow>
                      <TableCell>Other Income</TableCell>
                      <TableCell className="text-right font-mono">{formatAmount(totalOtherIncome)}</TableCell>
                    </TableRow>
                     <TableRow>
                      <TableCell>Other Expenses</TableCell>
                      <TableCell className="text-right font-mono">(-){formatAmount(totalOtherExpenses)}</TableCell>
                    </TableRow>
                  </TableBody>
                  <TableFooter>
                    <TableRow className={otherNet >= 0 ? "bg-green-100" : "bg-red-100"}>
                      <TableCell className="font-bold">Net Other Income</TableCell>
                      <TableCell className="text-right font-bold font-mono">{formatAmount(otherNet)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </div>
          
           <Card className="mt-8">
              <CardFooter className="flex justify-between items-center p-4">
                <CardTitle className={netProfit >= 0 ? 'text-green-700' : 'text-red-700'}>
                    {netProfit >= 0 ? <CheckCircle className="mr-2"/> : <XCircle className="mr-2"/>}
                    {netProfit >= 0 ? 'Net Profit' : 'Net Loss'}
                </CardTitle>
                <p className="text-2xl font-bold font-mono">{formatAmount(netProfit)}</p>
              </CardFooter>
            </Card>

        </CardContent>
      </Card>
    </>
  );
}
