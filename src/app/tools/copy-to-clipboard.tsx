

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function CopyToClipboard({ textToCopy, className }: { textToCopy: string, className?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      toast({ title: 'Copied!', description: 'The text has been copied to your clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    }).catch(err => {
      toast({ variant: 'destructive', title: 'Failed to copy', description: 'Could not copy text to clipboard.' });
    });
  };

  return (
    <Button onClick={handleCopy} variant="ghost" size="icon" className={className}>
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
       <span className="sr-only">Copy</span>
    </Button>
  );
}
