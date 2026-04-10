

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, Banknote, X, Copy, MoreVertical, Settings, ArrowRightLeft, RefreshCw, Save } from 'lucide-react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { subscribeToAccounts, addAccount, updateAccount, deleteAccount, subscribeToTransfers } from '@/services/accountService';
import { addTransaction, updateTransaction, deleteTransaction, recalculateBalancesFromTransaction } from '@/services/transactionService';
import type { Account, Transaction, ChargeRule, ReceivingNumber } from '@/types';
import { formatAmount, formatDate } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter as AlertDialogFooterComponent, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { DatePicker } from '@/components/ui/date-picker';
import ChargeRuleItem from '@/components/ChargeRuleItem';


const chargeRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  type: z.enum(['expense', 'income']),
  calculation: z.enum(['fixed', 'percentage']),
  value: z.coerce.number().min(0, "Value must be non-negative"),
});

const receivingNumberSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Sender name/identifier is required"),
  number: z.string().min(1, "Number is required"),
});

const accountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  balance: z.coerce.number().default(0),
  chargeRules: z.array(chargeRuleSchema).optional(),
  receivingNumbers: z.array(receivingNumberSchema).optional(),
});

export type AccountFormValues = z.infer<typeof accountSchema>;

const transferSchema = z.object({
    date: z.date(),
    amount: z.coerce.number().positive('Amount must be positive'),
    fromAccountId: z.string().min(1, "From account is required"),
    toAccountId: z.string().min(1, "To account is required"),
}).refine(data => data.fromAccountId !== data.toAccountId, {
    message: "From and To accounts cannot be the same",
    path: ["toAccountId"],
});

type TransferFormValues = z.infer<typeof transferSchema>;


export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transfers, setTransfers] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editingTransfer, setEditingTransfer] = useState<Transaction | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transferFilters, setTransferFilters] = useState({
    dateFrom: '',
    dateTo: '',
    fromAccountId: 'all',
    toAccountId: 'all',
  });
  const { toast } = useToast();

  const accountForm = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', balance: 0, chargeRules: [], receivingNumbers: [] },
  });
  
  const transferForm = useForm<TransferFormValues>({
    resolver: zodResolver(transferSchema),
    defaultValues: { date: new Date() }
  });

    const { fields: chargeFields, append: appendCharge, remove: removeCharge, replace: replaceCharge } = useFieldArray({
        control: accountForm.control,
        name: "chargeRules",
        keyName: "keyId",
    });

    const { fields: numberFields, append: appendNumber, remove: removeNumber, replace: replaceNumber } = useFieldArray({
      control: accountForm.control,
      name: "receivingNumbers",
      keyName: "keyId",
    });

  useEffect(() => {
    setLoading(true);
    const unsubscribeAccounts = subscribeToAccounts(setAccounts, (err) => {
      toast({ variant: 'destructive', title: 'Error fetching accounts', description: err.message });
      setLoading(false);
    });
    const unsubscribeTransfers = subscribeToTransfers(setTransfers, (err) => {
      toast({ variant: 'destructive', title: 'Error fetching transfers', description: err.message });
      setLoading(false);
    });
    
    const timer = setTimeout(() => setLoading(false), 800);

    return () => {
      unsubscribeAccounts();
      unsubscribeTransfers();
      clearTimeout(timer);
    };
  }, [toast]);
  
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + acc.balance, 0);
  }, [accounts]);
  
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      if (transferFilters.dateFrom && t.date < transferFilters.dateFrom) return false;
      if (transferFilters.dateTo && t.date > transferFilters.dateTo) return false;
      if (transferFilters.fromAccountId !== 'all' && t.fromAccountId !== transferFilters.fromAccountId) return false;
      if (transferFilters.toAccountId !== 'all' && t.toAccountId !== transferFilters.toAccountId) return false;
      return true;
    })
  }, [transfers, transferFilters]);

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    toast({ title: 'Recalculation Started', description: 'Recalculating all account balances. This may take a moment...' });
    try {
        await recalculateBalancesFromTransaction();
        toast({ title: 'Success!', description: 'All account balances have been recalculated and synced.' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Recalculation failed: ${error.message}` });
    } finally {
        setIsRecalculating(false);
    }
  };

    const handleAccountDialogClose = (open: boolean) => {
        if (open) {
          setIsDialogOpen(true);
          return;
        }

        if (!open && isDialogOpen) {
            setIsSaving(true);
            setTimeout(() => {
                setIsDialogOpen(false);
                accountForm.reset({ name: '', balance: 0, chargeRules: [], receivingNumbers: [] });
                removeCharge(Array.from({ length: chargeFields.length }, (_, i) => i));
                removeNumber(Array.from({ length: numberFields.length }, (_, i) => i));
                setEditingAccount(null);
                setDialogKey(prev => prev + 1);
                setIsSaving(false);
                document.body.style.pointerEvents = 'auto';
            }, 100);
        }
    };

  const handleAccountFormSubmit = async (data: AccountFormValues) => {
    setIsSaving(true);
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, { 
            name: data.name, 
            balance: data.balance,
            chargeRules: data.chargeRules, 
            receivingNumbers: data.receivingNumbers 
        });
        toast({ title: 'Success', description: 'Account updated successfully.' });
      } else {
        await addAccount({ 
            name: data.name, 
            balance: data.balance, 
            chargeRules: data.chargeRules, 
            receivingNumbers: data.receivingNumbers 
        });
        toast({ title: 'Success', description: 'Account added successfully.' });
      }
      handleAccountDialogClose(false);
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save account.' });
      setIsSaving(false);
    }
  };
  
   const handleTransferFormSubmit = async (data: TransferFormValues) => {
        if (!editingTransfer) return;
        try {
            await updateTransaction(editingTransfer.id, {
                date: data.date.toISOString().split('T')[0],
                amount: data.amount,
                fromAccountId: data.fromAccountId,
                toAccountId: data.toAccountId,
            });
            toast({ title: 'Success', description: 'Transfer updated successfully.' });
            setIsTransferDialogOpen(false);
            setEditingTransfer(null);
        } catch (error: any) {
            console.error("Failed to update transfer", error);
            toast({ variant: 'destructive', title: "Error", description: `Could not update transfer: ${error.message}` });
        }
    };


  const handleDeleteAccount = async (id: string) => {
    try {
      await deleteAccount(id);
      toast({ title: 'Success', description: 'Account deleted.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete account.' });
    }
  };
  
  const handleDeleteTransfer = async (id: string) => {
    try {
      await deleteTransaction(id);
      toast({ title: 'Success', description: 'Transfer deleted.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete transfer.' });
    }
  };

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    const safeChargeRules = (account.chargeRules || []).map(rule => ({
        ...rule,
        type: rule.type || 'expense',
        calculation: rule.calculation || 'fixed',
        value: rule.value || 0
    }));
    const safeReceivingNumbers = (account.receivingNumbers || []).map(num => ({
        ...num,
        id: num.id,
        name: num.name || '',
        number: num.number || ''
    }));

    accountForm.reset({ 
        name: account.name, 
        balance: account.balance, 
    });
    replaceCharge(safeChargeRules);
    replaceNumber(safeReceivingNumbers);
    setIsDialogOpen(true);
  };

  const openNewDialog = () => {
    setEditingAccount(null);
    accountForm.reset({ name: '', balance: 0, chargeRules: [], receivingNumbers: [] });
    replaceCharge([]);
    replaceNumber([]);
    setIsDialogOpen(true);
  };
  
  const openEditTransferDialog = (transfer: Transaction) => {
    setEditingTransfer(transfer);
    transferForm.reset({
        date: new Date(transfer.date),
        amount: transfer.amount,
        fromAccountId: transfer.fromAccountId || '',
        toAccountId: transfer.toAccountId || '',
    });
    setIsTransferDialogOpen(true);
  };
  
  const copyRuleToClipboard = (rule: ChargeRule) => {
      const ruleText = `Name: ${rule.name}, Type: ${rule.type}, Calc: ${rule.calculation}, Value: ${rule.value}`;
      navigator.clipboard.writeText(ruleText);
      toast({title: 'Copied!', description: 'Rule details copied to clipboard.'})
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <Banknote />
              Manage Accounts
            </h1>
            <p className="text-muted-foreground mt-1">
              Add, edit, and view your financial accounts and their rules.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleRecalculate} variant="outline" disabled={isRecalculating}>
                {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Recalculate Balances
            </Button>
            <Button onClick={openNewDialog}>
              <Plus className="mr-2 h-4 w-4" /> Add New Account
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="accounts">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="accounts">Accounts Overview</TabsTrigger>
            <TabsTrigger value="transfers">Transfer History</TabsTrigger>
          </TabsList>
          <TabsContent value="accounts">
             <Card>
                <CardContent className="pt-6">
                  {loading ? (
                    <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : (
                    <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Account Name</TableHead>
                          <TableHead>Receiving Numbers</TableHead>
                          <TableHead>Charge Rules</TableHead>
                          <TableHead className="text-right">Current Balance</TableHead>
                          <TableHead className="w-[50px] text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {accounts.map(account => (
                          <TableRow key={account.id} >
                            <TableCell className="font-medium">
                                <Link href={`/accounts/${account.id}`} className="hover:underline text-primary">
                                    {account.name}
                                </Link>
                            </TableCell>
                            <TableCell>
                               {account.receivingNumbers && account.receivingNumbers.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {account.receivingNumbers.map(num => (
                                        <Badge key={num.id} variant="secondary">
                                            {num.name}: {num.number}
                                        </Badge>
                                    ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {account.chargeRules && account.chargeRules.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                    {account.chargeRules.map(rule => (
                                         <TooltipProvider key={rule.name}>
                                            <Tooltip>
                                                <TooltipTrigger>
                                                    <Badge variant="secondary" onClick={() => copyRuleToClipboard(rule)} className="cursor-pointer">
                                                        {rule.name}
                                                    </Badge>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <p>{rule.type === 'expense' ? 'Expense' : 'Income'}: {rule.calculation === 'fixed' ? `${rule.value} (fixed)` : `${rule.value}%`}</p>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground">None</span>
                              )}
                            </TableCell>
                            <TableCell className={cn("text-right font-mono text-lg", account.balance >= 0 ? 'text-green-600' : 'text-red-600')}>
                                {formatAmount(account.balance)}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={(e) => {
                                        e.preventDefault();
                                        setTimeout(() => {
                                            openEditDialog(account);
                                        }, 10);
                                    }}>
                                        <Edit className="mr-2 h-4 w-4"/>Edit
                                    </DropdownMenuItem>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>Deleting an account is permanent. Ensure it has a zero balance and no transactions.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooterComponent>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteAccount(account.id)}>Delete</AlertDialogAction>
                                            </AlertDialogFooterComponent>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={3} className="text-right font-bold text-lg">Total Balance</TableCell>
                                <TableCell className="text-right font-bold text-lg text-primary font-mono">{formatAmount(totalBalance)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                    </div>
                  )}
                </CardContent>
             </Card>
          </TabsContent>
          <TabsContent value="transfers">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><ArrowRightLeft/>Recent Transfers</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg">
                    <div className="space-y-1"><Label>From</Label><DatePicker value={transferFilters.dateFrom ? new Date(transferFilters.dateFrom) : undefined} onChange={(d) => setTransferFilters(f => ({...f, dateFrom: d?.toISOString().split('T')[0] || ''}))}/></div>
                    <div className="space-y-1"><Label>To</Label><DatePicker value={transferFilters.dateTo ? new Date(transferFilters.dateTo) : undefined} onChange={(d) => setTransferFilters(f => ({...f, dateTo: d?.toISOString().split('T')[0] || ''}))}/></div>
                    <div className="space-y-1"><Label>From Account</Label>
                        <Select value={transferFilters.fromAccountId} onValueChange={(v) => setTransferFilters(f => ({...f, fromAccountId: v}))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Accounts</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                     <div className="space-y-1"><Label>To Account</Label>
                        <Select value={transferFilters.toAccountId} onValueChange={(v) => setTransferFilters(f => ({...f, toAccountId: v}))}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="all">All Accounts</SelectItem>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </div>
                <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>From Account</TableHead>
                      <TableHead>To Account</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right w-[50px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                       <TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" /></TableCell></TableRow>
                    ) : filteredTransfers.length > 0 ? filteredTransfers.map(t => (
                        <TableRow key={t.id}>
                            <TableCell>{formatDate(t.date)}</TableCell>
                            <TableCell>{accounts.find(a => a.id === t.fromAccountId)?.name || 'N/A'}</TableCell>
                            <TableCell>{accounts.find(a => a.id === t.toAccountId)?.name || 'N/A'}</TableCell>
                            <TableCell className="text-right font-mono">{formatAmount(t.amount)}</TableCell>
                             <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => openEditTransferDialog(t)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete this transfer record.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooterComponent>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteTransfer(t.id)}>Delete</AlertDialogAction>
                                            </AlertDialogFooterComponent>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    )) : (
                        <TableRow><TableCell colSpan={5} className="h-24 text-center">No transfers found.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

      <Dialog open={isDialogOpen} onOpenChange={handleAccountDialogClose}>
        <DialogContent key={dialogKey} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingAccount ? 'Edit Account' : 'Add New Account'}</DialogTitle>
            <DialogDescription>
                {editingAccount ? `Editing details for ${editingAccount.name}.` : 'Create a new financial account to track balances.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={accountForm.handleSubmit(handleAccountFormSubmit)}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Account Name</Label>
                <Input id="name" {...accountForm.register('name')} />
                {accountForm.formState.errors.name && <p className="text-red-500 text-xs mt-1">{accountForm.formState.errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="balance">Starting Balance</Label>
                <Input id="balance" type="number" step="0.01" {...accountForm.register('balance')} />
                {!!editingAccount && <p className="text-xs text-muted-foreground">This will be added to the current balance. Use a negative number to subtract.</p>}
              </div>

                <div className="space-y-4">
                    <Label className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4"/>Receiving Numbers</Label>
                    <p className="text-xs text-muted-foreground">Link SMS senders (like 'bKash') to this account for automatic transaction matching.</p>
                    <div className="space-y-3">
                        {numberFields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 border rounded-md relative">
                                <Input {...accountForm.register(`receivingNumbers.${index}.name`)} placeholder="Sender Name/Identifier (e.g., BKASH)" />
                                <Input {...accountForm.register(`receivingNumbers.${index}.number`)} placeholder="Number (e.g., 01xxxxxxxxx)" />
                                <Button type="button" variant="ghost" size="icon" className="absolute -top-3 -right-3 h-6 w-6 bg-background" onClick={() => removeNumber(index)}><X className="h-4 w-4 text-destructive"/></Button>
                            </div>
                        ))}
                    </div>
                     <Button type="button" variant="outline" size="sm" onClick={() => appendNumber({ id: `num-${Date.now()}`, name: '', number: '' })}>
                        <Plus className="mr-2 h-4 w-4"/> Add Receiving Number
                    </Button>
                </div>

              <div className="space-y-4">
                <Label className="font-semibold flex items-center gap-2"><Settings className="h-4 w-4"/>Charge Rules</Label>
                <div className="space-y-3">
                    {chargeFields.map((field, index) => (
                        <ChargeRuleItem 
                            key={field.keyId}
                            form={accountForm}
                            index={index}
                            remove={removeCharge}
                            fieldId={field.id}
                        />
                    ))}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => appendCharge({ name: '', type: 'expense', calculation: 'fixed', value: 0 })}>
                  <Plus className="mr-2 h-4 w-4"/> Add Charge Rule
                </Button>
              </div>

            </div>
            <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => handleAccountDialogClose(false)} disabled={isSaving}>Cancel</Button>
                <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                    Save
                </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Edit Transfer</DialogTitle>
                <DialogDescription>Modify the details of this account transfer.</DialogDescription>
            </DialogHeader>
            <form onSubmit={transferForm.handleSubmit(handleTransferFormSubmit)}>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-2">
                            <Label htmlFor="t-amount">Amount</Label>
                            <Input id="t-amount" type="number" step="0.01" {...transferForm.register('amount')} />
                            {transferForm.formState.errors.amount && <p className="text-red-500 text-xs mt-1">{transferForm.formState.errors.amount.message}</p>}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="t-date">Date</Label>
                            <Controller
                              control={transferForm.control}
                              name="date"
                              render={({ field }) => (
                                <DatePicker value={field.value} onChange={field.onChange} />
                              )}
                            />
                            {transferForm.formState.errors.date && <p className="text-red-500 text-xs mt-1">{transferForm.formState.errors.date.message}</p>}
                        </div>
                    </div>
                     <div className="space-y-2">
                        <Label>From Account</Label>
                        <Controller control={transferForm.control} name="fromAccountId" render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                                <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        {transferForm.formState.errors.fromAccountId && <p className="text-red-500 text-xs mt-1">{transferForm.formState.errors.fromAccountId.message}</p>}
                    </div>
                     <div className="space-y-2">
                        <Label>To Account</Label>
                        <Controller control={transferForm.control} name="toAccountId" render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                                <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                            </Select>
                        )} />
                        {transferForm.formState.errors.toAccountId && <p className="text-red-500 text-xs mt-1">{transferForm.formState.errors.toAccountId.message}</p>}
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit">Save Changes</Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

    

    