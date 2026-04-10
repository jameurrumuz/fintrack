'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, ArrowLeft, MoreVertical, Edit, Trash2 } from 'lucide-react';
import type { FamilyRegistration } from '@/types';
import { subscribeToFamilyRegistrations, updateFamilyRegistration, deleteFamilyRegistration } from '@/services/familyRegistrationService';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/utils';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DatePicker } from '@/components/ui/date-picker';


// Edit Dialog Component
const EditRegistrationDialog = ({ registration, open, onOpenChange, onSave }: { registration: FamilyRegistration | null; open: boolean; onOpenChange: (open: boolean) => void; onSave: (id: string, data: Partial<Omit<FamilyRegistration, 'id'>>) => void; }) => {
    const [formData, setFormData] = useState<Partial<FamilyRegistration>>({});

    useEffect(() => {
        if (registration) {
            setFormData({
                ...registration,
                dob: registration.dob ? new Date(registration.dob).toISOString().split('T')[0] : ''
            });
        }
    }, [registration]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { id, value } = e.target;
        setFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleDateChange = (date: Date | undefined) => {
        if (date) {
            setFormData(prev => ({ ...prev, dob: date.toISOString().split('T')[0] }));
        }
    };

    const handleSaveChanges = () => {
        if (!registration) return;
        onSave(registration.id, formData);
        onOpenChange(false);
    };

    if (!registration) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Registration</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="name" className="text-right">Name</Label>
                        <Input id="name" value={formData.name || ''} onChange={handleInputChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="phone" className="text-right">Phone</Label>
                        <Input id="phone" value={formData.phone || ''} onChange={handleInputChange} className="col-span-3" />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="dob" className="text-right">Date of Birth</Label>
                        <DatePicker value={formData.dob ? new Date(formData.dob) : undefined} onChange={handleDateChange} />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="nid" className="text-right">NID</Label>
                        <Input id="nid" value={formData.nid || ''} onChange={handleInputChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="fatherName" className="text-right">Father's Name</Label>
                        <Input id="fatherName" value={formData.fatherName || ''} onChange={handleInputChange} className="col-span-3" />
                    </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="motherName" className="text-right">Mother's Name</Label>
                        <Input id="motherName" value={formData.motherName || ''} onChange={handleInputChange} className="col-span-3" />
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
                    <Button onClick={handleSaveChanges}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function RegistrationDatabasePage() {
    const [registrations, setRegistrations] = useState<FamilyRegistration[]>([]);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    const [editingRegistration, setEditingRegistration] = useState<FamilyRegistration | null>(null);

    useEffect(() => {
        setLoading(true);
        const unsub = subscribeToFamilyRegistrations(
            (data) => {
                setRegistrations(data);
                setLoading(false);
            },
            (err) => {
                toast({ variant: 'destructive', title: 'Error', description: err.message });
                setLoading(false);
            }
        );
        return () => unsub();
    }, [toast]);
    
    const handleSave = async (id: string, data: Partial<Omit<FamilyRegistration, 'id'>>) => {
        try {
            await updateFamilyRegistration(id, data);
            toast({ title: 'Success', description: 'Registration updated.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    };
    
    const handleDelete = async (id: string) => {
        try {
            await deleteFamilyRegistration(id);
            toast({ title: 'Success', description: 'Registration deleted.' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Error', description: error.message });
        }
    }

    return (
        <>
        <EditRegistrationDialog
            registration={editingRegistration}
            open={!!editingRegistration}
            onOpenChange={() => setEditingRegistration(null)}
            onSave={handleSave}
        />
        <div className="container mx-auto max-w-7xl py-8">
            <div className="mb-6">
                <Button variant="outline" asChild>
                    <Link href="/tools"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Tools</Link>
                </Button>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>Family Registration Database</CardTitle>
                    <CardDescription>A list of all submitted family registrations.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Date of Birth</TableHead>
                                    <TableHead>NID</TableHead>
                                    <TableHead>Father's Name</TableHead>
                                    <TableHead>Mother's Name</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loading ? (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            <Loader2 className="animate-spin h-8 w-8 mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : registrations.length > 0 ? (
                                    registrations.map(reg => (
                                        <TableRow key={reg.id}>
                                            <TableCell className="font-medium">{reg.name}</TableCell>
                                            <TableCell>{reg.phone}</TableCell>
                                            <TableCell>{formatDate(reg.dob)}</TableCell>
                                            <TableCell>{reg.nid}</TableCell>
                                            <TableCell>{reg.fatherName}</TableCell>
                                            <TableCell>{reg.motherName}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem onClick={() => setEditingRegistration(reg)}><Edit className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <DropdownMenuItem onSelect={(e) => e.preventDefault()} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Delete</DropdownMenuItem>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescriptionComponent>This will permanently delete this registration record.</AlertDialogDescriptionComponent></AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                                    <AlertDialogAction onClick={() => handleDelete(reg.id)}>Delete</AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={7} className="h-24 text-center">
                                            No registrations found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
        </>
    );
}
