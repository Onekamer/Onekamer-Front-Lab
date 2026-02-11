import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Plus, Shield, Award, MessageSquare as MessageSquareQuote, Gem, Star, Crown, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import MediaDisplay from '@/components/MediaDisplay';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDistanceToNow, differenceInCalendarDays, differenceInCalendarMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const Badge = ({ icon, label, colorClass }) => (
  <div className={`flex items-center gap-2 py-1 px-3 rounded-full text-sm font-semibold ${colorClass}`}>
    {icon}
    <span>{label}</span>
  </div>
);

const UserProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { onlineUserIds } = useAuth();
  
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [badges, setBadges] = useState([]);
  const [postsCount, setPostsCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [userPosts, setUserPosts] = useState([]);
  const [userComments, setUserComments] = useState([]);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const { data: userProfile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error("Error fetching profile:", error);
        toast({
            title: "Erreur de chargement",
            description: "Impossible de charger le profil de l'utilisateur.",
            variant: "destructive"
        });
      }

      setProfile(userProfile);
      
      // Badges communauté
      try {
        const { data: badgeRows } = await supabase
          .from('user_badges')
          .select('awarded_at, awarded_by, badges_communaute ( code, name, icon )')
          .eq('user_id', userId)
          .order('awarded_at', { ascending: false });
        setBadges(
          (badgeRows || [])
            .map((r) => ({
              code: r?.badges_communaute?.code,
              name: r?.badges_communaute?.name,
              icon: r?.badges_communaute?.icon,
              awarded_at: r?.awarded_at,
              awarded_by: r?.awarded_by,
            }))
            .filter((b) => b.code)
        );
      } catch (_) {}

      // Compteurs posts / commentaires
      try {
        const { count: pc } = await supabase
          .from('posts')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        const { count: cc } = await supabase
          .from('comments')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId);
        setPostsCount(pc || 0);
        setCommentsCount(cc || 0);
      } catch (_) {}

      // Derniers contenus
      try {
        const [{ data: postsList }, { data: commentsList }] = await Promise.all([
          supabase
            .from('posts')
            .select('id, content, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20),
          supabase
            .from('comments')
            .select('id, content, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20),
        ]);
        setUserPosts(postsList || []);
        setUserComments(commentsList || []);
      } catch (_) {}
      setLoading(false);
    };
    loadProfile();
  }, [userId]);

  const handleFollow = () => {
    toast({
      title: `Vous suivez maintenant ${profile?.username || 'cet utilisateur'}`,
      description: "🚧 Cette fonctionnalité n'est pas encore implémentée.",
    });
  };
  
  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p>Profil non trouvé.</p>
        <Button onClick={() => navigate(-1)}>Retour</Button>
      </div>
    );
  }
  
  const planColors = {
    'Free': 'bg-gray-200 text-gray-800',
    'Standard': 'bg-blue-100 text-blue-800',
    'VIP': 'bg-yellow-200 text-yellow-800',
    'free': 'bg-gray-200 text-gray-800',
    'standard': 'bg-blue-100 text-blue-800',
    'vip': 'bg-yellow-200 text-yellow-800',
  };

  const allowsOnline = profile?.show_online_status !== false;
  const isOnline = Boolean(allowsOnline && userId && (onlineUserIds instanceof Set) && onlineUserIds.has(String(userId)));
  const statusText = (() => {
    if (!allowsOnline) return 'Hors ligne';
    if (isOnline) return 'En ligne';
    if (profile?.last_seen_at) {
      try {
        return `Vu ${formatDistanceToNow(new Date(profile.last_seen_at), { addSuffix: true, locale: fr })}`;
      } catch {
        return 'Hors ligne';
      }
    }
    return 'Hors ligne';
  })();

  return (
    <>
      <Helmet>
        <title>Profil de {profile.username || 'Utilisateur'} - OneKamer.co</title>
      </Helmet>
      <div className="max-w-2xl mx-auto">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center text-center">
                {profile.avatar_url ? (
                  <MediaDisplay bucket="avatars" path={profile.avatar_url} alt="Avatar" className="w-32 h-32 rounded-full object-cover mb-4" />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-gradient-to-br from-[#2BA84A] to-[#F5C300] flex items-center justify-center text-white text-5xl font-bold mb-4">
                    {(profile.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <h1 className="text-3xl font-bold text-gray-800">{profile.username || 'Utilisateur'}</h1>
                <div className="mt-2 flex items-center justify-center gap-2 text-sm text-gray-600">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span>{statusText}</span>
                </div>
                {(() => {
                  const memberSince = profile?.member_since_date || profile?.created_at || null;
                  if (!memberSince) return null;
                  try {
                    const days = differenceInCalendarDays(new Date(), new Date(memberSince));
                    const label = days < 30
                      ? `Membre depuis ${days} jour${days > 1 ? 's' : ''}`
                      : `Membre depuis ${differenceInCalendarMonths(new Date(), new Date(memberSince))} mois`;
                    return <div className="mt-1 text-sm text-gray-600">{label}</div>;
                  } catch {
                    return null;
                  }
                })()}
                
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <Badge 
                    icon={<Gem className="h-4 w-4" />} 
                    label={`Niveau ${profile.level || 1} - ${profile.levelName || 'Bronze'}`}
                    colorClass="bg-purple-100 text-purple-800"
                  />
                  <Badge 
                    icon={<Crown className="h-4 w-4" />} 
                    label={profile.plan || 'Free'}
                    colorClass={planColors[profile.plan] || 'bg-gray-200 text-gray-800'}
                  />
                  {profile.isTopDonor && (
                    <Badge 
                      icon={<Award className="h-4 w-4" />} 
                      label="Top Donateur"
                      colorClass="bg-green-100 text-green-800"
                    />
                  )}
                  {profile.isTopCommenter && (
                    <Badge 
                      icon={<MessageSquareQuote className="h-4 w-4" />} 
                      label="Top Commentateur"
                      colorClass="bg-indigo-100 text-indigo-800"
                    />
                  )}
                  {profile.roles?.map(role => (
                     <Badge 
                      key={role}
                      icon={role === 'Modérateur' ? <Shield className="h-4 w-4" /> : <Star className="h-4 w-4" />} 
                      label={role}
                      colorClass="bg-red-100 text-red-800"
                    />
                  ))}
                </div>

                {(() => {
                  const memberSince = profile?.member_since_date || profile?.created_at || null;
                  let showNew = false;
                  try {
                    if (memberSince) {
                      const days = differenceInCalendarDays(new Date(), new Date(memberSince));
                      showNew = days < 14 && profile?.is_new_member_badge_visible !== false;
                    }
                  } catch {}
                  return (
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      {showNew && (
                        <Badge icon={<span className="text-base">👋🏾</span>} label="Nouveau membre" colorClass="bg-gray-100 text-gray-800" />
                      )}
                      {badges.map((b) => (
                        <Badge key={b.code} icon={<span className="text-base">{b.icon}</span>} label={b.name} colorClass="bg-gray-100 text-gray-800" />
                      ))}
                    </div>
                  );
                })()}

                <p className="text-gray-600 mt-6 max-w-md">{profile.bio || 'Aucune biographie.'}</p>

                <div className="mt-4 text-sm text-gray-700">{postsCount} posts • {commentsCount} commentaires</div>

                <div className="mt-6 w-full">
                  <Tabs defaultValue="posts" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="posts">Publications ({postsCount})</TabsTrigger>
                      <TabsTrigger value="comments">Commentaires ({commentsCount})</TabsTrigger>
                    </TabsList>
                    <TabsContent value="posts" className="mt-3 space-y-3">
                      {userPosts.length === 0 ? (
                        <div className="text-sm text-gray-500">Aucune publication.</div>
                      ) : (
                        userPosts.map((p) => (
                          <div
                            key={p.id}
                            className="p-3 border rounded cursor-pointer hover:bg-gray-50"
                            onClick={() => navigate(`/echange?postId=${encodeURIComponent(p.id)}`)}
                          >
                            <div className="text-sm text-gray-800 font-medium">{(p.content || 'Publication').slice(0, 140)}</div>
                            <div className="text-xs text-gray-500">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: fr })}</div>
                          </div>
                        ))
                      )}
                    </TabsContent>
                    <TabsContent value="comments" className="mt-3 space-y-3">
                      {userComments.length === 0 ? (
                        <div className="text-sm text-gray-500">Aucun commentaire.</div>
                      ) : (
                        userComments.map((c) => (
                          <div key={c.id} className="p-3 border rounded">
                            <div className="text-sm text-gray-800">{(c.content || 'Commentaire').slice(0, 140)}</div>
                            <div className="text-xs text-gray-500">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: fr })}</div>
                          </div>
                        ))
                      )}
                    </TabsContent>
                  </Tabs>
                </div>

                <div className="flex gap-4 mt-6">
                  <Button className="bg-[#2BA84A]" onClick={handleFollow}>
                    <Plus className="h-4 w-4 mr-2" />
                    Suivre
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </>
  );
};

export default UserProfile;