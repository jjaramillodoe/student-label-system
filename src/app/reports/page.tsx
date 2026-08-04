'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Download, FileText, TrendingUp, Users, Printer, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import jsPDF from 'jspdf';
import { downloadCsvFile, objectsToCsv } from '@/lib/csv';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

export default function ReportsPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState<any>(null);
  const [groupBy, setGroupBy] = useState('day');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      fetchReports();
    }
  }, [status, groupBy, startDate, endDate]);

  async function fetchReports() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('groupBy', groupBy);

      const res = await fetch(`/api/print-reports?${params.toString()}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to fetch reports' }));
        throw new Error(errorData.error || `Server error: ${res.status}`);
      }
      
      const data = await res.json();
      
      // Ensure data structure is correct
      if (!data.summary) {
        data.summary = { totalPrints: 0, totalLabels: 0, uniqueStudentCount: 0, uniqueUserCount: 0 };
      }
      if (!data.data) {
        data.data = [];
      }
      
      setReportData(data);
    } catch (error: any) {
      console.error('Failed to fetch reports:', error);
      setReportData({
        summary: { totalPrints: 0, totalLabels: 0, uniqueStudentCount: 0, uniqueUserCount: 0 },
        data: [],
        error: error.message || 'Failed to fetch reports'
      });
    } finally {
      setLoading(false);
    }
  }

  function exportToPDF() {
    if (!reportData) return;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Print Reports', 14, 22);
    
    doc.setFontSize(12);
    let y = 35;
    doc.text(`Total Prints: ${reportData.summary.totalPrints}`, 14, y);
    y += 7;
    doc.text(`Total Labels: ${reportData.summary.totalLabels}`, 14, y);
    y += 7;
    doc.text(`Unique Students: ${reportData.summary.uniqueStudentCount}`, 14, y);
    y += 7;
    doc.text(`Unique Users: ${reportData.summary.uniqueUserCount}`, 14, y);

    doc.save(`print-reports-${new Date().toISOString().split('T')[0]}.pdf`);
  }

  function exportToCsv() {
    if (!reportData) return;
    downloadCsvFile(`print-reports-${new Date().toISOString().split('T')[0]}.csv`, objectsToCsv(reportData.data));
  }

  if (status === 'loading') {
    return (
      <div className="w-full p-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full p-6 space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link href="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
          <h1 className="text-3xl font-bold text-foreground">Print Reports & Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Analyze print activity, trends, and statistics
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToPDF} variant="outline" className="gap-2" disabled={!reportData}>
            <Download className="h-4 w-4" />
            Export PDF
          </Button>
          <Button onClick={exportToCsv} variant="outline" className="gap-2" disabled={!reportData}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <Separator />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Group By</Label>
              <Select value={groupBy} onValueChange={setGroupBy}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="student">Student</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchReports} className="w-full">
                Refresh
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : reportData ? (
        <>
          {reportData.error && (
            <Card className="border-destructive">
              <CardContent className="pt-6">
                <p className="text-destructive">{reportData.error}</p>
              </CardContent>
            </Card>
          )}
          
          {/* Summary Cards - Always show */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Prints</CardTitle>
                <Printer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.summary.totalPrints}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Labels</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.summary.totalLabels}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Unique Students</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.summary.uniqueStudentCount}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{reportData.summary.uniqueUserCount}</div>
              </CardContent>
            </Card>
          </div>

          {/* Empty State Message */}
          {reportData.data && reportData.data.length === 0 && !reportData.error && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8 text-muted-foreground">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium text-foreground">No print data found</p>
                  <p className="text-sm mt-1">Try adjusting your date range or print some labels first</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Charts - Only show if there's data */}
          {reportData.data && reportData.data.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Print Trends Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Print Trends</CardTitle>
                <CardDescription>Print activity over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  {groupBy === 'day' || groupBy === 'week' || groupBy === 'month' ? (
                    <LineChart data={reportData.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey={groupBy === 'day' ? 'date' : groupBy === 'week' ? 'week' : 'month'}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="count" stroke="#8884d8" name="Print Jobs" />
                      <Line type="monotone" dataKey="totalLabels" stroke="#82ca9d" name="Total Labels" />
                    </LineChart>
                  ) : (
                    <BarChart data={reportData.data}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey={groupBy === 'user' ? 'userEmail' : 'studentId'}
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="count" fill="#8884d8" name="Print Count" />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>
                  {groupBy === 'user' ? 'Print Distribution by User' : 
                   groupBy === 'student' ? 'Most Printed Students' : 
                   'Print Distribution'}
                </CardTitle>
                <CardDescription>
                  {groupBy === 'user' ? 'Who prints the most' : 
                   groupBy === 'student' ? 'Students with most prints' : 
                   'Distribution breakdown'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={reportData.data.slice(0, 6).map((item: any) => {
                        const name = groupBy === 'day' ? item.date : 
                                    groupBy === 'week' ? item.week : 
                                    groupBy === 'month' ? item.month : 
                                    groupBy === 'user' ? (item.userName || item.userEmail) : 
                                    (item.studentName || item.studentId);
                        return {
                          name: name || 'Unknown',
                          value: item.count
                        };
                      })}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {reportData.data.slice(0, 6).map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          )}

          {/* Data Table - Only show if there's data */}
          {reportData.data && reportData.data.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Detailed Data</CardTitle>
              <CardDescription>Raw data for the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="p-2 text-left">{groupBy === 'day' ? 'Date' : groupBy === 'week' ? 'Week' : groupBy === 'month' ? 'Month' : groupBy === 'user' ? 'User' : 'Student'}</th>
                      <th className="p-2 text-right">Print Count</th>
                      <th className="p-2 text-right">Total Labels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.data.map((item: any, idx: number) => {
                      const key = groupBy === 'day' ? item.date : 
                                  groupBy === 'week' ? item.week : 
                                  groupBy === 'month' ? item.month : 
                                  groupBy === 'user' ? (item.userEmail || item.userName) : 
                                  (item.studentId || item.studentName);
                      return (
                        <tr key={idx} className="border-b">
                          <td className="p-2">{key || '-'}</td>
                          <td className="p-2 text-right">{item.count}</td>
                          <td className="p-2 text-right">{item.totalLabels || '-'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
          )}
        </>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="font-medium text-foreground">No data available</p>
              <p className="text-sm mt-1">Click Refresh to load reports</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

