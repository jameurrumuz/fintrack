

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { addPlanProject } from '@/services/planService';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewPlanPage() {
  const [projectName, setProjectName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) {
      toast({
        variant: 'destructive',
        title: 'Project Name Required',
        description: 'Please enter a name for your new project.',
      });
      return;
    }
    setIsSaving(true);
    try {
      const newProjectId = await addPlanProject({ 
        name: projectName.trim(),
        selectedAccountIds: [],
        rawStartingBalance: { cash: 0, bank: 0, total: 0 },
       });
      toast({
        title: 'Project Created',
        description: `Successfully created "${projectName.trim()}".`,
      });
      // Redirect back to the main planner page, which will automatically select the new project
      router.push(`/plan?newProjectId=${newProjectId}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: `Could not create project: ${error.message}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto max-w-2xl py-8">
       <div className="mb-6">
        <Button variant="outline" asChild>
            <Link href="/plan"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Planner</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Create a New Financial Plan</CardTitle>
          <CardDescription>Give your new plan a name to get started.</CardDescription>
        </CardHeader>
        <form onSubmit={handleCreateProject}>
            <CardContent>
                <div className="space-y-2">
                    <Label htmlFor="project-name">Project Name</Label>
                    <Input
                        id="project-name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        placeholder="e.g., Q3 Sales Projection"
                        autoFocus
                    />
                </div>
            </CardContent>
            <CardFooter>
                 <Button type="submit" disabled={isSaving}>
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Create Project
                </Button>
            </CardFooter>
        </form>
      </Card>
    </div>
  );
}

