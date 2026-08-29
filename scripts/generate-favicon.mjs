import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dir = path.join(__dirname, "..", "src", "public", "images");

const SIZE = 512;
const SCALE = 4;
const S = SIZE * SCALE;
const CX = S / 2;
const CY = S / 2;
const MARGIN = 0.24 * S;
const RO = S / 2 - MARGIN;
const RI = RO * 0.4;
const HALF_OPEN = (52 * Math.PI) / 180;
const OX = S * 0.035;

const buf = Buffer.alloc(S * S * 3, 255);
for (let y = 0; y < S; y++) {
  for (let x = 0; x < S; x++) {
    const dx = x + 0.5 - CX - OX;
    const dy = y + 0.5 - CY;
    const r = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    if (r >= RI && r <= RO && Math.abs(ang) > HALF_OPEN) {
      const i = (y * S + x) * 3;
      buf[i] = 0xa0;
      buf[i + 1] = 0x20;
      buf[i + 2] = 0x30;
    }
  }
}

const square = await sharp(buf, { raw: { width: S, height: S, channels: 3 } })
  .resize(SIZE, SIZE, { kernel: "lanczos3" })
  .png()
  .toBuffer();

await sharp(square).jpeg({ quality: 95 }).toFile(path.join(dir, "favicon.jpg"));
await sharp(square).resize(32, 32).png().toFile(path.join(dir, "favicon.png"));
await sharp(square).resize(48, 48).png().toFile(path.join(dir, "favicon-48.png"));
await sharp(square).resize(180, 180).png().toFile(path.join(dir, "apple-touch-icon.png"));
fs.writeFileSync(path.join(dir, "favicon-512.png"), square);

const svgPath = path.join(dir, "favicon.svg");
if (fs.existsSync(svgPath)) fs.unlinkSync(svgPath);

console.log("Favicon regenerated (~24% padding)");
