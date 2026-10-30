import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const publicAssets = path.join(root, 'apps', 'web', 'public', 'assets');

for (const [id, sourceId, sheetName] of [
  ['boar-charge', 'boar-charge', 'sheet.png'],
  ['ethanol-flame', 'ethanol-flame', 'sheet.png'],
  ['ethanol-jet', 'ethanol-flame', 'jet-v2.png'],
  ['mamang-shuuu', 'mamang-shuuu', 'sheet.png'],
  ['mamang-angels', 'mamang-angels', 'sheet.png'],
  ['mamang-lightning', 'mamang-lightning', 'sheet.png'],
  ['stun-aura', 'stun-aura', 'sheet.png'],
  ['black-oil', 'black-oil', 'sheet.png'],
  ['robot-laser', 'robot-laser', 'sheet.png'],
]) {
  const source = path.join(root, 'assets', 'vfx', sourceId, 'source', sheetName);
  const output = path.join(publicAssets, 'vfx', id);
  await mkdir(output, { recursive: true });
  const info = await sharp(source).metadata();
  if (!info.hasAlpha || Math.abs(info.width / 4 - info.height / 2) > 1) throw new Error(`${id}: sheet must be transparent 4x2 square cells`);
  // Generated sheets may be an odd pixel wide; normalize once before slicing.
  const cellSize = Math.floor(Math.min(info.width / 4, info.height / 2));
  if (cellSize > 512) throw new Error(`${id}: cell size must not exceed 512px`);
  const normalized = await sharp(source).resize(cellSize * 4, cellSize * 2, { kernel: 'nearest' }).png().toBuffer();
  for (let i = 0; i < 8; i++) {
    const cell = await sharp(normalized).extract({ left: (i % 4) * cellSize, top: Math.floor(i / 4) * cellSize, width: cellSize, height: cellSize }).png().toBuffer();
    const frame = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: cell, left: Math.floor((512 - cellSize) / 2), top: 512 - cellSize }])
      .png({ palette: true, colors: 256, dither: 0.7, compressionLevel: 9, effort: 10 }).toBuffer();
    await writeFile(path.join(output, `${String(i).padStart(2, '0')}.png`), frame);
  }
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ id, canvas: [512, 512], frames: 8, origin: [0.5, 1], facing: 'right' }, null, 2));
  console.log(`Built ${id}: 8 frames`);
}

const logoSource = path.join(root, 'assets', 'ui', 'source', 'konoha-fighter-logo.png');
const logoOutput = path.join(publicAssets, 'ui', 'logo');
await mkdir(logoOutput, { recursive: true });
const logoInfo = await sharp(logoSource).metadata();
if (!logoInfo.hasAlpha) throw new Error('Logo source must have transparent alpha');
const scales = [0.12, 0.24, 0.42, 0.68, 1.17, 0.93, 1.05, 0.99, 1, 1];
for (let i = 0; i < scales.length; i++) {
  const width = Math.round(780 * scales[i]), height = Math.round(width * logoInfo.height / logoInfo.width);
  const logo = await sharp(logoSource).resize(width, height, { fit: 'fill', kernel: 'lanczos3' }).png().toBuffer();
  const streaks = i >= 2 && i <= 6 ? Buffer.from(`<svg width="960" height="540" xmlns="http://www.w3.org/2000/svg"><g stroke="#ffbe27" stroke-width="${i === 4 ? 10 : 5}" opacity="${i === 4 ? 0.7 : 0.35}"><path d="M0 70 L330 245 M960 60 L625 250 M0 480 L330 285 M960 490 L625 295"/></g><g stroke="#f23c2b" stroke-width="4" opacity="0.6"><path d="M60 150 L330 260 M900 120 L630 260 M60 390 L330 285 M900 410 L630 285"/></g></svg>`) : null;
  const layers = [];
  if (streaks) layers.push({ input: streaks, left: 0, top: 0 });
  layers.push({ input: logo, left: Math.floor((960 - width) / 2), top: Math.floor((540 - height) / 2) });
  const frame = await sharp({ create: { width: 960, height: 540, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite(layers)
    .png({ palette: true, colors: 256, dither: 0.7, compressionLevel: 9, effort: 10 }).toBuffer();
  await writeFile(path.join(logoOutput, `intro_${String(i).padStart(2, '0')}.png`), frame);
}
console.log('Built Konoha Fighter logo intro: 10 frames');
