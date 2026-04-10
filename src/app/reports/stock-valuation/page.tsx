

'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, DollarSign, Search, Check, ChevronsUpDown, X, Printer, Share2 } from 'lucide-react';
import type { Transaction, InventoryItem, AppSettings } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { format as formatFns, startOfMonth } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAppSettings } from '@/services/settingsService';


interface StockValuationRow {
  productId: string;
  productName: string;
  closingStock: number;
  purchaseValue: number; // Represents value of closing stock at cost
  saleValue: number;
  profit: number;
}

const MultiProductSelect = ({ items, selected, onChange }: { items: InventoryItem[], selected: string[], onChange: (selected: string[]) => void }) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (itemId: string) => {
        const newSelected = selected.includes(itemId)
            ? selected.filter(id => id !== itemId)
            : [...selected, itemId];
        onChange(newSelected);
    };
    
    const handleRemove = (e: React.MouseEvent, itemId: string) => {
        e.stopPropagation();
        const newSelected = selected.filter(id => id !== itemId);
        onChange(newSelected);
    }

    const selectedItems = selected.map(id => items.find(item => item.id === id)).filter(Boolean) as InventoryItem[];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10">
                    <div className="flex flex-wrap gap-1">
                        {selectedItems.length > 0 ? (
                             selectedItems.map(item => (
                                <Badge key={item.id} variant="secondary" className="pr-1">
                                    {item.name}
                                    <div role="button" tabIndex={0} className="ml-1 rounded-full" onClick={(e) => handleRemove(e, item.id)} onKeyDown={(e) => { if (e.key === "Enter") handleRemove(e, item.id); }}>
                                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </div>
                                </Badge>
                            ))
                        ) : (
                           "Select or search products..."
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search product..." />
                    <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={item.name}
                                    onSelect={() => handleSelect(item.id)}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", selected.includes(item.id) ? "opacity-100" : "opacity-0")} />
                                    {item.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

function StockValuationContent() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubInventory = subscribeToInventoryItems(setInventoryItems, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    getAppSettings().then(setAppSettings);

    const timer = setTimeout(() => setLoading(false), 500);

    return () => {
      unsubTransactions();
      unsubInventory();
      clearTimeout(timer);
    };
  }, [toast]);

  const categories = useMemo(() => {
    const allCategories = new Set(inventoryItems.map(item => item.category));
    return Array.from(allCategories).filter(Boolean); // Filter out empty or undefined categories
  }, [inventoryItems]);

  const { reportData, totals } = useMemo(() => {
    let itemsToProcess = inventoryItems;

    if (filterCategory !== 'all') {
      itemsToProcess = itemsToProcess.filter(item => item.category === filterCategory);
    }
    
    if (selectedProductIds.length > 0) {
        itemsToProcess = itemsToProcess.filter(item => selectedProductIds.includes(item.id));
    }
    
    if (itemsToProcess.length === 0) return { reportData: [], totals: { purchase: 0, sale: 0, profit: 0, closingStock: 0 } };

    const data: StockValuationRow[] = [];

    itemsToProcess.forEach(item => {
      const closingStock = item.quantity; // Use the actual current stock quantity
      const purchaseValue = closingStock * item.cost;
      const saleValue = closingStock * item.price;
      const profit = saleValue - purchaseValue;
      
      data.push({
        productId: item.id,
        productName: item.name,
        closingStock,
        purchaseValue,
        saleValue,
        profit,
      });
    });

    const totals = data.reduce((acc, row) => {
        acc.purchase += row.purchaseValue;
        acc.sale += row.saleValue;
        acc.profit += row.profit;
        acc.closingStock += row.closingStock;
        return acc;
    }, { purchase: 0, sale: 0, profit: 0, closingStock: 0 });

    return { reportData: data, totals };
  }, [inventoryItems, selectedProductIds, filterCategory]);

  const handlePrint = () => window.print();

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
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

      <div className="print-area">
      <Card>
        <CardHeader>
           <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
                <CardTitle className="flex items-center gap-2"><DollarSign />Stock Valuation Report</CardTitle>
                <CardDescription>Analyze the value of your current stock based on cost and sale prices.</CardDescription>
            </div>
            <div className="flex gap-2 no-print">
              <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
              <Button disabled><Share2 className="mr-2 h-4 w-4" /> Share</Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 border rounded-lg no-print">
            <div className="grid gap-1 flex-grow">
                <Label>Category</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger><SelectValue placeholder="All Categories" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-1 flex-grow">
              <Label>Products</Label>
              <MultiProductSelect items={inventoryItems} selected={selectedProductIds} onChange={setSelectedProductIds} />
            </div>
          </div>
          
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Stock Quantity</TableHead>
                  <TableHead className="text-right">Purchase Value</TableHead>
                  <TableHead className="text-right">Sale Value</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                ) : reportData.length > 0 ? (
                  reportData.map(row => (
                    <TableRow key={row.productId}>
                      <TableCell className="font-medium">{row.productName}</TableCell>
                      <TableCell className="text-center font-bold">{row.closingStock}</TableCell>
                      <TableCell className="text-right font-mono">{formatAmount(row.purchaseValue)}</TableCell>
                      <TableCell className="text-right font-mono">{formatAmount(row.saleValue)}</TableCell>
                      <TableCell className="text-right font-mono font-bold text-green-600">{formatAmount(row.profit)}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={5} className="h-24 text-center">Select products to generate the report.</TableCell></TableRow>
                )}
              </TableBody>
               <TableFooter>
                <TableRow>
                  <TableCell className="font-bold text-right">Totals</TableCell>
                  <TableCell className="font-bold text-center">{totals.closingStock}</TableCell>
                  <TableCell className="font-bold text-right font-mono">{formatAmount(totals.purchase)}</TableCell>
                  <TableCell className="font-bold text-right font-mono">{formatAmount(totals.sale)}</TableCell>
                  <TableCell className="font-bold text-right font-mono text-green-600">{formatAmount(totals.profit)}</TableCell>
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


export default function StockValuationReportPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <StockValuationContent />
        </Suspense>
    );
}
