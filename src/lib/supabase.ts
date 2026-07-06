import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// ─── "Keep me logged in" ──────────────────────────────────────────────────────
// When ON (default) the auth session lives in localStorage and survives browser
// restarts. When OFF it lives in sessionStorage and is cleared when the browser
// closes. The choice is recorded before sign-in via setKeepLoggedIn().
const KEEP_KEY = 'mgbit_keep_logged_in';

export function setKeepLoggedIn(keep: boolean) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEEP_KEY, keep ? 'true' : 'false');
  }
}

function shouldPersist(): boolean {
  if (typeof window === 'undefined') return true;
  return window.localStorage.getItem(KEEP_KEY) !== 'false'; // default: persist
}

const hybridAuthStorage = {
  getItem: (key: string): string | null =>
    window.sessionStorage.getItem(key) ?? window.localStorage.getItem(key),
  setItem: (key: string, value: string) => {
    if (shouldPersist()) {
      window.localStorage.setItem(key, value);
      window.sessionStorage.removeItem(key);
    } else {
      window.sessionStorage.setItem(key, value);
      window.localStorage.removeItem(key);
    }
  },
  removeItem: (key: string) => {
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== 'undefined' ? hybridAuthStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export type UserRole = 'property_owner' | 'contractor' | 'admin';

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  company_name?: string;
  license_number?: string;
  bio?: string;
  location?: {
    address?: string;
    city?: string;
    state?: string;
    zip?: string;
  };
  verification_status: 'pending' | 'verified' | 'rejected';
  rating: number;
  total_projects: number;
  created_at: string;
  updated_at: string;
  service_latitude?: number;
  service_longitude?: number;
  service_radius_km?: number;
  location_enabled?: boolean;
  // Contractor-specific fields (added by license verification migration)
  license_verified?: boolean;
  license_status?: string;
  years_experience?: number;
  specialties?: string[];
  onboarding_completed?: boolean;
  payout_details_completed?: boolean;
  service_area?: string;
}
