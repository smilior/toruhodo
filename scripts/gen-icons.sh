#!/usr/bin/env bash
# 撮るほど — アプリアイコン生成スクリプト（source of truth）
# sorosoro と同系のミニマル: セージ緑グラデ地 × 白の道標（石碑）マーカー単一モチーフ。文字は使わない。
# 依存: rsvg-convert（brew install librsvg）
# 使い方: bash scripts/gen-icons.sh  （リポジトリ直下で実行）
set -euo pipefail
cd "$(dirname "$0")/.."

ROOT="$(pwd)"
OUT_ICONS="$ROOT/public/icons"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT
mkdir -p "$OUT_ICONS" "$ROOT/src/app"

command -v rsvg-convert >/dev/null 2>&1 || {
  echo "rsvg-convert が必要です: brew install librsvg" >&2; exit 1; }

# ---- 共有アート（道標マーカー・単一モチーフ） ----
GRAD='<defs><linearGradient id="seal" x1="256" y1="0" x2="256" y2="512" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#7CAF85"/><stop offset="1" stop-color="#6FA378"/></linearGradient></defs>'
read -r -d '' ART <<'ART' || true
  <!-- 道標マーカー（石碑シルエット・先細り・山形天端／ミニマル） -->
  <g fill="#FFFFFF">
    <rect x="156" y="352" width="200" height="30" rx="15"/>
    <path d="M 214 356 L 224 176 Q 226 148 256 140 Q 286 148 288 176 L 298 356 Z"/>
  </g>
ART

# seal: 角丸・外側透過（favicon / PWA any）
cat > "$BUILD/seal.svg" <<SVG
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
$GRAD
<rect x="0" y="0" width="512" height="512" rx="114" fill="url(#seal)"/>
$ART
</svg>
SVG

# apple: 全面塗り（iOSが角丸マスク）
cat > "$BUILD/apple.svg" <<SVG
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
$GRAD
<rect x="0" y="0" width="512" height="512" fill="url(#seal)"/>
$ART
</svg>
SVG

# maskable: 全面塗り＋内容を中央80%安全域へ（Android maskable）
cat > "$BUILD/maskable.svg" <<SVG
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
$GRAD
<rect x="0" y="0" width="512" height="512" fill="url(#seal)"/>
<g transform="translate(51.2,51.2) scale(0.80)">
$ART
</g>
</svg>
SVG

# 出力
cp "$BUILD/seal.svg" "$ROOT/src/app/icon.svg"
cp "$BUILD/seal.svg" "$OUT_ICONS/icon.svg"
rsvg-convert -w 192 -h 192 "$BUILD/seal.svg"     -o "$OUT_ICONS/icon-192.png"
rsvg-convert -w 512 -h 512 "$BUILD/seal.svg"     -o "$OUT_ICONS/icon-512.png"
rsvg-convert -w 512 -h 512 "$BUILD/maskable.svg" -o "$OUT_ICONS/maskable-512.png"
rsvg-convert -w 180 -h 180 "$BUILD/apple.svg"    -o "$ROOT/src/app/apple-icon.png"

echo "生成完了:"
echo "  src/app/icon.svg"
echo "  src/app/apple-icon.png (180)"
echo "  public/icons/icon.svg"
echo "  public/icons/icon-192.png"
echo "  public/icons/icon-512.png"
echo "  public/icons/maskable-512.png"
