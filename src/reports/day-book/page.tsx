
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Printer, Share2, Book, ArrowDown, ArrowUp, ShoppingCart, Wallet, CreditCard, FileText, ArrowRightLeft, Users, Receipt, Package, Banknote } from 'lucide-react';
import type { Transaction, Account, Party, InventoryItem, AppSettings } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToAccounts } from '@/services/accountService';
import { subscribeToParties } from '@/services/partyService';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { getAppSettings } from '@/services/settingsService';
import { formatDate, formatAmount, getEffectiveAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { DateRange } from 'react-day-picker';
import { addDays, format as formatFns, startOfMonth } from 'date-fns';
import { Label } from '@/components/ui/label';

interface GroupedTransactions {
    income: Transaction[];
    spent: Transaction[];
    sale: Transaction[];
    purchase: Transaction[];
    credit_sale: Transaction[];
    credit_purchase: Transaction[];
    receive: Transaction[];
    give: Transaction[];
    transfer: Transaction[];
}

interface SaleWithStockInfo {
    itemId: string;
    itemName: string;
    openingStock: number;
    quantitySold: number;
    closingStock: number;
    saleValue: number;
}

const transactionGroupInfo = {
    sale: { title: "Cash Sales", icon: <Banknote className="h-5 w-5 text-green-500" /> },
    credit_sale: { title: "Credit Sales", icon: <Receipt className="h-5 w-5 text-purple-500" /> },
    income: { title: "Other Income", icon: <Wallet className="h-5 w-5 text-green-500" /> },
    spent: { title: "Expenses", icon: <CreditCard className="h-5 w-5 text-red-500" /> },
    purchase: { title: "Cash Purchases", icon: <ShoppingCart className="h-5 w-5 text-red-500" /> },
    credit_purchase: { title: "Credit Purchases", icon: <FileText className="h-5 w-5 text-orange-500" /> },
    receive: { title: "Received from Parties", icon: <ArrowDown className="h-5 w-5 text-blue-500" /> },
    give: { title: "Given to Parties", icon: <ArrowUp className="h-5 w-5 text-yellow-500" /> },
    transfer: { title: "Internal Transfers", icon: <ArrowRightLeft className="h-5 w-5 text-gray-500" /> },
}

const SalesStockCard = ({ salesInfo, title, icon }: { salesInfo: SaleWithStockInfo[], title: string, icon: React.ReactNode }) => {
    if (salesInfo.length === 0) return null;

    const totalSaleValue = salesInfo.reduce((sum, item) => sum + item.saleValue, 0);

    return (
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle></CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Item Name</TableHead>
                                <TableHead className="text-center">Opening Stock</TableHead>
                                <TableHead className="text-center">Qty Sold</TableHead>
                                <TableHead className="text-center">Closing Stock</TableHead>
                                <TableHead className="text-right">Sale Value</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {salesInfo.map(item => (
                                <TableRow key={item.itemId}>
                                    <TableCell>{item.itemName}</TableCell>
                                    <TableCell className="text-center">{item.openingStock}</TableCell>
                                    <TableCell className="text-center">{item.quantitySold}</TableCell>
                                    <TableCell className="text-center">{item.closingStock}</TableCell>
                                    <TableCell className="text-right font-mono">{formatAmount(item.saleValue)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={4} className="text-right font-bold">Total Sale Value</TableCell>
                                <TableCell className="text-right font-bold font-mono">{formatAmount(totalSaleValue)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};


const TransactionGroupCard = ({ title, icon, transactions, parties, accounts }: { title: string, icon: React.ReactNode, transactions: Transaction[], parties: Party[], accounts: Account[] }) => {
    if (transactions.length === 0) return null;

    const total = transactions.reduce((sum, tx) => sum + tx.amount, 0);
    const getPartyName = (partyId?: string) => parties.find(p => p.id === partyId)?.name;
    const getAccountName = (accountId?: string) => accounts.find(a => a.id === accountId)?.name;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">{icon} {title}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Party/Account</TableHead>
                                <TableHead className="text-right">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {transactions.map(t => (
                                <TableRow key={t.id}>
                                    <TableCell>{formatDate(t.date)}</TableCell>
                                    <TableCell>{t.description}</TableCell>
                                    <TableCell>
                                        {t.type === 'transfer' 
                                            ? `${getAccountName(t.fromAccountId)} → ${getAccountName(t.toAccountId)}`
                                            : (getPartyName(t.partyId) || getAccountName(t.accountId) || 'N/A')
                                        }
                                    </TableCell>
                                    <TableCell className="text-right font-mono">{formatAmount(t.amount)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={3} className="text-right font-bold">Total</TableCell>
                                <TableCell className="text-right font-bold font-mono">{formatAmount(total)}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
};


export default function DayBookReport() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [parties, setParties] = useState<Party[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  
  const [viaFilter, setViaFilter] = useState('all');

  useEffect(() => {
    setDateRange({ from: new Date(), to: new Date() });
    setLoading(true);
    const unsubTransactions = subscribeToAllTransactions(setTransactions, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubAccounts = subscribeToAccounts(setAccounts, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubParties = subscribeToParties(setParties, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    const unsubInventory = subscribeToInventoryItems(setInventory, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    getAppSettings().then(setAppSettings);

    const timer = setTimeout(() => setLoading(false), 500);

    return () => {
      unsubTransactions();
      unsubAccounts();
      unsubParties();
      unsubInventory();
      clearTimeout(timer);
    };
  }, [toast]);

  const { salesWithStock, groupedTransactions } = useMemo(() => {
    const fromDate = dateRange?.from ? formatFns(dateRange.from, 'yyyy-MM-dd') : '1970-01-01';
    const toDate = dateRange?.to ? formatFns(dateRange.to, 'yyyy-MM-dd') : '9999-12-31';

    const filteredTx = transactions.filter(t => {
      if (!t.enabled) return false;
      const txDate = t.date;
      if (txDate < fromDate) return false;
      if (txDate > toDate) return false;
      if (viaFilter !== 'all' && t.via !== viaFilter) return false;
      return true;
    });

    const salesInPeriod = filteredTx
      .filter(t => (t.type === 'sale' || t.type === 'credit_sale') && t.items)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const salesStockMap = new Map<string, SaleWithStockInfo>();

    for (const saleTx of salesInPeriod) {
        for (const soldItem of saleTx.items!) {
            const inventoryItem = inventory.find(i => i.id === soldItem.id);
            if (!inventoryItem) continue;

            // Calculate opening stock for this specific item on the day of the transaction
            const historicTransactions = transactions.filter(t => t.date < saleTx.date && t.enabled && t.items?.some(i => i.id === soldItem.id));
            
            let stockChangeBeforeTx = 0;
            historicTransactions.forEach(tx => {
                const itemInTx = tx.items!.find(i => i.id === soldItem.id)!;
                if (tx.type === 'purchase' || tx.type === 'credit_purchase') {
                    stockChangeBeforeTx += itemInTx.quantity;
                } else if (tx.type === 'sale' || tx.type === 'credit_sale') {
                    stockChangeBeforeTx -= itemInTx.quantity;
                }
            });

            // The opening stock is the current stock minus all changes that happened AFTER that transaction
            // This is a complex way. A simpler way is to calculate from the beginning.
            const initialStock = 0; // Assuming all items start at 0 before any transaction.
            const openingStock = initialStock + stockChangeBeforeTx;

            const closingStock = openingStock - soldItem.quantity;

            const existing = salesStockMap.get(soldItem.id);
            if (existing) {
                existing.quantitySold += soldItem.quantity;
                existing.saleValue += soldItem.price * soldItem.quantity;
                // We should probably show closing stock after the last sale of the day,
                // but for simplicity, we show it after each sale. The table shows aggregated view anyway.
                existing.closingStock = closingStock;
            } else {
                salesStockMap.set(soldItem.id, {
                    itemId: soldItem.id,
                    itemName: soldItem.name,
                    openingStock: openingStock,
                    quantitySold: soldItem.quantity,
                    closingStock: closingStock,
                    saleValue: soldItem.price * soldItem.quantity,
                });
            }
        }
    }

    const grouped = filteredTx.reduce((acc, tx) => {
        const typeKey = tx.type as keyof GroupedTransactions;
        if (!acc[typeKey]) {
            acc[typeKey] = [];
        }
        acc[typeKey].push(tx);
        return acc;
    }, {} as GroupedTransactions);

    return { salesWithStock: Array.from(salesStockMap.values()), groupedTransactions: grouped };

  }, [transactions, dateRange, viaFilter, inventory]);

  const setDatePreset = (preset: 'today' | 'yesterday' | 'thisMonth') => {
    const today = new Date();
    if (preset === 'today') {
        const from = new Date();
        from.setHours(0, 0, 0, 0);
        const to = new Date();
        to.setHours(23, 59, 59, 999);
        setDateRange({ from, to });
    } else if (preset === 'yesterday') {
        const yesterdayFrom = addDays(today, -1);
        yesterdayFrom.setHours(0, 0, 0, 0);
        const yesterdayTo = addDays(today, -1);
        yesterdayTo.setHours(23, 59, 59, 999);
        setDateRange({ from: yesterdayFrom, to: yesterdayTo });
    } else if (preset === 'thisMonth') {
        const from = startOfMonth(today);
        from.setHours(0, 0, 0, 0);
        const to = new Date();
        to.setHours(23, 59, 59, 999);
        setDateRange({ from, to: today });
    }
  }

  const handlePrint = () => window.print();

  return (
    <div className="p-4 md:p-6 lg:p-8">
       <style>{`
        @page {
          size: A4;
          margin: 1.5cm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-area, .print-area * { 
            visibility: visible; 
          }
          .print-area { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            padding: 0;
            margin: 0;
          }
          .no-print { 
            display: none; 
          }
          .print-header { display: block !important; }
          .print-area table th, .print-area table td {
            padding: 4px 8px;
            font-size: 9pt;
          }
           .print-area .card-header, .print-area .card-content {
              padding: 0.5rem;
            }
            .print-area .card-title {
              font-size: 1.1rem;
            }
            .print-area .card {
              border: none;
              box-shadow: none;
            }
        }
      `}</style>
      <div className="no-print">
        <div className="mb-6">
            <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
        </div>
      </div>
      <div className="print-area">
        <div className="hidden print-header text-center mb-6">
            <h1 className="text-2xl font-bold">{viaFilter === 'all' ? 'All Businesses' : appSettings?.businessProfiles.find(o => o.name === viaFilter)?.name}</h1>
            <h2 className="text-xl">Day Book</h2>
            {dateRange?.from && (
                <p className="text-sm">
                    {formatFns(dateRange.from, "LLL dd, y")}
                    {dateRange.to ? ` - ${formatFns(dateRange.to, "LLL dd, y")}` : ''}
                </p>
            )}
        </div>
        <Card>
            <CardHeader className="no-print">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                <CardTitle className="flex items-center gap-2"><Book/>Day Book</CardTitle>
                <CardDescription>A detailed summary of all transactions for the selected period.</CardDescription>
                </div>
                <div className="flex gap-2 no-print">
                <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4" /> Print Report</Button>
                <Button disabled><Share2 className="mr-2 h-4 w-4" /> Share</Button>
                </div>
            </div>
            </CardHeader>
            <CardContent>
            <div className="flex flex-col md:flex-row flex-wrap gap-2 mb-6 p-4 border rounded-lg no-print items-end">
                <div className="grid gap-1">
                    <Label>Date Range</Label>
                    <DateRangePicker date={dateRange} onDateChange={setDateRange} />
                </div>
                <div className="flex gap-1 pt-5">
                    <Button variant="outline" size="sm" onClick={() => setDatePreset('today')}>Today</Button>
                    <Button variant="outline" size="sm" onClick={() => setDatePreset('yesterday')}>Yesterday</Button>
                    <Button variant="outline" size="sm" onClick={() => setDatePreset('thisMonth')}>This Month</Button>
                </div>
                <div className="grid gap-1">
                    <Label>Business Profile</Label>
                    <Select value={viaFilter} onValueChange={setViaFilter}>
                        <SelectTrigger className="w-full md:w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Profiles</SelectItem>
                            {appSettings?.businessProfiles.map(o => <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            {loading ? (
                <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
            ) : groupedTransactions ? (
                <div className="space-y-6">
                    <SalesStockCard salesInfo={salesWithStock} title="Sales & Stock Movement" icon={<Package className="h-5 w-5 text-green-500" />} />
                    
                    {Object.entries(transactionGroupInfo)
                        .map(([type, info]) => {
                            const txs = groupedTransactions[type as keyof typeof transactionGroupInfo] || [];
                             if (txs.length === 0) return null;
                            return (
                                <TransactionGroupCard
                                    key={type}
                                    title={info.title}
                                    icon={info.icon}
                                    transactions={txs}
                                    parties={parties}
                                    accounts={accounts}
                                />
                            );
                    })}

                    {Object.values(groupedTransactions).every(arr => arr.length === 0) && (
                        <div className="text-center py-16">
                            <h3 className="text-xl font-semibold">No transactions found</h3>
                            <p className="text-muted-foreground mt-2">There are no transactions for the selected period and filters.</p>
                        </div>
                    )}
                </div>
            ) : (
                    <div className="text-center py-16">
                        <h3 className="text-xl font-semibold">Could not load data</h3>
                        <p className="text-muted-foreground mt-2">There was an issue loading the transaction data.</p>
                    </div>
            )}
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
