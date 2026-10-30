import test from 'node:test';
import assert from 'node:assert/strict';
import { RULES, NEUTRAL_INPUT, createWorld, createTrainingWorld, stepWorld, hitbox, type Input } from './index.ts';

const ready = () => { const world = createWorld(); world.phase = 'fight' as const; world.phaseFrames = 0; return world; };
const light: Input = { ...NEUTRAL_INPUT, light: true };

test('fixed ticks give the same outcome for the same input sequence', () => {
  const a = ready(), b = ready();
  for (let i = 0; i < 240; i++) {
    const inputs: [Input, Input] = [i < 40 ? { ...NEUTRAL_INPUT, right: true } : i === 41 ? light : NEUTRAL_INPUT,
      i < 40 ? { ...NEUTRAL_INPUT, left: true } : NEUTRAL_INPUT];
    stepWorld(a, inputs); stepWorld(b, inputs);
  }
  assert.deepEqual(a, b);
  assert.equal(a.tick, 240);
  assert.equal(a.timeFrames, RULES.roundSeconds * RULES.hz - 240);
});

test('attack hits only in active frames and once per activation', () => {
  const world = ready(); world.fighters[0].x = 420; world.fighters[1].x = 475;
  stepWorld(world, [light, NEUTRAL_INPUT]);
  assert.equal(hitbox(world.fighters[0]), null);
  for (let i = 0; i < 6; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.fighters[1].hp, 151);
  for (let i = 0; i < 10; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.fighters[1].hp, 151);
});

test('block prevents damage', () => {
  const world = ready(); world.fighters[0].x = 420; world.fighters[1].x = 475;
  const block: Input = { ...NEUTRAL_INPUT, block: true };
  for (let i = 0; i < 8; i++) stepWorld(world, [i === 0 ? light : NEUTRAL_INPUT, block]);
  assert.equal(world.fighters[1].hp, RULES.maxHp);
});

test('KO produces round result and two wins end match', () => {
  const world = ready(); world.fighters[0].x = 420; world.fighters[1].x = 475;
  world.fighters[1].hp = 7;
  for (let i = 0; i < 8; i++) stepWorld(world, [i === 0 ? light : NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.phase, 'roundEnd'); assert.equal(world.fighters[0].wins, 1);
  for (let i = 0; i < RULES.roundPauseFrames + 180; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.phase, 'fight');
  world.fighters[0].x = 420; world.fighters[1].x = 475; world.fighters[1].hp = 7;
  for (let i = 0; i < 8; i++) stepWorld(world, [i === 0 ? light : NEUTRAL_INPUT, NEUTRAL_INPUT]);
  for (let i = 0; i < RULES.roundPauseFrames; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.phase, 'matchEnd'); assert.equal(world.winner, 0);
});

test('Mamang basic spends energy, spawns six charging boars, and knocks down', () => {
  const world = ready(); world.fighters[0].x = 300; world.fighters[1].x = 530;
  stepWorld(world, [{ ...NEUTRAL_INPUT, special: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].energy, 0);
  assert.equal(world.fighters[0].state, 'IDLE');
  world.fighters[0].energy = 30;
  stepWorld(world, [{ ...NEUTRAL_INPUT, special: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].energy, 0);
  assert.ok(world.fighters[0].cooldowns.special > 0);
  const spawned = new Set<number>();
  let knockedDown = false;
  for (let i = 0; i < 80; i++) {
    stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
    world.effects.forEach(effect => spawned.add(effect.id));
    if (world.fighters[1].state === 'KNOCKDOWN') knockedDown = true;
  }
  assert.equal(spawned.size, 6);
  assert.equal(world.fighters[1].hp, 136);
  assert.equal(knockedDown, true);
});

test('King barrel flame hits repeatedly without exceeding three hits', () => {
  const world = ready(); world.fighters[0].x = 540; world.fighters[1].x = 400;
  world.fighters[1].energy = 30;
  stepWorld(world, [NEUTRAL_INPUT, { ...NEUTRAL_INPUT, special: true }]);
  let flameSeen = false;
  for (let i = 0; i < 80; i++) {
    stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
    flameSeen ||= world.effects.some(effect => effect.kind === 'flame');
  }
  assert.equal(flameSeen, true);
  assert.equal(world.fighters[0].hp, 145);
});

test('extended ethanol jet reaches a target about 300 pixels beyond the barrel', () => {
  const world = ready(); world.fighters[0].x = 580; world.fighters[1].x = 200;
  world.fighters[1].energy = 30;
  stepWorld(world, [NEUTRAL_INPUT, { ...NEUTRAL_INPUT, special: true }]);
  for (let i = 0; i < 80; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.ok(world.fighters[0].hp < RULES.maxHp);
});

test('extended ethanol jet mirrors correctly when King faces left', () => {
  const world = ready(); world.fighters[0].x = 300; world.fighters[1].x = 700;
  world.fighters[1].energy = 30;
  stepWorld(world, [NEUTRAL_INPUT, { ...NEUTRAL_INPUT, special: true }]);
  for (let i = 0; i < 80; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.ok(world.fighters[0].hp < RULES.maxHp);
});

test('normal and ultimate have separate energy costs and cooldowns', () => {
  const world = ready(); world.fighters[0].energy = 100;
  stepWorld(world, [{ ...NEUTRAL_INPUT, normal: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].energy, 45);
  assert.ok(world.fighters[0].cooldowns.normal > 0);
  for (let i = 0; i < 60; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  stepWorld(world, [{ ...NEUTRAL_INPUT, ultimate: true }, NEUTRAL_INPUT]);
  assert.notEqual(world.fighters[0].attack, 'ultimate');
  world.fighters[0].energy = 100;
  stepWorld(world, [{ ...NEUTRAL_INPUT, ultimate: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].energy, 0);
  assert.ok(world.fighters[0].cooldowns.ultimate > 0);
});

test('cooldown prevents another basic even with enough energy', () => {
  const world = ready(); world.fighters[0].energy = 100;
  stepWorld(world, [{ ...NEUTRAL_INPUT, special: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].energy, 70);
  for (let i = 0; i < 75; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].state, 'IDLE');
  stepWorld(world, [{ ...NEUTRAL_INPUT, special: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].energy, 70);
  assert.equal(world.fighters[0].attack, null);
});

test('holding block prevents flame damage', () => {
  const world = ready(); world.fighters[0].x = 540; world.fighters[1].x = 400;
  world.fighters[1].energy = 30;
  const block: Input = { ...NEUTRAL_INPUT, block: true };
  stepWorld(world, [block, { ...NEUTRAL_INPUT, special: true }]);
  for (let i = 0; i < 80; i++) stepWorld(world, [block, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].hp, RULES.maxHp);
});

test('skill effects remain deterministic from identical tick inputs', () => {
  const a = ready(), b = ready();
  for (const world of [a, b]) { world.fighters[0].x = 300; world.fighters[1].x = 530; world.fighters[0].energy = 30; }
  for (let i = 0; i < 90; i++) {
    const inputs: [Input, Input] = [i === 0 ? { ...NEUTRAL_INPUT, special: true } : NEUTRAL_INPUT, NEUTRAL_INPUT];
    stepWorld(a, inputs); stepWorld(b, inputs);
  }
  assert.deepEqual(a, b);
});

test('training bot reacts to strikes without losing HP or ending the session', () => {
  const world = createTrainingWorld();
  world.fighters[0].x = 620;
  for (let i = 0; i < 8; i++) stepWorld(world, [i === 0 ? light : NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.fighters[1].state, 'HIT_STUN');
  assert.equal(world.fighters[1].hp, RULES.maxHp);
  for (let i = 0; i < RULES.hz * 70; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.phase, 'fight');
  assert.equal(world.fighters[1].state, 'IDLE');
  assert.equal(world.fighters[0].hp, RULES.maxHp);
  assert.equal(world.timeFrames, RULES.roundSeconds * RULES.hz);
});

test('training grants full energy and skips cooldown for all three skills', () => {
  const world = createTrainingWorld('king-etanol');
  for (const key of ['special', 'normal', 'ultimate'] as const) {
    stepWorld(world, [{ ...NEUTRAL_INPUT, [key]: true }, NEUTRAL_INPUT]);
    assert.equal(world.fighters[0].attack, key);
    assert.equal(world.fighters[0].energy, RULES.maxEnergy);
    assert.equal(world.fighters[0].cooldowns[key], 0);
    for (let i = 0; i < 100; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  }
});

test('punch can start in the air and keeps jump physics active', () => {
  const world = ready(); world.fighters[0].x = 420; world.fighters[1].x = 475;
  stepWorld(world, [{ ...NEUTRAL_INPUT, jump: true }, NEUTRAL_INPUT]);
  stepWorld(world, [{ ...NEUTRAL_INPUT, light: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].state, 'AIR_LIGHT_ATTACK');
  const startY = world.fighters[0].y;
  for (let i = 0; i < 7; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.notEqual(world.fighters[0].y, startY);
  assert.ok(world.fighters[1].hp < RULES.maxHp);
});

test('kick can start while crouching and uses the low attack state', () => {
  const world = ready(); world.fighters[0].x = 420; world.fighters[1].x = 485;
  stepWorld(world, [{ ...NEUTRAL_INPUT, crouch: true, heavy: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].state, 'CROUCH_HEAVY_ATTACK');
  for (let i = 0; i < 14; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.ok(world.fighters[1].hp < RULES.maxHp);
});

test('Mamang normal fires across the arena and stuns for one second on impact', () => {
  const world = ready(); world.fighters[0].x = 100; world.fighters[1].x = 800; world.fighters[0].energy = 55;
  stepWorld(world, [{ ...NEUTRAL_INPUT, normal: true }, NEUTRAL_INPUT]);
  let shotSeen = false;
  for (let i = 0; i < 100 && world.fighters[1].state !== 'STUN'; i++) {
    stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
    shotSeen ||= world.effects.some(effect => effect.kind === 'shuuu');
  }
  assert.equal(shotSeen, true);
  assert.equal(world.fighters[1].state, 'STUN');
  assert.equal(world.fighters[1].stunFrames, 60);
  const x = world.fighters[1].x;
  for (let i = 0; i < 40; i++) stepWorld(world, [NEUTRAL_INPUT, { ...NEUTRAL_INPUT, left: true, light: true }]);
  assert.equal(world.fighters[1].x, x);
  assert.equal(world.fighters[1].state, 'STUN');
  for (let i = 0; i < 20; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.notEqual(world.fighters[1].state, 'STUN');
});

test('Mamang ultimate locks target, summons one five-angel effect, then strikes once', () => {
  const world = ready(); world.fighters[0].x = 100; world.fighters[1].x = 800; world.fighters[0].energy = 100;
  stepWorld(world, [{ ...NEUTRAL_INPUT, ultimate: true }, NEUTRAL_INPUT]);
  assert.equal(world.effects.filter(effect => effect.kind === 'angels').length, 1);
  assert.equal(world.fighters[1].state, 'STUN');
  for (let i = 0; i < 30; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.effects.filter(effect => effect.kind === 'angels').length, 1);
  assert.equal(world.fighters[1].state, 'STUN');
  const x = world.fighters[1].x;
  for (let i = 0; i < 80; i++) stepWorld(world, [NEUTRAL_INPUT, { ...NEUTRAL_INPUT, left: true, jump: true }]);
  assert.equal(world.fighters[1].x, x);
  assert.equal(world.fighters[1].hp, 118);
});

test('Mamang chains punch, punch, kick into a stronger third hit', () => {
  const world = ready(); world.fighters[0].x = 420; world.fighters[1].x = 485;
  stepWorld(world, [{ ...NEUTRAL_INPUT, light: true }, NEUTRAL_INPUT]);
  for (let i = 0; i < 8; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  stepWorld(world, [{ ...NEUTRAL_INPUT, light: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].comboStep, 2);
  for (let i = 0; i < 8; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  stepWorld(world, [{ ...NEUTRAL_INPUT, heavy: true }, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].comboStep, 3);
  assert.equal(world.fighters[0].state, 'HEAVY_ATTACK');
  for (let i = 0; i < 12; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.ok(world.fighters[1].hp <= 116);
});

test('Mamang shot can be blocked before impact', () => {
  const world = ready(); world.fighters[0].x = 100; world.fighters[1].x = 700; world.fighters[0].energy = 55;
  stepWorld(world, [{ ...NEUTRAL_INPUT, normal: true }, { ...NEUTRAL_INPUT, block: true }]);
  for (let i = 0; i < 70; i++) stepWorld(world, [NEUTRAL_INPUT, { ...NEUTRAL_INPUT, block: true }]);
  assert.equal(world.fighters[1].hp, RULES.maxHp);
  assert.notEqual(world.fighters[1].state, 'STUN');
});

test('training dummy shows the full stun reaction but never loses HP', () => {
  const world = createTrainingWorld(); world.fighters[0].x = 100;
  stepWorld(world, [{ ...NEUTRAL_INPUT, normal: true }, NEUTRAL_INPUT]);
  for (let i = 0; i < 70 && world.fighters[1].state !== 'STUN'; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.fighters[1].state, 'STUN');
  assert.equal(world.fighters[1].stunFrames, 60);
  assert.equal(world.fighters[1].hp, RULES.maxHp);
  for (let i = 0; i < 60; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.fighters[1].state, 'IDLE');
});

test('a follow-up hit cannot shorten Mamang shot stun', () => {
  const world = ready(); world.fighters[0].x = 100; world.fighters[1].x = 700; world.fighters[0].energy = 55;
  stepWorld(world, [{ ...NEUTRAL_INPUT, normal: true }, NEUTRAL_INPUT]);
  for (let i = 0; i < 70 && world.fighters[1].state !== 'STUN'; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.fighters[1].state, 'STUN');
  for (let i = 0; i < 12; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  world.fighters[0].x = 640; world.fighters[1].x = 695;
  const hpBefore = world.fighters[1].hp;
  stepWorld(world, [{ ...NEUTRAL_INPUT, light: true }, NEUTRAL_INPUT]);
  for (let i = 0; i < 7; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.ok(world.fighters[1].hp < hpBefore);
  assert.equal(world.fighters[1].state, 'STUN');
  assert.ok(world.fighters[1].stunFrames - world.fighters[1].stateFrame > 30);
});

test('King Black Oil roots once, then leaves the opponent slowed', () => {
  const world = ready(); world.fighters[0].x = 200; world.fighters[1].x = 700; world.fighters[1].energy = 55;
  stepWorld(world, [NEUTRAL_INPUT, { ...NEUTRAL_INPUT, normal: true }]);
  let oilSeen = false;
  for (let i = 0; i < 90 && world.fighters[0].state !== 'STUN'; i++) {
    stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
    oilSeen ||= world.effects.some(effect => effect.kind === 'black-oil');
  }
  assert.equal(oilSeen, true);
  assert.equal(world.fighters[0].hp, RULES.maxHp - 14);
  assert.equal(world.fighters[0].rootFrames, 36);
  assert.equal(world.fighters[0].slowFrames, 180);
  for (let i = 0; i < 36; i++) stepWorld(world, [NEUTRAL_INPUT, NEUTRAL_INPUT]);
  assert.equal(world.fighters[0].state, 'IDLE');
  const start = world.fighters[0].x;
  for (let i = 0; i < 30; i++) stepWorld(world, [{ ...NEUTRAL_INPUT, right: true }, NEUTRAL_INPUT]);
  assert.ok(world.fighters[0].x - start < RULES.walkSpeed * 0.6 * 30);
});

test('King Robot Tong laser ignores DEF and knocks the opponent down', () => {
  const world = ready(); world.fighters[0].x = 300; world.fighters[1].x = 700; world.fighters[1].energy = 100;
  const defend = { ...NEUTRAL_INPUT, block: true };
  stepWorld(world, [defend, { ...NEUTRAL_INPUT, ultimate: true }]);
  let laserSeen = false;
  for (let i = 0; i < 100 && world.fighters[0].hp === RULES.maxHp; i++) {
    stepWorld(world, [defend, NEUTRAL_INPUT]);
    laserSeen ||= world.effects.some(effect => effect.kind === 'robot-laser');
  }
  assert.equal(laserSeen, true);
  assert.equal(world.fighters[0].hp, RULES.maxHp - 40);
  assert.equal(world.fighters[0].state, 'KNOCKDOWN');
});

test('competitive balance uses thicker health and distinct skill tiers', () => {
  const world = ready();
  assert.equal(RULES.maxHp, 160);
  assert.equal(world.fighters[0].hp, 160);
  assert.deepEqual(Object.values(world.fighters[0].cooldowns), [0, 0, 0]);
});
