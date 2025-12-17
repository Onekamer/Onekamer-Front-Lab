import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

const ModerationAdminLab = () => {
  const { user, profile, session } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = profile.role === 'admin' || Boolean(profile.is_admin);
  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  const API_PREFIX = import.meta.env.VITE_API_URL || '/api';

  useEffect(() => {
    const run = async () => {
      try {
        setLoading(true);
        const token = session?.access_token;
        if (!token) throw new Error('Session expirée');

        const res = await fetch(`${API_PREFIX}/admin/moderation/actions?limit=100&offset=0`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur chargement historique');
        setItems(Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [API_PREFIX, session]);

  return (
    <>
      <Helmet>
        <title>Modération (LAB) - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Historique Modération (LAB)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" />
              </div>
            ) : items.length === 0 ? (
              <p className="text-gray-600">Aucune action de modération pour le moment.</p>
            ) : (
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.id} className="border rounded p-3">
                    <div className="flex justify-between gap-3">
                      <div className="font-semibold">
                        {it.action_type} — {it.reason}
                      </div>
                      <div className="text-xs text-gray-500">
                        {it.created_at ? new Date(it.created_at).toLocaleString() : ''}
                      </div>
                    </div>

                    <div className="mt-1 text-xs text-gray-600">
                      Auteur: <span className="font-medium">{it.target_username || it.target_user_id}</span>
                    </div>
                    <div className="text-xs text-gray-600">
                      Admin: <span className="font-medium">{it.admin_username || it.admin_user_id}</span>
                    </div>

                    <div className="mt-2 whitespace-pre-wrap">{it.message}</div>

                    <div className="mt-2 text-xs text-gray-600">
                      Notif: <span className="font-medium">{it.notification_sent ? 'OK' : 'KO'}</span>
                      {' • '}Email: <span className="font-medium">{it.email_sent ? 'OK' : 'KO'}</span>
                      {it.delivery_error ? (
                        <>
                          {' • '}Erreur: <span className="font-medium">{it.delivery_error}</span>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default ModerationAdminLab;
