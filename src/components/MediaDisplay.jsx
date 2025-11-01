import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, ImageOff } from 'lucide-react';

const defaultImages = {
  annonces: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/deafb02734097cfca203ab9aad10f6ba.png',
  evenements: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/e3c7a83af237fb7227a561adbdc2fb56.png',
  partenaires: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/fbbe30b8a750bf10ddf4da2c7de7bfd3.png',
  groupes: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/0d1b14eb0b6bbb002d83d44342b4afd2.png',
  faits_divers: 'https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/3426b67577181940ee97b83de9829d6d.png',
};

const MediaDisplay = ({ bucket, path, alt, className }) => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mediaType, setMediaType] = useState(null);
  const [errorState, setErrorState] = useState(false);

  useEffect(() => {
    const fetchMedia = async () => {
      setLoading(true);
      setErrorState(false);
      setMediaUrl(null);

      // 🧩 Cas 1 : pas de path -> image par défaut
      if (!path) {
        const fallback = defaultImages[bucket] || null;
        setMediaUrl(fallback);
        setMediaType('image');
        setErrorState(!fallback);
        setLoading(false);
        return;
      }

      // 🧩 Cas 2 : URL déjà complète (signée ou CDN)
      if (path.startsWith('http') || path.startsWith('blob:')) {
        setMediaUrl(path);
        const fileExt = path.split('.').pop().toLowerCase();
        const isVideo = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(fileExt);
        setMediaType(isVideo ? 'video' : 'image');
        setLoading(false);
        return;
      }

      // 🧩 Cas 3 : chemin relatif Supabase → création d’URL signée temporaire
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
        if (error || !data?.signedUrl) {
          console.warn(`⚠️ Média introuvable ou non signé dans ${bucket}/${path}`);
          const fallback = defaultImages[bucket] || null;
          setMediaUrl(fallback);
          setMediaType('image');
          setErrorState(!fallback);
        } else {
          setMediaUrl(data.signedUrl);
          const fileExt = path.split('.').pop().toLowerCase();
          setMediaType(['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(fileExt) ? 'video' : 'image');
        }
      } catch (err) {
        console.error(`❌ Erreur MediaDisplay (${bucket}/${path}):`, err.message);
        const fallback = defaultImages[bucket] || null;
        setMediaUrl(fallback);
        setMediaType('image');
        setErrorState(!fallback);
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [path, bucket]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (errorState || !mediaUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-200 ${className}`}>
        <ImageOff className="h-8 w-8 text-gray-500" />
        <p className="text-xs text-gray-500 mt-1">Média indisponible</p>
      </div>
    );
  }

  if (mediaType === 'video') {
    return <video src={mediaUrl} controls className={className} playsInline />;
  }

  return <img src={mediaUrl} alt={alt || 'image'} className={className} />;
};

export default MediaDisplay;
