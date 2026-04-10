

'use client';
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import type { Task, Party } from '@/types';
import { formatDistanceToNow, parseISO, isPast, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { MoreVertical, Edit, Trash2, MessageSquare, Bell, Clock, CheckCircle2, CircleDot, XCircle, Flag, Calendar, Phone, User } from 'lucide-react';

const priorityMap = {
  low: { label: 'Low', icon: <Flag className="h-4 w-4" />, color: 'text-gray-500' },
  medium: { label: 'Medium', icon: <Flag className="h-4 w-4" />, color: 'text-yellow-600' },
  high: { label: 'High', icon: <Flag className="h-4 w-4" />, color: 'text-red-600' },
};

const statusMap = {
    'in-progress': { label: 'In Progress', icon: <CircleDot className="h-4 w-4" />, color: 'text-blue-600' },
    'completed': { label: 'Completed', icon: <CheckCircle2 className="h-4 w-4" />, color: 'text-green-600' },
    'cancelled': { label: 'Cancelled', icon: <XCircle className="h-4 w-4" />, color: 'text-gray-500' },
}

const TaskCard = ({ task, parties, onCall, onUpdateStatus, onAddComment, onSetReminder, onEdit, onDelete }: { task: Task; parties?: Party[]; onCall?: (phone: string, partyId: string, taskTitle: string) => void; onUpdateStatus: (taskId: string, newStatus: Task['status']) => void; onAddComment: (id: string) => void; onSetReminder: (id: string) => void; onEdit: (task: Task) => void; onDelete: (taskId: string) => void; }) => {
    const partyDetails = task.partyId && parties ? parties.find(p => p.id === task.partyId) : null;
    const priority = priorityMap[task.priority];
    const status = statusMap[task.status];
    const isOverdue = isPast(parseISO(task.dueDate)) && task.status === 'in-progress';
    const { toast } = useToast();
    const [newUpdate, setNewUpdate] = React.useState('');
    const [showHistory, setShowHistory] = React.useState(false);

    const handlePostUpdate = () => {
        if (!newUpdate.trim()) return;
        onAddComment(task.id);
        setNewUpdate('');
        toast({ title: 'Update Posted!' });
    };

    return (
      <Card>
        <CardHeader className="flex-row items-start justify-between">
            <div>
              <CardTitle>{task.title}</CardTitle>
              <CardDescription>{task.description}</CardDescription>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4"/></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                {Object.entries(statusMap).map(([key, value]) => (
                    <DropdownMenuItem key={key} onClick={() => onUpdateStatus(task.id, key as Task['status'])}>
                        {React.cloneElement(value.icon, {className: 'mr-2 h-4 w-4'})} {value.label}
                    </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(task)}><Edit className="mr-2 h-4 w-4"/> Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetReminder(task.id)}><Bell className="mr-2 h-4 w-4" /> Set Reminder</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/> Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline" className={cn(priority.color)}>
                    {priority.icon} {priority.label} Priority
                </Badge>
                <Badge variant={isOverdue ? 'destructive' : 'outline'}>
                    <Calendar className="mr-1.5 h-4 w-4"/> Due {formatDistanceToNow(parseISO(task.dueDate), { addSuffix: true })}
                </Badge>
                <Badge variant="secondary">{task.category}</Badge>
            </div>
            {partyDetails && onCall && (
                <Card className="bg-blue-50 dark:bg-blue-900/20">
                    <CardHeader className="p-3"><CardTitle className="text-base flex items-center gap-2 text-blue-800"><User/>Customer: {partyDetails.name}</CardTitle></CardHeader>
                    <CardContent className="p-3 space-y-1 text-sm">
                        <p><strong>Address:</strong> {partyDetails.address}</p>
                        <div className="flex items-center justify-between">
                            <p><strong>Phone:</strong> {partyDetails.phone}</p>
                            <Button size="sm" onClick={() => onCall(partyDetails.phone!, partyDetails.id, task.title)}><Phone className="mr-2 h-4 w-4"/> Call</Button>
                        </div>
                    </CardContent>
                </Card>
            )}
             <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground" onClick={() => setShowHistory(!showHistory)} style={{cursor: 'pointer'}}>
                    Updates & History ({task.history.length})
                </h4>
                {showHistory && (
                    <div className="space-y-2 max-h-40 overflow-y-auto pr-2 border-l-2 pl-2">
                        {task.history.slice().reverse().map((entry, index) => (
                            <div key={index} className="text-xs flex gap-2">
                                <div className="text-muted-foreground"><Clock className="h-3 w-3 mt-0.5"/></div>
                                <div>
                                    <p className="text-muted-foreground">{formatDistanceToNow(parseISO(entry.date), {addSuffix: true})}</p>
                                    <p>{entry.comment}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </CardContent>
        <CardFooter className="flex-col items-start gap-2">
            <div className="w-full">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span className={cn('flex items-center gap-1.5', status.color)}>
                        {status.icon} {status.label}
                    </span>
                    <span>{task.progress}%</span>
                </div>
                <Progress value={task.progress} />
            </div>
             <div className="w-full space-y-2">
                <Textarea placeholder="Post an update..." value={newUpdate} onChange={(e) => setNewUpdate(e.target.value)} />
                <Button size="sm" onClick={handlePostUpdate} disabled={!newUpdate.trim()}>Post Update</Button>
            </div>
        </CardFooter>
      </Card>
    )
}

export default TaskCard;
