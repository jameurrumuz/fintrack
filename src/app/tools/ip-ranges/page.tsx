
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ListTree, AlertCircle, Copy } from 'lucide-react';
import Link from 'next/link';
import { CopyToClipboard } from '../copy-to-clipboard';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { ScrollArea } from '@/components/ui/scroll-area';

interface IpRanges {
    syncToken: string;
    creationTime: string;
    prefixes: {
        ipv4Prefix?: string;
        ipv6Prefix?: string;
        service: string;
        scope: string;
    }[];
}

async function getGoogleIpRanges(): Promise<[IpRanges | null, string | null]> {
  try {
    // Fetch IP ranges for Google APIs and services
    const servicesResponse = await fetch('https://www.gstatic.com/ipranges/goog.json', { cache: 'no-store' });
    if (!servicesResponse.ok) {
      throw new Error(`Failed to fetch Google services IP ranges: ${servicesResponse.statusText}`);
    }
    const servicesData: IpRanges = await servicesResponse.json();

    return [servicesData, null];
  } catch (error) {
    console.error(error);
    const errorMessage = error instanceof Error ? error.message : 'Could not fetch IP ranges.';
    return [null, errorMessage];
  }
}

const IpRangeList = ({ title, prefixes, type }: { title: string; prefixes: string[]; type: 'ipv4' | 'ipv6' }) => {
    const fullText = prefixes.join('\n');
    return (
        <AccordionItem value={title}>
            <AccordionTrigger>{title} ({prefixes.length} ranges)</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-2">
                    <div className="flex justify-end">
                        <CopyToClipboard textToCopy={fullText} />
                    </div>
                    <ScrollArea className="h-72 w-full rounded-md border p-4 font-mono text-sm">
                        {prefixes.map((prefix, index) => (
                            <div key={index}>{prefix}</div>
                        ))}
                    </ScrollArea>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}


export default async function IpRangesPage() {
  const [data, error] = await getGoogleIpRanges();

  const googleServicesIPv4 = data?.prefixes.filter(p => p.ipv4Prefix && p.service === 'Google').map(p => p.ipv4Prefix!) || [];
  const googleServicesIPv6 = data?.prefixes.filter(p => p.ipv6Prefix && p.service === 'Google').map(p => p.ipv6Prefix!) || [];
  const otherServicesIPv4 = data?.prefixes.filter(p => p.ipv4Prefix && p.service !== 'Google').map(p => p.ipv4Prefix!) || [];
  const otherServicesIPv6 = data?.prefixes.filter(p => p.ipv6Prefix && p.service !== 'Google').map(p => p.ipv6Prefix!) || [];

  return (
    <div className="container mx-auto max-w-4xl py-8">
       <div className="mb-6">
        <Button variant="outline" asChild><Link href="/tools">← Back to Tools</Link></Button>
      </div>
      <Card>
        <CardHeader className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <ListTree className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="mt-4">Google Cloud and Firebase IP Ranges</CardTitle>
          <CardDescription>
            Provide these IP ranges to your SMS service provider to whitelist them. This will resolve "Error 1016: IP address not allowed". It's recommended to add all ranges.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Could not fetch IP Ranges</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : (
             <Accordion type="single" collapsible className="w-full">
                <IpRangeList title="Google Services IPv4 Ranges" prefixes={googleServicesIPv4} type="ipv4" />
                <IpRangeList title="Other Google Services IPv4 Ranges" prefixes={otherServicesIPv4} type="ipv4" />
                <IpRangeList title="Google Services IPv6 Ranges" prefixes={googleServicesIPv6} type="ipv6" />
                <IpRangeList title="Other Google Services IPv6 Ranges" prefixes={otherServicesIPv6} type="ipv6" />
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

