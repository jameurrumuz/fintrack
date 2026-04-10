
'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Loader2, Landmark, Users } from 'lucide-react';
import type { Party, Loan } from '@/types';
import { subscribeToParties } from '@/services/partyService';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { formatAmount } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#16A34A', '#F97316']; // Green for Paid, Orange for Due

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-background/80 backdrop-blur-sm p-2 border rounded-lg shadow-lg">
        <p className="font-bold">{`${data.name}: ${formatAmount(data.value)}`}</p>
        <p className="text-sm text-muted-foreground">{`(${(payload[0].percent * 100).toFixed(2)}%)`}</p>
      </div>
    );
  }
  return null;
};

export default function LoanManagementPage() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const unsubParties = subscribeToParties(
      (data) => {
        setParties(data);
        setLoading(false);
      },
      (err) => {
        toast({ variant: 'destructive', title: 'Error', description: err.message });
        setLoading(false);
      }
    );
    return () => unsubParties();
  }, [toast]);

  const allLoans = useMemo(() => {
    const loans: (Loan & { partyId: string; partyName: string; })[] = [];
    parties.forEach(p => {
        if(p.loans && p.loans.length > 0) {
            p.loans.forEach(loan => {
                loans.push({ ...loan, partyId: p.id, partyName: p.name });
            });
        }
    });
    return loans.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [parties]);
  
  const getLoanStatus = (loan: Loan) => {
      const schedule = loan.schedule;
      if (!schedule || schedule.length === 0) return 'Disbursed';
      const isCompleted = schedule.every(emi => emi.status === 'paid');
      return isCompleted ? 'Completed' : 'Active';
  }

  const { chartData, totalPrincipal, totalInterestDue, totalRemainingDue } = useMemo(() => {
    let totalPaidPrincipal = 0;
    let totalDuePrincipal = 0;
    let interestDue = 0;
    let remainingDue = 0;

    allLoans.forEach(loan => {
      if(loan.schedule && loan.schedule.length > 0) {
        loan.schedule.forEach(emi => {
          if (emi.status === 'paid') {
            totalPaidPrincipal += emi.principal;
          } else {
            totalDuePrincipal += emi.principal;
            interestDue += emi.interest;
            remainingDue += emi.payment;
          }
        });
      } else if (getLoanStatus(loan) === 'Disbursed') {
        totalDuePrincipal += loan.principal;
        remainingDue += loan.principal;
      }
    });
    
    const principal = allLoans.reduce((sum, l) => sum + (l.principal || 0), 0);

    return {
        chartData: [
            { name: 'Paid Principal', value: totalPaidPrincipal },
            { name: 'Due Principal', value: totalDuePrincipal },
        ],
        totalPrincipal: principal,
        totalInterestDue: interestDue,
        totalRemainingDue: remainingDue,
    };
  }, [allLoans]);
  
  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <Button variant="outline" asChild><Link href="/reports">← Back to Reports</Link></Button>
      </div>
       <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl"><Landmark/> Loan Management</CardTitle>
          <CardDescription>View and manage all loan accounts.</CardDescription>
        </CardHeader>
        <CardContent>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
             <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Loan Accounts</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{allLoans.length}</p></CardContent>
             </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Principal Amount</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{formatAmount(totalPrincipal)}</p></CardContent>
             </Card>
             <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Interest Due</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-amber-600">{formatAmount(totalInterestDue)}</p></CardContent>
             </Card>
           </div>
           
           <Card>
            <CardHeader>
                <CardTitle>Loan Repayment Overview</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        outerRadius={110}
                        fill="#8884d8"
                        dataKey="value"
                    >
                        {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" />
                    </PieChart>
                </ResponsiveContainer>
                </div>
            </CardContent>
           </Card>

          <div className="rounded-md border overflow-x-auto mt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Borrower Name</TableHead>
                  <TableHead>Loan Number</TableHead>
                  <TableHead>Principal</TableHead>
                  <TableHead>Interest Rate</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Remaining Installment</TableHead>
                  <TableHead className="text-right">Remaining Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                ) : allLoans.length > 0 ? (
                  allLoans.map(loan => {
                    const remainingInstallments = loan.schedule?.filter(e => e.status !== 'paid').length || 0;
                    const remainingDue = loan.schedule?.filter(e => e.status !== 'paid').reduce((sum, e) => sum + e.payment, 0) || loan.principal;

                    return (
                        <TableRow key={loan.id}>
                          <TableCell className="font-medium">
                            <Link href={`/parties/${loan.partyId}`} className="hover:underline text-primary">
                              {loan.partyName}
                            </Link>
                          </TableCell>
                          <TableCell>#{loan.loanNumber}</TableCell>
                          <TableCell>{formatAmount(loan.principal || 0)}</TableCell>
                          <TableCell>{loan.interestRate || 0}%</TableCell>
                          <TableCell>{loan.tenure || 0} {loan.tenureUnit}</TableCell>
                          <TableCell className="text-center">{remainingInstallments}</TableCell>
                          <TableCell className="text-right font-mono">{formatAmount(remainingDue)}</TableCell>
                          <TableCell><Badge variant={getLoanStatus(loan) === 'Completed' ? 'default' : 'secondary'}>{getLoanStatus(loan)}</Badge></TableCell>
                        </TableRow>
                    )
                  })
                ) : (
                  <TableRow><TableCell colSpan={8} className="h-24 text-center">No loan accounts found.</TableCell></TableRow>
                )}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="text-right font-bold">Totals</TableCell>
                  <TableCell className="font-bold">{formatAmount(totalPrincipal)}</TableCell>
                  <TableCell colSpan={3}></TableCell>
                  <TableCell className="text-right font-bold">{formatAmount(totalRemainingDue)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
