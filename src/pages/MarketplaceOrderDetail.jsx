import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
  const location = useLocation();
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
  const [actioning, setActioning] = useState(null);

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
      setOrder(data?.order || null);
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

  const autoCompleteDate = useMemo(() => {
    const s = String(order?.status || '').toLowerCase();
    const f = String(order?.fulfillment_status || '').toLowerCase();
    if (s !== 'paid' || f !== 'delivered') return null;
    const base = order?.payout_release_at ? new Date(order.payout_release_at) : (order?.fulfillment_updated_at ? new Date(order.fulfillment_updated_at) : null);
    if (!base || Number.isNaN(base.getTime())) return null;
    if (!order?.payout_release_at) {
      base.setDate(base.getDate() + 14);
    }
    return base;
  }, [order?.status, order?.fulfillment_status, order?.payout_release_at, order?.fulfillment_updated_at]);

  const formatLongDate = (d) => {
    try {
      return d?.toLocaleString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return '' }
  };

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  const effectiveRole = useMemo(() => {
    const fromChat = location?.state && location.state.from === 'myshop-chat';
    if (fromChat) return 'seller';
    return role;
  }, [location?.state, role]);

  const chatLocked = useMemo(() => {
    const fs = String(order?.fulfillment_status || '').toLowerCase();
    return fs === 'completed';
  }, [order?.fulfillment_status]);

  const renderAmount = (amt, cur) => {
    const n = Number(amt || 0);
    const c = String(cur || '').toUpperCase();
    return `${(n / 100).toFixed(2)} ${c}`;
  };

  const formatOrderCode = (shopName, createdAt, orderNumber) => {
    const raw = String(shopName || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z]/g, '').toUpperCase();
    const prefix = (raw.slice(0, 3) || 'OK');
    const d = createdAt ? new Date(createdAt) : new Date();
    const year = Number.isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear();
    const num = String(Number(orderNumber || 0)).padStart(6, '0');
    return `${prefix}-${year}-${num}`;
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

  const handleResumePayment = async () => {
    if (!orderId || !session?.access_token) return;
    setActioning('pay');
    try {
      const res = await fetch(`${serverLabUrl}/api/market/orders/${encodeURIComponent(orderId)}/pay`, {
        method: 'GET',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.url) throw new Error(data?.error || 'Impossible de relancer le paiement');
      window.location.href = data.url;
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || 'Échec du paiement', variant: 'destructive' });
    } finally {
      setActioning(null);
    }
  };

  const handleCancelOrder = async () => {
    if (!orderId || !session?.access_token) return;
    setActioning('cancel');
    try {
      const res = await fetch(`${serverLabUrl}/api/market/orders/${encodeURIComponent(orderId)}/cancel`, {
        method: 'POST',
        headers,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Annulation impossible');
      await loadOrder();
      toast({ title: 'Commande annulée' });
    } catch (e) {
      toast({ title: 'Erreur', description: e?.message || "Impossible d'annuler la commande", variant: 'destructive' });
    } finally {
      setActioning(null);
    }
  };

  return (
    <>
      <Helmet>
        <title>
          {order ? `Commande n°${formatOrderCode(order.partner_display_name, order.created_at, order.order_number)} - OneKamer.co` : 'Commande - OneKamer.co'}
        </title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              if (effectiveRole === 'seller') {
                navigate('/marketplace/ma-boutique?tab=chat');
              } else {
                navigate('/market/orders');
              }
            }}
            className="px-2"
          >
            Retour
          </Button>
          <div className="text-sm text-gray-600">{effectiveRole ? (effectiveRole === 'buyer' ? 'Acheteur' : 'Vendeur') : ''}</div>
        </div>

        {loading ? (
          <div className="text-gray-600">Chargement…</div>
        ) : !order ? (
          <div className="text-gray-600">Commande introuvable.</div>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardHeader className="p-4">
                <CardTitle className="text-base font-semibold">
                  {order ? `Commande n°${formatOrderCode(order.partner_display_name, order.created_at, order.order_number)}` : 'Commande'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-700 font-medium">Statut de paiement</div>
                  <div>{String(order.status || '').toLowerCase().replace('_', ' ')}</div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-700 font-medium">Montant</div>
                  <div>{renderAmount(order.charge_amount_total, order.charge_currency)}</div>
                </div>
                {effectiveRole === 'seller' ? (
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Montant net à recevoir</div>
                    <div>{renderAmount(order.partner_amount, order.charge_currency)}</div>
                  </div>
                ) : null}
                {effectiveRole === 'seller' ? (
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Client</div>
                    <div className="truncate max-w-[60%]">{order?.customer_alias || '—'}</div>
                  </div>
                ) : null}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Livraison</div>
                    <div className="capitalize">{String(order.delivery_mode || '—')}</div>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-700 font-medium">Statut</div>
                    <div>{String(order.status || '').toLowerCase() === 'pending' ? 'Waiting for payment' : String(order.fulfillment_status || '—')}</div>
                  </div>
                </div>
                {effectiveRole === 'seller' ? (
                  <div className="pt-2 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-700 font-medium">Nom</div>
                      <div className="truncate max-w-[60%]">
                        {(() => {
                          const fn = String(order?.customer_first_name || '').trim();
                          const ln = String(order?.customer_last_name || '').trim();
                          const full = [fn, ln].filter(Boolean).join(' ').trim();
                          return full || '—';
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div className="text-gray-700 font-medium">Téléphone</div>
                      <div className="truncate max-w-[60%]">{order?.customer_phone || '—'}</div>
                    </div>
                    <div className="flex items-start justify-between text-sm">
                      <div className="text-gray-700 font-medium">Adresse</div>
                      <div className="text-right text-gray-700 whitespace-pre-wrap max-w-[60%]">
                        {(() => {
                          const a1 = String(order?.customer_address_line1 || '').trim();
                          const a2 = String(order?.customer_address_line2 || '').trim();
                          const pc = String(order?.customer_address_postal_code || '').trim();
                          const city = String(order?.customer_address_city || '').trim();
                          const cc = String(order?.customer_address_country || order?.customer_country_code || '').trim();
                          const row3 = [pc, city].filter(Boolean).join(' ');
                          const parts = [a1, a2, row3, cc].filter(Boolean);
                          return parts.length ? parts.join('\n') : '—';
                        })()}
                      </div>
                    </div>
                  </div>
                ) : null}
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
                {(() => {
                  const s = String(order?.status || '').toLowerCase();
                  if (effectiveRole !== 'buyer') return null;
                  if (s === 'paid' || s === 'cancelled' || s === 'canceled') return null;
                  return (
                    <div className="pt-2 space-y-2">
                      <Button onClick={handleResumePayment} disabled={actioning === 'pay'} className="w-full">Reprendre le paiement</Button>
                      <Button onClick={handleCancelOrder} disabled={actioning === 'cancel'} variant="outline" className="w-full">Annuler la commande</Button>
                    </div>
                  );
                })()}
              </CardContent>
            </Card>

            {effectiveRole === 'seller' && String(order?.fulfillment_status || '').toLowerCase() !== 'completed' ? (
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

            {effectiveRole === 'buyer' && String(order?.fulfillment_status || '').toLowerCase() === 'delivered' && !order?.buyer_received_at ? (
              <Card>
                <CardHeader className="p-4">
                  <CardTitle className="text-base font-semibold">Réception</CardTitle>
                </CardHeader>
                <CardContent className="p-4 pt-0 space-y-2">
                  <Button onClick={handleBuyerConfirmReceived} className="w-full">J'ai bien reçu la commande</Button>
                  {String(order?.status||'').toLowerCase() === 'paid' && autoCompleteDate ? (
                    <div className="text-xs text-gray-500 text-center">La commande sera considérée automatiquement terminée au bout de 14 jours — soit le {formatLongDate(autoCompleteDate)}.</div>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            {chatLocked ? (
              messages.length > 0 ? (
                <Card className="h-[60vh] flex flex-col">
                  <CardHeader className="p-4">
                    <CardTitle className="text-base font-semibold">Chat commande</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 flex flex-col">
                    <div ref={listRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                      {messages.map((m) => (
                        <div key={m.id} className={`max-w-[80%] rounded px-3 py-2 text-sm ${String(m.sender_id||'')===String(session?.user?.id||'') ? 'bg-[#DCFCE7] ml-auto' : 'bg-white border'}`}>
                          <div className="whitespace-pre-wrap break-words">{m.content}</div>
                          <div className="text-[11px] text-gray-500 mt-1">{new Date(m.created_at).toLocaleString()}</div>
                        </div>
                      ))}
                    </div>
                    <div className="border-t p-3">
                      <div className="text-sm font-medium text-red-600">La commande est terminée. Le chat n'est plus disponible.</div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="p-4">
                    <CardTitle className="text-base font-semibold">Chat commande</CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-sm text-gray-600">La commande est terminée. Le chat n'est plus disponible.</div>
                  </CardContent>
                </Card>
              )
            ) : String(order?.status||'').toLowerCase() === 'paid' ? (
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
