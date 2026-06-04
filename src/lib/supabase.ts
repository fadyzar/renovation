import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

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
  service_area?: string;
}
