import { createClient } from "@supabase/supabase-js";
let client: ReturnType<typeof createClient> | null = null;
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL,
    key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return (client ??= createClient(url, key));
}
export async function api(path: string, options: RequestInit = {}) {
  const sb = getSupabase();
  const session = await sb?.auth.getSession();
  const token = session?.data.session?.access_token;
  if (!token) throw Error("Please sign in");
  const res = await fetch("/api/" + path, {
    ...options,
    signal: options.signal || AbortSignal.timeout(20000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options.headers,
    },
  });
  const data = await res
    .json()
    .catch(() => ({ error: "The server is unavailable. Please retry." }));
  if (!res.ok) throw Error(data.error || "Unable to save. Please retry.");
  return data;
}
export function download(
  name: string,
  data: string,
  type = "application/json",
) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function csv(rows: any[][]) {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          let s = String(cell ?? "");
          if (/^\s*[=+@-]|^[\t\r\n]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        })
        .join(","),
    )
    .join("\r\n");
}
export async function webp(file: File) {
  if (!file.type.startsWith("image/")) throw Error("Choose an image file");
  if (file.size > 10000000) throw Error("Choose an image smaller than 10 MB");
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, 600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const result = canvas.toDataURL("image/webp", 0.78);
  if (!result.startsWith("data:image/webp;"))
    throw Error("This browser does not support WebP conversion");
  if (result.length > 700000)
    throw Error("Image is too large after compression");
  return result;
}
