

'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Note, NoteListItem } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Pin, PinOff, Trash2, Edit, CheckSquare, Image as ImageIcon, X, Camera, Upload } from 'lucide-react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { deleteNote } from '@/services/noteService';
import Image from 'next/image';
import { CameraCaptureDialog } from '@/components/ui/camera-capture-dialog';
import { uploadImage } from '@/services/storageService';


const noteColors = [
  'bg-white dark:bg-gray-800',
  'bg-red-100 dark:bg-red-900/30',
  'bg-orange-100 dark:bg-orange-900/30',
  'bg-yellow-100 dark:bg-yellow-900/30',
  'bg-green-100 dark:bg-green-900/30',
  'bg-blue-100 dark:bg-blue-900/30',
  'bg-purple-100 dark:bg-purple-900/30',
];

export const NoteCard = ({ note, onUpdate, onEdit }: { note: Note, onUpdate: (id: string, data: Partial<Note>) => void, onEdit: (note: Note) => void }) => {
    
    const handleToggleCheck = (itemId: string, checked: boolean) => {
        const updatedItems = note.items?.map(item => item.id === itemId ? { ...item, checked } : item);
        onUpdate(note.id, { items: updatedItems });
    };

    return (
      <Card className={cn("flex flex-col transition-colors break-inside-avoid group", note.color || 'bg-white dark:bg-gray-800')} onClick={() => onEdit(note)}>
        {note.imageUrl && (
            <div className="relative aspect-video">
                <Image src={note.imageUrl} alt={note.title || 'Note image'} fill className="object-cover" />
            </div>
        )}
        <CardHeader className="flex-row items-start justify-between pb-2">
          {note.title && <CardTitle className="text-lg font-bold">{note.title}</CardTitle>}
        </CardHeader>
        <CardContent className="flex-grow pt-0">
          {note.content && <p className="text-sm whitespace-pre-wrap">{note.content}</p>}
          {note.items && (
              <ul className="space-y-2">
                  {note.items.map(item => (
                      <li key={item.id} className="flex items-start gap-3" onClick={(e) => e.stopPropagation()}>
                          <Checkbox id={`${note.id}-${item.id}`} checked={item.checked} onCheckedChange={(checked) => handleToggleCheck(item.id, !!checked)} className="mt-0.5"/>
                          <label htmlFor={`${note.id}-${item.id}`} className={cn("text-sm", item.checked && "line-through text-muted-foreground")}>{item.text}</label>
                      </li>
                  ))}
              </ul>
          )}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span>{note.updatedAt ? formatDistanceToNow(parseISO(note.updatedAt), { addSuffix: true }) : 'just now'}</span>
            <div className="flex items-center">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => {e.stopPropagation(); onUpdate(note.id, { isPinned: !note.isPinned });}}>
                    {note.isPinned ? <PinOff className="h-4 w-4 text-primary" /> : <Pin className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={(e) => {e.stopPropagation(); deleteNote(note.id);}}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </CardFooter>
      </Card>
    );
};


const noteListItemSchema = z.object({
    id: z.string(),
    text: z.string().min(1, 'Item text cannot be empty'),
    checked: z.boolean(),
});

const editNoteSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  items: z.array(noteListItemSchema).optional(),
});

type EditNoteFormValues = z.infer<typeof editNoteSchema>;

export const EditNoteDialog = ({ note, isOpen, onOpenChange, onSave }: { note: Note | null, isOpen: boolean, onOpenChange: (open: boolean) => void, onSave: (id: string, data: Partial<Note>) => void }) => {
    const form = useForm<EditNoteFormValues>({
        resolver: zodResolver(editNoteSchema),
    });
    
    const { fields, append, remove, update } = useFieldArray({
        control: form.control,
        name: "items"
    });
    
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (note) {
            form.reset({ title: note.title || '', content: note.content || '', items: note.items || [] });
            setImagePreview(note.imageUrl || null);
        }
        setImageFile(null); // Reset file on open
    }, [note, isOpen, form]);

    if (!note) return null;

    const handleSave = async (data: EditNoteFormValues) => {
        let imageUrl = note.imageUrl;
        if (imageFile) {
            imageUrl = await uploadImage(imageFile, 'notes');
        }
        
        onSave(note.id, {
            ...data,
            imageUrl,
            items: data.items && data.items.length > 0 ? data.items : undefined,
            content: data.items && data.items.length > 0 ? undefined : data.content,
        });
        onOpenChange(false);
    };
    
    const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };
    const handleCaptureImage = (file: File) => {
        setImageFile(file);
        setImagePreview(URL.createObjectURL(file));
    };


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <CameraCaptureDialog open={isCameraOpen} onOpenChange={setIsCameraOpen} onCapture={handleCaptureImage} />
            <DialogContent>
                 <DialogHeader>
                    <DialogTitle className="sr-only">{note.title || 'Edit Note'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSave)} className="space-y-4">
                     {imagePreview && (
                         <div className="relative aspect-video rounded-lg overflow-hidden">
                           <Image src={imagePreview} alt="Note image" fill className="object-cover" />
                           <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => {setImageFile(null); setImagePreview(null); onSave(note.id, { imageUrl: '' })}}>
                                <X className="h-4 w-4" />
                           </Button>
                         </div>
                     )}
                    <Input {...form.register('title')} placeholder="Title" className="border-0 shadow-none focus-visible:ring-0 text-lg font-semibold" />

                    {(form.getValues('items') || []).length > 0 ? (
                        <div className="space-y-2">
                             {fields.map((field, index) => (
                                <div key={field.id} className="flex items-center gap-2">
                                    <Checkbox 
                                        checked={field.checked} 
                                        onCheckedChange={(checked) => update(index, {...field, checked: !!checked})}
                                    />
                                    <Input 
                                        {...form.register(`items.${index}.text`)}
                                        className={cn("border-0 shadow-none focus-visible:ring-0 h-auto p-0", field.checked && "line-through text-muted-foreground")}
                                    />
                                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} className="h-6 w-6"><X className="h-4 w-4"/></Button>
                                </div>
                            ))}
                            <Button type="button" variant="ghost" onClick={() => append({id: `item-${Date.now()}`, text: '', checked: false})}>+ Add item</Button>
                        </div>
                    ) : (
                         <Textarea {...form.register('content')} placeholder="Take a note..." rows={8} className="border-0 shadow-none focus-visible:ring-0"/>
                    )}
                   
                    <DialogFooter className="justify-between">
                         <div className="flex gap-2 items-center">
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageFileChange} />
                            <Button type="button" variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()}><Upload className="h-5 w-5"/></Button>
                            <Button type="button" variant="ghost" size="icon" onClick={() => setIsCameraOpen(true)}><Camera className="h-5 w-5"/></Button>
                            
                             <div className="flex gap-1 ml-4">
                                {noteColors.map(color => (
                                    <button 
                                        key={color} 
                                        type="button"
                                        onClick={() => onSave(note.id, { color })}
                                        className={cn("h-6 w-6 rounded-full border", color, note.color === color && "ring-2 ring-primary ring-offset-2")}
                                    />
                                ))}
                            </div>
                        </div>
                        <Button type="submit">Done</Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
