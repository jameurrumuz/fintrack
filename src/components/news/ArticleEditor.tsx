
'use client';
import { useState, useEffect, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import type { NewsArticle, NewsCategory } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { CameraCaptureDialog } from '@/components/ui/camera-capture-dialog';
import { uploadImage } from '@/services/storageService';
import { Camera, Upload, ImageIcon, Loader2, X } from 'lucide-react';
import Image from 'next/image';


const articleSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters long.'),
  slug: z.string().min(3, 'Slug is required.'),
  excerpt: z.string().min(10, 'Excerpt is required.'),
  content: z.string().min(50, 'Content must be at least 50 characters long.'),
  imageUrl: z.string().url('A featured image is required.').min(1, 'A featured image is required.'),
  category: z.string().min(1, 'Category is required.'),
  status: z.enum(['published', 'draft']),
  featured: z.boolean(),
});

type ArticleFormValues = z.infer<typeof articleSchema>;

interface ArticleEditorProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (article: NewsArticle) => void;
  article: NewsArticle | null;
  categories: NewsCategory[];
}

export default function ArticleEditor({ isOpen, onOpenChange, onSave, article, categories }: ArticleEditorProps) {
  const { register, handleSubmit, control, reset, setValue, formState: { errors } } = useForm<ArticleFormValues>({
    resolver: zodResolver(articleSchema),
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (article) {
      reset(article);
      setImagePreview(article.imageUrl || null);
    } else {
      reset({
        title: '',
        slug: '',
        excerpt: '',
        content: '',
        imageUrl: '',
        category: categories[0]?.name || '',
        status: 'draft',
        featured: false,
      });
      setImagePreview(null);
    }
    setImageFile(null);
  }, [article, isOpen, reset, categories]);

  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value;
    setValue('title', title);
    setValue('slug', title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  const processSave = async (data: ArticleFormValues) => {
    setIsUploading(true);
    let finalImageUrl = article?.imageUrl || data.imageUrl;
    
    if (imageFile) {
      try {
        toast({ title: "Uploading image..." });
        finalImageUrl = await uploadImage(imageFile, 'news-articles');
        setValue('imageUrl', finalImageUrl, { shouldValidate: true });
      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Upload Failed', description: error.message || 'Could not upload the image.' });
        setIsUploading(false);
        return;
      }
    }

    if (!finalImageUrl) {
        toast({ variant: 'destructive', title: 'Image Required', description: 'Please upload a featured image for the article.' });
        setIsUploading(false);
        return;
    }

    const completeArticle: NewsArticle = {
      ...(article || { 
        id: `news-${Date.now()}`,
        createdAt: new Date().toISOString(),
        author: { name: 'Admin', avatarUrl: 'https://i.pravatar.cc/150?u=admin' },
        views: 0
       }),
      ...data,
      imageUrl: finalImageUrl,
    };
    onSave(completeArticle);
    setIsUploading(false);
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
      setValue('imageUrl', 'file-selected', { shouldValidate: true }); // Use a placeholder to pass validation
    }
  };

  const handleCaptureImage = (file: File) => {
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setValue('imageUrl', 'file-selected', { shouldValidate: true });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <CameraCaptureDialog open={isCameraOpen} onOpenChange={setIsCameraOpen} onCapture={handleCaptureImage} />
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{article ? 'Edit Article' : 'Create New Article'}</DialogTitle>
          <DialogDescription>Fill in the details for your news article below.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(processSave)} className="space-y-4 max-h-[70vh] overflow-y-auto p-4">
          
          <div className="space-y-2">
            <Label>Featured Image</Label>
            {imagePreview && (
                <div className="relative aspect-video rounded-md overflow-hidden">
                    <Image src={imagePreview} alt="Image Preview" fill className="object-cover" />
                     <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => {setImageFile(null); setImagePreview(null); setValue('imageUrl', '');}}>
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            )}
            <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-grow" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-2 h-4 w-4" /> Upload Image
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageFileChange} />
                <Button type="button" variant="outline" onClick={() => setIsCameraOpen(true)}>
                    <Camera className="mr-2 h-4 w-4" /> Use Camera
                </Button>
            </div>
             {errors.imageUrl && <p className="text-sm text-destructive">{errors.imageUrl.message}</p>}
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input id="title" {...register('title')} onChange={handleTitleChange} />
            {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" {...register('slug')} />
            {errors.slug && <p className="text-sm text-destructive">{errors.slug.message}</p>}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="space-y-2">
                <Label>Category</Label>
                <Controller name="category" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            {categories.map(cat => (
                                <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}/>
                {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
             </div>
             <div className="space-y-2">
                <Label>Status</Label>
                <Controller name="status" control={control} render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue/></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="published">Published</SelectItem>
                            <SelectItem value="draft">Draft</SelectItem>
                        </SelectContent>
                    </Select>
                )}/>
             </div>
          </div>
           <div className="space-y-2">
            <Label htmlFor="excerpt">Excerpt</Label>
            <Textarea id="excerpt" {...register('excerpt')} />
            {errors.excerpt && <p className="text-sm text-destructive">{errors.excerpt.message}</p>}
          </div>
           <div className="space-y-2">
            <Label htmlFor="content">Content (HTML supported)</Label>
            <Textarea id="content" {...register('content')} rows={10}/>
            {errors.content && <p className="text-sm text-destructive">{errors.content.message}</p>}
          </div>
          <div className="flex items-center space-x-2">
            <Controller name="featured" control={control} render={({ field }) => (
                <Switch id="featured" checked={field.value} onCheckedChange={field.onChange} />
            )} />
            <Label htmlFor="featured">Featured Article</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={isUploading}>
                {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Save Article
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
