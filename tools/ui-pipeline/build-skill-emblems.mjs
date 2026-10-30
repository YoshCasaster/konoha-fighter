import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const source = new URL('../../assets/ui/skill-emblems/atlas.png', import.meta.url);
const output = new URL('../../apps/web/public/assets/ui/skill-emblems/', import.meta.url);
const names = [
  'mamang-grrovy-special', 'mamang-grrovy-normal', 'mamang-grrovy-ultimate',
  'king-etanol-special', 'king-etanol-normal', 'king-etanol-ultimate',
];

const { width, height } = await sharp(fileURLToPath(source)).metadata();
if (!width || !height || width % 3 || height % 2 || width / 3 !== height / 2) {
  throw new Error('Skill emblem atlas must be a 3 x 2 grid of square cells.');
}
const size = width / 3;
await mkdir(output, { recursive: true });
await Promise.all(names.map((name, index) => sharp(fileURLToPath(source))
  .extract({ left: (index % 3) * size, top: Math.floor(index / 3) * size, width: size, height: size })
  .resize(192, 192, { kernel: 'nearest' })
  .png({ compressionLevel: 9 })
  .toFile(fileURLToPath(new URL(`${name}.png`, output)))));

async function buildGeneratedEmblem(sheetUrl, index, name, background) {
  const input = fileURLToPath(sheetUrl);
  const info = await sharp(input).metadata();
  const cell = Math.floor(Math.min(info.width / 4, info.height / 2));
  const normalized = await sharp(input).resize(cell * 4, cell * 2, { kernel: 'nearest' }).png().toBuffer();
  const cellImage = await sharp(normalized)
    .extract({ left: index % 4 * cell, top: Math.floor(index / 4) * cell, width: cell, height: cell })
    .png().toBuffer();
  const subject = await sharp(cellImage)
    .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .resize(158, 158, { fit: 'contain', kernel: 'nearest', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const ring = Buffer.from(`<svg width="192" height="192" xmlns="http://www.w3.org/2000/svg"><circle cx="96" cy="96" r="88" fill="${background}" stroke="#ffd477" stroke-width="7"/><circle cx="96" cy="96" r="78" fill="none" stroke="#391628" stroke-width="4"/></svg>`);
  const emblem = await sharp({ create: { width: 192, height: 192, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: ring }, { input: subject, left: 17, top: 17 }])
    .png({ palette: true, colors: 192, dither: 0.65, compressionLevel: 9, effort: 10 }).toBuffer();
  await writeFile(fileURLToPath(new URL(`${name}.png`, output)), emblem);
}

await buildGeneratedEmblem(new URL('../../assets/vfx/black-oil/source/sheet.png', import.meta.url), 4, 'king-etanol-normal', '#160d2c');
await buildGeneratedEmblem(new URL('../../assets/characters/king-etanol/source/robot-tong-sheet.png', import.meta.url), 7, 'king-etanol-ultimate', '#082847');
console.log(`Built ${names.length} skill emblems from ${width}x${height} atlas`);
