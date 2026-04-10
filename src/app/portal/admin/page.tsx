
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// This is a simple redirect component. 
// If a user lands on /portal/admin, it will redirect them to the dashboard.
export default function AdminPortalPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/portal/admin/dashboard');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-screen">
            Redirecting to admin dashboard...
        </div>
    );
}
