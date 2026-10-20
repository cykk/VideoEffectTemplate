import sharp from "sharp";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const sourceIcon = path.join(rootDir, "apps/web/public/brand/logo-app-icon.png");

const brandWordmark = "MP3ToText.io";
const brandColor = "#26676A";
const iconBackground = "#0C7A7C";
const logoPadding = 32;
const iconSize = 176;
const iconGap = 40;
const wordmarkFontSize = 72;

async function measureWordmarkWidth(text, fontSize, color) {
  const textSvg = `
<svg xmlns="http://www.w3.org/2000/svg">
  <text x="0" y="${fontSize}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="600" fill="${color}">${text}</text>
</svg>`;

  const trimmed = await sharp(Buffer.from(textSvg)).trim({ threshold: 1 }).png().toBuffer();
  const { width = 0 } = await sharp(trimmed).metadata();
  return width;
}

function buildHorizontalLogoSvg({ width, height }) {
  const iconX = logoPadding;
  const iconY = logoPadding;
  const textX = iconX + iconSize + iconGap;
  const textY = iconY + iconSize / 2 + wordmarkFontSize * 0.36;

  return `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${width}" height="${height}" fill="#FFFFFF"/>
  <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="32" fill="${iconBackground}"/>
  <rect x="${iconX + 36}" y="${iconY + 80}" width="16" height="32" rx="8" fill="#FFFFFF"/>
  <rect x="${iconX + 62}" y="${iconY + 52}" width="16" height="88" rx="8" fill="#FFFFFF"/>
  <rect x="${iconX + 88}" y="${iconY + 68}" width="16" height="56" rx="8" fill="#FFFFFF"/>
  <rect x="${iconX + 134}" y="${iconY + 68}" width="48" height="16" rx="8" fill="#FFFFFF"/>
  <rect x="${iconX + 134}" y="${iconY + 104}" width="36" height="16" rx="8" fill="#FFFFFF"/>
  <text x="${textX}" y="${textY}" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="${wordmarkFontSize}" font-weight="600" fill="${brandColor}">${brandWordmark}</text>
</svg>`;
}

const squareLogoSvg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#FFFFFF"/>
  <rect x="192" y="192" width="640" height="640" rx="112" fill="${iconBackground}"/>
  <rect x="320" y="480" width="56" height="112" rx="28" fill="#FFFFFF"/>
  <rect x="412" y="384" width="56" height="304" rx="28" fill="#FFFFFF"/>
  <rect x="504" y="448" width="56" height="176" rx="28" fill="#FFFFFF"/>
  <rect x="664" y="448" width="176" height="56" rx="28" fill="#FFFFFF"/>
  <rect x="664" y="552" width="136" height="56" rx="28" fill="#FFFFFF"/>
  <text x="512" y="920" text-anchor="middle" font-family="Inter, Segoe UI, Arial, sans-serif" font-size="72" font-weight="600" fill="${brandColor}">${brandWordmark}</text>
</svg>
`;

fs.mkdirSync(publicDir, { recursive: true });

const wordmarkWidth = await measureWordmarkWidth(brandWordmark, wordmarkFontSize, brandColor);
const logoWidth = logoPadding + iconSize + iconGap + wordmarkWidth + logoPadding;
const logoHeight = logoPadding + iconSize + logoPadding;
const horizontalLogoSvg = buildHorizontalLogoSvg({
  width: logoWidth,
  height: logoHeight,
});

await sharp(sourceIcon).resize(512, 512).png().toFile(path.join(publicDir, "icon.png"));

const horizontalLogoBuffer = await sharp(Buffer.from(horizontalLogoSvg)).png().toBuffer();
const squareLogoBuffer = await sharp(Buffer.from(squareLogoSvg)).png().toBuffer();
const jpegOptions = { quality: 92, mozjpeg: true };

await sharp(horizontalLogoBuffer).png().toFile(path.join(publicDir, "logo.png"));
await sharp(horizontalLogoBuffer).jpeg(jpegOptions).toFile(path.join(publicDir, "logo.jpg"));

await sharp(squareLogoBuffer).png().toFile(path.join(publicDir, "logo-square.png"));
await sharp(squareLogoBuffer).jpeg(jpegOptions).toFile(path.join(publicDir, "logo-square.jpg"));

console.log("Generated public brand assets:");
console.log("- public/icon.png (512x512)");
console.log("- public/logo.png (" + logoWidth + "x" + logoHeight + ", horizontal wordmark)");
console.log("- public/logo.jpg (same as logo.png, JPEG)");
console.log("- public/logo-square.png (1024x1024, square with wordmark)");
console.log("- public/logo-square.jpg (same as logo-square.png, JPEG)");
