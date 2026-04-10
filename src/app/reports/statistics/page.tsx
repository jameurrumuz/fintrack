

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, TrendingUp, Users, Package, AlertTriangle, Coins, ArrowUp, ArrowDown, BarChart2 } from 'lucide-react';
import type { Transaction, Party, InventoryItem, AppSettings } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { formatAmount, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format as formatFns, startOfMonth, subMonths, differenceInDays, parseISO, eachMonthOfInterval, startOfISOWeek, endOfISOWeek, startOfWeek, endOfWeek, eachDayOfInterval } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, CartesianGrid, XAxis, YAxis, Bar, Tooltip } from 'recharts';


export default function StatisticsReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const to = new Date();
    const from = startOfMonth(to);
    return { from, to };
  });
  
  const [compareDateRange, setCompareDateRange] = useState<DateRange | undefined>(() => {
      const to = startOfMonth(new Date());
      const from = startOfMonth(subMonths(to, 1));
      return { from, to: new Date(to.getTime() - 1) }; // end of previous month
  });

  const [filters, setFilters] = useState({
    via: 'all',
    partyType: 'all',
  });

  useEffect(() => {
    setLoading(true);
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error loading transactions', description: err.message }));
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error loading parties', description: err.message }));
    const unsubInventory = subscribeToInventoryItems(setInventory, (err) => toast({ variant: 'destructive', title: 'Error loading inventory', description: err.message }));
    getAppSettings().then(setAppSettings);
    
    const timer = setTimeout(() => setLoading(false), 500);
    return () => {
      unsubTransactions();
      unsubParties();
      unsubInventory();
      clearTimeout(timer);
    };
  }, [toast]);
  
  const { topProducts, topBuyingProducts, topCustomers, topSuppliers, untrustworthyParties, topCollectionDays } = useMemo(() => {
    const processDateRange = (range: DateRange | undefined) => {
        if (!range || !range.from) return [];
        const toDate = range.to || range.from;
        
        return transactions.filter(t => {
            const txDate = new Date(t.date);
            const fromDate = new Date(range.from!);
            fromDate.setHours(0, 0, 0, 0);
            const toDateWithTime = new Date(toDate);
            toDateWithTime.setHours(23, 59, 59, 999);

            if (txDate < fromDate || txDate > toDateWithTime) return false;
            if (filters.via !== 'all' && t.via !== filters.via) return false;
            return true;
        });
    }

    const filteredTxPeriod1 = processDateRange(dateRange);
    const filteredTxPeriod2 = processDateRange(compareDateRange);
    const partyNameMap = new Map(parties.map(p => [p.id, p.name]));
    
    const calculateTopProducts = (txs: Transaction[], types: Transaction['type'][]) => {
        const productMap = new Map<string, { name: string; quantity: number }>();
        txs.forEach(tx => {
            if(types.includes(tx.type) && tx.enabled && tx.items) {
                tx.items.forEach(item => {
                    const existing = productMap.get(item.id) || { name: item.name, quantity: 0 };
                    existing.quantity += item.quantity;
                    productMap.set(item.id, existing);
                });
            }
        });
        return productMap;
    };
    
    const productSales1 = calculateTopProducts(filteredTxPeriod1, ['sale', 'credit_sale']);
    const productSales2 = calculateTopProducts(filteredTxPeriod2, ['sale', 'credit_sale']);
    const allProductSaleIds = new Set([...productSales1.keys(), ...productSales2.keys()]);

    const topProducts = Array.from(allProductSaleIds).map(id => {
        const p1 = productSales1.get(id);
        const p2 = productSales2.get(id);
        const qty1 = p1?.quantity || 0;
        const qty2 = p2?.quantity || 0;
        const change = qty2 > 0 ? ((qty1 - qty2) / qty2) * 100 : (qty1 > 0 ? Infinity : 0);
        return {
            id,
            name: p1?.name || p2?.name || 'Unknown',
            quantity1: qty1,
            quantity2: qty2,
            change: isFinite(change) ? change : (qty1 > 0 ? 100 : 0),
        };
    }).sort((a,b) => b.quantity1 - a.quantity1);
    
    const productBuys1 = calculateTopProducts(filteredTxPeriod1, ['purchase', 'credit_purchase']);
    const productBuys2 = calculateTopProducts(filteredTxPeriod2, ['purchase', 'credit_purchase']);
    const allProductBuyIds = new Set([...productBuys1.keys(), ...productBuys2.keys()]);
    
    const topBuyingProducts = Array.from(allProductBuyIds).map(id => {
        const p1 = productBuys1.get(id);
        const p2 = productBuys2.get(id);
        const qty1 = p1?.quantity || 0;
        const qty2 = p2?.quantity || 0;
        const change = qty2 > 0 ? ((qty1 - qty2) / qty2) * 100 : (qty1 > 0 ? Infinity : 0);
        return {
            id,
            name: p1?.name || p2?.name || 'Unknown',
            quantity1: qty1,
            quantity2: qty2,
            change: isFinite(change) ? change : (qty1 > 0 ? 100 : 0),
        };
    }).sort((a,b) => b.quantity1 - a.quantity1);


    const calculateTopCustomers = (txs: Transaction[]) => {
        const customerSales = new Map<string, { partyId: string, name: string, amount: number }>();
        txs.forEach(tx => {
            if ((tx.type === 'sale' || tx.type === 'credit_sale') && tx.enabled && tx.partyId) {
                 const existing = customerSales.get(tx.partyId) || { partyId: tx.partyId, name: partyNameMap.get(tx.partyId) || 'Unknown', amount: 0 };
                 existing.amount += tx.amount;
                 customerSales.set(tx.partyId, existing);
            }
        });
        return customerSales;
    };

    const customerSales1 = calculateTopCustomers(filteredTxPeriod1);
    const customerSales2 = calculateTopCustomers(filteredTxPeriod2);
    const allCustomerIds = new Set([...customerSales1.keys(), ...customerSales2.keys()]);
    
    const topCustomers = Array.from(allCustomerIds).map(id => {
        const c1 = customerSales1.get(id);
        const c2 = customerSales2.get(id);
        const amount1 = c1?.amount || 0;
        const amount2 = c2?.amount || 0;
        const change = amount2 > 0 ? ((amount1 - amount2) / amount2) * 100 : (amount1 > 0 ? Infinity : 0);
        return {
            partyId: id,
            name: c1?.name || c2?.name || 'Unknown',
            amount1,
            amount2,
            change: isFinite(change) ? change : (amount1 > 0 ? 100 : 0),
        };
    }).sort((a,b) => b.amount1 - a.amount1);


    const topSuppliers = Array.from(filteredTxPeriod1
        .filter(t => (t.type === 'purchase' || t.type === 'credit_purchase') && t.enabled && t.partyId)
        .reduce((acc, tx) => {
            const party = parties.find(p => p.id === tx.partyId && p.partyType === 'Supplier');
            if (party) {
                const existing = acc.get(party.id) || { partyId: party.id, name: party.name, amount: 0 };
                existing.amount += tx.amount;
                acc.set(party.id, existing);
            }
            return acc;
        }, new Map<string, { partyId: string; name: string; amount: number }>()).values())
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 10);
    
    const partyData = new Map<string, { partyId: string; name: string; totalPaid: number; paymentDurations: number[], balance: number, lastPaymentDate: string | null, partyType?: string }>();
    parties.forEach(p => {
        partyData.set(p.id, { partyId: p.id, name: p.name, totalPaid: 0, paymentDurations: [], balance: 0, lastPaymentDate: null, partyType: p.partyType });
    });
    
    const sortedTransactions = [...transactions].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sortedTransactions.forEach(tx => {
      if (tx.partyId) {
        const party = partyData.get(tx.partyId);
        if(party && tx.enabled) {
          const balanceEffect = (tx.type === 'receive' || tx.type === 'sale_return') ? tx.amount
                              : (tx.type === 'give' || tx.type === 'credit_give' || tx.type === 'purchase_return') ? -tx.amount
                              : (tx.type === 'credit_sale') ? -tx.amount
                              : 0;
          party.balance += balanceEffect;
          if (tx.type === 'receive') {
              party.totalPaid += tx.amount;
              party.lastPaymentDate = party.lastPaymentDate ? (tx.date > party.lastPaymentDate ? tx.date : party.lastPaymentDate) : tx.date;
          }
        }
      }
    });
    
    const creditSalesByParty = new Map<string, { date: string, amount: number, isSettled: boolean }[]>();
    sortedTransactions.forEach(tx => {
        if (tx.type === 'credit_sale' && tx.partyId && tx.enabled) {
            const sales = creditSalesByParty.get(tx.partyId) || [];
            sales.push({ date: tx.date, amount: tx.amount, isSettled: false });
            creditSalesByParty.set(tx.partyId, sales);
        }
    });
    sortedTransactions.forEach(tx => {
        if (tx.type === 'receive' && tx.partyId && tx.enabled) {
            const party = partyData.get(tx.partyId);
            if (party) {
                let paymentAmountToSettle = tx.amount;
                const salesForParty = (creditSalesByParty.get(tx.partyId) || []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                for (const sale of salesForParty) {
                    if (paymentAmountToSettle <= 0) break;
                    if (!sale.isSettled) {
                        const paymentDay = parseISO(tx.date);
                        const saleDay = parseISO(sale.date);
                        const duration = differenceInDays(paymentDay, saleDay);
                        if (duration >= 0) { 
                            party.paymentDurations.push(duration);
                        }
                        sale.isSettled = true;
                        paymentAmountToSettle -= sale.amount;
                    }
                }
            }
        }
    });
    
    const untrustworthyParties = Array.from(partyData.values())
        .filter(p => {
          const typeMatch = filters.partyType === 'all' || p.partyType === filters.partyType;
          return p.balance < 0 && p.partyType !== 'Supplier' && typeMatch;
        })
        .map(party => {
            let paymentPeriod = 'N/A';
            if (party.paymentDurations.length > 0) {
                const min = Math.min(...party.paymentDurations);
                const max = Math.max(...party.paymentDurations);
                paymentPeriod = `${min} - ${max} days`;
            }
            return { ...party, paymentPeriod };
        })
        .sort((a, b) => {
            const aDate = a.lastPaymentDate ? new Date(a.lastPaymentDate).getTime() : 0;
            const bDate = b.lastPaymentDate ? new Date(b.lastPaymentDate).getTime() : 0;
            if (aDate !== bDate) return aDate - bDate;
            return a.balance - b.balance;
        });

    const collectionsByDate = new Map<string, { total: number; count: number; min: number; max: number }>();
    filteredTxPeriod1.forEach(tx => {
        if (tx.type === 'receive' && tx.enabled) {
            const existing = collectionsByDate.get(tx.date) || { total: 0, count: 0, min: Infinity, max: -Infinity };
            existing.total += tx.amount;
            existing.count += 1;
            existing.min = Math.min(existing.min, tx.amount);
            existing.max = Math.max(existing.max, tx.amount);
            collectionsByDate.set(tx.date, existing);
        }
    });
    const topCollectionDays = Array.from(collectionsByDate.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => b.total - a.total);
    

    return { topProducts, topBuyingProducts, topCustomers, topSuppliers, untrustworthyParties, topCollectionDays };
  }, [transactions, parties, filters, dateRange, compareDateRange]);
  
  const chartData = useMemo(() => {
    const from = dateRange?.from;
    const to = dateRange?.to;

    if (!from || !to) return [];

    const months = eachMonthOfInterval({ start: from, end: to });
    
    const monthlyData: { [month: string]: { sales: number, purchases: number, profit: number } } = {};

    months.forEach(monthStart => {
        const monthKey = formatFns(monthStart, 'MMM yy');
        monthlyData[monthKey] = { sales: 0, purchases: 0, profit: 0 };
    });

    transactions.forEach(tx => {
        if (tx.enabled && (filters.via === 'all' || tx.via === filters.via)) {
            if (typeof tx.date !== 'string') return;
            const txDate = parseISO(tx.date);
            if (txDate >= from && txDate <= to) {
                 const monthKey = formatFns(txDate, 'MMM yy');
                if (monthlyData[monthKey]) {
                    if (tx.type === 'sale' || tx.type === 'credit_sale') {
                        monthlyData[monthKey].sales += tx.amount;
                        // Approximate profit calculation
                        const cost = tx.items?.reduce((sum, item) => sum + (item.cost || 0), 0) || 0;
                        monthlyData[monthKey].profit += (tx.amount - cost);
                    } else if (tx.type === 'purchase' || tx.type === 'credit_purchase') {
                        monthlyData[monthKey].purchases += tx.amount;
                    }
                }
            }
        }
    });

    return Object.entries(monthlyData).map(([month, data]) => ({ month, ...data }));
  }, [transactions, dateRange, filters.via]);
  
  const setDatePreset = (months: number) => {
    const to = new Date();
    const from = startOfMonth(subMonths(to, months - 1));
    setDateRange({ from, to });
  };
  
  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
  }

  const renderChange = (change: number) => {
    if (change === Infinity) return <span className="flex items-center text-green-600"><ArrowUp/> New</span>;
    if (change > 0) return <span className="flex items-center text-green-600"><ArrowUp/> {change.toFixed(1)}%</span>;
    if (change < 0) return <span className="flex items-center text-red-600"><ArrowDown/> {Math.abs(change).toFixed(1)}%</span>;
    return <span className="text-muted-foreground">-</span>;
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><TrendingUp /> Business Statistics</CardTitle>
          <CardDescription>An overview of your top performing products and customers with period comparison.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg">
            <div className="space-y-1">
                <Label>Primary Period</Label>
                <DateRangePicker date={dateRange} onDateChange={setDateRange} />
            </div>
            <div className="space-y-1">
                <Label>Comparison Period</Label>
                <DateRangePicker date={compareDateRange} onDateChange={setCompareDateRange} />
            </div>
            <div className="space-y-1">
                <Label>Business Profile</Label>
                <Select value={filters.via} onValueChange={v => setFilters({...filters, via: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {appSettings?.businessProfiles.map(o => <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </div>
          
          <Tabs defaultValue="products">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-7 mb-4">
                <TabsTrigger value="products">Top Products</TabsTrigger>
                 <TabsTrigger value="buying_products">Top Buying</TabsTrigger>
                <TabsTrigger value="customers">Top Customers</TabsTrigger>
                <TabsTrigger value="suppliers">Top Suppliers</TabsTrigger>
                <TabsTrigger value="untrustworthy">Untrustworthy</TabsTrigger>
                 <TabsTrigger value="collection">Top Collection</TabsTrigger>
                 <TabsTrigger value="graph">Graph Chart</TabsTrigger>
            </TabsList>
            
            <TabsContent value="products">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Package /> Top Selling Products</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Product Name</TableHead><TableHead className="text-right">Primary Period</TableHead><TableHead className="text-right">Compare Period</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {topProducts.map((product, index) => (
                        <TableRow key={product.id}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>{product.name}</TableCell>
                          <TableCell className="text-right font-semibold">{product.quantity1}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{product.quantity2}</TableCell>
                          <TableCell className="text-right">{renderChange(product.change)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="buying_products">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><Package /> Top Buying Products</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Product Name</TableHead><TableHead className="text-right">Primary Period</TableHead><TableHead className="text-right">Compare Period</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader>
                            <TableBody>
                            {topBuyingProducts.map((product, index) => (
                                <TableRow key={product.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell>{product.name}</TableCell>
                                <TableCell className="text-right font-semibold">{product.quantity1}</TableCell>
                                <TableCell className="text-right text-muted-foreground">{product.quantity2}</TableCell>
                                <TableCell className="text-right">{renderChange(product.change)}</TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>

            <TabsContent value="customers">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Users /> Top Customers</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Customer Name</TableHead><TableHead className="text-right">Primary Period</TableHead><TableHead className="text-right">Compare Period</TableHead><TableHead className="text-right">Change</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {topCustomers.map((customer, index) => (
                        <TableRow key={customer.partyId}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Link href={`/parties/${customer.partyId}`} className="hover:underline text-primary">
                                {customer.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{formatAmount(customer.amount1)}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{formatAmount(customer.amount2)}</TableCell>
                          <TableCell className="text-right">{renderChange(customer.change)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

             <TabsContent value="suppliers">
               <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Users /> Top Suppliers</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Supplier Name</TableHead><TableHead className="text-right">Total Purchase</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {topSuppliers.map((supplier, index) => (
                        <TableRow key={supplier.partyId}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Link href={`/parties/${supplier.partyId}`} className="hover:underline text-primary">
                                {supplier.name}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">{formatAmount(supplier.amount)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="untrustworthy">
               <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg text-destructive"><AlertTriangle/> Untrustworthy Parties</CardTitle>
                  <CardDescription>Parties with significant dues and long payment delays.</CardDescription>
                  <div className="pt-2">
                    <Label>Filter by Party Type</Label>
                    <Select value={filters.partyType} onValueChange={(v) => setFilters(f => ({...f, partyType: v}))}>
                      <SelectTrigger><SelectValue/></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {(appSettings?.partyTypes || []).map(type => (
                           <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Rank</TableHead><TableHead>Party Name</TableHead><TableHead>Last Payment</TableHead><TableHead>Payment Period (Days)</TableHead><TableHead className="text-right">Amount Due</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {untrustworthyParties.map((party, index) => (
                        <TableRow key={party.partyId}>
                          <TableCell>{index + 1}</TableCell>
                          <TableCell>
                            <Link href={`/parties/${party.partyId}`} className="hover:underline text-primary">
                                {party.name}
                            </Link>
                          </TableCell>
                           <TableCell>{party.lastPaymentDate ? formatDate(party.lastPaymentDate) : 'N/A'}</TableCell>
                          <TableCell>{party.paymentPeriod}</TableCell>
                          <TableCell className="text-right font-mono">{formatAmount(Math.abs(party.balance))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
             <TabsContent value="collection">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg"><Coins /> Top Collection Days</CardTitle>
                  <CardDescription>Days when you received the most payments.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead className="text-right">Total Collection</TableHead><TableHead className="text-center">No. of Payments</TableHead><TableHead className="text-right">Min. Payment</TableHead><TableHead className="text-right">Max. Payment</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {topCollectionDays.map((day) => (
                        <TableRow key={day.date}>
                          <TableCell>{formatDate(day.date)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatAmount(day.total)}</TableCell>
                          <TableCell className="text-center">{day.count}</TableCell>
                          <TableCell className="text-right">{formatAmount(day.min)}</TableCell>
                          <TableCell className="text-right">{formatAmount(day.max)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

             <TabsContent value="graph">
                <Card className="mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg"><BarChart2/> Monthly Performance</CardTitle>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Chart Date Range</Label>
                                <div className="flex gap-2 items-center">
                                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                                    <div className="flex gap-1">
                                      {[2,3,6,12].map(m => (
                                          <Button key={m} size="sm" variant="outline" onClick={() => setDatePreset(m)}>
                                              {m}M
                                          </Button>
                                      ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={{}} className="h-[400px] w-full">
                            <BarChart data={chartData}>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="month" tickLine={false} tickMargin={10} axisLine={false} />
                                <YAxis />
                                <Tooltip content={<ChartTooltipContent />} />
                                <Bar dataKey="sales" fill="hsl(var(--primary))" radius={4} name="Total Sales" />
                                <Bar dataKey="purchases" fill="hsl(var(--secondary))" radius={4} name="Total Purchases" />
                                <Bar dataKey="profit" fill="var(--color-chart-2)" radius={4} name="Net Profit" />
                            </BarChart>
                        </ChartContainer>
                        <div className="mt-4 p-4 border rounded-lg text-sm text-muted-foreground">
                            <p>This chart shows the total sales, total purchases, and net profit for each month in the selected date range. Net profit is calculated as (Total Sales - Cost of Goods Sold) based on sale transactions in the period.</p>
                        </div>
                    </CardContent>
                </Card>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
