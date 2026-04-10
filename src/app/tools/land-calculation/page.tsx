
'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Calculator, ArrowLeft, Users, PersonStanding } from 'lucide-react';
import Link from 'next/link';
import { Checkbox } from '@/components/ui/checkbox';


interface CalculationResult {
  heir: string;
  shareFraction: string;
  landAmount: number;
  totalLandForHeirs: number;
  count: number;
}

export default function LandCalculationPage() {
  const [totalLand, setTotalLand] = useState<number>(100);
  const [wives, setWives] = useState<number>(1);
  const [sons, setSons] = useState<number>(1);
  const [daughters, setDaughters] = useState<number>(1);
  const [results, setResults] = useState<CalculationResult[]>([]);
  const [remainder, setRemainder] = useState<number>(0);
  const [selectedRows, setSelectedRows] = useState<number[]>([]);


  const calculateShares = () => {
    let remainingLand = totalLand;
    const newResults: CalculationResult[] = [];
    
    const hasChildren = sons > 0 || daughters > 0;

    // 1. Wife's share
    if (wives > 0) {
      const wifeShareFraction = hasChildren ? 1 / 8 : 1 / 4;
      const wifeTotalLand = totalLand * wifeShareFraction;
      newResults.push({
        heir: `স্ত্রী (${wives} জন)`,
        shareFraction: hasChildren ? '১/৮ অংশ' : '১/৪ অংশ',
        landAmount: wifeTotalLand / wives,
        totalLandForHeirs: wifeTotalLand,
        count: wives
      });
      remainingLand -= wifeTotalLand;
    }

    // 2. Children's share
    if (hasChildren) {
        if (sons > 0) {
            // Case with sons (and possibly daughters)
            const totalParts = (sons * 2) + daughters;
            const landPerPart = remainingLand / totalParts;
            if (sons > 0) {
                newResults.push({
                    heir: `পুত্র (${sons} জন)`,
                    shareFraction: 'অবশিষ্টাংশ (প্রত্যেকে ২ অংশ)',
                    landAmount: landPerPart * 2,
                    totalLandForHeirs: landPerPart * 2 * sons,
                    count: sons
                });
            }
            if (daughters > 0) {
                newResults.push({
                    heir: `কন্যা (${daughters} জন)`,
                    shareFraction: 'অবশিষ্টাংশ (প্রত্যেকে ১ অংশ)',
                    landAmount: landPerPart,
                    totalLandForHeirs: landPerPart * daughters,
                    count: daughters
                });
            }
            setRemainder(0); // All remaining land is distributed
        } else {
            // Case with only daughters
            if (daughters === 1) {
                const daughterLand = totalLand / 2;
                newResults.push({
                    heir: `কন্যা (১ জন)`,
                    shareFraction: '১/২ অংশ',
                    landAmount: daughterLand,
                    totalLandForHeirs: daughterLand,
                    count: 1
                });
                remainingLand -= daughterLand;
            } else { // 2 or more daughters
                const daughterLand = totalLand * (2 / 3);
                 newResults.push({
                    heir: `কন্যা (${daughters} জন)`,
                    shareFraction: '২/৩ অংশ',
                    landAmount: daughterLand / daughters,
                    totalLandForHeirs: daughterLand,
                    count: daughters
                });
                remainingLand -= daughterLand;
            }
            setRemainder(remainingLand > 0.001 ? remainingLand : 0);
        }
    } else {
        // No children, wife has taken her share, rest goes to other heirs (not handled here)
        setRemainder(remainingLand > 0.001 ? remainingLand : 0);
    }

    setResults(newResults);
    setSelectedRows([]); // Reset selection on new calculation
  };
  
    const totalCalculatedLand = results.reduce((sum, res) => sum + res.totalLandForHeirs, 0);
    
    const selectedTotal = useMemo(() => {
        return selectedRows.reduce((sum, index) => {
            const result = results[index];
            if (result) {
                return sum + result.totalLandForHeirs;
            }
            return sum;
        }, 0);
    }, [selectedRows, results]);

    const handleSelectRow = (index: number) => {
        setSelectedRows(prev => {
            if (prev.includes(index)) {
                return prev.filter(i => i !== index);
            } else {
                return [...prev, index];
            }
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedRows(results.map((_, index) => index));
        } else {
            setSelectedRows([]);
        }
    };


  return (
    <div className="container mx-auto max-w-4xl py-8">
      <div className="mb-6">
        <Button variant="outline" asChild><Link href="/tools"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Tools</Link></Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><Calculator /> ফারায়েজ ক্যালকুলেটর (উত্তরাধিকার)</CardTitle>
          <CardDescription>ইসলামিক শরীয়াহ অনুযায়ী স্ত্রী, পুত্র ও কন্যার মধ্যে জমির অংশ বন্টন করুন।</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="p-4 border rounded-lg bg-muted/50">
            <h3 className="font-semibold mb-2">ইনপুট দিন</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="total-land">মোট জমির পরিমাণ (শতাংশ)</Label>
                <Input id="total-land" type="number" value={totalLand} onChange={(e) => setTotalLand(parseFloat(e.target.value) || 0)} />
              </div>
              <div></div>
              <div className="space-y-1">
                <Label htmlFor="wives"><Users className="inline h-4 w-4 mr-1"/>স্ত্রী</Label>
                <Input id="wives" type="number" value={wives} onChange={(e) => setWives(parseInt(e.target.value) || 0)} min="0" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sons"><PersonStanding className="inline h-4 w-4 mr-1"/>পুত্র</Label>
                <Input id="sons" type="number" value={sons} onChange={(e) => setSons(parseInt(e.target.value) || 0)} min="0" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="daughters"><PersonStanding className="inline h-4 w-4 mr-1"/>কন্যা</Label>
                <Input id="daughters" type="number" value={daughters} onChange={(e) => setDaughters(parseInt(e.target.value) || 0)} min="0" />
              </div>
            </div>
          </div>
           <Button onClick={calculateShares} className="w-full">হিসাব করুন</Button>

          {results.length > 0 && (
             <div className="space-y-4">
                <h3 className="font-semibold text-lg text-center">বন্টনের ফলাফল</h3>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">
                                <Checkbox
                                    checked={selectedRows.length === results.length}
                                    onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                />
                            </TableHead>
                            <TableHead>উত্তরাধিকারী</TableHead>
                            <TableHead>অংশ</TableHead>
                            <TableHead className="text-right">জমির পরিমাণ (শতাংশ)</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {results.map((res, index) => (
                            <TableRow key={index}>
                                <TableCell>
                                    <Checkbox
                                        checked={selectedRows.includes(index)}
                                        onCheckedChange={() => handleSelectRow(index)}
                                    />
                                </TableCell>
                                <TableCell className="font-medium">{res.heir}</TableCell>
                                <TableCell>{res.shareFraction}</TableCell>
                                <TableCell className="text-right font-mono">
                                    {(res.landAmount).toFixed(2)} / প্রতি জন
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                    <TableFooter>
                         {selectedRows.length > 0 && (
                             <TableRow className="bg-blue-50">
                                <TableCell colSpan={3} className="font-bold text-right text-blue-700">Selected Total:</TableCell>
                                <TableCell className="font-bold text-right font-mono text-blue-700">{selectedTotal.toFixed(2)}</TableCell>
                            </TableRow>
                         )}
                         <TableRow>
                            <TableCell colSpan={3} className="font-bold text-right">মোট বন্টিত জমি:</TableCell>
                            <TableCell className="font-bold text-right font-mono">{totalCalculatedLand.toFixed(2)}</TableCell>
                        </TableRow>
                        {remainder > 0 && (
                            <TableRow>
                                <TableCell colSpan={3} className="font-bold text-right text-amber-600">অবশিষ্ট (অন্যান্য ওয়ারিশদের জন্য):</TableCell>
                                <TableCell className="font-bold text-right font-mono text-amber-600">{remainder.toFixed(2)}</TableCell>
                            </TableRow>
                        )}
                         <TableRow>
                            <TableCell colSpan={3} className="font-bold text-right text-primary">মোট জমি:</TableCell>
                            <TableCell className="font-bold text-right font-mono text-primary">{totalLand.toFixed(2)}</TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
             </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
