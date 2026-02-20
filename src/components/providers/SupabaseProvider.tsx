"use client";

import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User, Session, SupabaseClient } from "@supabase/supabase-js";
import { toFriendlyAuthError } from "@/lib/supabase/auth-errors";

type SupabaseContext = {
  supabase: SupabaseClient | null;
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  initError: string | null;
};

const Context = createContext<SupabaseContext | undefined>(undefined);

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  const router = useRouter();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

  // Allow the frontend to boot even if Supabase env vars are missing. Pages that
  // depend on Supabase auth should gracefully handle `supabase === null`.
  const supabase = useMemo(() => {
    if (!isConfigured) return null;
    return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
  }, [isConfigured, supabaseUrl, supabaseAnonKey]);

  useEffect(() => {
    let isActive = true;

    if (!supabase) {
      setIsLoading(false);
      return;
    }

    const getSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!isActive) return;
        setSession(session);
        setUser(session?.user ?? null);
        setInitError(null);
      } catch (err) {
        if (!isActive) return;
        setSession(null);
        setUser(null);
        setInitError(toFriendlyAuthError(err));
      } finally {
        if (!isActive) return;
        setIsLoading(false);
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isActive) return;
      setSession(session);
      setUser(session?.user ?? null);

      if (event === "SIGNED_IN") {
        setInitError(null);
        router.refresh();
      }
      if (event === "SIGNED_OUT") {
        router.refresh();
      }
    });

    return () => {
      isActive = false;
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  return (
    <Context.Provider
      value={{ supabase, user, session, isLoading, isConfigured, initError }}
    >
      {children}
    </Context.Provider>
  );
}

export const useSupabase = () => {
  const context = useContext(Context);
  if (context === undefined) {
    throw new Error("useSupabase must be used inside SupabaseProvider");
  }
  return context;
};
