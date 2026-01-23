
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Helmet } from 'react-helmet';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Send, Loader2, Heart, Mic, Square, X, Image as ImageIcon, Phone } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
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
import { uploadAudioFile } from '@/utils/audioStorage';
import GroupAudioCall from '@/components/GroupAudioCall';
import { extractUniqueMentions } from '@/utils/mentions';
import { notifyGroupMentions } from '@/services/supabaseNotifications';

const AudioPlayer = ({ src, initialDuration = 0 }) => {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(initialDuration);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const reloadOnceRef = useRef(false);

  const togglePlayPause = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause(); else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const setAudioData = () => {
      if (isFinite(audio.duration)) setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
      setIsLoading(false);
    };
    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const onError = () => {
      setHasError(true);
      setIsLoading(false);
      const el = audioRef.current;
      if (el && !reloadOnceRef.current) {
        reloadOnceRef.current = true;
        const srcUrl = typeof src === 'string' ? src : '';
        const bust = srcUrl.includes('?') ? `${srcUrl}&t=${Date.now()}` : `${srcUrl}?t=${Date.now()}`;
        try {
          el.pause();
          el.src = bust;
          el.load();
        } catch (_) {}
      }
    };
    audio.addEventListener('loadedmetadata', setAudioData);
    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', () => setIsPlaying(false));
    audio.addEventListener('canplaythrough', () => setIsLoading(false));
    audio.addEventListener('error', onError);
    if (audio.readyState >= 2) setAudioData();
    return () => {
      audio.removeEventListener('loadedmetadata', setAudioData);
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', () => setIsPlaying(false));
      audio.removeEventListener('canplaythrough', () => setIsLoading(false));
      audio.removeEventListener('error', onError);
    };
  }, [src]);

  const formatTime = (t) => {
    if (isNaN(t) || t === Infinity) return '0:00';
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const guessedType = useMemo(() => {
    const u = (src || '').split('?')[0].toLowerCase();
    if (u.endsWith('.m4a') || u.endsWith('.mp4')) return 'audio/mp4';
    if (u.endsWith('.webm')) return 'audio/webm';
    if (u.endsWith('.ogg') || u.endsWith('.oga')) return 'audio/ogg';
    if (u.endsWith('.mp3')) return 'audio/mpeg';
    return undefined;
  }, [src]);

  return (
    <div className="flex items-center gap-2 bg-gray-200 rounded-full p-2 mt-2">
      <audio ref={audioRef} preload="metadata" playsInline>
        <source src={src} type={guessedType} />
        <source src={src} />
      </audio>
      <Button onClick={togglePlayPause} size="icon" className="rounded-full w-8 h-8">
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (isPlaying ? '❚❚' : '▶')}
      </Button>
      <div className="w-full bg-gray-300 rounded-full h-1.5">
        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${(currentTime / duration) * 100 || 0}%` }}></div>
      </div>
      <span className="text-xs text-gray-600 w-20 text-center">{formatTime(currentTime)} / {formatTime(duration)}</span>
      {hasError && <span className="text-xs text-red-600 ml-2">Audio non supporté</span>}
    </div>
  );
};

const MessageItem = ({ msg, currentUserId, groupId, onActionComplete }) => {
  const { user, onlineUserIds } = useAuth();
  const { toast } = useToast();
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
      toast({ title: 'Connectez-vous pour aimer ce message.', variant: 'destructive' });
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
    const c = msg.message_contenu || '';
    const isHttp = /^https?:\/\//i.test(c);
    // Ne pas classer .mp4 comme audio
    const isAudio = /(\.webm$|\.ogg$|\.m4a$|\.mp3$)/i.test(c.split('?')[0] || '');
    const isImage = /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.avif)(\?|$)/i.test(c);
    const isVideo = /(\.mp4|\.webm|\.ogg|\.mov)(\?|$)/i.test(c);
    if (isHttp) {
      // Priorité à la vidéo lorsque l'extension est ambiguë (.webm/.ogg peuvent être vidéo ou audio)
      if (isVideo) return <video src={c} controls className="rounded-lg max-h-80" />;
      if (isImage) return <img src={c} alt="Média partagé" className="rounded-lg max-h-80" />;
      if (isAudio) return <AudioPlayer src={c} initialDuration={msg.audio_duration || 0} />;
    }
    // Legacy path in Supabase storage
    try {
      const isMediaPath = c && c.includes('/');
      if (isMediaPath) {
        return <MediaDisplay bucket="groupes" path={c} alt="Média partagé" className="rounded-lg max-h-80 cursor-pointer" />;
      }
    } catch (e) { }
    return <p className="text-gray-800">{c}</p>;
  };

  const isMyMessage = msg.sender_id === currentUserId;
  const isSenderOnline = Boolean(msg?.sender_id && onlineUserIds instanceof Set && onlineUserIds.has(String(msg.sender_id)));

  return (
    <Card className="bg-white/80 backdrop-blur-sm border-none shadow-sm mb-4">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="relative">
            <Avatar>
              <AvatarImage src={msg.sender_avatar} />
              <AvatarFallback>{msg.sender_username?.[0] || '?'}</AvatarFallback>
            </Avatar>
            {isSenderOnline && (
              <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white" />
            )}
          </div>
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, session, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [groupData, setGroupData] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [joinRequestStatus, setJoinRequestStatus] = useState('idle');
  const [isStartingCall, setIsStartingCall] = useState(false);
  const [currentCall, setCurrentCall] = useState(null);
  const [isInCall, setIsInCall] = useState(false);
  // Media attach state
  const [mediaFile, setMediaFile] = useState(null);
  const [mediaPreviewUrl, setMediaPreviewUrl] = useState(null);
  const mediaInputRef = useRef(null);
  // Audio recording state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recorderPromiseRef = useRef(null);
  const mimeRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const messagesEndRef = useRef(null);
  const messageRefs = useRef({});

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
      if (groupOnlyError || !groupOnlyData) {
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
  }, [groupId, user, session, navigate, toast]);

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

  // Scroll automatique vers un message ciblé (mention) via ?messageId=
  useEffect(() => {
    const targetId = searchParams.get('messageId');
    if (!targetId || !messages || messages.length === 0) return;
    const el = messageRefs.current[targetId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchParams, messages]);

  const pickSupportedMime = useCallback(() => {
    const ua = navigator.userAgent.toLowerCase();
    // ✅ iOS / Safari ou PWA iPhone -> MP4 obligatoire
    if (ua.includes('iphone') || ua.includes('ipad') || (ua.includes('safari') && !ua.includes('chrome'))) {
      return { type: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' };
    }
    // ✅ Android / Chrome / Desktop -> WebM (Opus) préféré
    if (window.MediaRecorder?.isTypeSupported?.('audio/webm;codecs=opus')) {
      return { type: 'audio/webm;codecs=opus', ext: 'webm' };
    }
    // ✅ Fallback OGG
    if (window.MediaRecorder?.isTypeSupported?.('audio/ogg;codecs=opus')) {
      return { type: 'audio/ogg;codecs=opus', ext: 'ogg' };
    }
    // 🔙 Fallback ultime
    return { type: 'audio/mp4;codecs=mp4a.40.2', ext: 'm4a' };
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaPreviewUrl(URL.createObjectURL(file));
      // reset audio if any
      setAudioBlob(null);
      setRecordingTime(0);
      recorderPromiseRef.current = null;
      mimeRef.current = null;
    }
  };

  const handleRemoveMedia = () => {
    setMediaFile(null);
    setMediaPreviewUrl(null);
    if (mediaInputRef.current) mediaInputRef.current.value = '';
  };

  const uploadToBunny = async (file, folder) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);
    const response = await fetch(`${import.meta.env.VITE_API_URL}/upload`, { method: 'POST', body: formData });
    const text = await response.text();
    let data = null;
    if (text) {
      try { data = JSON.parse(text); } catch { throw new Error("Réponse inattendue du serveur d'upload"); }
    }
    if (!response.ok || !data?.success) {
      const message = data?.message || `Erreur d’upload BunnyCDN (code ${response.status})`;
      throw new Error(message);
    }
    return data.url;
  };

  const startRecording = async () => {
    try {
      setAudioBlob(null);
      setRecordingTime(0);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chosenMime = pickSupportedMime();
      mimeRef.current = chosenMime;
      let resolveRecording;
      const recordingDone = new Promise((resolve) => (resolveRecording = resolve));
      recorderPromiseRef.current = recordingDone;
      const supportedMimeType = window.MediaRecorder?.isTypeSupported?.(chosenMime.type) ? chosenMime.type : undefined;
      // Warm-up AudioContext pour Safari iOS
      try {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          const osc = ctx.createOscillator();
          const dest = ctx.createMediaStreamDestination();
          osc.connect(dest);
          osc.start();
          osc.stop(ctx.currentTime + 0.05);
          ctx.resume?.();
        }
      } catch (e) { console.warn('AudioContext warm-up échec', e); }

      const recorder = supportedMimeType ? new MediaRecorder(stream, { mimeType: supportedMimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onerror = (e) => { console.error('MediaRecorder error', e); resolveRecording(null); };
      recorder.onstop = async () => {
        clearInterval(recordingIntervalRef.current);
        if (recorder.manualPollingInterval) clearInterval(recorder.manualPollingInterval);
        stream.getTracks().forEach((t) => t.stop());
        await new Promise((r) => setTimeout(r, 300));
        const finalType = (mimeRef.current?.type || 'audio/webm').split(';')[0];
        const blob = new Blob(audioChunksRef.current, { type: finalType });
        setAudioBlob(blob);
        setIsRecording(false);
        mediaRecorderRef.current = null;
        resolveRecording(blob);
      };
      await new Promise((r) => setTimeout(r, 300));
      recorder.start(1000); // timeslice=1000 force chunks toutes les secondes (fix mobile 0 octets)
      // Polling manuel supplémentaire (iOS)
      try {
        recorder.manualPollingInterval = setInterval(() => {
          if (recorder.state === 'recording' && typeof recorder.requestData === 'function') {
            recorder.requestData();
          }
        }, 1000);
      } catch (_) {}
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      recordingIntervalRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
      setTimeout(() => { if (recorder.state !== 'inactive') recorder.stop(); }, 120000);
    } catch (err) {
      console.error('Erreur microphone:', err);
      toast({ title: "Erreur microphone", description: "Veuillez autoriser le micro.", variant: "destructive" });
      setAudioBlob(null);
      setRecordingTime(0);
      recorderPromiseRef.current = null;
      mimeRef.current = null;
    }
  };

  const handleSendMessage = async () => {
    if (!user) return;
    // If audio present (or pending), upload audio and send URL
    let finalBlob = audioBlob;
    if (!finalBlob && recorderPromiseRef.current) finalBlob = await recorderPromiseRef.current;

    if (finalBlob) {
      if (!finalBlob || finalBlob.size < 2000) {
        toast({ title: 'Erreur audio', description: "Audio vide ou trop court.", variant: 'destructive' });
        return;
      }
      const { ext, type } = mimeRef.current || { ext: 'webm', type: finalBlob.type || 'audio/webm' };
      const file = new File([finalBlob], `group-audio-${user.id}-${Date.now()}.${ext}`, { type });
      try {
        // Align to same bucket/folder as échange communautaire
        const { publicUrl } = await uploadAudioFile(file, 'comments_audio');
        const { error } = await supabase.from('messages_groupes').insert({
          groupe_id: groupId,
          sender_id: user.id,
          contenu: publicUrl,
        });
        if (error) throw error;
        handleRemoveAudio();
      } catch (e) {
        toast({ title: 'Erreur', description: e.message || 'Envoi audio impossible.', variant: 'destructive' });
      }
      return;
    }

    // Media file (image/video)
    if (mediaFile) {
      try {
        const url = await uploadToBunny(mediaFile, 'comments');
        const { error } = await supabase.from('messages_groupes').insert({
          groupe_id: groupId,
          sender_id: user.id,
          contenu: url,
        });
        if (error) throw error;
        handleRemoveMedia();
        setNewMessage('');
      } catch (e) {
        toast({ title: 'Erreur', description: e.message || 'Envoi média impossible.', variant: 'destructive' });
      }
      return;
    }

    if (!newMessage.trim()) return;

    // Mentions dans le message texte (recherche insensible à la casse)
    const mentionUsernames = extractUniqueMentions(newMessage);
    console.log('[GroupMentions] usernames détectés :', mentionUsernames);
    let mentionTargets = [];
    if (mentionUsernames.length) {
      const found = [];
      for (const raw of mentionUsernames) {
        const username = (raw || '').replace(/^@/, '');
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('id, username')
          .ilike('username', `%${username}%`)
          .maybeSingle();

        if (!profileError && profileData) {
          found.push(profileData);
        }
      }
      if (found.length) {
        // dédoublonner au cas où
        const unique = new Map();
        found.forEach((p) => {
          if (p?.id && !unique.has(p.id)) unique.set(p.id, p);
        });
        mentionTargets = Array.from(unique.values());
        console.log('[GroupMentions] cibles résolues :', mentionTargets);
      }
    }

    const { data: insertedMessage, error } = await supabase
      .from('messages_groupes')
      .insert({
        groupe_id: groupId,
        sender_id: user.id,
        contenu: newMessage,
      })
      .select('id')
      .single();

    if (error) {
      toast({ title: 'Erreur', description: 'Impossible d\'envoyer le message.', variant: 'destructive' });
    } else {
      setNewMessage('');

      if (mentionTargets.length && insertedMessage?.id) {
        try {
          console.log('[GroupMentions] envoi notification', {
            mentionedIds: mentionTargets.map((m) => m.id),
            groupId,
            messageId: insertedMessage.id,
          });
          const ok = await notifyGroupMentions({
            mentionedUserIds: mentionTargets.map((m) => m.id),
            authorName: user?.email || 'Un membre OneKamer',
            excerpt: newMessage,
            groupId,
            messageId: insertedMessage.id,
          });
          console.log('[GroupMentions] résultat notifyGroupMentions =', ok);
        } catch (notificationError) {
          console.error('Erreur notification (mention groupe):', notificationError);
        }
      }
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

  const handleStartGroupCall = async () => {
    if (!user) {
      toast({
        title: 'Connexion requise',
        description: 'Veuillez vous connecter pour démarrer un appel.',
        variant: 'destructive',
      });
      return;
    }

    try {
      setIsStartingCall(true);
      const rawApi = import.meta.env.VITE_API_URL;
      const apiUrl = (rawApi || '').replace(/\/$/, '');
      console.log('[GroupCall] handleStartGroupCall click', { rawApi, apiUrl, groupId, userId: user.id });

      const response = await fetch(`${apiUrl}/groups/${groupId}/call/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      let data = null;
      try {
        data = await response.json();
      } catch (e) {
        console.warn('[GroupCall] Impossible de parser la réponse JSON de /call/start', e);
      }

      if (!response.ok) {
        const message = data?.error || "Impossible de démarrer l'appel.";
        toast({ title: 'Erreur appel', description: message, variant: 'destructive' });
        console.error('[GroupCall] Erreur HTTP start call', { status: response.status, data });
        return;
      }
      const roomName = data?.roomName || data?.room || data?.room_name || null;
      const token = data?.token;
      const url = data?.url || data?.serverUrl || data?.livekitUrl;

      if (!token || !url) {
        console.error('[GroupCall] Réponse start call incomplète:', data);
        toast({
          title: 'Erreur appel',
          description: "Réponse du serveur incomplète pour démarrer l'appel.",
          variant: 'destructive',
        });
        return;
      }

      setCurrentCall({ roomName, token, url });
      setIsInCall(true);

      console.log('✅ [GroupCall] Appel de groupe démarré', { roomName, tokenPresent: !!token, url });
      toast({
        title: 'Appel démarré',
        description: 'Connexion à la salle en cours...',
        variant: 'default',
      });
    } catch (e) {
      console.error('❌ [GroupCall] Erreur start group call:', e);
      toast({
        title: 'Erreur',
        description: e?.message || "Erreur interne lors du démarrage de l'appel.",
        variant: 'destructive',
      });
    } finally {
      setIsStartingCall(false);
    }
  };

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
    const info = groupData[0];
    // Le fondateur est toujours considéré comme membre du groupe
    if (info?.groupe_fondateur_id === user.id) return true;
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
            <div className="flex items-center justify-end w-24">
              {isMember && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleStartGroupCall}
                  disabled={isStartingCall}
                  className="flex items-center gap-1"
                >
                  {isStartingCall ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline">Appel</span>
                </Button>
              )}
            </div>
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
            <div className="flex-grow overflow-y-auto flex flex-col">
              <div className="p-4 space-y-2">
                {messages.map(msg => (
                  <div
                    key={msg.message_id}
                    ref={(el) => {
                      if (el) messageRefs.current[msg.message_id] = el;
                    }}
                  >
                    <MessageItem
                      msg={msg}
                      currentUserId={user.id}
                      groupId={groupId}
                      onActionComplete={fetchGroupData}
                    />
                  </div>
                ))}
                <div ref={messagesEndRef}></div>
              </div>
              {isMember && (
                <div className="flex-shrink-0 p-3 border-t bg-gray-50">
                  {isInCall && currentCall && (
                    <GroupAudioCall
                      url={currentCall.url}
                      token={currentCall.token}
                      roomName={currentCall.roomName}
                      onLeave={() => {
                        setIsInCall(false);
                        setCurrentCall(null);
                      }}
                    />
                  )}
                  <div className="flex items-center gap-2">
                    {isRecording ? (
                      <div className="flex items-center gap-2 w-full bg-gray-100 p-2 rounded-lg">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-sm text-red-500 font-mono">{`${Math.floor(recordingTime / 60)}:${String(recordingTime % 60).padStart(2, '0')}`}</span>
                      </div>
                    ) : (
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Votre message..."
                        className="flex-1 bg-white"
                        rows={1}
                        disabled={!!audioBlob}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                      />
                    )}
                    <Button onClick={handleSendMessage} size="icon" className="bg-[#2BA84A] rounded-full shrink-0" disabled={!newMessage.trim() && !audioBlob && !recorderPromiseRef.current && !mediaFile}><Send className="h-5 w-5" /></Button>
                  </div>
                  {(mediaPreviewUrl || audioBlob) && (
                    <div className="relative p-2 bg-gray-100 rounded-lg mt-2">
                      {mediaPreviewUrl && mediaFile?.type?.startsWith('image') ? (
                        <img src={mediaPreviewUrl} alt="preview" className="w-24 h-24 rounded object-cover" />
                      ) : mediaPreviewUrl ? (
                        <video src={mediaPreviewUrl} controls className="w-full rounded object-cover" />
                      ) : audioBlob ? (
                        <AudioPlayer src={URL.createObjectURL(audioBlob)} initialDuration={recordingTime} />
                      ) : null}
                      <Button size="icon" variant="destructive" onClick={mediaPreviewUrl ? handleRemoveMedia : handleRemoveAudio} className="absolute -top-1 -right-1 h-5 w-5 rounded-full"><X className="h-3 w-3" /></Button>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    {!isRecording && !audioBlob && (
                      <Button size="sm" type="button" variant="ghost" onClick={() => mediaInputRef.current?.click()} disabled={!!audioBlob}>
                        <ImageIcon className="h-4 w-4 mr-2" /> Image/Vidéo
                      </Button>
                    )}
                    <input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={handleFileChange} disabled={isRecording || !!audioBlob} />
                    {!mediaFile && (
                      !isRecording ? (
                        !audioBlob && (
                          <Button size="sm" type="button" variant="ghost" onClick={startRecording}>
                            <Mic className="h-4 w-4 mr-2" /> Audio
                          </Button>
                        )
                      ) : (
                        <Button size="sm" type="button" variant="destructive" onClick={stopRecording}>
                          <Square className="h-4 w-4 mr-2" /> Stop
                        </Button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="members" className="flex-grow overflow-y-auto p-4">
            <GroupMembers members={members} currentUserRole={currentUserRole} currentUserId={user.id} groupId={groupId} onMemberUpdate={fetchGroupData} />
          </TabsContent>

          {(currentUserRole === 'admin' || currentUserRole === 'fondateur') && (
            <TabsContent value="admin" className="flex-grow overflow-y-auto p-4">
              <GroupAdmin group={{ ...groupInfo, id: groupInfo.groupe_id, fondateur_id: groupInfo.groupe_fondateur_id, groupes_membres: members }} onGroupUpdate={fetchGroupData} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </>
  );
};

export default GroupeDetail;
