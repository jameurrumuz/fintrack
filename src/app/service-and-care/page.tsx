
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Wrench, Plus, Edit, Trash2, Loader2, Package, Wallet, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToAccounts } from '@/services/accountService';
import type { AppSettings, CustomerService, InventoryItem, Party, Account } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { ServiceFormDialog } from '@/app/settings/page';
import { formatAmount } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';


export default function ServiceAndCarePage() {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingService, setEditingService] = useState<CustomerService | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    getAppSettings().then(setAppSettings);
    const unsubInventory = subscribeToInventoryItems(setInventoryItems, console.error);
    const unsubParties = subscribeToParties(setParties, console.error);
    const unsubAccounts = subscribeToAccounts(setAccounts, console.error);
    
    const timer = setTimeout(() => setLoading(false), 500);

    return () => {
      unsubInventory();
      unsubParties();
      unsubAccounts();
      clearTimeout(timer);
    };
  }, []);

  const handleSaveService = async (serviceData: CustomerService) => {
    if (!appSettings) return;

    const currentServices = appSettings.customerServices || [];
    let updatedServices;

    const existingIndex = currentServices.findIndex(s => s.id === serviceData.id);

    if (existingIndex > -1) {
        updatedServices = currentServices.map((s, i) => i === existingIndex ? serviceData : s);
    } else {
        updatedServices = [...currentServices, serviceData];
    }
    
    try {
        await saveAppSettings({ ...appSettings, customerServices: updatedServices });
        setAppSettings(prev => ({...prev!, customerServices: updatedServices}));
        toast({ title: 'Success', description: `Service "${serviceData.name}" has been saved.` });
        setIsFormOpen(false);
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Could not save service: ${e.message}`});
    }
  };
  
  const handleDeleteService = async (serviceId: string) => {
    if (!appSettings) return;
    const updatedServices = (appSettings.customerServices || []).filter(s => s.id !== serviceId);
    try {
        await saveAppSettings({ ...appSettings, customerServices: updatedServices });
        setAppSettings(prev => ({...prev!, customerServices: updatedServices}));
        toast({ title: 'Success', description: 'Service has been deleted.'});
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  }
  
  const incomeServices = useMemo(() => {
    return (appSettings?.customerServices || []).filter(s => s.type === 'income' || s.type === 'sale');
  }, [appSettings]);


  if (loading) {
      return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
        <ServiceFormDialog 
            open={isFormOpen}
            onOpenChange={setIsFormOpen}
            onSave={handleSaveService}
            service={editingService}
            inventoryItems={inventoryItems}
            staffList={parties.filter(p => p.partyType === 'Staff')}
            accounts={accounts}
            allowedTypes={['income', 'sale', 'receive', 'give']}
            appSettings={appSettings}
        />
        <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-2xl"><Wrench/> Service & Care Management</CardTitle>
                        <CardDescription>Add, edit, or remove the services your business offers.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingService(null); setIsFormOpen(true);}}>
                        <Plus className="mr-2 h-4 w-4"/> Add New Service
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {incomeServices.length > 0 ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {incomeServices.map(service => (
                            <Card key={service.id}>
                                <CardHeader className="flex-row items-start justify-between">
                                    <div className="space-y-1">
                                        <CardTitle className="flex items-center gap-2 text-lg">
                                            {service.type === 'sale' ? <Package className="h-5 w-5"/> : <Wallet className="h-5 w-5"/>}
                                            {service.name}
                                        </CardTitle>
                                        <CardDescription>{service.description || 'No description'}</CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4"/></Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent>
                                            <DropdownMenuItem onClick={() => { setEditingService(service); setIsFormOpen(true); }}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                                             <AlertDialog>
                                                <AlertDialogTrigger asChild><DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem></AlertDialogTrigger>
                                                <AlertDialogContent>
                                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescriptionComponent>This will permanently delete the "{service.name}" service.</AlertDialogDescriptionComponent></AlertDialogHeader>
                                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteService(service.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                                </AlertDialogContent>
                                             </AlertDialog>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </CardHeader>
                                <CardFooter className="pt-4">
                                     <Badge variant={service.type === 'sale' ? 'default' : 'secondary'}>{service.type}</Badge>
                                     <p className="font-bold text-lg ml-auto">{formatAmount(service.price || 0)}</p>
                                </CardFooter>
                            </Card>
                        ))}
                     </div>
                ) : (
                    <div className="text-center py-16 border-2 border-dashed rounded-lg">
                        <h3 className="text-xl font-semibold">No Services Added Yet</h3>
                        <p className="text-muted-foreground mt-2">Click "Add New Service" to get started.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    </div>
  );
}
