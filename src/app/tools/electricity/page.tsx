

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter as DialogFooterComponent, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit, Trash2, Loader2, HeartPulse, Wrench, Calendar, DollarSign, Search, Filter, Zap, MoreVertical, Clock, ArrowLeft, ExternalLink } from 'lucide-react';
import type { ElectricityInfo, MeterReading, ExpenseHistoryEntry, Transaction } from '@/types';
import { subscribeToElectricityMeters, addElectricityMeter, updateElectricityMeter, deleteElectricityMeter, addMeterReading, updateMeterReading, deleteMeterReading, postElectricityExpense, updateExpenseHistory, deleteExpenseHistory } from '@/services/electricityService';
import { addTransaction } from '@/services/transactionService';
import { formatAmount, formatDate } from '@/lib/utils';
import { differenceInDays, parseISO, format, isPast, isFuture, addYears, addMonths, addDays, differenceInHours } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { CopyToClipboard } from '../copy-to-clipboard';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';


const MeterFormDialog = ({ open, onOpenChange, onSave, meter }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (data: Omit<ElectricityInfo, 'id'>) => void, meter: ElectricityInfo | null }) => {
    const [label, setLabel] = useState('');
    const [meterNumber, setMeterNumber] = useState('');
    const [consumerNumber, setConsumerNumber] = useState('');
    const [phone, setPhone] = useState('');

    useEffect(() => {
        if (open) {
            if (meter) {
                setLabel(meter.label);
                setMeterNumber(meter.meterNumber);
                setConsumerNumber(meter.consumerNumber);
                setPhone(meter.phone || '');
            } else {
                setLabel('');
                setMeterNumber('');
                setConsumerNumber('');
                setPhone('');
            }
        }
    }, [meter, open]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ label, meterNumber, consumerNumber, phone, readings: meter?.readings || [], expenseHistory: meter?.expenseHistory || [] });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>{meter ? 'Edit Meter' : 'Add New Meter'}</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label htmlFor="label">Label</Label><Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g., Shop Meter, Home Meter" /></div>
                        <div className="space-y-2"><Label htmlFor="meter-no">Meter Number</Label><Input id="meter-no" value={meterNumber} onChange={(e) => setMeterNumber(e.target.value)} /></div>
                        <div className="space-y-2"><Label htmlFor="consumer-no">Consumer Number</Label><Input id="consumer-no" value={consumerNumber} onChange={(e) => setConsumerNumber(e.target.value)} /></div>
                        <div className="space-y-2"><Label htmlFor="phone">Phone Number</Label><Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                    </div>
                    <DialogFooterComponent>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit">Save</Button>
                    </DialogFooterComponent>
                </form>
            </DialogContent>
        </Dialog>
    );
};

const ReadingFormDialog = ({ open, onOpenChange, onSave, reading, meterId }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (meterId: string, data: MeterReading) => void, reading: MeterReading | null, meterId: string }) => {
    const [date, setDate] = useState('');
    const [readingValue, setReadingValue] = useState(0);
    const [rechargeAmount, setRechargeAmount] = useState(0);
    
    useEffect(() => {
        if (open) {
            if(reading) {
                setDate(format(parseISO(reading.date), 'yyyy-MM-dd'));
                setReadingValue(reading.reading || 0);
                setRechargeAmount(reading.rechargeAmount || 0);
            } else {
                setDate(format(new Date(), 'yyyy-MM-dd'));
                setReadingValue(0);
                setRechargeAmount(0);
            }
        }
    }, [reading, open]);
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const readingData: MeterReading = {
            id: reading?.id || `reading-${Date.now()}`,
            date,
            reading: readingValue,
            rechargeAmount
        };
        onSave(meterId, readingData);
    }
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                 <DialogHeader><DialogTitle>{reading ? 'Edit Reading' : 'Add New Reading'}</DialogTitle></DialogHeader>
                 <form onSubmit={handleSubmit}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Recharge Amount (BDT)</Label><Input type="number" step="0.01" value={rechargeAmount || ''} onChange={e => setRechargeAmount(parseFloat(e.target.value) || 0)} /></div>
                        <div className="space-y-2"><Label>Meter Reading (Unit) - Optional</Label><Input type="number" step="0.01" value={readingValue || ''} onChange={e => setReadingValue(parseFloat(e.target.value) || 0)} /></div>
                    </div>
                    <DialogFooterComponent>
                        <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                        <Button type="submit">Save Reading</Button>
                    </DialogFooterComponent>
                 </form>
            </DialogContent>
        </Dialog>
    )
}

const EditExpenseDialog = ({ open, onOpenChange, onSave, expense, meterId }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (meterId: string, expenseId: string, updates: Partial<ExpenseHistoryEntry>) => void, expense: ExpenseHistoryEntry | null, meterId: string }) => {
    const [consumedAmount, setConsumedAmount] = useState(0);
    const [currentBalance, setCurrentBalance] = useState(0);

    useEffect(() => {
        if (expense) {
            setConsumedAmount(expense.consumedAmount);
            setCurrentBalance(expense.currentBalance || 0);
        }
    }, [expense]);

    if (!expense) return null;
    
    const handleSave = () => {
        onSave(meterId, expense.id, { consumedAmount, currentBalance });
        onOpenChange(false);
    }

    return (
         <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader><DialogTitle>Edit Expense Record</DialogTitle></DialogHeader>
                <div className="space-y-4 py-4">
                     <div className="space-y-2">
                        <Label>Consumed Amount (BDT)</Label>
                        <Input type="number" value={consumedAmount} onChange={e => setConsumedAmount(parseFloat(e.target.value) || 0)} />
                    </div>
                     <div className="space-y-2">
                        <Label>Current Balance (BDT)</Label>
                        <Input type="number" value={currentBalance} onChange={e => setCurrentBalance(parseFloat(e.target.value) || 0)} />
                    </div>
                </div>
                 <DialogFooterComponent>
                    <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSave}>Save Changes</Button>
                </DialogFooterComponent>
            </DialogContent>
        </Dialog>
    )
}

export default function ElectricityManagementPage() {
  const [meters, setMeters] = useState<ElectricityInfo[]>([]);
  const [isMeterFormOpen, setIsMeterFormOpen] = useState(false);
  const [editingMeter, setEditingMeter] = useState<ElectricityInfo | null>(null);
  
  const [isReadingFormOpen, setIsReadingFormOpen] = useState(false);
  const [editingReading, setEditingReading] = useState<MeterReading | null>(null);
  const [activeMeterId, setActiveMeterId] = useState('');
  
  const [currentBalances, setCurrentBalances] = useState<Record<string, { balance: string, date: string }>>({});
  
  const [editingExpense, setEditingExpense] = useState<ExpenseHistoryEntry | null>(null);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    const unsubscribe = subscribeToElectricityMeters(
      setMeters,
      (error) => toast({ variant: 'destructive', title: 'Error', description: error.message })
    );
    return () => unsubscribe();
  }, [toast]);


  const handleSaveMeter = async (data: Omit<ElectricityInfo, 'id'>) => {
    try {
      if (editingMeter) {
        await updateElectricityMeter(editingMeter.id, data);
        toast({ title: 'Success', description: 'Meter information updated.' });
      } else {
        await addElectricityMeter(data);
        toast({ title: 'Success', description: 'New meter added.' });
      }
      setIsMeterFormOpen(false);
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Could not save meter: ${error.message}` });
    }
  };

  const handleDeleteMeter = async (id: string) => {
    try {
      await deleteElectricityMeter(id);
      toast({ title: 'Deleted', description: 'Meter information has been removed.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Could not delete meter: ${error.message}` });
    }
  };
  
  const handleSaveReading = async (meterId: string, reading: MeterReading) => {
      try {
          if (editingReading) {
              await updateMeterReading(meterId, reading);
              toast({ title: 'Reading updated' });
          } else {
              await addMeterReading(meterId, reading);
              toast({ title: 'Reading added' });
          }
          setIsReadingFormOpen(false);
      } catch (error: any) {
           toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
  };
  
  const handleDeleteReading = async (meterId: string, readingId: string) => {
      try {
        await deleteMeterReading(meterId, readingId);
        toast({ title: 'Reading deleted' });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
  }

  const handlePostExpense = async (meter: ElectricityInfo, calculation: { consumedAmount: number; days: number; hours: number; fromDate: string; toDate: string; avgCost: number; currentBalance: number; }) => {
    if (calculation.consumedAmount <= 0) return;

    try {
        await postElectricityExpense(meter.id, calculation);
        toast({ title: 'Expense Posted', description: 'Electricity bill transaction has been created and logged.' });
    } catch (error: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Could not post expense: ${error.message}` });
    }
  };
  
  const handleSaveExpense = async (meterId: string, expenseId: string, updates: Partial<ExpenseHistoryEntry>) => {
      try {
        await updateExpenseHistory(meterId, expenseId, updates);
        toast({ title: 'Success', description: 'Expense record updated.'});
      } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
      }
  };

  const handleDeleteExpense = async (meterId: string, expenseId: string) => {
      try {
          await deleteExpenseHistory(meterId, expenseId);
          toast({ title: 'Success', description: 'Expense record deleted.' });
      } catch (e: any) {
           toast({ variant: 'destructive', title: 'Error', description: e.message });
      }
  }
  
  const calculateConsumption = (meter: ElectricityInfo, currentBalanceData: { balance: string, date: string }) => {
    const sortedReadings = [...(meter.readings || [])].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const latestReading = sortedReadings.length > 0 ? sortedReadings[0] : null;
    const currentBalanceValue = parseFloat(currentBalanceData.balance);

    if (latestReading && !isNaN(currentBalanceValue) && currentBalanceValue >= 0) {
        const balanceAfterRecharge = latestReading.rechargeAmount;
        const consumedAmount = balanceAfterRecharge - currentBalanceValue;
        const toDate = new Date(currentBalanceData.date);
        const fromDate = parseISO(latestReading.date);
        const hours = Math.max(differenceInHours(toDate, fromDate), 1);
        const days = Math.max(differenceInDays(toDate, fromDate), 1);
        const avgCost = consumedAmount / days;
        return { consumedAmount, days, hours, fromDate: latestReading.date, toDate: currentBalanceData.date, avgCost, currentBalance: currentBalanceValue };
    }
    return null;
  };
  
  const filteredMeters = useMemo(() => {
      if (!searchTerm) return meters;
      const lowerCaseSearch = searchTerm.toLowerCase();
      return meters.filter(m => 
          m.label.toLowerCase().includes(lowerCaseSearch) ||
          m.meterNumber.toLowerCase().includes(lowerCaseSearch) ||
          m.consumerNumber.toLowerCase().includes(lowerCaseSearch)
      );
  }, [meters, searchTerm]);
  
  const nescoUrl = "https://customer.nesco.gov.bd/pre/panel";
  
  return (
    <div className="container mx-auto max-w-7xl py-8 space-y-6">
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/tools">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tools
          </Link>
        </Button>
      </div>

       <MeterFormDialog
            open={isMeterFormOpen}
            onOpenChange={setIsMeterFormOpen}
            onSave={handleSaveMeter}
            meter={editingMeter}
       />
       
       <ReadingFormDialog
            open={isReadingFormOpen}
            onOpenChange={setIsReadingFormOpen}
            onSave={handleSaveReading}
            reading={editingReading}
            meterId={activeMeterId}
       />

       <EditExpenseDialog
            open={isExpenseFormOpen}
            onOpenChange={setIsExpenseFormOpen}
            onSave={handleSaveExpense}
            expense={editingExpense}
            meterId={activeMeterId}
       />
       
        <Card>
            <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center">
                <div>
                     <CardTitle className="flex items-center gap-2 text-2xl"><Zap/> Electricity Management</CardTitle>
                    <CardDescription>
                        Manage your meter and consumer numbers for quick access.
                    </CardDescription>
                </div>
                <Button onClick={() => { setEditingMeter(null); setIsMeterFormOpen(true); }}>
                  <Plus className="mr-2 h-4 w-4"/> Add New Meter
                </Button>
            </CardHeader>
            <CardContent>
                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by label, meter no, or consumer no..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                    />
                </div>
            </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {filteredMeters.map((meter) => {
                const sortedReadings = [...(meter.readings || [])].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                const currentBalanceData = currentBalances[meter.id] || { balance: '', date: new Date().toISOString() };
                const calculation = calculateConsumption(meter, currentBalanceData);
                
                return (
                     <Card key={meter.id} className="p-4 relative group flex flex-col">
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingMeter(meter); setIsMeterFormOpen(true); }}><Edit className="h-4 w-4"/></Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescriptionComponent>This will permanently delete the meter "{meter.label}".</AlertDialogDescriptionComponent></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteMeter(meter.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                        <h3 className="font-semibold mb-2">{meter.label}</h3>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Meter Number:</span><div className="flex items-center gap-2"><span className="font-mono">{meter.meterNumber}</span><CopyToClipboard textToCopy={meter.meterNumber} /></div></div>
                            <div className="flex items-center justify-between text-sm"><span className="text-muted-foreground">Consumer Number:</span><div className="flex items-center gap-2"><span className="font-mono">{meter.consumerNumber}</span><CopyToClipboard textToCopy={meter.consumerNumber} /></div></div>
                        </div>

                         <div className="mt-4 pt-4 border-t flex-grow">
                             <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold">Readings History</h4>
                                <Button size="sm" onClick={() => { setActiveMeterId(meter.id); setEditingReading(null); setIsReadingFormOpen(true);}}><Plus className="mr-2 h-4 w-4"/>Add Reading</Button>
                             </div>
                              {sortedReadings.length > 0 ? (
                                <div className="space-y-4">
                                  <div className="space-y-2 pt-2">
                                    <Label>Current Balance (BDT)</Label>
                                    <div className="flex gap-2">
                                        <Input
                                          type="number"
                                          placeholder="Enter current meter balance"
                                          value={currentBalances[meter.id]?.balance || ''}
                                          onChange={(e) => setCurrentBalances({ ...currentBalances, [meter.id]: { ...currentBalances[meter.id], balance: e.target.value, date: currentBalances[meter.id]?.date || new Date().toISOString() } })}
                                        />
                                        <Input
                                            type="datetime-local"
                                            value={format(parseISO(currentBalances[meter.id]?.date || new Date().toISOString()), "yyyy-MM-dd'T'HH:mm")}
                                            onChange={(e) => setCurrentBalances({ ...currentBalances, [meter.id]: { ...currentBalances[meter.id], date: new Date(e.target.value).toISOString() } })}
                                        />
                                    </div>
                                    {calculation && calculation.consumedAmount > 0 && (
                                        <div className="p-2 border rounded-md text-sm text-center">
                                            <p>Consumed: <span className="font-semibold">{formatAmount(calculation.consumedAmount)}</span> in {calculation.days} day(s) ({calculation.hours} hours). </p>
                                            <p>Avg. Cost/Day: <span className="font-semibold">{formatAmount(calculation.avgCost)}</span></p>
                                            <Button size="sm" className="mt-2" onClick={() => handlePostExpense(meter, calculation)}>Post Expense</Button>
                                        </div>
                                    )}
                                  </div>
                                  <Table>
                                    <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Recharge</TableHead><TableHead className="text-right">Unit Reading</TableHead><TableHead className="w-12"></TableHead></TableRow></TableHeader>
                                    <TableBody>
                                      {sortedReadings.map((r, i) => {
                                        const prevReading = sortedReadings[i + 1];
                                        const unitDiff = prevReading ? r.reading - prevReading.reading : null;
                                        return (
                                          <TableRow key={r.id}>
                                            <TableCell>{formatDate(r.date)}</TableCell>
                                            <TableCell className="text-right">{formatAmount(r.rechargeAmount)}</TableCell>
                                            <TableCell className="text-right">{r.reading || '-'} {unitDiff && <span className="text-xs text-muted-foreground">(+{unitDiff.toFixed(2)})</span>}</TableCell>
                                            <TableCell>
                                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setActiveMeterId(meter.id); setEditingReading(r); setIsReadingFormOpen(true); }}><Edit className="h-3 w-3"/></Button>
                                               <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDeleteReading(meter.id, r.id)}><Trash2 className="h-3 w-3 text-destructive"/></Button>
                                            </TableCell>
                                          </TableRow>
                                        )
                                      })}
                                    </TableBody>
                                  </Table>
                                   <Card className="mt-4">
                                        <CardHeader><CardTitle className="text-base">Expense History</CardTitle></CardHeader>
                                        <CardContent>
                                        {meter.expenseHistory && meter.expenseHistory.length > 0 ? (
                                            <Table>
                                                <TableHeader><TableRow><TableHead>Period</TableHead><TableHead>Amount</TableHead><TableHead>Current Balance</TableHead><TableHead className="text-right">Avg. Daily</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                    {meter.expenseHistory.sort((a,b) => new Date(b.toDate).getTime() - new Date(a.toDate).getTime()).map(exp => {
                                                        const days = differenceInDays(parseISO(exp.toDate), parseISO(exp.fromDate)) + 1;
                                                        const avgDaily = days > 0 ? exp.consumedAmount / days : 0;
                                                        return (
                                                            <TableRow key={exp.id}>
                                                                <TableCell>{formatDate(exp.fromDate)} to {formatDate(exp.toDate)} ({days} days)</TableCell>
                                                                <TableCell>{formatAmount(exp.consumedAmount)}</TableCell>
                                                                <TableCell>{formatAmount(exp.currentBalance || 0)}</TableCell>
                                                                <TableCell className="text-right">{formatAmount(avgDaily)}</TableCell>
                                                                <TableCell>
                                                                    <DropdownMenu>
                                                                        <DropdownMenuTrigger asChild>
                                                                            <Button variant="ghost" size="icon" className="h-7 w-7"><MoreVertical className="h-4 w-4"/></Button>
                                                                        </DropdownMenuTrigger>
                                                                        <DropdownMenuContent>
                                                                            <DropdownMenuItem onClick={() => { setActiveMeterId(meter.id); setEditingExpense(exp); setIsExpenseFormOpen(true); }}>Edit</DropdownMenuItem>
                                                                            <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteExpense(meter.id, exp.id)}>Delete</DropdownMenuItem>
                                                                        </DropdownMenuContent>
                                                                    </DropdownMenu>
                                                                </TableCell>
                                                            </TableRow>
                                                        )
                                                    })}
                                                </TableBody>
                                            </Table>
                                        ) : (
                                            <p className="text-sm text-center text-muted-foreground py-2">No expenses posted yet.</p>
                                        )}
                                        </CardContent>
                                    </Card>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">No readings added yet.</p>
                              )}
                         </div>

                    </Card>
                );
            })}
        </div>
        <div className="pt-4 text-center">
            <Button asChild className="w-full max-w-sm">
                <a href={nescoUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" /> Open NESCO Portal in New Tab
                </a>
            </Button>
        </div>
    </div>
  );
}

    
