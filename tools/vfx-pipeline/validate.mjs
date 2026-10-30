import sharp from 'sharp';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const folders = ['boar-charge', 'ethanol-flame', 'ethanol-jet', 'mamang-shuuu', 'mamang-angels', 'mamang-lightning', 'stun-aura', 'black-oil', 'robot-laser'];
for (const folder of folders) {
  for (let frame = 0; frame < 8; frame++) {
    const file = path.join(root, 'apps/web/public/assets/vfx', folder, `${String(frame).padStart(2, '0')}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 512 || info.height !== 512) throw new Error(`${folder}/${frame}: expected 512x512`);
    let visible = 0;
    for (let pixel = 3; pixel < data.length; pixel += 4) if (data[pixel] > 16) visible++;
    if (visible < 1000) throw new Error(`${folder}/${frame}: empty or incomplete sprite`);
  }
}
console.log(`Validated ${folders.length * 8} VFX frames`);
