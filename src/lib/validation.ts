export function parseMemo(raw: string | null | undefined): {
  ok: true;
  memo: string | null;
} {
  if (raw == null) return { ok: true, memo: null };
  const t = raw.trim();
  if (t.length === 0) return { ok: true, memo: null };
  if (Array.from(t).length > 2000) {
    return { ok: true, memo: Array.from(t).slice(0, 2000).join("") };
  }
  return { ok: true, memo: t };
}

export function parseModeDefault(
  v: string,
): "easy" | "detail" {
  return v === "detail" ? "detail" : "easy";
}
