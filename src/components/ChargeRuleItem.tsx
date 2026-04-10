'use client';

import React from 'react';
import { UseFormReturn, Controller } from 'react-hook-form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { z } from 'zod';

// Define the schema locally to avoid circular dependencies if it were in the main page
const chargeRuleSchema = z.object({
  name: z.string().min(1, "Rule name is required"),
  type: z.enum(['expense', 'income']),
  calculation: z.enum(['fixed', 'percentage']),
  value: z.coerce.number().min(0, "Value must be non-negative"),
});

const accountSchema = z.object({
  name: z.string().min(1, 'Account name is required'),
  balance: z.coerce.number().default(0),
  chargeRules: z.array(chargeRuleSchema).optional(),
  receivingNumbers: z.array(z.object({ id: z.string(), name: z.string(), number: z.string() })).optional(),
});

export type AccountFormValues = z.infer<typeof accountSchema>;


interface ChargeRuleItemProps {
    form: UseFormReturn<AccountFormValues>;
    index: number;
    remove: (index: number) => void;
    fieldId: string;
}

const ChargeRuleItem: React.FC<ChargeRuleItemProps> = ({ form, index, remove, fieldId }) => {
    return (
        <div key={fieldId} className="grid grid-cols-1 md:grid-cols-5 gap-2 p-3 border rounded-md relative">
            {/* Rule Name */}
            <Input {...form.register(`chargeRules.${index}.name`)} placeholder="Rule Name (e.g. Send Money)" className="md:col-span-2" />
            
            {/* Rule Type Select */}
            <Controller 
                control={form.control} 
                name={`chargeRules.${index}.type`} 
                render={({field}) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="expense">Expense</SelectItem>
                            <SelectItem value="income">Income</SelectItem>
                        </SelectContent>
                    </Select>
                )} 
            />
            
            {/* Calculation Select */}
            <Controller 
                control={form.control} 
                name={`chargeRules.${index}.calculation`} 
                render={({field}) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger><SelectValue placeholder="Calculation" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="fixed">Fixed</SelectItem>
                            <SelectItem value="percentage">Percentage</SelectItem>
                        </SelectContent>
                    </Select>
                )} 
            />
            
            {/* Value Input */}
            <Input {...form.register(`chargeRules.${index}.value`)} type="number" step="0.01" placeholder="Value" />
            
            {/* Remove Button */}
            <Button type="button" variant="ghost" size="icon" className="absolute -top-3 -right-3 h-6 w-6 bg-background" onClick={() => remove(index)}>
                <X className="h-4 w-4 text-destructive"/>
            </Button>
        </div>
    );
};

export default React.memo(ChargeRuleItem);