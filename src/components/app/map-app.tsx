"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { listRecordsAction } from "@/actions/records";
import type { RecordDTO } from "@/lib/domain/record";
import { AppShell } from "@/components/app/app-shell";
import { getGoogleMapsApiKey, loadGoogleMaps } from "@/lib/google-maps";

type GeoRecord = RecordDTO & { lat: number; lng: number };

const JAPAN_CENTER = { lat: 36.15, lng: 137.25 };
const PRIMARY = "#6FA378";
const CARD = "#FFFFFF";

function toCoord(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asGeoRecord(r: RecordDTO): GeoRecord | null {
  const lat = toCoord(r.lat);
  const lng = toCoord(r.lng);
  if (lat == null || lng == null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { ...r, lat, lng };
}

function formatMapMeta(dto: RecordDTO): string {
  const d = new Date(dto.createdAt);
  const date = `${d.getMonth() + 1}月${d.getDate()}日`;
  if (dto.placeName) return `${date}・${dto.placeName}`;
  return date;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;");
}

/** 同一座標のピンを少しずらす（重なり防止） */
function spreadPositions(
  records: GeoRecord[],
): Array<GeoRecord & { displayLat: number; displayLng: number }> {
  const groups = new Map<string, GeoRecord[]>();
  for (const r of records) {
    const key = `${r.lat.toFixed(5)},${r.lng.toFixed(5)}`;
    const list = groups.get(key) ?? [];
    list.push(r);
    groups.set(key, list);
  }

  const out: Array<GeoRecord & { displayLat: number; displayLng: number }> = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push({
        ...group[0],
        displayLat: group[0].lat,
        displayLng: group[0].lng,
      });
      continue;
    }
    // らせん状に少しオフセット（約 8〜20m 相当）
    group.forEach((r, i) => {
      const angle = (i / group.length) * Math.PI * 2 - Math.PI / 2;
      const radius = 0.00012 * (1 + Math.floor(i / 6));
      out.push({
        ...r,
        displayLat: r.lat + Math.sin(angle) * radius,
        displayLng: r.lng + Math.cos(angle) * radius * 1.2,
      });
    });
  }
  return out;
}

function buildInfoHtml(rec: GeoRecord): string {
  const thumb = rec.photoUrl
    ? `<img src="${escapeAttr(rec.photoUrl)}" alt="" width="56" height="56" style="width:56px;height:56px;flex:none;border-radius:12px;object-fit:cover;border:1px solid #EDE5D2" />`
    : `<div style="width:56px;height:56px;flex:none;border-radius:12px;background:linear-gradient(145deg,#6FA378,#4F7A59);color:#FFFFFF;display:flex;align-items:center;justify-content:center;font-family:'Zen Maru Gothic',sans-serif;font-weight:700;font-size:22px">撮</div>`;

  // Google 標準の閉じるボタンは角丸カードではみ出しやすいので、カード内に自前の閉じるを置く
  return `
    <div class="toruhodo-iw" style="position:relative;box-sizing:border-box;width:248px;padding:2px 4px 2px 2px;font-family:'Zen Maru Gothic',system-ui,sans-serif;color:#3A352C">
      <button type="button" class="toruhodo-iw-close" aria-label="閉じる" style="
        position:absolute;top:-2px;right:-2px;z-index:2;
        width:28px;height:28px;margin:0;padding:0;border:none;border-radius:999px;
        background:rgba(58,53,44,0.08);color:#6B6350;cursor:pointer;
        display:flex;align-items:center;justify-content:center;
        font-size:18px;line-height:1;font-weight:700;
      ">×</button>
      <a href="/result/${escapeAttr(rec.id)}" style="display:flex;gap:12px;align-items:flex-start;padding:4px 28px 2px 2px;text-decoration:none;color:inherit">
        ${thumb}
        <div style="flex:1;min-width:0;padding-top:2px">
          <div style="font-size:14.5px;font-weight:700;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(rec.title)}</div>
          <div style="margin-top:4px;font-size:11.5px;color:#8A8272;line-height:1.4">${escapeHtml(formatMapMeta(rec))}</div>
        </div>
      </a>
      <a href="/result/${escapeAttr(rec.id)}" style="display:block;margin-top:10px;text-align:center;background:#6FA378;color:#FFFFFF;text-decoration:none;font-size:13px;font-weight:700;padding:10px 12px;border-radius:999px;box-shadow:0 6px 14px rgba(111, 163, 120, .28)">
        解説をひらく
      </a>
    </div>`;
}

/**
 * HTML カスタムピン（朱の滴型 + 写真 or「撮」朱印）
 * Google Maps OverlayView ベース
 */
function createHtmlPinOverlay(maps: typeof google.maps) {
  class HtmlPinOverlay extends maps.OverlayView {
    position: google.maps.LatLng;
    rec: GeoRecord;
    div: HTMLDivElement | null = null;
    selected = false;
    onSelect: (rec: GeoRecord, overlay: HtmlPinOverlay) => void;
    private index: number;

    constructor(
      position: google.maps.LatLngLiteral,
      rec: GeoRecord,
      index: number,
      onSelect: (rec: GeoRecord, overlay: HtmlPinOverlay) => void,
    ) {
      super();
      this.position = new maps.LatLng(position.lat, position.lng);
      this.rec = rec;
      this.index = index;
      this.onSelect = onSelect;
    }

    onAdd() {
      const div = document.createElement("div");
      div.className = "toruhodo-pin";
      div.style.cssText = [
        "position:absolute",
        "width:44px",
        "height:56px",
        "transform:translate(-50%,-100%)",
        "cursor:pointer",
        "z-index:1",
        "filter:drop-shadow(0 4px 8px rgba(40,30,15,0.28))",
        "transition:transform .18s ease, filter .18s ease",
        "will-change:transform",
        `animation:toruhodo-pin-drop .45s cubic-bezier(.2,1.2,.4,1) ${Math.min(this.index, 12) * 40}ms both`,
      ].join(";");
      div.setAttribute("role", "button");
      div.setAttribute("aria-label", this.rec.title);
      div.tabIndex = 0;

      const hasPhoto = Boolean(this.rec.photoUrl);

      div.innerHTML = `
        <svg width="44" height="56" viewBox="0 0 44 56" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="display:block">
          <path d="M22 54C22 54 40 36.5 40 22C40 11.5 32 4 22 4C12 4 4 11.5 4 22C4 36.5 22 54 22 54Z" fill="${PRIMARY}" stroke="${CARD}" stroke-width="2.5"/>
          <circle cx="22" cy="21" r="12.5" fill="${CARD}"/>
        </svg>
        <div class="toruhodo-pin-face" style="
          position:absolute;left:50%;top:8.5px;transform:translateX(-50%);
          width:23px;height:23px;border-radius:50%;overflow:hidden;
          display:flex;align-items:center;justify-content:center;
          background:linear-gradient(160deg,#7CAF85,#4F7A59);
          color:${CARD};font-family:'Zen Maru Gothic',sans-serif;font-weight:700;font-size:12px;
          line-height:1;pointer-events:none;
        ">${
          hasPhoto
            ? `<img src="${escapeAttr(this.rec.photoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover" />`
            : "撮"
        }</div>
      `;

      const select = (e: Event) => {
        e.stopPropagation();
        this.onSelect(this.rec, this);
      };
      div.addEventListener("click", select);
      div.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          select(e);
        }
      });

      this.div = div;
      const panes = this.getPanes();
      panes?.overlayMouseTarget.appendChild(div);
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.div.style.left = `${point.x}px`;
      this.div.style.top = `${point.y}px`;
      this.div.style.zIndex = this.selected ? "1000" : String(100 + Math.round(point.y));
    }

    onRemove() {
      this.div?.remove();
      this.div = null;
    }

    setSelected(selected: boolean) {
      this.selected = selected;
      if (!this.div) return;
      if (selected) {
        this.div.style.transform = "translate(-50%,-100%) scale(1.14)";
        this.div.style.filter =
          "drop-shadow(0 8px 16px rgba(111, 163, 120, 0.4))";
        this.div.style.zIndex = "1000";
      } else {
        this.div.style.transform = "translate(-50%,-100%) scale(1)";
        this.div.style.filter =
          "drop-shadow(0 4px 8px rgba(40,30,15,0.28))";
      }
      this.draw();
    }
  }

  return HtmlPinOverlay;
}

type PinOverlay = {
  setMap: (map: google.maps.Map | null) => void;
  setSelected: (selected: boolean) => void;
  rec: GeoRecord;
};

export function MapApp({
  initialRecords = [],
  initialError = null,
}: {
  initialRecords?: RecordDTO[];
  initialError?: string | null;
}) {
  const [records, setRecords] = useState<RecordDTO[]>(initialRecords);
  const [error, setError] = useState<string | null>(initialError);
  const [loading, setLoading] = useState(
    initialRecords.length === 0 && !initialError,
  );
  const [mapError, setMapError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const hasKey = Boolean(getGoogleMapsApiKey());

  const load = useCallback(async () => {
    const res = await listRecordsAction();
    if (!res.ok) {
      setError(res.error);
      setLoading(false);
      return;
    }
    setRecords(res.data.records);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const geoRecords = useMemo(() => {
    const out: GeoRecord[] = [];
    for (const r of records) {
      const g = asGeoRecord(r);
      if (g) out.push(g);
    }
    return out;
  }, [records]);

  const displayPins = useMemo(
    () => spreadPositions(geoRecords),
    [geoRecords],
  );

  const month = new Date().getMonth() + 1;
  const geoKey = useMemo(
    () =>
      displayPins
        .map((r) => `${r.id}:${r.displayLat},${r.displayLng}`)
        .join("|"),
    [displayPins],
  );

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pinsRef = useRef<PinOverlay[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const styleInjected = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (loading || error) return;
    if (!hasKey) {
      setMapError(
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が未設定です。.env.local に追加して npm run dev を再起動してください。",
      );
      return;
    }
    if (!mapContainerRef.current) return;

    let cancelled = false;

    async function init() {
      try {
        const maps = await loadGoogleMaps();
        if (cancelled || !mapContainerRef.current) return;

        {
          let style = document.getElementById(
            "toruhodo-map-pin-css",
          ) as HTMLStyleElement | null;
          if (!style) {
            style = document.createElement("style");
            style.id = "toruhodo-map-pin-css";
            document.head.appendChild(style);
          }
          style.textContent = `
            @keyframes toruhodo-pin-drop {
              0% { opacity: 0; transform: translate(-50%,-130%) scale(.6); }
              70% { opacity: 1; transform: translate(-50%,-100%) scale(1.06); }
              100% { opacity: 1; transform: translate(-50%,-100%) scale(1); }
            }
            .toruhodo-pin:focus-visible {
              outline: 2px solid #6FA378;
              outline-offset: 3px;
              border-radius: 8px;
            }
            .toruhodo-pin:hover {
              transform: translate(-50%,-100%) scale(1.08) !important;
              filter: drop-shadow(0 6px 12px rgba(111, 163, 120, 0.35)) !important;
            }
            .gm-style .gm-style-iw-c {
              padding: 12px !important;
              border-radius: 16px !important;
              box-shadow: 0 12px 28px rgba(30,25,18,0.22) !important;
              background: #FFFFFF !important;
              max-width: min(280px, calc(100vw - 48px)) !important;
              overflow: hidden !important;
            }
            .gm-style .gm-style-iw-d {
              overflow: hidden !important;
              max-height: none !important;
            }
            .gm-style .gm-style-iw-tc::after {
              background: #FFFFFF !important;
            }
            /* 標準クローズははみ出しやすいので非表示（自前ボタンを使用） */
            .gm-style-iw-chr,
            .gm-style-iw-ch,
            .gm-ui-hover-effect {
              display: none !important;
            }
          `;
          styleInjected.current = true;
        }

        pinsRef.current.forEach((p) => p.setMap(null));
        pinsRef.current = [];
        infoRef.current?.close();

        const center =
          displayPins[0] != null
            ? { lat: displayPins[0].displayLat, lng: displayPins[0].displayLng }
            : JAPAN_CENTER;

        if (!mapRef.current) {
          // 地図タイル／配色は Google 標準のまま（ピン UI だけカスタム）
          mapRef.current = new maps.Map(mapContainerRef.current, {
            center,
            zoom: displayPins.length ? 15 : 5.5,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
            clickableIcons: false,
            gestureHandling: "greedy",
          });

          mapRef.current.addListener("click", () => {
            infoRef.current?.close();
            pinsRef.current.forEach((p) => p.setSelected(false));
            setActiveId(null);
          });
        }

        const map = mapRef.current;
        const info = infoRef.current ?? new maps.InfoWindow({ maxWidth: 280 });
        infoRef.current = info;

        info.addListener("closeclick", () => {
          pinsRef.current.forEach((p) => p.setSelected(false));
          setActiveId(null);
        });

        const HtmlPinOverlay = createHtmlPinOverlay(maps);

        const onSelect = (rec: GeoRecord, overlay: PinOverlay) => {
          pinsRef.current.forEach((p) => p.setSelected(false));
          overlay.setSelected(true);
          setActiveId(rec.id);
          info.setContent(buildInfoHtml(rec));
          info.setPosition({ lat: rec.lat, lng: rec.lng });
          info.open({ map });
          map.panTo({ lat: rec.lat, lng: rec.lng });

          // カード内の閉じるボタンを配線（DOM 反映後）
          window.setTimeout(() => {
            const btn = document.querySelector(
              ".toruhodo-iw-close",
            ) as HTMLButtonElement | null;
            if (!btn) return;
            btn.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              info.close();
              pinsRef.current.forEach((p) => p.setSelected(false));
              setActiveId(null);
            };
          }, 0);
        };

        displayPins.forEach((rec, index) => {
          const overlay = new HtmlPinOverlay(
            { lat: rec.displayLat, lng: rec.displayLng },
            rec,
            index,
            onSelect,
          ) as unknown as PinOverlay;
          overlay.setMap(map);
          pinsRef.current.push(overlay);
        });

        if (displayPins.length > 1) {
          const bounds = new maps.LatLngBounds();
          displayPins.forEach((r) =>
            bounds.extend({ lat: r.displayLat, lng: r.displayLng }),
          );
          map.fitBounds(bounds, 72);
        } else if (displayPins.length === 1) {
          map.setCenter({
            lat: displayPins[0].displayLat,
            lng: displayPins[0].displayLng,
          });
          map.setZoom(16);
        } else {
          map.setCenter(JAPAN_CENTER);
          map.setZoom(5.5);
        }

        setMapError(null);
      } catch (e) {
        console.error(e);
        setMapError(
          e instanceof Error ? e.message : "Google Maps の初期化に失敗しました",
        );
      }
    }

    void init();

    return () => {
      cancelled = true;
      pinsRef.current.forEach((p) => p.setMap(null));
      pinsRef.current = [];
      infoRef.current?.close();
      infoRef.current = null;
      mapRef.current = null;
    };
  }, [geoKey, loading, error, hasKey, displayPins]);

  return (
    <AppShell>
      <div className="flex min-h-0 flex-1 flex-col">
        <header
          className="flex shrink-0 items-center gap-2"
          style={{ padding: "16px 24px 12px" }}
        >
          <h1
            className="font-mincho m-0 text-[22px] font-bold tracking-[0.08em]"
            style={{ color: "var(--ink)" }}
          >
            旅の記録地図
          </h1>
          <span
            className="ml-auto rounded-full text-xs font-bold"
            style={{
              color: "var(--label)",
              background: "#ECE5D0",
              padding: "6px 13px",
            }}
          >
            {month}月・{geoRecords.length}件
          </span>
        </header>

        {loading ? (
          <div
            className="flex min-h-0 flex-1 items-center justify-center px-8 pb-16"
            style={{ color: "var(--muted)" }}
          >
            <p className="m-0 text-[14px]">読み込み中…</p>
          </div>
        ) : error ? (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-8 pb-16 text-center">
            <p
              className="m-0 text-[15px] leading-8"
              style={{ color: "var(--label)" }}
              role="alert"
            >
              {error}
            </p>
          </div>
        ) : (
          <div
            className="relative min-h-0 flex-1 overflow-hidden"
            style={{ background: "#E8E4D8", minHeight: 280 }}
          >
            <div
              ref={mapContainerRef}
              className="absolute inset-0 h-full w-full"
              role="application"
              aria-label="旅の記録地図（Google マップ）"
            />

            {mapError && (
              <div
                className="absolute inset-x-4 top-4 z-20 rounded-[14px] px-4 py-3 text-[13px] font-bold leading-relaxed"
                style={{
                  background: "var(--warn-bg)",
                  border: "1px solid var(--warn-border)",
                  color: "var(--warn-ink)",
                }}
                role="alert"
              >
                {mapError}
              </div>
            )}

            {geoRecords.length === 0 && !mapError && (
              <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 px-6 text-center">
                <div
                  className="pointer-events-auto max-w-[300px] rounded-[20px] px-5 py-5"
                  style={{
                    background: "rgba(253,251,244,0.94)",
                    border: "1px solid var(--card-border)",
                    boxShadow: "0 10px 24px rgba(30,25,18,0.16)",
                  }}
                >
                  <p className="font-mincho m-0 text-[17px] font-bold">
                    位置つきの記録がまだありません
                  </p>
                  <p
                    className="mt-2 m-0 text-[13.5px] leading-7"
                    style={{ color: "var(--label)" }}
                  >
                    設定で位置情報をオンにし、撮影するとここにピンが立ちます。
                  </p>
                  <div className="mt-3 flex flex-col gap-2">
                    <Link
                      href="/scan"
                      className="btn-primary inline-flex h-[48px] text-[15px] no-underline"
                    >
                      かざして解説
                    </Link>
                    <Link
                      href="/settings"
                      className="text-[13px] font-bold no-underline"
                      style={{ color: "var(--secondary)" }}
                    >
                      位置情報の設定
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* 凡例 */}
            {geoRecords.length > 0 && !mapError && (
              <div
                className="absolute left-3 top-3 z-10 flex flex-col gap-1.5 rounded-[14px] border px-3 py-2.5 text-[11px] font-bold"
                style={{
                  color: "var(--label)",
                  background: "rgba(253,251,244,0.94)",
                  borderColor: "var(--border)",
                  boxShadow: "0 4px 12px rgba(30,25,18,0.08)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold"
                    style={{ background: PRIMARY, color: CARD }}
                  >
                    撮
                  </span>
                  記録ピン
                </div>
              </div>
            )}

            <div
              className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 max-w-[90%] truncate rounded-full border px-[15px] py-2 text-[11.5px] font-bold"
              style={{
                color: "var(--label)",
                background: "rgba(253,251,244,0.94)",
                borderColor: "var(--border)",
              }}
            >
              {activeId
                ? "ピンをタップ · 解説をひらく"
                : geoRecords.length > 0
                  ? `朱ピン ${geoRecords.length} 件 · タップで詳細`
                  : "位置オフでも記録は残せます"}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
