

'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogClose, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Save, Users, Loader2, ArrowLeft, Printer, Share2, ShoppingCart, User, Building, Phone, MapPin, ChevronsUpDown, Check, Calendar as CalendarIcon, Minus, ImageIcon, Camera, Upload, Truck, DollarSign, ScanLine, Pencil, Copy, Users2, CreditCard, Search, Package, Settings, X } from 'lucide-react';
import { subscribeToParties, addParty } from '@/services/partyService';
import { subscribeToInventoryItems, addInventoryItem } from '@/services/inventoryService';
import { addTransaction, subscribeToAllTransactions, handleSmsNotification } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import type { Party, InventoryItem, TransactionVia, Account, Payment, Transaction, AppSettings, InventoryCategory, Quotation } from '@/types';
import { formatAmount } from '@/lib/utils';
import InvoiceDialog from '@/components/pos/InvoiceDialog';
import { getAppSettings } from '@/services/settingsService';
import { uploadImage } from '@/services/storageService';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from 'date-fns';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { ItemFormDialog, StockAdjustmentDialog } from '@/components/inventory/InventoryManager';
import { PartyFormDialog } from '@/components/PartyManager';
import { DatePicker } from '@/components/ui/date-picker';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { writeBatch, doc, collection, serverTimestamp } from 'firebase/firestore';
import { getDb } from '@/lib/firebase';
import { cleanUndefined, getPartyBalanceEffect } from '@/lib/utils';
import { getQuotationById } from '@/services/quotationService';
import { motion, AnimatePresence } from 'framer-motion';
import { Switch } from '@/components/ui/switch';


interface CartItem extends InventoryItem {
  cartItemId: string; // Unique ID for the cart line item
  sellQuantity: number;
  sellPrice: number;
  itemProfit?: number;
  itemProfitPercentage?: number;
  itemDiscount?: number;
  location?: string;
}

type SaleType = 'cash' | 'credit';
type PricingTier = 'retail' | 'wholesale';

type SaleState = {
  billDate: Date;
  selectedPartyId: string;
  deliveryById: string;
  selectedVia: TransactionVia;
  cart: CartItem[];
  saleType: SaleType;
  payments: Payment[];
  discount: number;
  lastInvoice: Transaction | null;
  pricingTier: PricingTier;
  deliveryCharge: number;
  deliveryChargePaidBy: string;
  payDeliveryChargeNow: boolean;
  notes?: string;
  sendSmsOnSave: boolean;
};

type SaleTab = {
  id: string;
  name: string;
  state: SaleState;
};


const PartyCombobox = ({ parties, value, onChange, placeholder = "Select a customer..." }: { parties: Party[], value: string, onChange: (value: string, name?: string) => void, placeholder?: string }) => {
    const [open, setOpen] = useState(false);
    const selectedParty = parties.find(p => p.id === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {value && selectedParty ? selectedParty.name : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search..." />
                    <CommandList>
                        <CommandEmpty>Not found.</CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                key="unknown-person"
                                value="unknown"
                                onSelect={() => { onChange("", placeholder === "Select a customer..." ? 'Walk-in Customer' : 'Unknown Person'); setOpen(false); }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                                {placeholder === "Select a customer..." ? 'Walk-in Customer' : 'Unknown Person'}
                            </CommandItem>
                            {parties.map((party) => (
                                <CommandItem
                                    key={party.id}
                                    value={party.name}
                                    onSelect={() => {
                                        onChange(party.id, party.name);
                                        setOpen(false);
                                    }}
                                >
                                    <Check className={cn("mr-2 h-4 w-4", value === party.id ? "opacity-100" : "opacity-0")} />
                                    {party.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};

function PosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const partyIdFromQuery = searchParams.get('partyId');
  const quotationIdFromQuery = searchParams.get('quotationId');
  const { toast } = useToast();
  const invoiceRef = useRef<HTMLDivElement>(null);

  // Data states
  const [parties, setParties] = useState<Party[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);


  // Multi-tab state
  const [tabs, setTabs] = useState<SaleTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  
  // State for the animated tabs
  const [posTab, setPosTab] = useState('items');

  // Local UI states
  const [isSaving, setIsSaving] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [lastAddedItem, setLastAddedItem] = useState<CartItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isItemFormOpen, setIsItemFormOpen] = useState(false);
  const [isNewPartyDialogOpen, setIsNewPartyDialogOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<InventoryItem | null>(null);

  const updateActiveTabState = useCallback((newState: Partial<SaleState> | ((prevState: SaleState) => Partial<SaleState>)) => {
    setTabs(prevTabs => {
      const activeIndex = prevTabs.findIndex(tab => tab.id === activeTabId);
      if (activeIndex === -1) return prevTabs;

      const newTabs = [...prevTabs];
      const oldState = newTabs[activeIndex].state;
      const updatedFields = typeof newState === 'function' ? newState(oldState) : newState;
      newTabs[activeIndex] = {
        ...newTabs[activeIndex],
        state: { ...oldState, ...updatedFields }
      };
      return newTabs;
    });
  }, [activeTabId]);

  const createNewTab = useCallback((partyId = '', name = `Order ${tabs.length + 1}`): string => {
    const newTabId = `tab-${Date.now()}`;
    const defaultVia = appSettings?.businessProfiles?.[0]?.name as TransactionVia || 'Personal';
    
    const newTab: SaleTab = {
      id: newTabId,
      name,
      state: {
        billDate: new Date(),
        selectedPartyId: partyId,
        deliveryById: '',
        selectedVia: defaultVia,
        cart: [],
        saleType: 'cash',
        payments: [],
        discount: 0,
        lastInvoice: null,
        pricingTier: 'retail',
        deliveryCharge: 0,
        deliveryChargePaidBy: 'customer',
        payDeliveryChargeNow: false,
        notes: '',
        sendSmsOnSave: true,
      },
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTabId);
    return newTabId;
  }, [appSettings, tabs.length]);

  useEffect(() => {
    const savedTabs = localStorage.getItem('posTabs');
    if (savedTabs) {
        try {
            const parsedTabs: SaleTab[] = JSON.parse(savedTabs);
            // Convert string dates back to Date objects
            const restoredTabs = parsedTabs.map(tab => ({
                ...tab,
                state: {
                    ...tab.state,
                    billDate: new Date(tab.state.billDate),
                }
            }));
            setTabs(restoredTabs);
            if (restoredTabs.length > 0) {
                setActiveTabId(localStorage.getItem('posActiveTabId') || restoredTabs[0].id);
            }
        } catch (e) {
            console.error("Failed to parse saved POS state.", e);
            setTabs([]);
        }
    }
  }, []);

  useEffect(() => {
    if (tabs.length > 0) {
        localStorage.setItem('posTabs', JSON.stringify(tabs));
        localStorage.setItem('posActiveTabId', activeTabId);
    } else {
        localStorage.removeItem('posTabs');
        localStorage.removeItem('posActiveTabId');
    }
  }, [tabs, activeTabId]);
  
  const activeTabIndex = useMemo(() => tabs.findIndex(tab => tab.id === activeTabId), [tabs, activeTabId]);
  
  const activeTabState = useMemo(() => tabs[activeTabIndex]?.state, [tabs, activeTabIndex]);


  useEffect(() => {
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubInventory = subscribeToInventoryItems(setInventory, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubAccounts = subscribeToAccounts(setAccounts, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    
    getAppSettings().then(setAppSettings);
    setLoading(false);
    return () => {
      unsubParties();
      unsubInventory();
      unsubAccounts();
      unsubTransactions();
    };
  }, [toast]);
  
  useEffect(() => {
    if (tabs.length === 0 && !loading) {
      const partyFromQuery = parties.find(p => p.id === partyIdFromQuery);
      const name = partyFromQuery ? partyFromQuery.name : 'New Order';
      createNewTab(partyIdFromQuery || '', name);
    }
}, [loading, partyIdFromQuery, parties, createNewTab, tabs.length]);

  useEffect(() => {
    if (partyIdFromQuery && parties.length > 0 && activeTabIndex > -1) {
        const party = parties.find(p => p.id === partyIdFromQuery);
        if (party) {
            updateActiveTabState(prev => ({ 
                ...prev,
                selectedPartyId: partyIdFromQuery,
            }));
             setTabs(prevTabs => {
                const newTabs = [...prevTabs];
                if (newTabs[activeTabIndex]) {
                    newTabs[activeTabIndex].name = party.name;
                }
                return newTabs;
             });
        }
    }
}, [partyIdFromQuery, parties, activeTabIndex, updateActiveTabState]);

useEffect(() => {
    const loadQuotation = async () => {
      if (quotationIdFromQuery && inventory.length > 0 && activeTabIndex > -1 && (!activeTabState?.cart || activeTabState.cart.length === 0)) {
        const quote = await getQuotationById(quotationIdFromQuery);
        if (quote) {
          const cartItems: CartItem[] = quote.items.map(qItem => {
            const inventoryItem = inventory.find(i => i.id === qItem.id);
            return {
              ...inventoryItem!,
              cartItemId: `cart-${Date.now()}-${Math.random()}`,
              sellQuantity: qItem.quantity,
              sellPrice: qItem.price,
              location: inventoryItem?.location || appSettings?.inventoryLocations?.[0] || 'default',
            };
          });

          updateActiveTabState(prev => ({
              ...prev,
              cart: cartItems,
              selectedPartyId: quote.partyId || '',
              selectedVia: quote.via as TransactionVia || prev.selectedVia,
          }));
           
           setTabs(prevTabs => {
               const newTabs = [...prevTabs];
               if (newTabs[activeTabIndex]) {
                   newTabs[activeTabIndex].name = quote.partyName;
               }
               return newTabs;
           });
           
           router.replace('/pos', {scroll: false});
        }
      }
    };
    loadQuotation();
  }, [quotationIdFromQuery, inventory, activeTabIndex, appSettings, router, activeTabState?.cart, updateActiveTabState]);



  const filteredInventory = useMemo(() => {
    if (!searchQuery) return [];
    const lowercasedQuery = searchQuery.toLowerCase();
    return inventory.filter(item => 
        item.name.toLowerCase().includes(lowercasedQuery) ||
        (item.sku && item.sku.toLowerCase().includes(lowercasedQuery))
    );
  }, [searchQuery, inventory]);

  const deliveryPersonnel = useMemo(() => {
    return parties.filter(p => p.partyType === 'Delivery');
  }, [parties]);

  const derivedVia = useMemo(() => {
    if (!activeTabState) return appSettings?.businessProfiles?.[0]?.name as TransactionVia || 'Personal';
    
    const selectedParty = parties.find(p => p.id === activeTabState.selectedPartyId);
    if (selectedParty?.group) {
        return selectedParty.group as TransactionVia;
    }
    
    const firstItem = activeTabState.cart[0];
    const firstItemInventory = inventory.find(i => i.id === firstItem?.id);
    if (firstItemInventory?.via) {
      return firstItemInventory.via as TransactionVia;
    }
    
    return activeTabState.selectedVia || appSettings?.businessProfiles?.[0]?.name as TransactionVia || 'Personal';
  }, [activeTabState, parties, appSettings, inventory]);

  
  const updateCartPrices = useCallback((tier: PricingTier) => {
     updateActiveTabState(prev => ({
        ...prev,
        pricingTier: tier,
        cart: prev.cart.map(item => ({
            ...item,
            sellPrice: tier === 'wholesale' && item.wholesalePrice ? item.wholesalePrice : item.price,
        }))
    }));
  }, [updateActiveTabState]);

  useEffect(() => {
    if (activeTabState?.cart.length > 0) {
        updateCartPrices(activeTabState.pricingTier);
    }
  }, [activeTabState?.pricingTier, activeTabState?.cart.length, updateCartPrices]);
  
  useEffect(() => {
    if (lastAddedItem) {
        toast({ variant: 'destructive', title: 'Stock Limit Reached', description: `Cannot add more ${lastAddedItem.name} to the cart.` });
        setLastAddedItem(null); // Reset after showing toast
    }
  }, [lastAddedItem, toast]);


  const handleAddItemToCart = useCallback((item: InventoryItem) => {
    updateActiveTabState(prev => {
        const freshInventoryItem = inventory.find(i => i.id === item.id);
        if (!freshInventoryItem) {
            toast({ variant: 'destructive', title: 'Item not found', description: 'The selected item could not be found in the current inventory.' });
            return prev;
        }

        const { pricingTier, cart } = prev;
        const sellPrice = pricingTier === 'wholesale' && freshInventoryItem.wholesalePrice ? freshInventoryItem.wholesalePrice : freshInventoryItem.price;
        const defaultLocation = freshInventoryItem.via || appSettings?.inventoryLocations?.[0] || 'default';
        
        const itemProfile = appSettings?.businessProfiles.find(p => p.name === freshInventoryItem.via);
        let newVia = prev.selectedVia;
        if (itemProfile) {
            newVia = itemProfile.name as TransactionVia;
        }

        const existingItemIndex = cart.findIndex(cartItem => cartItem.id === freshInventoryItem.id && cartItem.location === defaultLocation);

        let newCart = [...cart];
        if (existingItemIndex > -1) {
            const existingItem = newCart[existingItemIndex];
            const stockInLocation = freshInventoryItem.stock?.[existingItem.location || 'default'] || 0;
            if (existingItem.sellQuantity < stockInLocation) {
                newCart[existingItemIndex] = { ...existingItem, sellQuantity: existingItem.sellQuantity + 1 };
            } else {
                 setTimeout(() => toast({ variant: 'destructive', title: 'Stock Limit Reached', description: `No more stock for ${freshInventoryItem.name} at this location.` }), 0);
            }
        } else {
            newCart.push({
                ...freshInventoryItem,
                cost: freshInventoryItem.cost, // Explicitly carry over cost
                cartItemId: `cart-${Date.now()}-${Math.random()}`,
                sellQuantity: 1,
                sellPrice,
                stock: freshInventoryItem.stock || {},
                location: defaultLocation
            });
        }
        return { cart: newCart, selectedVia: newVia };
    });
    setSearchQuery('');
}, [updateActiveTabState, appSettings, toast, inventory]);


  const handleCartItemChange = useCallback((cartItemId: string, field: 'sellQuantity' | 'sellPrice' | 'itemDiscount' | 'location', value: number | string) => {
     updateActiveTabState(prev => ({
        cart: prev.cart.map((item) => {
            if (item.cartItemId === cartItemId) {
                let newLocation = item.location;
                if (field === 'location' && typeof value === 'string') {
                    newLocation = value;
                }
                const stockInLocation = item.stock?.[newLocation || 'default'] || 0;
                if (field === 'sellQuantity' && typeof value === 'number') {
                    if (value > 0 && value <= stockInLocation) {
                        return { ...item, sellQuantity: value };
                    } else if (value > stockInLocation) {
                        toast({ variant: 'destructive', title: 'Stock Limit Exceeded', description: `Only ${stockInLocation} units of ${item.name} available in this location.` });
                    }
                } else if (field === 'sellPrice' && typeof value === 'number') {
                 if (value >= 0) {
                    return { ...item, sellPrice: value, cost: item.cost, wholesalePrice: item.wholesalePrice };
                }
            } else if (field === 'itemDiscount' && typeof value === 'number') {
                if (value >= 0) {
                    return { ...item, itemDiscount: value };
                }
            } else if (field === 'location' && typeof value === 'string') {
                 const newStock = item.stock?.[value] || 0;
                // Reset quantity if it exceeds new location's stock
                const newQuantity = item.sellQuantity > newStock ? newStock : 1;
                return { ...item, location: value, sellQuantity: newQuantity };
            }
            }
            return item;
        })
    }));
  }, [updateActiveTabState, toast]);
  
  const handleRemoveFromCart = useCallback((cartItemId: string) => {
      updateActiveTabState(prev => ({
          cart: prev.cart.filter(item => item.cartItemId !== cartItemId)
      }));
  }, [updateActiveTabState]);
  
  const handleAdjustQuantity = useCallback((cartItemId: string, amount: number) => {
    updateActiveTabState(prev => {
        const updatedCart = prev.cart.map(item => {
            if (item.cartItemId === cartItemId) {
                const newQuantity = item.sellQuantity + amount;
                const stockInLocation = item.stock?.[item.location || 'default'] || 0;
                if (newQuantity > 0 && newQuantity <= stockInLocation) {
                    return { ...item, sellQuantity: newQuantity };
                } else if (newQuantity > stockInLocation) {
                    toast({ variant: 'destructive', title: 'Stock Limit Exceeded', description: `Only ${stockInLocation} units of ${item.name} available.` });
                }
            }
            return item;
        }).filter(item => item.sellQuantity > 0);
        return { cart: updatedCart };
    });
  }, [updateActiveTabState, toast]);

  const cartWithProfit = useMemo(() => {
    if (!activeTabState) return [];
    return activeTabState.cart.map(item => {
      const itemTotal = parseFloat((item.sellPrice * item.sellQuantity).toFixed(2)) - (item.itemDiscount || 0);
      const itemCostTotal = (item.cost || 0) * item.sellQuantity;
      const itemProfit = itemTotal - itemCostTotal;
      const itemProfitPercentage = itemCostTotal > 0 ? (itemProfit / itemCostTotal) * 100 : 0;
      return { ...item, itemProfit, itemProfitPercentage };
    });
  }, [activeTabState]);

  const { subTotal, totalItems, netTotal, finalPayableAmount, paidAmount, dueAmount } = useMemo(() => {
    if (!activeTabState) return { subTotal: 0, totalItems: 0, netTotal: 0, finalPayableAmount: 0, paidAmount: 0, dueAmount: 0 };
    
    const { cart, discount, deliveryCharge, deliveryChargePaidBy, payments } = activeTabState;

    const currentCartWithProfit = cart.map(item => {
      const itemTotal = parseFloat((item.sellPrice * item.sellQuantity).toFixed(2)) - (item.itemDiscount || 0);
      const itemCostTotal = (item.cost || 0) * item.sellQuantity;
      const itemProfit = itemTotal - itemCostTotal;
      const itemProfitPercentage = itemCostTotal > 0 ? (itemProfit / itemCostTotal) * 100 : 0;
      return { ...item, itemProfit, itemProfitPercentage };
    });

    const subTotal = currentCartWithProfit.reduce((sum, item) => sum + parseFloat((item.sellPrice * item.sellQuantity).toFixed(2)), 0);
    const totalItems = currentCartWithProfit.reduce((sum, item) => sum + item.sellQuantity, 0);
    const totalItemDiscount = currentCartWithProfit.reduce((sum, item) => sum + (item.itemDiscount || 0), 0);
    const netTotal = subTotal - totalItemDiscount;
    const paidAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    const finalPayableAmount = parseFloat((netTotal - discount + (deliveryChargePaidBy === 'customer' ? deliveryCharge : 0)).toFixed(2));
    const dueAmount = parseFloat((finalPayableAmount - paidAmount).toFixed(2));

    return { subTotal, totalItems, netTotal, finalPayableAmount, paidAmount, dueAmount };
  }, [activeTabState]);

  const handleAddPayment = useCallback(() => {
    updateActiveTabState(prev => {
        const cashAccount = accounts.find(a => a.name.toLowerCase() === 'cash');
        const defaultAccountId = cashAccount?.id || (accounts[0]?.id || '');
        return {
            payments: [...(prev.payments || []), { accountId: defaultAccountId, amount: 0 }]
        };
    });
}, [accounts, updateActiveTabState]);



  const handlePaymentChange = useCallback((index: number, field: keyof Payment, value: string | number) => {
    updateActiveTabState(prev => ({
        payments: prev.payments.map((p, i) => i === index ? { ...p, [field]: value } : p)
    }));
  }, [updateActiveTabState]);


  const handleRemovePayment = useCallback((index: number) => {
      updateActiveTabState(prev => ({
          payments: prev.payments.filter((_, i) => i !== index)
      }));
  }, [updateActiveTabState]);

  const resetSale = useCallback((tabIdToReset: string) => {
    setTabs(prevTabs => {
        const indexToReset = prevTabs.findIndex(tab => tab.id === tabIdToReset);
        if (indexToReset === -1) return prevTabs;

        const newTabs = [...prevTabs];
        const defaultVia = appSettings?.businessProfiles?.[0]?.name as TransactionVia || 'Personal';
        newTabs[indexToReset].state = {
            billDate: new Date(),
            selectedPartyId: '',
            deliveryById: '',
            selectedVia: defaultVia,
            cart: [],
            saleType: 'cash',
            payments: [],
            discount: 0,
            lastInvoice: null,
            pricingTier: 'retail',
            deliveryCharge: 0,
            deliveryChargePaidBy: 'customer',
            payDeliveryChargeNow: false,
            notes: '',
            sendSmsOnSave: true,
        };
        newTabs[indexToReset].name = `Order ${indexToReset + 1}`;
        return newTabs;
    });
}, [appSettings]);


 const handleCompleteSale = async () => {
    if (!activeTabState) return;
    const { cart, selectedPartyId, billDate, deliveryById, deliveryCharge, deliveryChargePaidBy, payDeliveryChargeNow, discount, payments, notes, sendSmsOnSave } = activeTabState;

    if (cart.length === 0) {
      toast({ variant: 'destructive', title: 'Empty Cart', description: 'Your cart is empty.' });
      return;
    }
    if (dueAmount > 0 && !selectedPartyId) {
      toast({ variant: 'destructive', title: 'Customer Required', description: 'Please select a customer for a credit sale.' });
      return;
    }
  
    setIsSaving(true);
    const db = getDb();
    if (!db) {
      toast({ variant: 'destructive', title: 'Error', description: 'Database not initialized.' });
      setIsSaving(false);
      return;
    }
  
    const partyForTx = selectedPartyId || (parties.find(p => p.name.toLowerCase() === 'walk-in customer')?.id);
    const currentParty = parties.find(p => p.id === partyForTx);

    // Calculate previous due BEFORE this transaction happens
    const previousDue = transactions
            .filter(tx => tx.partyId === partyForTx && tx.enabled)
            .reduce((balance, tx) => balance + getPartyBalanceEffect(tx, false), 0);
    
    try {
      const batch = writeBatch(db);
      const saleDate = format(billDate, 'yyyy-MM-dd');
      
      const invoiceNumber = `INV-${Date.now()}`;
      
      const transactionItems = cartWithProfit.map(item => ({
        id: item.id, name: item.name, quantity: item.sellQuantity,
        price: item.sellPrice, cost: item.cost, location: item.location
      }));
      
      const saleDescription = notes ? `${notes} (Invoice: ${invoiceNumber})` : `Sale. Invoice: ${invoiceNumber}`;
      const totalItemDiscount = cartWithProfit.reduce((s, i) => s + (i.itemDiscount || 0), 0);
      const finalDiscount = discount + totalItemDiscount;

      const customerDeliveryCharge = deliveryChargePaidBy === 'customer' ? deliveryCharge : 0;
      const totalPayableByCustomer = subTotal - finalDiscount + customerDeliveryCharge;
      
      const txDataCreatedAt = serverTimestamp();

      let txData: Omit<Transaction, 'id'> = {
          date: saleDate,
          createdAt: txDataCreatedAt as any,
          via: derivedVia,
          items: transactionItems,
          invoiceNumber,
          amount: totalPayableByCustomer,
          partyId: partyForTx,
          description: saleDescription,
          type: (dueAmount > 0) ? 'credit_sale' : 'sale',
          payments: (dueAmount > 0) ? undefined : payments,
          deliveredBy: deliveryById || undefined,
          deliveryCharge: deliveryCharge,
          deliveryChargePaidBy,
          deliveryChargePaid: deliveryChargePaidBy === 'customer' ? false : payDeliveryChargeNow,
          discount: finalDiscount,
          enabled: true,
          sendSms: sendSmsOnSave,
      };

      const saleRef = doc(collection(db, 'transactions'));
      batch.set(saleRef, cleanUndefined(txData));
      
      if (dueAmount > 0 && paidAmount > 0) {
        for (const payment of payments) {
          const receiveTx: Omit<Transaction, 'id'> = {
            date: saleDate, 
            createdAt: new Date(Date.now() + 1).toISOString(), // Ensure this is after the sale
            via: derivedVia,
            description: `Part-payment for ${invoiceNumber}`, amount: payment.amount,
            type: 'receive', partyId: partyForTx, accountId: payment.accountId, enabled: true, sendSms: sendSmsOnSave,
          };
          const receiveRef = doc(collection(db, 'transactions'));
          batch.set(receiveRef, cleanUndefined(receiveTx));
        }
      }

      if (deliveryChargePaidBy !== 'customer' && payDeliveryChargeNow && deliveryById && deliveryCharge > 0) {
          const deliveryPaymentTx: Omit<Transaction, 'id'> = {
              date: saleDate, type: 'give',
              description: `Paid delivery charge to ${parties.find(p => p.id === deliveryById)?.name} for ${invoiceNumber}`,
              amount: deliveryCharge, partyId: deliveryById, via: derivedVia,
              accountId: payments[0]?.accountId || accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || accounts[0].id,
              enabled: true,
          };
          const deliveryPaymentRef = doc(collection(db, 'transactions'));
          batch.set(deliveryPaymentRef, cleanUndefined(deliveryPaymentTx));
      }

      await batch.commit();

      if (sendSmsOnSave && currentParty) {
        const savedTransaction: Transaction = {
            id: saleRef.id, 
            ...txData,
            createdAt: new Date().toISOString(), // Use client time for immediate calculation
            type: txData.type as any,
            amount: txData.amount as number,
            date: txData.date as string,
            partyId: partyForTx
        } as Transaction;

        handleSmsNotification(savedTransaction, currentParty, paidAmount, previousDue).catch(err => {
            console.error("SMS notification failed to send from POS:", err);
        });
      }
      
      toast({ title: 'Sale Completed', description: 'Transactions and inventory have been updated.' });
      resetSale(activeTabId);
      
      if (partyIdFromQuery) {
        router.push(`/parties/${partyIdFromQuery}`);
      } else {
        router.push('/transactions');
      }

    } catch (error: any) {
      console.error("Sale completion failed:", error);
      toast({ variant: 'destructive', title: 'Sale Failed', description: error.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveNewParty = async (data: any, item: Party | null, imageFile: File | null) => {
    setIsSaving(true);
    try {
        let imageUrl = item?.imageUrl || '';
        if (imageFile) {
            imageUrl = await uploadImage(imageFile, `party-images/${Date.now()}_${imageFile.name}`);
        }
        
        const finalData: Partial<Party> = { ...data, imageUrl, lastContacted: new Date().toISOString() };
        
        const newPartyId = await addParty(finalData as any);
        toast({ title: 'Success', description: 'Contact added successfully.' });
        updateActiveTabState({ selectedPartyId: newPartyId });
        setIsNewPartyDialogOpen(false);
    } catch (error: any) {
        console.error("Save error:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not save contact.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseTab = (tabId: string) => {
    setTabs(prevTabs => {
        if (prevTabs.length === 1) return prevTabs; // Don't close the last tab
        const newTabs = prevTabs.filter(tab => tab.id !== tabId);
        if (activeTabId === tabId) {
            setActiveTabId(newTabs[0]?.id || '');
        }
        return newTabs;
    });
  };

  if (!activeTabState) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  
  const { cart, billDate, deliveryCharge, deliveryChargePaidBy, payDeliveryChargeNow, saleType, payments, discount, lastInvoice, pricingTier, selectedPartyId, deliveryById, selectedVia, notes } = activeTabState;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-black flex flex-col">
      <header className="bg-primary text-primary-foreground p-2 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-1 overflow-x-auto">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="text-white hover:bg-white/10 shrink-0">
                <ArrowLeft />
            </Button>
            {tabs.map(tab => (
                <Button 
                  key={tab.id} 
                  variant={tab.id === activeTabId ? 'secondary' : 'ghost'}
                  className="h-auto px-3 py-1.5 text-sm shrink-0 flex items-center gap-1.5"
                  onClick={() => setActiveTabId(tab.id)}
                >
                  {tab.name}
                  <X className="h-4 w-4 text-muted-foreground" onClick={(e) => { e.stopPropagation(); handleCloseTab(tab.id); }}/>
                </Button>
            ))}
            <Button variant="ghost" size="icon" onClick={() => createNewTab()} className="text-white hover:bg-white/10 shrink-0">
                <Plus />
            </Button>
        </div>
        <div className="flex items-center gap-2 pr-2">
            <h1 className="text-lg font-semibold hidden sm:block">Sale</h1>
        </div>
      </header>
      
      <InvoiceDialog
        isOpen={isInvoiceDialogOpen}
        onOpenChange={setIsInvoiceDialogOpen}
        invoice={lastInvoice}
        party={parties.find(p => p.id === lastInvoice?.partyId)}
        parties={parties}
        appSettings={appSettings}
        onPrint={() => {}} // dummy onPrint
        ref={invoiceRef}
        accounts={accounts}
        allTransactions={transactions}
      />

       <ItemFormDialog 
        open={isItemFormOpen} 
        onOpenChange={setIsItemFormOpen} 
        onSave={() => {}} // This needs a proper save handler
        item={null} 
        categories={appSettings?.inventoryCategories || []} 
        parties={parties}
        appSettings={appSettings}
      />
      
      <PartyFormDialog 
        open={isNewPartyDialogOpen} 
        onOpenChange={setIsNewPartyDialogOpen} 
        onSave={handleSaveNewParty} 
        party={null}
        appSettings={appSettings}
        allParties={parties}
      />
       <StockAdjustmentDialog item={adjustingItem} open={!!adjustingItem} onOpenChange={() => setAdjustingItem(null)} appSettings={appSettings} />

      <main className="flex-grow overflow-y-auto">
        <Tabs defaultValue="items" className="w-full">
            <TabsList className="grid w-full grid-cols-3 rounded-none">
                <TabsTrigger value="items"><ShoppingCart className="mr-1 h-4 w-4"/>ITEMS</TabsTrigger>
                <TabsTrigger value="details"><Users2 className="mr-1 h-4 w-4"/>BILL DETAILS</TabsTrigger>
                <TabsTrigger value="payment"><CreditCard className="mr-1 h-4 w-4"/>PAYMENT</TabsTrigger>
            </TabsList>
            <TabsContent value="items" className="p-3 bg-white dark:bg-black">
                <div className="flex flex-col sm:flex-row items-center gap-2 mb-3">
                    <Select value={pricingTier} onValueChange={(v) => updateActiveTabState({ pricingTier: v as PricingTier })}>
                        <SelectTrigger className="w-full sm:w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="retail">Sale Price</SelectItem>
                            <SelectItem value="wholesale">Wholesale</SelectItem>
                        </SelectContent>
                    </Select>
                    <div className="relative flex-grow w-full">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"/>
                        <Input placeholder="Stock Code / Name" className="pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                    </div>
                     <Button variant="ghost" size="icon"><ScanLine/></Button>
                     <Button variant="ghost" size="sm" className="h-auto p-1" onClick={() => setIsItemFormOpen(true)}>
                         <Plus className="h-4 w-4 text-primary"/> <span className="text-primary text-xs">Create New Item</span>
                    </Button>
                </div>
                
                 {searchQuery && (
                    <div className="max-h-60 overflow-y-auto border rounded-md mb-3">
                        {filteredInventory.length > 0 ? (
                             filteredInventory.map(item => (
                                <div key={item.id} className="flex items-center justify-between p-2 border-b last:border-b-0 cursor-pointer hover:bg-muted" onClick={() => handleAddItemToCart(item)}>
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-8 w-8 rounded-md"><AvatarImage src={item.imageUrl} /><AvatarFallback className="rounded-md">{item.name.charAt(0)}</AvatarFallback></Avatar>
                                        <div>
                                            <p className="text-sm font-medium">{item.name}</p>
                                            <p className="text-xs text-muted-foreground">Stock: {item.quantity}</p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-mono">{formatAmount((pricingTier === 'wholesale' && item.wholesalePrice) ? item.wholesalePrice : (item.price || 0))}</p>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-sm text-muted-foreground p-4">No products found.</p>
                        )}
                    </div>
                 )}
                
                 <div className="space-y-3">
                    {cartWithProfit.map((item, index) => (
                         <Card key={item.cartItemId} className="overflow-hidden">
                            <CardContent className="p-3">
                                <div className="flex gap-3">
                                    <div className="flex-shrink-0">
                                        <p className="text-sm font-bold">{index + 1}.</p>
                                        <Avatar className="h-14 w-14 rounded-md mt-1">
                                            <AvatarImage src={item.imageUrl} alt={item.name} />
                                            <AvatarFallback className="rounded-md"><Package/></AvatarFallback>
                                        </Avatar>
                                    </div>
                                    <div className="flex-grow space-y-1">
                                         <div className="flex justify-between items-start">
                                            <h4 className="font-semibold leading-tight">{item.name}</h4>
                                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFromCart(item.cartItemId)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex gap-1">
                                                <Select value={item.location} onValueChange={(v) => handleCartItemChange(item.cartItemId, 'location', v)}>
                                                    <SelectTrigger className="h-8 text-xs">
                                                        <SelectValue placeholder="Select location..." />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {(appSettings?.inventoryLocations || ['default']).map(loc => (
                                                            <SelectItem key={loc} value={loc}>
                                                                {loc} (Stock: {item.stock?.[loc] || 0})
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                                <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => setAdjustingItem(item)}>Adjust Stock</Button>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1.5">
                                                <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={() => handleAdjustQuantity(item.cartItemId, -1)}><Minus className="h-4 w-4"/></Button>
                                                <Input type="number" value={item.sellQuantity} onFocus={(e) => e.target.select()} onChange={e => handleCartItemChange(item.cartItemId, 'sellQuantity', parseInt(e.target.value) || 1)} className="h-8 w-14 text-center" autoComplete="off"/>
                                                <Button size="icon" variant="outline" className="h-6 w-6 rounded-full" onClick={() => handleAdjustQuantity(item.cartItemId, 1)}><Plus className="h-4 w-4"/></Button>
                                            </div>
                                             <Input type="number" value={item.sellPrice} onFocus={(e) => e.target.select()} onChange={(e) => handleCartItemChange(item.cartItemId, 'sellPrice', parseFloat(e.target.value) || 0)} className="h-8 w-24 text-right font-semibold" autoComplete="off"/>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-2 border-t pt-2 space-y-2">
                                     <div className="flex items-center justify-between text-xs">
                                        <p>Sub Total ({item.sellQuantity} x {formatAmount(item.sellPrice)})</p>
                                        <p>{formatAmount(item.sellQuantity * item.sellPrice)}</p>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs">CP: {formatAmount(item.cost)}</p>
                                        <div className="flex items-center gap-1">
                                            <Label htmlFor={`discount-${item.cartItemId}`} className="text-xs">Discount</Label>
                                            <Input id={`discount-${item.cartItemId}`} type="number" className="h-7 w-20 text-right" placeholder="0.00" value={item.itemDiscount || ''} onFocus={(e) => e.target.select()} onChange={e => handleCartItemChange(item.cartItemId, 'itemDiscount', parseFloat(e.target.value) || 0)} autoComplete="off" />
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                            <CardFooter className="p-2 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs font-medium flex justify-between">
                                <span>Item Profit</span>
                                <span>{item.itemProfitPercentage?.toFixed(2)}% ({formatAmount(item.itemProfit || 0)})</span>
                            </CardFooter>
                         </Card>
                    ))}
                </div>
            </TabsContent>
            <TabsContent value="details" className="p-3">
                 <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Customer</Label>
                        <div className="flex gap-2">
                          <PartyCombobox parties={parties} value={selectedPartyId} onChange={(id) => {
                                updateActiveTabState({ selectedPartyId: id });
                                setTabs(prevTabs => {
                                    const newTabs = [...prevTabs];
                                    if (activeTabIndex > -1) {
                                        newTabs[activeTabIndex].name = parties.find(p => p.id === id)?.name || `Order ${activeTabIndex + 1}`;
                                    }
                                    return newTabs;
                                });
                            }} />
                          <Button type="button" variant="outline" onClick={() => setIsNewPartyDialogOpen(true)}>
                              New Customer
                          </Button>
                        </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Business Profile (Via)</Label>
                      <Select value={derivedVia} onValueChange={(v) => updateActiveTabState({ selectedVia: v as TransactionVia })}>
                          <SelectTrigger><SelectValue placeholder="Select profile..." /></SelectTrigger>
                          <SelectContent>
                              {(appSettings?.businessProfiles || []).map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Bill Date</Label>
                        <DatePicker mode="single" value={billDate} onChange={(d) => updateActiveTabState({ billDate: d as Date })} />
                    </div>
                     <div className="space-y-2">
                        <Label>Notes</Label>
                        <Textarea 
                            placeholder="Add a note for this sale..."
                            value={notes}
                            onChange={(e) => updateActiveTabState({ notes: e.target.value })}
                        />
                    </div>
                    <Card>
                        <CardHeader className="p-3"><CardTitle className="text-base flex items-center gap-2"><Truck/> Delivery Details</CardTitle></CardHeader>
                        <CardContent className="p-3 space-y-4">
                            <div className="space-y-2">
                                <Label>Delivered By</Label>
                                <PartyCombobox parties={deliveryPersonnel} value={deliveryById} onChange={(id) => updateActiveTabState({ deliveryById: id })} placeholder="Select delivery person..."/>
                            </div>
                            <div className="space-y-2">
                                <Label>Delivery Charge</Label>
                                <Input type="number" value={deliveryCharge} onChange={e => updateActiveTabState({ deliveryCharge: parseFloat(e.target.value) || 0 })} placeholder="0.00" onFocus={(e) => e.target.select()} autoComplete="off"/>
                            </div>
                            <div className="space-y-2">
                                <Label>Charge Paid By</Label>
                                 <RadioGroup
                                    value={deliveryChargePaidBy}
                                    onValueChange={(v) => updateActiveTabState({deliveryChargePaidBy: v})}
                                    className="flex gap-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="customer" id="paid-by-customer" />
                                        <Label htmlFor="paid-by-customer">Customer</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value={appSettings?.businessProfiles.find(p => p.name === selectedVia)?.name || 'institution'} id="paid-by-institution" />
                                        <Label htmlFor="paid-by-institution">{appSettings?.businessProfiles.find(p => p.name === selectedVia)?.name || 'Institution'}</Label>
                                    </div>
                                </RadioGroup>
                            </div>
                            {deliveryChargePaidBy !== 'customer' && deliveryCharge > 0 && (
                                <div className="flex items-center space-x-2">
                                    <Checkbox id="pay-delivery-now" checked={payDeliveryChargeNow} onCheckedChange={(checked) => updateActiveTabState({ payDeliveryChargeNow: !!checked })} />
                                    <Label htmlFor="pay-delivery-now">Pay charge to delivery person now?</Label>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                 </div>
            </TabsContent>
            <TabsContent value="payment" className="p-3">
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label>Sale Type</Label>
                        <Select value={saleType} onValueChange={(v) => updateActiveTabState({ saleType: v as SaleType })}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="cash">Cash/Bank Sale</SelectItem>
                                <SelectItem value="credit">Credit Sale</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    
                    <div>
                        <Label>Payment</Label>
                        {payments.map((payment, index) => (
                            <div key={index} className="flex items-end gap-2 mb-2">
                                <div className="flex-grow space-y-1">
                                    <Label className="text-xs">Payment Account</Label>
                                    <Select value={payment.accountId} onValueChange={(v) => handlePaymentChange(index, 'accountId', v)}>
                                        <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                                        <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-grow space-y-1">
                                    <Label className="text-xs">Amount</Label>
                                    <Input type="number" value={payment.amount} onFocus={(e) => e.target.select()} onChange={(e) => handlePaymentChange(index, 'amount', parseFloat(e.target.value) || 0)} autoComplete="off" />
                                </div>
                                <Button type="button" variant="destructive" size="icon" onClick={() => handleRemovePayment(index)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={handleAddPayment}>
                            <Plus className="mr-2 h-4 w-4"/> Add Payment
                        </Button>
                    </div>
                    
                    
                    <div className="space-y-2">
                        <Label>Overall Discount</Label>
                        <Input type="number" value={discount} onFocus={(e) => e.target.select()} onChange={e => updateActiveTabState({ discount: parseFloat(e.target.value) || 0 })} placeholder="0.00" autoComplete="off"/>
                    </div>
                    
                    <div className="p-4 border rounded-md space-y-2">
                        <div className="flex justify-between font-medium"><span>Sub Total</span><span>{formatAmount(netTotal)}</span></div>
                        <div className="flex justify-between"><span>Discount</span><span>-{formatAmount(discount)}</span></div>
                        <div className="flex justify-between"><span>Delivery Charge</span><span>+{formatAmount(deliveryChargePaidBy === 'customer' ? deliveryCharge : 0)}</span></div>
                        <Separator/>
                        <div className="flex justify-between font-bold text-lg"><span>Net Payable</span><span>{formatAmount(finalPayableAmount)}</span></div>
                        <div className="flex justify-between text-green-600 font-medium"><span>Paid</span><span>{formatAmount(paidAmount)}</span></div>
                        <div className="flex justify-between text-red-600 font-bold"><span>Due</span><span>{formatAmount(dueAmount)}</span></div>
                    </div>

                     <Button className="w-full" size="lg" onClick={handleCompleteSale} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin mr-2"/> : <Save className="mr-2"/>} Complete Sale
                    </Button>
                     <div className="flex items-center justify-center gap-4 pt-2">
                        <div className="flex items-center space-x-2">
                            <Switch id="send-sms" checked={activeTabState.sendSmsOnSave} onCheckedChange={(checked) => updateActiveTabState({ sendSmsOnSave: checked })} />
                            <Label htmlFor="send-sms">Send SMS</Label>
                        </div>
                    </div>

                </div>
            </TabsContent>
        </Tabs>
      </main>
      
      <footer className="sticky bottom-0 bg-background border-t shadow-md">
        <div className="p-3 space-y-1 text-sm">
            <div className="flex justify-between items-center">
                <p className="flex items-center gap-1"><ShoppingCart className="h-4 w-4"/> Items {cart.length} (Count {totalItems})</p>
                <p>Sub Total <span className="font-semibold">{formatAmount(subTotal)}</span></p>
            </div>
             <div className="flex justify-between items-center font-bold text-base">
                <p className="flex items-center gap-1"><User className="h-4 w-4"/> {parties.find(p => p.id === selectedPartyId)?.name || 'Walk-in Customer'}</p>
                <p>Net Total <span className="font-semibold">{formatAmount(netTotal - discount)}</span></p>
            </div>
        </div>
      </footer>
    </div>
  );
}

export default function PosPageWrapper() {
  return (
    <Suspense fallback={
        <div className="flex justify-center items-center h-screen">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    }>
        <PosPage />
    </Suspense>
  );
}
    
    

    

