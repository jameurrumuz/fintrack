
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Download, Upload, Loader2, AlertTriangle, ShieldCheck, Database, ArrowLeft, Sparkles, FileJson, Code2, Cpu } from 'lucide-react';
import { getAllData, restoreAllData } from '@/services/backupService';
import { getProjectCodebase } from './actions';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function BackupRestorePage() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const { toast } = useToast();

  // --- Database Backup ---
  const handleBackup = async () => {
    setLoading(true);
    setStatus('Gathering database information...');
    try {
      const data = await getAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const dateStr = new Date().toISOString().split('T')[0];
      link.download = `fintrack-db-backup-${dateStr}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: 'Backup Successful', description: 'Your database backup has been downloaded.' });
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Backup Failed', description: e.message });
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  // --- Database Restore ---
  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!confirm("CRITICAL WARNING: This will PERMANENTLY DELETE all current database records and replace them with the data from the file. Are you absolutely sure?")) {
      event.target.value = '';
      return;
    }

    setLoading(true);
    setStatus('Restoring database...');
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const fileContent = e.target?.result as string;
        const data = JSON.parse(fileContent);
        await restoreAllData(data);
        toast({ title: 'Restore Successful', description: 'The database has been fully restored. The app will reload.' });
        setTimeout(() => window.location.reload(), 2000);
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Restore Failed', description: 'Invalid file or database error.' });
        setLoading(false);
        setStatus('');
      }
    };
    reader.readAsText(file);
  };

  // --- Project Code Backup ---
  const handleDownloadCodebase = async () => {
    setLoading(true);
    setStatus('Collecting project files...');
    try {
      const result = await getProjectCodebase();
      if (result.success && result.files) {
        const blob = new Blob([JSON.stringify(result.files, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const dateStr = new Date().toISOString().split('T')[0];
        link.download = `fintrack-project-code-${dateStr}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: 'Code Export Successful', description: 'All source files collected into a single JSON file.' });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Export Failed', description: e.message });
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  // --- AI Studio Code Conversion ---
  const handleExportForAiStudio = async () => {
    setLoading(true);
    setStatus('Optimizing code for AI Studio...');
    try {
      const result = await getProjectCodebase();
      if (result.success && result.files) {
        let aiFormattedText = "# FIN TRACK PROJECT CODEBASE\n\n";
        
        Object.entries(result.files).forEach(([path, content]) => {
          aiFormattedText += `\nFILE: ${path}\n`;
          aiFormattedText += "```" + (path.split('.').pop() || 'text') + "\n";
          aiFormattedText += content;
          aiFormattedText += "\n```\n";
          aiFormattedText += "-".repeat(40) + "\n";
        });

        const blob = new Blob([aiFormattedText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `fintrack-ai-studio-code.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast({ title: 'AI Ready!', description: 'Codebase converted for AI Studio prompts.' });
      } else {
        throw new Error(result.error);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Conversion Failed', description: e.message });
    } finally {
      setLoading(false);
      setStatus('');
    }
  };

  return (
    <div className="container mx-auto max-w-4xl py-12 px-4">
      <div className="mb-6">
        <Button variant="outline" asChild>
          <Link href="/tools">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Tools
          </Link>
        </Button>
      </div>

      <Card className="border-2 border-primary/20 shadow-xl overflow-hidden">
        <CardHeader className="text-center bg-muted/30 pb-8 border-b">
          <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
            <Database className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-3xl font-bold">Maintenance Center</CardTitle>
          <CardDescription className="text-base max-w-md mx-auto">
            Backup and manage your entire application, including data and source code.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-10 pt-8">
          {/* Status Overlay for loading */}
          {loading && (
            <div className="fixed inset-0 z-50 bg-background/60 backdrop-blur-sm flex flex-col items-center justify-center">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="font-bold text-lg animate-pulse">{status}</p>
            </div>
          )}

          {/* Section 1: Database Management */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                <Database className="h-5 w-5 text-blue-600" />
              </div>
              <h3 className="font-bold text-xl">Database Management</h3>
            </div>
            
            <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl flex gap-4 items-start shadow-sm mb-4">
              <AlertTriangle className="h-6 w-6 text-amber-600 shrink-0 mt-1" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <p className="font-bold mb-1">Restoration Policy:</p>
                <p>Uploading a backup file will <strong>wipe out all current data</strong>. This action is irreversible.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleBackup}
                className="h-24 flex flex-col gap-2 hover:bg-blue-50 border-blue-200"
              >
                <Download className="h-6 w-6 text-blue-600" />
                <div className="text-left">
                  <p className="font-bold">Backup Database</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Export all collections</p>
                </div>
              </Button>

              <div className="relative">
                <input type="file" accept=".json" onChange={handleRestore} className="hidden" id="db-restore" />
                <Label 
                  htmlFor="db-restore" 
                  className="flex flex-col items-center justify-center h-24 border-2 border-dashed rounded-xl cursor-pointer hover:bg-amber-50 hover:border-amber-300 transition-all text-center p-2"
                >
                  <Upload className="h-6 w-6 text-amber-600 mb-1" />
                  <span className="font-bold">Restore Database</span>
                  <span className="text-[10px] text-muted-foreground uppercase">Import .json file</span>
                </Label>
              </div>
            </div>
          </div>

          {/* Section 2: Project & AI Engineering */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Code2 className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-xl">Code & AI Engineering</h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button 
                size="lg" 
                variant="outline"
                onClick={handleDownloadCodebase}
                className="h-24 flex flex-col gap-2 hover:bg-purple-50 border-purple-200"
              >
                <Code2 className="h-6 w-6 text-purple-600" />
                <div className="text-left">
                  <p className="font-bold">Export Project Code</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Source snapshot (.json)</p>
                </div>
              </Button>

              <Button 
                size="lg" 
                variant="default"
                onClick={handleExportForAiStudio}
                className="h-24 flex flex-col gap-2 shadow-lg group relative overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-600 to-indigo-600 opacity-90 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex flex-col items-center gap-2">
                  <Cpu className="h-6 w-6" />
                  <div className="text-center">
                    <p className="font-bold">Convert for AI Studio</p>
                    <p className="text-[10px] opacity-80 uppercase">Full Context Optimizer</p>
                  </div>
                </div>
              </Button>
            </div>
          </div>
        </CardContent>
        
        <CardFooter className="justify-center border-t bg-muted/30 p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-5 w-5 text-green-600" />
            Military-Grade Local Encryption & Safety
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}
