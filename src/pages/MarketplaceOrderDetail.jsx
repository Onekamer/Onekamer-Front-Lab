import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useToast } from '@/components/ui/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const MarketplaceOrderDetail = () => {
  const { orderId } = useParams();
  const { session } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const serverLabUrl = import.meta.env.VITE_SERVER_LAB_URL || 'https://onekamer-server-lab.onrender.com';

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState(null);
  const [items, setItems] = useState([]);
  const [role, setRole] = useState(null);
  const [messages, setMessages] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [sending, setSending] = useState(false);
  const [text, setText] = useState('');
  const [updatingFulfillment, setUpdatingFulfillment] = useState(false);

  const listRef = useRef(null);

  const headers = useMemo(() => {
    const h = { 'Content-Type': 'application/json' };
    if (session?.access_token) h.Authorization = `Bearer ${session.access_token}`;
    return h;
  }, [session?.access_token]);

  const loadOrder = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      if (!session?.access_token) {
        toast({ title: 'Veuillez vous connecter', variant: 'destructive' });
        return;
      }
      const res = await fetch(`${serverLabUrl}/api/market/orders/${encodeURIComponent(orderId)}`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement commande');
      setOrder(data?.order ? { ...data.order, customer_email: data?.customer_email || null } : null);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setRole(data?.role || null);
      setConversationId(data?.conversationId || null);
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de charger la commande.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [orderId, session?.access_token, serverLabUrl, headers, toast]);

  const loadMessages = useCallback(async () => {
    if (!orderId || !session?.access_token) return;
    try {
      const res = await fetch(`${serverLabUrl}/api/market/orders/${encodeURIComponent(orderId)}/messages`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur chargement messages');
      setMessages(Array.isArray(data?.messages) ? data.messages : []);
      if (data?.conversationId) setConversationId(data.conversationId);
    } catch {
    }
  }, [orderId, session?.access_token, serverLabUrl, headers]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  useEffect(() => {
    let id;
    const start = async () => {
      await loadMessages();
      id = setInterval(loadMessages, 4000);
    };
    start();
    return () => { if (id) clearInterval(id); };
  }, [loadMessages]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const renderAmount = (amt, cur) => {
    const n = Number(amt || 0);
    const c = String(cur || '').toUpperCase();
    return `${(n / 100).toFixed(2)} ${c}`;
  };

  const onSend = async () => {
    const content = String(text || '').trim();
    if (!content) return;
    if (!orderId) return;
    if (!session?.access_token) {
      toast({ title: 'Veuillez vous connecter', variant: 'destructive' });
      return;
    }
    setSending(true);
    try {
      const res = await fetch(`${serverLabUrl}/api/market/orders/${encodeURIComponent(orderId)}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur envoi message');
      setText('');
      await loadMessages();
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'envoyer le message.", variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleUpdateFulfillment = async (next) => {
    if (!orderId || !session?.access_token) return;
    if (!next) return;
    setUpdatingFulfillment(true);
    try {
      const res = await fetch(`${serverLabUrl}/api/market/orders/${encodeURIComponent(orderId)}/fulfillment`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur mise à jour du statut');
      await loadOrder();
      toast({ title: 'Statut mis à jour' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de mettre à jour le statut', variant: 'destructive' });
    } finally {
      setUpdatingFulfillment(false);
    }
  };

  const handleBuyerConfirmReceived = async () => {
    if (!orderId || !session?.access_token) return;
    try {
      const res = await fetch(`${serverLabUrl}/api/market/orders/${encodeURIComponent(orderId)}/confirm-received`, {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Erreur confirmation');
      await loadOrder();
      toast({ title: 'Confirmation envoyée' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible de confirmer la réception", variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet>
        <title>Commande #{orderId} - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => navigate(role === 'seller' ? '/marketplace/ma-boutique?tab=chat' : '/market/orders')} className="px-2">Retour</Button>
          <div className="text-sm text-gray-600">{role ? (role === 'buyer' ? 'Acheteur' : 'Vendeur') : ''}</div>
        </div>

        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : !order ? (
          <div className="text-gray-600">Commande introuvable.</div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base font-semibold">Commande #{order.id}</CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-700 font-medium">Statut</div>
                  <div className="capitalize">{String(order.status || '').replace('_', ' ')}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-700 font-medium">Montant</div>
                  <div>{renderAmount(order.charge_amount_total, order.charge_currency)}</div>
                </div>
                {role === 'seller' ? (
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Client</div>
                    <div className="truncate max-w-[60%]">{order?.customer_email || '—'}</div>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Livraison</div>
                    <div className="capitalize">{String(order.delivery_mode || '—')}</div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Préparation</div>
                    <div className="capitalize">{String(order.fulfillment_status || '—')}</div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">MAJ préparation</div>
                    <div>{order?.fulfillment_updated_at ? new Date(order.fulfillment_updated_at).toLocaleString() : '—'}</div>
                  </div>
                </div>
                {order?.customer_note ? (
                  <div className="pt-2">
                    <div className="text-gray-700 font-medium text-sm mb-1">Note client</div>
                    <div className="text-sm text-gray-700 whitespace-pre-wrap">{order.customer_note}</div>
                  </div>
                ) : null}
                <div className="pt-2">
                  <div className="text-gray-700 font-medium text-sm mb-1">Articles</div>
                  <div className="space-y-2">
                    {items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-sm">
                        <div className="truncate">{it.title_snapshot || 'Article'}</div>
                        <div className="text-gray-600">x{it.quantity}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {role === 'seller' ? (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold">Gérer la préparation</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={String(order?.fulfillment_status || 'preparing')}
                      onChange={(e) => handleUpdateFulfillment(e.target.value)}
                      className="flex h-10 w-full rounded-md border border-[#2BA84A]/30 bg-white px-3 py-2 text-sm"
                      disabled={updatingFulfillment}
                    >
                      <option value="preparing">En cours de préparation</option>
                      <option value="shipping">En cours de livraison</option>
                      <option value="delivered">Livré</option>
                    </select>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {role === 'buyer' && String(order?.fulfillment_status || '').toLowerCase() === 'delivered' && !order?.buyer_received_at ? (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold">Réception</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <Button onClick={handleBuyerConfirmReceived} className="w-full">J'ai bien reçu la commande</Button>
                </CardContent>
              </Card>
            ) : null}

            {String(order?.status||'').toLowerCase() === 'paid' ? (
              <Card className="h-[60vh] flex flex-col">
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold">Chat commande</CardTitle>
                </CardHeader>
                <CardContent className="p-0 flex-1 flex flex-col">
                  <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                    {messages.length === 0 ? (
                      <div className="text-gray-500 text-sm">Aucun message pour le moment.</div>
                    ) : messages.map((m) => (
                      <div key={m.id} className={`max-w-[80%] rounded px-3 py-2 text-sm ${String(m.sender_id||'')===String(session?.user?.id||'') ? 'bg-[#DCFCE7] ml-auto' : 'bg-white border'}`}>
                        <div className="whitespace-pre-wrap break-words">{m.content}</div>
                        <div className="text-[11px] text-gray-500 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t p-3 flex items-center gap-2">
                    <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Votre message…" onKeyDown={(e)=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); onSend(); } }} />
                    <Button onClick={onSend} disabled={sending || !text.trim()} className="shrink-0">Envoyer</Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold">Chat commande</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0">
                  <div className="text-sm text-gray-600">Le chat sera disponible une fois le paiement validé.</div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default MarketplaceOrderDetail;
