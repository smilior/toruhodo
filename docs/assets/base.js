/* design-doc base.js — mermaid only (sidebar + zoom are nav.js) */
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";

mermaid.initialize({
  startOnLoad: true,
  theme: "neutral",
  themeVariables: {
    fontFamily: "'Noto Sans JP',sans-serif",
    fontSize: "13px",
    primaryColor: "#ffffff",
    primaryBorderColor: "#9fccbd",
    primaryTextColor: "#333333",
    lineColor: "#9aa0a6",
    secondaryColor: "#e9f7f2",
    tertiaryColor: "#fafafa",
  },
});

/* 図解の拡大表示は nav.js（file:// 対応・img 対応）に移管済み */
