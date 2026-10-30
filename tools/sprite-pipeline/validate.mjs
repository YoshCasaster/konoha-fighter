import sharp from 'sharp';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const specs = {
  'king-etanol': { get_up: 260, special: 355, victory: 365, block: 341, block_hit: 341 },
  'mamang-grrovy': { block_hit: 316, block: 316, special: 400, victory: 390 },
};
for (const [id, poses] of Object.entries(specs)) {
  for (const [pose, expectedHeight] of Object.entries(poses)) {
    const file = path.join(root, 'apps', 'web', 'public', 'assets', 'characters', id, `${pose}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 512 || info.height !== 512) throw new Error(`${id}/${pose}: canvas must be 512x512`);
    let minY = 512, maxY = -1;
    for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) {
      if (data[(y * 512 + x) * 4 + 3] <= 16) continue;
      if (x < 8 || x >= 504 || y < 8 || y >= 504) throw new Error(`${id}/${pose}: opaque pixels too close to canvas edge`);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const height = maxY - minY + 1;
    if (Math.abs(height - expectedHeight) > 3) throw new Error(`${id}/${pose}: height ${height}, expected ${expectedHeight}`);
  }
}
console.log('Validated 9 repaired poses: canvas, scale, and transparent safety margin');
for (const pose of ['idle', 'hit_right', 'hit_left', 'recover']) {
  const file = path.join(root, 'apps', 'web', 'public', 'assets', 'characters', 'bot-sawit', `${pose}.png`);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  if (info.width !== 512 || info.height !== 512) throw new Error(`bot-sawit/${pose}: canvas must be 512x512`);
  let visible = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] > 16) visible++;
  if (visible < 10000) throw new Error(`bot-sawit/${pose}: missing or nearly empty sprite`);
}
console.log('Validated 4 Bot Sawit poses');
for (const id of ['mamang-grrovy', 'king-etanol']) {
  for (const pose of ['jump_punch_0', 'jump_punch_1', 'jump_kick_0', 'jump_kick_1', 'crouch_punch_0', 'crouch_punch_1', 'crouch_kick_0', 'crouch_kick_1', 'stun_0', 'stun_1']) {
    const file = path.join(root, 'apps', 'web', 'public', 'assets', 'characters', id, `${pose}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 512 || info.height !== 512) throw new Error(`${id}/${pose}: canvas must be 512x512`);
    let visible = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 16) visible++;
    if (visible < 3000) throw new Error(`${id}/${pose}: missing or nearly empty sprite`);
  }
}
console.log('Validated 20 contextual attack and stun poses');
for (const id of ['mamang-grrovy', 'king-etanol']) {
  const poses = ['block_0', 'block_1', ...(id === 'king-etanol' ? Array.from({ length: 8 }, (_, i) => `robot_${i}`) : [])];
  for (const pose of poses) {
    const file = path.join(root, 'apps', 'web', 'public', 'assets', 'characters', id, `${pose}.png`);
    const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (info.width !== 512 || info.height !== 512) throw new Error(`${id}/${pose}: canvas must be 512x512`);
    let visible = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] > 16) visible++;
    if (visible < 3000) throw new Error(`${id}/${pose}: missing or nearly empty sprite`);
  }
}
console.log('Validated 12 defense and Robot Tong character frames');
