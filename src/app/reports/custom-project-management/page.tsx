

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Briefcase, Plus, Trash2, Save, Search } from 'lucide-react';
import type { Transaction, Project } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToProjects, addProject, updateProject, deleteProject } from '@/services/projectManagementService';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';
import { transactionTypeOptions } from '@/lib/utils';
import { DatePicker } from '@/components/ui/date-picker';
import { format as formatFns } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';


// Mock service for now - This will be replaced by Firestore service
const getProjects = async (): Promise<Project[]> => {
    // In a real app, this would fetch from Firestore
    return [];
};
const saveProject = async (project: Project): Promise<void> => {
    // In a real app, this would save to Firestore
    console.log("Saving project", project);
};

const formatDate = (date: string | Date) => {
    return formatFns(new Date(date), 'dd/MM/yyyy');
}


export default function CustomProjectManagementPage() {
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [newProjectName, setNewProjectName] = useState('');
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [isSaving, setIsSaving] = useState(false);

    // All transactions from the database
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    
    // State for the transaction lookup feature
    const [lookupDate, setLookupDate] = useState<Date | undefined>(new Date());
    const [lookupType, setLookupType] = useState<Transaction['type']>('spent');
    const [isLookupDialogOpen, setIsLookupDialogOpen] = useState(false);
    const [selectedTxIds, setSelectedTxIds] = useState<Set<string>>(new Set());

    // Form state for new transaction
    const [newTx, setNewTx] = useState({
        date: new Date(),
        description: '',
        amount: 0,
        type: 'spent' as Transaction['type'],
    });

    useEffect(() => {
        setLoading(true);
        
        const unsubProjects = subscribeToProjects(setProjects, (error) => {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch projects.' });
            console.error(error);
        });

        const unsubTransactions = subscribeToAllTransactions(setAllTransactions, (error) => {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not fetch all transactions.' });
        });

        setLoading(false);

        return () => {
            unsubProjects();
            unsubTransactions();
        };
    }, [toast]);
    
    const lookupResults = useMemo(() => {
        if (!lookupDate || !selectedProject) return [];
        const formattedLookupDate = formatFns(lookupDate, 'yyyy-MM-dd');
        
        const projectTxIds = new Set(selectedProject.transactions.map(tx => tx.id));

        return allTransactions.filter(tx => 
            tx.date === formattedLookupDate && 
            tx.type === lookupType &&
            !projectTxIds.has(tx.id)
        );
    }, [lookupDate, lookupType, allTransactions, selectedProject]);

    const handleAddSelectedToProject = async () => {
        if (!selectedProject || selectedTxIds.size === 0) return;

        const transactionsToAdd = allTransactions.filter(tx => selectedTxIds.has(tx.id));
        
        const updatedProject = {
            ...selectedProject,
            transactions: [...selectedProject.transactions, ...transactionsToAdd],
        };

        try {
            await updateProject(selectedProject.id, { transactions: updatedProject.transactions });
            setSelectedProject(updatedProject);
            setSelectedTxIds(new Set());
            setIsLookupDialogOpen(false);
            toast({ title: 'Success', description: `${transactionsToAdd.length} transaction(s) added to the project.` });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add transactions.' });
        }
    };

    const handleAddProject = async () => {
        if (newProjectName.trim()) {
            try {
                const newProjectId = await addProject({ name: newProjectName.trim(), transactions: [] });
                setNewProjectName('');
                toast({ title: 'Success', description: 'New project created.' });
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not create project.' });
            }
        }
    };
    
    const handleAddTransactionToProject = async () => {
        if (!selectedProject || !newTx.description || newTx.amount <= 0) {
            toast({ variant: 'destructive', title: 'Invalid Transaction', description: 'Please fill out all fields.'});
            return;
        }

        const newTransaction: Transaction = {
            id: `tx-${Date.now()}`,
            date: formatFns(newTx.date, 'yyyy-MM-dd'),
            description: newTx.description,
            amount: newTx.amount,
            type: newTx.type,
            enabled: true,
        };

        const updatedProject = {
            ...selectedProject,
            transactions: [...selectedProject.transactions, newTransaction],
        };
        
        try {
            await updateProject(selectedProject.id, { transactions: updatedProject.transactions });
            setSelectedProject(updatedProject);
            setNewTx({ date: new Date(), description: '', amount: 0, type: 'spent' });
            toast({ title: 'Success', description: 'New entry added to project.' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add entry.' });
        }
    };

    const projectSummary = useMemo(() => {
        if (!selectedProject) return { income: 0, expense: 0, net: 0 };
        const income = selectedProject.transactions
            .filter(t => ['income', 'receive', 'sale', 'credit_sale'].includes(t.type))
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = selectedProject.transactions
            .filter(t => ['spent', 'give', 'purchase', 'credit_purchase'].includes(t.type))
            .reduce((sum, t) => sum + t.amount, 0);
        return { income, expense, net: income - expense };
    }, [selectedProject]);

    const handleSaveProject = async () => {
        if (!selectedProject) return;
        setIsSaving(true);
        try {
            // The updates are already saved as they happen, so we just give feedback.
            // If we change this to a single save button, we'd call updateProject here.
            toast({ title: "Success", description: "All changes have been saved." });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Error", description: "There was an issue saving." });
        } finally {
            setIsSaving(false);
        }
    };


    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8">
            <div className="flex justify-between items-center mb-6">
                <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <Card>
                        <CardHeader>
                            <CardTitle>Projects</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                             {loading ? (
                                <div className="flex justify-center items-center h-24"><Loader2 className="animate-spin" /></div>
                             ) : (
                                projects.map(p => (
                                    <Button 
                                        key={p.id} 
                                        variant={selectedProject?.id === p.id ? 'default' : 'outline'}
                                        className="w-full justify-start"
                                        onClick={() => setSelectedProject(p)}
                                    >
                                        {p.name}
                                    </Button>
                                ))
                             )}
                        </CardContent>
                        <CardFooter className="flex gap-2">
                             <Input 
                                value={newProjectName} 
                                onChange={(e) => setNewProjectName(e.target.value)}
                                placeholder="New project name..."
                            />
                            <Button onClick={handleAddProject}><Plus className="h-4 w-4"/></Button>
                        </CardFooter>
                    </Card>
                </div>

                <div className="lg:col-span-2">
                    {selectedProject ? (
                        <Card>
                             <CardHeader>
                                <CardTitle>{selectedProject.name}</CardTitle>
                                <CardDescription>Manage all financial entries for this project.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-muted/50">
                                        <div><Label>Total Income</Label><p className="font-bold text-green-600 text-lg">{formatAmount(projectSummary.income)}</p></div>
                                        <div><Label>Total Expense</Label><p className="font-bold text-red-600 text-lg">{formatAmount(projectSummary.expense)}</p></div>
                                        <div><Label>Net Profit/Loss</Label><p className={cn("font-bold text-lg", projectSummary.net >= 0 ? 'text-green-600' : 'text-red-600')}>{formatAmount(projectSummary.net)}</p></div>
                                    </div>
                                    <div className="rounded-md border">
                                        <Table>
                                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Description</TableHead><TableHead>Type</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                            <TableBody>
                                                {selectedProject.transactions.map(tx => (
                                                    <TableRow key={tx.id}>
                                                        <TableCell>{formatDate(tx.date)}</TableCell>
                                                        <TableCell>{tx.description}</TableCell>
                                                        <TableCell><Badge variant="outline">{tx.type}</Badge></TableCell>
                                                        <TableCell className={cn("text-right font-mono", ['spent', 'give', 'purchase'].includes(tx.type) ? 'text-red-600' : 'text-green-600' )}>{formatAmount(tx.amount)}</TableCell>
                                                    </TableRow>
                                                ))}
                                                <TableRow className="bg-muted/20">
                                                    <TableCell><DatePicker value={newTx.date} onChange={d => setNewTx(tx => ({...tx, date: d as Date}))} /></TableCell>
                                                    <TableCell><Input placeholder="Description" value={newTx.description} onChange={e => setNewTx(tx => ({...tx, description: e.target.value}))}/></TableCell>
                                                    <TableCell>
                                                        <Select value={newTx.type} onValueChange={(v) => setNewTx(tx => ({...tx, type: v as Transaction['type']}))}>
                                                            <SelectTrigger><SelectValue/></SelectTrigger>
                                                            <SelectContent>{transactionTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                                                        </Select>
                                                    </TableCell>
                                                    <TableCell><Input type="number" placeholder="Amount" value={newTx.amount || ''} onChange={e => setNewTx(tx => ({...tx, amount: Number(e.target.value)}))}/></TableCell>
                                                </TableRow>
                                            </TableBody>
                                        </Table>
                                    </div>
                                    <div className="flex gap-2">
                                     <Button onClick={handleAddTransactionToProject}><Plus className="mr-2 h-4 w-4"/> Add Entry</Button>
                                     <Dialog open={isLookupDialogOpen} onOpenChange={setIsLookupDialogOpen}>
                                        <DialogTrigger asChild>
                                             <Button variant="outline"><Search className="mr-2 h-4 w-4"/> Find & Add Existing Transaction</Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-2xl">
                                            <DialogHeader>
                                                <DialogTitle>Find Transactions</DialogTitle>
                                                <DialogDescription>Select a date and type to find transactions to add to this project.</DialogDescription>
                                            </DialogHeader>
                                            <div className="grid grid-cols-2 gap-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>Date</Label>
                                                    <DatePicker value={lookupDate} onChange={setLookupDate} />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Type</Label>
                                                    <Select value={lookupType} onValueChange={(v) => setLookupType(v as Transaction['type'])}>
                                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                                        <SelectContent>{transactionTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                                                    </Select>
                                                </div>
                                            </div>
                                            <div className="max-h-64 overflow-y-auto border rounded-md">
                                                <Table>
                                                    <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {lookupResults.length > 0 ? lookupResults.map(tx => (
                                                            <TableRow key={tx.id}>
                                                                <TableCell>
                                                                    <Checkbox
                                                                        checked={selectedTxIds.has(tx.id)}
                                                                        onCheckedChange={(checked) => {
                                                                            const newSet = new Set(selectedTxIds);
                                                                            if (checked) newSet.add(tx.id);
                                                                            else newSet.delete(tx.id);
                                                                            setSelectedTxIds(newSet);
                                                                        }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>{tx.description}</TableCell>
                                                                <TableCell className="text-right">{formatAmount(tx.amount)}</TableCell>
                                                            </TableRow>
                                                        )) : (
                                                            <TableRow><TableCell colSpan={3} className="text-center h-24">No transactions found for this date and type.</TableCell></TableRow>
                                                        )}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                            <DialogFooter>
                                                <Button onClick={handleAddSelectedToProject} disabled={selectedTxIds.size === 0}>Add to Project ({selectedTxIds.size})</Button>
                                            </DialogFooter>
                                        </DialogContent>
                                     </Dialog>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleSaveProject} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2 h-4 w-4"/>}
                                    Save Project Data
                                </Button>
                            </CardFooter>
                        </Card>
                    ) : (
                         <div className="flex items-center justify-center h-full border-2 border-dashed rounded-lg p-12 text-center">
                            <div>
                                <Briefcase className="mx-auto h-12 w-12 text-muted-foreground" />
                                <h3 className="mt-4 text-lg font-medium">Select a Project</h3>
                                <p className="mt-1 text-sm text-muted-foreground">Choose a project from the list or create a new one to get started.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
