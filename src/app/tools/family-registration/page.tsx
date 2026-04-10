
'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2, ShieldQuestion } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { DatePicker } from '@/components/ui/date-picker';
import { sendSmsAction } from '@/app/sms-reminder/actions';
import { addFamilyRegistration } from '@/services/familyRegistrationService';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';


export default function FamilyRegistrationPage() {
    const [step, setStep] = useState<'form' | 'otp'>('form');
    const [formData, setFormData] = useState({
        name: '',
        dob: new Date(),
        nid: '',
        fatherName: '',
        motherName: '',
        phone: '',
    });
    const [otp, setOtp] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setFormData(prev => ({ ...prev, dob: date }));
        }
    };

    const handleFormSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);

        if (!formData.name || !formData.phone) {
            toast({
                variant: 'destructive',
                title: 'Missing Information',
                description: 'Name and Phone Number are required.',
            });
            setIsSubmitting(false);
            return;
        }

        const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
        setGeneratedOtp(newOtp);

        try {
            const smsMessage = `Your verification code for Family Registration is: ${newOtp}`;
            const result = await sendSmsAction(formData.phone, smsMessage);

            if (result.success) {
                toast({
                    title: 'OTP Sent',
                    description: `We've sent an OTP to your phone number.`,
                });
                setStep('otp');
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Failed to Send OTP',
                    description: result.error || 'Please try again later.',
                });
            }
        } catch (error) {
            toast({
                variant: 'destructive',
                title: 'An Error Occurred',
                description: 'Could not send the OTP. Please check your connection and try again.',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleOtpVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        if (otp === generatedOtp) {
            try {
                await addFamilyRegistration({
                    name: formData.name,
                    dob: formData.dob.toISOString(),
                    nid: formData.nid,
                    fatherName: formData.fatherName,
                    motherName: formData.motherName,
                    phone: formData.phone,
                });

                toast({
                    title: 'Registration Successful!',
                    description: `Welcome, ${formData.name}! Your registration is complete.`,
                });
                // Reset form state
                setStep('form');
                setFormData({ name: '', dob: new Date(), nid: '', fatherName: '', motherName: '', phone: '' });
                setOtp('');
                setGeneratedOtp('');
            } catch (error: any) {
                toast({
                    variant: 'destructive',
                    title: 'Registration Failed',
                    description: 'Could not save your registration data. Please try again.',
                });
            }
        } else {
            toast({
                variant: 'destructive',
                title: 'Invalid OTP',
                description: 'The OTP you entered is incorrect. Please try again.',
            });
            setOtp('');
        }
        setIsSubmitting(false);
    };

    return (
        <div className="container mx-auto max-w-2xl py-8">
            
            {step === 'form' && (
                <Card>
                    <CardHeader>
                        <CardTitle>Family Registration</CardTitle>
                        <CardDescription>Please fill in the details below to register a new family member.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleFormSubmit}>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="name">Name *</Label>
                                    <Input id="name" value={formData.name} onChange={handleInputChange} required />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="dob">Date of Birth</Label>
                                    <DatePicker value={formData.dob} onChange={handleDateChange} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="nid">NID Number</Label>
                                <Input id="nid" value={formData.nid} onChange={handleInputChange} />
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label htmlFor="fatherName">Father's Name</Label>
                                    <Input id="fatherName" value={formData.fatherName} onChange={handleInputChange} />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="motherName">Mother's Name</Label>
                                    <Input id="motherName" value={formData.motherName} onChange={handleInputChange} />
                                </div>
                            </div>
                            <div className="space-y-1">
                                <Label htmlFor="phone">Phone Number *</Label>
                                <Input id="phone" type="tel" value={formData.phone} onChange={handleInputChange} required />
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Get OTP
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            )}

            {step === 'otp' && (
                 <Card>
                    <CardHeader>
                        <CardTitle>Verify Your Phone Number</CardTitle>
                        <CardDescription>An OTP has been sent to {formData.phone}. Please enter it below.</CardDescription>
                    </CardHeader>
                    <form onSubmit={handleOtpVerify}>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="otp">One-Time Password (OTP)</Label>
                                <Input 
                                    id="otp" 
                                    value={otp} 
                                    onChange={(e) => setOtp(e.target.value)} 
                                    maxLength={4}
                                    className="text-center text-2xl tracking-[1rem]"
                                    autoFocus
                                />
                            </div>
                        </CardContent>
                        <CardFooter className="justify-between">
                            <Button variant="ghost" onClick={() => setStep('form')}>Back</Button>
                            <Button type="submit" disabled={isSubmitting || otp.length < 4}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Verify & Register
                            </Button>
                        </CardFooter>
                    </form>
                </Card>
            )}
        </div>
    );
}
