
'use client';
import type { NewsArticle } from '@/types';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface PopularPostsProps {
  articles: NewsArticle[];
}

export default function PopularPosts({ articles }: PopularPostsProps) {
  return (
    <div className="border rounded-lg p-6">
      <h3 className="text-xl font-bold mb-4">Popular Posts</h3>
      <div className="space-y-4">
        {articles.map((article, index) => (
          <Link href={`/news/${article.slug}`} key={article.id} className="group flex items-start gap-4">
            <span className="text-2xl font-bold text-muted-foreground/50 group-hover:text-primary transition-colors">
              {String(index + 1).padStart(2, '0')}
            </span>
            <div>
              <h4 className="font-semibold leading-tight group-hover:underline">{article.title}</h4>
              <p className="text-xs text-muted-foreground mt-1">{article.author.name}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
