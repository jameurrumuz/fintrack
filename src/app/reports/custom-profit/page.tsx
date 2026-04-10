

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Calculator, Plus, Trash2, Check, ChevronsUpDown, Save, Printer, FileText, Calendar } from 'lucide-react';
import type { Transaction, InventoryItem, AppSettings, CalculationRow, ProfitCalculationProject, Party } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { subscribeToProfitProjects, saveProfitProjects, addProfitProject, updateProfitProject, deleteProfitProject } from '@/services/profitCalculationService';
import { formatAmount, formatDate, transactionTypeOptions } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format as formatFns, startOfMonth, endOfMonth, parseISO, getYear, getMonth, eachMonthOfInterval, startOfYear } from 'date-fns';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter } from "@/components/ui/alert-dialog";
import { Dialog, DialogClose, DialogTitle, DialogContent, DialogDescription, DialogHeader, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { subscribeToParties } from '@/services/partyService';
import { DateRange } from 'react-day-picker';
import { DatePicker } from '@/components/ui/date-picker';
import { useRouter } from 'next/navigation';


const ProductCombobox = ({ items, value, onSelect, className }: { items: InventoryItem[], value: string | undefined, onSelect: (item: InventoryItem) => void, className?: string }) => {
    const [open, setOpen] = useState(false)
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

const SelectTransactionsDialog = ({
    open,
    onOpenChange,
    allTransactions,
    onSelect,
    initialDateRange,
    initialBusinessProfile,
    transactionType,
    appSettings,
    calculationType = 'sum',
    parties,
    excludedTxIds = new Set(),
    currentSelectionIds = [],
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    allTransactions: Transaction[],
    onSelect: (total: number, selectedIds: string[]) => void,
    initialDateRange?: DateRange,
    initialBusinessProfile: string,
    transactionType: 'income' | 'spent' | 'sale' | 'receive' | 'commission',
    appSettings: AppSettings | null;
    calculationType?: 'sum' | 'profit';
    parties: Party[];
    excludedTxIds?: Set<string>;
    currentSelectionIds?: string[];
}) => {
    const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());
    const [filterRange, setFilterRange] = useState<DateRange | undefined>(undefined);
    const [filterProfile, setFilterProfile] = useState('all');
    const [dialogTransactionType, setDialogTransactionType] = useState(transactionType);

     useEffect(() => {
        if (open) {
            setFilterRange(initialDateRange);
            setFilterProfile(initialBusinessProfile);
            setDialogTransactionType(transactionType);
            setSelectedTxIds(new Set(currentSelectionIds));
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);
    
    const targetTransactionTypes = useMemo(() => {
        if (dialogTransactionType === 'sale') return ['sale', 'credit_sale'];
        if (dialogTransactionType === 'commission') return ['income']; // Filter 'income' type for commissions
        return [dialogTransactionType];
    }, [dialogTransactionType]);

    const allAvailableTransactions = useMemo(() => {
        if (!filterRange?.from) return [];
        const fromDate = formatFns(filterRange.from, 'yyyy-MM-dd');
        const toDate = filterRange.to ? formatFns(filterRange.to, 'yyyy-MM-dd') : fromDate;
        
        return allTransactions.filter(tx => {
            if (excludedTxIds.has(tx.id) && !currentSelectionIds.includes(tx.id)) return false;

            if (!targetTransactionTypes.includes(tx.type)) return false;
            
            const txDate = tx.date;
            if (txDate < fromDate || txDate > toDate) return false;

            if (filterProfile !== 'all' && tx.via !== filterProfile) return false;
            return true;
        });
    }, [allTransactions, filterRange, filterProfile, targetTransactionTypes, excludedTxIds, currentSelectionIds]);

    const transactionsToShow = useMemo(() => {
        return allAvailableTransactions.filter(tx => !selectedTxIds.has(tx.id));
    }, [allAvailableTransactions, selectedTxIds]);

    const selectedTransactions = useMemo(() => {
        return allAvailableTransactions.filter(tx => selectedTxIds.has(tx.id));
    }, [allAvailableTransactions, selectedTxIds]);


    const handleToggleAll = (checked: boolean) => {
        const currentIds = new Set(selectedTxIds);
        if (checked) {
            transactionsToShow.forEach(tx => currentIds.add(tx.id));
        } else {
            const visibleIds = new Set(transactionsToShow.map(tx => tx.id));
            visibleIds.forEach(id => currentIds.delete(id));
        }
        setSelectedTxIds(currentIds);
    };
    
    const handleToggleSingle = (txId: string, checked: boolean) => {
        const newSet = new Set(selectedTxIds);
        if (checked) newSet.add(txId);
        else newSet.delete(txId);
        setSelectedTxIds(newSet);
    }

    const calculatedTotal = useMemo(() => {
        if (calculationType === 'profit') {
            return selectedTransactions.reduce((totalProfit, t) => {
                if (!t.items) return totalProfit;
                 const saleCost = t.items.reduce((sum, item) => sum + (item.cost || 0), 0);
                return totalProfit + (t.amount - saleCost);
            }, 0);
        } else { // 'sum'
            return selectedTransactions.reduce((sum, tx) => sum + tx.amount, 0);
        }
    }, [selectedTransactions, calculationType]);

    const handleConfirm = () => {
        onSelect(calculatedTotal, Array.from(selectedTxIds));
        onOpenChange(false);
    };
    
    const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || 'N/A';

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-4xl max-h-[95vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Select {dialogTransactionType.charAt(0).toUpperCase() + dialogTransactionType.slice(1)} Transactions</DialogTitle>
                    <DialogDescription>
                        Select transactions to calculate the total. Already assigned transactions are hidden.
                    </DialogDescription>
                </DialogHeader>
                 <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 py-4">
                    <DatePicker 
                      value={filterRange?.from} 
                      onChange={(date) => date && setFilterRange({ from: date, to: filterRange?.to })}
                    />
                    <DatePicker 
                      value={filterRange?.to} 
                      onChange={(date) => date && setFilterRange({ from: filterRange?.from, to: date })}
                    />
                    <Select value={filterProfile} onValueChange={setFilterProfile}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Profiles</SelectItem>
                            {appSettings?.businessProfiles.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                     <Select value={dialogTransactionType} onValueChange={(v) => setDialogTransactionType(v as 'income' | 'spent' | 'sale' | 'receive' | 'commission')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {transactionTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                 </div>
                <div className="flex-grow overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                     <Checkbox
                                        checked={transactionsToShow.length > 0 && transactionsToShow.every(tx => selectedTxIds.has(tx.id))}
                                        onCheckedChange={(checked) => handleToggleAll(!!checked)}
                                    />
                                </TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead>Party</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactionsToShow.length > 0 ? (
                                transactionsToShow.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedTxIds.has(tx.id)}
                                                onCheckedChange={(checked) => handleToggleSingle(tx.id, !!checked)}
                                            />
                                        </TableCell>
                                        <TableCell>{formatDate(tx.date)}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell>{getPartyName(tx.partyId)}</TableCell>
                                        <TableCell className="text-right">{formatAmount(tx.amount)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={5} className="h-24 text-center">No unselected {dialogTransactionType} transactions found for this period.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                 {selectedTransactions.length > 0 && (
                    <div className="flex-shrink-0 mt-4">
                        <h4 className="font-semibold mb-2">Selected Transactions ({selectedTransactions.length})</h4>
                        <div className="max-h-48 overflow-y-auto border rounded-md">
                            <Table>
                                <TableBody>
                                    {selectedTransactions.map(tx => (
                                        <TableRow key={`selected-${tx.id}`} className="bg-muted/30">
                                            <TableCell className="w-12"><Checkbox checked={true} onCheckedChange={() => handleToggleSingle(tx.id, false)}/></TableCell>
                                            <TableCell>{formatDate(tx.date)}</TableCell>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell className="text-right">{formatAmount(tx.amount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </div>
                )}
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={selectedTxIds.size === 0}>
                        Confirm ({formatAmount(calculatedTotal)})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const SelectStockProfitDialog = ({
    open,
    onOpenChange,
    allTransactions,
    onSelect,
    initialDateRange,
    initialBusinessProfile,
    inventory,
    currentSelectionIds = [],
}: {
    open: boolean,
    onOpenChange: (open: boolean) => void,
    allTransactions: Transaction[],
    onSelect: (total: number, selectedIds: string[]) => void,
    initialDateRange?: DateRange,
    initialBusinessProfile: string,
    inventory: InventoryItem[],
    currentSelectionIds?: string[];
}) => {
    const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set(currentSelectionIds));

    const stockProfitabilityData = useMemo(() => {
        if (!initialDateRange?.from) return [];
        
        const fromDate = formatFns(initialDateRange.from, 'yyyy-MM-dd');
        const toDate = initialDateRange.to ? formatFns(initialDateRange.to, 'yyyy-MM-dd') : fromDate;
        
        const stockProfitMap = new Map<string, { itemId: string; itemName: string; totalProfit: number }>();

        const filteredSales = allTransactions.filter(t => {
            if (!(t.type === 'sale' || t.type === 'credit_sale') || !t.enabled || !t.items) return false;
            if (t.date < fromDate || t.date > toDate) return false;
            if (initialBusinessProfile !== 'all' && t.via !== initialBusinessProfile) return false;
            return true;
        });

        filteredSales.forEach(t => {
            t.items!.forEach(item => {
                const saleTotal = item.price * item.quantity;
                const costTotal = (item.cost || 0);
                const profitValue = saleTotal - costTotal;

                const existing = stockProfitMap.get(item.id) || { itemId: item.id, itemName: item.name, totalProfit: 0 };
                existing.totalProfit += profitValue;
                stockProfitMap.set(item.id, existing);
            });
        });
        
        return Array.from(stockProfitMap.values()).sort((a,b) => b.totalProfit - a.totalProfit);
    }, [allTransactions, initialDateRange, initialBusinessProfile]);

    const handleToggleAll = (checked: boolean) => {
        const allIds = new Set(stockProfitabilityData.map(p => p.itemId));
        setSelectedProductIds(checked ? allIds : new Set());
    };
    
    const handleToggleSingle = (itemId: string, checked: boolean) => {
        const newSet = new Set(selectedProductIds);
        if (checked) newSet.add(itemId);
        else newSet.delete(itemId);
        setSelectedProductIds(newSet);
    };

    const calculatedTotal = useMemo(() => {
        return stockProfitabilityData
            .filter(item => selectedProductIds.has(item.itemId))
            .reduce((sum, item) => sum + item.totalProfit, 0);
    }, [selectedProductIds, stockProfitabilityData]);

    const handleConfirm = () => {
        onSelect(calculatedTotal, Array.from(selectedProductIds));
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Select Products for Stock Profit</DialogTitle>
                </DialogHeader>
                 <div className="max-h-96 overflow-y-auto border rounded-md">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-12">
                                     <Checkbox
                                        checked={stockProfitabilityData.length > 0 && stockProfitabilityData.every(i => selectedProductIds.has(i.itemId))}
                                        onCheckedChange={(checked) => handleToggleAll(!!checked)}
                                    />
                                </TableHead>
                                <TableHead>Product</TableHead>
                                <TableHead className="text-right">Profit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stockProfitabilityData.length > 0 ? (
                                stockProfitabilityData.map(item => (
                                    <TableRow key={item.itemId}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedProductIds.has(item.itemId)}
                                                onCheckedChange={(checked) => handleToggleSingle(item.itemId, !!checked)}
                                            />
                                        </TableCell>
                                        <TableCell>{item.itemName}</TableCell>
                                        <TableCell className="text-right">{formatAmount(item.totalProfit)}</TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow><TableCell colSpan={3} className="h-24 text-center">No sales data for this period.</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
                 <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={selectedProductIds.size === 0}>
                        Confirm ({formatAmount(calculatedTotal)})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function CustomProfitPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [projects, setProjects] = useState<ProfitCalculationProject[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  
  const [isTxDialogOpen, setIsTxDialogOpen] = useState(false);
  const [txDialogTarget, setTxDialogTarget] = useState<{ projectId: string, rowIndex: number, field: 'commission' | 'otherIncome' | 'expense' } | null>(null);
  
  const [isStockProfitDialogOpen, setIsStockProfitDialogOpen] = useState(false);
  const [stockProfitDialogTarget, setStockProfitDialogTarget] = useState<{ projectId: string, rowIndex: number } | null>(null);
  
  const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
  const [purchaseDialogTarget, setPurchaseDialogTarget] = useState<{ projectId: string, rowIndex: number, productIndex: number, productId: string, productName: string } | null>(null);

  // Debounce setup
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  
  const debouncedUpdateProject = useCallback((projectId: string, updateData: Partial<ProfitCalculationProject>) => {
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }
    debounceTimeout.current = setTimeout(async () => {
      try {
        await updateProfitProject(projectId, updateData);
        // Optional: toast on successful save
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Auto-save Failed', description: e.message });
      }
    }, 1000); // 1-second delay
  }, [toast]);


  useEffect(() => {
    setLoading(true);
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubInventory = subscribeToInventoryItems(setInventory, (err) => toast({ variant: 'destructive', title: 'Error loading inventory', description: err.message }));
    const unsubProjects = subscribeToProfitProjects(setProjects, (err) => toast({ variant: 'destructive', title: 'Error loading projects', description: err.message }));
    const unsubParties = subscribeToParties(setParties, console.error);
    getAppSettings().then(setAppSettings);
    setLoading(false);
    return () => { unsubTransactions(); unsubInventory(); unsubProjects(); unsubParties(); };
  }, [toast]);

  const handleAddNewProject = async () => {
    try {
      await addProfitProject({
        name: `New Project ${projects.length + 1}`,
        rows: [],
      });
      toast({ title: "Project Added" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleProjectUpdate = (projectId: string, updateData: Partial<ProfitCalculationProject>) => {
    // Optimistic UI update
    setProjects(prevProjects =>
      prevProjects.map(p =>
        p.id === projectId ? { ...p, ...updateData } : p
      )
    );
    // Debounced Firestore update
    debouncedUpdateProject(projectId, updateData);
  };
  
  const handleDeleteProject = async (projectId: string) => {
    try {
      await deleteProfitProject(projectId);
      toast({ title: "Project Deleted" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  
  const handleAddNewRow = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const now = new Date();
    const newRow: CalculationRow = {
      id: `row-${Date.now()}`,
      businessProfile: appSettings?.businessProfiles[0]?.name || 'all',
      type: 'auto',
      dateFrom: formatFns(startOfMonth(now), 'yyyy-MM'),
      dateTo: formatFns(endOfMonth(now), 'yyyy-MM-dd'),
      commission: 0,
      expectedCommission: 0,
      products: [],
      totalQuantity: 0,
      expense: 0,
      otherIncome: 0,
      stockProfit: 0,
      netProfit: 0,
    };
    const updatedRows = [...project.rows, newRow];
    handleProjectUpdate(projectId, { rows: updatedRows });
  };
  
 const calculateAutoValues = useCallback((row: CalculationRow) => {
    const monthDate = row.dateFrom ? parseISO(`${row.dateFrom}-02`) : new Date();
    const from = formatFns(startOfMonth(monthDate), 'yyyy-MM-dd');
    const to = formatFns(endOfMonth(monthDate), 'yyyy-MM-dd');
    
    const filteredTx = transactions.filter(t => {
      if (!t.enabled) return false;
      const txDate = t.date;
      if (txDate < from || txDate > to) return false;
      if (row.businessProfile && row.businessProfile !== 'all' && t.via !== row.businessProfile) return false;
      return true;
    });

    const productPurchases = new Map<string, { quantity: number; name: string }>();

    filteredTx.forEach(tx => {
        if ((tx.type === 'purchase' || tx.type === 'credit_purchase') && tx.items) {
            tx.items.forEach(item => {
                const existing = productPurchases.get(item.id) || { quantity: 0, name: item.name };
                existing.quantity += item.quantity;
                productPurchases.set(item.id, existing);
            });
        }
    });
    
    const autoProducts = Array.from(productPurchases.entries()).map(([productId, data]) => ({
        productId, name: data.name, quantity: data.quantity,
    }));

    const stockProfit = filteredTx
      .filter(t => (t.type === 'sale' || t.type === 'credit_sale') && t.items)
      .reduce((totalProfit, t) => {
          const saleCost = t.items!.reduce((sum, item) => sum + (item.cost || 0), 0);
          return totalProfit + (t.amount - saleCost);
      }, 0);
    
    const totalQuantity = autoProducts.reduce((sum, p) => sum + p.quantity, 0);
    const expense = filteredTx.filter(t => t.type === 'spent').reduce((sum, t) => sum + t.amount, 0);
    const otherIncome = filteredTx.filter(t => t.type === 'income' && !t.description.toLowerCase().includes('commission')).reduce((sum, t) => sum + t.amount, 0);
    
    // Commission is handled manually or via selection, so it's not recalculated here
    const commission = row.commission || 0;

    const netProfit = commission + otherIncome + stockProfit - expense;
    
    return {...row, dateTo: to, products: autoProducts, totalQuantity, stockProfit, expense, otherIncome, netProfit };

  }, [transactions, inventory]);


  useEffect(() => {
    const needsUpdate = projects.some(p => p.rows.some(r => r.type === 'auto'));
    if (needsUpdate && transactions.length > 0 && inventory.length > 0) {
      const updatedProjects = projects.map(proj => ({
          ...proj,
          rows: proj.rows.map(row => row.type === 'auto' ? calculateAutoValues(row) : row)
      }));
      if (JSON.stringify(projects) !== JSON.stringify(updatedProjects)) {
         setProjects(updatedProjects);
      }
    }
  }, [transactions, inventory, projects, calculateAutoValues]);

 const handleRowChange = (projectId: string, rowIndex: number, field: keyof CalculationRow, value: any, selectedIds?: string[]) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newRows = [...project.rows];
    let newRow = { ...newRows[rowIndex] };
    
    (newRow as any)[field] = value;
    if (selectedIds) {
        if (field === 'stockProfit') {
            (newRow as any).stockProfitProductIds = selectedIds;
        } else {
            (newRow as any)[`${field}Ids`] = selectedIds;
        }
    }
    
    let finalRow;
    if (newRow.type === 'auto' && (field === 'dateFrom' || field === 'businessProfile')) {
        finalRow = calculateAutoValues(newRow);
    } else {
        newRow.netProfit = (newRow.commission || 0) + (newRow.otherIncome || 0) + (newRow.stockProfit || 0) - (newRow.expense || 0);
        finalRow = newRow;
    }
    newRows[rowIndex] = finalRow;
    handleProjectUpdate(projectId, { rows: newRows });
};
  
  const handleCommissionDateChange = (projectId: string, rowIndex: number, range: DateRange | undefined) => {
    const project = projects.find(p => p.id === projectId);
    if (!project || !range || !range.from) return;
    
    const newRows = [...project.rows];
    let newRow = { ...newRows[rowIndex] };
    
    newRow.commissionDateFrom = formatFns(range.from, 'yyyy-MM-dd');
    newRow.commissionDateTo = range.to ? formatFns(range.to, 'yyyy-MM-dd') : newRow.commissionDateFrom;

    newRows[rowIndex] = newRow;
    handleProjectUpdate(projectId, { rows: newRows });
  };

  const handleProductChange = (projectId: string, rowIndex: number, prodIndex: number, newProductId: string) => {
      const product = inventory.find(p => p.id === newProductId);
      if(!product) return;
      const project = projects.find(p => p.id === projectId);
      if (!project) return;

      const newRows = [...project.rows];
      newRows[rowIndex].products[prodIndex].productId = newProductId;
      newRows[rowIndex].products[prodIndex].name = product.name;
      handleProjectUpdate(projectId, { rows: newRows });
  };

  const handleProductQuantityChange = (projectId: string, rowIndex: number, prodIndex: number, newQuantity: number) => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      const newRows = [...project.rows];
      newRows[rowIndex].products[prodIndex].quantity = newQuantity;
      newRows[rowIndex].totalQuantity = newRows[rowIndex].products.reduce((sum, p) => sum + p.quantity, 0);
      handleProjectUpdate(projectId, { rows: newRows });
  };
  
  const handleAddProductToRow = (projectId: string, rowIndex: number) => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      const newRows = [...project.rows];
      newRows[rowIndex].products.push({productId: '', quantity: 0, name: ''});
      handleProjectUpdate(projectId, { rows: newRows });
  };

  const handleRemoveProductFromRow = (projectId: string, rowIndex: number, prodIndex: number) => {
     const project = projects.find(p => p.id === projectId);
      if (!project) return;
      const newRows = [...project.rows];
      newRows[rowIndex].products.splice(prodIndex, 1);
      newRows[rowIndex].totalQuantity = newRows[rowIndex].products.reduce((sum, p) => sum + p.quantity, 0);
      handleProjectUpdate(projectId, { rows: newRows });
  };

  const handleRemoveRow = (projectId: string, rowIndex: number) => {
      const project = projects.find(p => p.id === projectId);
      if (!project) return;
      const updatedRows = project.rows.filter((_, i) => i !== rowIndex);
      handleProjectUpdate(projectId, { rows: updatedRows });
  };
  
  const handleNavigateToDetailedReport = (project: ProfitCalculationProject, row: CalculationRow) => {
    sessionStorage.setItem('detailedReportData', JSON.stringify({ project, row }));
    router.push('/reports/detailed-profit-report');
  };
  
  const getCommissionDateRange = (projectId: string, rowIndex: number): DateRange | undefined => {
    const project = projects.find(p => p.id === projectId);
    const row = project?.rows[rowIndex];
    if (!row || !row.commissionDateFrom) return undefined;
    return { from: parseISO(row.commissionDateFrom), to: row.commissionDateTo ? parseISO(row.commissionDateTo) : parseISO(row.commissionDateFrom) };
  };

  const getInitialBusinessProfile = (projectId: string, rowIndex: number): string => {
     const project = projects.find(p => p.id === projectId);
     const row = project?.rows[rowIndex];
     return row?.businessProfile || 'all';
  };

  const handleSaveAllProjects = async () => {
    setIsSaving(true);
    try {
        await saveProfitProjects(projects);
        toast({title: "Success", description: "All projects have been saved."});
    } catch (e: any) {
        toast({variant: 'destructive', title: 'Error', description: `Could not save projects: ${e.message}`});
    } finally {
        setIsSaving(false);
    }
  }
  
  const calculateProjectTotals = (rows: CalculationRow[]) => {
    return rows.reduce((acc, row) => {
      acc.totalCommission += row.commission || 0;
      acc.totalExpectedCommission += row.expectedCommission || 0;
      acc.totalQuantity += row.totalQuantity || 0;
      acc.totalExpense += row.expense || 0;
      acc.totalOtherIncome += row.otherIncome || 0;
      acc.totalStockProfit += row.stockProfit || 0;
      acc.totalNetProfit += row.netProfit || 0;
      return acc;
    }, { totalCommission: 0, totalExpectedCommission: 0, totalQuantity: 0, totalExpense: 0, totalOtherIncome: 0, totalStockProfit: 0, totalNetProfit: 0 });
  };
  
  const getExcludedTxIdsForRow = (projectId: string, rowIndex: number, currentField: 'commission' | 'otherIncome' | 'expense') => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return new Set<string>();

    const excludedIds = new Set<string>();
    
    project.rows.forEach((row, rIndex) => {
        const fieldsToScan: (keyof CalculationRow)[] = ['commissionIds', 'otherIncomeIds', 'expenseIds'];
        fieldsToScan.forEach(fieldKey => {
            if (rIndex !== rowIndex || fieldKey !== `${currentField}Ids`) {
                (row[fieldKey] as string[] | undefined)?.forEach(id => excludedIds.add(id));
            }
        });
    });

    return excludedIds;
  };

  const getInitialDateRange = (project: ProfitCalculationProject | undefined, rowIndex: number) => {
    const row = project?.rows[rowIndex];
    if (!row || !row.dateFrom) return undefined;
    const fromDate = parseISO(`${row.dateFrom}-02`);
    const toDate = row.dateTo ? parseISO(row.dateTo) : fromDate;
    return { from: fromDate, to: toDate };
  }


  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      {isTxDialogOpen && txDialogTarget && (
        <SelectTransactionsDialog
          open={isTxDialogOpen}
          onOpenChange={(open) => {
            if (!open) setTxDialogTarget(null);
            setIsTxDialogOpen(open);
          }}
          allTransactions={transactions}
          parties={parties}
          initialDateRange={getInitialDateRange(projects.find(p => p.id === txDialogTarget.projectId), txDialogTarget.rowIndex)}
          initialBusinessProfile={getInitialBusinessProfile(txDialogTarget.projectId, txDialogTarget.rowIndex)}
          onSelect={(total, selectedIds) => {
            if (txDialogTarget) {
              handleRowChange(txDialogTarget.projectId, txDialogTarget.rowIndex, txDialogTarget.field, total, selectedIds);
            }
          }}
          transactionType={txDialogTarget.field}
          appSettings={appSettings}
          calculationType={'sum'}
          excludedTxIds={getExcludedTxIdsForRow(txDialogTarget.projectId, txDialogTarget.rowIndex, txDialogTarget.field)}
          currentSelectionIds={projects.find(p => p.id === txDialogTarget.projectId)?.rows[txDialogTarget.rowIndex][`${txDialogTarget.field}Ids` as keyof CalculationRow] as string[] | undefined}
        />
      )}
      {isStockProfitDialogOpen && stockProfitDialogTarget && (
        <SelectStockProfitDialog
          open={isStockProfitDialogOpen}
          onOpenChange={(open) => {
            if(!open) setStockProfitDialogTarget(null);
            setIsStockProfitDialogOpen(open);
          }}
          allTransactions={transactions}
          inventory={inventory}
          initialDateRange={getInitialDateRange(projects.find(p => p.id === stockProfitDialogTarget.projectId), stockProfitDialogTarget.rowIndex)}
          initialBusinessProfile={getInitialBusinessProfile(stockProfitDialogTarget.projectId, stockProfitDialogTarget.rowIndex)}
          onSelect={(total, selectedIds) => {
            if (stockProfitDialogTarget) {
              handleRowChange(stockProfitDialogTarget.projectId, stockProfitDialogTarget.rowIndex, 'stockProfit', total, selectedIds);
            }
          }}
           currentSelectionIds={projects.find(p => p.id === stockProfitDialogTarget.projectId)?.rows[stockProfitDialogTarget.rowIndex].stockProfitProductIds}
        />
      )}
       
      <div className="flex justify-between items-center mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
        <Button onClick={handleAddNewProject}><Plus className="mr-2 h-4 w-4" /> Add New Project</Button>
      </div>
      
      {projects.length === 0 && !loading && (
          <div className="text-center py-16 border-2 border-dashed rounded-lg">
              <h3 className="text-xl font-semibold">No Projects Yet</h3>
              <p className="text-muted-foreground mt-2">Click "Add New Project" to get started.</p>
          </div>
      )}
      
      <div className="space-y-8">
        {projects.map(project => {
            const totals = calculateProjectTotals(project.rows);
            return (
              <Card key={project.id}>
                <CardHeader>
                  <div className="flex justify-between items-center gap-4">
                     <Input 
                        defaultValue={project.name} 
                        onChange={e => handleRowChange(project.id, 0, 'name', e.target.value)}
                        className="text-2xl font-bold border-0 shadow-none focus-visible:ring-0 p-0 h-auto"
                      />
                     <div className="flex items-center gap-2">
                         <Button onClick={() => handleAddNewRow(project.id)}><Plus className="mr-2 h-4 w-4" /> Add Row</Button>
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="destructive" size="icon"><Trash2 className="h-4 w-4"/></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                               <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Project?</AlertDialogTitle>
                                    <AlertDialogDescriptionComponent>Are you sure you want to delete the project "{project.name}"? This action cannot be undone.</AlertDialogDescriptionComponent>
                                </AlertDialogHeader>
                               <AlertDialogFooter>
                                   <AlertDialogCancel>Cancel</AlertDialogCancel>
                                   <AlertDialogAction onClick={() => handleDeleteProject(project.id)}>Delete</AlertDialogAction>
                               </AlertDialogFooter>
                            </AlertDialogContent>
                         </AlertDialog>
                     </div>
                  </div>
                   <CardDescription>Calculate profit with custom parameters and adjustments for this project.</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? ( <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div> ) : (
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Business</TableHead><TableHead>Type</TableHead><TableHead>Month</TableHead><TableHead>Products (Purchased)</TableHead>
                            <TableHead className="text-right">Total Qty</TableHead><TableHead>Commission</TableHead>
                            <TableHead>Exp. Commission</TableHead>
                            <TableHead>Other Income</TableHead>
                            <TableHead>Expense</TableHead>
                            <TableHead>Stock Profit</TableHead><TableHead className="text-right">Net Profit</TableHead>
                            <TableHead className="w-12"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {project.rows.map((row, index) => (
                            <TableRow key={row.id}>
                              <TableCell><Select defaultValue={row.businessProfile} onValueChange={v => handleRowChange(project.id, index, 'businessProfile', v)}><SelectTrigger className="w-40"><SelectValue/></SelectTrigger><SelectContent>{appSettings?.businessProfiles.map(p=><SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}</SelectContent></Select></TableCell>
                              <TableCell><Select defaultValue={row.type} onValueChange={v => handleRowChange(project.id, index, 'type', v)}><SelectTrigger className="w-28"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="auto">Auto</SelectItem><SelectItem value="manual">Manual</SelectItem></SelectContent></Select></TableCell>
                              <TableCell>
                                <Input
                                    type="month"
                                    defaultValue={row.dateFrom}
                                    onChange={(e) => handleRowChange(project.id, index, 'dateFrom', e.target.value)}
                                    className="w-40"
                                />
                              </TableCell>
                              <TableCell className="min-w-[300px]">
                                <div className="space-y-2">
                                  {row.products.map((prod, pIndex) => (
                                      <div key={pIndex} className="flex gap-2 items-center">
                                          {row.type === 'manual' ? (
                                            <ProductCombobox items={inventory} value={prod.productId} onSelect={(item) => handleProductChange(project.id, index, pIndex, item.id)} />
                                          ) : (
                                            <Input value={prod.name} readOnly className="bg-muted/50" />
                                          )}
                                            <div className="flex items-center gap-1">
                                                <Input type="number" defaultValue={prod.quantity} onChange={e=>handleProductQuantityChange(project.id, index, pIndex, Number(e.target.value) || 0)} className="w-24" placeholder="Qty" disabled={row.type==='auto'} />
                                            </div>
                                          {row.type === 'manual' && <Button variant="ghost" size="icon" onClick={() => handleRemoveProductFromRow(project.id, index, pIndex)}><Trash2 className="h-4 w-4 text-destructive"/></Button> }
                                      </div>
                                  ))}
                                  {row.type === 'manual' && <Button type="button" variant="outline" size="sm" onClick={() => handleAddProductToRow(project.id, index)}>Add Product</Button>}
                                </div>
                              </TableCell>
                              <TableCell><Input type="number" defaultValue={row.totalQuantity} onChange={e=>handleRowChange(project.id, index, 'totalQuantity', Number(e.target.value))} className="w-24 text-right" disabled={row.type==='auto'} /></TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                    <Input type="number" defaultValue={row.commission.toFixed(2)} onChange={(e) => handleRowChange(project.id, index, 'commission', parseFloat(e.target.value) || 0)} readOnly={row.type === 'auto'} className="w-28 text-right" />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => { setTxDialogTarget({ projectId: project.id, rowIndex: index, field: 'commission' }); setIsTxDialogOpen(true); }}><Calculator className="h-4 w-4"/></Button>
                                </div>
                                <DatePicker 
                                  value={getCommissionDateRange(project.id, index)?.from}
                                  onChange={(d) => handleCommissionDateChange(project.id, index, d ? { from: d, to: d } : undefined)}
                                />
                              </TableCell>
                              <TableCell><Input type="number" defaultValue={row.expectedCommission} onChange={e=>handleRowChange(project.id, index, 'expectedCommission', Number(e.target.value))} className="w-28 text-right"/></TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                    <Input type="number" defaultValue={row.otherIncome.toFixed(2)} onChange={(e) => handleRowChange(project.id, index, 'otherIncome', parseFloat(e.target.value) || 0)} readOnly={row.type === 'auto'} className="w-28 text-right" />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => { setTxDialogTarget({ projectId: project.id, rowIndex: index, field: 'otherIncome' }); setIsTxDialogOpen(true); }}><Calculator className="h-4 w-4"/></Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                    <Input type="number" defaultValue={row.expense.toFixed(2)} onChange={(e) => handleRowChange(project.id, index, 'expense', parseFloat(e.target.value) || 0)} readOnly={row.type === 'auto'} className="w-28 text-right" />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => { setTxDialogTarget({ projectId: project.id, rowIndex: index, field: 'expense' }); setIsTxDialogOpen(true); }}><Calculator className="h-4 w-4"/></Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                    <Input type="number" defaultValue={row.stockProfit.toFixed(2)} readOnly className="w-28 text-right" />
                                     <Button type="button" variant="ghost" size="icon" onClick={() => { setStockProfitDialogTarget({ projectId: project.id, rowIndex: index }); setIsStockProfitDialogOpen(true); }}><Calculator className="h-4 w-4"/></Button>
                                </div>
                              </TableCell>
                              <TableCell><Input type="number" defaultValue={row.netProfit.toFixed(2)} readOnly className="w-28 text-right bg-muted/50" /></TableCell>
                              <TableCell>
                                <div className="flex">
                                  <Button variant="ghost" size="icon" onClick={() => handleNavigateToDetailedReport(project, row)}><FileText className="h-4 w-4"/></Button>
                                  <Button variant="ghost" size="icon" onClick={() => handleRemoveRow(project.id, index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                              <TableCell colSpan={4} className="text-right font-bold">Totals:</TableCell>
                              <TableCell className="text-right font-bold">{totals.totalQuantity}</TableCell>
                              <TableCell className="text-right font-bold">{formatAmount(totals.totalCommission)}</TableCell>
                              <TableCell className="text-right font-bold">{formatAmount(totals.totalExpectedCommission)}</TableCell>
                              <TableCell className="text-right font-bold">{formatAmount(totals.totalOtherIncome)}</TableCell>
                              <TableCell className="text-right font-bold">{formatAmount(totals.totalExpense)}</TableCell>
                              <TableCell className="text-right font-bold">{formatAmount(totals.totalStockProfit)}</TableCell>
                              <TableCell className="text-right font-bold">{formatAmount(totals.totalNetProfit)}</TableCell>
                              <TableCell></TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </div>
                  )}
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button onClick={handleSaveAllProjects} disabled={isSaving}>
                        <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save All Projects'}
                    </Button>
                </CardFooter>
              </Card>
            )
        })}
      </div>
    </div>
  );
}


