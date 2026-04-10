'use client';

import * as React from 'react';
import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Party, Transaction, Account, TransactionVia, AppSettings, ExpenseBook, ExpenseCategory, ChargeRule, SmsBlocklistRule, SmsSyncSettings, SheetRow } from '@/types';
import { transactionTypeOptions, formatAmount } from '@/lib/utils';
import { Plus, Check, ChevronsUpDown, Save, RefreshCcw, ListFilter, Trash2, X, FileText, MoveRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { addTransaction } from '@/services/transactionService';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRightLeft } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { DatePicker } from './ui/date-picker';
import { format as formatFns } from 'date-fns';
import { addExpenseCategoryToBook, saveAppSettings, subscribeToAppSettings, addSmsToDoneList, removeSmsFromDoneList, addSmsBlockRule, removeSmsBlockRule } from '@/services/settingsService';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { fetchSheetData } from '@/services/smsSyncService';
import { Loader2 } from 'lucide-react';
import { Badge } from './ui/badge';
import { Switch } from './ui/switch';
import { Checkbox } from './ui/checkbox';


const transactionSchema = z.object({
  date: z.date(),
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  accountId: z.string().optional(), // Made optional to handle credit_give/credit_sale
  type: z.enum(['sale', 'purchase', 'income', 'spent', 'receive', 'give', 'credit_sale', 'credit_purchase', 'sale_return', 'purchase_return', 'credit_give', 'credit_income']),
  partyId: z.string().optional(),
  via: z.string().optional(),
  charge: z.coerce.number().optional(),
  chargeVia: z.string().optional(),
}).superRefine((data, ctx) => {
    if (!['credit_sale', 'credit_purchase', 'credit_give', 'credit_income'].includes(data.type) && !data.accountId) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'Account is required for this transaction type.',
            path: ['accountId'],
        });
    }
});


const transferSchema = z.object({
    date: z.date(),
    amount: z.coerce.number().positive('Amount must be positive'),
    fromAccountId: z.string().min(1, "From account is required"),
    toAccountId: z.string().min(1, "To account is required"),
    description: z.string().optional(),
    charge: z.coerce.number().optional(),
    chargeVia: z.string().optional(),
}).refine(data => data.fromAccountId !== data.toAccountId, {
    message: "From and To accounts cannot be the same",
    path: ["toAccountId"],
});


type TransactionFormValues = z.infer<typeof transactionSchema>;
type TransferFormValues = z.infer<typeof transferSchema>;

interface TransactionFormProps {
  parties: Party[];
  accounts: Account[];
  appSettings: AppSettings | null;
  onAddTransaction: (data: Omit<Transaction, 'id' | 'enabled'>[], mode: 'saveAndClose' | 'saveAndNext') => void;
}

const PartyCombobox = ({ parties, value, onChange }: { parties: Party[], value?: string, onChange: (value: string) => void }) => {
    const [open, setOpen] = useState(false);
    const selectedParty = value ? parties.find(p => p.id === value) : null;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selectedParty ? selectedParty.name : "Select party..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search party..." />
                    <CommandList>
                        <CommandEmpty>No party found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value="none"
                                onSelect={() => {
                                    onChange("none");
                                    setOpen(false);
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 h-4 w-4",
                                        !value || value === "none" ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                None
                            </CommandItem>
                            {parties.map((party) => (
                                <CommandItem
                                    key={party.id}
                                    value={party.name}
                                    onSelect={(currentValue) => {
                                        const selected = parties.find(p => p.name.toLowerCase() === currentValue.toLowerCase());
                                        onChange(selected ? selected.id : "none");
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === party.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
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


export default function TransactionForm({ parties, accounts, appSettings: initialAppSettings, onAddTransaction }: TransactionFormProps) {
  const { toast } = useToast();
  
  const [appSettings, setAppSettings] = useState<AppSettings | null>(initialAppSettings);
  const [blocklistRules, setBlocklistRules] = useState<SmsBlocklistRule[]>([]);
  const [doneSms, setDoneSms] = useState<SheetRow[]>([]);
  const [smsSyncSettings, setSmsSyncSettings] = useState<SmsSyncSettings>({ autoReloadEnabled: true, reloadInterval: 60 });
  const { autoReloadEnabled, reloadInterval } = smsSyncSettings;

  const defaultVia = useMemo(() => appSettings?.businessProfiles?.[0]?.name || '', [appSettings]);
  const defaultAccountId = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.find(a => a.name.toLowerCase() === 'cash')?.id || accounts[0].id;
    }
    return '';
  }, [accounts]);

  const transactionForm = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      date: new Date(),
      description: '',
      accountId: defaultAccountId,
      type: 'spent',
      partyId: 'none',
      via: defaultVia,
      amount: '' as any, // Initialize with empty string for controlled component
      charge: 0,
      chargeVia: defaultVia,
    },
  });
  
  const transactionType = transactionForm.watch('type');
  const selectedPartyId = transactionForm.watch('partyId');
  const descriptionValue = transactionForm.watch('description');
  const viaValue = transactionForm.watch('via');
  
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selectedBookForAdd, setSelectedBookForAdd] = useState('');
  const [sendSms, setSendSms] = useState(true);

  const [activeTab, setActiveTab] = useState("transaction");
  const [smsData, setSmsData] = useState<SheetRow[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  const [newSmsIds, setNewSmsIds] = useState<Set<string>>(new Set());

  
  const [isBlocklistOpen, setIsBlocklistOpen] = useState(false);
  const [newBlockRule, setNewBlockRule] = useState<Omit<SmsBlocklistRule, 'id'>>({ type: 'contains', value: '' });

  const [selectedSms, setSelectedSms] = useState<Set<string>>(new Set());
  
  useEffect(() => {
    const unsub = subscribeToAppSettings((settings) => {
      setAppSettings(settings);
      setBlocklistRules(settings?.smsBlocklist || []);
      setDoneSms(settings?.doneSms || []);
      if (settings?.smsSyncSettings) {
        setSmsSyncSettings(settings.smsSyncSettings);
      }
    }, (error) => toast({ variant: 'destructive', title: 'Could not load settings', description: error.message }));

    return () => unsub();
  }, [toast]);


  const transactionAmount = transactionForm.watch('amount');
  const transactionAccountId = transactionForm.watch('accountId');

    const placeholderText = useMemo(() => {
        switch(transactionType) {
            case 'sale':
            case 'credit_sale':
                return 'e.g., Sold goods to...';
            case 'purchase':
            case 'credit_purchase':
                return 'e.g., Purchased items from...';
            case 'income':
            case 'credit_income':
                return 'e.g., Received rent...';
            case 'spent':
                return 'e.g., Office supplies or - for charges';
            case 'give':
                return 'e.g., Paid to supplier';
            case 'receive':
                return 'e.g., Payment from customer';
            default:
                return 'e.g., Transaction details...';
        }
    }, [transactionType]);

  const expenseSuggestions = useMemo(() => {
    if (!descriptionValue || !appSettings?.expenseBooks) return [];
    
    const lowerCaseDesc = descriptionValue.toLowerCase();
    const suggestions: (ExpenseCategory & { bookType: ExpenseBook['type'] })[] = [];

    for (const book of appSettings.expenseBooks) {
        const viaMatch = !book.via || book.via === 'all' || book.via === viaValue;

        if (viaMatch) {
            for (const category of book.categories) {
                if (category.name.toLowerCase().includes(lowerCaseDesc)) {
                    suggestions.push({ ...category, bookType: book.type });
                }
            }
        }
    }
    return suggestions;
  }, [descriptionValue, appSettings?.expenseBooks, viaValue]);

  const chargeRuleSuggestions = useMemo(() => {
      if (!descriptionValue?.includes('-')) return [];
      if (!transactionAccountId) return [];
      const account = accounts.find(acc => acc.id === transactionAccountId);
      if (!account || !account.chargeRules) return [];
      
      const searchTerm = descriptionValue.split('-').pop()?.trim().toLowerCase() || '';

      return account.chargeRules.filter(rule => rule.name.toLowerCase().includes(searchTerm));
  }, [descriptionValue, transactionAccountId, accounts]);


  useEffect(() => {
    if (['credit_sale', 'credit_purchase', 'credit_give', 'credit_income'].includes(transactionType)) {
      transactionForm.setValue('accountId', undefined);
    } else {
      if (!transactionForm.getValues('accountId')) {
        transactionForm.setValue('accountId', defaultAccountId);
      }
    }
  }, [transactionType, transactionForm, defaultAccountId]);
  
  const applyChargeRule = (rule: ChargeRule) => {
    if (!rule) return;
    
    let chargeAmount = 0;
    const amount = transactionForm.getValues('amount') || 0;
    
    if (rule.calculation === 'fixed') {
        chargeAmount = rule.value;
    } else if (rule.calculation === 'percentage' && amount > 0) {
        chargeAmount = (amount * rule.value) / 100;
    }
    
    transactionForm.setValue('description', rule.name);
    transactionForm.setValue('charge', parseFloat(chargeAmount.toFixed(2)));
    if (rule.transactionType) {
        transactionForm.setValue('type', rule.transactionType);
    }
    
    setShowSuggestions(false);
  };

  useEffect(() => {
      const selectedParty = parties.find(p => p.id === selectedPartyId);
      const newVia = selectedParty?.group as TransactionVia || defaultVia;
      if (newVia !== transactionForm.getValues('via')) {
          transactionForm.setValue('via', newVia, { shouldValidate: true });
      }
  }, [selectedPartyId, parties, transactionForm, defaultVia]);

  useEffect(() => {
    transactionForm.setValue('chargeVia', viaValue);
  }, [viaValue, transactionForm]);
  
  useEffect(() => {
    if (defaultAccountId) {
      transactionForm.setValue('accountId', defaultAccountId);
    }
  }, [defaultAccountId, transactionForm]);

  const transferForm = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: {
      date: new Date(),
      fromAccountId: '',
      toAccountId: '',
      amount: '' as any, // Initialize with empty string
      charge: 0,
      chargeVia: defaultVia
    }
  });
  
  const { watch: watchTransfer, setValue: setTransferValue } = transferForm;
  const transferDesc = watchTransfer('description');
  const transferAmount = watchTransfer('amount');
  const fromAccountId = watchTransfer('fromAccountId');

  useEffect(() => {
    if (!transferDesc || !accounts.length || !fromAccountId) return;
    
    const fromAccount = accounts.find(acc => acc.id === fromAccountId);
    if (!fromAccount || !fromAccount.chargeRules) return;

    const lowerCaseDesc = transferDesc.toLowerCase();
    const matchedRule = fromAccount.chargeRules.find(rule => lowerCaseDesc.includes(rule.name.toLowerCase()));
    
    if (matchedRule) {
      let chargeAmount = 0;
      if (matchedRule.calculation === 'fixed') {
        chargeAmount = matchedRule.value;
      } else if (matchedRule.calculation === 'percentage' && transferAmount > 0) {
        chargeAmount = (transferAmount * matchedRule.value) / 100;
      }
      setTransferValue('charge', parseFloat(chargeAmount.toFixed(2)));
    } else {
      setTransferValue('charge', 0);
    }
  }, [transferDesc, transferAmount, fromAccountId, accounts, setTransferValue]);

const onTransactionSubmit = (data: TransactionFormValues, mode: 'saveAndClose' | 'saveAndNext') => {
    // Balance Check
    if (['spent', 'give'].includes(data.type) && data.accountId) {
        const account = accounts.find(a => a.id === data.accountId);
        if (account && account.name.toLowerCase() !== 'cash') {
            if (account.balance <= 0 || account.balance < data.amount) {
                toast({
                    variant: 'destructive',
                    title: 'Insufficient Balance',
                    description: `The selected account "${account.name}" has insufficient funds for this transaction.`,
                });
                return;
            }
        }
    }
    const transactionsToCreate: Omit<Transaction, 'id' | 'enabled'>[] = [];
    
    const mainTransactionData: Partial<TransactionFormValues & { sendSms: boolean }> = {
        ...data,
        partyId: data.partyId === 'none' ? undefined : data.partyId,
        sendSms: sendSms
    };
    
    if (['credit_sale', 'credit_purchase', 'credit_give', 'credit_income'].includes(mainTransactionData.type!)) {
        mainTransactionData.accountId = undefined;
    }

    transactionsToCreate.push(mainTransactionData as Omit<Transaction, 'id' | 'enabled'>);

    if (data.charge && data.charge > 0) {
        const chargeTx: Omit<Transaction, 'id'|'enabled'> = {
            date: formatFns(data.date, 'yyyy-MM-dd'),
            amount: data.charge,
            type: 'spent',
            accountId: data.accountId,
            description: `Charge for: ${data.description}`,
            via: data.chargeVia || data.via,
        };
        transactionsToCreate.push(chargeTx);
    }
    
    onAddTransaction(transactionsToCreate.map(tx => ({...tx, date: formatFns(data.date, 'yyyy-MM-dd')})), mode);
    
    transactionForm.reset({
      date: new Date(),
      description: '',
      amount: '' as any,
      accountId: defaultAccountId,
      type: 'spent',
      partyId: 'none',
      via: defaultVia,
      charge: 0,
      chargeVia: defaultVia
    });
  };
  
  const onTransferSubmit = async (data: TransferFormValues) => {
    // Balance Check
    const fromAccount = accounts.find(a => a.id === data.fromAccountId);
    if (fromAccount && fromAccount.name.toLowerCase() !== 'cash') {
        if (fromAccount.balance <= 0 || fromAccount.balance < data.amount) {
            toast({
                variant: 'destructive',
                title: 'Insufficient Balance',
                description: `The "From" account "${fromAccount.name}" has insufficient funds for this transfer.`,
            });
            return;
        }
    }
    try {
        const transactionsToCreate: Omit<Transaction, 'id' | 'enabled'>[] = [];

        // Main transfer transaction
        const transferTransaction: Omit<Transaction, 'id' | 'enabled'> = {
            date: formatFns(data.date, 'yyyy-MM-dd'),
            amount: data.amount,
            type: 'transfer',
            fromAccountId: data.fromAccountId,
            toAccountId: data.toAccountId,
            description: data.description || `Transfer from ${accounts.find(a=>a.id===data.fromAccountId)?.name} to ${accounts.find(a=>a.id===data.toAccountId)?.name}`,
        };
        transactionsToCreate.push(transferTransaction);

        // Optional charge transaction
        if (data.charge && data.charge > 0) {
            const fromAccount = accounts.find(acc => acc.id === data.fromAccountId);
            const matchedRule = fromAccount?.chargeRules?.find(rule => (data.description || '').toLowerCase().includes(rule.name.toLowerCase()));
            const chargeType = matchedRule?.transactionType || (matchedRule?.type === 'income' ? 'income' : 'spent');

            const chargeTransaction: Omit<Transaction, 'id' | 'enabled'> = {
                date: formatFns(data.date, 'yyyy-MM-dd'),
                amount: data.charge,
                type: chargeType,
                accountId: data.fromAccountId, // Charge is deducted from the 'from' account
                description: `Charge for transfer to ${accounts.find(a=>a.id===data.toAccountId)?.name}`,
                via: data.chargeVia,
            };
            transactionsToCreate.push(chargeTransaction);
        }

        onAddTransaction(transactionsToCreate, 'saveAndClose');

        toast({ title: 'Success', description: 'Transfer completed successfully.'});
        transferForm.reset({
            date: new Date(),
            amount: '' as any,
            fromAccountId: '',
            toAccountId: '',
            description: '',
            charge: 0,
            chargeVia: defaultVia
        });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Transfer Error', description: error.message });
    }
  }
  
  const handleQuickAdd = async () => {
    if (!newCategoryName || !selectedBookForAdd) {
        toast({ variant: 'destructive', title: 'Error', description: 'Please provide a name and select a book.' });
        return;
    }
    try {
        await addExpenseCategoryToBook(selectedBookForAdd, newCategoryName);
        transactionForm.setValue('description', newCategoryName);
        toast({ title: 'Success', description: `Added "${newCategoryName}" to your expense book.` });
        setIsQuickAddOpen(false);
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };

  const handleFetchSms = useCallback(async () => {
    setSmsLoading(true);
    setNewSmsIds(new Set());
    try {
        const newData = await fetchSheetData();
        setSmsData(prevData => {
            const existingIds = new Set(prevData.map(d => `${d.date}-${d.message}`));
            const newlyFetched = newData.filter(d => !existingIds.has(`${d.date}-${d.message}`));
            
            if (newlyFetched.length > 0) {
                setNewSmsIds(new Set(newlyFetched.map(d => `${d.date}-${d.message}`)));
            }
            return newData; // Replace with fresh data
        });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Failed to fetch SMS', description: error.message });
    } finally {
        setSmsLoading(false);
    }
  }, [toast]);
  
  // Auto-reload effect
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (autoReloadEnabled && reloadInterval > 0) {
        intervalId = setInterval(handleFetchSms, reloadInterval * 1000);
    }
    return () => {
        if (intervalId) clearInterval(intervalId);
    };
  }, [autoReloadEnabled, reloadInterval, handleFetchSms]);

    
    const handleConvertToEntry = (sms: SheetRow, targetTab: 'transaction' | 'transfer') => {
        const amountRegex = /(?:Tk|Taka|BDT|Rs|৳)\.?\s*([0-9,]+(?:\.[0-9]+)?)|([0-9,]+(?:\.[0-9]+)?)\s*(?:Tk|Taka|BDT|Rs|৳)/i;
        const match = sms.message.match(amountRegex);
                
        let amount = 0;
        if (match) {
            const amountStr = match[1] || match[2];
            if (amountStr) {
                amount = parseFloat(amountStr.replace(/,/g, ''));
            }
        }
                
        const parseDateFromSmsMessage = (smsDateStr: string, smsMessage: string): Date => {
            let date = smsDateStr ? new Date(smsDateStr) : new Date();
            const genericDateRegex = /(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})/;
            const genericMatch = smsMessage.match(genericDateRegex);
            const monthNameRegex = /(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)-(\d{2,4})/i;
            const monthNameMatch = smsMessage.match(monthNameRegex);
            if (genericMatch) {
                const day = parseInt(genericMatch[1], 10);
                const month = parseInt(genericMatch[2], 10);
                let year = parseInt(genericMatch[3], 10);
                if (year < 100) { year += 2000; }
                if (!isNaN(day) && !isNaN(month) && !isNaN(year) && month > 0 && month <= 12 && day > 0 && day <= 31) {
                    const parsedDate = new Date(year, month - 1, day);
                    if (!isNaN(parsedDate.getTime())) return parsedDate;
                }
            } else if (monthNameMatch) {
                const parsedDate = new Date(monthNameMatch[0]);
                if (!isNaN(parsedDate.getTime())) return parsedDate;
            }
            return date;
        };

        const smsDate = parseDateFromSmsMessage(sms.date, sms.message);

        if (targetTab === 'transaction') {
            transactionForm.setValue('amount', amount);
            transactionForm.setValue('description', `From ${sms.name}: ${sms.message}`);
            transactionForm.setValue('date', smsDate);
        } else { // transfer
            transferForm.setValue('amount', amount);
            transferForm.setValue('description', `From ${sms.name}: ${sms.message}`);
            transferForm.setValue('date', smsDate);
        }
                
        handleDoneSms(sms);
        setActiveTab(targetTab);
    };
    
    const renderMessageWithClickableAmounts = (message: string) => {
        const splitRegex = /((?:Tk|Taka|BDT|Rs|৳)\.?\s*[0-9,]+(?:\.[0-9]+)?|[0-9,]+(?:\.[0-9]+)?\s*(?:Tk|Taka|BDT|Rs|৳))/gi;
        
        const parts = message.split(splitRegex);
        
        return parts.map((part, index) => {
            if (index % 2 === 1) {
                const amountMatch = part.match(/([0-9,]+(?:\.[0-9]+)?)/);
                const amountVal = amountMatch ? parseFloat(amountMatch[0].replace(/,/g, '')) : 0;
                
                return (
                    <button
                        key={index}
                        type="button"
                        className="underline text-primary font-bold hover:text-primary/80 mx-1"
                        onClick={() => {
                            transactionForm.setValue('amount', amountVal);
                            transactionForm.setValue('description', `From SMSTrnx: ${message}`);
                            setActiveTab('transaction');
                        }}
                    >
                        {part}
                    </button>
                );
            }
            return <React.Fragment key={index}>{part}</React.Fragment>;
        });
    };


    const handleSaveBlocklist = async () => {
        if (!appSettings) return;
        try {
            await saveAppSettings({ smsBlocklist: blocklistRules });
            toast({ title: 'Blocklist saved successfully.' });
            setIsBlocklistOpen(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error saving blocklist', description: error.message });
        }
    }
    const handleAddBlockRule = async () => {
        if (!newBlockRule.value.trim()) return;
        const newRule = { ...newBlockRule, id: `block-${Date.now()}`};
        try {
            await addSmsBlockRule(newRule);
            setNewBlockRule({ type: 'contains', value: '' });
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Could not add rule' });
        }
    }
    const handleRemoveBlockRule = async (id: string) => {
        try {
            await removeSmsBlockRule(id);
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Could not remove rule' });
        }
    }
    
    const { filteredSmsData, blockedSmsData } = useMemo(() => {
        const isSmsInDone = (sms: SheetRow) => doneSms.some(done => done.date === sms.date && done.message === sms.message);
        
        const blocked: SheetRow[] = [];
        const filtered: SheetRow[] = [];
    
        smsData.forEach(sms => {
            if (isSmsInDone(sms)) return;

            let isBlocked = false;
            for (const rule of blocklistRules) {
                const messageLower = sms.message.toLowerCase();
                const senderLower = (sms.name || '').trim().toLowerCase().trim();
                const valueLower = rule.value.toLowerCase().trim();

                if (valueLower === '') continue;
                let ruleMatched = false;

                switch (rule.type) {
                    case 'sender':
                        if (senderLower.includes(valueLower)) ruleMatched = true;
                        break;
                    case 'exact':
                        if (messageLower === valueLower) ruleMatched = true;
                        break;
                    case 'contains':
                        if (messageLower.includes(valueLower)) ruleMatched = true;
                        break;
                    case 'startsWith':
                        if (messageLower.startsWith(valueLower)) ruleMatched = true;
                        break;
                }
                if (ruleMatched) {
                    isBlocked = true;
                    break;
                }
            }

            if (isBlocked) {
                blocked.push(sms);
            } else {
                filtered.push(sms);
            }
        });
        
        return { 
            filteredSmsData: filtered.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
            blockedSmsData: blocked.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        };
    }, [smsData, blocklistRules, doneSms]);
    
    const handleDoneSms = async (sms: SheetRow) => {
        try {
            await addSmsToDoneList(sms);
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not mark as done.' });
        }
    };
    
    const handleUndoDoneSms = async (sms: SheetRow) => {
        try {
            await removeSmsFromDoneList(sms);
        } catch(e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not undo.' });
        }
    }
    
    const handleUnblockSender = async (senderName: string) => {
        const ruleToUnblock = blocklistRules.find(r => r.type === 'sender' && r.value === senderName);
        if (ruleToUnblock) {
            try {
                await removeSmsBlockRule(ruleToUnblock.id);
                toast({ title: 'Sender Unblocked' });
            } catch(e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not unblock sender.' });
            }
        }
    }

    const handleBlockSender = async (senderName: string) => {
        if (!senderName) return;
        const newRule: Omit<SmsBlocklistRule, 'id'> = { type: 'sender', value: senderName };
        try {
            await addSmsBlockRule(newRule);
            toast({ title: 'Sender Blocked', description: `Messages from "${senderName}" will now be hidden.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error saving blocklist', description: e.message });
        }
    }

    const handleSelectAllSms = (checked: boolean) => {
        if (checked) {
            setSelectedSms(new Set(filteredSmsData.map(sms => `${sms.date}-${sms.message}`)));
        } else {
            setSelectedSms(new Set());
        }
    };
    
    const handleSmsSelection = (sms: SheetRow, checked: boolean) => {
        const smsId = `${sms.date}-${sms.message}`;
        setSelectedSms(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(smsId);
            } else {
                newSet.delete(smsId);
            }
            return newSet;
        });
    };
    
    const handleBulkDone = async () => {
        const smsToMove = smsData.filter(sms => selectedSms.has(`${sms.date}-${sms.message}`));
        for (const sms of smsToMove) {
            await addSmsToDoneList(sms);
        }
        setSelectedSms(new Set());
    };
    
    const handleBulkBlock = async () => {
        const sendersToBlock = new Set<string>();
        smsData.forEach(sms => {
            if (selectedSms.has(`${sms.date}-${sms.message}`)) {
                if (sms.name) sendersToBlock.add(sms.name);
            }
        });
    
        const promises = Array.from(sendersToBlock).map(sender => addSmsBlockRule({ type: 'sender', value: sender }));
        
        try {
            await Promise.all(promises);
            toast({ title: 'Senders Blocked', description: `${promises.length} senders have been added to the blocklist.` });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error saving blocklist', description: e.message });
        }
        
        setSelectedSms(new Set());
    };

    const handleUiSettingsChange = (updates: Partial<SmsSyncSettings>) => {
        const newSyncSettings = { ...smsSyncSettings, ...updates };
        const newSettings = { ...appSettings!, smsSyncSettings: newSyncSettings };
        setAppSettings(newSettings);
        saveAppSettings(newSettings); // Persist to DB
    }


  return (
    <>
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Add Quick Description</DialogTitle>
                <DialogDescription>Save "{newCategoryName}" to an expense book for future use.</DialogDescription>
            </DialogHeader>
            <div className="space-y-2 py-4">
                <Label>Select Expense Book</Label>
                <Select value={selectedBookForAdd} onValueChange={setSelectedBookForAdd}>
                    <SelectTrigger>
                        <SelectValue placeholder="Select a book..." />
                    </SelectTrigger>
                    <SelectContent>
                        {appSettings?.expenseBooks?.map(book => (
                            <SelectItem key={book.id} value={book.id}>{book.name} ({book.type})</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                <Button onClick={handleQuickAdd}>Add Category</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={isBlocklistOpen} onOpenChange={setIsBlocklistOpen}>
          <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>Manage SMS Blocklist</DialogTitle></DialogHeader>
              <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="flex gap-2 items-end">
                      <div className="flex-grow space-y-1">
                          <Label>Rule Value</Label>
                          <Input value={newBlockRule.value} onChange={(e) => setNewBlockRule(r => ({...r, value: e.target.value}))} placeholder="Text or sender to block..." />
                      </div>
                      <div className="space-y-1">
                           <Label>Rule Type</Label>
                           <Select value={newBlockRule.type} onValueChange={(v) => setNewBlockRule(r => ({...r, type: v as any}))}>
                                <SelectTrigger className="w-[150px]"><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="sender">Sender</SelectItem>
                                    <SelectItem value="contains">Contains</SelectItem>
                                    <SelectItem value="exact">Exact Match</SelectItem>
                                    <SelectItem value="startsWith">Starts With</SelectItem>
                                </SelectContent>
                           </Select>
                      </div>
                      <Button onClick={handleAddBlockRule}>Add Rule</Button>
                  </div>
                  <div className="space-y-2">
                    {blocklistRules.map(rule => (
                        <div key={rule.id} className="flex items-center justify-between p-2 border rounded-md">
                            <div>
                                <Badge variant="secondary">{rule.type}</Badge>
                                <p className="font-mono text-sm ml-2">{rule.value}</p>
                            </div>
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveBlockRule(rule.id)}>
                                <Trash2 className="h-4 w-4 text-destructive"/>
                            </Button>
                        </div>
                    ))}
                  </div>
              </div>
              <DialogFooter>
                  <DialogClose asChild><Button variant="ghost">Close</Button></DialogClose>
                  {/* Save is now handled per action, no need for global save button here */}
              </DialogFooter>
          </DialogContent>
      </Dialog>
      <Card className="mb-8 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader>
                  <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="transaction">Transaction</TabsTrigger>
                      <TabsTrigger value="transfer"><ArrowRightLeft className="mr-2 h-4 w-4"/>Transfer</TabsTrigger>
                      <TabsTrigger value="sms">SMS to Trnx</TabsTrigger>
                  </TabsList>
              </CardHeader>
              <TabsContent value="transaction">
                  <form>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label htmlFor="amount">Amount</Label>
                            <Input id="amount" type="number" step="0.01" placeholder="0.00" {...transactionForm.register('amount')} onFocus={(e) => e.target.select()} />
                            {transactionForm.formState.errors.amount && <p className="text-red-500 text-xs mt-1">{transactionForm.formState.errors.amount.message}</p>}
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="date">Date</Label>
                            <Controller control={transactionForm.control} name="date" render={({ field }) => ( <DatePicker value={field.value} onChange={(date) => field.onChange(date as Date)} /> )}/>
                            {transactionForm.formState.errors.date && <p className="text-red-500 text-xs mt-1">{transactionForm.formState.errors.date.message}</p>}
                          </div>
                        </div>

                         <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                           <div className="space-y-2">
                              <Label>Type</Label>
                              <Controller control={transactionForm.control} name="type" render={({ field }) => (
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                                    <SelectContent>{transactionTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.icon} {opt.label}</SelectItem>)}</SelectContent>
                                  </Select>
                              )} />
                          </div>
                          {!['credit_sale', 'credit_purchase', 'credit_give', 'credit_income'].includes(transactionType) && (
                            <div className="space-y-2">
                                <Label>Account</Label>
                                <Controller control={transactionForm.control} name="accountId" render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                                      <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                )} />
                                {transactionForm.formState.errors.accountId && <p className="text-red-500 text-xs mt-1">{transactionForm.formState.errors.accountId.message}</p>}
                            </div>
                          )}
                        </div>

                        <div className="space-y-2 relative">
                            <Label htmlFor="description">Description</Label>
                            <Input id="description" placeholder={placeholderText} {...transactionForm.register('description')} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)} autoComplete="off" />
                            {showSuggestions && (
                              <div className="absolute z-10 w-full bg-background border rounded-md shadow-lg mt-1 max-h-60 overflow-y-auto">
                                <Command>
                                    <CommandList>
                                      <CommandEmpty>No matching suggestions.</CommandEmpty>
                                      {chargeRuleSuggestions.length > 0 ? (
                                           <CommandGroup heading="Charge Rules">
                                            {chargeRuleSuggestions.map((rule) => (
                                                <CommandItem key={rule.name} onSelect={() => applyChargeRule(rule)}>
                                                {rule.name}
                                                </CommandItem>
                                            ))}
                                            </CommandGroup>
                                      ) : (
                                        <>
                                            <CommandGroup heading="Suggestions">
                                            {expenseSuggestions.map((suggestion) => (
                                            <CommandItem
                                                key={suggestion.id}
                                                onSelect={() => {
                                                transactionForm.setValue('description', suggestion.name);
                                                transactionForm.setValue('type', suggestion.bookType);
                                                setShowSuggestions(false);
                                                }}
                                            >
                                                {suggestion.name}
                                            </CommandItem>
                                            ))}
                                            </CommandGroup>
                                            {descriptionValue && !expenseSuggestions.some(s => s.name.toLowerCase() === descriptionValue.toLowerCase()) && (
                                                <CommandItem
                                                    onSelect={() => {
                                                        setNewCategoryName(descriptionValue);
                                                        setSelectedBookForAdd(appSettings?.expenseBooks?.[0]?.id || '');
                                                        setIsQuickAddOpen(true);
                                                        setShowSuggestions(false);
                                                    }}
                                                    className="text-primary"
                                                >
                                                    <Plus className="mr-2 h-4 w-4" /> Add "{descriptionValue}" as a new category...
                                                </CommandItem>
                                            )}
                                        </>
                                      )}
                                    </CommandList>
                                </Command>
                              </div>
                            )}
                            {transactionForm.formState.errors.description && <p className="text-red-500 text-xs mt-1">{transactionForm.formState.errors.description.message}</p>}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Party</Label>
                            <Controller control={transactionForm.control} name="partyId" render={({ field }) => ( <PartyCombobox parties={parties} value={field.value} onChange={field.onChange} /> )} />
                          </div>
                          <div className="space-y-2">
                            <Label>Transaction Via</Label>
                            <Controller control={transactionForm.control} name="via" render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <SelectTrigger><SelectValue placeholder="Select via..." /></SelectTrigger>
                                  <SelectContent>{(appSettings?.businessProfiles || []).map(opt => <SelectItem key={opt.name} value={opt.name}>{opt.name}</SelectItem>)}</SelectContent>
                                </Select>
                            )} />
                          </div>
                        </div>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                            <div className="space-y-2">
                                <Label htmlFor="charge">Charge</Label>
                                 <Input id="charge" type="number" step="0.01" placeholder="0.00" {...transactionForm.register('charge')} onFocus={(e) => e.target.select()} />
                            </div>
                            <div className="space-y-2">
                                <Label>Charge to Profile (Via)</Label>
                                <Controller control={transactionForm.control} name="chargeVia" render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger><SelectValue placeholder="Select via..." /></SelectTrigger>
                                      <SelectContent>
                                          {(appSettings?.businessProfiles || []).map(opt => <SelectItem key={opt.name} value={opt.name}>{opt.name}</SelectItem>)}
                                      </SelectContent>
                                    </Select>
                                )} />
                            </div>
                        </div>
                      </CardContent>
                      <CardFooter className="flex-col sm:flex-row gap-2 justify-between">
                            <div className="flex items-center space-x-2">
                                <Switch id="send-sms" checked={sendSms} onCheckedChange={setSendSms}/>
                                <Label htmlFor="send-sms">Send SMS Notification</Label>
                            </div>
                          <div className="flex gap-2">
                              <Button type="button" onClick={transactionForm.handleSubmit(data => onTransactionSubmit(data, 'saveAndNext'))} className="w-full sm:w-auto">
                                  <Plus className="mr-2 h-4 w-4" /> Save & Next
                              </Button>
                              <Button type="button" onClick={transactionForm.handleSubmit(data => onTransactionSubmit(data, 'saveAndClose'))} className="w-full sm:w-auto" variant="secondary">
                                  <Save className="mr-2 h-4 w-4" /> Save & Close
                              </Button>
                          </div>
                      </CardFooter>
                  </form>
              </TabsContent>
              <TabsContent value="transfer">
                  <form onSubmit={transferForm.handleSubmit(onTransferSubmit)}>
                      <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <Label htmlFor="transfer-amount">Amount</Label>
                                  <Input id="transfer-amount" type="number" step="0.01" placeholder="0.00" {...transferForm.register('amount')} onFocus={(e) => e.target.select()} />
                                  {transferForm.formState.errors.amount && <p className="text-red-500 text-xs mt-1">{transferForm.formState.errors.amount.message}</p>}
                              </div>
                              <div className="space-y-2">
                                  <Label htmlFor="transfer-date">Date</Label>
                                  <Controller
                                      control={transferForm.control}
                                      name="date"
                                      render={({ field }) => (
                                          <DatePicker 
                                              value={field.value}
                                              onChange={(date) => field.onChange(date as Date)}
                                          />
                                      )}
                                  />
                                  {transferForm.formState.errors.date && <p className="text-red-500 text-xs mt-1">{transferForm.formState.errors.date.message}</p>}
                              </div>
                          </div>
                          <div className="space-y-2">
                                <Label htmlFor="transfer-description">Description (Optional)</Label>
                                <Input id="transfer-description" placeholder="e.g., Office expense or - for charges" {...transferForm.register('description')} />
                            </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <Label>From Account</Label>
                                  <Controller
                                  control={transferForm.control}
                                  name="fromAccountId"
                                  render={({ field }) => (
                                      <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                                      <SelectContent>
                                          {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatAmount(acc.balance)})</SelectItem>)}
                                      </SelectContent>
                                      </Select>
                                  )}
                                  />
                                  {transferForm.formState.errors.fromAccountId && <p className="text-red-500 text-xs mt-1">{transferForm.formState.errors.fromAccountId.message}</p>}
                              </div>
                              <div className="space-y-2">
                                  <Label>To Account</Label>
                                  <Controller
                                  control={transferForm.control}
                                  name="toAccountId"
                                  render={({ field }) => (
                                      <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                                      <SelectContent>
                                          {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name} ({formatAmount(acc.balance)})</SelectItem>)}
                                      </SelectContent>
                                      </Select>
                                  )}
                                  />
                                  {transferForm.formState.errors.toAccountId && <p className="text-red-500 text-xs mt-1">{transferForm.formState.errors.toAccountId.message}</p>}
                              </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-2">
                                  <Label htmlFor="transfer-charge">Charge</Label>
                                    <Input 
                                      id="transfer-charge" 
                                      type="number" 
                                      step="0.01" 
                                      placeholder="0.00" 
                                      {...transferForm.register('charge')} 
                                      onFocus={(e) => e.target.select()} 
                                  />
                              </div>
                              <div className="space-y-2">
                                  <Label>Charge to Profile (Via)</Label>
                                  <Controller
                                  control={transferForm.control}
                                  name="chargeVia"
                                  render={({ field }) => (
                                      <Select onValueChange={field.onChange} value={field.value}>
                                      <SelectTrigger><SelectValue placeholder="Select via..." /></SelectTrigger>
                                      <SelectContent>
                                          {(appSettings?.businessProfiles || []).map(opt => <SelectItem key={opt.name} value={opt.name}>{opt.name}</SelectItem>)}
                                      </SelectContent>
                                      </Select>
                                  )}
                                  />
                              </div>
                          </div>
                      </CardContent>
                      <CardFooter>
                          <Button type="submit" className="w-full">
                              <ArrowRightLeft className="mr-2 h-4 w-4" /> Confirm Transfer
                          </Button>
                      </CardFooter>
                  </form>
              </TabsContent>
              <TabsContent value="sms">
                <CardContent>
                    <div className="flex justify-between items-center mb-2">
                        <div/>
                        <div className="flex items-center gap-2">
                            <Switch id="auto-reload-switch" checked={autoReloadEnabled} onCheckedChange={(c) => handleUiSettingsChange({ autoReloadEnabled: c })} />
                            <Label htmlFor="auto-reload-switch">Auto Reload</Label>
                            <Input type="number" value={reloadInterval} onChange={e => handleUiSettingsChange({ reloadInterval: parseInt(e.target.value, 10) || 60 })} className="w-16 h-8" disabled={!autoReloadEnabled} />
                            <Label>sec</Label>
                            <Button variant="outline" onClick={() => setIsBlocklistOpen(true)}><ListFilter className="mr-2 h-4 w-4" /> Blocklist</Button>
                            <Button onClick={handleFetchSms} disabled={smsLoading}>
                                {smsLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                                Refresh SMS
                            </Button>
                        </div>
                    </div>
                     <Tabs defaultValue="inbox">
                        <TabsList className="grid w-full grid-cols-3">
                            <TabsTrigger value="inbox">Inbox ({filteredSmsData.length})</TabsTrigger>
                            <TabsTrigger value="done">Done ({doneSms.length})</TabsTrigger>
                            <TabsTrigger value="blocked">Blocked ({blockedSmsData.length})</TabsTrigger>
                        </TabsList>
                        {selectedSms.size > 0 && (
                            <div className="p-2 bg-muted rounded-md my-2 flex items-center justify-between">
                                <Label>{selectedSms.size} selected</Label>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="secondary" onClick={handleBulkDone}>Mark as Done</Button>
                                    <Button size="sm" variant="destructive" onClick={handleBulkBlock}>Block Senders</Button>
                                </div>
                            </div>
                        )}
                        <TabsContent value="inbox">
                            <div className="rounded-md border overflow-x-auto max-h-[50vh] mt-4">
                                <Table>
                                <TableHeader>
                                    <TableRow>
                                    <TableHead><Checkbox checked={filteredSmsData.length > 0 && selectedSms.size === filteredSmsData.length} onCheckedChange={(checked) => handleSelectAllSms(!!checked)} /></TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Sender</TableHead>
                                    <TableHead>Message</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {smsLoading ? (
                                        <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin" /></TableCell></TableRow>
                                    ) : filteredSmsData.length > 0 ? (
                                        filteredSmsData.map((row, index) => {
                                            const smsId = `${row.date}-${row.message}`;
                                            return (
                                            <TableRow key={index} className={cn(newSmsIds.has(smsId) && 'bg-yellow-100 dark:bg-yellow-900/20')}>
                                                <TableCell><Checkbox checked={selectedSms.has(smsId)} onCheckedChange={(checked) => handleSmsSelection(row, !!checked)} /></TableCell>
                                                <TableCell>{row.date}</TableCell>
                                                <TableCell>{row.name}</TableCell>
                                                <TableCell className="whitespace-pre-wrap break-words">{renderMessageWithClickableAmounts(row.message)}</TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    <Button size="sm" onClick={() => handleConvertToEntry(row, 'transaction')}>Make Entry</Button>
                                                    <Button size="sm" variant="outline" onClick={() => handleConvertToEntry(row, 'transfer')}>Make Transfer</Button>
                                                    <Button size="sm" variant="secondary" onClick={() => handleDoneSms(row)}>Done</Button>
                                                    <Button size="sm" variant="destructive" onClick={() => handleBlockSender(row.name)}>Block</Button>
                                                </TableCell>
                                            </TableRow>
                                        )})
                                    ) : (
                                        <TableRow><TableCell colSpan={5} className="h-24 text-center">No new SMS data found.</TableCell></TableRow>
                                    )}
                                </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                         <TabsContent value="done">
                            <div className="rounded-md border overflow-x-auto max-h-[50vh] mt-4">
                                <Table>
                                    <TableBody>
                                        {doneSms.length > 0 ? doneSms.map((row, index) => (
                                            <TableRow key={`sms-done-${index}`} className="bg-muted/30">
                                                <TableCell className="text-muted-foreground">{row.message}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="ghost" onClick={() => handleUndoDoneSms(row)}>Undo</Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={2} className="h-24 text-center">No completed SMS.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                         <TabsContent value="blocked">
                            <div className="rounded-md border overflow-x-auto max-h-[50vh] mt-4">
                                <Table>
                                    <TableBody>
                                        {blockedSmsData.length > 0 ? blockedSmsData.map((row, index) => (
                                            <TableRow key={`sms-blocked-${index}`} className="bg-destructive/10">
                                                <TableCell className="text-muted-foreground">{row.message}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="sm" variant="ghost" onClick={() => handleUnblockSender(row.name)}>Unblock</Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : <TableRow><TableCell colSpan={2} className="h-24 text-center">No blocked SMS.</TableCell></TableRow>}
                                    </TableBody>
                                </Table>
                            </div>
                        </TabsContent>
                  </Tabs>
                </CardContent>
              </TabsContent>
          </Tabs>
      </Card>
    </>
  );
}
