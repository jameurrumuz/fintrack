
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    Loader2, User, LogOut, FileStack, WalletCards, Wrench, UserCog, 
    Contact, Home, Settings, Briefcase, Archive, ShoppingCart, 
    Trash2, Package, Store, Plus, Minus, Headphones, ArrowRight,
    Sparkles, ShieldCheck, BarChart3
} from 'lucide-react';
import { subscribeToPartyById, logActivity } from '@/services/portalService';
import type { Party, InventoryItem, Transaction } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import Link from 'next/link';
import { cn, formatAmount } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '@/components/ui/separator';
import Image from 'next/image';

interface CartItem extends InventoryItem {
  quantityInCart: number;
}

const colors = {
    primary: '#1A05A2',      // Deep Blue
    secondary: '#8F0177',     // Purple
    accent: '#DE1A58',        // Red
    highlight: '#F67D31',      // Orange
    gradient: 'from-[#1A05A2] via-[#8F0177] to-[#DE1A58]',
    gradientLight: 'from-[#1A05A2]/10 via-[#8F0177]/10 to-[#DE1A58]/10',
    gradient4: 'from-[#1A05A2] to-[#8F0177]',
    gradient5: 'from-[#8F0177] to-[#DE1A58]',
};

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift();
}

const DashboardCard = ({ title, icon: Icon, href, hasNotification, index }: { title: string; icon: React.ElementType; href: string; hasNotification?: boolean; index: number }) => (
    <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: index * 0.05 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="h-full"
    >
        <Link href={href} className="block h-full">
            <Card className="border-0 shadow-sm hover:shadow-xl transition-all duration-300 h-full text-center relative bg-white rounded-3xl overflow-hidden group">
                <div className={cn("absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-5 transition-opacity duration-300", colors.gradient)} />
                <CardContent className="p-6 flex flex-col items-center justify-center gap-3">
                    <div className={cn("p-4 rounded-2xl bg-gray-50 text-[#1A05A2] group-hover:bg-white group-hover:shadow-lg transition-all duration-300")}>
                        <Icon className="h-8 w-8" />
                    </div>
                    <p className="text-sm font-bold text-gray-700 group-hover:text-[#1A05A2] transition-colors">{title}</p>
                    {hasNotification && (
                        <span className="absolute top-4 right-4 flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                        </span>
                    )}
                </CardContent>
            </Card>
        </Link>
    </motion.div>
);

export default function UserDashboardPage() {
  const router = useRouter();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const partyId = getCookie('loggedInPartyId');
    if (!partyId) {
      router.replace('/portal/login');
      return;
    }
    
    const savedCart = localStorage.getItem('shoppingCart');
    if (savedCart) {
        try {
            const parsedCart: CartItem[] = JSON.parse(savedCart);
            if (Array.isArray(parsedCart) && parsedCart.length > 0) {
                setCart(parsedCart);
            }
        } catch (e) {
            console.error("Failed to parse cart from localStorage", e);
            localStorage.removeItem('shoppingCart');
        }
    }

    const unsub = subscribeToPartyById(partyId, (fetchedParty) => {
        if (fetchedParty) {
            setParty(fetchedParty);
        } else {
             router.replace('/portal/login');
        }
        setLoading(false);
    }, console.error);

    return () => unsub();
  }, [router]);
  
    const updateCart = (newCart: CartItem[]) => {
        setCart(newCart);
        if (newCart.length > 0) {
            localStorage.setItem('shoppingCart', JSON.stringify(newCart));
        } else {
            localStorage.removeItem('shoppingCart');
        }
    };

    const handleUpdateQuantity = (itemId: string, change: number) => {
        const newCart = cart.map(item => {
            if (item.id === itemId) {
                const newQuantity = item.quantityInCart + change;
                return newQuantity > 0 ? { ...item, quantityInCart: newQuantity } : null;
            }
            return item;
        }).filter(Boolean) as CartItem[];
        updateCart(newCart);
    };

    const handleRemoveFromCart = (itemId: string) => {
        const newCart = cart.filter(item => item.id !== itemId);
        updateCart(newCart);
    };

    const handleClearCart = () => {
        updateCart([]);
    };
    
    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => total + (item.price * item.quantityInCart), 0);
    }, [cart]);

  const handleCompletePurchase = () => {
    if (cart.length === 0) {
        toast({ variant: "destructive", title: "Your cart is empty." });
        return;
    };
    router.push(`/portal/user/ledger?view=payments`);
  };

  const handleLogout = async () => {
    const partyId = getCookie('loggedInPartyId');
    if (partyId) {
      await logActivity(partyId, 'logout');
    }
    document.cookie = 'userType=; path=/; max-age=0';
    document.cookie = `loggedInPartyId=; path=/; max-age=0`;
    window.location.href = '/portal/login';
  };

  const dashboardItems = useMemo(() => {
    if (!party || !party.id) return [];
    
    const baseItems = [
        { title: "Explore Store", icon: Store, href: "/store" },
        { title: "My Orders", icon: Package, href: "/portal/user/orders" },
        { title: "Detailed Ledger", icon: FileStack, href: "/portal/user/ledger" },
        { title: "Make Payment", icon: WalletCards, href: "/portal/user/ledger?view=payments" },
        { title: "Services", icon: Wrench, href: "/portal/user/ledger?view=service" },
        { title: "Edit Profile", icon: UserCog, href: "/portal/user/ledger?view=profile" },
        { title: "Support", icon: Contact, href: "/portal/user/contact", hasNotification: party?.hasUnreadUserMessages },
    ];
    
    if (party.partyType === 'Marketing') {
        baseItems.unshift({ title: "Inventory", icon: Archive, href: "/portal/user/marketing-inventory" });
    }
    
    return baseItems;
  }, [party]);

  if (loading || !party) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
            <Loader2 className="h-12 w-12 text-[#1A05A2]" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="bg-gray-100 dark:bg-black min-h-screen flex flex-col">
       <header className={cn("bg-gradient-to-r p-6 pt-12 pb-16 rounded-b-[3rem] shadow-2xl text-white relative overflow-hidden", colors.gradient)}>
          <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 scale-150">
              <Sparkles className="h-32 w-32" />
          </div>
          <div className="container mx-auto flex items-center justify-between relative z-10">
              <div className="flex items-center gap-4">
                <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                    <Avatar className="h-16 w-16 border-4 border-white/20 shadow-xl">
                        <AvatarImage src={party.imageUrl} alt={party.name}/>
                        <AvatarFallback className="bg-white/20 text-white font-bold text-xl">{party.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                </motion.div>
                <div className="space-y-0.5">
                  <h1 className="text-xl font-black flex items-center gap-2">
                    {party.name} 
                    <ShieldCheck className="h-4 w-4 text-white/80" />
                  </h1>
                  <p className="text-xs font-bold opacity-70 tracking-widest uppercase">{party.phone}</p>
                </div>
              </div>
              <motion.div whileTap={{ scale: 0.9 }}>
                <Button onClick={handleLogout} variant="ghost" size="icon" className="h-12 w-12 text-white hover:bg-white/20 rounded-2xl">
                    <LogOut className="h-6 w-6" />
                </Button>
              </motion.div>
          </div>
        </header>

         <main className="container mx-auto p-4 space-y-6 -mt-10 relative z-10 pb-40">
            <AnimatePresence>
                {cart.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                    >
                        <Card className="border-0 shadow-2xl rounded-[2rem] bg-white overflow-hidden ring-4 ring-[#DE1A58]/10">
                            <CardHeader className="bg-slate-50/50 p-6 border-b border-gray-100">
                                <CardTitle className="flex items-center gap-3 text-lg text-gray-800">
                                    <div className="p-2 rounded-xl bg-[#DE1A58]/10 text-[#DE1A58]">
                                        <ShoppingCart className="h-5 w-5" />
                                    </div>
                                    Checkout Pending
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-6">
                               <div className="space-y-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                    {cart.map(item => (
                                        <div key={item.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-2xl">
                                            <div className="flex items-center gap-3">
                                                <div className="relative h-12 w-12 rounded-xl overflow-hidden border border-gray-200 bg-white">
                                                    <Image src={item.imageUrl || `https://placehold.co/100x100?text=${item.name.charAt(0)}`} alt={item.name} fill className="object-cover" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-gray-800 line-clamp-1">{item.name}</p>
                                                    <p className="text-xs font-bold text-[#8F0177]">{formatAmount(item.price)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-100">
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleUpdateQuantity(item.id, -1)}><Minus className="h-3 w-3" /></Button>
                                                <span className="font-black text-sm w-6 text-center">{item.quantityInCart}</span>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg" onClick={() => handleUpdateQuantity(item.id, 1)}><Plus className="h-3 w-3" /></Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Separator className="my-6" />
                                <div className="flex justify-between items-center px-2">
                                    <span className="text-sm font-bold text-gray-500 uppercase tracking-widest">Total Amount</span>
                                    <span className={`text-2xl font-black bg-gradient-to-r ${colors.gradient4} bg-clip-text text-transparent`}>
                                        {formatAmount(cartTotal)}
                                    </span>
                                </div>
                            </CardContent>
                            <CardFooter className="p-6 pt-0 flex gap-3">
                                <Button variant="outline" className="flex-1 h-12 rounded-2xl border-gray-200 text-gray-500 font-bold hover:bg-gray-50" onClick={handleClearCart}>
                                    <Trash2 className="h-4 w-4 mr-2" /> Clear
                                </Button>
                                <Button className={cn("flex-[2] h-12 rounded-2xl font-bold bg-gradient-to-r shadow-xl", colors.gradient)} onClick={handleCompletePurchase}>
                                    Checkout Now <ArrowRight className="h-4 w-4 ml-2" />
                                </Button>
                            </CardFooter>
                        </Card>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                {dashboardItems.map((item, idx) => (
                    <DashboardCard 
                        key={item.href}
                        title={item.title}
                        icon={item.icon}
                        href={item.href}
                        hasNotification={item.hasNotification}
                        index={idx}
                    />
                ))}
            </div>
        </main>
        
        <footer className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl border-t shadow-[0_-4px_20px_rgba(0,0,0,0.05)] z-20 pb-safe">
            <div className="container mx-auto px-4 -mt-12 mb-4">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <Card className={cn("border-0 shadow-2xl rounded-[2rem] bg-gradient-to-r text-white overflow-hidden", colors.gradient)}>
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            <Headphones className="h-20 w-20" />
                        </div>
                        <CardContent className="p-6 flex items-center justify-between relative z-10">
                            <div>
                                <h3 className="font-black text-lg">Need Assistance?</h3>
                                <p className="text-xs font-medium opacity-80">Our support heroes are ready to help you.</p>
                            </div>
                            <Button variant="secondary" className="rounded-2xl h-12 font-bold px-6 shadow-lg hover:shadow-xl transition-all" asChild>
                                <Link href="/portal/user/contact">Contact Support</Link>
                            </Button>
                        </CardContent>
                    </Card>
                </motion.div>
            </div>
            
            <div className="grid grid-cols-3 h-16 items-center">
                <Link href="/portal/user/dashboard" className="flex flex-col items-center gap-1 text-[#1A05A2] group relative">
                    <Home className="h-5 w-5 transition-transform group-hover:-translate-y-1" />
                    <span className="text-[10px] font-black uppercase">Home</span>
                    <motion.div layoutId="nav-active" className="h-1 w-6 bg-[#1A05A2] rounded-full absolute bottom-1" />
                </Link>
                <Link href="/portal/user/ledger" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors group">
                    <BarChart3 className="h-5 w-5 transition-transform group-hover:-translate-y-1" />
                    <span className="text-[10px] font-black uppercase">Ledger</span>
                </Link>
                <Link href="/portal/user/ledger?view=profile" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors group">
                    <UserCog className="h-5 w-5 transition-transform group-hover:-translate-y-1" />
                    <span className="text-[10px] font-black uppercase">Account</span>
                </Link>
            </div>
        </footer>
    </div>
  );
}
