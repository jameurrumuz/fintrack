

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, User, LogOut, Briefcase, CheckSquare, Plus, Map, Users2, Search } from 'lucide-react';
import Link from 'next/link';
import { Sidebar, SidebarProvider, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from '@/components/ui/sidebar';
import { subscribeToPartyById } from '@/services/portalService';
import { subscribeToViewableParties } from '@/services/partyService';
import type { Party, Transaction } from '@/types';
import { getPartyBalanceEffect, formatAmount, formatDate } from '@/lib/utils';
import { subscribeToTransactionsForPartyIds } from '@/services/transactionService';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export default function StaffCustomersPage() {
    const [staff, setStaff] = useState<Party | null>(null);
    const [viewableParties, setViewableParties] = useState<Party[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const router = useRouter();

    useEffect(() => {
        const partyId = getCookie('loggedInPartyId');
        if (!partyId) {
            router.push('/portal/login');
            return;
        }

        const unsubStaff = subscribeToPartyById(partyId, (fetchedStaff) => {
            if (fetchedStaff) {
                setStaff(fetchedStaff);
                // Once we have the staff member's permissions, we can subscribe to their viewable parties.
                subscribeToViewableParties(fetchedStaff, setViewableParties, console.error);
            } else {
                setLoading(false);
            }
        }, console.error);
        
        return () => unsubStaff();
    }, [router]);
    
    // This effect runs when `viewableParties` changes.
    useEffect(() => {
        if (viewableParties.length === 0) {
            setTransactions([]); // Clear transactions if no parties are viewable
            setLoading(false);
            return;
        }
        const partyIds = viewableParties.map(p => p.id);
        const unsubTransactions = subscribeToTransactionsForPartyIds(partyIds, setTransactions, console.error);
        setLoading(false);
        return () => unsubTransactions();
    }, [viewableParties]);
    
    const partyBalances = useMemo(() => {
        const balances: { [partyId: string]: number } = {};
        for (const tx of transactions) {
            if (tx.partyId) {
                if (!balances[tx.partyId]) balances[tx.partyId] = 0;
                balances[tx.partyId] += getPartyBalanceEffect(tx);
            }
        }
        return balances;
    }, [transactions]);
    
    const filteredCustomers = useMemo(() => {
        return viewableParties.filter(party => {
            return searchTerm 
                ? party.name.toLowerCase().includes(searchTerm.toLowerCase()) || party.phone?.includes(searchTerm) 
                : true;
        }).map(party => ({
            ...party,
            balance: partyBalances[party.id] || 0
        })).sort((a, b) => a.name.localeCompare(b.name));
    }, [viewableParties, searchTerm, partyBalances]);


    const handleLogout = () => {
        document.cookie = 'userType=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
        document.cookie = 'loggedInPartyId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
        document.cookie = 'isMobileView=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
        window.location.href = '/portal/login';
    };

    if (loading || !staff) {
        return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }

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
                                <SidebarMenuButton asChild isActive={true}>
                                <Link href="/portal/staff/customers"><Users2/> Customers</Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild>
                                <Link href="/portal/staff/tasks"><CheckSquare/> My Tasks</Link>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                            <SidebarMenuItem>
                                <SidebarMenuButton asChild>
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
                                <CardTitle>My Customer List</CardTitle>
                                <CardDescription>Showing customers based on your assigned permissions.</CardDescription>
                                <div className="relative pt-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                                    <Input 
                                        placeholder="Search customers..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-10"
                                    />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Phone</TableHead>
                                                <TableHead>Address</TableHead>
                                                <TableHead className="text-right">Balance</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredCustomers.length > 0 ? filteredCustomers.map(party => (
                                                <TableRow key={party.id}>
                                                     <TableCell className="font-medium flex items-center gap-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={party.imageUrl} alt={party.name} />
                                                            <AvatarFallback>{party.name.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        {party.name}
                                                    </TableCell>
                                                    <TableCell>{party.phone || 'N/A'}</TableCell>
                                                    <TableCell>{party.address || 'N/A'}</TableCell>
                                                    <TableCell className={cn("text-right font-mono", party.balance < 0 ? 'text-green-600' : 'text-red-600')}>
                                                        {formatAmount(party.balance)}
                                                    </TableCell>
                                                </TableRow>
                                            )) : (
                                                <TableRow><TableCell colSpan={4} className="h-24 text-center">No customers found.</TableCell></TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </main>
            </div>
        </SidebarProvider>
    );
}
