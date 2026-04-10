
'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function NewsletterSignup() {
  return (
    <div className="border rounded-lg p-6 bg-muted/40">
      <h3 className="text-xl font-bold mb-2">Subscribe to our Newsletter</h3>
      <p className="text-sm text-muted-foreground mb-4">Get the latest news and updates delivered to your inbox.</p>
      <form className="flex gap-2">
        <Input type="email" placeholder="Enter your email" className="bg-background"/>
        <Button>Subscribe</Button>
      </form>
    </div>
  );
}
