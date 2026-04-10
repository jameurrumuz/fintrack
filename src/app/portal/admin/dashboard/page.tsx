
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Shield, Users, LogOut, Edit, Briefcase, KeyRound, Bell, CreditCard, Activity, Plus, Flag, Calendar, Phone, Trash2, Settings, ChevronsUpDown, Check, UserPlus, Users2, MessageSquare, Target } from 'lucide-react';
import { subscribeToParties, updateParty } from '@/services/partyService';
import { getAppSettings } from '@/services/settingsService';
import { subscribeToAllTransactions, updateTransaction } from '@/services/transactionService';
import { subscribeToTasks, addTask, updateTask, deleteTask } from '@/services/taskService';
import type { Party, Transaction, Task, AppSettings, InventoryItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { formatDate, formatAmount } from '@/lib/utils';
import { differenceInMinutes, parseISO, format, formatDistanceToNow, isPast } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import TaskCard from '@/components/TaskCard';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { Checkbox } from '@/components/ui/checkbox';


const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string().min(1, 'Due date is required'),
  progress: z.coerce.number().min(0).max(100),
  assignedToId: z.string().optional(),
  partyId: z.string().optional(),
});
type TaskFormValues = z.infer<typeof taskSchema>;

const taskCategories = ['Collection', 'Business', 'Office Work', 'Family', 'Relatives', 'Health', 'Loan', 'Finance', 'Maintenance', 'Other'];

const PartyCombobox = ({ parties, value, onChange }: { parties: Party[], value?: string, onChange: (value: string) => void }) => {
    const [open, setOpen] = useState(false);
    const selectedPartyName = parties.find(p => p.id === value)?.name;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    {selectedPartyName || "Select customer..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search customer..." />
                    <CommandList>
                        <CommandEmpty>No customer found.</CommandEmpty>
                        <CommandGroup>
                             <CommandItem value="none" onSelect={() => onChange('none')}>
                                <Check className={cn("mr-2 h-4 w-4", !value || value === 'none' ? "opacity-100" : "opacity-0")} />
                                None
                            </CommandItem>
                            {parties.map((party) => (
                                <CommandItem key={party.id} value={party.name} onSelect={() => { onChange(party.id); setOpen(false); }}>
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


const MultiSelect = ({ options, selected, onChange, placeholder }: { options: { value: string, label: string }[], selected: string[], onChange: (selected: string[]) => void, placeholder: string }) => {
    const [open, setOpen] = useState(false);
    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                    {selected.length > 0 ? `${selected.length} selected` : placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                        <CommandEmpty>Nothing found.</CommandEmpty>
                        <CommandGroup>
                            {options.map(option => (
                                <CommandItem key={option.value} onSelect={() => {
                                    const newSelected = selected.includes(option.value)
                                        ? selected.filter(s => s !== option.value)
                                        : [...selected, option.value];
                                    onChange(newSelected);
                                }}>
                                    <Check className={cn("mr-2 h-4 w-4", selected.includes(option.value) ? "opacity-100" : "opacity-0")} />
                                    {option.label}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

const StaffPermissionDialog = ({ staff, open, onOpenChange, appSettings }: { staff: Party, open: boolean, onOpenChange: (open: boolean) => void, appSettings: AppSettings | null }) => {
    const { toast } = useToast();
    const [viewablePartyTypes, setViewablePartyTypes] = useState(staff.viewablePartyTypes || []);
    const [viewablePartyGroups, setViewablePartyGroups] = useState(staff.viewablePartyGroups || []);

    const handleSave = async () => {
        try {
            await updateParty(staff.id, { viewablePartyTypes, viewablePartyGroups });
            toast({ title: 'Success', description: 'Staff permissions have been updated.' });
            onOpenChange(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Could not update permissions: ${error.message}` });
        }
    };
    
    const partyTypeOptions = appSettings?.partyTypes.map(t => ({ value: t, label: t })) || [];
    const partyGroupOptions = appSettings?.businessProfiles.map(p => ({ value: p.name, label: p.name })) || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Set Permissions for {staff.name}</DialogTitle>
                    <DialogDescription>Control which customer groups this staff member can see.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Allowed Customer Types</Label>
                        <MultiSelect options={partyTypeOptions} selected={viewablePartyTypes} onChange={setViewablePartyTypes} placeholder="Select party types..." />
                    </div>
                     <div className="space-y-2">
                        <Label>Allowed Customer Groups (Business Profiles)</Label>
                        <MultiSelect options={partyGroupOptions} selected={viewablePartyGroups} onChange={setViewablePartyGroups} placeholder="Select groups..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Permissions</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const AssignProductsDialog = ({ party, inventory, open, onOpenChange }: { party: Party; inventory: InventoryItem[]; open: boolean; onOpenChange: (open: boolean) => void; }) => {
    const { toast } = useToast();
    const [selectedProductIds, setSelectedProductIds] = useState<string[]>(party.marketingProductIds || []);

    const handleSave = async () => {
        try {
            await updateParty(party.id, { marketingProductIds: selectedProductIds });
            toast({ title: 'Success', description: `Products assigned to ${party.name}.` });
            onOpenChange(false);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Could not assign products: ${error.message}` });
        }
    };
    
    const handleProductSelect = (productId: string, checked: boolean) => {
        if (checked) {
            setSelectedProductIds(prev => [...prev, productId]);
        } else {
            setSelectedProductIds(prev => prev.filter(id => id !== productId));
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Assign Products to {party.name}</DialogTitle>
                </DialogHeader>
                <div className="flex-grow overflow-y-auto space-y-2 pr-4">
                    {inventory.map(item => (
                        <div key={item.id} className="flex items-center space-x-2">
                            <Checkbox 
                                id={`product-${item.id}`}
                                checked={selectedProductIds.includes(item.id)}
                                onCheckedChange={(checked) => handleProductSelect(item.id, !!checked)}
                            />
                            <Label htmlFor={`product-${item.id}`}>{item.name}</Label>
                        </div>
                    ))}
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave}>Save Assignments</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


export default function FinPlanAdminDashboard() {
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [resettingPartyId, setResettingPartyId] = useState<string | null>(null);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingStaffPermissions, setEditingStaffPermissions] = useState<Party | null>(null);
  const [verifyingPaymentTx, setVerifyingPaymentTx] = useState<Transaction | null>(null);
  const [verificationNote, setVerificationNote] = useState('');
  const [assigningProductsParty, setAssigningProductsParty] = useState<Party | null>(null);


  useEffect(() => {
    const unsubParties = subscribeToParties(setParties, (error) => toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch parties.' }));
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (error) => toast({ variant: 'destructive', title: 'Error fetching transactions', description: error.message }));
    const unsubTasks = subscribeToTasks(setTasks, (error) => toast({ variant: 'destructive', title: 'Error fetching tasks', description: error.message }));
    const unsubInventory = subscribeToInventoryItems(setInventory, (error) => toast({ variant: 'destructive', title: 'Error fetching inventory', description: error.message }));
    getAppSettings().then(setAppSettings);

    setLoading(false);
    
    return () => {
      unsubParties();
      unsubTransactions();
      unsubTasks();
      unsubInventory();
    };
  }, [toast]);
  
  const isOnline = (lastSeen?: string | null) => {
    if (!lastSeen) return false;
    try {
        let lastSeenDate;
        if (typeof lastSeen === 'string') {
            lastSeenDate = parseISO(lastSeen);
        } else if (lastSeen instanceof Date) {
            lastSeenDate = lastSeen;
        } else {
            return false;
        }
        
        if (isNaN(lastSeenDate.getTime())) return false;
        return differenceInMinutes(new Date(), lastSeenDate) < 5;
    } catch (e) {
        console.error("Error parsing lastSeen date:", lastSeen, e);
        return false;
    }
};


 const { 
    customers, 
    staff, 
    pendingNameChanges, 
    allPayments, 
    unreadMessagesCount, 
    marketingUsers 
  } = useMemo(() => {
    const customersUnsorted = parties.filter(p => p.partyType !== 'Staff' && p.partyType !== 'Marketing');
    const staffWithTaskCount = parties
      .filter(p => p.partyType === 'Staff')
      .map(s => ({
        ...s,
        totalTasks: tasks.filter(t => t.assignedToId === s.id).length,
        pendingTasks: tasks.filter(t => t.status === 'in-progress').length,
      }));
    const marketingUsers = parties.filter(p => p.partyType === 'Marketing');
    const pendingNameChanges = parties.filter(p => !!p.pendingNameChange);
    
    const allPaymentTxs = transactions
        .filter(t => t.serviceId || t.paymentStatus)
        .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const customers = customersUnsorted.sort((a, b) => {
        const aOnline = isOnline(a.lastSeen);
        const bOnline = isOnline(b.lastSeen);
        if (aOnline !== bOnline) return aOnline ? -1 : 1;
        const aHasPerm = a.permissions?.viewLedger;
        const bHasPerm = b.permissions?.viewLedger;
        if (aHasPerm !== bHasPerm) return aHasPerm ? -1 : 1;
        const aDate = a.lastSeen ? new Date(a.lastSeen).getTime() : 0;
        const bDate = b.lastSeen ? new Date(b.lastSeen).getTime() : 0;
        return bDate - aDate;
    });

    const unreadMessagesCount = parties.filter(p => p.hasUnreadAdminMessages).length;

    return { customers, staff: staffWithTaskCount, pendingNameChanges, allPayments: allPaymentTxs, unreadMessagesCount, marketingUsers };
  }, [parties, transactions, tasks]);
  
  const handlePermissionChange = async (partyId: string, permissionKey: string, value: boolean) => {
    try {
      const party = parties.find(p => p.id === partyId);
      if (!party) return;
      const newPermissions = { ...(party.permissions || {}), [permissionKey]: value };
      await updateParty(partyId, { permissions: newPermissions });
      toast({ title: 'Success', description: 'Permission updated successfully.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not update permission.' });
    }
  };

  const handlePasswordReset = async () => {
    if (!resettingPartyId || !newPassword) return;
    try {
      await updateParty(resettingPartyId, { password: newPassword });
      toast({ title: 'Success', description: 'Password has been reset.' });
    } catch (error) {
       toast({ variant: 'destructive', title: 'Error', description: 'Could not reset password.' });
    } finally {
        setResettingPartyId(null);
        setNewPassword('');
    }
  };

  const handleNameChangeApproval = async (partyId: string, newName: string, approve: boolean) => {
    try {
        const party = parties.find(p => p.id === partyId);
        if (!party) return;
        await updateParty(partyId, { name: approve ? newName : party.name, pendingNameChange: '' });
        toast({ title: 'Success', description: `Name change request has been ${approve ? 'approved' : 'rejected'}.` });
    } catch (error: any) {
         toast({ variant: 'destructive', title: 'Error', description: 'Could not process the request.' });
    }
  };

  const handlePaymentApproval = async (approve: boolean) => {
      if (!verifyingPaymentTx) return;
      try {
        const status = approve ? 'approved' : 'rejected';
        await updateTransaction(verifyingPaymentTx.id, { 
            paymentStatus: status, 
            enabled: approve,
            verifiedByStaffId: 'admin', // In a real app, get the logged in admin/staff ID
            verificationNote: verificationNote,
        });
        toast({ title: 'Success', description: `Payment has been ${status}.` });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Could not process payment: ${error.message}` });
      } finally {
        setVerifyingPaymentTx(null);
        setVerificationNote('');
      }
  };
  
  const handleSaveTask = async (data: TaskFormValues) => {
    try {
        const rawTaskData: Partial<Task> = {
            ...data,
            assignedToId: data.assignedToId === 'none' ? undefined : data.assignedToId,
            assignedToName: data.assignedToId && data.assignedToId !== 'none' ? staff.find(s => s.id === data.assignedToId)?.name : undefined,
            partyId: data.partyId === 'none' ? undefined : data.partyId,
            partyName: data.partyId && data.partyId !== 'none' ? parties.find(p => p.id === data.partyId)?.name : undefined,
        };

        const taskData = Object.fromEntries(Object.entries(rawTaskData).filter(([_, v]) => v !== undefined));

        if (editingTask) {
            await updateTask(editingTask.id, taskData);
            toast({ title: 'Task Updated' });
        } else {
            await addTask(taskData as any);
            toast({ title: 'Task Created' });
        }
        setIsTaskFormOpen(false);
        setEditingTask(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save Error', description: error.message });
    }
  };
  
  const handleEditTask = (task: Task) => {
    setEditingTask(task);
    setIsTaskFormOpen(true);
  };

  const handleDeleteTask = async (taskId: string) => {
      if(window.confirm('Are you sure you want to delete this task?')) {
          await deleteTask(taskId);
          toast({ title: 'Task Deleted'});
      }
  }

  const handleUpdateStatus = async (id: string, status: Task['status']) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;
      const progress = status === 'completed' ? 100 : task.progress === 100 ? 0 : task.progress;
      const historyEntry = { date: new Date().toISOString(), action: 'status_change', comment: `Status changed to ${status}` };
      await updateTask(id, { status, progress, history: [...task.history, historyEntry] });
  };
  
  const handleAddComment = async (id: string) => {
      const comment = prompt('Enter your comment:');
      if (comment) {
          const task = tasks.find(t => t.id === id);
          if (task) {
             const historyEntry = { date: new Date().toISOString(), action: 'comment', comment };
             await updateTask(id, { history: [...task.history, historyEntry] });
             toast({ title: 'Comment Added' });
          }
      }
  };

  const handleSetReminder = async (id: string) => {
      const dateTime = prompt('Enter reminder date and time (YYYY-MM-DD HH:MM):', format(new Date(), 'yyyy-MM-dd HH:mm'));
      if (dateTime) {
         try {
            const reminderDate = new Date(dateTime);
            if (isNaN(reminderDate.getTime())) throw new Error('Invalid date format');
            const task = tasks.find(t => t.id === id);
            if(task) {
                const historyEntry = { date: new Date().toISOString(), action: 'reminder_set', comment: `Reminder set for ${format(reminderDate, 'MMM d, h:mm a')}` };
                await updateTask(id, { reminder: reminderDate.toISOString(), reminderSent: false, history: [...task.history, historyEntry] });
                toast({ title: 'Reminder Set!' });
            }
         } catch (error) {
             alert('Invalid date/time. Please use YYYY-MM-DD HH:MM format.');
         }
      }
  };


  const handleLogout = () => {
    document.cookie = 'userType=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    document.cookie = 'loggedInPartyId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    document.cookie = 'isMobileView=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    window.location.href = '/portal/login';
  };
  
  const getPartyName = (partyId?: string) => {
    if (!partyId) return 'N/A';
    return parties.find(p => p.id === partyId)?.name || 'Unknown Party';
  };
  const getStaffName = (staffId?: string) => staff.find(s => s.id === staffId)?.name || staffId;


  const getStatusBadge = (tx: Transaction) => {
    const status = tx.paymentStatus || 'pending';
    const note = tx.verificationNote;
    const staffName = getStaffName(tx.verifiedByStaffId);
    const badgeText = tx.verifiedByStaffId ? `${status.charAt(0).toUpperCase() + status.slice(1)} by ${staffName}` : status.charAt(0).toUpperCase() + status.slice(1);
    
    let badge;
    switch (status) {
        case 'approved': 
            badge = <Badge className="bg-green-100 text-green-700">{badgeText}</Badge>;
            break;
        case 'rejected':
            badge = <Badge variant="destructive">{badgeText}</Badge>;
            break;
        case 'pending': 
        default:
            badge = <Badge variant="secondary">{badgeText}</Badge>;
            break;
    }
    
    return note ? <div>{badge}<p className="text-xs text-muted-foreground italic">Note: {note}</p></div> : badge;
  };

  const renderPaymentTable = (paymentTxs: Transaction[], title: string) => (
    <Table>
      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Party</TableHead><TableHead>Details</TableHead><TableHead>Ref#</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
      <TableBody>
      {paymentTxs.map(tx => (
          <TableRow key={tx.id}>
              <TableCell>{formatDate(tx.date)}</TableCell>
              <TableCell>{getPartyName(tx.partyId)}</TableCell>
              <TableCell>{tx.description}</TableCell>
              <TableCell className="font-mono">{tx.txRef}</TableCell>
              <TableCell>{formatAmount(tx.amount)}</TableCell>
              <TableCell>{getStatusBadge(tx)}</TableCell>
              <TableCell className="text-right">
                {tx.paymentStatus === 'pending' && (
                  <Button size="sm" onClick={() => setVerifyingPaymentTx(tx)}>Verify</Button>
                )}
              </TableCell>
          </TableRow>
      ))}
      {paymentTxs.length === 0 && <TableRow><TableCell colSpan={7} className="text-center h-24">No {title.toLowerCase()} found.</TableCell></TableRow>}
      </TableBody>
    </Table>
  );

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 p-4 sm:p-8">
      
       {editingStaffPermissions && <StaffPermissionDialog staff={editingStaffPermissions} open={!!editingStaffPermissions} onOpenChange={() => setEditingStaffPermissions(null)} appSettings={appSettings} />}
       {assigningProductsParty && <AssignProductsDialog party={assigningProductsParty} inventory={inventory} open={!!assigningProductsParty} onOpenChange={() => setAssigningProductsParty(null)} />}

        <Dialog open={!!verifyingPaymentTx} onOpenChange={() => setVerifyingPaymentTx(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Verify Payment</DialogTitle>
                    <DialogDescription>
                        For "{verifyingPaymentTx?.description}" - {formatAmount(verifyingPaymentTx?.amount || 0)} BDT
                    </DialogDescription>
                </DialogHeader>
                 <div className="space-y-2">
                    <Label htmlFor="verification-note">Note (Optional)</Label>
                    <Input id="verification-note" value={verificationNote} onChange={e => setVerificationNote(e.target.value)} placeholder="e.g., TrxID mismatch but amount confirmed." />
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => setVerifyingPaymentTx(null)}>Cancel</Button>
                    <div className="flex gap-2">
                        <Button variant="destructive" onClick={() => handlePaymentApproval(false)}>Reject</Button>
                        <Button onClick={() => handlePaymentApproval(true)}>Approve</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>


      <div className="max-w-7xl mx-auto">
        <header className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-3"><Shield className="h-8 w-8 text-primary" /><h1 className="text-3xl font-bold">Fin Plan Admin</h1></div>
            <div className="flex items-center gap-4">
                 <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadMessagesCount > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 justify-center p-1">{unreadMessagesCount}</Badge>}
                </Button>
                <Button onClick={handleLogout} variant="outline"><LogOut className="mr-2 h-4 w-4" /> Log Out</Button>
            </div>
        </header>
        
        <main>
            {pendingNameChanges.length > 0 && (
                <Card className="mb-6 bg-yellow-50 border-yellow-300">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-yellow-800"><Bell/> Name Change Requests</CardTitle></CardHeader>
                    <CardContent>
                        {pendingNameChanges.map(party => (
                            <div key={party.id} className="flex justify-between items-center p-2 border-b">
                                <div><p><span className="font-bold">{party.name}</span> wants to change name to <span className="font-bold text-primary">{party.pendingNameChange}</span></p></div>
                                <div className="flex gap-2"><Button size="sm" variant="outline" onClick={() => handleNameChangeApproval(party.id, party.pendingNameChange!, false)}>Reject</Button><Button size="sm" onClick={() => handleNameChangeApproval(party.id, party.pendingNameChange!, true)}>Approve</Button></div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}
            
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-blue-800">Payment Verification</CardTitle>
                    <CardDescription>Review and approve/reject payments submitted by customers and staff.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Tabs defaultValue="pending">
                        <TabsList>
                            <TabsTrigger value="pending">Pending</TabsTrigger>
                            <TabsTrigger value="approved">Approved</TabsTrigger>
                            <TabsTrigger value="rejected">Rejected</TabsTrigger>
                        </TabsList>
                        <TabsContent value="pending">
                            {renderPaymentTable(allPayments.filter(p => p.paymentStatus === 'pending'), 'Pending Payments')}
                        </TabsContent>
                        <TabsContent value="approved">
                             {renderPaymentTable(allPayments.filter(p => p.paymentStatus === 'approved'), 'Approved Payments')}
                        </TabsContent>
                        <TabsContent value="rejected">
                             {renderPaymentTable(allPayments.filter(p => p.paymentStatus === 'rejected'), 'Rejected Payments')}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>


            <Tabs defaultValue="customers">
                <TabsList className="mb-4">
                    <TabsTrigger value="customers"><Users className="mr-2 h-4 w-4" /> Customer Portal</TabsTrigger>
                    <TabsTrigger value="staff"><Briefcase className="mr-2 h-4 w-4" /> Staff Management</TabsTrigger>
                    <TabsTrigger value="marketing"><Target className="mr-2 h-4 w-4" /> Marketing Management</TabsTrigger>
                </TabsList>
                <TabsContent value="customers">
                    <Card>
                        <CardHeader><div className="flex justify-between items-start"><div><CardTitle>User Permission Management</CardTitle><CardDescription>Control which features each party can access in their portal.</CardDescription></div><Button asChild variant="outline"><Link href="/parties"><Edit className="mr-2 h-4 w-4" /> Manage All Parties</Link></Button></div></CardHeader>
                        <CardContent>
                        <div className="rounded-md border">
                            <Table><TableHeader><TableRow><TableHead>Party Name</TableHead><TableHead>Status</TableHead><TableHead>View Ledger</TableHead><TableHead>Support</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {loading ? (<TableRow><TableCell colSpan={5} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>) : customers.map(party => (
                                        <TableRow key={party.id}>
                                            <TableCell className="font-medium">
                                                <Link href={`/parties/${party.id}`} className="hover:underline">{party.name}</Link>
                                            </TableCell>
                                            <TableCell>{isOnline(party.lastSeen) ? (<Badge variant="default" className="bg-green-100 text-green-700">Online</Badge>) : (party.lastSeen ? <Badge variant="outline">{formatDistanceToNow(parseISO(party.lastSeen), {addSuffix: true})}</Badge> : <Badge variant="outline">Offline</Badge>)}</TableCell>
                                            <TableCell><Switch id={`ledger-permission-${party.id}`} checked={party.permissions?.viewLedger || false} onCheckedChange={(value) => handlePermissionChange(party.id, 'viewLedger', value)} /><Label htmlFor={`ledger-permission-${party.id}`} className="sr-only">Toggle Ledger Permission</Label></TableCell>
                                            <TableCell>
                                                <Button variant="ghost" size="icon" asChild className="relative">
                                                    <Link href={`/portal/admin/activity/${party.id}`}>
                                                        <MessageSquare className="h-5 w-5"/>
                                                        {party.hasUnreadAdminMessages && <span className="absolute top-0 right-0 h-2.5 w-2.5 rounded-full bg-red-500" />}
                                                    </Link>
                                                </Button>
                                            </TableCell>
                                            <TableCell className="text-right space-x-2">
                                                <Button variant="ghost" size="sm" asChild><Link href={`/portal/admin/activity/${party.id}`}><Activity className="mr-2 h-4 w-4"/> View Activity</Link></Button>
                                                <AlertDialog><AlertDialogTrigger asChild><Button variant="outline" size="sm" onClick={() => setResettingPartyId(party.id)}><KeyRound className="mr-2 h-4 w-4"/> Reset Password</Button></AlertDialogTrigger>
                                                    <AlertDialogContent>
                                                        <AlertDialogHeader><AlertDialogTitle>Reset password for {party.name}?</AlertDialogTitle><AlertDialogDescriptionComponent>Enter a new password. The user will be able to log in with this new password immediately.</AlertDialogDescriptionComponent></AlertDialogHeader>
                                                        <Input type="text" placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                                        <AlertDialogFooter><AlertDialogCancel onClick={() => setResettingPartyId(null)}>Cancel</AlertDialogCancel><AlertDialogAction onClick={handlePasswordReset}>Set New Password</AlertDialogAction></AlertDialogFooter>
                                                    </AlertDialogContent>
                                                </AlertDialog>
                                            </TableCell>
                                        </TableRow>))}
                                </TableBody>
                            </Table>
                        </div>
                        </CardContent>
                    </Card>
                </TabsContent>
                <TabsContent value="staff">
                    <Card>
                        <CardHeader><div className="flex justify-between items-center"><CardTitle>Staff &amp; Task Management</CardTitle><Button onClick={() => {setEditingTask(null); setIsTaskFormOpen(true)}}><Plus className="mr-2 h-4 w-4"/>Create Task</Button></div><CardDescription>View staff members and manage their assigned tasks.</CardDescription></CardHeader>
                         <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <h3 className="font-semibold mb-2">Staff List</h3>
                                    <div className="rounded-md border">
                                        <Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Phone</TableHead><TableHead>Tasks (Pending/Total)</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {loading ? (<TableRow><TableCell colSpan={4} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>) : staff.map(member => (
                                                    <TableRow key={member.id}>
                                                        <TableCell className="font-medium">{member.name}</TableCell>
                                                        <TableCell>{member.phone}</TableCell>
                                                        <TableCell><Badge variant="secondary">{member.pendingTasks}/{member.totalTasks}</Badge></TableCell>
                                                         <TableCell className="text-right"><Button variant="outline" size="sm" onClick={() => setEditingStaffPermissions(member)}><Settings className="h-4 w-4"/></Button></TableCell>
                                                    </TableRow>))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <h3 className="font-semibold">All Tasks</h3>
                                    <div className="rounded-md border max-h-[60vh] overflow-y-auto p-2 space-y-4">
                                    {tasks.length === 0 ? <p className="text-center text-muted-foreground py-10">No tasks found.</p> : tasks.map(task => (
                                        <TaskCard 
                                            key={task.id} 
                                            task={task}
                                            parties={parties}
                                            onCall={() => {}} 
                                            onUpdateStatus={handleUpdateStatus}
                                            onAddComment={handleAddComment}
                                            onSetReminder={handleSetReminder}
                                            onEdit={handleEditTask}
                                            onDelete={handleDeleteTask}
                                        />
                                    ))}
                                    </div>
                                </div>
                            </div>
                         </CardContent>
                    </Card>
                </TabsContent>
                 <TabsContent value="marketing">
                    <Card>
                        <CardHeader>
                            <CardTitle>Marketing User Management</CardTitle>
                            <CardDescription>
                                Assign specific products to marketing users for them to track.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>User Name</TableHead>
                                        <TableHead>Assigned Products</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {marketingUsers.length > 0 ? marketingUsers.map(user => (
                                        <TableRow key={user.id}>
                                            <TableCell>{user.name}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{user.marketingProductIds?.length || 0} products</Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => setAssigningProductsParty(user)}>
                                                    Assign Products
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center h-24">No users with 'Marketing' party type found.</TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </main>
      </div>
    </div>
  );
}
