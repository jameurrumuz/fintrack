
'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, Package, Eye, ShoppingBag, Truck, CheckCircle2, Clock, Calendar } from 'lucide-react';
import type { Transaction, Party } from '@/types';
import { subscribeToTransactionsForParty } from '@/services/transactionService';
import { subscribeToPartyById } from '@/services/portalService';
import { formatDate, formatAmount } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

const colors = {
    primary: '#1A05A2',
    secondary: '#8F0177',
    accent: '#DE1A58',
    gradient: 'from-[#1A05A2] via-[#8F0177] to-[#DE1A58]',
};

function getCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
}

function UserOrdersPageContent() {
    const [party, setParty] = useState<Party | null>(null);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const partyId = getCookie('loggedInPartyId');
        if (!partyId) {
            router.push('/portal/login');
            return;
        }

        const unsubParty = subscribeToPartyById(partyId, setParty, console.error);
        const unsubTx = subscribeToTransactionsForParty(partyId, setTransactions, console.error);
        
        const timer = setTimeout(() => setLoading(false), 500);

        return () => {
            unsubParty();
            unsubTx();
            clearTimeout(timer);
        };
    }, [router]);

    const orders = useMemo(() => {
        return transactions
            .filter(tx => (tx.type === 'sale' || tx.type === 'credit_sale') && tx.enabled)
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions]);
    
    if (loading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-[#1A05A2]" /></div>;
    }
    
    return (
        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 min-h-screen">
             <header className={cn("bg-gradient-to-r p-4 pt-8 rounded-b-3xl shadow-lg text-white sticky top-0 z-10", colors.gradient)}>
                <div className="container mx-auto flex items-center justify-between">
                    <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/20">
                        <Link href="/portal/user/dashboard">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-xl font-bold flex items-center gap-2"><ShoppingBag /> My Orders</h1>
                    <div className="w-10" />
                </div>
            </header>
            
            <main className="container mx-auto p-4 space-y-6 pb-20">
                <AnimatePresence>
                    {orders.length > 0 ? (
                        <div className="grid gap-4">
                            {orders.map((order, idx) => {
                                const totalItems = order.items?.reduce((sum, item) => sum + item.quantity, 0) || 0;
                                const isPaid = order.amount - (order.payments?.reduce((sum, p) => sum + p.amount, 0) || 0) <= 0.01;
                                const status = order.status || 'pending';

                                return (
                                    <motion.div
                                        key={order.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                    >
                                        <Card className="border-0 shadow-md hover:shadow-xl transition-all rounded-3xl bg-white overflow-hidden group">
                                            <CardHeader className="p-4 bg-gray-50/50 flex flex-row items-center justify-between border-b border-gray-100">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-tighter">Order #{order.invoiceNumber?.replace('INV-', '')}</span>
                                                    <Badge variant={isPaid ? "default" : "outline"} className={cn(isPaid ? "bg-green-500" : "text-orange-500 border-orange-200", "text-[8px] h-4 uppercase")}>
                                                        {isPaid ? 'Paid' : 'Due'}
                                                    </Badge>
                                                </div>
                                                <div className="text-right">
                                                    <span className="text-[10px] font-bold text-gray-400 flex items-center gap-1 justify-end">
                                                        <Calendar className="h-3 w-3" /> {formatDate(order.date)}
                                                    </span>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-4">
                                                <div className="flex justify-between items-end">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-2 text-sm font-bold text-gray-800">
                                                            <Package className="h-4 w-4 text-[#8F0177]" />
                                                            {totalItems} Items
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {status === 'delivered' ? (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase">
                                                                    <CheckCircle2 className="h-3 w-3" /> Delivered
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 text-[10px] font-bold text-orange-500 uppercase">
                                                                    <Clock className="h-3 w-3" /> {status}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className={`text-2xl font-black bg-gradient-to-r ${colors.gradient} bg-clip-text text-transparent`}>
                                                            ৳{order.amount.toLocaleString()}
                                                        </p>
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-20 bg-white rounded-3xl shadow-sm border border-dashed">
                            <ShoppingBag className="h-16 w-16 mx-auto text-gray-200 mb-4" />
                            <h3 className="text-lg font-bold text-gray-800">No Orders Yet</h3>
                            <p className="text-sm text-gray-400 mb-6 px-10">Start your shopping journey today!</p>
                            <Button asChild className={cn("rounded-2xl bg-gradient-to-r", colors.gradient)}>
                                <Link href="/store">Explore Store</Link>
                            </Button>
                        </div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

export default function UserOrdersPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-[#1A05A2]" /></div>}>
            <UserOrdersPageContent />
        </Suspense>
    );
}
