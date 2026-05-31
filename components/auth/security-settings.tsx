"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { updateVaultSecurity, getUserData } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { encrypt, decrypt } from "@/lib/crypto";
import { Loader2, Key, ShieldAlert } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function SecuritySettings() {
  const { user, encryptionKey } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error", text: string } | null>(null);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setMessage({ type: "error", text: "Passwords do not match" });
      return;
    }
    
    setIsUpdating(true);
    setMessage(null);
    try {
      // 1. Verify current password by trying to decrypt master key
      const userData = await getUserData(user!.username);
      if (!userData?.salt) {
         throw new Error("Security salt missing. Contact support.");
      }

      let masterKey: string;
      if (!userData.master_key_password) {
        // Upgrade Path: User registered before E2EE master key was implemented.
        // In this case, their current password IS their master key.
        masterKey = currentPassword;
      } else {
        try {
          masterKey = await decrypt(userData.master_key_password, currentPassword, userData.salt);
        } catch (err) {
          throw new Error("Incorrect current password");
        }
      }

      // 2. Re-encrypt master key with NEW password
      const newEncryptedMasterKey = await encrypt(masterKey, newPassword, userData.salt);

      // 3. Update database (hashes and encrypted keys)
      await updateVaultSecurity({
        password: newPassword,
        master_key_password: newEncryptedMasterKey
      });

      setMessage({ type: "success", text: "Password updated and vault security upgraded." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update password" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      setMessage({ type: "error", text: "PINs do not match" });
      return;
    }
    if (newPin.length !== 6) {
      setMessage({ type: "error", text: "PIN must be 6 digits" });
      return;
    }
    
    setIsUpdating(true);
    setMessage(null);
    try {
      // We need the master key to re-encrypt it with the new PIN
      // The master key is already in context if the vault is unlocked
      if (!encryptionKey) {
        throw new Error("Vault must be unlocked to change PIN");
      }

      const userData = await getUserData(user!.username);
      
      // Security Check: Verify current PIN if one exists
      if (userData?.master_key_pin) {
        try {
          const decryptedKey = await decrypt(userData.master_key_pin, currentPin, userData!.salt);
          if (decryptedKey !== encryptionKey) {
            throw new Error("Incorrect current PIN");
          }
        } catch (err) {
          throw new Error("Incorrect current PIN");
        }
      }

      const newEncryptedMasterKey = await encrypt(encryptionKey as string, newPin, userData!.salt);

      await updateVaultSecurity({
        pin: newPin,
        master_key_pin: newEncryptedMasterKey
      });

      setMessage({ type: "success", text: "PIN updated successfully" });
      setCurrentPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err: any) {
      setMessage({ type: "error", text: err.message || "Failed to update PIN" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-8 py-4">
      <AnimatePresence>
        {message && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }} 
            animate={{ opacity: 1, height: "auto" }} 
            exit={{ opacity: 0, height: 0 }}
            className={cn(
              "p-3 rounded-xl text-[10px] font-bold uppercase tracking-wider text-center border",
              message.type === "success" ? "bg-green-50 dark:bg-green-900/20 border-green-100 dark:border-green-900/30 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400"
            )}
          >
            {message.text}
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleUpdatePassword} className="space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          <Key className="h-3.5 w-3.5" /> Change Password
        </div>
        <div className="space-y-2">
          <Input type="password" placeholder="Current Password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-none h-10" required />
          <Input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-none h-10" required />
          <Input type="password" placeholder="Confirm New Password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-none h-10" required />
        </div>
        <Button type="submit" className="w-full h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest" disabled={isUpdating}>
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update Password"}
        </Button>
      </form>

      <Separator className="bg-zinc-100 dark:bg-zinc-800" />

      <form onSubmit={handleUpdatePin} className="space-y-4">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          <ShieldAlert className="h-3.5 w-3.5" /> Change PIN
        </div>
        <div className="space-y-2">
          <Input type="password" inputMode="numeric" maxLength={6} placeholder="Current 6-Digit PIN" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-none h-10 text-center tracking-[0.5em]" required />
          <Input type="password" inputMode="numeric" maxLength={6} placeholder="New 6-Digit PIN" value={newPin} onChange={(e) => setNewPin(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-none h-10 text-center tracking-[0.5em]" required />
          <Input type="password" inputMode="numeric" maxLength={6} placeholder="Confirm New PIN" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} className="bg-zinc-50 dark:bg-zinc-900 border-none h-10 text-center tracking-[0.5em]" required />
        </div>
        <Button type="submit" variant="outline" className="w-full h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest border-zinc-200 dark:border-zinc-800" disabled={isUpdating}>
          {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update PIN"}
        </Button>
      </form>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
