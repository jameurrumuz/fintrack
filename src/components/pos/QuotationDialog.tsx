"use client"
import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { formatAmount, formatDate } from '@/lib/utils';
import type { Quotation, AppSettings } from '@/types';
import { Printer, Share2 } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useToast } from '@/hooks/use-toast';
import { useReactToPrint } from 'react-to-print';

interface QuotationDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  quotation: Quotation | null;
  appSettings: AppSettings | null;
  onPrint?: () => void;
}

const QuotationDialog = React.forwardRef<HTMLDivElement, QuotationDialogProps>(
  ({ isOpen, onOpenChange, quotation, appSettings, onPrint }, ref) => {
    const quotationContentRef = useRef<HTMLDivElement>(null);
    const businessProfile = appSettings?.businessProfiles.find(p => p.name === quotation?.via) || appSettings?.businessProfiles[0];
    const { toast } = useToast();

    React.useImperativeHandle(ref, () => quotationContentRef.current as HTMLDivElement);

    const handlePrint = useReactToPrint({
      contentRef: quotationContentRef,
      documentTitle: `Quotation-${quotation?.quotationNumber || 'Doc'}`,
      suppressErrors: true,
      pageStyle: `
        @page {
          size: A4;
          margin: 20mm;
        }
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print { display: none !important; }
        }
      `,
    });

    const handleShare = async () => {
       const element = quotationContentRef.current;
      if (!element || !quotation) {
          toast({ variant: 'destructive', title: "Error", description: "Could not find quotation content to share." });
          return;
      }
      toast({ title: "Generating image..." });
      try {
          const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff', useCORS: true, allowTaint: true });
          const file = await new Promise<File | null>(resolve => canvas.toBlob(blob => blob ? resolve(new File([blob], `quotation-${quotation.quotationNumber}.png`, { type: 'image/png' })) : resolve(null)));
           
          if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({
                  files: [file],
                  title: `Quotation #${quotation.quotationNumber}`,
                  text: `Quotation for ${quotation.partyName}`
              });
          } else {
             toast({ variant: 'destructive', title: "Share Not Supported", description: "Your browser does not support sharing files." });
          }
      } catch (error) {
          console.error("Image generation or sharing failed:", error);
          toast({ variant: 'destructive', title: 'Action Failed', description: 'Could not generate or share the image.' });
      }
    };

    if (!quotation) return null;

    return (
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Quotation #{quotation.quotationNumber}</DialogTitle>
          </DialogHeader>
          
          <div className="overflow-y-auto max-h-[70vh] print:max-h-none print:overflow-visible">
            <div 
              ref={quotationContentRef} 
              className="p-6 bg-white text-black text-sm print:p-0 print:w-full"
            >
              <header className="flex justify-between items-start pb-4 border-b">
                <div>
                  <h1 className="text-xl font-bold text-gray-800">{businessProfile?.name || 'Your Company'}</h1>
                  <p className="text-xs text-gray-500">{businessProfile?.address}</p>
                </div>
                <div className="text-right">
                  <h2 className="text-lg font-semibold uppercase text-gray-500">Quotation</h2>
                  <p className="text-xs"><strong>Date:</strong> {formatDate(quotation.date)}</p>
                </div>
              </header>

              <section className="my-4">
                 <h3 className="font-semibold text-gray-500 uppercase text-xs mb-1">Quote To</h3>
                 <p className="font-bold">{quotation.partyName}</p>
              </section>

              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-gray-50 print:bg-gray-100">
                    <TableHead className="text-gray-600 font-bold border-b">#</TableHead>
                    <TableHead className="text-gray-600 font-bold border-b">Item</TableHead>
                    <TableHead className="text-center text-gray-600 font-bold border-b">Qty</TableHead>
                    <TableHead className="text-right text-gray-600 font-bold border-b">Unit Price</TableHead>
                    <TableHead className="text-right text-gray-600 font-bold border-b">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quotation.items.map((item, i) => (
                    <TableRow key={item.id} className="border-b">
                      <TableCell className="font-medium">{i + 1}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell className="text-center">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatAmount(item.price)}</TableCell>
                      <TableCell className="text-right">{formatAmount(item.price * item.quantity)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                    <TableRow>
                        <TableCell colSpan={4} className="text-right font-bold text-lg border-t pt-2">Total Amount</TableCell>
                        <TableCell className="text-right font-bold text-lg border-t pt-2">{formatAmount(quotation.totalAmount)}</TableCell>
                    </TableRow>
                </TableFooter>
              </Table>
              
               {quotation.notes && (
                 <div className="mt-4 pt-2 border-t">
                    <h4 className="font-semibold">Notes:</h4>
                    <p className="text-xs text-gray-600 whitespace-pre-wrap">{quotation.notes}</p>
                 </div>
               )}

              <footer className="border-t pt-4 mt-6 text-xs text-gray-500 text-center">
                 <p className="font-bold">Thank you for your interest!</p>
              </footer>
            </div>
          </div>
          <DialogFooter className="border-t pt-4 print:hidden">
            <Button variant="outline" onClick={handleShare}><Share2 className="mr-2 h-4 w-4"/>Share</Button>
            <Button variant="outline" onClick={handlePrint}><Printer className="mr-2 h-4 w-4"/>Print</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }
);
QuotationDialog.displayName = 'QuotationDialog';

export default QuotationDialog;
