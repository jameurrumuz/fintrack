
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2, BarChart, TrendingUp, TrendingDown, CheckCircle, XCircle } from 'lucide-react';
import type { Transaction, InventoryItem, AppSettings } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format as formatFns, startOfMonth } from 'date-fns';

export default function NetProfitReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
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
    const unsubInventory = subscribeToInventoryItems(setInventory, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    getAppSettings().then(setAppSettings);

    const today = new Date();
    const startOfMonthDate = startOfMonth(today);
    setFilters({
        dateFrom: formatFns(startOfMonthDate, 'yyyy-MM-dd'),
        dateTo: formatFns(today, 'yyyy-MM-dd'),
        via: 'all',
    });

    setLoading(false);

    return () => {
      unsubTransactions();
      unsubInventory();
    };
  }, [toast]);

  const {
    stockProfit,
    otherIncome,
    otherExpenses,
    netProfit,
  } = useMemo(() => {
    const filtered = transactions.filter(t => {
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      if (filters.via !== 'all' && t.via !== filters.via) return false;
      return t.enabled;
    });

    const stockProfit = filtered
      .filter(t => (t.type === 'sale' || t.type === 'credit_sale') && t.items)
      .reduce((totalProfit, t) => {
        const transactionProfit = t.items!.reduce((itemSum, item) => {
          const saleValue = (Number(item.price) || 0) * (Number(item.quantity) || 0);
          
          let costPerUnit = Number(item.cost) || 0;
          if (costPerUnit <= 0 || costPerUnit > item.price) {
            const invItem = inventory.find(i => i.id === item.id);
            costPerUnit = invItem?.cost || 0;
          }

          const costValue = costPerUnit * (Number(item.quantity) || 0);
          return itemSum + (saleValue - costValue);
        }, 0);

        return totalProfit + transactionProfit;
      }, 0);

    const otherIncome = filtered.filter(t => t.type === 'income').reduce((sum, t) => sum + t.amount, 0);

    const otherExpenses = filtered.filter(t => t.type === 'spent').reduce((sum, t) => sum + t.amount, 0);
    
    const netProfit = stockProfit + otherIncome - otherExpenses;

    return { stockProfit, otherIncome, otherExpenses, netProfit };
  }, [transactions, inventory, filters]);

  const handlePrint = () => window.print();
  
  const getFilterQueryString = () => {
    const params = new URLSearchParams();
    if(filters.dateFrom) params.append('from', filters.dateFrom);
    if(filters.dateTo) params.append('to', filters.dateTo);
    if(filters.via !== 'all') params.append('via', filters.via);
    return params.toString();
  }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="no-print mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>
      <div className="print-area">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="flex items-center gap-2"><BarChart />Net Profit Report</CardTitle>
                <CardDescription>Analyze net profitability for the selected period.</CardDescription>
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
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-green-700 text-lg">Income</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                      <TableBody>
                          <TableRow>
                              <TableCell className="flex items-center gap-2"><TrendingUp/> Profit from Sales</TableCell>
                              <TableCell className="text-right font-mono">
                                  <Link href={`/reports/sales?${getFilterQueryString()}`} className="hover:underline">
                                      {formatAmount(stockProfit)}
                                  </Link>
                              </TableCell>
                          </TableRow>
                          <TableRow>
                              <TableCell className="flex items-center gap-2"><TrendingUp/> Other Income</TableCell>
                              <TableCell className="text-right font-mono">
                                   <Link href={`/reports/income?${getFilterQueryString()}`} className="hover:underline">
                                      {formatAmount(otherIncome)}
                                  </Link>
                              </TableCell>
                          </TableRow>
                      </TableBody>
                      <TableFooter>
                          <TableRow className="bg-green-50">
                              <TableCell className="font-bold">Total Income</TableCell>
                              <TableCell className="text-right font-bold font-mono">{formatAmount(stockProfit + otherIncome)}</TableCell>
                          </TableRow>
                      </TableFooter>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-red-700 text-lg">Expenses</CardTitle></CardHeader>
                <CardContent>
                   <Table>
                      <TableBody>
                           <TableRow>
                              <TableCell className="flex items-center gap-2"><TrendingDown/> Other Expenses</TableCell>
                              <TableCell className="text-right font-mono">
                                   <Link href={`/reports/expense?${getFilterQueryString()}`} className="hover:underline">
                                      {formatAmount(otherExpenses)}
                                  </Link>
                              </TableCell>
                          </TableRow>
                      </TableBody>
                       <TableFooter>
                          <TableRow className="bg-red-50">
                              <TableCell className="font-bold">Total Expenses</TableCell>
                              <TableCell className="text-right font-bold font-mono">{formatAmount(otherExpenses)}</TableCell>
                          </TableRow>
                      </TableFooter>
                   </Table>
                </CardContent>
              </Card>
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
      </div>
    </div>
  );
}
