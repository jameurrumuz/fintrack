
'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { 
  Plus, ArrowUp, ArrowDown, ShoppingCart, 
  Briefcase, Wallet, CreditCard, Landmark, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Party, AppSettings, Account } from '@/types';

interface ActionFooterProps {
  party: Party;
  appSettings: AppSettings | null;
  accounts: Account[];
  currentBalance: number;
  onOpenForm: (type: 'give' | 'receive' | 'spent' | 'credit_give' | 'credit_income') => void;
}

export default function ActionFooter({
  party,
  appSettings,
  accounts,
  currentBalance,
  onOpenForm
}: ActionFooterProps) {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t p-3 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] group-data-[state=expanded]/sidebar-wrapper:md:left-[var(--sidebar-width)] md:left-[var(--sidebar-width-icon)] transition-all duration-200 no-print">
      <div className="container mx-auto flex gap-3 max-w-4xl">
        <div className="grid grid-cols-2 gap-3 w-full">
          <Button 
            size="lg" 
            className="h-12 bg-red-600 hover:bg-red-700 text-white font-bold shadow-sm"
            onClick={() => onOpenForm('give')}
          >
            <ArrowUp className="mr-2 h-5 w-5" /> I Gave (৳)
          </Button>
          <Button 
            size="lg" 
            className="h-12 bg-green-600 hover:bg-green-700 text-white font-bold shadow-sm"
            onClick={() => onOpenForm('receive')}
          >
            <ArrowDown className="mr-2 h-5 w-5" /> I Received (৳)
          </Button>
        </div>
        
        <div className="hidden sm:flex gap-2">
          <Button size="lg" variant="secondary" className="h-12 px-6" asChild>
            <a href={`/pos?partyId=${party.id}`}>
              <ShoppingCart className="mr-2 h-5 w-5" /> Sale
            </a>
          </Button>
        </div>
      </div>
    </footer>
  );
}
