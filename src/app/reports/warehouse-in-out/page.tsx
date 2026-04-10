

'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Warehouse, ArrowUp, ArrowDown, X, ChevronsUpDown, Check } from 'lucide-react';
import Link from 'next/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import type { InventoryItem, AppSettings, Transaction, Party } from '@/types';
import { getAppSettings } from '@/services/settingsService';
import { formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { format, startOfMonth } from 'date-fns';

interface StockMovement {
    id: string;
    date: string;
    productName: string;
    from: string;
    to: string;
    quantity: number;
    type: 'in' | 'out';
}

const MultiPartySelect = ({ parties, selected, onChange }: { parties: Party[], selected: string[], onChange: (selected: string[]) => void }) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (partyId: string) => {
        const newSelected = selected.includes(partyId)
            ? selected.filter(id => id !== partyId)
            : [...selected, partyId];
        onChange(newSelected);
    };

    const handleRemove = (e: React.MouseEvent, partyId: string) => {
        e.stopPropagation();
        const newSelected = selected.filter(id => id !== partyId);
        onChange(newSelected);
    };

    const selectedParties = selected.map(id => parties.find(party => party.id === id)).filter(Boolean) as Party[];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10">
                    <div className="flex flex-wrap gap-1">
                        {selectedParties.length > 0 ? (
                            selectedParties.map(party => (
                                <Badge key={party.id} variant="secondary" className="pr-1">
                                    {party.name}
                                    <div role="button" tabIndex={0} className="ml-1 rounded-full" onClick={(e) => handleRemove(e, party.id)} onKeyDown={(e) => { if (e.key === "Enter") handleRemove(e, party.id); }}>
                                        <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                    </div>
                                </Badge>
                            ))
                        ) : (
                            "Select parties..."
                        )}
                    </div>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search party..." />
                    <CommandList>
                        <CommandEmpty>No party found.</CommandEmpty>
                        <CommandGroup>
                            {parties.map((party) => (
                                <CommandItem key={party.id} value={party.name} onSelect={() => handleSelect(party.id)}>
                                    <Check className={cn("mr-2 h-4 w-4", selected.includes(party.id) ? "opacity-100" : "opacity-0")} />
                                    {party.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

function WarehouseInOutReportContent() {
  const [loading, setLoading] = useState(true);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [filters, setFilters] = useState({
    dateFrom: format(startOfMonth(new Date()), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
    location: 'all',
    productId: 'all',
    partyIds: [] as string[],
    movementType: 'all' as 'all' | 'in' | 'out',
  });

  useEffect(() => {
    setLoading(true);
    const unsubInventory = subscribeToInventoryItems(setInventoryItems, console.error);
    const unsubTransactions = subscribeToAllTransactions(setTransactions, console.error);
    const unsubParties = subscribeToParties(setParties, console.error);
    getAppSettings().then(setAppSettings);
    
    const timer = setTimeout(() => setLoading(false), 800); // Give some time for data to load

    return () => {
        unsubInventory();
        unsubTransactions();
        unsubParties();
        clearTimeout(timer);
    };
  }, []);

  const movements = useMemo(() => {
    const partyMap = new Map(parties.map(p => [p.id, p.name]));
    const allMovements: StockMovement[] = [];

    const filteredTransactions = transactions.filter(tx => {
      if (!tx.items || !tx.enabled) return false;
      if (filters.dateFrom && tx.date < filters.dateFrom) return false;
      if (filters.dateTo && tx.date > filters.dateTo) return false;
      if (filters.partyIds.length > 0 && !filters.partyIds.includes(tx.partyId || '')) return false;
      return true;
    });

    filteredTransactions.forEach(tx => {
      tx.items!.forEach((item, index) => {
        if (filters.productId !== 'all' && item.id !== filters.productId) {
          return;
        }

        const location = item.location || 'default';
        let movement: Omit<StockMovement, 'id'> | null = null;
        
        if (tx.type === 'purchase' || tx.type === 'credit_purchase' || tx.type === 'sale_return') {
          movement = { date: tx.date, productName: item.name, from: partyMap.get(tx.partyId!) || 'Supplier', to: location, quantity: item.quantity, type: 'in' };
        } else if (tx.type === 'sale' || tx.type === 'credit_sale' || tx.type === 'purchase_return') {
          movement = { date: tx.date, productName: item.name, from: location, to: partyMap.get(tx.partyId!) || 'Customer', quantity: item.quantity, type: 'out' };
        }
        
        if (movement) {
          if (filters.movementType !== 'all' && movement.type !== filters.movementType) {
            return;
          }
          if (filters.location === 'all' || movement.from === filters.location || movement.to === filters.location) {
            allMovements.push({ ...movement, id: `${tx.id}-${item.id}-${index}` });
          }
        }
      });
    });
    
    return allMovements.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, parties, filters]);
  
  const { totalIn, totalOut } = useMemo(() => {
    const totalIn = movements.filter(m => m.type === 'in').reduce((sum, m) => sum + m.quantity, 0);
    const totalOut = movements.filter(m => m.type === 'out').reduce((sum, m) => sum + m.quantity, 0);
    return { totalIn, totalOut };
  }, [movements]);


  const handleFilterChange = (field: keyof typeof filters, value: string | string[]) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Warehouse />Warehouse In/Out Report</CardTitle>
          <CardDescription>Track stock movements between your warehouses and locations.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6 p-4 border rounded-lg">
            <div className="space-y-1"><Label>From Date</Label><Input type="date" value={filters.dateFrom} onChange={e => handleFilterChange('dateFrom', e.target.value)} /></div>
            <div className="space-y-1"><Label>To Date</Label><Input type="date" value={filters.dateTo} onChange={e => handleFilterChange('dateTo', e.target.value)} /></div>
            <div className="space-y-1">
                <Label>Location</Label>
                <Select value={filters.location} onValueChange={v => handleFilterChange('location', v)}>
                    <SelectTrigger><SelectValue placeholder="Select location..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Locations</SelectItem>
                        {(appSettings?.inventoryLocations || ['default']).map(loc => (
                            <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label>Product</Label>
                <Select value={filters.productId} onValueChange={v => handleFilterChange('productId', v)}>
                    <SelectTrigger><SelectValue placeholder="Select product..." /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        {inventoryItems.map(item => (
                            <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
             <div className="space-y-1">
                 <Label>Movement Type</Label>
                <Select value={filters.movementType} onValueChange={v => handleFilterChange('movementType', v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="in">Stock In</SelectItem>
                        <SelectItem value="out">Stock Out</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                 <Label>Party</Label>
                <MultiPartySelect parties={parties} selected={filters.partyIds} onChange={(ids) => handleFilterChange('partyIds', ids)} />
            </div>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>From</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                ) : movements.length > 0 ? (
                  movements.map(move => (
                    <TableRow key={move.id}>
                      <TableCell>{formatDate(move.date)}</TableCell>
                      <TableCell>{move.productName}</TableCell>
                      <TableCell>
                          {move.type === 'in' ? (
                            <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><ArrowDown className="mr-1 h-3 w-3"/> IN</Badge>
                          ) : (
                            <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50"><ArrowUp className="mr-1 h-3 w-3"/> OUT</Badge>
                          )}
                      </TableCell>
                      <TableCell>{move.from}</TableCell>
                      <TableCell>{move.to}</TableCell>
                      <TableCell className="text-right font-mono">{move.quantity}</TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow><TableCell colSpan={6} className="h-24 text-center">No movements found for the selected criteria.</TableCell></TableRow>
                )}
              </TableBody>
               <TableFooter>
                <TableRow>
                  <TableCell colSpan={5} className="text-right font-bold">Totals:</TableCell>
                  <TableCell className="text-right font-mono font-bold space-x-4">
                    <span className="text-green-600">In: {totalIn}</span>
                    <span className="text-red-600">Out: {totalOut}</span>
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


export default function WarehouseInOutReportPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <WarehouseInOutReportContent />
        </Suspense>
    )
}
