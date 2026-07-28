import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoginCta } from "./login-cta";

export const metadata: Metadata = {
  title: "撮るほど — かざすと、やさしく教えてくれる",
  description:
    "石碑や案内板にカメラをかざすと、AIがやさしい言葉で解説。旅の記録は地図と一緒に残ります。",
};

const STEPS = [
  {
    icon: "photo_camera",
    title: "撮る",
    body: "気になる石碑や案内板を、1 タップで撮影。",
  },
  {
    icon: "menu_book",
    title: "わかる",
    body: "むずかしい文章も、やさしい言葉とふりがなで。",
  },
  {
    icon: "map",
    title: "のこす",
    body: "旅の記録帳と地図で、いつでも振り返り。",
  },
] as const;

export default function LoginPage() {
  return (
    <div className="app-shell">
      <div className="app-frame">
        <div
          className="app-screen"
          style={{
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            style={{
              padding:
                "max(20px, env(safe-area-inset-top, 0px)) 20px calc(28px + env(safe-area-inset-bottom, 0px))",
            }}
          >
            {/* ヒーロー */}
            <header className="text-center">
              <div
                className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[14px]"
                style={{ background: "var(--primary)" }}
                aria-hidden
              >
                <AppMark />
              </div>
              <h1
                className="font-mincho m-0 text-[26px] font-bold tracking-[0.12em]"
                style={{ color: "var(--ink)" }}
              >
                撮るほど
              </h1>
              <p
                className="mt-2 m-0 text-[14px] font-medium leading-relaxed"
                style={{ color: "var(--muted)" }}
              >
                かざすと、やさしく教えてくれる
              </p>
              <p
                className="mx-auto mt-4 m-0 max-w-[22em] text-[15px] leading-[1.75]"
                style={{ color: "var(--ink)" }}
              >
                石碑や案内板にカメラをかざすと、AI
                がやさしい言葉で解説してくれます。旅の記録は、地図といっしょに残ります。
              </p>
            </header>

            {/* CTA */}
            <div className="mt-7">
              <Suspense
                fallback={
                  <div
                    className="rounded-[16px] py-3.5 text-center text-[15px] font-bold"
                    style={{
                      minHeight: 52,
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      color: "var(--muted)",
                    }}
                  >
                    読み込み中…
                  </div>
                }
              >
                <LoginCta />
              </Suspense>
            </div>

            {/* 3 ステップ */}
            <section className="mt-8" aria-label="使い方">
              <ul className="m-0 flex list-none flex-col gap-3 p-0">
                {STEPS.map((step, i) => (
                  <li
                    key={step.title}
                    className="card flex items-start gap-3 px-4 py-3.5"
                  >
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: "var(--accent-soft)",
                        color: "var(--primary-deep)",
                      }}
                      aria-hidden
                    >
                      <span
                        className="material-symbols-rounded"
                        style={{ fontSize: 22 }}
                      >
                        {step.icon}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <div className="flex items-baseline gap-2">
                        <span
                          className="text-[12px] font-bold tracking-[0.08em]"
                          style={{ color: "var(--label)" }}
                        >
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <h2
                          className="m-0 text-[16px] font-bold"
                          style={{ color: "var(--ink)" }}
                        >
                          {step.title}
                        </h2>
                      </div>
                      <p
                        className="mt-1 m-0 text-[15px] leading-[1.65]"
                        style={{ color: "var(--ink)" }}
                      >
                        {step.body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* 信頼一文 */}
            <p
              className="mt-6 m-0 text-center text-[14px] leading-relaxed"
              style={{ color: "var(--muted)" }}
            >
              大きな文字とやさしい表現で、どなたでも読みやすく。
            </p>

            {/* 法務フッター */}
            <footer
              className="mt-8 flex flex-col items-center gap-2 text-center text-[12px] leading-relaxed"
              style={{ color: "var(--muted-2)" }}
            >
              <nav
                className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1"
                aria-label="法務"
              >
                <Link
                  href="/legal/terms"
                  className="underline-offset-2 hover:underline"
                  style={{ color: "var(--muted-2)" }}
                >
                  利用規約
                </Link>
                <span aria-hidden>·</span>
                <Link
                  href="/legal/privacy"
                  className="underline-offset-2 hover:underline"
                  style={{ color: "var(--muted-2)" }}
                >
                  プライバシーポリシー
                </Link>
                <span aria-hidden>·</span>
                <Link
                  href="/legal/tokushoho"
                  className="underline-offset-2 hover:underline"
                  style={{ color: "var(--muted-2)" }}
                >
                  特定商取引法に基づく表記
                </Link>
              </nav>
            </footer>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppMark() {
  return (
    <svg width="30" height="30" viewBox="0 0 512 512" fill="none" aria-hidden>
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
  );
}
