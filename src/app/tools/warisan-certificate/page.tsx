

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Printer, Save, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import type { Heir, WarisanCertificate } from '@/types';
import { addWarisanCertificate, subscribeToWarisanCertificates, updateWarisanCertificate, deleteWarisanCertificate } from '@/services/warisanService';
import Image from 'next/image';
import { Slider } from '@/components/ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {formatDate as formatDateUtil} from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { uploadImage } from '@/services/storageService';


export default function WarisanCertificatePage() {
  const [deceasedName, setDeceasedName] = useState('');
  const [deceasedFatherName, setDeceasedFatherName] = useState('');
  const [deceasedAddress, setDeceasedAddress] = useState('');
  const [heirs, setHeirs] = useState<Heir[]>([
    { name: '', relation: 'Wife', is_alive: true, nid: '', dob: '', comment: '' },
    { name: '', relation: 'Son', is_alive: true, nid: '', dob: '', comment: '' },
    { name: '', relation: 'Daughter', is_alive: true, nid: '', dob: '', comment: '' },
  ]);
  const [certificateNumber, setCertificateNumber] = useState('');
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split('T')[0]);
  const [randomCertNumber, setRandomCertNumber] = useState('');
  
  // New state for additional fields
  const [applicantName, setApplicantName] = useState('');
  const [applicantFatherName, setApplicantFatherName] = useState('');
  const [applicantAddress, setApplicantAddress] = useState('');
  const [wardNo, setWardNo] = useState('');
  const [assistantName, setAssistantName] = useState('');
  const [adminName, setAdminName] = useState('মোঃ রাজিব আহসান');
  const [municipalityName, setMunicipalityName] = useState('লালমনিরহাট পৌরসভা');
  const [email, setEmail] = useState('ps.lalmonirhat.gov.bd');
  
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [preparerSignatureFile, setPreparerSignatureFile] = useState<File | null>(null);
  const [preparerSignaturePreview, setPreparerSignaturePreview] = useState<string | null>(null);
  
  // State to hold the original image URLs when editing
  const [originalImageUrls, setOriginalImageUrls] = useState<{ logoUrl?: string; signatureUrl?: string; preparerSignatureUrl?: string }>({});


  const [fontSize, setFontSize] = useState(16);
  const [fontFamily, setFontFamily] = useState('SolaimanLipi');
  
  const [savedCertificates, setSavedCertificates] = useState<WarisanCertificate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);


  const certificateRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

    useEffect(() => {
        setRandomCertNumber(Math.floor(100 + Math.random() * 900).toString());
        const unsub = subscribeToWarisanCertificates(setSavedCertificates, (err) => {
            toast({ variant: 'destructive', title: 'Error loading saved certificates', description: err.message });
        });
        return () => unsub();
    }, [toast]);

  const handleHeirChange = (index: number, field: keyof Heir, value: string | number | boolean) => {
    const newHeirs = [...heirs];
    (newHeirs[index] as any)[field] = value;
    setHeirs(newHeirs);
  };

  const addHeir = () => {
    setHeirs([...heirs, { name: '', relation: '', is_alive: true, nid: '', dob: '', comment: '' }]);
  };

  const removeHeir = (index: number) => {
    setHeirs(heirs.filter((_, i) => i !== index));
  };
  
  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
      }
    };
    
    const handleSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        setSignatureFile(file);
        setSignaturePreview(URL.createObjectURL(file));
      }
    };
    
    const handlePreparerSignatureFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPreparerSignatureFile(file);
            setPreparerSignaturePreview(URL.createObjectURL(file));
        }
    };

  const handlePrint = () => {
    const printableArea = certificateRef.current;
    if (printableArea) {
      const printWindow = window.open('', '_blank');
      printWindow?.document.write(`<html><head><title>Warisan Certificate</title><style>@import url('https://fonts.googleapis.com/css2?family=SolaimanLipi&display=swap');</style><script src="https://cdn.tailwindcss.com"><\/script></head><body class="p-8" style="font-family: '${fontFamily}', sans-serif; font-size: ${fontSize}px;">`);
      printWindow?.document.write(printableArea.innerHTML);
      printWindow?.document.write('</body></html>');
      printWindow?.document.close();
      printWindow?.focus();
      printWindow?.print();
    }
  };
  
  const resetForm = () => {
    setDeceasedName('');
    setDeceasedFatherName('');
    setDeceasedAddress('');
    setHeirs([
        { name: '', relation: 'Wife', is_alive: true, nid: '', dob: '', comment: '' },
        { name: '', relation: 'Son', is_alive: true, nid: '', dob: '', comment: '' },
        { name: '', relation: 'Daughter', is_alive: true, nid: '', dob: '', comment: '' },
    ]);
    setCertificateNumber('');
    setIssueDate(new Date().toISOString().split('T')[0]);
    setApplicantName('');
    setApplicantFatherName('');
    setApplicantAddress('');
    setWardNo('');
    setAssistantName('');
    setAdminName('মোঃ রাজিব আহসান');
    setMunicipalityName('লালমনিরহাট পৌরসভা');
    setEmail('ps.lalmonirhat.gov.bd');
    setEditingId(null);
    // Reset image previews and files
    setLogoFile(null);
    setLogoPreview(null);
    setSignatureFile(null);
    setSignaturePreview(null);
    setPreparerSignatureFile(null);
    setPreparerSignaturePreview(null);
    setOriginalImageUrls({});
  };

const handleSave = async () => {
  if (!deceasedName) {
    toast({ variant: 'destructive', title: 'Error', description: 'Deceased person\'s name is required.' });
    return;
  }

  try {
    let logoUrl = originalImageUrls.logoUrl;
    let signatureUrl = originalImageUrls.signatureUrl;
    let preparerSignatureUrl = originalImageUrls.preparerSignatureUrl;

    // Only upload if a new file is selected
    if (logoFile) {
      logoUrl = await uploadImage(logoFile, 'logos');
    }
    if (signatureFile) {
      signatureUrl = await uploadImage(signatureFile, 'signatures');
    }
    if (preparerSignatureFile) {
      preparerSignatureUrl = await uploadImage(preparerSignatureFile, 'signatures');
    }

    const certificateData: Omit<WarisanCertificate, 'id'> = {
      deceasedName, deceasedFatherName,
      address: deceasedAddress,
      heirs: heirs.filter(h => h.name),
      certificateNumber, issueDate,
      applicantName, applicantFatherName, applicantAddress,
      wardNo, assistantName, adminName, municipalityName, email,
      // Always pass the current URL, which is either the old one or the new one if uploaded
      logoUrl,
      signatureUrl,
      preparerSignatureUrl,
    };

    if (editingId) {
      await updateWarisanCertificate(editingId, certificateData);
      toast({ title: 'Success', description: 'Certificate updated successfully.' });
    } else {
      await addWarisanCertificate(certificateData);
      toast({ title: 'Success', description: 'Certificate saved successfully.' });
    }
    
    resetForm();

  } catch (error: any) {
    console.error("Save error:", error);
    toast({ variant: 'destructive', title: 'Error', description: `Could not save certificate: ${error.message}` });
  }
};
  
const handleEdit = (certificate: WarisanCertificate) => {
    setEditingId(certificate.id);
    setDeceasedName(certificate.deceasedName);
    setDeceasedFatherName(certificate.deceasedFatherName || '');
    setDeceasedAddress(certificate.address);
    setHeirs(certificate.heirs);
    setCertificateNumber(certificate.certificateNumber);
    setIssueDate(certificate.issueDate);
    setApplicantName(certificate.applicantName || '');
    setApplicantFatherName(certificate.applicantFatherName || '');
    setApplicantAddress(certificate.applicantAddress || '');
    setWardNo(certificate.wardNo || '');
    setAssistantName(certificate.assistantName || '');
    setAdminName(certificate.adminName || 'মোঃ রাজিব আহসান');
    setMunicipalityName(certificate.municipalityName || 'লালমনিরহাট পৌরসভা');
    setEmail(certificate.email || 'ps.lalmonirhat.gov.bd');
    
    const urls = {
        logoUrl: certificate.logoUrl,
        signatureUrl: certificate.signatureUrl,
        preparerSignatureUrl: certificate.preparerSignatureUrl
    };
    setLogoPreview(urls.logoUrl || null);
    setSignaturePreview(urls.signatureUrl || null);
    setPreparerSignaturePreview(urls.preparerSignatureUrl || null);
    setOriginalImageUrls(urls);
    
    // Reset file inputs
    setLogoFile(null);
    setSignatureFile(null);
    setPreparerSignatureFile(null);
};


  const handleDelete = async (id: string) => {
      try {
          await deleteWarisanCertificate(id);
          toast({ title: 'Success', description: 'Certificate deleted.' });
      } catch (error: any) {
           toast({ variant: 'destructive', title: 'Error', description: error.message });
      }
  }
  
    const toBengaliNumber = (n: number | string) => {
    const bengaliNumerals = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(n).split('').map(digit => bengaliNumerals[parseInt(digit)] || digit).join('');
  };
  
  const toBengaliDate = (dateString: string) => {
    try {
        const date = new Date(dateString);
        // Bengali months array
        const bengaliMonths = ["পৌষ", "মাঘ", "ফাল্গুন", "চৈত্র", "বৈশাখ", "জ্যৈষ্ঠ", "আষাঢ়", "শ্রাবণ", "ভাদ্র", "আশ্বিন", "কার্তিক", "অগ্রহায়ণ"];
        const bengaliYear = date.getFullYear() + 593;
        
        let day = date.getUTCDate();
        let month = date.getUTCMonth();
        
        const monthIndex = (month + 8) % 12; // This is a very rough approximation
        
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

  return (
    <div className="space-y-8">
       <div className="mb-6">
        <Button variant="outline" asChild><Link href="/tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Tools</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>ওয়ারিশান সার্টিফিকেট তৈরি করুন</CardTitle>
          <CardDescription>মৃত ব্যক্তি এবং তার উত্তরাধিকারীদের তথ্য পূরণ করুন।</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
           <div className="space-y-2">
            <Label htmlFor="fontSize">ফন্টের আকার ({fontSize}px)</Label>
            <Slider id="fontSize" value={[fontSize]} onValueChange={(value) => setFontSize(value[0])} min={8} max={24} step={1} />
          </div>
           <div className="space-y-2">
            <Label htmlFor="fontFamily">ফন্ট ফ্যামিলি</Label>
            <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger id="fontFamily">
                    <SelectValue placeholder="ফন্ট নির্বাচন করুন" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="SolaimanLipi">SolaimanLipi</SelectItem>
                    <SelectItem value="Kalpurush">Kalpurush</SelectItem>
                    <SelectItem value="Siyam Rupali">Siyam Rupali</SelectItem>
                    <SelectItem value="Hind Siliguri">Hind Siliguri</SelectItem>
                    <SelectItem value="sans-serif">Sans-serif (default)</SelectItem>
                    <SelectItem value="serif">Serif</SelectItem>
                </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="logoUpload">লোগো আপলোড</Label>
            <Input id="logoUpload" type="file" accept="image/*" onChange={handleLogoFileChange} />
          </div>
          <div className="space-y-2 p-3 border rounded-md bg-muted/20">
            <h3 className="font-semibold text-sm">মৃত ব্যক্তির তথ্য</h3>
            <div className="space-y-2">
              <Label htmlFor="deceasedName">মৃত ব্যক্তির নাম</Label>
              <Input id="deceasedName" value={deceasedName} onChange={e => setDeceasedName(e.target.value)} />
            </div>
             <div className="space-y-2">
              <Label htmlFor="deceasedFatherName">মৃত ব্যক্তির পিতার নাম</Label>
              <Input id="deceasedFatherName" value={deceasedFatherName} onChange={e => setDeceasedFatherName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="deceasedAddress">মৃত ব্যক্তির ঠিকানা</Label>
              <Input id="deceasedAddress" value={deceasedAddress} onChange={e => setDeceasedAddress(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 p-3 border rounded-md bg-muted/20">
            <h3 className="font-semibold text-sm">আবেদনকারীর তথ্য</h3>
            <div className="space-y-2">
                <Label htmlFor="applicantName">আবেদনকারীর নাম</Label>
                <Input id="applicantName" value={applicantName} onChange={e => setApplicantName(e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="applicantFatherName">আবেদনকারীর পিতার নাম</Label>
                <Input id="applicantFatherName" value={applicantFatherName} onChange={e => setApplicantFatherName(e.target.value)} />
            </div>
             <div className="space-y-2">
                <Label htmlFor="applicantAddress">আবেদনকারীর ঠিকানা</Label>
                <Input id="applicantAddress" value={applicantAddress} onChange={e => setApplicantAddress(e.target.value)} />
            </div>
          </div>

          <div className="space-y-2 p-3 border rounded-md bg-muted/20">
             <h3 className="font-semibold text-sm">সনদ ও কর্তৃপক্ষের তথ্য</h3>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cert-no">সনদপত্র নং</Label>
                  <Input id="cert-no" value={certificateNumber} onChange={e => setCertificateNumber(e.target.value)} />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="issue-date">ইস্যুর তারিখ</Label>
                  <Input id="issue-date" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
                </div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="wardNo">ওয়ার্ড নং</Label>
                    <Input id="wardNo" value={wardNo} onChange={e => setWardNo(e.target.value)} />
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="assistantName">সহকারীর নাম</Label>
                    <Input id="assistantName" value={assistantName} onChange={e => setAssistantName(e.target.value)} />
                </div>
            </div>
            <div className="space-y-2 pt-2">
                <Label htmlFor="preparerSignatureUpload">প্রস্তুতকারীর স্বাক্ষর আপলোড</Label>
                <Input id="preparerSignatureUpload" type="file" accept="image/*" onChange={handlePreparerSignatureFileChange} />
            </div>
            <div className="space-y-2 pt-2">
                <Label htmlFor="signatureUpload">স্বাক্ষর আপলোড</Label>
                <Input id="signatureUpload" type="file" accept="image/*" onChange={handleSignatureFileChange} />
            </div>
             <div className="space-y-2 pt-2">
                 <Label htmlFor="adminName">প্রশাসকের নাম</Label>
                <Input id="adminName" value={adminName} onChange={e => setAdminName(e.target.value)} placeholder="e.g., Md. Rafe" />
             </div>
             <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <Label htmlFor="municipalityName">পৌরসভার নাম</Label>
                    <Input id="municipalityName" value={municipalityName} onChange={e => setMunicipalityName(e.target.value)} placeholder="e.g., Lalmonirhat Pourosova" />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="email">ইমেইল</Label>
                    <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="e.g., info@example.com"/>
                </div>
             </div>
          </div>

          <h3 className="font-semibold pt-4 border-t">ওয়ারিশগণ</h3>
          {heirs.map((heir, index) => (
            <div key={index} className="p-3 border rounded-md space-y-2 relative">
               <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7" onClick={() => removeHeir(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="নাম" value={heir.name} onChange={e => handleHeirChange(index, 'name', e.target.value)} />
                <Input placeholder="সম্পর্ক" value={heir.relation} onChange={e => handleHeirChange(index, 'relation', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="জাতীয় পরিচয়পত্র নম্বর" value={heir.nid || ''} onChange={e => handleHeirChange(index, 'nid', e.target.value)} />
                <Input type="text" placeholder="জন্ম তারিখ বা বয়স" value={heir.dob || ''} onChange={e => handleHeirChange(index, 'dob', e.target.value)} />
              </div>
              <Input placeholder="মন্তব্য" value={heir.comment || ''} onChange={e => handleHeirChange(index, 'comment', e.target.value)} />
            </div>
          ))}
          <Button variant="outline" onClick={addHeir}><Plus className="mr-2 h-4 w-4" /> ওয়ারিশ যোগ করুন</Button>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Button onClick={handleSave}><Save className="mr-2 h-4 w-4"/>{editingId ? 'Update Certificate' : 'Save Certificate'}</Button>
        </CardFooter>
      </Card>
      
       <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
              <CardTitle>Saved Certificates</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Deceased Name</TableHead>
                <TableHead>Issue Date</TableHead>
                <TableHead>Heirs</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {savedCertificates.map((cert) => (
                <TableRow key={cert.id}>
                  <TableCell>{cert.deceasedName}</TableCell>
                  <TableCell>{formatDateUtil(cert.issueDate)}</TableCell>
                  <TableCell>{cert.heirs.length}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => handleEdit(cert)}>View & Edit</Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive">Delete</Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescriptionComponent>This will permanently delete the certificate for {cert.deceasedName}.</AlertDialogDescriptionComponent>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(cert.id)}>Delete</AlertDialogAction>
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
              <CardTitle>Certificate Preview</CardTitle>
              <Button onClick={handlePrint} variant="outline"><Printer className="mr-2 h-4 w-4"/> Print</Button>
            </div>
        </CardHeader>
        <CardContent>
          <div ref={certificateRef} className="p-4 border rounded-lg bg-white text-black" style={{ fontFamily: fontFamily, fontSize: `${fontSize}px` }}>
            <div className="text-center space-y-1 mb-8">
              {logoPreview && (
                <div className="mx-auto" style={{ width: '100px', height: '100px', position: 'relative' }}>
                  <Image src={logoPreview} alt="Logo" fill className="object-contain" />
                </div>
              )}
              <h2 className="text-3xl font-bold">{municipalityName}</h2>
              <p>লালমনিরহাট</p>
              <p className="font-semibold">প্রশাসন বিভাগ</p>
              <p>(সাধারন শাখা)</p>
              <p>{email}</p>
            </div>
            
            <div className="flex items-start justify-between text-sm mb-8">
                <div>
                    <p>স্মারক নম্বর-লাঃ পৌঃ সঃ/ওয়ারিশ নথি/{toBengaliNumber(new Date(issueDate).getFullYear())}/{toBengaliNumber(randomCertNumber)}</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="self-center">তারিখ:</span>
                    <div className="text-right">
                        <p>{toBengaliDate(issueDate)}</p>
                        <p className="border-t border-dotted border-black mt-1 pt-1">{formatEnglishDateInBengali(issueDate)}</p>
                    </div>
                </div>
            </div>

            <div className="text-center my-8">
                <div className="inline-block border-2 border-dashed border-green-600 p-1">
                    <h2 className="text-2xl font-bold bg-green-600 text-white px-8 py-2">
                    ওয়ারিশ সনদ
                    </h2>
                </div>
            </div>
            
            <p className="text-justify leading-relaxed mb-8">
              এই মর্মে সনদ প্রদান করা যাচ্ছে যে {applicantName || '(আবেদনকারীর নাম)'}, পিতা- {applicantFatherName || '(আবেদনকারীর পিতার নাম)'}, সাং- {applicantAddress || '(আবেদনকারীর ঠিকানা)'}, {municipalityName} এর স্থায়ী বাসিন্দা। তিনি দাপ্তরিক কাজে মৃত {deceasedName || '(মৃত ব্যক্তির নাম)'}, পিতা- {deceasedFatherName || '(মৃত ব্যক্তির পিতার নাম)'}, সাং- {deceasedAddress || '(মৃত ব্যক্তির ঠিকানা)'}, {municipalityName} এর ওয়ারিশ সনদ চেয়ে আবেদন করেন। তার আবেদনের প্রেক্ষিতে {wardNo ? `${toBengaliNumber(wardNo)}` : '___'} নং ওয়ার্ডের তথ্য সহায়তাকারী {assistantName || '(সহকারীর নাম)'}, মৃত {deceasedName || '(মৃত ব্যক্তির নাম)'} নিম্নবর্ণিত ওয়ারিশান রেখে গেছেন মর্মে প্রতিবেদন দাখিল করেছেন।
            </p>

             <div className="mt-8">
              <h3 className="font-bold text-center text-xl mb-4 underline">{deceasedName || '(মৃত ব্যক্তির নাম)'} - এর ওয়ারিশান</h3>
              <Table className="border border-black">
                <TableHeader>
                  <TableRow>
                    <TableHead className="font-bold border border-black text-center text-black text-sm">ক্রঃ নংঃ</TableHead>
                    <TableHead className="font-bold border border-black text-black text-sm">ওয়ারিশানের নাম</TableHead>
                    <TableHead className="font-bold border border-black text-center text-black text-sm">জাতীয় পরিচয়পত্র নম্বর</TableHead>
                    <TableHead className="font-bold border border-black text-center text-black text-sm">সম্পর্ক</TableHead>
                    <TableHead className="font-bold border border-black text-center text-black text-sm">জন্ম তারিখ</TableHead>
                    <TableHead className="font-bold border border-black text-center text-black text-sm">মন্তব্য</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {heirs.filter(h => h.name).map((heir, index) => (
                    <TableRow key={index}>
                      <TableCell className="border border-black text-center text-black text-sm">{toBengaliNumber(String(index + 1).padStart(2, '0'))}.</TableCell>
                      <TableCell className="border border-black text-black text-sm">{heir.name}</TableCell>
                      <TableCell className="border border-black text-center text-black text-sm">{heir.nid}</TableCell>
                      <TableCell className="border border-black text-center text-black text-sm">{heir.relation}</TableCell>
                      <TableCell className="border border-black text-center text-black text-sm">{heir.dob}</TableCell>
                      <TableCell className="border border-black text-center text-black text-sm">{heir.comment}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="mt-24 flex justify-between">
                <div className="text-center">
                    <div className="relative h-20 w-48 mx-auto mb-1">
                        {preparerSignaturePreview && (
                            <Image src={preparerSignaturePreview} alt="Preparer's Signature" fill className="object-contain" />
                        )}
                    </div>
                    <p className="border-t border-black pt-2">প্রস্তুতকারী</p>
                </div>
                 <div className="text-center">
                    <div className="relative h-20 w-48 mx-auto mb-1">
                        {signaturePreview && (
                            <Image src={signaturePreview} alt="Administrator's Signature" fill className="object-contain" />
                        )}
                    </div>
                    <p className="border-t border-black pt-2">{adminName || '(প্রশাসকের নাম)'}</p>
                    <p>প্রশাসক</p>
                    <p>{municipalityName || '(পৌরসভার নাম)'}</p>
                    <p>{email || '(ইমেইল)'}</p>
                </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
