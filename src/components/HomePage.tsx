
'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import type { Account, Transaction, Party, Reminder, AppSettings, InventoryItem, SalesTarget, SmsLog, SmsPackage } from '@/types';
import { cn, formatAmount, getPartyBalanceEffect, formatDate } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowRightLeft, ShoppingCart, Plus, Banknote, Landmark, Scale, Users, FileText, Archive, Settings, ArrowDown, ArrowUp, TrendingUp, TrendingDown, Package, ArrowUpCircle, ArrowDownCircle, Bell, Clock, AlertTriangle, Target, MessageSquare } from 'lucide-react';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToReminders } from '@/services/reminderService';
import { getAppSettings } from '@/services/settingsService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { useIsMobile } from '@/hooks/use-mobile';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { isToday, isPast, parseISO, format, startOfToday, isFuture, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Progress } from './ui/progress';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import Autoplay from "embla-carousel-autoplay";
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { subscribeToSmsLogs } from '@/services/smsLogService';


const QuickActionCard = ({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) => (
    <Link href={href} className="flex flex-col items-center justify-center gap-2 p-4 bg-muted/50 rounded-lg hover:bg-primary/10 transition-colors">
        {icon}
        <span className="text-xs font-medium text-center">{label}</span>
    </Link>
)

interface TargetReport extends SalesTarget {
    purchasedQuantity: number;
    achievedQuantity: number;
    purchaseBreakdown: Record<string, number>;
    remainingQuantity: number;
    quantityProgress: number;
}


export default function HomePage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [smsLogs, setSmsLogs] = useState<SmsLog[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const router = useRouter();
  
  const [currentReminderIndex, setCurrentReminderIndex] = useState(0);

  useEffect(() => {
    setLoading(true);
    const unsubAccounts = subscribeToAccounts(setAccounts, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error fetching transactions' }));
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error fetching parties' }));
    const unsubReminders = subscribeToReminders(setReminders, (err) => toast({ variant: 'destructive', title: 'Error fetching reminders' }));
    const unsubInventory = subscribeToInventoryItems(setInventoryItems, (err) => toast({ variant: 'destructive', title: 'Error fetching inventory' }));
    const unsubSmsLogs = subscribeToSmsLogs(setSmsLogs, (err) => toast({ variant: 'destructive', title: 'Error fetching SMS logs' }));
    getAppSettings().then(setAppSettings);
    
    const timer = setTimeout(() => setLoading(false), 500);

    return () => {
      unsubAccounts();
      unsubTransactions();
      unsubParties();
      unsubReminders();
      unsubInventory();
      unsubSmsLogs();
      clearTimeout(timer);
    };
  }, [toast]);
  
  const { 
    todayBalances, 
    receivablesPayables, 
    todaySummary, 
    todaysReminders, 
    salesTargetData,
    todaysNetProfit,
    topSellingProducts,
    smsStats,
   } = useMemo(() => {
    const balances = accounts.reduce((acc, account) => {
        const lowerCaseName = account.name.toLowerCase();
        if (lowerCaseName.includes('cash')) acc.cash += account.balance;
        else acc.bank += account.balance;
        acc.total += account.balance;
        return acc;
    }, { cash: 0, bank: 0, total: 0 });

    const partyBalances = new Map<string, number>();
    transactions.forEach(tx => {
      if (tx.partyId && tx.enabled) {
        const currentBal = partyBalances.get(tx.partyId) || 0;
        partyBalances.set(tx.partyId, currentBal + getPartyBalanceEffect(tx, false));
      }
    });

    const receivablesPayables = parties.reduce((acc, party) => {
        const balance = partyBalances.get(party.id) || 0;
        if (balance < 0) { // Customer owes us
             if(party.partyType !== 'Supplier') acc.receivable += Math.abs(balance);
        } else if (balance > 0) { // We owe supplier
            if(party.partyType === 'Supplier') acc.payable += balance;
        }
        return acc;
    }, { receivable: 0, payable: 0 });
    
    const todayString = new Date().toISOString().split('T')[0];
    const todaysTransactions = transactions.filter(t => t.date === todayString && t.enabled);
    
    const summary = todaysTransactions.reduce((acc, tx) => {
        if (tx.type === 'sale' || tx.type === 'credit_sale') acc.sales += tx.amount;
        if (tx.type === 'purchase' || tx.type === 'credit_purchase') acc.purchases += tx.amount;
        if (tx.type === 'spent') acc.expenses += tx.amount;
        if (tx.type === 'give') acc.give += tx.amount;
        if (tx.type === 'receive') acc.receive += tx.amount;
        if (tx.type === 'income') acc.income += tx.amount;
        return acc;
    }, { sales: 0, purchases: 0, expenses: 0, give: 0, receive: 0, income: 0 });
    
    const todaysReminders = reminders
        .filter(r => {
            if (r.status !== 'pending' || !r.reminderDates || r.reminderDates.length === 0) return false;
            return r.reminderDates.some(d => isToday(parseISO(d)) || isPast(parseISO(d)));
        })
        .map(r => {
            const allDates = r.reminderDates.map(d => parseISO(d)).sort((a,b) => a.getTime() - b.getTime());
            const nextOrMostRecent = allDates.find(d => d >= new Date()) || allDates[allDates.length - 1];
            return {...r, nextReminder: nextOrMostRecent?.toISOString()};
        })
        .sort((a,b) => new Date(a.nextReminder!).getTime() - new Date(b.nextReminder!).getTime());

    // --- Today's Net Profit ---
    const todaysSales = todaysTransactions.filter(t => t.type === 'sale' || t.type === 'credit_sale');
    const todaysProfit = todaysSales.reduce((sum, tx) => {
        const costOfGoods = tx.items?.reduce((costSum, item) => costSum + (item.cost || 0), 0) || 0;
        return sum + (tx.amount - costOfGoods);
    }, 0);
    const todaysExpenses = todaysTransactions.filter(t => t.type === 'spent').reduce((sum, tx) => sum + tx.amount, 0);
    const todaysNetProfit = todaysProfit - todaysExpenses;

    // --- Top 20 Selling Products ---
    const productSalesCount = new Map<string, number>();
    transactions.forEach(tx => {
        if ((tx.type === 'sale' || tx.type === 'credit_sale') && tx.items) {
            tx.items.forEach(item => {
                productSalesCount.set(item.id, (productSalesCount.get(item.id) || 0) + item.quantity);
            });
        }
    });
    const topSellingProducts = Array.from(productSalesCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([id, _]) => inventoryItems.find(item => item.id === id))
        .filter(Boolean) as InventoryItem[];

    // --- Sales & Target Calculation ---
    const currentMonth = format(new Date(), 'yyyy-MM');
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    
    const currentMonthTargets = (appSettings?.salesTargets || []).filter(t => t.month === currentMonth);
    
    const transactionsInMonth = transactions.filter(tx => {
        if (!tx.date || typeof tx.date !== 'string') return false; // Safety check
        const txDate = parseISO(tx.date);
        return tx.enabled && txDate >= monthStart && txDate <= monthEnd;
    });

    const targetReports: TargetReport[] = currentMonthTargets.map(target => {
        const relevantPurchases = transactionsInMonth.filter(tx => 
            (tx.type === 'purchase' || tx.type === 'credit_purchase') &&
            (target.businessProfile === 'all' || tx.via === target.businessProfile) &&
            (target.partyId ? tx.partyId === target.partyId : true)
        );

        const relevantSales = transactionsInMonth.filter(tx => 
            (tx.type === 'sale' || tx.type === 'credit_sale') &&
            (target.businessProfile === 'all' || tx.via === target.businessProfile) &&
            (target.partyId ? tx.partyId === target.partyId : true)
        );
        
        const purchaseBreakdown = relevantPurchases
            .flatMap(tx => tx.items || [])
            .filter(item => target.productIds.includes(item.id))
            .reduce((acc, item) => {
                acc[item.name] = (acc[item.name] || 0) + item.quantity;
                return acc;
            }, {} as Record<string, number>);

        const purchasedQuantity = Object.values(purchaseBreakdown).reduce((sum, qty) => sum + qty, 0);
        
        const achievedQuantity = relevantSales
            .flatMap(tx => tx.items || [])
            .filter(item => target.productIds.includes(item.id))
            .reduce((sum, item) => sum + item.quantity, 0);

        const targetForRemaining = target.type === 'programme' ? (target.programmeQuantityTarget || 0) : target.quantityTarget;
        const remainingQuantity = targetForRemaining - purchasedQuantity;

        let quantityProgress = 0;
        if (target.type === 'programme' && target.programmeQuantityTarget && target.programmeQuantityTarget > 0) {
            quantityProgress = (purchasedQuantity / target.programmeQuantityTarget) * 100;
        } else if (target.quantityTarget > 0) {
            quantityProgress = (purchasedQuantity / target.quantityTarget) * 100;
        }
        
        return {
            ...target,
            purchasedQuantity,
            achievedQuantity,
            purchaseBreakdown,
            remainingQuantity,
            quantityProgress,
        };
    });

    // --- SMS Stats ---
    const smsStats = (['Twilio', 'SMSQ', 'Pushbullet'] as Array<SmsPackage['provider']>).map(provider => {
        const lowerCaseProvider = provider.toLowerCase();
        
        const packagesForProvider = (appSettings?.smsPackages || []).filter(pkg => pkg.provider.toLowerCase() === lowerCaseProvider);
        const totalPurchased = packagesForProvider.reduce((sum, pkg) => sum + (pkg.quantity || 0), 0);
        const totalSent = smsLogs.filter(log => log.provider.toLowerCase() === lowerCaseProvider).reduce((sum, log) => sum + (log.segments || 0), 0);
        const remaining = totalPurchased - totalSent;

        const latestPackage = [...packagesForProvider].sort((a,b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime())[0];
        const expiryDate = latestPackage?.expiryDate ? parseISO(latestPackage.expiryDate) : null;
        const daysUntilExpiry = expiryDate ? differenceInDays(expiryDate, new Date()) : null;

        return { 
            provider,
            remaining, 
            totalSent, 
            expiryDate, 
            daysUntilExpiry 
        };
    });


    return { 
      todayBalances: balances, 
      receivablesPayables, 
      todaySummary: summary, 
      todaysReminders,
      salesTargetData: targetReports,
      todaysNetProfit,
      topSellingProducts,
      smsStats,
    };
  }, [accounts, transactions, reminders, appSettings, inventoryItems, parties, smsLogs]);
  
   useEffect(() => {
    if (todaysReminders.length > 1) {
      const interval = setInterval(() => {
        setCurrentReminderIndex(prevIndex => (prevIndex + 1) % todaysReminders.length);
      }, 5000); // Change reminder every 5 seconds
      return () => clearInterval(interval);
    }
  }, [todaysReminders.length]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const formatRemaining = (remaining: number) => {
    if (remaining < 0) {
        return `+${Math.abs(remaining)}`;
    }
    return remaining;
  };

  return (
    <div className="space-y-6">
       <Card>
        <CardHeader>
            <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
                <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <CardDescription className="flex items-center justify-between text-sm text-green-600"><span>Total Receivable</span> <ArrowDown/></CardDescription>
                  <p className="font-bold text-xl text-green-700">{formatAmount(receivablesPayables.receivable)}</p>
                </div>
                <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <CardDescription className="flex items-center justify-between text-sm text-red-600"><span>Total Payable</span> <ArrowUp/></CardDescription>
                  <p className="font-bold text-xl text-red-700">{formatAmount(receivablesPayables.payable)}</p>
                </div>
            </div>
             <div className="space-y-2">
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <CardDescription className="text-sm text-blue-600">Today's Net Profit</CardDescription>
                  <p className="font-bold text-xl text-blue-700">{formatAmount(todaysNetProfit)}</p>
                </div>
                <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <CardDescription className="text-sm text-purple-600">Top Selling Products (Stock)</CardDescription>
                   {topSellingProducts.length > 0 ? (
                       <Carousel 
                         opts={{ align: "start", loop: true }}
                         plugins={[Autoplay({delay: 5000})]}
                         className="w-full"
                        >
                          <CarouselContent>
                            {topSellingProducts.map(item => (
                              <CarouselItem key={item.id} className="basis-1/3 md:basis-1/4">
                                <div className="text-center p-1">
                                    <Avatar className="h-10 w-10 mx-auto rounded-md">
                                        <AvatarImage src={item.imageUrl} alt={item.name} />
                                        <AvatarFallback className="rounded-md">{item.name.charAt(0)}</AvatarFallback>
                                    </Avatar>
                                    <p className="text-xs font-semibold truncate mt-1" title={item.name}>{item.name}</p>
                                    <p className="font-bold text-lg text-purple-700">{item.quantity}</p>
                                </div>
                              </CarouselItem>
                            ))}
                          </CarouselContent>
                          <CarouselPrevious className="h-6 w-6 -left-4"/>
                          <CarouselNext className="h-6 w-6 -right-4" />
                       </Carousel>
                   ) : <p className="text-xs text-muted-foreground text-center pt-4">No sales data</p>}
                </div>
            </div>
        </CardContent>
      </Card>


       <Card>
        <CardHeader>
            <CardTitle>Today's Balance</CardTitle>
          </CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <CardDescription className="flex items-center gap-1 text-muted-foreground"><Banknote className="h-4 w-4"/> Cash</CardDescription>
              <p className="font-bold text-lg">{formatAmount(todayBalances.cash)}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <CardDescription className="flex items-center gap-1 text-muted-foreground"><Landmark className="h-4 w-4"/> Bank</CardDescription>
              <p className="font-bold text-lg">{formatAmount(todayBalances.bank)}</p>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <CardDescription className="flex items-center gap-1 text-muted-foreground"><Scale className="h-4 w-4"/> Total</CardDescription>
              <p className="font-bold text-lg">{formatAmount(todayBalances.total)}</p>
            </div>
        </CardContent>
      </Card>

        <Card>
            <CardHeader className="p-4 flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2"><MessageSquare/> SMS & API Status</CardTitle>
                <Link href="/sms-reminder" className="text-sm text-primary hover:underline">Manage SMS</Link>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {smsStats.map(stat => {
                    const isLowBalance = stat.remaining < (appSettings?.smsAlertSettings?.lowBalanceThreshold || 500);
                    const isExpiringSoon = stat.daysUntilExpiry !== null && stat.daysUntilExpiry <= (appSettings?.smsAlertSettings?.expiryWarningDays || 7);
                    return (
                        <Card key={stat.provider} className={cn((isLowBalance || isExpiringSoon) && "border-destructive")}>
                            <CardHeader className="pb-2">
                                <CardTitle className="text-base font-semibold">{stat.provider}</CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm space-y-1">
                                <div className="flex justify-between"><span>Remaining:</span> <span className={cn("font-bold", isLowBalance && "text-destructive")}>{stat.remaining}</span></div>
                                <div className="flex justify-between"><span>Sent:</span> <span>{stat.totalSent}</span></div>
                                <div className="flex justify-between"><span>Expiry:</span> <span>{stat.expiryDate ? formatDate(stat.expiryDate.toISOString()) : 'N/A'}</span></div>
                                {isExpiringSoon && <div className="text-xs text-destructive pt-1">Expires in {stat.daysUntilExpiry} days!</div>}
                            </CardContent>
                        </Card>
                    )
                })}
            </CardContent>
        </Card>

      <Card>
        <CardHeader className="p-4 flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Target/> This Month's Target</CardTitle>
            <Link href="/reports/sales-target" className="text-sm text-primary hover:underline">View Details</Link>
        </CardHeader>
        <CardContent className="space-y-4">
            {salesTargetData.length > 0 ? salesTargetData.map(target => (
                <div key={target.id} className="text-sm border rounded-lg p-3">
                    <div className="font-semibold">{(target.productNames || []).join(', ')}</div>
                    <div className="text-xs text-muted-foreground">{target.partyName || target.businessProfile}</div>
                    <Progress value={target.quantityProgress} className="mt-2" />
                     <div className="grid grid-cols-4 text-xs mt-1 text-center">
                       <div className="text-left"><span className="text-muted-foreground">Target:</span> {target.quantityTarget}</div>
                       <div><span className="text-muted-foreground">Purchased:</span> {target.purchasedQuantity}</div>
                       <div className="text-right"><span className="text-muted-foreground">Remaining:</span> {formatRemaining(target.remainingQuantity)}</div>
                       <div className="text-right"><span className="text-muted-foreground">Progress:</span> {target.quantityProgress.toFixed(0)}%</div>
                    </div>
                    {Object.keys(target.purchaseBreakdown).length > 0 && (
                        <div className="mt-1 text-xs text-muted-foreground border-t pt-1">
                           Purchased: {Object.entries(target.purchaseBreakdown).map(([name, qty]) => `${name}: ${qty}`).join(', ')}
                        </div>
                    )}
                </div>
            )) : <p className="text-sm text-muted-foreground text-center py-4">No purchase targets set for this month.</p>}
        </CardContent>
      </Card>


       <Card>
          <CardHeader className="p-3 pb-2"><CardTitle className="text-base">Today's Summary</CardTitle></CardHeader>
          <CardContent className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
              <span className="flex items-center gap-1.5"><TrendingUp className="text-green-500"/> Sales</span>
              <span className="font-mono">{formatAmount(todaySummary.sales)}</span>
            </div>
             <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
              <span className="flex items-center gap-1.5"><TrendingUp className="text-green-500"/> Income</span>
              <span className="font-mono">{formatAmount(todaySummary.income)}</span>
            </div>
             <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
              <span className="flex items-center gap-1.5"><ArrowDownCircle className="text-blue-500"/> Receive</span>
              <span className="font-mono">{formatAmount(todaySummary.receive)}</span>
            </div>
            <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
              <span className="flex items-center gap-1.5"><Package className="text-blue-500"/> Purchases</span>
              <span className="font-mono">{formatAmount(todaySummary.purchases)}</span>
            </div>
            <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
              <span className="flex items-center gap-1.5"><TrendingDown className="text-red-500"/> Expenses</span>
              <span className="font-mono">{formatAmount(todaySummary.expenses)}</span>
            </div>
             <div className="flex justify-between items-center text-sm p-2 bg-muted rounded-md">
              <span className="flex items-center gap-1.5"><ArrowUpCircle className="text-orange-500"/> Give</span>
              <span className="font-mono">{formatAmount(todaySummary.give)}</span>
            </div>
          </CardContent>
        </Card>
      
      <Link href="/reminders" passHref>
        <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="text-primary"/> Today's Reminders &amp; Overdues</CardTitle>
            </CardHeader>
            <CardContent>
                <AnimatePresence mode="wait">
                    {todaysReminders.length > 0 ? (
                        <motion.div
                            key={currentReminderIndex}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            transition={{ duration: 0.5 }}
                        >
                            {(() => {
                                const reminder = todaysReminders[currentReminderIndex];
                                if (!reminder) return null; // Add a guard clause here
                                const isOverdue = reminder.nextReminder ? isPast(parseISO(reminder.nextReminder)) && !isToday(parseISO(reminder.nextReminder)) : false;
                                return (
                                    <div className={cn("flex items-start gap-3 p-3 rounded-lg", isOverdue ? "bg-red-50 dark:bg-red-900/20" : "bg-blue-50 dark:bg-blue-900/20")}>
                                        {isOverdue ? <AlertTriangle className="h-5 w-5 text-red-500 mt-1"/> : <Clock className="h-5 w-5 text-blue-500 mt-1"/>}
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <p className="font-semibold">{reminder.partyName}</p>
                                                {isOverdue && <Badge variant="destructive">Overdue</Badge>}
                                            </div>
                                            <p className="text-sm text-muted-foreground">{reminder.notes}</p>
                                            <p className="text-xs font-mono text-muted-foreground mt-1">Due: {reminder.nextReminder ? format(parseISO(reminder.nextReminder), 'MMM d, h:mm a') : 'N/A'}</p>
                                        </div>
                                    </div>
                                );
                            })()}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="no-reminders"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.5 }}
                        >
                           <p className="text-sm text-muted-foreground text-center py-4">You have no reminders for today. Enjoy your day!</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </CardContent>
        </Card>
       </Link>

      <Card>
        <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-4 gap-4">
            <QuickActionCard href="/parties" icon={<Users className="h-6 w-6"/>} label="Parties" />
            <QuickActionCard href="/reports" icon={<FileText className="h-6 w-6"/>} label="Reports" />
            <QuickActionCard href="/inventory" icon={<Archive className="h-6 w-6"/>} label="Inventory" />
            <QuickActionCard href="/settings" icon={<Settings className="h-6 w-6"/>} label="Settings" />
        </CardContent>
      </Card>

    </div>
  );
}
