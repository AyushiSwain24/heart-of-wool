/**
 * Client-side image resize + compression before upload, so the admin can
 * upload phone-camera-sized photos (often 3-8MB) without bloating Supabase
 * Storage. Runs entirely in the browser via <canvas> — no extra dependency.
 *
 * Resizes so the longer edge is at most `maxDimension`, then re-encodes as
 * JPEG at `quality`. For product photos on a small shop site this keeps
 * files comfortably under ~150-250KB while still looking sharp at the
 * sizes they're displayed (product cards, detail page).
 */
export async function compressImage(
  file: File,
  { maxDimension = 1200, quality = 0.82 }: { maxDimension?: number; quality?: number } = {},
): Promise<{ blob: Blob; extension: string }> {
  const bitmap = await createImageBitmap(file);

  let { width, height } = bitmap;
  if (width > maxDimension || height > maxDimension) {
    const scale = maxDimension / Math.max(width, height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported in this browser");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Failed to compress image");

  return { blob, extension: "jpg" };
}
