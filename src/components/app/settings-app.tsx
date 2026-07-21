"use client";

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import {
  deleteAllUserDataAction,
  getSettingsAction,
  updateSettingsAction,
} from "@/actions/records";
import {
  DEFAULT_SETTINGS,
  type SettingsDTO,
} from "@/lib/domain/record";
import { signOut } from "@/lib/auth-client";
import { AppShell } from "@/components/app/app-shell";

type DeleteStep = "idle" | "confirm" | "deleting";

export function SettingsApp({
  initialSettings = DEFAULT_SETTINGS,
}: {
  initialSettings?: SettingsDTO;
}) {
  const [settings, setSettings] = useState<SettingsDTO>(initialSettings);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<DeleteStep>("idle");
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const refresh = useCallback(async () => {
    const res = await getSettingsAction();
    if (res.ok) setSettings(res.data.settings);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const patch = (partial: Partial<SettingsDTO>) => {
    const prev = settings;
    const next = { ...settings, ...partial };
    setSettings(next);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await updateSettingsAction(partial);
      if (!res.ok) {
        setSettings(prev);
        setError(res.error);
        return;
      }
      setSettings(res.data.settings);
    });
  };

  const handleDeleteAll = () => {
    if (deleteStep === "idle") {
      setDeleteStep("confirm");
      setMessage(null);
      setError(null);
      return;
    }
    if (deleteStep !== "confirm") return;

    setDeleteStep("deleting");
    startTransition(async () => {
      const res = await deleteAllUserDataAction();
      if (!res.ok) {
        setError(res.error);
        setDeleteStep("confirm");
        return;
      }
      setSettings({ ...DEFAULT_SETTINGS });
      setDeleteStep("idle");
      setMessage("すべての記録と設定を削除しました");
    });
  };

  const handleLogout = () => {
    void signOut({
      fetchOptions: {
        onSuccess: () => {
          window.location.href = "/login";
        },
      },
    });
  };

  return (
    <AppShell>
      <div className="app-scroll">
        <div style={{ padding: "16px 24px 6px" }}>
          <h1
            className="font-mincho m-0 text-[22px] font-bold tracking-[0.08em]"
            style={{ color: "var(--ink)" }}
          >
            設定
          </h1>
        </div>

        <div
          className="flex flex-col gap-2"
          style={{ padding: "8px 20px 32px" }}
        >
          {error ? (
            <p
              className="m-0 rounded-2xl px-4 py-3 text-[13px] font-medium"
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
          {message ? (
            <p
              className="m-0 rounded-2xl px-4 py-3 text-[13px] font-medium"
              style={{
                background: "var(--ai-card)",
                color: "var(--secondary)",
                border: "1px solid var(--ai-border)",
              }}
              role="status"
            >
              {message}
            </p>
          ) : null}

          <GroupTitle>表示の初期値</GroupTitle>
          <div className="card overflow-hidden">
            <Row bordered>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">ふりがな</div>
                <div
                  className="mt-0.5 text-[12px]"
                  style={{ color: "var(--muted)" }}
                >
                  解説画面を開いたときの初期状態
                </div>
              </div>
              <Toggle
                on={settings.furiganaDefault}
                disabled={pending}
                ariaLabel="ふりがな初期値"
                onClick={() =>
                  patch({ furiganaDefault: !settings.furiganaDefault })
                }
              />
            </Row>
            <Row>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">解説モード</div>
                <div
                  className="mt-0.5 text-[12px]"
                  style={{ color: "var(--muted)" }}
                >
                  やさしい / くわしい
                </div>
              </div>
              <div
                className="flex shrink-0 rounded-full p-[3px]"
                style={{ background: "var(--segment)" }}
                role="group"
                aria-label="解説モード初期値"
              >
                {(
                  [
                    { value: "easy", label: "やさしい" },
                    { value: "detail", label: "くわしい" },
                  ] as const
                ).map((opt) => {
                  const active = settings.modeDefault === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={pending}
                      onClick={() => patch({ modeDefault: opt.value })}
                      className="rounded-full px-3.5 py-[7px] text-[13px] font-bold"
                      style={{
                        background: active ? "var(--card)" : "transparent",
                        color: active ? "var(--ink)" : "var(--muted)",
                        boxShadow: active
                          ? "0 1px 3px rgba(58, 53, 44, 0.14)"
                          : "none",
                        border: "none",
                        cursor: pending ? "not-allowed" : "pointer",
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </Row>
          </div>

          <GroupTitle>プライバシー</GroupTitle>
          <div className="card overflow-hidden">
            <Row>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-medium">位置情報を記録する</div>
                <div
                  className="mt-0.5 text-[12px]"
                  style={{ color: "var(--muted)" }}
                >
                  オフでも記録自体は残せます
                </div>
              </div>
              <Toggle
                on={settings.geoEnabled}
                disabled={pending}
                ariaLabel="位置情報を記録する"
                onClick={() => patch({ geoEnabled: !settings.geoEnabled })}
              />
            </Row>
          </div>

          <GroupTitle>データ</GroupTitle>
          <div className="card overflow-hidden">
            {deleteStep === "idle" ? (
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={pending}
                className="flex w-full items-center gap-3 border-0 bg-transparent px-[18px] py-4 text-left"
                style={{ minHeight: 56, cursor: "pointer" }}
              >
                <span
                  className="text-[15px] font-bold"
                  style={{ color: "var(--primary)" }}
                >
                  すべての記録を削除
                </span>
              </button>
            ) : (
              <div className="px-[18px] py-4">
                <p
                  className="m-0 text-[14px] font-medium leading-relaxed"
                  style={{ color: "var(--ink)" }}
                >
                  すべての旅の記録と設定を削除します。この操作は取り消せません。
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={deleteStep === "deleting"}
                    onClick={() => setDeleteStep("idle")}
                    className="flex-1 rounded-full border-0 py-3 text-[14px] font-bold"
                    style={{
                      background: "var(--segment)",
                      color: "var(--label)",
                      cursor: "pointer",
                      minHeight: 44,
                    }}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    disabled={deleteStep === "deleting" || pending}
                    onClick={handleDeleteAll}
                    className="flex-1 rounded-full border-0 py-3 text-[14px] font-bold"
                    style={{
                      background: "var(--primary)",
                      color: "var(--card)",
                      cursor:
                        deleteStep === "deleting" ? "not-allowed" : "pointer",
                      minHeight: 44,
                      opacity: deleteStep === "deleting" ? 0.6 : 1,
                    }}
                  >
                    {deleteStep === "deleting" ? "削除中…" : "削除する"}
                  </button>
                </div>
              </div>
            )}
          </div>

          <GroupTitle>アカウント</GroupTitle>
          <div className="card overflow-hidden">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 border-0 bg-transparent px-[18px] py-4 text-left"
              style={{ minHeight: 56, cursor: "pointer" }}
            >
              <span className="flex-1 text-[15px] font-medium">ログアウト</span>
              <span
                className="material-symbols-rounded"
                style={{ fontSize: 20, color: "#B4AA94" }}
                aria-hidden
              >
                logout
              </span>
            </button>
          </div>

          <GroupTitle>その他</GroupTitle>
          <div className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDisclaimer((v) => !v)}
              className="flex w-full items-center gap-3 border-0 bg-transparent px-[18px] py-4 text-left"
              style={{ minHeight: 56, cursor: "pointer" }}
              aria-expanded={showDisclaimer}
            >
              <span className="flex-1 text-[15px] font-medium">
                免責・利用について
              </span>
              <span
                className="material-symbols-rounded"
                style={{
                  fontSize: 20,
                  color: "#B4AA94",
                  transform: showDisclaimer ? "rotate(90deg)" : "none",
                  transition: "transform 0.15s ease",
                }}
                aria-hidden
              >
                chevron_right
              </span>
            </button>
            {showDisclaimer ? (
              <div
                className="px-[18px] pb-4 text-[13px] leading-[1.8]"
                style={{ color: "var(--muted)" }}
              >
                撮るほどの解説は AI によるものです。歴史的事実の正確性を保証するものではありません。正確な情報は現地の案内板・資料をご確認ください。
              </div>
            ) : null}
          </div>

          <div
            className="px-2 pt-5 text-center text-[12px] leading-[1.7]"
            style={{ color: "var(--muted-2)" }}
          >
            撮るほど
            <br />
            AIによる解説です。正確な情報は現地の案内をご確認ください。
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-[12px] font-bold tracking-[0.1em]"
      style={{ color: "var(--label)", padding: "16px 4px 8px" }}
    >
      {children}
    </div>
  );
}

function Row({
  children,
  bordered = false,
}: {
  children: ReactNode;
  bordered?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-3 px-[18px] py-4"
      style={{
        minHeight: 56,
        borderBottom: bordered ? "1px solid var(--border)" : undefined,
      }}
    >
      {children}
    </div>
  );
}

function Toggle({
  on,
  disabled,
  ariaLabel,
  onClick,
}: {
  on: boolean;
  disabled?: boolean;
  ariaLabel: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className="relative shrink-0 border-0 p-0"
      style={{
        width: 52,
        height: 31,
        borderRadius: 999,
        background: on ? "var(--primary)" : "var(--toggle-off)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background 0.15s ease",
      }}
    >
      <span
        aria-hidden
        className="absolute block rounded-full"
        style={{
          top: 3,
          left: 3,
          width: 25,
          height: 25,
          background: "var(--card)",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.2)",
          transform: on ? "translateX(21px)" : "translateX(0)",
          transition: "transform 0.15s ease",
        }}
      />
    </button>
  );
}
