import { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signUp: (email: string, password: string, fullName: string, role: 'property_owner' | 'contractor') => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (role?: 'property_owner' | 'contractor') => Promise<void>;
  signOut: () => Promise<void>;
}

const PENDING_ROLE_KEY = 'mgbit_pending_signup_role';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      // First-time OAuth (e.g. Google) signups land here with the DB default
      // role (property_owner). If the user picked a role before the OAuth
      // redirect, apply it once — clamped to self-service roles only; the DB
      // trigger blocks any attempt to reach 'admin'.
      const pendingRole = localStorage.getItem(PENDING_ROLE_KEY);
      if (data && pendingRole && (pendingRole === 'property_owner' || pendingRole === 'contractor')
          && data.role !== 'admin' && data.role !== pendingRole) {
        localStorage.removeItem(PENDING_ROLE_KEY);
        const { data: updated } = await supabase
          .from('profiles').update({ role: pendingRole }).eq('id', userId).select('*').maybeSingle();
        setProfile(updated ?? data);
        return;
      }
      localStorage.removeItem(PENDING_ROLE_KEY);
      setProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function refreshProfile() {
    if (!user?.id) return;
    await loadProfile(user.id);
  }

  async function signUp(email: string, password: string, fullName: string, role: 'property_owner' | 'contractor') {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role,
        },
      },
    });
    if (error) throw error;
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }

  async function signInWithGoogle(role?: 'property_owner' | 'contractor') {
    // Remember the chosen role so the first-time profile (created by the DB
    // trigger as property_owner) can be corrected after the OAuth redirect.
    if (role) localStorage.setItem(PENDING_ROLE_KEY, role);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        queryParams: { prompt: 'select_account' },
      },
    });
    if (error) { localStorage.removeItem(PENDING_ROLE_KEY); throw error; }
  }

  async function signOut() {
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      console.error('Logout error (continuing anyway):', error);
    }
    // Clear local state regardless of server response
    setUser(null);
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
