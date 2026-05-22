"use client";

import { useEffect, useState } from "react";
import { getSecretQuestion, recoverWithAnswer, recoverWithKey } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { z } from "zod";

const keyRecoverySchema = z.object({
  username: z.string().min(1, "Username is required"),
  recoveryKey: z.string().min(1, "Recovery key is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

const answerRecoverySchema = z.object({
  username: z.string().min(1, "Username is required"),
  answer: z.string().min(1, "Answer is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string()
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export function RecoveryForm({ onBack }: { onBack: () => void }) {
  const { setIsAuth } = useAuth();
  const [username, setUsername] = useState("");
  const [question, setQuestion] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    recoveryKey: "",
    answer: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const handleFetchQuestion = async () => {
    if (!username) return;
    const q = await getSecretQuestion(username);
    setQuestion(q);
    if (!q) setError("No secret question found for this user");
  };

  const handleKeyRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError("");
    try {
      const valid = keyRecoverySchema.parse({ ...formData, username });
      const res = await recoverWithKey(valid.username, valid.recoveryKey, valid.newPassword);
      if (res.success) {
        setIsAuth(true);
      } else {
        setError(res.error || "Recovery failed");
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || "An error occurred");
      }
    }
    setIsPending(false);
  };

  const handleAnswerRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError("");
    try {
      const valid = answerRecoverySchema.parse({ ...formData, username });
      const res = await recoverWithAnswer(valid.username, valid.answer, valid.newPassword);
      if (res.success) {
        setIsAuth(true);
      } else {
        setError(res.error || "Recovery failed");
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || "An error occurred");
      }
    }
    setIsPending(false);
  };

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-900/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-xl font-semibold">Recovery</CardTitle>
        </div>
        <CardDescription>Reset your password to regain access</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Input
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onBlur={handleFetchQuestion}
            className="bg-zinc-50 dark:bg-zinc-800/50"
            required
          />
        </div>

        <Tabs defaultValue="key" title="Recovery Method">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="key">Key</TabsTrigger>
            <TabsTrigger value="question" disabled={!question}>Question</TabsTrigger>
          </TabsList>
          <TabsContent value="key">
            <form onSubmit={handleKeyRecovery} className="space-y-4">
              <Input
                type="text"
                placeholder="Recovery Key"
                value={formData.recoveryKey}
                onChange={(e) => setFormData({ ...formData, recoveryKey: e.target.value })}
                className="bg-zinc-50 dark:bg-zinc-800/50"
                required
              />
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="password"
                  placeholder="New Password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-800/50"
                  required
                />
                <Input
                  type="password"
                  placeholder="Confirm"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-800/50"
                  required
                />
              </div>
              {error && <p className="text-xs text-red-500 text-center font-medium">{error}</p>}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset & Unlock"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="question">
            <form onSubmit={handleAnswerRecovery} className="space-y-4">
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Security Question</p>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">{question}</p>
                <Input
                  type="text"
                  placeholder="Your Answer"
                  value={formData.answer}
                  onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-800/50"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  type="password"
                  placeholder="New Password"
                  value={formData.newPassword}
                  onChange={(e) => setFormData({ ...formData, newPassword: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-800/50"
                  required
                />
                <Input
                  type="password"
                  placeholder="Confirm"
                  value={formData.confirmPassword}
                  onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                  className="bg-zinc-50 dark:bg-zinc-800/50"
                  required
                />
              </div>
              {error && <p className="text-xs text-red-500 text-center font-medium">{error}</p>}
              <Button type="submit" className="w-full" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset & Unlock"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}