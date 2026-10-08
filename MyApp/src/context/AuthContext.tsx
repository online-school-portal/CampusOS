import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthContextType = {
  session: Session | null;
    user: User | null;
      role: string | null;
        loading: boolean;
          signOut: () => Promise<void>;
            setRole: (role: string | null) => void;
            };

            const AuthContext = createContext<AuthContextType>({
              session: null,
                user: null,
                  role: null,
                    loading: true,
                      signOut: async () => {},
                        setRole: () => {},
                        });

                        export const useAuth = () => useContext(AuthContext);

                        export function AuthProvider({ children }: { children: React.ReactNode }) {
                          const [session, setSession] = useState<Session | null>(null);
                            const [user, setUser] = useState<User | null>(null);
                              const [role, setRole] = useState<string | null>(null);
                                const [loading, setLoading] = useState(true);
                                  const [isReady, setIsReady] = useState(false);

                                    useEffect(() => {
                                        // Only run on the client
                                            setIsReady(true);

                                                const init = async () => {
                                                      try {
                                                              const { data: { session } } = await supabase.auth.getSession();
                                                                      setSession(session);
                                                                              setUser(session?.user ?? null);
                                                                                    } catch (e) {
                                                                                            console.log('Auth init error:', e);
                                                                                                  } finally {
                                                                                                          setLoading(false);
                                                                                                                }
                                                                                                                    };

                                                                                                                        init();

                                                                                                                            const { data: { subscription } } = supabase.auth.onAuthStateChange(
                                                                                                                                  async (_event, session) => {
                                                                                                                                          setSession(session);
                                                                                                                                                  setUser(session?.user ?? null);
                                                                                                                                                          setLoading(false);
                                                                                                                                                                }
                                                                                                                                                                    );

                                                                                                                                                                        return () => {
                                                                                                                                                                              subscription.unsubscribe();
                                                                                                                                                                                  };
                                                                                                                                                                                    }, []);

                                                                                                                                                                                      const signOut = async () => {
                                                                                                                                                                                          await supabase.auth.signOut();
                                                                                                                                                                                              setRole(null);
                                                                                                                                                                                                };

                                                                                                                                                                                                  // Don't render children until client is ready
                                                                                                                                                                                                    if (!isReady) {
                                                                                                                                                                                                        return null;
                                                                                                                                                                                                          }

                                                                                                                                                                                                            return (
                                                                                                                                                                                                                <AuthContext.Provider value={{ session, user, role, loading, signOut, setRole }}>
                                                                                                                                                                                                                      {children}
                                                                                                                                                                                                                          </AuthContext.Provider>
                                                                                                                                                                                                                            );
                                                                                                                                                                                                                            }