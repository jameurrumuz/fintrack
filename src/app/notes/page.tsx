'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { subscribeToNotes, addNote, updateNote } from '@/services/noteService';
import type { Note, NoteListItem } from '@/types';
import { 
  Loader2, Plus, Pin, PinOff, Trash2, Edit, CheckSquare, 
  Image as ImageIcon, X, Upload, Camera, ListChecks, Search, 
  Link, ExternalLink, Calendar, Clock, FolderTree, Trash
} from 'lucide-react';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { uploadImage } from '@/services/storageService';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

const noteListItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Item text cannot be empty'),
  checked: z.boolean(),
});

const noteSchema = z.object({
  title: z.string().optional(),
  content: z.string().optional(),
  items: z.array(noteListItemSchema).optional(),
});

type NoteFormValues = z.infer<typeof noteSchema>;

// Extended Note type with additional properties for our app
interface ExtendedNote extends Note {
  isPinned?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  linkedNotes?: string[];
  subNotes?: string[];
  parentNoteId?: string;
  color?: string;
}

// Helper function to safely format date
const safeFormatDate = (dateString: string | undefined, formatStr: string): string => {
  if (!dateString) return 'Invalid date';
  try {
    return format(parseISO(dateString), formatStr);
  } catch {
    return 'Invalid date';
  }
};

// Helper function to safely get time ago
const safeTimeAgo = (dateString: string | undefined): string => {
  if (!dateString) return 'Invalid date';
  try {
    return formatDistanceToNow(parseISO(dateString));
  } catch {
    return 'Invalid date';
  }
};

// Note Card Component
const NoteCardComponent = ({ 
  note, 
  onUpdate, 
  onEdit,
  onPermanentDelete,
  allNotes 
}: { 
  note: ExtendedNote; 
  onUpdate: (id: string, data: Partial<ExtendedNote>) => void; 
  onEdit: (note: ExtendedNote) => void;
  onPermanentDelete?: (id: string) => void;
  allNotes: ExtendedNote[];
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  const handleTogglePin = () => {
    onUpdate(note.id, { isPinned: !note.isPinned });
  };

  const handleDelete = () => {
    if (confirm('Are you sure you want to move this note to trash?')) {
      onUpdate(note.id, { isDeleted: true, deletedAt: new Date().toISOString() });
    }
  };

  const handlePermanentDelete = () => {
    if (confirm('Are you sure you want to permanently delete this note? This action cannot be undone.')) {
      onPermanentDelete?.(note.id);
    }
  };

  const getColorClasses = () => {
    switch (note.color) {
      case 'bg-yellow-50 dark:bg-yellow-950/30':
        return 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800';
      case 'bg-blue-50 dark:bg-blue-950/30':
        return 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800';
      case 'bg-green-50 dark:bg-green-950/30':
        return 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800';
      case 'bg-purple-50 dark:bg-purple-950/30':
        return 'bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-800';
      default:
        return 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700';
    }
  };

  const linkedNotesList = note.linkedNotes?.filter((id: string) => allNotes.find(n => n.id === id && !n.isDeleted)) || [];
  const subNotesList = note.subNotes?.filter((id: string) => allNotes.find(n => n.id === id && !n.isDeleted)) || [];

  return (
    <Card 
      className={cn(
        "group relative break-inside-avoid transition-all duration-200 hover:shadow-lg border cursor-pointer",
        getColorClasses()
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onEdit(note)}
    >
      <CardContent className="p-4">
        {note.imageUrl && (
          <div className="mb-3 -mx-4 -mt-4 overflow-hidden rounded-t-lg">
            <img src={note.imageUrl} alt="Note attachment" className="w-full h-48 object-cover" />
          </div>
        )}
        
        {note.title && (
          <h3 className="font-semibold text-lg mb-2 line-clamp-2">{note.title}</h3>
        )}
        
        {note.content && (
          <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{note.content}</p>
        )}
        
        {note.items && note.items.length > 0 && (
          <div className="space-y-2 mt-2">
            {note.items.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-start gap-2 text-sm">
                <Checkbox checked={item.checked} className="mt-0.5" disabled />
                <span className={cn("flex-1", item.checked && "line-through text-muted-foreground")}>
                  {item.text}
                </span>
              </div>
            ))}
            {note.items.length > 5 && (
              <p className="text-xs text-muted-foreground">+{note.items.length - 5} more items</p>
            )}
          </div>
        )}

        {/* Show linked notes count */}
        {(linkedNotesList.length > 0 || subNotesList.length > 0) && (
          <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
            {linkedNotesList.length > 0 && (
              <span className="flex items-center gap-1">
                <Link className="h-3 w-3" />
                {linkedNotesList.length} linked
              </span>
            )}
            {subNotesList.length > 0 && (
              <span className="flex items-center gap-1">
                <FolderTree className="h-3 w-3" />
                {subNotesList.length} sub-notes
              </span>
            )}
          </div>
        )}
        
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/50">
          <div className="flex flex-col text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {safeFormatDate(note.createdAt, 'MMM dd, yyyy')}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {safeFormatDate(note.createdAt, 'hh:mm a')}
            </span>
          </div>
          
          <div className={cn("flex gap-1 transition-opacity", isHovered ? "opacity-100" : "opacity-0")}>
            {!note.isDeleted && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTogglePin();
                  }}
                >
                  {note.isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete();
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </>
            )}
            {note.isDeleted && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePermanentDelete();
                }}
              >
                <Trash className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Link Notes Dialog Component
const LinkNotesDialog = ({ 
  isOpen, 
  onOpenChange, 
  currentNote, 
  allNotes, 
  onLink 
}: { 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  currentNote: ExtendedNote;
  allNotes: ExtendedNote[];
  onLink: (noteId: string, updates: Partial<ExtendedNote>) => void;
}) => {
  const [selectedNotes, setSelectedNotes] = useState<string[]>([]);
  const [linkType, setLinkType] = useState<'linked' | 'subnote'>('linked');

  useEffect(() => {
    if (currentNote) {
      if (linkType === 'linked') {
        setSelectedNotes(currentNote.linkedNotes || []);
      } else {
        setSelectedNotes(currentNote.subNotes || []);
      }
    }
  }, [currentNote, linkType]);

  const availableNotes = allNotes.filter(note => 
    note.id !== currentNote?.id && 
    !note.isDeleted &&
    (linkType === 'linked' ? !(currentNote?.linkedNotes || []).includes(note.id) : !(currentNote?.subNotes || []).includes(note.id))
  );

  const handleToggleNote = (noteId: string) => {
    setSelectedNotes(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    );
  };

  const handleSave = () => {
    if (linkType === 'linked') {
      onLink(currentNote.id, { linkedNotes: selectedNotes });
    } else {
      onLink(currentNote.id, { subNotes: selectedNotes });
      // Update parent reference for sub-notes
      selectedNotes.forEach(subNoteId => {
        onLink(subNoteId, { parentNoteId: currentNote.id });
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Link Notes to "{currentNote?.title || 'Untitled'}"</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <Button
              variant={linkType === 'linked' ? 'default' : 'outline'}
              onClick={() => setLinkType('linked')}
              className="flex-1"
            >
              <Link className="h-4 w-4 mr-2" />
              Linked Notes
            </Button>
            <Button
              variant={linkType === 'subnote' ? 'default' : 'outline'}
              onClick={() => setLinkType('subnote')}
              className="flex-1"
            >
              <FolderTree className="h-4 w-4 mr-2" />
              Sub-Notes
            </Button>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium">
              {linkType === 'linked' ? 'Available Notes to Link' : 'Available Sub-Notes'}
            </h4>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {availableNotes.length === 0 ? (
                <p className="text-muted-foreground text-sm">No notes available to link</p>
              ) : (
                availableNotes.map(note => (
                  <div
                    key={note.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                      selectedNotes.includes(note.id) && "bg-primary/10 border-primary"
                    )}
                    onClick={() => handleToggleNote(note.id)}
                  >
                    <Checkbox checked={selectedNotes.includes(note.id)} />
                    <div className="flex-1">
                      <p className="font-medium">{note.title || 'Untitled'}</p>
                      <p className="text-xs text-muted-foreground">
                        {safeFormatDate(note.createdAt, 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Links</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Edit Note Dialog Component
const EditNoteDialog = ({ 
  isOpen, 
  onOpenChange, 
  note, 
  onSave,
  allNotes,
  onLink 
}: { 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  note: ExtendedNote | null;
  onSave: (id: string, data: Partial<ExtendedNote>) => void;
  allNotes: ExtendedNote[];
  onLink: (noteId: string, updates: Partial<ExtendedNote>) => void;
}) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [items, setItems] = useState<NoteListItem[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title || '');
      setContent(note.content || '');
      setItems(note.items || []);
      setImageUrl(note.imageUrl || '');
    }
  }, [note]);

  const handleSave = () => {
    if (!note) return;
    
    const updates: Partial<ExtendedNote> = {};
    if (title !== note.title) updates.title = title;
    if (content !== note.content) updates.content = content;
    if (JSON.stringify(items) !== JSON.stringify(note.items)) updates.items = items;
    if (imageUrl !== note.imageUrl) updates.imageUrl = imageUrl;
    
    if (Object.keys(updates).length > 0) {
      onSave(note.id, updates);
    }
    onOpenChange(false);
  };

  const linkedNotes = note?.linkedNotes?.filter((id: string) => allNotes.find((n: ExtendedNote) => n.id === id && !n.isDeleted)) || [];
  const subNotes = note?.subNotes?.filter((id: string) => allNotes.find((n: ExtendedNote) => n.id === id && !n.isDeleted)) || [];

  if (!isOpen || !note) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => onOpenChange(false)}>
        <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
          <CardHeader>
            <CardTitle>Edit Note</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {imageUrl && (
              <div className="relative">
                <img src={imageUrl} alt="Note" className="w-full h-48 object-cover rounded-lg" />
                <Button
                  variant="destructive"
                  size="icon"
                  className="absolute top-2 right-2 h-8 w-8"
                  onClick={() => setImageUrl('')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <Input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <Textarea
              placeholder="Content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
            />
            {items.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium">Checklist</h4>
                {items.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={(checked) => {
                        const newItems = [...items];
                        newItems[index] = { ...newItems[index], checked: !!checked };
                        setItems(newItems);
                      }}
                    />
                    <Input
                      value={item.text}
                      onChange={(e) => {
                        const newItems = [...items];
                        newItems[index] = { ...newItems[index], text: e.target.value };
                        setItems(newItems);
                      }}
                      placeholder="Item text"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newItems = items.filter((_, i) => i !== index);
                        setItems(newItems);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setItems([...items, { id: `item-${Date.now()}`, text: '', checked: false }]);
                  }}
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Item
                </Button>
              </div>
            )}

            {/* Linked Notes Section */}
            <div className="space-y-2 pt-4 border-t">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Link className="h-4 w-4" />
                  Linked Notes
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowLinkDialog(true)}
                >
                  <Plus className="h-4 w-4 mr-1" /> Manage Links
                </Button>
              </div>
              
              {linkedNotes.length > 0 && (
                <div className="space-y-2">
                  {linkedNotes.map((linkedNoteId: string) => {
                    const linkedNote = allNotes.find((n: ExtendedNote) => n.id === linkedNoteId);
                    return linkedNote ? (
                      <div key={linkedNoteId} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium">{linkedNote.title || 'Untitled'}</p>
                          <p className="text-xs text-muted-foreground">
                            {safeFormatDate(linkedNote.createdAt, 'MMM dd, yyyy')}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            onOpenChange(false);
                            setTimeout(() => {
                              console.log('Navigate to note:', linkedNoteId);
                            }, 100);
                          }}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : null;
                  })}
                </div>
              )}

              {subNotes.length > 0 && (
                <>
                  <h4 className="font-medium flex items-center gap-2 mt-4">
                    <FolderTree className="h-4 w-4" />
                    Sub-Notes
                  </h4>
                  <div className="space-y-2">
                    {subNotes.map((subNoteId: string) => {
                      const subNote = allNotes.find((n: ExtendedNote) => n.id === subNoteId);
                      return subNote ? (
                        <div key={subNoteId} className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <div>
                            <p className="text-sm font-medium">{subNote.title || 'Untitled'}</p>
                            <p className="text-xs text-muted-foreground">
                              {safeFormatDate(subNote.createdAt, 'MMM dd, yyyy hh:mm a')}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              onOpenChange(false);
                              setTimeout(() => {
                                console.log('Navigate to sub-note:', subNoteId);
                              }, 100);
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : null;
                    })}
                  </div>
                </>
              )}
            </div>

            {/* Creation Info */}
            {note && (
              <div className="text-xs text-muted-foreground pt-4 border-t">
                <p>Created: {safeFormatDate(note.createdAt, 'MMMM dd, yyyy hh:mm a')}</p>
                <p>Last updated: {safeFormatDate(note.updatedAt, 'MMMM dd, yyyy hh:mm a')}</p>
                {note.deletedAt && (
                  <p>Deleted: {safeFormatDate(note.deletedAt, 'MMMM dd, yyyy hh:mm a')}</p>
                )}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave}>Save Changes</Button>
          </CardFooter>
        </Card>
      </div>

      <LinkNotesDialog
        isOpen={showLinkDialog}
        onOpenChange={setShowLinkDialog}
        currentNote={note}
        allNotes={allNotes}
        onLink={onLink}
      />
    </>
  );
};

// Trash Dialog Component
const TrashDialog = ({ 
  isOpen, 
  onOpenChange, 
  deletedNotes, 
  onRestore, 
  onPermanentDelete 
}: { 
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  deletedNotes: ExtendedNote[];
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
}) => {
  const [selectedNote, setSelectedNote] = useState<ExtendedNote | null>(null);

  const handlePermanentDelete = (noteId: string) => {
    if (confirm('Are you sure you want to permanently delete this note? This action cannot be undone.')) {
      onPermanentDelete(noteId);
    }
  };

  const handleRestore = (noteId: string) => {
    onRestore(noteId);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash className="h-5 w-5" />
            Trash
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {deletedNotes.length === 0 ? (
            <div className="text-center py-12">
              <Trash className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Trash is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {deletedNotes.map(note => (
                <Card key={note.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 cursor-pointer" onClick={() => setSelectedNote(note)}>
                      {note.title && (
                        <h3 className="font-semibold mb-1">{note.title}</h3>
                      )}
                      {note.content && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                      )}
                      {note.items && note.items.length > 0 && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {note.items.length} checklist items
                        </p>
                      )}
                      {note.deletedAt && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Deleted {safeTimeAgo(note.deletedAt)} ago
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(note.id)}
                      >
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => handlePermanentDelete(note.id)}
                      >
                        Delete Forever
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>

      {/* View Note Dialog */}
      {selectedNote && (
        <EditNoteDialog
          isOpen={!!selectedNote}
          onOpenChange={() => setSelectedNote(null)}
          note={selectedNote}
          onSave={() => {}}
          allNotes={[]}
          onLink={() => {}}
        />
      )}
    </Dialog>
  );
};

export default function NotesPage() {
  const [notes, setNotes] = useState<ExtendedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<ExtendedNote | null>(null);
  const [isFormExpanded, setIsFormExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<NoteFormValues>({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: '', content: '', items: [] },
  });
  
  const { fields, append, remove, update } = useFieldArray({
    control: form.control,
    name: "items"
  });

  const watchItems = form.watch('items');
  const isChecklist = watchItems && watchItems.length > 0;

  useEffect(() => {
    const unsub = subscribeToNotes((data: Note[]) => {
      // Convert Note[] to ExtendedNote[] with default values
      const extendedNotes: ExtendedNote[] = data.map(note => ({
        ...note,
        isPinned: false,
        isDeleted: false,
        linkedNotes: [],
        subNotes: [],
        color: 'bg-white dark:bg-gray-800',
      }));
      setNotes(extendedNotes);
      setLoading(false);
    }, (err: Error) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
      setLoading(false);
    });
    return () => unsub();
  }, [toast]);

  // Click outside handler to collapse form
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        if(isFormExpanded) {
          form.handleSubmit(handleAddNote)();
          setIsFormExpanded(false);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef, isFormExpanded, form]);

  // Filter notes based on search query and trash status
  const filteredNotes = useMemo(() => {
    if (showTrash) {
      return notes.filter(n => n.isDeleted === true);
    }
    
    if (!searchQuery.trim()) return notes.filter(n => !n.isDeleted);
    
    const query = searchQuery.toLowerCase().trim();
    return notes.filter(note => 
      !note.isDeleted && (
        note.title?.toLowerCase().includes(query) ||
        note.content?.toLowerCase().includes(query) ||
        note.items?.some(item => item.text.toLowerCase().includes(query))
      )
    );
  }, [notes, searchQuery, showTrash]);

  const { pinnedNotes, otherNotes } = useMemo(() => {
    const pinned = filteredNotes.filter(n => n.isPinned);
    const others = filteredNotes.filter(n => !n.isPinned);
    return { pinnedNotes: pinned, otherNotes: others };
  }, [filteredNotes]);
  
  const resetFormState = () => {
    form.reset({ title: '', content: '', items: [] });
    setImageFile(null);
    setImagePreview(null);
    if(fileInputRef.current) fileInputRef.current.value = '';
    setIsFormExpanded(false);
  }

  const handleAddNote = async (data: NoteFormValues) => {
    if (!data.title && !data.content && (!data.items || data.items.length === 0) && !imageFile) {
      setIsFormExpanded(false);
      return;
    }

    try {
      let imageUrl = '';
      if (imageFile) {
        imageUrl = await uploadImage(imageFile, 'notes');
      }

      const newNote: Partial<Note> = {
        title: data.title || '',
        imageUrl: imageUrl || undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      
      if (data.items && data.items.length > 0) {
        newNote.items = data.items;
      } else if (data.content) {
        newNote.content = data.content;
      }

      await addNote(newNote as Omit<Note, 'id'>);
      toast({ title: 'Note created successfully.' });
      resetFormState();
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  };
  
  const handleUpdateNote = async (id: string, data: Partial<ExtendedNote>) => {
    try {
      // Convert ExtendedNote updates to base Note updates
      const baseUpdates: Partial<Note> = {
        title: data.title,
        content: data.content,
        items: data.items,
        imageUrl: data.imageUrl,
        updatedAt: new Date().toISOString(),
      };
      await updateNote(id, baseUpdates);
      
      // Update local state
      setNotes(prev => prev.map(note => 
        note.id === id ? { ...note, ...data } : note
      ));
      
      toast({ title: 'Note updated successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: `Could not update note: ${error.message}` });
    }
  }

  const handlePermanentDelete = async (id: string) => {
    try {
      // Remove from local state (permanent delete)
      setNotes(prev => prev.filter(note => note.id !== id));
      toast({ title: 'Note permanently deleted.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  }

  const handleRestoreNote = async (id: string) => {
    try {
      await handleUpdateNote(id, { isDeleted: false, deletedAt: undefined });
      toast({ title: 'Note restored successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  }

  const handleLinkNotes = async (noteId: string, updates: Partial<ExtendedNote>) => {
    try {
      setNotes(prev => prev.map(note => 
        note.id === noteId ? { ...note, ...updates } : note
      ));
      toast({ title: 'Notes linked successfully.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error', description: error.message });
    }
  }

  const handleAddChecklistItem = () => {
    append({ id: `item-${Date.now()}`, text: '', checked: false });
  }

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setIsFormExpanded(true);
    }
  };

  const handleAddChecklist = () => {
    form.setValue('items', [{ id: `item-${Date.now()}`, text: '', checked: false }]);
    form.setValue('content', '');
    setIsFormExpanded(true);
  };

  const deletedNotesCount = notes.filter(n => n.isDeleted).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Notes
            </h1>
            <p className="text-muted-foreground mt-2">Capture your thoughts and ideas</p>
          </div>

          {/* Search Bar and Trash Button */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search notes by title, content, or checklist items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-24 py-6 text-base bg-white dark:bg-gray-800 shadow-md"
              />
              <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
                {searchQuery && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setSearchQuery('')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowTrash(true)}
                  className="gap-1"
                >
                  <Trash className="h-4 w-4" />
                  {deletedNotesCount > 0 && (
                    <span className="text-xs bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5">
                      {deletedNotesCount}
                    </span>
                  )}
                </Button>
              </div>
            </div>
          </div>

          {/* Create Note Form */}
          <div ref={wrapperRef} className="max-w-2xl mx-auto">
            <Card className="shadow-xl hover:shadow-2xl transition-shadow duration-300 border-0">
              <form onSubmit={form.handleSubmit(handleAddNote)}>
                <CardContent className="p-0">
                  {imagePreview && isFormExpanded && (
                    <div className="relative">
                      <img src={imagePreview} alt="Note preview" className="w-full h-auto max-h-64 object-cover rounded-t-lg" />
                      <Button 
                        type="button" 
                        variant="destructive" 
                        size="icon" 
                        className="absolute top-2 right-2 h-8 w-8 rounded-full shadow-lg"
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                  
                  {isFormExpanded && (
                    <div className="px-4 pt-4">
                      <Input 
                        {...form.register('title')} 
                        placeholder="Title" 
                        className="border-0 shadow-none focus-visible:ring-0 text-lg font-semibold px-0"
                      />
                    </div>
                  )}
                  
                  <div className="p-4">
                    <Textarea
                      {...form.register('content')}
                      placeholder={isFormExpanded ? "Write your note..." : "Take a note..."}
                      className="border-0 shadow-none focus-visible:ring-0 resize-none text-base"
                      onFocus={() => setIsFormExpanded(true)}
                      rows={isFormExpanded ? 4 : 1}
                    />
                    
                    {isFormExpanded && isChecklist && (
                      <div className="space-y-2 mt-4">
                        {fields.map((field, index) => (
                          <div key={field.id} className="flex items-center gap-2 group">
                            <Checkbox 
                              checked={field.checked} 
                              onCheckedChange={(checked) => update(index, {...field, checked: !!checked})}
                            />
                            <Input 
                              {...form.register(`items.${index}.text`)}
                              placeholder="List item..."
                              className={cn(
                                "border-0 shadow-none focus-visible:ring-0 h-auto p-0 text-sm",
                                field.checked && "line-through text-muted-foreground"
                              )}
                            />
                            <Button 
                              type="button" 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => remove(index)} 
                              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="h-4 w-4 text-destructive"/>
                            </Button>
                          </div>
                        ))}
                        <Button 
                          type="button" 
                          variant="ghost" 
                          onClick={handleAddChecklistItem}
                          className="text-sm"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add item
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
                
                {isFormExpanded && (
                  <CardFooter className="flex justify-between items-center p-3 border-t">
                    <div className="flex gap-1">
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageFileChange} 
                      />
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleAddChecklist}
                        className="gap-2"
                      >
                        <ListChecks className="h-4 w-4" />
                        <span className="hidden sm:inline">Checklist</span>
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => fileInputRef.current?.click()}
                        className="gap-2"
                      >
                        <ImageIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Image</span>
                      </Button>
                    </div>
                    <Button type="submit" variant="default" size="sm">
                      Close
                    </Button>
                  </CardFooter>
                )}
              </form>
            </Card>
          </div>
        
          {/* Notes Grid */}
          <div className="space-y-8">
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {searchQuery && !showTrash && (
                  <div className="text-center">
                    <p className="text-muted-foreground">
                      Found {filteredNotes.length} note{filteredNotes.length !== 1 ? 's' : ''} for "{searchQuery}"
                    </p>
                  </div>
                )}
                
                {!showTrash && pinnedNotes.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Pin className="h-4 w-4 text-muted-foreground" />
                      <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                        Pinned Notes
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {pinnedNotes.map(note => (
                        <NoteCardComponent 
                          key={note.id} 
                          note={note} 
                          onUpdate={handleUpdateNote} 
                          onEdit={setEditingNote}
                          onPermanentDelete={handlePermanentDelete}
                          allNotes={notes}
                        />
                      ))}
                    </div>
                  </div>
                )}
                
                {!showTrash && otherNotes.length > 0 && (
                  <div>
                    {pinnedNotes.length > 0 && (
                      <div className="flex items-center gap-2 mb-4">
                        <div className="h-px flex-1 bg-border" />
                        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                          Other Notes
                        </h2>
                        <div className="h-px flex-1 bg-border" />
                      </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {otherNotes.map(note => (
                        <NoteCardComponent 
                          key={note.id} 
                          note={note} 
                          onUpdate={handleUpdateNote} 
                          onEdit={setEditingNote}
                          onPermanentDelete={handlePermanentDelete}
                          allNotes={notes}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filteredNotes.length === 0 && !loading && !showTrash && (
                  <div className="text-center py-16">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-muted mb-4">
                      {searchQuery ? <Search className="h-8 w-8 text-muted-foreground" /> : <Plus className="h-8 w-8 text-muted-foreground" />}
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      {searchQuery ? 'No matching notes found' : 'No Notes Yet'}
                    </h3>
                    <p className="text-muted-foreground">
                      {searchQuery ? 'Try a different search term' : 'Create your first note to get started.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Edit Dialog */}
      <EditNoteDialog 
        isOpen={!!editingNote}
        onOpenChange={() => setEditingNote(null)}
        note={editingNote}
        onSave={handleUpdateNote}
        allNotes={notes}
        onLink={handleLinkNotes}
      />

      {/* Trash Dialog */}
      <TrashDialog
        isOpen={showTrash}
        onOpenChange={setShowTrash}
        deletedNotes={notes.filter(n => n.isDeleted)}
        onRestore={handleRestoreNote}
        onPermanentDelete={handlePermanentDelete}
      />
    </div>
  );
}