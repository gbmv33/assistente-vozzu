const sharp = require("sharp");
const path = require("path");
const fs = require("fs");

const ROOT = path.join(__dirname, "..");
const SVG = path.join(ROOT, "build", "icon.svg");
const BUILD = path.join(ROOT, "build");

// Monta um .ico com múltiplos PNGs embutidos (formato Vista+ que suporta PNG nativo)
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const entrySize = 16;
  let offset = headerSize + entrySize * count;

  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type ICO
  header.writeUInt16LE(count, 4);

  const entries = pngBuffers.map((png) => {
    const w = png.readUInt32BE(16);
    const h = png.readUInt32BE(20);
    const entry = Buffer.alloc(16);
    entry.writeUInt8(w >= 256 ? 0 : w, 0);
    entry.writeUInt8(h >= 256 ? 0 : h, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...pngBuffers]);
}

async function main() {
  const svg = fs.readFileSync(SVG);

  const sizes = [16, 32, 48, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const buf = await sharp(svg).resize(size, size).png().toBuffer();
    pngBuffers.push(buf);
    console.log(`✓ ${size}x${size}px`);
  }

  // icon.ico para o instalador / atalho do Windows
  fs.writeFileSync(path.join(BUILD, "icon.ico"), buildIco(pngBuffers));
  console.log("✓ icon.ico");

  // tray.png (16x16) para a bandeja do sistema
  fs.writeFileSync(path.join(BUILD, "tray.png"), pngBuffers[0]);
  console.log("✓ tray.png");

  console.log("\nÍcones prontos em build/");
}

main().catch((e) => { console.error(e); process.exit(1); });
