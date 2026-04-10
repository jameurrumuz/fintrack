
'use client';

import { useState, useMemo, Suspense, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Search, Receipt, Loader2, MoreVertical, Edit, Trash2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { formatAmount } from '@/lib/utils';
import Link from 'next/link';
import { subscribeToAllTransactions, deleteTransaction } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { getAppSettings } from '@/services/settingsService';
import type { Transaction, Party, AppSettings } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";

const PurchaseReturnCard = ({ item, partyName, onEdit, onDelete }: { item: Transaction; partyName: string; onEdit: (id: string) => void; onDelete: (id: string) => void; }) => {
  const date = parseISO(item.date);
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 flex items-start gap-4">
        <div className="flex flex-col items-center justify-center w-16 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-300 p-2 rounded-lg">
          <span className="text-sm font-semibold uppercase">{format(date, 'MMM')}</span>
          <span className="text-2xl font-bold">{format(date, 'dd')}</span>
          <span className="text-xs">{format(date, 'p')}</span>
        </div>
        <div className="flex-grow">
          <h3 className="font-semibold">{partyName}</h3>
          <p className="text-xs text-muted-foreground">{item.description}</p>
          <div className="flex items-center gap-2 mt-1">
            {item.accountId && <Badge variant="outline">{item.accountId}</Badge>}
            {item.invoiceNumber && <Badge variant="secondary">Ref Invoice #{item.invoiceNumber}</Badge>}
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-orange-500 text-lg">{formatAmount(item.amount)}</p>
           <div className="flex items-center justify-end">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 -mr-2"><MoreVertical className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(item.id)}><Edit className="mr-2 h-4 w-4"/>Edit</DropdownMenuItem>
                  <AlertDialog>
                      <AlertDialogTrigger asChild>
                          <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                          <AlertDialogHeader>
                              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                              <AlertDialogDescriptionComponent>This action cannot be undone. This will permanently delete the purchase return.</AlertDialogDescriptionComponent>
                          </AlertDialogHeader>
                           <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(item.id)}>Delete</AlertDialogAction>
                            </AlertDialogFooter>
                      </AlertDialogContent>
                  </AlertDialog>
              </DropdownMenuContent>
            </DropdownMenu>
           </div>
        </div>
      </CardContent>
    </Card>
  );
};

function PurchaseReturnsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchTerm = searchParams.get('q') || '';
  const { toast } = useToast();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (e) => toast({ variant: 'destructive', title: 'Error loading transactions' }));
    const unsubParties = subscribeToParties(setParties, (e) => toast({ variant: 'destructive', title: 'Error loading parties' }));

    const timer = setTimeout(() => setLoading(false), 500);

    return () => {
      unsubTransactions();
      unsubParties();
      clearTimeout(timer);
    };
  }, [toast]);

  const purchaseReturns = useMemo(() => {
    return transactions.filter(t => t.type === 'purchase_return').sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);
  
  const partyMap = useMemo(() => new Map(parties.map(p => [p.id, p.name])), [parties]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSearchTerm = e.target.value;
    const params = new URLSearchParams(searchParams.toString());
    if (newSearchTerm) {
      params.set('q', newSearchTerm);
    } else {
      params.delete('q');
    }
    router.push(`?${params.toString()}`);
  };
  
  const handleEdit = (id: string) => {
    router.push(`/purchase-returns/new?id=${id}`);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction(id);
      toast({ title: 'Success', description: 'Purchase return deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };


  const filteredReturns = useMemo(() => {
    return purchaseReturns.filter(item => {
      const partyName = item.partyId ? partyMap.get(item.partyId) || '' : '';
      if (!searchTerm) return true;
      const lowerCaseSearch = searchTerm.toLowerCase();
      return (
        partyName.toLowerCase().includes(lowerCaseSearch) ||
        item.description?.toLowerCase().includes(lowerCaseSearch) ||
        item.invoiceNumber?.toLowerCase().includes(lowerCaseSearch)
      );
    });
  }, [purchaseReturns, searchTerm, partyMap]);
  
  const totalReturns = filteredReturns.length;
  const totalReturnValue = filteredReturns.reduce((sum, item) => sum + item.amount, 0);

  return (
    <>
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-black">
        <header className="bg-primary text-primary-foreground p-3 flex items-center gap-4 sticky top-0 z-10 shadow-md">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft />
          </Button>
          <h1 className="text-lg font-semibold">Purchase Returns</h1>
        </header>

        <main className="flex-grow overflow-y-auto p-3 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-orange-100 dark:bg-orange-800/30 border-orange-200">
              <CardHeader className="p-3 text-center">
                <CardDescription>Total Purchase Returns</CardDescription>
                <CardTitle className="text-3xl">{totalReturns}</CardTitle>
              </CardHeader>
            </Card>
            <Card className="bg-amber-100 dark:bg-amber-800/30 border-amber-200">
              <CardHeader className="p-3 text-center">
                <CardDescription>Return Value</CardDescription>
                <CardTitle className="text-3xl">{formatAmount(totalReturnValue)}</CardTitle>
              </CardHeader>
            </Card>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Invoice No / Party Name..." 
              className="pl-9"
              value={searchTerm}
              onChange={handleSearchChange}
            />
          </div>

          <div className="space-y-3 pb-24">
              {loading ? (
                  <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
              ) : filteredReturns.length > 0 ? (
                  filteredReturns.map(item => <PurchaseReturnCard key={item.id} item={item} partyName={item.partyId ? partyMap.get(item.partyId) || 'N/A' : 'N/A'} onEdit={handleEdit} onDelete={handleDelete} />)
              ) : (
                  <div className="text-center py-10 text-muted-foreground">
                      <p>No purchase returns found.</p>
                  </div>
              )}
          </div>
        </main>

        <div className="fixed bottom-6 right-6 z-20">
            <Button asChild size="lg" className="rounded-full shadow-lg">
              <Link href="/purchase-returns/new">New Purchase Return</Link>
            </Button>
        </div>
      </div>
    </>
  );
}


export default function PurchaseReturnsPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <PurchaseReturnsContent />
        </Suspense>
    );
}
