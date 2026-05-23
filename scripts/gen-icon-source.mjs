// Generate a 1024x1024 PNG from the inline app logo SVG, save next to icon assets.
import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1024" height="1024">
  <defs>
    <linearGradient id="lg" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#f5d06f"/>
      <stop offset="55%" stop-color="#d4a017"/>
      <stop offset="100%" stop-color="#a47411"/>
    </linearGradient>
    <linearGradient id="sh" x1="0" y1="0" x2="0" y2="24" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#fff" stop-opacity="0.55"/>
      <stop offset="60%" stop-color="#fff" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="24" height="24" rx="6" fill="url(#lg)"/>
  <rect width="24" height="24" rx="6" fill="url(#sh)"/>
  <rect x="5" y="5" width="6" height="6" rx="1.4" fill="#1a1408" fill-opacity="0.85"/>
  <rect x="13" y="5" width="6" height="6" rx="1.4" fill="#1a1408" fill-opacity="0.35"/>
  <rect x="5" y="13" width="6" height="6" rx="1.4" fill="#1a1408" fill-opacity="0.35"/>
  <rect x="13" y="13" width="6" height="6" rx="1.4" fill="#1a1408" fill-opacity="0.85"/>
</svg>`;

const out = resolve("src-tauri/icons/source-1024.png");
const buffer = await sharp(Buffer.from(svg)).resize(1024, 1024).png().toBuffer();
writeFileSync(out, buffer);
console.log("Wrote", out, buffer.length, "bytes");
