import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.resolve(__dirname, "../apps/web/public");
const outputPath = path.join(outputDir, "og-image.png");

const svg = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f0fdfa"/>
      <stop offset="45%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#ecfeff"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#0C7A7C" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#14b8a6" stop-opacity="0.04"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="720" y="-40" width="560" height="560" rx="280" fill="url(#accent)"/>
  <rect x="80" y="198" width="88" height="88" rx="18" fill="#0C7A7C"/>
  <rect x="98" y="248" width="8" height="18" rx="4" fill="#ffffff"/>
  <rect x="112" y="228" width="8" height="48" rx="4" fill="#ffffff"/>
  <rect x="126" y="238" width="8" height="30" rx="4" fill="#ffffff"/>
  <rect x="148" y="238" width="28" height="8" rx="4" fill="#ffffff"/>
  <rect x="148" y="256" width="20" height="8" rx="4" fill="#ffffff"/>
  <text x="188" y="258" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" fill="#26676A">MP3ToText<tspan fill="#26676A">.io</tspan></text>
  <text x="80" y="348" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#0f172a">AI Audio &amp; Video Transcription</text>
  <text x="80" y="410" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#475569">Fast, accurate AI transcription online</text>
  <rect x="80" y="452" width="320" height="56" rx="28" fill="#0C7A7C"/>
  <text x="240" y="489" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#ffffff">Start Transcribing Free</text>
</svg>`;

await mkdir(outputDir, { recursive: true });

await sharp(Buffer.from(svg))
  .resize(1200, 630)
  .png({ compressionLevel: 9 })
  .toFile(outputPath);

const meta = await sharp(outputPath).metadata();
console.log(`Wrote ${outputPath} (${meta.width}x${meta.height})`);
