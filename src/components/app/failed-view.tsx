"use client";

type FailedViewProps = {
  onRetry: () => void;
  onHome: () => void;
  onClose?: () => void;
  error?: string | null;
};

export function FailedView({ onRetry, onHome, onClose, error }: FailedViewProps) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg)]">
      <div className="flex shrink-0 items-center px-3 pt-3 pb-1">
        <button
          type="button"
          aria-label="閉じる"
          onClick={onClose ?? onHome}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[var(--label)]"
        >
          <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
            close
          </span>
        </button>
        <div className="flex-1 text-center text-[16px] font-bold tracking-wide">解説</div>
        <div className="w-10" />
      </div>

      <div className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-8 pt-2">
        <div
          className="mx-auto mt-5 flex h-[104px] w-[104px] items-center justify-center rounded-full"
          style={{ background: "#F0E8D3" }}
        >
          <span
            className="material-symbols-rounded"
            style={{ fontSize: 46, color: "#A89263" }}
            aria-hidden
          >
            no_photography
          </span>
        </div>

        <h1 className="font-mincho text-center text-[20px] font-bold leading-snug">
          うまく読み取れませんでした
        </h1>

        <p
          className="text-center text-[15px] leading-[2] text-[var(--label)]"
          style={{ textWrap: "pretty" }}
        >
          {error
            ? error
            : "文字が小さかったり、影に入っていたりすると、読み取りがむずかしいことがあります。だいじょうぶ、もう一度ためしてみましょう。"}
        </p>

        <div className="card rounded-[20px] p-[18px]">
          <h2 className="text-[13px] font-bold tracking-[0.12em] text-[var(--label)]">
            うまく撮るコツ
          </h2>
          <div className="mt-3 flex flex-col gap-3">
            {(
              [
                ["zoom_in", "文字に近づいて、大きく写す"],
                ["light_mode", "影や反射をさけて、明るいところで"],
                ["center_focus_strong", "正面から、まっすぐ撮る"],
              ] as const
            ).map(([icon, label]) => (
              <div key={icon} className="flex items-center gap-[11px]">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                  style={{ background: "#F3EDDC" }}
                >
                  <span
                    className="material-symbols-rounded"
                    style={{ fontSize: 19, color: "var(--primary)" }}
                    aria-hidden
                  >
                    {icon}
                  </span>
                </div>
                <span className="text-[15px] leading-relaxed">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto flex flex-col gap-3.5 pt-4">
          <button type="button" className="btn-primary" onClick={onRetry}>
            <span className="material-symbols-rounded" style={{ fontSize: 22 }} aria-hidden>
              photo_camera
            </span>
            もう一度撮る
          </button>
          <button
            type="button"
            onClick={onHome}
            className="py-2 text-center text-[14px] font-bold text-[var(--secondary)]"
          >
            ホームにもどる
          </button>
        </div>
      </div>
    </div>
  );
}
