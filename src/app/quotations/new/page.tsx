

'use client';

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, Users, Loader2, ArrowLeft, ChevronsUpDown, Check, Search, Package, ShoppingCart, Users2, CreditCard, Minus } from 'lucide-react';
import { subscribeToParties, addParty } from '@/services/partyService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { addQuotation, getQuotationById, updateQuotation } from '@/services/quotationService';
import { getAppSettings } from '@/services/settingsService';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Party, InventoryItem, QuotationItem, AppSettings, TransactionVia, InventoryCategory } from '@/types';
import { formatAmount } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { PartyFormDialog } from '@/components/PartyManager'; 
import { uploadImage } from '@/services/storageService';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { ItemFormDialog } from '@/components/inventory/InventoryManager';


type PricingTier = 'retail' | 'wholesale';

const PartyCombobox = ({ parties, value, onChange, placeholder = "Select a customer..." }: { parties: Party[], value: string, onChange: (value: string) => void, placeholder?: string }) => {
    const [open, setOpen] = useState(false);
    const selectedParty = parties.find(p => p.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value && selectedParty ? selectedParty.name : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search party..." />
                    <CommandList>
                        <CommandEmpty>Not found.</CommandEmpty>
                        <CommandGroup>
                             <CommandItem
                                key="unknown-person"
                                value="unknown"
                                onSelect={() => { onChange(""); setOpen(false); }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                                Walk-in Customer
                            </CommandItem>
                            {parties.map((party) => (
                                <CommandItem
                                    key={party.id}
                                    value={party.name}
                                    onSelect={() => {
                                        onChange(party.id);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === party.id ? "opacity-100" : "opacity-0")} />
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

function NewQuotationPageComponent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const quotationId = searchParams.get('id');
    const { toast } = useToast();

    // Data states
    const [parties, setParties] = useState<Party[]>([]);
    const [inventory, setInventory] = useState<InventoryItem[]>([]);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);

    // Form states
    const [date, setDate] = useState<Date>(new Date());
    const [selectedPartyId, setSelectedPartyId] = useState('');
    const [notes, setNotes] = useState('');
    const [selectedVia, setSelectedVia] = useState<TransactionVia>('Personal');
    const [quotationItems, setQuotationItems] = useState<QuotationItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [pricingTier, setPricingTier] = useState<PricingTier>('retail');
    const [isNewPartyDialogOpen, setIsNewPartyDialogOpen] = useState(false);
    const [isItemFormOpen, setIsItemFormOpen] = useState(false);


    useEffect(() => {
        const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
        const unsubInventory = subscribeToInventoryItems(setInventory, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
        
        getAppSettings().then(settings => {
            setAppSettings(settings);
            if (settings?.businessProfiles?.[0]) {
                setSelectedVia(settings.businessProfiles[0].name as TransactionVia);
            }
        });
        
        if (quotationId) {
            getQuotationById(quotationId).then(quote => {
                if (quote) {
                    setDate(new Date(quote.date));
                    setSelectedPartyId(quote.partyId || '');
                    setNotes(quote.notes || '');
                    setSelectedVia(quote.via || 'Personal');
                    setQuotationItems(quote.items);
                }
            });
        }
        setLoading(false);
        return () => { unsubParties(); unsubInventory(); };
    }, [toast, quotationId]);
    
    const filteredInventory = useMemo(() => {
        if (!searchQuery) return [];
        const lowercasedQuery = searchQuery.toLowerCase();
        return inventory.filter(item => 
            item.name.toLowerCase().includes(lowercasedQuery) ||
            (item.sku && item.sku.toLowerCase().includes(lowercasedQuery))
        );
    }, [searchQuery, inventory]);
    
    const updateQuotePrices = useCallback((tier: PricingTier) => {
        setQuotationItems(prevItems => prevItems.map(qItem => {
            const inventoryItem = inventory.find(i => i.id === qItem.id);
            if (!inventoryItem) return qItem;
            const newPrice = tier === 'wholesale' && inventoryItem.wholesalePrice ? inventoryItem.wholesalePrice : inventoryItem.price;
            return { ...qItem, price: newPrice };
        }));
    }, [inventory]);

    useEffect(() => {
        updateQuotePrices(pricingTier);
    }, [pricingTier, updateQuotePrices]);

    const handleAddItemToQuote = (item: InventoryItem) => {
        setQuotationItems(prev => {
            const existing = prev.find(i => i.id === item.id);
            const price = pricingTier === 'wholesale' && item.wholesalePrice ? item.wholesalePrice : item.price;
            if(existing) {
                return prev.map(i => i.id === item.id ? {...i, quantity: i.quantity + 1, price} : i);
            }
            return [...prev, { id: item.id, name: item.name, quantity: 1, price }];
        });
        setSearchQuery("");
    };
    
    const handleItemChange = (itemId: string, field: 'quantity' | 'price', value: number) => {
        setQuotationItems(prev => prev.map(item => item.id === itemId ? {...item, [field]: value} : item));
    };
    
    const handleRemoveItem = (itemId: string) => {
        setQuotationItems(prev => prev.filter(item => item.id !== itemId));
    };

    const handleAdjustQuantity = (itemId: string, amount: number) => {
        setQuotationItems(prev => prev.map(item => {
            if (item.id === itemId) {
                const newQuantity = item.quantity + amount;
                return newQuantity > 0 ? { ...item, quantity: newQuantity } : null;
            }
            return item;
        }).filter(Boolean) as QuotationItem[]);
    };

    const { totalAmount, totalItems } = useMemo(() => {
        const totalAmount = quotationItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
        const totalItems = quotationItems.reduce((sum, item) => sum + item.quantity, 0);
        return { totalAmount, totalItems };
    }, [quotationItems]);

    const handleSaveQuotation = async () => {
        if(quotationItems.length === 0) {
            toast({ variant: 'destructive', title: 'Empty Quotation', description: 'Please add items to the quotation.' });
            return;
        }
        setIsSaving(true);
        try {
            const party = parties.find(p => p.id === selectedPartyId);
            const quoteData: Partial<Quotation> = {
                date: format(date, 'yyyy-MM-dd'),
                notes,
                partyId: selectedPartyId || undefined,
                partyName: party?.name || 'Walk-in Customer',
                items: quotationItems,
                totalAmount,
                status: 'draft',
                via: selectedVia,
            };

            if(quotationId){
                await updateQuotation(quotationId, quoteData);
                toast({ title: "Success", description: "Quotation has been updated." });

            } else {
                 await addQuotation({
                    ...quoteData,
                    quotationNumber: `QT-${Date.now().toString().slice(-6)}`,
                    createdAt: new Date().toISOString(),
                 } as Omit<Quotation, 'id'>);
                toast({ title: "Success", description: "Quotation has been saved." });
            }
            router.push('/billing');
        } catch (error: any) {
             toast({ variant: 'destructive', title: "Error", description: `Could not save quotation: ${error.message}` });
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleSaveNewParty = async (data: any, party: Party | null, imageFile: File | null) => {
        setIsSaving(true);
        let imageUrl = party?.imageUrl || '';

        try {
            if (imageFile) {
                imageUrl = await uploadImage(imageFile, `party-images/${Date.now()}_${imageFile.name}`);
            }
            
            let finalData: Partial<Party> = { ...data, imageUrl, lastContacted: new Date().toISOString() };
            
            const newPartyId = await addParty(finalData as any);
            toast({ title: 'Success', description: 'Contact added successfully.' });
            setSelectedPartyId(newPartyId);
            setIsNewPartyDialogOpen(false);
        } catch (error: any) {
            console.error("Save error:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not save contact.' });
        } finally {
          setIsSaving(false);
        }
    };
    
    return (
    <div className="flex flex-col h-screen bg-gray-100 dark:bg-black">
      <header className="bg-primary text-primary-foreground p-3 flex items-center justify-between shadow-md">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10">
                <ArrowLeft />
            </Button>
            <h1 className="text-lg font-semibold">{quotationId ? 'Edit Quotation' : 'New Quotation'}</h1>
            <div />
        </header>
        
      <PartyFormDialog 
        open={isNewPartyDialogOpen} 
        onOpenChange={setIsNewPartyDialogOpen} 
        onSave={handleSaveNewParty} 
        party={null}
        appSettings={appSettings}
        allParties={parties}
      />
       <ItemFormDialog 
        open={isItemFormOpen} 
        onOpenChange={setIsItemFormOpen} 
        onSave={() => {}} // This needs a proper save handler
        item={null} 
        categories={appSettings?.inventoryCategories || []} 
        parties={parties}
        appSettings={appSettings}
      />

      <main className="flex-grow overflow-y-auto">
        <Tabs defaultValue="items" className="w-full">
            <TabsList className="grid w-full grid-cols-2 rounded-none">
                <TabsTrigger value="items"><ShoppingCart className="mr-1 h-4 w-4"/>ITEMS</TabsTrigger>
                <TabsTrigger value="details"><Users2 className="mr-1 h-4 w-4"/>DETAILS</TabsTrigger>
            </TabsList>
            <TabsContent value="items" className="p-3 bg-white dark:bg-black">
                <div className="flex items-center gap-2 mb-3">
                    <Select value={pricingTier} onValueChange={(v) => setPricingTier(v as PricingTier)}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="retail">Sale Price</SelectItem>
                            <SelectItem value="wholesale">Wholesale</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="relative flex-grow">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
                        <Input placeholder="Search products..." className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                     <Button variant="ghost" size="sm" className="h-auto p-1" onClick={() => setIsItemFormOpen(true)}>
                         <Plus className="h-4 w-4 text-primary"/> <span className="text-primary text-xs">Create New Item</span>
                    </Button>
                </div>
                
                 {searchQuery && (
                    <div className="max-h-60 overflow-y-auto border rounded-md mb-3">
                        {filteredInventory.length > 0 ? (
                             filteredInventory.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-2 border-b last:border-b-0 cursor-pointer hover:bg-muted" onClick={() => handleAddItemToQuote(item)}>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8 rounded-md"><AvatarImage src={item.imageUrl} /><AvatarFallback className="rounded-md">{item.name.charAt(0)}</AvatarFallback></Avatar>
                                        <div>
                                            <p className="text-sm font-medium">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">Stock: {item.quantity}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-mono">{formatAmount(pricingTier === 'wholesale' && item.wholesalePrice ? item.wholesalePrice : item.price)}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-sm text-muted-foreground p-4">No products found.</p>
                        )}
                    </div>
                 )}
                
                 <div className="space-y-3">
                    {quotationItems.map((item, index) => (
                         <Card key={item.id} className="overflow-hidden">
                            <CardContent className="p-3">
                                <div className="flex gap-3">
                                    <div className="flex-shrink-0">
                                        <p className="text-sm font-bold">{index + 1}.</p>
                                    </div>
                                    <div className="flex-grow space-y-1">
                                         <div className="flex justify-between items-start">
                                            <h4 className="font-semibold leading-tight">{item.name}</h4>
                                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveItem(item.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={() => handleAdjustQuantity(item.id, -1)}><Minus className="h-4 w-4"/></Button>
                                                <Input type="number" value={item.quantity} onChange={e => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 1)} className="h-8 w-16 text-center" autoComplete="off"/>
                                                <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={() => handleAdjustQuantity(item.id, 1)}><Plus className="h-4 w-4"/></Button>
                                            </div>
                                             <Input type="number" value={item.price} onChange={e => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)} className="h-8 w-28 text-right font-semibold" autoComplete="off"/>
                                        </div>
                                        <div className="text-right font-medium pr-2">Total: {formatAmount(item.price * item.quantity)}</div>
                                    </div>
                                </div>
                            </CardContent>
                         </Card>
                    ))}
                </div>
                 <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => handleAddItemToQuote(inventory[0])}>
                    <Plus className="mr-2 h-4 w-4"/> Add Item
                </Button>
            </TabsContent>
            <TabsContent value="details" className="p-3">
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Customer</Label>
                        <div className="flex gap-2">
                          <PartyCombobox parties={parties} value={selectedPartyId} onChange={setSelectedPartyId}/>
                          <Button type="button" variant="outline" size="icon" onClick={() => setIsNewPartyDialogOpen(true)}><Plus/></Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Business Profile (Via)</Label>
                      <Select value={selectedVia} onValueChange={(v) => setSelectedVia(v as TransactionVia)}>
                          <SelectTrigger><SelectValue placeholder="Select profile..." /></SelectTrigger>
                          <SelectContent>
                              {(appSettings?.businessProfiles || []).map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Quotation Date</Label>
                        <DatePicker mode="single" value={date} onChange={(d) => setDate(d as Date)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes for the quotation..."/>
                    </div>
                 </div>
            </TabsContent>
        </Tabs>
      </main>
      
      <footer className="sticky bottom-0 bg-background border-t shadow-md">
        <div className="p-3 space-y-1 text-sm">
            <div className="flex justify-between items-center">
                <p className="flex items-center gap-1"><ShoppingCart className="h-4 w-4"/> Items {quotationItems.length} (Total Qty: {totalItems})</p>
                <Button onClick={handleSaveQuotation} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 h-5 w-5"/>}
                    {quotationId ? 'Update Quotation' : 'Save Quotation'}
                </Button>
            </div>
             <div className="flex justify-between items-center font-bold text-base">
                <p className="flex items-center gap-1"><Users className="h-4 w-4"/> {parties.find(p => p.id === selectedPartyId)?.name || 'Walk-in Customer'}</p>
                <p>Total Amount <span className="font-semibold">{formatAmount(totalAmount)}</span></p>
            </div>
        </div>
      </footer>
    </div>
    );
}


export default function NewQuotationPageWrapper() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin h-8 w-8" /></div>}>
      <NewQuotationPageComponent />
    </Suspense>
  );
}
