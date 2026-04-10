'use client';

import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { KeyRound, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PinLoginPageProps {
  onLoginSuccess: () => void;
  targetPin?: string;
}

const PIN_STORAGE_KEY = 'app-security-pin';
const SECURITY_QUESTION_KEY = 'app-security-question';
const SECURITY_ANSWER_KEY = 'app-security-answer';
const DEFAULT_PIN = '0035';
const PIN_LENGTH = 4;

const getPin = (): string => {
    if (typeof window === 'undefined') return DEFAULT_PIN;
    return localStorage.getItem(PIN_STORAGE_KEY) || DEFAULT_PIN;
};

const getSecurityInfo = (): { question: string, answer: string } => {
    if (typeof window === 'undefined') return { question: '', answer: '' };
    return {
        question: localStorage.getItem(SECURITY_QUESTION_KEY) || '',
        answer: localStorage.getItem(SECURITY_ANSWER_KEY) || '',
    }
}

const ForgotPinDialog = ({ onPinReset }: { onPinReset: (newPin: string) => void }) => {
    const [securityAnswer, setSecurityAnswer] = useState('');
    const [newPin, setNewPin] = useState('');
    const [confirmPin, setConfirmPin] = useState('');
    const [error, setError] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    const { question, answer: storedAnswer } = getSecurityInfo();
    const { toast } = useToast();

    if (!question) {
        return (
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Forgot PIN</DialogTitle>
                    <DialogDescription>
                        No security question has been set up. Please contact support or try to remember your PIN.
                    </DialogDescription>
                </DialogHeader>
                 <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="ghost">Close</Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        )
    }

    const handleVerifyAnswer = () => {
        if (securityAnswer.trim().toLowerCase() === storedAnswer.toLowerCase()) {
            setIsVerified(true);
            setError('');
            toast({ title: 'Answer Correct!', description: 'You can now set a new PIN.' });
        } else {
            setError('The provided answer is incorrect.');
        }
    };

    const handleResetPin = () => {
        if (newPin.length !== 4) {
            setError('New PIN must be 4 digits.');
            return;
        }
        if (newPin !== confirmPin) {
            setError('New PINs do not match.');
            return;
        }
        onPinReset(newPin);
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>Reset Your PIN</DialogTitle>
                <DialogDescription>Answer your security question to reset your PIN.</DialogDescription>
            </DialogHeader>
            {!isVerified ? (
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="securityQuestion">Security Question</Label>
                        <p id="securityQuestion" className="text-sm font-medium p-2 bg-muted rounded-md">{question}</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="securityAnswer">Your Answer</Label>
                        <Input id="securityAnswer" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)} />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
            ) : (
                <div className="space-y-4 py-4">
                     <div className="space-y-2">
                        <Label htmlFor="newPin">New PIN</Label>
                        <Input id="newPin" type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} maxLength={4} autoComplete="off" />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="confirmPin">Confirm New PIN</Label>
                        <Input id="confirmPin" type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} maxLength={4} autoComplete="off" />
                    </div>
                    {error && <p className="text-sm text-destructive">{error}</p>}
                </div>
            )}
            <DialogFooter>
                <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
                {!isVerified ? (
                    <Button onClick={handleVerifyAnswer}>Verify Answer</Button>
                ) : (
                    <Button onClick={handleResetPin}>Set New PIN</Button>
                )}
            </DialogFooter>
        </DialogContent>
    )
}

export default function PinLoginPage({ onLoginSuccess, targetPin }: PinLoginPageProps) {
  const [pin, setPin] = useState<string[]>(Array(PIN_LENGTH).fill(''));
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isForgotPinOpen, setIsForgotPinOpen] = useState(false);
  const { toast } = useToast();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleSubmit = (currentPin: string) => {
    setError('');
    setLoading(true);

    setTimeout(() => {
      const defaultPin = getPin();
      const correctPin = targetPin || defaultPin;
      if (currentPin === correctPin) {
        localStorage.setItem('sessionToken', `valid-session-${Date.now()}`);
        localStorage.setItem('sessionTimestamp', Date.now().toString());
        toast({ title: 'Success!', description: 'Access granted.' });
        onLoginSuccess();
      } else {
        setError('Invalid PIN. Please try again.');
        toast({ variant: 'destructive', title: 'Access Denied', description: 'The PIN you entered is incorrect.' });
        setPin(Array(PIN_LENGTH).fill(''));
        inputRefs.current[0]?.focus();
      }
      setLoading(false);
    }, 300);
  };
  
  const handlePinChange = (e: ChangeEvent<HTMLInputElement>, index: number) => {
      const { value } = e.target;
      const newPin = [...pin];

      if (value.length > 1) {
          const pasted = value.slice(0, PIN_LENGTH);
          for (let i = 0; i < pasted.length; i++) {
              if (index + i < PIN_LENGTH) {
                  newPin[index + i] = pasted[i];
              }
          }
          setPin(newPin);
          const fullPin = newPin.join('');
          if (fullPin.length === PIN_LENGTH) {
              handleSubmit(fullPin);
          } else {
              const nextFocusIndex = Math.min(index + pasted.length, PIN_LENGTH - 1);
              inputRefs.current[nextFocusIndex]?.focus();
          }
          return;
      }
      
      newPin[index] = value;
      setPin(newPin);

      const fullPin = newPin.join('');
      if (fullPin.length === PIN_LENGTH) {
          handleSubmit(fullPin);
      } else if (value && index < PIN_LENGTH - 1) {
          inputRefs.current[index + 1]?.focus();
      }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
      if (e.key === 'Backspace' && !pin[index] && index > 0) {
          inputRefs.current[index - 1]?.focus();
      }
  };
  
  const handlePinReset = (newPin: string) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem(PIN_STORAGE_KEY, newPin);
    }
    toast({ title: 'PIN Reset Successfully!', description: 'You can now log in with your new PIN.' });
    setIsForgotPinOpen(false);
    setPin(Array(PIN_LENGTH).fill(''));
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-muted/40">
        <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
            <div className="mx-auto bg-primary text-primary-foreground rounded-full p-3 w-fit mb-4">
            <KeyRound className="h-8 w-8" />
            </div>
            <CardTitle className="text-2xl">Enter Security PIN</CardTitle>
            <CardDescription>This application is protected. Please enter the PIN to continue.</CardDescription>
        </CardHeader>
        <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(pin.join('')); }} className="space-y-4">
                <div className="flex justify-center gap-2">
                {pin.map((digit, index) => (
                    <Input
                        key={index}
                        ref={el => {
                            inputRefs.current[index] = el;
                        }}
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={digit}
                        onChange={(e) => handlePinChange(e, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        className="h-14 w-12 text-center text-2xl"
                        maxLength={1}
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck="false"
                        name={`pin-${index}`}
                    />
                ))}
                </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading || pin.join('').length < PIN_LENGTH}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Unlock
            </Button>
            </form>
        </CardContent>
        <CardFooter className="flex justify-end">
            <Dialog open={isForgotPinOpen} onOpenChange={setIsForgotPinOpen}>
                <DialogTrigger asChild>
                    <Button variant="link" className="text-xs">Forgot PIN?</Button>
                </DialogTrigger>
                <ForgotPinDialog onPinReset={handlePinReset} />
            </Dialog>
        </CardFooter>
        </Card>
    </div>
  );
}