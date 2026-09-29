/** Prefix for files in `public/`. Empty locally; `/<repo>` on a project Pages site. */
export function publicPath(path: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
