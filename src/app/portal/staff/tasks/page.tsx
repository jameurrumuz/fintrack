

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { subscribeToPartyById, logActivity } from '@/services/portalService';
import type { Party, Task } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, User, LogOut, CheckSquare, Plus, Map, Briefcase, Flag, Calendar, Phone, MessageSquare, MoreVertical, Edit, Trash2, Users2 } from 'lucide-react';
import Link from 'next/link';
import { Sidebar, SidebarProvider, SidebarContent, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarTrigger } from '@/components/ui/sidebar';
import { subscribeToTasksForStaff, updateTask, deleteTask } from '@/services/taskService';
import { subscribeToParties } from '@/services/partyService';
import { formatDistanceToNow, parseISO, isPast } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import TaskCard from '@/components/TaskCard';

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}


export default function StaffTasksPage() {
  const [staff, setStaff] = useState<Party | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const partyId = getCookie('loggedInPartyId');
    if (!partyId) {
      setError('Could not find user information. Please log in again.');
      setLoading(false);
      return;
    }

    const unsubStaff = subscribeToPartyById(partyId, (fetchedParty) => {
        if (fetchedParty) setStaff(fetchedParty);
    }, setError);
    const unsubTasks = subscribeToTasksForStaff(partyId, (staffTasks) => {
        setTasks(staffTasks);
        setLoading(false);
    }, setError);
    const unsubParties = subscribeToParties(setParties, setError);

    return () => {
      unsubStaff();
      unsubTasks();
      unsubParties();
    };
  }, []);

  const handleLogout = () => {
    document.cookie = 'userType=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    document.cookie = 'loggedInPartyId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    document.cookie = 'isMobileView=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    window.location.href = '/portal/login'; // Force a full page reload
  };
  
  const handleCall = (phone: string, partyId: string, taskTitle: string) => {
      logActivity(partyId, 'call_made', { details: `Called customer for task: ${taskTitle}` });
      window.open(`tel:${phone}`);
  };

  const handleTaskUpdate = async (taskId: string, updateData: Partial<Task>) => {
      await updateTask(taskId, updateData);
  }

  const handleTaskDelete = async (taskId: string) => {
      if(confirm("Are you sure you want to delete this task?")) {
        await deleteTask(taskId);
      }
  }


  if (loading) {
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
                        <SidebarMenuButton asChild>
                           <Link href="/portal/staff/customers"><Users2/> Customers</Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={true}>
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
                        <CardTitle>My Assigned Tasks</CardTitle>
                        <CardDescription>All tasks assigned to you by the admin.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {tasks.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {tasks.map(task => (
                                    <TaskCard 
                                        key={task.id} 
                                        task={task} 
                                        parties={parties} 
                                        onCall={handleCall}
                                        onUpdateStatus={(id, status) => handleTaskUpdate(id, { status })}
                                        onAddComment={(id) => {}}
                                        onSetReminder={(id) => {}}
                                        onEdit={(t) => {}}
                                        onDelete={handleTaskDelete}
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-10">You have no assigned tasks.</p>
                        )}
                    </CardContent>
                 </Card>
            </div>
        </main>
      </div>
    </SidebarProvider>
  );
}
