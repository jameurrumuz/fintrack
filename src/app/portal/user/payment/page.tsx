
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { getAppSettings } from '@/services/settingsService';
import { addTransaction } from '@/services/transactionService';
import { incrementServiceUsage } from '@/services/partyService';
import type { AppSettings, CustomerService, InventoryItem, Party } from '@/types';
import { subscribeToInventoryItems } from '@/services/inventoryService';
import { Loader2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatAmount } from '@/lib/utils';
import { subscribeToPartyById } from '@/services/portalService';

function getCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
}

function PaymentStatusPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { toast } = useToast();

    const [status, setStatus] = useState<'processing' | 'success' | 'failure' | 'manual'>('processing');
    const [message, setMessage] = useState('Processing your payment status...');
    const [service, setService] = useState<CustomerService | null>(null);
    const [inventoryItem, setInventoryItem] = useState<InventoryItem | null>(null);
    const [party, setParty] = useState<Party | null>(null);
    const [trxId, setTrxId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);


    useEffect(() => {
        const paymentStatus = searchParams.get('status');
        const serviceId = searchParams.get('serviceId');
        const partyId = getCookie('loggedInPartyId');

        if (!paymentStatus || !serviceId || !partyId) {
            setStatus('failure');
            setMessage('Invalid payment verification link. Missing required information.');
            return;
        }
        
        const unsubParty = subscribeToPartyById(partyId, setParty, console.error);

        const processPayment = async () => {
            const settings = await getAppSettings();
            const service = settings?.customerServices?.find(s => s.id === serviceId);
            setService(service || null);

            if (!service) {
                setStatus('failure');
                setMessage('The requested service could not be found.');
                return;
            }

            const allInventory = await new Promise<InventoryItem[]>((resolve) => {
                const unsub = subscribeToInventoryItems(resolve, () => resolve([]));
                // This is a one-time fetch, so we can unsubscribe right away in a real app,
                // but for simplicity here we'll let it be.
            });
            const item = allInventory.find(i => i.id === service.productId);
            setInventoryItem(item || null);
            
            // This is the automatic success case
            if (paymentStatus === 'success') {
                setStatus('success');
                setMessage('Payment successful! Your transaction has been recorded.');
                try {
                     await handleRecordServicePayment(service, item || undefined, partyId, false);
                } catch (e: any) {
                    setMessage(`Payment recorded, but failed to create transaction: ${e.message}`);
                }
            } else {
                setStatus('manual');
                setMessage('Your payment is being processed. Please submit your Transaction ID for faster verification.');
            }
        };

        processPayment();
        return () => unsubParty();

    }, [searchParams]);

    const handleRecordServicePayment = async (
        serviceToRecord: CustomerService,
        item: InventoryItem | undefined,
        partyId: string,
        isManual: boolean,
        manualTrxId?: string
    ) => {
        setIsSubmitting(true);
        if (!partyId) {
            toast({ variant: 'destructive', title: 'Error', description: 'User not logged in.' });
            setIsSubmitting(false);
            return;
        }

        try {
            const txData: Omit<Transaction, 'id' | 'enabled'> = {
                date: new Date().toISOString().split('T')[0],
                description: `Service: ${serviceToRecord.name} ${isManual ? `(TrxID: ${manualTrxId})` : '(Auto-Verified)'}`,
                amount: item?.price || 0,
                type: serviceToRecord.type,
                partyId: partyId,
                via: 'Personal', // Or derive this from somewhere
                paymentStatus: isManual ? 'pending' : 'approved',
                enabled: !isManual, // Manual payments are not enabled until approved
                serviceId: serviceToRecord.id,
                items: item ? [{ id: item.id, name: item.name, quantity: serviceToRecord.quantity, price: item.price }] : undefined,
            };

            await addTransaction(txData);

            if (!isManual) {
                await incrementServiceUsage(partyId, serviceToRecord.id);
            }
            
            toast({
                title: isManual ? 'Request Submitted' : 'Service Recorded',
                description: isManual
                    ? 'Your payment is pending admin approval.'
                    : 'Your service has been recorded in your ledger.',
            });
            
            if (isManual) {
                 setStatus('success');
                 setMessage('Your payment verification request has been submitted successfully.');
            }

        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: `Could not record service: ${error.message}` });
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const renderContent = () => {
        switch (status) {
            case 'processing':
                return <div className="flex flex-col items-center gap-4"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p>{message}</p></div>;
            case 'success':
                return <div className="text-center"><CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" /><h2 className="text-2xl font-bold">Success!</h2><p>{message}</p></div>;
            case 'failure':
                return <div className="text-center"><AlertCircle className="h-16 w-16 text-destructive mx-auto mb-4" /><h2 className="text-2xl font-bold">Failed!</h2><p>{message}</p></div>;
            case 'manual':
                 if (!service) return null;
                 return (
                     <div className="space-y-4">
                        <p>{message}</p>
                        <Card className="bg-muted/50">
                             <CardHeader>
                                <CardTitle>Submit for Manual Verification</CardTitle>
                                <CardDescription>Service: {service.name}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <Label>Amount</Label>
                                    <Input value={formatAmount(inventoryItem?.price || 0)} readOnly />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="trxId">bKash/Nagad Transaction ID</Label>
                                    <Input id="trxId" value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="e.g., A1B2C3D4E5" />
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Button 
                                    onClick={() => handleRecordServicePayment(service, inventoryItem || undefined, party!.id, true, trxId)}
                                    disabled={!trxId || isSubmitting}
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin mr-2" /> : null}
                                    Submit for Verification
                                </Button>
                            </CardFooter>
                        </Card>
                     </div>
                 );
        }
    }

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle>Payment Status</CardTitle>
                </CardHeader>
                <CardContent>
                    {renderContent()}
                </CardContent>
                 <CardFooter>
                    <Button onClick={() => router.push('/portal/user/ledger')} className="w-full">Go to Dashboard</Button>
                </CardFooter>
            </Card>
        </div>
    );
}


export default function PaymentStatusPageWrapper() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <PaymentStatusPage />
        </Suspense>
    )
}
