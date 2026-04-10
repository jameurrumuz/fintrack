

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Printer, Save, Plus, Trash2, Edit } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { Heir, TradeLicence } from '@/types';
import { addTradeLicence, subscribeToTradeLicences, updateTradeLicence, deleteTradeLicence } from '@/services/tradeLicenceService';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {formatDate as formatDateUtil} from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uploadImage } from '@/services/storageService';
import QRCode from 'qrcode';


interface LicenceField {
    id: string;
    label: string;
    value: string;
    order: number;
}


export default function TradeLicenceMakerPage() {
    // Authority Info
    const [municipalityName, setMunicipalityName] = useState('লালমনিরহাট পৌরসভা');
    const [mayorName, setMayorName] = useState('মেয়র');
    const [executiveOfficerName, setExecutiveOfficerName] = useState('পৌর নির্বাহী কর্মকর্তা');
    const [inspectorName, setInspectorName] = useState('লাইসেন্স পরিদর্শক');
    
    // License Info - now part of licenceFields
    const [licenceFields, setLicenceFields] = useState<LicenceField[]>([
        { id: 'licenceNo', label: 'লাইসেন্স নং', value: '', order: 1 },
        { id: 'licenceId', label: 'লাইসেন্স আইডি', value: '', order: 2 },
        { id: 'wardNo', label: 'ওয়ার্ড নং', value: '', order: 3 },
        { id: 'circle', label: 'সার্কেল/রাস্তা/মহল্লা', value: '', order: 4 },
        { id: 'issueDate', label: 'লাইসেন্স ইস্যুর তারিখ', value: '', order: 5 },
        { id: 'renewalYear', label: 'নবায়নের অর্থ বছর', value: '', order: 6 },
        { id: 'renewalDate', label: 'নবায়নের তারিখ', value: '', order: 7 },
    ]);
    const [expiryYear, setExpiryYear] = useState('২০২৫');
    
    // Business Info
    const [businessName, setBusinessName] = useState('রুশাইব ট্রেডার্স');
    const [businessType, setBusinessType] = useState('198-মোটর/যান্ত্রিক পার্টসের দোকান');
    const [ownerName, setOwnerName] = useState('প্রোঃ মোঃ জামেউর রুমুজ');
    const [fatherName, setFatherName] = useState('মোঃ আব্দুল আজিজ');
    const [motherName, setMotherName] = useState('মোছাঃ রহিমা বেগম');
    const [businessAddress, setBusinessAddress] = useState('হোল্ডিং নং: ০১/০৭৩৭ দোকান নং: মহির উদ্দিন প্রামানিক মার্কেট,বটতলা,মোগলহাট রোড়,লালমনিরহাট');
    const [ownerPresentAddress, setOwnerPresentAddress] = useState('মহির উদ্দিন প্রামানিক মার্কেট,বটতলা,মোগলহাট রোড়,লালমনিরহাট');
    const [ownerPermanentAddress, setOwnerPermanentAddress] = useState('মহির উদ্দিন প্রামানিক মার্কেট,বটতলা,মোগলহাট রোড়,লালমনিরহাট');
    const [nid, setNid] = useState('১৯৯২৫২২৫৫০১০০০০৪৩');
    const [phone, setPhone] = useState('০১৯৪৮৪৮১১৪৮');
    const [tin, setTin] = useState('');
    
    // Financial Info
    const [fees, setFees] = useState<Omit<Heir, 'relation' | 'is_alive' | 'nid' | 'dob' | 'comment' >[]>([
        { description: 'ট্রেড লাইসেন্স/নবায়ন ফি', amount: 1500.00 },
        { description: 'সাইনবোর্ড কর', amount: 0.00 },
        { description: 'বিবিধ', amount: 0.00 },
        { description: 'বকেয়া', amount: 0.00 },
        { description: 'সারচার্জ', amount: 0.00 },
    ]);
    const [collection, setCollection] = useState<Omit<Heir, 'relation' | 'is_alive' | 'nid' | 'dob' | 'comment' >[]>([
        { description: 'হাল সারচার্জ', amount: 0.00 },
        { description: 'ভ্যাট', amount: 225.00 },
        { description: 'ভ্যাট বকেয়া', amount: 0.00 },
        { description: 'আয়কর', amount: 0.00 },
        { description: 'আয়কর বকেয়া', amount: 0.00 },
    ]);
    
    // Image states
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>('/lalmonirhat-logo.png');
    const [mayorSignatureFile, setMayorSignatureFile] = useState<File | null>(null);
    const [mayorSignaturePreview, setMayorSignaturePreview] = useState<string | null>(null);
    const [officerSignatureFile, setOfficerSignatureFile] = useState<File | null>(null);
    const [officerSignaturePreview, setOfficerSignaturePreview] = useState<string | null>(null);
    const [inspectorSignatureFile, setInspectorSignatureFile] = useState<File | null>(null);
    const [inspectorSignaturePreview, setInspectorSignaturePreview] = useState<string | null>(null);
    const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');
    const [fontSize, setFontSize] = useState(16);
    const [watermarkSize, setWatermarkSize] = useState(50);


    // Save/Load states
    const [savedLicences, setSavedLicences] = useState<TradeLicence[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [originalImageUrls, setOriginalImageUrls] = useState<{ logoUrl?: string; mayorSignatureUrl?: string; officerSignatureUrl?: string; inspectorSignatureUrl?: string; }>({});


    const certificateRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        const unsub = subscribeToTradeLicences(setSavedLicences, (err) => {
            toast({ variant: 'destructive', title: 'Error loading saved licenses', description: err.message });
        });
        return () => unsub();
    }, [toast]);
    
    // Generate QR Code
    useEffect(() => {
        const qrText = `Licence No: ${licenceFields.find(f=>f.id === 'licenceNo')?.value}\nBusiness: ${businessName}\nOwner: ${ownerName}`;
        QRCode.toDataURL(qrText, { width: 80, margin: 1, errorCorrectionLevel: 'H' }, (err, url) => {
            if (err) return;
            setQrCodeDataUrl(url);
        });
    }, [licenceFields, businessName, ownerName]);

    const totalFees = fees.reduce((acc, fee) => acc + fee.amount, 0);
    const totalCollection = collection.reduce((acc, item) => acc + item.amount, 0);
    const grandTotal = totalFees + totalCollection;
    
    const handlePrint = () => {
        const printableArea = certificateRef.current;
        if (printableArea) {
            const printWindow = window.open('', '_blank');
            printWindow?.document.write(`<html><head><title>Trade Licence</title><style>@import url('https://fonts.googleapis.com/css2?family=SolaimanLipi&display=swap');</style><script src="https://cdn.tailwindcss.com"><\/script></head><body class="p-8" style="font-family: 'SolaimanLipi', sans-serif;">`);
            printWindow?.document.write(printableArea.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            printWindow?.focus();
            printWindow?.print();
        }
    };
    
    const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>, previewSetter: React.Dispatch<React.SetStateAction<string | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setter(file);
            previewSetter(URL.createObjectURL(file));
        }
    };
    
    const resetForm = () => {
        setMunicipalityName('লালমনিরহাট পৌরসভা'); setMayorName('মেয়র'); setExecutiveOfficerName('পৌর নির্বাহী কর্মকর্তা'); setInspectorName('লাইসেন্স পরিদর্শক');
        setLicenceFields(prev => prev.map(f => ({ ...f, value: '' })));
        setExpiryYear('২০২৫');
        setBusinessName('রুশাইব ট্রেডার্স'); setBusinessType('198-মোটর/যান্ত্রিক পার্টসের দোকান'); setOwnerName('প্রোঃ মোঃ জামেউর রুমুজ');
        setFatherName('মোঃ আব্দুল আজিজ'); setMotherName('মোছাঃ রহিমা বেগম'); setBusinessAddress('হোল্ডিং নং: ০১/০৭৩৭ দোকান নং: মহির উদ্দিন প্রামানিক মার্কেট,বটতলা,মোগলহাট রোড়,লালমনিরহাট');
        setOwnerPresentAddress('মহির উদ্দিন প্রামানিক মার্কেট,বটতলা,মোগলহাট রোড়,লালমনিরহাট'); setOwnerPermanentAddress('মহির উদ্দিন প্রামানিক মার্কেট,বটতলা,মোগলহাট রোড়,লালমনিরহাট');
        setNid('১৯৯২৫২২৫৫০১০০০০৪৩'); setPhone('০১৯৪৮৪৮১১৪৮'); setTin('');
        setFees([ { description: 'ট্রেড লাইসেন্স/নবায়ন ফি', amount: 1500.00 }, { description: 'সাইনবোর্ড কর', amount: 0.00 }, { description: 'বিবিধ', amount: 0.00 }, { description: 'বকেয়া', amount: 0.00 }, { description: 'সারচার্জ', amount: 0.00 }, ]);
        setCollection([ { description: 'হাল সারচার্জ', amount: 0.00 }, { description: 'ভ্যাট', amount: 225.00 }, { description: 'ভ্যাট বকেয়া', amount: 0.00 }, { description: 'আয়কর', amount: 0.00 }, { description: 'আয়কর বকেয়া', amount: 0.00 }, ]);
        setLogoFile(null); setLogoPreview('/lalmonirhat-logo.png');
        setMayorSignatureFile(null); setMayorSignaturePreview(null); setOfficerSignatureFile(null); setOfficerSignaturePreview(null);
        setInspectorSignatureFile(null); setInspectorSignaturePreview(null);
        setEditingId(null);
    }
    
    const handleSave = async () => {
        if (!businessName || !ownerName) {
            toast({ variant: 'destructive', title: 'Error', description: 'Business and Owner name are required.' });
            return;
        }
    
        const getFieldValue = (id: string) => licenceFields.find(f => f.id === id)?.value || '';

        const licenceData: Omit<TradeLicence, 'id' | 'createdAt'> = {
            municipalityName, mayorName, executiveOfficerName, inspectorName,
            licenceNo: getFieldValue('licenceNo'),
            licenceId: getFieldValue('licenceId'),
            wardNo: getFieldValue('wardNo'),
            circle: getFieldValue('circle'),
            issueDate: getFieldValue('issueDate'),
            renewalYear: getFieldValue('renewalYear'),
            renewalDate: getFieldValue('renewalDate'),
            expiryYear,
            businessName, businessType, ownerName, fatherName, motherName,
            businessAddress, ownerPresentAddress, ownerPermanentAddress,
            nid, phone, tin, fees, collection,
            logoUrl: originalImageUrls.logoUrl || '',
            mayorSignatureUrl: originalImageUrls.mayorSignatureUrl || '',
            officerSignatureUrl: originalImageUrls.officerSignatureUrl || '',
            inspectorSignatureUrl: originalImageUrls.inspectorSignatureUrl || '',
            deceasedName: ownerName, address: businessAddress, heirs: []
        };
    
        try {
            if (logoFile) licenceData.logoUrl = await uploadImage(logoFile, 'trade-licence-logos');
            if (mayorSignatureFile) licenceData.mayorSignatureUrl = await uploadImage(mayorSignatureFile, 'trade-licence-signatures');
            if (officerSignatureFile) licenceData.officerSignatureUrl = await uploadImage(officerSignatureFile, 'trade-licence-signatures');
            if (inspectorSignatureFile) licenceData.inspectorSignatureUrl = await uploadImage(inspectorSignatureFile, 'trade-licence-signatures');
    
            if (editingId) {
                await updateTradeLicence(editingId, licenceData);
                toast({ title: 'Success', description: 'Licence updated successfully.' });
            } else {
                await addTradeLicence(licenceData);
                toast({ title: 'Success', description: 'Licence saved successfully.' });
            }
            resetForm();
    
        } catch (error: any) {
            console.error("Save error:", error);
            toast({ variant: 'destructive', title: 'Save Failed', description: error.message });
        }
    };
    
     const handleEdit = (licence: TradeLicence) => {
        setEditingId(licence.id);
        setMunicipalityName(licence.municipalityName); setMayorName(licence.mayorName); setExecutiveOfficerName(licence.executiveOfficerName); setInspectorName(licence.inspectorName);
        
        const newFields = licenceFields.map(f => ({ ...f, value: (licence as any)[f.id] || '' }));
        setLicenceFields(newFields);

        setExpiryYear(licence.expiryYear);
        setBusinessName(licence.businessName); setBusinessType(licence.businessType); setOwnerName(licence.ownerName);
        setFatherName(licence.fatherName); setMotherName(licence.motherName); setBusinessAddress(licence.businessAddress);
        setOwnerPresentAddress(licence.ownerPresentAddress); setOwnerPermanentAddress(licence.ownerPermanentAddress);
        setNid(licence.nid); setPhone(licence.phone); setTin(licence.tin);
        setFees(licence.fees || []); setCollection(licence.collection || []);
        setLogoPreview(licence.logoUrl || '/lalmonirhat-logo.png');
        setMayorSignaturePreview(licence.mayorSignatureUrl || null); setOfficerSignaturePreview(licence.officerSignatureUrl || null);
        setInspectorSignaturePreview(licence.inspectorSignatureUrl || null);
        
        // Store original URLs to avoid re-uploading if not changed
        setOriginalImageUrls({
            logoUrl: licence.logoUrl,
            mayorSignatureUrl: licence.mayorSignatureUrl,
            officerSignatureUrl: licence.officerSignatureUrl,
            inspectorSignatureUrl: licence.inspectorSignatureUrl,
        });
        
        // Reset file inputs
        setLogoFile(null); setMayorSignatureFile(null); setOfficerSignatureFile(null); setInspectorSignatureFile(null);
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteTradeLicence(id);
            toast({ title: 'Success', description: 'Licence deleted.'});
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };
    
    const toBengaliNumber = (n: number | string) => {
    const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(n).split('').map(digit => bengaliNumerals[parseInt(digit)] || digit).join('');
  };
  
  const toBengaliDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        const bengaliMonths = ["পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র", "বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ"];
        const bengaliYear = date.getFullYear() + 593;
        let day = date.getUTCDate();
        let month = date.getUTCMonth();
        const monthIndex = (month + 8) % 12;
        return `${toBengaliNumber(day)} ${bengaliMonths[monthIndex] || ''} ${toBengaliNumber(bengaliYear)} ব.`;
    } catch {
        return '';
    }
  };

  const formatEnglishDateInBengali = (dateString: string) => {
      try {
          const date = new Date(dateString);
          const day = toBengaliNumber(date.getUTCDate().toString().padStart(2, '0'));
          
          const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long' });
          const monthName = monthFormatter.format(date);
          
          const year = toBengaliNumber(date.getUTCFullYear());
          return ` ${day} ${monthName} ${year}ইং`;
      } catch {
          return '';
      }
  }
  
  const handleLicenceFieldChange = (id: string, value: string) => {
      setLicenceFields(prevFields => 
          prevFields.map(f => f.id === id ? { ...f, value } : f)
      );
  }
  
  const sortedLicenceFields = [...licenceFields].sort((a, b) => a.order - b.order);


  return (
    <div className="space-y-8">
      <div className="mb-6">
        <Button variant="outline" asChild><Link href="/tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Tools</Link></Button>
      </div>
      
       <Card>
                <CardHeader>
                    <CardTitle>Trade Licence Details</CardTitle>
                    <CardDescription>Fill in the details to generate the trade licence.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {/* Authority Info */}
                        <div className="space-y-2"><Label>Municipality Name</Label><Input value={municipalityName} onChange={e => setMunicipalityName(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Mayor Name</Label><Input value={mayorName} onChange={e => setMayorName(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Executive Officer Name</Label><Input value={executiveOfficerName} onChange={e => setExecutiveOfficerName(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Inspector Name</Label><Input value={inspectorName} onChange={e => setInspectorName(e.target.value)} /></div>
                        
                        {/* Licence Info */}
                        {sortedLicenceFields.map(field => (
                             <div className="space-y-2" key={`input-${field.id}`}>
                                <Label>{field.label}</Label>
                                <Input 
                                    type={field.id.includes('Date') ? 'date' : 'text'} 
                                    value={field.value} 
                                    onChange={(e) => handleLicenceFieldChange(field.id, e.target.value)}
                                />
                             </div>
                        ))}
                        <div className="space-y-2"><Label>Expiry Year</Label><Input value={expiryYear} onChange={e => setExpiryYear(e.target.value)} /></div>
                        
                        {/* Business Info */}
                        <div className="space-y-2 md:col-span-2"><Label>Business Name</Label><Input value={businessName} onChange={e => setBusinessName(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Business Type</Label><Input value={businessType} onChange={e => setBusinessType(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Owner Name</Label><Input value={ownerName} onChange={e => setOwnerName(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Father's Name</Label><Input value={fatherName} onChange={e => setFatherName(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Mother's Name</Label><Input value={motherName} onChange={e => setMotherName(e.target.value)} /></div>
                        <div className="space-y-2 md:col-span-3"><Label>Business Address</Label><Input value={businessAddress} onChange={e => setBusinessAddress(e.target.value)} /></div>
                        <div className="space-y-2 md:col-span-3"><Label>Owner's Present Address</Label><Input value={ownerPresentAddress} onChange={e => setOwnerPresentAddress(e.target.value)} /></div>
                        <div className="space-y-2 md:col-span-3"><Label>Owner's Permanent Address</Label><Input value={ownerPermanentAddress} onChange={e => setOwnerPermanentAddress(e.target.value)} /></div>
                        <div className="space-y-2"><Label>NID</Label><Input value={nid} onChange={e => setNid(e.target.value)} /></div>
                        <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
                        <div className="space-y-2"><Label>TIN</Label><Input value={tin} onChange={e => setTin(e.target.value)} /></div>

                        {/* Image Uploads */}
                        <div className="space-y-2"><Label>Logo</Label><Input id="logoUpload" type="file" accept="image/*" onChange={handleFileChange(setLogoFile, setLogoPreview)} /></div>
                        <div className="space-y-2">
                            <Label>Watermark Size ({watermarkSize}%)</Label>
                            <Slider value={[watermarkSize]} onValueChange={(v) => setWatermarkSize(v[0])} min={10} max={100} step={5} />
                        </div>
                        <div className="space-y-2"><Label>Mayor Signature</Label><Input type="file" accept="image/*" onChange={handleFileChange(setMayorSignatureFile, setMayorSignaturePreview)} /></div>
                        <div className="space-y-2"><Label>Officer Signature</Label><Input type="file" accept="image/*" onChange={handleFileChange(setOfficerSignatureFile, setOfficerSignaturePreview)} /></div>
                        <div className="space-y-2"><Label>Inspector Signature</Label><Input type="file" accept="image/*" onChange={handleFileChange(setInspectorSignatureFile, setInspectorSignaturePreview)} /></div>

                    </div>
                </CardContent>
                 <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={resetForm}>Reset</Button>
                    <Button onClick={handleSave}>
                        <Save className="mr-2 h-4 w-4"/>
                        {editingId ? 'Update Licence' : 'Save Licence'}
                    </Button>
                </CardFooter>
            </Card>
            
            <Card>
                <CardHeader>
                    <CardTitle>Saved Licences</CardTitle>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader><TableRow><TableHead>Business Name</TableHead><TableHead>Owner</TableHead><TableHead>Licence No</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {savedLicences.map(licence => (
                                <TableRow key={licence.id}>
                                    <TableCell>{licence.businessName}</TableCell>
                                    <TableCell>{licence.ownerName}</TableCell>
                                    <TableCell>{licence.licenceNo}</TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="ghost" size="sm" onClick={() => handleEdit(licence)}><Edit className="h-4 w-4 mr-1"/>Edit</Button>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="sm" className="text-destructive"><Trash2 className="h-4 w-4 mr-1"/>Delete</Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent>
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                    <AlertDialogDescriptionComponent>This will permanently delete this saved licence.</AlertDialogDescriptionComponent>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter>
                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDelete(licence.id)}>Delete</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

             <Card className="min-h-[80vh] mt-8">
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Licence Preview</CardTitle>
                        <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4"/> Print</Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <div ref={certificateRef} className="p-4 border rounded-lg bg-white text-black" style={{ fontFamily: 'SolaimanLipi, sans-serif' }}>
                        <div
                            className="p-1"
                            style={{
                                border: '12px solid transparent',
                                borderImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%233B82F6'%3E%3Cpath d='M36 0c-4.418278 0-8 3.581722-8 8v44c0 4.418278 3.581722 8 8 8h24V0H36zM31 16h-4c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM21 24h-4c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM11 32H7c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM31 40h-4c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM21 48h-4c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM11 56H7c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM31 8h-4c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM21 16h-4c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM11 24H7c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM31 32h-4c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM21 40h-4c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8zM11 48H7c-2.209139 0-4-1.790861-4-4 0-2.209139 1.790861-4 4-4h4v8z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E") 30 stretch`,
                                borderImageSlice: '30',
                                borderImageRepeat: 'repeat',
                            }}
                        >
                             <div className="border border-blue-500 p-4 relative">
                                <div className="relative z-10">
                                    {/* Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="w-[80px] h-[80px] flex-shrink-0 relative">
                                            {logoPreview && <Image src={logoPreview} alt="Logo" fill style={{objectFit:"contain"}} />}
                                        </div>
                                        <div className="text-center flex-grow">
                                            <h1 className="text-3xl font-bold text-black">{municipalityName}</h1>
                                            <h2 className="text-2xl font-bold text-sky-600">ট্রেড লাইসেন্স</h2>
                                        </div>
                                        <div className="w-[80px] h-[100px] flex-shrink-0"></div>
                                    </div>
                                    
                                    <table className="w-full text-sm mb-4 bg-sky-100 z-10 relative" style={{ fontSize: `${fontSize}px` }}>
                                        <tbody>
                                            {sortedLicenceFields.map(field => (
                                                 <tr key={field.id}>
                                                    <td className="py-1 px-2 font-bold w-48 align-top">{field.label}</td>
                                                    <td className="py-1 px-2 w-4 align-top">:</td>
                                                    <td className="py-1 px-2 align-top">{field.value}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    
                                    {/* Legal Text */}
                                    <div className="text-justify mb-4" style={{ fontSize: `${fontSize}px` }}>
                                        <p>স্থানীয় সরকার (পৌরসভা) আইন ২০০৯ (২০০৯ সনের ৫৮ নং আইন) এর ধারী ১৭০ এ প্রণীত আদর্শ কর তফসিল ২০১৪ এর আলোকে পেশা, ব্যবসা-বাণিজ্য, জীবিকা-বৃত্তি, প্রতিষ্ঠান ইত্যাদির উপর কর আদায়ের লক্ষ্যে নিম্নবর্ণিত ব্যক্তি/প্রতিষ্ঠানের অনুকূলে ট্রেড লাইসেন্স ইস্যু করা হইল।</p>
                                        <p>যাহার মেয়াদ {toBengaliNumber(expiryYear)} ইং সনের ৩০ জুন পর্যন্ত বলবৎ থাকিবে।</p>
                                    </div>
                                    
                                     <div className="relative">
                                        <div className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none">
                                          {logoPreview && (
                                            <div className="relative opacity-10" style={{ width: `${watermarkSize}%`, height: '100%' }}>
                                                <Image src={logoPreview} alt="Watermark" fill style={{objectFit:"contain"}} />
                                            </div>
                                          )}
                                        </div>
                                        <table className="w-full relative z-10" style={{ fontSize: `${fontSize}px` }}>
                                            <tbody>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">১। ব্যবসা প্রতিষ্ঠানের নাম</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black">{businessName}</div></td></tr>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">২। ব্যবসার ধরণ</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black">{businessType}</div></td></tr>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">৩। মালিকের নাম</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black">{ownerName}</div></td></tr>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">৪। পিতা/স্বামীর নাম</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black">{fatherName}</div></td></tr>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">৫। মাতার নাম</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black">{motherName}</div></td></tr>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">৬। ব্যবসা প্রতিষ্ঠানের ঠিকানা</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black">{businessAddress}</div></td></tr>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">৭। মালিকের ঠিকানা (বর্তমান)</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black">{ownerPresentAddress}</div></td></tr>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">৮। মালিকের ঠিকানা (স্থায়ী)</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black">{ownerPermanentAddress}</div></td></tr>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">৯। ন্যাশনাল আইডি নং</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black">{nid}</div></td></tr>
                                                <tr><td className="w-[180px] py-1 align-top font-bold">১০। ফোন/মোবাইল নং</td><td className="py-1 w-4">:</td><td className="py-1"><div className="border-b border-dotted border-black flex justify-between items-center"><span>{phone}</span>{tin && <span className="ml-4">টিআইএন: {tin}</span>}</div></td></tr>
                                            </tbody>
                                        </table>
                                     </div>
                                    
                                    {/* Financial Details */}
                                    <div className="flex items-start gap-4 mt-4">
                                        <div className="flex flex-col items-start shrink-0">
                                            <p className="font-bold">১১। আর্থিক বিবরণ</p>
                                            <div className="mt-2">
                                                {qrCodeDataUrl && <Image src={qrCodeDataUrl} alt="QR Code" height={80} width={80} />}
                                            </div>
                                        </div>
                                        <table className="w-full text-sm">
                                            <tbody>
                                                <tr>
                                                    <td className="pr-2 w-1/2 align-top">
                                                        <table className="w-full text-sm border-collapse">
                                                            <thead style={{ backgroundColor: '#75b5ff' }}>
                                                                <tr><th className="font-bold text-center py-1 px-2 border border-black">বিবরণ</th><th className="font-bold text-center py-1 px-2 border border-black">টাকা</th></tr>
                                                            </thead>
                                                            <tbody>{fees.map((fee, i) => (<tr key={i}><td className="py-1 border border-black px-2">{fee.description}</td><td className="text-right py-1 border border-black px-2">৳{toBengaliNumber(fee.amount.toFixed(2))}</td></tr>))}</tbody>
                                                            <tfoot style={{ backgroundColor: '#75b5ff' }}>
                                                                <tr><td className="py-1 font-bold border border-black px-2 text-center">মোট</td><td className="text-right py-1 font-bold border border-black px-2">৳{toBengaliNumber(totalFees.toFixed(2))}</td></tr>
                                                            </tfoot>
                                                        </table>
                                                    </td>
                                                    <td className="pl-2 w-1/2 align-top">
                                                        <table className="w-full text-sm">
                                                            <thead><tr><th className="font-bold text-center py-1 px-2 border border-black">আদায়ের বিবরণ</th><th className="font-bold text-center py-1 px-2 border border-black">টাকা</th></tr></thead>
                                                            <tbody>{collection.map((item, i) => (<tr key={i}><td className="py-1 border border-black px-2">{item.description}</td><td className="text-right py-1 border border-black px-2">৳{toBengaliNumber(item.amount.toFixed(2))}</td></tr>))}</tbody>
                                                            <tfoot style={{ backgroundColor: '#75b5ff' }}>
                                                                <tr><td className="py-1 font-bold border border-black px-2 text-center">মোট</td><td className="text-right py-1 font-bold border border-black px-2">৳{toBengaliNumber(totalCollection.toFixed(2))}</td></tr>
                                                            </tfoot>
                                                        </table>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td colSpan={2} className="pt-2">
                                                        <p className="text-sm">লাইসেন্সধারীর নিকট হইতে সকল পাওনা বাবদ মোট {toBengaliNumber(grandTotal.toFixed(2))} টাকা গ্রহন করা হইল।</p>
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                    
                                     {/* Signatures */}
                                     <div className="bg-sky-100 -mx-4 mt-8 px-4 py-2">
                                        <div className="flex justify-between items-end pt-8">
                                            <div className="text-center">
                                                {inspectorSignaturePreview && <div className="relative h-12 w-32 mx-auto"><Image src={inspectorSignaturePreview} alt="Inspector" fill style={{objectFit:"contain"}}/></div>}
                                                <p className="pt-1 mt-2">{inspectorName}</p>
                                                <p>লালমনিরহাট পৌরসভা</p>
                                            </div>
                                            <div className="text-center">
                                                {officerSignaturePreview && <div className="relative h-12 w-32 mx-auto"><Image src={officerSignaturePreview} alt="Officer" fill style={{objectFit:"contain"}}/></div>}
                                                <p className="pt-1 mt-2">{executiveOfficerName}</p>
                                                <p>লালমনিরহাট পৌরসভা</p>
                                            </div>
                                            <div className="text-center">
                                                {mayorSignaturePreview && <div className="relative h-12 w-32 mx-auto"><Image src={mayorSignaturePreview} alt="Mayor" fill style={{objectFit:"contain"}}/></div>}
                                                <p className="pt-1 mt-2">{mayorName}</p>
                                                <p>লালমনিরহাট পৌরসভা</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
    </div>
  );
}
  



    
    





