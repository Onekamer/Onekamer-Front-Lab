import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const MarketplaceOrders = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const serverLabUrl = import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com';

  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [status, setStatus] = useState('all');

  const headers = useMemo(() => {
    const h = { 'Content-Type': 'application/json' };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  useEffect(() => {
    let aborted = false;
    const load = async () => {
      setLoading(true);
      try {
        if (!session?.access_token) {
          setOrders([]);
          return;
        }
        const res = await fetch(`${serverLabUrl}/api/market/orders?status=${encodeURIComponent(status)}`, {
          method: 'GET',
          headers,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || 'Erreur chargement commandes');
        if (!aborted) setOrders(Array.isArray(data?.orders) ? data.orders : []);
      } catch (e) {
        if (!aborted) toast({ title: 'Erreur', description: e?.message || 'Impossible de charger vos commandes.', variant: 'destructive' });
      } finally {
        if (!aborted) setLoading(false);
      }
    };
    load();
    return () => { aborted = true; };
  }, [session?.access_token, serverLabUrl, headers, status, toast]);

  const renderAmount = (amt, cur) => {
    const n = Number(amt || 0);
    const c = String(cur || '').toUpperCase();
    return `${(n / 100).toFixed(2)} ${c}`;
  };

  const groups = useMemo(() => {
    const arr = Array.isArray(orders) ? orders : [];
    const out = [];
    const idx = new Map();
    for (const o of arr) {
      const raw = (o?.partner_display_name || '—');
      const name = String(raw).trim() || '—';
      if (!idx.has(name)) {
        idx.set(name, out.length);
        out.push({ name, items: [] });
      }
      out[idx.get(name)].items.push(o);
    }
    return out;
  }, [orders]);

  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setExpanded((prev) => {
      const next = { ...prev };
      for (const g of groups) {
        if (typeof next[g.name] === 'undefined') next[g.name] = false;
      }
      return next;
    });
  }, [groups]);

  return (
    <>
      <Helmet>
        <title>Mes commandes - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-bold text-[#2BA84A]">Mes commandes</h1>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filtrer" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="paid">Payées</SelectItem>
                <SelectItem value="canceled">Annulées</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : orders.length === 0 ? (
          <div className="text-gray-600">Aucune commande.</div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {groups.map((g) => (
              <Card key={g.name} className="hover:shadow-sm transition">
                <CardHeader className="p-4 cursor-pointer" onClick={() => setExpanded((prev) => ({ ...prev, [g.name]: !prev[g.name] }))}>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">{g.name}</CardTitle>
                    <span className="text-gray-400">{expanded[g.name] !== false ? '▾' : '▸'}</span>
                  </div>
                </CardHeader>
                {expanded[g.name] !== false ? (
                  <CardContent className="p-4 pt-0">
                    <div className="grid grid-cols-1 gap-3">
                      {g.items.map((o) => (
                        <Card key={o.id} className="hover:shadow-sm transition">
                          <CardHeader className="p-4">
                            <CardTitle className="text-base font-semibold">Commande #{o.id}</CardTitle>
                          </CardHeader>
                          <CardContent className="p-4 pt-0 space-y-2">
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 font-medium">Statut paiement</div>
                              <div className="capitalize">{String(o.status || '').replace('_', ' ')}</div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 font-medium">Statut commande</div>
                              <div className="capitalize">{String(o.fulfillment_status || '—').replace('_', ' ')}</div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 font-medium">Montant</div>
                              <div>{renderAmount(o.charge_amount_total, o.charge_currency)}</div>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <div className="text-gray-700 font-medium">Articles</div>
                              <div>{Array.isArray(o.items) ? o.items.length : 0}</div>
                            </div>
                            <div className="pt-2">
                              <Button className="w-full" onClick={() => navigate(`/market/orders/${o.id}`)}>Voir le détail</Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </CardContent>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default MarketplaceOrders;
