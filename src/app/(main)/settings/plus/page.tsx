"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCheckoutSessionAction } from "@/actions/billing";
import { PLUS_PLAN_NAME, PLUS_PRICE_LABEL } from "@/lib/billing/ui-copy";

/**
 * 申込内容の確認（特商法 12条の6 の 6 項目集約 §9.3 / §11.2）
 * Checkout 前に必ず挟む。
 */
export default function PlusConfirmPage() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const startCheckout = () => {
    setError(null);
    startTransition(async () => {
      const res = await createCheckoutSessionAction({ plan: "plus_monthly" });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // 同一タブで Stripe Checkout へ
      window.location.href = res.data.url;
    });
  };

  return (
    <div
      className="mx-auto min-h-dvh max-w-[480px]"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <header
        className="flex items-center gap-2"
        style={{ padding: "16px 20px 8px" }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center justify-center border-0 bg-transparent"
          style={{ width: 44, height: 44, cursor: "pointer" }}
          aria-label="もどる"
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: 24, color: "var(--ink)" }}
          >
            arrow_back
          </span>
        </button>
        <h1
          className="font-mincho m-0 text-[20px] font-bold tracking-[0.06em]"
        >
          お申し込み内容のご確認
        </h1>
      </header>

      <div style={{ padding: "12px 20px 40px" }}>
        {error ? (
          <p
            className="mb-4 m-0 rounded-2xl px-4 py-3 text-[14px] font-medium"
            style={{
              background: "var(--warn-bg)",
              color: "var(--warn-ink)",
              border: "1px solid var(--warn-border)",
            }}
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <div className="card px-5 py-5">
          <dl className="m-0 flex flex-col gap-4 text-[16px] leading-relaxed">
            <div>
              <dt className="text-[12px] font-bold tracking-[0.08em]" style={{ color: "var(--label)" }}>
                プラン
              </dt>
              <dd className="m-0 mt-1 font-bold">
                {PLUS_PLAN_NAME}（スキャン回数たっぷり）
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-bold tracking-[0.08em]" style={{ color: "var(--label)" }}>
                料金
              </dt>
              <dd className="m-0 mt-1">
                <strong>{PLUS_PRICE_LABEL}</strong>
                。1か月ごとに自動更新され、毎月の更新日にクレジットカードへ請求されます。
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-bold tracking-[0.08em]" style={{ color: "var(--label)" }}>
                利用開始
              </dt>
              <dd className="m-0 mt-1">
                お支払い手続きの完了後、すぐに使えます。
              </dd>
            </div>
            <div>
              <dt className="text-[12px] font-bold tracking-[0.08em]" style={{ color: "var(--label)" }}>
                解約
              </dt>
              <dd className="m-0 mt-1">
                いつでもできます。「設定 → プラン」から手続きすると、期間の終わりで更新が止まります。途中解約の日割り返金はありません。
              </dd>
            </div>
          </dl>

          <p
            className="mt-5 m-0 flex flex-wrap gap-x-4 gap-y-1 text-[13px]"
            style={{ color: "var(--muted)" }}
          >
            <Link href="/legal/terms" className="underline" style={{ color: "var(--secondary)" }}>
              利用規約
            </Link>
            <Link
              href="/legal/tokushoho"
              className="underline"
              style={{ color: "var(--secondary)" }}
            >
              特定商取引法に基づく表記
            </Link>
          </p>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={startCheckout}
            disabled={pending}
            className="rounded-full border-0 text-[16px] font-bold"
            style={{
              minHeight: 54,
              background: "var(--primary)",
              color: "var(--card)",
              cursor: pending ? "not-allowed" : "pointer",
              opacity: pending ? 0.7 : 1,
            }}
          >
            {pending
              ? "準備中…"
              : "お支払いに進む（Stripe の画面が開きます）"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            disabled={pending}
            className="rounded-full border-0 text-[16px] font-bold"
            style={{
              minHeight: 52,
              background: "transparent",
              color: "var(--label)",
              border: "1.5px solid var(--border)",
              cursor: "pointer",
            }}
          >
            もどる
          </button>
        </div>

        <p
          className="mt-5 m-0 text-center text-[12px] leading-relaxed"
          style={{ color: "var(--muted-2)" }}
        >
          カード情報は Stripe が取り扱い、このアプリのサーバーには保存しません。
        </p>
      </div>
    </div>
  );
}
