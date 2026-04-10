

'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { addTransaction, updateTransaction, subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToInventoryItems, addInventoryItem } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { subscribeToParties } from '@/services/partyService';
import type { Party, Account, AppSettings, Transaction, InventoryItem, TransactionVia } from '@/types';
import { formatDate, formatAmount } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';


import {
  ArrowLeft,
  Save,
  Loader2,
  Package,
  Trash2,
  Plus,
  MoreVertical,
  Briefcase,
  ShoppingCart,
  Building,
  ChevronsUpDown,
  Check
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

interface ReturnItem {
    id: string;
    name: string;
    returnQty: number;
    price: number;
    originalQty: number;
}

function NewSaleReturnPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const returnId = searchParams.get('id');
    const { toast } = useToast();

    // Data states
    const [parties, setParties] = useState<Party[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    
    // UI/Form states
    const [selectedPartyId, setSelectedPartyId] = useState<string>('');
    const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
    const [returnItems, setReturnItems] = useState<ReturnItem[]>([]);
    const [returnDate, setReturnDate] = useState(new Date());
    const [refundType, setRefundType] = useState<'adjust' | 'cash'>('adjust');
    const [refundAccountId, setRefundAccountId] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [via, setVia] = useState<TransactionVia | undefined>(undefined);
    const [note, setNote] = useState('');

    useEffect(() => {
        const unsubParties = subscribeToParties(setParties, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
        const unsubTransactions = subscribeToAllTransactions(setTransactions, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
        const unsubAccounts = subscribeToAccounts(setAccounts, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
        
        return () => {
            unsubParties();
            unsubTransactions();
            unsubAccounts();
        };
    }, [toast]);
    
    useEffect(() => {
        if (returnId && transactions.length > 0) {
            const returnTx = transactions.find(t => t.id === returnId);
            if (returnTx) {
                const originalInvoice = transactions.find(t => t.invoiceNumber === returnTx.invoiceNumber && t.type === 'sale');
                
                setSelectedPartyId(returnTx.partyId || '');
                setSelectedInvoiceId(originalInvoice?.id || '');
                setReturnDate(new Date(returnTx.date));
                setRefundAccountId(returnTx.accountId || '');
                setRefundType(returnTx.accountId ? 'cash' : 'adjust');
                setVia(returnTx.via as TransactionVia);
                setNote(returnTx.description || '');

                setReturnItems(returnTx.items?.map(item => {
                    const originalItem = originalInvoice?.items?.find(i => i.id === item.id);
                    return {
                        id: item.id,
                        name: item.name,
                        price: item.price,
                        originalQty: originalItem?.quantity || item.quantity,
                        returnQty: item.quantity
                    };
                }) || []);
            }
        }
    }, [returnId, transactions]);

    const selectedParty = useMemo(() => parties.find(p => p.id === selectedPartyId), [parties, selectedPartyId]);
    
    const partyInvoices = useMemo(() => {
        if (!selectedPartyId) return [];
        return transactions.filter(t => t.partyId === selectedPartyId && (t.type === 'sale' || t.type === 'credit_sale'));
    }, [transactions, selectedPartyId]);

    const selectedInvoice = useMemo(() => {
        const invoice = transactions.find(t => t.id === selectedInvoiceId);
        if (invoice && !returnId) { // Only auto-fill if not editing
            setReturnItems(invoice.items?.map(item => ({
                id: item.id,
                name: item.name,
                price: item.price,
                originalQty: item.quantity,
                returnQty: 0
            })) || []);
            setVia(invoice.via as TransactionVia);
        }
        return invoice;
    }, [transactions, selectedInvoiceId, returnId]);

    const handleReturnQtyChange = (itemId: string, qty: number) => {
        setReturnItems(prevItems => prevItems.map(item => {
            if (item.id === itemId) {
                const newQty = Math.max(0, Math.min(qty, item.originalQty));
                return { ...item, returnQty: newQty };
            }
            return item;
        }));
    };
    
    const totalReturnAmount = useMemo(() => {
        return returnItems.reduce((sum, item) => sum + (item.returnQty * item.price), 0);
    }, [returnItems]);

    const handleProcessReturn = async () => {
        if (totalReturnAmount <= 0) {
            toast({ variant: 'destructive', title: 'No items to return', description: 'Please specify the quantity for items being returned.' });
            return;
        }
        if (refundType === 'cash' && !refundAccountId) {
            toast({ variant: 'destructive', title: 'Account required', description: 'Please select an account to issue the refund from.' });
            return;
        }
        setIsSaving(true);
        try {
            const returnTxData = {
                date: returnDate.toISOString().split('T')[0],
                type: 'sale_return' as const,
                description: note || `Return for Invoice #${selectedInvoice?.invoiceNumber || 'N/A'}`,
                amount: totalReturnAmount,
                partyId: selectedPartyId,
                accountId: refundType === 'cash' ? refundAccountId : undefined,
                items: returnItems.filter(item => item.returnQty > 0).map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.returnQty,
                    price: item.price,
                    cost: 0, 
                })),
                via: via,
                invoiceNumber: selectedInvoice?.invoiceNumber,
            };

            if (returnId) {
                await updateTransaction(returnId, returnTxData);
                toast({ title: 'Success', description: 'Sale return updated successfully.' });
            } else {
                await addTransaction(returnTxData);
                toast({ title: 'Success', description: 'Sale return processed successfully.' });
            }
            router.push('/billing');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="flex flex-col h-screen bg-gray-100 dark:bg-black">
        <header className="bg-primary text-primary-foreground p-3 flex items-center gap-4 sticky top-0 z-10 shadow-md">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
            </Button>
            <h1 className="text-lg font-semibold">{returnId ? 'Edit Sale Return' : 'New Sale Return'}</h1>
        </header>
        
        <main className="flex-grow overflow-y-auto p-3 space-y-3">
            <Accordion type="single" collapsible defaultValue="customer-details" className="w-full">
                <AccordionItem value="customer-details" className="border rounded-lg bg-background">
                    <AccordionTrigger className="p-3 font-semibold">
                        Customer Details
                    </AccordionTrigger>
                    <AccordionContent className="p-3 pt-0 space-y-4">
                        <div className="flex items-center gap-2">
                             <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                                        {selectedParty ? selectedParty.name : "Search Existing Customer"}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                                <Command>
                                    <CommandInput placeholder="Search party..." />
                                    <CommandList>
                                        <CommandEmpty>No party found.</CommandEmpty>
                                        <CommandGroup>{parties.map((party) => (<CommandItem key={party.id} value={party.name} onSelect={() => setSelectedPartyId(party.id)}><Check className={cn("mr-2 h-4 w-4", selectedPartyId === party.id ? "opacity-100" : "opacity-0")} />{party.name}</CommandItem>))}</CommandGroup>
                                    </CommandList>
                                </Command>
                                </PopoverContent>
                            </Popover>
                            <Button variant="outline" size="sm" className="shrink-0" disabled>
                                <Plus className="mr-1 h-4 w-4" /> Add New
                            </Button>
                        </div>
                        <div className="space-y-1">
                            <Label>Customer</Label>
                            <Input readOnly value={selectedParty?.name || ''} className="bg-muted" />
                        </div>
                        <div className="space-y-1">
                            <Label>Mobile</Label>
                            <Input readOnly value={selectedParty?.phone || ''} className="bg-muted" />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <Card>
                <CardContent className="p-3 grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                        <Label>Invoice</Label>
                        <Select value={selectedInvoiceId} onValueChange={setSelectedInvoiceId} disabled={!selectedPartyId}>
                            <SelectTrigger><SelectValue placeholder="Select invoice..." /></SelectTrigger>
                            <SelectContent>{partyInvoices.map(inv => <SelectItem key={inv.id} value={inv.id}>#{inv.invoiceNumber?.replace('INV-','')} - {inv.date}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1">
                        <Label>Return Date</Label>
                        <DatePicker value={returnDate} onChange={(d) => setReturnDate(d as Date)}/>
                    </div>
                    <div className="col-span-2 space-y-1">
                        <Label>Original Order Value</Label>
                        <Input readOnly value={formatAmount(selectedInvoice?.amount || 0)} className="text-right font-semibold bg-muted" />
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="p-3">
                    <CardTitle className="text-base">Items to return</CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                     <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="w-40">Return Qty</TableHead>
                                    <TableHead className="text-right w-28">Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {returnItems.length > 0 ? returnItems.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <p className="font-medium">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">Purchased: {item.originalQty}</p>
                                        </TableCell>
                                        <TableCell>
                                            <Input type="number" value={item.returnQty} onFocus={(e) => e.target.select()} onChange={e => handleReturnQtyChange(item.id, parseInt(e.target.value) || 0)} max={item.originalQty} min="0" className="w-40"/>
                                        </TableCell>
                                        <TableCell className="text-right font-mono">{formatAmount(item.price)}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow><TableCell colSpan={3} className="text-center h-24">Select an invoice to see items.</TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
            
             <Card>
                <CardHeader className="p-3">
                    <CardTitle className="text-base">Refund Details</CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-2">
                    <div className="space-y-1">
                        <Label>Note / Description</Label>
                        <Textarea value={note} onChange={e => setNote(e.target.value)} placeholder="Reason for return..." />
                    </div>
                    <RadioGroup value={refundType} onValueChange={(v) => setRefundType(v as 'adjust' | 'cash')}>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="adjust" id="adjust"/>
                            <Label htmlFor="adjust">Adjust with Due Balance</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <RadioGroupItem value="cash" id="cash"/>
                            <Label htmlFor="cash">Cash/Bank Refund</Label>
                        </div>
                    </RadioGroup>
                    {refundType === 'cash' && (
                        <div className="pl-6 pt-2">
                            <Label>Refund From Account</Label>
                            <Select value={refundAccountId} onValueChange={setRefundAccountId}>
                                <SelectTrigger><SelectValue placeholder="Select account..."/></SelectTrigger>
                                <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    )}
                </CardContent>
            </Card>

        </main>

        <footer className="sticky bottom-0 bg-background border-t shadow-lg p-3 space-y-2">
            <div className="flex justify-between items-center text-sm font-medium">
                <p>Total Items - {returnItems.reduce((sum, item) => sum + item.returnQty, 0)}</p>
            </div>
            <div className="flex justify-between items-center">
                <Button onClick={handleProcessReturn} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 h-5 w-5"/>} 
                    {returnId ? 'Update Return' : 'Process Return'}
                </Button>
                <div className="text-right">
                    <p className="text-sm">Return Amount</p>
                    <p className="text-xl font-bold">{formatAmount(totalReturnAmount)}</p>
                </div>
            </div>
        </footer>
        </div>
    );
}

export default function NewSaleReturnPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
      <NewSaleReturnPage />
    </Suspense>
  );
}
