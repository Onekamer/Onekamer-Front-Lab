import React, { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/customSupabaseClient';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const PLAN_OPTIONS = [
  { value: 'free', label: 'Free' },
  { value: 'standard', label: 'Standard' },
  { value: 'vip', label: 'VIP' },
];

const ROLE_OPTIONS = [
  { value: 'user', label: 'User' },
  { value: 'admin', label: 'Admin' },
  { value: 'qrcode_verif', label: 'QRCode_Verif' },
];

const normalizeRole = (role) => {
  const raw = String(role || '').trim();
  const v = raw.toLowerCase();
  if (v === 'admin') return 'admin';
  if (v === 'user') return 'user';
  if (v === 'qrcode_verif') return 'qrcode_verif';
  return 'user';
};

const normalizePlan = (plan) => {
  const v = String(plan || '').trim().toLowerCase();
  if (['free', 'standard', 'vip'].includes(v)) return v;
  return 'free';
};

const AdminUsersLab = () => {
  const { user, profile, session, onlineUserIds } = useAuth();
  const navigate = useNavigate();

  if (!user || !profile) {
    return <Navigate to="/auth" replace />;
  }

  const isAdmin = String(profile.role || '').toLowerCase() === 'admin' || Boolean(profile.is_admin);
  if (!isAdmin) {
    return <Navigate to="/compte" replace />;
  }

  const serverLabUrl = (import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com').replace(/\/$/, '');
  const apiBaseUrl = import.meta.env.DEV ? '' : serverLabUrl;
  const API_PREFIX = `${apiBaseUrl}/api`;

  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [items, setItems] = useState([]);
  const [limit, setLimit] = useState(20);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(null);
  const [communityBadges, setCommunityBadges] = useState([]);
  const [userBadgesMap, setUserBadgesMap] = useState({}); // { userId: [{ badge_id, code, name, icon }] }
  const [selectedBadgeByUser, setSelectedBadgeByUser] = useState({}); // { userId: badgeId }

  const canPrev = offset > 0;
  const canNext = total == null ? items.length === limit : offset + limit < total;

  const getFreshAccessToken = async () => {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw new Error('Session expirée');
    const token = data?.session?.access_token;
    if (!token) throw new Error('Session expirée');
    return token;
  };

  const fetchUsers = async (opts = {}) => {
    try {
      setLoading(true);
      const token = await getFreshAccessToken();
      if (!API_PREFIX) throw new Error('API non configurée');

      const qs = new URLSearchParams();
      const q = String(opts.search ?? search).trim();
      const nextOffset = typeof opts.offset === 'number' ? opts.offset : offset;
      qs.set('limit', String(limit));
      qs.set('offset', String(nextOffset));
      if (q) qs.set('search', q);

      const res = await fetch(`${API_PREFIX}/admin/users?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        toast({ title: 'Session expirée', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
        navigate('/auth');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');

      const rows = Array.isArray(data?.items) ? data.items : [];
      setItems(
        rows.map((r) => ({
          ...r,
          planDraft: normalizePlan(r.plan),
          roleDraft: normalizeRole(r.role),
        }))
      );
      setTotal(typeof data?.total === 'number' ? data.total : null);
      if (typeof opts.offset === 'number') setOffset(opts.offset);

      // Charger la liste des badges communauté (une seule fois)
      try {
        if (!communityBadges || communityBadges.length === 0) {
          const { data: allBadges } = await supabase
            .from('badges_communaute')
            .select('id, code, name, icon')
            .order('name', { ascending: true });
          setCommunityBadges(Array.isArray(allBadges) ? allBadges : []);
        }
      } catch (_) {}

      // Charger les badges des utilisateurs affichés
      try {
        const ids = rows.map((r) => r.id).filter(Boolean);
        if (ids.length) {
          const { data: ub } = await supabase
            .from('user_badges')
            .select('user_id, badge_id, badges_communaute ( id, code, name, icon )')
            .in('user_id', ids);
          const map = {};
          (ub || []).forEach((row) => {
            const u = String(row.user_id);
            const b = row?.badges_communaute;
            if (!b?.id) return;
            if (!map[u]) map[u] = [];
            map[u].push({ badge_id: b.id, code: b.code, name: b.name, icon: b.icon });
          });
          setUserBadgesMap(map);
        } else {
          setUserBadgesMap({});
        }
      } catch (_) {}
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
      setItems([]);
      setTotal(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchUsers({ offset: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit]);

  useEffect(() => {
    const t = setTimeout(() => {
      fetchUsers({ offset: 0 });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onSave = async (row) => {
    try {
      const token = await getFreshAccessToken();
      if (!API_PREFIX) throw new Error('API non configurée');

      setSubmittingId(row.id);

      const payload = {
        plan: row.planDraft,
        role: row.roleDraft,
      };

      const res = await fetch(`${API_PREFIX}/admin/users/${encodeURIComponent(row.id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) {
        toast({ title: 'Session expirée', description: 'Veuillez vous reconnecter.', variant: 'destructive' });
        navigate('/auth');
        return;
      }
      if (!res.ok) throw new Error(data?.error || 'Erreur serveur');

      const updated = data?.item;
      if (!updated?.id) throw new Error('Réponse serveur invalide');

      toast({ title: 'Succès', description: 'Utilisateur mis à jour.' });

      setItems((prev) =>
        prev.map((it) => {
          if (String(it.id) !== String(updated.id)) return it;
          return {
            ...it,
            ...updated,
            planDraft: normalizePlan(updated.plan),
            roleDraft: normalizeRole(updated.role),
          };
        })
      );
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Erreur interne', variant: 'destructive' });
    } finally {
      setSubmittingId(null);
    }
  };

  const totalLabel = useMemo(() => {
    if (typeof total === 'number') return `${total} utilisateur(s)`;
    return `${items.length} utilisateur(s)`;
  }, [total, items.length]);

  const allowedBadgeCodes = useMemo(() => ['accueillant', 'guide', 'contributor', 'pilier'], []);

  const refreshUserBadges = async (userId) => {
    try {
      const { data: ub } = await supabase
        .from('user_badges')
        .select('user_id, badge_id, badges_communaute ( id, code, name, icon )')
        .eq('user_id', userId);
      const list = (ub || []).map((row) => ({
        badge_id: row?.badges_communaute?.id,
        code: row?.badges_communaute?.code,
        name: row?.badges_communaute?.name,
        icon: row?.badges_communaute?.icon,
      })).filter((v) => v.badge_id);
      setUserBadgesMap((prev) => ({ ...prev, [String(userId)]: list }));
    } catch (_) {}
  };

  const handleAddBadge = async (targetUserId, badgeId) => {
    try {
      if (!badgeId) return;
      const bid = Number(badgeId);
      const { error } = await supabase
        .from('user_badges')
        .insert({ user_id: targetUserId, badge_id: bid, awarded_by: user.id });
      if (error) throw error;
      toast({ title: 'Ajouté', description: 'Badge attribué.' });
      await refreshUserBadges(targetUserId);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'attribuer le badge.", variant: 'destructive' });
    }
  };

  const handleRemoveBadge = async (targetUserId, badgeId) => {
    try {
      const bid = Number(badgeId);
      const { error } = await supabase
        .from('user_badges')
        .delete()
        .match({ user_id: targetUserId, badge_id: bid });
      if (error) throw error;
      toast({ title: 'Retiré', description: 'Badge retiré.' });
      await refreshUserBadges(targetUserId);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible de retirer le badge.", variant: 'destructive' });
    }
  };

  const getStatusLabel = (row) => {
    const visible = row?.show_online_status !== false;
    if (!visible) return 'Hors ligne';
    const uid = row?.id ? String(row.id) : null;
    const isOnline = uid && onlineUserIds instanceof Set ? onlineUserIds.has(uid) : false;
    if (isOnline) return 'En ligne';
    if (row?.last_seen_at) {
      try {
        return `Vu ${formatDistanceToNow(new Date(row.last_seen_at), { addSuffix: true, locale: fr })}`;
      } catch {
        return 'Hors ligne';
      }
    }
    return 'Hors ligne';
  };

  const isRowOnline = (row) => {
    const visible = row?.show_online_status !== false;
    if (!visible) return false;
    const uid = row?.id ? String(row.id) : null;
    return Boolean(uid && onlineUserIds instanceof Set && onlineUserIds.has(uid));
  };

  const filteredItems = useMemo(() => {
    const plan = String(planFilter || 'all');
    const status = String(statusFilter || 'all');
    return (items || []).filter((row) => {
      if (plan !== 'all') {
        const p = normalizePlan(row?.plan);
        if (p !== plan) return false;
      }
      if (status !== 'all') {
        const online = isRowOnline(row);
        if (status === 'online' && !online) return false;
        if (status === 'offline' && online) return false;
      }
      return true;
    });
  }, [items, planFilter, statusFilter, onlineUserIds]);

  return (
    <>
      <Helmet>
        <title>Admin — Utilisateurs (LAB) - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <Button variant="ghost" className="px-0 text-sm" onClick={() => navigate('/compte')}>
          ← Retour à mon compte
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>Admin — Utilisateurs (LAB)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="text-sm font-medium">Recherche</div>
              <Input
                placeholder="Rechercher par username, nom complet ou email"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <div className="text-xs text-gray-600">Plan</div>
                <Select value={planFilter} onValueChange={(v) => setPlanFilter(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    {PLAN_OPTIONS.map((p) => (
                      <SelectItem key={p.value} value={p.value}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-gray-600">Statut</div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tous" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous</SelectItem>
                    <SelectItem value="online">En ligne</SelectItem>
                    <SelectItem value="offline">Hors ligne</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="text-xs text-gray-600">Afficher</div>
                <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v) || 20)}>
                  <SelectTrigger>
                    <SelectValue placeholder="20" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-xs text-gray-600">{filteredItems.length} affiché(s) — {totalLabel}</div>
            </div>

            {loading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#2BA84A]" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="text-sm text-gray-600">Aucun utilisateur trouvé.</div>
            ) : (
              <div className="space-y-3">
                {filteredItems.map((row) => (
                  <div key={row.id} className="border rounded p-3 space-y-3">
                    <div className="space-y-1">
                      <div className="font-semibold">{row.username || row.full_name || row.id}</div>
                      <div className="text-xs text-gray-600 break-all">{row.email || '—'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${isRowOnline(row) ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <span>{getStatusLabel(row)}</span>
                      </div>
                      <div className="text-xs text-gray-500">ID: {row.id}</div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <div className="text-xs text-gray-600">Plan</div>
                        <Select
                          value={row.planDraft}
                          onValueChange={(v) => {
                            setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, planDraft: v } : it)));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {PLAN_OPTIONS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <div className="text-xs text-gray-600">Rôle</div>
                        <Select
                          value={row.roleDraft}
                          onValueChange={(v) => {
                            setItems((prev) => prev.map((it) => (it.id === row.id ? { ...it, roleDraft: v } : it)));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Rôle" />
                          </SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>
                                {r.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="text-xs text-gray-600">Badges communauté</div>
                      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                        <Select
                          value={String(selectedBadgeByUser[row.id] || '')}
                          onValueChange={(v) => setSelectedBadgeByUser((prev) => ({ ...prev, [row.id]: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un badge" />
                          </SelectTrigger>
                          <SelectContent>
                            {communityBadges
                              .filter((b) => allowedBadgeCodes.includes(String(b.code || '').toLowerCase()))
                              .map((b) => (
                                <SelectItem key={b.id} value={String(b.id)}>
                                  {b.icon ? `${b.icon} ` : ''}{b.name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!selectedBadgeByUser[row.id]}
                          onClick={() => handleAddBadge(row.id, selectedBadgeByUser[row.id])}
                        >
                          Attribuer
                        </Button>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {(userBadgesMap[String(row.id)] || []).map((b) => (
                          <span key={b.badge_id} className="inline-flex items-center gap-1 text-xs bg-gray-100 rounded-full px-2 py-1">
                            <span>{b.icon}</span>
                            <span>{b.name}</span>
                            <button
                              type="button"
                              className="ml-1 text-red-500 hover:text-red-600"
                              title="Retirer"
                              onClick={() => handleRemoveBadge(row.id, b.badge_id)}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        className="w-full sm:w-auto"
                        disabled={submittingId === row.id}
                        onClick={() => onSave(row)}
                      >
                        {submittingId === row.id ? 'Enregistrement…' : 'Enregistrer'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && items.length > 0 && (
              <div className="flex items-center justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!canPrev}
                  onClick={() => fetchUsers({ offset: Math.max(offset - limit, 0) })}
                >
                  Précédent
                </Button>

                <div className="text-xs text-gray-500">
                  Page {Math.floor(offset / limit) + 1}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  disabled={!canNext}
                  onClick={() => fetchUsers({ offset: offset + limit })}
                >
                  Suivant
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
};

export default AdminUsersLab;
