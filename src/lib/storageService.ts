import { supabase, isSupabaseConfigured } from './supabase';
import { showErrorToast } from './toast';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  const fileType = file.type.toLowerCase();
  if (!ALLOWED_IMAGE_TYPES.includes(fileType)) {
    return { 
      valid: false, 
      error: 'Invalid file format. Only JPEG, PNG, and WebP images are allowed.' 
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds 5MB limit.` 
    };
  }

  return { valid: true };
}

/**
 * Resizes an image client-side to at most maxPx on its longest dimension.
 * Maintains aspect ratio.
 */
export async function resizeImageToMaxPx(file: File, maxPx: number = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to load image for resizing'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxPx || height > maxPx) {
          if (width > height) {
            height = Math.round((height * maxPx) / width);
            width = maxPx;
          } else {
            width = Math.round((width * maxPx) / height);
            height = maxPx;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Failed to create canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        const mimeType = file.type === 'image/png' 
          ? 'image/png' 
          : file.type === 'image/webp' 
            ? 'image/webp' 
            : 'image/jpeg';

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Image compression failed'));
            }
          },
          mimeType,
          0.88
        );
      };

      if (e.target?.result) {
        img.src = e.target.result as string;
      } else {
        reject(new Error('Empty file result'));
      }
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Extract storage path from a public Supabase Storage URL
 */
export function extractStoragePath(url: string, bucketName: string): string | null {
  if (!url || typeof url !== 'string') return null;
  const marker = `/storage/v1/object/public/${bucketName}/`;
  const idx = url.indexOf(marker);
  if (idx !== -1) {
    return url.substring(idx + marker.length);
  }
  return null;
}

/**
 * Delete a file from a Supabase storage bucket given its URL
 */
export async function deleteFileFromBucket(bucketName: string, url: string): Promise<void> {
  if (!isSupabaseConfigured || !url) return;
  const path = extractStoragePath(url, bucketName);
  if (!path) return;

  try {
    const { error } = await supabase.storage.from(bucketName).remove([path]);
    if (error) {
      console.warn(`Warning deleting old file from ${bucketName}:`, error.message);
    }
  } catch (err) {
    console.warn(`Failed to delete old file from ${bucketName}:`, err);
  }
}

/**
 * Upload style image to 'style-images' bucket
 */
export async function uploadStyleImage(
  file: File, 
  styleCode: string, 
  oldImageUrl?: string | null
): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    showErrorToast(validation.error || 'Invalid file');
    throw new Error(validation.error);
  }

  if (!isSupabaseConfigured) {
    // If Supabase not configured, fall back to local object URL or data URL
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  try {
    // 1. Delete old file if present
    if (oldImageUrl) {
      await deleteFileFromBucket('style-images', oldImageUrl);
    }

    // 2. Resize client side
    const resizedBlob = await resizeImageToMaxPx(file, 1200);

    // 3. Format filename: {style_code}-{timestamp}.{ext}
    const cleanCode = (styleCode || 'STYLE').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = file.name.split('.').pop() || (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
    const fileName = `${cleanCode}-${Date.now()}.${ext}`;

    // 4. Upload to 'style-images' bucket
    const { data, error } = await supabase.storage
      .from('style-images')
      .upload(fileName, resizedBlob, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (error) {
      showErrorToast(`Upload failed: ${error.message}`);
      throw error;
    }

    // 5. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('style-images')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err: any) {
    const message = err.message || 'Image upload failed';
    showErrorToast(`Style Image Upload Error: ${message}`);
    throw err;
  }
}

/**
 * Upload worker photo to 'worker-photos' bucket
 */
export async function uploadWorkerPhoto(
  file: File, 
  workerCode: string, 
  oldPhotoUrl?: string | null
): Promise<string> {
  const validation = validateImageFile(file);
  if (!validation.valid) {
    showErrorToast(validation.error || 'Invalid file');
    throw new Error(validation.error);
  }

  if (!isSupabaseConfigured) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(file);
    });
  }

  try {
    // 1. Delete old file if present
    if (oldPhotoUrl) {
      await deleteFileFromBucket('worker-photos', oldPhotoUrl);
    }

    // 2. Resize client side
    const resizedBlob = await resizeImageToMaxPx(file, 1200);

    // 3. Format filename: {worker_code}-{timestamp}.{ext}
    const cleanCode = (workerCode || 'WORKER').replace(/[^a-zA-Z0-9_-]/g, '_');
    const ext = file.name.split('.').pop() || (file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg');
    const fileName = `${cleanCode}-${Date.now()}.${ext}`;

    // 4. Upload to 'worker-photos' bucket
    const { data, error } = await supabase.storage
      .from('worker-photos')
      .upload(fileName, resizedBlob, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
      });

    if (error) {
      showErrorToast(`Upload failed: ${error.message}`);
      throw error;
    }

    // 5. Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('worker-photos')
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  } catch (err: any) {
    const message = err.message || 'Photo upload failed';
    showErrorToast(`Worker Photo Upload Error: ${message}`);
    throw err;
  }
}
