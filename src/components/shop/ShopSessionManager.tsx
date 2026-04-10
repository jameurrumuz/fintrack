
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Clock, Briefcase, Wallet } from 'lucide-react';
import { AppSettings, ShopDayReport, Account, Transaction } from '@/types';
import { Checkbox } from '../ui/checkbox';
import { formatAmount, getEffectiveAmount } from '@/lib/utils';
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '../ui/table';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { DatePicker } from '../ui/date-picker';
import { format as formatFns, startOfDay, endOfDay } from 'date-fns';

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


export default function ShopSessionManager({
    mode,
    isOpen,
    onOpenChange,
    onSave,
    lastReport,
    accounts,
    transactions,
}: {
    mode: 'OPEN' | 'CLOSE';
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onSave: (data: any) => Promise<void>;
    lastReport: ShopDayReport | null;
    accounts: Account[];
    transactions?: Transaction[];
}) {
    const [physicalBalances, setPhysicalBalances] = useState<Record<string, { balance: string; breakdown: Record<number, string> }>>({});
    const [sameAsLast, setSameAsLast] = useState(false);
    const [sameAsExpected, setSameAsExpected] = useState(false);
    const [loading, setLoading] = useState(false);
    const [snoozeUntil, setSnoozeUntil] = useState<number | null>(null);
    const [reportDate, setReportDate] = useState<Date>(new Date());

    const { toast } = useToast();

    useEffect(() => {
        if (isOpen) {
            const initialBalances: Record<string, { balance: string; breakdown: Record<number, string> }> = {};
            accounts.forEach(acc => {
                initialBalances[acc.id] = { balance: '', breakdown: {} };
            });
            setPhysicalBalances(initialBalances);
            setSameAsLast(false);
            setSameAsExpected(false);
            setReportDate(new Date());
        }
    }, [isOpen, accounts]);
    
    const openingBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        if (!lastReport) {
            accounts.forEach(acc => balances[acc.id] = 0);
            return balances;
        }

        accounts.forEach(acc => {
            const lastBalance = lastReport.physicalBalances.find(b => b.accountId === acc.id);
            balances[acc.id] = lastBalance?.balance || 0;
        });
        return balances;
    }, [lastReport, accounts]);

    const cashTransactionsInPeriod = useMemo(() => {
        if (!lastReport || !transactions) return [];
        const fromDate = new Date(lastReport.timestamp);
        const toDate = new Date();
        const accountIds = new Set(accounts.map(a => a.id));

        return transactions.filter(tx => {
            if (!tx.enabled) return false;
            const txDate = new Date(tx.createdAt || tx.date);
            if (txDate < fromDate || txDate > toDate) return false;
            
            if (tx.type === 'transfer') {
                return accountIds.has(tx.fromAccountId || '') || accountIds.has(tx.toAccountId || '');
            }
            if (tx.payments && tx.payments.length > 0) {
                return tx.payments.some(p => accountIds.has(p.accountId));
            }
            return tx.accountId ? accountIds.has(tx.accountId) : false;
        });
    }, [transactions, lastReport, accounts]);

    const expectedClosingBalances = useMemo(() => {
        const balances: Record<string, number> = { ...openingBalances };
        cashTransactionsInPeriod.forEach(tx => {
            if (tx.type === 'transfer') {
                if(tx.fromAccountId) balances[tx.fromAccountId] -= tx.amount;
                if(tx.toAccountId) balances[tx.toAccountId] += tx.amount;
            } else if (tx.payments?.length) {
                tx.payments.forEach(p => {
                    balances[p.accountId] = (balances[p.accountId] || 0) + p.amount;
                });
            } else if(tx.accountId) {
                balances[tx.accountId] = (balances[tx.accountId] || 0) + getEffectiveAmount(tx);
            }
        });
        return balances;
    }, [openingBalances, cashTransactionsInPeriod]);


    useEffect(() => {
        if (sameAsLast && mode === 'OPEN' && lastReport) {
            const newBalances: Record<string, { balance: string; breakdown: Record<number, string> }> = {};
            accounts.forEach(acc => {
                const lastBalance = lastReport.physicalBalances.find(b => b.accountId === acc.id);
                if (lastBalance) {
                    newBalances[acc.id] = {
                        balance: lastBalance.balance.toString(),
                        breakdown: lastBalance.breakdown || {},
                    };
                } else {
                    newBalances[acc.id] = { balance: '0', breakdown: {} };
                }
            });
            setPhysicalBalances(newBalances);
        }
    }, [sameAsLast, mode, lastReport, accounts]);
    
    useEffect(() => {
        if (sameAsExpected && mode === 'CLOSE') {
            const newBalances: Record<string, { balance: string; breakdown: Record<number, string> }> = {};
            accounts.forEach(acc => {
                newBalances[acc.id] = {
                    balance: (expectedClosingBalances[acc.id] || 0).toString(),
                    breakdown: {}, // Breakdown is not calculated, user has to fill if needed
                };
            });
            setPhysicalBalances(newBalances);
        }
    }, [sameAsExpected, mode, expectedClosingBalances, accounts]);

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
    

    const handleNoteChange = (accountId: string, denom: number, value: string) => {
        if (parseInt(value) < 0) return;
        setPhysicalBalances(prev => {
            const newBalances = { ...prev };
            if (!newBalances[accountId]) {
                newBalances[accountId] = { balance: '0', breakdown: {} };
            }
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
    
    const handleSnooze = (minutes: number) => {
        onOpenChange(false);
        toast({ title: `Snoozed for ${minutes} minutes.` });
    };

    const handleSubmit = async () => {
        setLoading(true);
        const reportData = {
            date: formatFns(reportDate, 'yyyy-MM-dd'),
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
        await onSave(reportData);
        setLoading(false);
    };
    
    const totalExpectedClosing = Object.values(expectedClosingBalances).reduce((sum, bal) => sum + bal, 0);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle>{mode === 'OPEN' ? '☀️ Start Day' : '🌙 End Day'}</DialogTitle>
                    <DialogDescription>Count your physical cash to record the balance.</DialogDescription>
                </DialogHeader>
                <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="space-y-1">
                        <Label>Date</Label>
                        <DatePicker value={reportDate} onChange={(d) => setReportDate(d as Date)} />
                    </div>
                    {mode === 'OPEN' && lastReport && (
                        <div className="flex items-center space-x-2 pt-5">
                            <Checkbox id="sameAsLast" checked={sameAsLast} onCheckedChange={(checked) => setSameAsLast(!!checked)} />
                            <Label htmlFor="sameAsLast">Same as last closing balance ({formatAmount(lastReport.physicalBalances.reduce((s,b) => s + b.balance, 0))})</Label>
                        </div>
                    )}
                    {mode === 'CLOSE' && (
                        <div className="flex items-center space-x-2 pt-5">
                            <Checkbox id="sameAsExpected" checked={sameAsExpected} onCheckedChange={(checked) => setSameAsExpected(!!checked)} />
                            <Label htmlFor="sameAsExpected">Same as expected closing balance ({formatAmount(totalExpectedClosing)})</Label>
                        </div>
                    )}
                </div>
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
                <DialogFooter className="flex-col sm:flex-row gap-3">
                    <div className="flex gap-2 justify-center sm:justify-start w-full">
                        <Button variant="outline" size="sm" onClick={() => handleSnooze(5)}>
                            <Clock className="w-3 h-3 mr-1" /> 5m
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleSnooze(10)}>
                            <Clock className="w-3 h-3 mr-1" /> 10m
                        </Button>
                    </div>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={loading}>
                        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {mode === 'OPEN' ? 'Save Opening Balance' : 'Save Closing Balance'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
