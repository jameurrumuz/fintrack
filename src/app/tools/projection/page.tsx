
"use client"

import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Transaction, Account, PlanEntry, Party, AppSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, Banknote, Landmark, Scale, Plus, Save, Trash2, User, ChevronsUpDown, Check, Edit, MoreVertical, BookOpen, Calculator, ArrowLeft, UserSearch, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
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
import { format as formatFns, subMonths, startOfMonth, endOfMonth } from 'date-fns';
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
import { subscribeToPlanEntries, addPlanEntry, deletePlanEntry, updatePlanEntry } from '@/services/planService';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';


type Balance = {
  cash: number;
  bank: number;
  total: number;
};

interface NewEntryState {
    dates: Date[];
    description: string;
    amount: number;
    type: 'receive' | 'give';
}

const PartySelector = ({ parties, onSelect, placeholder, balances, colorClass }: { parties: Party[], onSelect: (party: Party) => void, placeholder: string, balances: { [key: string]: number }, colorClass: string }) => {
    const [open, setOpen] = useState(false);
    
    const sortedParties = useMemo(() => {
        return [...parties].sort((a, b) => Math.abs(balances[b.id] || 0) - Math.abs(balances[a.id] || 0));
    }, [parties, balances]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                    <UserSearch className="mr-2 h-4 w-4" /> {placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0">
                <Command>
                    <CommandInput placeholder="Search party..." />
                    <CommandList>
                        <CommandEmpty>No party found.</CommandEmpty>
                        <CommandGroup>
                            {sortedParties.map((party) => (
                                <CommandItem key={party.id} value={party.name} onSelect={() => { onSelect(party); setOpen(false); }}>
                                    <div className="flex justify-between w-full items-center">
                                        <span>{party.name}</span>
                                        <Badge variant="outline" className={cn("font-mono", colorClass)}>
                                            {formatAmount(Math.abs(balances[party.id] || 0))}
                                        </Badge>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

const PartyComboboxForInput = ({ parties, value, onChange, placeholder }: { parties: Party[], value: string, onChange: (value: string) => void, placeholder: string }) => {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Input
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    onClick={() => setOpen(true)}
                />
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search party..." />
                    <CommandList>
                        <CommandEmpty>No party found. Type to create new.</CommandEmpty>
                        <CommandGroup>
                            {parties.map((party) => (
                                <CommandItem key={party.id} value={party.name} onSelect={() => { onChange(party.name); setOpen(false); }}>
                                    {party.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

const ProjectionList = ({ title, icon, parties, balances, colorClass, type, appSettings, onSelectionChange, implementationTotal }: { title: string, icon: React.ReactNode, parties: Party[], balances: { [key: string]: number }, colorClass: string, type: 'receivable' | 'payable', appSettings: AppSettings | null, onSelectionChange: (ids: string[]) => void, implementationTotal: number }) => {
    
    const selectedPartyIds = useMemo(() => {
        return type === 'receivable' ? appSettings?.projectionReceivablePartyIds || [] : appSettings?.projectionPayablePartyIds || [];
    }, [appSettings, type]);

    const handleSelect = (partyId: string) => {
        const newSelected = selectedPartyIds.includes(partyId) 
            ? selectedPartyIds.filter(id => id !== partyId)
            : [...selectedPartyIds, partyId];
        onSelectionChange(newSelected);
    }
    
    const totalSelectedBalance = useMemo(() => {
        return parties
            .filter(p => selectedPartyIds.includes(p.id))
            .reduce((sum, p) => sum + Math.abs(balances[p.id] || 0), 0);
    }, [parties, selectedPartyIds, balances]);
    
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">{icon} {title}</CardTitle>
                <PartySelector parties={parties} onSelect={(p) => handleSelect(p.id)} placeholder="Add Party" balances={balances} colorClass={colorClass} />
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold flex items-center gap-2">
                    <span className={colorClass}>{formatAmount(totalSelectedBalance)}</span>
                     {implementationTotal > 0 && (
                        <>
                            <span className="text-lg text-muted-foreground">+</span>
                            <span className={cn("text-lg font-mono", colorClass)}>{formatAmount(implementationTotal)}</span>
                        </>
                    )}
                </div>
                <ScrollArea className="h-72 mt-4">
                    <div className="space-y-2 p-2">
                        {parties.filter(p => selectedPartyIds.includes(p.id)).map(party => (
                             <div key={party.id} className="flex items-center">
                                <Checkbox
                                    checked={true}
                                    onCheckedChange={() => handleSelect(party.id)}
                                />
                                <div className="ml-3 flex-grow flex justify-between items-center text-sm">
                                    <span>{party.name}</span>
                                    <span className={cn("font-mono", colorClass)}>{formatAmount(Math.abs(balances[party.id] || 0))}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};

export default function ProjectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [planEntries, setPlanEntries] = useState<PlanEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [newPlanEntry, setNewPlanEntry] = useState<NewEntryState>({ dates: [new Date()], description: '', amount: 0, type: 'receive' });

  useEffect(() => {
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: "Error", description: err.message }));
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: "Error", description: err.message }));
    getAppSettings().then(setAppSettings);
    const unsubPlanEntries = subscribeToPlanEntries(null, setPlanEntries, (err) => toast({ variant: 'destructive', title: "Error fetching plan entries", description: err.message }));
    
    setLoading(false);
    return () => {
      unsubParties();
      unsubTransactions();
      unsubPlanEntries();
    };
  }, [toast]);
  
  const partyBalances = useMemo(() => {
    const balances: { [partyId: string]: number } = {};
    for (const tx of transactions) {
      if (tx.partyId && tx.enabled) {
        balances[tx.partyId] = (balances[tx.partyId] || 0) + getPartyBalanceEffect(tx, false);
      }
    }
    return balances;
  }, [transactions]);
  
  const { receivableParties, payableParties } = useMemo(() => {
    const receivables: Party[] = [];
    const payables: Party[] = [];
    parties.forEach(p => {
        const balance = partyBalances[p.id] || 0;
        if (balance < 0) receivables.push(p);
        else if (balance > 0) payables.push(p);
    });
    return { receivableParties: receivables, payableParties: payables };
  }, [parties, partyBalances]);


  const handleSelectionChange = async (type: 'receivable' | 'payable', ids: string[]) => {
    if (!appSettings) return;

    const key = type === 'receivable' ? 'projectionReceivablePartyIds' : 'projectionPayablePartyIds';
    const newSettings = { ...appSettings, [key]: ids };

    setAppSettings(newSettings);

    try {
        await saveAppSettings({ [key]: ids });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error saving selection', description: error.message });
        const oldSettings = await getAppSettings();
        setAppSettings(oldSettings);
    }
  };

    const handleAddPlanEntry = async () => {
        if (!newPlanEntry.description || newPlanEntry.amount <= 0 || newPlanEntry.dates.length === 0) {
            toast({ variant: 'destructive', title: 'Invalid Entry', description: 'Please provide a description, amount and at least one date.'});
            return;
        }

        const party = parties.find(p => p.name.toLowerCase() === newPlanEntry.description.toLowerCase());
        const selectedPartyIds = new Set([
            ...(appSettings?.projectionReceivablePartyIds || []),
            ...(appSettings?.projectionPayablePartyIds || []),
        ]);
        
        if (party && !selectedPartyIds.has(party.id)) {
            toast({
                variant: 'destructive',
                title: 'Party Not in Details',
                description: `"${newPlanEntry.description}" is not in the Projection Details list. Please add them first.`
            });
            return;
        }

        try {
            for (const date of newPlanEntry.dates) {
                await addPlanEntry({
                    description: newPlanEntry.description,
                    amount: newPlanEntry.amount,
                    type: newPlanEntry.type,
                    date: formatFns(date, 'yyyy-MM-dd'),
                    planId: 'default', // Hardcoded for now
                    enabled: true,
                    accountType: 'cash', // Default value
                });
            }
            setNewPlanEntry({ dates: [new Date()], description: '', amount: 0, type: 'receive' });
            toast({ title: 'Plan entry added.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    };
    
    const handleDeletePlanEntry = async (id: string) => {
        try {
            await deletePlanEntry(id);
            toast({ title: 'Entry removed.' });
        } catch (e: any) {
             toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    }

   const { implReceivables, implPayables, receivableEntries, payableEntries, implReceivablesForDetails, implPayablesForDetails } = useMemo(() => {
        const receivablePartyIds = new Set(appSettings?.projectionReceivablePartyIds || []);
        const payablePartyIds = new Set(appSettings?.projectionPayablePartyIds || []);
        const partyNameMap = new Map(parties.map(p => [p.name.toLowerCase(), p.id]));
        
        return planEntries.reduce((acc, entry) => {
            if (!entry.enabled) return acc;
            
            const partyId = partyNameMap.get(entry.description.toLowerCase());
            
            const isInReceivableList = partyId ? receivablePartyIds.has(partyId) : false;
            const isInPayableList = partyId ? payablePartyIds.has(partyId) : false;

            if (entry.type === 'receive') {
                acc.receivableEntries.push(entry);
                if (isInReceivableList || !partyId) { // Also include entries without a specific party
                    acc.implReceivablesForDetails += entry.amount;
                }
                acc.implReceivables += entry.amount;
            } else if (entry.type === 'give') {
                acc.payableEntries.push(entry);
                 if (isInPayableList || !partyId) {
                    acc.implPayablesForDetails += entry.amount;
                }
                 acc.implPayables += entry.amount;
            }
            
            return acc;
        }, { implReceivables: 0, implPayables: 0, receivableEntries: [] as PlanEntry[], payableEntries: [] as PlanEntry[], implReceivablesForDetails: 0, implPayablesForDetails: 0 });
    }, [planEntries, parties, appSettings]);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  }
  
  const getPartyFromDescription = (description: string) => {
      return parties.find(p => p.name === description);
  }

  return (
    <div className="space-y-6">
       <div className="mb-6">
            <Button variant="outline" asChild><Link href="/tools"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Tools</Link></Button>
        </div>
      <Card>
        <CardHeader>
            <CardTitle>Projection Details</CardTitle>
             <CardDescription>Select parties from your due lists to project future cash flow.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
               <ProjectionList 
                    title="Receivables (I will get)" 
                    icon={<ArrowDownCircle className="h-5 w-5 text-green-600"/>} 
                    parties={receivableParties}
                    balances={partyBalances}
                    colorClass="text-green-600"
                    type="receivable"
                    appSettings={appSettings}
                    onSelectionChange={(ids) => handleSelectionChange('receivable', ids)}
                    implementationTotal={implReceivablesForDetails}
               />
               <ProjectionList 
                    title="Payables (I will give)" 
                    icon={<ArrowUpCircle className="h-5 w-5 text-red-600"/>} 
                    parties={payableParties}
                    balances={partyBalances}
                    colorClass="text-red-600"
                    type="payable"
                    appSettings={appSettings}
                    onSelectionChange={(ids) => handleSelectionChange('payable', ids)}
                    implementationTotal={implPayablesForDetails}
               />
            </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Projection Implement</CardTitle>
          <CardDescription>Manually add future or hypothetical transactions to see their impact.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <Card className="flex flex-col h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2"><ArrowDownCircle className="h-5 w-5 text-green-600"/> Planned Receivables</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <div className="text-4xl font-bold text-green-600">{formatAmount(implReceivables)}</div>
                        <ScrollArea className="h-72 border rounded-md mt-4">
                            <div className="p-2 space-y-2">
                                {receivableEntries.map(entry => {
                                    const party = getPartyFromDescription(entry.description);
                                    return (
                                        <div key={entry.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md">
                                            <div>
                                                {party && <Badge variant="secondary">{party.name}</Badge>}
                                                <p className={cn("font-medium", party && 'text-xs text-muted-foreground mt-1')}>{party ? entry.description.replace(party.name, '').trim() : entry.description}</p>
                                                <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-green-600">{formatAmount(entry.amount)}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeletePlanEntry(entry.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                                </Button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
                <Card className="flex flex-col h-full">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2"><ArrowUpCircle className="h-5 w-5 text-red-600"/> Planned Payables</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow">
                        <div className="text-4xl font-bold text-red-600">{formatAmount(implPayables)}</div>
                        <ScrollArea className="h-72 border rounded-md mt-4">
                            <div className="p-2 space-y-2">
                                {payableEntries.map(entry => {
                                     const party = getPartyFromDescription(entry.description);
                                     return (
                                        <div key={entry.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded-md">
                                            <div>
                                                {party && <Badge variant="secondary">{party.name}</Badge>}
                                                <p className={cn("font-medium", party && 'text-xs text-muted-foreground mt-1')}>{party ? entry.description.replace(party.name, '').trim() : entry.description}</p>
                                                <p className="text-xs text-muted-foreground">{formatDate(entry.date)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono text-red-600">{formatAmount(entry.amount)}</span>
                                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeletePlanEntry(entry.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                                </Button>
                                            </div>
                                        </div>
                                     )
                                })}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
            <div className="mt-4 p-4 border rounded-lg bg-muted/50">
                    <h4 className="font-semibold mb-2">Add New Entry</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 items-end">
                        <div className="space-y-1">
                            <Label>Date(s)</Label>
                            <DatePicker
                                mode="multiple"
                                value={newPlanEntry.dates}
                                onChange={(d) => setNewPlanEntry(p => ({...p, dates: d as Date[] || []}))}
                                disableFutureDates={false}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Description</Label>
                            <PartyComboboxForInput 
                                parties={parties} 
                                value={newPlanEntry.description} 
                                onChange={(value) => setNewPlanEntry(p => ({ ...p, description: value }))} 
                                placeholder="Payable/Receivable For..."
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Amount</Label>
                            <Input type="number" value={newPlanEntry.amount || ''} onChange={e => setNewPlanEntry(p => ({...p, amount: parseFloat(e.target.value) || 0}))}/>
                        </div>
                        <div className="space-y-1">
                            <Label>Type</Label>
                            <Select value={newPlanEntry.type} onValueChange={(v) => setNewPlanEntry(p => ({...p, type: v as any}))}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="receive">Receivable</SelectItem>
                                    <SelectItem value="give">Payable</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <Button onClick={handleAddPlanEntry} className="md:col-span-4">Add Entry</Button>
                    </div>
                </div>
        </CardContent>
      </Card>
    </div>
  );
}
