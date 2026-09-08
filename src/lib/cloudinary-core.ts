export const CATEGORY_TAGS = ["nails", "lashes", "pedimani"] as const;
export type CategoryTag = (typeof CATEGORY_TAGS)[number];

export interface PortfolioItem {
  publicId: string;
  url: string;
  width: number;
  height: number;
  category: CategoryTag;
  caption?: string;
}

export interface CloudinaryResource {
  public_id?: string;
  width?: number;
  height?: number;
  context?: { custom?: Record<string, string> };
}

/** Maps one Admin API resource -> typed portfolio item (here, "tags ARE metadata"). */
export function mapResource(
  resource: CloudinaryResource,
  cloud: string,
  category: CategoryTag
): PortfolioItem {
  return {
    publicId: resource.public_id ?? "",
    url: uploadUrl(cloud, resource.public_id ?? ""),
    width: resource.width ?? 1,
    height: resource.height ?? 1,
    category,
    caption: resource.context?.custom?.caption || undefined,
  };
}

export function uploadUrl(cloud: string, publicId: string): string {
  return `https://res.cloudinary.com/${cloud}/image/upload/${publicId}`;
}