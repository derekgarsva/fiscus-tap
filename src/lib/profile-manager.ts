'use client';

import { BankProfile } from '@/types';

const PROFILES_KEY = 'fiscus_profiles_v1';
const CRYPTO_KEY_NAME = 'fiscus_crypto_key_v1';

// ─── Crypto helpers (AES-GCM via Web Crypto API) ────────────

async function getCryptoKey(): Promise<CryptoKey> {
  try {
    const stored = localStorage.getItem(CRYPTO_KEY_NAME);
    if (stored) {
      const jwk = JSON.parse(stored);
      return await crypto.subtle.importKey(
        'jwk',
        jwk,
        { name: 'AES-GCM' },
        true,
        ['encrypt', 'decrypt']
      );
    }
  } catch {
    // Key corrupted or missing, generate new one
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const jwk = await crypto.subtle.exportKey('jwk', key);
  localStorage.setItem(CRYPTO_KEY_NAME, JSON.stringify(jwk));
  return key;
}

async function encrypt(data: string): Promise<string> {
  const key = await getCryptoKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length);
  combined.set(iv);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return btoa(String.fromCharCode(...Array.from(combined)));
}

async function decrypt(data: string): Promise<string> {
  const key = await getCryptoKey();
  const combined = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );
  return new TextDecoder().decode(decrypted);
}

// ─── Profile CRUD ───────────────────────────────────────────

async function readAllProfiles(): Promise<Record<string, BankProfile>> {
  try {
    const raw = localStorage.getItem(PROFILES_KEY);
    if (!raw) return {};
    const decrypted = await decrypt(raw);
    return JSON.parse(decrypted);
  } catch {
    return {};
  }
}

async function writeAllProfiles(
  profiles: Record<string, BankProfile>
): Promise<void> {
  const encrypted = await encrypt(JSON.stringify(profiles));
  localStorage.setItem(PROFILES_KEY, encrypted);
}

export async function getProfile(
  bankCode: string
): Promise<BankProfile | null> {
  const profiles = await readAllProfiles();
  return profiles[bankCode] || null;
}

export async function saveProfile(
  bankCode: string,
  profile: BankProfile
): Promise<void> {
  const profiles = await readAllProfiles();
  profiles[bankCode] = { ...profile, updated_at: new Date().toISOString() };
  await writeAllProfiles(profiles);
}

export async function deleteProfile(bankCode: string): Promise<void> {
  const profiles = await readAllProfiles();
  delete profiles[bankCode];
  await writeAllProfiles(profiles);
}

export async function listProfiles(): Promise<Record<string, BankProfile>> {
  return readAllProfiles();
}

export async function hasProfile(bankCode: string): Promise<boolean> {
  const profile = await getProfile(bankCode);
  return profile !== null;
}
