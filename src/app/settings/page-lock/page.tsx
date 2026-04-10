
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
import type { AppSettings, PageSecurity } from '@/types';
import { Loader2, Lock, ShieldQuestion, User, Plus, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from '@/components/ui/input';

const allNavItems = [
    { href: "/", label: "Home", area: 'user' },
    { href: "/transactions", label: "Transactions", area: 'user' },
    { href: "/contacts", label: "Contacts", area: 'user' },
    { href: "/plan", label: "Plan", area: 'user' },
    { href: "/pos", label: "POS", area: 'user' },
    { href: "/po-rt", label: "PO", area: 'user' },
    { href: "/billing", label: "Billing", area: 'user' },
    { href: "/sale-returns", label: "Sale Returns", area: 'user' },
    { href: "/purchase-returns", label: "Purchase Returns", area: 'user' },
    { href: "/notes", label: "Notes", area: 'user' },
    { href: "/reminders", label: "Reminders", area: 'user' },
    { href: "/sms-reminder", label: "SMS", area: 'user' },
    { href: "/widgets", label: "Widgets", area: 'user' },
    { href: "/telegram-notification", label: "Telegram Notification", area: 'user' },
    
    { href: "/inventory", label: "Inventory", area: 'admin' },
    { href: "/accounts", label: "Accounts", area: 'admin' },
    { href: "/parties", label: "Parties", area: 'admin' },
    { href: "/auto-transactions", label: "Auto Transactions", area: 'admin' },
    { href: "/activity-log", label: "Activity Log", area: 'admin' },
    { href: "/log-record", label: "Log Record", area: 'admin' },
    { href: "/reports", label: "Reports", area: 'admin' },
    { href: "/business-report", label: "Business Report", area: 'admin' },
    { href: "/tools", label: "Tools", area: 'admin' },
    { href: "/toolkit", label: "Toolkit", area: 'admin' },
    { href: "/ecare", label: "Ecare", area: 'admin' },
    { href: "/service-and-care", label: "Service & Care", area: 'admin' },
    { href: "/web-seba", label: "Web Seba", area: 'admin' },
    { href: "/tasks", label: "Tasks", area: 'admin' },
    { href: "/missing-transaction-finder", label: "Missing Transaction Finder", area: 'admin' },
    { href: "/tools/find-trnx-with-sms", label: "Find Trnx With SMS", area: 'admin' },
    { href: "/tools/fitness-challenge", label: "Fitness Challenge", area: 'admin' },
    { href: "/tools/registration-database", label: "Registration DB", area: 'admin' },
    { href: "/lalmonirhat-elite-club", label: "Lalmonirhat Elite Club", area: 'admin' },
    { href: "/tools/news-management", label: "News Management", area: 'admin' },
    { href: "/settings", label: "Settings", area: 'admin' },
    { href: "/settings/page-lock", label: "Page Lock", area: 'admin' },
    { href: "/settings/shop-start-close", label: "Shop Start & Close", area: 'admin' },
    { href: "/reports/daily-balance-audit", label: "Daily Balance Audit", area: 'admin' },
    { href: "/news", label: "News", area: 'user' },
];


export default function PageLockSettings() {
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [newPagePath, setNewPagePath] = useState('');

    useEffect(() => {
        async function loadSettings() {
            setLoading(true);
            try {
                const settings = await getAppSettings();
                if (settings && !settings.pageSecurity) {
                    const initialPageSecurity: { [key: string]: PageSecurity } = {};
                    allNavItems.forEach(item => {
                        initialPageSecurity[item.href] = { area: item.area as 'admin' | 'user' };
                    });
                    settings.pageSecurity = initialPageSecurity;
                } else if (settings && settings.pageSecurity) {
                    let needsUpdate = false;
                    allNavItems.forEach(item => {
                        if (!settings.pageSecurity![item.href]) {
                            settings.pageSecurity![item.href] = { area: item.area as 'admin' | 'user' };
                            needsUpdate = true;
                        }
                    });
                    if (needsUpdate) {
                        await saveAppSettings({ pageSecurity: settings.pageSecurity });
                    }
                }
                setAppSettings(settings);
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Error loading settings', description: error.message });
            } finally {
                setLoading(false);
            }
        }
        loadSettings();
    }, [toast]);
    
    const handleLockToggle = async (pageHref: string, isLocked: boolean) => {
        if (!appSettings) return;

        const pageArea = appSettings.pageSecurity?.[pageHref]?.area || 'user';
        
        const adminLocked = new Set(appSettings.adminLockedPages || []);
        const userLocked = new Set(appSettings.userLockedPages || []);

        if (isLocked) {
            if (pageArea === 'admin') {
                adminLocked.add(pageHref);
            } else {
                userLocked.add(pageHref);
            }
        } else {
            adminLocked.delete(pageHref);
            userLocked.delete(pageHref);
        }

        const newSettings = {
            ...appSettings,
            adminLockedPages: Array.from(adminLocked),
            userLockedPages: Array.from(userLocked),
        };
        setAppSettings(newSettings);

        try {
            await saveAppSettings({
                adminLockedPages: Array.from(adminLocked),
                userLockedPages: Array.from(userLocked),
            });
            toast({
                title: 'Settings Updated',
                description: `Page '${pageHref}' has been ${isLocked ? 'locked' : 'unlocked'}.`
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Save' });
            const oldSettings = await getAppSettings();
            setAppSettings(oldSettings);
        }
    };
    
    const handleDisableToggle = async (pageHref: string, isDisabled: boolean) => {
        if (!appSettings) return;

        const newPageSecurity = {
            ...(appSettings.pageSecurity || {}),
            [pageHref]: {
                ...(appSettings.pageSecurity?.[pageHref] || { area: 'user' }),
                disabled: isDisabled,
            }
        };

        const newSettings = { ...appSettings, pageSecurity: newPageSecurity };
        setAppSettings(newSettings);

        try {
            await saveAppSettings({ pageSecurity: newPageSecurity });
            toast({
                title: 'Settings Updated',
                description: `Page '${pageHref}' has been ${isDisabled ? 'disabled' : 'enabled'}.`
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Save' });
            const oldSettings = await getAppSettings();
            setAppSettings(oldSettings);
        }
    };

    const handleDisabledNoticeChange = async (pageHref: string, notice: string) => {
        if (!appSettings) return;

        const newPageSecurity = {
            ...(appSettings.pageSecurity || {}),
            [pageHref]: {
                ...(appSettings.pageSecurity?.[pageHref] || { area: 'user' }),
                disabledNotice: notice.trim() || undefined,
            }
        };
        const newSettings = { ...appSettings, pageSecurity: newPageSecurity };
        setAppSettings(newSettings);
        
        try {
            await saveAppSettings({ pageSecurity: newPageSecurity });
            toast({
                title: 'Notice Updated',
            });
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Failed to Save Notice' });
             const oldSettings = await getAppSettings();
             setAppSettings(oldSettings);
        }
    };

    const handleAreaChange = async (pageHref: string, newArea: 'admin' | 'user') => {
        if (!appSettings) return;

        const currentPageSecurity = appSettings.pageSecurity || {};
        const oldArea = currentPageSecurity[pageHref]?.area || 'user';
        if (oldArea === newArea) return;

        const newPageSecurity = { 
            ...currentPageSecurity, 
            [pageHref]: { ...(currentPageSecurity[pageHref] || {}), area: newArea } 
        };
        
        const adminLocked = new Set(appSettings.adminLockedPages || []);
        const userLocked = new Set(appSettings.userLockedPages || []);
        
        const isCurrentlyLocked = adminLocked.has(pageHref) || userLocked.has(pageHref);

        adminLocked.delete(pageHref);
        userLocked.delete(pageHref);

        if (isCurrentlyLocked) {
            if (newArea === 'admin') {
                adminLocked.add(pageHref);
            } else {
                userLocked.add(pageHref);
            }
        }
        
        const newSettings = {
            ...appSettings, 
            pageSecurity: newPageSecurity,
            adminLockedPages: Array.from(adminLocked),
            userLockedPages: Array.from(userLocked),
        };
        setAppSettings(newSettings);

        try {
            await saveAppSettings({
                pageSecurity: newPageSecurity,
                adminLockedPages: Array.from(adminLocked),
                userLockedPages: Array.from(userLocked),
            });
            const pageLabel = allNavItems.find(p => p.href === pageHref)?.label || pageHref;
            toast({
                title: 'Security Area Updated',
                description: `Page '${pageLabel}' moved to ${newArea} area.`
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Save' });
            const oldSettings = await getAppSettings();
            setAppSettings(oldSettings);
        }
    };

    const handlePinChange = async (pageHref: string, newPin: string) => {
        if (!appSettings) return;

        const currentPageSecurity = appSettings.pageSecurity?.[pageHref] || { area: 'user' };
        const updatedPageSecurity = {
            ...currentPageSecurity,
            pin: newPin.trim() || undefined
        };

        const newSettings = {
            ...appSettings,
            pageSecurity: {
                ...(appSettings.pageSecurity || {}),
                [pageHref]: updatedPageSecurity,
            }
        };
        
        setAppSettings(newSettings);

        try {
            await saveAppSettings({ pageSecurity: newSettings.pageSecurity });
            toast({
                title: 'Custom PIN Updated',
                description: `Custom PIN for '${pageHref}' has been set.`,
            });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Save PIN' });
            const oldSettings = await getAppSettings();
            setAppSettings(oldSettings);
        }
    };

    const handleAddNewPagePath = async () => {
        if (!newPagePath.trim() || !newPagePath.startsWith('/')) {
            toast({
                variant: 'destructive',
                title: 'Invalid Path',
                description: 'Please enter a valid path starting with "/".'
            });
            return;
        }
        if (!appSettings) return;
    
        if (appSettings.pageSecurity?.[newPagePath.trim()]) {
            toast({
                title: 'Page Already Exists',
                description: 'This page path is already in the list.',
            });
            return;
        }

        const newPageSecurity = { ...(appSettings.pageSecurity || {}), [newPagePath.trim()]: { area: 'user' } as PageSecurity };
    
        const newSettings = { ...appSettings, pageSecurity: newPageSecurity };
        setAppSettings(newSettings);
    
        try {
            await saveAppSettings({ pageSecurity: newPageSecurity });
            toast({
                title: 'Page Added',
                description: `The page "${newPagePath.trim()}" has been added to the user area.`,
            });
            setNewPagePath('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Failed to Save' });
            const oldSettings = await getAppSettings();
            setAppSettings(oldSettings);
        }
      };

    const displayItems = useMemo(() => {
        const combinedItems = [...allNavItems];
        const existingHrefs = new Set(allNavItems.map(item => item.href));
    
        if (appSettings?.pageSecurity) {
          for (const href in appSettings.pageSecurity) {
            if (!existingHrefs.has(href)) {
              const label = href.split('/').pop()?.replace(/-/g, ' ') || href;
              const formattedLabel = label.charAt(0).toUpperCase() + label.slice(1);
              combinedItems.push({ href, label: formattedLabel, area: appSettings.pageSecurity[href].area });
              existingHrefs.add(href);
            }
          }
        }
        return combinedItems.sort((a, b) => a.label.localeCompare(b.label));
    }, [appSettings]);
    
    if (loading || !appSettings) {
        return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }
    
    const adminPages = displayItems.filter(p => appSettings.pageSecurity?.[p.href]?.area === 'admin');
    const userPages = displayItems.filter(p => appSettings.pageSecurity?.[p.href]?.area !== 'admin');
    const adminLockedSet = new Set(appSettings.adminLockedPages || []);
    const userLockedSet = new Set(appSettings.userLockedPages || []);

    const renderLockList = (pages: typeof displayItems) => (
        <div className="space-y-4">
            {pages.map((page) => (
                <div key={page.href} className="flex flex-col gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                        <div>
                            <Label htmlFor={`lock-${page.href}`} className="font-semibold text-base">
                                {page.label}
                            </Label>
                            <p className="text-sm text-muted-foreground">{page.href}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                            <Select
                                value={appSettings.pageSecurity?.[page.href]?.area || 'user'}
                                onValueChange={(value) => handleAreaChange(page.href, value as 'admin' | 'user')}
                            >
                                <SelectTrigger className="w-[120px] h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User Area</SelectItem>
                                    <SelectItem value="admin">Admin Area</SelectItem>
                                </SelectContent>
                            </Select>
                            <Button asChild variant="outline" size="icon" className="h-9 w-9">
                                <Link href={page.href} target="_blank">
                                    <ExternalLink className="h-4 w-4" />
                                </Link>
                            </Button>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                             <div className="space-y-1">
                                <Label className="text-xs font-normal">Custom PIN</Label>
                                <Input
                                type="password"
                                placeholder="Default PIN"
                                defaultValue={appSettings.pageSecurity?.[page.href]?.pin || ''}
                                onBlur={(e) => handlePinChange(page.href, e.target.value)}
                                className="h-9"
                                />
                            </div>
                            <div className="flex items-center gap-6 justify-end">
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id={`lock-${page.href}`}
                                        checked={adminLockedSet.has(page.href) || userLockedSet.has(page.href)}
                                        onCheckedChange={(checked) => handleLockToggle(page.href, checked)}
                                    />
                                    <Label htmlFor={`lock-${page.href}`} className="text-sm font-normal">Lock Page</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Switch
                                        id={`disable-${page.href}`}
                                        checked={appSettings.pageSecurity?.[page.href]?.disabled || false}
                                        onCheckedChange={(checked) => handleDisableToggle(page.href, checked)}
                                    />
                                    <Label htmlFor={`disable-${page.href}`} className="text-sm font-normal">Disable Page</Label>
                                </div>
                            </div>
                        </div>
                        
                        {appSettings.pageSecurity?.[page.href]?.disabled && (
                            <div className="space-y-1">
                                <Label className="text-xs font-normal">Disabled Notice</Label>
                                <Input
                                    placeholder="e.g., This page is under maintenance."
                                    defaultValue={appSettings.pageSecurity?.[page.href]?.disabledNotice || ''}
                                    onBlur={(e) => handleDisabledNoticeChange(page.href, e.target.value)}
                                    className="h-9"
                                />
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    );

    return (
        <div className="space-y-6">
             <div className="mb-6">
                <Button variant="outline" asChild><Link href="/settings">← Back to Settings</Link></Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock/> Page Lock Security</CardTitle>
                    <CardDescription>
                       Select which pages require a PIN to access. Admin pages share a session unlock, while User pages need individual unlocking.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex items-center gap-2 p-4 border rounded-lg bg-muted/50">
                        <Input
                            id="new-page-path"
                            placeholder="/tools/your-new-page"
                            value={newPagePath}
                            onChange={(e) => setNewPagePath(e.target.value)}
                        />
                        <Button onClick={handleAddNewPagePath} disabled={!newPagePath.trim()}>
                            <Plus className="mr-2 h-4 w-4" /> Add Page
                        </Button>
                    </div>
                </CardContent>
            </Card>
            
            <Tabs defaultValue="all">
                <TabsList>
                    <TabsTrigger value="all">All Pages ({displayItems.length})</TabsTrigger>
                    <TabsTrigger value="admin">Admin Area ({adminPages.length})</TabsTrigger>
                    <TabsTrigger value="user">User Area ({userPages.length})</TabsTrigger>
                </TabsList>
                <TabsContent value="all">
                    {renderLockList(displayItems)}
                </TabsContent>
                <TabsContent value="admin">
                     {renderLockList(adminPages)}
                </TabsContent>
                <TabsContent value="user">
                    {renderLockList(userPages)}
                </TabsContent>
            </Tabs>
        </div>
    )
}
