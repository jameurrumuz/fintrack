
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToPartyById, logActivity } from '@/services/portalService';
import type { Party, Task, Transaction, AppSettings } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, User, LogOut, CheckSquare, Plus, Map, Briefcase, Users2, CreditCard } from 'lucide-react';
import Link from 'next/link';
import { Sidebar, SidebarProvider, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from '@/components/ui/sidebar';
import { subscribeToTasksForStaff } from '@/services/taskService';
import { subscribeToTransactionsForVerification, updateTransaction } from '@/services/transactionService';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, formatAmount } from '@/lib/utils';
import { getAppSettings } from '@/services/settingsService';
import { subscribeToParties } from '@/services/partyService';


function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export default function StaffDashboardPage() {
  const [staff, setStaff] = useState<Party | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [verifiableTransactions, setVerifiableTransactions] = useState<Transaction[]>([]);
  const [allParties, setAllParties] = useState<Party[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const partyId = getCookie('loggedInPartyId');
    if (!partyId) {
      setError('Could not find user information. Please log in again.');
      setLoading(false);
      return;
    }

    let unsubStaff: () => void;
    let unsubTasks: () => void;
    let unsubVerifiableTx: () => void;
    
    const unsubParties = subscribeToParties(setAllParties, console.error);
    getAppSettings().then(setAppSettings);


    unsubStaff = subscribeToPartyById(
      partyId,
      (fetchedParty) => {
        if (fetchedParty && fetchedParty.partyType === 'Staff') {
          setStaff(fetchedParty);
          unsubTasks = subscribeToTasksForStaff(partyId, setTasks, (err) => setError(err.message));
          unsubVerifiableTx = subscribeToTransactionsForVerification(partyId, setVerifiableTransactions, (err) => setError(err.message));
        } else {
          setError('You do not have staff permissions.');
        }
        setLoading(false);
      },
      (e) => {
        setError('An error occurred while fetching your data.');
        setLoading(false);
      }
    );

    return () => {
      if (unsubStaff) unsubStaff();
      if (unsubTasks) unsubTasks();
      if (unsubVerifiableTx) unsubVerifiableTx();
      if (unsubParties) unsubParties();
    };
  }, [toast]);
  
  const handlePaymentApproval = async (transaction: Transaction, approve: boolean) => {
      try {
        const status = approve ? 'approved' : 'rejected';
        await updateTransaction(transaction.id, { paymentStatus: status, enabled: approve });
        toast({ title: 'Success', description: `Payment has been ${status}.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Could not process payment: ${error.message}` });
      }
  };
  
  const pendingPayments = useMemo(() => {
      if (!staff || !staff.id) return [];
      return verifiableTransactions.filter(t => t.paymentStatus === 'pending');
  }, [verifiableTransactions, staff]);

  const getPartyName = (partyId?: string) => {
      if (!partyId) return 'N/A';
      return allParties.find(p => p.id === partyId)?.name || 'Unknown Party';
  }


  const handleLogout = async () => {
    const partyId = getCookie('loggedInPartyId');
    if (partyId) {
      await logActivity(partyId, 'logout');
    }
    document.cookie = 'userType=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    document.cookie = 'loggedInPartyId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    document.cookie = 'isMobileView=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    window.location.href = '/portal/login'; // Force a full page reload
  };

  if (loading || !staff) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  const pendingTasks = tasks.filter(t => t.status === 'in-progress').length;

  return (
    <SidebarProvider>
      <div className="flex h-screen bg-muted/40">
        <Sidebar>
            <SidebarContent className="p-2">
                <SidebarMenu>
                     <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={true}>
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

            <div className="p-4 sm:p-6 space-y-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Dashboard Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-4 sm:grid-cols-2">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Pending Tasks</CardTitle>
                                <CheckSquare className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                             <CardContent>
                                <div className="text-2xl font-bold">{pendingTasks}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Site Visits Today</CardTitle>
                                <Map className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                             <CardContent>
                                <div className="text-2xl font-bold">0</div>
                                <p className="text-xs text-muted-foreground">Feature coming soon</p>
                            </CardContent>
                        </Card>
                    </CardContent>
                 </Card>

                 {pendingPayments.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><CreditCard/> Payment Verification Requests</CardTitle>
                      <CardDescription>Review and approve payments submitted by customers for services you can verify.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <Table>
                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Party</TableHead><TableHead>Amount</TableHead><TableHead>Method/TrxID</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                        {pendingPayments.map(tx => (
                          <TableRow key={tx.id}>
                            <TableCell>{formatDate(tx.date)}</TableCell>
                            <TableCell>{getPartyName(tx.partyId)}</TableCell>
                            <TableCell>{formatAmount(tx.amount)}</TableCell>
                            <TableCell>{tx.description}</TableCell>
                            <TableCell className="text-right">
                              <div className="flex gap-2 justify-end">
                                <Button size="sm" variant="destructive" onClick={() => handlePaymentApproval(tx, false)}>Reject</Button>
                                <Button size="sm" onClick={() => handlePaymentApproval(tx, true)}>Approve</Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        </TableBody>
                       </Table>
                    </CardContent>
                  </Card>
                 )}
            </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
