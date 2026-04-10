
'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToPartyById } from '@/services/portalService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { subscribeToAllTransactions } from '@/services/transactionService';
import type { Party, InventoryItem, Transaction } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, ArrowLeft, Package, ShoppingCart, Printer, BarChart3, TrendingUp, Boxes, Search } from 'lucide-react';
import { formatAmount, formatDate } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format as formatFns, startOfMonth } from 'date-fns';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const colors = {
    primary: '#1A05A2',
    secondary: '#8F0177',
    accent: '#DE1A58',
    gradient: 'from-[#1A05A2] via-[#8F0177] to-[#DE1A58]',
    gradient2: 'from-[#8F0177] via-[#DE1A58] to-[#F67D31]',
};

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export default function MarketingInventoryPage() {
  const [party, setParty] = useState<Party | null>(null);
  const [assignedInventory, setAssignedInventory] = useState<InventoryItem[]>([]);
  const [salesData, setSalesData] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: startOfMonth(today), to: today };
  });

  useEffect(() => {
    const partyId = getCookie('loggedInPartyId');
    if (!partyId) {
      router.replace('/portal/login');
      return;
    }

    const unsubParty = subscribeToPartyById(partyId, (fetchedParty) => {
      if (fetchedParty && fetchedParty.partyType === 'Marketing') {
        setParty(fetchedParty);
      } else {
        router.replace('/portal/user/dashboard');
      }
    }, console.error);

    return () => unsubParty();
  }, [router]);

  useEffect(() => {
    if (!party) return;
    setLoading(true);
    const unsubInventory = subscribeToInventoryItems((allItems) => {
      const userProductIds = new Set(party.marketingProductIds || []);
      setAssignedInventory(allItems.filter(item => userProductIds.has(item.id)));
    }, console.error);

    const unsubTransactions = subscribeToAllTransactions((allTransactions) => {
        const userProductIds = new Set(party.marketingProductIds || []);
        setSalesData(allTransactions.filter(tx => 
            (tx.type === 'sale' || tx.type === 'credit_sale') &&
            tx.items?.some(item => userProductIds.has(item.id))
        ));
    }, console.error);
    
    setLoading(false);
    return () => { unsubInventory(); unsubTransactions(); };
  }, [party]);

  const salesReport = useMemo(() => {
    const fromStr = dateRange?.from ? formatFns(dateRange.from, 'yyyy-MM-dd') : '1970-01-01';
    const toStr = dateRange?.to ? formatFns(dateRange.to, 'yyyy-MM-dd') : '9999-12-31';
    
    const report: { date: string; itemName: string; quantity: number }[] = [];
    salesData.filter(tx => tx.date >= fromStr && tx.date <= toStr).forEach(tx => {
        tx.items?.forEach(item => {
            if (assignedInventory.some(ai => ai.id === item.id)) {
                report.push({ date: tx.date, itemName: item.name, quantity: item.quantity });
            }
        });
    });
    return report.sort((a,b) => b.date.localeCompare(a.date));
  }, [salesData, assignedInventory, dateRange]);
  
  const stats = useMemo(() => ({
    stock: assignedInventory.reduce((s, i) => s + i.quantity, 0),
    sold: salesReport.reduce((s, i) => s + i.quantity, 0),
    value: assignedInventory.reduce((s, i) => s + (i.quantity * i.price), 0)
  }), [assignedInventory, salesReport]);

  if (loading || !party) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-[#1A05A2]" /></div>;

  return (
    <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 min-h-screen">
        <header className={cn("bg-gradient-to-r p-4 pt-8 rounded-b-3xl shadow-lg text-white sticky top-0 z-10", colors.gradient)}>
            <div className="container mx-auto flex items-center justify-between">
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => router.back()}><ArrowLeft /></Button>
                <h1 className="text-xl font-bold flex items-center gap-2"><Boxes /> Marketing Store</h1>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/20 rounded-full" onClick={() => window.print()}><Printer className="h-5 w-5" /></Button>
            </div>
        </header>

        <main className="container mx-auto p-4 space-y-6 pb-20">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <Card className="border-0 shadow-lg rounded-3xl bg-white overflow-hidden">
                        <CardHeader className="p-4 bg-blue-50/50 pb-2">
                            <CardDescription className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1"><Boxes className="h-3 w-3"/> Current Stock</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0"><p className="text-2xl font-black text-[#1A05A2]">{stats.stock}</p></CardContent>
                    </Card>
                </motion.div>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}>
                    <Card className="border-0 shadow-lg rounded-3xl bg-white overflow-hidden">
                        <CardHeader className="p-4 bg-purple-50/50 pb-2">
                            <CardDescription className="text-[10px] font-bold text-purple-600 uppercase flex items-center gap-1"><TrendingUp className="h-3 w-3"/> Sold Quantity</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0"><p className="text-2xl font-black text-[#8F0177]">{stats.sold}</p></CardContent>
                    </Card>
                </motion.div>
                <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2 }} className="col-span-2 lg:col-span-1">
                    <Card className="border-0 shadow-lg rounded-3xl bg-white overflow-hidden">
                        <CardHeader className="p-4 bg-red-50/50 pb-2">
                            <CardDescription className="text-[10px] font-bold text-red-600 uppercase flex items-center gap-1"><BarChart3 className="h-3 w-3"/> Stock Value</CardDescription>
                        </CardHeader>
                        <CardContent className="p-4 pt-0"><p className={`text-2xl font-black bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>৳{stats.value.toLocaleString()}</p></CardContent>
                    </Card>
                </motion.div>
            </div>

            <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white">
                <CardHeader className={cn("p-6 text-white", colors.gradient)}>
                    <CardTitle className="flex items-center gap-2"><ShoppingCart /> Product Sales Report</CardTitle>
                    <div className="mt-4 no-print bg-white/10 p-2 rounded-2xl">
                        <DateRangePicker date={dateRange} onDateChange={setDateRange} className="text-white" />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader><TableRow className="bg-gray-50 border-0"><TableHead className="font-bold text-[10px] uppercase text-gray-400">Date</TableHead><TableHead className="font-bold text-[10px] uppercase text-gray-400">Product</TableHead><TableHead className="text-right font-bold text-[10px] uppercase text-gray-400">Qty</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {salesReport.length > 0 ? salesReport.map((sale, idx) => (
                                <TableRow key={idx} className="border-b border-gray-50 group hover:bg-gray-50 transition-colors">
                                    <TableCell className="text-[10px] font-bold text-gray-500">{formatDate(sale.date)}</TableCell>
                                    <TableCell className="text-sm font-semibold text-gray-800">{sale.itemName}</TableCell>
                                    <TableCell className="text-right font-black text-[#8F0177]">{sale.quantity}</TableCell>
                                </TableRow>
                            )) : (
                                <TableRow><TableCell colSpan={3} className="h-40 text-center text-gray-400 text-sm">No sales found for this period.</TableCell></TableRow>
                            )}
                        </TableBody>
                        <TableFooter className="bg-gray-100/50 border-t-2 border-gray-200">
                            <TableRow>
                                <TableCell colSpan={2} className="font-black text-sm text-gray-800 uppercase">Total Sales</TableCell>
                                <TableCell className="text-right font-black text-xl text-[#DE1A58]">{stats.sold}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </CardContent>
            </Card>
        </main>
    </div>
  );
}
