
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shapes } from 'lucide-react';

export default function WidgetsPage() {
  return (
    <div className="space-y-8">
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight flex items-center justify-center gap-3">
          <Shapes className="h-10 w-10 text-primary" />
          Widgets
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">
          A collection of useful widgets to enhance your experience.
        </p>
      </header>
      <div className="flex justify-center">
        <Card className="w-full max-w-2xl text-center">
            <CardHeader>
                <CardTitle>Coming Soon!</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">New and exciting widgets are on their way. Stay tuned!</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
