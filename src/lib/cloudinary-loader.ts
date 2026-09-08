import type { ImageLoaderProps } from "next/image";

/**
 * Builds a Cloudinary delivery URL for next/image. Pure string maths, no
 * secrets here — safe to run on the client. `f_auto` serves AVIF where the
 * browser understands it, WebP everywhere else.
 */
export default function cloudinaryLoader({ src, width, quality }: ImageLoaderProps): string {
  return sizedCloudinaryUrl(src, width, quality);
}

export function applyTransforms(src: string, transforms: string[]): string {
  const sep = "/image/upload/";
  const i = src.indexOf(sep);
  if (i === -1) return src;
  const head = src.slice(0, i);
  const id = src.slice(i + sep.length);
  return `${head}/image/upload/${transforms.join(",")}/${id}`;
}

export function sizedCloudinaryUrl(src: string, width: number, quality = 75): string {
  return applyTransforms(src, [`f_auto`, `q_${quality}`, `w_${width}`]);
}

export function blurCloudinaryUrl(src: string): string {
  return applyTransforms(src, ["f_auto", "q_20", "w_24", "e_blur:300"]);
}