
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Calculator, ChevronsUpDown, Check, Plus, Trash2, Save, Loader2, History, X } from 'lucide-react';
import { formatAmount, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import type { InventoryItem, CostingProject, CostingItem, Account } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import Link from 'next/link';
import { subscribeToCostingProjects, addCostingProject, updateCostingProject, deleteCostingProject } from '@/services/costingService';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format as formatFns } from 'date-fns';
import { subscribeToAccounts } from '@/services/accountService';
import { Badge } from '@/components/ui/badge';

const ProductCombobox = ({ items, value, onSelect, className }: { items: InventoryItem[], value: string, onSelect: (item: InventoryItem) => void, className?: string }) => {
    const [open, setOpen] = useState(false);
    const currentItemName = items.find((item) => item.id === value)?.name || "Select item...";

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between font-normal", className)}
                >
                    {currentItemName}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search item..." />
                    <CommandList>
                        <CommandEmpty>No item found.</CommandEmpty>
                        <CommandGroup>{items.map((item) => (<CommandItem key={item.id} value={item.name} onSelect={() => { onSelect(item); setOpen(false);}}>
                             <Check
                                className={cn(
                                    "mr-2 h-4 w-4",
                                    value === item.id ? "opacity-100" : "opacity-0"
                                )}
                            />
                            {item.name}</CommandItem>))}</CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const MultiAccountSelect = ({ accounts, selected, onChange, totalCost }: { accounts: Account[], selected: string[], onChange: (selected: string[]) => void, totalCost: number }) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (accountId: string) => {
        const newSelected = selected.includes(accountId)
            ? selected.filter(id => id !== accountId)
            : [...selected, accountId];
        onChange(newSelected);
    };

    const handleRemove = (e: React.MouseEvent | React.KeyboardEvent, accountId: string) => {
        e.stopPropagation();
        const newSelected = selected.filter(id => id !== accountId);
        onChange(newSelected);
    };

    const selectedAccounts = selected.map(id => accounts.find(acc => acc.id === id)).filter(Boolean) as Account[];
    const totalSelectedBalance = selectedAccounts.reduce((sum, acc) => sum + acc.balance, 0);
    const shortOrSurplus = totalSelectedBalance - totalCost;

    return (
        <div className="space-y-1">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10">
                        <div className="flex flex-wrap gap-1">
                            {selectedAccounts.length > 0 ? (
                                selectedAccounts.map(account => (
                                    <Badge key={account.id} variant="secondary" className="pr-1">
                                        {account.name}
                                        <div
                                            role="button"
                                            tabIndex={0}
                                            className="ml-1 rounded-full cursor-pointer outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2"
                                            onClick={(e) => handleRemove(e, account.id)}
                                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") handleRemove(e, account.id); }}
                                        >
                                            <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                                            <span className="sr-only">Remove {account.name}</span>
                                        </div>
                                    </Badge>
                                ))
                            ) : "Select accounts..."}
                        </div>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search account..." />
                        <CommandList>
                            <CommandEmpty>No account found.</CommandEmpty>
                            <CommandGroup>
                                {accounts.map((account) => (
                                    <CommandItem key={account.id} value={account.name} onSelect={() => handleSelect(account.id)}>
                                        <Check className={cn("mr-2 h-4 w-4", selected.includes(account.id) ? "opacity-100" : "opacity-0")} />
                                        <div className="flex justify-between w-full">
                                            <span>{account.name}</span>
                                            <span className="text-muted-foreground">{formatAmount(account.balance)}</span>
                                        </div>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
             {selected.length > 0 && (
                <div className={cn("text-xs text-center p-1 rounded-sm", shortOrSurplus >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                    {shortOrSurplus >= 0 ? `Surplus: ${formatAmount(shortOrSurplus)}` : `Short: ${formatAmount(Math.abs(shortOrSurplus))}`}
                </div>
            )}
        </div>
    );
};


export default function CostingCalculatorPage() {
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [savedProjects, setSavedProjects] = useState<CostingProject[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // Form state
    const [items, setItems] = useState<Partial<CostingItem & { selectedAccountIds: string[] }>>([{ id: `item-${Date.now()}`, selectedAccountIds: [] }]);
    const [projectName, setProjectName] = useState('');
    const [globalTransport, setGlobalTransport] = useState(0);
    const [globalUnloading, setGlobalUnloading] = useState(0);
    const [globalCommission, setGlobalCommission] = useState(0);
    const [editingProjectId, setEditingProjectId] = useState<string | null>(null);


    useEffect(() => {
        const unsubInventory = subscribeToInventoryItems(setInventory, (err) => toast({ variant: 'destructive', title: 'Error loading inventory', description: err.message }));
        const unsubProjects = subscribeToCostingProjects(setSavedProjects, (err) => toast({ variant: 'destructive', title: 'Error loading projects', description: err.message }));
        const unsubAccounts = subscribeToAccounts(setAccounts, (err) => toast({ variant: 'destructive', title: 'Error loading accounts', description: err.message }));
        return () => {
          unsubInventory();
          unsubProjects();
          unsubAccounts();
        }
    }, [toast]);
    
    const handleItemChange = (index: number, field: keyof (CostingItem & {selectedAccountIds: string[]}), value: any) => {
        const newItems = [...items];
        const currentItem = { ...newItems[index] };
        (currentItem as any)[field] = value;
        newItems[index] = currentItem;
        setItems(newItems);
    };
    
    const handleProductSelect = (index: number, product: InventoryItem) => {
        const newItems = [...items];
        newItems[index] = {
            ...newItems[index],
            productId: product.id,
            name: product.name,
            purchasePrice: product.cost,
        };
        setItems(newItems);
    };

    const addItemRow = () => setItems([...items, { id: `item-${Date.now()}`, selectedAccountIds: [] }]);
    const removeItemRow = (index: number) => setItems(items.filter((_, i) => i !== index));

    const columnTotals = useMemo(() => {
        return items.reduce((acc, item) => {
            const quantity = Number(item.quantity) || 0;
            acc.quantity += quantity;
            acc.transportCost += quantity * (Number(item.transportCost) || 0);
            acc.unloadingCost += quantity * (Number(item.unloadingCost) || 0);
            acc.commission += quantity * (Number(item.commission) || 0);
            return acc;
        }, { quantity: 0, transportCost: 0, unloadingCost: 0, commission: 0 });
    }, [items]);

    const calculationResults = useMemo(() => {
        if (items.length === 0 || items.every(item => !item.quantity)) {
            return null;
        }

        const totalBags = items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
        const transportPerBag = totalBags > 0 ? globalTransport / totalBags : 0;
        const unloadingPerBag = totalBags > 0 ? globalUnloading / totalBags : 0;
        const commissionPerBag = totalBags > 0 ? globalCommission / totalBags : 0;

        const calculatedItems = items.map(item => {
            const quantity = Number(item.quantity) || 0;
            if (quantity === 0) return null;

            const purchasePrice = Number(item.purchasePrice) || 0;
            const itemTransport = (Number(item.transportCost) || 0) + transportPerBag;
            const itemUnloading = (Number(item.unloadingCost) || 0) + unloadingPerBag;
            const itemCommission = (Number(item.commission) || 0) + commissionPerBag;
            
            const doCost = purchasePrice * quantity;
            const costBeforeCommission = purchasePrice + itemTransport + itemUnloading;
            const finalCostPerUnit = costBeforeCommission - itemCommission;
            const totalCost = finalCostPerUnit * quantity;
            
            let profitLoss;
            const sellingPrice = Number(item.sellingPrice) || 0;
            if (sellingPrice > 0) {
                profitLoss = (sellingPrice - finalCostPerUnit) * quantity;
            }

            return {
                ...item,
                quantity,
                purchasePrice,
                transportCost: itemTransport,
                unloadingCost: itemUnloading,
                commission: itemCommission,
                doCost,
                finalCost: totalCost,
                finalCostPerUnit: finalCostPerUnit,
                sellingPrice: sellingPrice > 0 ? sellingPrice : undefined,
                profitLoss,
            } as CostingItem & { doCost: number, finalCostPerUnit: number };
        }).filter(Boolean) as (CostingItem & { doCost: number, finalCostPerUnit: number })[];
        
        const totalDoCost = calculatedItems.reduce((sum, item) => sum + (item.doCost || 0), 0);
        const totalFinalCost = calculatedItems.reduce((sum, item) => sum + (item.finalCost || 0), 0);
        const totalProfitLoss = calculatedItems.reduce((sum, item) => sum + (item.profitLoss || 0), 0);

        return {
            id: editingProjectId || `proj-${Date.now()}`,
            name: projectName || `Calculation - ${formatFns(new Date(), 'PPp')}`,
            createdAt: editingProjectId ? (savedProjects.find(p => p.id === editingProjectId)?.createdAt || new Date().toISOString()) : new Date().toISOString(),
            items: calculatedItems,
            totalDoCost: totalDoCost,
            totalCost: totalFinalCost,
            totalProfit: totalProfitLoss,
        };
    }, [items, globalTransport, globalUnloading, globalCommission, projectName, editingProjectId, savedProjects]);


    const handleSaveProject = async () => {
        if (!calculationResults) {
            toast({ variant: 'destructive', title: 'No Results', description: 'Please calculate costs before saving.'});
            return;
        }
        setIsSaving(true);
        try {
            const projectData: Partial<Omit<CostingProject, 'id'>> = {
                name: calculationResults.name,
                items: calculationResults.items,
                totalCost: calculationResults.totalCost,
                totalDoCost: calculationResults.totalDoCost,
                totalProfit: calculationResults.totalProfit,
            };

            if (editingProjectId) {
                await updateCostingProject(editingProjectId, projectData);
                toast({ title: 'Project Updated!', description: `Costing project "${calculationResults.name}" has been updated.`});
            } else {
                await addCostingProject({ ...projectData, createdAt: new Date().toISOString() } as Omit<CostingProject, 'id'>);
                toast({ title: 'Project Saved!', description: `Costing project "${calculationResults.name}" has been saved.`});
            }

            // Clear form
            setProjectName('');
            setItems([{ id: `item-${Date.now()}`, selectedAccountIds: [] }]);
            setGlobalTransport(0);
            setGlobalUnloading(0);
            setGlobalCommission(0);
            setEditingProjectId(null);

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleDeleteProject = async (id: string) => {
        try {
            await deleteCostingProject(id);
            toast({ title: 'Project Deleted' });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
        }
    }

    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <Button variant="outline" asChild><Link href="/tools">← Back to Tools</Link></Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl"><Calculator /> New Costing Project</CardTitle>
                    <CardDescription>Calculate the final cost of products, including transport and other expenses.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Label htmlFor="projectName">Project Name</Label>
                        <Input id="projectName" value={projectName} onChange={(e) => setProjectName(e.target.value)} placeholder="e.g., Akij Cement Shipment #123"/>
                    </div>
                    <div className="rounded-md border overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[200px]">Product</TableHead>
                                    <TableHead className="w-40">Cost Price</TableHead>
                                    <TableHead className="w-32">Quantity</TableHead>
                                    <TableHead className="w-40">Total Cost</TableHead>
                                    <TableHead className="min-w-[200px]">Select Account(s)</TableHead>
                                    <TableHead className="w-32">Transport</TableHead>
                                    <TableHead className="w-32">Unloading</TableHead>
                                    <TableHead className="w-32">Commission</TableHead>
                                    <TableHead className="w-40">Sale Price</TableHead>
                                    <TableHead className="w-12"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item, index) => {
                                    const totalCost = (Number(item.purchasePrice) || 0) * (Number(item.quantity) || 0);
                                    return (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <ProductCombobox items={inventory} value={item.productId || ''} onSelect={(product) => handleProductSelect(index, product)} />
                                        </TableCell>
                                        <TableCell><Input className="w-40" type="number" step="0.01" value={item.purchasePrice || ''} onChange={(e) => handleItemChange(index, 'purchasePrice', e.target.value)} placeholder="0.00" onFocus={(e) => e.target.select()} /></TableCell>
                                        <TableCell><Input className="w-32" type="number" value={item.quantity || ''} onChange={(e) => handleItemChange(index, 'quantity', e.target.value)} placeholder="0" onFocus={(e) => e.target.select()}/></TableCell>
                                        <TableCell><Input className="w-40 font-mono text-right" readOnly value={formatAmount(totalCost)} /></TableCell>
                                        <TableCell>
                                            <MultiAccountSelect
                                                accounts={accounts}
                                                selected={item.selectedAccountIds || []}
                                                onChange={(ids) => handleItemChange(index, 'selectedAccountIds', ids)}
                                                totalCost={totalCost}
                                            />
                                        </TableCell>
                                        <TableCell><Input className="w-32" type="number" step="0.01" value={item.transportCost || ''} onChange={(e) => handleItemChange(index, 'transportCost', e.target.value)} placeholder="per unit" onFocus={(e) => e.target.select()}/></TableCell>
                                        <TableCell><Input className="w-32" type="number" step="0.01" value={item.unloadingCost || ''} onChange={(e) => handleItemChange(index, 'unloadingCost', e.target.value)} placeholder="per unit" onFocus={(e) => e.target.select()}/></TableCell>
                                        <TableCell><Input className="w-32" type="number" step="0.01" value={item.commission || ''} onChange={(e) => handleItemChange(index, 'commission', e.target.value)} placeholder="per unit" onFocus={(e) => e.target.select()}/></TableCell>
                                        <TableCell><Input className="w-40" type="number" step="0.01" value={item.sellingPrice || ''} onChange={(e) => handleItemChange(index, 'sellingPrice', e.target.value)} placeholder="for profit calc" onFocus={(e) => e.target.select()}/></TableCell>
                                        <TableCell><Button type="button" variant="ghost" size="icon" onClick={() => removeItemRow(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                    </TableRow>
                                )})}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={2} className="font-bold text-right">Totals:</TableCell>
                                    <TableCell className="font-semibold text-center">{columnTotals.quantity}</TableCell>
                                    <TableCell colSpan={3}></TableCell>
                                    <TableCell className="font-semibold text-right">{formatAmount(columnTotals.transportCost)}</TableCell>
                                    <TableCell className="font-semibold text-right">{formatAmount(columnTotals.unloadingCost)}</TableCell>
                                    <TableCell className="font-semibold text-right">{formatAmount(columnTotals.commission)}</TableCell>
                                    <TableCell colSpan={2}></TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                    <Button variant="outline" size="sm" onClick={addItemRow}><Plus className="mr-2"/> Add Item</Button>

                     <div className="space-y-4 pt-4 border-t">
                        <h3 className="font-semibold text-lg">Global Costs (Distributed per unit)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2"><Label>Total Truck/Van Transport</Label><Input type="number" value={globalTransport || ''} onChange={e => setGlobalTransport(parseFloat(e.target.value) || 0)} placeholder="0.00" onFocus={(e) => e.target.select()}/></div>
                            <div className="space-y-2"><Label>Total Unloading Cost</Label><Input type="number" value={globalUnloading || ''} onChange={e => setGlobalUnloading(parseFloat(e.target.value) || 0)} placeholder="0.00" onFocus={(e) => e.target.select()}/></div>
                            <div className="space-y-2"><Label>Total Commission</Label><Input type="number" value={globalCommission || ''} onChange={e => setGlobalCommission(parseFloat(e.target.value) || 0)} placeholder="0.00" onFocus={(e) => e.target.select()}/></div>
                        </div>
                     </div>
                </CardContent>

                 {calculationResults && (
                    <CardFooter>
                        <div className="w-full space-y-4">
                            <div className="flex justify-between items-center">
                                 <div>
                                    <CardTitle>Calculation Results</CardTitle>
                                    <CardDescription>Created on {formatDate(calculationResults.createdAt)}</CardDescription>
                                </div>
                                <Button onClick={handleSaveProject} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                                    {editingProjectId ? 'Update Project' : 'Save as New Project'}
                                </Button>
                            </div>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">DO Cost</TableHead>
                                        <TableHead className="text-right">Final Cost/Unit</TableHead>
                                        <TableHead className="text-right">Total Cost</TableHead>
                                        <TableHead className="text-right">Sale Price/Unit</TableHead>
                                        <TableHead className="text-right">Profit/Loss</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {calculationResults.items.map(item => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell className="text-right">{item.quantity}</TableCell>
                                            <TableCell className="text-right font-mono">{formatAmount(item.doCost)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatAmount((item.finalCostPerUnit || 0))}</TableCell>
                                            <TableCell className="text-right font-mono">{formatAmount(item.finalCost || 0)}</TableCell>
                                            <TableCell className="text-right font-mono">{formatAmount(item.sellingPrice || 0)}</TableCell>
                                            <TableCell className={cn("text-right font-mono", (item.profitLoss || 0) >= 0 ? 'text-green-600' : 'text-red-600')}>
                                                {formatAmount(item.profitLoss || 0)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                <TableFooter>
                                    <TableRow>
                                        <TableCell colSpan={2} className="font-bold text-right">Totals</TableCell>
                                        <TableCell className="font-bold text-right">{formatAmount(calculationResults.totalDoCost)}</TableCell>
                                        <TableCell></TableCell>
                                        <TableCell className="font-bold text-right">{formatAmount(calculationResults.totalCost)}</TableCell>
                                        <TableCell></TableCell>
                                        <TableCell className={cn("font-bold text-right", calculationResults.totalProfit >= 0 ? 'text-green-600' : 'text-red-600')}>{formatAmount(calculationResults.totalProfit)}</TableCell>
                                    </TableRow>
                                </TableFooter>
                            </Table>
                        </div>
                    </CardFooter>
                 )}
            </Card>

             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><History/> Saved Projects</CardTitle>
                </CardHeader>
                <CardContent>
                    {savedProjects.length > 0 ? (
                        <div className="space-y-2">
                            {savedProjects.map(p => (
                                <div key={p.id} className="flex justify-between items-center p-3 border rounded-md">
                                    <div>
                                        <p className="font-semibold">{p.name}</p>
                                        <p className="text-sm text-muted-foreground">{formatDate(p.createdAt)} - {p.items.length} items</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="sm" onClick={() => {
                                            setProjectName(p.name);
                                            setItems(p.items);
                                            setEditingProjectId(p.id);
                                            setGlobalTransport(0); // Reset global costs when loading a project
                                            setGlobalUnloading(0);
                                            setGlobalCommission(0);
                                            window.scrollTo({ top: 0, behavior: 'smooth' });
                                        }}>View & Edit</Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                               <Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4"/></Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                                                    <AlertDialogDescriptionComponent>Are you sure you want to delete "{p.name}"?</AlertDialogDescriptionComponent>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                     <AlertDialogAction onClick={() => handleDeleteProject(p.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-center text-muted-foreground py-8">No saved projects yet.</p>
                    )}
                </CardContent>
            </Card>

        </div>
    );
}

