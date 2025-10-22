import { supabase } from '@/lib/customSupabaseClient';

const DEFAULT_AUDIO_BUCKET = import.meta.env.VITE_AUDIO_BUCKET || 'comments_audio';
const DEFAULT_PROVIDER = (import.meta.env.VITE_AUDIO_STORAGE || 'supabase').toLowerCase();

const stripBucketPrefix = (path) => {
  if (!path) return path;
  const trimmed = path.replace(/^\/+/, '');
  const withoutPublic = trimmed.startsWith('public/') ? trimmed.substring(7) : trimmed;
  if (withoutPublic.startsWith(`${DEFAULT_AUDIO_BUCKET}/`)) {
    return withoutPublic.substring(DEFAULT_AUDIO_BUCKET.length + 1);
  }
  return withoutPublic;
};

const normalizePath = (path) => stripBucketPrefix(path?.trim?.() || '');

const fetchBunnyUpload = async (file, folder) => {
  const apiUrl = import.meta.env.VITE_API_URL;
  if (!apiUrl) {
    throw new Error('Aucune URL API Bunny configurée.');
  }

  const formData = new FormData();
  formData.append('file', file);
  if (folder) {
    formData.append('folder', folder);
  }

  const response = await fetch(`${apiUrl}/upload`, {
    method: 'POST',
    body: formData,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (error) {
      console.error('Réponse upload invalide:', text);
      throw new Error("Réponse inattendue du serveur d'upload");
    }
  }

  if (!response.ok || !data?.success) {
    const message = data?.message || `Erreur d’upload BunnyCDN (code ${response.status})`;
    throw new Error(message);
  }

  return { publicUrl: data.url, path: null };
};

const uploadToSupabase = async (file, folder) => {
  const sanitizedFolder = folder && folder !== DEFAULT_AUDIO_BUCKET ? folder.replace(/^\/+|\/+$/g, '') : '';
  const objectKey = sanitizedFolder ? `${sanitizedFolder}/${file.name}` : file.name;

  const { error } = await supabase.storage
    .from(DEFAULT_AUDIO_BUCKET)
    .upload(objectKey, file, { cacheControl: '3600', upsert: false });

  if (error) {
    // Si le fichier existe déjà, génère un nom unique et réessaie.
    if (error.message?.toLowerCase?.().includes('exists')) {
      const randomSuffix = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
      const uniqueKey = sanitizedFolder
        ? `${sanitizedFolder}/${Date.now()}-${randomSuffix}-${file.name}`
        : `${Date.now()}-${randomSuffix}-${file.name}`;

      const retry = await supabase.storage
        .from(DEFAULT_AUDIO_BUCKET)
        .upload(uniqueKey, file, { cacheControl: '3600', upsert: false });

      if (retry.error) {
        throw retry.error;
      }

      const { data: retryPublic, error: publicError } = supabase.storage
        .from(DEFAULT_AUDIO_BUCKET)
        .getPublicUrl(uniqueKey);

      if (publicError) throw publicError;

      return { publicUrl: retryPublic.publicUrl, path: uniqueKey };
    }

    throw error;
  }

  const { data: publicData, error: publicError } = supabase.storage
    .from(DEFAULT_AUDIO_BUCKET)
    .getPublicUrl(objectKey);

  if (publicError) throw publicError;

  return { publicUrl: publicData.publicUrl, path: objectKey };
};

export const uploadAudioFile = async (file, folder) => {
  if (!file) throw new Error('Aucun fichier audio à téléverser.');

  if (DEFAULT_PROVIDER === 'bunny') {
    return fetchBunnyUpload(file, folder);
  }

  return uploadToSupabase(file, folder);
};

export const ensurePublicAudioUrl = (url) => {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;

  const path = normalizePath(url);
  const { data } = supabase.storage.from(DEFAULT_AUDIO_BUCKET).getPublicUrl(path);
  return data?.publicUrl || url;
};

export const getAudioBucket = () => DEFAULT_AUDIO_BUCKET;
