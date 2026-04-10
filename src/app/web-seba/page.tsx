
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Construction } from 'lucide-react';

export default function WebSebaPage() {
  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
          <Construction className="h-10 w-10 text-primary" />
          Web Seba
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Web related services and tools.
        </p>
      </header>
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl text-center">
            <CardHeader>
                <CardTitle>Coming Soon!</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">This feature is under construction. New and exciting web services are on their way. Stay tuned!</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
