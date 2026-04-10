

'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, LogOut, Plus, Map, Briefcase, CheckSquare, Save, Users2 } from 'lucide-react';
import Link from 'next/link';
import { Sidebar, SidebarProvider, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from '@/components/ui/sidebar';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { getAppSettings } from '@/services/settingsService';
import { addParty } from '@/services/partyService';
import { AppSettings, Party } from '@/types';
import { subscribeToPartyById } from '@/services/portalService';


const partySchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  group: z.string().optional(),
  partyType: z.string().optional(),
  status: z.string().optional(),
});
type PartyFormValues = z.infer<typeof partySchema>;

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export default function StaffAddPartyPage() {
    const [staff, setStaff] = useState<Party | null>(null);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const router = useRouter();
    const { toast } = useToast();

    const form = useForm<PartyFormValues>({
        resolver: zodResolver(partySchema),
        defaultValues: { name: '', phone: '', address: '', group: '', partyType: '', status: '' },
    });

    useEffect(() => {
        const partyId = getCookie('loggedInPartyId');
        if (!partyId) {
            router.push('/portal/login');
            return;
        }

        const unsubStaff = subscribeToPartyById(partyId, setStaff, console.error);
        getAppSettings().then(setAppSettings);

        return () => unsubStaff();
    }, [router]);
    
     const handleLogout = () => {
        document.cookie = 'userType=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
        document.cookie = 'loggedInPartyId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
        document.cookie = 'isMobileView=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
        window.location.href = '/portal/login'; // Force a full page reload
    };

    const handleFormSubmit = async (data: PartyFormValues) => {
        setIsSaving(true);
        try {
            const finalData = { ...data, lastContacted: new Date().toISOString() };
            await addParty(finalData);
            toast({ title: "Success", description: "New party added successfully." });
            form.reset();
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Error", description: `Could not add party: ${error.message}` });
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
     <SidebarProvider>
      <div className="flex h-screen bg-muted/40">
        <Sidebar>
            <SidebarContent className="p-2">
                <SidebarMenu>
                     <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                           <Link href="/portal/staff/dashboard"><Briefcase/> Dashboard</Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                           <Link href="/portal/staff/customers"><Users2/> Customers</Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild>
                           <Link href="/portal/staff/tasks"><CheckSquare/> My Tasks</Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={true}>
                            <Link href="/portal/staff/add-party"><Plus/> Add New Party</Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                        <SidebarMenuButton asChild disabled>
                           <Link href="/portal/staff/site-visits"><Map/> Site Visits</Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarContent>
        </Sidebar>

        <main className="flex-1 overflow-y-auto">
            <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6 py-4">
                 <SidebarTrigger className="md:hidden" />
                 <div className="flex items-center gap-3">
                    <User className="h-8 w-8 text-primary" />
                    <div>
                        <h1 className="text-xl font-bold">Welcome, {staff?.name}!</h1>
                        <p className="text-xs text-muted-foreground">{staff?.phone}</p>
                    </div>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    <Button onClick={handleLogout} variant="outline" size="sm">
                        <LogOut className="mr-2 h-4 w-4" />
                        Log Out
                    </Button>
                </div>
            </header>

            <div className="p-4 sm:p-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Add a New Party/Customer</CardTitle>
                        <CardDescription>Fill out the form to add a new contact to the system.</CardDescription>
                    </CardHeader>
                    <form onSubmit={form.handleSubmit(handleFormSubmit)}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Name</Label>
                                <Input id="name" {...form.register('name')} />
                                {form.formState.errors.name && <p className="text-red-500 text-xs mt-1">{form.formState.errors.name.message}</p>}
                            </div>
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="phone">Phone</Label>
                                    <Input id="phone" {...form.register('phone')} />
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
                                        {appSettings?.partyTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                                )} />
                            </div>
                             <div className="space-y-2">
                                <Label htmlFor="address">Address</Label>
                                <Input id="address" {...form.register('address')} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="status">Opening Note / Status</Label>
                                <Textarea id="status" {...form.register('status')} placeholder="e.g., Initial contact made, interested in product X..." />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isSaving}>
                                {isSaving ? <><Loader2 className="animate-spin mr-2"/> Saving...</> : <><Save className="mr-2 h-4 w-4"/>Save Party</>}
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            </div>
        </main>
      </div>
    </SidebarProvider>
    )
}
