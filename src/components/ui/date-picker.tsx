

"use client"

import * as React from "react"
import { format } from "date-fns"
import { Calendar as CalendarIcon } from "lucide-react"
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "./badge";

interface DatePickerProps {
    value?: Date | Date[];
    onChange: (date: Date | Date[] | undefined) => void;
    className?: string;
    mode?: "single" | "multiple" | "range" | "default";
    placeholder?: string;
    disableFutureDates?: boolean;
}

export function DatePicker({ value, onChange, className, mode = "single", placeholder = "Pick a date", disableFutureDates = true }: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedDate: Date | Date[] | undefined) => {
    onChange(selectedDate);
    if (mode === "single" && selectedDate) {
      setOpen(false);
    }
  };
  
  const displayValue = () => {
    if (mode === "multiple" && Array.isArray(value) && value.length > 0) {
      if (value.length > 2) {
        return `${value.length} dates selected`
      }
      return value.map(date => format(date, "dd/MM/yy")).join(', ');
    }
    if (mode === "single" && value && !Array.isArray(value)) {
        return format(value, "dd/MM/yyyy");
    }
    return <span>{placeholder}</span>;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-full justify-start text-left font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {displayValue()}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode={mode}
          selected={value as any}
          onSelect={handleSelect}
          initialFocus
          disabled={
            disableFutureDates ? (date) => date > new Date() && !isToday(date) : false
          }
        />
      </PopoverContent>
    </Popover>
  )
}


function isToday(date: Date) {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
}

