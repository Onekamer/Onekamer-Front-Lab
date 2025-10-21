import React, { useEffect } from "react";
import { useAuth } from "@/contexts/SupabaseAuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { redirectIfNoAccess } from "./accessRedirect";

export default function AutoAccessWrapper({ children }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const applyAutoAccessProtection = async () => {
      if (loading) return;

      const pathRules = [
        { path: "/rencontre", section: "rencontre", action: "read" },
        { path: "/publier/evenement", section: "evenements", action: "create" },
        { path: "/publier/annonce", section: "annonces", action: "create" },
        { path: "/partenaires", section: "partenaires", action: "read" },
      ];

      for (const rule of pathRules) {
        if (
          location.pathname.startsWith(rule.path) &&
          location.pathname !== "/rencontre/profil" &&
          location.pathname !== "/rencontre/messages"
        ) {
          await redirectIfNoAccess(user, navigate, rule.section, rule.action);
          break;
        }
      }
    };

    applyAutoAccessProtection();
  }, [user, loading, navigate, location]);

  if (loading) {
  return (
    <div className="flex justify-center items-center h-screen">
      <p className="text-gray-500">Chargement...</p>
    </div>
  );
}

return <>{children}</>;
}

