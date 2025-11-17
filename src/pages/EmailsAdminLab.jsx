import React, { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const EmailsAdminLab = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [adminSubject, setAdminSubject] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminEmails, setAdminEmails] = useState('');
  const [adminSending, setAdminSending] = useState(false);

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = profile.role === 'admin';
  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  const adminApiToken = import.meta.env.VITE_ADMIN_API_TOKEN_LAB;
  const serverLabUrl = import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com';

  return (
    <>
      <Helmet>
        <title>Emails admin (LAB) - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Envoyer des emails (LAB)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!adminApiToken && (
              <p className="text-red-500 text-xs font-medium">
                Le token admin LAB n'est pas configuré (VITE_ADMIN_API_TOKEN_LAB).
              </p>
            )}

            <div className="space-y-1">
              <label className="block font-medium">Sujet</label>
              <input
                type="text"
                className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                value={adminSubject}
                onChange={(e) => setAdminSubject(e.target.value)}
                placeholder="Sujet de l'email"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium">Message</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[200px] focus:outline-none focus:ring focus:ring-green-500/40"
                value={adminMessage}
                onChange={(e) => setAdminMessage(e.target.value)}
                placeholder="Contenu de l'email"
              />
            </div>

            <div className="space-y-1">
              <label className="block font-medium">Emails (séparés par des virgules)</label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm min-h-[120px] focus:outline-none focus:ring focus:ring-green-500/40"
                value={adminEmails}
                onChange={(e) => setAdminEmails(e.target.value)}
                placeholder="ex: contact@onekamer.co, william@ndamboa.com"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                type="button"
                disabled={adminSending}
                onClick={async () => {
                  if (!adminApiToken) {
                    toast({
                      title: 'Configuration manquante',
                      description: "VITE_ADMIN_API_TOKEN_LAB n'est pas défini.",
                      variant: 'destructive',
                    });
                    return;
                  }

                  const emails = adminEmails
                    .split(',')
                    .map((e) => e.trim())
                    .filter((e) => e.length > 0);

                  if (!adminSubject || !adminMessage || emails.length === 0) {
                    toast({
                      title: 'Champs incomplets',
                      description: 'Sujet, message et au moins un email sont requis.',
                      variant: 'destructive',
                    });
                    return;
                  }

                  setAdminSending(true);
                  try {
                    const res = await fetch(`${serverLabUrl}/admin/email/enqueue-info-all-users`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-admin-token': adminApiToken,
                      },
                      body: JSON.stringify({
                        subject: adminSubject,
                        message: adminMessage,
                        emails,
                      }),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data?.error || 'Erreur lors de la création des emails');
                    }

                    toast({
                      title: 'Emails créés',
                      description: `${data.inserted || 0} emails en file (mode: ${data.mode || 'profiles'})`,
                    });
                  } catch (error) {
                    console.error(error);
                    toast({
                      title: 'Erreur',
                      description: error.message || 'Impossible de créer les emails.',
                      variant: 'destructive',
                    });
                  } finally {
                    setAdminSending(false);
                  }
                }}
                className="flex-1"
              >
                {adminSending ? 'Envoi en cours...' : 'Créer les emails'}
              </Button>

              <Button
                type="button"
                variant="outline"
                disabled={adminSending}
                onClick={async () => {
                  if (!adminApiToken) {
                    toast({
                      title: 'Configuration manquante',
                      description: "VITE_ADMIN_API_TOKEN_LAB n'est pas défini.",
                      variant: 'destructive',
                    });
                    return;
                  }

                  setAdminSending(true);
                  try {
                    const res = await fetch(`${serverLabUrl}/admin/email/process-jobs`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-admin-token': adminApiToken,
                      },
                      body: JSON.stringify({ limit: 50 }),
                    });

                    const data = await res.json();
                    if (!res.ok) {
                      throw new Error(data?.error || 'Erreur lors du traitement des emails');
                    }

                    toast({
                      title: 'Traitement des emails',
                      description: `Emails envoyés: ${data.sent || 0}, erreurs: ${data.errors?.length || 0}`,
                    });
                  } catch (error) {
                    console.error(error);
                    toast({
                      title: 'Erreur',
                      description: error.message || 'Impossible de traiter les emails.',
                      variant: 'destructive',
                    });
                  } finally {
                    setAdminSending(false);
                  }
                }}
                className="flex-1"
              >
                Traiter les emails
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default EmailsAdminLab;
