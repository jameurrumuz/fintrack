
'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { 
  Edit, RefreshCw, Printer, Share2, Phone, MessageSquare, 
  ArrowDown, ArrowUp, Wallet, Briefcase, Landmark, Package,
  TrendingUp, TrendingDown, MapPin
} from 'lucide-react';
import { formatAmount, cn } from '@/lib/utils';
import type { Party, AppSettings } from '@/types';

interface ProfileStatsProps {
  party: Party;
  currentBalance: number;
  analysis: any;
  appSettings: AppSettings | null;
  onEditParty: () => void;
  onRecalculate: () => void;
  setActiveTab: (tab: string) => void;
  onPrintStatement: () => void;
  onShareStatement: () => void;
  onOpenForm: (type: 'give' | 'receive' | 'spent' | 'credit_give' | 'credit_income') => void;
}

export default function ProfileStats({
  party,
  currentBalance,
  analysis,
  appSettings,
  onEditParty,
  onRecalculate,
  setActiveTab,
  onPrintStatement,
  onShareStatement,
  onOpenForm
}: ProfileStatsProps) {
  const isReceivable = currentBalance < 0;
  const isPayable = currentBalance > 0;

  return (
    <div className="bg-background border-b sticky top-0 z-20 shadow-sm">
      <header className="container mx-auto p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/10">
              <AvatarImage src={party.imageUrl} alt={party.name} />
              <AvatarFallback className="text-xl font-bold">{party.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{party.name}</h1>
                <Badge variant="secondary" className="text-xs">{party.partyType || 'Customer'}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> {party.phone || 'No Phone'}</span>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {party.address || 'No Address'}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEditParty}>
              <Edit className="h-4 w-4 mr-2" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={onRecalculate}>
              <RefreshCw className="h-4 w-4 mr-2" /> Sync
            </Button>
            <Button variant="outline" size="sm" onClick={onPrintStatement}>
              <Printer className="h-4 w-4 mr-2" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={onShareStatement}>
              <Share2 className="h-4 w-4 mr-2" /> Share
            </Button>
            <div className="flex gap-1 ml-2">
              <Button size="icon" variant="ghost" className="h-9 w-9 text-green-600" asChild>
                <a href={`tel:${party.phone}`}><Phone className="h-5 w-5" /></a>
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600" asChild>
                <a href={`https://wa.me/${party.phone?.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer">
                  <MessageSquare className="h-5 w-5" />
                </a>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <Card className={cn(
            "border-l-4 shadow-sm",
            isReceivable ? "border-l-green-500 bg-green-50/30" : isPayable ? "border-l-red-500 bg-red-50/30" : "border-l-muted"
          )}>
            <CardContent className="p-4">
              <p className="text-sm font-medium text-muted-foreground">
                {isReceivable ? "You will Receive" : isPayable ? "You will Give" : "Settled Balance"}
              </p>
              <p className={cn("text-2xl font-bold mt-1", isReceivable ? "text-green-600" : isPayable ? "text-red-600" : "")}>
                {formatAmount(Math.abs(currentBalance))}
              </p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-blue-500 shadow-sm bg-blue-50/30">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sale/Give</p>
                  <p className="text-xl font-bold mt-1">{formatAmount(analysis?.totalGive || 0)}</p>
                </div>
                <TrendingUp className="h-5 w-5 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-purple-500 shadow-sm bg-purple-50/30">
            <CardContent className="p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Collection/Recv</p>
                  <p className="text-xl font-bold mt-1">{formatAmount(analysis?.totalReceive || 0)}</p>
                </div>
                <TrendingDown className="h-5 w-5 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      </header>
    </div>
  );
}
