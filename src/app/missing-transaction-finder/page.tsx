

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { AlertTriangle, Search, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { getAppSettings } from '@/services/settingsService';
import { subscribeToParties } from '@/services/partyService';
import type { Transaction, AppSettings, Party, Account } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { format as formatFns } from 'date-fns';
import { formatAmount, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { subscribeToAccounts } from '@/services/accountService';


type TransactionGroup = {
    title: string;
    types: Transaction['type'][];
    transactions: Transaction[];
    totalAmount: number;
    relatedExpenses: Transaction[];
    totalRelatedExpense: number;
};

export default function MissingTransactionFinderPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [parties, setParties] = useState<Party[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        date: formatFns(new Date(), 'yyyy-MM-dd'),
        via: 'all',
    });
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => {
            toast({ variant: 'destructive', title: 'Error loading transactions' });
        });
        const unsubParties = subscribeToParties(setParties, (err) => {
             toast({ variant: 'destructive', title: 'Error loading parties' });
        });
        const unsubAccounts = subscribeToAccounts(setAccounts, (err) => {
             toast({ variant: 'destructive', title: 'Error loading accounts' });
        });
        getAppSettings().then(setAppSettings);
        
        const timer = setTimeout(() => setLoading(false), 500);

        return () => {
            unsubTransactions();
            unsubParties();
            unsubAccounts();
            clearTimeout(timer);
        };
    }, [toast]);
    
    const { groupedData, totalIncome, totalExpense } = useMemo(() => {
        const filteredTx = transactions.filter(t => 
            t.date === filters.date && 
            (filters.via === 'all' || t.via === filters.via)
        );
        
        const mainTransactions = filteredTx.filter(t => !t.description.toLowerCase().startsWith('charge for'));
        const expenseTransactions = filteredTx.filter(t => t.type === 'spent');

        const groups: TransactionGroup[] = [
            { title: 'Sales', types: ['sale', 'credit_sale'], transactions: [], totalAmount: 0, relatedExpenses: [], totalRelatedExpense: 0 },
            { title: 'Purchases', types: ['purchase', 'credit_purchase'], transactions: [], totalAmount: 0, relatedExpenses: [], totalRelatedExpense: 0 },
            { title: 'Other Income', types: ['income', 'credit_income'], transactions: [], totalAmount: 0, relatedExpenses: [], totalRelatedExpense: 0 },
            { title: 'Payments Given', types: ['give', 'credit_give'], transactions: [], totalAmount: 0, relatedExpenses: [], totalRelatedExpense: 0 },
        ];
        
        mainTransactions.forEach(tx => {
            const group = groups.find(g => g.types.includes(tx.type));
            if(group) {
                group.transactions.push(tx);
                group.totalAmount += tx.amount;
            }
        });

        expenseTransactions.forEach(expTx => {
            if(expTx.description.toLowerCase().startsWith('charge for')) {
                const originalDesc = expTx.description.replace('Charge for: ', '');
                const relatedGroup = groups.find(g => g.transactions.some(t => t.description === originalDesc));
                if (relatedGroup) {
                    relatedGroup.relatedExpenses.push(expTx);
                    relatedGroup.totalRelatedExpense += expTx.amount;
                }
            }
        });
        
        const totalIncome = groups.filter(g => ['Sales', 'Other Income'].includes(g.title)).reduce((sum, g) => sum + g.totalAmount, 0);
        const totalExpense = groups.filter(g => ['Purchases', 'Payments Given'].includes(g.title)).reduce((sum, g) => sum + g.totalAmount, 0) + groups.reduce((sum,g) => sum + g.totalRelatedExpense, 0);

        return { groupedData: groups, totalIncome, totalExpense };

    }, [transactions, filters.date, filters.via]);

    const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name || 'N/A';
    const getAccountName = (accountId?: string) => accounts.find(a => a.id === accountId)?.name || 'N/A';

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-6 w-6 text-destructive" />
                        Daily Transaction Audit
                    </CardTitle>
                    <CardDescription>
                        Cross-reference your daily transactions with their associated costs to ensure everything is accounted for.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg">
                        <div className="space-y-1">
                            <Label>Date</Label>
                            <Input type="date" value={filters.date} onChange={(e) => setFilters(f => ({...f, date: e.target.value}))} />
                        </div>
                         <div className="space-y-1">
                            <Label>Business Profile</Label>
                            <Select value={filters.via} onValueChange={(v) => setFilters(f => ({...f, via: v}))}>
                                <SelectTrigger><SelectValue/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Profiles</SelectItem>
                                    {appSettings?.businessProfiles.map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    </CardContent>
                    </Card>
                    {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : (
                        <div className="space-y-6">
                            {groupedData.map(group => {
                                if (group.transactions.length === 0) return null;

                                return (
                                <Card key={group.title}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-lg">{group.title}</CardTitle>
                                        <CardDescription>Total: {formatAmount(group.totalAmount)}</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                         {group.title === 'Sales' ? (
                                             group.transactions.map(tx => (
                                                <Card key={tx.id} className="mb-4">
                                                    <CardHeader className="pb-2">
                                                        <CardTitle className="text-base flex justify-between items-center">
                                                            <span>{getPartyName(tx.partyId)}</span>
                                                            <span className="text-sm font-medium text-muted-foreground">{tx.invoiceNumber}</span>
                                                        </CardTitle>
                                                        <CardDescription>Total Sale: {formatAmount(tx.amount)}</CardDescription>
                                                    </CardHeader>
                                                    <CardContent>
                                                        <Table>
                                                            <TableHeader>
                                                                <TableRow>
                                                                    <TableHead>Product</TableHead>
                                                                    <TableHead className="text-center">Qty</TableHead>
                                                                    <TableHead className="text-right">Price</TableHead>
                                                                    <TableHead className="text-right">Total</TableHead>
                                                                </TableRow>
                                                            </TableHeader>
                                                            <TableBody>
                                                                {tx.items?.map((item, index) => (
                                                                    <TableRow key={index}>
                                                                        <TableCell>{item.name}</TableCell>
                                                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                                                        <TableCell className="text-right">{formatAmount(item.price)}</TableCell>
                                                                        <TableCell className="text-right">{formatAmount(item.price * item.quantity)}</TableCell>
                                                                    </TableRow>
                                                                ))}
                                                                {(tx.deliveryCharge || 0) > 0 && (
                                                                    <TableRow>
                                                                        <TableCell colSpan={3} className="text-right font-semibold">Delivery Charge</TableCell>
                                                                        <TableCell className="text-right">{formatAmount(tx.deliveryCharge || 0)}</TableCell>
                                                                    </TableRow>
                                                                )}
                                                            </TableBody>
                                                        </Table>
                                                    </CardContent>
                                                </Card>
                                            ))
                                         ) : (
                                            <div className="space-y-2">
                                                <h4 className="text-sm font-semibold">Main Transactions:</h4>
                                                <Table>
                                                    <TableHeader>
                                                      <TableRow>
                                                        <TableHead>Description</TableHead>
                                                        <TableHead>Account</TableHead>
                                                        <TableHead className="text-right">Amount</TableHead>
                                                      </TableRow>
                                                    </TableHeader>
                                                    <TableBody>
                                                    {group.transactions.map(tx => (
                                                        <TableRow key={tx.id}>
                                                            <TableCell>{tx.description}</TableCell>
                                                            <TableCell>{getAccountName(tx.accountId)}</TableCell>
                                                            <TableCell className="text-right">{formatAmount(tx.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    </TableBody>
                                                </Table>
                                                {group.relatedExpenses.length > 0 && (
                                                    <>
                                                    <h4 className="text-sm font-semibold mt-4">Related Costs/Charges:</h4>
                                                    <Table>
                                                        <TableBody>
                                                            {group.relatedExpenses.map(exp => (
                                                                <TableRow key={exp.id}>
                                                                    <TableCell>{exp.description}</TableCell>
                                                                    <TableCell>{getAccountName(exp.accountId)}</TableCell>
                                                                    <TableCell className="text-right text-red-600">{formatAmount(exp.amount)}</TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                        <TableFooter>
                                                            <TableRow>
                                                                <TableCell colSpan={2} className="font-bold text-right">Total Cost</TableCell>
                                                                <TableCell className="font-bold text-right text-red-600">{formatAmount(group.totalRelatedExpense)}</TableCell>
                                                            </TableRow>
                                                        </TableFooter>
                                                    </Table>
                                                    </>
                                                )}
                                            </div>
                                         )}
                                    </CardContent>
                                    <CardFooter>
                                        <p className={cn("text-sm font-bold", (group.totalAmount - group.totalRelatedExpense) >= 0 ? 'text-green-600' : 'text-red-600')}>
                                            Net: {formatAmount(group.totalAmount - group.totalRelatedExpense)}
                                        </p>
                                    </CardFooter>
                                </Card>
                            )})}
                        </div>
                    )}
            <Card>
                <CardFooter>
                    <div className="w-full flex justify-between p-4 bg-muted rounded-lg">
                        <div className="text-center">
                            <p className="text-sm text-muted-foreground">Total Income Side</p>
                            <p className="text-xl font-bold text-green-600">{formatAmount(totalIncome)}</p>
                        </div>
                        <div className="text-center">
                             <p className="text-sm text-muted-foreground">Total Expense Side</p>
                            <p className="text-xl font-bold text-red-600">{formatAmount(totalExpense)}</p>
                        </div>
                         <div className="text-center">
                             <p className="text-sm text-muted-foreground">Net Effect</p>
                            <p className={cn("text-xl font-bold", (totalIncome-totalExpense) >= 0 ? 'text-green-600' : 'text-red-600')}>{formatAmount(totalIncome - totalExpense)}</p>
                        </div>
                    </div>
                </CardFooter>
            </Card>
        </div>
    );
}

