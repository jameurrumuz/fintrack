'use client';

import { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { subscribeToPartyById, requestNameChange, updatePartyPassword, logActivity } from '@/services/portalService';
import type { Transaction, Party, AppSettings, CustomerService, InventoryItem, Account, VerificationResult } from '@/types';
import { subscribeToTransactionsForParty, addTransaction, attemptAutoVerification, subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToParties } from '@/services/partyService';
import { getAppSettings } from '@/services/settingsService';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Loader2, FileText, FileStack, LogOut, WalletCards, Wrench, UserCog, ArrowLeft, Eye, CheckCircle2, History, MessageSquare, Copy, KeyRound, Smartphone } from 'lucide-react';
import Link from 'next/link';
import { cn, formatAmount, formatDate, getPartyBalanceEffect } from '@/lib/utils';
import { format as formatFns, subDays, startOfDay, parseISO } from 'date-fns';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { Badge } from '@/components/ui/badge';
import { CopyToClipboard } from '@/app/tools/copy-to-clipboard';
import InvoiceDialog from '@/components/pos/InvoiceDialog';
import { Switch } from '@/components/ui/switch';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'framer-motion';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

// Color Palette
const colors = {
    primary: '#1A05A2',      // Deep Blue
    secondary: '#8F0177',     // Purple
    accent: '#DE1A58',        // Red
    gradient: 'from-[#1A05A2] via-[#8F0177] to-[#DE1A58]',
    gradientLight: 'from-[#1A05A2]/10 via-[#8F0177]/10 to-[#DE1A58]/10',
};

const translations = {
    en: {
        myLedger: "My Ledger",
        payments: "Payments",
        service: "Service",
        myProfile: "My Profile",
        welcome: "Welcome",
        logout: "Log Out",
        updateProfileTitle: "Update Your Profile",
        changePasswordTitle: "Change Your Password",
        profileTab: "Profile",
        passwordTab: "Password",
        nameLabel: "Name",
        requestChangeBtn: "Request Change",
        requestPendingBtn: "Request Pending",
        nameChangeConfirmTitle: "Confirm Name Change",
        nameChangeConfirmDesc: (oldName: string, newName: string) => `Are you sure you want to request to change your name from "${oldName}" to "${newName}"?`,
        nameChangeRequestSent: "Your name change request has been sent for admin approval.",
        currentPasswordLabel: "Current Password",
        newPasswordLabel: "New Password",
        confirmNewPasswordLabel: "Confirm New Password",
        updatePasswordBtn: "Update Password",
        paymentHistoryTitle: "Payment History",
        paymentHistoryDesc: "History of all your service payments.",
        dateCol: "Date",
        detailsCol: "Details",
        serviceCol: "Service",
        amountCol: "Amount",
        statusCol: "Status",
        noPaymentHistory: "No payment history found.",
        availableServicesTitle: "Available Services",
        availableServicesDesc: "Choose a service for your needs.",
        availServiceBtn: "Avail Service",
        noServicesAvailable: "No services are available at the moment.",
        submitPaymentTitle: "Submit Payment Details",
        submitPaymentDesc: (amount: number) => `You are making a payment of ৳${formatAmount(amount, false)}. Please pay using the instructions below and submit details for verification.`,
        paymentInstructionsTitle: "Payment Instructions",
        paymentRefLabel: "Your Payment Reference",
        paymentRefDesc: "Please use this code in the payment reference/note.",
        paymentPhoneLabel: "Phone number used for payment",
        paymentTrxIdLabel: "Transaction ID (TrxID)",
        submitForVerificationBtn: "Submit for Verification",
        verifyingPaymentTitle: "Verifying your payment...",
        verifyingPaymentDesc: "This may take a moment. Please wait.",
        verificationSuccessTitle: "Payment Verified & Service Activated!",
        verificationSuccessDesc: "Your transaction has been recorded.",
        verificationPendingTitle: "Verification Pending",
        verificationPendingDesc: "Your payment could not be auto-verified. It is now pending admin approval. Contact 01617590765 for support.",
        closeBtn: "Close",
        cancelBtn: "Cancel",
        confirmRequestBtn: "Confirm Request",
        transactionHistoryTitle: "Transaction History",
        fromLabel: "From",
        toLabel: "To",
        openingBalance: "Opening Balance",
        debitCol: "Debit (You Received)",
        creditCol: "Credit (You Gave)",
        balanceCol: "Balance",
        finalBalance: "Final Balance",
        noTransactionsFound: "No transactions found for this period.",
        currentBalance: "Current Balance",
        language: "Language",
        english: "English",
        bengali: "Bengali",
        enterAnyAmountTitle: (serviceName: string) => `Enter Amount for "${serviceName}"`,
        enterAnyAmountDescription: "Please enter the amount you wish to pay and click Next.",
        paymentAmountLabel: "Payment Amount",
        paymentAmountPlaceholder: "Enter amount",
        nextButton: "Next",
        paymentMethod: "Method:",
        paymentNumber: "Number:",
        paymentType: "Type:",
    },
    bn: {
        myLedger: "আমার লেজার",
        payments: "পেমেন্ট",
        service: "সার্ভিস",
        myProfile: "আমার প্রোফাইল",
        welcome: "স্বাগতম",
        logout: "লগ আউট",
        updateProfileTitle: "আপনার প্রোফাইল আপডেট করুন",
        changePasswordTitle: "আপনার পাসওয়ার্ড পরিবর্তন করুন",
        profileTab: "প্রোফাইল",
        passwordTab: "পাসওয়ার্ড",
        nameLabel: "নাম",
        requestChangeBtn: "পরিবর্তনের অনুরোধ",
        requestPendingBtn: "অনুরোধ অপেক্ষাধীন",
        nameChangeConfirmTitle: "নাম পরিবর্তনের অনুরোধ নিশ্চিত করুন",
        nameChangeConfirmDesc: (oldName: string, newName: string) => `আপনি কি নিশ্চিত যে আপনি আপনার নাম "${oldName}" থেকে "${newName}" করার জন্য অনুরোধ করতে চান?`,
        nameChangeRequestSent: "আপনার নাম পরিবর্তনের অনুরোধটি অ্যাডমিন অনুমোদনের জন্য পাঠানো হয়েছে।",
        currentPasswordLabel: "বর্তমান পাসওয়ার্ড",
        newPasswordLabel: "নতুন পাসওয়ার্ড",
        confirmNewPasswordLabel: "নতুন পাসওয়ার্ড নিশ্চিত করুন",
        updatePasswordBtn: "পাসওয়ার্ড আপডেট করুন",
        paymentHistoryTitle: "পেমেন্টের ইতিহাস",
        paymentHistoryDesc: "আপনার সমস্ত সার্ভিস পেমেন্টের ইতিহাস।",
        dateCol: "তারিখ",
        detailsCol: "বিবরণ",
        serviceCol: "সার্ভিস",
        amountCol: "পরিমাণ",
        statusCol: "অবস্থা",
        noPaymentHistory: "কোনো পেমেন্টের ইতিহাস পাওয়া যায়নি।",
        availableServicesTitle: "উপলব্ধ সার্ভিসসমূহ",
        availableServicesDesc: "আপনার প্রয়োজন অনুযায়ী একটি সার্ভিস বেছে নিন।",
        availServiceBtn: "সার্ভিস গ্রহণ করুন",
        noServicesAvailable: "এই মুহূর্তে কোনো সার্ভিস উপলব্ধ নেই।",
        submitPaymentTitle: "পেমেন্টের বিবরণ জমা দিন",
        submitPaymentDesc: (amount: number) => `আপনি ${formatAmount(amount, false)} টাকার একটি পেমেন্ট করছেন। অনুগ্রহ করে নিচের নির্দেশাবলী অনুসরণ করে পেমেন্ট করে বিবরণ জমা দিন।`,
        paymentInstructionsTitle: "পেমেন্টের নির্দেশাবলী",
        paymentRefLabel: "নিচের রেফারেন্স নম্বরটি কপি করে নিন",
        paymentRefDesc: "পেমেন্ট করার সময় এই রেফারেন্সটি ব্যবহার করুন",
        paymentPhoneLabel: "যে ফোন নম্বর থেকে পেমেন্ট করা হয়েছে",
        paymentTrxIdLabel: "লেনদেন আইডি (TrxID)",
        submitForVerificationBtn: "যাচাইয়ের জন্য জমা দিন",
        verifyingPaymentTitle: "আপনার পেমেন্ট যাচাই করা হচ্ছে...",
        verifyingPaymentDesc: "কিছু মুহূর্ত সময় লাগতে পারে। অনুগ্রহ করে অপেক্ষা করুন।",
        verificationSuccessTitle: "পেমেন্ট যাচাই এবং সার্ভিস সক্রিয় হয়েছে!",
        verificationSuccessDesc: "আপনার লেনদেন রেকর্ড করা হয়েছে।",
        verificationPendingTitle: "যাচাই অপেক্ষাধীন",
        verificationPendingDesc: "আপনার পেমেন্ট স্বয়ংক্রিয়ভাবে যাচাই করা যায়নি। এটি এখন অ্যাডমিন অনুমোদনের জন্য অপেক্ষাধীন। সহায়তার জন্য 01617590765 নম্বরে যোগাযোগ করুন।",
        closeBtn: "বন্ধ করুন",
        cancelBtn: "বাতিল",
        confirmRequestBtn: "অনুরোধ নিশ্চিত করুন",
        transactionHistoryTitle: "লেনদেনের ইতিহাস",
        fromLabel: "থেকে",
        toLabel: "পর্যন্ত",
        openingBalance: "প্রারম্ভিক ব্যালেন্স",
        debitCol: "খরচ (আপনি পেয়েছেন)",
        creditCol: "জমা (আপনি দিয়েছেন)",
        balanceCol: "ব্যালেন্স",
        finalBalance: "চূড়ান্ত ব্যালেন্স",
        noTransactionsFound: "এই সময়ের জন্য কোনো লেনদেন পাওয়া যায়নি।",
        currentBalance: "বর্তমান ব্যালেন্স",
        language: "ভাষা",
        english: "English",
        bengali: "Bengali",
        enterAnyAmountTitle: (serviceName: string) => `"${serviceName}"-এর জন্য টাকার পরিমাণ লিখুন`,
        enterAnyAmountDescription: "আপনি কতটাকা পেমেন্ট করতে চান নিচে সেটি লিখুন ও নিচে পরবর্তী বাটনে ক্লিক করুন।",
        paymentAmountLabel: "পেমেন্টের পরিমাণ",
        paymentAmountPlaceholder: "টাকার পরিমাণ লিখুন",
        nextButton: "পরবর্তী",
        paymentMethod: "পদ্ধতি:",
        paymentNumber: "নাম্বার:",
        paymentType: "ধরণ:",
    }
};

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

function UserLedgerPageComponent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const invoiceRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const [party, setParty] = useState<Party | null>(null);
  const [parties, setParties] = useState<Party[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const initialView = searchParams.get('view') || 'ledger';
  const [activeView, setActiveView] = useState(initialView);
  
  const [filters, setFilters] = useState(() => {
    const today = new Date();
    const sevenDaysAgo = subDays(startOfDay(today), 6);
    return { 
        dateFrom: formatFns(sevenDaysAgo, 'yyyy-MM-dd'), 
        dateTo: formatFns(today, 'yyyy-MM-dd') 
    };
  });
  
  const [viewingInvoice, setViewingInvoice] = useState<Transaction | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<CustomerService | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [isAnyAmountDialogOpen, setIsAnyAmountDialogOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [language, setLanguage] = useState<'en' | 'bn'>('en');
  const { toast } = useToast();
  const t = translations[language];

  useEffect(() => {
    const savedLang = localStorage.getItem('userPortalLanguage') as 'en' | 'bn';
    if (savedLang) setLanguage(savedLang);

    const partyId = getCookie('loggedInPartyId');
    if (!partyId) {
      router.replace('/portal/login');
      return;
    }
    
    const unsubParty = subscribeToPartyById(partyId, (fetchedParty) => {
        if (fetchedParty) {
            setParty(fetchedParty);
            subscribeToTransactionsForParty(partyId, setTransactions, (err) => setError(err.message));
        } else {
            setError('Failed to load your profile.');
        }
        setLoading(false);
    }, console.error);
    
    const unsubAllTransactions = subscribeToAllTransactions(setAllTransactions, console.error);
    const unsubInventory = subscribeToInventoryItems(setInventory, console.error);
    const unsubAccounts = subscribeToAccounts(setAccounts, console.error);
    const unsubParties = subscribeToParties(setParties, console.error);
    getAppSettings().then(setAppSettings);

    return () => {
      unsubParty();
      unsubAllTransactions();
      unsubInventory();
      unsubAccounts();
      unsubParties();
    };
  }, [router]);

  const handleLanguageChange = (checked: boolean) => {
    const newLang = checked ? 'bn' : 'en';
    setLanguage(newLang);
    localStorage.setItem('userPortalLanguage', newLang);
  };

  const handleLogout = async () => {
    const partyId = getCookie('loggedInPartyId');
    if (partyId) await logActivity(partyId, 'logout');
    document.cookie = 'userType=; path=/; max-age=0';
    document.cookie = `loggedInPartyId=; path=/; max-age=0`;
    window.location.href = '/portal/login';
  };

  const { filteredTransactions, openingBalance, currentBalance } = useMemo(() => {
    if (!party) return { filteredTransactions: [], openingBalance: 0, currentBalance: 0 };

    const enabledTxs = transactions.filter(t => t.enabled);
    const actualTotalBalance = enabledTxs.reduce((sum, t) => sum + getPartyBalanceEffect(t, false), 0);

    let runningBalance = 0;
    const withBalance = [...enabledTxs].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .map(t => {
            runningBalance += getPartyBalanceEffect(t, false);
            return { ...t, runningBalance };
        });

    const filtered = withBalance.filter(t => {
        if (filters.dateFrom && t.date < filters.dateFrom) return false;
        if (filters.dateTo && t.date > filters.dateTo) return false;
        return true;
    }).reverse();

    const opening = withBalance.filter(t => filters.dateFrom && t.date < filters.dateFrom).pop()?.runningBalance || 0;

    return { filteredTransactions: filtered, openingBalance: opening, currentBalance: actualTotalBalance };
  }, [transactions, filters, party]);

  const handlePaymentSubmission = async (phone: string, trxId: string, txRef: string, amount: number): Promise<VerificationResult> => {
    const service = selectedService;
    const depositChannels = service?.depositChannels || [];
    const verificationResult = await attemptAutoVerification(txRef, trxId, depositChannels, amount);

    try {
        const txData: Omit<Transaction, 'id'> = {
            date: formatFns(new Date(), 'yyyy-MM-dd'),
            description: `Service: ${service?.name || 'Payment'} (Ref: ${txRef}, TrxID: ${trxId})`,
            amount: amount,
            type: service?.type || 'receive',
            partyId: party?.id,
            via: 'Personal',
            paymentStatus: verificationResult.isVerified ? 'approved' : 'pending',
            enabled: verificationResult.isVerified,
            serviceId: service?.id,
            txRef: txRef,
            accountId: verificationResult.accountId,
            verificationNote: `Paid from ${phone}.`
        };

        await addTransaction(txData);
        toast({ 
            title: verificationResult.isVerified ? t.verificationSuccessTitle : t.verificationPendingTitle,
            description: verificationResult.isVerified ? t.verificationSuccessDesc : t.verificationPendingDesc
        });
        setIsPaymentDialogOpen(false);
        return { success: true, isPending: !verificationResult.isVerified, isVerified: verificationResult.isVerified };
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
        return { success: false, isPending: false, isVerified: false };
    }
  };

  const navItems = [
    { view: 'ledger', icon: FileStack, label: t.myLedger },
    { view: 'payments', icon: WalletCards, label: t.payments },
    { view: 'service', icon: Wrench, label: t.service },
    { view: 'profile', icon: UserCog, label: t.myProfile },
  ];

  if (loading || !party) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin text-[#1A05A2]" /></div>;

  return (
    <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 min-h-screen">
        <InvoiceDialog
            isOpen={!!viewingInvoice}
            onOpenChange={(open) => !open && setViewingInvoice(null)}
            invoice={viewingInvoice}
            party={party}
            parties={parties}
            appSettings={appSettings}
            onPrint={() => window.print()}
            ref={invoiceRef}
            accounts={accounts}
            allTransactions={allTransactions}
        />

        <header className={cn("bg-gradient-to-r p-4 pt-8 rounded-b-3xl shadow-lg text-white sticky top-0 z-20", colors.gradient)}>
          <div className="container mx-auto flex items-center justify-between">
              <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/20"><Link href="/portal/user/dashboard"><ArrowLeft /></Link></Button>
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 border-2 border-white shadow-xl">
                    <AvatarImage src={party.imageUrl} />
                    <AvatarFallback className="bg-white/20 text-white font-bold">{party.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <h1 className="text-lg font-bold truncate max-w-[150px]">{party.name}</h1>
                  <p className="text-[10px] opacity-80">{party.phone}</p>
                </div>
              </div>
              <Button onClick={handleLogout} variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <LogOut className="h-5 w-5" />
              </Button>
          </div>
        </header>

        <main className="container mx-auto p-4 space-y-6 pb-24">
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeView}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                >
                    {activeView === 'ledger' && (
                        <div className="space-y-6">
                            <Card className="border-0 shadow-xl bg-white overflow-hidden rounded-2xl">
                                <CardHeader className={cn("bg-gradient-to-r p-6 text-white", colors.gradient)}>
                                    <div className="flex justify-between items-end">
                                        <div>
                                            <p className="text-xs opacity-80 uppercase tracking-widest">{t.currentBalance}</p>
                                            <h2 className="text-3xl font-bold mt-1">৳ {Math.abs(currentBalance).toLocaleString()}</h2>
                                        </div>
                                        <Badge className={cn("bg-white/20 text-white border-0", currentBalance < 0 ? 'bg-green-500' : 'bg-red-500')}>
                                            {currentBalance < 0 ? 'Receivable' : 'Payable'}
                                        </Badge>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-gray-400">{t.fromLabel}</Label>
                                            <Input type="date" value={filters.dateFrom} onChange={e => setFilters({...filters, dateFrom: e.target.value})} className="bg-gray-50 border-0 rounded-xl h-10" />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-bold text-gray-400">{t.toLabel}</Label>
                                            <Input type="date" value={filters.dateTo} onChange={e => setFilters({...filters, dateTo: e.target.value})} className="bg-gray-50 border-0 rounded-xl h-10" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="space-y-3">
                                {filteredTransactions.length > 0 ? filteredTransactions.map((tx, idx) => {
                                    const effect = getPartyBalanceEffect(tx, true);
                                    return (
                                        <motion.div
                                            key={tx.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                        >
                                            <Card className="border-0 shadow-sm hover:shadow-md transition-all rounded-2xl bg-white p-4">
                                                <div className="flex justify-between items-start gap-4">
                                                    <div className="flex-grow min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[10px] font-bold text-gray-400 uppercase">{formatDate(tx.date)}</span>
                                                            <Badge variant="outline" className="text-[8px] uppercase px-1.5 h-4">{tx.type.replace('_', ' ')}</Badge>
                                                        </div>
                                                        <p className="text-sm font-semibold text-gray-800 line-clamp-1">{tx.description}</p>
                                                        {tx.invoiceNumber && (
                                                            <Button variant="link" size="sm" className="h-auto p-0 text-[10px] text-[#1A05A2]" onClick={() => setViewingInvoice(tx)}>
                                                                <Eye className="h-3 w-3 mr-1" /> View Invoice
                                                            </Button>
                                                        )}
                                                    </div>
                                                    <div className="text-right flex-shrink-0">
                                                        <p className={cn("text-base font-bold", effect > 0 ? "text-green-600" : "text-red-600")}>
                                                            {effect > 0 ? '+' : '-'} ৳{Math.abs(effect).toLocaleString()}
                                                        </p>
                                                        <p className="text-[10px] text-gray-400 mt-0.5">Bal: ৳{tx.runningBalance.toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </Card>
                                        </motion.div>
                                    );
                                }) : (
                                    <div className="text-center py-12">
                                        <FileText className="h-12 w-12 mx-auto text-gray-200 mb-2" />
                                        <p className="text-sm text-gray-400">{t.noTransactionsFound}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeView === 'payments' && (
                        <div className="space-y-6">
                            <Card className="border-0 shadow-xl rounded-3xl overflow-hidden">
                                <CardHeader className={cn("bg-gradient-to-r p-6 text-white text-center", colors.gradient)}>
                                    <CardTitle className="text-xl flex items-center justify-center gap-2"><WalletCards /> Make a Payment</CardTitle>
                                    <CardDescription className="text-white/70">Securely recharge or pay your dues</CardDescription>
                                </CardHeader>
                                <CardContent className="p-6 grid gap-4">
                                    {(appSettings?.customerServices || []).filter(s => s.enabled && (s.type === 'receive' || s.type === 'give')).map(service => (
                                        <Button 
                                            key={service.id} 
                                            className={cn("h-14 rounded-2xl text-base font-bold bg-gradient-to-r shadow-lg hover:shadow-xl transition-all", colors.gradient)}
                                            onClick={() => {
                                                if (service.amountType === 'any') {
                                                    setSelectedService(service);
                                                    setIsAnyAmountDialogOpen(true);
                                                } else {
                                                    setPaymentAmount(service.price || 0);
                                                    setSelectedService(service);
                                                    setIsPaymentDialogOpen(true);
                                                }
                                            }}
                                        >
                                            {service.name}
                                        </Button>
                                    ))}
                                </CardContent>
                            </Card>

                            <Card className="border-0 shadow-lg rounded-2xl">
                                <CardHeader><CardTitle className="text-lg">{t.paymentHistoryTitle}</CardTitle></CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableHeader><TableRow className="bg-gray-50"><TableHead>{t.dateCol}</TableHead><TableHead>{t.detailsCol}</TableHead><TableHead className="text-right">{t.amountCol}</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {transactions.filter(t => t.serviceId).map(tx => (
                                                <TableRow key={tx.id}>
                                                    <TableCell className="text-[10px]">{formatDate(tx.date)}</TableCell>
                                                    <TableCell className="text-[10px] font-medium">{tx.description}</TableCell>
                                                    <TableCell className="text-right font-bold text-green-600">৳{tx.amount}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {activeView === 'service' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(appSettings?.customerServices || []).filter(s => s.enabled && s.type === 'sale').map((s, idx) => (
                                <motion.div key={s.id} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.1 }}>
                                    <Card className="border-0 shadow-xl rounded-3xl overflow-hidden group">
                                        <CardHeader className={cn("p-4 bg-gradient-to-br", colors.gradientLight)}>
                                            <div className="flex justify-between items-start">
                                                <div className="p-3 rounded-2xl bg-white shadow-md text-[#1A05A2]"><Package /></div>
                                                <Badge className={cn("bg-gradient-to-r text-white border-0", colors.gradient)}>{s.type}</Badge>
                                            </div>
                                            <CardTitle className="mt-4 text-xl font-bold text-[#1A05A2]">{s.name}</CardTitle>
                                            <CardDescription className="line-clamp-2">{s.description}</CardDescription>
                                        </CardHeader>
                                        <CardContent className="p-4 pt-6">
                                            <p className={`text-3xl font-black bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>
                                                ৳ {formatAmount(s.price || 0, false)}
                                            </p>
                                        </CardContent>
                                        <CardFooter className="p-4">
                                            <Button 
                                                className={cn("w-full rounded-2xl h-12 font-bold bg-gradient-to-r shadow-lg transition-all", colors.gradient)}
                                                onClick={() => {
                                                    setPaymentAmount(s.price || 0);
                                                    setSelectedService(s);
                                                    setIsPaymentDialogOpen(true);
                                                }}
                                            >
                                                {t.availServiceBtn}
                                            </Button>
                                        </CardFooter>
                                    </Card>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {activeView === 'profile' && <ProfileManagement party={party} lang={language} />}
                </motion.div>
            </AnimatePresence>
        </main>

        <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-30">
            <div className="container mx-auto grid grid-cols-4 h-16 items-center">
                {navItems.map(item => (
                     <button 
                        key={item.view} 
                        onClick={() => setActiveView(item.view)} 
                        className={cn(
                            "flex flex-col items-center gap-1 transition-all relative",
                            activeView === item.view ? "text-[#1A05A2]" : "text-gray-400 hover:text-gray-600"
                        )}
                    >
                        <item.icon className={cn("h-5 w-5", activeView === item.view && "scale-110")} />
                        <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
                        {activeView === item.view && (
                            <motion.div layoutId="nav-pill" className="absolute -top-3 h-1 w-8 bg-[#1A05A2] rounded-full" />
                        )}
                    </button>
                ))}
            </div>
        </footer>

        {/* Dialogs */}
        <Dialog open={isAnyAmountDialogOpen} onOpenChange={setIsAnyAmountDialogOpen}>
            <DialogContent className="rounded-3xl">
                <DialogHeader><DialogTitle className="text-xl font-bold text-[#1A05A2]">{t.enterAnyAmountTitle(selectedService?.name || '')}</DialogTitle></DialogHeader>
                <div className="py-6">
                    <Label className="text-xs uppercase font-bold text-gray-400 mb-2 block">{t.paymentAmountLabel}</Label>
                    <Input type="number" value={customAmount} onChange={e => setCustomAmount(e.target.value)} placeholder={t.paymentAmountPlaceholder} className="h-14 text-2xl font-bold bg-gray-50 border-0 rounded-2xl text-center" />
                </div>
                <DialogFooter className="flex gap-2">
                    <Button variant="ghost" className="rounded-xl flex-1" onClick={() => setIsAnyAmountDialogOpen(false)}>{t.cancelBtn}</Button>
                    <Button 
                        className={cn("rounded-xl flex-1 bg-gradient-to-r text-white", colors.gradient)}
                        onClick={() => {
                            const val = parseFloat(customAmount);
                            if (val > 0) { setPaymentAmount(val); setIsAnyAmountDialogOpen(false); setIsPaymentDialogOpen(true); setCustomAmount(''); }
                        }}
                    >
                        {t.nextButton}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>

        <PaymentDialog
            open={isPaymentDialogOpen}
            onOpenChange={setIsPaymentDialogOpen}
            paymentInstruction={appSettings?.businessProfiles?.[0]?.paymentInstruction}
            amount={paymentAmount}
            onConfirm={handlePaymentSubmission}
            lang={language}
            service={selectedService}
        />
    </div>
  );
}

const PaymentDialog = ({ open, onOpenChange, paymentInstruction, amount, onConfirm, lang, service }: any) => {
    const t = translations[lang as 'en' | 'bn'];
    const [phone, setPhone] = useState('');
    const [trxId, setTrxId] = useState('');
    const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'pending'>('idle');
    const [txRef] = useState(() => Math.floor(1000 + Math.random() * 9000).toString());

    const handleVerify = async () => {
        setStatus('checking');
        const res = await onConfirm(phone, trxId, txRef, amount);
        setStatus(res.isVerified ? 'success' : 'pending');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-3xl max-w-sm">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold text-[#1A05A2]">{service?.name || t.submitPaymentTitle}</DialogTitle>
                    <DialogDescription>{t.submitPaymentDesc(amount)}</DialogDescription>
                </DialogHeader>

                {status === 'idle' ? (
                    <div className="space-y-4 py-4">
                        <Card className="bg-blue-50 border-0 rounded-2xl p-4">
                            <p className="text-[10px] font-bold text-blue-400 uppercase mb-2">{t.paymentInstructionsTitle}</p>
                            <div className="space-y-1 text-sm font-medium text-blue-800">
                                <p>{t.paymentMethod} {paymentInstruction?.method}</p>
                                <p>{t.paymentNumber} {paymentInstruction?.number}</p>
                                <p>{t.paymentType} {paymentInstruction?.type}</p>
                            </div>
                        </Card>
                        <div className="bg-orange-50 border border-orange-100 p-4 rounded-2xl text-center">
                            <p className="text-[10px] font-bold text-orange-400 uppercase mb-1">{t.paymentRefLabel}</p>
                            <div className="flex items-center justify-center gap-2">
                                <span className="text-2xl font-black tracking-widest text-orange-600">{txRef}</span>
                                <CopyToClipboard textToCopy={txRef} />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <Input placeholder={t.paymentPhoneLabel} value={phone} onChange={e => setPhone(e.target.value)} className="h-12 rounded-xl bg-gray-50 border-0" />
                            <Input placeholder={t.paymentTrxIdLabel} value={trxId} onChange={e => setTrxId(e.target.value)} className="h-12 rounded-xl bg-gray-50 border-0 uppercase" />
                        </div>
                        <Button className={cn("w-full h-12 rounded-2xl bg-gradient-to-r font-bold shadow-lg", colors.gradient)} disabled={!phone || !trxId} onClick={handleVerify}>
                            {t.submitForVerificationBtn}
                        </Button>
                    </div>
                ) : (
                    <div className="py-12 text-center space-y-4">
                        {status === 'checking' && <Loader2 className="h-12 w-12 animate-spin mx-auto text-[#1A05A2]" />}
                        {status === 'success' && <CheckCircle2 className="h-16 w-16 mx-auto text-green-500" />}
                        {status === 'pending' && <History className="h-16 w-16 mx-auto text-orange-500" />}
                        <p className="font-bold text-lg">{status === 'checking' ? t.verifyingPaymentTitle : (status === 'success' ? t.verificationSuccessTitle : t.verificationPendingTitle)}</p>
                        <p className="text-sm text-gray-500">{status === 'checking' ? t.verifyingPaymentDesc : (status === 'success' ? t.verificationSuccessDesc : t.verificationPendingDesc)}</p>
                        <Button variant="outline" className="w-full rounded-xl" onClick={() => onOpenChange(false)}>{t.closeBtn}</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

const ProfileManagement = ({ party, lang }: { party: Party, lang: 'en' | 'bn' }) => {
    const t = translations[lang];
    const { toast } = useToast();
    const [newName, setNewName] = useState(party.name);
    const { register, handleSubmit, formState: { errors }, reset } = useForm<PasswordChangeValues>({ resolver: zodResolver(passwordChangeSchema) });

    const handlePass = async (data: PasswordChangeValues) => {
        try {
            await updatePartyPassword(party.id, data.currentPassword, data.newPassword);
            toast({ title: 'Success', description: 'Password updated.' });
            reset();
        } catch (e: any) { toast({ variant: 'destructive', title: 'Error', description: e.message }); }
    };

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className={cn("bg-gradient-to-r p-6 text-white text-center", colors.gradient)}>
                    <CardTitle className="text-xl flex items-center justify-center gap-2"><UserCog /> {t.profileTab}</CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs uppercase font-bold text-gray-400">{t.nameLabel}</Label>
                        <div className="flex gap-2">
                            <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-12 rounded-xl bg-gray-50 border-0" />
                            <Button 
                                className={cn("h-12 rounded-xl px-6 bg-gradient-to-r text-white", colors.gradient)}
                                disabled={newName === party.name || !!party.pendingNameChange}
                                onClick={() => requestNameChange(party.id, newName).then(() => toast({ title: 'Requested' }))}
                            >
                                {party.pendingNameChange ? t.requestPendingBtn : t.requestChangeBtn}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-0 shadow-xl rounded-3xl overflow-hidden">
                <CardHeader className="bg-gray-50 p-6 text-center border-b">
                    <CardTitle className="text-xl text-gray-800 flex items-center justify-center gap-2"><KeyRound /> {t.passwordTab}</CardTitle>
                </CardHeader>
                <form onSubmit={handleSubmit(handlePass)}>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-1">
                            <Label className="text-xs uppercase font-bold text-gray-400">{t.currentPasswordLabel}</Label>
                            <Input type="password" {...register('currentPassword')} className="h-12 rounded-xl bg-gray-50 border-0" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs uppercase font-bold text-gray-400">{t.newPasswordLabel}</Label>
                            <Input type="password" {...register('newPassword')} className="h-12 rounded-xl bg-gray-50 border-0" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs uppercase font-bold text-gray-400">{t.confirmNewPasswordLabel}</Label>
                            <Input type="password" {...register('confirmPassword')} className="h-12 rounded-xl bg-gray-50 border-0" />
                        </div>
                    </CardContent>
                    <CardFooter className="p-6 pt-0">
                        <Button type="submit" className={cn("w-full h-12 rounded-2xl bg-gradient-to-r font-bold shadow-lg", colors.gradient)}>
                            {t.updatePasswordBtn}
                        </Button>
                    </CardFooter>
                </form>
            </Card>
        </div>
    );
};

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});
type PasswordChangeValues = z.infer<typeof passwordChangeSchema>;

export default function Page() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-[#1A05A2]" /></div>}>
            <UserLedgerPageComponent />
        </Suspense>
    )
}
