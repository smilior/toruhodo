"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { signIn } from "@/lib/auth-client";

function LoginContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      await signIn.social({
        provider: "google",
        callbackURL: callbackUrl,
      });
    } catch (e) {
      console.error(e);
      setError(
        "ログインを開始できませんでした。GOOGLE_CLIENT_ID / SECRET と BETTER_AUTH_SECRET を確認してください。",
      );
      setLoading(false);
    }
  };

  return (
    <div className="app-shell items-center p-5 sm:p-6">
      <div
        className="w-full max-w-[400px] rounded-[28px] p-7 sm:p-8"
        style={{
          background: "var(--card)",
          boxShadow: "0 12px 32px rgba(58, 53, 44, 0.1)",
          border: "1px solid var(--card-border)",
        }}
      >
        <div className="text-center mb-8">
          <div
            className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[14px]"
            style={{
              background: "var(--primary)",
            }}
            aria-hidden
          >
            <svg width="30" height="30" viewBox="0 0 512 512" fill="none">
              <g
                stroke="#fff"
                strokeWidth={38}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M150 214 V182 Q150 150 182 150 H214" />
                <path d="M298 150 H330 Q362 150 362 182 V214" />
                <path d="M362 298 V330 Q362 362 330 362 H298" />
                <path d="M214 362 H182 Q150 362 150 330 V298" />
              </g>
              <path
                d="M256 196 Q270 242 316 256 Q270 270 256 316 Q242 270 196 256 Q242 242 256 196 Z"
                fill="#fff"
              />
            </svg>
          </div>
          <h1
            className="font-mincho text-[24px] font-bold tracking-[0.14em]"
            style={{ color: "var(--ink)" }}
          >
            撮るほど
          </h1>
          <p
            className="mt-2.5 text-[12.5px] font-medium leading-relaxed"
            style={{ color: "var(--muted)" }}
          >
            かざすと、やさしく教えてくれる
          </p>
        </div>

        {error ? (
          <div
            className="mb-4 rounded-2xl px-4 py-3 text-[13px] font-medium"
            style={{
              background: "var(--warn-bg)",
              color: "var(--warn-ink)",
              border: "1px solid var(--warn-border)",
            }}
            role="alert"
          >
            {error}
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleGoogle}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-[16px] border px-5 py-3.5 text-[15px] font-bold transition active:scale-[0.98] disabled:opacity-60"
          style={{
            background: "var(--bg)",
            borderColor: "var(--border)",
            color: "var(--ink)",
          }}
        >
          <GoogleIcon />
          {loading ? "接続中…" : "Googleでログイン"}
        </button>

        <p
          className="mt-5 text-center text-[11.5px] font-medium leading-relaxed"
          style={{ color: "var(--muted-2)" }}
        >
          ログイン後、旅の記録はあなたのアカウントに保存されます。
        </p>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div
          className="min-h-dvh flex items-center justify-center"
          style={{ color: "var(--muted)" }}
        >
          読み込み中…
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
