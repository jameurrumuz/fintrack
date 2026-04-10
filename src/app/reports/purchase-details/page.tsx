
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2, Package } from 'lucide-react';
import type { Transaction, Party, AppSettings } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { getAppSettings } from '@/services/settingsService';
import { formatDate, formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format as formatFns, startOfMonth } from 'date-fns';

interface PurchaseItemRow {
    transactionId: string;
    date: string;
    itemName: string;
    quantity: number;
    costPrice: number;
    totalCost: number;
    partyName: string;
    via?: string;
}

export default function PurchaseDetailsReport() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [parties, setParties] = useState<Party[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState(() => {
        const today = new Date();
        const monthStart = startOfMonth(today);
        return {
            dateFrom: formatFns(monthStart, 'yyyy-MM-dd'),
            dateTo: formatFns(today, 'yyyy-MM-dd'),
        };
    });
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
        const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));

        const timer = setTimeout(() => setLoading(false), 500);

        return () => {
            unsubTransactions();
            unsubParties();
            clearTimeout(timer);
        };
    }, [toast]);
    
    const { purchaseItems, totalQuantity, totalValue } = useMemo(() => {
        const partyMap = new Map(parties.map(p => [p.id, p.name]));
        
        const purchaseTransactions = transactions.filter(t => 
            (t.type === 'purchase' || t.type === 'credit_purchase') && t.enabled
        );

        const filtered = purchaseTransactions.filter(t => {
            if (filters.dateFrom && t.date < filters.dateFrom) return false;
            if (filters.dateTo && t.date > filters.dateTo) return false;
            return true;
        });
        
        const flattenedItems: PurchaseItemRow[] = filtered.flatMap(tx =>
            (tx.items || []).map(item => ({
                transactionId: tx.id,
                date: tx.date,
                itemName: item.name,
                quantity: item.quantity,
                costPrice: item.price,
                totalCost: item.price * item.quantity,
                partyName: tx.partyId ? partyMap.get(tx.partyId) || 'Unknown' : 'N/A',
                via: tx.via,
            }))
        ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        
        const totalQty = flattenedItems.reduce((sum, item) => sum + item.quantity, 0);
        const totalVal = flattenedItems.reduce((sum, item) => sum + item.totalCost, 0);

        return { purchaseItems: flattenedItems, totalQuantity: totalQty, totalValue: totalVal };
    }, [transactions, parties, filters]);

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
                            <CardTitle className="flex items-center gap-2"><Package /> Purchase Details Report</CardTitle>
                            <CardDescription>A detailed list of all individual items purchased.</CardDescription>
                        </div>
                        <div className="flex gap-2 no-print">
                            <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
                            <Button disabled><Share2 className="mr-2 h-4 w-4" /> Share</Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 p-4 border rounded-lg no-print">
                        <div className="space-y-1">
                            <Label>From</Label>
                            <Input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <Label>To</Label>
                            <Input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} />
                        </div>
                    </div>

                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Product Name</TableHead>
                                    <TableHead>Supplier</TableHead>
                                    <TableHead>Via</TableHead>
                                    <TableHead className="text-right">Quantity</TableHead>
                                    <TableHead className="text-right">Cost Price</TableHead>
                                    <TableHead className="text-right">Total Cost</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                                ) : purchaseItems.length > 0 ? (
                                    purchaseItems.map((item, index) => (
                                        <TableRow key={`${item.transactionId}-${index}`}>
                                            <TableCell>{formatDate(item.date)}</TableCell>
                                            <TableCell className="font-medium">{item.itemName}</TableCell>
                                            <TableCell>{item.partyName}</TableCell>
                                            <TableCell>{item.via}</TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right font-mono">{formatAmount(item.costPrice)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatAmount(item.totalCost)}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow><TableCell colSpan={7} className="h-24 text-center">No purchased items found for the selected criteria.</TableCell></TableRow>
                                )}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={4} className="font-bold text-right">Totals</TableCell>
                                    <TableCell className="font-bold text-right">{totalQuantity}</TableCell>
                                    <TableCell></TableCell>
                                    <TableCell className="font-bold text-right font-mono">{formatAmount(totalValue)}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </>
    );
}

