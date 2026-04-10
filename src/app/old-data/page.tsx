

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { UploadCloud, FileText, FileUp, Loader2 } from 'lucide-react';
import { PdfDataTable } from '@/components/pdf-data-table';
import { extractDataFromPdf } from '@/ai/flows/extract-pdf-flow';
import { useToast } from "@/hooks/use-toast";
import { saveOldLedgerData } from '@/services/partyService';
import { Party } from '@/types';
import { subscribeToParties } from '@/services/partyService';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

type TableData = Record<string, string | number>;

function OldDataContent() {
  const searchParams = useSearchParams();
  const partyIdFromQuery = searchParams.get('partyId');
  const [data, setData] = useState<TableData[] | null>(null);
  const [fileNames, setFileNames] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [parties, setParties] = useState<Party[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState<string>('');
  const [startRow, setStartRow] = useState<number | undefined>(undefined);
  const [endRow, setEndRow] = useState<number | undefined>(undefined);


  const { toast } = useToast();
  
  useEffect(() => {
    if (partyIdFromQuery) {
        setSelectedPartyId(partyIdFromQuery);
    }
    const unsubscribe = subscribeToParties(setParties, (e) => toast({variant: 'destructive', title: 'Error', description: e.message}));
    return () => unsubscribe();
  }, [partyIdFromQuery, toast]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      
      const pdfFiles = Array.from(files).filter(file => file.type === 'application/pdf');

      if (pdfFiles.length === 0) {
        setError('Please upload at least one valid PDF file.');
        return;
      }

      setError('');
      setFileNames(pdfFiles.map(f => f.name));
      setIsLoading(true);
      setData(null); // Reset data when new files are uploaded

      const newExtractedData: TableData[] = [];
      
      try {
        for (const file of pdfFiles) {
          const pdfDataUri = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (error) => reject(error);
          });
          
          const result = await extractDataFromPdf({ pdfDataUri, startRow, endRow });
          
          if(result.data && !result.data.some(d => d.hasOwnProperty('error'))) {
            newExtractedData.push(...result.data);
          } else {
             toast({
              variant: "destructive",
              title: `Extraction Failed for ${file.name}`,
              description: "Could not extract data from this PDF. It might be an image-only PDF or have a complex layout.",
            });
          }
        }
        setData(newExtractedData);

      } catch (e) {
          console.error(e);
          setError('An error occurred during data extraction. Please check the files and try again.');
          toast({
            variant: "destructive",
            title: "Extraction Process Failed",
            description: "An unexpected error occurred while processing one or more files.",
          });
      } finally {
        setIsLoading(false);
      }
    }
  };
  
  const handleSaveLedger = async (ledgerData: TableData[]) => {
    if (!selectedPartyId) {
      toast({variant: 'destructive', title: 'No Party Selected', description: 'Please select a party to save the ledger data.'});
      return;
    }
    setIsSaving(true);
    try {
      await saveOldLedgerData(selectedPartyId, ledgerData);
      toast({title: 'Success!', description: `Old ledger data saved successfully for ${parties.find(p => p.id === selectedPartyId)?.name}.`});
      setData(null);
    } catch(e: any) {
       toast({variant: 'destructive', title: 'Save Failed', description: e.message});
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <main className="flex min-h-screen w-full flex-col items-center bg-background p-4 sm:p-8 pt-16">
      <div className="w-full max-w-6xl space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold tracking-tight text-primary sm:text-5xl">
            PDF Data Extractor
          </h1>
          <p className="mt-4 text-lg text-foreground/80">
            Upload PDF ledgers to extract and save historical transaction data for a party.
          </p>
        </div>
        
        <Card className="w-full shadow-lg">
          <CardHeader>
            <CardTitle>Upload PDFs</CardTitle>
            <CardDescription>Select a party and the corresponding PDF files to extract data from.</CardDescription>
          </CardHeader>
          <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="space-y-2 lg:col-span-2">
                    <Label>Select Party</Label>
                    <Select value={selectedPartyId} onValueChange={setSelectedPartyId}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a party to associate data with..." />
                        </SelectTrigger>
                        <SelectContent>
                            {parties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label>Start Row (Optional)</Label>
                    <Input type="number" placeholder="e.g., 1" value={startRow === undefined ? '' : startRow} onChange={(e) => setStartRow(e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
                 <div className="space-y-2">
                    <Label>End Row (Optional)</Label>
                    <Input type="number" placeholder="e.g., 100" value={endRow === undefined ? '' : endRow} onChange={(e) => setEndRow(e.target.value ? parseInt(e.target.value) : undefined)} />
                </div>
             </div>
            <div className="flex flex-col items-center justify-center w-full">
              <label htmlFor="pdf-upload" className="flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer bg-card hover:bg-accent/10 transition-colors">
                <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                  <UploadCloud className="w-10 h-10 mb-3 text-muted-foreground" />
                  <p className="mb-2 text-sm text-muted-foreground">
                    <span className="font-semibold text-accent">Click to upload</span> or drag and drop
                  </p>
                  <p className="text-xs text-muted-foreground">PDFs only (MAX. 5MB each)</p>
                  {fileNames.length > 0 && !error && (
                    <div className="mt-4 text-sm font-medium text-primary">
                        <p>Selected file(s):</p>
                        <ul className="list-disc list-inside">
                            {fileNames.map(name => <li key={name}>{name}</li>)}
                        </ul>
                    </div>
                  )}
                </div>
                <Input id="pdf-upload" type="file" className="hidden" accept="application/pdf" multiple onChange={handleFileChange} />
              </label>
              {error && <p className="mt-2 text-sm text-destructive font-medium">{error}</p>}
            </div>
          </CardContent>
        </Card>

        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-4 pt-8">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="animate-spin text-primary h-8 w-8" />
            </div>
            <p className="text-muted-foreground animate-pulse">Extracting data from {fileNames.length} file(s)... This may take a moment.</p>
          </div>
        )}

        {data && !isLoading && (
          <Card className="w-full shadow-lg">
            <CardHeader>
              <CardTitle>Extracted Data ({data.length} rows)</CardTitle>
              <CardDescription>Here is the combined data from your PDF(s). You can search, delete rows/columns, and save the final ledger to the selected party.</CardDescription>
            </CardHeader>
            <CardContent>
              <PdfDataTable initialData={data} onSave={handleSaveLedger} isSaving={isSaving} />
            </CardContent>
          </Card>
        )}
      </div>
    </main>
  );
}


export default function OldDataPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <OldDataContent />
        </Suspense>
    )
}
