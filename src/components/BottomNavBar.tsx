
'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from './ui/button';
import { Settings, FileText, ShoppingCart, MoreVertical, Plus, Wrench, Contact2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { useState } from 'react';

const NavItem = ({ href, icon, label, isActive }: { href: string; icon: React.ReactNode; label: string, isActive: boolean }) => (
  <Link href={href} className={cn("flex flex-col items-center gap-1 text-xs", isActive ? "text-primary" : "text-muted-foreground")}>
    {icon}
    <span>{label}</span>
  </Link>
);

const MoreMenu = () => {
    const navItems = [
        { href: "/parties", label: "Parties" },
        { href: "/accounts", label: "Accounts" },
        { href: "/inventory", label: "Inventory" },
        { href: "/tasks", label: "Tasks" },
        { href: "/activity-log", label: "Activity Log" },
    ];
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                 <button className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
                    <MoreVertical className="h-6 w-6"/>
                    <span>More</span>
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-40 mb-2">
                {navItems.map(item => (
                    <DropdownMenuItem key={item.href} asChild>
                        <Link href={item.href}>{item.label}</Link>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
};

export default function BottomNavBar() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-background border-t shadow-[0_-1px_3px_rgba(0,0,0,0.05)] z-50">
      <div className="grid grid-cols-5 h-full items-center justify-around">
        <NavItem href="/reports" icon={<FileText className="h-6 w-6"/>} label="Reports" isActive={pathname.startsWith('/reports')} />
        <NavItem href="/contacts" icon={<Contact2 className="h-6 w-6"/>} label="Contacts" isActive={pathname.startsWith('/contacts')} />
        
        <div className="flex justify-center items-center">
            <Button
              className="h-16 w-16 rounded-full shadow-lg"
              onClick={() => router.push('/pos')}
            >
              <ShoppingCart className="h-8 w-8" />
              <span className="sr-only">Point of Sale</span>
            </Button>
        </div>

        <NavItem href="/transactions" icon={<Plus className="h-6 w-6"/>} label="Transaction" isActive={pathname === '/transactions'} />
        <MoreMenu />
      </div>
    </div>
  );
}
