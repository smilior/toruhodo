import Link from "next/link";
import { PLUS_PRICE_LABEL } from "@/lib/billing/ui-copy";

/** 利用規約（課金条項の草案。要専門家確認 §11.5） */
export default function TermsPage() {
  return (
    <div
      className="mx-auto min-h-dvh max-w-[640px] px-5 py-8"
      style={{ background: "var(--bg)", color: "var(--ink)" }}
    >
      <Link
        href="/settings"
        className="text-[14px] font-bold no-underline"
        style={{ color: "var(--secondary)" }}
      >
        ← 設定にもどる
      </Link>
      <h1 className="font-mincho mt-6 text-[22px] font-bold tracking-[0.06em]">
        利用規約
      </h1>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
        課金に関する条項の草案です。正式公開前に弁護士確認を経てください。
      </p>

      <article className="mt-6 space-y-5 text-[15px] leading-[1.85]">
        <section>
          <h2 className="text-[16px] font-bold">プランと料金</h2>
          <p className="m-0 mt-1" style={{ color: "var(--ink)" }}>
            無料プランのほか、有料プラン「撮るほどプラス」（{PLUS_PRICE_LABEL}
            ・1か月ごと自動更新）を提供します。無料トライアルは当面ありません。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">解約</h2>
          <p className="m-0 mt-1">
            いつでも解約できます。解約後も契約期間の終わりまではプラス機能を利用できます。日割り返金はありません。これまでの記録は消えません。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">返金</h2>
          <p className="m-0 mt-1">
            性質上、提供開始後の返金は原則として行いません。通信販売のためクーリングオフは適用されません。ただし誤請求・二重請求、長時間の重大障害、法令上必要な場合は個別に対応します。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">支払い失敗</h2>
          <p className="m-0 mt-1">
            決済に失敗した場合、一定期間の再試行後に無料プランへ切り替わることがあります。記録データは削除しません。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">解説の性質</h2>
          <p className="m-0 mt-1">
            本サービスの解説は AI によるものです。歴史的事実の正確性を保証するものではありません。
          </p>
        </section>
      </article>
    </div>
  );
}
