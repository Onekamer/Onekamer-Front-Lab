import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/SupabaseAuthContext";

export const useProtectedPage = () => {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  // Redirection synchronisée avant le montage complet pour éviter les effets et requêtes inutiles
  if (!loading && !session && typeof window !== "undefined") {
    const originalConsoleError = console.error;
    console.error = () => {};
    window.location.replace("/login");
    // Pas de restauration nécessaire, la navigation remplace la page
  }

  useEffect(() => {
    if (!loading && !session) {
      console.clear();
      navigate("/login", { replace: true });
    }
  }, [session, loading, navigate]);

  return session;
};
