
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Network, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { CopyToClipboard } from '../copy-to-clipboard';


async function getMyIp(): Promise<string> {
  try {
    const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`Failed to fetch IP: ${response.statusText}`);
    }
    const data = await response.json();
    return data.ip;
  } catch (error) {
    console.error(error);
    if (error instanceof Error) {
        return `Error: ${error.message}`;
    }
    return 'Could not fetch IP address.';
  }
}

export default async function MyIpPage() {
  const ip = await getMyIp();
  const hasError = ip.startsWith('Error') || ip.startsWith('Could not');

  return (
    <div className="container mx-auto max-w-2xl py-8">
        <div className="mb-6">
            <Button variant="outline" asChild><Link href="/tools">← Back to Tools</Link></Button>
        </div>
         <Card>
            <CardHeader className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                <Network className="h-6 w-6 text-primary" />
              </div>
              <CardTitle className="mt-4">Your Server's Public IP Address</CardTitle>
              <CardDescription>
                Provide this IP address to your SMS service provider to whitelist it. This will resolve "Error 1016: IP address not allowed".
              </CardDescription>
            </CardHeader>
            <CardContent>
              {hasError ? (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Could not fetch IP Address</AlertTitle>
                  <AlertDescription>{ip}</AlertDescription>
                </Alert>
              ) : (
                <div className="flex items-center gap-4 rounded-lg bg-muted p-4">
                  <p className="text-2xl font-mono flex-grow break-all">{ip}</p>
                  <CopyToClipboard textToCopy={ip} />
                </div>
              )}
            </CardContent>
          </Card>
    </div>
  );
}
