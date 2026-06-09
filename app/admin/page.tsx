"use client";

import { useEffect, useState } from "react";
import { getAdminData, toggleUserBan, createInvite, broadcastEmail } from "@/lib/actions/admin";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ChevronLeft, Zap, Users, ShieldCheck, Mail, UserPlus, Ban, CheckCircle } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  role: string;
  ai_credits: number;
  last_ai_usage_date: string | null;
  is_banned: boolean;
  created_at: string;
}

export default function AdminPage() {
  const [data, setData] = useState<{ stats: any, users: AdminUser[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [broadcastSubject, setBroadcastSubject] = useState("");
  const [broadcastContent, setBroadcastContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      const res = await getAdminData();
      setData(res as any);
    } catch (err: any) {
      setError(err.message || "Failed to load admin data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const handleBanToggle = async (userId: number, currentStatus: boolean) => {
    try {
      await toggleUserBan(userId, !currentStatus);
      toast.success(currentStatus ? "User unbanned" : "User banned");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to toggle ban status");
    }
  };

  const handleInvite = async () => {
    if (!inviteEmail || !inviteName) return toast.error("Please provide name and email");
    try {
      setIsSending(true);
      await createInvite(inviteEmail, inviteName);
      toast.success("Invite sent successfully!");
      setInviteEmail("");
      setInviteName("");
      loadData();
    } catch (e: any) {
      toast.error(e.message || "Failed to send invite");
    } finally {
      setIsSending(false);
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastSubject || !broadcastContent) return toast.error("Please provide subject and content");
    try {
      setIsSending(true);
      await broadcastEmail('all', broadcastSubject, broadcastContent);
      toast.success("Broadcast sent successfully!");
      setBroadcastSubject("");
      setBroadcastContent("");
    } catch (e: any) {
      toast.error(e.message || "Failed to send broadcast");
    } finally {
      setIsSending(false);
    }
  };

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
          <div className="flex gap-2">
            <Dialog>
              <DialogTrigger className={cn(buttonVariants({ variant: "outline" }), "gap-2")}>
                  <UserPlus className="h-4 w-4" /> Invite User
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Send Invitation</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Input placeholder="Name" value={inviteName} onChange={e => setInviteName(e.target.value)} />
                  <Input placeholder="Email Address" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
                  <Button onClick={handleInvite} disabled={isSending}>
                    {isSending ? "Sending..." : "Send Invite Link"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger className={cn(buttonVariants(), "gap-2 bg-blue-600 hover:bg-blue-700 text-white")}>
                  <Mail className="h-4 w-4" /> Broadcast
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Send Broadcast Email</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <Input placeholder="Subject" value={broadcastSubject} onChange={e => setBroadcastSubject(e.target.value)} />
                  <Textarea 
                    placeholder="HTML Content (e.g. <p>Hello everyone...</p>)" 
                    className="min-h-[200px]"
                    value={broadcastContent} 
                    onChange={e => setBroadcastContent(e.target.value)} 
                  />
                  <p className="text-xs text-zinc-500">Will be sent to all non-banned users.</p>
                  <Button onClick={handleBroadcast} disabled={isSending} className="bg-blue-600 hover:bg-blue-700 text-white">
                    {isSending ? "Sending..." : "Send to All Users"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Total AI Tokens Generated</CardDescription>
              <CardTitle className="text-3xl font-bold flex items-center gap-3">
                <Zap className="h-5 w-5 text-amber-500" />
                {data.stats.total_tokens?.toLocaleString() || 0}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50">
          <CardHeader>
            <CardTitle>User Directory</CardTitle>
            <CardDescription>Manage, monitor, and ban users</CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-zinc-400 text-left">
                    <th className="py-3 font-medium">Username</th>
                    <th className="py-3 font-medium">Email</th>
                    <th className="py-3 font-medium">Role</th>
                    <th className="py-3 font-medium">Status</th>
                    <th className="py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.users.map((u) => (
                    <tr key={u.id} className="border-b border-zinc-50 dark:border-zinc-900/50 last:border-0">
                      <td className="py-4 font-semibold">{u.username.includes('INVITED') ? "Pending Invite" : u.username}</td>
                      <td className="py-4 text-zinc-500">{u.email || "No email"}</td>
                      <td className="py-4">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-zinc-900 text-zinc-50 dark:bg-white dark:text-zinc-950' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-4">
                        {u.is_banned ? (
                          <span className="flex items-center gap-1 text-red-500 font-medium text-xs"><Ban className="h-3 w-3"/> Banned</span>
                        ) : (
                          <span className="flex items-center gap-1 text-green-500 font-medium text-xs"><CheckCircle className="h-3 w-3"/> Active</span>
                        )}
                      </td>
                      <td className="py-4 text-right">
                        {u.role !== 'admin' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className={`h-8 text-xs ${u.is_banned ? 'text-green-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950' : 'text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950'}`}
                            onClick={() => handleBanToggle(u.id, u.is_banned)}
                          >
                            {u.is_banned ? "Unban" : "Ban User"}
                          </Button>
                        )}
                      </td>
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
