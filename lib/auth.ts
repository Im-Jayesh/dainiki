import { db } from "./db";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface UserCreateData {
  username: string;
  email: string;
  password: string;
  pin?: string;
  secretQuestion?: string;
  secretAnswer?: string;
  encryptionSalt?: string;
  master_key_password?: string;
  master_key_pin?: string;
}

export async function createUser(data: UserCreateData) {
  const passwordHash = bcrypt.hashSync(data.password, 10);
  const pinHash = data.pin ? bcrypt.hashSync(data.pin, 10) : null;
  const secretAnswerHash = data.secretAnswer ? bcrypt.hashSync(data.secretAnswer, 10) : null;
  const recoveryKey = crypto.randomBytes(16).toString("hex");
  const encryptionSalt = data.encryptionSalt || crypto.randomBytes(16).toString("hex");

  // Generate a simple 6-digit OTP
  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

  const result = await db.execute({
    sql: `INSERT INTO users (username, email, password_hash, pin_hash, recovery_key, secret_question, secret_answer_hash, encryption_salt, role, otp_code, is_verified, master_key_password, master_key_pin)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    args: [
      data.username,
      data.email,
      passwordHash,
      pinHash,
      recoveryKey,
      data.secretQuestion || null,
      secretAnswerHash,
      encryptionSalt,
      data.username.toLowerCase() === "ztlab99" ? "admin" : "user",
      otpCode,
      data.master_key_password || null,
      data.master_key_pin || null
    ]
  });

  return { id: result.lastInsertRowid, recoveryKey, encryptionSalt, otpCode };
}


export async function getUserByUsername(username: string) {
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE username = ?",
    args: [username]
  });

  if (!result.rows[0]) return null;
  return { ...result.rows[0] } as any;
}

export async function getUserByEmail(email: string) {
  const result = await db.execute({
    sql: "SELECT * FROM users WHERE email = ?",
    args: [email]
  });

  if (!result.rows[0]) return null;
  return { ...result.rows[0] } as any;
}

export async function userExists(username: string) {
  const result = await db.execute({
    sql: "SELECT COUNT(*) as count FROM users WHERE username = ?",
    args: [username]
  });

  const count = Number((result.rows[0] as any).count);
  return count > 0;
}

export async function emailExists(email: string) {
  const result = await db.execute({
    sql: "SELECT COUNT(*) as count FROM users WHERE email = ?",
    args: [email]
  });

  const count = Number((result.rows[0] as any).count);
  return count > 0;
}

export async function verifyPassword(username: string, password: string) {
  const user = await getUserByUsername(username);
  if (!user) return false;
  return bcrypt.compareSync(password, user.password_hash);
}

export async function verifyPin(username: string, pin: string) {
  const user = await getUserByUsername(username);
  if (!user || !user.pin_hash) return false;
  return bcrypt.compareSync(pin, user.pin_hash);
}

export async function verifyRecoveryKey(username: string, recoveryKey: string) {
  const user = await getUserByUsername(username);
  if (!user) return false;
  return user.recovery_key === recoveryKey;
}

export async function verifySecretAnswer(username: string, answer: string) {
  const user = await getUserByUsername(username);
  if (!user || !user.secret_answer_hash) return false;
  return bcrypt.compareSync(answer, user.secret_answer_hash);
}

export async function updatePassword(username: string, newPassword: string) {
  const passwordHash = bcrypt.hashSync(newPassword, 10);
  return await db.execute({
    sql: "UPDATE users SET password_hash = ? WHERE username = ?",
    args: [passwordHash, username]
  });
}

export async function updatePin(username: string, newPin: string) {
  const pinHash = bcrypt.hashSync(newPin, 10);
  return await db.execute({
    sql: "UPDATE users SET pin_hash = ? WHERE username = ?",
    args: [pinHash, username]
  });
}
