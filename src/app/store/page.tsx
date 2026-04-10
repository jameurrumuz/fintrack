'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatAmount } from '@/lib/utils';
import { subscribeToInventoryItems, subscribeToInventoryCategories } from '@/services/inventoryService';
import { generateInvoiceNumber } from '@/services/transactionService';
import type { InventoryItem, InventoryCategory, Transaction } from '@/types';
import {
    Loader2,
    Search,
    ShoppingCart,
    User,
    LogIn,
    Package,
    Plus,
    Minus,
    Trash2,
    Heart,
    Share2,
    Sparkles,
    Filter,
    X,
    ChevronDown,
    MapPin,
    CreditCard,
    Truck,
    RefreshCw,
    Shield,
    Gift,
    Clock,
    Star,
    Tag,
    CheckCircle,
    AlertCircle,
    Menu,
    Home,
    ChevronLeft,
    ChevronRight,
    SlidersHorizontal,
    Globe,
    Award,
    Zap,
    TrendingUp,
    Phone,
    Mail,
    Facebook,
    Instagram,
    Twitter,
    Youtube,
    ShoppingBag,
    Store,
    Headphones,
    Wallet,
    BarChart3
} from 'lucide-react';

interface CartItem extends InventoryItem {
    quantityInCart: number;
}

// Color Scheme
const colors = {
    primary: '#1A05A2',      // Deep Blue
    secondary: '#8F0177',     // Purple
    accent: '#DE1A58',        // Red
    highlight: '#F67D31',      // Orange
    gradient1: 'from-[#1A05A2] via-[#8F0177] to-[#DE1A58]',
    gradient2: 'from-[#8F0177] via-[#DE1A58] to-[#F67D31]',
    gradient3: 'from-[#DE1A58] to-[#F67D31]',
    gradient4: 'from-[#1A05A2] to-[#8F0177]',
    gradient5: 'from-[#8F0177] to-[#DE1A58]',
};

// Animation Variants
const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
        opacity: 1,
        transition: {
            staggerChildren: 0.05
        }
    }
};

const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
        y: 0,
        opacity: 1,
        transition: {
            type: "spring",
            stiffness: 100,
            damping: 12
        }
    }
};

// Mobile Product Card
const MobileProductCard = ({ item, onAddToCart, onQuickView }: { 
    item: InventoryItem; 
    onAddToCart: (item: InventoryItem) => void;
    onQuickView: (item: InventoryItem) => void;
}) => {
    const [isLiked, setIsLiked] = useState(false);
    const [isPressed, setIsPressed] = useState(false);
    const isOutOfStock = item.quantity <= 0;

    return (
        <motion.div
            variants={itemVariants}
            whileTap={{ scale: 0.98 }}
            className="h-full"
            onTouchStart={() => setIsPressed(true)}
            onTouchEnd={() => setIsPressed(false)}
        >
            <Card className={cn(
                "overflow-hidden border-0 shadow-sm transition-all duration-300 h-full flex flex-col",
                isPressed ? "shadow-md scale-[0.99]" : "shadow-sm",
                "bg-white hover:shadow-xl relative"
            )}>
                {/* Image Container */}
                <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-[#1A05A2]/5 to-[#8F0177]/5">
                    <div className="relative w-full h-full">
                        <Image
                            src={item.imageUrl || `https://placehold.co/400x400/e2e8f0/1e293b?text=${encodeURIComponent(item.name.substring(0, 10))}`}
                            alt={item.name}
                            fill
                            sizes="(max-width: 640px) 45vw, 20vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    </div>

                    {/* Discount Badge */}
                    {(item as any).discount && (
                        <motion.div
                            initial={{ x: -50, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className="absolute top-2 left-2 z-10"
                        >
                            <Badge className={`bg-gradient-to-r ${colors.gradient3} text-white border-0 text-[10px] px-2 py-0.5 shadow-lg`}>
                                -{(item as any).discount}%
                            </Badge>
                        </motion.div>
                    )}

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center"
                        >
                            <Badge className="bg-[#DE1A58] text-white text-[10px] px-2 py-1 rotate-[-15deg] shadow-xl">
                                OUT OF STOCK
                            </Badge>
                        </motion.div>
                    )}

                    {/* Like Button */}
                    <motion.div
                        whileTap={{ scale: 1.2 }}
                        className="absolute bottom-2 right-2 z-10"
                    >
                        <Button
                            size="icon"
                            variant="ghost"
                            className={cn(
                                "h-8 w-8 rounded-full backdrop-blur-sm transition-all",
                                isLiked ? "bg-[#DE1A58] text-white" : "bg-white/80 text-gray-600 hover:bg-white"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsLiked(!isLiked);
                            }}
                        >
                            <Heart className={cn("h-4 w-4", isLiked && "fill-white")} />
                        </Button>
                    </motion.div>

                    {/* Quick View Button */}
                    <motion.div
                        whileTap={{ scale: 1.1 }}
                        className="absolute top-2 right-2 z-10 sm:hidden"
                    >
                        <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white"
                            onClick={(e) => {
                                e.stopPropagation();
                                onQuickView(item);
                            }}
                        >
                            <Share2 className="h-4 w-4 text-[#1A05A2]" />
                        </Button>
                    </motion.div>
                </div>

                <CardHeader className="p-2 pb-0">
                    <CardTitle className="text-xs font-medium line-clamp-2 h-8 text-gray-800">
                        {item.name}
                    </CardTitle>
                </CardHeader>

                <CardContent className="p-2 pt-1">
                    <div className="flex items-baseline gap-1 flex-wrap">
                        <span className={`text-sm font-bold bg-gradient-to-r ${colors.gradient4} bg-clip-text text-transparent`}>
                            ৳{item.price.toLocaleString()}
                        </span>
                        {(item as any).originalPrice && (
                            <span className="text-[10px] text-gray-400 line-through">
                                ৳{(item as any).originalPrice}
                            </span>
                        )}
                    </div>

                    {/* Stock Status */}
                    <p className="text-[10px] mt-1">
                        {item.quantity > 0 ? (
                            <span className="text-[#1A05A2]">{item.quantity} in stock</span>
                        ) : (
                            <span className="text-[#DE1A58]">Out of stock</span>
                        )}
                    </p>
                </CardContent>

                <CardFooter className="p-2 pt-0 mt-auto">
                    <motion.div
                        whileTap={{ scale: 0.95 }}
                        className="w-full"
                    >
                        <Button
                            className={cn(
                                "w-full h-8 text-xs font-medium transition-all duration-300",
                                isOutOfStock 
                                    ? "bg-gray-200 text-gray-500 cursor-not-allowed" 
                                    : `bg-gradient-to-r ${colors.gradient4} hover:${colors.gradient5} text-white shadow-md hover:shadow-lg`
                            )}
                            disabled={isOutOfStock}
                            onClick={() => onAddToCart(item)}
                        >
                            {isOutOfStock ? (
                                <>
                                    <Clock className="mr-1 h-3 w-3" />
                                    Out
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="mr-1 h-3 w-3" />
                                    Add
                                </>
                            )}
                        </Button>
                    </motion.div>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

// Desktop Product Card
const DesktopProductCard = ({ item, onAddToCart, onQuickView }: { 
    item: InventoryItem; 
    onAddToCart: (item: InventoryItem) => void;
    onQuickView: (item: InventoryItem) => void;
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isLiked, setIsLiked] = useState(false);
    const isOutOfStock = item.quantity <= 0;

    return (
        <motion.div
            variants={itemVariants}
            whileHover={{ y: -8 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            onHoverStart={() => setIsHovered(true)}
            onHoverEnd={() => setIsHovered(false)}
            className="h-full hidden sm:block"
        >
            <Card className="overflow-hidden bg-white border-0 shadow-lg hover:shadow-2xl transition-all duration-500 group relative h-full flex flex-col">
                {/* Discount Badge */}
                {(item as any).discount && (
                    <motion.div
                        initial={{ x: -100 }}
                        animate={{ x: 0 }}
                        className="absolute top-4 left-4 z-20"
                    >
                        <Badge className={`bg-gradient-to-r ${colors.gradient3} text-white border-0 shadow-lg px-3 py-1`}>
                            -{(item as any).discount}%
                        </Badge>
                    </motion.div>
                )}

                {/* Quick Action Buttons */}
                <AnimatePresence>
                    {isHovered && !isOutOfStock && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="absolute top-4 right-4 z-20 flex flex-col gap-2"
                        >
                            <motion.div whileTap={{ scale: 0.9 }}>
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className={cn(
                                        "h-10 w-10 rounded-full backdrop-blur-sm shadow-lg",
                                        isLiked 
                                            ? "bg-[#DE1A58] text-white hover:bg-[#DE1A58]" 
                                            : "bg-white/90 hover:bg-white"
                                    )}
                                    onClick={() => setIsLiked(!isLiked)}
                                >
                                    <Heart className={cn("h-5 w-5 transition-colors", isLiked && "fill-white")} />
                                </Button>
                            </motion.div>
                            <motion.div whileTap={{ scale: 0.9 }}>
                                <Button
                                    size="icon"
                                    variant="secondary"
                                    className="h-10 w-10 rounded-full bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg"
                                    onClick={() => onQuickView(item)}
                                >
                                    <Share2 className="h-5 w-5 text-[#1A05A2]" />
                                </Button>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Image Container */}
                <div className="relative aspect-square w-full overflow-hidden bg-gradient-to-br from-[#1A05A2]/5 to-[#8F0177]/5">
                    <motion.div
                        animate={{ scale: isHovered ? 1.1 : 1 }}
                        transition={{ duration: 0.4 }}
                        className="relative w-full h-full"
                    >
                        <Image
                            src={item.imageUrl || `https://placehold.co/600x600/e2e8f0/1e293b?text=${encodeURIComponent(item.name)}`}
                            alt={item.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            className="object-cover"
                            priority={false}
                        />
                    </motion.div>

                    {/* Out of Stock Overlay */}
                    {isOutOfStock && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center"
                        >
                            <Badge className="bg-[#DE1A58] text-white text-sm px-4 py-2 rotate-[-15deg] shadow-xl">
                                OUT OF STOCK
                            </Badge>
                        </motion.div>
                    )}

                    {/* Category Badge */}
                    {item.category && (
                        <motion.div
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="absolute bottom-4 left-4 z-10"
                        >
                            <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm hover:bg-white shadow-lg text-[#1A05A2] border border-[#1A05A2]/20">
                                <Tag className="h-3 w-3 mr-1" />
                                {item.category}
                            </Badge>
                        </motion.div>
                    )}
                </div>

                <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-sm font-medium line-clamp-2 text-gray-800">
                        {item.name}
                    </CardTitle>
                    {item.sku && (
                        <p className="text-xs text-gray-500">SKU: {item.sku}</p>
                    )}
                </CardHeader>

                <CardContent className="p-4 pt-0">
                    <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold bg-gradient-to-r ${colors.gradient4} bg-clip-text text-transparent`}>
                            ৳{item.price.toLocaleString()}
                        </span>
                        {(item as any).originalPrice && (
                            <span className="text-sm text-gray-400 line-through">
                                ৳{(item as any).originalPrice}
                            </span>
                        )}
                    </div>

                    {/* Rating Stars */}
                    {(item as any).rating && (
                        <div className="flex items-center gap-1 mt-2">
                            {[...Array(5)].map((_, i) => (
                                <Star
                                    key={i}
                                    className={cn(
                                        "h-3 w-3",
                                        i < (item as any).rating ? "fill-[#F67D31] text-[#F67D31]" : "text-gray-300"
                                    )}
                                />
                            ))}
                            <span className="text-xs text-gray-500 ml-1">
                                ({(item as any).reviews || 0})
                            </span>
                        </div>
                    )}
                </CardContent>

                <CardFooter className="p-4 pt-0 mt-auto">
                    <motion.div
                        whileTap={{ scale: 0.95 }}
                        className="w-full"
                    >
                        <Button
                            className={cn(
                                "w-full bg-gradient-to-r from-[#1A05A2] to-[#8F0177] hover:from-[#8F0177] hover:to-[#DE1A58] text-white shadow-lg hover:shadow-xl transition-all duration-300",
                                isOutOfStock && "opacity-50 cursor-not-allowed bg-gray-400"
                            )}
                            disabled={isOutOfStock}
                            onClick={() => onAddToCart(item)}
                        >
                            {isOutOfStock ? (
                                <>
                                    <Clock className="mr-2 h-4 w-4" />
                                    Out of Stock
                                </>
                            ) : (
                                <>
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Add to Cart
                                </>
                            )}
                        </Button>
                    </motion.div>
                </CardFooter>
            </Card>
        </motion.div>
    );
};

function getCookie(name: string): string | undefined {
    if (typeof document === 'undefined') return undefined;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift();
}

export default function StorePage() {
    const router = useRouter();
    
    const [items, setItems] = useState<InventoryItem[]>([]);
    const [categories, setCategories] = useState<InventoryCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [filterCategory, setFilterCategory] = useState("all");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
    const [sortBy, setSortBy] = useState("default");
    const [priceRange, setPriceRange] = useState({ min: 0, max: 100000 });
    const [showQuickView, setShowQuickView] = useState<InventoryItem | null>(null);
    const [isCheckingOut, setIsCheckingOut] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const { toast } = useToast();

    // Contact Information
    const contactInfo = {
        phone: '+8801617590765',
        email: 'jameurrumuz@gmail.com',
        address: 'Mohir Uddin Pramanik Market, Mogolhat Road, Lalmonirhat',
        copyright: '© 2026 Fin Store. All Rights Reserved'
    };

    // Responsive items per page
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 640) {
                setItemsPerPage(8);
            } else if (window.innerWidth < 1024) {
                setItemsPerPage(12);
            } else {
                setItemsPerPage(20);
            }
        };
        
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const savedCart = localStorage.getItem('shoppingCart');
        if (savedCart) {
            try {
                setCart(JSON.parse(savedCart));
            } catch (e) {
                localStorage.removeItem('shoppingCart');
            }
        }

        const userType = getCookie('userType');
        setIsLoggedIn(!!userType);

        const unsubItems = subscribeToInventoryItems(
            (inventoryItems) => {
                setItems(inventoryItems);
                setLoading(false);
            },
            (error) => {
                console.error('Error fetching items:', error);
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: "Failed to load products. Please refresh the page."
                });
            }
        );

        const unsubCategories = subscribeToInventoryCategories(
            (categories) => {
                setCategories(categories);
            },
            (error) => {
                console.error('Error fetching categories:', error);
            }
        );

        return () => {
            unsubItems();
            unsubCategories();
        };
    }, [toast]);

    useEffect(() => {
        if (cart.length > 0) {
            localStorage.setItem('shoppingCart', JSON.stringify(cart));
        } else {
            localStorage.removeItem('shoppingCart');
        }
    }, [cart]);

    const handleAddToCart = (item: InventoryItem) => {
        setCart(prevCart => {
            const existingItem = prevCart.find(cartItem => cartItem.id === item.id);
            if (existingItem) {
                return prevCart.map(cartItem =>
                    cartItem.id === item.id
                        ? { ...cartItem, quantityInCart: cartItem.quantityInCart + 1 }
                        : cartItem
                );
            }
            return [...prevCart, { ...item, quantityInCart: 1 }];
        });

        toast({
            title: "✨ Added to Cart!",
            description: `${item.name} has been added.`,
            duration: 1500,
            className: `bg-gradient-to-r ${colors.gradient4} text-white border-none`,
        });

        if (typeof window !== 'undefined' && window.navigator.vibrate) {
            window.navigator.vibrate(30);
        }
    };

    const handleUpdateQuantity = (itemId: string, change: number) => {
        setCart(prevCart => {
            const updatedCart = prevCart.map(item => {
                if (item.id === itemId) {
                    const newQuantity = item.quantityInCart + change;
                    return newQuantity > 0 ? { ...item, quantityInCart: newQuantity } : null;
                }
                return item;
            }).filter((item): item is CartItem => item !== null);
            return updatedCart;
        });
    };

    const handleRemoveFromCart = (itemId: string) => {
        setCart(prevCart => prevCart.filter(item => item.id !== itemId));
        toast({
            title: "Item Removed",
            description: "Item has been removed.",
            duration: 1500,
        });
    };

    const handleCheckout = async () => {
        if (!isLoggedIn) {
            router.push('/portal/login?redirect=/store');
            return;
        }

        setIsCheckingOut(true);
        try {
            const invoiceNumber = await generateInvoiceNumber();
            
            const transaction: Omit<Transaction, 'id'> = {
                type: 'sale',
                date: new Date().toISOString().split('T')[0],
                amount: cartTotal,
                partyId: 'walkin-customer',
                description: `Purchase from Online Store - ${new Date().toLocaleString()}`,
                items: cart.map(item => ({
                    id: item.id,
                    name: item.name,
                    quantity: item.quantityInCart,
                    price: item.price,
                    inventoryId: item.id,
                })),
                payments: [{
                    amount: cartTotal,
                    method: 'online',
                    accountId: 'online-sales',
                    date: new Date().toISOString().split('T')[0]
                }] as any,
                status: 'pending',
                invoiceNumber: invoiceNumber,
                createdAt: new Date().toISOString(),
                enabled: true
            };

            // Call addTransaction instead of createTransaction
            const { addTransaction } = await import('@/services/transactionService');
            await addTransaction(transaction);
            
            setCart([]);
            setIsCartOpen(false);
            
            toast({
                title: "🎉 Order Placed!",
                description: `Order #${invoiceNumber} received.`,
                className: `bg-gradient-to-r ${colors.gradient4} text-white border-none`,
            });

            setTimeout(() => {
                router.push('/portal/user/orders');
            }, 1500);

        } catch (error: any) {
            console.error('Checkout error:', error);
            toast({
                variant: "destructive",
                title: "Checkout Failed",
                description: error.message || "Something went wrong."
            });
        } finally {
            setIsCheckingOut(false);
        }
    };

    const cartTotal = useMemo(() => {
        return cart.reduce((total, item) => total + (item.price * item.quantityInCart), 0);
    }, [cart]);

    const cartItemCount = useMemo(() => {
        return cart.reduce((acc, item) => acc + item.quantityInCart, 0);
    }, [cart]);

    const filteredAndSortedItems = useMemo(() => {
        let filtered = items.filter(item => {
            const categoryMatch = filterCategory === 'all' || item.category === filterCategory;
            const searchMatch = searchTerm
                ? item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                  (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
                  (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()))
                : true;
            const priceMatch = item.price >= priceRange.min && item.price <= priceRange.max;
            return categoryMatch && searchMatch && priceMatch;
        });

        switch (sortBy) {
            case "price-low":
                filtered.sort((a, b) => a.price - b.price);
                break;
            case "price-high":
                filtered.sort((a, b) => b.price - a.price);
                break;
            case "name":
                filtered.sort((a, b) => a.name.localeCompare(b.name));
                break;
            default:
                break;
        }

        return filtered;
    }, [items, searchTerm, filterCategory, sortBy, priceRange]);

    const paginatedItems = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredAndSortedItems.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredAndSortedItems, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredAndSortedItems.length / itemsPerPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterCategory, sortBy, priceRange]);

    // Mobile Filter Dialog
    const MobileFilterDialog = () => (
        <Dialog open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
            <DialogContent className="w-[90%] max-w-[400px] rounded-2xl p-0 overflow-hidden">
                <DialogHeader className="p-4 border-b sticky top-0 bg-white z-10">
                    <div className="flex items-center justify-between">
                        <DialogTitle className={`text-base font-semibold bg-gradient-to-r ${colors.gradient4} bg-clip-text text-transparent`}>
                            Filter Products
                        </DialogTitle>
                        <DialogDescription className="sr-only">
                            Filter and sort products by category, price, and other options
                        </DialogDescription>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-gray-100" onClick={() => setIsMobileFilterOpen(false)}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>
                
                <div className="p-4 space-y-6 overflow-y-auto max-h-[70vh]">
                    {/* Categories */}
                    <div>
                        <h4 className="text-sm font-medium mb-3 text-[#1A05A2]">Categories</h4>
                        <div className="flex flex-wrap gap-2">
                            <Badge
                                variant={filterCategory === "all" ? "default" : "outline"}
                                className={cn(
                                    "px-4 py-2 text-sm cursor-pointer transition-all",
                                    filterCategory === "all" 
                                        ? `bg-gradient-to-r ${colors.gradient4} text-white` 
                                        : "hover:border-[#1A05A2] hover:text-[#1A05A2]"
                                )}
                                onClick={() => {
                                    setFilterCategory("all");
                                    setIsMobileFilterOpen(false);
                                }}
                            >
                                All
                            </Badge>
                            {categories.map(c => (
                                <Badge
                                    key={c.id}
                                    variant={filterCategory === c.name ? "default" : "outline"}
                                    className={cn(
                                        "px-4 py-2 text-sm cursor-pointer transition-all",
                                        filterCategory === c.name 
                                            ? `bg-gradient-to-r ${colors.gradient4} text-white` 
                                            : "hover:border-[#1A05A2] hover:text-[#1A05A2]"
                                    )}
                                    onClick={() => {
                                        setFilterCategory(c.name);
                                        setIsMobileFilterOpen(false);
                                    }}
                                >
                                    {c.name}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Sort */}
                    <div>
                        <h4 className="text-sm font-medium mb-3 text-[#1A05A2]">Sort By</h4>
                        <div className="space-y-2">
                            {[
                                { value: "default", label: "Default" },
                                { value: "price-low", label: "Price: Low to High" },
                                { value: "price-high", label: "Price: High to Low" },
                                { value: "name", label: "Name" }
                            ].map(option => (
                                <motion.div
                                    key={option.value}
                                    whileTap={{ scale: 0.98 }}
                                    className={cn(
                                        "p-3 rounded-lg border cursor-pointer transition-all",
                                        sortBy === option.value 
                                            ? "border-[#1A05A2] bg-[#1A05A2]/5" 
                                            : "border-gray-200 hover:border-[#1A05A2]"
                                    )}
                                    onClick={() => {
                                        setSortBy(option.value);
                                        setIsMobileFilterOpen(false);
                                    }}
                                >
                                    <span className={cn(
                                        "text-sm",
                                        sortBy === option.value && "text-[#1A05A2] font-medium"
                                    )}>
                                        {option.label}
                                    </span>
                                </motion.div>
                            ))}
                        </div>
                    </div>

                    {/* Price Range */}
                    <div>
                        <h4 className="text-sm font-medium mb-3 text-[#1A05A2]">Price Range</h4>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Input
                                    type="number"
                                    placeholder="Min"
                                    value={priceRange.min}
                                    onChange={(e) => setPriceRange(prev => ({ ...prev, min: Number(e.target.value) }))}
                                    className="bg-gray-50 text-sm h-10 focus-visible:ring-[#1A05A2]"
                                />
                                <span className="text-gray-500">-</span>
                                <Input
                                    type="number"
                                    placeholder="Max"
                                    value={priceRange.max}
                                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: Number(e.target.value) }))}
                                    className="bg-gray-50 text-sm h-10 focus-visible:ring-[#1A05A2]"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Clear Filters */}
                    <Button
                        variant="outline"
                        className="w-full h-11 text-sm border-[#DE1A58] text-[#DE1A58] hover:bg-[#DE1A58] hover:text-white transition-all"
                        onClick={() => {
                            setFilterCategory("all");
                            setSearchTerm("");
                            setSortBy("default");
                            setPriceRange({ min: 0, max: 100000 });
                            setIsMobileFilterOpen(false);
                        }}
                    >
                        <RefreshCw className="mr-2 h-4 w-4" />
                        Clear All Filters
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1A05A2]/5 via-[#8F0177]/5 to-[#DE1A58]/5">
                <motion.div
                    animate={{ 
                        rotate: 360,
                        scale: [1, 1.2, 1],
                    }}
                    transition={{ 
                        rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                        scale: { duration: 1, repeat: Infinity }
                    }}
                    className="relative"
                >
                    <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${colors.gradient1} blur-xl opacity-50`} />
                    <Loader2 className="h-12 w-12 text-[#1A05A2] relative z-10" />
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50">
            {/* Mobile Filter Dialog */}
            <MobileFilterDialog />

            {/* Quick View Dialog */}
            <Dialog open={!!showQuickView} onOpenChange={() => setShowQuickView(null)}>
                <DialogContent className="w-[320px] max-w-[320px] rounded-2xl p-0 overflow-hidden">
                    {showQuickView && (
                        <>
                            <div className="relative aspect-square w-full">
                                <Image
                                    src={showQuickView.imageUrl || '/placeholder.png'}
                                    alt={showQuickView.name}
                                    fill
                                    className="object-cover"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute top-2 right-2 h-8 w-8 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white"
                                    onClick={() => setShowQuickView(null)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="p-4 space-y-3">
                                <DialogTitle className="sr-only">
                                    Product Details: {showQuickView.name}
                                </DialogTitle>
                                <DialogDescription className="sr-only">
                                    View and add {showQuickView.name} to your cart.
                                </DialogDescription>
                                
                                <h3 className="text-base font-semibold text-gray-800 line-clamp-2">{showQuickView.name}</h3>
                                <div className="flex items-center justify-between">
                                    <p className={`text-xl font-bold bg-gradient-to-r ${colors.gradient4} bg-clip-text text-transparent`}>
                                        ৳{showQuickView.price.toLocaleString()}
                                    </p>
                                    {showQuickView.quantity <= 0 && (
                                        <Badge className="bg-[#DE1A58] text-white text-xs">Out of Stock</Badge>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 line-clamp-2">
                                    {showQuickView.description || 'No description available.'}
                                </p>
                                <Button
                                    className={`w-full h-9 text-sm bg-gradient-to-r ${colors.gradient4} hover:${colors.gradient5} text-white`}
                                    onClick={() => {
                                        handleAddToCart(showQuickView);
                                        setShowQuickView(null);
                                    }}
                                    disabled={showQuickView.quantity <= 0}
                                >
                                    {showQuickView.quantity <= 0 ? (
                                        "Out of Stock"
                                    ) : (
                                        <>
                                            <ShoppingCart className="mr-2 h-4 w-4" />
                                            Add to Cart
                                        </>
                                    )}
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Cart Dialog */}
            <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
                <DialogContent className="w-[90%] max-w-[400px] rounded-2xl p-0 overflow-hidden">
                    <DialogHeader className={`p-4 border-b bg-gradient-to-r ${colors.gradient4}`}>
                        <div className="flex items-center justify-between">
                            <DialogTitle className="text-base font-semibold text-white flex items-center gap-2">
                                <ShoppingBag className="h-5 w-5" />
                                Shopping Cart ({cartItemCount})
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                                Your shopping cart items
                            </DialogDescription>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/20 rounded-full" onClick={() => setIsCartOpen(false)}>
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </DialogHeader>

                    {cart.length > 0 ? (
                        <>
                            <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                                <AnimatePresence>
                                    {cart.map(item => (
                                        <motion.div
                                            key={item.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl"
                                        >
                                            <div className="relative h-16 w-16 rounded-lg overflow-hidden flex-shrink-0">
                                                <Image
                                                    src={item.imageUrl || '/placeholder.png'}
                                                    alt={item.name}
                                                    fill
                                                    className="object-cover"
                                                />
                                            </div>
                                            <div className="flex-grow min-w-0">
                                                <p className="font-medium text-sm truncate text-gray-800">{item.name}</p>
                                                <p className="text-xs text-[#8F0177] mt-0.5">
                                                    ৳{item.price.toLocaleString()} x {item.quantityInCart}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-7 w-7 rounded-full border-[#1A05A2] text-[#1A05A2] hover:bg-[#1A05A2] hover:text-white"
                                                    onClick={() => handleUpdateQuantity(item.id, -1)}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="w-6 text-center text-sm font-medium">
                                                    {item.quantityInCart}
                                                </span>
                                                <Button
                                                    size="icon"
                                                    variant="outline"
                                                    className="h-7 w-7 rounded-full border-[#1A05A2] text-[#1A05A2] hover:bg-[#1A05A2] hover:text-white"
                                                    onClick={() => handleUpdateQuantity(item.id, 1)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7 text-[#DE1A58] hover:bg-[#DE1A58] hover:text-white rounded-full"
                                                onClick={() => handleRemoveFromCart(item.id)}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </Button>
                                        </motion.div>
                                    ))}
                                </AnimatePresence>
                            </div>

                            <div className="p-4 border-t bg-gray-50">
                                <div className="space-y-2 mb-3">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Subtotal</span>
                                        <span className="font-medium text-[#1A05A2]">৳{cartTotal.toLocaleString()}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-600">Shipping</span>
                                        <span className="text-green-600">Free</span>
                                    </div>
                                    <Separator className="bg-gray-200" />
                                    <div className="flex justify-between font-bold">
                                        <span>Total</span>
                                        <span className={`bg-gradient-to-r ${colors.gradient4} bg-clip-text text-transparent`}>
                                            ৳{cartTotal.toLocaleString()}
                                        </span>
                                    </div>
                                </div>

                                {isLoggedIn ? (
                                    <Button 
                                        className={`w-full h-10 text-sm bg-gradient-to-r ${colors.gradient4} hover:${colors.gradient5} text-white`}
                                        onClick={handleCheckout}
                                        disabled={isCheckingOut}
                                    >
                                        {isCheckingOut ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Processing...
                                            </>
                                        ) : (
                                            <>
                                                <CreditCard className="mr-2 h-4 w-4" />
                                                Checkout
                                            </>
                                        )}
                                    </Button>
                                ) : (
                                    <div className="flex gap-2">
                                        <Button asChild variant="outline" className="flex-1 h-9 text-sm border-[#1A05A2] text-[#1A05A2] hover:bg-[#1A05A2] hover:text-white">
                                            <Link href="/portal/login?redirect=/store">
                                                Login
                                            </Link>
                                        </Button>
                                        <Button asChild className={`flex-1 h-9 text-sm bg-gradient-to-r ${colors.gradient4} hover:${colors.gradient5} text-white`}>
                                            <Link href="/portal/signup?redirect=/store">
                                                Sign Up
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="flex flex-col items-center justify-center py-12 px-4"
                        >
                            <motion.div
                                animate={{ 
                                    scale: [1, 1.1, 1],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <ShoppingBag className="h-16 w-16 text-[#1A05A2]/20 mb-4" />
                            </motion.div>
                            <p className="text-base font-semibold mb-1 text-gray-800">Your cart is empty</p>
                            <p className="text-xs text-gray-500 mb-4 text-center">Looks like you haven't added anything yet</p>
                            <Button onClick={() => setIsCartOpen(false)} variant="outline" size="sm" className="border-[#1A05A2] text-[#1A05A2] hover:bg-[#1A05A2] hover:text-white">
                                Continue Shopping
                            </Button>
                        </motion.div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Header */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-gray-200">
                <div className="px-3">
                    {/* Top Bar */}
                    <div className="flex h-14 items-center justify-between">
                        {/* Logo */}
                        <Link href="/store" className="flex items-center gap-1.5 group">
                            <motion.div
                                whileHover={{ rotate: 360 }}
                                transition={{ duration: 0.5 }}
                                className="relative"
                            >
                                <div className={`absolute inset-0 rounded-full bg-gradient-to-r ${colors.gradient1} blur-md opacity-50 group-hover:opacity-75 transition-opacity`} />
                                <Store className="h-6 w-6 text-[#1A05A2] relative z-10" />
                            </motion.div>
                            <span className={`text-base font-bold bg-gradient-to-r ${colors.gradient4} bg-clip-text text-transparent`}>
                                FinStore
                            </span>
                        </Link>

                        {/* Right Icons */}
                        <div className="flex items-center gap-1">
                            {isLoggedIn ? (
                                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-[#1A05A2] hover:bg-[#1A05A2]/10 rounded-full">
                                    <Link href="/portal/user/dashboard">
                                        <User className="h-5 w-5" />
                                    </Link>
                                </Button>
                            ) : (
                                <Button asChild variant="ghost" size="icon" className="h-9 w-9 text-[#1A05A2] hover:bg-[#1A05A2]/10 rounded-full">
                                    <Link href="/portal/login">
                                        <LogIn className="h-5 w-5" />
                                    </Link>
                                </Button>
                            )}

                            {/* Cart Button */}
                            <motion.div
                                whileTap={{ scale: 0.9 }}
                                className="relative"
                            >
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="relative h-9 w-9 text-[#1A05A2] hover:bg-[#1A05A2]/10 rounded-full"
                                    onClick={() => setIsCartOpen(true)}
                                >
                                    <ShoppingCart className="h-5 w-5" />
                                    {cartItemCount > 0 && (
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            className="absolute -top-1 -right-1"
                                        >
                                            <Badge className={`h-5 w-5 rounded-full p-0 flex items-center justify-center bg-gradient-to-r ${colors.gradient3} text-white text-xs`}>
                                                {cartItemCount}
                                            </Badge>
                                        </motion.div>
                                    )}
                                </Button>
                            </motion.div>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <motion.div 
                        className="pb-3"
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="Search products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-9 h-10 bg-gray-100 border-0 rounded-full text-sm focus-visible:ring-2 focus-visible:ring-[#1A05A2] transition-all"
                            />
                            {searchTerm && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-gray-500 hover:text-[#DE1A58] rounded-full"
                                    onClick={() => setSearchTerm("")}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </motion.div>

                    {/* Filter and Sort Row */}
                    <div className="flex items-center justify-between pb-2">
                        <motion.div 
                            className="flex gap-1 overflow-x-auto hide-scrollbar"
                            initial={{ x: -20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Badge
                                variant={filterCategory === "all" ? "default" : "outline"}
                                className={cn(
                                    "px-4 py-1.5 text-xs whitespace-nowrap cursor-pointer transition-all rounded-full",
                                    filterCategory === "all" 
                                        ? `bg-gradient-to-r ${colors.gradient4} text-white` 
                                        : "hover:border-[#1A05A2] hover:text-[#1A05A2]"
                                )}
                                onClick={() => setFilterCategory("all")}
                            >
                                All
                            </Badge>
                            {categories.slice(0, 5).map(c => (
                                <Badge
                                    key={c.id}
                                    variant={filterCategory === c.name ? "default" : "outline"}
                                    className={cn(
                                        "px-4 py-1.5 text-xs whitespace-nowrap cursor-pointer transition-all rounded-full",
                                        filterCategory === c.name 
                                            ? `bg-gradient-to-r ${colors.gradient4} text-white` 
                                            : "hover:border-[#1A05A2] hover:text-[#1A05A2]"
                                    )}
                                    onClick={() => setFilterCategory(c.name)}
                                >
                                    {c.name}
                                </Badge>
                            ))}
                        </motion.div>
                        
                        <motion.div
                            whileTap={{ scale: 0.95 }}
                            initial={{ x: 20, opacity: 0 }}
                            animate={{ x: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                        >
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-3 text-xs ml-2 flex-shrink-0 border-[#1A05A2] text-[#1A05A2] hover:bg-[#1A05A2] hover:text-white rounded-full"
                                onClick={() => setIsMobileFilterOpen(true)}
                            >
                                <SlidersHorizontal className="h-3.5 w-3.5 mr-1" />
                                Filter
                            </Button>
                        </motion.div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="px-3 py-4">
                {/* Results Summary */}
                <motion.div 
                    className="flex justify-between items-center mb-3"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.3 }}
                >
                    <p className="text-xs text-gray-500">
                        {filteredAndSortedItems.length} products found
                    </p>
                    <Badge variant="secondary" className={`text-xs px-2 py-0.5 bg-gradient-to-r ${colors.gradient4} text-white rounded-full`}>
                        <Sparkles className="h-3 w-3 mr-1" />
                        New
                    </Badge>
                </motion.div>

                {/* Product Grid */}
                {filteredAndSortedItems.length > 0 ? (
                    <>
                        <motion.div
                            variants={containerVariants}
                            initial="hidden"
                            animate="visible"
                            className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 sm:gap-4"
                        >
                            {paginatedItems.map(item => (
                                <React.Fragment key={item.id}>
                                    {/* Mobile Card */}
                                    <div className="block sm:hidden">
                                        <MobileProductCard
                                            item={item}
                                            onAddToCart={handleAddToCart}
                                            onQuickView={setShowQuickView}
                                        />
                                    </div>
                                    {/* Desktop Card */}
                                    <div className="hidden sm:block">
                                        <DesktopProductCard
                                            item={item}
                                            onAddToCart={handleAddToCart}
                                            onQuickView={setShowQuickView}
                                        />
                                    </div>
                                </React.Fragment>
                            ))}
                        </motion.div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <motion.div 
                                className="flex items-center justify-center gap-2 mt-6"
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: 0.4 }}
                            >
                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 border-[#1A05A2] text-[#1A05A2] hover:bg-[#1A05A2] hover:text-white rounded-full"
                                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                
                                <span className={`text-sm px-3 py-1 bg-gradient-to-r ${colors.gradient4} text-white rounded-full`}>
                                    {currentPage} / {totalPages}
                                </span>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8 border-[#1A05A2] text-[#1A05A2] hover:bg-[#1A05A2] hover:text-white rounded-full"
                                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                    disabled={currentPage === totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </motion.div>
                        )}
                    </>
                ) : (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-12"
                    >
                        <motion.div
                            animate={{ 
                                scale: [1, 1.1, 1],
                            }}
                            transition={{ duration: 3, repeat: Infinity }}
                            className="relative inline-block"
                        >
                            <Search className="h-16 w-16 mx-auto text-[#1A05A2]/20 mb-4" />
                            <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="absolute -top-2 -right-2"
                            >
                                <Badge className={`h-5 w-5 rounded-full bg-gradient-to-r ${colors.gradient3} text-white`}>0</Badge>
                            </motion.div>
                        </motion.div>
                        <h3 className="text-base font-semibold mb-2 text-gray-800">No Products Found</h3>
                        <p className="text-xs text-gray-500 mb-4 max-w-xs mx-auto">We couldn't find any products matching your criteria.</p>
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-[#1A05A2] text-[#1A05A2] hover:bg-[#1A05A2] hover:text-white rounded-full"
                            onClick={() => {
                                setSearchTerm("");
                                setFilterCategory("all");
                                setSortBy("default");
                                setPriceRange({ min: 0, max: 100000 });
                            }}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Clear Filters
                        </Button>
                    </motion.div>
                )}
            </main>

            {/* Features Section */}
            <section className="bg-gradient-to-br from-[#1A05A2]/5 via-[#8F0177]/5 to-[#DE1A58]/5 py-8 sm:py-12 mt-6">
                <div className="container mx-auto px-4">
                    <motion.h2 
                        className="text-lg sm:text-xl font-bold text-center mb-6"
                        initial={{ y: 20, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                    >
                        Why Choose <span className={`bg-gradient-to-r ${colors.gradient4} bg-clip-text text-transparent`}>Fin Store</span>
                    </motion.h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        {[
                            { icon: Truck, title: "Free Shipping", desc: "On orders ৳1000+", color: "#1A05A2" },
                            { icon: Shield, title: "Secure Payment", desc: "100% secure", color: "#8F0177" },
                            { icon: RefreshCw, title: "Easy Returns", desc: "7-day return", color: "#DE1A58" },
                            { icon: Gift, title: "Rewards", desc: "Earn points", color: "#F67D31" }
                        ].map((feature, index) => (
                            <motion.div
                                key={index}
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 }}
                                viewport={{ once: true }}
                                whileHover={{ y: -5 }}
                                className="text-center"
                            >
                                <div className={cn(
                                    "inline-flex p-3 bg-white rounded-xl shadow-lg mb-2",
                                    "hover:shadow-xl transition-all duration-300"
                                )}>
                                    <feature.icon className="h-5 w-5" style={{ color: feature.color }} />
                                </div>
                                <h3 className="text-xs font-semibold mb-0.5 text-gray-800">{feature.title}</h3>
                                <p className="text-[10px] text-gray-500">{feature.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Newsletter Section */}
            <section className="py-8 bg-gradient-to-r from-[#1A05A2]/10 via-[#8F0177]/10 to-[#DE1A58]/10">
                <div className="container mx-auto px-4 text-center">
                    <motion.h2 
                        className="text-base sm:text-lg font-bold mb-1 text-gray-800"
                        initial={{ y: 20, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        viewport={{ once: true }}
                    >
                        Stay Updated
                    </motion.h2>
                    <motion.p 
                        className="text-xs text-gray-500 mb-4"
                        initial={{ y: 20, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        viewport={{ once: true }}
                    >
                        Get updates on new products and offers
                    </motion.p>
                    <motion.div 
                        className="flex flex-col sm:flex-row max-w-md mx-auto gap-2 px-4"
                        initial={{ y: 20, opacity: 0 }}
                        whileInView={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        viewport={{ once: true }}
                    >
                        <Input
                            type="email"
                            placeholder="Enter your email"
                            className="bg-white text-sm h-9 focus-visible:ring-[#1A05A2] rounded-full"
                        />
                        <Button className={`bg-gradient-to-r ${colors.gradient4} hover:${colors.gradient5} text-white whitespace-nowrap text-sm h-9 rounded-full px-6`}>
                            Subscribe
                        </Button>
                    </motion.div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-gray-200 py-8">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-6">
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Store className="h-5 w-5 text-[#1A05A2]" />
                                <span className={`font-bold text-sm bg-gradient-to-r ${colors.gradient4} bg-clip-text text-transparent`}>
                                    Fin Store
                                </span>
                            </div>
                            <p className="text-xs text-gray-500 mb-3">
                                Your trusted online store for quality products at the best prices in Bangladesh.
                            </p>
                            <div className="flex gap-2">
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#1A05A2]/10 text-[#1A05A2]">
                                    <Facebook className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#8F0177]/10 text-[#8F0177]">
                                    <Instagram className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#DE1A58]/10 text-[#DE1A58]">
                                    <Twitter className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-[#F67D31]/10 text-[#F67D31]">
                                    <Youtube className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                        
                        <div>
                            <h4 className="font-semibold text-sm mb-3 text-gray-800">Quick Links</h4>
                            <ul className="space-y-2 text-xs text-gray-500">
                                <li><Link href="/about" className="hover:text-[#1A05A2] transition-colors">About Us</Link></li>
                                <li><Link href="/contact" className="hover:text-[#8F0177] transition-colors">Contact</Link></li>
                                <li><Link href="/faq" className="hover:text-[#DE1A58] transition-colors">FAQ</Link></li>
                                <li><Link href="/terms" className="hover:text-[#F67D31] transition-colors">Terms & Conditions</Link></li>
                                <li><Link href="/privacy" className="hover:text-[#1A05A2] transition-colors">Privacy Policy</Link></li>
                            </ul>
                        </div>
                        
                        <div>
                            <h4 className="font-semibold text-sm mb-3 text-gray-800">Categories</h4>
                            <ul className="space-y-2 text-xs text-gray-500">
                                {categories.slice(0, 5).map(c => (
                                    <li key={c.id}>
                                        <button
                                            onClick={() => setFilterCategory(c.name)}
                                            className="hover:text-[#1A05A2] transition-colors"
                                        >
                                            {c.name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                        
                        <div>
                            <h4 className="font-semibold text-sm mb-3 text-gray-800">Contact Us</h4>
                            <div className="space-y-2 text-xs text-gray-500">
                                <p className="flex items-center gap-2">
                                    <Phone className="h-4 w-4 text-[#1A05A2]" />
                                    <a href={`tel:${contactInfo.phone}`} className="hover:text-[#1A05A2] transition-colors">
                                        {contactInfo.phone}
                                    </a>
                                </p>
                                <p className="flex items-center gap-2">
                                    <Mail className="h-4 w-4 text-[#8F0177]" />
                                    <a href={`mailto:${contactInfo.email}`} className="hover:text-[#8F0177] transition-colors">
                                        {contactInfo.email}
                                    </a>
                                </p>
                                <p className="flex items-center gap-2">
                                    <MapPin className="h-4 w-4 text-[#DE1A58]" />
                                    <span>{contactInfo.address}</span>
                                </p>
                                <p className="flex items-center gap-2 mt-3 pt-2 border-t border-gray-100">
                                    <Headphones className="h-4 w-4 text-[#F67D31]" />
                                    <span className="font-medium text-[#F67D31]">24/7 Customer Support</span>
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="border-t border-gray-200 pt-4 text-center">
                        <p className="text-xs text-gray-500">
                            {contactInfo.copyright}
                        </p>
                    </div>
                </div>
            </footer>

            {/* Bottom Navigation - Mobile */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 py-2 px-4 sm:hidden z-50">
                <div className="flex items-center justify-between">
                    {[
                        { icon: Home, label: "Home", href: "/store", color: "#1A05A2" },
                        { icon: Menu, label: "Categories", href: "/categories", color: "#8F0177" },
                        { icon: Gift, label: "Offers", href: "/offers", color: "#DE1A58" },
                        { icon: User, label: "Account", href: "/account", color: "#F67D31" }
                    ].map((item, i) => (
                        <Link key={i} href={item.href} className="flex flex-col items-center group">
                            <item.icon className="h-5 w-5 transition-colors" style={{ color: item.color }} />
                            <span className="text-[10px] mt-0.5 text-gray-500 group-hover:text-[#1A05A2] transition-colors">
                                {item.label}
                            </span>
                        </Link>
                    ))}
                </div>
            </nav>

            {/* Bottom Padding for Mobile Nav */}
            <div className="h-14 sm:h-0"></div>
        </div>
    );
}