"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { login, loginWithPin, getUserData } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";
import { z } from "zod";
import { decrypt } from "@/lib/crypto";

const passwordLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const pinLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  pin: z.string().regex(/^\d{1,6}$/, "PIN must be up to 6 digits"),
});

export function LoginForm({ onForgotPassword, onRegister }: { onForgotPassword: () => void; onRegister?: () => void }) {
  const { setIsAuth, setEncryptionKey, refreshStatus } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [pin, setPin] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError("");
    try {
      const { username: validUsername, password: validPassword } = passwordLoginSchema.parse({ username, password });
      const res = await login(validUsername, validPassword);
      if (res.success) {
        if (res.unverified) {
          await refreshStatus();
          return;
        }

        // Fetch E2EE metadata
        const userData = await getUserData(validUsername);
        if (userData && userData.master_key_password && userData.salt) {
          try {
            const masterKey = await decrypt(userData.master_key_password, validPassword, userData.salt);
            setEncryptionKey(masterKey);
          } catch (err) {
            setError("Failed to decrypt vault key. Incorrect password?");
            setIsPending(false);
            return;
          }
        } else {
          // Fallback for old users
          setEncryptionKey(validPassword);
        }
        
        await refreshStatus();
        setIsAuth(true);
      } else {
        setError(res.error || "Login failed");
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

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError("");
    try {
      const { username: validUsername, pin: validPin } = pinLoginSchema.parse({ username, pin });
      const res = await loginWithPin(validUsername, validPin);
      if (res.success) {
        if (res.unverified) {
          await refreshStatus();
          return;
        }

        // Fetch E2EE metadata
        const userData = await getUserData(validUsername);
        if (userData && userData.master_key_pin && userData.salt) {
          try {
            const masterKey = await decrypt(userData.master_key_pin, validPin, userData.salt);
            setEncryptionKey(masterKey);
          } catch (err) {
            setError("Failed to decrypt vault key with PIN.");
            setIsPending(false);
            return;
          }
        } else if (userData && !userData.master_key_pin) {
           setError("No PIN set for this vault. Please use password.");
           setIsPending(false);
           return;
        } else {
          // Fallback for old users (though they didn't have PIN decryption)
          setEncryptionKey(validPin);
        }
        
        await refreshStatus();
        setIsAuth(true);
      } else {
        setError(res.error || "Login failed");
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
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-semibold tracking-tight">Welcome Back</CardTitle>
        <CardDescription>Enter your credentials to access your journal</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="bg-zinc-50 dark:bg-zinc-800/50"
            required
          />
        </div>

        <Tabs defaultValue="password" title="Login Method">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="password">Password</TabsTrigger>
            <TabsTrigger value="pin">PIN</TabsTrigger>
          </TabsList>
          <TabsContent value="password">
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-800/50"
                  required
                />
              </div>
              {error && <p className="text-xs text-red-500 text-center font-medium">{error}</p>}
              <Button type="submit" className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="pin">
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-800/50 text-center text-2xl tracking-[1em] h-14"
                  maxLength={6}
                  required
                />
              </div>
              {error && <p className="text-xs text-red-500 text-center font-medium">{error}</p>}
              <Button type="submit" className="w-full h-11 rounded-xl font-bold uppercase tracking-widest text-xs" disabled={isPending}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Unlock"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        <Button variant="link" className="w-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs" onClick={onForgotPassword}>
          Forgot credentials?
        </Button>
        <Button variant="link" className="w-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 text-xs" onClick={onRegister}>
          Don&apos;t have an account? Register
        </Button>
      </CardFooter>
    </Card>
  );
}
