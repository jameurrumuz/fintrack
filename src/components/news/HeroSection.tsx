
'use client';
import type { NewsArticle } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';

interface HeroSectionProps {
  articles: NewsArticle[];
}

export default function HeroSection({ articles }: HeroSectionProps) {
  if (articles.length === 0) return null;

  const mainArticle = articles[0];
  const sideArticles = articles.slice(1, 3);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Main Featured Article */}
      <Link href={`/news/${mainArticle.slug}`} className="group">
        <div className="relative aspect-video w-full overflow-hidden rounded-lg">
          <Image src={mainArticle.imageUrl} alt={mainArticle.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 1024px) 100vw, 50vw"/>
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent"/>
          <div className="absolute bottom-0 p-6 text-white">
            <Badge className="mb-2">{mainArticle.category}</Badge>
            <h1 className="text-2xl lg:text-4xl font-bold leading-tight group-hover:underline">{mainArticle.title}</h1>
          </div>
        </div>
      </Link>

      {/* Side Articles */}
      <div className="space-y-6">
        {sideArticles.map(article => (
          <Link href={`/news/${article.slug}`} key={article.id} className="group flex gap-4">
             <div className="relative w-1/3 aspect-square overflow-hidden rounded-md flex-shrink-0">
               <Image src={article.imageUrl} alt={article.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="33vw" />
             </div>
             <div className="flex flex-col justify-center">
                <Badge variant="secondary" className="mb-1 w-fit">{article.category}</Badge>
                <h2 className="font-semibold leading-snug group-hover:underline">{article.title}</h2>
                <p className="text-xs text-muted-foreground mt-2">{formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}</p>
             </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
