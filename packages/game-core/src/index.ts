// Temporary prototype balance values. Keep simulation values in one place.
export const RULES = {
  hz: 60, arenaWidth: 960, floorY: 470, maxHp: 160, roundSeconds: 75,
  roundsToWin: 2, walkSpeed: 3.5, jumpSpeed: 12, gravity: 0.58,
  bodyWidth: 46, bodyHeight: 108, crouchHeight: 67, maxEnergy: 100,
  roundPauseFrames: 120,
} as const;

export type FighterState = 'IDLE' | 'WALK_FORWARD' | 'WALK_BACKWARD' | 'CROUCH' |
  'JUMP_ASCEND' | 'JUMP_FALL' | 'LIGHT_ATTACK' | 'HEAVY_ATTACK' |
  'AIR_LIGHT_ATTACK' | 'AIR_HEAVY_ATTACK' | 'CROUCH_LIGHT_ATTACK' | 'CROUCH_HEAVY_ATTACK' |
  'SPECIAL_ATTACK' | 'BLOCK' | 'BLOCK_HIT' | 'HIT_STUN' | 'STUN' |
  'KNOCKDOWN' | 'GET_UP' | 'KO' | 'ROUND_WIN';
export type SkillKey = 'special' | 'normal' | 'ultimate';
export type AttackKey = 'light' | 'heavy' | SkillKey;
export type Input = { left: boolean; right: boolean; jump: boolean; crouch: boolean; block: boolean; light: boolean; heavy: boolean; special: boolean; normal: boolean; ultimate: boolean };
export const NEUTRAL_INPUT: Input = { left: false, right: false, jump: false, crouch: false, block: false, light: false, heavy: false, special: false, normal: false, ultimate: false };

export type Attack = { startup: number; active: number; recovery: number; damage: number; range: number; height: number; hitStun: number; blockStun: number; knockback: number; energyGain: number; energyCost: number; cooldownFrames: number; effect?: 'boar' | 'flame' | 'black-oil' | 'robot-laser' };
export type Character = { id: string; name: string; title: string; color: number; accent: number; attacks: Record<AttackKey, Attack> };
const commonAttacks: Record<AttackKey, Attack> = {
  light: { startup: 5, active: 3, recovery: 9, damage: 9, range: 64, height: 42, hitStun: 13, blockStun: 7, knockback: 18, energyGain: 9, energyCost: 0, cooldownFrames: 0 },
  heavy: { startup: 11, active: 4, recovery: 17, damage: 18, range: 78, height: 52, hitStun: 19, blockStun: 10, knockback: 34, energyGain: 14, energyCost: 0, cooldownFrames: 0 },
  special: { startup: 16, active: 36, recovery: 18, damage: 4, range: 0, height: 0, hitStun: 18, blockStun: 9, knockback: 22, energyGain: 0, energyCost: 30, cooldownFrames: 300, effect: 'boar' },
  normal: { startup: 16, active: 8, recovery: 30, damage: 22, range: 128, height: 85, hitStun: 30, blockStun: 16, knockback: 72, energyGain: 0, energyCost: 55, cooldownFrames: 540 },
  ultimate: { startup: 25, active: 12, recovery: 42, damage: 42, range: 180, height: 110, hitStun: 42, blockStun: 21, knockback: 112, energyGain: 0, energyCost: 100, cooldownFrames: 1080 },
};
export const CHARACTERS: Character[] = [
  { id: 'mamang-grrovy', name: 'MAMANG GRROVY', title: 'SANG LEGENDA TONGKAT', color: 0xe87562, accent: 0xffd69d, attacks: commonAttacks },
  { id: 'king-etanol', name: 'KING ETANOL', title: 'RAJA PUKULAN', color: 0x6cbbf5, accent: 0xccefff, attacks: {
    light: { ...commonAttacks.light, startup: 4, damage: 8 },
    heavy: { ...commonAttacks.heavy, damage: 20, recovery: 20 },
    special: { ...commonAttacks.special, effect: 'flame', startup: 18, damage: 5, knockback: 14 },
    normal: { ...commonAttacks.normal, effect: 'black-oil', damage: 14, startup: 20, active: 16, recovery: 34 },
    ultimate: { ...commonAttacks.ultimate, effect: 'robot-laser', damage: 40, startup: 34, active: 10, recovery: 52 },
  } },
];
export const TRAINING_DUMMY: Character = { id: 'bot-sawit', name: 'BOT SAWIT', title: 'TARGET LATIHAN', color: 0x6a9c49, accent: 0xf28b3c, attacks: commonAttacks };

export type Fighter = { characterId: string; x: number; y: number; vy: number; facing: 1 | -1; hp: number; energy: number; cooldowns: Record<SkillKey, number>; state: FighterState; stateFrame: number; stunFrames: number; rootFrames: number; slowFrames: number; attack: AttackKey | null; hitTarget: boolean; wins: number; comboStep: number; comboWindow: number; lightHeld: boolean; heavyHeld: boolean };
export type Phase = 'countdown' | 'fight' | 'roundEnd' | 'matchEnd';
export type Event = { type: 'hit' | 'block' | 'ko' | 'round' | 'fight' | 'skill' | 'combo'; player?: number; damage?: number; skill?: SkillKey };
export type SkillEffect = { id: number; kind: 'boar' | 'flame' | 'shuuu' | 'angels' | 'black-oil' | 'robot-laser'; owner: 0 | 1; x: number; y: number; facing: 1 | -1; age: number; life: number; lastHitTick: number; hitCount: number };
export type World = { mode: 'versus' | 'training'; tick: number; phase: Phase; phaseFrames: number; round: number; timeFrames: number; winner: number | null; roundWinner: number | null; fighters: [Fighter, Fighter]; effects: SkillEffect[]; nextEffectId: number; events: Event[] };
export function skillEffectHitbox(effect: SkillEffect) {
  if (effect.kind === 'boar') return { x: effect.x - 55, y: effect.y - 90, w: 110, h: 85 };
  if (effect.kind === 'shuuu') return { x: effect.x - 70, y: effect.y - 145, w: 140, h: 115 };
  if (effect.kind === 'angels') return { x: effect.x - 90, y: effect.y - 190, w: 180, h: 190 };
  if (effect.kind === 'black-oil') return { x: 0, y: effect.y - 58, w: RULES.arenaWidth, h: 58 };
  if (effect.kind === 'robot-laser') return { x: effect.facing === 1 ? effect.x : effect.x - 720, y: effect.y - 170, w: 720, h: 135 };
  return { x: effect.facing === 1 ? effect.x + 18 : effect.x - 318, y: effect.y - 145, w: 300, h: 95 };
}

export function createWorld(ids: [string, string] = ['mamang-grrovy', 'king-etanol']): World {
  return { mode: 'versus', tick: 0, phase: 'countdown', phaseFrames: 180, round: 1,
    timeFrames: RULES.roundSeconds * RULES.hz, winner: null, roundWinner: null, effects: [], nextEffectId: 1, events: [],
    fighters: [makeFighter(ids[0], 265, 1), makeFighter(ids[1], 695, -1)] };
}
export function createTrainingWorld(characterId = 'mamang-grrovy'): World {
  const world = createWorld([characterId, TRAINING_DUMMY.id]);
  world.mode = 'training'; world.phase = 'fight'; world.phaseFrames = 0;
  world.fighters[0].energy = RULES.maxEnergy;
  world.fighters[1].x = 700;
  return world;
}
function makeFighter(characterId: string, x: number, facing: 1 | -1): Fighter {
  return { characterId, x, y: RULES.floorY, vy: 0, facing, hp: RULES.maxHp,
    energy: 0, cooldowns: { special: 0, normal: 0, ultimate: 0 }, state: 'IDLE', stateFrame: 0, stunFrames: 0, rootFrames: 0, slowFrames: 0, attack: null, hitTarget: false, wins: 0,
    comboStep: 0, comboWindow: 0, lightHeld: false, heavyHeld: false };
}
export function characterFor(f: Fighter): Character { return f.characterId === TRAINING_DUMMY.id ? TRAINING_DUMMY : CHARACTERS.find(c => c.id === f.characterId) ?? CHARACTERS[0]; }
export function attackFor(f: Fighter): Attack | null {
  if (!f.attack) return null;
  const attack = characterFor(f).attacks[f.attack];
  if (f.characterId === 'mamang-grrovy' && f.comboStep === 2 && f.attack === 'light') return { ...attack, range: 82 };
  if (f.characterId === 'mamang-grrovy' && f.comboStep === 3 && f.attack === 'heavy') return { ...attack, startup: 8, damage: 26, range: 112, knockback: 65 };
  return attack;
}
export function isAttackState(s: FighterState): boolean { return s === 'LIGHT_ATTACK' || s === 'HEAVY_ATTACK' || s === 'SPECIAL_ATTACK' || s === 'AIR_LIGHT_ATTACK' || s === 'AIR_HEAVY_ATTACK' || s === 'CROUCH_LIGHT_ATTACK' || s === 'CROUCH_HEAVY_ATTACK'; }
export function bodyHeight(f: Fighter): number { return f.characterId === TRAINING_DUMMY.id ? 172 : (f.state === 'CROUCH' || f.state.startsWith('CROUCH_')) ? RULES.crouchHeight : RULES.bodyHeight; }
export function hurtbox(f: Fighter) { const width = f.characterId === TRAINING_DUMMY.id ? 92 : RULES.bodyWidth; return { x: f.x - width / 2, y: f.y - bodyHeight(f), w: width, h: bodyHeight(f) }; }
export function pushbox(f: Fighter) { return { x: f.x - 21, y: f.y - 58, w: 42, h: 58 }; }
export function hitbox(f: Fighter) {
  const a = attackFor(f);
  if ((f.characterId === 'mamang-grrovy' || f.characterId === 'king-etanol') && (f.attack === 'normal' || f.attack === 'ultimate')) return null;
  if (!a || a.effect || !isAttackState(f.state) || f.stateFrame < a.startup || f.stateFrame >= a.startup + a.active) return null;
  const crouching = f.state.startsWith('CROUCH_');
  return { x: f.facing === 1 ? f.x + 13 : f.x - 13 - a.range, y: f.y - a.height - (crouching ? 3 : 29),
    w: a.range, h: a.height };
}
function intersects(a: {x: number; y: number; w: number; h: number}, b: {x: number; y: number; w: number; h: number}) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
function state(f: Fighter, next: FighterState, attack: AttackKey | null = null) {
  if (f.state !== next || f.attack !== attack) { f.state = next; f.stateFrame = 0; f.attack = attack; f.hitTarget = false; }
}
function stepFighter(f: Fighter, opponent: Fighter, input: Input) {
  f.stateFrame++;
  f.rootFrames = Math.max(0, f.rootFrames - 1); f.slowFrames = Math.max(0, f.slowFrames - 1);
  const freshLight = input.light && !f.lightHeld, freshHeavy = input.heavy && !f.heavyHeld;
  f.lightHeld = input.light; f.heavyHeld = input.heavy;
  if (f.comboWindow > 0) f.comboWindow--;
  else f.comboStep = 0;
  for (const key of ['special', 'normal', 'ultimate'] as SkillKey[]) f.cooldowns[key] = Math.max(0, f.cooldowns[key] - 1);
  if (f.state === 'KO' || f.state === 'ROUND_WIN') return;
  if (f.state === 'HIT_STUN' || f.state === 'STUN' || f.state === 'BLOCK_HIT' || f.state === 'KNOCKDOWN') {
    const duration = f.stunFrames || (f.state === 'KNOCKDOWN' ? 32 : f.state === 'BLOCK_HIT' ? 10 : 18);
    if (f.stateFrame >= duration) state(f, f.state === 'KNOCKDOWN' ? 'GET_UP' : 'IDLE');
    return;
  }
  if (f.state === 'GET_UP') { if (f.stateFrame >= 15) state(f, 'IDLE'); return; }
  if (isAttackState(f.state)) {
    const a = attackFor(f)!;
    if (f.characterId === 'mamang-grrovy' && f.state === 'LIGHT_ATTACK' && f.stateFrame >= a.startup + a.active && f.comboWindow > 0) {
      if (f.comboStep === 1 && freshLight) {
        f.comboStep = 2; f.comboWindow = 45; f.stateFrame = 0; f.hitTarget = false; return;
      }
      if (f.comboStep === 2 && freshHeavy) {
        f.comboStep = 3; f.comboWindow = 45; state(f, 'HEAVY_ATTACK', 'heavy'); return;
      }
    }
    if (f.state.startsWith('AIR_')) {
      f.y = Math.min(RULES.floorY, f.y + f.vy);
      f.vy += RULES.gravity;
      if (f.y === RULES.floorY) f.vy = 0;
    }
    if (f.stateFrame >= a.startup + a.active + a.recovery) { state(f, 'IDLE'); f.comboStep = 0; f.comboWindow = 0; }
    return;
  }
  if (f.y < RULES.floorY || f.vy !== 0) {
    f.y = Math.min(RULES.floorY, f.y + f.vy);
    f.vy += RULES.gravity;
    if (f.y === RULES.floorY) { f.vy = 0; state(f, 'IDLE'); }
    else state(f, f.vy < 0 ? 'JUMP_ASCEND' : 'JUMP_FALL');
  }
  f.facing = f.x <= opponent.x ? 1 : -1;
  if (f.y < RULES.floorY && (input.light || input.heavy)) {
    const key: AttackKey = input.heavy ? 'heavy' : 'light';
    state(f, input.heavy ? 'AIR_HEAVY_ATTACK' : 'AIR_LIGHT_ATTACK', key);
    return;
  }
  if (f.y === RULES.floorY) {
    if (input.block) { state(f, 'BLOCK'); return; }
    if (input.crouch) {
      if (input.light || input.heavy) {
        const key: AttackKey = input.heavy ? 'heavy' : 'light';
        state(f, input.heavy ? 'CROUCH_HEAVY_ATTACK' : 'CROUCH_LIGHT_ATTACK', key);
      } else state(f, 'CROUCH');
      return;
    }
    if (input.jump) { f.vy = -RULES.jumpSpeed; state(f, 'JUMP_ASCEND'); return; }
    const key: AttackKey | null = input.ultimate ? 'ultimate' : input.normal ? 'normal' : input.special ? 'special' : input.heavy ? 'heavy' : input.light ? 'light' : null;
    if (key && f.energy >= characterFor(f).attacks[key].energyCost && (!(key in f.cooldowns) || f.cooldowns[key as SkillKey] === 0)) {
      const attack = characterFor(f).attacks[key];
      f.energy -= attack.energyCost;
      if (key in f.cooldowns) f.cooldowns[key as SkillKey] = attack.cooldownFrames;
      state(f, key === 'light' ? 'LIGHT_ATTACK' : key === 'heavy' ? 'HEAVY_ATTACK' : 'SPECIAL_ATTACK', key);
      if (f.characterId === 'mamang-grrovy') { f.comboStep = key === 'light' ? 1 : 0; f.comboWindow = key === 'light' ? 45 : 0; }
      return;
    }
  }
  const axis = Number(input.right) - Number(input.left);
  if (axis) { const speed = RULES.walkSpeed * (f.slowFrames > 0 ? 0.45 : 1); f.x = Math.max(26, Math.min(RULES.arenaWidth - 26, f.x + axis * speed));
    if (f.y === RULES.floorY) state(f, axis === f.facing ? 'WALK_FORWARD' : 'WALK_BACKWARD'); }
  else if (f.y === RULES.floorY) state(f, 'IDLE');
}
function resolvePush(a: Fighter, b: Fighter) {
  if (Math.abs(a.x - b.x) >= 42 || Math.abs(a.y - b.y) > 90) return;
  const middle = (a.x + b.x) / 2;
  if (a.x <= b.x) { a.x = Math.max(26, middle - 21); b.x = Math.min(RULES.arenaWidth - 26, middle + 21); }
  else { a.x = Math.min(RULES.arenaWidth - 26, middle + 21); b.x = Math.max(26, middle - 21); }
}
function resolveHit(world: World, attacker: Fighter, defender: Fighter, defenderInput: Input, defenderIndex: number) {
  const box = hitbox(attacker), attack = attackFor(attacker);
  if (!box || !attack || attacker.hitTarget || !intersects(box, hurtbox(defender))) return;
  attacker.hitTarget = true;
  const blocking = defenderInput.block && defender.y === RULES.floorY && defender.state !== 'HIT_STUN' && defender.state !== 'STUN' && defender.state !== 'KNOCKDOWN' && !isAttackState(defender.state);
  if (blocking) { defender.stunFrames = attack.blockStun; state(defender, 'BLOCK_HIT'); world.events.push({ type: 'block', player: defenderIndex }); return; }
  if (world.mode === 'training' && defenderIndex === 1) {
    if (defender.state !== 'STUN') { defender.stunFrames = attack.damage >= 28 ? 22 : 14; state(defender, 'HIT_STUN'); }
    attacker.energy = RULES.maxEnergy;
    world.events.push({ type: 'hit', player: defenderIndex, damage: attack.damage });
    return;
  }
  defender.hp = Math.max(0, defender.hp - attack.damage);
  defender.energy = Math.min(RULES.maxEnergy, defender.energy + 5);
  attacker.energy = Math.min(RULES.maxEnergy, attacker.energy + attack.energyGain);
  const wasStunned = defender.state === 'STUN';
  if (!wasStunned) defender.x = Math.max(26, Math.min(RULES.arenaWidth - 26, defender.x + attacker.facing * attack.knockback));
  if (defender.hp <= 0) state(defender, 'KO');
  else if (!wasStunned) {
    defender.stunFrames = attack.damage >= 28 ? Math.max(32, attack.hitStun) : attack.hitStun;
    state(defender, attack.damage >= 28 ? 'KNOCKDOWN' : 'HIT_STUN');
  }
  world.events.push({ type: defender.hp <= 0 ? 'ko' : 'hit', player: defenderIndex, damage: attack.damage });
  if (attacker.characterId === 'mamang-grrovy' && attacker.comboStep === 3) world.events.push({ type: 'combo', player: 1 - defenderIndex });
}
function spawnSkillEffects(world: World) {
  world.fighters.forEach((f, index) => {
    if (f.state !== 'SPECIAL_ATTACK') return;
    const attack = attackFor(f)!;
    if (f.characterId === 'mamang-grrovy' && (f.attack === 'normal' || f.attack === 'ultimate')) {
      const ultimate = f.attack === 'ultimate', target = world.fighters[1 - index];
      if (f.stateFrame !== (ultimate ? 0 : attack.startup)) return;
      if (ultimate && target.hp > 0) {
        target.y = RULES.floorY; target.vy = 0; target.stunFrames = 115;
        state(target, 'STUN');
      }
      world.effects.push({ id: world.nextEffectId++, kind: ultimate ? 'angels' : 'shuuu', owner: index as 0 | 1,
        x: ultimate ? target.x : f.x + f.facing * 55, y: RULES.floorY, facing: f.facing, age: 0,
        life: ultimate ? 104 : 85, lastHitTick: -1000, hitCount: 0 });
      world.events.push({ type: 'skill', player: index, skill: f.attack });
      return;
    }
    if (f.characterId === 'king-etanol' && (f.attack === 'normal' || f.attack === 'ultimate')) {
      if (f.stateFrame !== attack.startup) return;
      const ultimate = f.attack === 'ultimate';
      world.effects.push({ id: world.nextEffectId++, kind: ultimate ? 'robot-laser' : 'black-oil', owner: index as 0 | 1,
        x: ultimate ? f.x + f.facing * 38 : RULES.arenaWidth / 2, y: RULES.floorY, facing: f.facing, age: 0,
        life: ultimate ? 50 : 210, lastHitTick: -1000, hitCount: 0 });
      world.events.push({ type: 'skill', player: index, skill: f.attack });
      return;
    }
    if (f.attack !== 'special') return;
    const isBoar = attack.effect === 'boar';
    const offset = f.stateFrame - attack.startup;
    if ((isBoar && [0, 6, 12, 18, 24, 30].includes(offset)) || (!isBoar && offset === 0)) {
      world.effects.push({ id: world.nextEffectId++, kind: isBoar ? 'boar' : 'flame', owner: index as 0 | 1,
        x: f.x + f.facing * (isBoar ? 44 : 105), y: RULES.floorY, facing: f.facing, age: 0,
        life: isBoar ? 64 : 62, lastHitTick: -1000, hitCount: 0 });
      world.events.push({ type: 'skill', player: index, skill: 'special' });
    }
  });
}
function resolveSkillHit(world: World, effect: SkillEffect, target: Fighter, input: Input, targetIndex: number) {
  const attack = characterFor(world.fighters[effect.owner]).attacks.special;
  effect.lastHitTick = world.tick; effect.hitCount++;
  if (effect.kind === 'boar') effect.life = Math.min(effect.life, effect.age + 14);
  const blocking = input.block && target.y === RULES.floorY && !isAttackState(target.state) && target.state !== 'KNOCKDOWN' && target.state !== 'HIT_STUN' && target.state !== 'STUN';
  if (blocking) {
    target.stunFrames = attack.blockStun; state(target, 'BLOCK_HIT');
    world.events.push({ type: 'block', player: targetIndex }); return;
  }
  if (world.mode === 'training' && targetIndex === 1) {
    if (target.state !== 'STUN') { target.stunFrames = 20; state(target, 'HIT_STUN'); }
    world.events.push({ type: 'hit', player: targetIndex, damage: attack.damage });
    return;
  }
  target.hp = Math.max(0, target.hp - attack.damage);
  target.energy = Math.min(RULES.maxEnergy, target.energy + 3);
  const wasStunned = target.state === 'STUN';
  if (!wasStunned) target.x = Math.max(26, Math.min(RULES.arenaWidth - 26, target.x + effect.facing * attack.knockback));
  if (target.hp <= 0) state(target, 'KO');
  else if (!wasStunned) { target.stunFrames = effect.kind === 'boar' ? 28 : 32; state(target, 'KNOCKDOWN'); }
  world.events.push({ type: target.hp <= 0 ? 'ko' : 'hit', player: targetIndex, damage: attack.damage });
}
function stepSkillEffects(world: World, inputs: [Input, Input]) {
  for (const effect of world.effects) {
    effect.age++;
    const targetIndex = 1 - effect.owner, target = world.fighters[targetIndex];
    if (effect.kind === 'shuuu') {
      if (effect.hitCount === 0) effect.x += effect.facing * 10;
      if (effect.hitCount === 0 && target.hp > 0 && intersects(skillEffectHitbox(effect), hurtbox(target))) {
        effect.hitCount = 1; effect.life = Math.min(effect.life, effect.age + 10);
        const attack = characterFor(world.fighters[effect.owner]).attacks.normal;
        const blocked = inputs[targetIndex].block && target.y === RULES.floorY && target.state !== 'STUN' && !isAttackState(target.state);
        if (blocked) { target.stunFrames = attack.blockStun; state(target, 'BLOCK_HIT'); world.events.push({ type: 'block', player: targetIndex }); }
        else {
          if (!(world.mode === 'training' && targetIndex === 1)) target.hp = Math.max(0, target.hp - attack.damage);
          target.y = RULES.floorY; target.vy = 0; target.stunFrames = 60;
          state(target, target.hp <= 0 ? 'KO' : 'STUN');
          world.events.push({ type: target.hp <= 0 ? 'ko' : 'hit', player: targetIndex, damage: attack.damage });
        }
      }
      continue;
    }
    if (effect.kind === 'angels') {
      effect.x = target.x;
      if (effect.age === 75 && effect.hitCount === 0 && target.hp > 0) {
        effect.hitCount = 1;
        const attack = characterFor(world.fighters[effect.owner]).attacks.ultimate;
        if (!(world.mode === 'training' && targetIndex === 1)) target.hp = Math.max(0, target.hp - attack.damage);
        if (target.hp <= 0) state(target, 'KO');
        world.events.push({ type: target.hp <= 0 ? 'ko' : 'hit', player: targetIndex, damage: attack.damage });
      }
      continue;
    }
    if (effect.kind === 'black-oil') {
      if (effect.hitCount === 0 && effect.age >= 18 && target.hp > 0 && target.y === RULES.floorY && intersects(skillEffectHitbox(effect), hurtbox(target))) {
        effect.hitCount = 1;
        const attack = characterFor(world.fighters[effect.owner]).attacks.normal;
        if (!(world.mode === 'training' && targetIndex === 1)) target.hp = Math.max(0, target.hp - attack.damage);
        target.y = RULES.floorY; target.vy = 0; target.rootFrames = 36; target.slowFrames = 180; target.stunFrames = 36;
        state(target, target.hp <= 0 ? 'KO' : 'STUN');
        world.events.push({ type: target.hp <= 0 ? 'ko' : 'hit', player: targetIndex, damage: attack.damage });
      }
      continue;
    }
    if (effect.kind === 'robot-laser') {
      if (effect.hitCount === 0 && effect.age >= 20 && target.hp > 0 && intersects(skillEffectHitbox(effect), hurtbox(target))) {
        effect.hitCount = 1;
        const attack = characterFor(world.fighters[effect.owner]).attacks.ultimate;
        if (!(world.mode === 'training' && targetIndex === 1)) target.hp = Math.max(0, target.hp - attack.damage);
        target.y = RULES.floorY; target.vy = 0; target.stunFrames = 48;
        state(target, target.hp <= 0 ? 'KO' : 'KNOCKDOWN');
        world.events.push({ type: target.hp <= 0 ? 'ko' : 'hit', player: targetIndex, damage: attack.damage });
      }
      continue;
    }
    if (effect.kind === 'boar') effect.x += effect.facing * 9;
    const box = skillEffectHitbox(effect);
    const active = effect.kind === 'boar' || (effect.age >= 10 && effect.age <= 48);
    const canHit = effect.kind === 'boar' ? effect.hitCount === 0 : effect.hitCount < 3 && world.tick - effect.lastHitTick >= 12;
    if (active && canHit && target.hp > 0 && intersects(box, hurtbox(target)))
      resolveSkillHit(world, effect, target, inputs[targetIndex], targetIndex);
  }
  world.effects = world.effects.filter(e => e.age < e.life);
}
function endRound(world: World, winner: number | null) {
  world.phase = 'roundEnd'; world.phaseFrames = RULES.roundPauseFrames; world.roundWinner = winner;
  world.effects = [];
  if (winner !== null) { const fighter = world.fighters[winner]; fighter.wins++;
    if (fighter.hp > 0) state(fighter, 'ROUND_WIN'); }
  world.events.push({ type: 'round', player: winner ?? undefined });
}
export function stepWorld(world: World, inputs: [Input, Input]): World {
  world.tick++; world.events = [];
  if (world.phase === 'countdown') {
    if (--world.phaseFrames <= 0) { world.phase = 'fight'; world.events.push({ type: 'fight' }); }
    return world;
  }
  if (world.phase === 'roundEnd') {
    if (--world.phaseFrames <= 0) {
      const champion = world.fighters.findIndex(f => f.wins >= RULES.roundsToWin);
      if (champion >= 0) { world.phase = 'matchEnd'; world.winner = champion; }
      else {
        const ids: [string, string] = [world.fighters[0].characterId, world.fighters[1].characterId];
        const wins: [number, number] = [world.fighters[0].wins, world.fighters[1].wins];
        const next = createWorld(ids); next.round = world.round + 1;
        next.fighters[0].wins = wins[0]; next.fighters[1].wins = wins[1];
        Object.assign(world, next, { tick: world.tick });
      }
    }
    return world;
  }
  if (world.phase !== 'fight') return world;
  const [a, b] = world.fighters;
  if (world.mode === 'training') {
    a.hp = RULES.maxHp; a.energy = RULES.maxEnergy;
    a.cooldowns.special = a.cooldowns.normal = a.cooldowns.ultimate = 0;
    stepFighter(a, b, inputs[0]);
    b.stateFrame++;
    if ((b.state === 'HIT_STUN' || b.state === 'STUN') && b.stateFrame >= b.stunFrames) state(b, 'IDLE');
    spawnSkillEffects(world); stepSkillEffects(world, inputs);
    resolveHit(world, a, b, NEUTRAL_INPUT, 1);
    a.hp = b.hp = RULES.maxHp; a.energy = RULES.maxEnergy;
    a.cooldowns.special = a.cooldowns.normal = a.cooldowns.ultimate = 0;
    return world;
  }
  stepFighter(a, b, inputs[0]); stepFighter(b, a, inputs[1]); resolvePush(a, b);
  spawnSkillEffects(world); stepSkillEffects(world, inputs);
  resolveHit(world, a, b, inputs[1], 1); resolveHit(world, b, a, inputs[0], 0);
  if (a.hp <= 0 || b.hp <= 0) endRound(world, a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1);
  else if (--world.timeFrames <= 0) endRound(world, a.hp === b.hp ? null : a.hp > b.hp ? 0 : 1);
  return world;
}
