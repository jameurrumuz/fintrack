
"use client"

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Edit, Trash2, Loader2, Phone, MessageSquare, MoreVertical, Upload, Image as ImageIcon, Camera, ChevronsUpDown, ArrowDown, ArrowUp, Search, Filter, FileText, Landmark, Percent, Calendar, DollarSign, Check, UserSearch, ListFilter } from 'lucide-react';
import { subscribeToParties, addParty, updateParty, deleteParty } from '@/services/partyService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { Party, Transaction, AppSettings, Loan, InventoryItem } from '@/types';
import { getAppSettings } from '@/services/settingsService';
import { uploadImage } from '@/services/storageService';
import { useToast } from '@/hooks/use-toast';
import { Button, buttonVariants } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { formatAmount, formatDate } from '@/lib/utils';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from './ui/badge';
import { cn } from '@/lib/utils';
import { Popover, PopoverTrigger, PopoverContent } from './ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from './ui/command';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CameraCaptureDialog } from './ui/camera-capture-dialog';


const loanDetailsSchema = z.object({
  principal: z.coerce.number().positive("Principal must be a positive number.").optional(),
  interestRate: z.coerce.number().min(0, "Interest rate cannot be negative.").optional(),
  term: z.coerce.number().positive("Term must be a positive number.").optional(),
  issueDate: z.string().optional(),
});

const specificPriceSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  productName: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be non-negative"),
});

const partySchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  group: z.string().optional(),
  partyType: z.string().optional(),
  status: z.string().optional(),
  imageUrl: z.string().optional(),
  loanDetails: loanDetailsSchema.optional(),
  specificPrices: z.array(specificPriceSchema).optional(),
});


type PartyFormValues = z.infer<typeof partySchema>;

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

export const PartyFormDialog = ({ open, onOpenChange, onSave, party, appSettings, allParties = [] }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (data: PartyFormValues, party: Party | null, imageFile: File | null) => void; party: Party | null; appSettings: AppSettings | null, allParties?: Party[] }) => {
    const { toast } = useToast();
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    
    useEffect(() => {
        const unsub = subscribeToInventoryItems(setInventoryItems, (e) => toast({ variant: 'destructive', title: 'Error loading inventory', description: e.message }));
        return () => unsub();
    },[toast])

    const form = useForm<PartyFormValues>({
        resolver: zodResolver(partySchema),
        defaultValues: { name: '', phone: '', address: '', group: '', partyType: '', status: '', imageUrl: '', specificPrices: [] },
    });
  
    const { fields: specificPriceFields, append: appendSpecificPrice, remove: removeSpecificPrice, update: updateSpecificPrice } = useFieldArray({
        control: form.control,
        name: "specificPrices",
    });
    
    const [nameSuggestions, setNameSuggestions] = useState<Party[]>([]);
    const [phoneSuggestions, setPhoneSuggestions] = useState<Party[]>([]);
    const watchedName = form.watch('name');
    const watchedPhone = form.watch('phone');

    const partyType = form.watch("partyType");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const isContactPickerSupported = typeof navigator !== 'undefined' && "contacts" in navigator;
    
    useEffect(() => {
        if (allParties && watchedName && watchedName.length > 2) {
            const suggestions = allParties.filter(p =>
                p.id !== party?.id && p.name.toLowerCase().includes(watchedName.toLowerCase())
            );
            setNameSuggestions(suggestions);
        } else {
            setNameSuggestions([]);
        }
    }, [watchedName, allParties, party]);

    useEffect(() => {
        if (allParties && watchedPhone && watchedPhone.length > 5) {
            const suggestions = allParties.filter(p =>
                p.id !== party?.id && p.phone?.replace(/\s/g, '').includes(watchedPhone.replace(/\s/g, ''))
            );
            setPhoneSuggestions(suggestions);
        } else {
            setPhoneSuggestions([]);
        }
    }, [watchedPhone, allParties, party]);


    useEffect(() => {
        if (party) {
            form.reset({ 
                name: party.name, 
                phone: party.phone || '', 
                address: party.address || '', 
                group: party.group || '', 
                partyType: party.partyType || '', 
                status: party.status || '', 
                imageUrl: party.imageUrl || '',
                loanDetails: party.loanDetails,
                specificPrices: party.specificPrices || [],
            });
            setImagePreview(party.imageUrl || null);
        } else {
            form.reset({
                name: '', phone: '', address: '', group: '', partyType: '', status: '', imageUrl: '', specificPrices: []
            });
            setImagePreview(null);
        }
        setImageFile(null);
    }, [party, open, form]);


    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleCaptureImage = (file: File) => {
        setImageFile(file);
        const reader = new FileReader();
        reader.onloadend = () => {
            setImagePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };

    const handleSelectContact = useCallback(async () => {
        if (!isContactPickerSupported) return;
        try {
            const props = ['name', 'tel'];
            const contacts = await (navigator as any).contacts.select(props, { multiple: false });
            if (contacts && contacts.length > 0) {
                const contact = contacts[0];
                if (contact.name && contact.name.length > 0) {
                    form.setValue('name', contact.name[0]);
                }
                if (contact.tel && contact.tel.length > 0) {
                    form.setValue('phone', contact.tel[0]);
                }
            }
        } catch (ex) {
            console.error('Error selecting contact:', ex);
            toast({ variant: 'destructive', title: 'Could not open contacts', description: 'There was an error trying to access your contacts.' });
        }
    }, [isContactPickerSupported, form, toast]);


    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <CameraCaptureDialog open={isCameraOpen} onOpenChange={setIsCameraOpen} onCapture={handleCaptureImage} />
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{party ? 'Edit Party' : 'Add New Party'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(data => onSave(data, party, imageFile))} className="space-y-4">
                    <Tabs defaultValue="details" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="details">Details</TabsTrigger>
                            <TabsTrigger value="prices">Specific Prices</TabsTrigger>
                        </TabsList>
                        <TabsContent value="details">
                            <div className="grid gap-4 py-4">
                            <div className="flex flex-col items-center gap-4">
                                <Avatar className="h-24 w-24">
                                <AvatarImage src={imagePreview || undefined} alt="Party image" />
                                <AvatarFallback><ImageIcon className="h-10 w-10 text-muted-foreground" /></AvatarFallback>
                                </Avatar>
                                <div className="flex gap-2">
                                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Upload</Button>
                                    <Button type="button" variant="outline" onClick={() => setIsCameraOpen(true)}>
                                    <Camera className="mr-2 h-4 w-4" /> Take Photo
                                    </Button>
                                </div>
                                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageFileChange} />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" {...form.register('name')} />
                                {nameSuggestions.length > 0 && (
                                    <div className="p-2 border border-yellow-300 bg-yellow-50 rounded-md text-xs">
                                        <p className="font-semibold">Possible duplicate found:</p>
                                        <ul className="list-disc pl-5">
                                            {nameSuggestions.map(s => <li key={s.id}>{s.name} ({s.phone})</li>)}
                                        </ul>
                                    </div>
                                )}
                                {form.formState.errors.name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <div className="flex items-center gap-2">
                                        <Input id="phone" {...form.register('phone')} />
                                        {isContactPickerSupported && (
                                            <Button type="button" variant="outline" size="icon" onClick={handleSelectContact} aria-label="Select from contacts">
                                                <UserSearch className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                    {phoneSuggestions.length > 0 && (
                                        <div className="p-2 border border-yellow-300 bg-yellow-50 rounded-md text-xs">
                                            <p className="font-semibold">Possible duplicate found:</p>
                                            <ul className="list-disc pl-5">
                                                {phoneSuggestions.map(s => <li key={s.id}>{s.name} ({s.phone})</li>)}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="group">Main Group</Label>
                                    <Controller name="group" control={form.control} render={({ field }) => (
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger><SelectValue placeholder="Select group..." /></SelectTrigger>
                                        <SelectContent>
                                            {appSettings?.businessProfiles.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    )} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="partyType">Party Type</Label>
                                <Controller name="partyType" control={form.control} render={({ field }) => (
                                <Select onValueChange={field.onChange} value={field.value}>
                                    <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                                    <SelectContent>
                                        {(appSettings?.partyTypes || []).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                )} />
                            </div>
                            
                                {partyType === 'Loan' && (
                                <Card className="bg-muted/50">
                                    <CardHeader className="p-3"><CardTitle className="text-base">Loan Details</CardTitle></CardHeader>
                                    <CardContent className="p-3 space-y-2">
                                    <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Principal Amount</Label>
                                                <Input type="number" step="0.01" {...form.register('loanDetails.principal')} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Issue Date</Label>
                                                <Input type="date" {...form.register('loanDetails.issueDate')} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <Label>Annual Interest Rate (%)</Label>
                                                <Input type="number" step="0.01" {...form.register('loanDetails.interestRate')} />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>Term (Months)</Label>
                                                <Input type="number" {...form.register('loanDetails.term')} />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                )}

                            <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Input id="address" {...form.register('address')} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status">Last Status / Note</Label>
                                <Textarea id="status" {...form.register('status')} placeholder="e.g., Payment pending, call back next week..." />
                            </div>
                            </div>
                        </TabsContent>
                        <TabsContent value="prices">
                             <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                {specificPriceFields.map((field, index) => (
                                    <div key={field.id} className="flex items-center gap-2">
                                        <div className="flex-grow">
                                                <Controller
                                                    name={`specificPrices.${index}.productId`}
                                                    control={form.control}
                                                    render={({ field }) => (
                                                        <ProductCombobox 
                                                            items={inventoryItems} 
                                                            value={field.value} 
                                                            onSelect={(item) => {
                                                                field.onChange(item.id);
                                                                updateSpecificPrice(index, {
                                                                    productId: item.id,
                                                                    productName: item.name,
                                                                    price: form.getValues(`specificPrices.${index}.price`)
                                                                });
                                                            }} 
                                                        />
                                                    )}
                                                />
                                        </div>
                                        <div className="w-32">
                                            <Input type="number" step="0.01" placeholder="Price" {...form.register(`specificPrices.${index}.price`)} />
                                        </div>
                                        <Button type="button" variant="ghost" size="icon" onClick={() => removeSpecificPrice(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </div>
                                ))}
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => appendSpecificPrice({ productId: '', productName: '', price: 0 })}>
                                    <Plus className="mr-2 h-4 w-4"/> Add Price
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                    <DialogFooter>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button type="submit">Save</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}

const SmsLanguageDialog = ({ open, onOpenChange, party, balance, appSettings }: { open: boolean, onOpenChange: (open: boolean) => void, party: Party, balance: number, appSettings: AppSettings | null }) => {
    const { toast } = useToast();
    const businessName = appSettings?.businessProfiles.find(p => p.name === party.group)?.name || appSettings?.businessProfiles[0]?.name || 'our company';
    const [message, setMessage] = useState('');
    const [lang, setLang] = useState<'en' | 'bn' | null>(null);

    useEffect(() => {
        if (!open) {
            setLang(null);
            setMessage('');
        }
    }, [open]);
    
    const generateMessage = (language: 'en' | 'bn') => {
        setLang(language);
        let msg = '';
        if (language === 'en') {
            msg = `Dear ${party.name}, your current due is BDT ${formatAmount(Math.abs(balance), false)}. Please clear your dues as soon as possible. Thank you. - ${businessName}`;
        } else {
            msg = `প্রিয় ${party.name}, আপনার বর্তমান বকেয়া ${formatAmount(Math.abs(balance), false)}। অনুগ্রহ করে দ্রুত বকেয়া পরিশোধ করুন। ধন্যবাদ, ${businessName}`;
        }
        setMessage(msg);
    };

    const handleSend = () => {
        if (!party.phone) {
             toast({ variant: 'destructive', title: 'No Phone Number', description: `No phone number is saved for ${party.name}.`});
             return;
        }
        
        const isDesktop = !/Mobi|Android/i.test(navigator.userAgent);
        
        if (isDesktop) {
            navigator.clipboard.writeText(message);
            toast({ title: 'Message Copied', description: 'SMS message copied to clipboard. Please paste it into your SMS application.' });
        } else {
            // This is a workaround for some webviews that block `sms:` links.
            // It attempts to open an intent URL, which mobile browsers can handle to open the SMS app.
            const intentUrl = `intent:${party.phone}?body=${encodeURIComponent(message)}#Intent;action=android.intent.action.VIEW;scheme=sms;end`;
            window.open(intentUrl, '_blank');
        }
        
        onOpenChange(false);
    };

    if (!lang) {
        return (
             <AlertDialog open={open} onOpenChange={onOpenChange}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Choose SMS Language</AlertDialogTitle>
                         <AlertDialogDescriptionComponent>
                            Select the language for the SMS reminder to {party.name}.
                        </AlertDialogDescriptionComponent>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <Button onClick={() => generateMessage('bn')}>Send Bengali</Button>
                        <Button onClick={() => generateMessage('en')}>Send English</Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        )
    }
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Review SMS to {party.name}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                     <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} />
                </div>
                <DialogFooter>
                     <Button variant="ghost" onClick={() => setLang(null)}>Back</Button>
                     <Button onClick={handleSend}>Send via SMS App</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
};


export default function PartyManager() {
  const [parties, setParties] = useState<Party[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<Party | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState('All');
  const [sortOption, setSortOption] = useState<'name-asc' | 'name-desc' | 'bal-desc' | 'bal-asc' | 'receivable-desc' | 'receivable-asc' | 'payable-desc' | 'payable-asc'>('name-asc');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedPartyForSms, setSelectedPartyForSms] = useState<Party | null>(null);
  const [partyToDelete, setPartyToDelete] = useState<Party | null>(null);
  const [deleteChallenge, setDeleteChallenge] = useState({ num1: 0, num2: 0, answer: '' });

  const { toast } = useToast();
  const router = useRouter();


  useEffect(() => {
    setLoading(true);
    
    getAppSettings().then(setAppSettings).catch(error => {
      toast({ variant: 'destructive', title: 'Error loading settings', description: error.message });
    });
    
    const unsubscribeParties = subscribeToParties((updatedParties) => {
        setParties(updatedParties);
        setLoading(false);
    }, (err) => {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch contacts.'});
        setLoading(false);
    });

    return () => {
        unsubscribeParties();
    };
  }, [toast]);

  
  const { toCollect, toPay } = useMemo(() => {
    let collect = 0;
    let pay = 0;
    
    parties.forEach(party => {
        const balance = party.balance || 0;
        if (balance < 0) { // Customer owes us
            collect += Math.abs(balance);
        } else if (balance > 0) { // We owe party
            pay += balance;
        }
    });

    return { toCollect: collect, toPay: pay };
  }, [parties]);

  const partyTypeCounts = useMemo(() => {
    const counts: { [key: string]: number } = {};
    for (const party of parties) {
      if (party.partyType) {
        counts[party.partyType] = (counts[party.partyType] || 0) + 1;
      }
    }
    return counts;
  }, [parties]);


  const handleFormSubmit = async (data: PartyFormValues, party: Party | null, imageFile: File | null) => {
    setIsUploading(true);
    let imageUrl = party?.imageUrl || '';

    try {
        if (imageFile) {
            imageUrl = await uploadImage(imageFile, `party-images/${Date.now()}_${imageFile.name}`);
        }
        
        let finalData: Partial<Party> = { ...data, imageUrl, lastContacted: new Date().toISOString() };
        
        // Firestore doesn't allow 'undefined' fields. Clean it up.
        if (finalData.partyType !== 'Loan') {
          delete finalData.loanDetails;
        }

        if (party) {
            await updateParty(party.id, finalData);
            toast({ title: 'Success', description: 'Contact updated successfully.' });
        } else {
            await addParty(finalData as any);
            toast({ title: 'Success', description: 'Contact added successfully.' });
        }
    } catch (error) {
        console.error("Save error:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save contact.' });
    } finally {
      setIsUploading(false);
      setIsDialogOpen(false);
    }
  };
  
  const handleDeleteParty = async () => {
    if (!partyToDelete) return;
    try {
      await deleteParty(partyToDelete.id);
      toast({ title: 'Success', description: `Contact "${partyToDelete.name}" deleted.` });
      setPartyToDelete(null);
      setDeleteChallenge({ num1: 0, num2: 0, answer: '' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not delete contact.' });
    }
  }

  const openEditDialog = (party: Party) => {
    setEditingParty(party);
    setIsDialogOpen(true);
  }

  const openNewDialog = () => {
    setEditingParty(null);
    setIsDialogOpen(true);
  }
  
  const openDeleteDialog = (party: Party) => {
    setPartyToDelete(party);
    setDeleteChallenge({
        num1: Math.floor(Math.random() * 10) + 1,
        num2: Math.floor(Math.random() * 10) + 1,
        answer: ''
    });
  };

  const filteredParties = useMemo(() => {
    const filtered = parties.filter(p => {
        const typeMatch = filterType === 'All' || p.partyType === filterType;
        const searchMatch = searchTerm 
            ? p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.phone?.includes(searchTerm)
            : true;
        return typeMatch && searchMatch;
    });

    return filtered.sort((a, b) => {
        const balanceA = a.balance || 0;
        const balanceB = b.balance || 0;

        switch (sortOption) {
            case 'name-asc':
                return a.name.localeCompare(b.name);
            case 'name-desc':
                return b.name.localeCompare(a.name);
            case 'bal-desc':
                return Math.abs(balanceB) - Math.abs(balanceA);
            case 'bal-asc':
                return Math.abs(balanceA) - Math.abs(balanceB);
            case 'receivable-desc':
                return balanceA - balanceB;
            case 'receivable-asc':
                return balanceB - balanceA;
             case 'payable-desc':
                 return balanceB - balanceA;
            case 'payable-asc':
                 return balanceA - balanceB;
            default:
                return 0;
        }
    });
  }, [parties, searchTerm, filterType, sortOption]);


  const handleSendSms = (e: React.MouseEvent, party: Party) => {
    e.stopPropagation();
    setSelectedPartyForSms(party);
  };

  return (
    <>
      {selectedPartyForSms && (
          <SmsLanguageDialog
              open={!!selectedPartyForSms}
              onOpenChange={() => setSelectedPartyForSms(null)}
              party={{...selectedPartyForSms, balance: selectedPartyForSms.balance || 0}}
              balance={selectedPartyForSms.balance || 0}
              appSettings={appSettings}
          />
      )}
      {partyToDelete && (
        <AlertDialog open={!!partyToDelete} onOpenChange={(open) => !open && setPartyToDelete(null)}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure you want to delete {partyToDelete?.name}?</AlertDialogTitle>
                  <AlertDialogDescriptionComponent>
                      This action cannot be undone and will permanently delete this party. To confirm, please solve the following:
                  </AlertDialogDescriptionComponent>
              </AlertDialogHeader>
              <div className="my-2 p-4 bg-muted rounded-md text-center">
                  <span className="text-lg font-mono">{deleteChallenge.num1} + {deleteChallenge.num2} = ?</span>
                  <Input 
                      value={deleteChallenge.answer}
                      onChange={(e) => setDeleteChallenge({...deleteChallenge, answer: e.target.value})}
                      className="mt-2 text-center"
                      autoFocus
                  />
              </div>
              <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                      onClick={handleDeleteParty}
                      disabled={parseInt(deleteChallenge.answer) !== (deleteChallenge.num1 + deleteChallenge.num2)}
                      className={cn(buttonVariants({ variant: 'destructive' }))}
                  >
                      Delete
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>
      )}

      <PartyFormDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        onSave={handleFormSubmit}
        party={editingParty}
        appSettings={appSettings}
        allParties={parties}
      />
      
      <div className="space-y-4">
        <Collapsible defaultOpen>
            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                    <CollapsibleTrigger asChild>
                        <CardHeader className="p-3 cursor-pointer">
                            <CardDescription className="text-green-600 dark:text-green-400 flex items-center justify-between">
                                To Collect <ArrowDown className="h-4 w-4" />
                            </CardDescription>
                            <CardTitle className="text-green-700 dark:text-green-300 text-2xl">
                                {formatAmount(toCollect)}
                            </CardTitle>
                        </CardHeader>
                    </CollapsibleTrigger>
                </Card>
                 <Card className="bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800">
                     <CollapsibleTrigger asChild>
                        <CardHeader className="p-3 cursor-pointer">
                            <CardDescription className="text-red-600 dark:text-red-400 flex items-center justify-between">
                                To Pay <ArrowUp className="h-4 w-4" />
                            </CardDescription>
                            <CardTitle className="text-red-700 dark:text-red-300 text-2xl">
                                {formatAmount(toPay)}
                            </CardTitle>
                        </CardHeader>
                    </CollapsibleTrigger>
                </Card>
            </div>
            <CollapsibleContent>
                <p className="text-xs text-muted-foreground p-2 text-center">Summary of all party balances.</p>
            </CollapsibleContent>
        </Collapsible>
        
        <div className="space-y-4">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                    placeholder="Search by Name/Mobile..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                />
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-full bg-muted p-1 flex-wrap">
                    <Button
                        key="All"
                        variant={filterType === 'All' ? 'default' : 'ghost'}
                        size="sm"
                        className="rounded-full"
                        onClick={() => setFilterType('All')}
                    >
                        All ({parties.length})
                    </Button>
                    {(appSettings?.partyTypes || []).map(type => (
                        <Button
                            key={type}
                            variant={filterType === type ? 'default' : 'ghost'}
                            size="sm"
                            className="rounded-full"
                            onClick={() => setFilterType(type)}
                        >
                            {type} ({partyTypeCounts[type] || 0})
                        </Button>
                    ))}
                </div>
                 <div className="flex-grow"/>
                 <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline"><ListFilter className="mr-2 h-4 w-4"/>Sort By</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                        <DropdownMenuRadioGroup value={sortOption} onValueChange={(v) => setSortOption(v as any)}>
                            <DropdownMenuRadioItem value="name-asc">Name (A-Z)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="name-desc">Name (Z-A)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="bal-desc">Balance (High-Low)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="bal-asc">Balance (Low-High)</DropdownMenuRadioItem>
                             <DropdownMenuSeparator />
                            <DropdownMenuRadioItem value="receivable-desc">Receivables (High-Low)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="receivable-asc">Receivables (Low-High)</DropdownMenuRadioItem>
                             <DropdownMenuSeparator />
                            <DropdownMenuRadioItem value="payable-desc">Payables (High-Low)</DropdownMenuRadioItem>
                            <DropdownMenuRadioItem value="payable-asc">Payables (Low-High)</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                    </DropdownMenuContent>
                 </DropdownMenu>
                 <Button onClick={openNewDialog}><Plus className="mr-2 h-4 w-4"/> Add Party</Button>
            </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="mx-auto h-12 w-12 animate-spin text-primary" /></div>
        ) : filteredParties.length > 0 ? (
           <div className="space-y-3">
             {filteredParties.map(party => {
                const balance = party.balance || 0;
                const isReceivable = balance < 0;
                const hasPayable = balance > 0;
                const hasDue = isReceivable || hasPayable;
                
                return (
                    <Card key={party.id}>
                        <CardContent className="p-3 flex items-start gap-4">
                            <Avatar className="h-12 w-12 flex-shrink-0 cursor-pointer" onClick={() => router.push(`/parties/${party.id}`)}>
                                <AvatarImage src={party.imageUrl} alt={party.name} />
                                <AvatarFallback>{party.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-grow min-w-0 cursor-pointer" onClick={() => router.push(`/parties/${party.id}`)}>
                                <p className="font-semibold truncate">{party.name}</p>
                                <p className="text-sm text-muted-foreground">{party.phone || 'No phone'}</p>
                                {party.status && <p className="text-xs text-blue-600 italic mt-1 truncate">Note: {party.status}</p>}
                                <div className="flex items-center gap-2 mt-1">
                                    {party.partyType && <Badge variant="outline">{party.partyType}</Badge>}
                                    {hasDue && party.phone && isReceivable && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-6 px-2 text-xs"
                                            onClick={(e) => handleSendSms(e, party)}
                                        >
                                            <MessageSquare className="h-3 w-3 mr-1" />
                                            Send SMS
                                        </Button>
                                    )}
                                </div>
                            </div>
                            <div className="text-right flex-shrink-0 flex flex-col items-end">
                                <div  className="cursor-pointer" onClick={() => router.push(`/parties/${party.id}`)}>
                                    <p className={cn("text-xl font-bold", isReceivable ? "text-green-600" : (hasPayable ? "text-red-600" : ""))}>
                                        {formatAmount(Math.abs(balance))}
                                    </p>
                                    {hasDue && <p className="text-xs text-muted-foreground">{isReceivable ? 'I will get' : 'I will give'}</p>}
                                </div>
                                <div onClick={e => e.stopPropagation()}>
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 mt-1 -mr-2"><MoreVertical className="h-4 w-4" /></Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem asChild>
                                            <Link href={`/parties/${party.id}`}>
                                                <FileText className="mr-2 h-4 w-4" /> View Report
                                            </Link>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={(e) => {openEditDialog(party);}}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); openDeleteDialog(party); }} className="text-destructive focus:text-destructive">
                                            <Trash2 className="mr-2 h-4 w-4"/>Delete
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                 </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
           </div>
        ) : (
            <div className="text-center py-16 border-2 border-dashed rounded-lg">
                <h3 className="text-xl font-semibold">No Parties Found</h3>
                <p className="text-muted-foreground mt-2">Try adjusting your search or filters.</p>
            </div>
        )}
      </div>
    </>
  )
}
