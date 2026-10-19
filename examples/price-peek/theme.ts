import { defineTheme } from "@dolly/core";

// Price Peek's brand: cool grey paper, near-black ink, electric blue accent; Bricolage Grotesque for
// headlines, Instrument Sans for UI text, Segoe UI for the badge (as the extension draws it).
export const theme = defineTheme({
  name: "price-peek",
  colors: { bg: "#eef1f6", fg: "#14161b", accent: "#3355ff", "accent-soft": "#8ea0ff", muted: "#8a90a0", surface: "#ffffff", ink: "#14161b", line: "#dfe2e8", grid: "#d3d8e1" },
  // price: glyphs Instrument Sans lacks (₩, ฿, 万) fall back to the generic sans-serif, as on the store page
  fonts: { display: '"Bricolage Grotesque", sans-serif', body: '"Instrument Sans", "Segoe UI", sans-serif', price: '"Instrument Sans", sans-serif', ui: '"Segoe UI", "Instrument Sans", sans-serif' },
  // TODO(self-host): vendor these OFL fonts into fonts/ so renders never touch the network.
  fontCss: ["https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Instrument+Sans:wght@400;500;600;700&display=block"],
  fontFaces: [
    { family: "Bricolage Grotesque", weight: "800" }, { family: "Bricolage Grotesque", weight: "700" },
    { family: "Instrument Sans", weight: "500" }, { family: "Instrument Sans", weight: "600" }, { family: "Instrument Sans", weight: "700" },
  ],
  radii: { sm: 8, md: 14, lg: 22 },
  shadows: {
    card: "0 24px 48px -28px rgba(20,24,40,.35), 0 0 0 1px rgba(20,24,40,.05)",
    float: "0 50px 90px -40px rgba(20,24,40,.5), 0 0 0 1px rgba(20,24,40,.06)",
  },
});
