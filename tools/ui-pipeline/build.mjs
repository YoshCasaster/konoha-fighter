import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const sheets = [
  { input: 'assets/ui/combat-announcements/source/ko-sheet.png', output: 'apps/web/public/assets/ui/combat-announcements/ko', prefix: 'ko' },
  { input: 'assets/ui/combat-announcements/source/vs-sheet.png', output: 'apps/web/public/assets/ui/combat-announcements/vs', prefix: 'vs' },
  { input: 'assets/ui/skill-button/source/charge-sheet.png', output: 'apps/web/public/assets/ui/skill-button', prefix: 'charge' },
  { input: 'assets/ui/mobile-controls/source/analog-sheet.png', output: 'apps/web/public/assets/ui/mobile-controls/analog', prefix: 'analog' },
  { input: 'assets/ui/mobile-controls/source/punch-sheet.png', output: 'apps/web/public/assets/ui/mobile-controls/punch', prefix: 'punch' },
  { input: 'assets/ui/mobile-controls/source/kick-sheet.png', output: 'apps/web/public/assets/ui/mobile-controls/kick', prefix: 'kick' },
  { input: 'assets/ui/mobile-controls/source/def-sheet.png', output: 'apps/web/public/assets/ui/mobile-controls/def', prefix: 'def' },
];

for (const spec of sheets) {
  const input = path.join(root, spec.input), output = path.join(root, spec.output);
  const info = await sharp(input).metadata();
  if (!info.width || !info.height || !info.hasAlpha) throw new Error(`${spec.input}: expected transparent image`);
  await mkdir(output, { recursive: true });
  const cellWidth = Math.floor(info.width / 4), cellHeight = Math.floor(info.height / 2);
  for (let i = 0; i < 8; i++) {
    const left = (i % 4) * cellWidth, top = Math.floor(i / 4) * cellHeight;
    const width = i % 4 === 3 ? info.width - left : cellWidth;
    const height = i >= 4 ? info.height - top : cellHeight;
    const frame = await sharp(input).extract({ left, top, width, height })
      .resize(512, 512, { fit: 'contain', kernel: 'nearest', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ palette: true, colors: 256, dither: 0.7, compressionLevel: 9, effort: 10 }).toBuffer();
    await writeFile(path.join(output, `${String(i).padStart(2, '0')}.png`), frame);
  }
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ frames: 8, canvas: [512, 512], fps: 12, loop: !['ko', 'vs'].includes(spec.prefix) }, null, 2));
  console.log(`Built ${spec.prefix}: 8 frames`);
}
