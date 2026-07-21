/**
 * 逆ジオコーディング（緯度経度 → 日本語の地名）
 * 1. Google Geocoding API（NEXT_PUBLIC_GOOGLE_MAPS_API_KEY または GOOGLE_MAPS_API_KEY）
 * 2. フォールバック: OpenStreetMap Nominatim（キー不要・利用は控えめに）
 */

export function isCoordinateLikePlaceName(
  name: string | null | undefined,
): boolean {
  if (!name) return true;
  const t = name.trim();
  // "36.1538, 137.2514" 形式
  if (/^-?\d{1,3}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/.test(t)) return true;
  return false;
}

export async function resolvePlaceName(input: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  placeName?: string | null;
}): Promise<string | null> {
  const lat = input.lat;
  const lng = input.lng;
  if (
    lat == null ||
    lng == null ||
    !Number.isFinite(lat) ||
    !Number.isFinite(lng)
  ) {
    return null;
  }

  const existing = input.placeName?.trim() || null;
  if (existing && !isCoordinateLikePlaceName(existing)) {
    return existing;
  }

  try {
    const googleName = await reverseGeocodeGoogle(lat, lng);
    if (googleName) return googleName;
  } catch (e) {
    console.error("Google reverse geocode failed", e);
  }

  try {
    const osmName = await reverseGeocodeNominatim(lat, lng);
    if (osmName) return osmName;
  } catch (e) {
    console.error("Nominatim reverse geocode failed", e);
  }

  return existing; // 座標文字列があればそれ、なければ null
}

function mapsApiKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

async function reverseGeocodeGoogle(
  lat: number,
  lng: number,
): Promise<string | null> {
  const key = mapsApiKey();
  if (!key) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("language", "ja");
  url.searchParams.set("result_type", "locality|sublocality|postal_code|premise");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), {
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    console.error("Geocoding HTTP", res.status);
    return null;
  }

  const data = (await res.json()) as {
    status: string;
    results?: Array<{
      formatted_address?: string;
      address_components?: Array<{
        long_name: string;
        short_name: string;
        types: string[];
      }>;
    }>;
    error_message?: string;
  };

  if (data.status !== "OK" || !data.results?.length) {
    // result_type が厳しすぎる場合は再試行（制限なし）
    if (data.status === "ZERO_RESULTS") {
      return reverseGeocodeGoogleLoose(lat, lng, key);
    }
    if (data.status !== "OK") {
      console.error("Geocoding status", data.status, data.error_message);
    }
    return null;
  }

  return formatGoogleResult(data.results[0]) ??
    reverseGeocodeGoogleLoose(lat, lng, key);
}

async function reverseGeocodeGoogleLoose(
  lat: number,
  lng: number,
  key: string,
): Promise<string | null> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("language", "ja");
  url.searchParams.set("key", key);

  const res = await fetch(url.toString(), { next: { revalidate: 86400 } });
  if (!res.ok) return null;
  const data = (await res.json()) as {
    status: string;
    results?: Array<{
      formatted_address?: string;
      address_components?: Array<{
        long_name: string;
        short_name: string;
        types: string[];
      }>;
    }>;
  };
  if (data.status !== "OK" || !data.results?.length) return null;
  return formatGoogleResult(data.results[0]);
}

function formatGoogleResult(result: {
  formatted_address?: string;
  address_components?: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
}): string | null {
  const comps = result.address_components ?? [];
  const pick = (...types: string[]) =>
    comps.find((c) => types.some((t) => c.types.includes(t)))?.long_name;

  const pref = pick("administrative_area_level_1");
  const city =
    pick("locality", "administrative_area_level_2") ||
    pick("sublocality_level_1");
  const town =
    pick(
      "sublocality_level_2",
      "sublocality_level_3",
      "sublocality",
      "neighborhood",
    ) || pick("political");

  // 都道府県 + 市区町村 + 町名（短く）
  const parts = [pref, city, town].filter(Boolean) as string[];
  // 重複除去（「東京都」「東京都」など）
  const unique: string[] = [];
  for (const p of parts) {
    if (!unique.includes(p) && !unique.some((u) => u.includes(p) || p.includes(u) && p.length < u.length)) {
      // より短い方が長い方に含まれるなら短い方をスキップしがち — 単純に未収録のみ
      if (unique.some((u) => u === p)) continue;
      unique.push(p);
    }
  }

  // 単純ユニーク
  const cleaned = [...new Set(parts)];
  if (cleaned.length > 0) {
    // 長すぎる場合は県+市まで
    if (cleaned.join("").length > 24) {
      return cleaned.slice(0, 2).join("");
    }
    return cleaned.join("");
  }

  // formatted_address から日本の郵便番号や国名を落とす
  const formatted = result.formatted_address;
  if (!formatted) return null;
  return formatted
    .replace(/日本、?\s*/g, "")
    .replace(/〒?\d{3}-?\d{4}\s*/g, "")
    .replace(/、/g, "")
    .trim()
    .slice(0, 40) || null;
}

async function reverseGeocodeNominatim(
  lat: number,
  lng: number,
): Promise<string | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("accept-language", "ja");
  url.searchParams.set("zoom", "16");

  const res = await fetch(url.toString(), {
    headers: {
      // Nominatim 利用ポリシー: アプリ識別が必要
      "User-Agent": "toruhodo/0.1 (local reverse-geocode; contact: local-dev)",
    },
    next: { revalidate: 86400 },
  });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    name?: string;
    display_name?: string;
    address?: Record<string, string>;
  };

  const a = data.address ?? {};
  const pref = a.state || a.province;
  const city = a.city || a.town || a.village || a.municipality || a.county;
  const town = a.suburb || a.neighbourhood || a.quarter || a.city_district;
  const parts = [pref, city, town].filter(Boolean) as string[];
  if (parts.length) return [...new Set(parts)].join("").slice(0, 40);

  if (data.name) return data.name.slice(0, 40);
  if (data.display_name) {
    return data.display_name.split(",")[0]?.trim().slice(0, 40) || null;
  }
  return null;
}
