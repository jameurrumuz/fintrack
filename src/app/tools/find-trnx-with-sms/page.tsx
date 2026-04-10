

      

'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, ArrowLeft, Search, CheckCircle, FileWarning, Link as LinkIcon, MoveRight, Receipt } from 'lucide-react';
import type { Transaction, Account, AppSettings, SheetRow } from '@/types';
import { subscribeToAllTransactions, updateTransaction } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { getAppSettings } from '@/services/settingsService';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { format as formatFns } from 'date-fns';
import { formatAmount, formatDate } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';


// Simplified client-side amount extraction
function extractAmountFromSms(message: string): number | null {
  // This regex is more robust and handles various formats like "Tk 1,000.00", "BDT1,000", "1,000Tk" etc.
  const amountRegex = /((?:tk|taka|bdt|rs|BDT)\.?\s*([\d,]+\.?\d*)|([\d,]+\.?\d*)\s*(?:tk|taka|bdt|rs|BDT))/i;
  const match = message.match(amountRegex);
  if (match && (match[2] || match[3])) {
    const amountStr = (match[2] || match[3]).replace(/,/g, '');
    return parseFloat(amountStr);
  }
  return null;
}


function FindTrnxWithSmsPage() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [doneSms, setDoneSms] = useState<SheetRow[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const router = useRouter();


    const [filters, setFilters] = useState({
        accountId: '',
        dateFrom: formatFns(new Date(), 'yyyy-MM-dd'),
        dateTo: formatFns(new Date(), 'yyyy-MM-dd'),
        sender: 'all',
    });

    useEffect(() => {
        setLoading(true);
        const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error loading transactions', description: err.message }));
        const unsubAccounts = subscribeToAccounts(setAccounts, (err) => {
            toast({ variant: 'destructive', title: 'Error loading accounts', description: err.message });
        });
        getAppSettings().then(settings => {
            setDoneSms(settings?.doneSms || []);
        });

        const timer = setTimeout(() => setLoading(false), 800);
        return () => {
            unsubTransactions();
            unsubAccounts();
            clearTimeout(timer);
        };
    }, [toast]);
    
    const { accountSms, accountTransactions, matchedSms, matchedTransactions, balanceDifference, potentialMatches } = useMemo(() => {
        if (!filters.accountId || !filters.dateFrom) {
            return { accountSms: [], accountTransactions: [], matchedSms: new Set(), matchedTransactions: new Set(), balanceDifference: 0, potentialMatches: new Map() };
        }

        const selectedAccount = accounts.find(a => a.id === filters.accountId);
        if (!selectedAccount) {
            return { accountSms: [], accountTransactions: [], matchedSms: new Set(), matchedTransactions: new Set(), balanceDifference: 0, potentialMatches: new Map() };
        }
        
        const receivingNumbers = selectedAccount.receivingNumbers || [];
        const senderIdentifiers = receivingNumbers.flatMap(rn => [rn.name.toLowerCase().trim(), rn.number.toLowerCase().trim()]).filter(Boolean);

        const uniqueSmsMap = new Map<string, SheetRow>();
        doneSms.forEach(s => {
            const uniqueKey = `${s.date}-${s.message}`;
            if (!uniqueSmsMap.has(uniqueKey)) {
                uniqueSmsMap.set(uniqueKey, s);
            }
        });
        const uniqueSms = Array.from(uniqueSmsMap.values());


        const accountSms = uniqueSms.filter(s => {
            try {
                const smsDate = formatFns(new Date(s.date), 'yyyy-MM-dd');
                const senderLower = s.name.toLowerCase().trim();

                const isFromLinkedSender = senderIdentifiers.some(id => senderLower.includes(id));
                const dateMatch = smsDate >= filters.dateFrom && smsDate <= filters.dateTo;
                const specificSenderMatch = filters.sender === 'all' || s.name === filters.sender;
                
                return isFromLinkedSender && dateMatch && specificSenderMatch;
            } catch (e) {
                return false;
            }
        });
        
        const accountTransactions = transactions.filter(tx => {
            const dateMatch = tx.date >= filters.dateFrom && tx.date <= filters.dateTo;
            const accountMatch = tx.involvedAccounts?.includes(filters.accountId);
            return dateMatch && accountMatch && tx.enabled;
        });

        const matchedSms = new Set<number>();
        const matchedTransactions = new Set<string>();
        const potentialMatches = new Map<string, SheetRow[]>();

        const tempTxs = [...accountTransactions];

        accountSms.forEach((sms, smsIndex) => {
            const smsAmount = extractAmountFromSms(sms.message);
            if(smsAmount === null) return;
            
            const potentialMatchIndex = tempTxs.findIndex(tx => {
                if (matchedTransactions.has(tx.id)) return false;
                if (tx.type === 'transfer') {
                    if (tx.toAccountId === filters.accountId) {
                        return Math.abs(tx.amount - smsAmount) < 0.01;
                    }
                }
                const txAmount = tx.amount;
                return Math.abs(txAmount - smsAmount) < 0.01;
            });

            if (potentialMatchIndex > -1) {
                const matchedTx = tempTxs.splice(potentialMatchIndex, 1)[0];
                matchedSms.add(smsIndex);
                matchedTransactions.add(matchedTx.id);
            }
        });
        
        accountTransactions.forEach(tx => {
            if (!matchedTransactions.has(tx.id)) {
                const txAmount = tx.type === 'transfer' ? (tx.toAccountId === filters.accountId ? tx.amount : 0) : tx.amount;
                if(txAmount > 0) {
                    const possibleSms = accountSms.filter((sms, index) => {
                        if (matchedSms.has(index)) return false;
                        const smsAmount = extractAmountFromSms(sms.message);
                        return smsAmount !== null && Math.abs(txAmount - smsAmount) < 0.01;
                    });
                    if (possibleSms.length > 0) {
                        potentialMatches.set(tx.id, possibleSms);
                    }
                }
            }
        });
        
        const smsTotal = accountSms.reduce((sum, sms) => sum + (extractAmountFromSms(sms.message) || 0), 0);
        const txTotal = accountTransactions.reduce((sum, tx) => {
            if (tx.type === 'transfer') {
                if (tx.toAccountId === filters.accountId) return sum + tx.amount;
                if (tx.fromAccountId === filters.accountId) return sum - tx.amount;
                return sum;
            }
            return sum + (tx.type === 'spent' || tx.type === 'give' ? -tx.amount : tx.amount);
        }, 0);

        return { 
            accountSms, 
            accountTransactions, 
            matchedSms, 
            matchedTransactions,
            balanceDifference: smsTotal - txTotal,
            potentialMatches
        };

    }, [accounts, doneSms, transactions, filters]);

    const uniqueSenders = useMemo(() => {
        const senders = new Set(doneSms.map(s => s.name));
        return Array.from(senders);
    }, [doneSms]);
    
    const handleMerge = async (txId: string, sms: SheetRow) => {
        try {
            await updateTransaction(txId, { description: sms.message });
            toast({ title: 'Success', description: 'Transaction merged with SMS.' });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Merge Failed', description: error.message });
        }
    };
    
    const handleConvertToEntry = (sms: SheetRow, targetTab: 'transaction' | 'transfer') => {
        const amount = extractAmountFromSms(sms.message) || 0;
        let smsDate = sms.date ? new Date(sms.date).toISOString() : new Date().toISOString();

        const queryParams = new URLSearchParams({
            amount: amount.toString(),
            description: `From ${sms.name}: ${sms.message}`,
            date: smsDate,
        });

        if (targetTab === 'transaction') {
            router.push(`/transactions?${queryParams.toString()}`);
        } else {
             router.push(`/transactions?tab=transfer&${queryParams.toString()}`);
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="mb-6">
                <Button variant="outline" asChild><Link href="/tools"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Tools</Link></Button>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl"><Search/> Find Transactions with SMS</CardTitle>
                    <CardDescription>Reconcile bank transactions with your SMS "Done" list to find missing entries.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg">
                        <div className="space-y-1">
                            <Label>Bank Account</Label>
                            <Select value={filters.accountId} onValueChange={v => setFilters(f => ({...f, accountId: v}))}>
                                <SelectTrigger><SelectValue placeholder="Select an account..." /></SelectTrigger>
                                <SelectContent>{accounts.filter(a => !a.name.toLowerCase().includes('cash')).map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1">
                            <Label>From Date</Label>
                            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))} />
                        </div>
                        <div className="space-y-1">
                            <Label>To Date</Label>
                            <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))} />
                        </div>
                         <div className="space-y-1">
                            <Label>Sender</Label>
                            <Select value={filters.sender} onValueChange={v => setFilters(f => ({...f, sender: v}))}>
                                <SelectTrigger><SelectValue placeholder="All Senders" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Senders</SelectItem>
                                    {uniqueSenders.map(sender => <SelectItem key={sender} value={sender}>{sender}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {loading ? <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div> : (
                        <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <h3 className="font-semibold flex items-center gap-2">Unmatched SMS ({accountSms.filter((_, i) => !matchedSms.has(i)).length})</h3>
                                <div className="rounded-md border max-h-[60vh] overflow-y-auto">
                                    <Table>
                                        <TableBody>
                                            {accountSms.filter((_, i) => !matchedSms.has(i)).map((sms, i) => (
                                                <TableRow key={`sms-unmatched-${i}`}>
                                                    <TableCell className="text-xs">{sms.message}</TableCell>
                                                    <TableCell className="text-right font-mono">{formatAmount(extractAmountFromSms(sms.message) || 0)}</TableCell>
                                                     <TableCell className="text-right space-x-1">
                                                        <Button size="sm" onClick={() => handleConvertToEntry(sms, 'transaction')}>Make Entry</Button>
                                                        <Button size="sm" variant="outline" onClick={() => handleConvertToEntry(sms, 'transfer')}>Make Transfer</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                             <div className="space-y-2">
                                <h3 className="font-semibold flex items-center gap-2">Unmatched Transactions ({accountTransactions.filter(tx => !matchedTransactions.has(tx.id)).length})</h3>
                                <div className="rounded-md border max-h-[60vh] overflow-y-auto">
                                     <Table>
                                        <TableBody>
                                             {accountTransactions.filter(tx => !matchedTransactions.has(tx.id)).map(tx => {
                                                  const txAmount = tx.type === 'transfer' ? (tx.toAccountId === filters.accountId ? tx.amount : -tx.amount) : (tx.type === 'spent' || tx.type === 'give' ? -tx.amount : tx.amount);
                                                  return (
                                                    <TableRow key={tx.id}>
                                                        <TableCell>
                                                            <p className="text-xs">{tx.description}</p>
                                                            {potentialMatches.has(tx.id) && (
                                                                <div className="mt-2">
                                                                    <Select onValueChange={(smsJson) => handleMerge(tx.id, JSON.parse(smsJson))}>
                                                                        <SelectTrigger className="h-8 text-xs">
                                                                            <SelectValue placeholder="Potential match found..."/>
                                                                        </SelectTrigger>
                                                                        <SelectContent>
                                                                            {potentialMatches.get(tx.id)!.map((sms, i) => (
                                                                                <SelectItem key={`match-${i}`} value={JSON.stringify(sms)}>
                                                                                    Merge with SMS from {sms.name}
                                                                                </SelectItem>
                                                                            ))}
                                                                        </SelectContent>
                                                                    </Select>
                                                                </div>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className={cn("text-right font-mono", txAmount >= 0 ? "text-green-600" : "text-red-600")}>{formatAmount(txAmount)}</TableCell>
                                                    </TableRow>
                                                )
                                             })}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </div>
                        <CardFooter className="mt-4 p-4 border rounded-lg">
                            <div className="w-full flex justify-end">
                                <div className="text-right">
                                    <Label>Balance Difference</Label>
                                    <p className={cn("text-2xl font-bold font-mono", balanceDifference > 0 && "text-green-600", balanceDifference < 0 && "text-red-600")}>
                                        {formatAmount(balanceDifference)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">(Unmatched SMS Total - Unmatched Transaction Total)</p>
                                </div>
                            </div>
                        </CardFooter>
                        </>
                    )}
                </CardContent>
             </Card>
        </div>
    )
}


export default function FindTrnxWithSmsPageWrapper() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <FindTrnxWithSmsPage />
        </Suspense>
    )
}

    
    