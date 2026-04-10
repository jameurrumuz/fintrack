

'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, AlertCircle, RefreshCcw, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { processSmsAndCreateTransactions, fetchSheetData } from '@/services/smsSyncService';
import { useToast } from '@/hooks/use-toast';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
import type { AppSettings, SmsSyncSettings } from '@/types';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';


interface SheetRow {
  date: string;
  name: string;
  message: string;
}

const SmsSettings = ({ initialSettings, onSettingsSaved }: { initialSettings: AppSettings | null, onSettingsSaved: (newSettings: AppSettings) => void }) => {
    const [sheetId, setSheetId] = useState(initialSettings?.googleSheetId || '');
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();
    
    const handleSave = async () => {
        setIsSaving(true);
        try {
            const currentSettings = await getAppSettings() || {};
            const newSettings = { ...currentSettings, googleSheetId: sheetId };
            await saveAppSettings(newSettings as AppSettings);
            onSettingsSaved(newSettings as AppSettings);
            toast({ title: 'Success', description: 'Settings saved successfully.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSaving(false);
        }
    };
    
    const sheetUrl = sheetId ? `https://docs.google.com/spreadsheets/d/${sheetId}/edit` : '';

    return (
        <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
                <Card>
                    <AccordionTrigger className="p-4 hover:no-underline">
                        <CardHeader className="p-0 text-left">
                            <CardTitle className="flex items-center gap-2"><Settings/> Google Sheet Settings</CardTitle>
                            <CardDescription>Enter the ID of your public Google Sheet to sync SMS data.</CardDescription>
                        </CardHeader>
                    </AccordionTrigger>
                    <AccordionContent>
                        <CardContent className="pt-2 space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="sheetId">Google Sheet ID</Label>
                                <Input 
                                    id="sheetId"
                                    value={sheetId}
                                    onChange={(e) => setSheetId(e.target.value)}
                                    placeholder="e.g., 1-1TBUZW3NRdclur56XHrfoVHk-2-uKBvmWhigFzOdLA"
                                />
                                {sheetUrl && (
                                    <p className="text-xs text-muted-foreground">
                                        Current sheet link: <a href={sheetUrl} target="_blank" rel="noopener noreferrer" className="underline">{sheetUrl}</a>
                                    </p>
                                )}
                            </div>
                            <Alert>
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Important Setup Instructions</AlertTitle>
                                <AlertDescription>
                                    <ol className="list-decimal list-inside space-y-1">
                                        <li>Make sure your Google Sheet is shared so that "Anyone with the link" can <strong>view</strong>.</li>
                                        <li>Go to "File" &gt; "Share" &gt; "Publish to web".</li>
                                        <li>Publish the entire document as a <strong>Comma-separated values (.csv)</strong> file.</li>
                                    </ol>
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                        <CardFooter>
                            <Button onClick={handleSave} disabled={isSaving}>
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Save Settings
                            </Button>
                        </CardFooter>
                    </AccordionContent>
                </Card>
            </AccordionItem>
        </Accordion>
    )
}

const SmsDataDisplay = ({ settings, onSettingsChange }: { settings: AppSettings | null, onSettingsChange: (newSettings: AppSettings) => void }) => {
    const [data, setData] = useState<SheetRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const { toast } = useToast();
    
    const smsSyncSettings = settings?.smsSyncSettings || { autoReloadEnabled: true, reloadInterval: 60 };
    const { autoReloadEnabled, reloadInterval } = smsSyncSettings;

    useEffect(() => {
        const sheetId = settings?.googleSheetId;
        if (!sheetId) {
            setLoading(false);
            setError("Google Sheet ID is not configured. Please set it in the options above.");
            setData([]);
            return;
        }

        const fetchData = async () => {
            setLoading(true);
            setError(null);
            try {
                const parsedData = await fetchSheetData();
                setData(parsedData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            } catch (err) {
                console.error(err);
                setError(err instanceof Error ? err.message : 'An unknown error occurred.');
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        let intervalId: NodeJS.Timeout | null = null;
        if (autoReloadEnabled && reloadInterval > 0) {
            intervalId = setInterval(fetchData, reloadInterval * 1000);
        }

        return () => { if (intervalId) clearInterval(intervalId); };
    }, [autoReloadEnabled, reloadInterval, settings]);
    
    const handleUiSettingsChange = (updates: Partial<SmsSyncSettings>) => {
        const newSyncSettings = { ...smsSyncSettings, ...updates };
        const newSettings = { ...settings!, smsSyncSettings: newSyncSettings };
        onSettingsChange(newSettings);
        saveAppSettings(newSettings); // Persist to DB
    }

    const handleSyncNow = async () => {
        setIsSyncing(true);
        toast({ title: "Sync Started", description: "Processing SMS messages and creating transactions..." });
        try {
            const result = await processSmsAndCreateTransactions();
            toast({
                title: "Sync Complete",
                description: `${result.created} transactions created. ${result.errors} errors encountered.`,
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

    return (
         <Card>
            <CardHeader>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <CardTitle>SMS Log from Google Sheet</CardTitle>
                        <CardDescription>Displaying data directly from your public Google Sheet.</CardDescription>
                    </div>
                    <div className="p-3 border rounded-lg flex items-center gap-4">
                        <div className="flex items-center space-x-2">
                            <Switch id="auto-reload-switch" checked={autoReloadEnabled} onCheckedChange={(checked) => handleUiSettingsChange({ autoReloadEnabled: checked })} />
                            <Label htmlFor="auto-reload-switch">Auto Reload</Label>
                        </div>
                        <div className="flex items-center gap-2">
                            <Input type="number" value={reloadInterval} onChange={(e) => handleUiSettingsChange({ reloadInterval: parseInt(e.target.value, 10) || 60 })} className="w-20 h-8" min="5" disabled={!autoReloadEnabled} />
                            <Label>sec</Label>
                        </div>
                        <Button onClick={handleSyncNow} disabled={isSyncing}>
                            {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                            Sync Now
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {loading && (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="ml-4">Loading data from Google Sheet...</p>
                    </div>
                )}
                {error && (
                    <Alert variant="destructive">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Failed to load data</AlertTitle>
                        <AlertDescription>
                            <p>{error}</p>
                            <Button onClick={() => window.location.reload()} variant="secondary" className="mt-4">
                                Try Again
                            </Button>
                        </AlertDescription>
                    </Alert>
                )}
                {!loading && !error && (
                    <div className="rounded-md border overflow-x-auto max-h-[70vh]">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Sender</TableHead>
                                    <TableHead>Message</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {data.length > 0 ? (
                                    data.map((row, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{row.date}</TableCell>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell className="whitespace-pre-wrap break-words">{row.message}</TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-24 text-center">
                                            No data found in the sheet or the sheet is empty.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}


export default function SmsPage() {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);

    useEffect(() => {
        const loadInitialSettings = async () => {
            setLoadingSettings(true);
            const initialSettings = await getAppSettings();
            setSettings(initialSettings);
            setLoadingSettings(false);
        };
        loadInitialSettings();
    }, []);
    
    const handleSettingsChange = (newSettings: AppSettings) => {
        setSettings(newSettings);
    }

    if (loadingSettings) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>
    }

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
      <SmsSettings initialSettings={settings} onSettingsSaved={handleSettingsChange} />
      <SmsDataDisplay settings={settings} onSettingsChange={handleSettingsChange} />
    </div>
  );
}
