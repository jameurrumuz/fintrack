'use client';

import React, { Suspense, useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Transaction, Party, Account, InventoryItem, TransactionVia, AppSettings, Loan, AmortizationEntry, SheetRow, SmsBlocklistRule } from '@/types';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToTransactionsForParty, updateTransaction, addTransaction as addTxService, toggleTransaction, recalculateBalancesFromTransaction, subscribeToAllTransactions, deleteTransaction } from '@/services/transactionService';
import { getOldLedgerData, subscribeToParties, updateParty, saveLoanAndUpdateParty, deleteLoan, markEmiAsPaid, updateLoanDetails, editEmiPaymentTransactions, deleteEmiPayment } from '@/services/partyService';
import { getAppSettings } from '@/services/settingsService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatAmount, formatDate, getPartyBalanceEffect, cn } from '@/lib/utils';
import { Loader2, ArrowLeft, Printer, MoreVertical, Edit, Trash2, ShoppingCart, RefreshCcw, Landmark, Briefcase, MessageSquare, Share2, ArrowDown, ArrowUp, Plus, Circle, CheckCircle, FileUp, Phone, Receipt, Eye, Search, FileText, X, ChevronsUpDown, Check, TrendingUp, TrendingDown, Clock, User } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { SidebarInset } from '@/components/ui/sidebar';
import { format as formatFns, parseISO, isPast, addMonths, addDays, differenceInDays, differenceInHours, isValid } from 'date-fns';
import { DatePicker } from '@/components/ui/date-picker';
import PartyTransactionEditDialog from '@/components/PartyTransactionEditDialog';
import PaymentReceiptDialog from '@/components/PaymentReceiptDialog';
import InvoiceDialog from '@/components/pos/InvoiceDialog';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { fetchSheetData } from '@/services/smsSyncService';
import { Separator } from '@/components/ui/separator';
import QRCode from 'qrcode';

const partyTransactionSchema = z.object({
  date: z.date(),
  description: z.string().min(1, 'Description is required'),
  amount: z.coerce.number().positive('Amount must be positive'),
  accountId: z.string().optional(),
  type: z.enum(['receive', 'give', 'credit_sale', 'purchase', 'spent', 'income', 'credit_purchase', 'sale', 'credit_give', 'credit_income']),
  via: z.string().optional(),
  charge: z.coerce.number().optional(),
  chargeVia: z.string().optional(),
}).superRefine((data, ctx) => {
    if (['give', 'receive', 'sale', 'purchase', 'spent', 'income'].includes(data.type)) {
        if (!data.accountId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Account is required for this transaction type.',
                path: ['accountId'],
            });
        }
    }
});

type FormValues = z.infer<typeof partyTransactionSchema>;

const loanFormSchema = z.object({
  principal: z.coerce.number().positive(),
  interestRate: z.coerce.number().min(0).optional(),
  tenure: z.coerce.number().positive().optional(),
  totalInstallments: z.coerce.number().positive().optional(),
  installmentAmount: z.coerce.number().positive().optional(),
  tenureUnit: z.enum(['days', 'weeks', 'months']).optional(),
  startDate: z.string().min(1),
  firstEmiDate: z.string().min(1),
  paymentFrequency: z.enum(['daily', 'weekly', 'fortnightly', 'monthly', 'quarterly']),
  interestType: z.enum(['no_interest', 'simple', 'compound']),
  repaymentType: z.enum(['principal_interest', 'interest_only', 'principal_interest_custom']),
  processingFee: z.coerce.number().min(0).optional(),
  disbursementType: z.enum(['receive_in_account', 'credit_only']),
  disbursementAccountId: z.string().optional(),
  calculationMode: z.enum(['rate', 'emi']).default('rate'),
});

type LoanFormValues = z.infer<typeof loanFormSchema>;

const PayEmiDialog = ({ isOpen, onOpenChange, installment, accounts, onConfirm, onDelete }: { isOpen: boolean, onOpenChange: (open: boolean) => void, installment: AmortizationEntry, accounts: Account[], onConfirm: (data: any) => void, onDelete: () => void }) => {
    const isEditing = installment.status === 'paid';
    const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
    const [accountId, setAccountId] = useState('');
    const [principal, setPrincipal] = useState(0);
    const [interest, setInterest] = useState(0);
    const [description, setDescription] = useState('');

    useEffect(() => {
        if(isOpen) {
            setPaymentDate(installment.paidOn || new Date().toISOString().split('T')[0]);
            setAccountId(installment.paymentDetails?.mode || '');
            setPrincipal(parseFloat((installment.paymentDetails?.principal ?? installment.principal).toFixed(2)));
            setInterest(parseFloat((installment.paymentDetails?.interest ?? installment.interest).toFixed(2)));
            setDescription(installment.paymentDetails?.description || `EMI Payment for Installment #${installment.installment}`);
        }
    }, [isOpen, installment]);
    
    const handleConfirm = () => {
        if (!accountId) return alert('Please select a payment account.');
        onConfirm({ paymentDate, accountId, principal, interest, description });
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{isEditing ? 'Edit' : 'Pay'} EMI #{installment.installment}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1"><Label>Payment Date</Label><Input type="date" value={paymentDate} onChange={e => setPaymentDate(e.target.value)} /></div>
                    <div className="space-y-1"><Label>Account</Label>
                        <Select value={accountId} onValueChange={setAccountId}>
                            <SelectTrigger><SelectValue placeholder="Select account..."/></SelectTrigger>
                            <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1"><Label>Principal Paid</Label><Input type="number" step="0.01" value={principal} onChange={e => setPrincipal(parseFloat(e.target.value) || 0)} /></div>
                        <div className="space-y-1"><Label>Interest Paid</Label><Input type="number" step="0.01" value={interest} onChange={e => setInterest(parseFloat(e.target.value) || 0)} /></div>
                    </div>
                    <div className="space-y-1"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                </div>
                <DialogFooter className="justify-between">
                    <div>{isEditing && <Button variant="destructive" onClick={onDelete}>Delete Payment</Button>}</div>
                    <div className="flex gap-2">
                        <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                        <Button onClick={handleConfirm}>{isEditing ? 'Save Changes' : 'Confirm Payment'}</Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const EditLoanDialog = ({ isOpen, onOpenChange, loan, onSave, accounts }: { isOpen: boolean, onOpenChange: (open: boolean) => void, loan: Loan, onSave: (loanId: string, data: Loan) => void, accounts: Account[] }) => {
    const form = useForm<LoanFormValues>({
        resolver: zodResolver(loanFormSchema),
        defaultValues: { ...loan, startDate: loan.startDate.split('T')[0], firstEmiDate: loan.firstEmiDate.split('T')[0] }
    });
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Edit Loan #{loan.loanNumber}</DialogTitle></DialogHeader>
                <form onSubmit={form.handleSubmit(data => onSave(loan.id, { ...loan, ...data }))}>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label>Principal</Label><Input type="number" {...form.register('principal')} /></div>
                            <div className="space-y-1"><Label>Interest Rate</Label><Input type="number" step="0.01" {...form.register('interestRate')} /></div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1"><Label>Start Date</Label><Input type="date" {...form.register('startDate')} /></div>
                            <div className="space-y-1"><Label>First EMI Date</Label><Input type="date" {...form.register('firstEmiDate')} /></div>
                        </div>
                    </div>
                    <DialogFooter><Button type="submit">Save Changes</Button></DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

function NewLoanForm({ partyId, accounts }: { partyId: string, accounts: Account[] }) {
    const { toast } = useToast();
    const form = useForm<LoanFormValues>({
        resolver: zodResolver(loanFormSchema),
        defaultValues: {
            principal: 100000, interestRate: 10, tenure: 12, tenureUnit: 'months',
            startDate: formatFns(new Date(), 'yyyy-MM-dd'),
            firstEmiDate: formatFns(addDays(new Date(), 30), 'yyyy-MM-dd'),
            paymentFrequency: 'monthly', interestType: 'simple', repaymentType: 'principal_interest',
            disbursementType: 'receive_in_account', calculationMode: 'rate',
        }
    });

    const [generatedSchedule, setGeneratedSchedule] = useState<AmortizationEntry[]>([]);
    const { principal, interestRate, tenure, firstEmiDate, paymentFrequency, calculationMode, repaymentType, installmentAmount, totalInstallments } = form.watch();

    useEffect(() => {
        if (!principal || principal <= 0) return setGeneratedSchedule([]);
        let schedule: AmortizationEntry[] = [];
        let numPayments = tenure || 0;
        let emi = 0;
        if (repaymentType === 'principal_interest') {
            if (calculationMode === 'rate' && tenure) {
                emi = (principal + (principal * (interestRate || 0) / 100 * (tenure / 12))) / tenure;
            } else if (calculationMode === 'emi' && installmentAmount) {
                emi = installmentAmount;
                numPayments = totalInstallments || Math.ceil(principal / emi);
            }
        }
        let currentDate = new Date(firstEmiDate);
        let remainingBalance = principal;
        for (let i = 1; i <= numPayments; i++) {
            const p = emi;
            remainingBalance -= p;
            schedule.push({ installment: i, dueDate: currentDate.toISOString().split('T')[0], payment: emi, principal: p, interest: 0, remainingBalance: remainingBalance > 0 ? remainingBalance : 0, status: 'unpaid' });
            if (paymentFrequency === 'monthly') currentDate = addMonths(currentDate, 1);
            else if (paymentFrequency === 'weekly') currentDate = addDays(currentDate, 7);
            else if (paymentFrequency === 'daily') currentDate = addDays(currentDate, 1);
        }
        setGeneratedSchedule(schedule);
    }, [principal, interestRate, tenure, firstEmiDate, paymentFrequency, calculationMode, repaymentType, installmentAmount, totalInstallments, form]);

    const handleLoanSubmit = async (data: LoanFormValues) => {
        try {
            await saveLoanAndUpdateParty(partyId, { ...data, loanNumber: `L-${Date.now()}`, schedule: generatedSchedule, isActive: true });
            toast({ title: "Loan Created!" });
            form.reset();
        } catch (error: any) { toast({ variant: "destructive", title: "Error", description: error.message }); }
    };

    return (
        <Card>
            <CardHeader><CardTitle className="text-sm">Create New Loan</CardTitle></CardHeader>
            <form onSubmit={form.handleSubmit(handleLoanSubmit)}>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1"><Label className="text-[10px]">Principal</Label><Input type="number" {...form.register('principal')} className="h-8 text-xs" /></div>
                        <div className="space-y-1"><Label className="text-[10px]">Start Date</Label><Input type="date" {...form.register('startDate')} className="h-8 text-xs" /></div>
                        <div className="space-y-1"><Label className="text-[10px]">First EMI Date</Label><Input type="date" {...form.register('firstEmiDate')} className="h-8 text-xs" /></div>
                        <div className="space-y-1"><Label className="text-[10px]">Fee</Label><Input type="number" {...form.register('processingFee')} className="h-8 text-xs" /></div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="space-y-1"><Label className="text-[10px]">Frequency</Label>
                            <Select defaultValue="monthly" onValueChange={(v) => form.setValue('paymentFrequency', v as any)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monthly">Monthly</SelectItem><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="daily">Daily</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px]">Repayment</Label>
                            <Select defaultValue="principal_interest" onValueChange={(v) => form.setValue('repaymentType', v as any)}><SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="principal_interest">Principal + Int</SelectItem><SelectItem value="interest_only">Int Only</SelectItem></SelectContent></Select>
                        </div>
                        <div className="space-y-1"><Label className="text-[10px]">Account</Label>
                            <Select onValueChange={(v) => form.setValue('disbursementAccountId', v)}><SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Account"/></SelectTrigger><SelectContent>{accounts.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent></Select>
                        </div>
                        <Button type="submit" className="mt-5 h-8 text-[10px]">CREATE</Button>
                    </div>
                </CardContent>
            </form>
        </Card>
    );
}

function PartyLedgerPageContent({ partyId }: { partyId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const ledgerEndRef = useRef<HTMLDivElement>(null);

  const [party, setParty] = useState<Party | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [oldLedger, setOldLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("transactions");
  const [filters, setFilters] = useState({ 
    dateFrom: formatFns(addDays(new Date(), -30), 'yyyy-MM-dd'), 
    dateTo: formatFns(new Date(), 'yyyy-MM-dd'), 
    via: 'all' 
  });
  const [isDateFilterEnabled, setIsDateFilterEnabled] = useState(false);
  const [includeInternalTx, setIncludeInternalTx] = useState(true);
  
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [viewingReceipt, setViewingReceipt] = useState<Transaction | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Transaction | null>(null);
  const [payingInstallment, setPayingInstallment] = useState<{ loanId: string, installment: AmortizationEntry, index: number } | null>(null);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formType, setFormType] = useState<'give' | 'receive' | 'spent' | 'credit_give' | 'credit_income'>('give');
  const [isGiveOptionsOpen, setIsGiveOptionsOpen] = useState(false);
  const [isReceiveOptionsOpen, setIsReceiveOptionsOpen] = useState(false);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  const [smsData, setSmsData] = useState<SheetRow[]>([]);
  const [smsLoading, setSmsLoading] = useState(false);
  
  const [doneSms, setDoneSms] = useState<SheetRow[]>([]);
  const [blocklistRules, setBlocklistRules] = useState<SmsBlocklistRule[]>([]);
  const [selectedSms, setSelectedSms] = useState<Set<string>>(new Set());
  const [sendSms, setSendSms] = useState(true);

  useEffect(() => {
    if (partyId) {
        setLoading(true);
        getDoc(doc(db, 'parties', partyId)).then(snap => { 
            if (snap.exists()) setParty({ id: snap.id, ...snap.data() } as Party); 
            else router.push('/parties');
        }).catch(err => console.error(err));
        
        getOldLedgerData(partyId).then(data => { if (data) setOldLedger(data); });
        getAppSettings().then(settings => {
            setAppSettings(settings);
            setDoneSms(settings?.doneSms || []);
            setBlocklistRules(settings?.smsBlocklist || []);
        });
        subscribeToTransactionsForParty(partyId, setTransactions, console.error);
        subscribeToAllTransactions(setAllTransactions, console.error);
        subscribeToAccounts(setAccounts, console.error);
        subscribeToParties(setParties, console.error);
        subscribeToInventoryItems(setInventoryItems, console.error);
        setTimeout(() => setLoading(false), 500);
    }
  }, [partyId, toast, router]);

  const { groupedTransactions, currentBalance, openingBalance, finalBalanceInTable, partyAnalysis, soldProductsSummary } = useMemo(() => {
    const enabledTxs = transactions.filter(t => t.enabled);
    
    // Sort oldest first for running balance
    const sortedAll = [...enabledTxs].sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        if (dateA !== dateB) return dateA - dateB;
        const timeA = (a as any).createdAt ? new Date((a as any).createdAt).getTime() : 0;
        const timeB = (b as any).createdAt ? new Date((b as any).createdAt).getTime() : 0;
        return timeA - timeB;
    });
    
    let running = 0;
    const withRunning = sortedAll.map(t => {
        running += getPartyBalanceEffect(t);
        return { ...t, runningBalance: running };
    });

    const opening = isDateFilterEnabled ? withRunning
        .filter(t => t.date < filters.dateFrom)
        .pop()?.runningBalance || 0 : 0;

    let filtered = withRunning.filter(t => {
        if (filters.via !== 'all' && t.via !== filters.via) return false;
        if (!isDateFilterEnabled) return true;
        return t.date >= filters.dateFrom && t.date <= filters.dateTo;
    });
    
    if (!includeInternalTx) {
        filtered = filtered.filter(t => getPartyBalanceEffect(t) !== 0);
    }

    const grouped: { [key: string]: any[] } = {};
    filtered.forEach(t => { if(!grouped[t.date]) grouped[t.date] = []; grouped[t.date].push(t); });
    
    // For UI Display, sort days Ascending (oldest first)
    const groupedArray = Object.entries(grouped).sort(([dateA], [dateB]) => new Date(dateA).getTime() - new Date(dateB).getTime()); 

    // --- Analysis ---
    let totalReceive = 0;
    let totalGive = 0;
    const productSales = new Map<string, { name: string, quantity: number }>();

    enabledTxs.forEach(tx => {
        const effect = getPartyBalanceEffect(tx);
        const isDebit = ['give', 'spent', 'purchase', 'purchase_return', 'credit_give', 'credit_sale', 'sale'].includes(tx.type);
        const isCredit = ['receive', 'credit_purchase', 'sale_return', 'income', 'credit_income'].includes(tx.type);

        if (isCredit) totalReceive += tx.amount;
        else if (isDebit) {
            totalGive += tx.amount;
            if (tx.type === 'sale' || tx.type === 'credit_sale') {
                tx.items?.forEach(item => {
                    const existing = productSales.get(item.id) || { name: item.name, quantity: 0 };
                    existing.quantity += item.quantity;
                    productSales.set(item.id, existing);
                });
            }
        }
    });

    const totalProfit = enabledTxs
        .filter(tx => (tx.type === 'sale' || tx.type === 'credit_sale') && tx.items)
        .reduce((profit, tx) => {
             const saleCost = tx.items!.reduce((cost, item) => cost + (item.cost || 0), 0);
            return profit + (tx.amount - saleCost);
        }, 0);

    return { 
        groupedTransactions: groupedArray, 
        currentBalance: running, 
        openingBalance: opening, 
        finalBalanceInTable: running,
        partyAnalysis: { totalGive, totalReceive, totalProfit },
        soldProductsSummary: Array.from(productSales.values()).sort((a,b) => b.quantity - a.quantity)
    };
  }, [transactions, filters, isDateFilterEnabled, includeInternalTx]);

  useEffect(() => {
    if (ledgerEndRef.current && !isDateFilterEnabled) {
        ledgerEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [groupedTransactions, isDateFilterEnabled]);

  const defaultAccountId = useMemo(() => {
    if (accounts.length > 0) {
      return accounts.find(a => a.name.toLowerCase() === 'cash')?.id || accounts[0].id;
    }
    return '';
  }, [accounts]);

  const transactionForm = useForm<FormValues>({ 
    resolver: zodResolver(partyTransactionSchema), 
    defaultValues: { date: new Date(), type: 'receive', amount: '' as any, accountId: defaultAccountId, via: '', charge: 0, chargeVia: '' } 
  });

  const handleAddTransaction = async (data: FormValues) => {
    if (!party) return;
    try {
        await addTxService({ ...data, date: formatFns(data.date, 'yyyy-MM-dd'), partyId: party.id, enabled: true });
        toast({ title: 'Success' });
        setIsFormOpen(false);
        transactionForm.reset();
    } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
  };

  const handleUpdateTransaction = async (data: Omit<Transaction, 'id' | 'enabled'>) => {
    if (!editingTransaction) return;
    try {
      await updateTransaction(editingTransaction.id, data);
      toast({ title: "Success" });
      setEditingTransaction(null);
    } catch (error: any) { toast({ variant: 'destructive', title: "Error", description: error.message }); }
  };

  const handleDeleteTransaction = async (txId: string) => {
    try {
        await toggleTransaction(txId, false);
        toast({ title: "Disabled" });
    } catch (error: any) { toast({ variant: 'destructive', title: "Error", description: error.message }); }
  };

  const handleSmsSearch = async () => {
    setIsSmsDialogOpen(true);
    setSmsLoading(true);
    try {
        const data = await fetchSheetData();
        setSmsData(data);
    } catch (e) {
        toast({ variant: 'destructive', title: 'Failed to load SMS data' });
    } finally {
        setSmsLoading(false);
    }
  };

  const handleSelectSms = (sms: SheetRow) => {
    const amountRegex = /(\d{1,3}(,\d{3})*(\.\d+)?)/;
    const match = sms.message.match(amountRegex);
    const amount = match ? parseFloat(match[0].replace(/,/g, '')) : 0;
    transactionForm.setValue('amount', amount);
    transactionForm.setValue('description', sms.message);
    setIsSmsDialogOpen(false);
  }

  const openFormDialog = (type: 'give' | 'receive' | 'spent' | 'credit_give' | 'credit_income') => {
    setFormType(type);
    transactionForm.reset({
        date: new Date(), 
        description: '', 
        amount: '' as any, 
        accountId: defaultAccountId, 
        type: type,
        via: party?.group || 'Personal', 
        charge: 0, 
        chargeVia: party?.group || 'Personal',
    });
    setIsFormOpen(true);
  };

  const handleMarkEmiAsPaid = async (data: any) => {
    if (payingInstallment) {
      await markEmiAsPaid(partyId, payingInstallment.loanId, payingInstallment.index, data);
      toast({ title: "EMI Paid!" });
      setPayingInstallment(null);
    }
  };

  const handleEditEmiPayment = async (data: any) => {
    if (payingInstallment) {
      await editEmiPaymentTransactions(partyId, payingInstallment.loanId, payingInstallment.index, data);
      toast({ title: "EMI Updated!" });
      setPayingInstallment(null);
    }
  };

  const handleDeleteEmiPayment = async () => {
    if (payingInstallment) {
      await deleteEmiPayment(partyId, payingInstallment.loanId, payingInstallment.index);
      toast({ title: "EMI Payment Deleted!" });
      setPayingInstallment(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center items-center h-screen">
      <Loader2 className="animate-spin text-primary h-8 w-8" />
    </div>
  );
  
  if (!party) return (
    <div className="flex flex-col justify-center items-center h-screen gap-4">
      <p className="text-muted-foreground">Party not found</p>
      <Button onClick={() => router.push('/parties')}>Back to Parties</Button>
    </div>
  );

  return (
    <SidebarInset className="flex flex-col bg-gray-50 dark:bg-gray-900">
        <PartyTransactionEditDialog 
          transaction={editingTransaction} 
          onOpenChange={(open) => !open && setEditingTransaction(null)} 
          onSave={handleUpdateTransaction} 
          parties={parties} 
          accounts={accounts} 
          inventoryItems={[]} 
          appSettings={appSettings} 
        />
        <PaymentReceiptDialog 
          isOpen={!!viewingReceipt} 
          onOpenChange={() => setViewingReceipt(null)} 
          transaction={viewingReceipt} 
          party={party} 
          appSettings={appSettings} 
          accounts={accounts} 
          allTransactions={allTransactions} 
        />
        <InvoiceDialog 
          isOpen={!!viewingInvoice} 
          onOpenChange={(open) => !open && setViewingInvoice(null)} 
          invoice={viewingInvoice} 
          party={party} 
          parties={parties} 
          appSettings={appSettings} 
          onPrint={() => {}} 
          ref={invoiceRef} 
          accounts={accounts} 
          allTransactions={allTransactions} 
        />
        
        {payingInstallment && (
            <PayEmiDialog 
              isOpen={!!payingInstallment} 
              onOpenChange={() => setPayingInstallment(null)} 
              installment={payingInstallment.installment} 
              accounts={accounts} 
              onConfirm={payingInstallment.installment.status === 'paid' ? handleEditEmiPayment : handleMarkEmiAsPaid} 
              onDelete={handleDeleteEmiPayment} 
            />
        )}
        {editingLoan && (
            <EditLoanDialog 
              isOpen={!!editingLoan} 
              onOpenChange={() => setEditingLoan(null)} 
              loan={editingLoan} 
              onSave={(id, data) => updateLoanDetails(partyId, id, data).then(() => { toast({title: "Updated"}); setEditingLoan(null); })} 
              accounts={accounts} 
            />
        )}

        <Dialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen}>
            <DialogContent className="max-w-4xl">
                <DialogHeader><DialogTitle>Search SMS</DialogTitle></DialogHeader>
                <div className="max-h-[60vh] overflow-y-auto">
                    {smsLoading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin h-8 w-8"/></div> : (
                        <Table>
                            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Sender</TableHead><TableHead>Message</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {smsData.map((sms, i) => (
                                    <TableRow key={i} onClick={() => handleSelectSms(sms)} className="cursor-pointer hover:bg-muted">
                                        <TableCell>{sms.date}</TableCell><TableCell>{sms.name}</TableCell><TableCell className="text-xs">{sms.message}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>
            </DialogContent>
        </Dialog>

        <header className="bg-background border-b sticky top-0 z-20 shadow-sm no-print">
            <div className="container mx-auto px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                            <Link href="/parties"><ArrowLeft className="h-4 w-4" /></Link>
                        </Button>
                        <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-red-500 text-white font-bold text-xs">
                                {party.name?.charAt(0) || 'P'}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-sm font-bold truncate max-w-[150px]">{party.name}</h1>
                            <p className="text-[10px] text-muted-foreground">{party.phone || 'No Phone'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-green-600" asChild>
                            <a href={`https://wa.me/${party.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                                <MessageSquare className="h-4 w-4" />
                            </a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600" asChild>
                            <a href={`tel:${party.phone}`}><Phone className="h-4 w-4" /></a>
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <MoreVertical className="h-4 w-4"/>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => router.push(`/parties?edit=${party.id}`)}>
                                    <Edit className="mr-2 h-3 w-3" /> Edit Party
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => recalculateBalancesFromTransaction()}>
                                    <RefreshCcw className="mr-2 h-3 w-3" /> Sync Balance
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
                <div className="mt-2">
                    <Card className="bg-gray-100 dark:bg-gray-800 border-0 shadow-sm">
                        <CardContent className="p-2 text-center">
                            <p className="text-[8px] uppercase font-black text-gray-500 tracking-wider">
                                {currentBalance >= 0 ? 'NET PAYABLE' : 'NET RECEIVABLE'}
                            </p>
                            <p className={cn("text-xl font-black", currentBalance >= 0 ? "text-red-600" : "text-green-600")}>
                                ৳{formatAmount(Math.abs(currentBalance), false)}
                            </p>
                        </CardContent>
                    </Card>
                </div>
                <div className="grid grid-cols-6 gap-1 mt-2 mb-1 max-w-md mx-auto">
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-1 flex flex-col items-center gap-0" onClick={() => setActiveTab("loan")}>
                        <Landmark className="h-4 w-4" /><span className="text-[9px]">LOAN</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-1 flex flex-col items-center gap-0" asChild>
                        <Link href={`/old-data?partyId=${party.id}`}><FileUp className="h-4 w-4" /><span className="text-[9px]">OLD</span></Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-1 flex flex-col items-center gap-0" onClick={() => openFormDialog('spent')}>
                        <Briefcase className="h-4 w-4" /><span className="text-[9px]">EXP</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-1 flex flex-col items-center gap-0" asChild>
                        <Link href={`/pos?partyId=${party.id}`}><ShoppingCart className="h-4 w-4" /><span className="text-[9px]">POS</span></Link>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-1 flex flex-col items-center gap-0" onClick={() => window.print()}>
                        <Printer className="h-4 w-4" /><span className="text-[9px]">PRINT</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-auto py-1 px-1 flex flex-col items-center gap-0" onClick={() => {}}>
                        <Share2 className="h-4 w-4" /><span className="text-[9px]">SHARE</span>
                    </Button>
                </div>
            </div>
        </header>

        <main className="container mx-auto p-3 flex-1 overflow-auto pb-24">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 h-auto p-1 bg-gray-100 dark:bg-gray-800 rounded-lg mb-2">
                <TabsTrigger value="transactions" className="text-xs">Transactions</TabsTrigger>
                <TabsTrigger value="party-details" className="text-xs">Analysis</TabsTrigger>
                <TabsTrigger value="loan" className="text-xs">Loan Mgt</TabsTrigger>
                <TabsTrigger value="old_ledger" className="text-xs">Old Data</TabsTrigger>
            </TabsList>
            <TabsContent value="transactions" className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border shadow-sm">
                    <div className="flex items-center gap-1">
                        <Input 
                            type="date" 
                            value={filters.dateFrom} 
                            onChange={e => setFilters({...filters, dateFrom: e.target.value})} 
                            className="h-7 w-28 text-[10px]" 
                        />
                        <span className="text-xs text-muted-foreground">to</span>
                        <Input 
                            type="date" 
                            value={filters.dateTo} 
                            onChange={e => setFilters({...filters, dateTo: e.target.value})} 
                            className="h-7 w-28 text-[10px]" 
                        />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center space-x-1">
                        <Checkbox id="inc-int" checked={includeInternalTx} onCheckedChange={(c) => setIncludeInternalTx(!!c)}/>
                        <Label htmlFor="inc-int" className="text-[10px]">INC/EXP</Label>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Switch id="filter-sw" checked={isDateFilterEnabled} onCheckedChange={setIsDateFilterEnabled} className="h-4 w-7"/>
                        <Label htmlFor="filter-sw" className="text-[10px]">FILTER</Label>
                      </div>
                    </div>
                </div>
                <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="text-xs w-10 text-center">SL</TableHead>
                          <TableHead className="text-xs">Date</TableHead>
                          <TableHead className="text-xs">Description</TableHead>
                          <TableHead className="text-right text-xs">Dr (Debit)</TableHead>
                          <TableHead className="text-right text-xs">Cr (Credit)</TableHead>
                          <TableHead className="text-right text-xs">Balance</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isDateFilterEnabled && (
                            <TableRow className="bg-muted/30 italic">
                                <TableCell colSpan={5} className="text-right font-bold text-[10px]">Opening Balance</TableCell>
                                <TableCell className="text-right font-bold text-[10px]">{formatAmount(openingBalance)}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        )}
                        {groupedTransactions.map(([date, txs]) => (
                          <React.Fragment key={date}>
                            <TableRow className="bg-primary/5 hover:bg-primary/10">
                              <TableCell colSpan={7} className="py-1 px-3 font-bold text-[10px] text-primary">
                                {formatDate(date)}
                              </TableCell>
                            </TableRow>
                            {txs.map((t, idx) => {
                              const isDebit = ['give', 'purchase', 'spent', 'credit_sale', 'purchase_return', 'credit_give'].includes(t.type);
                              const isCredit = ['receive', 'sale', 'income', 'credit_purchase', 'sale_return', 'credit_income'].includes(t.type);
                              const isInvoice = t.type === 'sale' || t.type === 'credit_sale';
                              return (
                                <TableRow key={t.id} className="group hover:bg-muted/30">
                                    <TableCell className="text-[10px] text-center">{idx + 1}</TableCell>
                                    <TableCell className="text-[10px]">{formatDate(date)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="text-xs">{t.description}</span>
                                            <div className="flex items-center gap-1">
                                              <Badge variant="outline" className="text-[8px] w-fit h-3 uppercase">{t.type}</Badge>
                                              {t.accountId && <span className="text-[8px] font-bold text-primary">| {accounts.find(a => a.id === t.accountId)?.name}</span>}
                                              {isInvoice && (
                                                <Button 
                                                  variant="link" 
                                                  className="h-auto p-0 text-[8px]" 
                                                  onClick={() => setViewingInvoice(t)}
                                                >
                                                  Invoice
                                                </Button>
                                              )}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right text-red-600 text-[10px]">
                                        {isDebit ? formatAmount(t.amount) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right text-green-600 text-[10px]">
                                        {isCredit ? formatAmount(t.amount) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-bold text-[10px]">
                                        {formatAmount(t.runningBalance)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                                    <MoreVertical className="h-3 w-3" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
                                                <DropdownMenuItem onClick={() => setEditingTransaction(t)}>
                                                    <Edit className="mr-2 h-4 w-4"/> Edit
                                                </DropdownMenuItem>
                                                <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteTransaction(t.id)}>
                                                    <Trash2 className="mr-2 h-4 w-4"/> Disable
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </TableCell>
                                </TableRow>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={5} className="text-right font-bold text-xs">Final Balance</TableCell>
                          <TableCell className="text-right font-bold text-xs">{formatAmount(finalBalanceInTable)}</TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                </div>
                <div ref={ledgerEndRef} />
            </TabsContent>
            
            <TabsContent value="party-details">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader><CardTitle>Performance Summary</CardTitle></CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Total Debit Items (Dr):</span> 
                                <span className="font-medium text-red-600">{formatAmount(partyAnalysis.totalGive)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Total Credit Items (Cr):</span> 
                                <span className="font-medium text-green-600">{formatAmount(partyAnalysis.totalReceive)}</span>
                            </div>
                            <div className="flex justify-between font-bold text-primary">
                                <span>Total Profit Generated:</span> 
                                <span>{formatAmount(partyAnalysis.totalProfit)}</span>
                            </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Products Purchased</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Product</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {soldProductsSummary.map((p, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{p.name}</TableCell>
                                            <TableCell className="text-right">{p.quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>

            <TabsContent value="loan" className="space-y-4">
                <NewLoanForm partyId={partyId} accounts={accounts} />
                <Card className="mt-4">
                    <CardHeader><CardTitle className="text-sm">Active Loans</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        {party.loans?.map(loan => (
                            <Card key={loan.id} className="bg-muted/50 p-3">
                                <div className="flex justify-between items-center mb-2">
                                    <p className="font-bold text-xs">Loan #{loan.loanNumber}</p>
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            className="h-7 text-[10px]"
                                            onClick={() => setEditingLoan(loan)}
                                        >
                                            Edit
                                        </Button>
                                        <Button 
                                            variant="destructive" 
                                            size="sm" 
                                            className="h-7 text-[10px]" 
                                            onClick={() => deleteLoan(partyId, loan.id)}
                                        >
                                            Delete
                                        </Button>
                                    </div>
                                </div>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-[10px]">EMI#</TableHead>
                                            <TableHead className="text-[10px]">Date</TableHead>
                                            <TableHead className="text-right text-[10px]">Pay</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loan.schedule.map((emi, idx) => (
                                            <TableRow key={idx}>
                                                <TableCell className="text-[10px]">{emi.installment}</TableCell>
                                                <TableCell className="text-[10px]">{formatDate(emi.dueDate)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Button 
                                                        size="sm" 
                                                        className="h-6 text-[9px]" 
                                                        variant={emi.status === 'paid' ? 'outline' : 'default'} 
                                                        onClick={() => setPayingInstallment({ loanId: loan.id, installment: emi, index: idx })}
                                                    >
                                                        {emi.status.toUpperCase()}
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </Card>
                        ))}
                        {(!party.loans || party.loans.length === 0) && (
                            <p className="text-center text-muted-foreground text-sm py-4">No active loans</p>
                        )}
                    </CardContent>
                </Card>
            </TabsContent>
            
            <TabsContent value="old_ledger">
              <Card>
                <CardHeader className="p-3"><CardTitle className="text-sm">Historical Data</CardTitle></CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-[10px]">Date</TableHead>
                        <TableHead className="text-[10px]">Description</TableHead>
                        <TableHead className="text-right text-[10px]">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {oldLedger.map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-[10px]">{String(r['Date'])}</TableCell>
                          <TableCell className="text-[10px]">{String(r['Comments'])}</TableCell>
                          <TableCell className="text-right font-bold text-[10px]">{formatAmount(Number(r['Balance (৳)']))}</TableCell>
                        </TableRow>
                      ))}
                      {oldLedger.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center text-muted-foreground py-4">
                            No historical data available
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </main>
        
        <footer className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t p-2 shadow-lg no-print">
            <div className="container mx-auto grid grid-cols-2 gap-2 max-w-md">
                <Dialog open={isGiveOptionsOpen} onOpenChange={setIsGiveOptionsOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-10 bg-red-600 hover:bg-red-700 text-white font-bold text-xs">
                            <ArrowUp className="mr-1 h-3 w-3"/> I Gave
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xs">
                        <DialogHeader><DialogTitle>Select "Give" Type</DialogTitle></DialogHeader>
                        <div className="grid gap-2 py-4">
                            <Button onClick={() => { openFormDialog('give'); setIsGiveOptionsOpen(false); }}>
                                Give (Paid)
                            </Button>
                            <Button onClick={() => { openFormDialog('credit_give'); setIsGiveOptionsOpen(false); }} variant="outline">
                                Credit Give (Due)
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>

                <Dialog open={isReceiveOptionsOpen} onOpenChange={setIsReceiveOptionsOpen}>
                    <DialogTrigger asChild>
                        <Button className="h-10 bg-green-600 hover:bg-green-700 text-white font-bold text-xs">
                            <ArrowDown className="mr-1 h-3 w-3"/> I Received
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-xs">
                        <DialogHeader><DialogTitle>Select "Receive" Type</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <Button onClick={() => { openFormDialog('receive'); setIsReceiveOptionsOpen(false); }}>
                                Receive Payment
                            </Button>
                            <Button onClick={() => { openFormDialog('credit_income'); setIsReceiveOptionsOpen(false); }} variant="outline">
                                Credit Income (Due)
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </footer>

        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
            <DialogContent className="max-w-sm">
                <DialogHeader><DialogTitle className="uppercase text-xs">{formType}</DialogTitle></DialogHeader>
                <form onSubmit={transactionForm.handleSubmit(handleAddTransaction)}>
                    <div className="space-y-3">
                        <div className="flex justify-end">
                            <Button type="button" variant="outline" size="sm" onClick={handleSmsSearch}>
                                <Search className="mr-2 h-4 w-4"/> Search SMS
                            </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px]">Amount</Label>
                                <Input type="number" step="0.01" {...transactionForm.register('amount')} className="h-8 text-xs" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px]">Date</Label>
                                <DatePicker 
                                    value={transactionForm.watch('date')} 
                                    onChange={d => transactionForm.setValue('date', d as Date)} 
                                />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[10px]">Description</Label>
                            <Input {...transactionForm.register('description')} className="h-8 text-xs" />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1">
                                <Label className="text-[10px]">Account</Label>
                                <Select 
                                    onValueChange={v => transactionForm.setValue('accountId', v)} 
                                    value={transactionForm.watch('accountId')}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Account"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1">
                                <Label className="text-[10px]">Profile (Via)</Label>
                                <Select 
                                    onValueChange={v => transactionForm.setValue('via', v)} 
                                    value={transactionForm.watch('via')}
                                >
                                    <SelectTrigger className="h-8 text-xs">
                                        <SelectValue placeholder="Via"/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(appSettings?.businessProfiles || []).map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2 pt-1">
                            <Switch id="send-sms-quick" checked={sendSms} onCheckedChange={setSendSms} className="scale-75" />
                            <Label htmlFor="send-sms-quick" className="text-[10px]">Send SMS</Label>
                        </div>
                        <DialogFooter className="pt-2 flex gap-2">
                            <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => setIsFormOpen(false)}>
                                Cancel
                            </Button>
                            <Button type="submit" size="sm" className="flex-1">
                                Save
                            </Button>
                        </DialogFooter>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    </SidebarInset>
  );
}

export default function PartyLedgerPageWrapper(props: { params: Promise<{ partyId: string }> }) {
  const params = use(props.params);
  const partyId = params.partyId;
  
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-primary" /></div>}>
      <PartyLedgerPageContent partyId={partyId} />
    </Suspense>
  );
}
