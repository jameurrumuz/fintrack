
'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Plus, Upload, Download, MoreVertical, Calendar, Flag, Tag, Trash2, Edit, MessageSquare, Bell, Clock, Loader2, CheckCircle2, CircleDot, XCircle, ChevronDown, Check, User, Briefcase, Phone, UserSearch, ChevronsUpDown } from 'lucide-react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { format, parseISO, isPast, isToday, isFuture, formatDistanceToNow, differenceInMinutes, subMinutes, subHours, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { subscribeToTasks, addTask, updateTask, deleteTask } from '@/services/taskService';
import { subscribeToParties } from '@/services/partyService';
import type { Task, Party } from '@/types';
import { cn } from '@/lib/utils';
import { writeBatch } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import TaskCard from '@/components/TaskCard';
import { useSearchParams, useRouter } from 'next/navigation';


const taskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high']),
  dueDate: z.string().min(1, 'Due date is required'),
  progress: z.coerce.number().min(0).max(100),
  assignedToId: z.string().optional(),
  partyId: z.string().optional(),
  reminderOffset: z.coerce.number().min(0).optional(),
  reminderUnit: z.enum(['minutes', 'hours', 'days', 'weeks', 'months', 'years']).optional(),
});
type TaskFormValues = z.infer<typeof taskSchema>;

const taskCategories = ['Collection', 'Business', 'Office Work', 'Family', 'Relatives', 'Health', 'Loan', 'Finance', 'Maintenance', 'Other'];

const priorityMap = {
  low: { label: 'Low', icon: <Flag className="h-4 w-4" />, color: 'text-gray-500' },
  medium: { label: 'Medium', icon: <Flag className="h-4 w-4" />, color: 'text-yellow-600' },
  high: { label: 'High', icon: <Flag className="h-4 w-4" />, color: 'text-red-600' },
};

const statusMap = {
    'in-progress': { label: 'In Progress', icon: <CircleDot className="h-4 w-4" />, color: 'text-blue-600' },
    'completed': { label: 'Completed', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-600' },
    'cancelled': { label: 'Cancelled', icon: <XCircle className="h-4 w-4" />, color: 'text-gray-500' },
}


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


const TaskFormDialog = ({ open, onOpenChange, onSave, task, staffList, parties }: { open: boolean; onOpenChange: (open: boolean) => void; onSave: (data: TaskFormValues) => void; task: Task | null; staffList: Party[]; parties: Party[] }) => {
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskSchema), defaultValues: { progress: 0 } });
  
  useEffect(() => {
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || '',
        category: task.category,
        priority: task.priority,
        dueDate: format(parseISO(task.dueDate), "yyyy-MM-dd'T'HH:mm"),
        progress: task.progress,
        assignedToId: task.assignedToId || 'none',
        partyId: task.partyId || 'none',
        reminderOffset: task.reminderOffset || undefined,
        reminderUnit: task.reminderUnit || 'minutes',
      });
    } else {
      form.reset({
        title: '',
        description: '',
        category: '',
        priority: 'medium',
        dueDate: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
        progress: 0,
        assignedToId: 'none',
        partyId: 'none',
        reminderOffset: 30,
        reminderUnit: 'minutes',
      });
    }
  }, [task, open, form]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'Create New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSave)} className="space-y-4 py-4">
          <Input placeholder="Task Title" {...form.register('title')} />
          {form.formState.errors.title && <p className="text-destructive text-xs">{form.formState.errors.title.message}</p>}
          <Textarea placeholder="Add a description..." {...form.register('description')} />
          <div className="grid grid-cols-2 gap-4">
            <Controller name="category" control={form.control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>{taskCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            )} />
             <Controller name="priority" control={form.control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Priority" /></SelectTrigger>
                <SelectContent>{Object.entries(priorityMap).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
              </Select>
            )} />
          </div>
           <div className="space-y-2">
            <Label>Link to Party/Customer (Optional)</Label>
            <Controller
              name="partyId"
              control={form.control}
              render={({ field }) => (
                <PartyCombobox parties={parties} value={field.value} onChange={field.onChange} />
              )}
            />
          </div>
          <div className="space-y-2">
            <Label>Assign To</Label>
            <Controller name="assignedToId" control={form.control} render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger><SelectValue placeholder="Assign to staff..." /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {staffList.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )} />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-2">
                <Label>Due Date</Label>
                <Input type="datetime-local" {...form.register('dueDate')} />
            </div>
             <div className="space-y-2">
                <Label>Notify me before</Label>
                 <div className="grid grid-cols-2 gap-2">
                    <Input type="number" {...form.register('reminderOffset')} placeholder="e.g., 30" />
                     <Controller
                      name="reminderUnit"
                      control={form.control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="minutes">Minutes</SelectItem>
                                <SelectItem value="hours">Hours</SelectItem>
                                <SelectItem value="days">Days</SelectItem>
                                <SelectItem value="weeks">Weeks</SelectItem>
                                <SelectItem value="months">Months</SelectItem>
                                <SelectItem value="years">Years</SelectItem>
                            </SelectContent>
                        </Select>
                      )}
                    />
                </div>
            </div>
          </div>
          <div>
            <Label>Progress: {form.watch('progress')}%</Label>
            <Input type="range" min="0" max="100" {...form.register('progress')} />
          </div>
          <DialogFooter>
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit">Save Task</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};


function TasksPageContent() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [filters, setFilters] = useState({ status: 'in-progress', category: 'all' });
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const sendTelegramAlarm = async (message: string) => {
    const token = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN;
    const chatId = process.env.NEXT_PUBLIC_TELEGRAM_CHAT_ID;
  
    if (!token || !chatId) {
        console.warn('Telegram bot token or chat ID is not configured.');
        return;
    }
  
    try {
        await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`);
    } catch (error) {
        console.error("Failed to send Telegram alarm:", error);
    }
  };


  useEffect(() => {
    const unsubTasks = subscribeToTasks((allTasks) => {
        setTasks(allTasks);
        const taskIdFromUrl = searchParams.get('taskId');
        if (taskIdFromUrl) {
            const taskToEdit = allTasks.find(t => t.id === taskIdFromUrl);
            if (taskToEdit) {
                setEditingTask(taskToEdit);
                setIsFormOpen(true);
            }
            router.replace('/tasks');
        }
        setLoading(false);
    }, (error) => {
      toast({ variant: 'destructive', title: 'Connection Error', description: error.message });
      setLoading(false);
    });
    
    const unsubParties = subscribeToParties(setParties, (error) => {
      toast({ variant: 'destructive', title: 'Error fetching parties', description: error.message });
    });

    return () => {
      unsubTasks();
      unsubParties();
    };
  }, [toast, searchParams, router]);
  
  const checkReminders = useCallback(() => {
    tasks.forEach(task => {
        if (task.status !== 'in-progress' || task.reminderSent) return;
        
        const offset = task.reminderOffset || 0;
        const unit = task.reminderUnit || 'minutes';

        if (offset > 0) {
            const dueDate = parseISO(task.dueDate);
            let reminderTime;
            switch(unit) {
                case 'minutes': reminderTime = subMinutes(dueDate, offset); break;
                case 'hours': reminderTime = subHours(dueDate, offset); break;
                case 'days': reminderTime = subDays(dueDate, offset); break;
                case 'weeks': reminderTime = subWeeks(dueDate, offset); break;
                case 'months': reminderTime = subMonths(dueDate, offset); break;
                case 'years': reminderTime = subYears(dueDate, offset); break;
                default: reminderTime = dueDate;
            }

            if (isPast(reminderTime)) {
                const message = `🚨 Reminder: ${task.title} is due soon!`;
                new Notification('Task Reminder', { body: `Due soon: ${task.title}`, icon: '/favicon.ico' });
                sendTelegramAlarm(message);
                updateTask(task.id, { reminderSent: true });
            }
        }
        
        if (!task.overdueNotified && isPast(parseISO(task.dueDate))) {
            const message = `⏰ Overdue: ${task.title} was due ${formatDistanceToNow(parseISO(task.dueDate), { addSuffix: true })}`;
            new Notification('Task Overdue!', { body: `${task.title} was due ${formatDistanceToNow(parseISO(task.dueDate), { addSuffix: true })}`, icon: '/favicon.ico' });
            sendTelegramAlarm(message);
            updateTask(task.id, { overdueNotified: true });
        }
    });
}, [tasks]);

  useEffect(() => {
    const intervalId = setInterval(checkReminders, 60000); // Check every minute
    return () => clearInterval(intervalId);
  }, [checkReminders]);
  
  const staffList = useMemo(() => parties.filter(p => p.partyType === 'Staff'), [parties]);
  
 const handleSaveTask = async (data: TaskFormValues) => {
    try {
        const rawTaskData: Partial<Task> = {
            ...data,
            assignedToId: data.assignedToId === 'none' ? undefined : data.assignedToId,
            assignedToName: data.assignedToId && data.assignedToId !== 'none' ? staffList.find(s => s.id === data.assignedToId)?.name : undefined,
            partyId: data.partyId === 'none' ? undefined : data.partyId,
            partyName: data.partyId && data.partyId !== 'none' ? parties.find(p => p.id === data.partyId)?.name : undefined,
        };

        const taskData = Object.fromEntries(Object.entries(rawTaskData).filter(([_, v]) => v !== undefined));

        if (editingTask) {
            const historyEntry = { date: new Date().toISOString(), action: 'updated', comment: 'Task details updated', progress: data.progress };
            await updateTask(editingTask.id, { ...taskData, history: [...editingTask.history, historyEntry] });
        } else {
            await addTask(taskData as any);
        }

        toast({ title: editingTask ? 'Task Updated' : 'Task Created' });
        setIsFormOpen(false);
        setEditingTask(null);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Save Error', description: error.message });
    }
  };
  
  const handleEdit = (task: Task) => {
      setEditingTask(task);
      setIsFormOpen(true);
  };
  
  const handleDelete = async (id: string) => {
      try {
        await deleteTask(id);
        toast({ title: 'Task Deleted' });
      } catch (error: any) {
          toast({ variant: 'destructive', title: 'Delete Error', description: error.message });
      }
  };

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

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
        const statusMatch = filters.status === 'all' || task.status === filters.status;
        const categoryMatch = filters.category === 'all' || task.category === filters.category;
        return statusMatch && categoryMatch;
    });
  }, [tasks, filters]);

  return (
    <div className="flex flex-col h-screen">
      <main className="flex-grow">
        <TaskFormDialog open={isFormOpen} onOpenChange={setIsFormOpen} onSave={handleSaveTask} task={editingTask} staffList={staffList} parties={parties} />
        
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <div>
                 <h1 className="text-3xl font-bold">Task Manager</h1>
                 <p className="text-muted-foreground">Stay organized and track your progress.</p>
            </div>
            <div className="flex gap-2">
                 <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }}><Plus className="mr-2 h-4 w-4" /> Create Task</Button>
            </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="flex-grow">
                <Label>Status</Label>
                <Select value={filters.status} onValueChange={(v) => setFilters(f => ({...f, status: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        {Object.entries(statusMap).map(([key, val]) => <SelectItem key={key} value={key}>{val.label}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="flex-grow">
                <Label>Category</Label>
                <Select value={filters.category} onValueChange={(v) => setFilters(f => ({...f, category: v}))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Categories</SelectItem>
                        {taskCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>

        {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : filteredTasks.length > 0 ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredTasks.map(task => (
                    <TaskCard 
                        key={task.id} 
                        task={task}
                        parties={parties}
                        onCall={(phone, partyId, title) => console.log(`Calling ${phone}`)} 
                        onEdit={handleEdit} 
                        onDelete={handleDelete}
                        onAddComment={handleAddComment}
                        onSetReminder={handleSetReminder}
                        onUpdateStatus={handleUpdateStatus}
                    />
                ))}
            </div>
        ) : (
             <div className="text-center py-16">
                 <h2 className="text-2xl font-semibold">No tasks found</h2>
                 <p className="text-muted-foreground mt-2">Try adjusting your filters or create a new task to get started.</p>
             </div>
        )}
      </main>
    </div>
  );
}

export default function TasksPage() {
    return (
        <Suspense>
            <TasksPageContent />
        </Suspense>
    )
}
