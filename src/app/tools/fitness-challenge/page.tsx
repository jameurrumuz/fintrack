
'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { FitnessLog, AppSettings, FitnessChallengeSettings, CustomFoodItem } from '@/types';
import { subscribeToFitnessLogs, saveFitnessLog, deleteFitnessLog } from '@/services/fitnessChallengeService';
import { getAppSettings, saveAppSettings } from '@/services/settingsService';
import { Loader2, Trash2, Dumbbell, Apple, Utensils, AlertTriangle, TrendingDown, Settings, Plus, X, BarChart as BarChartIcon } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { format, differenceInDays, parseISO } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription as AlertDialogDescriptionComponent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


const USER_ID = "test-user-123"; // Hardcoded for now

const defaultSettings: FitnessChallengeSettings = {
    duration: 45,
    highPointFoods: [
        { id: '1', name: 'Paratha', points: 25 },
        { id: '2', name: 'Noodles', points: 30 },
        { id: '3', name: '2-tsp Sugar Tea', points: 10 },
        { id: '4', name: 'Rice', points: 15 },
    ],
    mediumPointFoods: [
        { id: '5', name: 'Roti', points: 5 },
        { id: '6', name: 'Egg', points: 5 },
    ],
    lowPointFoods: [
        { id: '7', name: 'Apple', points: 5 },
        { id: '8', name: 'Salad', points: 0 },
    ],
};

const SettingsDialog = ({ open, onOpenChange, settings, onSave }: { open: boolean, onOpenChange: (open: boolean) => void, settings: FitnessChallengeSettings, onSave: (newSettings: FitnessChallengeSettings) => void }) => {
    const [localSettings, setLocalSettings] = useState(settings);
    const [newFood, setNewFood] = useState<{ name: string, points: string, list: 'high' | 'medium' | 'low' | null }>({ name: '', points: '', list: null });

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleFoodChange = (list: 'high' | 'medium' | 'low', index: number, field: 'name' | 'points', value: string) => {
        const listKey = `${list}PointFoods` as keyof FitnessChallengeSettings;
        const updatedList = [...(localSettings[listKey] as CustomFoodItem[])];
        if (field === 'points') {
            updatedList[index] = { ...updatedList[index], [field]: parseInt(value) || 0 };
        } else {
            updatedList[index] = { ...updatedList[index], [field]: value };
        }
        setLocalSettings(prev => ({ ...prev!, [listKey]: updatedList }));
    };
    
    const handleRemoveFood = (list: 'high' | 'medium' | 'low', id: string) => {
        const listKey = `${list}PointFoods` as keyof FitnessChallengeSettings;
        const updatedList = (localSettings[listKey] as CustomFoodItem[]).filter(food => food.id !== id);
        setLocalSettings(prev => ({ ...prev!, [listKey]: updatedList }));
    }

    const handleAddFood = () => {
        if (!newFood.name || !newFood.points || !newFood.list) return;
        const listKey = `${newFood.list}PointFoods` as keyof FitnessChallengeSettings;
        const newItem = { id: `food-${Date.now()}`, name: newFood.name, points: parseInt(newFood.points) };
        setLocalSettings(prev => ({ ...prev!, [listKey]: [...(prev[listKey] as CustomFoodItem[]), newItem] }));
        setNewFood({ name: '', points: '', list: null });
    };

    const renderFoodList = (list: CustomFoodItem[], type: 'high' | 'medium' | 'low') => (
        <div className="space-y-2">
            {list.map((food, index) => (
                <div key={food.id} className="flex items-center gap-2">
                    <Input value={food.name} onChange={(e) => handleFoodChange(type, index, 'name', e.target.value)} className="flex-grow" />
                    <Input type="number" value={food.points} onChange={(e) => handleFoodChange(type, index, 'points', e.target.value)} className="w-20" />
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveFood(type, food.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
            ))}
        </div>
    );
    
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Challenge Settings</DialogTitle></DialogHeader>
                <div className="space-y-6 py-4">
                    <div className="space-y-2">
                        <Label>Challenge Duration (Days)</Label>
                        <Input type="number" value={localSettings.duration} onChange={(e) => setLocalSettings({ ...localSettings, duration: parseInt(e.target.value) || 45 })} />
                    </div>
                    
                    <Separator />
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-3 p-3 border rounded-lg">
                            <h4 className="font-semibold text-red-600">High Point Foods (Avoid)</h4>
                            {renderFoodList(localSettings.highPointFoods, 'high')}
                            <Button size="sm" variant="outline" onClick={() => setNewFood({name: '', points: '', list: 'high'})}>+ Add</Button>
                        </div>
                         <div className="space-y-3 p-3 border rounded-lg">
                            <h4 className="font-semibold text-yellow-600">Medium Point Foods (Good)</h4>
                            {renderFoodList(localSettings.mediumPointFoods, 'medium')}
                             <Button size="sm" variant="outline" onClick={() => setNewFood({name: '', points: '', list: 'medium'})}>+ Add</Button>
                        </div>
                         <div className="space-y-3 p-3 border rounded-lg">
                            <h4 className="font-semibold text-green-600">Low Point Foods (Very Good)</h4>
                            {renderFoodList(localSettings.lowPointFoods, 'low')}
                             <Button size="sm" variant="outline" onClick={() => setNewFood({name: '', points: '', list: 'low'})}>+ Add</Button>
                        </div>
                    </div>
                    
                    {newFood.list && (
                        <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                           <Input placeholder="Food Name" value={newFood.name} onChange={(e) => setNewFood({...newFood, name: e.target.value})} />
                           <Input type="number" placeholder="Points" value={newFood.points} onChange={(e) => setNewFood({...newFood, points: e.target.value})} className="w-24"/>
                           <Button onClick={handleAddFood}>Add</Button>
                           <Button variant="ghost" size="icon" onClick={() => setNewFood({name: '', points: '', list: null})}><X className="h-4 w-4"/></Button>
                        </div>
                    )}

                </div>
                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={() => onSave(localSettings)}>Save Settings</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default function FitnessChallengePage() {
    const { toast } = useToast();
    const [logs, setLogs] = useState<FitnessLog[]>([]);
    const [settings, setSettings] = useState<FitnessChallengeSettings>(defaultSettings);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    
    const [todayLog, setTodayLog] = useState<Partial<FitnessLog>>({
        foods: [],
        walk_mins: 0,
    });
    
    useEffect(() => {
        getAppSettings().then(s => {
            setAppSettings(s);
            if (s?.fitnessChallenge) {
                setSettings(s.fitnessChallenge);
            }
        });
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const unsub = subscribeToFitnessLogs(
            USER_ID,
            (newLogs) => {
                setLogs(newLogs);
                const existingTodayLog = newLogs.find(log => log.date === todayStr);
                setTodayLog(existingTodayLog || { date: todayStr, foods: [], walk_mins: 0, user_id: USER_ID });
                setLoading(false);
            },
            (error) => {
                toast({ variant: 'destructive', title: 'Error', description: error.message });
                setLoading(false);
            }
        );
        return () => unsub();
    }, [toast]);
    
    const challengeStartDate = useMemo(() => {
        if (logs.length === 0) return null;
        const firstLogDate = new Date(logs[logs.length - 1].date);
        return firstLogDate;
    }, [logs]);

    const challengeDay = useMemo(() => {
        if (!challengeStartDate) return 1;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(challengeStartDate);
        start.setHours(0, 0, 0, 0);
        return differenceInDays(today, start) + 1;
    }, [challengeStartDate]);

    const handleAddFood = (food: { name: string; points: number }) => {
        setTodayLog(prev => ({
            ...prev,
            foods: [...(prev.foods || []), food],
        }));
    };
    
    const handleRemoveFood = (index: number) => {
        setTodayLog(prev => ({
            ...prev,
            foods: (prev.foods || []).filter((_, i) => i !== index),
        }));
    };

    const handleWalkMinsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setTodayLog(prev => ({ ...prev, walk_mins: parseInt(e.target.value) || 0 }));
    };

    const todayCalculation = useMemo(() => {
        const total_points_food = (todayLog.foods || []).reduce((sum, f) => sum + f.points, 0);
        const walk_mins = todayLog.walk_mins || 0;
        const points_reduced = walk_mins * 0.5;
        const total_points = total_points_food - points_reduced;
        return { total_points, points_reduced };
    }, [todayLog.foods, todayLog.walk_mins]);
    
    const handleSaveLog = async () => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const logToSave: Omit<FitnessLog, 'id' | 'total_kcal'> = {
            date: todayStr,
            user_id: USER_ID,
            foods: todayLog.foods || [],
            walk_mins: todayLog.walk_mins || 0,
            total_points: todayCalculation.total_points,
        };
        try {
            await saveFitnessLog(logToSave as any);
            toast({ title: "Success", description: "Today's log has been saved." });
        } catch (error: any) {
             toast({ variant: 'destructive', title: "Save Failed", description: error.message });
        }
    };
    
    const handleDeleteLog = async (logId: string) => {
        try {
            await deleteFitnessLog(logId);
            toast({ title: 'Log Deleted' });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
        }
    };

    const handleSaveSettings = async (newSettings: FitnessChallengeSettings) => {
        if (!appSettings) return;
        const updatedAppSettings = { ...appSettings, fitnessChallenge: newSettings };
        await saveAppSettings(updatedAppSettings);
        setSettings(newSettings);
        setAppSettings(updatedAppSettings);
        setIsSettingsOpen(false);
        toast({ title: 'Settings saved!' });
    };
    
    const historyChartData = useMemo(() => {
        return logs.map(log => ({
            date: format(parseISO(log.date), 'MMM d'),
            points: log.total_points,
        })).reverse();
    }, [logs]);

    const chartConfig = {
      points: {
        label: "Points",
        color: "hsl(var(--primary))",
      },
    } satisfies ChartConfig;

    if (loading) {
        return <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>
    }

    return (
        <div className="space-y-6">
            <SettingsDialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen} settings={settings} onSave={handleSaveSettings} />
            <div className="flex justify-between items-center">
                 <h1 className="text-3xl font-bold tracking-tight">Fitness Challenge</h1>
                 <Button variant="outline" onClick={() => setIsSettingsOpen(true)}><Settings className="mr-2 h-4 w-4"/> Settings</Button>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>{settings.duration}-Day Weight Loss Challenge</CardTitle>
                    <CardDescription>Day {challengeDay} of {settings.duration}</CardDescription>
                </CardHeader>
                <CardContent>
                    <Progress value={(challengeDay / settings.duration) * 100} />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Today's Entry ({format(new Date(), 'dd MMMM, yyyy')})</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                         <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                             <div className="space-y-2">
                                <Label className="text-base font-semibold">Foods</Label>
                                <div className="flex flex-wrap gap-1">
                                    {settings.highPointFoods.map(food => (<Button key={food.id} variant="outline" size="sm" onClick={() => handleAddFood(food)} className="bg-red-50 text-red-700">{food.name} (+{food.points})</Button>))}
                                    {settings.mediumPointFoods.map(food => (<Button key={food.id} variant="outline" size="sm" onClick={() => handleAddFood(food)} className="bg-yellow-50 text-yellow-700">{food.name} (+{food.points})</Button>))}
                                    {settings.lowPointFoods.map(food => (<Button key={food.id} variant="outline" size="sm" onClick={() => handleAddFood(food)} className="bg-green-50 text-green-700">{food.name} (+{food.points})</Button>))}
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-base font-semibold" htmlFor="walk-mins">Exercise</Label>
                                <div className="flex items-center gap-2">
                                    <Input id="walk-mins" type="number" value={todayLog.walk_mins || ''} onChange={handleWalkMinsChange} placeholder="e.g., 30" />
                                    <Label>mins</Label>
                                </div>
                            </div>
                         </div>
                         <div className="p-4 border rounded-lg bg-muted/30">
                            <h4 className="font-semibold mb-2">Consumed Items</h4>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {(todayLog.foods || []).map((food, index) => (
                                 <div key={index} className="flex justify-between items-center text-sm">
                                     <span>{food.name}</span>
                                     <div className="flex items-center gap-2">
                                         <Badge variant="secondary">{food.points} pts</Badge>
                                         <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleRemoveFood(index)}><Trash2 className="h-4 w-4 text-destructive"/></Button>
                                     </div>
                                 </div>
                              ))}
                              {todayLog.foods?.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No food added yet.</p>}
                            </div>
                         </div>
                    </CardContent>
                    <CardFooter className="flex-col items-stretch space-y-4">
                        <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 space-y-2">
                             <div className="flex justify-between font-semibold">
                                <span>Food Points:</span>
                                <span>{(todayLog.foods || []).reduce((s,f) => s+f.points, 0)}</span>
                             </div>
                              <div className="flex justify-between font-semibold">
                                <span>Walk Deduction:</span>
                                <span>-{todayCalculation.points_reduced.toFixed(1)}</span>
                             </div>
                             <Separator className="bg-blue-200" />
                              <div className="flex justify-between text-xl font-bold">
                                <span>Total Points Today:</span>
                                <span>{todayCalculation.total_points.toFixed(1)}</span>
                             </div>
                        </div>
                        <Button onClick={handleSaveLog} className="w-full">Save Today's Log</Button>
                    </CardFooter>
                </Card>
                
                <Card>
                    <CardHeader>
                        <CardTitle>History & Progress</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ChartContainer config={chartConfig} className="h-60 w-full">
                            <BarChart data={historyChartData} accessibilityLayer>
                                <CartesianGrid vertical={false} />
                                <XAxis dataKey="date" tickLine={false} tickMargin={10} axisLine={false} fontSize={12}/>
                                <YAxis fontSize={12} tickLine={false} axisLine={false}/>
                                <Tooltip cursor={false} content={<ChartTooltipContent />} />
                                <Bar dataKey="points" fill="var(--color-points)" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ChartContainer>
                         <div className="mt-4 space-y-2 max-h-60 overflow-y-auto">
                            {logs.map(log => (
                                <div key={log.id} className="flex justify-between items-center p-2 border rounded-md">
                                    <div>
                                        <p className="font-semibold">{format(new Date(log.date), 'dd MMMM yyyy')}</p>
                                        <p className="text-sm">Points: {log.total_points.toFixed(1)}</p>
                                    </div>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4"/></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescriptionComponent>This will permanently delete this log entry.</AlertDialogDescriptionComponent></AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteLog(log.id)}>Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

    