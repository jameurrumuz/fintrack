

'use client';

import React, { useState, useEffect, useRef, Suspense, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Loader2, Send, ArrowLeft, User, Phone, Briefcase } from 'lucide-react';
import { subscribeToChatThread, sendMessage, markMessagesAsRead } from '@/services/chatService';
import { subscribeToPartyById } from '@/services/portalService';
import type { ChatThread, ChatMessage, Party } from '@/types';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';


function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

function CustomerMessagePage({ params }: { params: Promise<{ partyId: string }> }) {
    const { partyId } = use(params);
    const router = useRouter();
    
    const [thread, setThread] = useState<ChatThread | null>(null);
    const [party, setParty] = useState<Party | null>(null);
    const [loading, setLoading] = useState(true);
    const [newMessage, setNewMessage] = useState('');
    const [isSending, setIsSending] = useState(false);
    
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const loggedInPartyId = getCookie('loggedInPartyId');
    const userType = getCookie('userType');
    
    const isAdmin = userType === 'fin-plan-admin';
    const senderId = isAdmin ? 'admin' : loggedInPartyId || '';
    const senderName = isAdmin ? 'Admin' : (party?.name || 'User');
    

    useEffect(() => {
        if (!partyId) return;

        setLoading(true);
        const unsubThread = subscribeToChatThread(partyId, (newThread) => {
            setThread(newThread);
            if (newThread) {
                 markMessagesAsRead(partyId, isAdmin ? 'admin' : 'user');
            }
        }, console.error);
        
        const unsubParty = subscribeToPartyById(partyId, setParty, console.error);

        const timer = setTimeout(() => setLoading(false), 500);

        return () => {
            unsubThread();
            unsubParty();
            clearTimeout(timer);
        };
    }, [partyId, isAdmin]);
    
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [thread?.messages]);


    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMessage.trim() || !partyId || !party?.name || isSending) return;

        setIsSending(true);
        try {
            await sendMessage(partyId, party.name, {
                senderId,
                senderName,
                text: newMessage,
            });
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        } finally {
            setIsSending(false);
        }
    };
    
    const goBack = () => {
        if (isAdmin) {
            router.push('/portal/admin/dashboard');
        } else {
            router.push('/portal/user/dashboard');
        }
    }

    if (loading || !party) {
        return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
    }
    
    return (
        <div className="flex flex-col h-screen bg-muted/40">
            <header className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b bg-background px-4">
                <Button variant="ghost" size="icon" onClick={goBack}>
                    <ArrowLeft />
                </Button>
                <div className="flex items-center gap-3">
                    <Avatar>
                        <AvatarImage src={party?.imageUrl} />
                        <AvatarFallback>{party?.name?.charAt(0) || 'U'}</AvatarFallback>
                    </Avatar>
                    <div>
                        <h1 className="text-lg font-semibold">{party?.name}</h1>
                        <p className="text-xs text-muted-foreground">{party?.phone}</p>
                    </div>
                     {party?.partyType && <Badge variant="outline">{party.partyType}</Badge>}
                </div>
            </header>
            
            <main className="flex-grow overflow-y-auto p-4 space-y-4">
                {thread?.messages && thread.messages.map((msg) => (
                    <div key={msg.id} className={cn("flex items-end gap-2", msg.senderId === senderId ? "justify-end" : "justify-start")}>
                        {msg.senderId !== senderId && (
                             <Avatar className="h-8 w-8">
                                <AvatarFallback>{msg.senderName.charAt(0)}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn(
                            "max-w-xs md:max-w-md rounded-lg p-3 text-sm",
                            msg.senderId === senderId ? "bg-primary text-primary-foreground rounded-br-none" : "bg-background rounded-bl-none border"
                        )}>
                            <p>{msg.text}</p>
                             <p className="text-xs opacity-70 mt-1 text-right">{formatDistanceToNow(parseISO(msg.timestamp), { addSuffix: true })}</p>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
                 {(!thread || thread.messages.length === 0) && (
                    <div className="text-center text-muted-foreground py-10">
                        No messages in this conversation yet.
                    </div>
                )}
            </main>
            
            <footer className="sticky bottom-0 z-10 border-t bg-background p-4">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <Input 
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Type your message..."
                        autoComplete="off"
                        disabled={isSending}
                    />
                    <Button type="submit" size="icon" disabled={isSending || !newMessage.trim()}>
                        {isSending ? <Loader2 className="h-4 w-4 animate-spin"/> : <Send className="h-4 w-4" />}
                    </Button>
                </form>
            </footer>
        </div>
    );
}

export default function Page(props: { params: Promise<{ partyId: string }> }) {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <CustomerMessagePage {...props} />
        </Suspense>
    )
}
