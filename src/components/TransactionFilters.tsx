
"use client"

import * as React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { transactionTypeOptions } from '@/lib/utils';
import { Trash2, X, Check, ChevronsUpDown } from 'lucide-react';
import type { Filters, Sort } from '@/components/ClientPage';
import type { Account, Party, AppSettings } from '@/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { cn } from '@/lib/utils';
import { DatePicker } from './ui/date-picker';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from './ui/badge';
import { format as formatFns } from 'date-fns';

interface TransactionFiltersProps {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  onDateToChange: (dateTo: string) => void;
  accounts: Account[];
  parties: Party[];
  appSettings: AppSettings | null;
  onDeleteFiltered: () => void;
  sort: Sort;
  setSort: (sort: Sort) => void;
  filteredCount: number;
}

const PartyCombobox = ({ parties, value, onChange }: { parties: Party[], value: string, onChange: (value: string) => void }) => {
    const [open, setOpen] = React.useState(false)
    const selectedPartyName = value === 'all' ? 'All Parties' : parties.find(p => p.id === value)?.name;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal"
                >
                    {selectedPartyName || "Select party..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder="Search party..." />
                    <CommandList>
                        <CommandEmpty>No party found.</CommandEmpty>
                        <CommandGroup>
                             <CommandItem
                                key="all-parties"
                                value="all"
                                onSelect={() => {
                                    onChange("all");
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                                All Parties
                            </CommandItem>
                            {parties.map((party) => (
                                <CommandItem
                                    key={party.id}
                                    value={party.name}
                                    onSelect={(currentValue) => {
                                        const selected = parties.find(p => p.name.toLowerCase() === currentValue.toLowerCase());
                                        onChange(selected ? selected.id : "all");
                                        setOpen(false);
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === party.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {party.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
};


export default function TransactionFilters({ filters, setFilters, onDateToChange, accounts, parties, appSettings, onDeleteFiltered, sort, setSort, filteredCount }: TransactionFiltersProps) {
  
  const handleFilterChange = (key: keyof Filters, value: string) => {
    setFilters({ ...filters, [key]: value });
  };
  
  const handleSort = (key: keyof Sort['sortBy']) => {
    const direction = sort.sortBy[key] === 'asc' ? 'desc' : 'asc';
    setSort({
      sortKey: key,
      sortBy: {
        ...sort.sortBy,
        [key]: direction,
      },
    });
  };

  const clearFilters = () => {
    const today = new Date();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);

    setFilters({
      type: 'all',
      accountId: 'all',
      partyId: 'all',
      dateFrom: formatFns(sevenDaysAgo, 'yyyy-MM-dd'),
      dateTo: formatFns(today, 'yyyy-MM-dd'),
      via: 'all',
      status: 'enabled',
    });
  };

  return (
    <Card className="mb-8">
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="filterType">Type</Label>
            <Select value={filters.type} onValueChange={(v) => handleFilterChange('type', v)}>
              <SelectTrigger id="filterType"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {transactionTypeOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
            <Label htmlFor="filterStatus">Status</Label>
            <Select value={filters.status} onValueChange={(v) => handleFilterChange('status', v)}>
              <SelectTrigger id="filterStatus"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="enabled">Enabled</SelectItem>
                <SelectItem value="disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterAccount">Account</Label>
            <Select value={filters.accountId} onValueChange={(v) => handleFilterChange('accountId', v)}>
              <SelectTrigger id="filterAccount"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
           <div className="space-y-2">
              <Label htmlFor="filterParty">Party</Label>
              <PartyCombobox
                  parties={parties}
                  value={filters.partyId}
                  onChange={(v) => handleFilterChange('partyId', v)}
              />
          </div>
           <div className="space-y-2">
            <Label htmlFor="filterVia">Via</Label>
            <Select value={filters.via} onValueChange={(v) => handleFilterChange('via', v)}>
              <SelectTrigger id="filterVia"><SelectValue/></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Profiles</SelectItem>
                {(appSettings?.businessProfiles || []).map(o => <SelectItem key={o.name} value={o.name}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterDateFrom">From</Label>
            <DatePicker 
              value={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
              onChange={(date) => handleFilterChange('dateFrom', date ? formatFns(date as Date, 'yyyy-MM-dd') : '')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filterDateTo">To</Label>
            <DatePicker 
              value={filters.dateTo ? new Date(filters.dateTo) : undefined}
              onChange={(date) => onDateToChange(date ? formatFns(date as Date, 'yyyy-MM-dd') : '')}
            />
          </div>
        </div>
         <div className="flex flex-wrap gap-2 mt-4">
            <Button variant="outline" onClick={clearFilters} className="w-full sm:w-auto">
              <X className="h-4 w-4 mr-2"/> Clear Filters
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full sm:w-auto" disabled={filteredCount === 0}>
                  <Trash2 className="h-4 w-4 mr-2"/> Disable Filtered ({filteredCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently disable {filteredCount} transaction(s) shown by the current filters. This action cannot be undone, but you can re-enable them from the Activity Log.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={onDeleteFiltered}
                    className={cn(buttonVariants({ variant: "destructive" }))}
                  >
                    Yes, disable them
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
      </CardContent>
    </Card>
  );
}
