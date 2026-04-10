

"use client"

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Transaction, Account, PlanEntry, Party, PlanProject, InventoryItem, TransactionType, ShopDayReport } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, ArrowDown, ArrowUp, Banknote, Landmark, Scale, Plus, Save, Trash2, User, ChevronsUpDown, Check, Edit, MoreVertical, BookOpen, Calculator } from 'lucide-react';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToPlanEntries, addPlanEntry, updatePlanEntry, deletePlanEntry, subscribeToPlanProjects, addPlanProject, updatePlanProject, deletePlanProject, subscribeToOrphanPlanEntries } from '@/services/planService';
import { subscribeToDailyReports } from '@/services/shopSessionService';
import { getEffectiveAmount, formatBalance, transactionTypeOptions, formatDate, getPartyBalanceEffect, formatAmount, cleanUndefined } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DatePicker } from '@/components/ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { format as formatFns, subMonths, startOfMonth, endOfMonth, parseISO, isBefore, startOfYesterday, isValid } from 'date-fns';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { doc } from 'firebase/firestore';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from 'next/link';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { Badge } from '@/components/ui/badge';


type Balance = {
  cash: number;
  bank: number;
  total: number;
};

interface NewEntryState {
    dates: Date[];
    description: string;
    amount: number;
    type: TransactionType;
    accountType: 'cash' | 'bank';
    partyId?: string;
}

const PartyCombobox = ({ parties, value, onChange, partyBalances, plannedPartyIds }: { parties: Party[], value?: string, onChange: (value: string) => void, partyBalances: { [partyId: string]: number }, plannedPartyIds: Set<string> }) => {
    const [open, setOpen] = useState(false);
    const selectedPartyName = parties.find(p => p.id === value)?.name;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedPartyName || "Select party (optional)..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search party..." />
                    <CommandList>
                        <CommandEmpty>No party found.</CommandEmpty>
                        <CommandGroup>
                             <CommandItem value="none" onSelect={() => onChange('')}>
                                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                                None
                            </CommandItem>
                            {parties.map((party) => {
                                const balance = partyBalances[party.id] || 0;
                                const hasPlan = plannedPartyIds.has(party.id);
                                const itemClass = hasPlan ? 'bg-green-600 text-white' : 'bg-red-600 text-white';

                                return (
                                    <CommandItem 
                                        key={party.id} 
                                        value={party.name} 
                                        onSelect={() => { onChange(party.id); setOpen(false); }}
                                        className={cn('aria-selected:bg-primary aria-selected:text-primary-foreground', itemClass)}
                                    >
                                        <Check className={cn("mr-2 h-4 w-4", value === party.id ? "opacity-100" : "opacity-0")} />
                                        <div className="flex justify-between w-full text-white">
                                            <span >{party.name}</span>
                                            <span >{formatAmount(balance)}</span>
                                        </div>
                                    </CommandItem>
                                );
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const ProductCombobox = ({ items, onSelect, className }: { items: InventoryItem[], onSelect: (item: InventoryItem | null) => void, className?: string }) => {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className={cn("w-full justify-between font-normal", className)}>
                    {"Select item to add..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search item..." />
                    <CommandList>
                        <CommandEmpty>No item found.</CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => (
                                <CommandItem
                                    key={item.id}
                                    value={item.name}
                                    onSelect={() => {
                                        onSelect(item);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={"mr-2 h-4 w-4 opacity-0"} />
                                    <div className="flex justify-between w-full">
                                        <span>{item.name}</span>
                                        <span className="text-xs text-muted-foreground">{formatAmount(item.cost)}</span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const MultiAccountSelect = ({ accounts, selected, onChange }: { accounts: Account[], selected: string[], onChange: (selected: string[]) => void }) => {
    const [open, setOpen] = useState(false);

    const handleSelect = (accountId: string) => {
        const newSelected = selected.includes(accountId)
            ? selected.filter(id => id !== accountId)
            : [...selected, accountId];
        onChange(newSelected);
    };

    const selectedAccounts = selected.map(id => accounts.find(acc => acc.id === id)).filter(Boolean) as Account[];

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal h-auto min-h-10">
                    <div className="flex flex-wrap gap-1">
                        {selectedAccounts.length > 0 ? (
                            selectedAccounts.map(account => (
                                <Badge key={account.id} variant="secondary">
                                    {account.name}
                                </Badge>
                            ))
                        ) : (
                            "Select accounts to load balance..."
                        )}
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
    );
};


const BalanceDisplayCard = ({ title, balances, children }: { title: string, balances: Balance, children?: React.ReactNode }) => (
    <Card className="bg-muted/50">
        <CardHeader className="p-3">
            <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent className="p-3 space-y-2">
            <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><Banknote className="h-4 w-4"/>Cash</span>
                <span className={cn("font-mono", balances.cash >= 0 ? 'text-green-600' : 'text-red-600')}>{formatBalance(balances.cash)}</span>
            </div>
            <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-1.5"><Landmark className="h-4 w-4"/>Bank</span>
                <span className={cn("font-mono", balances.bank >= 0 ? 'text-green-600' : 'text-red-600')}>{formatBalance(balances.bank)}</span>
            </div>
            {children && <div className="border-t pt-2 mt-2">{children}</div>}
        </CardContent>
         <CardFooter className="p-3 border-t">
            <div className="flex justify-between items-center w-full">
                <span className="font-semibold flex items-center gap-1.5"><Scale className="h-4 w-4"/>Total</span>
                <span className={cn("font-mono font-bold", balances.total >= 0 ? 'text-green-600' : 'text-red-600')}>{formatBalance(balances.total)}</span>
            </div>
        </CardFooter>
    </Card>
);

export default function PlanClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const newProjectIdFromQuery = searchParams.get('newProjectId');
  const [liveAccounts, setLiveAccounts] = useState<Account[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [planProjects, setPlanProjects] = useState<PlanProject[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [planEntries, setPlanEntries] = useState<PlanEntry[]>([]);
  const [shopReports, setShopReports] = useState<ShopDayReport[]>([]);
  
  const [isAutoReloadEnabled, setIsAutoReloadEnabled] = useState(false);
  const [reloadInterval, setReloadInterval] = useState(5); // in minutes
  
  const [newEntry, setNewEntry] = useState<NewEntryState>({
    dates: [new Date()],
    description: '',
    amount: 0,
    type: 'spent',
    accountType: 'bank',
    partyId: ''
  });

  const [newPurchaseItems, setNewPurchaseItems] = useState<{ id: string; name: string; quantity: number; price: number }[]>([]);
  
  const isInitialLoad = useRef(true);

  // Get current selected project
  const currentProject = useMemo(() => {
    return planProjects.find(p => p.id === selectedPlanId);
  }, [planProjects, selectedPlanId]);


  const startingBalance = useMemo(() => {
    if (!currentProject) return { cash: 0, bank: 0, total: 0 };

    // If rawStartingBalance has a value (from quick add), prioritize it
    if (currentProject.rawStartingBalance && currentProject.rawStartingBalance.total > 0) {
        return currentProject.rawStartingBalance;
    }

    // Otherwise, calculate from selected accounts
    if (!currentProject.selectedAccountIds || currentProject.selectedAccountIds.length === 0) {
        return { cash: 0, bank: 0, total: 0 };
    }

    const selectedAccounts = liveAccounts.filter(acc => currentProject.selectedAccountIds!.includes(acc.id));
    
    const cash = selectedAccounts.filter(acc => acc.name.toLowerCase().includes('cash')).reduce((sum, acc) => sum + acc.balance, 0);
    const bank = selectedAccounts.filter(acc => !acc.name.toLowerCase().includes('cash')).reduce((sum, acc) => sum + acc.balance, 0);
    
    return {
      cash,
      bank,
      total: cash + bank,
    };
  }, [currentProject, liveAccounts]);


   useEffect(() => {
    if (newEntry.type === 'purchase' || newEntry.type === 'credit_purchase') {
      const total = newPurchaseItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      setNewEntry(prev => ({ ...prev, amount: total }));
    }
  }, [newPurchaseItems, newEntry.type]);
  
  useEffect(() => {
      const savedAutoReload = localStorage.getItem('planAutoReloadEnabled');
      if (savedAutoReload) setIsAutoReloadEnabled(JSON.parse(savedAutoReload));
      
      const savedInterval = localStorage.getItem('planReloadInterval');
      if (savedInterval) setReloadInterval(parseInt(savedInterval, 10));

  }, []);

  const handleDataMigration = useCallback(async (projects: PlanProject[]) => {
    const orphanSub = subscribeToOrphanPlanEntries(async (orphanEntries) => {
      orphanSub(); // Unsubscribe after the first run.
      const defaultPlanExists = projects.some(p => p.name === 'Default Plan');
      if (orphanEntries.length > 0 && !defaultPlanExists) {
        toast({ title: 'Migrating Old Data', description: `Found ${orphanEntries.length} entries. Moving to a "Default Plan".` });
        try {
          const defaultPlanId = await addPlanProject({ name: 'Default Plan', selectedAccountIds: [], rawStartingBalance: {cash: 0, bank: 0, total: 0} });
          const batch = writeBatch(db);
          orphanEntries.forEach(entry => {
            const entryRef = doc(db, 'planEntries', entry.id);
            batch.update(entryRef, { planId: defaultPlanId });
          });
          await batch.commit();
          toast({ title: 'Migration Complete!', description: 'Your old data is now available under "Default Plan".' });
        } catch (e) {
          toast({ variant: 'destructive', title: "Migration Failed", description: "Could not create a default plan." });
        }
      }
    }, (err) => {
      toast({ variant: 'destructive', title: "Migration Error", description: err.message });
      orphanSub();
    });
  }, [toast]);

  useEffect(() => {
    if (newProjectIdFromQuery) {
        setSelectedPlanId(newProjectIdFromQuery);
        // Clean the URL
        router.replace('/plan');
    }
}, [newProjectIdFromQuery, router]);

  useEffect(() => {
    const unsubProjects = subscribeToPlanProjects((projects) => {
        setPlanProjects(projects);
        if (isInitialLoad.current && projects.length > 0) {
            handleDataMigration(projects);
            const lastSelected = localStorage.getItem('selectedPlanId');
            if (!newProjectIdFromQuery) {
                const planToSelect = projects.find(p => p.id === lastSelected) || projects[0];
                 if (planToSelect) {
                    setSelectedPlanId(planToSelect.id || '');
                }
            }
            isInitialLoad.current = false;
        }
    }, (err) => toast({ variant: 'destructive', title: "Error", description: err.message }));
    
    return () => unsubProjects();
  }, [toast, handleDataMigration, newProjectIdFromQuery]);


  useEffect(() => {
    const unsubAccounts = subscribeToAccounts(setLiveAccounts, (err) => toast({ variant: 'destructive', title: "Error", description: err.message }));
    const unsubTxs = subscribeToAllTransactions(setAllTransactions, (err) => toast({ variant: 'destructive', title: "Error fetching transactions" }));
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: "Error fetching parties" }));
    const unsubInventory = subscribeToInventoryItems(setInventoryItems, console.error);
    const unsubReports = subscribeToDailyReports(setShopReports, (err) => toast({ variant: 'destructive', title: 'Error fetching reports', description: err.message }));

    
    setLoading(false);
    return () => {
      unsubAccounts();
      unsubTxs();
      unsubParties();
      unsubInventory();
      unsubReports();
    };
  }, [toast]);
  
  useEffect(() => {
    if (selectedPlanId) {
      localStorage.setItem('selectedPlanId', selectedPlanId);
      const unsub = subscribeToPlanEntries(selectedPlanId, setPlanEntries, (err) => {
        toast({ variant: 'destructive', title: "Error fetching plan entries", description: err.message });
      });
      return () => unsub();
    } else {
      setPlanEntries([]); // Clear entries if no plan is selected
    }
  }, [selectedPlanId, toast]);

  useEffect(() => {
    if (planEntries.length > 0) {
        const yesterday = startOfYesterday();
        const entriesToDelete = planEntries.filter(entry => {
            try {
                const entryDate = parseISO(entry.date);
                return isBefore(entryDate, yesterday);
            } catch (e) {
                console.error(`Invalid date format for entry ${entry.id}: ${entry.date}`, e);
                return false;
            }
        });

        if (entriesToDelete.length > 0) {
            console.log(`Deleting ${entriesToDelete.length} old plan entries.`);
            const deletePromises = entriesToDelete.map(entry => deletePlanEntry(entry.id));
            Promise.all(deletePromises)
                .then(() => {
                    toast({
                        title: 'Old Plan Entries Cleared',
                        description: `${entriesToDelete.length} entries from before yesterday have been removed.`,
                    });
                })
                .catch(error => {
                    toast({
                        variant: 'destructive',
                        title: 'Error Clearing Entries',
                        description: `Could not delete old plan entries: ${error.message}`,
                    });
                });
        }
    }
  }, [planEntries, toast]);

  const partyBalances = useMemo(() => {
    const balances: { [partyId: string]: number } = {};
    for (const tx of allTransactions) {
      if (tx.partyId) {
        balances[tx.partyId] = (balances[tx.partyId] || 0) + getPartyBalanceEffect(tx, false);
      }
    }
    return balances;
  }, [allTransactions]);
  
  const partiesWithDue = useMemo(() => {
    return parties.filter(p => {
        const balance = partyBalances[p.id] || 0;
        return Math.abs(balance) > 0.01;
    });
  }, [parties, partyBalances]);

  const plannedPartyIds = useMemo(() => new Set(planEntries.filter(p => p.partyId).map(p => p.partyId)), [planEntries]);

  const availableToPlanForParty = useMemo(() => {
    if (!newEntry.partyId) return null;

    const currentPartyBalance = partyBalances[newEntry.partyId] || 0;
    const plannedPartyTxs = planEntries
        .filter(p => p.partyId === newEntry.partyId && p.enabled)
        .reduce((sum, p) => sum + getPartyBalanceEffect(p as any, true), 0);
    
    return currentPartyBalance + plannedPartyTxs;
  }, [newEntry.partyId, partyBalances, planEntries]);


  const planningTimeline = useMemo(() => {
    let currentCash = startingBalance.cash;
    let currentBank = startingBalance.bank;
    const runningPartyBalances = { ...partyBalances };

    const sortedEntries = [...planEntries].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return sortedEntries.map(entry => {
      let cashEffect = 0;
      let bankEffect = 0;
      let partyBalanceAfter = null;

      if(entry.enabled) {
          const amount = getEffectiveAmount({type: entry.type, amount: entry.amount, enabled: true} as any);
          if (entry.accountType === 'cash') {
              cashEffect = amount;
          } else {
              bankEffect = amount;
          }
      }
      
      currentCash += cashEffect;
      currentBank += bankEffect;
      
      if (entry.partyId && entry.enabled) {
          const partyBalanceEffect = getPartyBalanceEffect(entry as any, false);
          runningPartyBalances[entry.partyId] = (runningPartyBalances[entry.partyId] || 0) + partyBalanceEffect;
          partyBalanceAfter = runningPartyBalances[entry.partyId];
      }

      return {
        ...entry,
        runningCashBalance: currentCash,
        runningBankBalance: currentBank,
        runningTotalBalance: currentCash + currentBank,
        partyBalanceAfter,
      };
    });
  }, [planEntries, startingBalance, partyBalances]);
  
  const finalPlanningBalance = useMemo(() => {
      if(planningTimeline.length === 0) return startingBalance;
      const lastEntry = planningTimeline[planningTimeline.length - 1];
      return {
          cash: lastEntry.runningCashBalance,
          bank: lastEntry.runningBankBalance,
          total: lastEntry.runningTotalBalance
      };
  }, [planningTimeline, startingBalance]);

  const handleAccountSelectionChange = (ids: string[]) => {
    if (!currentProject) return;
    updatePlanProject(currentProject.id, { 
        selectedAccountIds: ids,
        rawStartingBalance: { cash: 0, bank: 0, total: 0 } 
    });
  };
  
  const handleQuickAddBalance = (amount: number) => {
    if (!currentProject) return;
    updatePlanProject(currentProject.id, {
        selectedAccountIds: [],
        rawStartingBalance: {
            total: amount,
            cash: amount,
            bank: 0,
        }
    });
    toast({ title: 'Balance Updated', description: `Starting balance set to ${formatAmount(amount)}` });
  };

  const quickAddBalances = useMemo(() => {
    if (shopReports.length === 0) return [];
    
    const sortedReports = [...shopReports]
        .filter(r => r.timestamp && isValid(new Date(r.timestamp)))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
    const lastClose = sortedReports.find(r => r.type === 'CLOSE');
    const lastOpen = sortedReports.find(r => r.type === 'OPEN');
    
    const options = [];
    if (lastClose) {
        options.push({
            label: `Last Closing (${formatDate(lastClose.date)})`,
            amount: lastClose.totalAmount,
        });
    }
    if (lastOpen) {
         options.push({
            label: `Last Opening (${formatDate(lastOpen.date)})`,
            amount: lastOpen.totalAmount,
        });
    }
    const uniqueOptions = Array.from(new Map(options.map(item => [item.label, item])).values());
    return uniqueOptions.slice(0, 2);

  }, [shopReports]);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId) {
        toast({ variant: 'destructive', title: 'No Plan Selected', description: 'Please create or select a plan first.' });
        return;
    }
    if (!newEntry.description || newEntry.amount <= 0 || newEntry.dates.length === 0) {
      toast({ variant: 'destructive', title: "Invalid Entry", description: "Please provide a description, a positive amount, and at least one date." });
      return;
    }

    if (newEntry.type === 'purchase' || newEntry.type === 'credit_purchase') {
      if (newPurchaseItems.length === 0) {
        toast({ variant: 'destructive', title: "No items", description: "Please add items for the purchase." });
        return;
      }
    }


    // Validation for party balance
    if (newEntry.partyId && availableToPlanForParty !== null) {
      const isReceiving = ['receive', 'sale', 'credit_sale', 'income'].includes(newEntry.type);
      const isGiving = ['give', 'purchase', 'credit_purchase', 'spent', 'credit_give'].includes(newEntry.type);
      const absAvailable = Math.abs(availableToPlanForParty);

      if (isReceiving && newEntry.amount > absAvailable) {
        toast({
          variant: 'destructive',
          title: 'Amount Exceeds Receivable',
          description: `You can only plan to receive up to ${formatAmount(absAvailable)} from this party.`,
        });
        return;
      }
  
      if (isGiving && newEntry.amount > absAvailable) {
        toast({
          variant: 'destructive',
          title: 'Amount Exceeds Payable',
          description: `You can only plan to give up to ${formatAmount(absAvailable)} to this party.`,
        });
        return;
      }
    }


    try {
        const party = parties.find(p => p.id === newEntry.partyId);

        for (const date of newEntry.dates) {
            const entryData: Partial<PlanEntry> = { 
                planId: selectedPlanId,
                date: formatFns(date, 'yyyy-MM-dd'),
                description: newEntry.description,
                amount: newEntry.amount,
                type: newEntry.type,
                accountType: newEntry.accountType,
                enabled: true,
                partyId: newEntry.partyId || undefined,
                partyName: party?.name || undefined,
            };

            if (newEntry.type === 'purchase' || newEntry.type === 'credit_purchase') {
              entryData.items = newPurchaseItems.map(({id, name, quantity, price}) => ({id, name, quantity, price}));
            }

             await addPlanEntry(cleanUndefined(entryData) as Omit<PlanEntry, 'id'>);
        }
        
        setNewEntry({
          dates: [new Date()],
          description: '',
          amount: 0,
          type: 'spent',
          accountType: 'bank',
          partyId: ''
        });
        setNewPurchaseItems([]);
        toast({ title: 'Entries Added', description: `Your new plan entries (${newEntry.dates.length}) have been saved.`});
    } catch (error) {
        console.error(error);
        toast({ variant: 'destructive', title: 'Save Error', description: 'Could not save the new entries.' });
    }
  };

  const handleToggleEntry = async (id: string, enabled: boolean) => {
    try {
        await updatePlanEntry(id, { enabled });
    } catch(error) {
        toast({ variant: 'destructive', title: 'Update Error', description: 'Could not update the entry status.' });
    }
  };
  
  const handleRemoveEntry = async (id: string) => {
      try {
        await deletePlanEntry(id);
        toast({ title: 'Entry Deleted' });
      } catch (error) {
         toast({ variant: 'destructive', title: 'Delete Error', description: 'Could not delete the entry.' });
      }
  }

  const handleEntryChange = async (id: string, field: keyof PlanEntry, value: any) => {
    try {
      const updateData: Partial<PlanEntry> = { [field]: value };
      if (field === 'date') {
        updateData.date = formatFns(new Date(value), 'yyyy-MM-dd');
      }
      await updatePlanEntry(id, updateData);
    } catch (error) {
      toast({ variant: 'destructive', title: 'Update Error', description: `Could not update ${field}.` });
    }
  };

  const handleRenameProject = async () => {
      const newName = prompt('Enter the new name for this plan:');
      if (newName && selectedPlanId) {
          await updatePlanProject(selectedPlanId, { name: newName });
          toast({title: 'Plan Renamed'});
      }
  };

  const handleDeleteProject = async () => {
      if (selectedPlanId) {
          await deletePlanProject(selectedPlanId);
          setSelectedPlanId('');
          toast({title: 'Plan Deleted'});
      }
  };

  const calculateAverage = (type: 'sale' | 'receive' | 'spent' | 'income') => {
    const threeMonthsAgo = subMonths(new Date(), 3);
    const startDate = formatFns(startOfMonth(threeMonthsAgo), 'yyyy-MM-dd');
    
    // Get all account IDs
    const allAccountIds = new Set(liveAccounts.map(a => a.id));

    const relevantTransactions = allTransactions.filter(tx => {
        let typeMatch = false;
        if (type === 'sale') typeMatch = tx.type === 'sale';
        else typeMatch = tx.type === type;
        
        let accountMatch = false;
        // For sales, check if any payment involves one of the accounts
        if (type === 'sale') {
            accountMatch = tx.payments?.some(p => allAccountIds.has(p.accountId)) ?? false;
        } else {
            // For other types, check the main accountId
            accountMatch = tx.accountId ? allAccountIds.has(tx.accountId) : false;
        }

        return typeMatch && accountMatch && tx.date >= startDate && tx.enabled;
    });

    if (relevantTransactions.length === 0) {
      toast({ title: 'No Data', description: `No ${type} transactions found in the last 3 months.` });
      return;
    }

    const totalAmount = relevantTransactions.reduce((sum, tx) => {
        if (type === 'sale' && tx.payments) {
            // Sum up payments that go to any of the tracked accounts
            const relevantPaymentAmount = tx.payments
                .filter(p => allAccountIds.has(p.accountId))
                .reduce((paymentSum, p) => paymentSum + p.amount, 0);
            return sum + relevantPaymentAmount;
        }
        return sum + tx.amount;
    }, 0);

    const average = totalAmount / relevantTransactions.length;
    
    setNewEntry(prev => ({ ...prev, amount: parseFloat(average.toFixed(2)) }));
    toast({ title: 'Average Calculated', description: `Average ${type} amount across all accounts is ${formatAmount(average)}.` });
};


  let lastDate: string | null = null;


  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <Tabs value={selectedPlanId} onValueChange={setSelectedPlanId} className="w-full">
                        <TabsList>
                            {planProjects.map(p => (
                                <TabsTrigger key={p.id} value={p.id}>{p.name}</TabsTrigger>
                            ))}
                            <Link href="/plan/new">
                               <Button variant="ghost" size="sm" className="ml-2">
                                <Plus className="h-4 w-4 mr-1"/> New Project
                               </Button>
                            </Link>
                        </TabsList>
                    </Tabs>
                    {selectedPlanId && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={handleRenameProject}><Edit className="mr-2 h-4 w-4"/> Rename</DropdownMenuItem>
                                <DropdownMenuSeparator/>
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/> Delete</DropdownMenuItem>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Confirm Delete</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete this plan and all its entries? This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDeleteProject}>Delete Plan</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>
            </CardHeader>
        </Card>
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2"><BookOpen/>Financial Planner</CardTitle>
              <CardDescription>Plan your future finances without affecting your live data.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="p-3">
                        <CardTitle className="text-base">Starting Accounts</CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-3">
                        <MultiAccountSelect
                            accounts={liveAccounts}
                            selected={currentProject?.selectedAccountIds || []}
                            onChange={handleAccountSelectionChange}
                        />
                         <div className="space-y-2 pt-2 border-t">
                            <Label className="text-xs text-muted-foreground">Quick Add from Daily Report</Label>
                            <div className="space-y-2">
                                {quickAddBalances.map(bal => (
                                    <div key={bal.label} className="flex items-center justify-between p-2 bg-background rounded-md border">
                                        <div>
                                            <p className="text-sm font-medium">{bal.label}</p>
                                            <p className="text-sm font-mono">{formatAmount(bal.amount)}</p>
                                        </div>
                                        <Button size="sm" variant="secondary" onClick={() => handleQuickAddBalance(bal.amount)}>Add</Button>
                                    </div>
                                ))}
                                {quickAddBalances.length === 0 && (
                                    <p className="text-xs text-center text-muted-foreground py-2">No recent reports found.</p>
                                )}
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Selected Starting Balance</p>
                            <p className="text-2xl font-bold">{formatAmount(startingBalance.total)}</p>
                        </div>
                    </CardContent>
                </Card>
               <BalanceDisplayCard title="Final Planning Balance" balances={finalPlanningBalance} />
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>New Plan Entry</CardTitle>
        </CardHeader>
        <form onSubmit={handleAddEntry}>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1 sm:col-span-2 lg:col-span-3">
                <Label>Description</Label>
                <Input value={newEntry.description} onChange={e => setNewEntry({ ...newEntry, description: e.target.value })} />
            </div>
             <div className="space-y-1">
                <Label>Party (optional)</Label>
                <PartyCombobox 
                    parties={partiesWithDue} 
                    value={newEntry.partyId} 
                    onChange={partyId => setNewEntry(prev => ({...prev, partyId}))} 
                    partyBalances={partyBalances} 
                    plannedPartyIds={plannedPartyIds}
                />
            </div>
            <div className="space-y-1">
                <Label>Available to Plan</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                       <Input
                          readOnly
                          value={availableToPlanForParty !== null 
                            ? `${formatAmount(availableToPlanForParty)}`
                            : 'N/A'
                          }
                          className={cn(
                            "font-semibold",
                            availableToPlanForParty === null ? '' :
                            availableToPlanForParty < 0 ? 'text-green-600' : 'text-red-600'
                          )}
                        />
                    </TooltipTrigger>
                     {newEntry.partyId && availableToPlanForParty !== null && (
                       <TooltipContent>
                        <p>{availableToPlanForParty < 0 ? 'You can receive up to this amount.' : 'You can give up to this amount.'}</p>
                      </TooltipContent>
                     )}
                  </Tooltip>
                </TooltipProvider>
            </div>
             <div className="space-y-1">
                <Label>Date(s)</Label>
                <DatePicker 
                    mode="multiple"
                    value={newEntry.dates}
                    onChange={(dates) => setNewEntry({...newEntry, dates: dates as Date[] || []})}
                    placeholder="Select one or more dates"
                    disableFutureDates={false}
                />
            </div>
            <div className="space-y-1">
                <Label>Type</Label>
                <Select value={newEntry.type} onValueChange={(v: TransactionType) => setNewEntry({ ...newEntry, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                    {transactionTypeOptions.filter(t => t.value !== 'transfer').map(opt => (
                        <SelectItem key={opt.value} value={opt.value as any}>{opt.label}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label>Account</Label>
                <Select value={newEntry.accountType} onValueChange={(v: 'cash' | 'bank') => setNewEntry({ ...newEntry, accountType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                    <SelectItem value="bank">Bank</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            
            {(newEntry.type === 'purchase' || newEntry.type === 'credit_purchase') ? (
                <div className="space-y-2 col-span-1 sm:col-span-2 lg:col-span-3">
                    <Label>Purchase Items</Label>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item</TableHead>
                                <TableHead className="w-24">Qty</TableHead>
                                <TableHead className="w-32">Price</TableHead>
                                <TableHead className="w-12"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {newPurchaseItems.map((item, index) => (
                                <TableRow key={item.id}>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.quantity} onChange={e => {
                                            const newItems = [...newPurchaseItems];
                                            newItems[index].quantity = parseInt(e.target.value) || 0;
                                            setNewPurchaseItems(newItems);
                                        }} />
                                    </TableCell>
                                    <TableCell>
                                        <Input type="number" value={item.price} onChange={e => {
                                            const newItems = [...newPurchaseItems];
                                            newItems[index].price = parseFloat(e.target.value) || 0;
                                            setNewPurchaseItems(newItems);
                                        }} />
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" onClick={() => setNewPurchaseItems(newPurchaseItems.filter((_, i) => i !== index))}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    <ProductCombobox items={inventoryItems} onSelect={(item) => {
                        if (item) {
                            setNewPurchaseItems(prev => [...prev, {id: item.id, name: item.name, quantity: 1, price: item.cost}]);
                        }
                    }} />
                </div>
            ) : (
                 <div className="space-y-1">
                    <Label>Amount</Label>
                    <div className="flex items-center gap-2">
                        <Input type="number" value={newEntry.amount || ''} 
                            onChange={e => setNewEntry({ ...newEntry, amount: parseFloat(e.target.value) || 0 })} 
                        />
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon"><Calculator className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => calculateAverage('sale')}>Average Sale (Cash)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => calculateAverage('receive')}>Avg Collection (Cash)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => calculateAverage('spent')}>Average Spent (Cash)</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => calculateAverage('income')}>Average Income (Cash)</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            )}
            
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full sm:w-auto"><Plus className="mr-2 h-4 w-4"/>Add to Plan</Button>
          </CardFooter>
        </form>
      </Card>
      
      <Card>
          <CardHeader><CardTitle>Planning Timeline</CardTitle></CardHeader>
          <CardContent>
            <TooltipProvider>
              <div className="rounded-md border overflow-x-auto">
                  <Table>
                      <TableHeader><TableRow>
                          <TableHead className="p-1 sm:p-2 w-12 text-xs sm:text-sm">On/Off</TableHead>
                          <TableHead className="p-1 sm:p-2 w-40 text-xs sm:text-sm">Date</TableHead>
                          <TableHead className="p-1 sm:p-2 text-xs sm:text-sm">Description</TableHead>
                          <TableHead className="p-1 sm:p-2 text-xs sm:text-sm">Party</TableHead>
                          <TableHead className="p-1 sm:p-2 text-xs sm:text-sm">Type</TableHead>
                          <TableHead className="p-1 sm:p-2 text-xs sm:text-sm">Account</TableHead>
                          <TableHead className="p-1 sm:p-2 text-right text-xs sm:text-sm">Amount</TableHead>
                          <TableHead className="p-1 sm:p-2 text-right text-xs sm:text-sm">Total Balance</TableHead>
                          <TableHead className="p-1 sm:p-2 text-right text-xs sm:text-sm">Action</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                          <TableRow className="bg-muted/50 hover:bg-muted/50"><TableCell colSpan={7} className="font-bold text-right p-2 text-xs sm:text-sm">Starting Balance</TableCell><TableCell className="text-right font-bold p-2 text-xs sm:text-sm">{formatBalance(startingBalance.total)}</TableCell><TableCell></TableCell></TableRow>
                          {planningTimeline.length > 0 ? (
                              planningTimeline.map(entry => {
                                  const showDateSeparator = entry.date !== lastDate;
                                  lastDate = entry.date;
                                  return (
                                    <React.Fragment key={entry.id}>
                                      {showDateSeparator && (
                                        <TableRow className="bg-primary/10 hover:bg-primary/20">
                                          <TableCell colSpan={9} className="p-2 font-bold text-primary">
                                            {formatDate(entry.date)}
                                          </TableCell>
                                        </TableRow>
                                      )}
                                      <TableRow data-state={entry.enabled ? 'active' : 'disabled'} className="data-[state=disabled]:text-muted-foreground data-[state=disabled]:opacity-60">
                                          <TableCell className="p-1 sm:p-2"><Switch checked={entry.enabled} onCheckedChange={(c) => handleToggleEntry(entry.id, c)} className="h-5 w-9 data-[state=checked]:translate-x-4 data-[state=unchecked]:translate-x-0" thumbClassName="h-4 w-4" /></TableCell>
                                          <TableCell className="p-1 sm:p-2">
                                            <Input type="date" defaultValue={entry.date} onBlur={(e) => handleEntryChange(entry.id, 'date', e.target.value)} className="w-full h-8 text-xs sm:text-sm" />
                                          </TableCell>
                                          <TableCell className="p-1 sm:p-2">
                                            <Input defaultValue={entry.description} onBlur={(e) => handleEntryChange(entry.id, 'description', e.target.value)} className="w-full h-8 text-xs sm:text-sm" />
                                            {entry.items && entry.items.length > 0 && (
                                                <div className="text-[10px] leading-tight text-muted-foreground mt-1 pl-1">
                                                    {entry.items.map((item, i) => (
                                                        <p key={i}>{item.name} ({item.quantity}x{item.price})</p>
                                                    ))}
                                                </div>
                                            )}
                                          </TableCell>
                                           <TableCell className="p-1 sm:p-2 text-xs sm:text-sm">
                                            <Tooltip>
                                              <TooltipTrigger asChild>
                                                  <span className="cursor-pointer underline-dashed">{entry.partyName || 'N/A'}</span>
                                              </TooltipTrigger>
                                              {entry.partyBalanceAfter !== null && (
                                                <TooltipContent>
                                                  <p>Remaining Balance: {formatAmount(entry.partyBalanceAfter)}</p>
                                                </TooltipContent>
                                              )}
                                            </Tooltip>
                                           </TableCell>
                                          <TableCell className="p-1 sm:p-2">
                                              <span className={cn('flex items-center gap-1 text-xs sm:text-sm', getEffectiveAmount({type: entry.type, amount: 1, enabled: true} as any) > 0 ? 'text-green-600' : 'text-red-600')}>
                                                  {getEffectiveAmount({type: entry.type, amount: 1, enabled: true} as any) > 0 ? <ArrowDown/> : <ArrowUp/>} {entry.type}
                                              </span>
                                          </TableCell>
                                          <TableCell className="p-1 sm:p-2 text-xs sm:text-sm">{entry.accountType}</TableCell>
                                          <TableCell className="p-1 sm:p-2">
                                            <Input type="number" defaultValue={entry.amount} onBlur={(e) => handleEntryChange(entry.id, 'amount', parseFloat(e.target.value))} className="w-full text-right h-8 text-xs sm:text-sm" />
                                          </TableCell>
                                          <TableCell className="text-right font-semibold p-2 text-xs sm:text-sm">{formatBalance(entry.runningTotalBalance)}</TableCell>
                                          <TableCell className="text-right p-1 sm:p-2">
                                               <AlertDialog>
                                                    <AlertDialogTrigger asChild>
                                                        <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                                    </AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This action will permanently delete this plan entry.</AlertDialogDescription></AlertDialogHeader>
                                                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleRemoveEntry(entry.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                          </TableCell>
                                      </TableRow>
                                    </React.Fragment>
                                  )
                              })
                          ) : (
                              <TableRow><TableCell colSpan={9} className="h-24 text-center">No planning entries yet. Add one above to start.</TableCell></TableRow>
                          )}
                      </TableBody>
                  </Table>
              </div>
            </TooltipProvider>
          </CardContent>
      </Card>
    </div>
  );
}

