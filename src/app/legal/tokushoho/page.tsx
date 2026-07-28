import { PLUS_PRICE_LABEL } from "@/lib/billing/ui-copy";

/** 特定商取引法に基づく表記（§11.1）。実値は server-only env。 */
export default function TokushohoPage() {
  const name = process.env.TOKUSHOHO_NAME?.trim() || "";
  const address = process.env.TOKUSHOHO_ADDRESS?.trim() || "";
  const phone = process.env.TOKUSHOHO_PHONE?.trim() || "";
  const email = process.env.TOKUSHOHO_EMAIL?.trim() || "";
  const allSet = Boolean(name && address && phone && email);

  const rows: [string, string][] = [
    ["販売事業者", name || "（氏名・個人名を記入）"],
    ["所在地", address || "（住所を記入）"],
    ["電話番号", phone || "（電話番号を記入）"],
    ["メールアドレス", email || "（問い合わせ用メールを記入）"],
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
  ];

  return (
    <>
      <h1 className="font-mincho mt-6 text-[22px] font-bold tracking-[0.06em]">
        特定商取引法に基づく表記
      </h1>
      {!allSet ? (
        <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
          プレースホルダを含む雛形です。リリース前に環境変数（TOKUSHOHO_*）へ実値を設定し、専門家確認を経てください。
        </p>
      ) : null}

      <table
        className="mt-6 w-full border-collapse text-[14px] leading-relaxed"
        style={{ border: "1px solid var(--border)" }}
      >
        <tbody>
          {rows.map(([k, v]) => (
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
    </>
  );
}
