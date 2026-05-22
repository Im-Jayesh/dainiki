"use client";

import { useEffect, useState } from "react";
import { getAiUsage } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Zap, Users, BarChart3, ShieldCheck } from "lucide-react";
import Link from "next/link";

interface AdminData {
  stats: {
    total_users: number;
    total_credits_used: number;
  };
  users: Array<{
    id: number;
    username: string;
    ai_credits: number;
    last_ai_usage_date: string | null;
    role: string;
  }>;
}

export default function AdminPage() {
  const [data, setData] = useState<AdminData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const usage = await getAiUsage();
        setData(usage as unknown as AdminData);
      } catch (err: any) {
        setError(err.message || "Failed to load admin data");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  if (error || !data) return <div className="flex h-screen items-center justify-center text-red-500">{error || "Unauthorized"}</div>;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-1.5">
                <ShieldCheck className="h-3 w-3 text-zinc-900 dark:text-zinc-100" /> System Control
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Total Users</CardDescription>
              <CardTitle className="text-3xl font-bold flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-500" />
                {data.stats.total_users || 0}
              </CardTitle>
            </CardHeader>
          </Card>
          
          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">AI Requests (Today)</CardDescription>
              <CardTitle className="text-3xl font-bold flex items-center gap-3">
                <Zap className="h-5 w-5 text-amber-500" />
                {data.stats.total_credits_used || 0}
              </CardTitle>
            </CardHeader>
          </Card>

          <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
            <CardHeader className="pb-2">
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Avg Requests/User</CardDescription>
              <CardTitle className="text-3xl font-bold flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-green-500" />
                {data.stats.total_users ? (data.stats.total_credits_used / data.stats.total_users).toFixed(1) : 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <CardHeader>
            <CardTitle>User Directory</CardTitle>
            <CardDescription>Manage and monitor all dainiki users</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 text-left">
                    <th className="py-3 font-medium">Username</th>
                    <th className="py-3 font-medium">Role</th>
                    <th className="py-3 font-medium">Remaining AI</th>
                    <th className="py-3 font-medium">Last Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-50 dark:border-zinc-900/50 last:border-0">
                      <td className="py-4 font-semibold">{u.username}</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-zinc-900 text-zinc-50 dark:bg-white dark:text-zinc-950' : 'bg-zinc-100 dark:bg-zinc-800'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4">{u.ai_credits} / 10</td>
                      <td className="py-4 text-zinc-500">{u.last_ai_usage_date || "Never"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
