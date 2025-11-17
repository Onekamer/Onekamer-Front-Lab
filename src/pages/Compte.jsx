import React, { useState, useEffect } from 'react';

import { Helmet } from 'react-helmet';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { LogOut, ChevronRight, Coins, ShieldCheck, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import MediaDisplay from '@/components/MediaDisplay';

const Compte = () => {
  const { user, profile, signOut, balance, loading } = useAuth();
  const navigate = useNavigate();
  const [adminSubject, setAdminSubject] = useState('');
  const [adminMessage, setAdminMessage] = useState('');
  const [adminEmails, setAdminEmails] = useState('');
  const [adminSending, setAdminSending] = useState(false);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = profile.role === 'admin';

  const adminApiToken = import.meta.env.VITE_ADMIN_API_TOKEN_LAB;
  const serverLabUrl = import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com';

  const handleLogout = async () => {
    const { error } = await signOut();
    if (!error) {
      navigate('/');
      toast({
        title: "Déconnexion réussie",
        description: "À bientôt sur OneKamer.co !",
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Mon Compte - OneKamer.co</title>
        <meta name="description" content="Gérez votre profil, vos forfaits et vos paramètres sur OneKamer.co." />
      </Helmet>

      <div className="space-y-6">
        <div className="flex flex-col items-center space-y-4">
          <Avatar className="w-24 h-24 border-4 border-[#2BA84A]">
            {profile.avatar_url ? (
              <MediaDisplay
                bucket="avatars"
                path={profile.avatar_url}
                alt={profile.username}
                className="rounded-full w-full h-full object-cover"
              />
            ) : (
              <AvatarFallback className="text-3xl bg-gray-200">{profile.username?.charAt(0).toUpperCase()}</AvatarFallback>
            )}
          </Avatar>
          <div className="text-center">
            <h1 className="text-2xl font-bold">{profile.username}</h1>
            <p className="text-sm text-gray-500">{user.email}</p>
          </div>
          <p className="text-center text-gray-600 max-w-md">{profile.bio || "Aucune biographie pour le moment."}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Mes Badges</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <div className="bg-purple-100 text-purple-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3"/> Niveau 1 - Bronze
            </div>
            <div className="bg-blue-100 text-blue-700 text-xs font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3 h-3"/> {profile.plan || 'Free'}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4">
          <Card className="text-center">
            <CardHeader>
              <CardTitle className="text-lg">Forfait</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#2BA84A] capitalize">{profile.plan || 'Free'}</p>
            </CardContent>
          </Card>
          <Card className="text-center cursor-pointer" onClick={() => navigate('/ok-coins')}>
            <CardHeader>
              <CardTitle className="text-lg">OK Coins</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-[#F5C300] flex items-center justify-center gap-2">
                <Coins className="w-6 h-6"/> {balance ? balance.coins_balance.toLocaleString() : 0}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Paramètres</CardTitle>
          </CardHeader>
          <CardContent className="divide-y">
            <MenuItem onClick={() => navigate('/compte/modifier')} title="Modifier le profil" />
            <MenuItem onClick={() => navigate('/compte/notifications')} title="Notifications" />
            <MenuItem onClick={() => navigate('/compte/favoris')} title="Mes favoris" />
            <MenuItem onClick={() => navigate('/compte/confidentialite')} title="Confidentialité" />
            <MenuItem onClick={() => navigate('/forfaits')} title="Changer de forfait" />
          </CardContent>
        </Card>

        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Emails admin (LAB)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              {!adminApiToken && (
                <p className="text-red-500 text-xs font-medium">
                  Le token admin LAB n&#39;est pas configuré (VITE_ADMIN_API_TOKEN_LAB).
                </p>
              )}

              <div className="space-y-1">
                <label className="block font-medium">Sujet</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring focus:ring-green-500/40"
                  value={adminSubject}
                  onChange={(e) => setAdminSubject(e.target.value)}
                  placeholder="Sujet de l&#39;email"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-medium">Message</label>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm min-h-[80px] focus:outline-none focus:ring focus:ring-green-500/40"
                  value={adminMessage}
                  onChange={(e) => setAdminMessage(e.target.value)}
                  placeholder="Contenu de l&#39;email"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-medium">Emails (séparés par des virgules)</label>
                <textarea
                  className="w-full border rounded px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring focus:ring-green-500/40"
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
                        title: "Configuration manquante",
                        description: "VITE_ADMIN_API_TOKEN_LAB n&#39;est pas défini.",
                        variant: "destructive",
                      });
                      return;
                    }

                    const emails = adminEmails
                      .split(',')
                      .map((e) => e.trim())
                      .filter((e) => e.length > 0);

                    if (!adminSubject || !adminMessage || emails.length === 0) {
                      toast({
                        title: "Champs incomplets",
                        description: "Sujet, message et au moins un email sont requis.",
                        variant: "destructive",
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
                        title: "Emails créés",
                        description: `${data.inserted || 0} emails en file (mode: ${data.mode || 'profiles'})`,
                      });
                    } catch (error) {
                      console.error(error);
                      toast({
                        title: "Erreur",
                        description: error.message || 'Impossible de créer les emails.',
                        variant: "destructive",
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
                        title: "Configuration manquante",
                        description: "VITE_ADMIN_API_TOKEN_LAB n&#39;est pas défini.",
                        variant: "destructive",
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
                        title: "Traitement des emails",
                        description: `Emails envoyés: ${data.sent || 0}, erreurs: ${data.errors?.length || 0}`,
                      });
                    } catch (error) {
                      console.error(error);
                      toast({
                        title: "Erreur",
                        description: error.message || 'Impossible de traiter les emails.',
                        variant: "destructive",
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
        )}

        <div className="flex justify-center">
          <Button variant="destructive" onClick={handleLogout} className="w-full max-w-sm">
            <LogOut className="mr-2 h-4 w-4" /> Se déconnecter
          </Button>
        </div>
      </div>
    </>
  );
};

const MenuItem = ({ onClick, title }) => (
  <button onClick={onClick} className="w-full flex justify-between items-center py-4 text-left">
    <span className="font-medium">{title}</span>
    <ChevronRight className="h-5 w-5 text-gray-400" />
  </button>
);

export default Compte;