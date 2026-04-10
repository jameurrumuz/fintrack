
"use client"
import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { formatAmount, formatDate, amountToWords, getPartyBalanceEffect } from '@/lib/utils';
import type { Transaction, Party, AppSettings, BusinessProfile, Account } from '@/types';
import { Printer, Mail, Phone, Share2, MessageSquare, Truck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import QRCode from 'qrcode';
import Image from 'next/image';
import html2canvas from 'html2canvas';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import { subscribeToAllTransactions } from '@/services/transactionService';


interface InvoiceDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: Transaction | null;
  party: Party | undefined;
  parties: Party[];
  appSettings: AppSettings | null;
  onPrint: () => void;
  accounts: Account[];
  showCommunicationButtons?: boolean; // New prop
  allTransactions: Transaction[];
  customPartyName?: string;
}

const SmsLanguageDialog = ({ open, onOpenChange, onSend }: { open: boolean; onOpenChange: (open: boolean) => void; onSend: (lang: 'en' | 'bn', includeBalance: boolean) => void }) => {
    const [includeBalance, setIncludeBalance] = useState(true);
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Choose SMS Language</AlertDialogTitle>
                    <AlertDialogDescriptionComponent>Select the language for the SMS receipt.</AlertDialogDescriptionComponent>
                </AlertDialogHeader>
                 <div className="flex items-center space-x-2 my-4">
                    <Checkbox id="include-balance-receipt-sms" checked={includeBalance} onCheckedChange={(checked) => setIncludeBalance(!!checked)} />
                    <Label htmlFor="include-balance-receipt-sms">পূর্বের বকেয়াসহ</Label>
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <Button onClick={() => onSend('bn', includeBalance)}>Send Bengali</Button>
                    <Button onClick={() => onSend('en', includeBalance)}>Send English</Button>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};


const InvoiceDialog = React.forwardRef<HTMLDivElement, InvoiceDialogProps>(
  ({ isOpen, onOpenChange, invoice, party, parties, appSettings, onPrint, accounts = [], showCommunicationButtons = true, allTransactions, customPartyName }, ref) => {
  const { toast } = useToast();
  const invoiceContentRef = useRef<HTMLDivElement>(null);
  const customerCopyRef = useRef<HTMLDivElement>(null); // Ref for customer copy
  const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);
  
  const businessProfile = invoice?.businessProfile || (appSettings?.businessProfiles.find(p => p.name === invoice?.via) || appSettings?.businessProfiles[0]);

  const deliveryPerson = parties.find(p => p.id === invoice?.deliveredBy);

  // Moved QR Code generation here, as it doesn't need to be in InvoiceBody
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
  useEffect(() => {
    if (invoice && businessProfile) {
      const qrText = `Invoice: ${invoice.invoiceNumber}\nDate: ${invoice.date}\nAmount: ${formatAmount(invoice.amount)}\nFrom: ${businessProfile.name}`;
      QRCode.toDataURL(qrText, { width: 100, margin: 1 }, (err, url) => {
        if (err) {
          console.error('Failed to generate QR code', err);
          return;
        }
        setQrCodeDataUrl(url);
      });
    }
  }, [invoice, businessProfile]);
  
  React.useImperativeHandle(ref, () => invoiceContentRef.current as HTMLDivElement);
  
  const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const element = customerCopyRef.current;
    if (!element || !invoice) {
        toast({ variant: 'destructive', title: "Error", description: "Could not find invoice content to share." });
        return;
    }
    
    toast({ title: "Generating image...", description: "This may take a moment." });
    
    try {
        const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: true });
        
        canvas.toBlob(async (blob) => {
              if (!blob) {
                throw new Error("Canvas to Blob conversion failed.");
              }
              try {
                const file = new File([blob], `invoice-${invoice.invoiceNumber?.replace('INV-','') || 'shared'}.png`, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  await navigator.share({
                      files: [file],
                      title: `Invoice #${invoice.invoiceNumber?.replace('INV-','')}`,
                      text: `Invoice for ${party?.name || customPartyName || 'your purchase'}.`
                  });
                } else {
                   const dataUrl = canvas.toDataURL('image/png');
                   const link = document.createElement('a');
                   link.href = dataUrl;
                   link.download = file.name;
                   document.body.appendChild(link);
                   link.click();
                   document.body.removeChild(link);
                   toast({ title: "Share not supported", description: "Downloading invoice image instead." });
                }
              } catch (shareError) {
                 console.error("Image sharing failed:", shareError);
                 if (shareError instanceof Error && shareError.name !== 'AbortError') {
                   toast({ variant: 'destructive', title: 'Sharing Failed', description: 'Could not share the invoice image.' });
                 }
              }
            }, 'image/png');
    } catch (error) {
        console.error("Image generation failed:", error);
        toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not generate or share the image. Please try again.' });
    }
};



  const generateSmsMessage = (lang: 'en' | 'bn', includeBalance: boolean): string => {
    if (!invoice || !party) return '';

    const thisTransactionPayment = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
    
    const totalItemValue = invoice.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
    const discountAmount = invoice.discount || 0;
    const finalDeliveryCharge = invoice.deliveryChargePaidBy === 'customer' ? (invoice.deliveryCharge || 0) : 0;
    const payableAmount = totalItemValue - discountAmount + finalDeliveryCharge;
    
    const transactionsBeforeThisInvoice = allTransactions
        .filter(t => t.partyId === party.id && new Date(t.date) < new Date(invoice.date) && t.enabled)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        
    const previousBalance = transactionsBeforeThisInvoice.reduce((sum, tx) => sum + getPartyBalanceEffect(tx, false), 0);
    const currentBalance = previousBalance + getPartyBalanceEffect(invoice, false);

    const businessName = businessProfile?.name || 'our company';

    const partyBalanceText = (balance: number, language: 'en' | 'bn') => {
        if (language === 'bn') {
            if (balance > 0.01) return `${formatAmount(balance, false)} (আপনার দেনা)`;
            if (balance < -0.01) return `${formatAmount(Math.abs(balance), false)} (আপনার পাওনা)`;
        } else { // lang === 'en'
            if (balance > 0.01) return `${formatAmount(balance, false)} (Your Payable)`;
            if (balance < -0.01) return `${formatAmount(Math.abs(balance), false)} (Your Receivable)`;
        }
        return formatAmount(0, false);
    };

    const previousBalanceStr = partyBalanceText(previousBalance);
    const currentBalanceStr = partyBalanceText(currentBalance);
    
    let baseMessage: string;
    if (lang === 'bn') {
        baseMessage = `প্রিয় ${party.name}, আপনার চালান নং #${invoice.invoiceNumber?.replace('INV-', '') || ''} তৈরি হয়েছে। মোট বিল: ${formatAmount(payableAmount)}।`;
        if (thisTransactionPayment > 0) {
            baseMessage += ` আজকের জমা- ${formatAmount(thisTransactionPayment)},`;
        }
    } else {
        baseMessage = `Dear ${party.name}, your Invoice #${invoice.invoiceNumber?.replace('INV-', '') || ''} generated for BDT ${formatAmount(payableAmount)}.`;
        if (thisTransactionPayment > 0) {
            baseMessage += ` Paid: ${formatAmount(thisTransactionPayment)}.`;
        }
    }

    let balanceMessage = '';
    if (includeBalance) {
        if (lang === 'bn') {
            balanceMessage = ` পূর্বের ব্যালেন্স: ${previousBalanceStr}, বর্তমান ব্যালেন্স: ${currentBalanceStr}।`;
        } else {
            balanceMessage = ` Previous Balance: ${previousBalanceStr}, Current Balance: ${currentBalanceStr}.`;
        }
    }
    
    return `${baseMessage}${balanceMessage} ধন্যবাদ, ${businessName}`;
};



  const handleSendSms = (lang: 'en' | 'bn', includeBalance: boolean) => {
    if (!invoice || !party || !party.phone) {
        toast({
            variant: 'destructive',
            title: 'Cannot Send SMS',
            description: 'Customer phone number is not available.',
        });
        return;
    }
    
    const message = generateSmsMessage(lang, includeBalance);
    window.location.href = `sms:${party.phone}?body=${encodeURIComponent(message)}`;
    setIsSmsDialogOpen(false);
  };
  
  const handleSendWhatsapp = () => {
    if (!party?.phone) {
        toast({ variant: 'destructive', title: 'Cannot send message', description: 'Party phone number is missing.' });
        return;
    }
    const message = generateSmsMessage('en', true); // Defaulting to English with balance for WhatsApp
    let phoneNumber = party.phone.replace(/\s+/g, ''); // Remove spaces
    if (!phoneNumber.startsWith('+')) {
        phoneNumber = `+88${phoneNumber}`;
    }
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };
  
  if (!invoice) return null;
  
  return (
    <>
    <style>{`
        @media print {
            .no-print { display: none; }
            .print-area {
                visibility: visible !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                height: auto;
                float: none;
                background-color: white;
            }
             body > *:not(.print-area) {
                visibility: hidden;
                display: none;
            }
        }
    `}</style>
    <SmsLanguageDialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen} onSend={handleSendSms} />
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-full flex flex-col sm:h-auto sm:max-h-[90vh]">
        <DialogHeader className="no-print">
          <DialogTitle>Invoice #{invoice.invoiceNumber?.replace('INV-','')}</DialogTitle>
        </DialogHeader>
        <div className="flex-grow overflow-y-auto" >
            <div ref={invoiceContentRef} className="space-y-6 bg-white print-area">
                <div className="p-6" ref={customerCopyRef}>
                  <InvoiceBody 
                    invoice={invoice} 
                    businessProfile={businessProfile} 
                    party={party}
                    customPartyName={customPartyName} 
                    deliveryPerson={deliveryPerson} 
                    accounts={accounts} 
                    allTransactions={allTransactions} 
                    parties={parties} 
                    qrCodeDataUrl={qrCodeDataUrl}
                  />
                </div>
            </div>
        </div>
        <DialogFooter className="border-t pt-4 flex-shrink-0 no-print">
            <div className="flex justify-end gap-2 w-full">
                {showCommunicationButtons && (
                    <>
                        <Button variant="outline" onClick={() => setIsSmsDialogOpen(true)}><MessageSquare className="mr-2 h-4 w-4"/>Send SMS</Button>
                        <Button variant="outline" onClick={handleSendWhatsapp} className="bg-green-100 hover:bg-green-200 text-green-700">Send on WhatsApp</Button>
                    </>
                )}
                <Button variant="outline" onClick={onPrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
                <Button onClick={handleShare}><Share2 className="mr-2 h-4 w-4"/>Share</Button>
            </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  )
});
InvoiceDialog.displayName = 'InvoiceDialog';

export default InvoiceDialog;

// Sub-component for the invoice body to be reused
const InvoiceBody = ({ invoice, businessProfile, party, customPartyName, deliveryPerson, accounts, allTransactions, parties, qrCodeDataUrl }: { invoice: Transaction & { isPaid?: boolean, businessProfileAddress?: string; businessProfilePhone?: string; businessProfileName?: string, partyName?: string } | null, businessProfile: BusinessProfile | undefined, party: Party | undefined, customPartyName?: string, deliveryPerson: Party | undefined, accounts: Account[], allTransactions: Transaction[], parties?: Party[], qrCodeDataUrl: string }) => {

    if (!invoice) return null;

    const totalItemValue = invoice.items?.reduce((sum, item) => sum + item.price * item.quantity, 0) || 0;
    const discountAmount = invoice.discount || 0;
    const finalDeliveryCharge = invoice.deliveryChargePaidBy === 'customer' ? (invoice.deliveryCharge || 0) : 0;
    
    const payableAmount = totalItemValue - discountAmount + finalDeliveryCharge;
    
    const directPaidAmount = invoice.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;

    const subsequentPayments = allTransactions.filter(t =>
        t.type === 'receive' &&
        t.partyId === invoice.partyId &&
        t.description.includes(invoice.invoiceNumber || '---')
    ).reduce((sum, t) => sum + t.amount, 0);

    const totalPaidAmount = directPaidAmount + subsequentPayments;
    const dueAmount = payableAmount - totalPaidAmount;
    
    const getAccountName = (accountId: string) => accounts.find(a => a.id === accountId)?.name || 'Unknown Account';
    const partyMap = new Map((parties || []).map(p => [p.id, p.name]));
    
    const aggregatedItems = invoice.items?.reduce((acc, currentItem) => {
        const existingItem = acc.find(item => (item.id || item.name) === (currentItem.id || currentItem.name));
        if (existingItem) {
            existingItem.quantity += currentItem.quantity;
        } else {
            acc.push({ ...currentItem });
        }
        return acc;
    }, [] as typeof invoice.items);
    
    const displayedPartyName = customPartyName || party?.name || 'Walk-in Customer';

    return (
        <div className="bg-white text-black text-sm relative">
             {invoice.isPaid && (
              <div className="absolute inset-0 flex items-end justify-center z-0 pb-1/4">
                  <p className="text-8xl font-black text-green-500/10 print:text-gray-100 transform -rotate-30 select-none">PAID</p>
              </div>
            )}
            <div className="relative z-10">
                <header className="flex justify-between items-start pb-4 border-b">
                    <div className="flex items-center gap-4">
                        {businessProfile?.logoUrl && (
                            <Image src={businessProfile.logoUrl} alt={`${businessProfile?.name} logo`} width={64} height={64} className="object-contain print-image" />
                        )}
                        <div>
                            <h1 className="text-3xl font-bold text-gray-800">{invoice.businessProfileName || businessProfile?.name || 'Your Company'}</h1>
                            <p className="text-sm text-gray-500">{invoice.businessProfileAddress || businessProfile?.address}</p>
                            <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                                <Phone className="h-3 w-3"/>
                                <span>{invoice.businessProfilePhone || businessProfile?.phone}</span>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Mail className="h-3 w-3"/>
                                <span>{businessProfile?.email}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-2xl font-semibold uppercase text-gray-500">Invoice</h2>
                        <p className="text-sm"><strong>Invoice #:</strong> {invoice.invoiceNumber?.replace('INV-','')}</p>
                        <p className="text-sm"><strong>Date:</strong> {formatDate(invoice.date)}</p>
                    </div>
                </header>

                <section className="grid grid-cols-2 gap-4 my-4">
                    <div>
                        <h3 className="font-semibold text-gray-500 uppercase text-xs mb-1">Bill To</h3>
                        <p className="font-bold">{displayedPartyName}</p>
                        <p className="text-gray-600">{party?.address}</p>
                        <p className="text-gray-600">{party?.phone}</p>
                    </div>
                    {deliveryPerson && (
                    <div className="text-right">
                        <h3 className="font-semibold text-gray-500 uppercase text-xs mb-1">Delivered By</h3>
                        <div className="flex items-center justify-end gap-2 font-bold">
                            <Truck className="h-4 w-4"/> 
                            <span>{deliveryPerson.name}</span>
                        </div>
                        <p className="text-gray-600">{deliveryPerson.phone}</p>
                    </div>
                    )}
                </section>

                <Table>
                    <TableHeader>
                        <TableRow className="bg-gray-50">
                        <TableHead className="text-gray-600">#</TableHead>
                        <TableHead className="text-gray-600">Item</TableHead>
                        <TableHead className="text-center text-gray-600">Qty</TableHead>
                        <TableHead className="text-right text-gray-600">Unit Price</TableHead>
                        <TableHead className="text-right text-gray-600">Total</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(aggregatedItems || invoice.items)?.map((item, i) => (
                            <TableRow key={`${item.id}-${i}`} className="text-xs">
                                <TableCell className="font-medium">{i + 1}</TableCell>
                                <TableCell>
                                    {item.name}
                                    {item.date && <p className="text-xs text-muted-foreground">{formatDate(item.date)}</p>}
                                </TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatAmount(item.price)}</TableCell>
                                <TableCell className="text-right">{formatAmount(item.price * item.quantity)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>

                <div className="flex justify-end mt-4">
                    <div className="w-full max-w-sm space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-gray-500">Subtotal:</span>
                        <span className="font-medium">{formatAmount(totalItemValue)}</span>
                    </div>
                    {discountAmount > 0 && 
                        <div className="flex justify-between">
                            <span className="text-gray-500">Discount:</span>
                            <span className="font-medium">-{formatAmount(discountAmount)}</span>
                        </div>
                    }
                    {finalDeliveryCharge > 0 &&
                        <div className="flex justify-between">
                            <span className="text-gray-500">Delivery Charge:</span>
                            <span className="font-medium">{formatAmount(finalDeliveryCharge)}</span>
                        </div>
                    }
                    <div className="flex justify-between border-t pt-2 font-bold text-base">
                        <span>Payable Amount:</span>
                        <span>{formatAmount(payableAmount)}</span>
                    </div>
                    {totalPaidAmount > 0 && (
                        <div className="flex justify-between text-green-600">
                            <span>Paid:</span>
                            <span>{formatAmount(totalPaidAmount)}</span>
                        </div>
                    )}
                    {!invoice.isPaid && (
                        <div className="flex justify-between text-red-600 font-semibold">
                            <span>Due:</span>
                            <span>{formatAmount(dueAmount)}</span>
                        </div>
                    )}
                    </div>
                </div>

                <div className="mt-4 pt-2 border-t">
                    {invoice.payments && invoice.payments.length > 0 && (
                        <p className="text-xs text-gray-600">
                            Paid via {invoice.payments.map(p => `${getAccountName(p.accountId)} (${formatAmount(p.amount)})`).join(', ')}
                        </p>
                    )}
                    <p className="text-xs text-gray-600 font-semibold mt-1">
                        In Words: {amountToWords(payableAmount)} Taka Only
                    </p>
                </div>
                
                <footer className="border-t pt-4 mt-6 flex justify-between items-end">
                    <div className="text-center">
                        <div className="border-t border-gray-400 pt-1 w-32"></div>
                        <p className="text-xs text-gray-500">Authorized Signature</p>
                    </div>
                    {qrCodeDataUrl && <img src={qrCodeDataUrl} alt="QR Code" className="h-20 w-20" />}
                </footer>
            </div>
        </div>
    )
}

    

    