

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToPartyById } from '@/services/portalService';
import type { Party, Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Loader2, User, LogOut, CheckSquare, Plus, Map, Briefcase, Users2 } from 'lucide-react';
import Link from 'next/link';
import { Sidebar, SidebarProvider, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from '@/components/ui/sidebar';

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export default function SiteVisitsPage() {
    const [staff, setStaff] = useState<Party | null>(null);
    const router = useRouter();

    useEffect(() => {
        const partyId = getCookie('loggedInPartyId');
        if (!partyId) {
            router.push('/portal/login');
            return;
        }

        const unsubStaff = subscribeToPartyById(partyId, setStaff, console.error);
        return () => unsubStaff();
    }, [router]);
    
     const handleLogout = () => {
        document.cookie = 'userType=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        document.cookie = 'loggedInPartyId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/portal/login'; // Force a full page reload
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
                        <SidebarMenuButton asChild>
                            <Link href="/portal/staff/add-party"><Plus/> Add New Party</Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                     <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={true} disabled>
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
                        <CardTitle>Site Visits</CardTitle>
                        <CardDescription>This feature is coming soon. You will be able to log your site visits here.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-48 flex items-center justify-center">
                        <p className="text-muted-foreground">Coming Soon</p>
                    </CardContent>
                 </Card>
            </div>
        </main>
      </div>
    </SidebarProvider>
    )
}
