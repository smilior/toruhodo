export type Entitlement = "free" | "plus";

// PR-2 が §6.4 の実装（isEntitled + subscriptions 参照）で本ファイルを全置換する。
// それまで plus 契約は存在し得ないため "free" 固定は意味的にも正しい。
export async function getEntitlement(_userId: string): Promise<Entitlement> {
  return "free";
}
