
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Loader2, Save, History, ClipboardCheck, Wallet, Package } from 'lucide-react';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { subscribeToAccounts } from '@/services/accountService';
import { saveAudit, subscribeToAudits } from '@/services/auditService';
import type { InventoryItem, Account, StockAudit, AuditItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { formatAmount, formatDate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


interface VerifiableItem {
  id: string;
  name: string;
  systemBalance: number;
  physicalBalance: number | string;
  difference: number;
}

export default function StockAuditPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [audits, setAudits] = useState<StockAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const [verifiableStock, setVerifiableStock] = useState<VerifiableItem[]>([]);
  const [verifiableCash, setVerifiableCash] = useState<VerifiableItem[]>([]);

  useEffect(() => {
    const unsubInventory = subscribeToInventoryItems(setInventoryItems, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    const unsubAccounts = subscribeToAccounts(setAccounts, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    const unsubAudits = subscribeToAudits(setAudits, (e) => toast({ variant: 'destructive', title: 'Error', description: e.message }));
    setLoading(false);
    return () => {
      unsubInventory();
      unsubAccounts();
      unsubAudits();
    };
  }, [toast]);

  useEffect(() => {
    setVerifiableStock(inventoryItems.map(item => ({
      id: item.id,
      name: item.name,
      systemBalance: item.quantity,
      physicalBalance: '',
      difference: 0
    })));
  }, [inventoryItems]);

  useEffect(() => {
    setVerifiableCash(accounts.map(acc => ({
      id: acc.id,
      name: acc.name,
      systemBalance: acc.balance,
      physicalBalance: '',
      difference: 0
    })));
  }, [accounts]);

  const handleInputChange = (id: string, value: string, type: 'stock' | 'cash') => {
    const updater = (prevItems: VerifiableItem[]) => {
      return prevItems.map(item => {
        if (item.id === id) {
          const physical = parseFloat(value) || 0;
          const difference = physical - item.systemBalance;
          return { ...item, physicalBalance: value, difference };
        }
        return item;
      });
    };
    if (type === 'stock') setVerifiableStock(updater);
    else setVerifiableCash(updater);
  };
  
  const handleSaveAudit = async () => {
    setIsSaving(true);
    try {
        const auditItems: AuditItem[] = [
            ...verifiableStock.map(item => ({...item, type: 'stock', physicalBalance: parseFloat(item.physicalBalance as string) || 0 })),
            ...verifiableCash.map(item => ({...item, type: 'cash', physicalBalance: parseFloat(item.physicalBalance as string) || 0 }))
        ];
        
        if (auditItems.every(item => item.physicalBalance === 0 || item.physicalBalance === '')) {
            toast({ variant: 'destructive', title: 'Empty Audit', description: 'Please enter at least one physical count before saving.' });
            setIsSaving(false);
            return;
        }

        const newAudit: Omit<StockAudit, 'id'> = {
            createdAt: new Date().toISOString(),
            items: auditItems.filter(item => item.physicalBalance !== '' && !isNaN(item.physicalBalance as number)),
        };

        await saveAudit(newAudit);
        toast({ title: 'Success', description: 'Audit report saved successfully.'});
    } catch(e: any) {
        toast({ variant: 'destructive', title: 'Error', description: `Could not save audit: ${e.message}` });
    } finally {
        setIsSaving(false);
    }
  };

  const renderTable = (items: VerifiableItem[], type: 'stock' | 'cash') => (
    <div className="rounded-md border overflow-x-auto">
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{type === 'stock' ? 'Item Name' : 'Account Name'}</TableHead>
                    <TableHead className="text-right">System Balance</TableHead>
                    <TableHead className="w-40 text-right">Physical Count</TableHead>
                    <TableHead className="text-right">Difference</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {items.map(item => (
                    <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-right font-mono">{formatAmount(item.systemBalance)}</TableCell>
                        <TableCell>
                            <Input
                                type="number"
                                step="0.01"
                                value={item.physicalBalance}
                                onChange={e => handleInputChange(item.id, e.target.value, type)}
                                className="text-right"
                                placeholder="0.00"
                            />
                        </TableCell>
                        <TableCell className={cn("text-right font-mono", item.difference > 0 && "text-green-600", item.difference < 0 && "text-red-600")}>
                           {item.physicalBalance !== '' ? formatAmount(item.difference) : '-'}
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    </div>
  );
  
  const renderAuditHistory = () => (
     <Card>
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><History/> Audit History</CardTitle>
            <CardDescription>Review previously saved stock and cash audits.</CardDescription>
        </CardHeader>
        <CardContent>
            {audits.length > 0 ? (
                <Accordion type="single" collapsible className="w-full">
                    {audits.map(audit => (
                        <AccordionItem key={audit.id} value={audit.id}>
                            <AccordionTrigger>
                                <div className="flex justify-between w-full pr-4">
                                    <span>Audit of {formatDate(audit.createdAt)}</span>
                                    <Badge>View Details</Badge>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-4">
                                    <h4 className="font-semibold mt-2">Stock Audit</h4>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">System</TableHead><TableHead className="text-right">Physical</TableHead><TableHead className="text-right">Diff</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {audit.items.filter(i => i.type === 'stock').map(item => (
                                                <TableRow key={item.id}><TableCell>{item.name}</TableCell><TableCell className="text-right">{formatAmount(item.systemBalance)}</TableCell><TableCell className="text-right">{formatAmount(item.physicalBalance)}</TableCell><TableCell className={cn("text-right", item.difference > 0 ? 'text-green-600' : item.difference < 0 ? 'text-red-600' : '')}>{formatAmount(item.difference)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                    <h4 className="font-semibold mt-4">Cash/Bank Audit</h4>
                                      <Table>
                                        <TableHeader><TableRow><TableHead>Account</TableHead><TableHead className="text-right">System</TableHead><TableHead className="text-right">Physical</TableHead><TableHead className="text-right">Diff</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {audit.items.filter(i => i.type === 'cash').map(item => (
                                                <TableRow key={item.id}><TableCell>{item.name}</TableCell><TableCell className="text-right">{formatAmount(item.systemBalance)}</TableCell><TableCell className="text-right">{formatAmount(item.physicalBalance)}</TableCell><TableCell className={cn("text-right", item.difference > 0 ? 'text-green-600' : item.difference < 0 ? 'text-red-600' : '')}>{formatAmount(item.difference)}</TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            ) : (
                <p className="text-center text-muted-foreground p-8">No audit history found.</p>
            )}
        </CardContent>
     </Card>
  );


  return (
    <div>
      <div className="mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>

      <Tabs defaultValue="current_audit">
        <TabsList className="mb-4">
            <TabsTrigger value="current_audit"><ClipboardCheck className="mr-2 h-4 w-4" /> Current Audit</TabsTrigger>
            <TabsTrigger value="history"><History className="mr-2 h-4 w-4" /> History</TabsTrigger>
        </TabsList>
        <TabsContent value="current_audit">
            <Card>
                <CardHeader>
                <CardTitle className="flex items-center gap-2 text-2xl"><ClipboardCheck/> Stock & Cash Audit</CardTitle>
                <CardDescription>Physically verify your stock and cash balances against system records.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    {loading ? <div className="flex justify-center items-center h-48"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div> : 
                    (
                        <>
                            <div>
                                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Package/> Inventory Items</h3>
                                {renderTable(verifiableStock, 'stock')}
                            </div>
                             <div>
                                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Wallet/> Cash & Bank Accounts</h3>
                                {renderTable(verifiableCash, 'cash')}
                            </div>
                        </>
                    )}
                </CardContent>
                <CardFooter>
                    <Button onClick={handleSaveAudit} disabled={isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                        Save Audit Report
                    </Button>
                </CardFooter>
            </Card>
        </TabsContent>
        <TabsContent value="history">
            {renderAuditHistory()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
