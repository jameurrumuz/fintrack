'use client';

import React, { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { addTransaction, subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToInventoryItems, addInventoryItem } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { subscribeToParties } from '@/services/partyService';
import type { Party, Account, AppSettings, Transaction, InventoryItem, TransactionVia } from '@/types';
import { formatAmount, getPartyBalanceEffect } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

import {
  ArrowLeft,
  Save,
  Loader2,
  Package,
  Trash2,
  Plus,
  Wallet,
  Receipt,
  ArrowDownToLine,
  HandCoins,
  X
} from 'lucide-react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { format as formatFns } from 'date-fns';
import { Switch } from '@/components/ui/switch';

interface ReceivedItem {
    id: string;
    name: string;
    quantity: number;
    price: number;
    salePrice: number;
    wholesalePrice: number;
    category: string;
    isNew: boolean;
    location?: string;
    batchNumber?: string;
    expiryDate?: string;
    receiveDate?: string;
}

const receiveAsOptions = [
    { value: 'cash_bank', label: 'Payment', icon: Wallet, mobileLabel: 'Payment' },
    { value: 'credit_purchase', label: 'Credit Purchase', icon: Receipt, mobileLabel: 'Credit' },
    { value: 'cash_purchase', label: 'Cash Purchase', icon: Package, mobileLabel: 'Cash' },
    { value: 'income', label: 'Other Income', icon: ArrowDownToLine, mobileLabel: 'Income' },
    { value: 'credit_income', label: 'Credit Income', icon: HandCoins, mobileLabel: 'Cr Income' },
];

function ReceiveTransactionPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const partyId = searchParams.get('partyId') || '';
    const partyName = searchParams.get('partyName') || 'Unknown';
    
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
    const [parties, setParties] = useState<Party[]>([]);
    const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [receivedItems, setReceivedItems] = useState<ReceivedItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [windowWidth, setWindowWidth] = useState(0);

    const [amount, setAmount] = useState('');
    const [date, setDate] = useState<Date>(new Date());
    const [note, setNote] = useState('');
    const [via, setVia] = useState<TransactionVia>('Personal');

    const [receivedAs, setReceivedAs] = useState<'cash_bank' | 'credit_purchase' | 'cash_purchase' | 'income' | 'credit_income'>('cash_bank');
    const [accountId, setAccountId] = useState('');
    const [sendSmsOnSave, setSendSmsOnSave] = useState(true);

    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    // Track window width for responsive design
    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };
        
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    
    // Initialize data with error handling
    useEffect(() => {
        let isMounted = true;
        
        const initializeData = async () => {
            try {
                setIsLoading(true);
                
                const settings = await getAppSettings();
                if (isMounted) {
                    setAppSettings(settings);
                }
                
                const unsubAccounts = subscribeToAccounts(
                    (data) => { if (isMounted) setAccounts(data || []); },
                    (error) => { if (isMounted) toast({ variant: 'destructive', title: "Error", description: error?.message || "Failed to load accounts" }); }
                );
                
                const unsubInventory = subscribeToInventoryItems(
                    (data) => { if (isMounted) setInventoryItems(data || []); },
                    (error) => { if (isMounted) toast({ variant: 'destructive', title: "Error", description: error?.message || "Failed to load inventory" }); }
                );
                
                const unsubParties = subscribeToParties(
                    (data) => { if (isMounted) setParties(data || []); },
                    (error) => { if (isMounted) toast({ variant: 'destructive', title: "Error", description: error?.message || "Failed to load parties" }); }
                );
                
                const unsubTransactions = subscribeToAllTransactions(
                    (data) => { if (isMounted) setAllTransactions(data || []); },
                    (error) => { if (isMounted) toast({ variant: 'destructive', title: "Error", description: error?.message || "Failed to load transactions" }); }
                );
                
                return () => {
                    unsubAccounts();
                    unsubInventory();
                    unsubParties();
                    unsubTransactions();
                };
            } catch (error: any) {
                if (isMounted) {
                    toast({ variant: 'destructive', title: "Initialization Error", description: error?.message || "Failed to initialize data" });
                }
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };
        
        initializeData();
        
        return () => {
            isMounted = false;
        };
    }, [toast]);

    // Set default account with safety checks
    useEffect(() => {
        if (accounts && accounts.length > 0 && !accountId) {
            const cashAccount = accounts.find(a => a.name?.toLowerCase() === 'cash');
            if (cashAccount?.id) {
                setAccountId(cashAccount.id);
            } else if (accounts[0]?.id) {
                setAccountId(accounts[0].id);
            }
        }
    }, [accounts, accountId]);
    
    const currentPartyBalance = useMemo(() => {
        if (!partyId || !allTransactions || allTransactions.length === 0) return 0;
        return allTransactions
            .filter(t => t.partyId === partyId && t.enabled)
            .reduce((balance, tx) => balance + getPartyBalanceEffect(tx, false), 0);
    }, [allTransactions, partyId]);

    const partyBalanceText = useMemo(() => {
        const balance = currentPartyBalance || 0;
        if (balance > 0.01) return `Payable: ${formatAmount(balance)}`;
        if (balance < -0.01) return `Receivable: ${formatAmount(Math.abs(balance))}`;
        return 'Balance: 0.00';
    }, [currentPartyBalance]);

    useEffect(() => {
        if (partyId && parties && parties.length > 0) {
            const selectedParty = parties.find(p => p.id === partyId);
            if (selectedParty?.group) {
                setVia(selectedParty.group as TransactionVia);
            } else if (appSettings?.businessProfiles?.[0]?.name) {
                setVia(appSettings.businessProfiles[0].name as TransactionVia);
            }
        } else if (appSettings?.businessProfiles?.[0]?.name && !via) {
            setVia(appSettings.businessProfiles[0].name as TransactionVia);
        }
    }, [partyId, parties, appSettings, via]);

    const totalAmount = useMemo(() => {
        if ((receivedAs === 'credit_purchase' || receivedAs === 'cash_purchase') && receivedItems.length > 0) {
            return receivedItems.reduce((sum, item) => sum + ((item.price || 0) * (item.quantity || 0)), 0);
        }
        const parsedAmount = parseFloat(amount);
        return isNaN(parsedAmount) ? 0 : parsedAmount;
    }, [receivedItems, receivedAs, amount]);
    
    const handleAddItem = () => {
        const newItem: ReceivedItem = { 
            id: `new-${Date.now()}`, 
            name: '', 
            quantity: 1, 
            price: 0, 
            salePrice: 0, 
            wholesalePrice: 0, 
            category: appSettings?.inventoryCategories?.[0]?.name || 'Uncategorized', 
            isNew: true,
            location: appSettings?.inventoryLocations?.[0] || 'default',
            batchNumber: `B${Date.now()}`,
            receiveDate: formatFns(new Date(), 'yyyy-MM-dd'),
            expiryDate: '',
        };
        setReceivedItems([...receivedItems, newItem]);
    };
    
    const handleItemChange = (index: number, field: keyof ReceivedItem, value: any) => {
        if (index < 0 || index >= receivedItems.length) return;
        
        const newItems = [...receivedItems];
        const currentItem = newItems[index];

        if (field === 'id') {
            const selectedItem = inventoryItems.find(i => i.id === value);
            if (selectedItem) {
                newItems[index] = { 
                    ...currentItem, 
                    id: selectedItem.id, 
                    name: selectedItem.name || '', 
                    price: selectedItem.cost || 0,
                    salePrice: selectedItem.price || 0,
                    wholesalePrice: selectedItem.wholesalePrice || 0,
                    category: selectedItem.category || 'Uncategorized',
                    isNew: false,
                };
            }
        } else {
            (currentItem as any)[field] = value;
        }
        setReceivedItems(newItems);
    }

    const handleRemoveItem = (index: number) => {
        if (index < 0 || index >= receivedItems.length) return;
        setReceivedItems(receivedItems.filter((_, i) => i !== index));
    };

    const handleSave = async () => {
        if (totalAmount <= 0) {
            toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount or add items.' });
            return;
        }

        setIsSaving(true);
        try {
            let txType: Transaction['type'];
            let description = '';
            let txAccountId: string | undefined;
            let itemsToSave: Transaction['items'] | undefined = undefined;
            let txPartyId: string | undefined = partyId || undefined;

            switch(receivedAs) {
                case 'credit_purchase':
                case 'cash_purchase':
                    txType = receivedAs === 'cash_purchase' ? 'purchase' : 'credit_purchase';
                    description = note || `Goods received from ${partyName}.`;
                    if (receivedAs === 'cash_purchase') {
                        txAccountId = accountId;
                        if (!txAccountId) {
                            toast({ variant: 'destructive', title: 'Account Required', description: 'Please select an account for cash purchase.' });
                            setIsSaving(false);
                            return;
                        }
                    }
                    
                    if (receivedItems.length > 0) {
                        for (const item of receivedItems) {
                            if (item.isNew && item.name && item.name.trim()) {
                                const newItemData: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt'> = {
                                    name: item.name.trim(),
                                    sku: `AUTO-${Date.now()}-${Math.random()}`,
                                    category: item.category || 'Uncategorized',
                                    price: item.salePrice || 0,
                                    cost: item.price || 0,
                                    wholesalePrice: item.wholesalePrice || 0,
                                    quantity: 0,
                                    minStockLevel: 10,
                                };
                                const newItemId = await addInventoryItem(newItemData);
                                item.id = newItemId;
                            }
                        }
                        itemsToSave = receivedItems.map(item => ({
                            id: item.id,
                            name: item.name || 'Unknown',
                            quantity: item.quantity || 0,
                            price: item.price || 0,
                            cost: (item.price || 0) * (item.quantity || 0),
                            location: item.location,
                            batchNumber: item.batchNumber,
                            expiryDate: item.expiryDate,
                            receiveDate: item.receiveDate,
                        }));
                    }
                    break;
                
                case 'income':
                case 'credit_income':
                    txType = receivedAs;
                    description = note || `Income from ${partyName}`;
                    txAccountId = receivedAs === 'income' ? accountId : undefined;
                    txPartyId = partyId || undefined;
                    if (!txAccountId && txType === 'income') {
                        toast({ variant: 'destructive', title: 'Account Required', description: 'Please select an account for the income.' });
                        setIsSaving(false);
                        return;
                    }
                    break;
                    
                case 'cash_bank':
                default:
                    txType = 'receive';
                    description = note || `Payment received from ${partyName}.`;
                    txAccountId = accountId;
                    if (!txAccountId) {
                        toast({ variant: 'destructive', title: 'Account Required', description: 'Please select an account for the payment.' });
                        setIsSaving(false);
                        return;
                    }
                    break;
            }
            
            const transactionData: Omit<Transaction, 'id' | 'createdAt' | 'updatedAt'> = {
                date: formatFns(date, 'yyyy-MM-dd'),
                amount: totalAmount,
                type: txType,
                partyId: txPartyId,
                description: description || '',
                accountId: txAccountId,
                items: itemsToSave,
                via: via || 'Personal',
                enabled: true,
            };

            await addTransaction(transactionData);
            
            toast({ title: 'Success', description: 'Transaction saved successfully.' });
            router.push(partyId ? `/parties/${partyId}` : '/transactions');
        } catch (error: any) {
            console.error('Save error:', error);
            toast({ 
                variant: 'destructive', 
                title: 'Save Failed', 
                description: error?.message || 'An unexpected error occurred' 
            });
        } finally {
            setIsSaving(false);
        }
    };
    
    const selectedAccount = accounts?.find(acc => acc.id === accountId);
    
    const handleReceivedAsChange = useCallback((value: any) => {
        if (value) {
            setReceivedAs(value);
        }
    }, []);

    const isMobile = windowWidth < 768;
    const isTablet = windowWidth >= 768 && windowWidth < 1024;

    if (isLoading) {
        return (
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: '#f3f4f6'
            }}>
                <Loader2 className="h-8 w-8 md:h-12 md:w-12 animate-spin text-primary" />
                <p style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6b7280' }}>Loading...</p>
            </div>
        );
    }

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100vh',
            backgroundColor: '#f3f4f6',
            overflow: 'hidden',
            width: '100%',
            maxWidth: '100%',
            position: 'relative'
        }}>
            {/* Global styles */}
            <style jsx global>{`
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                html, body {
                    max-width: 100%;
                    overflow-x: hidden;
                    width: 100%;
                    position: relative;
                }
                #__next, #root, .app-container {
                    max-width: 100%;
                    overflow-x: hidden;
                }
                @media (max-width: 767px) {
                    .mobile-stack {
                        flex-direction: column;
                    }
                    .mobile-full-width {
                        width: 100%;
                    }
                }
            `}</style>

            {/* Fixed Header */}
            <header style={{
                backgroundColor: '#3b82f6',
                color: 'white',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
                zIndex: 10,
                flexShrink: 0,
                width: '100%'
            }}>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => router.back()} 
                    style={{ color: 'white', flexShrink: 0 }}
                    type="button"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div style={{
                    textAlign: 'center',
                    flex: 1,
                    minWidth: 0,
                    paddingLeft: '8px',
                    paddingRight: '8px',
                    overflow: 'hidden'
                }}>
                    <h1 style={{
                        fontSize: isMobile ? '14px' : '18px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>I Received From</h1>
                    <p style={{
                        fontSize: isMobile ? '12px' : '14px',
                        opacity: 0.9,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>{partyName || 'Unknown'}</p>
                    <p style={{
                        fontSize: isMobile ? '12px' : '14px',
                        fontWeight: '600',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}>
                        {partyBalanceText}
                    </p>
                </div>
                <div style={{ width: '40px', flexShrink: 0 }}/>
            </header>

            {/* Scrollable Content */}
            <main style={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'hidden',
                width: '100%',
                padding: isMobile ? '8px' : '12px'
            }}>
                <div style={{
                    maxWidth: '100%',
                    margin: '0 auto'
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px 0 rgba(0,0,0,0.1)',
                        width: '100%',
                        overflow: 'hidden'
                    }}>
                        <div style={{
                            padding: isMobile ? '12px' : '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: isMobile ? '12px' : '16px',
                            width: '100%'
                        }}>
                            {/* Receive As Selection */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                                <label style={{ fontSize: isMobile ? '12px' : '14px', fontWeight: '500' }}>Receive as</label>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(5, 1fr)',
                                    gap: '4px',
                                    backgroundColor: '#f3f4f6',
                                    padding: '4px',
                                    borderRadius: '8px',
                                    width: '100%'
                                }}>
                                    {receiveAsOptions.map(option => {
                                        const isDisabled = (option.value === 'credit_purchase' || option.value === 'cash_purchase' || option.value === 'credit_income') && !partyId;
                                        return (
                                            <button
                                                key={option.value}
                                                type="button"
                                                onClick={() => !isDisabled && setReceivedAs(option.value as any)}
                                                disabled={isDisabled}
                                                style={{
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '4px',
                                                    padding: isMobile ? '8px' : '12px',
                                                    fontSize: isMobile ? '10px' : '12px',
                                                    fontWeight: '500',
                                                    borderRadius: '6px',
                                                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                                                    opacity: isDisabled ? 0.5 : 1,
                                                    backgroundColor: receivedAs === option.value ? 'white' : 'transparent',
                                                    color: receivedAs === option.value ? '#3b82f6' : '#6b7280',
                                                    boxShadow: receivedAs === option.value ? '0 1px 2px 0 rgba(0,0,0,0.05)' : 'none',
                                                    transition: 'all 0.2s',
                                                    width: '100%'
                                }}>
                                                <option.icon className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
                                                <span style={{ display: isMobile ? 'none' : 'inline' }}>{option.label}</span>
                                                <span style={{ display: isMobile ? 'inline' : 'none', fontSize: '10px' }}>{option.mobileLabel}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* Date and Amount Row */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
                                gap: isMobile ? '8px' : '16px',
                                width: '100%'
                            }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                    <label style={{ fontSize: isMobile ? '12px' : '14px' }}>Date</label>
                                    <DatePicker value={date} onChange={(d) => d && setDate(d as Date)} />
                                </div>
                                {(receivedAs === 'cash_bank' || receivedAs === 'income' || receivedAs === 'credit_income') && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                        <label style={{ fontSize: isMobile ? '12px' : '14px' }}>Amount (৳)</label>
                                        <input
                                            type="number"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            placeholder="0.00"
                                            style={{
                                                height: isMobile ? '36px' : '40px',
                                                fontSize: isMobile ? '14px' : '16px',
                                                padding: '8px',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '6px',
                                                width: '100%'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>
                            
                            {/* Account and Business Profile Row */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: isMobile ? '1fr 1fr' : '1fr 1fr',
                                gap: isMobile ? '8px' : '16px',
                                width: '100%'
                            }}>
                                {(receivedAs === 'cash_bank' || receivedAs === 'income' || receivedAs === 'cash_purchase') && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                        <label style={{ fontSize: isMobile ? '12px' : '14px' }}>Account</label>
                                        <select
                                            value={accountId}
                                            onChange={(e) => setAccountId(e.target.value)}
                                            style={{
                                                height: isMobile ? '36px' : '40px',
                                                fontSize: isMobile ? '14px' : '16px',
                                                padding: '8px',
                                                border: '1px solid #e5e7eb',
                                                borderRadius: '6px',
                                                width: '100%'
                                            }}
                                        >
                                            <option value="">Select account...</option>
                                            {accounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>
                                                    {acc.name} ({formatAmount(acc.balance || 0)})
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                                    <label style={{ fontSize: isMobile ? '12px' : '14px' }}>Business Profile</label>
                                    <select
                                        value={via}
                                        onChange={(e) => setVia(e.target.value as TransactionVia)}
                                        style={{
                                            height: isMobile ? '36px' : '40px',
                                            fontSize: isMobile ? '14px' : '16px',
                                            padding: '8px',
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px',
                                            width: '100%'
                                        }}
                                    >
                                        {(appSettings?.businessProfiles || []).map(p => (
                                            <option key={p.name} value={p.name}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Items Section */}
                            {(receivedAs === 'credit_purchase' || receivedAs === 'cash_purchase') && (
                                <div style={{
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px',
                                    width: '100%'
                                }}>
                                    <div
                                        style={{
                                            padding: '12px',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center'
                                        }}
                                        onClick={() => {
                                            const content = document.getElementById('items-content');
                                            if (content) {
                                                content.style.display = content.style.display === 'none' ? 'block' : 'none';
                                            }
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <Package className={isMobile ? 'h-4 w-4' : 'h-5 w-5'} />
                                            <span>Received Items ({receivedItems.length})</span>
                                        </div>
                                        <ChevronDown className="h-4 w-4" />
                                    </div>
                                    <div id="items-content" style={{ padding: '12px', paddingTop: '8px', display: 'block' }}>
                                        <div style={{
                                            maxHeight: isMobile ? '400px' : '500px',
                                            overflowY: 'auto',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '12px'
                                        }}>
                                            {receivedItems.map((item, index) => (
                                                <div
                                                    key={index}
                                                    style={{
                                                        padding: '12px',
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '8px',
                                                        position: 'relative',
                                                        width: '100%'
                                                    }}
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(index)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '8px',
                                                            right: '8px',
                                                            padding: '4px'
                                                        }}
                                                    >
                                                        <X className="h-4 w-4" style={{ color: '#ef4444' }} />
                                                    </button>
                                                    
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <label style={{ fontSize: '12px' }}>Item</label>
                                                            <select
                                                                value={item.id}
                                                                onChange={(e) => handleItemChange(index, 'id', e.target.value)}
                                                                style={{
                                                                    height: '36px',
                                                                    fontSize: '14px',
                                                                    padding: '8px',
                                                                    border: '1px solid #e5e7eb',
                                                                    borderRadius: '6px',
                                                                    width: '100%'
                                                                }}
                                                            >
                                                                <option value="">Select existing item...</option>
                                                                {inventoryItems.map(invItem => (
                                                                    <option key={invItem.id} value={invItem.id}>{invItem.name}</option>
                                                                ))}
                                                            </select>
                                                            <input
                                                                value={item.name || ''}
                                                                onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                                                                placeholder="Or type new item name"
                                                                disabled={!item.isNew}
                                                                style={{
                                                                    height: '36px',
                                                                    fontSize: '14px',
                                                                    padding: '8px',
                                                                    border: '1px solid #e5e7eb',
                                                                    borderRadius: '6px',
                                                                    width: '100%',
                                                                    backgroundColor: !item.isNew ? '#f3f4f6' : 'white'
                                                                }}
                                                            />
                                                        </div>
                                                        
                                                        <div style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr 1fr',
                                                            gap: '8px',
                                                            width: '100%'
                                                        }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '12px' }}>Qty</label>
                                                                <input
                                                                    type="number"
                                                                    value={item.quantity}
                                                                    onChange={e => handleItemChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                                                    style={{
                                                                        height: '36px',
                                                                        fontSize: '14px',
                                                                        padding: '8px',
                                                                        border: '1px solid #e5e7eb',
                                                                        borderRadius: '6px',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '12px' }}>Cost Price</label>
                                                                <input
                                                                    type="number"
                                                                    value={item.price}
                                                                    onChange={e => handleItemChange(index, 'price', parseFloat(e.target.value) || 0)}
                                                                    style={{
                                                                        height: '36px',
                                                                        fontSize: '14px',
                                                                        padding: '8px',
                                                                        border: '1px solid #e5e7eb',
                                                                        borderRadius: '6px',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        
                                                        <div style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr 1fr',
                                                            gap: '8px',
                                                            width: '100%'
                                                        }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '12px' }}>Sale Price</label>
                                                                <input
                                                                    type="number"
                                                                    value={item.salePrice}
                                                                    onChange={e => handleItemChange(index, 'salePrice', parseFloat(e.target.value) || 0)}
                                                                    style={{
                                                                        height: '36px',
                                                                        fontSize: '14px',
                                                                        padding: '8px',
                                                                        border: '1px solid #e5e7eb',
                                                                        borderRadius: '6px',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '12px' }}>Wholesale</label>
                                                                <input
                                                                    type="number"
                                                                    value={item.wholesalePrice}
                                                                    onChange={e => handleItemChange(index, 'wholesalePrice', parseFloat(e.target.value) || 0)}
                                                                    style={{
                                                                        height: '36px',
                                                                        fontSize: '14px',
                                                                        padding: '8px',
                                                                        border: '1px solid #e5e7eb',
                                                                        borderRadius: '6px',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        
                                                        <div style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr 1fr',
                                                            gap: '8px',
                                                            width: '100%'
                                                        }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '12px' }}>Receive Date</label>
                                                                <input
                                                                    type="date"
                                                                    value={item.receiveDate || ''}
                                                                    onChange={e => handleItemChange(index, 'receiveDate', e.target.value)}
                                                                    style={{
                                                                        height: '36px',
                                                                        fontSize: '14px',
                                                                        padding: '8px',
                                                                        border: '1px solid #e5e7eb',
                                                                        borderRadius: '6px',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '12px' }}>Expiry Date</label>
                                                                <input
                                                                    type="date"
                                                                    value={item.expiryDate || ''}
                                                                    onChange={e => handleItemChange(index, 'expiryDate', e.target.value)}
                                                                    style={{
                                                                        height: '36px',
                                                                        fontSize: '14px',
                                                                        padding: '8px',
                                                                        border: '1px solid #e5e7eb',
                                                                        borderRadius: '6px',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                            </div>
                                                        </div>
                                                        
                                                        <div style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '1fr 1fr',
                                                            gap: '8px',
                                                            width: '100%'
                                                        }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '12px' }}>Batch No.</label>
                                                                <input
                                                                    value={item.batchNumber || ''}
                                                                    onChange={e => handleItemChange(index, 'batchNumber', e.target.value)}
                                                                    style={{
                                                                        height: '36px',
                                                                        fontSize: '14px',
                                                                        padding: '8px',
                                                                        border: '1px solid #e5e7eb',
                                                                        borderRadius: '6px',
                                                                        width: '100%'
                                                                    }}
                                                                />
                                                            </div>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                                <label style={{ fontSize: '12px' }}>Location</label>
                                                                <select
                                                                    value={item.location || 'default'}
                                                                    onChange={(e) => handleItemChange(index, 'location', e.target.value)}
                                                                    style={{
                                                                        height: '36px',
                                                                        fontSize: '14px',
                                                                        padding: '8px',
                                                                        border: '1px solid #e5e7eb',
                                                                        borderRadius: '6px',
                                                                        width: '100%'
                                                                    }}
                                                                >
                                                                    <option value="default">Default</option>
                                                                    {(appSettings?.inventoryLocations || []).map(loc => (
                                                                        <option key={loc} value={loc}>{loc}</option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            <button
                                                type="button"
                                                onClick={handleAddItem}
                                                style={{
                                                    width: '100%',
                                                    padding: '8px',
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: '6px',
                                                    backgroundColor: 'white',
                                                    marginTop: '8px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: '8px'
                                                }}
                                            >
                                                <Plus className="h-4 w-4" />
                                                Add Item
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                            
                            {/* Note Textarea */}
                            <textarea
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                placeholder="Add Note (Optional)"
                                rows={isMobile ? 2 : 3}
                                style={{
                                    padding: '8px',
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px',
                                    fontSize: isMobile ? '14px' : '16px',
                                    resize: 'none',
                                    width: '100%'
                                }}
                            />
                        </div>
                    </div>
                </div>
            </main>

            {/* Fixed Footer */}
            <footer style={{
                backgroundColor: 'white',
                borderTop: '1px solid #e5e7eb',
                padding: '12px',
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                zIndex: 10,
                flexShrink: 0,
                width: '100%'
            }}>
                <div style={{ textAlign: isMobile ? 'center' : 'left', width: isMobile ? '100%' : 'auto' }}>
                    <p style={{ fontSize: '12px', color: '#6b7280' }}>Total Amount</p>
                    <p style={{ fontSize: isMobile ? '20px' : '24px', fontWeight: 'bold', color: '#3b82f6' }}>
                        {formatAmount(totalAmount)}
                    </p>
                </div>
                
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: isMobile ? 'space-between' : 'flex-end',
                    gap: '12px',
                    width: isMobile ? '100%' : 'auto'
                }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        backgroundColor: '#f3f4f6',
                        padding: '4px 8px',
                        borderRadius: '6px'
                    }}>
                        <Switch
                            id="send-sms"
                            checked={sendSmsOnSave}
                            onCheckedChange={setSendSmsOnSave}
                        />
                        <label htmlFor="send-sms" style={{ fontSize: isMobile ? '12px' : '14px', cursor: 'pointer' }}>Send SMS</label>
                    </div>
                    
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        style={{
                            flex: isMobile ? 1 : 'none',
                            minWidth: isMobile ? 'auto' : '120px',
                            padding: '8px 16px',
                            backgroundColor: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px',
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.5 : 1
                        }}
                    >
                        {isSaving ? (
                            <Loader2 className="animate-spin h-4 w-4" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Save
                    </button>
                </div>
            </footer>
        </div>
    );
}

// Add ChevronDown icon component
const ChevronDown = ({ className }: { className?: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
);

export default function ReceiveTransactionPageWrapper() {
    return (
        <Suspense fallback={
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100vh',
                backgroundColor: '#f3f4f6'
            }}>
                <Loader2 className="h-8 w-8 md:h-12 md:w-12 animate-spin text-primary" />
            </div>
        }>
            <ReceiveTransactionPage />
        </Suspense>
    );
}