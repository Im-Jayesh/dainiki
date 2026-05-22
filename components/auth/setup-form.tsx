"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck, Key, Copy, Check } from "lucide-react";
import { register, verifyOtp } from "@/lib/actions/auth";
import { z } from "zod";
import { encrypt } from "@/lib/crypto";

const setupSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(20, "Username must be at most 20 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string(),
  pin: z.string().regex(/^\d{0,6}$/, "PIN must be up to 6 digits").optional(),
  secretQuestion: z.string().optional(),
  secretAnswer: z.string().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"]
});

export function SetupForm({ onSwitchToLogin, initialStep = 1, initialUsername = "" }: { onSwitchToLogin?: () => void; initialStep?: 1 | 2 | 3; initialUsername?: string }) {
  const { refreshStatus, setEncryptionKey } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(initialStep); // 1: Info, 2: OTP, 3: Success
  const [formData, setFormData] = useState({
    username: initialUsername,
    email: "",
    password: "",
    confirmPassword: "",
    pin: "",
    secretQuestion: "",
    secretAnswer: ""
  });
  const [recoveryKey, setRecoveryKey] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [copied, setCopied] = useState(false);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError("");
    try {
      const validatedData = setupSchema.parse(formData);
      
      // E2EE Setup: Generate Client-side Master Key and Salt
      const encryptionSalt = Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      const masterKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Encrypt Master Key with Password
      const masterKeyPassword = await encrypt(masterKey, validatedData.password, encryptionSalt);
      
      // Encrypt Master Key with PIN (if provided)
      let masterKeyPin = undefined;
      if (validatedData.pin && validatedData.pin.trim()) {
        masterKeyPin = await encrypt(masterKey, validatedData.pin, encryptionSalt);
      }

      const res = await register({
        ...validatedData,
        encryptionSalt,
        master_key_password: masterKeyPassword,
        master_key_pin: masterKeyPin
      });
      
      setRecoveryKey(res.recoveryKey);
      setEncryptionKey(masterKey); // Use the raw master key for the session
      
      setStep(2);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError(err.issues[0].message);
      } else {
        setError(err.message || "Setup failed");
      }
    } finally {
      setIsPending(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError("");
    try {
      const res = await verifyOtp(formData.username, otpCode);
      if (res.success) {
        setStep(3);
      } else {
        setError(res.error || "Verification failed");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setIsPending(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(recoveryKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (step === 3) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-900/50 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
            <ShieldCheck className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Account Verified</CardTitle>
          <CardDescription>Your personal vault is now fully unlocked</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs" onClick={() => refreshStatus()}>
            Enter Your Vault
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (step === 2) {
    return (
      <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-900/50 backdrop-blur-sm text-center">
        <CardHeader>
          <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
          <CardDescription>We&apos;ve sent a verification code to {formData.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="text"
                placeholder="6-digit code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-800/50 text-center text-2xl tracking-[0.5em] h-14"
                maxLength={6}
                required
              />
              <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-widest text-center mt-2">Verify your account to proceed</p>
            </div>
            {error && <p className="text-xs text-red-500 font-medium">{error}</p>}
            <Button type="submit" className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs" disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify & Unlock"}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
           <div className="p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 w-full text-left space-y-3">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
              <Key className="h-3 w-3" /> Save Recovery Key
            </div>
            <div className="flex gap-2">
              <code className="flex-1 bg-white dark:bg-black p-3 rounded-xl text-[10px] font-mono break-all border border-zinc-200 dark:border-zinc-800">
                {recoveryKey}
              </code>
              <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl shrink-0" onClick={copyToClipboard}>
                {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="border-zinc-200 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-900/50 backdrop-blur-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold tracking-tight">Create Account</CardTitle>
        <CardDescription>Join Dainiki and start your private journal</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSetup} className="space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="text"
                placeholder="Username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="bg-zinc-50 dark:bg-zinc-800/50"
                required
              />
              <Input
                type="email"
                placeholder="Email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="bg-zinc-50 dark:bg-zinc-800/50"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="password"
                placeholder="Password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
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
            <Input
              type="text"
              placeholder="PIN (6 digits, optional)"
              value={formData.pin}
              onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
              className="bg-zinc-50 dark:bg-zinc-800/50"
              maxLength={6}
            />
            <div className="space-y-4 pt-2">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Recovery Question</p>
              <Input
                type="text"
                placeholder="e.g., What was your first pet's name?"
                value={formData.secretQuestion}
                onChange={(e) => setFormData({ ...formData, secretQuestion: e.target.value })}
                className="bg-zinc-50 dark:bg-zinc-800/50"
              />
              <Input
                type="text"
                placeholder="Your Answer"
                value={formData.secretAnswer}
                onChange={(e) => setFormData({ ...formData, secretAnswer: e.target.value })}
                className="bg-zinc-50 dark:bg-zinc-800/50"
              />
            </div>
          </div>
          {error && <p className="text-xs text-red-500 text-center font-medium">{error}</p>}
          <Button type="submit" className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs" disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Account"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <Button variant="link" className="w-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs" onClick={onSwitchToLogin}>
          Already have an account? Login
        </Button>
      </CardFooter>
    </Card>
  );
}
