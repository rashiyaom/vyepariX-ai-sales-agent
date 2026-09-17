import React, { createContext, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./supabase";

export interface UserProfile {
  id: string;
  email: string;
  full_name?: string;
  company_name?: string;
  industry?: string;
  avatar_url?: string;
  role?: string;
  onboarding_completed?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithEmail: (
    email: string,
    password: string
  ) => Promise<{ user: User | null; session: Session | null; error: any }>;
  signUpWithEmail: (
    email: string,
    password: string,
    metadata?: { full_name?: string; company_name?: string; industry?: string }
  ) => Promise<{
    user: User | null;
    session: Session | null;
    error: any;
    needsVerification: boolean;
  }>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  completeOnboarding: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch or sync user profile
  const fetchProfile = async (currentUser: User) => {
    try {
      // First try to load from Supabase profiles table
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", currentUser.id)
        .maybeSingle();

      if (data && !error) {
        setProfile(data as UserProfile);
        return;
      }

      // Fallback to user metadata
      const meta = (currentUser.user_metadata || {}) as Record<string, any>;
      const fallbackProfile: UserProfile = {
        id: currentUser.id,
        email: currentUser.email || "",
        full_name: (meta["full_name"] || meta["name"] || "") as string,
        company_name: (meta["company_name"] || meta["company"] || "") as string,
        industry: (meta["industry"] || "") as string,
        avatar_url: (meta["avatar_url"] || meta["picture"] || "") as string,
        role: "owner",
        onboarding_completed: Boolean(meta["onboarding_completed"]),
      };
      setProfile(fallbackProfile);

      // Attempt upsert into profiles table
      if (isSupabaseConfigured) {
        await supabase.from("profiles").upsert(fallbackProfile).select();
      }
    } catch (err) {
      console.warn("Could not fetch remote profile:", err);
    }
  };

  useEffect(() => {
    // Initial session load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user);
      }
      setLoading(false);
    });

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchProfile(newSession.user);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const origin = window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/dashboard`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
    return { error };
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (!error && data.session) {
      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await fetchProfile(data.user);
      }
    }
    return { user: data.user, session: data.session, error };
  };

  const signUpWithEmail = async (
    email: string,
    password: string,
    metadata?: { full_name?: string; company_name?: string; industry?: string }
  ) => {
    const origin = window.location.origin;
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: metadata?.full_name?.trim() || "",
          company_name: metadata?.company_name?.trim() || "",
          industry: metadata?.industry?.trim() || "",
          onboarding_completed: false,
        },
        emailRedirectTo: `${origin}/onboarding`,
      },
    });

    const needsVerification = Boolean(
      !error && data.user && (!data.session || data.user.identities?.length === 0)
    );

    if (data.session && data.user) {
      setSession(data.session);
      setUser(data.user);
      await fetchProfile(data.user);
    }

    return {
      user: data.user,
      session: data.session,
      error,
      needsVerification,
    };
  };

  const resendVerificationEmail = async (email: string) => {
    const origin = window.location.origin;
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
      options: {
        emailRedirectTo: `${origin}/onboarding`,
      },
    });
    return { error };
  };

  const resetPassword = async (email: string) => {
    const origin = window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${origin}/login?type=recovery`,
    });
    return { error };
  };

  const completeOnboarding = async () => {
    if (!user) return;
    try {
      await supabase.auth.updateUser({
        data: { onboarding_completed: true },
      });
      if (isSupabaseConfigured) {
        await supabase
          .from("profiles")
          .update({ onboarding_completed: true, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }
      setProfile((prev) => (prev ? { ...prev, onboarding_completed: true } : null));
    } catch (e) {
      console.warn("Failed to update onboarding status:", e);
    }
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return;
    try {
      if (isSupabaseConfigured) {
        await supabase
          .from("profiles")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", user.id);
      }
      setProfile((prev) => (prev ? { ...prev, ...updates } : null));
    } catch (e) {
      console.warn("Failed to update profile:", e);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    localStorage.removeItem("vyepari_x_auth_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        isAuthenticated: Boolean(user && session),
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        resendVerificationEmail,
        resetPassword,
        completeOnboarding,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
