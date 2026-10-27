import { localData } from '@/lib/localData';

const VAULT_KEY = 'password_vault';
const NEVER_KEY = 'password_never_sites';
const ITERATIONS = 310000;
let vaultKey = null;
let vaultSalt = null;
let records = [];

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...bytes));
const base64ToBytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));

async function deriveKey(masterPassword, salt) {
  const material = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(masterPassword), 'PBKDF2', false, ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

async function encryptRecords(key, value, salt) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)),
  );
  return {
    version: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function persist() {
  localData.set(VAULT_KEY, await encryptRecords(vaultKey, records, vaultSalt));
}

async function decryptEnvelope(envelope, masterPassword) {
  if (envelope?.version !== 1 || envelope?.kdf !== 'PBKDF2-SHA256' || envelope?.iterations !== ITERATIONS) {
    throw new Error('This encrypted backup format is not supported.');
  }
  const salt = base64ToBytes(envelope.salt);
  const key = await deriveKey(masterPassword, salt);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(envelope.iv) }, key, base64ToBytes(envelope.ciphertext),
  );
  const decoded = JSON.parse(new TextDecoder().decode(plaintext));
  if (!Array.isArray(decoded)) throw new Error('Invalid vault content.');
  return { key, salt, records: decoded };
}

function recordHost(site) {
  try { return new URL(site).hostname.toLowerCase().replace(/^www\./, ''); } catch { return String(site || '').toLowerCase(); }
}
function sameLogin(left, right) {
  return recordHost(left.site) === recordHost(right.site)
    && String(left.username || '').trim().toLowerCase() === String(right.username || '').trim().toLowerCase();
}

export const passwordVault = {
  isInitialized: () => localData.has(VAULT_KEY),
  isUnlocked: () => vaultKey !== null,
  async unlock(masterPassword) {
    if (!masterPassword) throw new Error('Enter your vault master password.');
    const stored = localData.get(VAULT_KEY);
    if (!stored) {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      vaultKey = await deriveKey(masterPassword, salt);
      vaultSalt = salt;
      records = [];
      await persist();
      return records;
    }
    if (stored.version !== 1 || stored.kdf !== 'PBKDF2-SHA256') {
      throw new Error('This password vault format is not supported.');
    }
    try {
      const decoded = await decryptEnvelope(stored, masterPassword);
      vaultKey = decoded.key;
      vaultSalt = decoded.salt;
      records = decoded.records;
      return records;
    } catch {
      vaultKey = null;
      vaultSalt = null;
      records = [];
      throw new Error('That master password did not unlock this vault.');
    }
  },
  list() {
    if (!vaultKey) throw new Error('Unlock your password vault first.');
    return [...records].sort((a, b) => a.site.localeCompare(b.site));
  },
  matching(site) {
    if (!vaultKey) return [];
    const hostname = (() => { try { return new URL(site).hostname.toLowerCase(); } catch { return ''; } })();
    if (!hostname) return [];
    return this.list().filter((record) => {
      try {
        const savedHost = new URL(record.site).hostname.toLowerCase();
        return hostname === savedHost || hostname.endsWith(`.${savedHost}`);
      } catch { return false; }
    });
  },
  async save(record) {
    if (!vaultKey) throw new Error('Unlock your password vault first.');
    const existing = record.id ? null : records.find((item) => sameLogin(item, record));
    const normalized = {
      ...record,
      id: record.id || existing?.id || crypto.randomUUID(),
      updatedAt: Date.now(),
    };
    records = [normalized, ...records.filter((item) => item.id !== normalized.id)];
    await persist();
    return this.list();
  },
  exportEncrypted() {
    if (!vaultKey) throw new Error('Unlock your password vault first.');
    return { app: 'Matcha Air', type: 'encrypted-password-vault', ...localData.get(VAULT_KEY) };
  },
  async importEncrypted(envelope, masterPassword) {
    if (!masterPassword) throw new Error('Enter the vault master password for this backup.');
    const decoded = await decryptEnvelope(envelope, masterPassword);
    vaultKey = decoded.key;
    vaultSalt = decoded.salt;
    records = decoded.records;
    localData.set(VAULT_KEY, envelope);
    return this.list();
  },
  async remove(id) {
    if (!vaultKey) throw new Error('Unlock your password vault first.');
    records = records.filter((item) => item.id !== id);
    await persist();
    return this.list();
  },
  lock() {
    vaultKey = null;
    vaultSalt = null;
    records = [];
  },
  isNeverSaved(site) {
    const host = (() => { try { return new URL(site).hostname; } catch { return site; } })();
    return (localData.get(NEVER_KEY) || []).includes(host);
  },
  neverSave(site) {
    const host = (() => { try { return new URL(site).hostname; } catch { return site; } })();
    const sites = localData.get(NEVER_KEY) || [];
    if (!sites.includes(host)) localData.set(NEVER_KEY, [...sites, host]);
  },
};
