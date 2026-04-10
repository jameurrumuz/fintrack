
"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatBalance, formatAmount } from '@/lib/utils';
import { Banknote, Landmark, Scale } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from './ui/switch';
import { Label } from './ui/label';

type BalanceItem = {
    name: string;
    amount: number;
    icon: React.ElementType;
    id: string;
}

interface BalanceSummaryProps {
  title: string;
  balances: { cash: number; bank: number; total: number; };
}

const BalanceCard = ({ title, amount, icon: Icon }: { title: string; amount: number; icon: React.ElementType }) => {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2 pb-1">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-2 pt-0">
                <div className={cn(
                    "font-bold text-base sm:text-lg lg:text-xl break-words",
                    amount >= 0 ? 'text-green-600' : 'text-red-600'
                )}>
                    {formatAmount(amount)}
                </div>
            </CardContent>
        </Card>
    );
};

export default function BalanceSummary({ title, balances }: BalanceSummaryProps) {
    const balanceItems = [
        { name: 'Cash', amount: balances.cash, icon: Banknote, id: 'cash' },
        { name: 'Bank', amount: balances.bank, icon: Landmark, id: 'bank' },
        { name: 'Total', amount: balances.total, icon: Scale, id: 'total' },
    ];


  return (
    <div>
      <h2 className="text-md font-semibold mb-2 text-gray-800 dark:text-gray-200">{title}</h2>
      <div className="grid gap-2 grid-cols-3">
        {balanceItems.map(item => (
            <BalanceCard 
                key={item.id} 
                title={item.name} 
                amount={item.amount} 
                icon={item.icon} 
            />
        ))}
      </div>
    </div>
  );
}
