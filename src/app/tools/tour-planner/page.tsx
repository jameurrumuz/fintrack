
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, ArrowLeft, Users, UserPlus, HandCoins, Edit, MoreVertical, FilePlus, Share, Printer, FileText, PiggyBank, Scale, CircleDollarSign } from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';
import type { Tour, Friend, Deposit, Expense, Estimate, Party, Account, Transaction, InventoryItem, AppSettings } from '@/types';
import { subscribeToTours, addTour, updateTour, deleteTour } from '@/services/tourService';
import { addTransaction, deleteTransaction, deleteTransactionByDetails, updateTransaction, subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { DatePicker } from '@/components/ui/date-picker';
import { subscribeToParties, addParty } from '@/services/partyService'; // Import addParty
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { formatAmount, formatDate } from '@/lib/utils';
import { parseISO, format } from 'date-fns';
import html2canvas from 'html2canvas';
import {
    CircleDot,
    CheckCircle2,
    XCircle,
    Flag,
    Calendar,
    Phone,
    MessageSquare,
    Bell,
    Clock,
    User,
    Briefcase,
    ChevronsUpDown,
    Check as CheckIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import PartyTransactionEditDialog from '@/components/PartyTransactionEditDialog';


const FriendEditDialog = ({ friend, open, onOpenChange, onSave }: { friend: Friend | null, open: boolean, onOpenChange: (open: boolean) => void, onSave: (id: string, name: string, role: 'member' | 'manager') => void }) => {
    const [name, setName] = useState('');
    const [role, setRole] = useState<'member' | 'manager'>('member');

    useEffect(() => {
        if (friend) {
            setName(friend.name);
            setRole(friend.role || 'member');
        }
    }, [friend]);

    const handleSave = () => {
        if (friend) {
            onSave(friend.id, name, role);
        }
    };
    
    if (!friend) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Edit Friend</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>Role</Label>
                        <Select value={role} onValueChange={(v) => setRole(v as 'member' | 'manager')}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="member">General Member</SelectItem>
                                <SelectItem value="manager">Manager</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};


const TourPlannerPage = () => {
  const [tours, setTours] = useState<Tour[]>([]);
  const [selectedTourId, setSelectedTourId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]); // State for all parties
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendRole, setNewFriendRole] = useState<'member' | 'manager'>('member');
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedFriendForDeposit, setSelectedFriendForDeposit] = useState('');
  const [selectedAccountIdForDeposit, setSelectedAccountIdForDeposit] = useState('');
  const [depositDate, setDepositDate] = useState(new Date());

  const [giveAmount, setGiveAmount] = useState('');
  const [selectedFriendForGive, setSelectedFriendForGive] = useState('');
  const [selectedAccountIdForGive, setSelectedAccountIdForGive] = useState('');
  const [giveDate, setGiveDate] = useState(new Date());
  
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [newTourName, setNewTourName] = useState('');
  const [isNewTourDialogOpen, setIsNewTourDialogOpen] = useState(false);
  
  const [estimateDescription, setEstimateDescription] = useState('');
  const [estimateAmount, setEstimateAmount] = useState('');
  const [editingEstimate, setEditingEstimate] = useState<Estimate | null>(null);
  const [isEstimateDialogOpen, setIsEstimateDialogOpen] = useState(false);
  const [editingDeposit, setEditingDeposit] = useState<Deposit | null>(null);
  const [editingFriend, setEditingFriend] = useState<Friend | null>(null);


  const summaryRef = useRef(null);
  const expensesRef = useRef(null);
  const { toast } = useToast();
  
  useEffect(() => {
    const unsub = subscribeToTours(
      (loadedTours) => {
        setTours(loadedTours);
        if (loadedTours.length > 0 && !selectedTourId) {
            const lastSelected = localStorage.getItem('selectedTourId');
            const tourToSelect = loadedTours.find(t => t.id === lastSelected) || loadedTours[0];
            if (tourToSelect) {
                setSelectedTourId(tourToSelect.id);
            }
        }
        setLoading(false);
      },
      (error) => {
        toast({ variant: 'destructive', title: 'Error loading tours', description: error.message });
        setLoading(false);
      }
    );
     const unsubAccounts = subscribeToAccounts(setAccounts, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
     const unsubParties = subscribeToParties(setParties, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
     const unsubTransactions = subscribeToAllTransactions(setTransactions, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));

    
    return () => {
        unsub();
        unsubAccounts();
        unsubParties();
        unsubTransactions();
    };
  }, [toast, selectedTourId]);
  
  useEffect(() => {
    if (selectedTourId) {
      localStorage.setItem('selectedTourId', selectedTourId);
    }
  }, [selectedTourId]);

  const currentTour = useMemo(() => tours.find(t => t.id === selectedTourId), [tours, selectedTourId]);
  
  const allMembers = useMemo(() => {
      if (!currentTour) return [];
      const manager = currentTour.friends.find(f => f.role === 'manager');
      const members = currentTour.friends.filter(f => f.role !== 'manager');
      return manager ? [manager, ...members] : members;
  }, [currentTour]);


  const updateCurrentTour = async (updates: Partial<Tour>) => {
    if (!selectedTourId) return;
    try {
      await updateTour(selectedTourId, updates);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    }
  };
  
  const handleSelectTour = (id: string | null) => {
      setSelectedTourId(id);
  };

  const handleAddFriend = async () => {
    if (newFriendName.trim() === '') {
        toast({ variant: 'destructive', title: 'Friend name cannot be empty.' });
        return;
    }
    
    if (newFriendRole === 'manager' && (currentTour?.friends || []).some(f => f.role === 'manager')) {
        toast({ variant: 'destructive', title: 'Manager already exists', description: 'Only one manager is allowed per tour.' });
        return;
    }

    const trimmedName = newFriendName.trim();
    let existingParty = parties.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
    let friendId;

    if (!existingParty) {
        try {
            const newPartyId = await addParty({ name: trimmedName, partyType: 'Friend' });
            friendId = newPartyId;
            const newPartyForList = { id: newPartyId, name: trimmedName, partyType: 'Friend' } as Party;
            setParties(prev => [...prev, newPartyForList]);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to create party', description: error.message });
            return;
        }
    } else {
        friendId = existingParty.id;
    }

    const newFriend: Friend = { id: friendId, name: trimmedName, role: newFriendRole };
    const updatedFriends = [...(currentTour?.friends || [])];

    if (!updatedFriends.some(f => f.id === newFriend.id)) {
        updatedFriends.push(newFriend);
    }

    await updateCurrentTour({ friends: updatedFriends });
    setNewFriendName('');
};
  
  const handleRemoveFriend = async (id: string) => {
    const updatedFriends = (currentTour?.friends || []).filter(f => f.id !== id);
    const depositsToDelete = (currentTour?.deposits || []).filter(d => d.friendId === id);
    const updatedDeposits = (currentTour?.deposits || []).filter(d => d.friendId !== id);
    
    for (const deposit of depositsToDelete) {
        if (deposit.transactionId) {
            try {
                await deleteTransaction(deposit.transactionId);
            } catch (error: any) {
                 toast({ variant: 'destructive', title: 'Failed to delete transaction', description: error.message });
            }
        }
    }

    const updatedExpenses = (currentTour?.expenses || []).filter(e => e.paidById !== id);
    
    await updateCurrentTour({ friends: updatedFriends, deposits: updatedDeposits, expenses: updatedExpenses });
}

  const handleUpdateFriend = async (id: string, name: string, role: 'member' | 'manager') => {
    const updatedFriends = (currentTour?.friends || []).map(f => {
        // If setting a new manager, demote the old one
        if (role === 'manager' && f.role === 'manager' && f.id !== id) {
            return { ...f, role: 'member' };
        }
        if (f.id === id) {
            return { ...f, name, role };
        }
        return f;
    });
    
    await updateCurrentTour({ friends: updatedFriends });
    setEditingFriend(null);
  };

  const handleAddDeposit = async () => {
    const amount = parseFloat(depositAmount);
    if (!selectedFriendForDeposit || isNaN(amount) || amount <= 0 || !selectedAccountIdForDeposit) {
      toast({ variant: 'destructive', title: 'Please select a friend, account, and enter a valid amount.' });
      return;
    }

    let txId = '';
    if (currentTour?.partyId) {
        const friendName = (currentTour.friends || []).find(f => f.id === selectedFriendForDeposit)?.name || 'Unknown Friend';
        const newTx = await addTransaction({
            date: depositDate.toISOString().split('T')[0],
            amount,
            type: 'receive',
            description: `Tour deposit from ${friendName}`,
            partyId: currentTour.partyId,
            accountId: selectedAccountIdForDeposit,
            enabled: true,
            via: 'Personal'
        });
        txId = newTx;
    }

    const newDeposit: Deposit = { 
        id: `deposit-${Date.now()}`, 
        friendId: selectedFriendForDeposit, 
        amount, 
        createdAt: depositDate.toISOString(),
        accountId: selectedAccountIdForDeposit,
        transactionId: txId
    };

    const updatedDeposits = [...(currentTour?.deposits || []), newDeposit];
    await updateCurrentTour({ deposits: updatedDeposits });

    setDepositAmount('');
    setSelectedFriendForDeposit('');
    setSelectedAccountIdForDeposit('');
  };

  const handleGiveAmount = async () => {
    const amount = parseFloat(giveAmount);
    if (!selectedFriendForGive || isNaN(amount) || amount <= 0 || !selectedAccountIdForGive) {
        toast({ variant: 'destructive', title: 'Please select a friend, account, and enter a valid amount.' });
        return;
    }

    if (currentTour) {
        const friendName = (currentTour.friends || []).find(f => f.id === selectedFriendForGive)?.name || 'Unknown Friend';
        try {
            await addTransaction({
                date: giveDate.toISOString().split('T')[0],
                amount,
                type: 'give',
                description: `Given to ${friendName} for tour expenses`,
                partyId: currentTour.partyId, // Associate with the tour's partyId
                accountId: selectedAccountIdForGive,
                enabled: true,
                via: 'Personal',
            });
            
            toast({ title: 'Success', description: `Amount given to ${friendName} has been recorded.`});
            setGiveAmount('');
            setSelectedFriendForGive('');
            setSelectedAccountIdForGive('');
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Error', description: `Could not record transaction: ${error.message}` });
        }
    }
  };
  
const handleRemoveDeposit = async (id: string) => {
    const depositToDelete = currentTour?.deposits.find(d => d.id === id);
    if (!depositToDelete) return;

    if (depositToDelete.transactionId) {
        try {
            await deleteTransaction(depositToDelete.transactionId);
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Transaction Deletion Failed', description: `Could not delete linked transaction: ${error.message}` });
            return;
        }
    }

    const updatedDeposits = (currentTour?.deposits || []).filter(d => d.id !== id);
    await updateCurrentTour({ deposits: updatedDeposits });
    toast({ title: 'Success', description: 'Deposit and corresponding transaction deleted.' });
}
  
  const handleSaveDeposit = async (data: Deposit) => {
    const originalDeposit = currentTour?.deposits.find(d => d.id === data.id);
    if (!originalDeposit || !currentTour?.partyId) return;

    const updatedDeposits = (currentTour.deposits || []).map(d => d.id === data.id ? data : d);

    try {
        const newFriendName = (currentTour.friends || []).find(f => f.id === data.friendId)?.name || 'Unknown Friend';
        
        if (data.transactionId) {
            await updateTransaction(
                data.transactionId,
                {
                    date: data.createdAt.split('T')[0],
                    amount: data.amount,
                    accountId: data.accountId,
                    description: `Tour deposit from ${newFriendName}`,
                }
            );
        }

        await updateCurrentTour({ deposits: updatedDeposits });
        toast({ title: 'Success', description: 'Deposit and transaction updated.' });
    } catch(error: any) {
        toast({ variant: 'destructive', title: 'Update Failed', description: error.message });
    }
    
    setEditingDeposit(null);
  };


const handleSaveExpense = async (data: Partial<Expense & { accountId?: string }>) => {
    if (!currentTour) return;

    const currentFriends = [...(currentTour.friends || [])];
    const paidByFriend = currentFriends.find(f => f.id === data.paidById);
    const expenseDate = data.createdAt ? new Date(data.createdAt).toISOString() : new Date().toISOString();
    
    let txId: string | undefined = undefined;

    if (paidByFriend?.role === 'manager' && data.accountId && currentTour.partyId) {
        txId = await addTransaction({
            date: expenseDate.split('T')[0],
            amount: data.amount!,
            type: 'give', // Changed from spent to give to affect tour party ledger
            description: `Tour expense: ${data.description}`,
            partyId: currentTour.partyId, 
            accountId: data.accountId,
            enabled: true,
            via: 'Personal',
        });
    } else if (paidByFriend) {
        txId = await addTransaction({
            date: expenseDate.split('T')[0],
            amount: data.amount!,
            type: 'credit_give',
            description: `Tour expense covered by ${paidByFriend.name}: ${data.description}`,
            partyId: data.paidById, 
            enabled: true,
            via: 'Personal',
        });
    }

    const newExpense: Expense = {
        id: editingExpense ? editingExpense.id : `expense-${Date.now()}`,
        description: data.description!,
        amount: data.amount!,
        paidById: data.paidById!,
        paidFor: data.paidFor || ['all'],
        createdAt: expenseDate,
        transactionId: txId || editingExpense?.transactionId,
        accountId: data.accountId,
    };
    
    const updatedExpenses = editingExpense
        ? (currentTour.expenses || []).map(e => e.id === editingExpense.id ? newExpense : e)
        : [...(currentTour.expenses || []), newExpense];
    
    if (paidByFriend) {
         const newDeposit: Deposit = {
            id: `deposit-expense-${newExpense.id}-${Math.random().toString(36).substring(2, 9)}`,
            friendId: paidByFriend.id,
            amount: newExpense.amount,
            createdAt: newExpense.createdAt,
            transactionId: newExpense.transactionId,
            accountId: newExpense.accountId
        };
        const updatedDeposits = [...(currentTour.deposits || []), newDeposit];
        await updateCurrentTour({ expenses: updatedExpenses, deposits: updatedDeposits });
    } else {
        await updateCurrentTour({ expenses: updatedExpenses });
    }
    
    setIsExpenseDialogOpen(false);
    setEditingExpense(null);
};



  const handleRemoveExpense = async (id: string) => {
    const expenseToDelete = currentTour?.expenses.find(e => e.id === id);
    if (!expenseToDelete) return;
    
    const depositToDelete = currentTour?.deposits.find(d => d.id.includes(expenseToDelete.id));
    
    if (expenseToDelete.transactionId) {
        try {
            await deleteTransaction(expenseToDelete.transactionId);
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Failed to delete expense transaction', description: `Could not delete linked transaction: ${error.message}` });
             return;
        }
    }
    
    const updatedExpenses = (currentTour?.expenses || []).filter(e => e.id !== id);
    const updatedDeposits = depositToDelete ? (currentTour?.deposits || []).filter(d => d.id !== depositToDelete.id) : currentTour?.deposits;

    await updateCurrentTour({ expenses: updatedExpenses, deposits: updatedDeposits });
  }

    const handleAddEstimate = () => {
    const amount = parseFloat(estimateAmount);
    if (estimateDescription.trim() === '' || isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Please enter a valid description and amount.' });
      return;
    }
    const newEstimate: Estimate = { 
        id: `estimate-${Date.now()}`, 
        description: estimateDescription.trim(), 
        amount 
    };
    const updatedEstimates = [...(currentTour?.estimates || []), newEstimate];
    updateCurrentTour({ estimates: updatedEstimates });
    setEstimateDescription('');
    setEstimateAmount('');
  };

  const handleSaveEstimate = (data: Estimate) => {
    if (!editingEstimate) return;
    const updatedEstimates = (currentTour?.estimates || []).map(e => e.id === editingEstimate.id ? { ...e, ...data } : e);
    updateCurrentTour({ estimates: updatedEstimates });
    setIsEstimateDialogOpen(false);
    setEditingEstimate(null);
  };
  
  const handleRemoveEstimate = (id: string) => {
      const updatedEstimates = (currentTour?.estimates || []).filter(e => e.id !== id);
      updateCurrentTour({ estimates: updatedEstimates });
  }

  const handleAddNewTour = async () => {
      if (!newTourName.trim()) {
          toast({ variant: 'destructive', title: 'Tour name cannot be empty.' });
          return;
      }
      try {
          const newTourId = await addTour({
              name: newTourName.trim(),
              friends: [],
              deposits: [],
              expenses: [],
              estimates: [],
              managerBalance: 0,
          });
          setSelectedTourId(newTourId);
          setNewTourName('');
          setIsNewTourDialogOpen(false);
          toast({ title: 'Success!', description: `Tour "${newTourName.trim()}" has been created.` });
      } catch (error: any) {
           toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
  }
  
  const handleDeleteTour = async () => {
      if (!selectedTourId) return;
      try {
        await deleteTour(selectedTourId);
        toast({ title: 'Success', description: 'Tour deleted.' });
        setSelectedTourId(null);
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
  }
  
  const handleUpdateTransaction = async (data: Omit<Transaction, 'id' | 'enabled'>) => {
      if (!editingTransaction) return;
      try {
        await updateTransaction(editingTransaction.id, data);
        toast({ title: "Success", description: "Transaction updated successfully." });
        setEditingTransaction(null);
      } catch (error: any) {
        console.error("Failed to update transaction", error);
        toast({ variant: 'destructive', title: "Error", description: `Could not update transaction: ${error.message}` });
      }
  };


  const { balances, manager, tourSummary, givenAmounts } = useMemo(() => {
    if (!currentTour) return { balances: {}, manager: null, tourSummary: { totalMembers: 0, totalCollection: 0, totalExpenses: 0, totalEstimates: 0, perPersonCost: 0 }, givenAmounts: {} };
    
    const managerFriend = allMembers.find(f => f.role === 'manager');
    const totalMembers = allMembers.length;
    const totalCollection = (currentTour.deposits || []).reduce((sum, d) => sum + d.amount, 0);
    const totalExpenses = (currentTour.expenses || []).reduce((sum, e) => sum + e.amount, 0);
    const totalEstimates = (currentTour.estimates || []).reduce((sum, e) => sum + e.amount, 0);
    const perPersonCost = totalMembers > 0 ? totalExpenses / totalMembers : 0;
    
    const friendBalances: { [key: string]: number } = {};
    const localGivenAmounts: { [key: string]: number } = {};
    
    allMembers.forEach(f => {
      friendBalances[f.id] = 0;
      localGivenAmounts[f.id] = 0;
    });

    (currentTour.deposits || []).forEach(d => {
        friendBalances[d.friendId] = (friendBalances[d.friendId] || 0) + d.amount;
    });

    transactions.forEach(tx => {
        if (tx.partyId === currentTour.partyId && tx.type === 'give' && tx.description.includes('for tour expenses')) {
            const friendName = tx.description.replace('Given to ', '').replace(' for tour expenses', '');
            const friend = allMembers.find(f => f.name === friendName);
            if (friend) {
                localGivenAmounts[friend.id] = (localGivenAmounts[friend.id] || 0) + tx.amount;
            }
        }
    });
    
    allMembers.forEach(f => {
        friendBalances[f.id] -= perPersonCost;
        friendBalances[f.id] -= localGivenAmounts[f.id];
    });

    return { 
        balances: friendBalances, 
        manager: managerFriend || null,
        tourSummary: { totalMembers, totalCollection, totalExpenses, totalEstimates, perPersonCost },
        givenAmounts: localGivenAmounts
    };
  }, [currentTour, transactions, allMembers]);
  
  const finalSettlements = useMemo(() => {
    if (!currentTour) return [];
    let givers: { friendId: string, amount: number }[] = [];
    let takers: { friendId: string, amount: number }[] = [];

    Object.entries(balances).forEach(([friendId, balance]) => {
        if (balance > 0) takers.push({ friendId, amount: balance });
        else if (balance < 0) givers.push({ friendId, amount: Math.abs(balance) });
    });
    
    takers.sort((a,b) => b.amount - a.amount);
    givers.sort((a,b) => b.amount - a.amount);
    
    const settlements = [];
    
    while(givers.length > 0 && takers.length > 0) {
        const giver = givers[0];
        const taker = takers[0];
        const amount = Math.min(giver.amount, taker.amount);
        
        settlements.push({ from: giver.friendId, to: taker.friendId, amount });
        
        giver.amount -= amount;
        taker.amount -= amount;
        
        if(giver.amount < 0.01) givers.shift();
        if(taker.amount < 0.01) takers.shift();
    }

    return settlements;
  }, [currentTour, balances]);
  
    const shareViaWhatsApp = (ref: React.RefObject<HTMLDivElement>, title: string) => {
    const element = ref.current;
    if (element) {
      html2canvas(element, { scale: 2, useCORS: true }).then(canvas => {
        canvas.toBlob(blob => {
          if(blob) {
            const file = new File([blob], `${title.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              navigator.share({
                files: [file],
                title: title,
              });
            } else {
               toast({ variant: 'destructive', title: 'Share not supported on this browser.'});
            }
          }
        }, 'image/png');
      });
    }
  };


    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <Button variant="outline" asChild><Link href="/tools"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Tools</Link></Button>
            </div>
            
            <Dialog open={isNewTourDialogOpen} onOpenChange={setIsNewTourDialogOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Create New Tour</DialogTitle></DialogHeader>
                    <div className="py-4">
                        <Label>Tour Name</Label>
                        <Input value={newTourName} onChange={e => setNewTourName(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                        <Button onClick={handleAddNewTour}>Create</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <PartyTransactionEditDialog transaction={editingTransaction} onOpenChange={(open) => !open && setEditingTransaction(null)} onSave={handleUpdateTransaction} parties={parties} accounts={accounts} inventoryItems={[]} />

            {editingDeposit && <DepositEditDialog open={!!editingDeposit} onOpenChange={() => setEditingDeposit(null)} onSave={handleSaveDeposit} deposit={editingDeposit} friends={currentTour?.friends || []} accounts={accounts} />}
            {isEstimateDialogOpen && <EstimateFormDialog open={isEstimateDialogOpen} onOpenChange={setIsEstimateDialogOpen} onSave={handleSaveEstimate} estimate={editingEstimate} />}
            {isExpenseDialogOpen && <ExpenseFormDialog open={isExpenseDialogOpen} onOpenChange={() => { setIsExpenseDialogOpen(false); setEditingExpense(null); }} onSave={handleSaveExpense} expense={editingExpense} friends={currentTour?.friends || []} accounts={accounts} />}
            {editingFriend && <FriendEditDialog friend={editingFriend} open={!!editingFriend} onOpenChange={() => setEditingFriend(null)} onSave={handleUpdateFriend} />}


            <Card>
                <CardHeader className="flex-row items-center justify-between">
                     <div className="flex items-center gap-2">
                        <Select value={selectedTourId || ''} onValueChange={(value) => handleSelectTour(value)}>
                            <SelectTrigger className="w-[250px]"><SelectValue placeholder="Select a tour..." /></SelectTrigger>
                            <SelectContent>
                                {tours.map(tour => (
                                    <SelectItem key={tour.id} value={tour.id}>{tour.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" onClick={() => setIsNewTourDialogOpen(true)}><Plus className="h-4 w-4"/></Button>
                     </div>
                     {selectedTourId && (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="destructive" size="sm">Delete Tour</Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescriptionComponent>Are you sure you want to delete this tour and all its data?</AlertDialogDescriptionComponent></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleDeleteTour}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                     )}
                </CardHeader>
            </Card>
            
            {currentTour && (
                <>
                <Card>
                    <CardHeader><CardTitle>1. Tour Summary</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg"><p className="text-sm text-blue-600">Total Members</p><p className="font-bold text-2xl text-blue-700">{tourSummary.totalMembers}</p></div>
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg"><p className="text-sm text-green-600">Total Collection</p><p className="font-bold text-2xl text-green-700">{formatAmount(tourSummary.totalCollection)}</p></div>
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg"><p className="text-sm text-red-600">Total Expenses</p><p className="font-bold text-2xl text-red-700">{formatAmount(tourSummary.totalExpenses)}</p></div>
                        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"><p className="text-sm text-yellow-600">Estimated Cost</p><p className="font-bold text-2xl text-yellow-700">{formatAmount(tourSummary.totalEstimates)}</p></div>
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg"><p className="text-sm text-purple-600">Cost Per Person</p><p className="font-bold text-2xl text-purple-700">{formatAmount(tourSummary.perPersonCost)}</p></div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle className="flex items-center gap-2">2. Friends ({allMembers.length})</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex gap-2">
                             <Input placeholder="Friend's Name" value={newFriendName} onChange={e => setNewFriendName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddFriend()} />
                             <Select value={newFriendRole} onValueChange={(v) => setNewFriendRole(v as 'member' | 'manager')}>
                                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="member">General Member</SelectItem>
                                    <SelectItem value="manager">Manager</SelectItem>
                                </SelectContent>
                             </Select>
                             <Button onClick={handleAddFriend}>Add</Button>
                        </div>
                        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                           {allMembers.map((friend, index) => (
                                <div key={friend.id} className="bg-muted p-2 rounded-md flex justify-between items-center text-sm">
                                    <span className="flex items-center gap-2">{index + 1}. {friend.name} {friend.role === 'manager' && <Badge variant="secondary" className="ml-1">M</Badge>}</span>
                                    <div>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingFriend(friend)}><Edit className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFriend(friend.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </div>
                                </div>
                           ))}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>3. Record Transactions</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <h3 className="font-semibold">Add Deposit</h3>
                            <div className="space-y-2">
                                <Label>Friend</Label>
                                <Select value={selectedFriendForDeposit} onValueChange={setSelectedFriendForDeposit}>
                                    <SelectTrigger><SelectValue placeholder="Select Friend"/></SelectTrigger>
                                    <SelectContent>{(currentTour.friends || []).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input type="number" placeholder="Amount" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label>Account</Label>
                                <Select value={selectedAccountIdForDeposit} onValueChange={setSelectedAccountIdForDeposit}>
                                    <SelectTrigger><SelectValue placeholder="Select Account"/></SelectTrigger>
                                    <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Date</Label>
                                <DatePicker value={depositDate} onChange={(d) => setDepositDate(d || new Date())}/>
                            </div>
                            <Button onClick={handleAddDeposit} className="w-full">Add Deposit</Button>
                        </div>
                        <div className="space-y-4">
                            <h3 className="font-semibold">Give Amount to Member</h3>
                             <div className="space-y-2">
                                <Label>Friend</Label>
                                <Select value={selectedFriendForGive} onValueChange={setSelectedFriendForGive}>
                                    <SelectTrigger><SelectValue placeholder="Select Friend"/></SelectTrigger>
                                    <SelectContent>{(currentTour.friends || []).map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Amount</Label>
                                <Input type="number" placeholder="Amount" value={giveAmount} onChange={e => setGiveAmount(e.target.value)} />
                            </div>
                             <div className="space-y-2">
                                <Label>Account</Label>
                                <Select value={selectedAccountIdForGive} onValueChange={setSelectedAccountIdForGive}>
                                    <SelectTrigger><SelectValue placeholder="Select Account"/></SelectTrigger>
                                    <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Date</Label>
                                <DatePicker value={giveDate} onChange={(d) => setGiveDate(d || new Date())}/>
                            </div>
                            <Button onClick={handleGiveAmount} className="w-full">Give Amount</Button>
                        </div>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-2">
                        <div className="mt-4 space-y-2 w-full">
                           <h4 className="font-medium">Deposit History</h4>
                           {[...(currentTour.deposits || [])].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((deposit, index) => (
                                <div key={`${deposit.id}-${index}`} className="flex justify-between items-center bg-muted p-2 rounded-md">
                                   <div className="text-sm">
                                       <span className="font-semibold">{index + 1}. {(currentTour.friends || []).find(f=>f.id === deposit.friendId)?.name || 'Unknown'}</span> deposited <span className="font-bold">{formatAmount(deposit.amount)}</span>
                                   </div>
                                   <div className="text-xs text-muted-foreground flex items-center gap-2">
                                       <span>{deposit.createdAt ? format(parseISO(deposit.createdAt), 'MMM dd, h:mm a') : 'N/A'}</span>
                                       <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingDeposit(deposit)}><Edit className="h-4 w-4"/></Button>
                                       <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveDeposit(deposit.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                   </div>
                               </div>
                           ))}
                        </div>
                         <div className="mt-4 space-y-2 w-full">
                           <h4 className="font-medium">Give History</h4>
                           {transactions.filter(tx => tx.partyId === currentTour.partyId && tx.type === 'give' && tx.description.includes('for tour expenses'))
                                .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                                .map((tx, index) => (
                               <div key={tx.id} className="flex justify-between items-center bg-muted p-2 rounded-md">
                                   <div className="text-sm">
                                       <span className="font-semibold">{index + 1}. {tx.description.replace('Given to ', '').replace(' for tour expenses', '')}</span> was given <span className="font-bold">{formatAmount(tx.amount)}</span>
                                   </div>
                                   <div className="text-xs text-muted-foreground flex items-center gap-2">
                                        <span>{formatDate(tx.date)}</span>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingTransaction(tx)}><Edit className="h-4 w-4"/></Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => deleteTransaction(tx.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                   </div>
                               </div>
                           ))}
                        </div>
                    </CardFooter>
                </Card>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                       <CardHeader className="flex-row justify-between items-center">
                            <CardTitle>4. Estimates</CardTitle>
                            <Button size="sm" onClick={() => { setEditingEstimate(null); setIsEstimateDialogOpen(true); }}><Plus className="mr-2 h-4 w-4"/>Add</Button>
                        </CardHeader>
                       <CardContent>
                          <Table>
                            <TableBody>
                                {(currentTour.estimates || []).map((est, index) => (
                                    <TableRow key={est.id}>
                                        <TableCell>{index + 1}. {est.description}</TableCell>
                                        <TableCell className="text-right">{formatAmount(est.amount)}</TableCell>
                                        <TableCell className="text-right">
                                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingEstimate(est); setIsEstimateDialogOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveEstimate(est.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                             <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Estimate</TableCell>
                                    <TableCell className="text-right font-bold">{formatAmount((currentTour.estimates || []).reduce((sum, e) => sum + e.amount, 0))}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                          </Table>
                       </CardContent>
                    </Card>

                    <Card>
                       <CardHeader className="flex-row justify-between items-center">
                            <CardTitle>5. Expenses</CardTitle>
                            <Button size="sm" onClick={() => { setEditingExpense(null); setIsExpenseDialogOpen(true);}}><Plus className="mr-2 h-4 w-4"/>Add</Button>
                        </CardHeader>
                       <CardContent>
                          <Table>
                             <TableBody>
                                {(currentTour.expenses || []).map((exp, index) => (
                                     <TableRow key={exp.id}>
                                        <TableCell>
                                            {index + 1}. {exp.description}
                                            <p className="text-xs text-muted-foreground">Paid by: {exp.paidById === 'manager' ? 'Manager' : (exp.paidById === 'credit' ? 'Credit' : (currentTour.friends || []).find(f=>f.id===exp.paidById)?.name)}</p>
                                        </TableCell>
                                        <TableCell className="text-right">{formatAmount(exp.amount)}</TableCell>
                                        <TableCell className="text-right">
                                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingExpense(exp); setIsExpenseDialogOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                             <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveExpense(exp.id)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                             </TableBody>
                             <TableFooter>
                                <TableRow>
                                    <TableCell className="font-bold">Total Expense</TableCell>
                                    <TableCell className="text-right font-bold">{formatAmount((currentTour.expenses || []).reduce((sum, e) => sum + e.amount, 0))}</TableCell>
                                    <TableCell></TableCell>
                                </TableRow>
                            </TableFooter>
                          </Table>
                       </CardContent>
                    </Card>
                </div>


                <div ref={summaryRef}>
                 <Card>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>6. Summary</CardTitle>
                         <Button variant="outline" size="sm" onClick={() => shareViaWhatsApp(summaryRef, "Tour Summary")}><Share className="mr-2 h-4 w-4" /> Share</Button>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Friend</TableHead><TableHead className="text-right">Deposited</TableHead><TableHead className="text-right">Less: Given</TableHead><TableHead className="text-right">Share of Expense</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {allMembers.map((friend, index) => {
                                    const totalDeposit = (currentTour.deposits || []).filter(d => d.friendId === friend.id).reduce((sum, d) => sum + d.amount, 0);
                                    const balance = balances[friend.id] || 0;
                                    const givenAmount = givenAmounts[friend.id] || 0;

                                    return (
                                        <TableRow key={friend.id}>
                                             <TableCell>{index + 1}.</TableCell>
                                            <TableCell>{friend.name} {friend.role === 'manager' && <Badge variant="secondary" className="ml-1">M</Badge>}</TableCell>
                                            <TableCell className="text-right">{formatAmount(totalDeposit)}</TableCell>
                                            <TableCell className="text-right text-orange-600">{formatAmount(givenAmount)}</TableCell>
                                            <TableCell className="text-right">{formatAmount(tourSummary.perPersonCost)}</TableCell>
                                            <TableCell className={cn("text-right font-bold", balance >= 0 ? 'text-green-600' : 'text-red-600')}>{formatAmount(balance)}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                            <TableFooter>
                                <TableRow>
                                    <TableCell colSpan={2} className="font-bold">Total</TableCell>
                                    <TableCell className="text-right font-bold">{formatAmount(tourSummary.totalCollection)}</TableCell>
                                    <TableCell className="text-right font-bold text-orange-600">{formatAmount(Object.values(givenAmounts).reduce((a, b) => a + b, 0))}</TableCell>
                                    <TableCell className="text-right font-bold">{formatAmount(tourSummary.totalExpenses)}</TableCell>
                                    <TableCell className="text-right font-bold">{formatAmount(Object.values(balances).reduce((acc, b) => acc + b, 0))}</TableCell>
                                </TableRow>
                            </TableFooter>
                        </Table>
                    </CardContent>
                </Card>
                </div>
                
                 <Card ref={expensesRef}>
                    <CardHeader className="flex-row items-center justify-between">
                        <CardTitle>7. Final Settlements</CardTitle>
                        <Button variant="outline" size="sm" onClick={() => shareViaWhatsApp(expensesRef, "Final Settlements")}><Share className="mr-2 h-4 w-4" /> Share</Button>
                    </CardHeader>
                    <CardContent>
                        {finalSettlements.length > 0 ? (
                            <ul className="space-y-2">
                                {finalSettlements.map((s,i) => (
                                    <li key={i} className="flex items-center justify-center gap-2 p-2 bg-muted rounded-md text-sm">
                                        <span className="font-semibold">{i + 1}. {(currentTour.friends || []).find(f=>f.id === s.from)?.name}</span>
                                        <span>will give</span>
                                        <span className="font-bold text-primary">{formatAmount(s.amount)}</span>
                                        <span>to</span>
                                        <span className="font-semibold">{(currentTour.friends || []).find(f=>f.id === s.to)?.name}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-center text-muted-foreground">All accounts are settled!</p>
                        )}
                    </CardContent>
                </Card>
                </>
            )}
        </div>
    );
};

const EstimateFormDialog = ({ open, onOpenChange, onSave, estimate }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (data: Partial<Estimate>) => void, estimate: Estimate | null }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');

    useEffect(() => {
        if (estimate) {
            setDescription(estimate.description);
            setAmount(String(estimate.amount));
        } else {
            setDescription('');
            setAmount('');
        }
    }, [estimate, open]);

    const handleSubmit = () => {
        const parsedAmount = parseFloat(amount);
        if (description.trim() && !isNaN(parsedAmount) && parsedAmount > 0) {
            onSave({ description, amount: parsedAmount });
        }
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{estimate ? 'Edit Estimate' : 'Add Estimate'}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Amount</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit}>Save</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

const ExpenseFormDialog = ({ open, onOpenChange, onSave, expense, friends, accounts }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (data: Partial<Expense & { accountId?: string }>) => void, expense: Expense | null, friends: Friend[], accounts: Account[] }) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [paidById, setPaidById] = useState('');
    const [paidFor, setPaidFor] = useState<string[]>(['all']);
    const [accountId, setAccountId] = useState('');
    const [expenseDate, setExpenseDate] = useState(new Date());

    const manager = useMemo(() => friends.find(f => f.role === 'manager'), [friends]);

    useEffect(() => {
        if (expense) {
            setDescription(expense.description);
            setAmount(String(expense.amount));
            setPaidById(expense.paidById);
            setPaidFor(expense.paidFor || ['all']);
            setAccountId(expense.accountId || '');
            setExpenseDate(new Date(expense.createdAt));
        } else {
            setDescription('');
            setAmount('');
            setPaidById(manager?.id || ''); // Default to manager if exists
            setPaidFor(['all']);
            setAccountId(accounts.find(a => a.name.toLowerCase() === 'cash')?.id || accounts[0]?.id || '');
            setExpenseDate(new Date());
        }
    }, [expense, open, accounts, manager]);

    const handleSubmit = () => {
        const parsedAmount = parseFloat(amount);
        if (description.trim() && !isNaN(parsedAmount) && parsedAmount > 0 && paidById) {
            onSave({ description, amount: parsedAmount, paidById, paidFor, accountId: accountId, createdAt: expenseDate.toISOString() });
        }
    };
    
    const handlePaidForChange = (id: string, checked: boolean) => {
        if (id === 'all') {
            setPaidFor(checked ? ['all'] : []);
        } else {
            let newPaidFor = paidFor.filter(fId => fId !== 'all');
            if (checked) {
                newPaidFor.push(id);
            } else {
                newPaidFor = newPaidFor.filter(fId => fId !== id);
            }
            setPaidFor(newPaidFor);
        }
    };
    
    const isManagerSelected = friends.some(f => f.id === paidById && f.role === 'manager');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{expense ? 'Edit Expense' : 'Add Expense'}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2"><Label>Date</Label><DatePicker value={expenseDate} onChange={(d) => setExpenseDate(d || new Date())}/></div>
                    <div className="space-y-2"><Label>Description</Label><Input value={description} onChange={e => setDescription(e.target.value)} /></div>
                    <div className="space-y-2"><Label>Amount</Label><Input type="number" value={amount} onChange={e => setAmount(e.target.value)} /></div>
                    <div className="space-y-2">
                        <Label>Paid By</Label>
                        <Select value={paidById} onValueChange={setPaidById}>
                            <SelectTrigger><SelectValue placeholder="Select who paid..."/></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="credit">On Credit (বাকিতে)</SelectItem>
                                {friends.map(f => <SelectItem key={f.id} value={f.id}>{f.name}{f.role === 'manager' ? ` (${f.role})` : ''}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                     {isManagerSelected && (
                        <div className="space-y-2">
                            <Label>From Account</Label>
                            <Select value={accountId} onValueChange={setAccountId}>
                                <SelectTrigger><SelectValue placeholder="Select account..."/></SelectTrigger>
                                <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                     )}
                    <div className="space-y-2">
                        <Label>Split For</Label>
                        <div className="space-y-2 max-h-48 overflow-y-auto p-2 border rounded-md">
                            <div className="flex items-center space-x-2">
                                <Checkbox id="paid-for-all" checked={paidFor.includes('all')} onCheckedChange={(checked) => handlePaidForChange('all', !!checked)} />
                                <Label htmlFor="paid-for-all">Everyone</Label>
                            </div>
                            {friends.map(f => (
                                <div key={f.id} className="flex items-center space-x-2">
                                    <Checkbox id={`paid-for-${f.id}`} checked={paidFor.includes(f.id) || paidFor.includes('all')} onCheckedChange={(checked) => handlePaidForChange(f.id, !!checked)} disabled={paidFor.includes('all')}/>
                                    <Label htmlFor={`paid-for-${f.id}`}>{f.name}</Label>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSubmit}>Save Expense</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

const DepositEditDialog = ({ open, onOpenChange, onSave, deposit, friends, accounts }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (data: Deposit) => void, deposit: Deposit | null, friends: Friend[], accounts: Account[] }) => {
    const [amount, setAmount] = useState('');
    const [friendId, setFriendId] = useState('');
    const [accountId, setAccountId] = useState('');
    const [depositDate, setDepositDate] = useState(new Date());

    useEffect(() => {
        if (deposit) {
            setAmount(String(deposit.amount));
            setFriendId(deposit.friendId);
            setAccountId(deposit.accountId || '');
            setDepositDate(new Date(deposit.createdAt));
        }
    }, [deposit, open]);

    const handleSave = () => {
        if (!deposit) return;
        const parsedAmount = parseFloat(amount);
        if (isNaN(parsedAmount) || parsedAmount <= 0 || !friendId || !accountId) {
            toast({ variant: 'destructive', title: 'Invalid data' });
            return;
        }
        onSave({
            ...deposit,
            amount: parsedAmount,
            friendId,
            accountId,
            createdAt: depositDate.toISOString(),
        });
    };
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Edit Deposit</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label>Date</Label>
                        <DatePicker value={depositDate} onChange={(d) => setDepositDate(d || new Date())} />
                    </div>
                    <div className="space-y-2">
                        <Label>Friend</Label>
                        <Select value={friendId} onValueChange={setFriendId}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                 {friends.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Account</Label>
                        <Select value={accountId} onValueChange={setAccountId}>
                            <SelectTrigger><SelectValue/></SelectTrigger>
                            <SelectContent>
                                 {accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Amount</Label>
                        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default TourPlannerPage;
