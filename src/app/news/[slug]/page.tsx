
'use client';
import { useState, useEffect } from 'react';
import { getArticleBySlug, getArticles } from '@/lib/news-data';
import NewsHeader from '@/components/news/NewsHeader';
import { notFound, useParams } from 'next/navigation';
import Image from 'next/image';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import Link from 'next/link';
import PopularPosts from '@/components/news/PopularPosts';
import { Separator } from '@/components/ui/separator';
import type { NewsArticle } from '@/types';
import { Loader2 } from 'lucide-react';

export default function ArticlePage() {
  const params = useParams();
  const slug = params.slug as string;
  const [article, setArticle] = useState<NewsArticle | null | undefined>(undefined);
  const [relatedArticles, setRelatedArticles] = useState<NewsArticle[]>([]);

  useEffect(() => {
    if (slug) {
      const { article: foundArticle, related: foundRelated } = getArticleBySlug(slug);
      setArticle(foundArticle);
      setRelatedArticles(foundRelated);
    }
  }, [slug]);

  if (article === undefined) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-12 w-12 animate-spin" /></div>;
  }

  if (!article) {
    notFound();
  }

  return (
    <div className="bg-background text-foreground">
      <NewsHeader />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            <article className="lg:col-span-8">
                <header className="mb-8">
                    <Badge className="mb-4">{article.category}</Badge>
                    <h1 className="text-4xl lg:text-5xl font-bold leading-tight mb-4">{article.title}</h1>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={article.author.avatarUrl} alt={article.author.name} />
                                <AvatarFallback>{article.author.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span>By {article.author.name}</span>
                        </div>
                        <span>{format(new Date(article.createdAt), 'MMMM d, yyyy')}</span>
                    </div>
                </header>
                <div className="relative aspect-video w-full overflow-hidden rounded-lg mb-8">
                    <Image src={article.imageUrl} alt={article.title} fill className="object-cover" sizes="(max-width: 1024px) 100vw, 66vw"/>
                </div>
                {/* The content is HTML, so we need to render it dangerously */}
                <div
                    className="prose-styles max-w-none space-y-6 text-lg leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: article.content }}
                />
            </article>
            <aside className="lg:col-span-4 space-y-8">
                 <PopularPosts articles={relatedArticles} />
            </aside>
        </div>
      </main>

       <footer className="bg-muted text-muted-foreground mt-12 py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <div className="flex justify-center gap-6 mb-4">
                <Link href="#" className="hover:text-primary">About Us</Link>
                <Link href="#" className="hover:text-primary">Contact</Link>
                <Link href="#" className="hover:text-primary">Privacy Policy</Link>
            </div>
            <p>&copy; {new Date().getFullYear()} Fin News. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
