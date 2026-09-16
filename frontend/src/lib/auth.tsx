import React, { createContext, useContext, useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";
import { useGoogleLogin } from "@react-oauth/google";

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
  user: any | null;
  session: any | null;
  profile: UserProfile | null;
  loading: boolean;
  isAuthenticated: boolean;
  signInWithGoogle: () => void;
  signInWithCredential: (credential: string) => void;
  signInWithEmail: (email: string, password: string) => Promise<{ user: any; session: any; error: any }>;
  signUpWithEmail: (email: string, password: string, metadata?: any) => Promise<any>;
  signOut: () => Promise<void>;
  resendVerificationEmail: (email: string) => Promise<{ error: any }>;
  resetPassword: (email: string) => Promise<{ error: any }>;
  completeOnboarding: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [session, setSession] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load session from local storage on mount
    const storedToken = localStorage.getItem("vyepari_x_auth_token");
    if (storedToken) {
      try {
        const decoded = jwtDecode<any>(storedToken);
        // Check if token is expired
        if (decoded.exp * 1000 < Date.now()) {
          throw new Error("Token expired");
        }
        
        setSession({ access_token: storedToken });
        setUser({ id: decoded.sub, email: decoded.email });
        
        setProfile({
          id: decoded.sub,
          email: decoded.email,
          full_name: decoded.name,
          avatar_url: decoded.picture,
          role: "owner",
          onboarding_completed: true, // We bypass onboarding for now
        });
      } catch (err) {
        console.warn("Invalid stored token", err);
        localStorage.removeItem("vyepari_x_auth_token");
      }
    }
    setLoading(false);
  }, []);

  const signInWithCredential = (credential: string) => {
    try {
      const decoded = jwtDecode<any>(credential);
      localStorage.setItem("vyepari_x_auth_token", credential);
      
      setSession({ access_token: credential });
      setUser({ id: decoded.sub, email: decoded.email });
      setProfile({
        id: decoded.sub,
        email: decoded.email,
        full_name: decoded.name,
        avatar_url: decoded.picture,
        role: "owner",
        onboarding_completed: true,
      });
    } catch (err) {
      console.error("Failed to decode Google credential", err);
    }
  };

  const login = useGoogleLogin({
    onSuccess: async (codeResponse) => {
      try {
        const userInfoResponse = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
          headers: { Authorization: `Bearer ${codeResponse.access_token}` },
        });
        const userInfo = await userInfoResponse.json();
        
        localStorage.setItem("vyepari_x_auth_token", codeResponse.access_token);
        
        setSession({ access_token: codeResponse.access_token });
        setUser({ id: userInfo.sub, email: userInfo.email });
        setProfile({
          id: userInfo.sub,
          email: userInfo.email,
          full_name: userInfo.name,
          avatar_url: userInfo.picture,
          role: "owner",
          onboarding_completed: true,
        });
      } catch (err) {
        console.error("Failed to fetch Google user info", err);
      }
    },
    onError: (errorResponse) => console.log(errorResponse),
  });

  const signInWithGoogle = () => {
    login();
  };

  // Stubs for removed Supabase functionality
  const signInWithEmail = async () => ({ user: null, session: null, error: new Error("Email login disabled") });
  const signUpWithEmail = async () => ({ user: null, session: null, error: new Error("Email signup disabled") });
  const resendVerificationEmail = async () => ({ error: new Error("Disabled") });
  const resetPassword = async () => ({ error: new Error("Disabled") });
  const completeOnboarding = async () => {};
  const updateProfile = async () => {};
  const refreshProfile = async () => {};

  const signOut = async () => {
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
        signInWithCredential,
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
