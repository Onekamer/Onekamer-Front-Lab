import React, { useState, useEffect, useCallback, useRef } from 'react';
    import { Helmet } from 'react-helmet';
    import { motion, AnimatePresence } from 'framer-motion';
    import { Card, CardContent } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Search, Share2, MapPin, ArrowLeft, Phone, MessageSquare, Mail, Plus, Loader2, Trash2, Euro, Pencil } from 'lucide-react';
    import { useToast } from '@/components/ui/use-toast';
    import { useNavigate, useSearchParams } from 'react-router-dom';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import MediaDisplay from '@/components/MediaDisplay';
    import FavoriteButton from '@/components/FavoriteButton';
    import { canUserAccess } from '@/lib/accessControl';
    import { applyAutoAccessProtection } from "@/lib/autoAccessWrapper";

    const formatPrice = (price, devise) => {
        const priceNumber = parseFloat(price);
        if (isNaN(priceNumber) || priceNumber <= 0) {
            return 'Gratuit';
        }
        const symbol = devise?.symbole || '€';
        return `${priceNumber.toFixed(2).replace('.', ',')} ${symbol}`;
    };

    const AnnonceDetail = ({ annonce, onBack, onDelete, onEdit, apiPrefix, session }) => {
      const { user, profile } = useAuth();
      const { toast } = useToast();
      const navigate = useNavigate();
      const isOwner = user?.id === annonce.user_id;
      const isAdmin = profile?.is_admin === true || profile?.is_admin === 1 || profile?.is_admin === 'true' || String(profile?.role || '').toLowerCase() === 'admin';

      const [interestLoading, setInterestLoading] = useState(true);
      const [interested, setInterested] = useState(false);
      const [interestCount, setInterestCount] = useState(0);

      useEffect(() => {
        let mounted = true;
        (async () => {
          try {
            if (!user || !annonce?.id || !apiPrefix) { setInterestLoading(false); return; }
            const token = session?.access_token;
            if (!token) { setInterestLoading(false); return; }
            const res = await fetch(`${apiPrefix}/annonces/${encodeURIComponent(String(annonce.id))}/interest/status`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (mounted && res.ok) {
              setInterested(!!data?.interested);
              setInterestCount(Number(data?.interests_count || 0));
            } else if (mounted) {
              // Fallback: lecture directe Supabase si la route n'est pas dispo
              try {
                const { data: ann } = await supabase
                  .from('annonces')
                  .select('id, interests_count')
                  .eq('id', annonce.id)
                  .maybeSingle();
                setInterestCount(Number(ann?.interests_count || 0));
              } catch {}
              try {
                const { data: row } = await supabase
                  .from('annonces_interests')
                  .select('id')
                  .eq('annonce_id', annonce.id)
                  .eq('user_id', user.id)
                  .maybeSingle();
                setInterested(!!row);
              } catch {}
            }
          } catch {}
          if (mounted) setInterestLoading(false);
        })();
        return () => { mounted = false };
      }, [user, session, apiPrefix, annonce?.id]);

      const handleToggleInterest = async (e) => {
        e.stopPropagation();
        try {
          if (!user) {
            toast({ title: 'Connexion requise', description: 'Connectez-vous pour indiquer votre intérêt.', variant: 'destructive' });
            return;
          }
          const token = session?.access_token;
          if (!token) throw new Error('Session expirée');
          const res = await fetch(`${apiPrefix}/annonces/${encodeURIComponent(String(annonce.id))}/interest`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
          setInterested(!!data?.interested);
          setInterestCount(Number(data?.interests_count || 0));
        } catch (err) {
          toast({ title: 'Erreur', description: err?.message || 'Impossible de mettre à jour.', variant: 'destructive' });
        }
      };

      const handleShare = async () => {
        const shareData = {
          title: annonce.titre,
          text: annonce.description,
          url: window.location.href,
        };
        if (navigator.share) {
          try {
            await navigator.share(shareData);
          } catch (err) {
            if (err.name !== 'AbortError') {
              toast({ title: "Erreur de partage", description: err.message, variant: "destructive" });
            }
          }
        } else {
          toast({ title: "Partage non disponible", description: "Votre navigateur ne supporte pas le partage natif." });
        }
      };

      const navigateToProfile = (e) => {
        e.stopPropagation();
        if(annonce.user_id) {
            navigate(`/profil/${annonce.user_id}`);
        }
      }

      return (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-gradient-to-br from-[#FDF9F9] to-[#CDE1D5] overflow-y-auto"
        >
          <div className="relative">
            <MediaDisplay bucket="annonces" path={annonce.media_url} alt={annonce.titre} className="w-full h-64 object-cover" />
            <div className="absolute top-4 left-4 z-20">
              <button onClick={onBack} className="bg-white/80 backdrop-blur-sm rounded-full p-2 shadow-md">
                <ArrowLeft className="h-6 w-6 text-gray-800" />
              </button>
            </div>
             <div className="absolute top-4 right-4 flex items-center gap-2 z-20">
                <FavoriteButton contentType="annonce" contentId={annonce.id} />
                <Button variant="outline" size="sm" onClick={handleToggleInterest} disabled={interestLoading} className="bg-white/80 backdrop-blur-sm">
                  {interested ? 'Je ne suis plus intéressé(e)' : 'Je suis intéressé(e)'}{!interestLoading ? ` (${interestCount})` : ''}
                </Button>
                {(isOwner || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-gray-700 bg-white/80 backdrop-blur-sm rounded-full h-8 w-8"
                    onClick={() => onEdit(annonce.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {(isOwner || isAdmin) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-red-500 bg-white/80 backdrop-blur-sm rounded-full h-8 w-8"
                    onClick={async () => {
                      await onDelete(annonce.id, annonce.media_url);
                      onBack();
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={handleShare} className="bg-white/80 backdrop-blur-sm rounded-full h-8 w-8"><Share2 className="h-4 w-4 text-gray-500" /></Button>
            </div>
          </div>
          <div className="p-4 -mt-8">
            <Card className="shadow-xl rounded-2xl relative">
              <CardContent className="p-6 space-y-4 pt-6">
                
                <div className="space-y-1">
                    <span className="bg-[#CDE1D5] text-[#2BA84A] text-xs font-semibold px-2.5 py-1 rounded-full">{annonce.annonces_categories?.nom || 'Catégorie'}</span>
                    <h1 className="text-2xl font-bold text-gray-800 pt-2">{annonce.titre}</h1>
                    <p className="text-sm text-gray-500">
                      par <span className="font-semibold text-gray-700 cursor-pointer hover:underline" onClick={navigateToProfile}>{annonce.profiles?.username || 'un membre'}</span>
                    </p>
                </div>
                
                <div>
                  <p className="text-3xl font-bold text-[#2BA84A]">{formatPrice(annonce.prix, annonce.devises)}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                    <MapPin className="h-4 w-4" />
                    <span>{annonce.villes?.nom}, {annonce.pays?.nom}</span>
                  </div>
                </div>

                <div>
                  <h2 className="font-semibold text-gray-800 mb-1">Description</h2>
                  <p className="text-gray-600 text-sm">{annonce.description}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2">
                  {annonce.telephone && (
                    <a href={`tel:${annonce.telephone}`} target="_blank" rel="noopener noreferrer" className="w-full">
                      <Button variant="outline" className="flex items-center gap-2 w-full">
                        <Phone className="h-4 w-4" /> Appeler
                      </Button>
                    </a>
                  )}
                  {annonce.telephone && (
                    <a href={`https://wa.me/${annonce.telephone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="w-full">
                      <Button className="flex items-center gap-2 w-full bg-[#25D366] hover:bg-[#25D366]/90 text-white">
                        <MessageSquare className="h-4 w-4" /> WhatsApp
                      </Button>
                    </a>
                  )}
                  {annonce.email && (
                    <a href={`mailto:${annonce.email}`} target="_blank" rel="noopener noreferrer" className="w-full">
                      <Button variant="outline" className="flex items-center gap-2 w-full">
                        <Mail className="h-4 w-4" /> Email
                      </Button>
                    </a>
                  )}
                </div>
                
                <p className="text-center text-xs text-gray-400 pt-2">Publié le {new Date(annonce.created_at).toLocaleDateString()}</p>
              </CardContent>
            </Card>
          </div>
        </motion.div>
      );
    };

    const AnnonceCard = ({ annonce, onSelect }) => {
        const { toast } = useToast();
        const handleShare = async (e) => {
            e.stopPropagation();
            const shareData = { title: annonce.titre, text: annonce.description, url: window.location.href };
            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                } catch (err) {
                   if (err.name !== 'AbortError') {
                     toast({ title: "Erreur de partage", description: err.message, variant: "destructive" });
                   }
                }
            } else {
                toast({ title: "Partage non disponible", description: "Votre navigateur ne supporte pas le partage natif." });
            }
        };

        return (
            <Card onClick={() => onSelect(annonce)} className="cursor-pointer group overflow-hidden shadow-md hover:shadow-xl transition-shadow duration-300 h-full flex flex-col rounded-lg">
                <div className="relative h-48 bg-gray-200">
                    <MediaDisplay bucket="annonces" path={annonce.media_url} alt={annonce.titre} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                    <div className="relative p-2 h-full flex flex-col justify-between">
                        <div className="flex justify-between items-start">
                            <div className="bg-[#E0222A] text-white px-3 py-1 rounded-full text-xs font-semibold">{annonce.annonces_categories?.nom || 'Catégorie'}</div>
                            <div className="flex items-center gap-2">
                                <FavoriteButton contentType="annonce" contentId={annonce.id} />
                                <Button variant="ghost" size="icon" onClick={handleShare} className="text-white bg-black/20 hover:bg-black/40 rounded-full h-8 w-8">
                                    <Share2 className="h-4 w-4" />
                                </Button>
                        </div>
                    </div>
                    <div>
                        <h3 className="text-white font-bold text-lg truncate">{annonce.titre}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-200"><MapPin className="h-4 w-4" />{annonce.villes?.nom || 'Lieu non spécifié'}</div>
                    </div>
                </div>
            </div>
            <CardContent className="p-4 flex-grow flex flex-col justify-between">
                <span className="text-2xl font-bold text-[#2BA84A] mb-2">{formatPrice(annonce.prix, annonce.devises)}</span>
                <div className="grid grid-cols-2 gap-2 w-full">
                    {annonce.telephone && (
                        <a href={`https://wa.me/${annonce.telephone.replace(/\D/g, '')}`} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="w-full bg-[#25D366]/10 border-[#25D366] text-[#25D366] hover:bg-[#25D366]/20">
                                <MessageSquare className="h-4 w-4" />
                            </Button>
                        </a>
                    )}
                    {annonce.email && (
                        <a href={`mailto:${annonce.email}`} onClick={e => e.stopPropagation()} target="_blank" rel="noopener noreferrer">
                            <Button variant="outline" size="sm" className="w-full">
                                <Mail className="h-4 w-4" />
                            </Button>
                        </a>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

const Annonces = () => {
    const [annonces, setAnnonces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAnnonce, setSelectedAnnonce] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [suggestLoading, setSuggestLoading] = useState(false);
    const suggestDebounceRef = useRef(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user, profile, session, loading: authLoading } = useAuth();
    const { toast } = useToast();
    const [canCreateAd, setCanCreateAd] = useState(false);

    const API_BASE_URL = (import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com').replace(/\/$/, '');
    const API_PREFIX = `${API_BASE_URL}/api`;

    // Vérifie automatiquement les droits d'accès à la page "Annonces"
    useEffect(() => {
        if (authLoading) return;
        applyAutoAccessProtection(user, navigate, window.location.pathname);
    }, [user, navigate, authLoading]);

    // Vérifie si l'utilisateur peut créer une annonce
    useEffect(() => {
        if (user) {
            canUserAccess(user, "annonces", "create").then(setCanCreateAd);
        } else {
            setCanCreateAd(false);
        }
    }, [user]);

    const fetchAnnonces = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('view_annonces_accessible')
            .select('*, annonces_categories(nom), pays(nom), villes(nom), profiles(username, avatar_url), devises(symbole)')
            .order('created_at', { ascending: false });

        if (error) {
            toast({ title: "Erreur de chargement", description: error.message, variant: "destructive" });
            setAnnonces([]);
        } else {
            setAnnonces(data);
        }
        setLoading(false);
    }, [toast]);

    useEffect(() => {
        fetchAnnonces();

        const channel = supabase.channel('realtime:public:annonces')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'annonces' }, (payload) => {
                fetchAnnonces();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        }
    }, [fetchAnnonces]);

    useEffect(() => {
        if (!annonces || annonces.length === 0) return;
        const annonceId = searchParams.get('annonceId');
        if (!annonceId) return;
        const found = annonces.find((ann) => String(ann.id) === String(annonceId));
        if (found) {
            setSelectedAnnonce(found);
        }
    }, [annonces, searchParams]);

    const handleDelete = async (annonceId, mediaPath) => {
        if (!user) return;
        try {
            const isAdmin = profile?.is_admin === true || profile?.is_admin === 1 || profile?.is_admin === 'true' || String(profile?.role || '').toLowerCase() === 'admin';
            const isOwner = user?.id && annonces.find((a) => a.id === annonceId)?.user_id === user.id;

            if (isAdmin && !isOwner) {
              const token = session?.access_token;
              if (!token) throw new Error('Session expirée');
              const res = await fetch(`${API_PREFIX}/admin/annonces/${encodeURIComponent(annonceId)}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(data?.error || 'Erreur serveur');
              toast({ title: 'Succès', description: 'Annonce supprimée (admin).' });
              setAnnonces((prev) => (prev || []).filter((a) => a.id !== annonceId));
              return;
            }

            if (mediaPath) {
                const { error } = await supabase.storage.from('annonces').remove([mediaPath]);
                if (error) console.warn("Storage deletion warning:", error.message);
            }

            const { error: dbError } = await supabase.from('annonces').delete().eq('id', annonceId);
            if (dbError) throw dbError;

            toast({ title: 'Succès', description: 'Annonce supprimée.' });
            setAnnonces((prev) => (prev || []).filter((a) => a.id !== annonceId));
        } catch (error) {
            toast({ title: "Erreur de suppression", description: error.message, variant: "destructive" });
        }
    };

    const handleEdit = (annonceId) => {
      navigate(`/publier/annonce?annonceId=${encodeURIComponent(annonceId)}`);
    };

    const handleCreateClick = async () => {
        if (!user) {
            toast({ title: "Connexion requise", description: "Veuillez vous connecter pour publier.", variant: "destructive" });
            return;
        }
        if (canCreateAd) {
          navigate('/publier/annonce');
        } else {
          const allowed = await canUserAccess(user, 'annonces', 'create');
          if (allowed) {
            navigate('/publier/annonce');
          } else {
            toast({title: "Accès restreint", description: "Passez VIP pour créer une annonce.", variant: "destructive"});
            navigate('/forfaits');
          }
        }
      }

      const filteredAnnonces = annonces.filter(annonce => 
        (annonce.titre?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (annonce.annonces_categories?.nom?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (annonce.villes?.nom?.toLowerCase() || '').includes(searchTerm.toLowerCase())
      );

      // Autocomplete en temps réel (Annonces uniquement)
      useEffect(() => {
        if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current);
        const term = searchTerm.trim();
        if (!term) { setSuggestions([]); return; }
        suggestDebounceRef.current = setTimeout(async () => {
          setSuggestLoading(true);
          const like = `%${term}%`;
          try {
            const { data, error } = await supabase
              .from('view_annonces_accessible')
              .select('id, titre, media_url')
              .ilike('titre', like)
              .limit(8);
            setSuggestions(!error && Array.isArray(data) ? data : []);
          } catch {
            setSuggestions([]);
          }
          setSuggestLoading(false);
        }, 250);
        return () => { if (suggestDebounceRef.current) clearTimeout(suggestDebounceRef.current); };
      }, [searchTerm]);

      return (
  <>
    <Helmet>
      <title>Annonces - OneKamer.co</title>
      <meta name="description" content="Découvrez les annonces de la communauté OneKamer.co" />
    </Helmet>

    <AnimatePresence>
      {selectedAnnonce && (
        <AnnonceDetail 
          annonce={selectedAnnonce} 
          onBack={() => setSelectedAnnonce(null)} 
          onDelete={handleDelete}
          onEdit={handleEdit}
          apiPrefix={API_PREFIX}
          session={session}
        />
      )}
    </AnimatePresence>

    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-3xl font-bold text-[#2BA84A]">Annonces</h1>
          <Button onClick={handleCreateClick} className="bg-gradient-to-r from-[#E0222A] to-[#F5C300] text-white">
            <Plus className="mr-2 h-4 w-4" /> Créer
          </Button>
        </div>
          
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#6B6B6B]" />
                <Input placeholder="Rechercher une annonce..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10"/>
                {searchTerm.trim() && (
                  <div className="mt-2 space-y-2">
                    {suggestLoading && (
                      <div className="text-sm text-gray-500">Chargement...</div>
                    )}
                    {!suggestLoading && suggestions.length > 0 && (
                      <div className="space-y-2">
                        {suggestions.map((s) => (
                          <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer"
                               onClick={() => setSearchTerm(s.titre)}>
                            <div className="w-10 h-10 rounded overflow-hidden bg-gray-200 flex-shrink-0">
                              <MediaDisplay bucket="annonces" path={s.media_url} alt={s.titre} className="w-full h-full object-cover" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold truncate">{s.titre}</div>
                              <div className="text-xs text-gray-600 truncate">Annonce</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>

            {loading ? (
              <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" /></div>
            ) : filteredAnnonces.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAnnonces.map((annonce, index) => (
                  <motion.div key={annonce.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                     <AnnonceCard annonce={annonce} onSelect={setSelectedAnnonce} />
                  </motion.div>
                ))}
              </div>
            ) : (
                <div className="text-center py-12 text-gray-500">
                    <p>Aucune annonce pour le moment.</p>
                    <p>Soyez le premier à en publier une !</p>
                </div>
            )}
                </div>
  </>
);
};

export default Annonces;
