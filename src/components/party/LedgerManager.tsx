
'use client';

import React from 'react';
import { TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MoreVertical, Edit, Trash2, Receipt, FileUp, ListFilter, Calendar, 
  ArrowDown, ArrowUp, Info, Eye, Printer, BookOpen
} from 'lucide-react';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";
import { formatAmount, formatDate, cn, getPartyBalanceEffect } from '@/lib/utils';
import type { Transaction, Account, Party, AppSettings } from '@/types';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface LedgerManagerProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  groupedTransactions: [string, any[]][];
  filters: { dateFrom: string; dateTo: string; via: string; };
  setFilters: React.Dispatch<React.SetStateAction<{ dateFrom: string; dateTo: string; via: string; }>>;
  isDateFilterEnabled: boolean;
  setIsDateFilterEnabled: (enabled: boolean) => void;
  includeInternalTx: boolean;
  setIncludeInternalTx: (include: boolean) => void;
  openingBalance: number;
  finalBalance: number;
  accounts: Account[];
  parties: Party[];
  appSettings: AppSettings | null;
  onEditTx: (tx: Transaction) => void;
  onDeleteTx: (id: string) => void;
  onPrintTx: (tx: Transaction) => void;
  oldLedger: any[];
  soldProducts: any[];
}

export default function LedgerManager({
  activeTab,
  setActiveTab,
  groupedTransactions,
  filters,
  setFilters,
  isDateFilterEnabled,
  setIsDateFilterEnabled,
  includeInternalTx,
  setIncludeInternalTx,
  openingBalance,
  finalBalance,
  accounts,
  parties,
  appSettings,
  onEditTx,
  onDeleteTx,
  onPrintTx,
  oldLedger,
  soldProducts
}: LedgerManagerProps) {
  
  return (
    <>
      <TabsList className="grid w-full grid-cols-4 mb-4">
        <TabsTrigger value="transactions">Transactions</TabsTrigger>
        <TabsTrigger value="party-details">Analysis</TabsTrigger>
        <TabsTrigger value="loan">Loans</TabsTrigger>
        <TabsTrigger value="old_ledger">Old Data</TabsTrigger>
      </TabsList>

      <TabsContent value="transactions" className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">From</Label>
                  <Input 
                    type="date" 
                    value={filters.dateFrom} 
                    onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))}
                    className="h-9 text-sm w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">To</Label>
                  <Input 
                    type="date" 
                    value={filters.dateTo} 
                    onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))}
                    className="h-9 text-sm w-40"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Profile</Label>
                  <Select value={filters.via} onValueChange={v => setFilters(f => ({...f, via: v}))}>
                    <SelectTrigger className="h-9 text-sm w-[140px]"><SelectValue placeholder="All Profiles" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Profiles</SelectItem>
                      {(appSettings?.businessProfiles || []).map(p => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Checkbox id="include-internal" checked={includeInternalTx} onCheckedChange={c => setIncludeInternalTx(!!c)} />
                  <Label htmlFor="include-internal" className="text-xs font-normal">Inc. Internal</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch id="date-filter-toggle" checked={isDateFilterEnabled} onCheckedChange={setIsDateFilterEnabled} />
                  <Label htmlFor="date-filter-toggle" className="text-xs font-normal">Apply Dates</Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px]">Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit (In)</TableHead>
                <TableHead className="text-right">Credit (Out)</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isDateFilterEnabled && (
                <TableRow className="bg-slate-50 italic">
                  <TableCell colSpan={4} className="text-right font-medium">Opening Balance</TableCell>
                  <TableCell className="text-right font-bold">{formatAmount(openingBalance)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
              {groupedTransactions.length > 0 ? groupedTransactions.map(([date, txs]) => (
                <React.Fragment key={date}>
                  {txs.map((t, idx) => {
                    const effect = getPartyBalanceEffect(t, true);
                    const isDebit = effect < 0;
                    const isCredit = effect > 0;
                    const amount = Math.abs(effect);

                    return (
                      <TableRow key={t.id} className="group hover:bg-muted/30">
                        <TableCell className="text-xs font-medium">{idx === 0 ? formatDate(date) : ''}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm">{t.description || 'Transaction'}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] h-4 py-0">{t.type.replace('_', ' ')}</Badge>
                              {t.via && <span className="text-[10px] text-muted-foreground">via {t.via}</span>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-red-600 font-mono">
                          {isDebit ? formatAmount(amount) : '-'}
                        </TableCell>
                        <TableCell className="text-right text-green-600 font-mono">
                          {isCredit ? formatAmount(amount) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold font-mono">
                          {formatAmount(t.runningBalance)}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => onEditTx(t)}><Edit className="h-4 w-4 mr-2" /> Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onPrintTx(t)}><Printer className="h-4 w-4 mr-2" /> Print</DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive"><Trash2 className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This will move the transaction to the activity log and adjust balances.</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => onDeleteTx(t.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </React.Fragment>
              )) : (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    No transactions found for this period.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
            <TableFooter>
              <TableRow className="bg-muted/50">
                <TableCell colSpan={4} className="text-right font-bold text-base">Final Balance</TableCell>
                <TableCell className="text-right font-bold text-base">{formatAmount(finalBalance)}</TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </TabsContent>

      <TabsContent value="old_ledger">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Historical Ledger Data</CardTitle>
              <CardDescription>Imported or manually added old records.</CardDescription>
            </div>
            <Button variant="outline" asChild>
              <Link href={`/old-data?partyId=${(groupedTransactions[0]?.[1][0] as Transaction)?.partyId}`}>
                <FileUp className="h-4 w-4 mr-2" /> Import PDF
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {oldLedger.length > 0 ? (
              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Comments</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {oldLedger.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs">{String(row['Date'])}</TableCell>
                        <TableCell className="text-xs">{String(row['Comments'])}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(Number(row['debit']))}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(Number(row['credit']))}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{formatAmount(Number(row['Balance (৳)']))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-12 w-12 mx-auto opacity-20 mb-4" />
                <p>No historical data available for this party.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </>
  );
}

function DropdownMenuSeparator() {
  return <div className="h-px bg-muted my-1" />
}
