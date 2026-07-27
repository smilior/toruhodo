"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from "react";
import { useRouter } from "next/navigation";
import { createScanAction, getSettingsAction } from "@/actions/records";
import { getSubscriptionStatusAction } from "@/actions/billing";
import type { SettingsDTO, SuggestedQuestion } from "@/lib/domain/record";
import { DEFAULT_SETTINGS } from "@/lib/domain/record";
import { FailedView } from "@/components/app/failed-view";
import { PaywallSheet } from "@/components/billing/paywall-sheet";

export const PENDING_SCAN_KEY = "toruhodo.pendingScan";

export type PendingScanPayload = {
  photoUrl: string;
  title: string;
  easyText: string;
  detailText: string;
  easyRuby: string;
  detailRuby: string;
  ocrRaw: string;
  partial: boolean;
  partialChars: string | null;
  lat: number | null;
  lng: number | null;
  placeName: string | null;
  suggestedQuestions: SuggestedQuestion[];
  createdAt: string;
};

type Phase = "idle" | "capturing" | "ocr" | "generating" | "failed";

type ForceStatus = "failed" | "partial" | "done" | undefined;

function stripDataUrl(dataUrl: string): { base64: string; mimeType: string } {
  const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (m) return { base64: m[2], mimeType: m[1] };
  return { base64: dataUrl, mimeType: "image/jpeg" };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** 長辺 1280px・JPEG 0.72 に圧縮（Server Action / sessionStorage 肥大化防止） */
async function compressImageDataUrl(
  dataUrl: string,
  maxEdge = 1280,
  quality = 0.72,
): Promise<string> {
  if (typeof window === "undefined") return dataUrl;
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        let { width, height } = img;
        const edge = Math.max(width, height);
        if (edge > maxEdge) {
          const scale = maxEdge / edge;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function getGeo(
  enabled: boolean,
): Promise<{ lat: number | null; lng: number | null; placeName: string | null }> {
  if (!enabled || typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({ lat: null, lng: null, placeName: null });
  }
  return new Promise((resolve) => {
    const timer = setTimeout(
      () => resolve({ lat: null, lng: null, placeName: null }),
      4000,
    );
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        // 地名はサーバー側で逆ジオコード（座標文字列は入れない）
        resolve({
          lat,
          lng,
          placeName: null,
        });
      },
      () => {
        clearTimeout(timer);
        resolve({ lat: null, lng: null, placeName: null });
      },
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 60_000 },
    );
  });
}

export function ScanApp() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelledRef = useRef(false);
  const runIdRef = useRef(0);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const singleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapAtRef = useRef(0);
  const longPressedRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [cameraLive, setCameraLive] = useState(false);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<SettingsDTO>(DEFAULT_SETTINGS);
  const [showPaywall, setShowPaywall] = useState(false);
  const [resetsAt, setResetsAt] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const video = videoRef.current;
    if (video) {
      video.srcObject = null;
    }
    setCameraLive(false);
  }, []);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCapturedPhoto(null);
    setError(null);
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setPhase("capturing");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }
      setCameraLive(true);
      setPhase("capturing");
    } catch {
      setCameraLive(false);
      setPhase("capturing");
    }
  }, [stopCamera]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await getSettingsAction();
      if (alive && res.ok) setSettings(res.data.settings);
    })();
    void startCamera();
    return () => {
      alive = false;
      cancelledRef.current = true;
      stopCamera();
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      if (singleTimerRef.current) clearTimeout(singleTimerRef.current);
    };
  }, [startCamera, stopCamera]);

  const captureFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (video && cameraLive && video.videoWidth > 0) {
      const canvas = document.createElement("canvas");
      let w = video.videoWidth;
      let h = video.videoHeight;
      const maxEdge = 1280;
      const edge = Math.max(w, h);
      if (edge > maxEdge) {
        const scale = maxEdge / edge;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0, w, h);
        return canvas.toDataURL("image/jpeg", 0.72);
      }
    }
    return capturedPhoto;
  }, [cameraLive, capturedPhoto]);

  const placeholderDataUrl = useCallback(() => {
    // 1x1 JPEG-ish placeholder as base64 when camera unavailable
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#423D32";
      ctx.fillRect(0, 0, 640, 480);
      for (let i = -480; i < 640; i += 28) {
        ctx.strokeStyle = "#38342B";
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + 480, 480);
        ctx.stroke();
      }
      ctx.fillStyle = "#A89F8A";
      ctx.font = "20px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("撮るほど", 320, 240);
    }
    return canvas.toDataURL("image/jpeg", 0.8);
  }, []);

  const beginScan = useCallback(
    async (forceStatus: ForceStatus, imageDataUrl?: string | null) => {
      const runId = ++runIdRef.current;
      cancelledRef.current = false;
      setError(null);

      const rawPhoto = imageDataUrl ?? captureFrame() ?? placeholderDataUrl();
      const photo = await compressImageDataUrl(rawPhoto);
      if (cancelledRef.current || runIdRef.current !== runId) return;
      setCapturedPhoto(photo);
      stopCamera();
      setPhase("ocr");

      const stageTimer = setTimeout(() => {
        if (runIdRef.current === runId && !cancelledRef.current) {
          setPhase("generating");
        }
      }, 1400);

      try {
        const geo = await getGeo(settings.geoEnabled);
        if (cancelledRef.current || runIdRef.current !== runId) return;

        const { base64, mimeType } = stripDataUrl(photo);
        const res = await createScanAction({
          imageBase64: base64,
          mimeType,
          lat: geo.lat,
          lng: geo.lng,
          placeName: geo.placeName,
          forceStatus,
        });

        if (cancelledRef.current || runIdRef.current !== runId) return;
        clearTimeout(stageTimer);

        // Ensure generating stage is visible briefly if action was very fast
        setPhase("generating");
        await new Promise((r) => setTimeout(r, 400));
        if (cancelledRef.current || runIdRef.current !== runId) return;

        if (!res.ok) {
          if (res.code === "LIMIT_REACHED") {
            const st = await getSubscriptionStatusAction();
            if (st.ok) setResetsAt(st.data.resetsAt);
            setShowPaywall(true);
            setPhase("idle");
            return;
          }
          setError(res.error);
          setPhase("failed");
          return;
        }

        const { scan, photoUrl, lat, lng, placeName } = res.data;

        if (scan.status === "failed") {
          setPhase("failed");
          return;
        }

        const pending: PendingScanPayload = {
          photoUrl,
          title: scan.title,
          easyText: scan.easyText,
          detailText: scan.detailText,
          easyRuby: scan.easyRuby,
          detailRuby: scan.detailRuby,
          ocrRaw: scan.ocrRaw,
          partial: scan.status === "partial",
          partialChars: scan.partialChars ?? null,
          lat,
          lng,
          placeName,
          suggestedQuestions: scan.suggestedQuestions ?? [],
          createdAt: new Date().toISOString(),
        };

        try {
          sessionStorage.setItem(PENDING_SCAN_KEY, JSON.stringify(pending));
        } catch {
          setError("一時データの保存に失敗しました");
          setPhase("failed");
          return;
        }

        router.push("/result/pending");
      } catch (e) {
        if (cancelledRef.current || runIdRef.current !== runId) return;
        clearTimeout(stageTimer);
        console.error(e);
        setError("読み取りに失敗しました");
        setPhase("failed");
      }
    },
    [
      captureFrame,
      placeholderDataUrl,
      router,
      settings.geoEnabled,
      stopCamera,
    ],
  );

  const cancelLoading = useCallback(() => {
    cancelledRef.current = true;
    runIdRef.current += 1;
    setPhase("idle");
    setCapturedPhoto(null);
    setError(null);
    void startCamera();
  }, [startCamera]);

  const handleRetry = useCallback(() => {
    cancelledRef.current = false;
    setError(null);
    setPhase("idle");
    setCapturedPhoto(null);
    void startCamera();
  }, [startCamera]);

  const onShutterPointerDown = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (phase === "ocr" || phase === "generating") return;
    longPressedRef.current = false;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    pressTimerRef.current = setTimeout(() => {
      longPressedRef.current = true;
      if (singleTimerRef.current) {
        clearTimeout(singleTimerRef.current);
        singleTimerRef.current = null;
      }
      lastTapAtRef.current = 0;
      void beginScan("partial");
    }, 550);
  };

  const cancelPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const onShutterPointerUp = (e: PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    cancelPress();
    if (phase === "ocr" || phase === "generating") return;
    if (longPressedRef.current) return;

    const now = Date.now();
    if (now - lastTapAtRef.current < 350) {
      if (singleTimerRef.current) {
        clearTimeout(singleTimerRef.current);
        singleTimerRef.current = null;
      }
      lastTapAtRef.current = 0;
      void beginScan("failed");
      return;
    }

    lastTapAtRef.current = now;
    if (singleTimerRef.current) clearTimeout(singleTimerRef.current);
    singleTimerRef.current = setTimeout(() => {
      singleTimerRef.current = null;
      lastTapAtRef.current = 0;
      void beginScan(undefined);
    }, 320);
  };

  const onGalleryChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const dataUrl = await fileToDataUrl(file);
      void beginScan(undefined, dataUrl);
    } catch {
      setError("画像を読み込めませんでした");
    }
  };

  const loading = phase === "ocr" || phase === "generating";
  const ocrDone = phase === "generating";

  if (phase === "failed") {
    return (
      <FailedView
        onRetry={handleRetry}
        onHome={() => router.push("/")}
        onClose={() => router.push("/")}
        error={error}
      />
    );
  }

  return (
    <div className="relative flex h-full min-h-0 flex-col bg-[var(--scan-bg)]">
      {/* Camera / captured photo view */}
      <div
        className="relative min-h-0 flex-1 overflow-hidden"
        style={{
          backgroundImage: capturedPhoto
            ? `url(${capturedPhoto})`
            : "repeating-linear-gradient(45deg, #38342B 0 14px, #423D32 14px 28px)",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 h-full w-full object-cover"
          style={{ display: cameraLive && !capturedPhoto ? "block" : "none" }}
        />

        {!cameraLive && !capturedPhoto && (
          <div
            className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center photo-ph"
            style={{
              background:
                "repeating-linear-gradient(45deg, #38342B 0 14px, #423D32 14px 28px)",
            }}
          >
            <span className="text-[11px] tracking-[0.1em] text-[var(--muted)]">
              カメラ映像（プレースホルダー）
            </span>
          </div>
        )}

        <button
          type="button"
          aria-label="閉じる"
          onClick={() => {
            stopCamera();
            router.push("/");
          }}
          className="absolute left-4 top-3.5 z-[5] flex h-10 w-10 items-center justify-center rounded-full text-[var(--bg)]"
          style={{ background: "rgba(20,17,13,.55)" }}
        >
          <span className="material-symbols-rounded" style={{ fontSize: 20 }} aria-hidden>
            close
          </span>
        </button>

        {!loading && (
          <div
            className="absolute left-1/2 top-5 z-[5] flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-[15px] py-[9px] text-[13px] font-bold"
            style={{
              background: "rgba(253,251,244,.94)",
              color: "#4A4436",
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: 16,
                color: "var(--primary)",
                fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
              aria-hidden
            >
              lightbulb
            </span>
            文字がはっきり写るように撮ってね
          </div>
        )}

        {!loading && (
          <div
            className="pointer-events-none absolute z-[4]"
            style={{ left: 30, right: 30, top: 110, bottom: 120 }}
          >
            <div
              className="absolute left-0 top-0 h-[34px] w-[34px]"
              style={{
                borderColor: "var(--bg)",
                borderStyle: "solid",
                borderWidth: "3.5px 0 0 3.5px",
                borderTopLeftRadius: 12,
              }}
            />
            <div
              className="absolute right-0 top-0 h-[34px] w-[34px]"
              style={{
                borderColor: "var(--bg)",
                borderStyle: "solid",
                borderWidth: "3.5px 3.5px 0 0",
                borderTopRightRadius: 12,
              }}
            />
            <div
              className="absolute bottom-0 left-0 h-[34px] w-[34px]"
              style={{
                borderColor: "var(--bg)",
                borderStyle: "solid",
                borderWidth: "0 0 3.5px 3.5px",
                borderBottomLeftRadius: 12,
              }}
            />
            <div
              className="absolute bottom-0 right-0 h-[34px] w-[34px]"
              style={{
                borderColor: "var(--bg)",
                borderStyle: "solid",
                borderWidth: "0 3.5px 3.5px 0",
                borderBottomRightRadius: 12,
              }}
            />
            <div
              className="absolute bottom-4 left-0 right-0 text-center text-[13px] tracking-[0.06em]"
              style={{ color: "rgba(246,241,229,.92)" }}
            >
              石碑や案内板を、枠のなかに
            </div>
          </div>
        )}

        {!loading && (
          <div
            className="pointer-events-none absolute bottom-2 left-1/2 z-[5] -translate-x-1/2 whitespace-nowrap text-[10px] tracking-[0.04em]"
            style={{ color: "rgba(246,241,229,.55)" }}
          >
            タップ＝通常 / 長押し＝部分 / ダブルタップ＝失敗
          </div>
        )}

        {loading && (
          <div
            className="absolute inset-0 z-10"
            style={{ background: "rgba(20,17,13,.38)" }}
          />
        )}
      </div>

      {/* Controls */}
      {!loading && (
        <div
          className="flex shrink-0 items-center justify-between px-11 pb-10 pt-[26px]"
          style={{ background: "var(--scan-bg)" }}
        >
          <button
            type="button"
            aria-label="ギャラリー"
            onClick={() => fileInputRef.current?.click()}
            className="flex h-[46px] w-[46px] items-center justify-center rounded-full text-[var(--bg)]"
            style={{ background: "rgba(246,241,229,.14)" }}
          >
            <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
              photo_library
            </span>
          </button>

          <button
            type="button"
            aria-label="シャッター"
            onPointerDown={onShutterPointerDown}
            onPointerUp={onShutterPointerUp}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--bg)] p-0"
          >
            <div
              className="h-[60px] w-[60px] rounded-full bg-[var(--primary)] transition-transform duration-100 active:scale-90"
            />
          </button>

          <button
            type="button"
            aria-label="フラッシュ"
            onClick={() => setFlashOn((v) => !v)}
            className="flex h-[46px] w-[46px] items-center justify-center rounded-full"
            style={{
              background: flashOn
                ? "rgba(111,163,120,.4)"
                : "rgba(246,241,229,.14)",
              color: flashOn ? "#E9D8B8" : "var(--bg)",
            }}
          >
            <span
              className="material-symbols-rounded"
              style={{
                fontSize: 22,
                fontVariationSettings: flashOn
                  ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
                  : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24",
              }}
              aria-hidden
            >
              bolt
            </span>
          </button>
        </div>
      )}

      {/* Loading bottom sheet */}
      {loading && (
        <div
          className="absolute bottom-0 left-0 right-0 z-[15] flex flex-col gap-[18px] px-[26px] pb-9 pt-3.5"
          style={{
            background: "var(--bg)",
            borderRadius: "26px 26px 0 0",
            animation: "toruhodo-sheet-up 300ms ease-out",
          }}
        >
          <div
            className="mx-auto h-[5px] w-11 rounded-full"
            style={{ background: "#D8CFBA" }}
          />

          <div className="flex min-h-7 items-center gap-3.5">
            {ocrDone ? (
              <>
                <span
                  className="material-symbols-rounded"
                  style={{
                    fontSize: 26,
                    color: "var(--secondary)",
                    fontVariationSettings:
                      "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24",
                  }}
                  aria-hidden
                >
                  check_circle
                </span>
                <div className="text-[15px] font-bold text-[var(--label)]">
                  読み取りました
                </div>
              </>
            ) : (
              <>
                <div
                  className="h-[22px] w-[22px] shrink-0 animate-spin rounded-full"
                  style={{
                    border: "3px solid #E5DCC4",
                    borderTopColor: "var(--primary)",
                    margin: "0 2px",
                  }}
                />
                <div className="text-[16.5px] font-bold">読み取っています…</div>
              </>
            )}
          </div>

          <div
            className="flex min-h-7 items-center gap-3.5"
            style={{ opacity: ocrDone ? 1 : 0.45 }}
          >
            {ocrDone ? (
              <>
                <div
                  className="h-[22px] w-[22px] shrink-0 animate-spin rounded-full"
                  style={{
                    border: "3px solid #E5DCC4",
                    borderTopColor: "var(--primary)",
                    margin: "0 2px",
                  }}
                />
                <div>
                  <div className="text-[16.5px] font-bold">解説を作っています…</div>
                  <div className="mt-0.5 text-[12.5px] text-[var(--muted)]">
                    やさしい言葉に言いかえています
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="w-[26px] shrink-0" />
                <div className="text-[15px] font-medium text-[var(--muted)]">
                  解説を作っています…
                </div>
              </>
            )}
          </div>

          <div className="text-center text-xs text-[var(--muted-2)]">
            そのまま少しだけお待ちください
          </div>
          <button
            type="button"
            onClick={cancelLoading}
            className="py-2 text-center text-[14px] font-bold text-[var(--muted)]"
          >
            キャンセル
          </button>
          {error ? (
            <p className="text-center text-[13px] text-[var(--primary)]">{error}</p>
          ) : null}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onGalleryChange}
      />

      <PaywallSheet
        open={showPaywall}
        onClose={() => setShowPaywall(false)}
        resetsAt={resetsAt}
        kind="scan"
      />
    </div>
  );
}
