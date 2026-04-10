

'use client';

import React, { useState, useEffect, useMemo, Suspense, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, User, Phone, MapPin, Edit, Save, Plus, Trash2, Calendar, Ban, FileText, Notebook } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ClubMember, SubscriptionHistory } from '@/types';
import { subscribeToClubMemberById, updateClubMember } from '@/services/clubMemberService';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDate } from '@/lib/utils';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { DatePicker } from '@/components/ui/date-picker';
import { format, isPast, parseISO } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';


const subscriptionHistorySchema = z.object({
  subscriptionDate: z.date(),
  expiryDate: z.date(),
  amount: z.coerce.number().min(0),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
});
type SubscriptionFormValues = z.infer<typeof subscriptionHistorySchema>;

function MemberProfilePage({ params }: { params: Promise<{ memberId: string }> }) {
  const router = useRouter();
  const { memberId } = use(params);
  const [member, setMember] = useState<ClubMember | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isAddingSubscription, setIsAddingSubscription] = useState(false);
  const [banUntil, setBanUntil] = useState<Date | undefined>(undefined);
  const [banReason, setBanReason] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const { toast } = useToast();

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<Partial<ClubMember>>({
    // Using a simplified schema for editing basic details
  });

  const subscriptionForm = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionHistorySchema),
    defaultValues: {
      subscriptionDate: new Date(),
      expiryDate: new Date(new Date().setFullYear(new Date().getFullYear() + 1)),
      amount: 0,
    }
  });

  useEffect(() => {
    if (memberId) {
      const unsub = subscribeToClubMemberById(memberId, (data) => {
        setMember(data);
        if (data) {
          reset(data);
          setAdminNotes(data.adminNotes || '');
          setBanReason(data.banReason || '');
          if (data.banUntil) {
            setBanUntil(new Date(data.banUntil));
          } else {
            setBanUntil(undefined);
          }
        }
        setLoading(false);
      }, (err) => {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
        setLoading(false);
      });
      return () => unsub();
    }
  }, [memberId, toast, reset]);
  
  const handleUpdateDetails = async (data: Partial<ClubMember>) => {
    if (!member) return;
    try {
      await updateClubMember(member.id, data);
      toast({ title: 'Success', description: 'Member details updated.' });
      setIsEditing(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  
  const handleAddSubscription = async (data: SubscriptionFormValues) => {
    if (!member) return;

    const newSubscription: SubscriptionHistory = {
      id: `sub-${Date.now()}`,
      subscriptionDate: format(data.subscriptionDate, 'yyyy-MM-dd'),
      expiryDate: format(data.expiryDate, 'yyyy-MM-dd'),
      amount: data.amount,
      transactionId: data.transactionId,
      notes: data.notes,
    };

    const updatedHistory = [...(member.subscriptionHistory || []), newSubscription];
    const latestExpiryDate = updatedHistory.sort((a,b) => new Date(b.expiryDate).getTime() - new Date(a.expiryDate).getTime())[0].expiryDate;

    try {
      await updateClubMember(member.id, { 
        subscriptionHistory: updatedHistory,
        subscriptionEndDate: latestExpiryDate // Also update the main expiry date
      });
      toast({ title: 'Subscription Added' });
      setIsAddingSubscription(false);
      subscriptionForm.reset();
    } catch (e: any) {
       toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };

  const handleDeleteSubscription = async (subId: string) => {
    if (!member) return;
    const updatedHistory = (member.subscriptionHistory || []).filter(s => s.id !== subId);
    const latestExpiryDate = updatedHistory.length > 0 ? updatedHistory.sort((a,b) => new Date(b.expiryDate).getTime() - new Date(a.date).getTime())[0].expiryDate : member.joinDate;

    try {
        await updateClubMember(member.id, { subscriptionHistory: updatedHistory, subscriptionEndDate: latestExpiryDate });
        toast({ title: 'Subscription Removed' });
    } catch (e: any) {
        toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  
  const handleSaveBan = async () => {
    if (!member) return;
    try {
      const updates: Partial<ClubMember> = { 
        banUntil: banUntil ? banUntil.toISOString() : null,
        status: banUntil && isPast(banUntil) === false ? 'banned' : 'active',
        banReason: banReason,
        bannedAt: banUntil ? new Date().toISOString() : null,
      };
      await updateClubMember(member.id, updates);
      toast({ title: 'Success', description: 'Ban status updated.' });
    } catch (e: any) {
       toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  
  const handleSaveNotes = async () => {
    if (!member) return;
    try {
      await updateClubMember(member.id, { adminNotes });
      toast({ title: 'Success', description: 'Admin notes saved.' });
    } catch (e: any) {
       toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };


  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>;
  }
  if (!member) {
    return <div className="text-center p-8">Member not found.</div>;
  }
  
  const isBanned = member.status === 'banned' && member.banUntil && !isPast(new Date(member.banUntil));

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <Button variant="outline" onClick={() => router.push('/lalmonirhat-elite-club')}><ArrowLeft className="mr-2 h-4 w-4"/> Back to List</Button>
        <Button onClick={() => setIsEditing(!isEditing)}>{isEditing ? 'Cancel' : <><Edit className="mr-2 h-4 w-4"/> Edit Profile</>}</Button>
      </div>
      
      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
             <Avatar className="h-20 w-20"><AvatarImage src={member.imageUrl} /><AvatarFallback>{member.name.charAt(0)}</AvatarFallback></Avatar>
             <div>
                <CardTitle className="text-2xl flex items-center gap-2">
                  {member.name}
                  {isBanned && <Badge variant="destructive">Banned</Badge>}
                </CardTitle>
                <CardDescription>Member ID: {member.memberId}</CardDescription>
             </div>
          </div>
        </CardHeader>
        <CardContent>
          {isEditing ? (
            <form onSubmit={handleSubmit(handleUpdateDetails)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Name</Label><Input {...register('name')} /></div>
                  <div className="space-y-1"><Label>Phone</Label><Input {...register('phone')} /></div>
              </div>
              <div className="space-y-1"><Label>Address</Label><Input {...register('address')} /></div>
               <div className="space-y-1"><Label>Email</Label><Input {...register('email')} /></div>
              <Button type="submit">Save Changes</Button>
            </form>
          ) : (
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div className="font-semibold text-muted-foreground">Phone</div><div>{member.phone}</div>
                <div className="font-semibold text-muted-foreground">Address</div><div>{member.address}</div>
                <div className="font-semibold text-muted-foreground">Email</div><div>{member.email || 'N/A'}</div>
                <div className="font-semibold text-muted-foreground">Join Date</div><div>{formatDate(member.joinDate)}</div>
                <div className="font-semibold text-muted-foreground">Reference</div><div>{member.referenceName || 'N/A'}</div>
                 {isBanned && member.bannedAt && (
                    <>
                      <div className="font-semibold text-muted-foreground">Banned On</div><div>{formatDate(member.bannedAt)}</div>
                    </>
                 )}
                 {isBanned && member.banReason && (
                    <>
                        <div className="font-semibold text-muted-foreground">Ban Reason</div><div>{member.banReason}</div>
                    </>
                 )}
            </div>
          )}
        </CardContent>
      </Card>
      
       <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Ban/>Ban Management</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>Ban Until</Label>
                    <DatePicker value={banUntil} onChange={setBanUntil} disableFutureDates={false} />
                </div>
                 <div className="space-y-2">
                    <Label>Reason for Ban</Label>
                    <Input value={banReason} onChange={(e) => setBanReason(e.target.value)} placeholder="e.g., Misconduct, Payment issue" />
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleSaveBan}>Save Ban Status</Button>
                    <Button variant="ghost" onClick={() => { setBanUntil(undefined); setBanReason(''); }}>Clear Ban</Button>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Notebook/>Admin Notes</CardTitle></CardHeader>
            <CardContent className="space-y-4">
                <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} placeholder="Add internal notes about this member..." rows={4}/>
                 <Button onClick={handleSaveNotes}>Save Notes</Button>
            </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Subscription History</CardTitle>
            <Button size="sm" onClick={() => setIsAddingSubscription(true)}><Plus className="mr-2 h-4 w-4"/> Add Subscription</Button>
          </div>
        </CardHeader>
        <CardContent>
          {isAddingSubscription && (
            <form onSubmit={subscriptionForm.handleSubmit(handleAddSubscription)} className="p-4 border rounded-lg mb-4 space-y-4">
              <h4 className="font-semibold">New Subscription Record</h4>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                      <Label>Subscription Date</Label>
                      <Controller name="subscriptionDate" control={subscriptionForm.control} render={({field}) => <DatePicker value={field.value} onChange={field.onChange} />} />
                  </div>
                   <div className="space-y-1">
                      <Label>Expiry Date</Label>
                      <Controller name="expiryDate" control={subscriptionForm.control} render={({field}) => <DatePicker value={field.value} onChange={field.onChange} />} />
                  </div>
              </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1"><Label>Amount</Label><Input type="number" {...subscriptionForm.register('amount')} /></div>
                  <div className="space-y-1"><Label>Transaction ID</Label><Input {...subscriptionForm.register('transactionId')} /></div>
              </div>
              <div className="space-y-1"><Label>Notes</Label><Input {...subscriptionForm.register('notes')} /></div>
              <div className="flex gap-2">
                  <Button type="submit">Save</Button>
                  <Button type="button" variant="ghost" onClick={() => setIsAddingSubscription(false)}>Cancel</Button>
              </div>
            </form>
          )}

          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Expiry</TableHead><TableHead>Amount</TableHead><TableHead>Trx ID</TableHead><TableHead>Notes</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
            <TableBody>
              {(member.subscriptionHistory || []).map(sub => (
                <TableRow key={sub.id}>
                    <TableCell>{formatDate(sub.subscriptionDate)}</TableCell>
                    <TableCell>{formatDate(sub.expiryDate)}</TableCell>
                    <TableCell>{sub.amount}</TableCell>
                    <TableCell>{sub.transactionId}</TableCell>
                    <TableCell>{sub.notes}</TableCell>
                    <TableCell className="text-right">
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>This will delete this subscription record permanently.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteSubscription(sub.id)}>Delete</AlertDialogAction>
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
    </div>
  );
}

export default function MemberProfilePageWrapper(props: { params: Promise<{ memberId: string }> }) {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /></div>}>
            <MemberProfilePage {...props} />
        </Suspense>
    );
}

