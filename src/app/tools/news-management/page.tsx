
'use client';
import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { PlusCircle, BarChart2, List, Settings, Trash2 } from 'lucide-react';
import ArticleTable from '@/components/news/ArticleTable';
import ArticleEditor from '@/components/news/ArticleEditor';
import { getArticles, saveArticle, deleteArticle } from '@/lib/news-data';
import type { NewsArticle, AppSettings, NewsCategory } from '@/types';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

const CategoryManagerDialog = ({ open, onOpenChange, categories, onSave }: { open: boolean, onOpenChange: (open: boolean) => void, categories: NewsCategory[], onSave: (cats: NewsCategory[]) => void }) => {
    const [localCategories, setLocalCategories] = useState(categories);
    const [newCategoryName, setNewCategoryName] = useState('');

    useEffect(() => {
        setLocalCategories(categories);
    }, [categories]);

    const handleAddCategory = () => {
        if (newCategoryName.trim() && !localCategories.some(c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase())) {
            const newCat = { id: `cat-${Date.now()}`, name: newCategoryName.trim() };
            setLocalCategories([...localCategories, newCat]);
            setNewCategoryName('');
        }
    };

    const handleRemoveCategory = (id: string) => {
        setLocalCategories(localCategories.filter(cat => cat.id !== id));
    };

    const handleConfirmSave = () => {
        onSave(localCategories);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manage Categories</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto p-1">
                    {localCategories.map(cat => (
                        <div key={cat.id} className="flex items-center gap-2">
                            <Input value={cat.name} readOnly className="bg-muted" />
                            <Button variant="ghost" size="icon" onClick={() => handleRemoveCategory(cat.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </div>
                    ))}
                    <div className="flex items-center gap-2 pt-4 border-t">
                        <Input placeholder="New category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} />
                        <Button onClick={handleAddCategory}>Add</Button>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleConfirmSave}>Save Changes</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default function NewsManagementPage() {
    const [articles, setArticles] = useState<NewsArticle[]>([]);
    const [isEditorOpen, setIsEditorOpen] = useState(false);
    const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
    const { toast } = useToast();

    useEffect(() => {
        setArticles(getArticles());
        getAppSettings().then(setAppSettings);
    }, []);

    const categories = useMemo(() => {
        return appSettings?.newsCategories || [];
    }, [appSettings]);

    const stats = useMemo(() => {
        const totalArticles = articles.length;
        const totalViews = articles.reduce((sum, article) => sum + article.views, 0);
        const publishedCount = articles.filter(a => a.status === 'published').length;
        return { totalArticles, totalViews, publishedCount };
    }, [articles]);

    const handleOpenEditor = (article: NewsArticle | null) => {
        setEditingArticle(article);
        setIsEditorOpen(true);
    };

    const handleSaveArticle = (articleData: NewsArticle) => {
        saveArticle(articleData);
        setArticles(getArticles()); // Refresh list from source
        setIsEditorOpen(false);
    };

    const handleDeleteArticle = (articleId: string) => {
        deleteArticle(articleId);
        setArticles(getArticles()); // Refresh list from source
    };

    const handleSaveCategories = async (newCategories: NewsCategory[]) => {
        if (!appSettings) return;
        try {
            await saveAppSettings({ ...appSettings, newsCategories: newCategories });
            setAppSettings(prev => ({ ...prev!, newsCategories: newCategories }));
            toast({ title: "Categories updated successfully." });
        } catch (error) {
            toast({ variant: 'destructive', title: "Failed to save categories." });
        }
    };

    return (
        <div className="space-y-6">
            <ArticleEditor 
                isOpen={isEditorOpen}
                onOpenChange={setIsEditorOpen}
                onSave={handleSaveArticle}
                article={editingArticle}
                categories={categories}
            />

            <CategoryManagerDialog
                open={isCategoryManagerOpen}
                onOpenChange={setIsCategoryManagerOpen}
                categories={categories}
                onSave={handleSaveCategories}
            />

            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold">News Management</h1>
                    <p className="text-muted-foreground">Create, edit, and manage all your news articles.</p>
                </div>
                 <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsCategoryManagerOpen(true)}>
                        <Settings className="mr-2 h-4 w-4" />
                        Manage Categories
                    </Button>
                    <Button onClick={() => handleOpenEditor(null)}>
                        <PlusCircle className="mr-2 h-4 w-4" />
                        Create Article
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="dashboard">
                <TabsList>
                    <TabsTrigger value="dashboard"><BarChart2 className="mr-2 h-4 w-4"/>Dashboard</TabsTrigger>
                    <TabsTrigger value="articles"><List className="mr-2 h-4 w-4"/>Manage Articles</TabsTrigger>
                </TabsList>
                <TabsContent value="dashboard">
                    <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Articles</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalArticles}</div>
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.totalViews.toLocaleString()}</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Published Articles</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{stats.publishedCount}</div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>
                <TabsContent value="articles">
                    <Card>
                        <CardHeader>
                            <CardTitle>All Articles</CardTitle>
                            <CardDescription>A list of all articles in the system.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <ArticleTable 
                                articles={articles} 
                                onEdit={handleOpenEditor} 
                                onDelete={handleDeleteArticle}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
