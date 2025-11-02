import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/customSupabaseClient';
import { Loader2, ImageOff } from 'lucide-react';

// 🧩 Images par défaut locales pour les buckets sans CDN
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

      // 🧩 Aucun fichier → image par défaut selon le bucket
      if (!path) {
        setMediaUrl(defaultImages[bucket] || null);
        setMediaType('image');
        setLoading(false);
        if (!defaultImages[bucket]) setErrorState(true);
        return;
      }

      // 🧠 Si le chemin est une URL complète (BunnyCDN / lien absolu / blob)
      if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('blob:')) {
        setMediaUrl(path);
        const isVideo =
          path.endsWith('.mp4') ||
          path.endsWith('.webm') ||
          path.endsWith('.ogg') ||
          path.startsWith('blob:video');
        setMediaType(isVideo ? 'video' : 'image');
        setLoading(false);
        return;
      }

      // 🔐 Sinon : charger depuis Supabase Storage (cas des uploads directs)
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600); // 1h

        if (error) {
          if (error.message.includes('not found')) {
            console.warn(`❌ Média introuvable dans "${bucket}" → fallback par défaut`);
            setMediaUrl(defaultImages[bucket] || null);
            setMediaType('image');
            if (!defaultImages[bucket]) setErrorState(true);
          } else {
            throw error;
          }
        } else if (data?.signedUrl) {
          setMediaUrl(data.signedUrl);
          const ext = path.split('.').pop().toLowerCase();
          setMediaType(['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext) ? 'video' : 'image');
        } else {
          throw new Error('Aucune URL signée générée.');
        }
      } catch (err) {
        console.error(`Erreur récupération média (${bucket}/${path}) :`, err.message);
        setMediaUrl(defaultImages[bucket] || null);
        setMediaType('image');
        if (!defaultImages[bucket]) setErrorState(true);
      } finally {
        setLoading(false);
      }
    };

    fetchMedia();
  }, [path, bucket]);

  // 🌀 Loading state
  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 ${className}`}>
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
      </div>
    );
  }

  // ❌ Erreur ou média absent
  if (errorState || !mediaUrl) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-200 ${className}`}>
        <ImageOff className="h-8 w-8 text-gray-500" />
        <p className="text-xs text-gray-500 mt-1">Média indisponible</p>
      </div>
    );
  }

  // 🎥 Vidéo
  if (mediaType === 'video') {
    return (
      <video
        src={mediaUrl}
        controls
        playsInline
        className={className}
        onError={(e) => {
          console.warn('Erreur chargement vidéo, fallback image.');
          e.target.poster = defaultImages[bucket] || defaultImages.annonces;
        }}
      />
    );
  }

  // 🖼️ Image
  return (
    <img
      src={mediaUrl}
      alt={alt || 'Média'}
      className={className}
      onError={(e) => {
        console.warn('Erreur chargement image, fallback image par défaut.');
        e.target.src = defaultImages[bucket] || defaultImages.annonces;
      }}
    />
  );
};

export default MediaDisplay;


