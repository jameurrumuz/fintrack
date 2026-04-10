
'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MoreVertical, Search, Trash2, Printer, FileText, Columns, Save } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

type TableData = Record<string, string | number>;

interface PdfDataTableProps {
  initialData: TableData[];
  onSave?: (data: TableData[]) => void;
  isSaving?: boolean;
}

export function PdfDataTable({ initialData, onSave, isSaving }: PdfDataTableProps) {
  const [data, setData] = useState(initialData);
  const [headers, setHeaders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [printHeader, setPrintHeader] = useState('');
  const [printableColumns, setPrintableColumns] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setData(initialData);
    if (initialData.length > 0 && Object.keys(initialData[0]).length > 1) {
      const initialHeaders = Object.keys(initialData[0]);
      setHeaders(initialHeaders);
      const initialPrintableColumns = initialHeaders.reduce((acc, header) => {
        acc[header] = true;
        return acc;
      }, {} as Record<string, boolean>);
      setPrintableColumns(initialPrintableColumns);
    } else {
      setHeaders([]);
      setPrintableColumns({});
    }
  }, [initialData]);

  const handlePrint = () => {
    window.print();
  };

  const handleRowDelete = (rowIndex: number) => {
    const actualIndex = data.findIndex(item => item === filteredData[rowIndex]);
    if (actualIndex > -1) {
        setData((prevData) => prevData.filter((_, index) => index !== actualIndex));
    }
  };

  const handleColumnDelete = (columnKey: string) => {
    setHeaders((prevHeaders) => prevHeaders.filter((h) => h !== columnKey));
    setPrintableColumns(prev => {
        const newPrintable = {...prev};
        delete newPrintable[columnKey];
        return newPrintable;
    });
    setData((prevData) =>
      prevData.map((row) => {
        const newRow = { ...row };
        delete newRow[columnKey];
        return newRow;
      })
    );
  };
  
  const handlePrintableColumnToggle = (columnKey: string) => {
    setPrintableColumns(prev => ({ ...prev, [columnKey]: !prev[columnKey] }));
  };

  const filteredData = useMemo(() => {
    if (!searchQuery) {
      return data;
    }
    const lowercasedQuery = searchQuery.toLowerCase();
    return data.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(lowercasedQuery)
      )
    );
  }, [data, searchQuery]);

  const visiblePrintHeaders = headers.filter(h => printableColumns[h]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            placeholder="Search table..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex w-full sm:w-auto items-center gap-2">
            <div className="relative w-full flex-grow">
               <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
               <Input
                  placeholder="Set Print Header..."
                  value={printHeader}
                  onChange={(e) => setPrintHeader(e.target.value)}
                  className="pl-10"
               />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Columns className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Print Columns</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {headers.map(header => (
                  <DropdownMenuCheckboxItem
                    key={header}
                    checked={printableColumns[header]}
                    onCheckedChange={() => handlePrintableColumnToggle(header)}
                  >
                    {header}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={handlePrint} variant="outline">
               <Printer className="mr-2 h-4 w-4" />
               Print
            </Button>
            {onSave && (
              <Button onClick={() => onSave(data)} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4"/>
                {isSaving ? 'Saving...' : 'Save Ledger to Party'}
              </Button>
            )}
        </div>
      </div>
      <div id="printable-area">
        {printHeader && <h2 className="text-2xl font-bold text-center mb-4 hidden print:block">{printHeader}</h2>}
        <div className="rounded-md border max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-muted/50 bg-muted/50">
                <TableHead className="font-bold text-primary no-print w-16">ক্রমিক নং</TableHead>
                {headers.map((header) => (
                  <TableHead key={header} className={`font-bold text-primary ${!printableColumns[header] ? 'no-print' : ''}`}>
                    <div className="flex items-center justify-between group">
                      <span className="capitalize">{header.replace(/_/g, ' ')}</span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity no-print">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleColumnDelete(header)} className="text-destructive focus:text-destructive focus:bg-destructive/10">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Column
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-right font-bold text-primary no-print">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length > 0 ? (
                filteredData.map((row, rowIndex) => (
                  <TableRow key={`row-${rowIndex}`} className="transition-all hover:bg-accent/20">
                    <TableCell className="no-print font-medium p-2">{rowIndex + 1}</TableCell>
                    {headers.map((header) => (
                      <TableCell key={`${header}-${rowIndex}`} className={`print-cell p-2 ${!printableColumns[header] ? 'no-print' : ''}`}>
                        {row[header]}
                      </TableCell>
                    ))}
                    <TableCell className="text-right no-print p-2">
                      <Button variant="ghost" size="icon" onClick={() => handleRowDelete(rowIndex)} aria-label={`Delete row ${rowIndex + 1}`}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={headers.length > 0 ? headers.length + 2 : 1} className="h-24 text-center">
                    No results found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
