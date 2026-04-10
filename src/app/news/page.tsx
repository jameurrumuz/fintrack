
'use client';
import { useState, useEffect } from 'react';
import { getArticles } from '@/lib/news-data';
import type { NewsArticle } from '@/types';
import NewsHeader from '@/components/news/NewsHeader';
import HeroSection from '@/components/news/HeroSection';
import NewsCard from '@/components/news/NewsCard';
import PopularPosts from '@/components/news/PopularPosts';
import NewsletterSignup from '@/components/news/NewsletterSignup';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NewsPage() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);

  useEffect(() => {
    setArticles(getArticles());
  }, []);

  const featuredArticles = articles.filter(a => a.featured && a.status === 'published');
  const recentArticles = articles.filter(a => !a.featured && a.status === 'published');

  return (
    <div className="bg-background text-foreground">
      <NewsHeader />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <HeroSection articles={featuredArticles.slice(0, 3)} />

        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <h2 className="text-3xl font-bold border-b pb-2 mb-6">Recent News</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {recentArticles.map(article => (
                <NewsCard key={article.id} article={article} />
              ))}
            </div>
            <div className="text-center mt-12">
                <Button variant="outline">Load More Articles</Button>
            </div>
          </div>
          <aside className="lg:col-span-1 space-y-8">
             <PopularPosts articles={articles.slice(0, 5)} />
             <NewsletterSignup />
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
            <p>&copy; {new Date().getFullYear()} Fin Plan News. All Rights Reserved.</p>
        </div>
      </footer>
    </div>
  );
}
