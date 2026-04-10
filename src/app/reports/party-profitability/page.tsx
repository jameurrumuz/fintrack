
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2, Users } from 'lucide-react';
import type { Transaction, Party, InventoryItem, AppSettings } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { format as formatFns, startOfMonth } from 'date-fns';

interface PartyProfit {
  partyId: string;
  partyName: string;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
}

export default function PartyProfitabilityReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
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
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubInventory = subscribeToInventoryItems(setInventory, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    getAppSettings().then(setAppSettings);

    setLoading(false);

    return () => {
      unsubTransactions();
      unsubParties();
      unsubInventory();
    };
  }, [toast]);

  const { profitabilityData, totalProfit } = useMemo(() => {
    const itemCostMap = new Map(inventory.map(item => [item.id, item.cost]));
    const partyProfitMap = new Map<string, PartyProfit>();
    const partyNameMap = new Map(parties.map(p => [p.id, p.name]));

    const saleTransactions = transactions.filter(t => 
        (t.type === 'sale' || t.type === 'credit_sale') && 
        t.enabled && 
        t.items && 
        t.items.length > 0 &&
        t.partyId
    );
    
    const filteredSales = saleTransactions.filter(t => {
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      if (filters.via !== 'all' && t.via !== filters.via) return false;
      return true;
    });

    filteredSales.forEach(t => {
      if (!t.partyId) return;
      
      let saleProfit = 0;
      let saleCost = 0;
      let saleTotal = 0;

      t.items!.forEach(item => {
        const cost = itemCostMap.get(item.id) || 0;
        saleTotal += item.price * item.quantity;
        saleCost += cost * item.quantity;
      });
      
      saleProfit = saleTotal - saleCost;

      const existingParty = partyProfitMap.get(t.partyId);
      if (existingParty) {
        existingParty.totalSales += saleTotal;
        existingParty.totalCost += saleCost;
        existingParty.totalProfit += saleProfit;
      } else {
        partyProfitMap.set(t.partyId, {
          partyId: t.partyId,
          partyName: partyNameMap.get(t.partyId) || 'Unknown Party',
          totalSales: saleTotal,
          totalCost: saleCost,
          totalProfit: saleProfit,
        });
      }
    });
    
    const profitabilityData = Array.from(partyProfitMap.values()).sort((a,b) => b.totalProfit - a.totalProfit);
    const totalProfit = profitabilityData.reduce((sum, p) => sum + p.totalProfit, 0);

    return { profitabilityData, totalProfit };
  }, [transactions, parties, inventory, filters]);

  const handlePrint = () => window.print();

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 print-area">
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

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Users className="text-green-600" />Party-wise Profitability Report</CardTitle>
              <CardDescription>Analyze profit generated from each customer.</CardDescription>
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
            <div className="space-y-1"><Label>Transaction Via</Label>
                <Select value={filters.via} onValueChange={v => setFilters({...filters, via: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        {appSettings?.businessProfiles.map(o => <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Party Name</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Total Profit</TableHead>
                  <TableHead className="text-right">Profit Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                ) : profitabilityData.length > 0 ? (
                  profitabilityData.map(p => {
                    const margin = p.totalSales > 0 ? (p.totalProfit / p.totalSales) * 100 : 0;
                    return (
                        <TableRow key={p.partyId}>
                            <TableCell className="font-medium">{p.partyName}</TableCell>
                            <TableCell className="text-right font-mono">{formatAmount(p.totalSales)}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">{formatAmount(p.totalCost)}</TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatAmount(p.totalProfit)}</TableCell>
                            <TableCell className="text-right"><Badge variant={margin >= 0 ? "default" : "destructive"}>{margin.toFixed(2)}%</Badge></TableCell>
                        </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">No sales data found for profitability analysis.</TableCell></TableRow>
                )}
              </TableBody>
               <TableFooter>
                <TableRow>
                    <TableCell colSpan={3} className="text-right font-bold">Total Profit</TableCell>
                    <TableCell className="text-right font-bold font-mono text-green-600">{formatAmount(totalProfit)}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
