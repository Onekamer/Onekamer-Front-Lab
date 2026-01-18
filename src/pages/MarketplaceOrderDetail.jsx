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

  return (
    <>
      <Helmet>
        <title>Commande #{orderId} - OneKamer.co</title>
      </Helmet>

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => navigate('/market/orders')} className="px-2">Retour</Button>
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
          </div>
        )}
      </div>
    </>
  );
};

export default MarketplaceOrderDetail;
