import type { User } from '@supabase/supabase-js';
import {
  setRememberMePreference,
  supabase,
  SUPABASE_AUTH_STORAGE_KEY,
} from './supabaseClient';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: AuthUser;
  needsConfirmation?: boolean;
  email?: string;
}

export interface SignUpWithEmailInput {
  displayName: string;
  email: string;
  password: string;
  rememberMe: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function mapSupabaseUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;
  const metaDisplay =
    typeof user.user_metadata?.display_name === 'string'
      ? user.user_metadata.display_name.trim()
      : typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name.trim()
        : '';
  const email = (user.email || '').trim();
  const displayName = metaDisplay || (email ? email.split('@')[0] : '') || 'User';
  return {
    id: user.id,
    email,
    displayName,
  };
}

function getEmailRedirectUrl(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const baseUrl = import.meta.env.BASE_URL || '/';
  return window.location.origin + baseUrl;
}

export async function getInitialSessionUser(): Promise<AuthUser | null> {
  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    return mapSupabaseUser(data.session?.user);
  } catch {
    return null;
  }
}

export function subscribeAuthChanges(cb: (user: AuthUser | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(mapSupabaseUser(session?.user));
  });
  return () => {
    subscription.unsubscribe();
  };
}

export async function signInWithEmail(
  email: string,
  password: string,
  rememberMe = true
): Promise<AuthResult> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return { ok: false, error: 'Enter your email address.' };
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (!password) {
    return { ok: false, error: 'Enter your password.' };
  }

  setRememberMePreference(rememberMe);

  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) {
      const needsConfirmation = /not confirmed/i.test(error.message);
      return {
        ok: false,
        error: error.message || 'Incorrect email or password.',
        needsConfirmation,
        email: needsConfirmation ? cleanEmail : undefined,
      };
    }
    const mapped = mapSupabaseUser(data.user ?? data.session?.user);
    if (!mapped) {
      return { ok: false, error: 'Could not load account session.' };
    }
    return { ok: true, user: mapped };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to sign in right now.',
    };
  }
}

export async function signUpWithEmail({
  displayName,
  email,
  password,
  rememberMe,
}: SignUpWithEmailInput): Promise<AuthResult> {
  const cleanName = displayName.trim();
  const cleanEmail = email.trim();

  if (!cleanName) {
    return { ok: false, error: 'Enter your display name.' };
  }
  if (!cleanEmail) {
    return { ok: false, error: 'Enter your email address.' };
  }
  if (!EMAIL_RE.test(cleanEmail)) {
    return { ok: false, error: 'Enter a valid email address.' };
  }
  if (password.length < 6) {
    return { ok: false, error: 'Password must be at least 6 characters.' };
  }

  setRememberMePreference(rememberMe);

  try {
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { display_name: cleanName },
        emailRedirectTo: getEmailRedirectUrl(),
      },
    });
    if (error) {
      return { ok: false, error: error.message || 'Could not create account.' };
    }
    if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
      return {
        ok: false,
        error: 'An account with this email already exists. Please Sign In.',
      };
    }
    if (data.session) {
      const mapped = mapSupabaseUser(data.session.user ?? data.user);
      if (!mapped) {
        return { ok: false, error: 'Unable to initialize session.' };
      }
      return { ok: true, user: mapped };
    }
    if (data.user && !data.session) {
      return { ok: true, needsConfirmation: true, email: cleanEmail };
    }
    return { ok: false, error: 'Could not create account.' };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Unable to create account right now.',
    };
  }
}

export async function verifySignupOtp(email: string, token: string): Promise<AuthResult> {
  const cleanEmail = email.trim();
  const cleanToken = token.trim().replace(/\s+/g, '');

  if (!cleanEmail) {
    return { ok: false, error: 'Missing email address for verification.' };
  }
  if (!cleanToken) {
    return { ok: false, error: 'Enter the 6-digit verification code from your email.' };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: cleanEmail,
      token: cleanToken,
      type: 'signup',
    });
    if (error) {
      return { ok: false, error: error.message || 'Invalid or expired verification code.' };
    }
    const mapped = mapSupabaseUser(data.session?.user ?? data.user);
    if (!mapped) {
      return { ok: false, error: 'Verification succeeded, please sign in.' };
    }
    return { ok: true, user: mapped };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not verify code.',
    };
  }
}

export async function resendSignupConfirmation(email: string): Promise<AuthResult> {
  const cleanEmail = email.trim();
  if (!cleanEmail) {
    return { ok: false, error: 'Enter your email address.' };
  }

  try {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: {
        emailRedirectTo: getEmailRedirectUrl(),
      },
    });
    if (error) {
      return { ok: false, error: error.message || 'Could not resend confirmation email.' };
    }
    return { ok: true, email: cleanEmail };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not resend confirmation email.',
    };
  }
}

export async function signOutCloud(): Promise<void> {
  try {
    await supabase.auth.signOut();
  } catch {
    // Ensure local auth token storage is still cleared if offline
  }
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    } catch {
      // Ignore
    }
    try {
      window.sessionStorage.removeItem(SUPABASE_AUTH_STORAGE_KEY);
    } catch {
      // Ignore
    }
  }
}
