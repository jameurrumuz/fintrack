
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Bot, SlidersHorizontal, AlertCircle, Search, CheckCircle, XCircle, Info, RefreshCcw, SkipForward, Rss } from 'lucide-react';
import type { Transaction, Party, AppSettings, SmsSyncLog } from '@/types';
import { subscribeToAllTransactions } from '@/services/transactionService';
import { subscribeToParties } from '@/services/partyService';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
import { processSmsAndCreateTransactions } from '@/services/smsSyncService';
import { formatDate, formatAmount } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"


const SyncResultDisplay = ({ syncLog }: { syncLog: SmsSyncLog }) => (
    <Card className="bg-muted/50">
        <CardHeader className="pb-4">
            <CardTitle className="text-lg">Last Sync Results</CardTitle>
            <CardDescription>
                Synced on {formatDate(syncLog.date)} at {new Date(syncLog.date).toLocaleTimeString()}
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
                <div className="p-2 bg-green-100 rounded-md">
                    <p className="text-2xl font-bold text-green-700">{syncLog.created}</p>
                    <p className="text-sm font-medium text-green-600">Created</p>
                </div>
                 <div className="p-2 bg-yellow-100 rounded-md">
                    <p className="text-2xl font-bold text-yellow-700">{syncLog.skipped}</p>
                    <p className="text-sm font-medium text-yellow-600">Skipped</p>
                </div>
                 <div className="p-2 bg-red-100 rounded-md">
                    <p className="text-2xl font-bold text-red-700">{syncLog.errors}</p>
                    <p className="text-sm font-medium text-red-600">Errors</p>
                </div>
            </div>
        </CardContent>
    </Card>
)

const LatestSmsDisplay = ({ syncLog }: { syncLog: SmsSyncLog | null }) => {
    const latestSms = useMemo(() => {
        if (!syncLog || !syncLog.results || syncLog.results.length === 0) {
            return null;
        }
        // Assuming the first result is the most recent one processed
        return syncLog.results[0].sms;
    }, [syncLog]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Rss/> Last Processed SMS</CardTitle>
                <CardDescription>The most recent SMS message processed during the last sync.</CardDescription>
            </CardHeader>
            <CardContent>
                {latestSms ? (
                    <div className="p-3 bg-muted rounded-md space-y-1">
                        <p className="text-sm"><strong>From:</strong> {latestSms.name}</p>
                        <p className="text-sm"><strong>Message:</strong> {latestSms.message}</p>
                    </div>
                ) : (
                    <div className="text-center py-8 text-muted-foreground">
                        <p>No SMS processed in the last sync.</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


export default function AutoTransactionsPage() {
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setLoading(true);
    const fetchSettings = async () => {
        const settings = await getAppSettings();
        setAppSettings(settings);
        setLoading(false);
    };

    fetchSettings();
  }, [toast]);
  
  const handleSyncNow = async () => {
    setIsSyncing(true);
    toast({ title: "Sync Started", description: "Processing SMS messages..." });
    try {
        const result = await processSmsAndCreateTransactions();
        // Update the local state to show the new log immediately
        setAppSettings(prev => ({...prev!, lastSyncResult: result}));
        toast({
            title: "Sync Complete",
            description: `${result.created} transactions created.`,
        });
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: "Sync Failed",
            description: error.message,
        });
    } finally {
        setIsSyncing(false);
    }
  };

  const getStatusIcon = (status: 'success' | 'skipped' | 'error') => {
      switch (status) {
          case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
          case 'skipped': return <SkipForward className="h-4 w-4 text-yellow-500" />;
          case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
      }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-2xl"><Bot /> Auto-Transaction Log</CardTitle>
              <CardDescription>Monitor and debug transactions created automatically via SMS sync.</CardDescription>
            </div>
            <div className="flex gap-2">
                <Button onClick={handleSyncNow} disabled={isSyncing}>
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <RefreshCcw className="mr-2 h-4 w-4"/>}
                    Sync Now
                </Button>
                <Button asChild variant="outline">
                    <Link href="/settings"><SlidersHorizontal className="mr-2 h-4 w-4"/> Configure Rules</Link>
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
            {loading ? (
                 <div className="flex justify-center items-center h-24"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
            ) : appSettings?.lastSyncResult ? (
                 <SyncResultDisplay syncLog={appSettings.lastSyncResult} />
            ) : (
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Run a sync to see the results here.</p>
                </div>
            )}
        </CardContent>
      </Card>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LatestSmsDisplay syncLog={appSettings?.lastSyncResult || null} />

        <Card>
            <CardHeader>
                <CardTitle>SMS Processing Details</CardTitle>
                <CardDescription>Detailed log of each SMS processed during the last sync.</CardDescription>
            </CardHeader>
            <CardContent>
            {loading ? (
                <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin h-8 w-8 text-primary"/></div>
            ) : appSettings?.lastSyncResult && appSettings.lastSyncResult.results.length > 0 ? (
                <div className="rounded-md border max-h-96 overflow-y-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>From</TableHead>
                        <TableHead>Message</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {appSettings.lastSyncResult.results.map((res, i) => (
                        <TableRow key={`res-${i}`} className={cn(res.status === 'error' && 'bg-red-50/50')}>
                        <TableCell className="font-medium">{res.sms.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{res.sms.message}</TableCell>
                        <TableCell>
                            <Badge variant={res.status === 'success' ? 'default' : res.status === 'skipped' ? 'secondary' : 'destructive'} className={cn('capitalize', res.status === 'success' && 'bg-green-100 text-green-700')}>
                                {getStatusIcon(res.status)}
                                <span className="ml-1">{res.status}</span>
                            </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                            {res.status === 'success' && <Badge variant="outline">{res.ruleName}</Badge>}
                            {res.status !== 'success' && res.reason}
                        </TableCell>
                        <TableCell className="text-right font-mono">{res.amount ? formatAmount(res.amount) : '-'}</TableCell>
                        </TableRow>
                    ))}
                    </TableBody>
                </Table>
                </div>
            ) : (
                <div className="text-center py-16">
                    <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
                    <h3 className="mt-4 text-lg font-medium">No Sync Data Found</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                    Run a sync or check your rules if you're expecting to see data here.
                    </p>
                </div>
            )}
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
