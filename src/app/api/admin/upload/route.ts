import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { CATEGORY_TAGS, type CategoryTag } from "@/lib/cloudinary-core";
import { PORTFOLIO_FOLDER } from "@/lib/constants";
import { revalidateTag } from "next/cache";
import { PORTFOLIO_CACHE_TAG } from "@/lib/cloudinary";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];

/**
 * Signed upload. The browser posts the file here; this route signs the request
 * with the API secret and forwards it to Cloudinary. The secret never reaches
 * the client, and middleware has already checked the admin session.
 */
export async function POST(request: Request) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloud || !apiKey || !apiSecret) {
    return NextResponse.json({ error: "Cloudinary isn't configured." }, { status: 503 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const category = String(form.get("category") ?? "");
  const caption = String(form.get("caption") ?? "").slice(0, 200);

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image supplied." }, { status: 400 });
  }
  if (!ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Use a JPEG, PNG, WebP or AVIF image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 10 MB." }, { status: 400 });
  }
  if (!(CATEGORY_TAGS as readonly string[]).includes(category)) {
    return NextResponse.json({ error: "Pick a category." }, { status: 400 });
  }

  // Cloudinary signs the alphabetically-sorted params, secret appended.
  const timestamp = Math.floor(Date.now() / 1000);
  const params: Record<string, string> = {
    folder: PORTFOLIO_FOLDER,
    tags: category as CategoryTag,
    timestamp: String(timestamp),
  };
  if (caption) params.context = `caption=${caption.replace(/[|=]/g, " ")}`;

  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  const signature = createHash("sha1").update(toSign + apiSecret).digest("hex");

  const upload = new FormData();
  upload.set("file", file);
  for (const [k, v] of Object.entries(params)) upload.set(k, v);
  upload.set("api_key", apiKey);
  upload.set("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: upload,
  });
  if (!res.ok) {
    console.error("[upload]", res.status, await res.text());
    return NextResponse.json({ error: "Cloudinary rejected the upload." }, { status: 502 });
  }

  const data = (await res.json()) as { public_id: string; secure_url: string };
  revalidateTag(PORTFOLIO_CACHE_TAG, { expire: 0 });
  return NextResponse.json({ ok: true, publicId: data.public_id, url: data.secure_url });
}
