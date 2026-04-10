
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
    Home, Users, FileText, Settings, Shield, Bell, Menu, ArrowRightLeft, Archive, Banknote, ShoppingCart, Edit, Lock, Wrench, MessageSquareWarning
} from 'lucide-react';
import { subscribeToPendingPayments, subscribeToNewOnlineOrders, markOnlineOrdersAsNotified } from '@/services/transactionService';
import { subscribeToTasks, updateTask } from '@/services/taskService';
import { subscribeToPlanEntries } from '@/services/planService';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import type { Transaction, Task, PlanEntry, SmsLog } from '@/types';
import { Badge } from './ui/badge';
import { usePathname, useRouter } from 'next/navigation';
import { cn, formatAmount } from '@/lib/utils';
import { useSidebar } from '@/components/ui/sidebar';
import { isToday, isPast, parseISO, formatDistanceToNow, format as formatFns } from 'date-fns'; 
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Circle, ListChecks } from 'lucide-react';
import { subscribeToSmsLogs, markFailedLogsAsRead } from '@/services/smsLogService';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';


const navItems = [
    { href: "/", label: "Home", icon: <Home className="h-4 w-4" /> },
    { href: "/transactions", label: "Transactions", icon: <ArrowRightLeft className="h-4 w-4" /> },
    { href: "/inventory", label: "Inventory", icon: <Archive className="h-4 w-4" /> },
    { href: "/accounts", label: "Accounts", icon: <Banknote className="h-4 w-4" /> },
    { href: "/parties", label: "Parties", icon: <Users className="h-4 w-4" /> },
    { href: "/pos", label: "POS", icon: <ShoppingCart className="h-4 w-4" /> },
    { href: "/reports", label: "Reports", icon: <FileText className="h-4 w-4" /> },
    { href: "/portal/login", label: "Portal", icon: <Shield className="h-4 w-4" /> },
];

export default function Header() {
  const [paymentNotificationCount, setPaymentNotificationCount] = useState(0);
  const [notificationTasks, setNotificationTasks] = useState<Task[]>([]);
  const [todaysPlanEntries, setTodaysPlanEntries] = useState<PlanEntry[]>([]);
  const [failedSmsLogs, setFailedSmsLogs] = useState<SmsLog[]>([]);
  const [donePlanEntryIds, setDonePlanEntryIds] = useState<Set<string>>(new Set());
  const [newOnlineOrders, setNewOnlineOrders] = useState<Transaction[]>([]);
  const notifiedOrderIds = useRef(new Set<string>());
  const { toast } = useToast();
  const pathname = usePathname();
  const router = useRouter();
  const { toggleSidebar } = useSidebar();


  useEffect(() => {
    const unsubPending = subscribeToPendingPayments((pending) => {
        setPaymentNotificationCount(pending.length);
    }, console.error);

    const unsubNewOrders = subscribeToNewOnlineOrders((newOrders) => {
        const hasTrulyNewOrder = newOrders.some(o => !notifiedOrderIds.current.has(o.id));
        if (hasTrulyNewOrder) {
            toast({
                title: `New Online Order Received!`,
                description: `${newOrders.length} new order(s) are pending review.`,
                action: <ToastAction altText="View Orders"><Link href="/order-management">View</Link></ToastAction>,
              });
            newOrders.forEach(o => notifiedOrderIds.current.add(o.id));
        }
        setNewOnlineOrders(newOrders);
    }, console.error);

    const unsubTasks = subscribeToTasks((tasks) => {
      const pendingTasks = tasks.filter(t => {
        try {
            const dueDate = parseISO(t.dueDate);
            return t.status === 'in-progress' && (isToday(dueDate) || isPast(dueDate));
        } catch (e) { return false; }
      });
      setNotificationTasks(pendingTasks);
    }, console.error);

    const unsubSmsLogs = subscribeToSmsLogs((logs) => {
      const unreadFailed = logs.filter(log => log.status === 'failed' && !log.isRead);
      setFailedSmsLogs(unreadFailed);
    }, console.error);
    
    const unsubPlanEntries = subscribeToPlanEntries(null, (allEntries) => {
        const todayStr = formatFns(new Date(), 'yyyy-MM-dd');
        const todayEntries = allEntries.filter(entry => entry.date === todayStr);
        setTodaysPlanEntries(todayEntries);
    }, console.error);

    return () => {
      unsubPending();
      unsubNewOrders();
      unsubTasks();
      unsubSmsLogs();
      unsubPlanEntries();
    };
  }, [toast]);

  useEffect(() => {
    const storedDone = localStorage.getItem('donePlanEntries');
    const todayStr = formatFns(new Date(), 'yyyy-MM-dd');
    if (storedDone) {
        try {
            const { date, ids } = JSON.parse(storedDone);
            if (date === todayStr) setDonePlanEntryIds(new Set(ids));
            else localStorage.removeItem('donePlanEntries');
        } catch (e) { localStorage.removeItem('donePlanEntries'); }
    }
  }, []);

  const handlePlanEntryDone = useCallback((entryId: string, done: boolean) => {
      setDonePlanEntryIds(prevIds => {
          const newIds = new Set(prevIds);
          if (done) newIds.add(entryId); else newIds.delete(entryId);
          const todayStr = formatFns(new Date(), 'yyyy-MM-dd');
          localStorage.setItem('donePlanEntries', JSON.stringify({ date: todayStr, ids: Array.from(newIds) }));
          return newIds;
      });
  }, []);

  const handleNotificationClick = async (task: Task) => {
    if (!task.overdueNotified) await updateTask(task.id, { overdueNotified: true });
  };

  const handleLock = () => {
    localStorage.removeItem('sessionToken');
    localStorage.removeItem('sessionTimestamp');
    window.location.reload();
  };

  const handleFailedSmsClick = async () => {
    const logIdsToMarkAsRead = failedSmsLogs.map(log => log.id);
    if (logIdsToMarkAsRead.length > 0) await markFailedLogsAsRead(logIdsToMarkAsRead);
  }

  const handleOnlineOrderNotificationClick = async () => {
    const idsToUpdate = newOnlineOrders.map(o => o.id);
    if (idsToUpdate.length > 0) await markOnlineOrdersAsNotified(idsToUpdate);
  };

  const isNotificationPage = pathname === '/portal/admin/dashboard';
  const newTasks = notificationTasks.filter(t => !t.overdueNotified);
  const displayablePlanEntries = useMemo(() => todaysPlanEntries.filter(entry => !donePlanEntryIds.has(entry.id)), [todaysPlanEntries, donePlanEntryIds]);
  const totalNotifications = paymentNotificationCount + newTasks.length + displayablePlanEntries.length + failedSmsLogs.length + newOnlineOrders.length;

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background print:hidden">
      <div className="container mx-auto flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
                <Menu className="h-5 w-5" />
                <span className="sr-only">Toggle Sidebar</span>
            </Button>
            <Link href="/" className="text-2xl font-bold tracking-tight">Fin Plan</Link>
        </div>
        <nav className="hidden items-center gap-1 sm:gap-2 md:flex">
          {navItems.map((item) => (
            <Button key={item.href} asChild variant="ghost" className={cn("text-foreground hover:bg-accent/50 text-xs sm:text-sm px-2 sm:px-4", pathname === item.href && "bg-accent")}>
                <Link href={item.href} className="flex items-center gap-2">
                    {item.icon}
                    <span className="hidden lg:inline">{item.label}</span>
                </Link>
            </Button>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
           <Button asChild variant="ghost" className="text-foreground hover:bg-accent/50 text-xs sm:text-sm px-2 sm:px-4">
                <Link href="/tools" className="flex items-center gap-2">
                    <Wrench className="h-5 w-5" />
                    <span className="sr-only">Tools</span>
                </Link>
            </Button>
           <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className={cn("relative text-foreground hover:bg-accent/50 text-xs sm:text-sm px-2 sm:px-4", isNotificationPage && "bg-accent")}>
                    <Bell className="h-5 w-5" />
                    {totalNotifications > 0 && (
                        <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-1 text-xs">
                            {totalNotifications}
                        </Badge>
                    )}
                    <span className="sr-only">Notifications</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>Notifications</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {newOnlineOrders.length > 0 && (
                    <DropdownMenuItem asChild>
                        <Link href="/order-management" onClick={handleOnlineOrderNotificationClick} className="font-semibold text-blue-600">
                            <ShoppingCart className="mr-2 h-4 w-4"/> {newOnlineOrders.length} new online order(s)!
                        </Link>
                    </DropdownMenuItem>
                )}
                {failedSmsLogs.length > 0 && (
                  <DropdownMenuItem asChild>
                    <Link href="/sms-reminder" onClick={handleFailedSmsClick} className="text-destructive font-semibold">
                      <MessageSquareWarning className="mr-2 h-4 w-4"/> {failedSmsLogs.length} failed SMS message(s).
                    </Link>
                  </DropdownMenuItem>
                )}
                {paymentNotificationCount > 0 && (
                    <DropdownMenuItem asChild>
                        <Link href="/portal/admin/dashboard">
                            {paymentNotificationCount} pending payment(s) for verification.
                        </Link>
                    </DropdownMenuItem>
                )}
                {notificationTasks.length > 0 && (
                     <>
                        {notificationTasks.map(task => (
                           <DropdownMenuItem key={task.id} asChild onSelect={() => handleNotificationClick(task)}>
                             <Link href={`/tasks?taskId=${task.id}`} className="flex justify-between items-center gap-2">
                               <div className="flex items-center gap-2 flex-grow min-w-0">
                                  {!task.overdueNotified && <Circle className="h-2 w-2 text-blue-500 fill-current flex-shrink-0"/>}
                                   <div className="flex-grow min-w-0">
                                      <p className="font-semibold truncate">{task.title}</p>
                                      <p className="text-xs text-destructive">
                                          Due {formatDistanceToNow(parseISO(task.dueDate), { addSuffix: true })}
                                      </p>
                                   </div>
                               </div>
                                <Button variant="ghost" size="sm" className="flex-shrink-0">View</Button>
                             </Link>
                           </DropdownMenuItem>
                        ))}
                     </>
                )}
                 {displayablePlanEntries.length > 0 && (
                     <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Today's Plan</DropdownMenuLabel>
                        {displayablePlanEntries.map(entry => (
                             <DropdownMenuItem key={entry.id} onSelect={(e) => e.preventDefault()} className="cursor-pointer">
                               <div className="flex items-center gap-2 w-full">
                                   <Checkbox 
                                       id={`plan-${entry.id}`} 
                                       onCheckedChange={(checked) => handlePlanEntryDone(entry.id, !!checked)}
                                   />
                                   <label htmlFor={`plan-${entry.id}`} className="flex-grow truncate cursor-pointer flex justify-between items-center w-full pr-2">
                                       <span>{entry.description}</span>
                                       <span className="font-mono text-xs text-muted-foreground">{formatAmount(entry.amount)}</span>
                                   </label>
                               </div>
                             </DropdownMenuItem>
                        ))}
                     </>
                )}
                {(totalNotifications) === 0 && (
                    <DropdownMenuItem disabled>No new notifications</DropdownMenuItem>
                )}
            </DropdownMenuContent>
           </DropdownMenu>

           <Button asChild variant="ghost" className="text-foreground hover:bg-accent/50 text-xs sm:text-sm px-2 sm:px-4" onClick={handleLock}>
                <div className="flex items-center gap-2 cursor-pointer">
                    <Lock className="h-5 w-5" />
                    <span className="sr-only">Lock</span>
                </div>
            </Button>

           <Button asChild variant="ghost" className="text-foreground hover:bg-accent/50 text-xs sm:text-sm px-2 sm:px-4">
                <Link href="/settings" className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    <span className="sr-only">Settings</span>
                </Link>
            </Button>
        </div>
      </div>
    </header>
  );
}
