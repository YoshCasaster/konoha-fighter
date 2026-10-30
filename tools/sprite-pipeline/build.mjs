import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { normalizePose } from './normalize.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const names = ['idle_0', 'idle_1', 'walk_0', 'walk_1', 'crouch', 'jump_start', 'jump_air', 'land', 'light', 'heavy', 'special', 'hit'];
const extraNames = ['block', 'block_hit', 'knockdown', 'get_up', 'ko', 'victory'];
const stunNames = ['stun_0', 'stun_1'];
const contextNames = ['jump_punch_0', 'jump_punch_1', 'jump_kick_0', 'jump_kick_1', 'crouch_punch_0', 'crouch_punch_1', 'crouch_kick_0', 'crouch_kick_1'];
const defenseNames = ['block_0', 'block_1'];
const robotNames = Array.from({ length: 8 }, (_, index) => `robot_${index}`);
const ids = ['mamang-grrovy', 'king-etanol'];

for (const id of ids) {
  const source = path.join(root, 'assets', 'characters', id, 'source');
  const output = path.join(root, 'apps', 'web', 'public', 'assets', 'characters', id);
  await mkdir(output, { recursive: true });
  for (const [sheetName, columns, rows, frameNames] of [
    ['sheet-main.png', 4, 3, names],
    ['sheet-extra.png', 3, 2, extraNames],
  ]) {
    const input = path.join(source, sheetName);
    const info = await sharp(input).metadata();
    if (!info.hasAlpha || info.width % columns || info.height % rows) throw new Error(`${id}/${sheetName}: invalid alpha or grid`);
    const cellWidth = info.width / columns, cellHeight = info.height / rows;
    if (cellWidth !== cellHeight || cellWidth > 512) throw new Error(`${id}/${sheetName}: expected square cells <=512`);
    for (let index = 0; index < frameNames.length; index++) {
      const frame = await sharp(input).extract({ left: index % columns * cellWidth, top: Math.floor(index / columns) * cellHeight, width: cellWidth, height: cellHeight }).png().toBuffer();
      const canvas = await sharp({ create: { width: 512, height: 512, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([{ input: frame, left: Math.floor((512 - cellWidth) / 2), top: 512 - cellHeight }]).png().toBuffer();
      await writeFile(path.join(output, `${frameNames[index]}.png`), canvas);
    }
  }
  const overrideSpecs = id === 'king-etanol'
    ? { block: [0, 341], block_hit: [1, 341], get_up: [3, 260], victory: [5, 365] }
    : { block: [0, 316], block_hit: [1, 316], victory: [5, 390] };
  const extraV2 = path.join(source, 'sheet-extra-v2.png');
  const overrideInfo = await sharp(extraV2).metadata();
  if (!overrideInfo.hasAlpha || overrideInfo.width !== 1536 || overrideInfo.height !== 1024) throw new Error(`${id}: repaired extra sheet must be 1536x1024 with alpha`);
  const baseline = id === 'king-etanol' ? 500 : 488;
  const qa = {};
  for (const [name, [index, targetHeight]] of Object.entries(overrideSpecs)) {
    const cell = await sharp(extraV2).extract({ left: (index % 3) * 512, top: Math.floor(index / 3) * 512, width: 512, height: 512 }).png().toBuffer();
    const { output: pose, metrics } = await normalizePose(cell, { targetHeight, baseline, isolate: true });
    await writeFile(path.join(output, `${name}.png`), pose); qa[name] = metrics;
  }
  const special = await sharp(path.join(source, 'special-v2.png')).png().toBuffer();
  const { output: specialPose, metrics: specialMetrics } = await normalizePose(special, { targetHeight: id === 'king-etanol' ? 355 : 400, baseline });
  await writeFile(path.join(output, 'special.png'), specialPose); qa.special = specialMetrics;
  const contextSheet = path.join(source, 'context-attacks.png');
  const contextInfo = await sharp(contextSheet).metadata();
  if (!contextInfo.hasAlpha || !contextInfo.width || !contextInfo.height) throw new Error(`${id}: context attack sheet needs alpha`);
  const contextCellWidth = Math.floor(contextInfo.width / 4), contextCellHeight = Math.floor(contextInfo.height / 2);
  for (let index = 0; index < contextNames.length; index++) {
    const left = (index % 4) * contextCellWidth, top = Math.floor(index / 4) * contextCellHeight;
    const width = index % 4 === 3 ? contextInfo.width - left : contextCellWidth;
    const height = index >= 4 ? contextInfo.height - top : contextCellHeight;
    const cell = await sharp(contextSheet).extract({ left, top, width, height }).png().toBuffer();
    const crouching = index >= 4;
    const { output: pose, metrics } = await normalizePose(cell, { targetHeight: crouching ? 285 : 360, baseline: crouching ? 496 : 480, isolate: true });
    await writeFile(path.join(output, `${contextNames[index]}.png`), pose); qa[contextNames[index]] = metrics;
  }
  const stunSheet = path.join(source, 'stun-sheet.png');
  const stunInfo = await sharp(stunSheet).metadata();
  if (!stunInfo.hasAlpha || !stunInfo.width || !stunInfo.height) throw new Error(`${id}: stun sheet needs alpha`);
  const stunCellWidth = Math.floor(stunInfo.width / 2);
  for (let index = 0; index < stunNames.length; index++) {
    const cell = await sharp(stunSheet).extract({ left: index * stunCellWidth, top: 0,
      width: index ? stunInfo.width - stunCellWidth : stunCellWidth, height: stunInfo.height }).png().toBuffer();
    const { output: pose, metrics } = await normalizePose(cell, { targetHeight: id === 'king-etanol' ? 350 : 360, baseline: 496, isolate: true });
    await writeFile(path.join(output, `${stunNames[index]}.png`), pose); qa[stunNames[index]] = metrics;
  }
  const blockBase = await sharp(path.join(output, 'block.png')).png().toBuffer();
  await writeFile(path.join(output, 'block_0.png'), await sharp(blockBase)
    .png({ palette: true, colors: 256, compressionLevel: 9, effort: 10 }).toBuffer());
  await writeFile(path.join(output, 'block_1.png'), await sharp(blockBase)
    .affine([[1, 0], [0, 1]], { idx: 0, idy: -2, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .modulate({ brightness: 1.06 }).png({ palette: true, colors: 256, compressionLevel: 9, effort: 10 }).toBuffer());
  if (id === 'king-etanol') {
    const robotSheet = path.join(source, 'robot-tong-sheet.png'), robotInfo = await sharp(robotSheet).metadata();
    if (!robotInfo.hasAlpha || !robotInfo.width || !robotInfo.height || Math.abs(robotInfo.width / 4 - robotInfo.height / 2) > 1)
      throw new Error('king-etanol: robot sheet must be a transparent 4x2 grid');
    const cellSize = Math.floor(Math.min(robotInfo.width / 4, robotInfo.height / 2));
    const normalized = await sharp(robotSheet).resize(cellSize * 4, cellSize * 2, { kernel: 'nearest' }).png().toBuffer();
    for (let index = 0; index < robotNames.length; index++) {
      const cell = await sharp(normalized).extract({ left: index % 4 * cellSize, top: Math.floor(index / 4) * cellSize, width: cellSize, height: cellSize }).png().toBuffer();
      const { output: pose, metrics } = await normalizePose(cell, { targetHeight: 380, baseline: 496, isolate: true });
      await writeFile(path.join(output, `${robotNames[index]}.png`), await sharp(pose)
        .png({ palette: true, colors: 256, dither: 0.7, compressionLevel: 9, effort: 10 }).toBuffer());
      qa[robotNames[index]] = metrics;
    }
  }
  await writeFile(path.join(output, 'normalization-qa.json'), JSON.stringify(qa, null, 2));
  await writeFile(path.join(output, 'manifest.json'), JSON.stringify({
    id, canvas: [512, 512], origin: [0.5, 1], facing: 'right',
    frames: [...names, ...extraNames, ...contextNames, ...stunNames, ...defenseNames, ...(id === 'king-etanol' ? robotNames : [])],
    sequences: {
      IDLE: ['idle_0', 'idle_1'], WALK_FORWARD: ['walk_0', 'walk_1'], WALK_BACKWARD: ['walk_1', 'walk_0'],
      CROUCH: ['crouch'], JUMP_ASCEND: ['jump_start'], JUMP_FALL: ['jump_air'], LAND: ['land'],
      LIGHT_ATTACK: ['light'], HEAVY_ATTACK: ['heavy'], SPECIAL_ATTACK: ['special'],
      AIR_LIGHT_ATTACK: ['jump_punch_0', 'jump_punch_1'], AIR_HEAVY_ATTACK: ['jump_kick_0', 'jump_kick_1'],
      CROUCH_LIGHT_ATTACK: ['crouch_punch_0', 'crouch_punch_1'], CROUCH_HEAVY_ATTACK: ['crouch_kick_0', 'crouch_kick_1'],
      BLOCK: defenseNames, BLOCK_HIT: ['block_hit'], HIT_STUN: ['hit'], STUN: stunNames,
      ...(id === 'king-etanol' ? { ROBOT_ULTIMATE: robotNames } : {}),
      KNOCKDOWN: ['knockdown'], GET_UP: ['get_up'], KO: ['ko'], ROUND_WIN: ['victory'],
    },
  }, null, 2));
  console.log(`Built ${id}: ${names.length + extraNames.length + contextNames.length + stunNames.length} frames`);
}

// Bot Sawit uses its own 2x2 reaction sheet. Keep each pose in the same canvas.
const botSource = path.join(root, 'assets', 'characters', 'bot-sawit', 'source', 'sheet.png');
const botOutput = path.join(root, 'apps', 'web', 'public', 'assets', 'characters', 'bot-sawit');
const botInfo = await sharp(botSource).metadata();
if (!botInfo.hasAlpha || !botInfo.width || !botInfo.height) throw new Error('bot-sawit: expected transparent sheet');
await mkdir(botOutput, { recursive: true });
const botNames = ['idle', 'hit_right', 'hit_left', 'recover'];
const leftWidth = Math.floor(botInfo.width / 2), topHeight = Math.floor(botInfo.height / 2);
for (let index = 0; index < botNames.length; index++) {
  const left = index % 2 ? leftWidth : 0, top = index < 2 ? 0 : topHeight;
  const width = index % 2 ? botInfo.width - leftWidth : leftWidth;
  const height = index < 2 ? topHeight : botInfo.height - topHeight;
  const cell = await sharp(botSource).extract({ left, top, width, height }).png().toBuffer();
  const pose = await sharp(cell).resize(512, 512, { fit: 'contain', kernel: 'nearest', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  await writeFile(path.join(botOutput, `${botNames[index]}.png`), pose);
}
await writeFile(path.join(botOutput, 'manifest.json'), JSON.stringify({ id: 'bot-sawit', canvas: [512, 512], origin: [0.5, 1], frames: botNames, sequences: { IDLE: ['idle'], HIT_STUN: ['hit_right', 'hit_left'], STUN: ['hit_right', 'hit_left'], RECOVER: ['recover'] } }, null, 2));
console.log('Built bot-sawit: 4 frames');
