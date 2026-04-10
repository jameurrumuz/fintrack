'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, Shield, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { authenticateAdmin, authenticateParty } from '@/services/portalService';
import { useToast } from '@/hooks/use-toast';
import type { Party } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';


export default function FinPlanLoginPage() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [keepLoggedIn, setKeepLoggedIn] = useState(true);
  const [enableMobileView, setEnableMobileView] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    // Clear previous portal cookies
    document.cookie = 'userType=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    document.cookie = 'loggedInPartyId=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';
    document.cookie = 'isMobileView=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=None; Secure';

    const baseCookieOptions = `path=/; SameSite=None; Secure;`;
    const cookieOptions = keepLoggedIn
      ? `${baseCookieOptions} max-age=${60 * 60 * 24 * 7}` // 7 days
      : baseCookieOptions;

    if (enableMobileView) {
      document.cookie = `isMobileView=true; ${cookieOptions}`;
    }

    try {
      // 1. Check for Admin Login
      const adminResult = await authenticateAdmin(phone, password);
      if (adminResult.success) {
        document.cookie = `userType=fin-plan-admin; ${cookieOptions}`;
        router.push('/portal/admin/dashboard');
        toast({ title: "Welcome Admin!" });
        setLoading(false);
        return;
      }
      
      // 2. Check for Party Login
      const partyResult = await authenticateParty(phone, password);
      if (partyResult.success && partyResult.partyId && partyResult.party) {
        document.cookie = `loggedInPartyId=${partyResult.partyId}; ${cookieOptions}`;
        toast({ title: `Welcome ${partyResult.party.name}!` });
        
        // Redirect based on partyType
        if (partyResult.party.partyType === 'Staff') {
          document.cookie = `userType=fin-plan-staff; ${cookieOptions}`;
          router.push('/portal/staff/dashboard');
        } else {
          document.cookie = `userType=fin-plan-user; ${cookieOptions}`;
          router.push('/portal/user/dashboard');
        }
      } else {
        setError(partyResult.error || 'Invalid credentials.');
      }

    } catch (err) {
      console.error(err);
      setError('An error occurred during login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center">
          <div className="flex justify-center items-center gap-2 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <CardTitle className="text-3xl font-bold">Fin Plan Portal</CardTitle>
          </div>
          <CardDescription>Enter your credentials to access your account</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Your registered phone number"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
                <div className="flex items-center space-x-2">
                    <Checkbox id="keep-logged-in" checked={keepLoggedIn} onCheckedChange={(checked) => setKeepLoggedIn(!!checked)} />
                    <Label htmlFor="keep-logged-in" className="text-sm font-normal">Keep me logged in</Label>
                </div>
                 <div className="flex items-center space-x-2">
                    <Checkbox id="enable-mobile-view" checked={enableMobileView} onCheckedChange={(checked) => setEnableMobileView(!!checked)} />
                    <Label htmlFor="enable-mobile-view" className="text-sm font-normal">Enable mobile view</Label>
                </div>
            </div>
             {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}
          </CardContent>
          <CardFooter className="flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing In...' : <><LogIn className="mr-2 h-4 w-4" /> Sign In</>}
            </Button>
            <div className="text-center text-sm">
                Don't have an account?{' '}
                <Button asChild variant="link" className="p-0">
                   <Link href="/portal/signup">
                     Sign up
                   </Link>
                </Button>
            </div>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
