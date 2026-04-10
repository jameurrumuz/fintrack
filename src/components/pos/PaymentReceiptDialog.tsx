

"use client";

import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { formatAmount, formatDate, getPartyBalanceEffect, amountToWords } from '@/lib/utils';
import type { Transaction, Party, AppSettings, BusinessProfile, Account } from '@/types';
import { Printer, Mail, Phone, Share2, MessageSquare } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import Image from 'next/image';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';


interface PaymentReceiptDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  party: Party | undefined;
  appSettings: AppSettings | null;
  accounts?: Account[];
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


const PaymentReceiptDialog = React.forwardRef<HTMLDivElement, PaymentReceiptDialogProps>(
  ({ isOpen, onOpenChange, transaction, party, appSettings, accounts = [] }, ref) => {
    const receiptContentRef = useRef<HTMLDivElement>(null);
    const businessProfile = appSettings?.businessProfiles.find(p => p.name === transaction?.via) || appSettings?.businessProfiles[0];
    const { toast } = useToast();
    const [isSmsDialogOpen, setIsSmsDialogOpen] = useState(false);

    React.useImperativeHandle(ref, () => receiptContentRef.current as HTMLDivElement);

    const handlePrint = () => {
      const printable = receiptContentRef.current;
      if (printable) {
        const printWindow = window.open('', '_blank');
        printWindow?.document.write('<html><head><title>Print Receipt</title>');
        printWindow?.document.write('<style>@media print { .no-print { display: none; } }</style>');
        printWindow?.document.write('<link rel="stylesheet" href="https://unpkg.com/tailwindcss@^2/dist/tailwind.min.css">');
        printWindow?.document.write('</head><body class="p-4">');
        printWindow?.document.write(printable.innerHTML);
        printWindow?.document.write('</body></html>');
        printWindow?.document.close();
        printWindow?.print();
      }
    };

    const handleShare = async (event: React.MouseEvent<HTMLButtonElement>) => {
        const element = receiptContentRef.current;
        if (!element || !transaction) {
            toast({ variant: 'destructive', title: "Error", description: "Could not find receipt content to share." });
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
                const file = new File([blob], `receipt-${transaction.id.slice(0, 6) || 'shared'}.png`, { type: 'image/png' });
                if (navigator.canShare && navigator.canShare({ files: [file] })) {
                  await navigator.share({
                      files: [file],
                      title: 'Payment Receipt',
                      text: `Payment receipt for ${party?.name || 'your transaction'}.`
                  });
                } else {
                   const dataUrl = canvas.toDataURL('image/png');
                   const link = document.createElement('a');
                   link.href = dataUrl;
                   link.download = file.name;
                   document.body.appendChild(link);
                   link.click();
                   document.body.removeChild(link);
                   toast({ title: "Share not supported", description: "Downloading receipt image instead." });
                }
              } catch (shareError) {
                 console.error("Image sharing failed:", shareError);
                 if (shareError instanceof Error && shareError.name !== 'AbortError') {
                   toast({ variant: 'destructive', title: 'Sharing Failed', description: 'Could not share the receipt image.' });
                 }
              }
            }, 'image/png');
        } catch (error) {
            console.error("Image generation failed:", error);
            toast({ variant: 'destructive', title: 'Image Generation Failed', description: 'Could not generate image. Please try again.' });
        }
    };
    
    const generateSmsMessage = (lang: 'en' | 'bn', includeBalance: boolean): string => {
        if (!transaction || !party) return '';

        const previousBalance = transaction.previousBalance ?? 0;
        const currentBalance = previousBalance + getPartyBalanceEffect(transaction, false);
        const amountStr = formatAmount(transaction.amount);
        const businessName = businessProfile?.name || 'our company';

        const partyBalanceText = (balance: number, language: 'en' | 'bn') => {
            if (language === 'bn') {
                if (balance > 0.01) return `${formatAmount(balance)} (আপনার দেনা)`;
                if (balance < -0.01) return `${formatAmount(Math.abs(balance))} (আপনার পাওনা)`;
            } else { // lang === 'en'
                if (balance > 0.01) return `${formatAmount(balance)} (Your Payable)`;
                if (balance < -0.01) return `${formatAmount(Math.abs(balance))} (Your Receivable)`;
            }
            return formatAmount(0);
        };

        const previousBalanceStr = partyBalanceText(previousBalance, lang);
        const currentBalanceStr = partyBalanceText(currentBalance, lang);
        
        let baseMessage: string;
        if (lang === 'bn') {
            const verb = transaction.type === 'receive' ? 'আপনার কাছ থেকে গ্রহণ করা হলো' : 'আপনাকে প্রদান করা হলো';
            baseMessage = `প্রিয় ${party.name}, ${verb} ${amountStr}। তারিখ: ${formatDate(transaction.date)}। বিবরণ: ${transaction.description}।`;
        } else {
            const verb = transaction.type === 'receive' ? 'received from' : 'paid to';
            baseMessage = `Dear ${party.name}, BDT ${amountStr} has been ${verb} you. Date: ${formatDate(transaction.date)}. For: ${transaction.description}.`;
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
        if (!transaction || !party || !party.phone) {
            toast({ variant: 'destructive', title: 'Cannot send SMS', description: 'Party phone number is missing.'});
            return;
        }
        
        const message = generateSmsMessage(lang, includeBalance);
        const isDesktop = !/Mobi|Android/i.test(navigator.userAgent);
        
        if (isDesktop) {
            navigator.clipboard.writeText(message);
            toast({ title: 'Message Copied', description: 'SMS message copied to clipboard. Please paste it into your SMS application.' });
        } else {
            const intentUrl = `intent:${party.phone}?body=${encodeURIComponent(message)}#Intent;action=android.intent.action.VIEW;scheme=sms;end`;
            window.open(intentUrl, '_blank');
        }
        
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
    
    if (!transaction) return null;

    const previousBalance = transaction.previousBalance ?? 0;
    const isReceive = transaction.type === 'receive';
    const transactionAmount = transaction.amount;
    const currentBalance = previousBalance + getPartyBalanceEffect(transaction, false);
    const accountName = accounts.find(a => a.id === transaction.accountId)?.name || 'N/A';

    const partyBalanceText = (balance: number) => {
        if (balance > 0.01) return `${formatAmount(balance)} (Payable)`;
        if (balance < -0.01) return `${formatAmount(Math.abs(balance))} (Receivable)`;
        return formatAmount(0);
    };

    const previousBalanceText = partyBalanceText(previousBalance);
    const currentBalanceText = partyBalanceText(currentBalance);


    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <SmsLanguageDialog open={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen} onSend={handleSendSms} />
        <DialogContent className="max-w-xl">
          <DialogHeader className="no-print">
            <DialogTitle>{isReceive ? 'Payment Receipt' : 'Payment Voucher'}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto">
            <div ref={receiptContentRef} className="p-6 space-y-6 bg-white text-black text-sm">
              <header className="flex justify-between items-start pb-4 border-b">
                <div className="flex items-center gap-4">
                  {businessProfile?.logoUrl && (
                    <Image src={businessProfile.logoUrl} alt={`${businessProfile?.name} logo`} width={64} height={64} className="object-contain print-image" />
                  )}
                  <div>
                    <h1 className="text-xl font-bold text-gray-800">{businessProfile?.name || 'Your Company'}</h1>
                    <p className="text-xs text-gray-500">{businessProfile?.address}</p>
                     <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <Phone className="h-3 w-3"/><span>{businessProfile?.phone}</span>
                    </div>
                     <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Mail className="h-3 w-3"/><span>{businessProfile?.email}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-semibold uppercase text-gray-500">{isReceive ? 'Money Receipt' : 'Payment Voucher'}</h2>
                  <p className="text-xs"><strong>Voucher #:</strong> {transaction.id.slice(0, 8)}</p>
                  <p className="text-xs"><strong>Date:</strong> {formatDate(transaction.date)}</p>
                </div>
              </header>

              <section>
                 <p>
                  {isReceive ? 'Received with thanks from' : 'Paid to'} <span className="font-bold">{party?.name || 'N/A'}</span>
                  , the sum of <span className="font-bold">{formatAmount(transactionAmount)} BDT</span>
                  &nbsp;in <span className="font-bold">{accountName}</span>
                  &nbsp;for <span className="italic">{transaction.description}</span>.
                </p>
              </section>

              <Table className="border">
                <TableBody>
                  <TableRow>
                    <TableCell className="font-semibold">Previous Balance:</TableCell>
                    <TableCell className="text-right">{previousBalanceText}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">{isReceive ? 'Amount Received:' : 'Amount Paid:'}</TableCell>
                    <TableCell className={`text-right font-bold ${isReceive ? 'text-green-600' : 'text-red-600'}`}>{formatAmount(transactionAmount)}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold text-lg">Current Balance:</TableCell>
                    <TableCell className="text-right font-bold text-lg">{currentBalanceText}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              
              <footer className="border-t pt-4 mt-6 text-xs text-gray-500 text-center">
                 <p className="font-bold">Thank you for your business!</p>
                <p>This is a computer-generated receipt and does not require a signature.</p>
              </footer>
            </div>
          </div>
          <DialogFooter className="border-t pt-4 flex justify-end gap-2 no-print">
            <Button variant="outline" onClick={() => setIsSmsDialogOpen(true)}><MessageSquare className="mr-2 h-4 w-4"/>Send SMS</Button>
            <Button variant="outline" onClick={handleSendWhatsapp} className="bg-green-100 hover:bg-green-200 text-green-700">Send on WhatsApp</Button>
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
            <Button onClick={handleShare}><Share2 className="mr-2 h-4 w-4"/>Share</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
PaymentReceiptDialog.displayName = 'PaymentReceiptDialog';
export default PaymentReceiptDialog;

