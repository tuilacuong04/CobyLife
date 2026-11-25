export const AUTH_ACCOUNT_KEY = 'coby_life_auth_account_v1';
export const AUTH_SESSION_KEY = 'coby_life_auth_session_v1';
export const AUTH_CHANGE_EVENT = 'coby-auth-change';

const PASSWORD_DOMAIN_PREFIX = 'coby_life_v1:';

export interface AuthAccount {
  identifier: string;
  displayName: string;
  passwordHash: string;
  createdAt: string;
}

export interface AuthSession {
  identifier: string;
  displayName: string;
  authenticatedAt: string;
  rememberMe: boolean;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  account?: AuthAccount;
}

export interface SignUpInput {
  displayName: string;
  identifier: string;
  password: string;
  rememberMe: boolean;
}

function encodeUtf8(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(text);
  }
  const encoded = unescape(encodeURIComponent(text));
  const out = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i++) {
    out[i] = encoded.charCodeAt(i);
  }
  return out;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

function sha256Fallback(input: string): string {
  const bytes = encodeUtf8(input);
  const bitLen = bytes.length * 8;
  const paddedLen = Math.ceil((bytes.length + 9) / 64) * 64;
  const padded = new Uint8Array(paddedLen);
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  const view = new DataView(padded.buffer);
  const hiBits = Math.floor(bitLen / 0x100000000);
  const loBits = bitLen >>> 0;
  view.setUint32(paddedLen - 8, hiBits, false);
  view.setUint32(paddedLen - 4, loBits, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < paddedLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + SHA256_K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0;
    h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0;
    h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0;
    h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0;
    h[7] = (h[7] + hh) >>> 0;
  }

  return Array.from(h)
    .map((word) => word.toString(16).padStart(8, '0'))
    .join('');
}

async function hashPassword(password: string): Promise<string> {
  const input = `${PASSWORD_DOMAIN_PREFIX}${password}`;
  if (typeof window !== 'undefined' && window.crypto?.subtle?.digest) {
    try {
      const bytes = encodeUtf8(input);
      const ab = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(ab).set(bytes);
      const digest = await window.crypto.subtle.digest('SHA-256', ab);
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    } catch {
      return sha256Fallback(input);
    }
  }
  return sha256Fallback(input);
}

function emitAuthChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT));
  }
}

function readStorageItem(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeSession(rememberMe: boolean, identifier: string, displayName: string): AuthSession {
  const session: AuthSession = {
    identifier,
    displayName,
    authenticatedAt: new Date().toISOString(),
    rememberMe,
  };
  const serialized = JSON.stringify(session);
  try {
    if (rememberMe) {
      window.localStorage.setItem(AUTH_SESSION_KEY, serialized);
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    } else {
      window.sessionStorage.setItem(AUTH_SESSION_KEY, serialized);
      window.localStorage.removeItem(AUTH_SESSION_KEY);
    }
  } catch {
    // Ignore storage quota errors in restricted environments
  }
  return session;
}

export function getAuthAccount(): AuthAccount | null {
  if (typeof window === 'undefined') return null;
  const raw = readStorageItem(window.localStorage, AUTH_ACCOUNT_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthAccount>;
    if (
      parsed &&
      typeof parsed.identifier === 'string' &&
      parsed.identifier.trim().length > 0 &&
      typeof parsed.displayName === 'string' &&
      typeof parsed.passwordHash === 'string' &&
      parsed.passwordHash.length > 0 &&
      typeof parsed.createdAt === 'string'
    ) {
      return {
        identifier: parsed.identifier,
        displayName: parsed.displayName,
        passwordHash: parsed.passwordHash,
        createdAt: parsed.createdAt,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function hasRegisteredAccount(): boolean {
  return getAuthAccount() !== null;
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw =
    readStorageItem(window.localStorage, AUTH_SESSION_KEY) ??
    readStorageItem(window.sessionStorage, AUTH_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>;
    if (
      parsed &&
      typeof parsed.authenticatedAt === 'string' &&
      parsed.authenticatedAt.length > 0 &&
      typeof parsed.identifier === 'string'
    ) {
      return {
        identifier: parsed.identifier,
        displayName: typeof parsed.displayName === 'string' ? parsed.displayName : 'Personal OS',
        authenticatedAt: parsed.authenticatedAt,
        rememberMe: Boolean(parsed.rememberMe),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getAuthSession() !== null;
}

export async function signUp({
  displayName,
  identifier,
  password,
  rememberMe,
}: SignUpInput): Promise<AuthResult> {
  const cleanName = displayName.trim();
  const cleanId = identifier.trim();

  if (!cleanName) {
    return { ok: false, error: 'Enter your display name.' };
  }
  if (!cleanId) {
    return { ok: false, error: 'Enter an email or username.' };
  }
  if (password.length < 4) {
    return { ok: false, error: 'Password must be at least 4 characters.' };
  }

  const passwordHash = await hashPassword(password);
  const account: AuthAccount = {
    identifier: cleanId,
    displayName: cleanName,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(AUTH_ACCOUNT_KEY, JSON.stringify(account));
  } catch {
    return { ok: false, error: 'Could not save account to local storage.' };
  }

  writeSession(rememberMe, account.identifier, account.displayName);
  emitAuthChange();
  return { ok: true, account };
}

export async function signIn(
  identifier: string,
  password: string,
  rememberMe = true
): Promise<AuthResult> {
  const cleanId = identifier.trim();
  if (!cleanId) {
    return { ok: false, error: 'Enter your email or username.' };
  }
  if (!password) {
    return { ok: false, error: 'Enter your password.' };
  }

  const account = getAuthAccount();
  if (!account) {
    return {
      ok: false,
      error: 'No local account found on this device. Create an account or use Cloud Pair.',
    };
  }

  if (account.identifier.trim().toLowerCase() !== cleanId.toLowerCase()) {
    return { ok: false, error: 'Incorrect email/username or password.' };
  }

  const passwordHash = await hashPassword(password);
  if (passwordHash !== account.passwordHash) {
    return { ok: false, error: 'Incorrect email/username or password.' };
  }

  writeSession(rememberMe, account.identifier, account.displayName);
  emitAuthChange();
  return { ok: true, account };
}

export function markSessionAuthenticated(
  rememberMe: boolean,
  identifier?: string,
  displayName?: string
): AuthSession {
  const existing = getAuthAccount();
  const resolvedId = identifier?.trim() || existing?.identifier || 'cloud-paired';
  const resolvedName = displayName?.trim() || existing?.displayName || 'Synced Device';
  const session = writeSession(rememberMe, resolvedId, resolvedName);
  emitAuthChange();
  return session;
}

export function signOut(): void {
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // Ignore
    }
    try {
      window.sessionStorage.removeItem(AUTH_SESSION_KEY);
    } catch {
      // Ignore
    }
  }
  emitAuthChange();
}
