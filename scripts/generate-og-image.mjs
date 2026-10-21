import sharp from "sharp";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const web = path.join(root, "apps/web");
const dictionary = JSON.parse(await readFile(path.join(root, "packages/shared/src/i18n/locales/en.json"), "utf8"));
const brand = dictionary.component.layout.header.brand.identity.primary_name;
const description = dictionary.page.marketing.landing.metadata.description;
const escapeXml = (value) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;",
})[character]);
const mark = '<rect x="3" y="3" width="9" height="9" rx="2" fill="white"/><rect x="16" y="3" width="9" height="9" rx="2" fill="white" opacity=".6"/><rect x="3" y="16" width="9" height="9" rx="2" fill="white" opacity=".6"/><rect x="16" y="16" width="9" height="9" rx="2" fill="white"/>';
const icon = `<svg width="512" height="512" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg"><rect width="28" height="28" rx="6" fill="#0C7A7C"/>${mark}</svg>`;
const og = `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#f7faf9"/>
  <rect x="72" y="75" width="1056" height="480" rx="20" fill="#ffffff" stroke="#dbe5e3" stroke-width="2"/>
  <svg x="128" y="166" width="88" height="88" viewBox="0 0 28 28"><rect width="28" height="28" rx="6" fill="#0C7A7C"/>${mark}</svg>
  <text x="244" y="225" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#153c3b">${escapeXml(brand)}</text>
  <text x="128" y="370" font-family="Arial, sans-serif" font-size="23" fill="#475569">${escapeXml(description)}</text>
</svg>`;

await mkdir(path.join(web, "public"), { recursive: true });
const iconPng = await sharp(Buffer.from(icon)).resize(512, 512).png().toBuffer();
await writeFile(path.join(web, "src/app/icon.png"), iconPng);
await sharp(Buffer.from(icon)).resize(180, 180).png().toFile(path.join(web, "src/app/apple-icon.png"));
await sharp(Buffer.from(og)).png().toFile(path.join(web, "public/og-image.png"));

const faviconPng = await sharp(Buffer.from(icon)).resize(48, 48).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header[6] = 48;
header[7] = 48;
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(faviconPng.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(path.join(web, "src/app/favicon.ico"), Buffer.concat([header, faviconPng]));
