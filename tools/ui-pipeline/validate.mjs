import sharp from 'sharp';
import path from 'node:path';
import { stat } from 'node:fs/promises';

const root = path.resolve(import.meta.dirname, '../..');
const folders = ['combat-announcements/ko', 'combat-announcements/vs', 'skill-button', 'mobile-controls/analog', 'mobile-controls/punch', 'mobile-controls/kick', 'mobile-controls/def'];
for (const folder of folders) {
  for (let i = 0; i < 8; i++) {
    const file = path.join(root, 'apps/web/public/assets/ui', folder, `${String(i).padStart(2, '0')}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 512 || info.height !== 512) throw new Error(`${folder}/${i}: expected 512x512`);
    let visible = 0;
    for (let p = 3; p < data.length; p += 4) if (data[p] > 16) visible++;
    if (visible < 100) throw new Error(`${folder}/${i}: frame is empty`);
  }
}
for (const name of ['retro-temple.webp', 'civic-plaza.webp', 'pemilihan-karakter.webp']) {
  const file = path.join(root, 'apps/web/public/assets/stages', name);
  const info = await sharp(file).metadata(), bytes = (await stat(file)).size;
  if (info.width !== 1600 || info.height !== 900) throw new Error(`${name}: expected 1600x900`);
  if (bytes > 400_000) throw new Error(`${name}: compressed background exceeds 400 KB`);
}
for (const [name, width, height] of [['button-strip.webp', 1280, 96], ['panel-strip.webp', 512, 128]]) {
  const info = await sharp(path.join(root, 'apps/web/public/assets/ui/retro-theme', name)).metadata();
  if (info.width !== width || info.height !== height) throw new Error(`${name}: invalid sprite strip canvas`);
}
console.log(`Validated ${folders.length * 8} UI animation frames and compressed retro theme assets`);
