import Link from "next/link";
import { PLUS_PRICE_LABEL } from "@/lib/billing/ui-copy";

/** 特定商取引法に基づく表記（雛形。実値はリリース前に記入 §11.1） */
export default function TokushohoPage() {
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
        特定商取引法に基づく表記
      </h1>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
        プレースホルダを含む雛形です。リリース前に実値を記入し、専門家確認を経てください。
      </p>

      <table
        className="mt-6 w-full border-collapse text-[14px] leading-relaxed"
        style={{ border: "1px solid var(--border)" }}
      >
        <tbody>
          {(
            [
              ["販売事業者", "（氏名・個人名を記入）"],
              ["所在地", "（住所を記入）"],
              ["電話番号", "（電話番号を記入）"],
              ["メールアドレス", "（問い合わせ用メールを記入）"],
              ["販売価格", PLUS_PRICE_LABEL],
              [
                "対価以外の費用",
                "インターネット接続に要する通信費はお客様のご負担となります。",
              ],
              [
                "支払時期・方法",
                "お申し込み時にクレジットカード等で決済。以後、1か月ごとの更新日に自動請求。",
              ],
              [
                "役務の提供時期",
                "お支払い手続きの完了後、ただちにご利用いただけます。",
              ],
              [
                "解約・返金",
                "いつでも解約可。期間の終わりまで利用可。日割り返金なし。誤請求等は個別対応。",
              ],
              [
                "動作環境",
                "最新のモバイル向けブラウザ（iOS Safari / Android Chrome 等）および PWA。",
              ],
              [
                "プラン内容",
                "撮るほどプラス: スキャン・ガイド質問の回数制限を実質解除（フェアユース上限あり）。",
              ],
            ] as const
          ).map(([k, v]) => (
            <tr key={k} style={{ borderTop: "1px solid var(--border)" }}>
              <th
                className="px-3 py-3 text-left align-top font-bold"
                style={{
                  width: "32%",
                  background: "var(--segment)",
                  color: "var(--label)",
                }}
              >
                {k}
              </th>
              <td className="px-3 py-3">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
