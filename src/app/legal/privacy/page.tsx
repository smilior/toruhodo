import Link from "next/link";

/** プライバシーポリシー草案（§11.5-6。要専門家確認） */
export default function PrivacyPage() {
  const contact =
    process.env.TOKUSHOHO_EMAIL?.trim() || "（問い合わせ用メールを記入）";

  return (
    <>
      <h1 className="font-mincho mt-6 text-[22px] font-bold tracking-[0.06em]">
        プライバシーポリシー
      </h1>
      <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
        草案です。正式公開前に弁護士確認を経てください。
      </p>

      <article className="mt-6 space-y-5 text-[15px] leading-[1.85]">
        <section>
          <h2 className="text-[16px] font-bold">収集する情報</h2>
          <p className="m-0 mt-1">
            Google アカウントによるログイン情報（氏名・メールアドレス等）、撮影した石碑・案内板の画像、任意で記録する位置情報、利用状況（スキャン・質問の回数など）を取り扱います。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">利用目的</h2>
          <p className="m-0 mt-1">
            解説の生成、記録の保存・表示、サービス改善、不正利用の防止、課金・サポート対応のために利用します。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">外部への提供・委託</h2>
          <ul className="mt-1 list-disc space-y-2 pl-5">
            <li>
              画像解析のため、Google の Gemini API に画像・テキストを送信することがあります。
            </li>
            <li>
              写真の保存に Vercel Blob、データベースに Turso（libSQL）を利用します。
            </li>
            <li>
              有料プランの決済は Stripe が行います。
              <strong>
                カード情報は Stripe が取り扱い、本サービスのサーバーには保存しません
              </strong>
              。詳細は
              <a
                href="https://stripe.com/jp/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: "var(--secondary)" }}
              >
                Stripe のプライバシーポリシー
              </a>
              をご確認ください。
            </li>
          </ul>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">データの削除</h2>
          <p className="m-0 mt-1">
            設定画面から「すべての記録を削除」を実行すると、保存した記録と設定を削除します。有効なサブスクリプションがある場合は先に解約します。
          </p>
        </section>
        <section>
          <h2 className="text-[16px] font-bold">お問い合わせ</h2>
          <p className="m-0 mt-1">
            個人情報に関するお問い合わせ: {contact}
            <br />
            事業者情報は
            <Link
              href="/legal/tokushoho"
              className="underline"
              style={{ color: "var(--secondary)" }}
            >
              特定商取引法に基づく表記
            </Link>
            もご参照ください。
          </p>
        </section>
      </article>
    </>
  );
}
