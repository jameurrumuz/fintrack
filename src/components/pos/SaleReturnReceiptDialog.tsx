
"use client"
import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { formatAmount, formatDate, amountToWords } from '@/lib/utils';
import type { Transaction, Party, AppSettings, BusinessProfile } from '@/types';
import { Printer, Share2, Phone, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import html2canvas from 'html2canvas';
import Image from 'next/image';

interface SaleReturnReceiptDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  receipt: Transaction | null;
  party: Party | undefined;
  appSettings: AppSettings | null;
  onPrint: () => void;
  originalInvoice?: Transaction | null;
}

const SaleReturnReceiptDialog = React.forwardRef<HTMLDivElement, SaleReturnReceiptDialogProps>(
  ({ isOpen, onOpenChange, receipt, party, appSettings, onPrint, originalInvoice }, ref) => {
    const { toast } = useToast();
    const receiptContentRef = useRef<HTMLDivElement>(null);
    
    const businessProfile = appSettings?.businessProfiles.find(p => p.name === receipt?.via) || appSettings?.businessProfiles[0];

    React.useImperativeHandle(ref, () => receiptContentRef.current as HTMLDivElement);

     const handleShare = async () => {
        const element = receiptContentRef.current;
        if (!element || !receipt) {
            toast({ variant: 'destructive', title: "Error", description: "Could not find receipt content." });
            return;
        }

        toast({ title: "Generating image..." });
        try {
            const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: true });
            const dataUrl = canvas.toDataURL('image/png');
            const blob = await (await fetch(dataUrl)).blob();
            const file = new File([blob], `credit-note-${receipt.id.slice(0, 6)}.png`, { type: 'image/png' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({ files: [file], title: 'Credit Note' });
            } else {
                toast({ variant: 'destructive', title: "Share Not Supported", description: "Your browser does not support sharing files." });
            }
        } catch (error) {
            toast({ variant: 'destructive', title: 'Error', description: 'Could not generate shareable image.' });
        }
    };
    
    if (!receipt) return null;

    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader className="no-print">
            <DialogTitle>Credit Note</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[70vh]">
            <div ref={receiptContentRef} className="p-6 bg-white text-black text-sm">
                <header className="flex justify-between items-start pb-4 border-b">
                    <div className="flex items-center gap-4">
                        {businessProfile?.logoUrl && <Image src={businessProfile.logoUrl} alt="Logo" width={64} height={64} className="object-contain" />}
                        <div>
                            <h1 className="text-2xl font-bold">{businessProfile?.name}</h1>
                            <p className="text-xs">{businessProfile?.address}</p>
                            <p className="text-xs flex items-center gap-1"><Phone className="h-3 w-3"/>{businessProfile?.phone}</p>
                            <p className="text-xs flex items-center gap-1"><Mail className="h-3 w-3"/>{businessProfile?.email}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <h2 className="text-xl font-semibold uppercase">Credit Note</h2>
                        <p className="text-xs"><strong>Note #:</strong> {receipt.id.slice(0, 8)}</p>
                        <p className="text-xs"><strong>Date:</strong> {formatDate(receipt.date)}</p>
                    </div>
                </header>
                <section className="grid grid-cols-2 gap-4 my-4">
                    <div>
                        <h3 className="font-semibold text-gray-500 uppercase text-xs mb-1">Credit to</h3>
                        <p className="font-bold">{party?.name || 'N/A'}</p>
                        <p className="text-gray-600">{party?.address}</p>
                        <p className="text-gray-600">{party?.phone}</p>
                    </div>
                    {originalInvoice && (
                        <div className="text-right">
                             <h3 className="font-semibold text-gray-500 uppercase text-xs mb-1">Original Invoice</h3>
                             <p><strong>Invoice #:</strong> {originalInvoice.invoiceNumber?.replace('INV-', '')}</p>
                             <p><strong>Date:</strong> {formatDate(originalInvoice.date)}</p>
                             <p><strong>Amount:</strong> {formatAmount(originalInvoice.amount)}</p>
                        </div>
                    )}
                </section>
                <Table>
                    <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Item Returned</TableHead><TableHead className="text-center">Qty</TableHead><TableHead className="text-right">Unit Price</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {receipt.items?.map((item, i) => (
                            <TableRow key={item.id}>
                                <TableCell>{i + 1}</TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatAmount(item.price)}</TableCell>
                                <TableCell className="text-right">{formatAmount(item.price * item.quantity)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <div className="flex justify-end mt-4">
                    <div className="w-full max-w-xs space-y-2 text-sm">
                        <div className="flex justify-between font-bold text-base border-t pt-2">
                            <span>Credit Amount:</span>
                            <span>{formatAmount(receipt.amount)}</span>
                        </div>
                    </div>
                </div>
                 <div className="mt-4 pt-2 border-t">
                    <p className="text-xs text-gray-600 font-semibold mt-1">In Words: {amountToWords(receipt.amount)} Taka Only</p>
                </div>
                 <footer className="border-t pt-4 mt-6 text-xs text-gray-500 text-center">
                    <p>This credit note can be adjusted against future purchases.</p>
                </footer>
            </div>
          </div>
          <DialogFooter className="border-t pt-4 no-print">
            <Button variant="outline" onClick={handleShare}><Share2 className="mr-2 h-4 w-4"/>Share</Button>
            <Button variant="outline" onClick={onPrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
SaleReturnReceiptDialog.displayName = 'SaleReturnReceiptDialog';

export default SaleReturnReceiptDialog;
