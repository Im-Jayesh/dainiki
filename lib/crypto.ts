/**
 * Encryption utilities for End-to-End Encryption in Dainiki.
 * Uses Web Crypto API (AES-GCM).
 */

const ALGORITHM = "AES-GCM";

// Key cache to avoid expensive derivation on every call
const keyCache = new Map<string, CryptoKey>();

async function deriveKey(password: string, salt: string) {
  const cacheKey = `${password}:${salt}`;
  if (keyCache.has(cacheKey)) {
    return keyCache.get(cacheKey)!;
  }

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    passwordKey,
    { name: ALGORITHM, length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  keyCache.set(cacheKey, derivedKey);
  return derivedKey;
}

// Robust base64 helpers that handle large buffers and non-ASCII
function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function encrypt(text: string, password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await deriveKey(password, salt);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(text)
  );

  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return arrayBufferToBase64(combined);
}

export async function decrypt(encoded: string, password: string, salt: string): Promise<string> {
  if (!encoded || typeof encoded !== "string" || encoded.trim() === "") return "";
  
  const decoder = new TextDecoder();
  let combined: Uint8Array;
  try {
    combined = base64ToArrayBuffer(encoded);
  } catch (e) {
    return encoded;
  }

  if (combined.length < 28) {
    // AES-GCM ciphertext must have at least 12 bytes IV + 16 bytes GCM auth tag
    return encoded; 
  }

  const iv = combined.slice(0, 12);
  const encrypted = combined.slice(12);
  const key = await deriveKey(password, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encrypted
    );
    return decoder.decode(decrypted);
  } catch (err) {
    console.error("AES-GCM decryption failed:", err);
    return "🔒 Decryption Failed";
  }
}

