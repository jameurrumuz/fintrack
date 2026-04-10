

'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Printer, Share2, User, Plus, Trash2, Save, History, BookOpen, Edit } from 'lucide-react';
import type { Transaction, Party, Account, BusinessProfile, CustomStatement, InventoryItem } from '@/types';
import { subscribeToAllTransactions, updateTransaction } from '@/services/transactionService';
import { subscribeToParties, getOldLedgerData, updateOldLedgerEntry } from '@/services/partyService';
import { getAppSettings } from '@/services/settingsService';
import { saveStatement, subscribeToStatements } from '@/services/statementService'; 
import { formatDate, formatAmount, getPartyBalanceEffect } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import PartyTransactionEditDialog from '@/components/PartyTransactionEditDialog';
import { subscribeToInventoryItems } from '@/services/inventoryService';


type StatementEntry = {
    id: string;
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
};

const SavedStatementViewDialog = ({ statement, isOpen, onOpenChange }: { statement: CustomStatement | null, isOpen: boolean, onOpenChange: (open: boolean) => void }) => {
    const printRef = useRef<HTMLDivElement>(null);

    const handlePrint = () => {
        const printableArea = printRef.current;
        if (printableArea) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write('<html><head><title>Print Statement</title>');
            printWindow?.document.write('<link rel="stylesheet" href="https://unpkg.com/tailwindcss@^2/dist/tailwind.min.css">');
            printWindow?.document.write('</head><body class="p-4">');
            printWindow?.document.write(printableArea.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            printWindow?.print();
        }
    };
    
    if (!statement) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Statement for {statement.partyName}</DialogTitle>
                    <DialogDescription>
                        Saved on {formatDate(statement.statementDate)}. 
                        Period: {statement.dateRange?.from ? `${formatDate(statement.dateRange.from)} to ${formatDate(statement.dateRange.to)}` : 'N/A'}
                    </DialogDescription>
                </DialogHeader>
                <div ref={printRef} className="flex-grow overflow-y-auto p-2">
                     <div className="text-center mb-4">
                        <h2 className="text-2xl font-bold">{statement.businessProfileName}</h2>
                        <h3 className="text-xl">Statement for {statement.partyName}</h3>
                     </div>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="text-right">Debit</TableHead>
                                <TableHead className="text-right">Credit</TableHead>
                                <TableHead className="text-right">Balance</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {statement.data.map((row, index) => (
                                <TableRow key={row.id || index}>
                                    <TableCell>{formatDate(row.date)}</TableCell>
                                    <TableCell>{row.description}</TableCell>
                                    <TableCell className="text-right font-mono text-red-600">{formatAmount(row.debit)}</TableCell>
                                    <TableCell className="text-right font-mono text-green-600">{formatAmount(row.credit)}</TableCell>
                                    <TableCell className="text-right font-mono">{formatAmount(row.balance)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                 <DialogFooter>
                    <Button variant="outline" onClick={handlePrint}>
                        <Printer className="mr-2 h-4 w-4" /> Print
                    </Button>
                    <DialogClose asChild>
                        <Button>Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}


export default function PartyStatementReport() {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [parties, setParties] = useState<Party[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [appSettings, setAppSettings] = useState<{ businessProfiles: BusinessProfile[] } | null>(null);
    const [savedStatements, setSavedStatements] = useState<CustomStatement[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    
    const [filters, setFilters] = useState({
        partyId: '',
        dateFrom: '',
        dateTo: '',
    });
    
    const [statementData, setStatementData] = useState<StatementEntry[]>([]);
    const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
    const [viewingStatement, setViewingStatement] = useState<CustomStatement | null>(null);
    
    const { toast } = useToast();

    useEffect(() => {
        setLoading(true);
        const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
        const unsubParties = subscribeToParties((parties) => {
            setParties(parties);
            if (parties.length > 0 && !filters.partyId) {
                setFilters(f => ({ ...f, partyId: parties[0].id }));
            }
        }, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
        const unsubInventory = subscribeToInventoryItems(setInventoryItems, (err) => toast({ variant: 'destructive', title: 'Error fetching inventory' }));
        
        getAppSettings().then(settings => setAppSettings(settings ? { businessProfiles: settings.businessProfiles } : null));

        const timer = setTimeout(() => setLoading(false), 500);
        return () => {
            unsubTransactions();
            unsubParties();
            unsubInventory();
            clearTimeout(timer);
        };
    }, [toast]);
    
    useEffect(() => {
        if(filters.partyId){
            const unsubStatements = subscribeToStatements(filters.partyId, setSavedStatements, (err) => toast({ variant: 'destructive', title: 'Error fetching saved statements' }));
            return () => unsubStatements();
        }
    }, [filters.partyId, toast]);

    const generateStatement = useCallback(() => {
        if (!filters.partyId) {
            setStatementData([]);
            return;
        }

        const loadAndGenerate = async () => {
            setLoading(true);
            let partyOldDataRaw: Record<string, string | number>[] = [];
            if (filters.partyId) {
                partyOldDataRaw = await getOldLedgerData(filters.partyId) || [];
            }
            
            const fromDate = filters.dateFrom ? new Date(filters.dateFrom) : null;
            if(fromDate) fromDate.setHours(0,0,0,0);
            
            const toDate = filters.dateTo ? new Date(filters.dateTo) : null;
            if(toDate) toDate.setHours(23,59,59,999);


            const partyOldData = partyOldDataRaw
                .filter(row => {
                    const date = new Date(String(row['Date'] || ''));
                    if (fromDate && date < fromDate) return false;
                    if (toDate && date > toDate) return false;
                    return true;
                })
                .map((row, index) => ({
                id: `old-${index}`,
                date: String(row['Date'] || ''),
                description: String(row['Comments'] || ''),
                debit: Number(row['debit'] || 0),
                credit: Number(row['credit'] || 0),
                balance: 0,
            }));

            const partyTransactions = transactions
                .filter(t => {
                    if (t.partyId !== filters.partyId) return false;
                    const txDate = new Date(t.date);
                    if (fromDate && txDate < fromDate) return false;
                    if (toDate && txDate > toDate) return false;
                    return true;
                })
                .map(t => {
                    const effect = getPartyBalanceEffect(t);
                    return {
                        id: t.id,
                        date: t.date,
                        description: t.description,
                        debit: effect < 0 ? Math.abs(effect) : 0,
                        credit: effect > 0 ? effect : 0,
                        balance: 0,
                    }
                });

            const combinedData = [...partyOldData, ...partyTransactions]
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
            
            let runningBalance = 0;
            const dataWithBalance = combinedData.map(item => {
                runningBalance += (item.credit - item.debit);
                return { ...item, balance: runningBalance };
            });

            setStatementData(dataWithBalance);
            setLoading(false);
        };

        loadAndGenerate();

    }, [filters, transactions]);

    const handleFieldChange = async (index: number, field: keyof StatementEntry, value: string | number) => {
        const updatedData = [...statementData];
        const entry = { ...updatedData[index] };
        (entry as any)[field] = value;
        updatedData[index] = entry;

        recalculateBalances(updatedData);

        const isOldEntry = entry.id.startsWith('old-');
        const updatedEntryData = { [field]: value };
        
        try {
            if (isOldEntry) {
                await updateOldLedgerEntry(filters.partyId, parseInt(entry.id.split('-')[1]), updatedEntryData);
            } else {
                await updateTransaction(entry.id, updatedEntryData);
            }
        } catch (error: any) {
            toast({ variant: 'destructive', title: "Update Failed", description: error.message });
            // Revert optimistic update on error if needed
        }
    };

    const setData = (data: StatementEntry[]) => {
        setStatementData(data);
    };
    
    const recalculateBalances = (data: StatementEntry[]) => {
        let currentBalance = 0;
        const newData = data.map(row => {
            currentBalance += (Number(row.credit) - Number(row.debit));
            return { ...row, balance: currentBalance };
        });
        setStatementData(newData);
    };
    
    const addRow = () => {
        const newRow: StatementEntry = {
            id: `custom-${Date.now()}`,
            date: new Date().toISOString().split('T')[0],
            description: '',
            debit: 0,
            credit: 0,
            balance: 0,
        };
        const updatedData = [...statementData, newRow];
        recalculateBalances(updatedData);
    }
    
    const deleteRow = (index: number) => {
        const updatedData = statementData.filter((_, i) => i !== index);
        recalculateBalances(updatedData);
    }
    
    const handleSaveStatement = async () => {
        if (!filters.partyId || statementData.length === 0) {
            toast({ variant: 'destructive', title: 'Error', description: 'Cannot save an empty statement.' });
            return;
        }
        setIsSaving(true);
        try {
            await saveStatement({
                partyId: filters.partyId,
                partyName: parties.find(p => p.id === filters.partyId)?.name || 'Unknown',
                statementDate: new Date().toISOString(),
                data: statementData,
                businessProfileName: 'All', // This can be enhanced to use a filter later
                dateRange: { from: filters.dateFrom, to: filters.dateTo }
            });
            toast({ title: 'Success', description: 'Statement has been saved.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        } finally {
            setIsSaving(false);
        }
    }
    
    const handleUpdateTransaction = async (data: Omit<Transaction, 'id' | 'enabled'>) => {
      if (!editingTransaction) return;
      try {
        await updateTransaction(editingTransaction.id, data);
        toast({ title: "Success", description: "Transaction updated successfully." });
        setEditingTransaction(null);
        generateStatement(); // Refresh statement after edit
      } catch (error: any) {
        console.error("Failed to update transaction", error);
        toast({ variant: 'destructive', title: "Error", description: `Could not update transaction: ${error.message}` });
      }
    };

    const handleEditClick = (entry: StatementEntry) => {
        if (entry.id.startsWith('old-') || entry.id.startsWith('custom-')) {
            toast({title: "In-line Editing", description: "Please edit old or custom entries directly in the table."});
        } else {
            const originalTx = transactions.find(t => t.id === entry.id);
            if (originalTx) {
                setEditingTransaction(originalTx);
            }
        }
    };

    const selectedParty = useMemo(() => parties.find(p => p.id === filters.partyId), [parties, filters.partyId]);

    return (
        <div>
            <div className="mb-6">
                <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
            </div>
            
            <PartyTransactionEditDialog
              transaction={editingTransaction}
              parties={parties}
              accounts={accounts}
              inventoryItems={inventoryItems}
              onOpenChange={(isOpen) => !isOpen && setEditingTransaction(null)}
              onSave={handleUpdateTransaction}
              appSettings={appSettings}
            />
            
             <SavedStatementViewDialog 
                isOpen={!!viewingStatement}
                onOpenChange={() => setViewingStatement(null)}
                statement={viewingStatement}
            />

            <Tabs defaultValue="create">
                 <TabsList className="mb-4">
                    <TabsTrigger value="create"><BookOpen className="mr-2 h-4 w-4"/>Create Statement</TabsTrigger>
                    <TabsTrigger value="history"><History className="mr-2 h-4 w-4"/>Saved Statements</TabsTrigger>
                </TabsList>
                
                <TabsContent value="create">
                    <Card>
                        <CardHeader>
                            <CardTitle>Party Statement Generator</CardTitle>
                            <CardDescription>Generate, edit, and save a financial statement for a party.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 p-4 border rounded-lg">
                                <div className="space-y-1 lg:col-span-2"><Label>Party</Label>
                                    <Select value={filters.partyId} onValueChange={v => setFilters({ ...filters, partyId: v, dateFrom: '', dateTo: '' })}>
                                        <SelectTrigger><SelectValue placeholder="Select a party..." /></SelectTrigger>
                                        <SelectContent>{parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1"><Label>From</Label><Input type="date" value={filters.dateFrom} onChange={e => setFilters({ ...filters, dateFrom: e.target.value })} /></div>
                                <div className="space-y-1"><Label>To</Label><Input type="date" value={filters.dateTo} onChange={e => setFilters({ ...filters, dateTo: e.target.value })} /></div>
                                <div className="lg:col-span-4">
                                     <Button onClick={generateStatement} disabled={!filters.partyId || loading} className="w-full">
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null} Generate Statement
                                    </Button>
                                </div>
                            </div>

                            {statementData.length > 0 && (
                                <>
                                    <div className="rounded-md border overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Description</TableHead>
                                                    <TableHead className="text-right">Debit</TableHead>
                                                    <TableHead className="text-right">Credit</TableHead>
                                                    <TableHead className="text-right">Balance</TableHead>
                                                    <TableHead className="w-20 text-right"></TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {statementData.map((item, index) => (
                                                    <TableRow key={item.id}>
                                                        <TableCell><Input type="date" defaultValue={item.date.split('T')[0]} onBlur={e => handleFieldChange(index, 'date', e.target.value)} className="w-32" /></TableCell>
                                                        <TableCell><Input defaultValue={item.description} onBlur={e => handleFieldChange(index, 'description', e.target.value)} /></TableCell>
                                                        <TableCell><Input type="number" defaultValue={item.debit} onBlur={e => handleFieldChange(index, 'debit', Number(e.target.value))} className="text-right font-mono text-red-600" /></TableCell>
                                                        <TableCell><Input type="number" defaultValue={item.credit} onBlur={e => handleFieldChange(index, 'credit', Number(e.target.value))} className="text-right font-mono text-green-600" /></TableCell>
                                                        <TableCell className="text-right font-mono">{formatAmount(item.balance)}</TableCell>
                                                        <TableCell>
                                                            <div className="flex justify-end gap-1">
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditClick(item)}>
                                                                    <Edit className="h-4 w-4"/>
                                                                </Button>
                                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteRow(index)}>
                                                                    <Trash2 className="h-4 w-4 text-destructive"/>
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex justify-end mt-4">
                                        <Button onClick={addRow} variant="outline"><Plus className="mr-2 h-4 w-4"/> Add Row</Button>
                                    </div>
                                </>
                            )}
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSaveStatement} disabled={isSaving || statementData.length === 0}>
                                <Save className="mr-2 h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Statement'}
                            </Button>
                        </CardFooter>
                    </Card>
                </TabsContent>
                
                <TabsContent value="history">
                     <Card>
                        <CardHeader>
                            <CardTitle>Saved Statements for {selectedParty?.name}</CardTitle>
                            <CardDescription>Review previously generated and saved statements.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Saved Date</TableHead>
                                            <TableHead>Statement Period</TableHead>
                                            <TableHead>Business Profile</TableHead>
                                            <TableHead className="text-right">Final Balance</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                    {savedStatements.length > 0 ? savedStatements.map(stmt => (
                                        <TableRow key={stmt.id}>
                                            <TableCell>{formatDate(stmt.statementDate)}</TableCell>
                                            <TableCell>{stmt.dateRange?.from ? `${formatDate(stmt.dateRange.from)} to ${formatDate(stmt.dateRange.to)}` : 'N/A'}</TableCell>
                                            <TableCell>{stmt.businessProfileName}</TableCell>
                                            <TableCell className="text-right">{formatAmount(stmt.data[stmt.data.length - 1]?.balance || 0)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="outline" size="sm" onClick={() => setViewingStatement(stmt)}>View/Print</Button>
                                            </TableCell>
                                        </TableRow>
                                    )) : (
                                        <TableRow><TableCell colSpan={5} className="h-24 text-center">No saved statements for this party.</TableCell></TableRow>
                                    )}
                                    </TableBody>
                                </Table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
