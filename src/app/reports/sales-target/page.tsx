

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Target, Plus, Edit, Trash2, Check, ChevronsUpDown, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format, startOfMonth, parse, endOfMonth } from 'date-fns';
import { formatAmount } from '@/lib/utils';
import type { AppSettings, InventoryItem, SalesTarget, Transaction, Party } from '@/types';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePicker } from '@/components/ui/date-picker';

const MultiProductSelect = ({ items, selectedProductIds, onSelectionChange }: { items: InventoryItem[], selectedProductIds: string[], onSelectionChange: (ids: string[]) => void }) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (itemId: string) => {
        const newSelected = selectedProductIds.includes(itemId)
            ? selectedProductIds.filter(id => id !== itemId)
            : [...selectedProductIds, itemId];
        onSelectionChange(newSelected);
    };

     const handleRemove = (e: React.MouseEvent, itemId: string) => {
        e.stopPropagation();
        const newSelected = selectedProductIds.filter(id => id !== itemId);
        onSelectionChange(newSelected);
    };

    const selectedItems = selectedProductIds.map(id => items.find(item => item.id === id)).filter(Boolean) as InventoryItem[];

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
                            "Select products..."
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
                                <CommandItem key={item.id} value={item.name} onSelect={() => handleSelect(item.id)}>
                                    <Check className={cn("mr-2 h-4 w-4", selectedProductIds.includes(item.id) ? "opacity-100" : "opacity-0")} />
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


export default function SalesTargetPage() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [parties, setParties] = useState<Party[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();

    const [filters, setFilters] = useState({ month: format(new Date(), 'yyyy-MM'), businessProfile: 'all', partyId: 'all' });
    const [newTarget, setNewTarget] = useState<Partial<SalesTarget>>({ type: 'monthly', productIds: [], quantityTarget: 0, programmeQuantityTarget: 0, month: filters.month, businessProfile: filters.businessProfile, partyId: 'all' });
    const [editingTargetId, setEditingTargetId] = useState<string | null>(null);
    
    useEffect(() => {
        setNewTarget(t => ({...t, month: filters.month, businessProfile: filters.businessProfile, partyId: filters.partyId }));
    }, [filters]);

    useEffect(() => {
        setLoading(true);
        const unsubSettings = getAppSettings().then(setSettings);
        const unsubInventory = subscribeToInventoryItems(setInventoryItems, console.error);
        const unsubTransactions = subscribeToAllTransactions(setTransactions, console.error);
        const unsubParties = subscribeToParties(setParties, console.error);
        Promise.all([unsubSettings]).then(() => setLoading(false));
        return () => { unsubInventory(); unsubTransactions(); unsubParties(); };
    }, []);

    const handleSaveTargets = async (targets: SalesTarget[]) => {
        if (!settings) return;
        try {
            await saveAppSettings({ ...settings, salesTargets: targets });
            setSettings({ ...settings, salesTargets: targets });
            toast({ title: 'Success', description: 'Sales targets have been saved.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Could not save targets: ${error.message}` });
        }
    };

    const handleAddOrUpdateTarget = () => {
        const currentTargets = settings?.salesTargets || [];
        if (!newTarget.productIds || newTarget.productIds.length === 0) {
            toast({ variant: 'destructive', title: 'Invalid Product' });
            return;
        }

        const productNames = newTarget.productIds.map(id => inventoryItems.find(i => i.id === id)?.name || '').filter(Boolean);
        const partyName = parties.find(p => p.id === newTarget.partyId)?.name;

        const targetData: SalesTarget = {
            id: editingTargetId || `st-${Date.now()}`,
            type: newTarget.type || 'monthly',
            month: newTarget.month!,
            businessProfile: newTarget.businessProfile!,
            productIds: newTarget.productIds,
            productNames: productNames,
            quantityTarget: newTarget.quantityTarget || 0,
            programmeQuantityTarget: newTarget.programmeQuantityTarget || 0,
            partyId: newTarget.partyId === 'all' ? undefined : newTarget.partyId,
            partyName: newTarget.partyId === 'all' ? undefined : partyName,
            programmeDateRange: newTarget.type === 'programme' ? newTarget.programmeDateRange : undefined,
        };

        let updatedTargets;
        if (editingTargetId) {
            updatedTargets = currentTargets.map(t => t.id === editingTargetId ? targetData : t);
        } else {
            updatedTargets = [...currentTargets, targetData];
        }

        handleSaveTargets(updatedTargets);
        setNewTarget({ type: 'monthly', productIds: [], quantityTarget: 0, programmeQuantityTarget: 0, month: filters.month, businessProfile: filters.businessProfile, partyId: 'all' });
        setEditingTargetId(null);
    };
    
    const handleDeleteTarget = (id: string) => {
        const updatedTargets = (settings?.salesTargets || []).filter(t => t.id !== id);
        handleSaveTargets(updatedTargets);
    };

    const targetReport = useMemo(() => {
        return (settings?.salesTargets || [])
            .filter(t => {
                const typeMatch = t.type === 'monthly' ? t.month === filters.month : true;
                const profileMatch = filters.businessProfile === 'all' || t.businessProfile === filters.businessProfile;
                const partyMatch = filters.partyId === 'all' || t.partyId === filters.partyId;
                return typeMatch && profileMatch && partyMatch;
            })
            .map(target => {
                let fromDate, toDate;
                if (target.type === 'programme' && target.programmeDateRange) {
                    fromDate = target.programmeDateRange.from;
                    toDate = target.programmeDateRange.to;
                } else {
                    const monthDate = parse(target.month, 'yyyy-MM', new Date());
                    fromDate = format(startOfMonth(monthDate), 'yyyy-MM-dd');
                    toDate = format(endOfMonth(monthDate), 'yyyy-MM-dd');
                }

                const purchasesForPeriod = transactions.filter(tx => 
                    tx.date >= fromDate && tx.date <= toDate &&
                    (target.businessProfile === 'all' || tx.via === target.businessProfile) &&
                    (target.partyId ? tx.partyId === target.partyId : true) &&
                    (tx.type === 'purchase' || tx.type === 'credit_purchase') && tx.items
                );

                const purchaseBreakdown = purchasesForPeriod
                    .flatMap(tx => tx.items || [])
                    .filter(item => target.productIds.includes(item.id))
                    .reduce((acc, item) => {
                        acc[item.name] = (acc[item.name] || 0) + item.quantity;
                        return acc;
                    }, {} as Record<string, number>);
                
                const purchasedQuantity = Object.values(purchaseBreakdown).reduce((sum, qty) => sum + qty, 0);
                const remainingQuantity = (target.quantityTarget || 0) - purchasedQuantity;
                const quantityProgress = target.quantityTarget > 0 ? (purchasedQuantity / target.quantityTarget) * 100 : 0;
                
                return {
                    ...target,
                    purchasedQuantity,
                    purchaseBreakdown,
                    remainingQuantity,
                    quantityProgress,
                };
            });
    }, [filters, settings?.salesTargets, transactions]);


    const totals = useMemo(() => {
        return targetReport.reduce((acc, report) => {
            acc.quantityTarget += report.quantityTarget || 0;
            acc.purchasedQuantity += report.purchasedQuantity || 0;
            acc.remainingQuantity += report.remainingQuantity;
            return acc;
        }, { quantityTarget: 0, purchasedQuantity: 0, remainingQuantity: 0 });
    }, [targetReport]);


    if (loading) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8" /></div>;

    const formatRemaining = (remaining: number) => {
        if (remaining < 0) {
            return `+${Math.abs(remaining)}`;
        }
        return remaining;
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="mb-6"><Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button></div>
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Target /> Purchase Target & Achieve</CardTitle>
                    <CardDescription>Set and track monthly or programme-based purchase goals for your products and parties.</CardDescription>
                </CardHeader>
            </Card>

            <Card className="mb-6">
                <CardHeader><CardTitle className="text-lg">{editingTargetId ? 'Edit Target' : 'Add New Target'}</CardTitle></CardHeader>
                <CardContent>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1">
                            <Label>Target Type</Label>
                            <RadioGroup value={newTarget.type || 'monthly'} onValueChange={(v) => setNewTarget(t => ({...t, type: v as any}))} className="flex gap-4 pt-2">
                                <div className="flex items-center space-x-2"><RadioGroupItem value="monthly" id="monthly"/><Label htmlFor="monthly">Monthly</Label></div>
                                <div className="flex items-center space-x-2"><RadioGroupItem value="programme" id="programme"/><Label htmlFor="programme">Programme</Label></div>
                            </RadioGroup>
                        </div>
                        {newTarget.type === 'monthly' && (
                            <div className="space-y-1">
                                <Label>Month</Label>
                                <Input type="month" value={newTarget.month} onChange={e => setNewTarget(t => ({...t, month: e.target.value}))} />
                            </div>
                        )}
                        {newTarget.type === 'programme' && (
                             <div className="space-y-1">
                                <Label>Programme Dates</Label>
                                <DateRangePicker
                                    date={{
                                        from: newTarget.programmeDateRange?.from ? new Date(newTarget.programmeDateRange.from) : undefined,
                                        to: newTarget.programmeDateRange?.to ? new Date(newTarget.programmeDateRange.to) : undefined,
                                    }}
                                    onDateChange={(range) => setNewTarget(t => ({ ...t, programmeDateRange: { from: range?.from?.toISOString().split('T')[0] || '', to: range?.to?.toISOString().split('T')[0] || '' } }))}
                                />
                            </div>
                        )}
                        <div />
                         <div className="space-y-1 md:col-span-2 lg:col-span-3">
                            <Label>Product(s)</Label>
                            <MultiProductSelect 
                                items={inventoryItems} 
                                selectedProductIds={newTarget.productIds || []} 
                                onSelectionChange={(ids) => setNewTarget(t => ({...t, productIds: ids}))}
                            />
                        </div>
                        <div className="space-y-1"><Label>Business Profile</Label>
                            <Select value={newTarget.businessProfile} onValueChange={v => setNewTarget(t => ({...t, businessProfile: v}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Profiles</SelectItem>
                                    {settings?.businessProfiles.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1"><Label>Party/Supplier</Label>
                            <Select value={newTarget.partyId || 'all'} onValueChange={v => setNewTarget(t => ({...t, partyId: v}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Parties</SelectItem>
                                    {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1">
                                <Label>Quantity Target</Label>
                                <Input type="number" value={newTarget.quantityTarget || ''} onChange={e => setNewTarget(t => ({...t, quantityTarget: Number(e.target.value)}))} />
                            </div>
                            {newTarget.type === 'programme' && (
                                <div className="space-y-1">
                                    <Label>Programme Target</Label>
                                    <Input type="number" value={newTarget.programmeQuantityTarget || ''} onChange={e => setNewTarget(t => ({...t, programmeQuantityTarget: Number(e.target.value)}))} />
                                </div>
                            )}
                        </div>
                    </div>
                </CardContent>
                <CardFooter><Button onClick={handleAddOrUpdateTarget}>{editingTargetId ? 'Update Target' : 'Add Target'}</Button></CardFooter>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Achievement Report</CardTitle>
                </CardHeader>
                <CardContent>
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                        <div className="space-y-1"><Label>Month</Label><Input type="month" value={filters.month} onChange={e => setFilters(f => ({...f, month: e.target.value}))} /></div>
                        <div className="space-y-1"><Label>Business Profile</Label>
                            <Select value={filters.businessProfile} onValueChange={v => setFilters(f => ({...f, businessProfile: v}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Profiles</SelectItem>
                                    {settings?.businessProfiles.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1"><Label>Party/Supplier</Label>
                            <Select value={filters.partyId} onValueChange={v => setFilters(f => ({...f, partyId: v}))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Parties</SelectItem>
                                    {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                     <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product(s)</TableHead>
                                    <TableHead>Party</TableHead>
                                    <TableHead>Period</TableHead>
                                    <TableHead className="w-[250px]">Achievement / Progress</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                        <TableBody>
                            {targetReport.length > 0 ? targetReport.map(report => (
                                <TableRow key={report.id}>
                                    <TableCell className="font-medium">
                                        <p>{(report.productNames || []).join(', ')}</p>
                                        {Object.entries(report.purchaseBreakdown).map(([name, qty]) => (
                                            <div key={name} className="text-xs text-muted-foreground whitespace-nowrap">{name}: {qty}</div>
                                        ))}
                                    </TableCell>
                                    <TableCell>{report.partyName || 'All'}</TableCell>
                                    <TableCell>
                                        {report.type === 'programme' && report.programmeDateRange 
                                            ? `${report.programmeDateRange.from} to ${report.programmeDateRange.to}` 
                                            : report.month}
                                    </TableCell>
                                    <TableCell className="min-w-[200px]">
                                       <Progress value={report.purchasedQuantity} monthlyTarget={report.quantityTarget} programmeTarget={report.programmeQuantityTarget}/>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => { setEditingTargetId(report.id); setNewTarget(report); }}><Edit className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteTarget(report.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </TableCell>
                                </TableRow>
                            )) : (<TableRow><TableCell colSpan={8} className="h-24 text-center">No targets set for this period.</TableCell></TableRow>)}
                        </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
