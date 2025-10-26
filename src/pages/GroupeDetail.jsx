
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
    import { Helmet } from 'react-helmet';
    import { useParams, useNavigate } from 'react-router-dom';
    import { Card, CardContent } from '@/components/ui/card';
    import { Button } from '@/components/ui/button';
    import { ArrowLeft, Send, Loader2, Heart } from 'lucide-react';
    import { Textarea } from '@/components/ui/textarea';
    import { toast } from '@/components/ui/use-toast';
    import { supabase } from '@/lib/customSupabaseClient';
    import { useAuth } from '@/contexts/SupabaseAuthContext';
    import MediaDisplay from '@/components/MediaDisplay';
    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import DonationDialog from '@/components/DonationDialog';
    import { formatDistanceToNow } from 'date-fns';
    import { fr } from 'date-fns/locale';
    import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
    import GroupMembers from '@/pages/groupes/GroupMembers';
    import GroupAdmin from '@/pages/groupes/GroupAdmin';

    const MessageItem = ({ msg, currentUserId, groupId, onActionComplete }) => {
      const { user } = useAuth();
      const [isLiked, setIsLiked] = useState(false);
      const [likesCount, setLikesCount] = useState(msg.likes_count || 0);

      const checkLiked = useCallback(async () => {
        if (!user || !msg.message_id) return;
        const { data, error } = await supabase
          .from('group_message_likes')
          .select('id')
          .eq('message_id', msg.message_id)
          .eq('user_id', user.id)
          .maybeSingle();

        if (!error && data) {
          setIsLiked(true);
        }
      }, [user, msg.message_id]);
      
      useEffect(() => {
        if (!msg.is_system_message) {
          checkLiked();
        }
      }, [checkLiked, msg.is_system_message]);

      const handleLike = async () => {
        if (!user || !msg.message_id) {
          toast({ title: 'Connectez-vous pour aimer ce message.', variant: 'destructive'});
          return;
        }

        const currentlyLiked = isLiked;
        setIsLiked(!currentlyLiked);
        setLikesCount(prev => currentlyLiked ? prev - 1 : prev + 1);

        if (currentlyLiked) {
          await supabase.from('group_message_likes').delete().match({ message_id: msg.message_id, user_id: user.id });
        } else {
          await supabase.from('group_message_likes').insert({ message_id: msg.message_id, user_id: user.id });
        }
      };
      
      if (msg.is_system_message) {
        return (
            <div className="text-center my-4">
                <p className="text-sm text-green-600 bg-green-100 rounded-full px-3 py-1 inline-block">{msg.message_contenu}</p>
            </div>
        );
      }

      const renderContent = () => {
        try {
          const isMedia = msg.message_contenu && msg.message_contenu.includes('/');
          if (isMedia) {
             return <MediaDisplay bucket="groupes" path={msg.message_contenu} alt="Média partagé" className="rounded-lg max-h-80 cursor-pointer" />;
          }
        } catch(e) {
          // not a media path
        }
        return <p className="text-gray-800">{msg.message_contenu}</p>;
      }

      const isMyMessage = msg.sender_id === currentUserId;

      return (
          <Card className="bg-white/80 backdrop-blur-sm border-none shadow-sm mb-4">
              <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                      <Avatar>
                          <AvatarImage src={msg.sender_avatar} />
                          <AvatarFallback>{msg.sender_username?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                          <div>
                              <p className="font-bold">{msg.sender_username || 'Utilisateur inconnu'}</p>
                              <p className="text-xs text-gray-500">
                                {formatDistanceToNow(new Date(msg.message_date), { addSuffix: true, locale: fr })}
                              </p>
                          </div>
                           <div className="mt-3">
                              {renderContent()}
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-4 text-[#6B6B6B] mt-3 pl-12">
                      <button
                        className={`flex items-center gap-2 hover:text-[#E0222A] transition-colors ${isLiked ? 'text-[#E0222A]' : ''}`}
                        onClick={handleLike}
                      >
                        <Heart className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                        <span>{likesCount}</span>
                      </button>
                      {!isMyMessage && msg.sender_id && (
                        <DonationDialog receiverId={msg.sender_id} receiverName={msg.sender_username} groupId={groupId} onDonationComplete={onActionComplete} />
                      )}
                  </div>
              </CardContent>
          </Card>
      )
    };
    
    const GroupeDetail = () => {
      const { groupId } = useParams();
      const navigate = useNavigate();
      const { user, session, loading: authLoading } = useAuth();
      const [groupData, setGroupData] = useState([]);
      const [messages, setMessages] = useState([]);
      const [loading, setLoading] = useState(true);
      const [newMessage, setNewMessage] = useState('');
      const [joinRequestStatus, setJoinRequestStatus] = useState('idle');
      const messagesEndRef = useRef(null);
    
      const fetchGroupData = useCallback(async () => {
        if (!user || !session) {
          setLoading(false);
          return;
        }

        const { data, error } = await supabase
            .from('vue_groupes_complete')
            .select('*')
            .eq('groupe_id', groupId)
            .order('message_date', { ascending: true });

        if (error) {
            console.error('Erreur chargement vue:', error);
            toast({ title: 'Erreur', description: 'Groupe introuvable ou erreur de chargement.', variant: 'destructive' });
            navigate('/groupes');
            setLoading(false);
            return;
        }
        
        if (data.length === 0) {
           const { data: groupOnlyData, error: groupOnlyError } = await supabase.from('groupes').select('*').eq('id', groupId).single();
           if(groupOnlyError || !groupOnlyData){
             toast({ title: 'Erreur', description: 'Groupe introuvable.', variant: 'destructive' });
             navigate('/groupes');
             setLoading(false);
             return;
           }
           setGroupData([{
             groupe_id: groupOnlyData.id,
             groupe_nom: groupOnlyData.nom,
             groupe_description: groupOnlyData.description,
             groupe_prive: groupOnlyData.est_prive,
             groupe_fondateur_id: groupOnlyData.fondateur_id,
             groupe_image_url: groupOnlyData.image_url,
           }]);
           setMessages([]);
        } else {
            setGroupData(data);
            const uniqueMessages = new Map();
            data.forEach(row => {
                if (row.message_id && !uniqueMessages.has(row.message_id)) {
                    uniqueMessages.set(row.message_id, row);
                }
            });
            setMessages(Array.from(uniqueMessages.values()));
        }

        setLoading(false);
    }, [groupId, user, session, navigate]);

      useEffect(() => {
        if (!authLoading) {
            if (user && session) {
                fetchGroupData();
            } else {
                navigate('/auth');
            }
        }
      }, [user, session, authLoading, fetchGroupData, navigate]);
    
      useEffect(() => {
        if (!user || !groupId) return;
      
        const channel = supabase
          .channel(`group-realtime-${groupId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages_groupes',
              filter: `groupe_id=eq.${groupId}`,
            },
            async (payload) => {
              const { data: senderProfile } = await supabase
                .from('profiles')
                .select('username, avatar_url')
                .eq('id', payload.new.sender_id)
                .single();
      
              const newMessage = {
                message_id: payload.new.id,
                message_contenu: payload.new.contenu,
                message_date: payload.new.created_at,
                sender_id: payload.new.sender_id,
                likes_count: 0,
                sender_username: senderProfile?.username,
                sender_avatar: senderProfile?.avatar_url,
                is_system_message: payload.new.is_system_message
              };
      
              setMessages((prev) => [...prev, newMessage]);
              setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
            }
          )
          .subscribe();
      
        return () => supabase.removeChannel(channel);
      }, [groupId, user]);

      useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }, [messages]);

      const handleSendMessage = async () => {
        if (!newMessage.trim() || !user) return;
        const { error } = await supabase.from('messages_groupes').insert({
          groupe_id: groupId,
          sender_id: user.id,
          contenu: newMessage,
        });
        if (error) {
            toast({ title: 'Erreur', description: 'Impossible d\'envoyer le message.', variant: 'destructive' });
        } else {
            setNewMessage('');
        }
      };

      const handleRequestToJoin = async () => {
          if (!user) {
              toast({ title: 'Connectez-vous pour rejoindre un groupe', variant: 'destructive' });
              return;
          }
          setJoinRequestStatus('loading');
          const { error } = await supabase.rpc('request_to_join_group', { p_group_id: groupId });
          if (error) {
              toast({ title: 'Erreur', description: error.message, variant: 'destructive' });
              setJoinRequestStatus('error');
          } else {
              toast({ title: 'Demande envoyée', description: 'Votre demande a été envoyée au fondateur du groupe.' });
              setJoinRequestStatus('sent');
          }
      }

      const groupInfo = useMemo(() => groupData?.[0], [groupData]);

      const members = useMemo(() => {
        if (!groupData) return [];
        const uniqueMembers = new Map();
        groupData.forEach(row => {
          if (row.membre_id && !uniqueMembers.has(row.membre_id)) {
            uniqueMembers.set(row.membre_id, {
              user_id: row.membre_id,
              is_admin: row.membre_is_admin,
              role: row.membre_role,
              profile: {
                username: row.membre_username,
                avatar_url: row.membre_avatar
              }
            });
          }
        });
        return Array.from(uniqueMembers.values());
      }, [groupData]);

      const currentUserRole = useMemo(() => {
        if (!groupInfo || !user) return 'guest';
        if (groupInfo.groupe_fondateur_id === user.id) return 'fondateur';
        const member = members.find(m => m.user_id === user.id);
        if (!member) return 'guest';
        if (member.is_admin) return 'admin';
        return 'membre';
      }, [groupInfo, user, members]);

      const isMember = useMemo(() => {
         if (!groupData || !user) return false;
         return groupData.some(row => row.membre_id === user.id);
      }, [groupData, user]);

      if (loading || authLoading) return <div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin" /></div>;
      if (!groupInfo) return null;
    
      if (!isMember && groupInfo.groupe_prive) {
        return (
          <>
            <Helmet><title>Rejoindre {groupInfo.groupe_nom}</title></Helmet>
            <Button variant="ghost" onClick={() => navigate('/groupes')} className="mb-4"><ArrowLeft className="h-4 w-4 mr-2" /> Retour</Button>
            <Card className="text-center">
              <CardContent className="pt-6">
                <MediaDisplay bucket="groupes" path={groupInfo.groupe_image_url} alt={groupInfo.groupe_nom} className="w-32 h-32 rounded-full object-cover mx-auto mb-4" />
                <h1 className="text-2xl font-bold">{groupInfo.groupe_nom}</h1>
                <p className="mt-4">{groupInfo.groupe_description}</p>
                 <Button 
                    className="mt-6 bg-[#2BA84A]" 
                    onClick={handleRequestToJoin}
                    disabled={joinRequestStatus !== 'idle'}
                 >
                    {joinRequestStatus === 'loading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {joinRequestStatus === 'sent' ? 'Demande envoyée' : 'Demander à rejoindre'}
                </Button>
              </CardContent>
            </Card>
          </>
        );
      }
    
      return (
        <>
          <Helmet><title>{groupInfo.groupe_nom} - Groupe OneKamer.co</title></Helmet>
          <div className="flex flex-col h-[calc(100vh-8rem)]">
            <div className="flex-shrink-0">
              <div className="flex items-center p-3 border-b">
                <Button variant="ghost" size="icon" onClick={() => navigate('/groupes')}><ArrowLeft className="h-5 w-5" /></Button>
                <div className="flex-1 text-center">
                  <h1 className="font-bold text-lg">{groupInfo.groupe_nom}</h1>
                  <p className="text-sm text-gray-500">{members.length} membres</p>
                </div>
                <div className="w-10"></div>
              </div>
            </div>
            
            <Tabs defaultValue="messages" className="flex-grow flex flex-col overflow-hidden">
              <div className="flex-shrink-0">
                <TabsList className="grid w-full grid-cols-3 mx-auto max-w-md">
                  <TabsTrigger value="messages">Messages</TabsTrigger>
                  <TabsTrigger value="members">Membres</TabsTrigger>
                  {(currentUserRole === 'admin' || currentUserRole === 'fondateur') && <TabsTrigger value="admin">Admin</TabsTrigger>}
                </TabsList>
              </div>
              
              <TabsContent value="messages" className="flex-grow flex flex-col overflow-hidden">
                {isMember && (
                  <div className="flex-shrink-0 p-3 border-b bg-gray-50">
                      <div className="flex items-center gap-2">
                          <Textarea 
                              value={newMessage} 
                              onChange={(e) => setNewMessage(e.target.value)} 
                              placeholder="Votre message..." 
                              className="flex-1 bg-white" 
                              rows={1}
                              onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      handleSendMessage();
                                  }
                              }}
                          />
                          <Button onClick={handleSendMessage} size="icon" className="bg-[#2BA84A] rounded-full shrink-0"><Send className="h-5 w-5" /></Button>
                      </div>
                  </div>
                )}
                <div className="flex-grow overflow-y-auto p-4 space-y-2">
                  {messages.map(msg => <MessageItem key={msg.message_id} msg={msg} currentUserId={user.id} groupId={groupId} onActionComplete={fetchGroupData} />)}
                  <div ref={messagesEndRef}></div>
                </div>
              </TabsContent>

              <TabsContent value="members" className="flex-grow overflow-y-auto p-4">
                <GroupMembers members={members} currentUserRole={currentUserRole} currentUserId={user.id} groupId={groupId} onMemberUpdate={fetchGroupData} />
              </TabsContent>

              {(currentUserRole === 'admin' || currentUserRole === 'fondateur') && (
                <TabsContent value="admin" className="flex-grow overflow-y-auto p-4">
                  <GroupAdmin group={{...groupInfo, id: groupInfo.groupe_id, fondateur_id: groupInfo.groupe_fondateur_id, groupes_membres: members}} onGroupUpdate={fetchGroupData}/>
                </TabsContent>
              )}
            </Tabs>
          </div>
        </>
      );
    };
    
    export default GroupeDetail;
