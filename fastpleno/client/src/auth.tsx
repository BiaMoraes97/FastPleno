// Guarda quem está logado e oferece login/cadastro/logout para qualquer tela.
import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { api, tokenStore } from "./api";
import { User } from "./types";

interface AuthValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: { name: string; email: string; password: string; directionCode?: string }) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue>(null!);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Ao abrir o site, tenta recuperar o login salvo.
  useEffect(() => {
    if (!tokenStore.get()) return setLoading(false);
    api.me().then((r) => setUser(r.user)).catch(() => tokenStore.clear()).finally(() => setLoading(false));
  }, []);

  const finish = (r: { token: string; user: User }) => {
    tokenStore.set(r.token);
    setUser(r.user);
  };

  const value: AuthValue = {
    user,
    loading,
    login: async (email, password) => finish(await api.login(email, password)),
    register: async (data) => finish(await api.register(data)),
    logout: () => {
      tokenStore.clear();
      setUser(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Envolve páginas que exigem login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}
