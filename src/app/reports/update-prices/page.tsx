
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Save, Filter, Tags } from 'lucide-react';
import type { InventoryItem } from '@/types';
import { subscribeToInventoryItems, batchUpdateInventoryPrices } from '@/services/inventoryService';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';


interface EditableItem extends InventoryItem {
    newPrice?: number;
    newWholesalePrice?: number;
    newCost?: number;
}

export default function UpdatePricesPage() {
    const [items, setItems] = useState<EditableItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showOnlyMissing, setShowOnlyMissing] = useState(false);
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState('');


    useEffect(() => {
        setLoading(true);
        const unsub = subscribeToInventoryItems(
            (inventoryItems) => {
                setItems(inventoryItems);
                setLoading(false);
            },
            (err) => {
                toast({ variant: 'destructive', title: 'Error', description: err.message });
                setLoading(false);
            }
        );
        return () => unsub();
    }, [toast]);

    const handlePriceChange = (id: string, field: 'newPrice' | 'newWholesalePrice' | 'newCost', value: string) => {
        const numericValue = parseFloat(value);
        setItems(prevItems =>
            prevItems.map(item =>
                item.id === id ? { ...item, [field]: isNaN(numericValue) ? undefined : numericValue } : item
            )
        );
    };

    const handleSave = async () => {
        setIsSaving(true);
        const updates = items
            .filter(item => typeof item.newPrice === 'number' || typeof item.newWholesalePrice === 'number' || typeof item.newCost === 'number')
            .map(item => ({
                id: item.id,
                price: typeof item.newPrice === 'number' ? item.newPrice : item.price,
                wholesalePrice: typeof item.newWholesalePrice === 'number' ? item.newWholesalePrice : (item.wholesalePrice || 0),
                cost: typeof item.newCost === 'number' ? item.newCost : item.cost,
            }));

        if (updates.length === 0) {
            toast({ title: 'No Changes', description: 'There are no new prices to save.' });
            setIsSaving(false);
            return;
        }

        try {
            await batchUpdateInventoryPrices(updates);
            toast({ title: 'Success!', description: `${updates.length} item prices have been updated.` });
            // Reset the 'new' fields after saving
            setItems(prev => prev.map(item => ({...item, newPrice: undefined, newWholesalePrice: undefined, newCost: undefined})))
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const filteredItems = useMemo(() => {
        return items.filter(item => {
            const searchMatch = searchTerm 
                ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) || (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
                : true;
            
            const missingPriceMatch = showOnlyMissing
                ? (item.price === 0 || !item.price) && (item.wholesalePrice === 0 || !item.wholesalePrice)
                : true;
                
            return searchMatch && missingPriceMatch;
        });
    }, [items, showOnlyMissing, searchTerm]);

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="mb-6">
                <Button variant="outline" asChild><Link href="/reports"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Reports</Link></Button>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center gap-2"><Tags/> Update Product Prices</CardTitle>
                            <CardDescription>Bulk edit sale, wholesale and cost prices for your inventory.</CardDescription>
                        </div>
                        <Button onClick={handleSave} disabled={isSaving}>
                            <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save All Changes'}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                     <div className="flex flex-col sm:flex-row gap-4 mb-4 p-4 border rounded-lg">
                        <Input 
                            placeholder="Search by name or SKU..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-xs"
                        />
                        <div className="flex items-center space-x-2">
                            <Checkbox id="missing-prices" checked={showOnlyMissing} onCheckedChange={(checked) => setShowOnlyMissing(!!checked)} />
                            <Label htmlFor="missing-prices" className="flex items-center gap-1">
                                <Filter className="h-4 w-4" /> Show only items with missing prices
                            </Label>
                        </div>
                    </div>
                    
                    {loading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>
                    ) : (
                        <div className="rounded-md border overflow-y-auto max-h-[60vh]">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background">
                                    <TableRow>
                                        <TableHead>Product Name</TableHead>
                                        <TableHead>SKU</TableHead>
                                        <TableHead className="w-48 text-right">Cost Price</TableHead>
                                        <TableHead className="w-48 text-right">Sale Price</TableHead>
                                        <TableHead className="w-48 text-right">Wholesale Price</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredItems.length > 0 ? (
                                        filteredItems.map(item => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium">{item.name}</TableCell>
                                                <TableCell>{item.sku}</TableCell>
                                                 <TableCell>
                                                    <Input
                                                        type="number"
                                                        placeholder={formatAmount(item.cost)}
                                                        value={item.newCost ?? ''}
                                                        onChange={(e) => handlePriceChange(item.id, 'newCost', e.target.value)}
                                                        className="text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        placeholder={formatAmount(item.price)}
                                                        value={item.newPrice ?? ''}
                                                        onChange={(e) => handlePriceChange(item.id, 'newPrice', e.target.value)}
                                                        className="text-right"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        type="number"
                                                        placeholder={formatAmount(item.wholesalePrice || 0)}
                                                        value={item.newWholesalePrice ?? ''}
                                                        onChange={(e) => handlePriceChange(item.id, 'newWholesalePrice', e.target.value)}
                                                        className="text-right"
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow><TableCell colSpan={5} className="h-24 text-center">No items match your criteria.</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

