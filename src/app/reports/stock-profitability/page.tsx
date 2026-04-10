
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2, PackageCheck, RefreshCcw } from 'lucide-react';
import type { Transaction, Party, InventoryItem, AppSettings } from '@/types';
import { subscribeToAllTransactions, recalculateAllFifoAndProfits } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { format as formatFns, startOfMonth } from 'date-fns';
import { useRouter } from 'next/navigation';

interface StockProfit {
  itemId: string;
  itemName: string;
  quantitySold: number;
  totalSales: number;
  totalCost: number;
  totalProfit: number;
}

export default function StockProfitabilityReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecalculating, setIsRecalculating] = useState(false);
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
  const router = useRouter();

  useEffect(() => {
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error loading parties' }));
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
    const stockProfitMap = new Map<string, StockProfit>();
    const inventoryMap = new Map(inventory.map(item => [item.id, item]));
    
    const saleTransactions = transactions.filter(t => 
        (t.type === 'sale' || t.type === 'credit_sale') && 
        t.enabled && 
        t.items && 
        t.items.length > 0
    );
    
    const filteredSales = saleTransactions.filter(t => {
      if (filters.dateFrom && t.date < filters.dateFrom) return false;
      if (filters.dateTo && t.date > filters.dateTo) return false;
      if (filters.via !== 'all' && t.via !== filters.via) return false;
      return true;
    });

    filteredSales.forEach(t => {
      t.items!.forEach(item => {
        const inventoryItem = inventoryMap.get(item.id);
        const itemName = inventoryItem?.name || item.name || 'Unknown Item';
        const saleValue = item.price * item.quantity;
        
        let costPerUnit = item.cost || 0;
        
        // If cost is missing or seems incorrect (e.g., higher than sale price), try to find a better cost.
        if (costPerUnit <= 0 || costPerUnit > item.price) {
          costPerUnit = inventoryItem?.cost || 0;
        }

        const totalCostForItem = costPerUnit * item.quantity;
        const profitValue = saleValue - totalCostForItem;

        const existingItem = stockProfitMap.get(item.id);
        if (existingItem) {
          existingItem.quantitySold += item.quantity;
          existingItem.totalSales += saleValue;
          existingItem.totalCost += totalCostForItem;
          existingItem.totalProfit += profitValue;
        } else {
          stockProfitMap.set(item.id, {
            itemId: item.id,
            itemName: itemName,
            quantitySold: item.quantity,
            totalSales: saleValue,
            totalCost: totalCostForItem,
            totalProfit: profitValue,
          });
        }
      });
    });
    
    const profitabilityData = Array.from(stockProfitMap.values()).sort((a,b) => b.totalProfit - a.totalProfit);
    const totalProfit = profitabilityData.reduce((sum, p) => sum + p.totalProfit, 0);

    return { profitabilityData, totalProfit };
  }, [transactions, inventory, filters]);

  const handleGlobalRecalculate = async () => {
      setIsRecalculating(true);
      toast({ title: 'Recalculation Started', description: 'Recalculating all sale profits based on FIFO. This may take some time...' });
      try {
        const result = await recalculateAllFifoAndProfits();
        toast({ title: 'Recalculation Complete!', description: `${result.updatedTransactions} sales transactions were re-costed and ${result.updatedItems} inventory items were updated.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Recalculation Failed', description: error.message });
      } finally {
        setIsRecalculating(false);
      }
  };


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
              <CardTitle className="flex items-center gap-2"><PackageCheck className="text-green-600" />Stock-wise Profitability Report</CardTitle>
              <CardDescription>Analyze profit generated from each product.</CardDescription>
            </div>
            <div className="flex gap-2 no-print">
               <Button onClick={handleGlobalRecalculate} variant="destructive" disabled={isRecalculating}>
                    {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCcw className="mr-2 h-4 w-4" />}
                    Recalculate All Profits
                </Button>
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
                  <TableHead>Item Name</TableHead>
                  <TableHead className="text-right">Quantity Sold</TableHead>
                  <TableHead className="text-right">Total Sales</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead className="text-right">Total Profit</TableHead>
                  <TableHead className="text-right">Profit Margin</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                ) : profitabilityData.length > 0 ? (
                  profitabilityData.map(p => {
                    const margin = p.totalSales > 0 ? (p.totalProfit / p.totalSales) * 100 : 0;
                    const hasZeroCost = p.totalCost <= 0 && p.quantitySold > 0;
                    return (
                        <TableRow key={p.itemId}>
                            <TableCell className="font-medium">{p.itemName}</TableCell>
                            <TableCell className="text-right font-mono">{p.quantitySold}</TableCell>
                            <TableCell className="text-right font-mono">{formatAmount(p.totalSales)}</TableCell>
                            <TableCell className="text-right font-mono text-red-600">
                                {hasZeroCost ? (
                                    <Link href={`/po-rt?items=${encodeURIComponent(JSON.stringify([{ productId: p.itemId, name: p.itemName, price: 0, quantity: 1 }]))}`} className="text-xs text-red-500 hover:underline">
                                        Update Cost
                                    </Link>
                                ) : formatAmount(p.totalCost)}
                            </TableCell>
                            <TableCell className="text-right font-mono text-green-600">{formatAmount(p.totalProfit)}</TableCell>
                            <TableCell className="text-right"><Badge variant={margin >= 0 ? "default" : "destructive"}>{margin.toFixed(2)}%</Badge></TableCell>
                        </TableRow>
                    );
                  })
                ) : (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">No sales data found for profitability analysis.</TableCell></TableRow>
                )}
              </TableBody>
               <TableFooter>
                <TableRow>
                    <TableCell colSpan={4} className="text-right font-bold">Total Profit</TableCell>
                    <TableCell className="text-right font-bold font-mono text-green-600">{formatAmount(totalProfit)}</TableCell>
                    <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
