
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft, TrainFront, ArrowDown, ArrowUp, Clock, CalendarX, Ticket, SatelliteDish, ChevronDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface TrainInfo {
    id: string;
    name: string;
    route: string;
    offDay: string;
    upTrain: { name: string; number: string };
    downTrain: { name: string; number: string };
    arrivalTime: { hour: number; minute: number; location: string; };
}

const trainData: TrainInfo[] = [
    {
        id: 'burimari-express',
        name: 'বুড়িমারী এক্সপ্রেস',
        route: 'বুড়িমারী - লালমনিরহাট - ঢাকা',
        offDay: 'শুক্রবার',
        upTrain: { name: 'আপ ট্রেন (বুড়িমারী → ঢাকা)', number: '809' },
        downTrain: { name: 'ডাউন ট্রেন (ঢাকা → বুড়িমারী)', number: '810' },
        arrivalTime: { hour: 21, minute: 20, location: 'লালমনিরহাট' },
    },
    {
        id: 'korotoa-express',
        name: 'করতোয়া এক্সপ্রেস',
        route: 'সান্তাহার - বুড়িমারি',
        offDay: 'বুধবার',
        upTrain: { name: 'আপ ট্রেন (সান্তাহার → বুড়িমারি)', number: '713' },
        downTrain: { name: 'ডাউন ট্রেন (বুড়িমারি → সান্তাহার)', number: '714' },
        arrivalTime: { hour: 13, minute: 50, location: 'লালমনিরহাট' },
    },
    {
        id: 'lalmoni-express',
        name: 'লালমনি এক্সপ্রেস',
        route: 'লালমনিরহাট - ঢাকা',
        offDay: 'শুক্রবার',
        upTrain: { name: 'আপ ট্রেন (লালমনিরহাট → ঢাকা)', number: '751' },
        downTrain: { name: 'ডাউন ট্রেন (ঢাকা → লালমনিরহাট)', number: '752' },
        arrivalTime: { hour: 10, minute: 40, location: 'লালমনিরহাট' },
    },
    {
        id: 'rangpur-express',
        name: 'রংপুর এক্সপ্রেস',
        route: 'রংপুর - ঢাকা',
        offDay: 'রবিবার',
        upTrain: { name: 'আপ ট্রেন (রংপুর → ঢাকা)', number: '771' },
        downTrain: { name: 'ডাউন ট্রেন (ঢাকা → রংপুর)', number: '772' },
        arrivalTime: { hour: 20, minute: 40, location: 'কাউনিয়া' },
    }
];

const Countdown = ({ train }: { train: TrainInfo }) => {
    const [countdown, setCountdown] = useState('');
    const dayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const todayName = dayNames[new Date().getDay()];
    const isOffDay = train.offDay === todayName;

    useEffect(() => {
        if (isOffDay) {
            setCountdown(`আজ ${todayName}, ট্রেনের অফ ডে`);
            return;
        }

        const interval = setInterval(() => {
            const today = new Date();
            const targetTime = new Date();
            targetTime.setHours(train.arrivalTime.hour, train.arrivalTime.minute, 0, 0);

            if (today > targetTime) {
                targetTime.setDate(targetTime.getDate() + 1);
            }

            const diff = targetTime.getTime() - today.getTime();

            if (diff > 0) {
                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);
                setCountdown(`${train.arrivalTime.location} পৌঁছাতে বাকি: ${hours} ঘণ্টা ${minutes} মিনিট ${seconds} সেকেন্ড`);
            } else {
                setCountdown(`ট্রেনটি ${train.arrivalTime.location} পৌঁছেছে!`);
            }
        }, 1000);

        return () => clearInterval(interval);
    }, [train, isOffDay, todayName]);
    
    return (
        <div className={cn("text-center text-lg font-bold p-3 rounded-md", isOffDay ? "text-muted-foreground bg-muted" : "text-primary bg-primary/10")}>
            {countdown}
        </div>
    );
};


const TrainCard = ({ train }: { train: TrainInfo }) => {
    const dayNames = ['রবিবার', 'সোমবার', 'মঙ্গলবার', 'বুধবার', 'বৃহস্পতিবার', 'শুক্রবার', 'শনিবার'];
    const todayName = dayNames[new Date().getDay()];
    const isOffDay = train.offDay === todayName;

    return (
         <Card>
            <AccordionTrigger className="p-4 hover:no-underline">
                <div className="flex items-center gap-4">
                    <TrainFront className="h-8 w-8 text-primary" />
                    <div>
                        <CardTitle className="text-xl">{train.name}</CardTitle>
                        <CardDescription>{train.route}</CardDescription>
                    </div>
                     {isOffDay && <Badge variant="destructive">আজ অফ ডে</Badge>}
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="p-4 pt-0 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Card className="bg-green-50 dark:bg-green-900/20">
                            <CardHeader className="p-3">
                                <CardTitle className="text-base flex items-center gap-2 text-green-700 dark:text-green-300"><ArrowUp/> {train.upTrain.name}</CardTitle>
                                <CardDescription>ট্রেন নম্বর: {train.upTrain.number}</CardDescription>
                            </CardHeader>
                            <CardFooter className="p-3">
                                <Button asChild size="sm" className="w-full bg-green-600 hover:bg-green-700">
                                    <a href={`sms:16318?body=TR ${train.upTrain.number}`}><SatelliteDish className="mr-2"/>ট্র্যাক করুন</a>
                                </Button>
                            </CardFooter>
                        </Card>
                         <Card className="bg-red-50 dark:bg-red-900/20">
                            <CardHeader className="p-3">
                                <CardTitle className="text-base flex items-center gap-2 text-red-700 dark:text-red-300"><ArrowDown/> {train.downTrain.name}</CardTitle>
                                <CardDescription>ট্রেন নম্বর: {train.downTrain.number}</CardDescription>
                            </CardHeader>
                            <CardFooter className="p-3">
                                <Button asChild size="sm" className="w-full bg-red-600 hover:bg-red-700">
                                    <a href={`sms:16318?body=TR ${train.downTrain.number}`}><SatelliteDish className="mr-2"/>ট্র্যাক করুন</a>
                                </Button>
                            </CardFooter>
                        </Card>
                    </div>

                    <div className="text-center p-3 border rounded-lg">
                        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4"/> লালমনিরহাটে পৌঁছানোর নির্ধারিত সময়:</p>
                        <p className="text-lg font-semibold">{new Date(0, 0, 0, train.arrivalTime.hour, train.arrivalTime.minute).toLocaleTimeString('bn-BD', { hour: 'numeric', minute: 'numeric', hour12: true })}</p>
                    </div>

                    <Countdown train={train} />

                     <Button asChild size="lg" className="w-full">
                        <a href="https://railapp.railway.gov.bd/" target="_blank" rel="noopener noreferrer">
                            <Ticket className="mr-2"/> অনলাইন টিকিট কিনুন
                        </a>
                    </Button>
                </div>
            </AccordionContent>
        </Card>
    )
}

export default function TrainTrackerPage() {
    const [currentTime, setCurrentTime] = useState('');

     useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const options: Intl.DateTimeFormatOptions = { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                second: 'numeric',
                hour12: true
            };
            setCurrentTime(now.toLocaleDateString('bn-BD', options));
        }, 1000);
        return () => clearInterval(timer);
     }, []);

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-6 lg:p-8">
            <div className="mb-6">
                <Button variant="outline" asChild><Link href="/tools"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Tools</Link></Button>
            </div>
            
            <header className="text-center mb-8">
                <h1 className="text-4xl font-extrabold tracking-tight">বাংলাদেশ রেলওয়ে ট্র্যাকার</h1>
                <p className="mt-2 text-lg text-muted-foreground">সরাসরি আপনার ট্রেনের অবস্থান ও সময় জানুন</p>
                <p className="mt-4 font-mono text-sm text-muted-foreground">{currentTime}</p>
            </header>

            <Accordion type="single" collapsible defaultValue="burimari-express" className="w-full space-y-4">
                {trainData.map(train => (
                    <AccordionItem key={train.id} value={train.id} className="border-b-0">
                       <TrainCard train={train} />
                    </AccordionItem>
                ))}
            </Accordion>
            
            <Card className="mt-8">
                <CardHeader>
                    <CardTitle className="text-base">কিভাবে ব্যবহার করবেন?</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                    <p>১. যে ট্রেনটি ট্র্যাক করতে চান সেটির কার্ডে ক্লিক করুন।</p>
                    <p>২. 'ট্র্যাক করুন' বাটনে ক্লিক করলে আপনার ফোনের মেসেজিং অ্যাপ খুলবে।</p>
                    <p>৩. স্বয়ংক্রিয়ভাবে লেখা মেসেজটি 16318 নম্বরে পাঠিয়ে দিন। ফিরতি এসএমএস-এ ট্রেনের বর্তমান অবস্থান জানতে পারবেন।</p>
                    <p>৪. অফ ডে-তে সংশ্লিষ্ট ট্রেন চলাচল করে না।</p>
                </CardContent>
            </Card>
        </div>
    );
}

    