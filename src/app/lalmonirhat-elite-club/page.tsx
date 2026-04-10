

'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, Plus, Edit, Trash2, Search, User, Phone, MapPin, Percent, DollarSign, Wallet, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { ClubMember, AppSettings, MemberCategoryConfig } from '@/types';
import { subscribeToClubMembers, addClubMember, updateClubMember, deleteClubMember } from '@/services/clubMemberService';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
import { formatDate, formatAmount } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { uploadImage } from '@/services/storageService';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";


const memberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  address: z.string().optional(),
  memberId: z.string().optional(),
  joinDate: z.string().min(1, 'Join date is required'),
  status: z.enum(['active', 'inactive', 'banned']),
  imageUrl: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  facebookName: z.string().optional(),
  facebookUrl: z.string().url().optional().or(z.literal('')),
  referenceId: z.string().optional(),
  referenceName: z.string().optional(),
  referenceUrl: z.string().url().optional().or(z.literal('')),
  subscriptionEndDate: z.string().optional(),
  transactionNumber: z.string().optional(),
  memberCategory: z.string().optional(),
});
type MemberFormValues = z.infer<typeof memberSchema>;

const MemberFormDialog = ({ open, onOpenChange, onSave, member, allMembers, memberCategoryConfig }: { open: boolean, onOpenChange: (open: boolean) => void, onSave: (data: MemberFormValues, imageFile: File | null) => void, member: ClubMember | null, allMembers: ClubMember[], memberCategoryConfig: MemberCategoryConfig[] }) => {
  const { register, handleSubmit, reset, control, formState: { errors }, watch } = useForm<MemberFormValues>({ resolver: zodResolver(memberSchema) });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const selectedCategory = watch('memberCategory');
  const joiningFee = useMemo(() => {
      if (!selectedCategory) return 0;
      return memberCategoryConfig.find(c => c.name === selectedCategory)?.joiningFee || 0;
  }, [selectedCategory, memberCategoryConfig]);

  useEffect(() => {
    if (member) {
      reset({ 
          ...member, 
          email: member.email || '', 
          facebookName: member.facebookName || '', 
          facebookUrl: member.facebookUrl || '',
          referenceId: member.referenceId || '', 
          referenceName: member.referenceName || '', 
          referenceUrl: member.referenceUrl || '', 
          subscriptionEndDate: member.subscriptionEndDate, 
          transactionNumber: member.transactionNumber, 
          memberCategory: member.memberCategory || 'General' 
        });
      setImagePreview(member.imageUrl || null);
    } else {
      reset({ name: '', phone: '', address: '', memberId: '', joinDate: new Date().toISOString().split('T')[0], status: 'active', email: '', facebookName: '', facebookUrl: '', referenceId: '', referenceName: '', referenceUrl: '', subscriptionEndDate: '', transactionNumber: '', memberCategory: 'General' });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [member, reset, open]);
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader><DialogTitle>{member ? 'Edit Member' : 'Add New Member'}</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmit(data => onSave(data, imageFile))} className="space-y-4 py-4 max-h-[80vh] overflow-y-auto pr-6">
          <div className="flex justify-center"><Avatar className="h-24 w-24"><AvatarImage src={imagePreview || undefined}/><AvatarFallback><User className="h-12 w-12"/></AvatarFallback></Avatar></div>
          <Input type="file" accept="image/*" onChange={handleFileChange} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
                <Label>Name *</Label>
                <Input {...register('name')} placeholder="Name" />
                {errors.name && <p className="text-destructive text-xs">{errors.name.message}</p>}
            </div>
             <div className="space-y-1">
                <Label>Phone *</Label>
                <Input {...register('phone')} placeholder="Phone" />
                {errors.phone && <p className="text-destructive text-xs">{errors.phone.message}</p>}
            </div>
          </div>

          <div className="space-y-1">
            <Label>Address *</Label>
            <Input {...register('address')} placeholder="Address" />
            {errors.address && <p className="text-destructive text-xs">{errors.address.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
                <Label>Join Date *</Label>
                <Input type="date" {...register('joinDate')} />
                {errors.joinDate && <p className="text-destructive text-xs">{errors.joinDate.message}</p>}
            </div>
            <div className="space-y-1">
                <Label>Member ID</Label>
                <Input {...register('memberId')} placeholder="Auto-generated" disabled />
            </div>
          </div>
          
           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
                <Label>Email</Label>
                <Input type="email" {...register('email')} placeholder="Email address" />
                {errors.email && <p className="text-destructive text-xs">{errors.email.message}</p>}
            </div>
             <div className="space-y-1">
                <Label>Facebook Name</Label>
                <Input {...register('facebookName')} placeholder="Facebook profile name" />
            </div>
          </div>
          
           <div className="space-y-1">
            <Label>Facebook URL</Label>
            <Input {...register('facebookUrl')} placeholder="https://facebook.com/username" />
            {errors.facebookUrl && <p className="text-destructive text-xs">{errors.facebookUrl.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-1">
                <Label>Reference</Label>
                <Controller
                    name="referenceId"
                    control={control}
                    render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                            <SelectTrigger><SelectValue placeholder="Select referrer..."/></SelectTrigger>
                            <SelectContent>
                                {allMembers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    )}
                />
            </div>
            <div className="space-y-1">
                <Label>Reference URL</Label>
                <Input {...register('referenceUrl')} placeholder="Reference profile URL" />
                 {errors.referenceUrl && <p className="text-destructive text-xs">{errors.referenceUrl.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div className="space-y-1">
                  <Label>Subscription End Date</Label>
                  <Input type="date" {...register('subscriptionEndDate')} disabled/>
              </div>
              <div className="space-y-1">
                  <Label>Transaction Number</Label>
                  <Input {...register('transactionNumber')} placeholder="e.g., Bkash TrxID" />
              </div>
              <div className="space-y-1">
                  <Label>Member Category</Label>
                    <Controller
                        name="memberCategory"
                        control={control}
                        render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                                <SelectTrigger><SelectValue placeholder="Select category..."/></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="General">General</SelectItem>
                                    <SelectItem value="VIP">VIP</SelectItem>
                                    <SelectItem value="Founder">Founder</SelectItem>
                                    <SelectItem value="Monthly">Monthly</SelectItem>
                                    <SelectItem value="Yearly">Yearly</SelectItem>
                                    <SelectItem value="5 Year">5 Year</SelectItem>
                                    <SelectItem value="Lifetime">Lifetime</SelectItem>
                                    <SelectItem value="Bronze">Bronze</SelectItem>
                                    <SelectItem value="Silver">Silver</SelectItem>
                                    <SelectItem value="Titanium">Titanium</SelectItem>
                                    <SelectItem value="Gold">Gold</SelectItem>
                                    <SelectItem value="Platinum">Platinum</SelectItem>
                                    <SelectItem value="Diamond">Diamond</SelectItem>
                                </SelectContent>
                            </Select>
                        )}
                    />
              </div>
               {joiningFee > 0 && (
                <div className="md:col-span-3 text-center p-2 bg-blue-50 rounded-md">
                    <p className="font-semibold">Joining Fee for this category: <span className="font-bold text-blue-600">{formatAmount(joiningFee)}</span></p>
                </div>
            )}
          </div>

          <DialogFooter className="pt-4">
            <DialogClose asChild><Button type="button" variant="ghost">Cancel</Button></DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function LalmonirhatEliteClubPage() {
  const [members, setMembers] = useState<ClubMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<ClubMember | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [subscriptionFilter, setSubscriptionFilter] = useState('all');
  const { toast } = useToast();
  
  // New state for settings
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);


  useEffect(() => {
    const unsub = subscribeToClubMembers(setMembers, (err) => toast({ variant: 'destructive', title: 'Error', description: err.message }));
    getAppSettings().then(setAppSettings);
    setLoading(false);
    return () => unsub();
  }, [toast]);
  
  const memberCategoryConfig = useMemo(() => {
      const config = appSettings?.memberCategoryConfig || [];
      const defaultConfig: MemberCategoryConfig[] = [
        { id: 'General', name: 'General', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 },
        { id: 'VIP', name: 'VIP', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 },
        { id: 'Founder', name: 'Founder', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 * 10 },
        { id: 'Monthly', name: 'Monthly', profitPercentage: 0, joiningFee: 0, subscriptionDays: 30 },
        { id: 'Yearly', name: 'Yearly', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 },
        { id: '5 Year', name: '5 Year', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 * 5 },
        { id: 'Lifetime', name: 'Lifetime', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 * 99 },
        { id: 'Bronze', name: 'Bronze', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 },
        { id: 'Silver', name: 'Silver', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 },
        { id: 'Titanium', name: 'Titanium', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 },
        { id: 'Gold', name: 'Gold', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 },
        { id: 'Platinum', name: 'Platinum', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 },
        { id: 'Diamond', name: 'Diamond', profitPercentage: 0, joiningFee: 0, subscriptionDays: 365 },
      ];

      defaultConfig.forEach(defaultCat => {
        if (!config.find(c => c.id === defaultCat.id)) {
            config.push(defaultCat);
        }
      });
      
      return config;
  }, [appSettings]);

  const handleConfigChange = (id: string, field: 'profitPercentage' | 'joiningFee' | 'subscriptionDays', value: string) => {
    const newConfig = memberCategoryConfig.map(cat => 
        cat.id === id ? { ...cat, [field]: parseFloat(value) || 0 } : cat
    );
    if(appSettings) {
        const newSettings = { ...appSettings, memberCategoryConfig: newConfig };
        setAppSettings(newSettings);
        
        // Debounce the save operation
        if (debounceTimeout.current) {
            clearTimeout(debounceTimeout.current);
        }
        debounceTimeout.current = setTimeout(() => {
            saveAppSettings(newSettings);
            toast({title: "Settings saved."});
        }, 1000); // Wait 1 second after the last change
    }
  };


  const filteredMembers = useMemo(() => {
    return members.filter(member => {
        const searchMatch = searchTerm 
            ? member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              (member.phone && member.phone.includes(searchTerm)) ||
              (member.memberId && member.memberId.includes(searchTerm))
            : true;
        
        const isBanned = member.status === 'banned';
        
        let statusMatch = true;
        if (statusFilter !== 'all') {
            statusMatch = member.status === statusFilter;
        }

        let subscriptionMatch = true;
        if (subscriptionFilter !== 'all') {
            const isSubActive = member.subscriptionEndDate ? !isPast(parseISO(member.subscriptionEndDate)) : true;
            if (subscriptionFilter === 'active') {
                subscriptionMatch = isSubActive;
            } else if (subscriptionFilter === 'expired') {
                subscriptionMatch = !isSubActive;
            }
        }

        return searchMatch && statusMatch && subscriptionMatch;
    });
  }, [members, searchTerm, statusFilter, subscriptionFilter]);


  const handleSaveMember = async (data: MemberFormValues, imageFile: File | null) => {
    try {
      let imageUrl = editingMember?.imageUrl || undefined;
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'club-members');
      }
      
      const referrer = allMembers.find(m => m.id === data.referenceId);

      const memberData = { 
        ...data, 
        imageUrl, 
        referenceName: referrer?.name 
      };

      if (editingMember) {
        await updateClubMember(editingMember.id, memberData, memberCategoryConfig);
        toast({ title: 'Success', description: 'Member updated.' });
      } else {
        await addClubMember(memberData, memberCategoryConfig, allMembers);
        toast({ title: 'Success', description: 'New member added.' });
      }
      setIsDialogOpen(false);
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  };
  
  const handleDeleteMember = async (id: string) => {
    try {
      await deleteClubMember(id);
      toast({ title: 'Member Deleted' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Error', description: e.message });
    }
  }

  const allMembers = members; // for passing to dialog

  return (
    <div className="space-y-6">
      <MemberFormDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onSave={handleSaveMember} member={editingMember} allMembers={allMembers} memberCategoryConfig={memberCategoryConfig} />
      <Tabs defaultValue="members">
        <TabsList className="mb-4">
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="categories">Category Management</TabsTrigger>
        </TabsList>
        <TabsContent value="members">
            <Card>
                <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                    <CardTitle>Lalmonirhat Elite Club</CardTitle>
                    <CardDescription>Manage club member information.</CardDescription>
                    </div>
                    <Button onClick={() => { setEditingMember(null); setIsDialogOpen(true); }}><Plus className="mr-2 h-4 w-4"/> Add Member</Button>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search by name, phone, or ID..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9"/>
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                            <SelectItem value="banned">Banned</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={subscriptionFilter} onValueChange={setSubscriptionFilter}>
                        <SelectTrigger className="w-full sm:w-[180px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Subscriptions</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="expired">Expired</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                </CardHeader>
                <CardContent>
                <div className="rounded-md border">
                    <Table>
                    <TableHeader>
                        <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Member ID</TableHead>
                        <TableHead>Join Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Subscription</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Profit</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                        <TableRow><TableCell colSpan={10} className="h-24 text-center"><Loader2 className="animate-spin"/></TableCell></TableRow>
                        ) : filteredMembers.length > 0 ? (
                        filteredMembers.map(member => {
                            const isSubscriptionActive = member.subscriptionEndDate ? !isPast(parseISO(member.subscriptionEndDate)) : true; // Assume active if no date
                            const isBanned = member.status === 'banned';
                            const referralCount = members.filter(m => m.referenceId === member.id).length;
                            const referrer = members.find(m => m.id === member.referenceId);
                            
                            return (
                                <TableRow key={member.id}>
                                <TableCell className="font-medium">
                                <Link href={`/lalmonirhat-elite-club/${member.id}`} className="flex items-center gap-2 hover:underline">
                                        <Avatar><AvatarImage src={member.imageUrl}/><AvatarFallback>{member.name.charAt(0)}</AvatarFallback></Avatar>
                                        {member.name}
                                    </Link>
                                </TableCell>
                                <TableCell>{member.phone}</TableCell>
                                <TableCell>{member.memberId}</TableCell>
                                <TableCell>{formatDate(member.joinDate)}</TableCell>
                                <TableCell><Badge variant="secondary">{member.memberCategory || 'General'}</Badge></TableCell>
                                <TableCell>
                                    <Badge variant={isSubscriptionActive ? "default" : "destructive"} className={cn(isSubscriptionActive && "bg-green-100 text-green-700")}>
                                        {isSubscriptionActive ? 'Active' : 'Expired'}
                                    </Badge>
                                    {member.subscriptionEndDate && <p className="text-xs text-muted-foreground">{formatDate(member.subscriptionEndDate)}</p>}
                                </TableCell>
                                <TableCell>
                                    {isBanned ? (
                                        <Badge variant="destructive">Banned</Badge>
                                    ) : (
                                        <Badge variant="default" className={cn(member.status === 'active' ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600")}>
                                            {member.status}
                                        </Badge>
                                    )}
                                </TableCell>
                                <TableCell className="font-mono text-right">{formatAmount(member.profitBalance || 0)}</TableCell>
                                <TableCell>{referrer?.name || member.referenceName || '-'} {referralCount > 0 && `(${referralCount})`}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="icon" onClick={() => { setEditingMember(member); setIsDialogOpen(true); }}><Edit className="h-4 w-4"/></Button>
                                    <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader><AlertDialogTitle>Confirm Deletion</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete {member.name}?</AlertDialogDescription></AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteMember(member.id)}>Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                                </TableRow>
                            )
                        })
                        ) : (
                        <TableRow><TableCell colSpan={10} className="h-24 text-center">No members found.</TableCell></TableRow>
                        )}
                    </TableBody>
                    </Table>
                </div>
                </CardContent>
            </Card>
        </TabsContent>
        <TabsContent value="categories">
            <Card>
                <CardHeader>
                    <CardTitle>Member Category Management</CardTitle>
                    <CardDescription>Set joining fees, profit percentages, and subscription durations for different member categories.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-1/4">Category Name</TableHead>
                                    <TableHead className="w-1/4">Joining Fee</TableHead>
                                    <TableHead className="w-1/4">Profit Share</TableHead>
                                    <TableHead className="w-1/4">Subscription Duration</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {memberCategoryConfig.map(config => (
                                    <TableRow key={config.id}>
                                        <TableCell className="font-medium">{config.name}</TableCell>
                                        <TableCell>
                                            <div className="relative">
                                                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                                <Input 
                                                    type="number" 
                                                    defaultValue={config.joiningFee || 0}
                                                    onBlur={(e) => handleConfigChange(config.id, 'joiningFee', e.target.value)}
                                                    className="w-full pl-8"
                                                    placeholder="0"
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="relative">
                                                <Input 
                                                    type="number" 
                                                    defaultValue={config.profitPercentage}
                                                    onBlur={(e) => handleConfigChange(config.id, 'profitPercentage', e.target.value)}
                                                    className="w-full pr-8"
                                                />
                                                <Percent className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                         <TableCell>
                                            <div className="relative">
                                                <Input 
                                                    type="number" 
                                                    defaultValue={config.subscriptionDays || 365}
                                                    onBlur={(e) => handleConfigChange(config.id, 'subscriptionDays', e.target.value)}
                                                    className="w-full pr-8"
                                                />
                                                <CalendarDays className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
