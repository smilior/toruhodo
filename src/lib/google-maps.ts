/** ブラウザ向け Google Maps JS API ローダ（1 回だけ読み込み） */

const SCRIPT_ID = "toruhodo-google-maps";

export function getGoogleMapsApiKey(): string {
  return (
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAP_API_KEY?.trim() ||
    ""
  );
}

declare global {
  interface Window {
    google?: typeof google;
    __toruhodoGmapsReady?: Promise<typeof google.maps>;
  }
}

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is undefined"));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (window.__toruhodoGmapsReady) {
    return window.__toruhodoGmapsReady;
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return Promise.reject(
      new Error(
        "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY が未設定です。.env.local に追加して dev を再起動してください。",
      ),
    );
  }

  window.__toruhodoGmapsReady = new Promise((resolve, reject) => {
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.google?.maps) resolve(window.google.maps);
        else reject(new Error("Google Maps failed to load"));
      });
      existing.addEventListener("error", () =>
        reject(new Error("Google Maps script error")),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.defer = true;
    // language=ja で日本語UI・表記
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&language=ja&region=JP`;
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error("Google Maps object missing after load"));
    };
    script.onerror = () => {
      window.__toruhodoGmapsReady = undefined;
      reject(new Error("Google Maps の読み込みに失敗しました（キー制限・ネットワークを確認）"));
    };
    document.head.appendChild(script);
  });

  return window.__toruhodoGmapsReady;
}
