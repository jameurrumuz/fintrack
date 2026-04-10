
'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Phone, Mail, MapPin, MessageSquare, Send, Loader2, Headset, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { sendMessage, subscribeToChatThread } from '@/services/chatService';
import { subscribeToPartyById } from '@/services/portalService';
import type { Party, ChatThread } from '@/types';
import { format, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CopyToClipboard } from '@/app/tools/copy-to-clipboard';
import { motion, AnimatePresence } from 'framer-motion';

const colors = {
    primary: '#1A05A2',
    secondary: '#8F0177',
    accent: '#DE1A58',
    gradient: 'from-[#1A05A2] via-[#8F0177] to-[#DE1A58]',
};

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export default function UserContactPage() {
    const { toast } = useToast();
    const [party, setParty] = useState<Party | null>(null);
    const [thread, setThread] = useState<ChatThread | null>(null);
    const [message, setMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const partyId = getCookie('loggedInPartyId');
        if (partyId) {
            const unsubParty = subscribeToPartyById(partyId, setParty, console.error);
            const unsubThread = subscribeToChatThread(partyId, setThread, console.error);
            return () => { unsubParty(); unsubThread(); };
        }
    }, []);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [thread?.messages]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!message.trim() || !party) return;

        setIsSending(true);
        try {
            await sendMessage(party.id, party.name, {
                senderId: party.id,
                senderName: party.name,
                text: message,
            });
            setMessage('');
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        } finally {
            setIsSending(false);
        }
    };

    const adminContact = {
        phone: '01617590765',
        email: 'jameurrumuz@gmail.com',
        address: 'Mohir Uddin Pramanik Market, Bottala, Mogolhat Road, Lalmonirhat'
    };

    return (
        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-50 min-h-screen">
            <header className={cn("bg-gradient-to-r p-4 pt-8 rounded-b-3xl shadow-lg text-white sticky top-0 z-10", colors.gradient)}>
                <div className="container mx-auto flex items-center justify-between">
                    <Button asChild variant="ghost" size="icon" className="text-white hover:bg-white/20">
                        <Link href="/portal/user/dashboard">
                            <ArrowLeft className="h-5 w-5" />
                        </Link>
                    </Button>
                    <h1 className="text-xl font-bold flex items-center gap-2"><Headset /> Support Center</h1>
                    <div className="w-10" />
                </div>
            </header>

            <main className="container mx-auto p-4 space-y-6 pb-32">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                    <Card className="border-0 shadow-xl rounded-3xl overflow-hidden bg-white">
                        <CardHeader className="bg-gray-50/50 p-6 border-b border-gray-100">
                            <CardTitle className="text-lg text-[#1A05A2]">Contact Details</CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-[#1A05A2]/10 text-[#1A05A2]"><Phone className="h-4 w-4" /></div>
                                    <span className="text-sm font-bold text-gray-700">{adminContact.phone}</span>
                                </div>
                                <div className="flex gap-1">
                                    <CopyToClipboard textToCopy={adminContact.phone} />
                                    <Button asChild variant="ghost" size="icon" className="text-green-600"><a href={`tel:${adminContact.phone}`}><Phone className="h-4 w-4"/></a></Button>
                                </div>
                            </div>
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-[#8F0177]/10 text-[#8F0177]"><Mail className="h-4 w-4" /></div>
                                    <span className="text-sm font-bold text-gray-700">{adminContact.email}</span>
                                </div>
                                <CopyToClipboard textToCopy={adminContact.email} />
                            </div>
                            <div className="flex items-start justify-between p-3 bg-gray-50 rounded-2xl">
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-xl bg-[#DE1A58]/10 text-[#DE1A58] mt-1"><MapPin className="h-4 w-4" /></div>
                                    <span className="text-sm font-bold text-gray-700 leading-tight">{adminContact.address}</span>
                                </div>
                                <CopyToClipboard textToCopy={adminContact.address} />
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>

                <Card className="border-0 shadow-2xl rounded-3xl overflow-hidden bg-white h-[500px] flex flex-col">
                    <CardHeader className="bg-gray-50/50 p-4 border-b border-gray-100 flex-shrink-0">
                        <CardTitle className="text-base flex items-center gap-2"><MessageCircle className="text-[#1A05A2]" /> Live Chat</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-grow overflow-y-auto p-4 space-y-4 bg-slate-50/30">
                        <AnimatePresence mode="popLayout">
                            {thread?.messages && thread.messages.length > 0 ? thread.messages.map((msg, idx) => (
                               <motion.div 
                                    key={msg.id}
                                    initial={{ opacity: 0, scale: 0.9, x: msg.senderId === party?.id ? 20 : -20 }}
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    className={cn("flex items-end gap-2", msg.senderId === party?.id ? "justify-end" : "justify-start")}
                                >
                                    {msg.senderId !== party?.id && (
                                        <Avatar className="h-8 w-8 shadow-sm">
                                            <AvatarFallback className="bg-gradient-to-br from-gray-400 to-gray-600 text-white text-[10px]">{msg.senderName.charAt(0)}</AvatarFallback>
                                        </Avatar>
                                    )}
                                    <div className={cn(
                                        "max-w-[75%] rounded-2xl p-3 text-sm shadow-sm relative",
                                        msg.senderId === party?.id 
                                            ? `bg-gradient-to-br ${colors.gradient} text-white rounded-br-none` 
                                            : "bg-white text-gray-800 border rounded-bl-none"
                                    )}>
                                        <p className="leading-relaxed">{msg.text}</p>
                                        <p className={cn("text-[8px] mt-1 text-right opacity-60", msg.senderId === party?.id ? "text-white" : "text-gray-400")}>
                                            {format(parseISO(msg.timestamp), "h:mm a")}
                                        </p>
                                    </div>
                                </motion.div>
                            )) : (
                                <div className="text-center py-20 opacity-30">
                                    <MessageSquare className="h-16 w-16 mx-auto mb-2" />
                                    <p className="text-sm">Start a conversation</p>
                                </div>
                            )}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </CardContent>
                    <CardFooter className="p-4 bg-white border-t border-gray-100 flex-shrink-0">
                        <form onSubmit={handleSendMessage} className="flex items-center gap-2 w-full">
                            <Input 
                                value={message} 
                                onChange={(e) => setMessage(e.target.value)} 
                                placeholder="Type a message..." 
                                className="h-12 rounded-2xl bg-gray-100 border-0 focus-visible:ring-[#1A05A2]"
                                disabled={isSending}
                            />
                            <Button 
                                type="submit" 
                                size="icon" 
                                className={cn("h-12 w-12 rounded-2xl bg-gradient-to-r shadow-lg shrink-0", colors.gradient)}
                                disabled={isSending || !message.trim()}
                            >
                                {isSending ? <Loader2 className="h-5 w-5 animate-spin"/> : <Send className="h-5 w-5" />}
                            </Button>
                        </form>
                    </CardFooter>
                </Card>
            </main>
        </div>
    );
}
