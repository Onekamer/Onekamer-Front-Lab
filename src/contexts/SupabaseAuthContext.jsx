import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { useToast } from '@/components/ui/use-toast';
import subscribeForPushMulti from '@/lib/push/subscribeForPush';
import { loadLinkedAccounts, saveLinkedAccounts } from '@/lib/linkedAccounts';
import { createEphemeralClient } from '@/lib/supabaseEphemeral';

const AuthContext = createContext(undefined);

export const AuthProvider = ({ children }) => {
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [balance, setBalance] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [onlineUserIds, setOnlineUserIds] = useState(() => new Set());
  const [linkedAccounts, setLinkedAccounts] = useState(() => []);

  useEffect(() => {
    setLinkedAccounts(loadLinkedAccounts());
  }, []);

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  }, []);

  const fetchBalance = useCallback(async (userId) => {
    if (!userId) return null;
    const { data, error } = await supabase
      .from('okcoins_users_balance')
      .select('*')
      .eq('user_id', userId)
      .single();
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching balance:', error);
      return null;
    }
    return data;
  }, []);

  const checkFeaturePermission = useCallback(async (userId, featureKey) => {
    if (!userId) return false;
    const { data, error } = await supabase.rpc('user_has_feature', {
      p_user_id: userId,
      p_feature_key: featureKey,
    });
    if (error) {
      console.error(`Error checking permission for ${featureKey}:`, error);
      return false;
    }
    return data;
  }, []);

  const fetchAllPermissions = useCallback(async (userId) => {
    if (!userId) return {};
    const featureKeys = [
      'annonces_read', 'create_annonce', 'rencontre_access', 
      'partenaires_access', 'position_access', 'evenements_read',
      'faits_divers_read', 'groupes_read'
    ];
    const permissionChecks = featureKeys.map(key => checkFeaturePermission(userId, key));
    const results = await Promise.all(permissionChecks);
    const userPermissions = featureKeys.reduce((acc, key, index) => {
      acc[key] = results[index];
      return acc;
    }, {});
    setPermissions(userPermissions);
    return userPermissions;
  }, [checkFeaturePermission]);

  const handleSession = useCallback(async (session) => {
    setSession(session);
    const currentUser = session?.user ?? null;
    setUser(currentUser);

    if (currentUser) {
      const [userProfile, userBalance, userPermissions] = await Promise.all([
        fetchProfile(currentUser.id),
        fetchBalance(currentUser.id),
        fetchAllPermissions(currentUser.id)
      ]);
      setProfile(userProfile);
      setBalance(userBalance);
      setPermissions(userPermissions);
    } else {
      setProfile(null);
      setBalance(null);
      setPermissions({});
    }
    setLoading(false);
  }, [fetchProfile, fetchBalance, fetchAllPermissions]);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          await handleSession(session);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setSession(null);
          setProfile(null);
          setBalance(null);
          setPermissions({});
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [handleSession]);

  useEffect(() => {
    if (!session?.access_token) return;

    const INVITE_CODE_STORAGE_KEY = 'onekamer_invite_code';
    const code = String(localStorage.getItem(INVITE_CODE_STORAGE_KEY) || '').trim();
    if (!code) return;

    const trackedKey = `onekamer_invite_first_login_tracked:${code}`;
    const alreadyTracked = String(localStorage.getItem(trackedKey) || '') === '1';
    if (alreadyTracked) return;

    const serverLabUrl = (import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com').replace(/\/$/, '');
    const API_PREFIX = `${serverLabUrl}/api`;

    (async () => {
      try {
        const res = await fetch(`${API_PREFIX}/invites/track`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ code, event: 'first_login' }),
        });
        if (res.ok) {
          localStorage.setItem(trackedKey, '1');
          localStorage.removeItem(INVITE_CODE_STORAGE_KEY);
        }
      } catch {}
    })();
  }, [session?.access_token]);

  const allIds = useMemo(() => {
    const ids = new Set();
    if (user?.id) ids.add(user.id);
    (linkedAccounts || []).forEach((a) => {
      if (a?.userId) ids.add(String(a.userId));
    });
    return Array.from(ids);
  }, [user?.id, linkedAccounts]);

  useEffect(() => {
    const provider = import.meta.env.VITE_NOTIFICATIONS_PROVIDER || 'onesignal';
    if (provider !== 'supabase_light') return;
    if (!allIds.length) return;
    (async () => {
      try {
        await subscribeForPushMulti(allIds);
      } catch {}
    })();
  }, [allIds]);

  useEffect(() => {
    const onMessage = (e) => {
      try {
        const msg = e?.data || {};
        if (msg?.type === 'ok_push_subscription_changed') {
          const ids = new Set();
          if (user?.id) ids.add(user.id);
          (linkedAccounts || []).forEach((a) => a?.userId && ids.add(String(a.userId)));
          subscribeForPushMulti(Array.from(ids));
        }
        if (msg?.type === 'ok_switch_to' && msg?.userId) {
          const url = msg?.url || '/';
          switchToAccount(String(msg.userId)).then(() => {
            try { window.location.href = url; } catch {}
          });
        }
      } catch {}
    };
    if (navigator?.serviceWorker) navigator.serviceWorker.addEventListener('message', onMessage);
    return () => {
      if (navigator?.serviceWorker) navigator.serviceWorker.removeEventListener('message', onMessage);
    };
  }, [user?.id, linkedAccounts]);

  const refreshBalance = useCallback(async () => {
    if (user) {
      const userBalance = await fetchBalance(user.id);
      setBalance(userBalance);
    }
  }, [user, fetchBalance]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const userProfile = await fetchProfile(user.id);
      setProfile(userProfile);
      await fetchAllPermissions(user.id);
    }
  }, [user, fetchProfile, fetchAllPermissions]);

  const linkExistingAccount = useCallback(async (email, password) => {
    try {
      const eph = createEphemeralClient(false);
      const { data, error } = await eph.auth.signInWithPassword({ email, password });
      if (error) {
        toast({ variant: 'destructive', title: 'Connexion échouée', description: error.message || 'Impossible de lier ce compte.' });
        return { error };
      }
      const s = data?.session;
      const u = data?.user;
      if (!s || !u) {
        toast({ variant: 'destructive', title: 'Erreur', description: 'Session indisponible.' });
        return { error: 'no_session' };
      }
      let p = null;
      try {
        const { data: prof } = await eph.from('profiles').select('*').eq('id', u.id).single();
        p = prof || null;
      } catch {}
      const acc = {
        userId: u.id,
        email: u.email,
        username: p?.username || null,
        avatar_url: p?.avatar_url || null,
        access_token: s.access_token,
        refresh_token: s.refresh_token,
      };
      setLinkedAccounts((prev) => {
        const exists = prev.some((x) => String(x.userId) === String(acc.userId));
        const next = exists ? prev.map((x) => (String(x.userId) === String(acc.userId) ? acc : x)) : [...prev, acc];
        saveLinkedAccounts(next);
        return next;
      });
      toast({ title: 'Compte lié', description: 'Le compte a été ajouté.' });
      return { error: null };
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erreur', description: e?.message || 'Impossible de lier ce compte.' });
      return { error: e };
    }
  }, [toast]);

  const unlinkAccount = useCallback(async (targetUserId) => {
    setLinkedAccounts((prev) => {
      const next = prev.filter((x) => String(x.userId) !== String(targetUserId));
      saveLinkedAccounts(next);
      return next;
    });
    toast({ title: 'Compte retiré', description: 'Ce compte ne sera plus lié à cet appareil.' });
    return { error: null };
  }, [toast]);

  const switchToAccount = useCallback(async (targetUserId) => {
    if (!targetUserId) return { error: 'missing_user_id' };
    if (user?.id && String(user.id) === String(targetUserId)) return { error: null };
    const acc = (linkedAccounts || []).find((a) => String(a.userId) === String(targetUserId));
    if (!acc?.refresh_token) {
      toast({ variant: 'destructive', title: 'Introuvable', description: 'Jeton manquant pour ce compte.' });
      return { error: 'not_found' };
    }
    try {
      const at = acc.access_token || '';
      const rt = acc.refresh_token;
      const { error } = await supabase.auth.setSession({ access_token: at, refresh_token: rt });
      if (error) throw error;
      return { error: null };
    } catch (e) {
      toast({ variant: 'destructive', title: 'Échec du switch', description: e?.message || 'Impossible de basculer.' });
      return { error: e };
    }
  }, [linkedAccounts, user?.id, toast]);

  useEffect(() => {
    if (!user) return;
    const balanceChannel = supabase
      .channel(`balance-updates-for-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'okcoins_users_balance', filter: `user_id=eq.${user.id}`}, payload => {
        setBalance(payload.new);
        toast({ title: 'Solde mis à jour ! 💰', description: `Votre nouveau solde est de ${payload.new.coins_balance} pièces.` });
      })
      .subscribe();
    const notificationChannel = supabase
      .channel(`notifications-for-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'okcoins_notifications', filter: `user_id=eq.${user.id}`}, payload => {
        toast({ title: 'Nouvelle notification ! 🔔', description: payload.new.message });
        refreshBalance();
      })
      .subscribe();
    const profileChannel = supabase
      .channel(`profile-updates-for-${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}`}, payload => {
        const next = payload?.new;
        setProfile((prev) => {
          const shouldNotify = Boolean(
            prev && next && (
              String(prev.plan || '') !== String(next.plan || '') ||
              String(prev.role || '') !== String(next.role || '') ||
              Boolean(prev.is_admin) !== Boolean(next.is_admin)
            )
          );

          if (shouldNotify) {
            toast({ title: 'Profil mis à jour!', description: 'Votre abonnement a été mis à jour.' });
            fetchAllPermissions(user.id);
          }

          return next;
        });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(balanceChannel);
      supabase.removeChannel(notificationChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [user, toast, refreshBalance, fetchAllPermissions]);

  useEffect(() => {
    if (!user) {
      setOnlineUserIds(new Set());
      return;
    }

    if (profile?.show_online_status === false) {
      setOnlineUserIds(new Set());
      return;
    }

    const serverLabUrl = (import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com').replace(/\/$/, '');
    const apiBaseUrl = import.meta.env.DEV ? '' : serverLabUrl;
    const API_PREFIX = `${apiBaseUrl}/api`;

    const presenceChannel = supabase.channel('presence:global', {
      config: { presence: { key: user.id } },
    });

    const sync = () => {
      const state = presenceChannel.presenceState();
      const ids = Object.keys(state || {});
      setOnlineUserIds(new Set(ids));
    };

    presenceChannel.on('presence', { event: 'sync' }, sync);
    presenceChannel.subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      try {
        await presenceChannel.track({ user_id: user.id });
      } catch {
        // ignore
      }
    });

    const beat = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) return;
        const token = data?.session?.access_token;
        if (!token) return;
        await fetch(`${API_PREFIX}/presence/heartbeat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore
      }
    };

    beat();
    const intervalId = setInterval(beat, 60 * 1000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        beat();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      clearInterval(intervalId);
      supabase.removeChannel(presenceChannel);
    };
  }, [user, profile?.show_online_status]);

  const signUp = useCallback(async (credentials, { data, emailRedirectTo }) => {
    const { error } = await supabase.auth.signUp({ ...credentials, options: { data, emailRedirectTo } });
    if (error) {
      toast({ variant: 'destructive', title: "L'inscription a échoué", description: error.message || "Quelque chose s'est mal passé" });
    }
    return { error };
  }, [toast]);

  const signIn = useCallback(async (credentials) => {
    const { error } = await supabase.auth.signInWithPassword(credentials);
    if (error) {
      toast({ variant: 'destructive', title: 'La connexion a échoué', description: error.message || "Quelque chose s'est mal passé" });
    }
    return { error };
  }, [toast]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setProfile(null);
      setBalance(null);
      setPermissions({});
      return { error: null };
    }
    toast({ variant: 'destructive', title: 'La déconnexion a échoué', description: error.message || "Quelque chose s'est mal passé" });
    return { error };
  }, [toast]);

  const updateUser = useCallback(async (updates) => {
    const { data, error } = await supabase.auth.updateUser(updates);
    if (error) {
      toast({ variant: 'destructive', title: 'La mise à jour a échoué', description: error.message || "Quelque chose s'est mal passé" });
    }
    return { data, error };
  }, [toast]);

  const value = useMemo(() => ({
    user,
    session,
    profile,
    balance,
    loading,
    permissions,
    onlineUserIds,
    signUp,
    signIn,
    signOut,
    updateUser,
    refreshProfile,
    refreshBalance,
    checkFeaturePermission,
    linkedAccounts,
    linkExistingAccount,
    unlinkAccount,
    switchToAccount,
  }), [
    user,
    session,
    profile,
    balance,
    loading,
    permissions,
    onlineUserIds,
    signUp,
    signIn,
    signOut,
    updateUser,
    refreshProfile,
    refreshBalance,
    checkFeaturePermission,
    linkedAccounts,
    linkExistingAccount,
    unlinkAccount,
    switchToAccount,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};