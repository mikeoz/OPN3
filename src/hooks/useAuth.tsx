import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { Member } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  member: Member | null;
  loading: boolean;
  signUp: (email: string, password: string, handle?: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch member profile with setTimeout to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchMember(session.user.id);
          }, 0);
        } else {
          setMember(null);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchMember(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchMember = async (userId: string) => {
    const { data } = await supabase
      .from('tno_members')
      .select('*')
      .eq('member_id', userId)
      .maybeSingle();
    
    if (data) {
      setMember(data as Member);
    }
  };

  const signUp = async (email: string, password: string, handle?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) return { error };

    // Create member profile if signup successful
    if (data.user) {
      const { error: memberError } = await supabase
        .from('tno_members')
        .insert({
          member_id: data.user.id,
          email: email,
          handle: handle || null,
        });

      if (memberError) {
        return { error: new Error(memberError.message) };
      }

      // Create audit event
      await supabase.from('tno_audit_events').insert({
        event_type: 'member.created',
        actor_member_id: data.user.id,
        subject_member_id: data.user.id,
      });
    }

    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setMember(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, member, loading, signUp, signIn, signOut }}>
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
