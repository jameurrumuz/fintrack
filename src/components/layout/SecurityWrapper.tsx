
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getAppSettings, subscribeToAppSettings } from '@/services/settingsService';
import type { AppSettings, PageSecurity } from '@/types';
import PinLoginPage from '@/app/pin-login/page';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';


function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

function useIdleTimer(onIdle: () => void, timeoutInMinutes: number | null | undefined) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const resetTimer = useCallback(() => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        if (timeoutInMinutes && timeoutInMinutes > 0) {
            timeoutRef.current = setTimeout(onIdle, timeoutInMinutes * 60 * 1000);
        }
    }, [onIdle, timeoutInMinutes]);

    useEffect(() => {
        const events = ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'];
        
        const eventListener = () => resetTimer();

        events.forEach(event => window.addEventListener(event, eventListener));
        resetTimer(); 

        return () => {
            events.forEach(event => window.removeEventListener(event, eventListener));
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [resetTimer]);
}

/**
 * Helper to match current path against security patterns (handling dynamic routes)
 */
const getPageSecurity = (path: string, security: Record<string, PageSecurity> | undefined) => {
    if (!security) return null;
    if (security[path]) return security[path];
    
    // Check for dynamic matches like /parties/[partyId]
    const patterns = Object.keys(security);
    for (const pattern of patterns) {
        if (pattern.includes('[')) {
            const regexPattern = '^' + pattern.replace(/\[.*?\]/g, '[^/]+') + '$';
            const regex = new RegExp(regexPattern);
            if (regex.test(path)) {
                return security[pattern];
            }
        }
    }
    return null;
};

export function SecurityWrapper({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [loading, setLoading] = useState(true);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [unlockedPages, setUnlockedPages] = useState<Set<string>>(new Set());
    const [isAdminZoneUnlocked, setIsAdminZoneUnlocked] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        const sessionToken = localStorage.getItem('sessionToken');
        const sessionTimestamp = localStorage.getItem('sessionTimestamp');
        
        const unsub = subscribeToAppSettings((settings) => {
            if (settings) {
                setAppSettings({
                    ...settings,
                    adminLockedPages: settings.adminLockedPages || [],
                    userLockedPages: settings.userLockedPages || [],
                    pageSecurity: settings.pageSecurity || {},
                });
            } else {
                getAppSettings().then(setAppSettings);
            }
        }, (err) => {
            console.error("Error subscribing to settings:", err);
            getAppSettings().then(setAppSettings);
        });

        if (sessionToken && sessionTimestamp) {
            const lastLogin = parseInt(sessionTimestamp, 10);
            const sixHours = 6 * 60 * 60 * 1000;
            if (Date.now() - lastLogin < sixHours) {
                setIsAuthenticated(true);
            } else {
                localStorage.removeItem('sessionToken');
                localStorage.removeItem('sessionTimestamp');
            }
        }
        setLoading(false);

        return () => unsub();
    }, []);

    const handleLock = useCallback(() => {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('sessionTimestamp');
        setUnlockedPages(new Set());
        setIsAdminZoneUnlocked(false);
        setIsAuthenticated(false);
        router.refresh(); 
    }, [router]);

    useIdleTimer(handleLock, appSettings?.autoLockTimeout);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

    if (loading || !appSettings) {
        return <div className="flex h-screen items-center justify-center">Loading...</div>;
    }
    
    const publicPaths = ['/portal/login', '/portal/signup', '/maintenance-e-service', '/migration-guide.html', '/store', '/news'];
    const isPublicPage = publicPaths.some(path => pathname.startsWith(path));
    
    const userType = getCookie('userType');
    const isPortalUser = userType === 'fin-plan-user' || userType === 'fin-plan-staff' || userType === 'fin-plan-admin';

    if (isPortalUser || isPublicPage) {
        return <>{children}</>;
    }
    
    if (!isAuthenticated) {
        return <PinLoginPage onLoginSuccess={handleLoginSuccess} />;
    }

    const pageSecurityInfo = getPageSecurity(pathname, appSettings.pageSecurity);
    
    if (pageSecurityInfo?.disabled) {
        return (
            <div className="flex h-screen items-center justify-center text-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader>
                        <CardTitle>Page Disabled</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p>{pageSecurityInfo.disabledNotice || 'This page is currently unavailable. Please contact the administrator.'}</p>
                    </CardContent>
                </Card>
            </div>
        );
    }
    
    const isAnAdminPage = pageSecurityInfo?.area === 'admin';
    const customPin = pageSecurityInfo?.pin;

    const isAdminPageLocked = appSettings.adminLockedPages?.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\[.*?\]/g, '[^/]+') + '$');
        return regex.test(pathname);
    });
    const isUserPageLocked = appSettings.userLockedPages?.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\[.*?\]/g, '[^/]+') + '$');
        return regex.test(pathname);
    });

    const isPageCurrentlyLocked = isAdminPageLocked || isUserPageLocked;

    if (isPageCurrentlyLocked) {
        if (isAnAdminPage) {
            if (!isAdminZoneUnlocked) {
                return <PinLoginPage onLoginSuccess={() => setIsAdminZoneUnlocked(true)} targetPin={customPin} />;
            }
        } else {
            if (!unlockedPages.has(pathname)) {
                return <PinLoginPage onLoginSuccess={() => {
                    setUnlockedPages(prev => new Set(prev).add(pathname));
                }} targetPin={customPin} />;
            }
        }
    }
    
    return <>{children}</>;
}
