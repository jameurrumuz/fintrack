

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Bell, Clock, Calendar, MoreVertical, Edit, Trash2, Loader2, ListFilter, AlertCircle, Search, Pin, PinOff, MessageSquarePlus } from 'lucide-react';
import type { Party, Transaction, Reminder, AppSettings } from '@/types';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToReminders, addReminder, updateReminder, deleteReminder, clearAllReminders } from '@/services/reminderService';
import { getPartyBalanceEffect, formatAmount, formatDate } from '@/lib/utils';
import { format, parseISO, isToday, isFuture, isPast, startOfToday } from 'date-fns';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { getAppSettings } from '@/services/settingsService';


const reminderSchema = z.object({
  notes: z.string().optional(),
  reminderDates: z.array(z.object({ value: z.string().min(1, 'Date cannot be empty.') })).min(1, 'At least one reminder date is required.'),
});

type ReminderFormValues = z.infer<typeof reminderSchema>;

const SmsLanguageDialog = ({ open, onOpenChange, party, balance, appSettings, onSend }: { open: boolean, onOpenChange: (open: boolean) => void, party: Party, balance: number, appSettings: AppSettings | null, onSend: (message: string) => void }) => {
    const { toast } = useToast();
    const businessName = appSettings?.businessProfiles.find(p => p.name === party.group)?.name || appSettings?.businessProfiles[0]?.name || 'our company';

    const handleSend = (lang: 'en' | 'bn') => {
        let message = '';
        if (lang === 'en') {
            message = `Dear ${party.name}, your due amount is ${formatAmount(Math.abs(balance))}. Please pay at your earliest convenience. Regards, ${businessName}`;
        } else {
            message = `প্রিয় ${party.name}, আপনার বর্তমান বকেয়া ${formatAmount(Math.abs(balance))}। অনুগ্রহ করে দ্রুত বকেয়া পরিশোধ করুন। ধন্যবাদ, ${businessName}`;
        }
        if (party.phone) {
            window.location.href = `sms:${party.phone}?body=${encodeURIComponent(message)}`;
        } else {
             toast({
                variant: 'destructive',
                title: 'No Phone Number',
                description: `No phone number is saved for ${party.name}.`
            });
        }
        onOpenChange(false);
    };

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Choose SMS Language</AlertDialogTitle>
                    <AlertDialogDescriptionComponent>Select the language for the SMS reminder to {party.name}.</AlertDialogDescriptionComponent>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button onClick={() => handleSend('bn')}>Send Bengali</Button>
                    <Button onClick={() => handleSend('en')}>Send English</Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

const ReminderFormDialog = ({
  isOpen,
  onOpenChange,
  party,
  onSave,
  existingReminder
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  party: Party & { balance: number };
  onSave: (data: Partial<Reminder>) => void;
  existingReminder?: Reminder | null;
}) => {
  const { control, handleSubmit, reset } = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderSchema),
  });
  
  const { fields, append, remove } = useFieldArray({
      control,
      name: "reminderDates",
  });

  useEffect(() => {
    if (existingReminder) {
      reset({
        notes: existingReminder.notes || '',
        reminderDates: (existingReminder.reminderDates || (existingReminder.reminderDate ? [existingReminder.reminderDate] : [])).map(d => ({ value: format(parseISO(d), "yyyy-MM-dd'T'HH:mm") })),
      });
    } else {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(11, 0, 0, 0);
        reset({
            notes: '',
            reminderDates: [{ value: format(tomorrow, "yyyy-MM-dd'T'HH:mm") }],
        });
    }
  }, [existingReminder, reset]);

  const handleFormSubmit = (data: ReminderFormValues) => {
    const reminderData: Partial<Reminder> = {
      partyId: party.id,
      partyName: party.name,
      dueAmount: party.balance || 0, // Save the current balance when setting/updating
      reminderDates: data.reminderDates.map(d => new Date(d.value).toISOString()),
      notes: data.notes,
      status: 'pending',
    };
    onSave(reminderData);
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingReminder ? 'Edit' : 'Set'} Reminder for {party.name}</DialogTitle>
          <DialogDescription>
            Current Due Amount: <span className="font-bold">{formatAmount(Math.abs(party.balance || 0))}</span>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          
          <div className="space-y-2">
            <Label>Reminder Dates & Times</Label>
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input type="datetime-local" {...control.register(`reminderDates.${index}.value`)} />
                <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={() => append({ value: format(new Date(), "yyyy-MM-dd'T'HH:mm") })}>
              <Plus className="mr-2 h-4 w-4"/> Add Reminder Date
            </Button>
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="e.g., Call before noon..." {...control.register('notes')} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit">Save Reminder</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};


export default function RemindersPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  
  const [pinnedPartyIds, setPinnedPartyIds] = useState<string[]>([]);
  const [dueListSearch, setDueListSearch] = useState('');

  const [selectedParty, setSelectedParty] = useState<(Party & { balance: number }) | null>(null);
  const [editingReminder, setEditingReminder] = useState<Reminder | null>(null);
  const [smsParty, setSmsParty] = useState<(Party & { balance: number }) | null>(null);
  
  useEffect(() => {
    // Load pinned parties from local storage
    const savedPinned = localStorage.getItem('pinnedPartyIds');
    if (savedPinned) {
      setPinnedPartyIds(JSON.parse(savedPinned));
    }

    const unsubParties = subscribeToParties(setParties, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    const unsubReminders = subscribeToReminders(setReminders, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    getAppSettings().then(setAppSettings);
    
    setLoading(false);

    return () => {
      unsubParties();
      unsubTransactions();
      unsubReminders();
    };
  }, [toast]);
  
  const partiesWithBalance = useMemo(() => {
    const balances: Record<string, number> = {};
    for (const tx of transactions) {
      if (tx.partyId) {
        balances[tx.partyId] = (balances[tx.partyId] || 0) + getPartyBalanceEffect(tx);
      }
    }
    
    let partiesList = parties
      .map(party => ({
        ...party,
        balance: balances[party.id] || 0,
      }))
      .filter(party => party.balance < 0);
      
    if (dueListSearch) {
        partiesList = partiesList.filter(party => party.name.toLowerCase().includes(dueListSearch.toLowerCase()));
    }
    
    return partiesList.sort((a,b) => {
        const isAPinned = pinnedPartyIds.includes(a.id);
        const isBPinned = pinnedPartyIds.includes(b.id);
        if (isAPinned && !isBPinned) return -1;
        if (!isAPinned && isBPinned) return 1;
        return Math.abs(b.balance || 0) - Math.abs(a.balance || 0);
    });

  }, [parties, transactions, pinnedPartyIds, dueListSearch]);

  const totalDue = useMemo(() => {
      return partiesWithBalance.reduce((sum, party) => sum + Math.abs(party.balance || 0), 0);
  }, [partiesWithBalance]);
  
  const togglePin = (partyId: string) => {
    const newPinnedIds = pinnedPartyIds.includes(partyId)
      ? pinnedPartyIds.filter(id => id !== partyId)
      : [...pinnedPartyIds, partyId];
    setPinnedPartyIds(newPinnedIds);
    localStorage.setItem('pinnedPartyIds', JSON.stringify(newPinnedIds));
  };


  const groupedReminders = useMemo(() => {
    const groups: { overdue: Reminder[]; today: Reminder[]; upcoming: Reminder[] } = {
        overdue: [],
        today: [],
        upcoming: [],
    };
    
    const now = new Date();

    reminders
        .filter(r => r.status === 'pending')
        .forEach(r => {
            if (!r.reminderDates || r.reminderDates.length === 0) return;

            const futureDates = r.reminderDates
                                .map(d => parseISO(d))
                                .filter(d => d >= now)
                                .sort((a, b) => a.getTime() - b.getTime());
            
            if (futureDates.length > 0) {
                const nextDate = futureDates[0];
                if (isToday(nextDate)) {
                    groups.today.push({...r, nextReminder: nextDate.toISOString()});
                } else {
                    groups.upcoming.push({...r, nextReminder: nextDate.toISOString()});
                }
            } else {
                 // All reminder dates are in the past
                 const allDates = r.reminderDates.map(d => parseISO(d)).sort((a, b) => a.getTime() - b.getTime());
                 const lastDate = allDates[allDates.length - 1];
                 if(lastDate) {
                    groups.overdue.push({...r, nextReminder: lastDate.toISOString()});
                 }
            }
        });
        
    groups.overdue.sort((a,b) => new Date(a.nextReminder!).getTime() - new Date(b.nextReminder!).getTime());
    groups.today.sort((a,b) => new Date(a.nextReminder!).getTime() - new Date(b.nextReminder!).getTime());
    groups.upcoming.sort((a,b) => new Date(a.nextReminder!).getTime() - new Date(b.nextReminder!).getTime());
    
    return groups;
  }, [reminders]);
  

  const handleSaveReminder = async (data: Partial<Reminder>) => {
    try {
      if (editingReminder) {
        await updateReminder(editingReminder.id, data);
        toast({ title: "Reminder updated!" });
      } else {
        await addReminder({ ...data, createdAt: new Date().toISOString() } as Omit<Reminder, 'id'>);
        toast({ title: "Reminder set successfully!" });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    } finally {
        setSelectedParty(null);
        setEditingReminder(null);
    }
  };

  const handleMarkAsComplete = async (id: string) => {
    try {
        await updateReminder(id, { status: 'completed' });
        toast({title: "Reminder marked as complete."})
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  }

  const handleDeleteReminder = async (id: string) => {
      try {
        await deleteReminder(id);
        toast({title: "Reminder deleted."})
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  }

  const handleClearAll = async () => {
    try {
      await clearAllReminders();
      toast({ title: "All reminders cleared." });
    } catch (error: any) {
      toast({ variant: 'destructive', title: "Error", description: `Could not clear reminders: ${error.message}` });
    }
  };

  const openReminderDialog = (party: Party & { balance: number }) => {
    const existing = reminders.find(r => r.partyId === party.id && r.status === 'pending');
    setEditingReminder(existing || null);
    setSelectedParty(party);
  };
  
  const handleSendSms = (party: Party, balance: number) => {
    if (!party.phone) {
        toast({
            variant: 'destructive',
            title: 'No Phone Number',
            description: `No phone number is saved for ${party.name}.`
        });
        return;
    }
    setSmsParty({ ...party, balance });
  };


  const ReminderList = ({ title, reminders, className }: { title: string, reminders: (Reminder & {nextReminder?: string})[], className?: string }) => {
    if (reminders.length === 0) return null;
    return (
        <div className="space-y-3">
             <h3 className={cn("font-semibold text-lg", className)}>{title} ({reminders.length})</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {reminders.map(reminder => {
                    const party = partiesWithBalance.find(p => p.id === reminder.partyId);
                    const liveDue = party?.balance || 0;
                    return (
                        <Card key={reminder.id}>
                            <CardHeader className="flex flex-row justify-between items-start pb-2">
                                <div>
                                    <CardTitle className="text-base">{reminder.partyName}</CardTitle>
                                    <Badge variant={title === 'Overdue' ? 'destructive' : 'outline'} className="mt-1">
                                    <Clock className="mr-1 h-3 w-3"/> {reminder.nextReminder ? format(parseISO(reminder.nextReminder), 'MMM d, h:mm a') : 'No upcoming date'}
                                    </Badge>
                                </div>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                        <DropdownMenuItem onClick={() => handleMarkAsComplete(reminder.id)}>Mark as Done</DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => {
                                            const partyToEdit = parties.find(p => p.id === reminder.partyId);
                                            if(partyToEdit) {
                                                const livePartyData = {...partyToEdit, balance: liveDue};
                                                setEditingReminder(reminder);
                                                setSelectedParty(livePartyData);
                                            }
                                        }}>Edit</DropdownMenuItem>
                                        <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteReminder(reminder.id)}>Delete</DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardHeader>
                            <CardContent>
                                <p className="text-sm text-muted-foreground">{reminder.notes}</p>
                            </CardContent>
                            <CardFooter>
                                <p className="font-bold text-green-600">{formatAmount(Math.abs(liveDue))}</p>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
  };
  
  return (
    <div className="space-y-6">
      {selectedParty && (
        <ReminderFormDialog
          isOpen={!!selectedParty}
          onOpenChange={(open) => !open && setSelectedParty(null)}
          party={selectedParty}
          onSave={handleSaveReminder}
          existingReminder={editingReminder}
        />
      )}
       {smsParty && (
        <SmsLanguageDialog
            open={!!smsParty}
            onOpenChange={() => setSmsParty(null)}
            party={smsParty}
            balance={smsParty.balance}
            appSettings={appSettings}
            onSend={() => {}}
        />
       )}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-center">
             <div>
                <CardTitle className="flex items-center gap-2"><Bell />Due & Reminders</CardTitle>
                <CardDescription>Manage your receivables and set reminders to follow up.</CardDescription>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Due</p>
                <p className="text-2xl font-bold text-green-600">{formatAmount(totalDue)}</p>
              </div>
          </div>
        </CardHeader>
      </Card>
      <Tabs defaultValue="dues">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="dues">Due List</TabsTrigger>
          <TabsTrigger value="reminders">Reminders ({reminders.filter(r => r.status === 'pending').length})</TabsTrigger>
        </TabsList>
        <TabsContent value="dues">
          <Card>
            <CardHeader>
              <CardTitle>Parties with Due Balance</CardTitle>
              <div className="relative mt-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                      placeholder="Search by party name..." 
                      className="pl-10"
                      value={dueListSearch}
                      onChange={(e) => setDueListSearch(e.target.value)}
                  />
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Party Name</TableHead><TableHead className="text-right">Due Amount</TableHead><TableHead className="text-center w-48">Action</TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                       <TableRow><TableCell colSpan={3} className="h-24 text-center"><Loader2 className="animate-spin"/></TableCell></TableRow>
                    ) : partiesWithBalance.map(party => (
                       <TableRow key={party.id}>
                          <TableCell className="font-medium flex items-center gap-2">
                             <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => togglePin(party.id)}>
                                {pinnedPartyIds.includes(party.id) ? <PinOff className="h-4 w-4 text-primary" /> : <Pin className="h-4 w-4" />}
                             </Button>
                            {party.name}
                          </TableCell>
                          <TableCell className="text-right font-mono text-green-600">{formatAmount(Math.abs(party.balance || 0))}</TableCell>
                          <TableCell className="text-center space-x-2">
                            <Button size="sm" variant="outline" onClick={() => openReminderDialog(party)}>
                              <Bell className="mr-2 h-4 w-4"/> Set Reminder
                            </Button>
                             <Button size="sm" variant="outline" onClick={() => handleSendSms(party, party.balance)} disabled={!party.phone}>
                                <MessageSquarePlus className="mr-2 h-4 w-4"/> Send SMS
                            </Button>
                          </TableCell>
                       </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="reminders">
           <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle>Reminder Timeline</CardTitle>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" disabled={reminders.length === 0}>
                          <Trash2 className="mr-2 h-4 w-4" /> Clear All
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                          <AlertDialogDescriptionComponent>
                            This will permanently delete all reminders. This action cannot be undone.
                          </AlertDialogDescriptionComponent>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={handleClearAll}>Yes, Clear All</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {loading ? (
                    <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin"/></div>
                ) : (
                    <>
                        <ReminderList title="Overdue" reminders={groupedReminders.overdue} className="text-destructive"/>
                        <ReminderList title="Today" reminders={groupedReminders.today} className="text-blue-600"/>
                        <ReminderList title="Upcoming" reminders={groupedReminders.upcoming} />
                        {reminders.filter(r => r.status === 'pending').length === 0 && (
                            <div className="text-center py-10">
                                <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="text-xl font-semibold">No pending reminders</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Go to the "Due List" to set new reminders.</p>
                            </div>
                        )}
                    </>
                )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
