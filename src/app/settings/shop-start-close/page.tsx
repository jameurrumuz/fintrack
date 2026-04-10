'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
import { addDailyReport, subscribeToDailyReports, updateDailyReport, deleteDailyReport } from '@/services/shopSessionService';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import type { AppSettings, ShopDayReport, Transaction, Account } from '@/types';
import { Loader2, Store, Save, History, Trash2, Calculator, Wallet, Briefcase, TrendingUp, TrendingDown, Edit, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { formatAmount, formatDate, getEffectiveAmount } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ShopSessionManager from '@/components/shop/ShopSessionManager';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { format as formatFns, parseISO, endOfDay, startOfDay, isWithinInterval, addDays, startOfMonth, isEqual, subDays, isValid } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DatePicker } from '@/components/ui/date-picker';


const DENOMINATIONS = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

const NoteCounter = ({ title, icon, counts, onChange, total }: { title: string, icon: React.ReactNode, counts: Record<number, string>, onChange: (denom: number, value: string) => void, total: number }) => (
    <div className="space-y-2 p-3 border rounded-lg">
        <h4 className="font-semibold text-center flex items-center justify-center gap-2">{icon} {title}</h4>
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead className="text-center">Note</TableHead>
                    <TableHead className="text-center">Count</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {DENOMINATIONS.map(denom => (
                    <TableRow key={denom}>
                        <TableCell className="text-center font-medium">৳{denom}</TableCell>
                        <TableCell>
                             <Input
                                type="number"
                                placeholder="0"
                                className="text-center h-8"
                                min="0"
                                value={counts[denom] || ''}
                                onChange={(e) => onChange(denom, e.target.value)}
                            />
                        </TableCell>
                        <TableCell className="text-right text-sm">
                            {counts[denom] ? (parseInt(counts[denom]) * denom).toLocaleString() : '-'}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
            <TableFooter>
                <TableRow>
                    <TableCell colSpan={2} className="font-bold text-right">Total</TableCell>
                    <TableCell className="text-right font-bold">{formatAmount(total)}</TableCell>
                </TableRow>
            </TableFooter>
        </Table>
    </div>
);

const EditReportDialog = ({ report, isOpen, onOpenChange, onSave, accounts }: { report: ShopDayReport | null, isOpen: boolean, onOpenChange: (open: boolean) => void, onSave: (id: string, data: any) => void, accounts: Account[] }) => {
    const [physicalBalances, setPhysicalBalances] = useState<Record<string, { balance: string; breakdown: Record<number, string> }>>({});

    useEffect(() => {
        if (report) {
            const initialBalances: Record<string, { balance: string; breakdown: Record<number, string> }> = {};
            accounts.forEach(acc => {
                const existingBalance = report.physicalBalances.find(b => b.accountId === acc.id);
                initialBalances[acc.id] = {
                    balance: existingBalance ? String(existingBalance.balance) : '0',
                    breakdown: existingBalance?.breakdown || {},
                };
            });
            setPhysicalBalances(initialBalances);
        }
    }, [report, accounts]);

    const handleNoteChange = (accountId: string, denom: number, value: string) => {
        if (parseInt(value) < 0) return;
        setPhysicalBalances(prev => {
            const newBalances = { ...prev };
            const newBreakdown = { ...newBalances[accountId].breakdown, [denom]: value };
            const newTotal = DENOMINATIONS.reduce((sum, d) => sum + ((parseInt(newBreakdown[d]) || 0) * d), 0);
            newBalances[accountId] = { breakdown: newBreakdown, balance: newTotal.toString() };
            return newBalances;
        });
    };
    
    const handleBalanceChange = (accountId: string, value: string) => {
        setPhysicalBalances(prev => ({
            ...prev,
            [accountId]: {
                ...(prev[accountId] || { breakdown: {} }),
                balance: value,
            }
        }));
    };
    
    const grandTotal = useMemo(() => {
        return accounts.reduce((total, acc) => {
            const balanceData = physicalBalances[acc.id];
            if (balanceData) {
                if (acc.name.toLowerCase().includes('cash')) {
                    return total + DENOMINATIONS.reduce((sum, denom) => sum + ((parseInt(balanceData.breakdown[denom]) || 0) * denom), 0);
                }
                return total + (parseFloat(balanceData.balance) || 0);
            }
            return total;
        }, 0);
    }, [physicalBalances, accounts]);

    const handleSaveChanges = () => {
        if (!report) return;
        const reportData = {
            physicalBalances: accounts.map(acc => {
                const balanceData = physicalBalances[acc.id] || { balance: '0', breakdown: {} };
                 const isCash = acc.name.toLowerCase().includes('cash');
                 const finalBalance = isCash
                    ? DENOMINATIONS.reduce((sum, denom) => sum + ((parseInt(balanceData.breakdown[denom]) || 0) * denom), 0)
                    : parseFloat(balanceData.balance) || 0;

                return {
                    accountName: acc.name,
                    accountId: acc.id,
                    balance: finalBalance,
                    breakdown: isCash ? balanceData.breakdown : {},
                };
            }).filter(b => b.balance > 0),
            totalAmount: grandTotal,
        };
        onSave(report.id, reportData);
    };
    
    if (!report) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>Edit Report for {formatDate(report.date)}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 py-4 max-h-[60vh] overflow-y-auto">
                    {accounts.map(acc => {
                         const isCash = acc.name.toLowerCase().includes('cash');
                         const balanceData = physicalBalances[acc.id] || { balance: '', breakdown: {} };
                         
                         const total = isCash
                            ? DENOMINATIONS.reduce((sum, denom) => sum + ((parseInt(balanceData.breakdown[denom]) || 0) * denom), 0)
                            : parseFloat(balanceData.balance) || 0;

                         if (isCash) {
                             return <NoteCounter 
                                        key={acc.id}
                                        title={acc.name} 
                                        icon={acc.name.toLowerCase().includes('drawer') ? <Briefcase/> : <Wallet/>}
                                        counts={balanceData.breakdown} 
                                        onChange={(d, v) => handleNoteChange(acc.id, d, v)} 
                                        total={total}
                                    />
                         }
                         return (
                             <Card key={acc.id} className="p-4 space-y-2">
                                <Label className="font-semibold">{acc.name}</Label>
                                <Input 
                                    type="number" 
                                    placeholder="Enter balance"
                                    value={balanceData.balance}
                                    onChange={(e) => handleBalanceChange(acc.id, e.target.value)}
                                />
                                <p className="text-right font-bold">{formatAmount(total)}</p>
                             </Card>
                         )
                    })}
                </div>
                <div className="border-t mt-4 pt-4 flex justify-between items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <span className="text-lg font-bold flex items-center gap-2">Grand Total:</span>
                    <span className="text-2xl font-bold text-primary">৳ {grandTotal.toLocaleString()}</span>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSaveChanges}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const DaySummaryCard = ({ title, amount, colorClass, icon: Icon }: { title: string; amount: number; colorClass: string; icon: React.ElementType }) => (
    <Card className={cn("border-l-4", colorClass)}>
        <CardHeader className="p-3">
            <CardDescription className="flex items-center gap-2 text-sm">{Icon && <Icon className="h-4 w-4" />} {title}</CardDescription>
            <CardTitle className="text-2xl">{formatAmount(amount)}</CardTitle>
        </CardHeader>
    </Card>
);

const CurrentSessionSummary = ({ reports, transactions, accounts, dateRange, selectedAccountId }: { reports: ShopDayReport[]; transactions: Transaction[]; accounts: Account[], dateRange: DateRange | undefined, selectedAccountId: string }) => {
    
    const { openingBalance, accountIdsToFilter } = useMemo(() => {
        let idsToFilter: Set<string>;
        if (selectedAccountId === 'all-cash') {
            idsToFilter = new Set(accounts.filter(a => a.name.toLowerCase().includes('cash')).map(a => a.id));
        } else {
            idsToFilter = new Set([selectedAccountId]);
        }

        const fromDate = dateRange?.from ? startOfDay(dateRange.from) : new Date(0);
        const dateQueryStr = formatFns(fromDate, 'yyyy-MM-dd');
        
        const openingReportForDate = reports.find(r => 
            r.type === 'OPEN' && 
            r.date === dateQueryStr
        );

        if (openingReportForDate) {
            let balance = 0;
            const balancesFromReport = openingReportForDate.physicalBalances || [];
            if (selectedAccountId === 'all-cash') {
                balance = balancesFromReport
                    .filter(b => idsToFilter.has(b.accountId))
                    .reduce((sum, b) => sum + b.balance, 0);
            } else {
                const accountBalance = balancesFromReport.find(b => b.accountId === selectedAccountId);
                balance = accountBalance?.balance || 0;
            }
            return { openingBalance: balance, accountIdsToFilter: idsToFilter };
        }
        
        const lastCloseReport = [...reports]
            .filter(r => r.type === 'CLOSE' && new Date(r.date) < fromDate)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (lastCloseReport) {
            let balance = 0;
            const balancesFromReport = lastCloseReport.physicalBalances || [];
            if (selectedAccountId === 'all-cash') {
                balance = balancesFromReport
                    .filter(b => idsToFilter.has(b.accountId))
                    .reduce((sum, b) => sum + b.balance, 0);
            } else {
                const accountBalance = balancesFromReport.find(b => b.accountId === selectedAccountId);
                balance = accountBalance?.balance || 0;
            }
            return { openingBalance: balance, accountIdsToFilter: idsToFilter };
        }

        // Fallback: calculate from all transactions before the start date
        const calculatedOpeningBalance = transactions.reduce((balance, tx) => {
            if (!tx.enabled) return balance;
            
            const txDate = new Date(tx.date);
            if (txDate >= fromDate) return balance;
            
            let effect = 0;
             if (tx.type === 'transfer') {
                if (tx.fromAccountId && idsToFilter.has(tx.fromAccountId)) effect -= tx.amount;
                if (tx.toAccountId && idsToFilter.has(tx.toAccountId)) effect += tx.amount;
            } else if ((tx.type === 'sale' || tx.type === 'credit_sale') && tx.payments && tx.payments.length > 0) {
                 effect = tx.payments
                    .filter(p => idsToFilter.has(p.accountId))
                    .reduce((sum, p) => sum + p.amount, 0);
            } else if (tx.accountId && idsToFilter.has(tx.accountId)) {
                effect = getEffectiveAmount(tx);
            }
            return balance + effect;
        }, 0);


        return { openingBalance: calculatedOpeningBalance, accountIdsToFilter: idsToFilter };
    }, [reports, accounts, selectedAccountId, dateRange, transactions]);

    const cashTransactions = useMemo(() => {
        if (!dateRange?.from || accountIdsToFilter.size === 0) return [];
    
        const fromDate = startOfDay(dateRange.from);
        const toDate = dateRange.to ? endOfDay(dateRange.to) : endOfDay(dateRange.from);
    
        return transactions.filter(tx => {
            if (!tx.enabled) return false;
            
            let txDate: Date;
            try {
                if (tx.date && (tx.date as any).toDate) {
                    txDate = (tx.date as any).toDate();
                } else if (typeof tx.date === 'string') {
                    const isoDate = parseISO(tx.date);
                    if (isValid(isoDate)) {
                        txDate = isoDate;
                    } else {
                        const [year, month, day] = tx.date.split('-').map(Number);
                        txDate = new Date(year, month - 1, day);
                    }
                } else {
                    return false; 
                }
                
                if (!isValid(txDate)) return false; 
            } catch (e) {
                console.error("Error parsing transaction date", tx.date, e);
                return false;
            }
    
            const isInRange = isWithinInterval(txDate, { start: fromDate, end: toDate });
            if (!isInRange) return false;
    
            if (tx.type === 'transfer') {
                return accountIdsToFilter.has(tx.fromAccountId || '') || accountIdsToFilter.has(tx.toAccountId || '');
            }
            if (tx.payments && tx.payments.length > 0) {
                return tx.payments.some(p => accountIdsToFilter.has(p.accountId));
            }
            return tx.accountId ? accountIdsToFilter.has(tx.accountId) : false;
        });
    }, [transactions, dateRange, accountIdsToFilter]);


    const summary = useMemo(() => {
        const result = { 
            cashIn: 0, 
            cashOut: 0, 
            byType: {} as Record<string, { total: number, count: number, transactions: (Transaction & { displayAmount: number })[] }> 
        };

        cashTransactions.forEach(tx => {
            let effect = 0;
            let displayAmount = 0;

            if (tx.type === 'transfer') {
                if (tx.fromAccountId && accountIdsToFilter.has(tx.fromAccountId)) effect -= tx.amount;
                if (tx.toAccountId && accountIdsToFilter.has(tx.toAccountId)) effect += tx.amount;
                displayAmount = tx.amount;
            } else if (tx.payments && tx.payments.length > 0) {
                 const paymentToAccount = tx.payments.find(p => accountIdsToFilter.has(p.accountId));
                 if (paymentToAccount) {
                    effect = paymentToAccount.amount; // Always positive for sale payments
                    displayAmount = paymentToAccount.amount;
                 }
            } else if (tx.accountId && accountIdsToFilter.has(tx.accountId)) {
                effect = getEffectiveAmount(tx);
                displayAmount = Math.abs(effect);
            }
            
            if (effect > 0) result.cashIn += effect;
            else if (effect < 0) result.cashOut += Math.abs(effect);
            
            if (displayAmount > 0) {
                const type = tx.type || 'other';
                if (!result.byType[type]) result.byType[type] = { total: 0, count: 0, transactions: [] };
                
                result.byType[type].total += displayAmount;
                result.byType[type].count += 1;
                result.byType[type].transactions.push({ ...tx, displayAmount });
            }
        });

        return result;
    }, [cashTransactions, accountIdsToFilter]);
    

    if (reports.length === 0 && cashTransactions.length === 0) {
        return <div className="text-center p-8 text-muted-foreground">No session found for the selected date. Start a new day to see the summary.</div>;
    }
    
    const expectedClosingBalance = openingBalance + summary.cashIn - summary.cashOut;
    
    const closingReport = reports.find(r => r.type === 'CLOSE');
    let discrepancy: number | null = null;
    if (closingReport) {
        let closingPhysicalBalance = 0;
        if (selectedAccountId === 'all-cash') {
            closingPhysicalBalance = (closingReport.physicalBalances || [])
                .filter(b => accountIdsToFilter.has(b.accountId))
                .reduce((sum, b) => sum + b.balance, 0);
        } else {
            closingPhysicalBalance = closingReport.physicalBalances.find(b => b.accountId === selectedAccountId)?.balance || 0;
        }
        discrepancy = closingPhysicalBalance - expectedClosingBalance;
    }
    
    return (
        <div className="space-y-4">
             <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <DaySummaryCard title="Opening Balance" amount={openingBalance} colorClass="border-blue-500" icon={Briefcase} />
                <DaySummaryCard title="Total Cash In" amount={summary.cashIn} colorClass="border-green-500" icon={TrendingUp} />
                <DaySummaryCard title="Total Cash Out" amount={summary.cashOut} colorClass="border-red-500" icon={TrendingDown} />
                <DaySummaryCard title="Expected Closing" amount={expectedClosingBalance} colorClass="border-indigo-500" icon={Calculator} />
            </div>
            {closingReport && discrepancy !== null && (
                 <div className={cn("p-4 rounded-lg text-center font-semibold", discrepancy === 0 ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800")}>
                    {discrepancy === 0 ? "No discrepancy found." : `Discrepancy: ${formatAmount(discrepancy)}`}
                 </div>
            )}
            
            <Accordion type="multiple" className="w-full">
                {Object.entries(summary.byType).map(([type, data]) => {
                    if (data.count === 0) return null;
                    return (
                     <AccordionItem value={type} key={type}>
                        <AccordionTrigger>
                            <div className="flex justify-between w-full pr-4">
                                <span>{type.replace('_', ' ').toUpperCase()} ({data.count})</span>
                                <span>{formatAmount(data.total)}</span>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.transactions.map(tx => (
                                        <TableRow key={tx.id}>
                                            <TableCell>{tx.description}</TableCell>
                                            <TableCell className="text-right font-mono">{formatAmount(tx.displayAmount)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </AccordionContent>
                     </AccordionItem>
                    )
                })}
            </Accordion>
        </div>
    )
}

export default function ShopStartClosePage() {
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [savedReports, setSavedReports] = useState<ShopDayReport[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const [isEditReportOpen, setIsEditReportOpen] = useState(false);
    const [editingReport, setEditingReport] = useState<ShopDayReport | null>(null);
    const [dialogMode, setDialogMode] = useState<'OPEN' | 'CLOSE'>('OPEN');
    
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
      from: startOfDay(new Date()),
      to: endOfDay(new Date()),
    });
    
    const [selectedAccountId, setSelectedAccountId] = useState('all-cash');

    const [startTime, setStartTime] = useState('09:00');
    const [closeTime, setCloseTime] = useState('21:00');
    
    useEffect(() => {
        const loadInitialData = async () => {
            setLoading(true);
            try {
                const settings = await getAppSettings();
                setAppSettings(settings);
                if (settings?.shopTimeSettings) {
                    setStartTime(settings.shopTimeSettings.startTime);
                    setCloseTime(settings.shopTimeSettings.closeTime);
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error loading settings', description: error.message });
            }
        };

        loadInitialData();

        const unsubReports = subscribeToDailyReports(setSavedReports, (err) => {
            toast({ variant: 'destructive', title: 'Error loading reports', description: err.message });
        });
        
        const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => {
            toast({ variant: 'destructive', title: 'Error loading transactions', description: err.message });
        });
        
        const unsubAccounts = subscribeToAccounts(setAccounts, (err) => {
             toast({ variant: 'destructive', title: 'Error loading accounts', description: err.message });
        });
        
        setLoading(false);
        return () => { unsubReports(); unsubTransactions(); unsubAccounts(); };

    }, [toast]);
    
    const sortedReports = useMemo(() => {
        return [...savedReports].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime() || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }, [savedReports]);

    const reportsForSelectedDate = useMemo(() => {
        if (!dateRange?.from) return [];
        const selectedDateStr = formatFns(dateRange.from, 'yyyy-MM-dd');
        return sortedReports.filter(r => r.date === selectedDateStr);
    }, [sortedReports, dateRange]);


    const lastReport = useMemo(() => {
        const lastClose = sortedReports.find(r => r.type === 'CLOSE');
        return lastClose || sortedReports[0] || null;
    }, [sortedReports]);

    const handleSaveReport = async (data: any) => {
        try {
            await addDailyReport({ type: dialogMode, ...data });
            toast({ title: 'Success', description: `${dialogMode === 'OPEN' ? 'Opening' : 'Closing'} report saved.`});
            setIsDialogOpen(false);
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    }
    
    const handleUpdateReport = async (id: string, data: any) => {
        try {
            await updateDailyReport(id, data);
            toast({ title: 'Success', description: 'Report updated successfully.' });
            setIsEditReportOpen(false);
        } catch(e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    }

    const handleDeleteReport = async (id: string) => {
        try {
            await deleteDailyReport(id);
            toast({ title: 'Success', description: 'Report deleted.' });
        } catch (e: any) {
            toast({ variant: 'destructive', title: 'Error', description: e.message });
        }
    }

    const handleSaveTimings = async () => {
        if (!appSettings) return;
        setIsSaving(true);
        try {
            const newSettings: AppSettings = {
                ...appSettings,
                shopTimeSettings: { startTime, closeTime }
            };
            await saveAppSettings(newSettings);
            setAppSettings(newSettings);
            toast({ title: 'Success!', description: 'Shop timings have been saved.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Could not save settings: ${error.message}` });
        } finally {
            setIsSaving(false);
        }
    };
    
    const clearHistory = () => {
        if(window.confirm("Are you sure you want to clear all history? This cannot be undone.")) {
            // In a real app with a backend, you'd call a service function here.
            localStorage.removeItem('shop_daily_reports');
            setSavedReports([]);
            toast({ title: "History Cleared" });
        }
    };

    const handleDateChange = (days: number) => {
        setDateRange(currentRange => {
            const from = currentRange?.from || new Date();
            const newDate = addDays(from, days);
            return { from: newDate, to: newDate };
        });
    };
    
    if (loading) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
             <ShopSessionManager 
                mode={dialogMode}
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                onSave={handleSaveReport}
                lastReport={lastReport}
                accounts={accounts}
                transactions={transactions}
             />
             <EditReportDialog
                report={editingReport}
                isOpen={isEditReportOpen}
                onOpenChange={setIsEditReportOpen}
                onSave={handleUpdateReport}
                accounts={accounts}
             />
             <div className="mb-6">
                <Button variant="outline" asChild><Link href="/settings">← Back to Settings</Link></Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Store /> Shop Start &amp; Close Time</CardTitle>
                    <CardDescription>Set the daily start and close times.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-lg">
                        <div className="space-y-2">
                            <Label htmlFor="start-time">Shop Start Time</Label>
                            <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="close-time">Shop Close Time</Label>
                            <Input id="close-time" type="time" value={closeTime} onChange={(e) => setCloseTime(e.target.value)} />
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-4">
                     <Button onClick={handleSaveTimings} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Timings
                    </Button>
                    <div className="flex gap-4">
                        <Button size="lg" className="bg-green-600 hover:bg-green-700" onClick={() => { setDialogMode('OPEN'); setIsDialogOpen(true); }}>
                            ☀️ Start Day
                        </Button>
                        <Button size="lg" className="bg-red-600 hover:bg-red-700" onClick={() => { setDialogMode('CLOSE'); setIsDialogOpen(true); }}>
                            🌙 End Day
                        </Button>
                    </div>
                </CardFooter>
            </Card>

             <Tabs defaultValue="summary">
                <TabsList>
                    <TabsTrigger value="summary">Session Summary</TabsTrigger>
                    <TabsTrigger value="history">Daily Reports History</TabsTrigger>
                </TabsList>
                <TabsContent value="summary">
                    <Card>
                         <CardContent className="pt-6">
                            <div className="flex flex-wrap gap-4 mb-4">
                                <div className="space-y-1">
                                    <Label>Select Date</Label>
                                    <div className="flex items-center gap-2">
                                        <Button variant="outline" size="icon" onClick={() => handleDateChange(-1)}>
                                            <ChevronLeft className="h-4 w-4" />
                                        </Button>
                                        <DateRangePicker
                                            date={dateRange}
                                            onDateChange={(range) => setDateRange(range)}
                                        />
                                        <Button variant="outline" size="icon" onClick={() => handleDateChange(1)}>
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label>Select Account</Label>
                                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                        <SelectTrigger className="w-[200px]">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all-cash">All Cash Accounts</SelectItem>
                                            {accounts.map(acc => (
                                                <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            
                            <CurrentSessionSummary 
                                reports={reportsForSelectedDate} 
                                transactions={transactions} 
                                accounts={accounts} 
                                dateRange={dateRange}
                                selectedAccountId={selectedAccountId}
                            />
                         </CardContent>
                    </Card>
                </TabsContent>
                
                <TabsContent value="history">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><History /> Report History</CardTitle>
                            <CardDescription>View and manage past daily opening and closing reports.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Date</TableHead>
                                            <TableHead>Type</TableHead>
                                            <TableHead>Recorded At</TableHead>
                                            <TableHead className="text-right">Total Amount</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {sortedReports.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                    No reports found. Start a day to generate a report.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            sortedReports.map((report) => (
                                                <TableRow key={report.id}>
                                                    <TableCell className="font-medium">{formatDate(report.date)}</TableCell>
                                                    <TableCell>
                                                        <span className={cn(
                                                            "px-2 py-1 rounded-full text-xs font-bold",
                                                            report.type === 'OPEN' ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                                        )}>
                                                            {report.type === 'OPEN' ? 'OPENING' : 'CLOSING'}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell className="text-muted-foreground text-sm">
                                                        {report.timestamp ? formatFns(new Date(report.timestamp), 'h:mm a') : '-'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-bold">
                                                        {formatAmount(report.totalAmount)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button variant="ghost" className="h-8 w-8 p-0">
                                                                    <span className="sr-only">Open menu</span>
                                                                    <MoreVertical className="h-4 w-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => {
                                                                    setEditingReport(report);
                                                                    setIsEditReportOpen(true);
                                                                }}>
                                                                    <Edit className="mr-2 h-4 w-4" /> Edit Details
                                                                </DropdownMenuItem>
                                                                <AlertDialog>
                                                                    <AlertDialogTrigger asChild>
                                                                        <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive focus:text-destructive">
                                                                            <Trash2 className="mr-2 h-4 w-4" /> Delete
                                                                        </DropdownMenuItem>
                                                                    </AlertDialogTrigger>
                                                                    <AlertDialogContent>
                                                                        <AlertDialogHeader>
                                                                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                                                            <AlertDialogDescription>
                                                                                This action cannot be undone. This will permanently delete this report.
                                                                            </AlertDialogDescription>
                                                                        </AlertDialogHeader>
                                                                        <AlertDialogFooter>
                                                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                            <AlertDialogAction onClick={() => handleDeleteReport(report.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
                                                                        </AlertDialogFooter>
                                                                    </AlertDialogContent>
                                                                </AlertDialog>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            
                            {sortedReports.length > 0 && (
                                <div className="mt-4 flex justify-end">
                                    <Button variant="outline" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={clearHistory}>
                                        <Trash2 className="mr-2 h-4 w-4" /> Clear All History
                                    </Button>
                                </div>
                            )}
                                        </CardContent>
                                    </Card>
                                </TabsContent>
                            </Tabs>
        </div>
    );
}