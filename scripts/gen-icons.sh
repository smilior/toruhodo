#!/usr/bin/env bash
# 撮るほど — アプリアイコン生成スクリプト（source of truth）
# 朱印シール地 × 道標（石碑）シルエット ＋ やさしいきらめき。文字は使わない。
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

# ---- 共有アート（道標 + きらめき） ----
GRAD='<defs><radialGradient id="seal" cx="38%" cy="30%" r="85%"><stop offset="0%" stop-color="#C2582F"/><stop offset="60%" stop-color="#B9502F"/><stop offset="100%" stop-color="#A9472A"/></radialGradient></defs>'
read -r -d '' ART <<'ART' || true
  <!-- 道標（先細り・山形天端） -->
  <g fill="#FDFBF4">
    <rect x="128" y="388" width="240" height="30" rx="9"/>
    <rect x="150" y="358" width="196" height="32" rx="7"/>
    <path d="M 172 360 L 184 152 Q 186 132 204 124 L 240 108 Q 248 105 256 108 L 292 124 Q 310 132 312 152 L 324 360 Z"/>
  </g>
  <!-- 刻線（碑文の暗示・抽象／文字ではない） -->
  <g fill="#A9472A">
    <rect x="206" y="198" width="86" height="13" rx="6.5"/>
    <rect x="216" y="234" width="66" height="13" rx="6.5"/>
  </g>
  <!-- きらめき（かざすと、やさしく教えてくれる） -->
  <g fill="#FDFBF4">
    <path d="M 398 116 Q 406 148 438 156 Q 406 164 398 196 Q 390 164 358 156 Q 390 148 398 116 Z"/>
    <path d="M 442 190 Q 446 205 462 209 Q 446 213 442 228 Q 438 213 422 209 Q 438 205 442 190 Z" opacity="0.9"/>
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
