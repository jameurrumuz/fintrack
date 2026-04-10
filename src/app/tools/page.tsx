'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { RefreshCw, Calculator, Train, MessageSquare, ListTree, HeartPulse, Zap, FilePlus, HandCoins, Users, Group, FileSignature, Search, Database, HardDriveDownload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';
import { recalculateAllPartyBalances } from '@/services/transactionService';
import { Loader2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

const tools = [
  {
    title: 'System Backup & Restore',
    description: 'Download a full JSON backup of your database or restore it from a file.',
    href: '/backupandrestore',
    icon: <HardDriveDownload className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Recalculate Party Balances',
    description: 'Fix balance discrepancies by recalculating all party balances from your transaction history.',
    action: 'recalculatePartyBalances',
    icon: <RefreshCw className="h-8 w-8 text-primary" />,
  },
  {
    title: 'Tour Planner',
    description: 'Manage tour expenses with friends.',
    href: '/tools/tour-planner',
    icon: <Group className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Costing Calculator',
    description: 'Calculate final product costs including transport and other expenses.',
    href: '/tools/costing-calculator',
    icon: <Calculator className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Family Registration',
    description: 'Register new family members with OTP verification.',
    href: '/tools/family-registration',
    icon: <Users className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Registration Database',
    description: 'View all submitted family registrations.',
    href: '/tools/registration-database',
    icon: <Database className="h-12 w-12 text-primary" />,
  },
  {
    title: '45-Day Fitness Challenge',
    description: 'Track your diet and exercise to achieve your weight loss goals.',
    href: '/tools/fitness-challenge',
    icon: <HeartPulse className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Manual Invoice Creator',
    description: 'Create and print an invoice manually without creating a transaction.',
    href: '/tools/manual-invoice',
    icon: <FilePlus className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Land Calculator',
    description: 'Calculate land inheritance shares based on Islamic Faraid law.',
    href: '/tools/land-calculation',
    icon: <Calculator className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Warisan Certificate',
    description: 'Create, print, and save inheritance certificates.',
    href: '/tools/warisan-certificate',
    icon: <Users className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Trade Licence Maker',
    description: 'Create, print, and save trade licenses.',
    href: '/tools/trade-licence',
    icon: <FileSignature className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Projection',
    description: 'View a projection of your receivables and payables.',
    href: '/tools/projection',
    icon: <HandCoins className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Train Tracker',
    description: 'Track Bangladesh Railway trains and check schedules.',
    href: '/tools/train-tracker',
    icon: <Train className="h-12 w-12 text-primary" />,
  },
  {
    title: 'SMS Sync',
    description: 'Sync and view SMS messages from a data source.',
    href: '/sms',
    icon: <MessageSquare className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Find Trnx With SMS',
    description: 'Reconcile transactions with SMS data.',
    href: '/tools/find-trnx-with-sms',
    icon: <Search className="h-12 w-12 text-primary" />,
  },
  {
    title: 'IP Ranges',
    description: 'Get Google Cloud and Firebase IP ranges for whitelisting.',
    href: '/tools/ip-ranges',
    icon: <ListTree className="h-12 w-12 text-primary" />,
  },
   {
    title: 'E-care',
    description: 'Track warranties, services, and costs for all your products.',
    href: '/ecare',
    icon: <HeartPulse className="h-12 w-12 text-primary" />,
  },
  {
    title: 'Electricity Management',
    description: 'Manage meter and consumer numbers for electricity bills.',
    href: '/tools/electricity',
    icon: <Zap className="h-12 w-12 text-primary" />,
  },
];

export default function ToolkitPage() {
    const { toast } = useToast();
    const [isRecalculating, setIsRecalculating] = useState(false);

    const handleRecalculate = async () => {
        setIsRecalculating(true);
        toast({ title: "Recalculation Started", description: "This might take a moment..." });
        try {
            const count = await recalculateAllPartyBalances();
            toast({ title: "Success!", description: `Recalculated balances for ${count} parties.` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsRecalculating(false);
        }
    }


  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Toolkit</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          A collection of powerful utilities for data management and maintenance.
        </p>
      </header>
      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {tools.map((tool) => {
            if (tool.action === 'recalculatePartyBalances') {
                return (
                    <AlertDialog key={tool.title}>
                        <AlertDialogTrigger asChild>
                            <Card className="hover:shadow-lg transition-shadow h-full flex flex-col items-center justify-center text-center p-6 cursor-pointer">
                                <CardHeader className="flex-row items-start gap-4 space-y-0">
                                    <div className="flex-shrink-0">{tool.icon}</div>
                                    <div>
                                        <CardTitle>{tool.title}</CardTitle>
                                        <CardDescription>{tool.description}</CardDescription>
                                    </div>
                                </CardHeader>
                            </Card>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Confirm Recalculation</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will recalculate all party balances based on their transaction history. Use this if you find discrepancies in due amounts.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleRecalculate} disabled={isRecalculating}>
                                     {isRecalculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                    Confirm & Recalculate
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                )
            }
            return (
              <Link key={tool.title} href={tool.href || '#'}>
                <Card className="hover:shadow-lg transition-shadow h-full flex flex-col items-center justify-center text-center p-6">
                  <CardHeader className="flex-row items-start gap-4 space-y-0">
                    <div className="flex-shrink-0">{tool.icon}</div>
                    <div>
                      <CardTitle>{tool.title}</CardTitle>
                      <CardDescription>{tool.description}</CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            )
        })}
      </div>
       <Card className="mt-8 bg-amber-50 border-amber-200 dark:bg-amber-900/20">
        <CardHeader>
            <CardTitle>How Automatic Calculation Works</CardTitle>
        </CardHeader>
        <CardContent>
            <p className="text-sm text-muted-foreground">
                Please note that your balances are designed to update automatically after every transaction. The "Recalculate" tools are powerful utilities meant for occasional use, such as fixing a data inconsistency or after a large, manual data import. It is not necessary to run them after every transaction.
            </p>
        </CardContent>
       </Card>
    </div>
  );
}
