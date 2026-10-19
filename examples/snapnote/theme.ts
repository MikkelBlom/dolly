import { defineTheme } from "@dolly/core";

// Snapnote brand: warm off-white, deep green accent, rounded cards, friendly sans (Montserrat) + Lora for quotes.
export const theme = defineTheme({
  name: "Snapnote",
  colors: {
    bg: "#f7f3ec", fg: "#1d2420", accent: "#1f6f4a", "accent-soft": "#bfe3cd", muted: "#5c6059",
    surface: "#fffdf9", ink: "#1f6f4a", line: "#e7dfd2", warn: "#9a5b12", "warn-soft": "#fbecd3", select: "#cfe8d9",
  },
  fonts: {
    display: '"Montserrat", system-ui, sans-serif', body: '"Montserrat", system-ui, sans-serif',
    ui: '"Montserrat", system-ui, sans-serif', serif: '"Lora", Georgia, serif',
  },
  fontFaces: [
    { family: "Montserrat", src: "fonts/Montserrat-Regular.ttf", weight: "400" },
    { family: "Montserrat", src: "fonts/Montserrat-Bold.ttf", weight: "700" },
    { family: "Lora", src: "fonts/Lora-Regular.ttf", weight: "400" },
    { family: "Lora", src: "fonts/Lora-Italic.ttf", weight: "400", style: "italic" },
  ],
  radii: { sm: 10, md: 16, lg: 24 },
  shadows: {
    card: "0 24px 48px -28px rgba(40,32,20,.35), 0 0 0 1px rgba(40,32,20,.06)",
    float: "0 50px 90px -40px rgba(40,32,20,.45), 0 0 0 1px rgba(40,32,20,.07)",
  },
});
