import React, { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const AuthCallback = () => {
  const navigate = useNavigate();

  const params = useMemo(() => {
    const h = (typeof window !== 'undefined' ? window.location.hash : '') || '';
    const q = (typeof window !== 'undefined' ? window.location.search : '') || '';
    const search = new URLSearchParams(q.startsWith('?') ? q : '');
    const hash = new URLSearchParams(h.startsWith('#') ? h.slice(1) : '');

    const access_token = hash.get('access_token') || search.get('access_token') || '';
    const type = hash.get('type') || search.get('type') || '';
    const error = search.get('error') || hash.get('error') || '';
    const error_description = search.get('error_description') || hash.get('error_description') || '';
    return { access_token, type, error, error_description };
  }, []);

  useEffect(() => {
    if (params.access_token) {
      sessionStorage.setItem('ok_reset_access_token', params.access_token);
      sessionStorage.setItem('ok_reset_type', params.type || 'recovery');
    }
  }, [params]);

  const handleContinue = () => {
    const token = sessionStorage.getItem('ok_reset_access_token') || params.access_token || '';
    const type = sessionStorage.getItem('ok_reset_type') || params.type || 'recovery';

    if (!token) {
      navigate('/auth', { replace: true });
      return;
    }

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const redirectTo = encodeURIComponent(`${window.location.origin}/reset-password`);
    const verifyUrl = `${supabaseUrl}/auth/v1/verify?token=${encodeURIComponent(token)}&type=${encodeURIComponent(type)}&redirect_to=${redirectTo}`;

    window.location.replace(verifyUrl);
  };

  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Connexion sécurisée</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {params.error ? (
            <>
              <p className="text-red-600 font-medium">Erreur: {params.error}</p>
              {params.error_description ? <p className="text-sm">{params.error_description}</p> : null}
              <Button className="w-full" onClick={() => navigate('/auth')}>Renvoyer le lien</Button>
            </>
          ) : (
            <>
              <p>Appuyez sur Continuer pour finaliser la réinitialisation.</p>
              <Button className="w-full" onClick={handleContinue}>Continuer</Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;