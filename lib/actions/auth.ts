"use server";
import { createUser, userExists, emailExists, verifyPassword, verifyPin, getUserByUsername as getDbUserByUsername, verifyRecoveryKey, verifySecretAnswer, updatePassword, updatePin } from "@/lib/auth";
import { getCache, setCache, deleteCache } from "@/lib/redis";

export async function getUserByUsername(username: string) {
  const cacheKey = `user:username:${username}`;
  const cached = await getCache<any>(cacheKey);
  if (cached) return cached;
  
  const user = await getDbUserByUsername(username);
  if (user) await setCache(cacheKey, user, 3600);
  return user;
}

export async function changePassword(oldPassword: string, newPassword: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const isValid = await verifyPassword(session.username, oldPassword);
  if (!isValid) return { success: false, error: "Incorrect current password" };

  const user = await getUserByUsername(session.username);
  const { encrypt } = await import("@/lib/crypto");

  // We need to re-encrypt the master key with the new password
  // This requires the master key to be in context, but since this is a server action,
  // the client must provide it. Actually, a better way is to send the encrypted master key
  // to the client, have them decrypt with old password and re-encrypt with new.
  // But for simplicity and security, we'll follow the pattern where the client handles encryption.
  return { success: true }; // Client-side will handle the heavy lifting
}

export async function updateVaultSecurity(data: { 
  password?: string, 
  pin?: string, 
  master_key_password?: string, 
  master_key_pin?: string 
}) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  if (data.password) {
    await updatePassword(session.username, data.password);
  }

  if (data.pin) {
    await updatePin(session.username, data.pin);
  }

  if (data.master_key_password) {
    await db.execute({
      sql: "UPDATE users SET master_key_password = ? WHERE id = ?",
      args: [data.master_key_password, session.userId]
    });
  }

  if (data.master_key_pin) {
    await db.execute({
      sql: "UPDATE users SET master_key_pin = ? WHERE id = ?",
      args: [data.master_key_pin, session.userId]
    });
  }

  await deleteCache(`user:username:${session.username}`);
  return { success: true };
}
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import nodemailer from "nodemailer";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const SESSION_COOKIE = "dainiki_session";

export async function checkUserExists() {
  // Now we check if ANY user exists to determine if it's a fresh install
  // though for multi-user, we mostly care about individual users
  return false; // For multi-user, we don't need this global check as much
}

export async function register(data: { 
  username: string; 
  email: string; 
  password: string; 
  pin: string; 
  secretQuestion?: string; 
  secretAnswer?: string;
  encryptionSalt?: string;
  master_key_password?: string;
  master_key_pin?: string;
}) {
  if (await userExists(data.username)) {
    throw new Error("Username already taken");
  }

  if (await emailExists(data.email)) {
    throw new Error("Email already registered with another vault");
  }

  const { id, recoveryKey, otpCode } = await createUser(data);

  // Send Email via Nodemailer SMTP
  const emailUser = process.env.EMAIL_USER; // Your Gmail
  const emailPass = process.env.EMAIL_PASS; // Your App Password

  if (emailUser && emailPass) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: emailUser,
        pass: emailPass,
      },
    });

    try {
      await transporter.sendMail({
        from: `"Dainiki" <${emailUser}>`,
        to: data.email,
        subject: "Verify your Dainiki account",
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px; color: #18181b; border: 1px solid #e4e4e7; border-radius: 24px;">
            <h1 style="font-size: 24px; font-weight: bold; margin-bottom: 24px;">Welcome to Dainiki</h1>
            <p style="font-size: 16px; margin-bottom: 24px;">Your verification code is:</p>
            <div style="background-color: #f4f4f5; padding: 24px; border-radius: 12px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 0.5em; color: #09090b;">
              ${otpCode}
            </div>
            <p style="font-size: 12px; color: #71717a; margin-top: 32px;">If you didn't create an account, you can ignore this email.</p>
          </div>
        `
      });
      console.log(`[AUTH] Email sent successfully to ${data.email}`);
    } catch (e) {
      console.error("Nodemailer email error:", e);
    }
  }

  // LOGGING OTP for development
  console.log(`[AUTH] Verification OTP for ${data.username}: ${otpCode}`);

  return { recoveryKey, otpCode };
}


export async function verifyOtp(username: string, code: string) {
  const user = await getUserByUsername(username);
  if (!user) throw new Error("User not found");

  if (user.otp_code === code) {
    await db.execute({
      sql: "UPDATE users SET is_verified = 1, otp_code = NULL WHERE id = ?",
      args: [user.id]
    });
    
    // Auto login after verification
    (await cookies()).set(SESSION_COOKIE, JSON.stringify({ userId: Number(user.id), username: user.username, isVerified: true }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7
    });
    
    return { success: true };
    }
    return { success: false, error: "Invalid verification code" };
    }

    export async function acceptInvite(token: string, data: { 
    username: string; 
    password: string; 
    pin: string; 
    secretQuestion?: string; 
    secretAnswer?: string;
    encryptionSalt?: string;
    master_key_password?: string;
    master_key_pin?: string;
    }) {
    const result = await db.execute({
      sql: "SELECT id, email FROM users WHERE invite_token = ? AND invite_expires > CURRENT_TIMESTAMP",
      args: [token]
    });

    const user = result.rows[0];
    if (!user) {
      throw new Error("Invalid or expired invite token");
    }

    if (await userExists(data.username) && data.username.toLowerCase() !== (user.username as string)?.toLowerCase()) {
       throw new Error("Username already taken");
    }

    const passwordHash = bcrypt.hashSync(data.password, 10);
    const pinHash = data.pin ? bcrypt.hashSync(data.pin, 10) : null;
    const secretAnswerHash = data.secretAnswer ? bcrypt.hashSync(data.secretAnswer, 10) : null;
    const recoveryKey = crypto.randomBytes(16).toString("hex");

    await db.execute({
      sql: `UPDATE users SET 
        username = ?, password_hash = ?, pin_hash = ?, recovery_key = ?, 
        secret_question = ?, secret_answer_hash = ?, encryption_salt = ?, 
        master_key_password = ?, master_key_pin = ?, is_verified = 1, 
        invite_token = NULL, invite_expires = NULL
        WHERE id = ?`,
      args: [
        data.username,
        passwordHash,
        pinHash,
        recoveryKey,
        data.secretQuestion || null,
        secretAnswerHash,
        data.encryptionSalt || null,
        data.master_key_password || null,
        data.master_key_pin || null,
        user.id
        ]
    });

    // Auto login
    (await cookies()).set(SESSION_COOKIE, JSON.stringify({ userId: Number(user.id), username: data.username, isVerified: true }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7
    });

    return { recoveryKey };
    }

export async function login(username: string, password: string) {
  const isValid = await verifyPassword(username, password);
  if (isValid) {
    const user = await getUserByUsername(username);
    const isVerified = Boolean(user.is_verified);
    
    (await cookies()).set(SESSION_COOKIE, JSON.stringify({ userId: Number(user.id), username: user.username, isVerified }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7
    });

    if (!isVerified) {
      return { success: true, unverified: true, username: user.username };
    }
    return { success: true };
  }
  return { success: false, error: "Invalid username or password" };
}

export async function loginWithPin(username: string, pin: string) {
  const isValid = await verifyPin(username, pin);
  if (isValid) {
    const user = await getUserByUsername(username);
    const isVerified = Boolean(user.is_verified);

    (await cookies()).set(SESSION_COOKIE, JSON.stringify({ userId: Number(user.id), username: user.username, isVerified }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7
    });

    if (!isVerified) {
      return { success: true, unverified: true, username: user.username };
    }
    return { success: true };
  }
  return { success: false, error: "Invalid PIN" };
}

export async function getSession() {
  const session = (await cookies()).get(SESSION_COOKIE);
  if (!session?.value) return null;
  try {
    return JSON.parse(session.value) as { userId: number; username: string; isVerified?: boolean };
  } catch (e) {
    return null;
  }
}

export async function isAuthenticated() {
  const session = await getSession();
  return session !== null;
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getUserData(username: string) {
  const user = await getUserByUsername(username);
  if (!user) return null;

  const today = new Date().toISOString().split('T')[0];
  let credits = Number(user.ai_credits);

  if (user.last_ai_usage_date !== today) {
    credits = 10;
    await db.execute({
      sql: "UPDATE users SET ai_credits = ?, last_ai_usage_date = ? WHERE id = ?",
      args: [credits, today, user.id]
    });
  }

  return {
    salt: user.encryption_salt,
    credits: credits,
    role: user.role,
    settings: user.settings,
    master_key_password: user.master_key_password,
    master_key_pin: user.master_key_pin
  };
}

export async function getSecretQuestion(username: string) {
  const user = await getUserByUsername(username);
  return user?.secret_question || null;
}

export async function recoverWithKey(username: string, key: string, newPassword: string) {
  const isValid = await verifyRecoveryKey(username, key);
  if (isValid) {
    await updatePassword(username, newPassword);
    return { success: true };
  }
  return { success: false, error: "Invalid recovery key" };
}

export async function recoverWithAnswer(username: string, answer: string, newPassword: string) {
  const isValid = await verifySecretAnswer(username, answer);
  if (isValid) {
    await updatePassword(username, newPassword);
    return { success: true };
  }
  return { success: false, error: "Invalid secret answer" };
}

export async function deductAiCredit() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const user = await getUserByUsername(session.username);
  if (!user) throw new Error("User not found");

  const today = new Date().toISOString().split('T')[0];
  let credits = user.ai_credits;

  // Reset credits if it's a new day
  if (user.last_ai_usage_date !== today) {
    credits = 10;
  }

  if (credits <= 0) {
    return { success: false, error: "Daily AI limit reached (10 credits)" };
  }

  // Deduct credit
  await db.execute({
    sql: "UPDATE users SET ai_credits = ?, last_ai_usage_date = ? WHERE id = ?",
    args: [credits - 1, today, user.id]
  });

  await deleteCache(`user:username:${session.username}`);
  return { success: true, remaining: credits - 1 };
}

import { scheduleReminder } from "@/lib/reminders";

export async function updateSettings(settings: any) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const user = await getUserByUsername(session.username);
  const currentSettings = JSON.parse(user.settings || '{}');
  const mergedSettings = { ...currentSettings, ...settings };

  // If they updated reminders or timezone, sync with QStash
  if (settings.reminders !== undefined || settings.timezone !== undefined) {
    if (mergedSettings.reminders?.enabled && mergedSettings.reminders?.time) {
      const scheduleId = await scheduleReminder(
        session.userId,
        mergedSettings.reminders.enabled,
        mergedSettings.reminders.time,
        mergedSettings.timezone || "UTC",
        mergedSettings.qstashScheduleId
      );
      mergedSettings.qstashScheduleId = scheduleId;
    } else if (mergedSettings.qstashScheduleId) {
      // If disabled, just delete the schedule
      await scheduleReminder(
        session.userId,
        false,
        "",
        mergedSettings.timezone || "UTC",
        mergedSettings.qstashScheduleId
      );
      mergedSettings.qstashScheduleId = null;
    }
  }

  await db.execute({
    sql: "UPDATE users SET settings = ? WHERE id = ?",
    args: [JSON.stringify(mergedSettings), session.userId]
  });

  await deleteCache(`user:username:${session.username}`);
  return { success: true };
}

export async function updatePersonalityProfile(profile: string) {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const user = await getUserByUsername(session.username);
  const currentSettings = JSON.parse(user.settings || '{}');
  currentSettings.personalityProfile = profile;

  await db.execute({
    sql: "UPDATE users SET settings = ? WHERE id = ?",
    args: [JSON.stringify(currentSettings), session.userId]
  });

  await deleteCache(`user:username:${session.username}`);
  return { success: true };
}

export async function getAiUsage() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");

  const user = await getUserByUsername(session.username);
  if (!user || user.role !== 'admin') throw new Error("Unauthorized");

  const result = await db.execute(`
    SELECT COUNT(*) as total_users, SUM(10 - ai_credits) as total_credits_used 
    FROM users 
    WHERE last_ai_usage_date = CURRENT_DATE
  `);
  
  const allUsers = await db.execute("SELECT id, username, ai_credits, last_ai_usage_date, role FROM users");

  return {
    stats: result.rows[0],
    users: allUsers.rows.map(u => ({
      ...u,
      id: Number(u.id),
      ai_credits: Number(u.ai_credits)
    }))
  };
}
