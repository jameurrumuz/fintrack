'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface QrCodeCardProps {
  title: string;
  description: string;
  url: string;
}

export default function QrCodeCard({ title, description, url }: QrCodeCardProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  useEffect(() => {
    if (url) {
      QRCode.toDataURL(url, { width: 200, margin: 2 }, (err, dataUrl) => {
        if (err) {
          console.error("Failed to generate QR code", err);
          return;
        }
        setQrCodeUrl(dataUrl);
      });
    }
  }, [url]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        {qrCodeUrl ? (
          <img src={qrCodeUrl} alt={title} />
        ) : (
          <Skeleton className="w-[200px] h-[200px]" />
        )}
      </CardContent>
    </Card>
  );
}
