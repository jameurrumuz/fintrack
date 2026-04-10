'use client';

import { useState, Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserPlus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createPartyAccount, checkPartyExists } from '@/services/portalService';
import { sendSmsAction } from '@/app/sms-reminder/actions';

const signupSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  phone: z.string().min(10, 'A valid 10-digit phone number is required').max(10), // Assuming user enters 10 digits after 0
  password: z.string().min(6, 'Password must be at least 6 characters'),
  address: z.string().optional(),
  servicePackage: z.string().optional(),
});

type SignupFormValues = z.infer<typeof signupSchema>;

function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const servicePackage = searchParams.get('servicePackage');

  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [otp, setOtp] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [phoneError, setPhoneError] = useState('');

  const form = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: { 
      name: '', 
      phone: '', 
      password: '', 
      address: '',
      servicePackage: servicePackage || '',
    },
  });

  const { watch } = form;
  const watchedPhone = watch('phone');

  useEffect(() => {
    const checkPhone = async () => {
        if (watchedPhone && watchedPhone.length >= 10) {
            const fullPhone = `0${watchedPhone}`;
            const { exists } = await checkPartyExists(fullPhone);
            if (exists) {
                setPhoneError('This phone number is already registered.');
            } else {
                setPhoneError('');
            }
        } else {
            setPhoneError('');
        }
    };
    const debounce = setTimeout(checkPhone, 500);
    return () => clearTimeout(debounce);
  }, [watchedPhone]);


  const handleGetOtp = async (data: SignupFormValues) => {
    setError('');
    if (phoneError) {
        toast({
            variant: 'destructive',
            title: 'Registration Error',
            description: phoneError,
        });
        return;
    }
    setLoading(true);

    const newOtp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(newOtp);
    const fullPhoneNumber = `0${data.phone}`;

    try {
        const smsMessage = `Your verification code for Family Registration is: ${newOtp}`;
        const result = await sendSmsAction(fullPhoneNumber, smsMessage);

        if (result.success) {
            toast({
                title: 'OTP Sent',
                description: `We've sent an OTP to your phone number.`,
            });
            setStep('otp');
        } else {
            setError(result.error || 'Failed to send OTP. Please try again later.');
        }
    } catch (err) {
        setError('An unexpected error occurred. Please check your connection.');
    } finally {
        setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    setIsVerifying(true);
    setError('');
    
    if (otp !== generatedOtp) {
        setError('Invalid OTP. Please try again.');
        setIsVerifying(false);
        setOtp('');
        return;
    }
    
    const formData = form.getValues();
    const fullPhoneNumber = `0${formData.phone}`;

    try {
        const result = await createPartyAccount({ ...formData, phone: fullPhoneNumber });
        if (result.success) {
            toast({
            title: 'Signup Successful!',
            description: 'Your account has been created. Please log in.',
            });
            router.push('/portal/login');
        } else {
            setError(result.error || 'An unknown error occurred.');
            setStep('form'); // Go back to form if final creation fails
        }
    } catch (err) {
        setError('An unexpected error occurred during signup.');
        setStep('form');
    } finally {
        setIsVerifying(false);
    }
  };


  if (step === 'otp') {
    return (
        <Card className="w-full max-w-md shadow-2xl">
            <CardHeader className="text-center">
                <CardTitle>Verify Phone Number</CardTitle>
                <CardDescription>Enter the 4-digit OTP sent to +880{form.getValues('phone')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="otp">One-Time Password</Label>
                    <Input id="otp" value={otp} onChange={(e) => setOtp(e.target.value)} maxLength={4} className="text-center text-lg tracking-[1rem]" autoFocus />
                </div>
                 {error && <p className="text-sm font-medium text-destructive">{error}</p>}
            </CardContent>
            <CardFooter className="flex-col gap-4">
                <Button onClick={handleOtpVerify} className="w-full" disabled={isVerifying || otp.length < 4}>
                    {isVerifying ? <Loader2 className="animate-spin mr-2"/> : null}
                    Verify & Register
                </Button>
                 <Button variant="link" onClick={() => setStep('form')}>Back to form</Button>
            </CardFooter>
        </Card>
    );
  }

  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader className="text-center">
        <div className="flex justify-center items-center gap-2 mb-2">
          <UserPlus className="h-8 w-8 text-primary" />
          <CardTitle className="text-3xl font-bold">Create Account</CardTitle>
        </div>
        <CardDescription>
          {servicePackage 
            ? `Sign up to purchase the ${servicePackage} package.`
            : 'Sign up to access your Fin Plan portal'
          }
        </CardDescription>
      </CardHeader>
      <form onSubmit={form.handleSubmit(handleGetOtp)}>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input id="name" placeholder="Your full name" {...form.register('name')} disabled={loading} />
            {form.formState.errors.name && <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>}
          </div>
           <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="flex items-center">
              <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm h-10">
                +880
              </span>
              <Input
                id="phone"
                type="tel"
                placeholder="1xxxxxxxxx"
                className="rounded-l-none"
                {...form.register('phone')}
                disabled={loading}
              />
            </div>
             {phoneError && <p className="text-destructive text-xs mt-1">{phoneError}</p>}
            {form.formState.errors.phone && <p className="text-destructive text-xs">{form.formState.errors.phone.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" {...form.register('password')} disabled={loading} />
            {form.formState.errors.password && <p className="text-destructive text-xs">{form.formState.errors.password.message}</p>}
          </div>
           <div className="space-y-2">
            <Label htmlFor="address">Address (Optional)</Label>
            <Input id="address" placeholder="Your address" {...form.register('address')} disabled={loading} />
          </div>
           {error && (
            <p className="text-sm font-medium text-destructive">{error}</p>
          )}
        </CardContent>
        <CardFooter className="flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading || !!phoneError}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
            Get OTP
          </Button>
          <div className="text-center text-sm">
              Already have an account?{' '}
              <Button asChild variant="link" className="p-0">
                 <Link href="/portal/login">
                   Log in
                 </Link>
              </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  )
}


export default function FinPlanSignupPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Suspense fallback={<div>Loading...</div>}>
        <SignupForm />
      </Suspense>
    </div>
  );
}
