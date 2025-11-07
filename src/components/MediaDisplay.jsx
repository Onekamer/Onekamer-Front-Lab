import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/customSupabaseClient";
import { Loader2, ImageOff } from "lucide-react";

const defaultImages = {
  annonces: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/deafb02734097cfca203ab9aad10f6ba.png",
  evenements: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/e3c7a83af237fb7227a561adbdc2fb56.png",
  partenaires: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/fbbe30b8a750bf10ddf4da2c7de7bfd3.png",
  groupes: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/0d1b14eb0b6bbb002d83d44342b4afd2.png",
  faits_divers: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/3426b67577181940ee97b83de9829d6d.png",
  rencontres: "https://horizons-cdn.hostinger.com/2838c69a-ba17-4f74-8eef-55777dbe8ec3/deafb02734097cfca203ab9aad10f6ba.png",
};

const MediaDisplay = ({ bucket, path, alt, className }) => {
  const [mediaUrl, setMediaUrl] = useState(null);
  const [mediaType, setMediaType] = useState("image");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const loadMedia = async () => {
      setLoading(true);
      setError(false);

      if (!path) {
        setMediaUrl(defaultImages[bucket] || null);
        setLoading(false);
        return;
      }

      // ✅ Si c’est une URL CDN ou externe
      if (path.startsWith("http")) {
        console.log("🌐 Média externe détecté :", path);
        setMediaUrl(path);
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(path);
        setMediaType(isVideo ? "video" : "image");
        setLoading(false);
        return;
      }

      // ✅ Sinon, Supabase storage (normalisation du chemin)
      try {
        let p = path || "";
        p = p.replace(/^\/+/, "");
        // ✅ Préfixe automatique si le chemin ne contient pas le nom du bucket
        if (!p.startsWith("http") && bucket && !p.startsWith(`${bucket}/`)) {
          p = `${bucket}/${p}`;
        }
        // ✅ Déduplication éventuelle 'bucket/bucket/...'
        if (bucket && p.startsWith(`${bucket}/${bucket}/`)) {
          p = p.replace(new RegExp(`^${bucket}/`), "");
        }
        console.log("🔏 Signature Supabase:", { bucket, path: p });
        if (p.startsWith("rencontres/rencontres/")) {
          p = p.replace(/^rencontres\//, "");
        }
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(p, 3600);
        if (error) throw error;
        setMediaUrl(data.signedUrl);
        const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(p);
        setMediaType(isVideo ? "video" : "image");
      } catch (err) {
        console.warn("⚠️ Erreur media Supabase:", err.message);
        setMediaUrl(defaultImages[bucket] || null);
        setError(false);
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
        console.warn("⚠️ Erreur de chargement image → fallback");
        e.target.onerror = null;
        e.target.src = defaultImages[bucket] || defaultImages.annonces;
      }}
    />
  );
};

export default MediaDisplay;



