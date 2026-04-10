

'use client';

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { getPartyBalanceEffect } from '@/lib/utils';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToManualInvoices, addManualInvoice, updateManualInvoice, deleteManualInvoice } from '@/services/manualInvoiceService';
import type { Party, InventoryItem, AppSettings, Transaction, ManualInvoice, ManualInvoiceItem } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { subscribeToParties, addParty } from '@/services/partyService';
import InvoiceDialog from '@/components/pos/InvoiceDialog';
import { ArrowLeft, Save, Loader2, Plus, Trash2, Edit, Printer, Search, FilePlus } from 'lucide-react';
import { formatAmount, formatDate } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import Link from 'next/link';
import html2canvas from 'html2canvas';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";


interface ManualInvoiceItemWithDate extends ManualInvoiceItem {
    date: Date;
}

function ManualInvoicePage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [parties, setParties] = useState<Party[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [savedInvoices, setSavedInvoices] = useState<ManualInvoice[]>([]);
    const [loading, setLoading] = useState(true);

    const [items, setItems] = useState<ManualInvoiceItemWithDate[]>([]);
    const [selectedPartyId, setSelectedPartyId] = useState<string>('');
    const [customPartyName, setCustomPartyName] = useState('');
    const [businessProfile, setBusinessProfile] = useState<{ name: string; address: string; phone: string; }>({ name: '', address: '', phone: '' });
    const [date, setDate] = useState<Date>(new Date());
    const [invoiceNotes, setInvoiceNotes] = useState('');
    const [discount, setDiscount] = useState(0);
    const [deliveryCharge, setDeliveryCharge] = useState(0);
    const [showPaidStamp, setShowPaidStamp] = useState(false);
    
    const [invoiceToView, setInvoiceToView] = useState<Transaction | null>(null);
    const invoiceRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();
    const [newProductName, setNewProductName] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);
    
    const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
    const [selectedTxForImport, setSelectedTxForImport] = useState<Set<string>>(new Set());


    useEffect(() => {
        setLoading(true);
        const unsubParties = subscribeToParties(setParties, console.error);
        const unsubInventory = subscribeToInventoryItems(setInventory, console.error);
        const unsubTransactions = subscribeToAllTransactions(setAllTransactions, console.error);
        const unsubManualInvoices = subscribeToManualInvoices(setSavedInvoices, console.error);
        getAppSettings().then(settings => {
            setAppSettings(settings);
            if (settings?.businessProfiles?.[0]) {
                setBusinessProfile(settings.businessProfiles[0]);
            }
            setLoading(false);
        });

        return () => { unsubParties(); unsubInventory(); unsubTransactions(); unsubManualInvoices(); };
    }, []);

    const partyTransactions = useMemo(() => {
        if (!selectedPartyId) return [];
        const importedItemIds = new Set(items.map(i => i.originalTxId).filter(Boolean));
        return allTransactions
            .filter(t => t.partyId === selectedPartyId && t.enabled && !importedItemIds.has(t.id))
            .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [allTransactions, selectedPartyId, items]);
    
    const handleImportSelectedTransactions = () => {
        const transactionsToImport = allTransactions.filter(tx => selectedTxForImport.has(tx.id));
        
        const newInvoiceItems: ManualInvoiceItemWithDate[] = transactionsToImport.map(tx => {
            return {
                id: `imported-${tx.id}`,
                name: tx.description,
                date: new Date(tx.date),
                quantity: 1,
                price: tx.amount,
                cost: (tx.items || []).reduce((sum, i) => sum + (i.cost || 0), 0),
                originalTxId: tx.id,
            };
        });

        if (transactionsToImport.length > 0) {
            setDate(new Date(transactionsToImport[0].date));
        }

        setItems(prev => [...prev, ...newInvoiceItems]);
        toast({ title: 'Success', description: `${transactionsToImport.length} transactions added.` });
        setIsImportDialogOpen(false);
        setSelectedTxForImport(new Set());
    };

    const handleAddItem = (item: { id: string; name: string; price: number; cost?: number }) => {
        setItems(prev => {
            return [...prev, { id: item.id || `custom-${Date.now()}`, name: item.name, quantity: 1, price: item.price || 0, cost: item.cost || 0, date: new Date() }];
        });
        setNewProductName(''); // Clear input after adding
    };
    
    const handleItemChange = (itemId: string, field: keyof ManualInvoiceItem, value: number | Date | string) => {
        setItems(prev => prev.map(item => item.id === itemId ? { ...item, [field]: value } as ManualInvoiceItemWithDate : item));
    };

    const handleRemoveItem = (itemId: string) => {
        setItems(prev => prev.filter(item => item.id !== itemId));
    };

    const { subTotal, totalAmount } = useMemo(() => {
        const sub = items.reduce((sum, item) => {
            const itemTotal = item.price * item.quantity;
            return sum + itemTotal;
        }, 0);
        const total = sub - discount + deliveryCharge;
        return { subTotal: sub, totalAmount: total };
    }, [items, discount, deliveryCharge]);

    const handleGenerateAndSaveInvoice = async () => {
        if (items.length === 0) {
            toast({ variant: 'destructive', title: 'Empty Invoice', description: 'Please add at least one item.'});
            return;
        }

        setIsSaving(true);
        const party = parties.find(p => p.id === selectedPartyId);
        const partyName = customPartyName || party?.name || 'Walk-in Customer';

        const invoiceData: Omit<ManualInvoice, 'id' | 'createdAt'> = {
            invoiceNumber: editingInvoiceId ? savedInvoices.find(i => i.id === editingInvoiceId)?.invoiceNumber || `MANUAL-${Date.now().toString().slice(-6)}` : `MANUAL-${Date.now().toString().slice(-6)}`,
            date: date.toISOString().split('T')[0],
            notes: invoiceNotes,
            partyId: selectedPartyId || undefined,
            partyName: partyName,
            businessProfileName: businessProfile.name,
            businessProfileAddress: businessProfile.address,
            businessProfilePhone: businessProfile.phone,
            items: items.map(item => ({
                id: item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                date: item.date instanceof Date ? item.date.toISOString().split('T')[0] : item.date,
            })),
            subTotal,
            totalAmount,
            discount,
            deliveryCharge,
            isPaid: showPaidStamp,
        };
        
        try {
            let savedInvoice: ManualInvoice;
            if (editingInvoiceId) {
                await updateManualInvoice(editingInvoiceId, invoiceData);
                savedInvoice = { ...invoiceData, id: editingInvoiceId, createdAt: savedInvoices.find(i => i.id === editingInvoiceId)!.createdAt };
                toast({title: 'Success', description: 'Invoice updated successfully.'});
            } else {
                 const newId = await addManualInvoice(invoiceData);
                 savedInvoice = { ...invoiceData, id: newId, createdAt: new Date().toISOString() };
                 toast({title: 'Success', description: 'Invoice saved successfully.'});
            }
            handleViewInvoice(savedInvoice, partyName);
            resetForm();
        } catch (error) {
            console.error('Failed to save invoice', error);
            toast({variant: 'destructive', title: 'Error', description: 'Could not save the invoice.'});
        } finally {
            setIsSaving(false);
        }
    };
    
    const resetForm = () => {
        setItems([]);
        setSelectedPartyId('');
        setCustomPartyName('');
        setDate(new Date());
        setInvoiceNotes('');
        setDiscount(0);
        setDeliveryCharge(0);
        setEditingInvoiceId(null);
        setShowPaidStamp(false);
        if (appSettings?.businessProfiles?.[0]) {
            setBusinessProfile(appSettings.businessProfiles[0]);
        }
    }
    
    const handleEditInvoice = (invoice: ManualInvoice) => {
        setEditingInvoiceId(invoice.id);
        setItems(invoice.items.map(item => ({...item, date: new Date(item.date)})));
        setSelectedPartyId(invoice.partyId || '');
        setCustomPartyName(invoice.partyId ? '' : invoice.partyName);
        setBusinessProfile({
            name: invoice.businessProfileName,
            address: invoice.businessProfileAddress || '',
            phone: invoice.businessProfilePhone || '',
        });
        setDate(new Date(invoice.date));
        setInvoiceNotes(invoice.notes || '');
        setDiscount(invoice.discount || 0);
        setDeliveryCharge(invoice.deliveryCharge || 0);
        setShowPaidStamp(invoice.isPaid || false);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDeleteInvoice = async (id: string) => {
        try {
            await deleteManualInvoice(id);
            toast({ title: 'Invoice Deleted' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete invoice.'});
        }
    }
    
    const handleViewInvoice = (manualInvoice: ManualInvoice, partyNameOverride?: string) => {
         const transactionLike: Transaction = {
            id: manualInvoice.id,
            invoiceNumber: manualInvoice.invoiceNumber,
            date: manualInvoice.date,
            partyId: manualInvoice.partyId,
            items: manualInvoice.items.map(i => ({...i, id: i.id || `manual-${i.name}`, date: i.date instanceof Date ? i.date.toISOString().split('T')[0] : i.date})),
            amount: manualInvoice.totalAmount,
            discount: manualInvoice.discount,
            deliveryCharge: manualInvoice.deliveryCharge,
            description: manualInvoice.notes || '',
            type: 'sale',
            enabled: true,
            via: manualInvoice.businessProfileName,
            businessProfile: {
                name: manualInvoice.businessProfileName,
                address: manualInvoice.businessProfileAddress,
                phone: manualInvoice.businessProfilePhone,
            },
        };
        const partyToView = parties.find(p => p.id === manualInvoice.partyId) || { id: 'custom', name: partyNameOverride || 'Walk-in Customer' };
        setInvoiceToView({...transactionLike, partyName: partyToView.name, isPaid: manualInvoice.isPaid});
    };
    
    const handleBusinessProfileChange = (value: string) => {
        if (value === 'custom') {
            setBusinessProfile({ name: '', address: '', phone: '' });
        } else {
            const profile = appSettings?.businessProfiles.find(p => p.name === value);
            if (profile) {
                setBusinessProfile(profile);
            }
        }
    };


    if (loading) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

    return (
        <div className="container mx-auto max-w-4xl py-8">
            <InvoiceDialog
                isOpen={!!invoiceToView}
                onOpenChange={() => setInvoiceToView(null)}
                invoice={invoiceToView}
                party={parties.find(p => p.id === invoiceToView?.partyId)}
                parties={parties}
                appSettings={null}
                customPartyName={invoiceToView?.partyName}
                accounts={[]}
                allTransactions={allTransactions}
                onPrint={() => {
                    const printable = invoiceRef.current;
                    if (printable) {
                        const printWindow = window.open('', '_blank');
                        printWindow?.document.write('<html><head><title>Print Invoice</title><link rel="stylesheet" href="https://unpkg.com/tailwindcss@^2/dist/tailwind.min.css"></head><body class="p-4">' + printable.innerHTML + '</body></html>');
                        printWindow?.document.close();
                        printWindow?.focus();
                        setTimeout(() => { printWindow?.print(); }, 500);
                    }
                }}
                ref={invoiceRef}
            />

            <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Import Transactions for {parties.find(p => p.id === selectedPartyId)?.name}</DialogTitle>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead><Checkbox
                                        checked={selectedTxForImport.size === partyTransactions.length && partyTransactions.length > 0}
                                        onCheckedChange={(checked) => {
                                            const allIds = new Set(partyTransactions.map(tx => tx.id));
                                            setSelectedTxForImport(checked ? allIds : new Set());
                                        }}
                                    /></TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {partyTransactions.map(tx => (
                                    <TableRow key={tx.id}>
                                        <TableCell><Checkbox
                                            checked={selectedTxForImport.has(tx.id)}
                                            onCheckedChange={(checked) => {
                                                const newSet = new Set(selectedTxForImport);
                                                if(checked) newSet.add(tx.id);
                                                else newSet.delete(tx.id);
                                                setSelectedTxForImport(newSet);
                                            }}
                                        /></TableCell>
                                        <TableCell>{formatDate(tx.date)}</TableCell>
                                        <TableCell>{tx.description}</TableCell>
                                        <TableCell className="text-right">{formatAmount(tx.amount)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button onClick={handleImportSelectedTransactions} disabled={selectedTxForImport.size === 0}>
                            Add Selected ({selectedTxForImport.size}) to Invoice
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="mb-6">
                <Button variant="outline" asChild><Link href="/tools"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Tools</Link></Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><FilePlus/> Manual Invoice Creator</CardTitle>
                    <CardDescription>Quickly generate a printable invoice for any purpose. These invoices are for viewing and printing only and do not affect your financial records.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <div className="space-y-1"><Label>Date</Label><DatePicker value={date} onChange={(d) => setDate(d || new Date())} /></div>
                        <div className="space-y-1">
                            <Label>Party</Label>
                            <Input 
                                list="party-suggestions"
                                value={customPartyName || (parties.find(p => p.id === selectedPartyId)?.name || '')}
                                onChange={(e) => {
                                    setCustomPartyName(e.target.value);
                                    const matchingParty = parties.find(p => p.name === e.target.value);
                                    setSelectedPartyId(matchingParty ? matchingParty.id : '');
                                }}
                                placeholder="Select or type party name"
                            />
                            <datalist id="party-suggestions">
                                {parties.map(p => <option key={p.id} value={p.name} />)}
                            </datalist>
                        </div>
                         <div className="space-y-1">
                            <Label>Business Profile</Label>
                            <Select value={businessProfile.name} onValueChange={handleBusinessProfileChange}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select or type business profile..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="custom">Custom</SelectItem>
                                    {appSettings?.businessProfiles.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>Business Name</Label>
                             <Input 
                                value={businessProfile.name || ''}
                                onChange={(e) => setBusinessProfile(p => ({...p, name: e.target.value}))}
                                placeholder="Your Business Name"
                            />
                        </div>
                         <div className="space-y-1">
                            <Label>Business Address</Label>
                             <Input 
                                value={businessProfile.address || ''}
                                onChange={(e) => setBusinessProfile(p => ({...p, address: e.target.value}))}
                                placeholder="Your Business Address"
                            />
                        </div>
                         <div className="space-y-1">
                            <Label>Business Phone</Label>
                             <Input 
                                value={businessProfile.phone || ''}
                                onChange={(e) => setBusinessProfile(p => ({...p, phone: e.target.value}))}
                                placeholder="Your Business Phone"
                            />
                        </div>
                    </div>
                     <div className="rounded-md border">
                        <Table>
                            <TableHeader><TableRow><TableHead className="w-16">Sl</TableHead><TableHead className="w-48">Date</TableHead><TableHead>Item</TableHead><TableHead className="w-24">Qty</TableHead><TableHead className="w-32">Price</TableHead><TableHead className="w-32 text-right">Total</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                            <TableBody>
                                {items.map((item, index) => (
                                    <TableRow key={item.id}>
                                        <TableCell>{index + 1}</TableCell>
                                        <TableCell>
                                            <DatePicker value={item.date} onChange={(d) => handleItemChange(item.id, 'date', d || new Date())}/>
                                        </TableCell>
                                        <TableCell><Input value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} /></TableCell>
                                        <TableCell><Input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)} onFocus={e => e.target.select()} /></TableCell>
                                        <TableCell><Input type="number" value={item.price} onChange={e => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)} onFocus={e => e.target.select()} /></TableCell>
                                        <TableCell className="text-right font-mono">{formatAmount(item.price * item.quantity)}</TableCell>
                                        <TableCell><Button variant="ghost" size="icon" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <div className="space-y-2 flex-grow">
                            <Label>Add Product</Label>
                            <div className="flex gap-2">
                                <Input
                                    list="product-suggestions"
                                    value={newProductName}
                                    onChange={(e) => setNewProductName(e.target.value)}
                                    placeholder="Select existing or type new product"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newProductName) {
                                            e.preventDefault();
                                            const existingItem = inventory.find(i => i.name.toLowerCase() === newProductName.toLowerCase());
                                            handleAddItem(existingItem || { id: `custom-${Date.now()}`, name: newProductName, price: 0 });
                                        }
                                    }}
                                />
                                <datalist id="product-suggestions">
                                    {inventory.map(item => <option key={item.id} value={item.name} />)}
                                </datalist>
                                <Button onClick={() => {
                                    const existingItem = inventory.find(i => i.name.toLowerCase() === newProductName.toLowerCase());
                                    handleAddItem(existingItem || { id: `custom-${Date.now()}`, name: newProductName, price: 0 });
                                }}>Add</Button>
                            </div>
                        </div>
                        {selectedPartyId && (
                            <div className="space-y-2">
                                <Label>Or Import</Label>
                                <Button variant="outline" className="w-full" onClick={() => setIsImportDialogOpen(true)}>
                                    Import from Transaction
                                </Button>
                            </div>
                        )}
                    </div>
                     <div className="space-y-4 pt-4 border-t">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-1"><Label>Discount</Label><Input type="number" value={discount} onChange={e => setDiscount(parseFloat(e.target.value) || 0)} placeholder="0.00"/></div>
                            <div className="space-y-1"><Label>Delivery Charge</Label><Input type="number" value={deliveryCharge} onChange={e => setDeliveryCharge(parseFloat(e.target.value) || 0)} placeholder="0.00"/></div>
                            <div className="flex items-end pb-2">
                                <div className="flex items-center space-x-2">
                                <Checkbox id="paid-stamp" checked={showPaidStamp} onCheckedChange={(checked) => setShowPaidStamp(!!checked)} />
                                <Label htmlFor="paid-stamp">Show 'Paid' Stamp</Label>
                                </div>
                            </div>
                        </div>
                         <div className="space-y-1"><Label>Notes</Label><Textarea value={invoiceNotes} onChange={e => setInvoiceNotes(e.target.value)} placeholder="Terms & conditions or other notes..."/></div>
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col items-end gap-2">
                    <p>Subtotal: <span className="font-semibold">{formatAmount(subTotal)}</span></p>
                    <p className="text-2xl font-bold">Total: <span className="text-primary">{formatAmount(totalAmount)}</span></p>
                    <div className="flex gap-2">
                         <Button size="lg" onClick={handleGenerateAndSaveInvoice} disabled={isSaving}>
                            <Save className="mr-2 h-4 w-4"/> {editingInvoiceId ? 'Update & View' : 'Save & View'}
                        </Button>
                    </div>
                </CardFooter>
            </Card>

            <Card className="mt-8">
                <CardHeader>
                    <CardTitle>Saved Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Invoice #</TableHead><TableHead>Party</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {savedInvoices.map(invoice => (
                                <TableRow key={invoice.id}>
                                    <TableCell>{formatDate(invoice.date)}</TableCell>
                                    <TableCell>{invoice.invoiceNumber}</TableCell>
                                    <TableCell>{invoice.partyName}</TableCell>
                                    <TableCell className="text-right">{formatAmount(invoice.totalAmount)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => handleViewInvoice(invoice)}>View/Print</Button>
                                        <Button variant="ghost" size="sm" onClick={() => handleEditInvoice(invoice)}>
                                            <Edit className="h-4 w-4 mr-1"/>Edit
                                        </Button>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-4 w-4 mr-1"/>Delete</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescription>This will permanently delete this manual invoice.</AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteInvoice(invoice.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}

export default function ManualInvoicePageWrapper() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <ManualInvoicePage />
        </Suspense>
    );
}

