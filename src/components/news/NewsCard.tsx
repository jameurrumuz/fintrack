
'use client';
import type { NewsArticle } from '@/types';
import Image from 'next/image';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';

interface NewsCardProps {
  article: NewsArticle;
}

export default function NewsCard({ article }: NewsCardProps) {
  return (
    <Link href={`/news/${article.slug}`} className="group">
        <Card className="h-full flex flex-col overflow-hidden">
        <div className="relative aspect-video w-full overflow-hidden">
            <Image src={article.imageUrl} alt={article.title} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width: 768px) 100vw, 50vw"/>
        </div>
        <CardHeader>
            <CardTitle className="leading-snug group-hover:text-primary transition-colors">{article.title}</CardTitle>
        </CardHeader>
        <CardContent className="flex-grow">
            <p className="text-sm text-muted-foreground">{article.excerpt}</p>
        </CardContent>
        <CardFooter>
            <div className="flex items-center gap-3 w-full">
                <Avatar className="h-8 w-8">
                    <AvatarImage src={article.author.avatarUrl} alt={article.author.name} />
                    <AvatarFallback>{article.author.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <p className="text-sm font-semibold">{article.author.name}</p>
                    <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(article.createdAt), { addSuffix: true })}
                    </p>
                </div>
            </div>
        </CardFooter>
        </Card>
    </Link>
  );
}
