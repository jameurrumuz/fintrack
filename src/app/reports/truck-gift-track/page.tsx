
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, Truck, Gift, User, Phone, MessageSquare, MoreVertical, Link2, X, Search } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Party, TruckGiftTrackRecord } from '@/types';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToTrackRecords, addTrackRecord, updateTrackRecord, deleteTrackRecord } from '@/services/trackingService';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';


const recordSchema = z.object({
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  truckNumber: z.string().optional(),
  deliveryAddress: z.string().min(1, "Delivery address is required"),
  productName: z.string().min(1, "Product name is required"),
  quantity: z.coerce.number().min(0).optional(),
  customers: z.array(z.object({ id: z.string(), name: z.string() })).min(1, "At least one customer is required"),
  deliveryPersonId: z.string().optional(),
  deliveryDate: z.string().optional(),
  giftDate: z.string().optional(),
  gift: z.object({
      description: z.string().optional(),
      recipients: z.array(z.object({ id: z.string(), name: z.string() })).optional(),
  }).optional(),
});


type RecordFormValues = z.infer<typeof recordSchema>;

const MultiCustomerSelect = ({ parties, selectedCustomers, onSelect, onRemove, placeholder = "Add Customer" }: { parties: Party[]; selectedCustomers: { id: string; name: string }[]; onSelect: (party: Party) => void; onRemove: (partyId: string) => void; placeholder?: string; }) => {
    const [open, setOpen] = useState(false);
    const availableParties = parties.filter(p => !selectedCustomers.some(s => s.id === p.id));

    return (
        <div className="space-y-2">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start font-normal">
                        <Plus className="mr-2 h-4 w-4" /> {placeholder}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                    <Command>
                        <CommandInput placeholder="Search customers..." />
                        <CommandList>
                            <CommandEmpty>No parties found.</CommandEmpty>
                            <CommandGroup>
                                {availableParties.map(party => (
                                    <CommandItem
                                        key={party.id}
                                        value={party.name}
                                        onSelect={() => {
                                            onSelect(party);
                                            setOpen(false);
                                        }}
                                    >
                                        {party.name}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
            <div className="flex flex-wrap gap-2">
                {selectedCustomers.map(customer => (
                    <Badge key={customer.id} variant="secondary">
                        {customer.name}
                        <button type="button" onClick={() => onRemove(customer.id)} className="ml-1 rounded-full outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-2">
                            <X className="h-3 w-3" />
                        </button>
                    </Badge>
                ))}
            </div>
        </div>
    );
};


const RecordFormDialog = ({ open, onOpenChange, onSave, record, parties }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (data: RecordFormValues) => void, record: TruckGiftTrackRecord | null, parties: Party[] }) => {
  const { control, register, handleSubmit, formState: { errors }, watch, setValue } = useForm<RecordFormValues>({ resolver: zodResolver(recordSchema) });
  const customers = watch('customers', []);
  const giftRecipients = watch('gift.recipients', []);
  const [customRecipient, setCustomRecipient] = useState('');


  useEffect(() => {
    if (record) {
      setValue('driverName', record.driverName || '');
      setValue('driverPhone', record.driverPhone || '');
      setValue('truckNumber', record.truckNumber || '');
      setValue('deliveryAddress', record.deliveryAddress);
      setValue('productName', record.productName);
      setValue('quantity', record.quantity || 0);
      setValue('customers', record.customers || []);
      setValue('deliveryPersonId', record.deliveryPersonId || '');
      setValue('deliveryDate', record.deliveryDate ? record.deliveryDate.split('T')[0] : '');
      setValue('giftDate', record.giftDate ? record.giftDate.split('T')[0] : '');
      setValue('gift.description', record.gift?.description || '');
      setValue('gift.recipients', record.gift?.recipients || []);

    } else {
      setValue('driverName', '');
      setValue('driverPhone', '');
      setValue('truckNumber', '');
      setValue('deliveryAddress', '');
      setValue('productName', '');
      setValue('quantity', 0);
      setValue('customers', []);
      setValue('deliveryPersonId', '');
      setValue('deliveryDate', new Date().toISOString().split('T')[0]);
      setValue('giftDate', new Date().toISOString().split('T')[0]);
      setValue('gift.description', '');
      setValue('gift.recipients', []);
    }
  }, [record, open, setValue]);

  const handleSelectCustomer = (party: Party) => {
    const currentCustomers = customers || [];
    if (!currentCustomers.some(c => c.id === party.id)) {
      setValue('customers', [...currentCustomers, { id: party.id, name: party.name }]);
    }
  };

  const handleRemoveCustomer = (partyId: string) => {
    setValue('customers', customers.filter(c => c.id !== partyId));
    setValue('gift.recipients', (giftRecipients || []).filter(r => r.id !== partyId));
  };
  
  const handleSelectGiftRecipient = (party: Party) => {
      const currentRecipients = giftRecipients || [];
      if (!currentRecipients.some(c => c.id === party.id)) {
          setValue('gift.recipients', [...currentRecipients, { id: party.id, name: party.name }]);
      }
  };

  const handleRemoveGiftRecipient = (partyId: string) => {
    setValue('gift.recipients', (giftRecipients || []).filter(r => r.id !== partyId));
  };

  const handleAddCustomRecipient = () => {
    if (customRecipient.trim()) {
      const currentRecipients = giftRecipients || [];
      setValue('gift.recipients', [...currentRecipients, { id: `custom-${Date.now()}`, name: customRecipient.trim() }]);
      setCustomRecipient('');
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{record ? 'Edit Record' : 'Add New Record'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(onSave)} className="space-y-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Driver Name</Label><Input {...register('driverName')} /></div>
            <div className="space-y-1"><Label>Driver Phone</Label><Input {...register('driverPhone')} /></div>
          </div>
          <div className="space-y-1"><Label>Truck Number</Label><Input {...register('truckNumber')} /></div>
          <div className="space-y-1"><Label>Delivery Address *</Label><Textarea {...register('deliveryAddress')} />{errors.deliveryAddress && <p className="text-destructive text-xs">{errors.deliveryAddress.message}</p>}</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Product Name *</Label><Input {...register('productName')} />{errors.productName && <p className="text-destructive text-xs">{errors.productName.message}</p>}</div>
            <div className="space-y-1"><Label>Quantity</Label><Input type="number" {...register('quantity')} /></div>
          </div>
          
          <div className="space-y-1"><Label>Customers *</Label>
            <MultiCustomerSelect parties={parties} selectedCustomers={customers || []} onSelect={handleSelectCustomer} onRemove={handleRemoveCustomer} />
            {errors.customers && <p className="text-destructive text-xs">{errors.customers.message}</p>}
          </div>
          
          <div className="space-y-1"><Label>Delivery Date</Label><Input type="date" {...register('deliveryDate')} /></div>

          <div className="space-y-3 p-3 border rounded-md">
            <h4 className="font-semibold text-sm">Gift Details (Optional)</h4>
            <div className="space-y-1"><Label>Gift Description</Label><Input {...register('gift.description')} placeholder="e.g., Rice, Oil Pack" /></div>
            <div className="space-y-1"><Label>Gift Delivery Date</Label><Input type="date" {...register('giftDate')} /></div>
            <div className="space-y-1"><Label>Gift Recipients</Label>
                <MultiCustomerSelect parties={parties} selectedCustomers={giftRecipients || []} onSelect={handleSelectGiftRecipient} onRemove={handleRemoveGiftRecipient} placeholder="Add recipient from list" />
                 <div className="flex gap-2">
                    <Input value={customRecipient} onChange={(e) => setCustomRecipient(e.target.value)} placeholder="Or add custom recipient name" />
                    <Button type="button" variant="secondary" onClick={handleAddCustomRecipient}>Add</Button>
                </div>
            </div>
          </div>
          
          <div className="space-y-1"><Label>Delivery Person</Label>
             <Controller name="deliveryPersonId" control={control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Select delivery person..." /></SelectTrigger>
                <SelectContent>{parties.filter(p=>p.partyType === 'Delivery').map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit">Save Record</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const SmsDialog = ({ record, deliveryPerson, customersWithDetails }: { record: TruckGiftTrackRecord, deliveryPerson?: Party, customersWithDetails: Party[] }) => {
    const customerDetailsForDriver = customersWithDetails.map(c => `  - Name: ${c.name}, Phone: ${c.phone}, Address: ${c.address}`).join('\n');
    const smsForDriver = `Customer Details:\n${customerDetailsForDriver}\n\nDelivery Address: ${record.deliveryAddress}`;
    const smsForDeliveryPerson = `Delivery Task:\nDriver: ${record.driverName}, Ph: ${record.driverPhone}\nTruck: ${record.truckNumber}\nProduct: ${record.productName} (${record.quantity})\n\nCustomers:\n${customerDetailsForDriver}\n\nAddress: ${record.deliveryAddress}`;

    return (
        <Dialog>
            <DialogTrigger asChild><Button size="sm" variant="outline"><MessageSquare className="mr-2 h-4 w-4"/> Send Details via SMS</Button></DialogTrigger>
            <DialogContent>
                <DialogHeader><DialogTitle>Send SMS Notifications</DialogTitle></DialogHeader>
                <div className="space-y-4">
                    {record.driverPhone && (
                        <div className="flex justify-between items-center">
                            <p className="text-sm">To Driver ({record.driverName})</p>
                            <Button size="sm" asChild><a href={`sms:${record.driverPhone}?body=${encodeURIComponent(smsForDriver)}`}>Send</a></Button>
                        </div>
                    )}
                    {customersWithDetails.map((customer, i) => {
                        if (!customer.phone) return null;
                        const smsForCustomer = `Your product "${record.productName}" is on its way!\nDriver: ${record.driverName}\nPhone: ${record.driverPhone}\nTruck: ${record.truckNumber}`;
                        return (
                            <div key={i} className="flex justify-between items-center">
                                <p className="text-sm">To Customer ({customer.name})</p>
                                <Button size="sm" asChild><a href={`sms:${customer.phone}?body=${encodeURIComponent(smsForCustomer)}`}>Send</a></Button>
                            </div>
                        )
                    })}
                    {deliveryPerson?.phone && (
                        <div className="flex justify-between items-center">
                            <p className="text-sm">To Delivery Person ({deliveryPerson.name})</p>
                            <Button size="sm" asChild><a href={`sms:${deliveryPerson.phone}?body=${encodeURIComponent(smsForDeliveryPerson)}`}>Send</a></Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default function TruckGiftTrackPage() {
  const [records, setRecords] = useState<TruckGiftTrackRecord[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<TruckGiftTrackRecord | null>(null);
  const { toast } = useToast();
  
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    deliveryPersonId: 'all',
    searchTerm: '',
  });

  useEffect(() => {
    const unsubRecords = subscribeToTrackRecords(setRecords, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    const unsubParties = subscribeToParties(setParties, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    setLoading(false);
    return () => {
      unsubRecords();
      unsubParties();
    };
  }, [toast]);
  
  const deliveryPersonnel = useMemo(() => parties.filter(p => p.partyType === 'Delivery'), [parties]);
  
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      if (filters.dateFrom && record.createdAt < filters.dateFrom) return false;
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(record.createdAt) > toDate) return false;
      }
      if (filters.deliveryPersonId !== 'all' && record.deliveryPersonId !== filters.deliveryPersonId) return false;
      if (filters.searchTerm) {
        const term = filters.searchTerm.toLowerCase();
        const customerMatch = (record.customers || []).some(c => c.name.toLowerCase().includes(term));
        const driverMatch = record.driverName?.toLowerCase().includes(term);
        const productMatch = record.productName?.toLowerCase().includes(term);
        const truckMatch = record.truckNumber?.toLowerCase().includes(term);
        if (!customerMatch && !driverMatch && !productMatch && !truckMatch) return false;
      }
      return true;
    });
  }, [records, filters]);

  const handleSaveRecord = async (data: RecordFormValues) => {
    try {
      const deliveryPerson = parties.find(p => p.id === data.deliveryPersonId);
      const recordData = { ...data, deliveryPersonName: deliveryPerson?.name };
      
      if (editingRecord) {
        await updateTrackRecord(editingRecord.id, recordData);
        toast({ title: 'Success', description: 'Record updated.' });
      } else {
        await addTrackRecord({ ...recordData, createdAt: new Date().toISOString() });
        toast({ title: 'Success', description: 'New record added.' });
      }
      setIsDialogOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const handleDeleteRecord = async (id: string) => {
      try {
        await deleteTrackRecord(id);
        toast({ title: 'Success', description: 'Record deleted.'});
      } catch (error: any) {
         toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
  }
  
  const getParty = (id: string): Party | undefined => parties.find(p => p.id === id);

  return (
    <div>
       <div className="mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>

      <RecordFormDialog 
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSave={handleSaveRecord}
        record={editingRecord}
        parties={parties}
      />

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl"><Truck/> Truck & Gift Tracking</CardTitle>
              <CardDescription>Manage deliveries and track gift distributions to customers.</CardDescription>
            </div>
            <Button onClick={() => { setEditingRecord(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4"/> Add Record</Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 p-4 border rounded-lg">
             <div className="space-y-1"><Label>From</Label><Input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} /></div>
             <div className="space-y-1"><Label>To</Label><Input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} /></div>
             <div className="space-y-1"><Label>Delivery Person</Label>
                <Select value={filters.deliveryPersonId} onValueChange={v => setFilters({...filters, deliveryPersonId: v})}>
                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All</SelectItem>{deliveryPersonnel.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
             </div>
             <div className="space-y-1"><Label>Search</Label><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/><Input placeholder="Product, truck, driver..." className="pl-8" value={filters.searchTerm} onChange={e => setFilters({...filters, searchTerm: e.target.value})}/></div></div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
             <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
          ) : filteredRecords.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecords.map((record, index) => {
                const deliveryPerson = getParty(record.deliveryPersonId || '');
                const customersWithDetails = (record.customers || []).map(c => getParty(c.id)).filter(Boolean) as Party[];
                
                return (
                  <Card key={record.id} className="flex flex-col">
                    <CardHeader className="flex-row items-start justify-between pb-2">
                        <div className="space-y-1">
                            <CardTitle className="text-base flex items-center gap-2">
                                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded-sm">{index + 1}</span>
                                {record.productName} ({record.quantity})
                            </CardTitle>
                             <p className="text-xs text-muted-foreground">Created: {formatDate(record.createdAt)}</p>
                             {record.deliveryDate && <p className="text-xs text-muted-foreground">Delivery: {formatDate(record.deliveryDate)}</p>}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => { setEditingRecord(record); setIsDialogOpen(true); }}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDeleteRecord(record.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </CardHeader>
                    <CardContent className="flex-grow space-y-3 text-sm">
                      <div className="p-2 bg-muted/50 rounded-md">
                        <p className="font-semibold flex items-center gap-1.5"><Truck className="h-4 w-4"/> Driver: {record.driverName} ({record.driverPhone})</p>
                        <p>Truck No: {record.truckNumber}</p>
                      </div>
                      <div className="p-2 bg-muted/50 rounded-md">
                         <p className="font-semibold flex items-center gap-1.5"><User className="h-4 w-4"/> To:</p>
                         <div className="flex flex-wrap gap-1 mt-1">
                            {(record.customers || []).map(c => <Badge key={c.id} variant="outline">{c.name}</Badge>)}
                         </div>
                         <p className="mt-2">Address: {record.deliveryAddress}</p>
                         {record.deliveryPersonName && <p>Delivery Person: {record.deliveryPersonName}</p>}
                      </div>
                      {record.gift?.description && (
                          <div className="p-2 bg-orange-50 rounded-md">
                             <p className="font-semibold flex items-center gap-1.5 text-orange-700"><Gift className="h-4 w-4"/> Gift: {record.gift.description}</p>
                             {record.giftDate && <p className="text-xs text-muted-foreground">Gift Date: {formatDate(record.giftDate)}</p>}
                             {(record.gift.recipients && record.gift.recipients.length > 0) && (
                                 <div className="flex flex-wrap gap-1 mt-1">
                                    <span className="text-xs">Recipients:</span>
                                    {record.gift.recipients.map(r => <Badge key={r.id} variant="secondary">{r.name}</Badge>)}
                                 </div>
                             )}
                          </div>
                      )}
                    </CardContent>
                    <CardFooter className="flex-col items-stretch space-y-2">
                       <SmsDialog record={record} deliveryPerson={deliveryPerson} customersWithDetails={customersWithDetails} />
                    </CardFooter>
                  </Card>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-16">
              <h3 className="text-xl font-semibold">No records yet</h3>
              <p className="text-muted-foreground mt-2">Click "Add Record" to start tracking.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
