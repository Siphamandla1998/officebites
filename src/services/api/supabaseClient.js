import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[supabase] Missing environment variables. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your environment."
  );
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// ==========================================
// STORAGE BUCKETS
// ==========================================

export const BUCKETS = {
  PAYMENT_PROOFS: "payment-proofs",
  MEAL_IMAGES: "meal-images",
  VENDOR_IMAGES: "vendor-images",
  AVATARS: "avatars",
  SUPPORT_ATTACHMENTS: "support-attachments",
};

// ==========================================
// PUBLIC FILE UPLOAD
// ==========================================

export async function uploadToBucket(bucket, path, file) {
  if (!file) {
    throw new Error("No file provided.");
  }

  if (!file.type?.startsWith("image/")) {
    throw new Error("Only image files are allowed.");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Image must be smaller than 5MB.");
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    throw new Error("Could not generate public file URL.");
  }

  return data.publicUrl;
}

// ==========================================
// PRIVATE FILE UPLOAD
// ==========================================

export async function uploadPrivate(bucket, path, file) {
  if (!file) {
    throw new Error("No file provided.");
  }

  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: false,
    });

  if (error) {
    throw new Error(error.message);
  }

  return path;
}

// ==========================================
// SIGNED URL
// ==========================================

export async function getSignedUrl(
  bucket,
  path,
  expiresIn = 3600
) {
  if (!path) {
    return null;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error) {
    throw new Error(error.message);
  }

  return data?.signedUrl || null;
}
