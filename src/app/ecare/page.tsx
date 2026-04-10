

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, HeartPulse, Wrench, Calendar, DollarSign, Search, Filter } from 'lucide-react';
import type { EcareItem, ServiceRecord } from '@/types';
import { subscribeToEcareItems, addEcareItem, updateEcareItem, deleteEcareItem, addServiceRecord, deleteServiceRecord } from '@/services/ecareService';
import { formatDate, formatAmount } from '@/lib/utils';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DatePicker } from '@/components/ui/date-picker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format, parseISO, isPast, isFuture, addYears, addMonths, addDays, formatDistanceToNowStrict } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreVertical } from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';


const ecareItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  purchaseDate: z.date({ required_error: "Purchase date is required" }),
  purchasePrice: z.coerce.number().min(0),
  recoveredAmount: z.coerce.number().min(0).optional(),
  warrantyPeriod: z.string().optional(),
  notes: z.string().optional(),
});
type EcareItemFormValues = z.infer<typeof ecareItemSchema>;

const serviceRecordSchema = z.object({
  date: z.date({ required_error: "Service date is required" }),
  servicePerson: z.string().min(1, "Service person name is required"),
  servicePersonPhone: z.string().optional(),
  cost: z.coerce.number().min(0),
  description: z.string().min(1, "Description is required"),
  nextServiceDate: z.date().optional(),
});
type ServiceRecordFormValues = z.infer<typeof serviceRecordSchema>;

const EcareItemFormDialog = ({ open, onOpenChange, onSave, item }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (data: EcareItemFormValues, id?: string) => void, item: EcareItem | null }) => {
  const form = useForm<EcareItemFormValues>({
    resolver: zodResolver(ecareItemSchema),
  });

  useEffect(() => {
    if (item) {
      form.reset({
        ...item,
        purchaseDate: new Date(item.purchaseDate),
        recoveredAmount: item.recoveredAmount || 0,
      });
    } else {
      form.reset({ name: '', category: '', purchaseDate: new Date(), purchasePrice: 0, recoveredAmount: 0, warrantyPeriod: '', notes: '' });
    }
  }, [item, open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>{item ? 'Edit Item' : 'Add New Item'}</DialogTitle></DialogHeader>
        <form onSubmit={form.handleSubmit(data => onSave(data, item?.id))} className="space-y-4 py-4">
          <div className="space-y-1"><Label>Name</Label><Input {...form.register('name')} />{form.formState.errors.name && <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>}</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Category</Label><Input {...form.register('category')} placeholder="e.g., Car, AC" />{form.formState.errors.category && <p className="text-destructive text-xs">{form.formState.errors.category.message}</p>}</div>
            <div className="space-y-1"><Label>Purchase Date</Label><Controller name="purchaseDate" control={form.control} render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Purchase Price</Label><Input type="number" {...form.register('purchasePrice')} /></div>
            <div className="space-y-1"><Label>Recovered Amount</Label><Input type="number" {...form.register('recoveredAmount')} /></div>
          </div>
           <div className="space-y-1"><Label>Warranty Period</Label><Input {...form.register('warrantyPeriod')} placeholder="e.g., 2 years, 6 months" /></div>
          <div className="space-y-1"><Label>Notes</Label><Textarea {...form.register('notes')} /></div>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Save</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const ServiceRecordFormDialog = ({ open, onOpenChange, onSave, itemId }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (data: ServiceRecordFormValues, eqId: string) => void, itemId: string }) => {
  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<ServiceRecordFormValues>({
    resolver: zodResolver(serviceRecordSchema),
    defaultValues: { date: new Date(), cost: 0 }
  });

  useEffect(() => {
    if (!open) reset({ date: new Date(), cost: 0, servicePerson: '', description: '', nextServiceDate: undefined });
  }, [open, reset]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Service Record</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit((data) => onSave(data, itemId))} className="space-y-4 py-4">
          <div className="space-y-1"><Label>Description</Label><Textarea {...register('description')} />{errors.description && <p className="text-destructive text-xs">{errors.description.message}</p>}</div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Service Person</Label><Input {...register('servicePerson')} />{errors.servicePerson && <p className="text-destructive text-xs">{errors.servicePerson.message}</p>}</div>
            <div className="space-y-1"><Label>Phone</Label><Input {...register('servicePersonPhone')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1"><Label>Service Date</Label><Controller name="date" control={control} render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />} /></div>
            <div className="space-y-1"><Label>Cost</Label><Input type="number" {...register('cost')} /></div>
          </div>
          <div className="space-y-1"><Label>Next Service Date (Optional)</Label><Controller name="nextServiceDate" control={control} render={({ field }) => <DatePicker value={field.value} onChange={field.onChange} />} /></div>
          <DialogFooter><Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit">Add Record</Button></DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

const WarrantyInfo = ({ purchaseDate, warrantyPeriod }: { purchaseDate: string; warrantyPeriod: string; }) => {
    if (!warrantyPeriod) return <span>-</span>;
    
    const calculateEndDate = () => {
        try {
            const pDate = parseISO(purchaseDate);
            const match = warrantyPeriod.match(/(\d+)\s*(year|month|day)s?/i);
            if (!match) return null; // Can't parse duration
            
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();

            if (unit.startsWith('year')) return addYears(pDate, value);
            if (unit.startsWith('month')) return addMonths(pDate, value);
            if (unit.startsWith('day')) return addDays(pDate, value);
            return null;
        } catch (e) {
            console.error("Error parsing date for warranty calculation:", e);
            return null;
        }
    }

    const endDate = calculateEndDate();
    if(!endDate) return <span>{warrantyPeriod}</span>; // Show original text if parsing failed

    const isExpired = isPast(endDate);

    return (
        <div className="flex flex-col">
            <span className={cn(isExpired && 'text-red-500 line-through')}>{formatDate(endDate.toISOString())}</span>
             {!isExpired && (
                <span className="text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(endDate, { addSuffix: true })}
                </span>
             )}
              {isExpired && (
                <span className="text-xs font-bold text-red-500">Expired</span>
             )}
        </div>
    )
}

function EcarePageContent() {
  const [items, setItems] = useState<EcareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EcareItem | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string>('');
  const [filters, setFilters] = useState({ search: '', category: 'all' });
  const { toast } = useToast();

  useEffect(() => {
    const unsub = subscribeToEcareItems(setItems, (err) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      setLoading(false);
    });
    setLoading(false);
    return () => unsub();
  }, [toast]);

  const categories = useMemo(() => ['all', ...Array.from(new Set(items.map(e => e.category)))], [items]);

  const filteredItems = useMemo(() => {
    return items.filter(e => {
      const searchMatch = filters.search ? e.name.toLowerCase().includes(filters.search.toLowerCase()) || e.category.toLowerCase().includes(filters.search.toLowerCase()) : true;
      const categoryMatch = filters.category === 'all' || e.category === filters.category;
      return searchMatch && categoryMatch;
    }).sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
  }, [items, filters]);

  const handleSaveItem = async (data: EcareItemFormValues, id?: string) => {
    try {
      const itemData: Partial<EcareItem> = { 
          ...data, 
          purchaseDate: data.purchaseDate.toISOString(),
          recoveredAmount: data.recoveredAmount || 0,
      };
      if (id) {
        await updateEcareItem(id, itemData);
        toast({ title: 'Success', description: 'Item updated.' });
      } else {
        await addEcareItem({ ...itemData, serviceHistory: [] } as Omit<EcareItem, 'id'>);
        toast({ title: 'Success', description: 'New item added.' });
      }
      setIsItemFormOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  
  const handleDeleteItem = async (id: string) => {
      await deleteEcareItem(id);
      toast({title: 'Item Deleted'});
  }

  const handleAddService = async (data: ServiceRecordFormValues, itemId: string) => {
    try {
        const newRecord: ServiceRecord = {
            id: `maint-${Date.now()}`,
            ...data,
            date: data.date.toISOString(),
            nextServiceDate: data.nextServiceDate?.toISOString(),
        };
        await addServiceRecord(itemId, newRecord);

        if(data.nextServiceDate) {
            await updateEcareItem(itemId, { nextServiceDate: data.nextServiceDate.toISOString() });
        }

        toast({ title: 'Success', description: 'Service record added.' });
        setIsServiceFormOpen(false);
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  
  const handleDeleteService = async (itemId: string, serviceId: string) => {
      await deleteServiceRecord(itemId, serviceId);
      toast({title: 'Record Deleted'});
  }
  
  const { totalServiceCost, totalNetCost } = useMemo(() => {
    const serviceCost = items.reduce((total, eq) => total + (eq.serviceHistory || []).reduce((sum, hist) => sum + hist.cost, 0), 0);
    const netCost = items.reduce((total, eq) => total + (eq.purchasePrice - (eq.recoveredAmount || 0)), 0);
    return { totalServiceCost: serviceCost, totalNetCost: netCost };
  }, [items]);

  return (
    <div className="space-y-6">
      <EcareItemFormDialog open={isItemFormOpen} onOpenChange={setIsItemFormOpen} onSave={handleSaveItem} item={editingItem} />
      <ServiceRecordFormDialog open={isServiceFormOpen} onOpenChange={setIsServiceFormOpen} onSave={handleAddService} itemId={selectedItemId} />

      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3"><HeartPulse /> E-care</h1>
          <p className="text-muted-foreground mt-1">Track products, warranties, services, and costs.</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setIsItemFormOpen(true); }}><Plus className="mr-2 h-4 w-4"/> Add Item</Button>
      </header>

       <Card>
            <CardHeader><CardTitle>Overall Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                    <p className="text-sm text-blue-600">Total Items</p>
                    <p className="font-bold text-2xl text-blue-700">{items.length}</p>
                </div>
                 <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                    <p className="text-sm text-purple-600">Total Net Cost</p>
                    <p className="font-bold text-2xl text-purple-700">{formatAmount(totalNetCost)}</p>
                </div>
                 <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <p className="text-sm text-red-600">Total Service Cost</p>
                    <p className="font-bold text-2xl text-red-700">{formatAmount(totalServiceCost)}</p>
                </div>
            </CardContent>
        </Card>

      <Card>
        <CardHeader>
            <CardTitle>Item List</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <div className="relative flex-grow">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search by name or category..." value={filters.search} onChange={e => setFilters({...filters, search: e.target.value})} className="pl-10"/>
                </div>
                 <Select value={filters.category} onValueChange={v => setFilters({...filters, category: v})}>
                    <SelectTrigger className="w-full sm:w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {categories.map(cat => <SelectItem key={cat} value={cat}>{cat === 'all' ? 'All Categories' : cat}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </CardHeader>
        <CardContent>
            {loading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div> : 
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Purchase Date</TableHead>
                    <TableHead>Purchase Price</TableHead>
                    <TableHead>Recovered Amount</TableHead>
                    <TableHead>Net Cost</TableHead>
                    <TableHead>Warranty</TableHead>
                    <TableHead>Next Service</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredItems.length > 0 ? filteredItems.map(item => {
                        const isNextServiceDue = item.nextServiceDate ? isPast(parseISO(item.nextServiceDate)) : false;
                        const netCost = item.purchasePrice - (item.recoveredAmount || 0);
                        const totalServiceCostForItem = item.serviceHistory?.reduce((sum, s) => sum + s.cost, 0) || 0;
                        return (
                            <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.name}</TableCell>
                                <TableCell><Badge variant="secondary">{item.category}</Badge></TableCell>
                                <TableCell>{formatDate(item.purchaseDate)}</TableCell>
                                <TableCell>{formatAmount(item.purchasePrice)}</TableCell>
                                <TableCell>{formatAmount(item.recoveredAmount || 0)}</TableCell>
                                <TableCell className="font-semibold">{formatAmount(netCost)}</TableCell>
                                <TableCell>
                                    <WarrantyInfo purchaseDate={item.purchaseDate} warrantyPeriod={item.warrantyPeriod} />
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <span className={cn(isNextServiceDue && 'font-bold text-red-500')}>
                                            {item.nextServiceDate ? formatDate(item.nextServiceDate) : '-'}
                                            {isNextServiceDue && ' (Due)'}
                                        </span>
                                        {totalServiceCostForItem > 0 && (
                                            <Badge variant="outline" className="mt-1 w-fit">
                                                Cost: {formatAmount(totalServiceCostForItem)}
                                            </Badge>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical/></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => { setSelectedItemId(item.id); setIsServiceFormOpen(true); }}><Wrench className="mr-2 h-4 w-4"/>Add Service Record</DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => { setEditingItem(item); setIsItemFormOpen(true); }}><Edit className="mr-2 h-4 w-4"/>Edit Item</DropdownMenuItem>
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={(e)=>e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem></AlertDialogTrigger>
                                                <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Confirm Delete</AlertDialogTitle><AlertDialogDescriptionComponent>Are you sure you want to delete {item.name}?</AlertDialogDescriptionComponent></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={()=>handleDeleteItem(item.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                                            </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        )
                    }) : (
                        <TableRow>
                            <TableCell colSpan={9} className="h-24 text-center">No items found.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
              </Table>
            </div>
            }
        </CardContent>
      </Card>
    </div>
  )
}

export default function EcarePage() {
    return <EcarePageContent />;
}
