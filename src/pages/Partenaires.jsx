import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import MediaDisplay from "@/components/MediaDisplay";
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search, Star, Share2, MessageSquare, Mail, ArrowLeft, Lock, MapPin } from 'lucide-react';
import { canUserAccess } from '@/lib/accessControl';
import FavoriteButton from '@/components/FavoriteButton';
import { applyAutoAccessProtection } from "@/lib/autoAccessWrapper";

const PartenaireDetail = ({ partenaire, onBack, onRecommander }) => {
  const { toast } = useToast();

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: partenaire.name,
        text: `Découvrez ${partenaire.name} sur OneKamer.co !`,
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert("La fonction de partage n'est pas supportée sur ce navigateur.");
    }
  };

  const handleOpenMaps = () => {
    if (!partenaire) return;

    const { latitude, longitude, address } = partenaire;

    if (latitude && longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
      window.open(url, "_blank");
      return;
    }

    if (address) {
      const encoded = encodeURIComponent(address);
      const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
      window.open(url, "_blank");
      return;
    }

    toast({
      title: 'Adresse indisponible',
      description: "Aucune information de localisation disponible pour ce partenaire.",
      variant: 'destructive',
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: '100%' }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: '100%' }}
      className="fixed inset-0 z-50 bg-gradient-to-br from-[#FDF9F9] to-[#CDE1D5] overflow-y-auto pt-16 pb-16"
    >
      <div className="container mx-auto px-4">
        <Button variant="ghost" onClick={onBack} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-2" /> Retour
        </Button>
        <Card className="shadow-xl rounded-2xl">
          {partenaire.media_url && (
            <MediaDisplay bucket="partenaires" path={partenaire.media_url} alt={partenaire.name || "Partenaire"} className="w-full h-48 object-cover rounded-t-2xl" />
          )}
          <CardHeader>
            <div className="flex justify-between items-start">
              <CardTitle className="text-2xl font-bold text-gray-800">{partenaire.name}</CardTitle>
              <span className="bg-yellow-100 text-yellow-800 text-xs font-semibold px-2.5 py-1 rounded-full">{partenaire.partenaires_categories?.nom || 'Partenaire'}</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-gray-600">{partenaire.description}</p>
            <div className="text-sm text-gray-500 space-y-2">
              <p><span className="font-semibold">Adresse:</span> {partenaire.address}</p>
              <p><span className="font-semibold">Téléphone:</span> <a href={`tel:${partenaire.phone}`} className="text-green-600">{partenaire.phone}</a></p>
              {partenaire.website && <p><span className="font-semibold">Site web:</span> <a href={partenaire.website} target="_blank" rel="noopener noreferrer" className="text-green-600">{partenaire.website}</a></p>}
            </div>
            <button
              onClick={handleOpenMaps}
              className="mt-3 bg-[#2BA84A] hover:bg-[#24903f] text-white px-3 py-2 rounded-md text-sm w-full"
            >
              
              📍 Ouvrir dans Google Maps
            </button>
            <p className="text-sm text-gray-500 italic border-t pt-4">Recommandé par: {partenaire.recommandation || 'la communauté'}</p>
            <div className="flex gap-2 pt-4 border-t">
              <Button onClick={() => onRecommander(partenaire.id)} className="flex-1">
                <Star className="w-4 h-4 mr-2" /> Recommander
              </Button>
              <Button onClick={handleShare} variant="outline" className="flex-1">
                <Share2 className="w-4 h-4 mr-2" /> Partager
              </Button>
            </div>
            <div className="flex gap-2">
              {partenaire.phone && (
                <a href={`sms:${partenaire.phone}`} className="flex-1">
                  <Button variant="secondary" className="w-full"><MessageSquare className="w-4 h-4 mr-2" /> Contacter par SMS</Button>
                </a>
              )}
              {partenaire.email && (
                <a href={`mailto:${partenaire.email}`} className="flex-1">
                  <Button variant="secondary" className="w-full"><Mail className="w-4 h-4 mr-2" /> Contacter par Email</Button>
                </a>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

const Partenaires = () => {
  const [partenaires, setPartenaires] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const suggestDebounceRef = useRef(null);
  const marketSyncRef = useRef(false);
  const [selectedPartenaire, setSelectedPartenaire] = useState(null);
  const { toast } = useToast();
  const { user, session, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [canCreate, setCanCreate] = useState(false);
  const [searchParams] = useSearchParams();
  const [marketPartner, setMarketPartner] = useState(null);
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketOnboarding, setMarketOnboarding] = useState(false);
  const serverLabUrl = import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com';

  // 🟢 Vérifie automatiquement les droits d'accès à la page "Partenaires"
  useEffect(() => {
    if (authLoading) return;
    applyAutoAccessProtection(user, navigate, window.location.pathname);
  }, [user, navigate, authLoading]);

  // 🟢 Vérifie si l'utilisateur peut créer un partenaire
  useEffect(() => {
    if (user) {
      canUserAccess(user, 'partenaires', 'create').then(setCanCreate);
    } else {
      setCanCreate(false);
    }
  }, [user]);

  const loadMarketPartner = useCallback(async () => {
    if (!user?.id) {
      setMarketPartner(null);
      return;
    }
    setMarketLoading(true);
    try {
      const { data, error } = await supabase
        .from('partners_market')
        .select('id, display_name, status, payout_status, stripe_connect_account_id')
        .eq('owner_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) {
        setMarketPartner(null);
      } else {
        setMarketPartner(Array.isArray(data) && data.length > 0 ? data[0] : null);
      }
    } finally {
      setMarketLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    loadMarketPartner();
  }, [authLoading, loadMarketPartner]);

  useEffect(() => {
    const sync = async () => {
      if (!marketPartner?.id) return;
      if (!marketPartner?.stripe_connect_account_id) return;
      if (String(marketPartner?.payout_status || '').toLowerCase() !== 'incomplete') return;
      if (!session?.access_token) return;
      if (marketSyncRef.current) return;

      marketSyncRef.current = true;
      try {
        const res = await fetch(`${serverLabUrl}/api/partner/connect/sync-status`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ partnerId: marketPartner.id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || 'sync_status_failed');
        }

        await loadMarketPartner();
      } catch (_e) {
        // Silent fail: on garde l'état actuel, l'utilisateur peut retenter via reload/retour onboarding
      } finally {
        marketSyncRef.current = false;
      }
    };

    sync();
  }, [marketPartner, session, serverLabUrl, loadMarketPartner]);

  const fetchPartenaires = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('view_partenaires_accessible').select('*, partenaires_categories(id, nom, industrie)');
    if (searchTerm) {
      query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
    }
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;
    if (error) {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de charger les partenaires.' });
      console.error(error);
    } else {
      setPartenaires(data);
    }
    setLoading(false);
  }, [searchTerm, toast]);

  useEffect(() => {
    fetchPartenaires();
  }, [fetchPartenaires]);

  useEffect(() => {
    if (!partenaires || partenaires.length === 0) return;
    const partnerId = searchParams.get('partnerId');
    if (!partnerId) return;
    const found = partenaires.find((p) => String(p.id) === String(partnerId));
    if (found) {
      setSelectedPartenaire(found);
    }
  }, [partenaires, searchParams]);

  // Autocomplete en temps réel (Partenaires uniquement)
  useEffect(() => {
    if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
    const term = searchTerm.trim();
    if (!term) { setSuggestions([]); return; }
    suggestDebounceRef.current = setTimeout(async () => {
      setSuggestLoading(true);
      const like = `%${term}%`;
      try {
        const { data, error } = await supabase
          .from('view_partenaires_accessible')
          .select('id, name, media_url, address')
          .ilike('name', like)
          .limit(8);
        setSuggestions(!error && Array.isArray(data) ? data : []);
      } catch {
        setSuggestions([]);
      }
      setSuggestLoading(false);
    }, 250);
    return () => { if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current); };
  }, [searchTerm]);

  const handleProposerClick = async () => {
    if (!user) {
        toast({
            title: "Connexion requise",
            variant: "destructive",
        });
        navigate("/auth");
        return;
    }
    if (await canUserAccess(user, 'partenaires', 'create')) {
      navigate('/publier/partenaire');
    } else {
      toast({
        title: "Accès restreint",
        description: "Cette fonctionnalité est réservée aux membres VIP.",
        variant: "destructive",
      });
      navigate("/forfaits");
    }
  };

  const handleRecommander = (partenaireId) => {
    toast({ title: 'Bientôt disponible', description: 'La fonctionnalité de recommandation sera bientôt activée.' });
  };

  const handleOpenMapsQuick = (e, partenaire) => {
    e.stopPropagation();
    if (!partenaire) return;

    const { latitude, longitude, address } = partenaire;

    if (latitude && longitude) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
      window.open(url, "_blank");
      return;
    }

    if (address) {
      const encoded = encodeURIComponent(address);
      const url = `https://www.google.com/maps/search/?api=1&query=${encoded}`;
      window.open(url, "_blank");
      return;
    }

    toast({
      title: 'Adresse indisponible',
      description: "Aucune information de localisation disponible pour ce partenaire.",
      variant: 'destructive',
    });
  };

  return (
  <>
    <Helmet>
      <title>Partenaires - OneKamer.co</title>
      <meta name="description" content="Découvrez les partenaires de confiance de la communauté OneKamer." />
    </Helmet>

    <AnimatePresence>
      {selectedPartenaire && (
        <PartenaireDetail 
          partenaire={selectedPartenaire} 
          onBack={() => setSelectedPartenaire(null)} 
          onRecommander={handleRecommander}
        />
      )}
    </AnimatePresence>
      
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl font-bold text-[#2BA84A]"
          >
            Partenaires
          </motion.h1>
          <Button onClick={handleProposerClick} disabled={!canCreate}>
            {canCreate ? <Plus className="w-4 h-4 mr-2" /> : <Lock className="w-4 h-4 mr-2" />}
            {canCreate ? 'Proposer' : 'Verrouillé'}
          </Button>
        </div>

        {user && (
          <Card>
            <CardHeader className="p-4">
              <CardTitle className="text-base">Espace partenaire (Marketplace)</CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-0 space-y-3 text-sm">
              {marketLoading ? (
                <div className="text-gray-600">Chargement…</div>
              ) : !marketPartner ? (
                <div className="text-gray-600">
                  Aucun espace partenaire marketplace lié à ton compte pour le moment.
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-800">{marketPartner.display_name || 'Mon partenaire'}</div>
                    <div className="text-gray-600">Statut: {marketPartner.status || '—'}</div>
                    <div className="text-gray-600">Paiements: {marketPartner.payout_status || '—'}</div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      type="button"
                      disabled={marketOnboarding || !session?.access_token}
                      onClick={async () => {
                        if (!session?.access_token) {
                          toast({
                            title: 'Connexion requise',
                            description: "Impossible de récupérer la session. Réessaie après reconnexion.",
                            variant: 'destructive',
                          });
                          return;
                        }

                        setMarketOnboarding(true);
                        try {
                          const res = await fetch(`${serverLabUrl}/api/partner/connect/onboarding-link`, {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${session.access_token}`,
                            },
                            body: JSON.stringify({ partnerId: marketPartner.id }),
                          });

                          const data = await res.json();
                          if (!res.ok) {
                            throw new Error(data?.error || "Impossible de générer le lien d'onboarding");
                          }

                          if (data?.url) {
                            window.location.href = data.url;
                          } else {
                            throw new Error("Lien d'onboarding manquant");
                          }
                        } catch (e) {
                          toast({
                            title: 'Erreur',
                            description: e?.message || "Impossible de démarrer l'onboarding Stripe",
                            variant: 'destructive',
                          });
                        } finally {
                          setMarketOnboarding(false);
                        }
                      }}
                      className="sm:w-fit"
                    >
                      {marketOnboarding ? 'Redirection…' : 'Activer les paiements'}
                    </Button>
                    {marketPartner.stripe_connect_account_id ? (
                      <div className="text-xs text-gray-500 self-center">
                        Compte Stripe: {marketPartner.stripe_connect_account_id}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-500 self-center">Compte Stripe: non lié</div>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <Input 
            placeholder="Rechercher un partenaire..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
          {searchTerm.trim() && (
            <div className="mt-2 space-y-2">
              {suggestLoading && (
                <div className="text-sm text-gray-500">Chargement...</div>
              )}
              {!suggestLoading && suggestions.length > 0 && (
                <div className="space-y-2">
                  {suggestions.map((s) => (
                    <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onClick={() => setSearchTerm(s.name)}>
                      <div className="w-10 h-10 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                        <MediaDisplay bucket="partenaires" path={s.media_url} alt={s.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{s.name}</div>
                        <div className="text-xs text-gray-600 truncate">Partenaire</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-green-500"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partenaires.map((partenaire, index) => (
              <motion.div
                key={partenaire.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedPartenaire(partenaire)}
                className="cursor-pointer"
              >
                <Card className="relative overflow-hidden hover:shadow-xl transition-shadow h-full flex flex-col group">
                  <div className="h-40 w-full relative">
                    <MediaDisplay
                      bucket="partenaires"
                      path={partenaire.media_url}
                      alt={partenaire.name || "Partenaire"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <CardHeader className="p-4">
                    <CardTitle className="text-lg font-semibold">{partenaire.name}</CardTitle>
                    <p className="text-sm text-gray-600 flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M12 18.7c-3.3 0-6-2.7-6-6s2.7-6 6-6 6 2.7 6 6-2.7 6-6 6z"/><circle cx="12" cy="12" r="2"/><path d="M12 22s-8-4-8-10c0-4.4 3.6-8 8-8s8 3.6 8 8c0 6-8 10-8 10z"/></svg>
                      {partenaire.address}
                    </p>
                  </CardHeader>
                  <CardContent className="flex justify-around border-t pt-4 pb-3">
                    <Button
                      onClick={(e) => handleOpenMapsQuick(e, partenaire)}
                      className="bg-[#2BA84A] hover:bg-[#24903f] text-white px-4 py-2 rounded-full flex items-center gap-2 text-sm"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>S'y rendre</span>
                    </Button>
                    <Button variant="ghost" size="icon">
                      <MessageSquare className="w-5 h-5 text-[#2BA84A]" />
                    </Button>
                    <Button variant="ghost" size="icon">
                      <Mail className="w-5 h-5 text-[#2BA84A]" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
            </div>
  </>
);
};

export default Partenaires;
