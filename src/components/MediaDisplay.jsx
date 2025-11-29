import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/customSupabaseClient";
import { Loader2, ImageOff } from "lucide-react";
import { normalizeMediaUrl } from "@/utils/normalizeMediaUrl";

const defaultImages = {
  annonces: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/deafb02734097cfca203ab9aad10f6ba.png",
  evenements: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/e3c7a83af237fb7227a561adbdc2fb56.png",
  partenaires: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/fbbe30b8a750bf10ddf4da2c7de7bfd3.png",
  groupes: "https://onekamer-media-cdn.b-cdn.net/misc/Photo%20D%C3%A9faut%20Groupe.jpg",
  faits_divers: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/3426b67577181940ee97b83de9829d6d.png",
  rencontres: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/deafb02734097cfca203ab9aad10f6ba.png",
  avatars: "https://onekamer-media-cdn.b-cdn.net/avatars/default_avatar.png",
};

const MediaDisplay = ({ bucket, path, alt, className }) => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState("image");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [backupUrl, setBackupUrl] = useState(null);

  useEffect(() => {
    const loadMedia = async () => {
      setLoading(true);
      setError(false);

      if (!path) {
        setMediaUrl(defaultImages[bucket] || null);
        setLoading(false);
        return;
      }

      // 🛑 Si un path interne ressemble à un "default_*" (ex: default_faits_divers), évite toute requête
      if (!/^https?:\/\//i.test(path) && /default_faits_divers/i.test(path)) {
        setMediaUrl(defaultImages[bucket] || null);
        setMediaType('image');
        setLoading(false);
        return;
      }

      // ✅ Si c’est une URL CDN ou externe
      if (path.startsWith("http")) {
        const normalized = normalizeMediaUrl(path);
        console.log("🌐 Média externe détecté :", normalized);
        // Si l'URL pointe vers localhost/127.* (données legacy), fallback CDN par bucket
        try {
          const u = new URL(normalized);
          if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
            setMediaUrl(defaultImages[bucket] || null);
            setMediaType('image');
            setLoading(false);
            return;
          }
          // 🔁 Si c'est une ancienne URL signée Supabase, régénère une signature fraîche
          if (/\/storage\/v1\/object\/sign\//.test(u.pathname)) {
            const signedPath = u.pathname.replace(/\/storage\/v1\/object\/sign\//, '');
            const [bkt, ...restParts] = signedPath.split('/');
            let rel = restParts.join('/');
            // 🧹 Normalise les chemins dupliqués: e.g. 'rencontres/rencontres/...' -> '...'
            if (rel.startsWith(`${bkt}/`)) {
              rel = rel.slice(bkt.length + 1);
            }
            try {
              const { data, error } = await supabase.storage.from(bkt).createSignedUrl(rel, 3600);
              if (!error && data?.signedUrl) {
                setMediaUrl(data.signedUrl);
                const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(rel);
                setMediaType(isVideo ? 'video' : 'image');
                setLoading(false);
                return;
              }
            } catch (e) {
              console.warn('⚠️ Echec régénération URL signée → tentative CDN', e?.message || e);
              // 🔁 Fallback ciblé vers BunnyCDN avec le chemin normalisé
              const cdnUrl = `https://onekamer-media-cdn.b-cdn.net/${bkt}/${rel}`;
              setMediaUrl(cdnUrl);
              const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(rel);
              setMediaType(isVideo ? 'video' : 'image');
              setLoading(false);
              return;
            }
          }
        } catch {}
        setBackupUrl(null);
        setMediaUrl(normalized);
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(normalized);
        setMediaType(isVideo ? "video" : "image");
        setLoading(false);
        return;
      }

      // ✅ Sinon, Supabase storage (normalisation du chemin)
      try {
        let p = path || "";
        p = p.replace(/^\/+/, "");
        // ✅ Déduplication éventuelle 'bucket/bucket/...'
        if (bucket && p.startsWith(`${bucket}/${bucket}/`)) {
          p = p.replace(new RegExp(`^${bucket}/`), "");
        }
        // ✅ Pour createSignedUrl, le chemin doit être RELATIF au bucket: retire le préfixe `${bucket}/` si présent
        if (bucket && p.startsWith(`${bucket}/`)) {
          p = p.slice(bucket.length + 1);
        }

        // 🟢 Pour le bucket 'rencontres', on tente le CDN d'abord (les fichiers sont servis depuis BunnyCDN)
        if (bucket === 'rencontres') {
          const primaryCdn = `https://onekamer-media-cdn.b-cdn.net/${bucket}/${p}`.replace(/(?<!:)\/\/+/, "/");
          const altCdn = p.startsWith(`${bucket}/`)
            ? `https://onekamer-media-cdn.b-cdn.net/${p}`
            : `https://onekamer-media-cdn.b-cdn.net/${bucket}/${bucket}/${p}`;
          console.log('🛰️ CDN (prioritaire) rencontres →', { primaryCdn, altCdn });
          setBackupUrl(altCdn);
          setMediaUrl(primaryCdn);
          const isVideoCdn = /\.(mp4|webm|ogg|mov)$/i.test(p);
          setMediaType(isVideoCdn ? "video" : "image");
          setLoading(false);
          return;
        }

        console.log("🔏 Signature Supabase:", { bucket, path: p });
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(p, 3600);
        if (error) throw error;
        setBackupUrl(null);
        setMediaUrl(data.signedUrl);
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(p);
        setMediaType(isVideo ? "video" : "image");
      } catch (err) {
        console.warn("⚠️ Erreur media Supabase:", err?.message || err);
        // 🔁 Quel que soit le type d'erreur (400, 404, etc.), tenter BunnyCDN si possible
        if (bucket) {
          let rel = (path || "").replace(/^\/+/, "");
          if (rel.startsWith(`${bucket}/`)) {
            rel = rel.slice(bucket.length + 1);
          }
          if (rel) {
            const primaryCdn = `https://onekamer-media-cdn.b-cdn.net/${bucket}/${rel}`.replace(/(?<!:)\/\/+/, "/");
            // Variante alternative si l'arbo réelle du CDN contient un doublon de bucket
            const altCdn = rel.startsWith(`${bucket}/`)
              ? `https://onekamer-media-cdn.b-cdn.net/${rel}`
              : `https://onekamer-media-cdn.b-cdn.net/${bucket}/${bucket}/${rel}`;
            console.log('🛰️ CDN (fallback) →', { primaryCdn, altCdn });
            setBackupUrl(altCdn);
            setMediaUrl(primaryCdn);
            const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(rel);
            setMediaType(isVideo ? "video" : "image");
            setError(false);
          } else {
            setMediaUrl(defaultImages[bucket] || null);
            setError(false);
          }
        } else {
          setMediaUrl(null);
          setError(true);
        }
      } finally {
        setLoading(false);
      }
    };

    loadMedia();
  }, [bucket, path]);

  if (loading) {
    return (
      <div className={`flex items-center justify-center bg-gray-200 ${className}`}>
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!mediaUrl || error) {
    return (
      <div className={`flex flex-col items-center justify-center bg-gray-200 ${className}`}>
        <ImageOff className="h-8 w-8 text-gray-500" />
        <p className="text-xs text-gray-500 mt-1">Média indisponible</p>
      </div>
    );
  }

  if (mediaType === "video") {
    return <video src={mediaUrl} controls className={className} />;
  }

  return (
    <img
      src={mediaUrl}
      alt={alt || "Image"}
      className={className}
      onError={(e) => {
        console.warn("⚠️ Erreur de chargement image → tentative backup ou fallback");
        if (backupUrl) {
          const next = backupUrl;
          setBackupUrl(null);
          e.target.src = next;
          return;
        }
        e.target.onerror = null;
        e.target.src = defaultImages[bucket] || defaultImages.annonces;
      }}
    />
  );
};

export default MediaDisplay;
