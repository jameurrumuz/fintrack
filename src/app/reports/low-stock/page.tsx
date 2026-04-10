

'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Warehouse, FilePlus, ShoppingCart, Edit } from 'lucide-react';
import type { InventoryItem } from '@/types';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import { useRouter } from 'next/navigation';
import { formatAmount } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"


interface LowStockItem extends InventoryItem {
  reorderQty: number;
  selected: boolean;
}

export default function LowStockReportPage() {
  const [items, setItems] = useState<LowStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsubItems = subscribeToInventoryItems(
      (inventoryItems) => {
        const lowStock = inventoryItems
          .filter(item => item.quantity <= item.minStockLevel)
          .map(item => ({ ...item, reorderQty: item.minStockLevel > 0 ? item.minStockLevel : 10, selected: false }));
        setItems(lowStock);
        setLoading(false);
      },
      (err) => {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
        setLoading(false);
      }
    );
    return () => unsubItems();
  }, [toast]);

  const unconfiguredItems = useMemo(() => {
    return items.filter(item => item.minStockLevel === 0);
  }, [items]);


  const handleSelectionChange = (id: string, checked: boolean) => {
    setItems(items.map(item => item.id === id ? { ...item, selected: checked } : item));
  };

  const handleQuantityChange = (id: string, quantity: number) => {
    setItems(items.map(item => item.id === id ? { ...item, reorderQty: quantity } : item));
  };

  const selectedItems = useMemo(() => items.filter(item => item.selected), [items]);

  const { totalSelectedItems, totalOrderValue } = useMemo(() => {
    const totalItems = selectedItems.reduce((sum, item) => sum + item.reorderQty, 0);
    const totalValue = selectedItems.reduce((sum, item) => sum + (item.cost * item.reorderQty), 0);
    return { totalSelectedItems: totalItems, totalOrderValue: totalValue };
  }, [selectedItems]);

  const handleCreatePO = () => {
    if (selectedItems.length === 0) {
      toast({ variant: 'destructive', title: 'No items selected', description: 'Please select items to create a purchase order.' });
      return;
    }
    const poItems = selectedItems.map(item => ({
      productId: item.id,
      name: item.name,
      price: item.cost,
      quantity: item.reorderQty,
    }));
    
    const queryString = encodeURIComponent(JSON.stringify(poItems));
    router.push(`/po-rt?items=${queryString}`);
  };

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><Warehouse className="text-yellow-500" />Low Stock Report</CardTitle>
              <CardDescription>Products that need to be reordered and managed.</CardDescription>
            </div>
             <Button onClick={handleCreatePO} disabled={selectedItems.length === 0}>
              <FilePlus className="mr-2 h-4 w-4" /> Create Purchase Order ({selectedItems.length})
            </Button>
          </div>
        </CardHeader>
        <CardContent>
            <Tabs defaultValue="low-stock">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="low-stock">Low Stock Items</TabsTrigger>
                    <TabsTrigger value="unconfigured">Unconfigured Items <Badge variant="destructive" className="ml-2">{unconfiguredItems.length}</Badge></TabsTrigger>
                </TabsList>
                <TabsContent value="low-stock" className="mt-4">
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead className="w-[50px]"><Checkbox 
                                checked={items.length > 0 && items.every(item => item.selected)}
                                onCheckedChange={(checked) => setItems(items.map(item => ({...item, selected: !!checked})))}
                            /></TableHead>
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-center">Current Stock</TableHead>
                            <TableHead className="text-center">Min. Stock</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                            <TableHead className="w-[120px]">Reorder Qty</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                            ) : items.filter(item => item.minStockLevel > 0).length > 0 ? (
                            items.filter(item => item.minStockLevel > 0).map(item => (
                                <TableRow key={item.id} data-state={item.selected ? 'selected' : ''}>
                                <TableCell><Checkbox checked={item.selected} onCheckedChange={(checked) => handleSelectionChange(item.id, !!checked)} /></TableCell>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-center"><Badge variant="destructive">{item.quantity}</Badge></TableCell>
                                <TableCell className="text-center">{item.minStockLevel}</TableCell>
                                <TableCell className="text-right font-mono">{formatAmount(item.cost)}</TableCell>
                                <TableCell>
                                    <Input
                                    type="number"
                                    className="h-8 text-center"
                                    value={item.reorderQty}
                                    onChange={e => handleQuantityChange(item.id, parseInt(e.target.value) || 0)}
                                    />
                                </TableCell>
                                </TableRow>
                            ))
                            ) : (
                            <TableRow><TableCell colSpan={6} className="h-24 text-center">No low stock items found. Well done!</TableCell></TableRow>
                            )}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                            <TableCell colSpan={4} className="font-bold text-right">Selected Order Summary</TableCell>
                            <TableCell className="font-bold text-right">{formatAmount(totalOrderValue)}</TableCell>
                            <TableCell className="font-bold text-center">{totalSelectedItems} items</TableCell>
                            </TableRow>
                        </TableFooter>
                        </Table>
                    </div>
                </TabsContent>
                 <TabsContent value="unconfigured" className="mt-4">
                     <div className="rounded-md border overflow-x-auto">
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead>Item Name</TableHead>
                            <TableHead className="text-center">Current Stock</TableHead>
                            <TableHead className="text-center">Min. Stock Level</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                            ) : unconfiguredItems.length > 0 ? (
                            unconfiguredItems.map(item => (
                                <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-center"><Badge variant="outline">Not Set</Badge></TableCell>
                                <TableCell className="text-right">
                                    <Button asChild variant="outline" size="sm">
                                        <Link href={`/inventory?edit=${item.id}`}><Edit className="mr-2 h-4 w-4" />Set Level</Link>
                                    </Button>
                                </TableCell>
                                </TableRow>
                            ))
                            ) : (
                            <TableRow><TableCell colSpan={4} className="h-24 text-center">All items have a minimum stock level configured.</TableCell></TableRow>
                            )}
                        </TableBody>
                        </Table>
                    </div>
                </TabsContent>
            </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
