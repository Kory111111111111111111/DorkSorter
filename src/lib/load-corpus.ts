import type { Dork } from "@/lib/dork";
import { publicPath } from "@/lib/public-path";

let pending: Promise<Dork[]> | null = null;

/** Fetch the static dork index once and share it across the page. */
export function loadCorpus(): Promise<Dork[]> {
  if (!pending) {
    pending = fetch(publicPath("/dorks.json"))
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { dorks?: unknown };
        if (!Array.isArray(json.dorks)) throw new Error("Invalid dork index");
        return json.dorks as Dork[];
      })
      .catch((err: unknown) => {
        pending = null;
        throw err;
      });
  }
  return pending;
}
