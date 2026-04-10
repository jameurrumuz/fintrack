

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, SlidersHorizontal, ArrowDown, ArrowUp, Edit, Trash2, MoreVertical, ArrowRightLeft } from 'lucide-react';
import type { InventoryMovement, InventoryItem, AppSettings } from '@/types';
import { subscribeToStockAdjustments, subscribeToInventoryItems, updateStockAdjustment, deleteStockAdjustment } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { formatDate, formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { format as formatFns } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';


const EditAdjustmentDialog = ({ adjustment, open, onOpenChange, onSave }: { adjustment: InventoryMovement | null; open: boolean; onOpenChange: (open: boolean) => void; onSave: (id: string, qty: number, notes: string) => void; }) => {
    const [quantity, setQuantity] = useState(0);
    const [notes, setNotes] = useState('');
    
    useEffect(() => {
        if(adjustment) {
            setQuantity(adjustment.quantity);
            setNotes(adjustment.notes || '');
        }
    }, [adjustment]);

    if (!adjustment) return null;

    const handleSave = () => {
        onSave(adjustment.id, quantity, notes);
        onOpenChange(false);
    }
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Edit Adjustment</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" value={quantity} onChange={e => setQuantity(parseFloat(e.target.value) || 0)} placeholder="e.g., 5 or -5" />
                        <p className="text-xs text-muted-foreground">Use a positive number to add stock, a negative number to subtract.</p>
                    </div>
                     <div className="space-y-2">
                        <Label>Reason / Notes</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


export default function StockAdjustmentReport() {
  const [adjustments, setAdjustments] = useState<InventoryMovement[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [editingAdjustment, setEditingAdjustment] = useState<InventoryMovement | null>(null);


  const [filters, setFilters] = useState({
    dateRange: { from: new Date(new Date().setDate(1)), to: new Date() } as DateRange | undefined,
    location: 'all',
    productId: 'all',
  });

  useEffect(() => {
    setLoading(true);
    const unsubAdjustments = subscribeToStockAdjustments(setAdjustments, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubInventory = subscribeToInventoryItems(setInventory, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    getAppSettings().then(setAppSettings);
    
    const timer = setTimeout(() => setLoading(false), 500);

    return () => {
      unsubAdjustments();
      unsubInventory();
      clearTimeout(timer);
    };
  }, [toast]);
  
  const filteredAdjustments = useMemo(() => {
    const itemMap = new Map(inventory.map(i => [i.id, i.name]));
    
    return adjustments.filter(adj => {
        if (filters.dateRange?.from) {
            const fromDate = new Date(filters.dateRange.from);
            fromDate.setHours(0,0,0,0);
            if (new Date(adj.date) < fromDate) return false;
        }
        if (filters.dateRange?.to) {
            const toDate = new Date(filters.dateRange.to);
            toDate.setHours(23,59,59,999);
            if (new Date(adj.date) > toDate) return false;
        }
        if (filters.location !== 'all') {
            if (filters.location === 'default') {
                if(adj.location) return false;
            } else if (adj.location !== filters.location) {
                return false;
            }
        }
        if (filters.productId !== 'all' && adj.itemId !== filters.productId) return false;
        return true;
    }).map(adj => ({...adj, itemName: itemMap.get(adj.itemId) || 'Unknown Item'}));

  }, [adjustments, filters, inventory]);
  
  const handleSaveEdit = async (id: string, newQuantity: number, newNotes: string) => {
    try {
      await updateStockAdjustment(id, newQuantity, newNotes);
      toast({ title: 'Success', description: 'Adjustment updated and stock recalculated.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStockAdjustment(id);
      toast({ title: 'Success', description: 'Adjustment deleted and stock reverted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    }
  };


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
       <div className="mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>
      
      <EditAdjustmentDialog 
        adjustment={editingAdjustment} 
        open={!!editingAdjustment} 
        onOpenChange={() => setEditingAdjustment(null)}
        onSave={handleSaveEdit}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><SlidersHorizontal/>Stock Adjustment Report</CardTitle>
          <CardDescription>A log of all manual stock additions and subtractions.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6 p-4 border rounded-lg items-end">
            <div className="grid gap-1">
              <Label>Date Range</Label>
              <DateRangePicker date={filters.dateRange} onDateChange={(date) => setFilters(f => ({ ...f, dateRange: date }))} />
            </div>
            <div className="grid gap-1">
              <Label>Location</Label>
              <Select value={filters.location} onValueChange={(v) => setFilters(f => ({...f, location: v}))}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Locations" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="default">Default</SelectItem>
                    {(appSettings?.inventoryLocations || []).map(loc => (
                        <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1">
              <Label>Product</Label>
              <Select value={filters.productId} onValueChange={(v) => setFilters(f => ({...f, productId: v}))}>
                <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="All Products" /></SelectTrigger>
                <SelectContent><SelectItem value="all">All Products</SelectItem>{inventory.map(item => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                ) : filteredAdjustments.length > 0 ? (
                  filteredAdjustments.map(adj => {
                    let typeBadge;
                    if (adj.type === 'transfer') {
                        typeBadge = <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50"><ArrowRightLeft className="mr-1 h-3 w-3"/> Transfer</Badge>
                    } else if (adj.quantity > 0) {
                        typeBadge = <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50"><ArrowUp className="mr-1 h-3 w-3"/> Adjustment</Badge>
                    } else {
                        typeBadge = <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50"><ArrowDown className="mr-1 h-3 w-3"/> Adjustment</Badge>
                    }
                    
                    return (
                    <TableRow key={adj.id}>
                      <TableCell>{formatDate(adj.date)}</TableCell>
                      <TableCell>{adj.itemName}</TableCell>
                      <TableCell>{typeBadge}</TableCell>
                      <TableCell><Badge variant="secondary">{adj.location || 'default'}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{adj.notes}</TableCell>
                      <TableCell className="text-right font-mono">{adj.quantity > 0 ? `+${adj.quantity}` : adj.quantity}</TableCell>
                      <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => setEditingAdjustment(adj)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                            <AlertDialogDescription>This will delete the adjustment record and revert the stock change. This action cannot be undone.</AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={() => handleDelete(adj.id)}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )})
                ) : (
                   <TableRow><TableCell colSpan={7} className="h-24 text-center">No adjustments found for the selected criteria.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
