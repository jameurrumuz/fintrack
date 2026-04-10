
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow, TableFooter } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatAmount } from '@/lib/utils';
import type { InventoryItem, Account, Payment } from '@/types';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import Image from 'next/image';
import { Textarea } from '../ui/textarea';


interface CartItem extends InventoryItem {
  quantityInCart: number;
}
interface CheckoutDialogProps {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    cart: CartItem[];
    accounts: Account[];
    onConfirmOrder: (payments: Payment[], discount: number, notes: string) => Promise<void>;
    isCheckingOut: boolean;
}

export function CheckoutDialog({ isOpen, onOpenChange, cart, accounts, onConfirmOrder, isCheckingOut }: CheckoutDialogProps) {
    const [payments, setPayments] = useState<Payment[]>([]);
    const [discount, setDiscount] = useState(0);
    const [notes, setNotes] = useState('');

    useEffect(() => {
        if (isOpen) {
            // Reset state when dialog opens
            setPayments([]);
            setDiscount(0);
            setNotes('');
        }
    }, [isOpen]);

    const subTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantityInCart, 0), [cart]);
    const totalAmount = useMemo(() => subTotal - discount, [subTotal, discount]);
    const paidAmount = useMemo(() => payments.reduce((sum, p) => sum + p.amount, 0), [payments]);
    const dueAmount = useMemo(() => totalAmount - paidAmount, [totalAmount, paidAmount]);

    const handleAddPayment = () => {
        const defaultAccountId = accounts.find(a => a.name.toLowerCase() === 'cash')?.id || accounts[0]?.id || '';
        const remainingDue = totalAmount - paidAmount;
        setPayments([...payments, { accountId: defaultAccountId, amount: Math.max(0, remainingDue) }]);
    };

    const handlePaymentChange = (index: number, field: keyof Payment, value: string | number) => {
        const newPayments = [...payments];
        if (field === 'amount') {
            (newPayments[index] as any)[field] = parseFloat(value as string) || 0;
        } else {
            (newPayments[index] as any)[field] = value;
        }
        setPayments(newPayments);
    };

    const handleRemovePayment = (index: number) => {
        setPayments(payments.filter((_, i) => i !== index));
    };

    const handleConfirm = () => {
        onConfirmOrder(payments, discount, notes);
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>Complete Your Purchase</DialogTitle>
                    <DialogDescription>Review your order and add payment details.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <ScrollArea className="h-60">
                        <div className="space-y-3 pr-4">
                        {cart.map(item => (
                            <div key={item.id} className="flex items-center gap-4">
                                <Image src={item.imageUrl || ''} alt={item.name} width={48} height={48} className="rounded-md" />
                                <div className="flex-grow">
                                    <p className="font-semibold text-sm">{item.name}</p>
                                    <p className="text-xs text-muted-foreground">{item.quantityInCart} x {formatAmount(item.price)}</p>
                                </div>
                                <p className="font-semibold text-sm">{formatAmount(item.price * item.quantityInCart)}</p>
                            </div>
                        ))}
                        </div>
                    </ScrollArea>
                    <Separator />
                    <div className="space-y-2">
                        <div className="flex justify-between"><span>Subtotal</span><span>{formatAmount(subTotal)}</span></div>
                        <div className="flex justify-between items-center">
                            <Label htmlFor="discount">Discount</Label>
                            <Input id="discount" type="number" value={discount || ''} onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="w-28 h-8 text-right" placeholder="0.00" />
                        </div>
                        <div className="flex justify-between font-bold text-lg"><span>Total</span><span>{formatAmount(totalAmount)}</span></div>
                    </div>
                     <Separator />
                     <div className="space-y-2">
                        <Label>Payments</Label>
                        {payments.map((payment, index) => (
                             <div key={index} className="flex items-end gap-2">
                                <div className="flex-grow space-y-1">
                                    <Label className="text-xs">Account</Label>
                                    <Select value={payment.accountId} onValueChange={(v) => handlePaymentChange(index, 'accountId', v)}>
                                        <SelectTrigger><SelectValue placeholder="Select account..." /></SelectTrigger>
                                        <SelectContent>{accounts.map(acc => <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-grow space-y-1">
                                    <Label className="text-xs">Amount</Label>
                                    <Input type="number" value={payment.amount || ''} onChange={(e) => handlePaymentChange(index, 'amount', e.target.value)} />
                                </div>
                                <Button type="button" variant="destructive" size="icon" onClick={() => handleRemovePayment(index)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        ))}
                        <Button type="button" variant="outline" size="sm" onClick={handleAddPayment}><Plus className="mr-2 h-4 w-4"/> Add Payment</Button>
                     </div>
                      <div className="p-2 border rounded-md space-y-1 bg-muted/50">
                        <div className="flex justify-between font-semibold"><span>Paid Amount</span><span>{formatAmount(paidAmount)}</span></div>
                        <div className="flex justify-between font-bold text-red-600"><span>Due Amount</span><span>{formatAmount(dueAmount)}</span></div>
                    </div>
                     <div className="space-y-2">
                        <Label>Notes (Optional)</Label>
                        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes for this order..." />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleConfirm} className="w-full" disabled={isCheckingOut}>
                        {isCheckingOut && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Confirm Order
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

