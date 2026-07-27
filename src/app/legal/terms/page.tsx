import Link from "next/link";
import { PLUS_PRICE_LABEL } from "@/lib/billing/ui-copy";

/** 利用規約（課金条項の草案。要専門家確認 §11.5） */
export default function TermsPage() {
  return (
    <>
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
            いつでも解約できます。解約後も契約期間の終わりまではプラス機能を利用できます。日割りの返金はありません。これまでの記録は消えません。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">返金</h2>
          <p className="m-0 mt-1">
            性質上、提供開始後の返金は原則として行いません。通信販売のためクーリングオフは適用されません。ただし
            (a) 誤請求・二重請求 (b) 長時間の重大障害 (c)
            法令上必要な場合は個別に対応します。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">料金改定</h2>
          <p className="m-0 mt-1">
            料金を改定する場合は、民法第548条の4（定型約款の変更）に沿い、事前に周知したうえで、各ユーザーの次回更新分から適用します。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">支払い失敗</h2>
          <p className="m-0 mt-1">
            決済に失敗した場合、一定期間の再試行後に無料プランへ切り替わることがあります。記録データは削除しません。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">全データの削除</h2>
          <p className="m-0 mt-1">
            アプリ内の全データ削除を行う場合、有効なサブスクリプションは即時解約され、日割り返金はありません。削除後も課金だけが残ることはありません。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">解説の性質</h2>
          <p className="m-0 mt-1">
            本サービスの解説は AI によるものです。歴史的事実の正確性を保証するものではありません。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">プライバシー</h2>
          <p className="m-0 mt-1">
            個人情報の取り扱いについては
            <Link
              href="/legal/privacy"
              className="underline"
              style={{ color: "var(--secondary)" }}
            >
              プライバシーポリシー
            </Link>
            をご確認ください。
          </p>
        </section>
      </article>
    </>
  );
}
