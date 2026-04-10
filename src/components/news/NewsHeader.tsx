
'use client';
import Link from 'next/link';
import { Search, Clapperboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '../ui/badge';
import { useState, useEffect } from 'react';
import { getAppSettings } from '@/services/settingsService';
import type { AppSettings } from '@/types';

export default function NewsHeader() {
  const [time, setTime] = useState(new Date());
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    getAppSettings().then(setAppSettings);
    return () => clearInterval(timer);
  }, []);

  const categories = appSettings?.newsCategories || [];

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Link href="/news" className="flex items-center gap-2">
            <Clapperboard className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold">FinNews</span>
          </Link>
          <div className="flex-1 flex justify-center items-center gap-6 text-sm font-medium text-muted-foreground">
             {categories.map(category => (
                <Link key={category.id} href="#" className="hover:text-primary transition-colors hidden md:block">
                    {category.name}
                </Link>
             ))}
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground hidden lg:block">
                {time.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <Badge variant="destructive" className="items-center gap-1 hidden sm:flex">
                <div className="h-2 w-2 rounded-full bg-white animate-pulse" />
                LIVE
            </Badge>
          </div>
        </div>
      </div>
    </header>
  );
}
