

'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Clock, User, Bell, Repeat, Save, Trash2, TrendingUp, TrendingDown, ArrowRight, Loader2, ChevronsUpDown, Check, MoreVertical, Edit, Phone, MessageSquare, Plus, FileText } from 'lucide-react';
import { format, isPast, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { sendTelegramNotification } from './actions'; 
import { subscribeToParties } from '@/services/partyService';
import { getPartyBalanceEffect, formatAmount } from '@/lib/utils';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { addReminder, deleteReminder, subscribeToReminders, updateReminder } from '@/services/reminderService';
import type { Party, Reminder, Transaction } from '@/types';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';


// --- Types ---
type PartyWithBalance = Party & { balance: number };

// --- Missing Component: PartySelector ---
const PartySelector = ({ 
  parties, 
  onSelect, 
  placeholder 
}: { 
  parties: PartyWithBalance[]; 
  onSelect: (party: PartyWithBalance) => void; 
  placeholder?: string; 
}) => {
  const [open, setOpen] = useState(false);
  const [selectedParty, setSelectedParty] = useState<PartyWithBalance | null>(null);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between h-12">
          {selectedParty ? (
             <div className="flex items-center justify-between w-full">
                <span>{selectedParty.name}</span>
                <Badge variant={selectedParty.balance < 0 ? "destructive" : "secondary"} className="ml-2 mr-2">
                    {selectedParty.balance}
                </Badge>
             </div>
          ) : (
            <span className="text-muted-foreground">{placeholder || "Select party..."}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search party name..." />
          <CommandList>
            <CommandEmpty>No party found.</CommandEmpty>
            <CommandGroup>
              <CommandItem onSelect={() => { setSelectedParty(null); onSelect({} as PartyWithBalance); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", !selectedParty ? "opacity-100" : "opacity-0")} />
                None
              </CommandItem>
              {parties.map((party) => (
                <CommandItem
                  key={party.id}
                  value={party.name}
                  onSelect={() => {
                    setSelectedParty(party);
                    onSelect(party);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", selectedParty?.id === party.id ? "opacity-100" : "opacity-0")} />
                  <div className="flex flex-1 justify-between items-center">
                    <span>{party.name}</span>
                    <span className={cn("text-xs font-mono", party.balance < 0 ? "text-red-500" : "text-green-500")}>
                        {party.balance}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

// --- Main Page Component ---
export default function ReminderSchedulerPage() {
  // --- States ---
  const [parties, setParties] = useState<Party[]>([]); 
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  
  // Form States
  const [selectedParty, setSelectedParty] = useState<PartyWithBalance | null>(null);
  const [note, setNote] = useState('');
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState('10:00');
  const [repeat, setRepeat] = useState<'none' | 'daily' | 'weekly' | 'monthly'>('none');
  const [loading, setLoading] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    const unsubParties = subscribeToParties(setParties, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    const unsubReminders = subscribeToReminders(setReminders, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    return () => { unsubParties(); unsubReminders(); unsubTransactions(); }
  }, [toast]);
  
  const partyBalances = useMemo(() => {
    const balances: { [partyId: string]: number } = {};
    for (const tx of transactions) {
      if (tx.partyId && tx.enabled) {
        if (!balances[tx.partyId]) balances[tx.partyId] = 0;
        balances[tx.partyId] += getPartyBalanceEffect(tx, false);
      }
    }
    return balances;
  }, [transactions]);
  
  const partiesWithBalance: PartyWithBalance[] = useMemo(() => {
      return parties.map(party => ({
          ...party,
          balance: partyBalances[party.id] || 0,
      }));
  }, [parties, partyBalances]);


  // --- Handlers ---
  const handleSaveReminder = async () => {
    if (!date) {
      toast({ variant: 'destructive', title: 'Error', description: 'Please select a date.' });
      return;
    }

    setLoading(true);

    const [hours, minutes] = time.split(':').map(Number);
    const scheduledDate = new Date(date);
    scheduledDate.setHours(hours, minutes);

    const newReminder: Omit<Reminder, 'id'> = {
      partyId: selectedParty?.id || '',
      partyName: selectedParty?.name || note || 'General Reminder',
      dueAmount: selectedParty?.balance || 0,
      notes: note,
      dueDate: scheduledDate.toISOString(),
      reminderDates: [scheduledDate.toISOString()],
      repeat: repeat,
      status: 'pending',
      history: [{ date: new Date().toISOString(), action: 'created', comment: 'Reminder created' }]
    };
    
    try {
        await addReminder(newReminder);
        toast({ title: 'Reminder Set!', description: `Scheduled for ${format(scheduledDate, 'PP p')}` });
        setNote('');
        setSelectedParty(null);
        setRepeat('none');
    } catch(e:any) {
        toast({ variant: 'destructive', title: 'Save Failed', description: e.message });
    } finally {
        setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteReminder(id);
      toast({ title: 'Reminder Deleted' });
    } catch(e:any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: e.message });
    }
  };

  return (
    <div className="container mx-auto max-w-7xl py-6 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Collection Scheduler</h1>
        <p className="text-muted-foreground">Automate your payment reminders and collection calls via Telegram.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* --- LEFT SIDE: CREATE REMINDER FORM (Cols 5) --- */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="border-t-4 border-t-primary shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" /> Set New Reminder
              </CardTitle>
              <CardDescription>Configure who to remind and when.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              
              {/* 1. Party Selection */}
              <div className="space-y-2">
                <Label>Select Party / Customer</Label>
                <PartySelector 
                    parties={partiesWithBalance}
                    onSelect={(party) => setSelectedParty(party)}
                    placeholder="Search or select a party..."
                />
              </div>

              {/* Live Balance Card */}
              {selectedParty && (
                <div className={cn("p-4 rounded-lg border flex items-center justify-between animate-in fade-in zoom-in duration-300", 
                  selectedParty.balance < 0 ? "bg-red-50 border-red-200 dark:bg-red-900/20" : "bg-green-50 border-green-200 dark:bg-green-900/20")}>
                  <div>
                    <p className="text-sm font-medium opacity-70">Current Due Balance</p>
                    <p className={cn("text-2xl font-bold", selectedParty.balance < 0 ? "text-red-600" : "text-green-600")}>
                      {selectedParty.balance} ৳
                    </p>
                  </div>
                  {selectedParty.balance < 0 ? <TrendingDown className="h-8 w-8 text-red-400"/> : <TrendingUp className="h-8 w-8 text-green-400"/>}
                </div>
              )}

              {/* 2. Date & Time */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date ? format(date, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label>Time</Label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                </div>
              </div>

              {/* 3. Note */}
              <div className="space-y-2">
                <Label>Reminder Title / Note</Label>
                <Textarea 
                  placeholder="E.g. Call for the pending check..." 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="resize-none"
                />
              </div>

              {/* 4. Repeat Options */}
              <div className="space-y-2 border p-3 rounded-md bg-muted/20">
                <Label className="flex items-center gap-2 mb-2"><Repeat className="h-4 w-4"/> Repeat Frequency</Label>
                <div className="flex gap-2">
                  {['none', 'daily', 'weekly', 'monthly'].map((opt) => (
                    <div 
                      key={opt}
                      onClick={() => setRepeat(opt as any)}
                      className={cn("cursor-pointer px-3 py-1.5 text-xs font-medium rounded-full border transition-all",
                        repeat === opt ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                      )}
                    >
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </div>
                  ))}
                </div>
                {repeat !== 'none' && <p className="text-xs text-muted-foreground mt-1 ml-1">Reminder will repeat {repeat} at {time}.</p>}
              </div>

            </CardContent>
            <CardFooter>
              <Button onClick={handleSaveReminder} disabled={loading} className="w-full h-11 text-base shadow-md">
                {loading ? "Scheduling..." : <><Save className="mr-2 h-4 w-4" /> Schedule Reminder</>}
              </Button>
            </CardFooter>
          </Card>
        </div>

        {/* --- RIGHT SIDE: UPCOMING REMINDERS LIST --- */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" /> Upcoming Queue
            </h2>
            <Badge variant="outline">{reminders.filter(r => r.status === 'pending').length} Pending</Badge>
          </div>

          <div className="grid gap-4">
            {reminders.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/10">
                <Bell className="h-10 w-10 mx-auto text-muted-foreground opacity-50 mb-2"/>
                <p className="text-muted-foreground">No reminders scheduled.</p>
              </div>
            ) : (
              reminders.map((reminder) => (
                <div key={reminder.id} className="group flex items-start justify-between p-4 rounded-xl border bg-card hover:shadow-md transition-all">
                  <div className="flex gap-4">
                    <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-lg">
                      {reminder.partyName.charAt(0)}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{reminder.partyName}</h3>
                        {reminder.repeat !== 'none' && <Badge variant="secondary" className="text-[10px] h-5"><Repeat className="h-3 w-3 mr-1"/> {reminder.repeat}</Badge>}
                         <Badge variant={reminder.status === 'sent' ? 'default' : 'outline'}>{reminder.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{reminder.notes || "Payment collection reminder"}</p>
                      
                      <div className="flex items-center gap-3 text-xs font-medium mt-1">
                        <span className="text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {(() => {
                              const dateObj = new Date(reminder.dueDate);
                              return isValid(dateObj) 
                                ? `${format(dateObj, 'MMM d, yyyy')} at ${format(dateObj, 'h:mm a')}`
                                : 'Invalid Date';
                          })()}
                        </span>
                        <span className={cn((partyBalances?.[reminder.partyId] || 0) < 0 ? "text-red-500" : "text-green-500")}>
                          Balance: {formatAmount(partyBalances?.[reminder.partyId] || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <DropdownMenu>
                       <DropdownMenuTrigger asChild>
                           <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4"/></Button>
                       </DropdownMenuTrigger>
                       <DropdownMenuContent>
                          <DropdownMenuItem asChild><Link href={`/parties/${reminder.partyId}`}><FileText className="mr-2 h-4 w-4" /> Go to Ledger</Link></DropdownMenuItem>
                          <DropdownMenuItem><Edit className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(reminder.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/> Delete</DropdownMenuItem>
                       </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
