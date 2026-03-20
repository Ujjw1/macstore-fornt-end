const STORAGE_BASE = "https://admin.macstore.com.np/storage";

/** Matches legacy Laravel JSON string or plain path for product images. */
export function productImageUrl(raw: string | undefined): string {
  if (!raw) return "https://via.placeholder.com/400?text=No+image";
  try {
    const parsed = JSON.parse(raw) as unknown;
    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    if (typeof first === "string") {
      if (first.startsWith("http")) return first;
      return `${STORAGE_BASE}/${first.replace(/^\/+/, "")}`;
    }
  } catch {
    if (raw.startsWith("http")) return raw;
    return `${STORAGE_BASE}/${raw.replace(/^\/+/, "")}`;
  }
  return "https://via.placeholder.com/400?text=No+image";
}
