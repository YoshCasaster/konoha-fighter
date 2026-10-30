import sharp from 'sharp';
import path from 'node:path';
import { readdir, stat } from 'node:fs/promises';

const root = path.resolve(import.meta.dirname, '../../apps/web/public/assets/ui');
async function files(folder) {
  const result = [];
  for (const name of await readdir(folder)) {
    const file = path.join(folder, name), info = await stat(file);
    if (info.isDirectory()) result.push(...await files(file));
    else if (name.endsWith('.png')) result.push(file);
  }
  return result;
}
const pngs = await files(root);
let before = 0, after = 0;
for (const file of pngs) {
  const old = await stat(file); before += old.size;
  const temp = `${file}.optimized`;
  await sharp(file).png({ palette: true, colors: 256, dither: 0.7, compressionLevel: 9, effort: 10 }).toFile(temp);
  const fresh = await stat(temp);
  if (fresh.size < old.size) {
    const { rename, rm } = await import('node:fs/promises');
    await rm(file); await rename(temp, file); after += fresh.size;
  } else {
    const { rm } = await import('node:fs/promises');
    await rm(temp); after += old.size;
  }
}
console.log(`Optimized ${pngs.length} public UI PNGs: ${(before / 1048576).toFixed(2)} MB -> ${(after / 1048576).toFixed(2)} MB`);
