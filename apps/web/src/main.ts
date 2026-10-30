import Phaser from 'phaser';
import { CHARACTERS, RULES, NEUTRAL_INPUT, createWorld, createTrainingWorld, stepWorld, characterFor, hitbox, hurtbox, pushbox, skillEffectHitbox, type Input, type Fighter, type SkillKey, type World } from '@konoha/game-core';
import './style.css';

type Page = 'menu' | 'select' | 'versus' | 'battle' | 'result' | 'sprites' | 'settings';
type GameSettings = {
  masterVolume: number; sfxVolume: number; musicVolume: number; muted: boolean; musicEnabled: boolean;
  controlScale: number; stickX: number; stickY: number; clusterX: number; clusterY: number;
};
const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.8, sfxVolume: 0.85, musicVolume: 0.38, muted: false, musicEnabled: true,
  controlScale: 1, stickX: 2.2, stickY: 63.5, clusterX: 69.2, clusterY: 53.3,
};
const CONTROL_PRESETS: Record<string, Pick<GameSettings, 'controlScale' | 'stickX' | 'stickY' | 'clusterX' | 'clusterY'>> = {
  standard: { controlScale: 1, stickX: 2.2, stickY: 63.5, clusterX: 69.2, clusterY: 53.3 },
  compact: { controlScale: 0.88, stickX: 3.2, stickY: 66, clusterX: 71.5, clusterY: 57 },
  mirrored: { controlScale: 1, stickX: 83.2, stickY: 63.5, clusterX: 1.5, clusterY: 53.3 },
};
function loadSettings(): GameSettings {
  try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem('konoha-fighter-settings') ?? '{}') }; }
  catch { return { ...DEFAULT_SETTINGS }; }
}
let settings = loadSettings();
function saveSettings() {
  try { localStorage.setItem('konoha-fighter-settings', JSON.stringify(settings)); }
  catch { /* Settings still apply for the current session when storage is unavailable. */ }
  syncMusic();
}
const app = document.querySelector<HTMLDivElement>('#app')!;
let page: Page = 'menu';
let chosen: [string, string] = ['mamang-grrovy', 'king-etanol'];
let selectionMode: 'versus' | 'training' = 'versus';
let world = createWorld(chosen);
let game: Phaser.Game | null = null;
let debug = false;
let paused = false;
let soundEnabled = true;
let audio: AudioContext | null = null;
let musicTimer: number | null = null;
let musicStep = 0;
let transitionSerial = 0;
const queuedSkill: [SkillKey | null, SkillKey | null] = [null, null];
const touchInput: Input = { ...NEUTRAL_INPUT };
const CHARACTER_FRAMES = ['idle_0', 'idle_1', 'walk_0', 'walk_1', 'crouch', 'jump_start', 'jump_air', 'land', 'light', 'heavy', 'special', 'hit', 'block', 'block_0', 'block_1', 'block_hit', 'knockdown', 'get_up', 'ko', 'victory', 'jump_punch_0', 'jump_punch_1', 'jump_kick_0', 'jump_kick_1', 'crouch_punch_0', 'crouch_punch_1', 'crouch_kick_0', 'crouch_kick_1', 'stun_0', 'stun_1'];
const ROBOT_FRAMES = Array.from({ length: 8 }, (_, index) => `robot_${index}`);
const SKILL_DETAILS: Record<string, Record<SkillKey, { name: string; short: string; description: string }>> = {
  'mamang-grrovy': {
    special: { name: 'SERBUAN CELENG', short: 'CELENG', description: 'Enam babi hutan menyeruduk beruntun.' },
    normal: { name: 'TEMBAKAN SHUUU', short: 'SHUUU', description: 'Tembakan jarak jauh yang membuat target stun selama 1 detik.' },
    ultimate: { name: 'TITAH MALAIKAT', short: 'MALAIKAT', description: 'Lima malaikat mengunci lawan lalu menyambar dengan petir.' },
  },
  'king-etanol': {
    special: { name: 'ETHANOL FLAME', short: 'FLAME', description: 'Tong menyemburkan api panjang.' },
    normal: { name: 'BLACK OIL', short: 'OIL', description: 'Oli memenuhi arena, mengunci lalu memperlambat lawan.' },
    ultimate: { name: 'ROBOT TONG', short: 'ROBOT', description: 'Berubah menjadi Robot Tong dan menembakkan laser unblockable.' },
  },
};

function skillDetailMarkup(characterId: string) {
  const character = CHARACTERS.find(item => item.id === characterId)!, details = SKILL_DETAILS[characterId];
  return (['special', 'normal', 'ultimate'] as SkillKey[]).map(key => `
    <div class="preview-skill ${key}">
      <img class="skill-emblem" src="/assets/ui/skill-emblems/${characterId}-${key}.png" alt="">
      <div class="skill-copy"><b>${details[key].name}</b><small>${details[key].description}</small></div>
      <span class="skill-energy">${character.attacks[key].energyCost} EN</span>
    </div>`).join('');
}

function syncVisibleViewport() {
  const viewport = window.visualViewport;
  document.documentElement.style.setProperty('--app-height', `${Math.round(viewport?.height ?? window.innerHeight)}px`);
  document.documentElement.style.setProperty('--app-offset-top', `${Math.round(viewport?.offsetTop ?? 0)}px`);
  window.requestAnimationFrame(() => game?.scale.refresh());
}
syncVisibleViewport();
window.addEventListener('resize', syncVisibleViewport);
window.addEventListener('orientationchange', () => window.setTimeout(syncVisibleViewport, 120));
window.visualViewport?.addEventListener('resize', syncVisibleViewport);
window.visualViewport?.addEventListener('scroll', syncVisibleViewport);
for (const eventName of ['gesturestart', 'gesturechange', 'gestureend'])
  document.addEventListener(eventName, event => event.preventDefault(), { passive: false });
let previousTouchEnd = 0;
document.addEventListener('touchend', event => {
  const now = Date.now();
  if (now - previousTouchEnd < 320) event.preventDefault();
  previousTouchEnd = now;
}, { passive: false });

function mobileFloorLift() {
  if (!window.matchMedia('(pointer: coarse)').matches && window.innerWidth > 950) return 0;
  const viewport = window.visualViewport;
  const ratio = (viewport?.width ?? window.innerWidth) / Math.max(1, viewport?.height ?? window.innerHeight);
  return Math.round(Math.max(26, Math.min(70, 28 + (ratio - 16 / 9) * 52)));
}

async function enterImmersive() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    await (screen.orientation as ScreenOrientation & { lock?: (orientation: string) => Promise<void> }).lock?.('landscape');
  } catch { /* Fullscreen/orientation support differs by browser. */ }
}
const imageAnimationTokens = new WeakMap<HTMLImageElement, number>();
function animateImage(image: HTMLImageElement, folder: string, loop = false, frameMs = 75) {
  const token = (imageAnimationTokens.get(image) ?? 0) + 1;
  imageAnimationTokens.set(image, token);
  const startedAt = performance.now();
  let renderedFrame = -1;
  const next = (now: number) => {
    if (!image.isConnected || imageAnimationTokens.get(image) !== token) return;
    const elapsedFrame = Math.floor((now - startedAt) / frameMs);
    const frame = loop ? elapsedFrame % 8 : Math.min(7, elapsedFrame);
    if (frame !== renderedFrame) {
      image.src = `${folder}/${String(frame).padStart(2, '0')}.png`;
      renderedFrame = frame;
    }
    if (loop || elapsedFrame < 7) window.requestAnimationFrame(next);
  };
  window.requestAnimationFrame(next);
}

function beep(freq: number, duration = 0.08, type: OscillatorType = 'square') {
  if (!soundEnabled || settings.muted || settings.masterVolume <= 0 || settings.sfxVolume <= 0) return;
  try {
    audio ??= new AudioContext();
    void audio.resume(); syncMusic();
    const o = audio.createOscillator(), gain = audio.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, audio.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(60, freq / 2), audio.currentTime + duration);
    gain.gain.setValueAtTime(0.06 * settings.masterVolume * settings.sfxVolume, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + duration);
    o.connect(gain).connect(audio.destination); o.start(); o.stop(audio.currentTime + duration);
  } catch { /* Audio is optional. */ }
}
function syncMusic() {
  if (musicTimer !== null) { window.clearInterval(musicTimer); musicTimer = null; }
  if (!audio || settings.muted || !settings.musicEnabled || settings.masterVolume <= 0 || settings.musicVolume <= 0) return;
  const notes = [110, 147, 165, 196, 165, 147, 123, 147];
  const playNote = () => {
    if (!audio) return;
    const oscillator = audio.createOscillator(), gain = audio.createGain();
    oscillator.type = musicStep % 4 === 3 ? 'square' : 'triangle';
    oscillator.frequency.setValueAtTime(notes[musicStep++ % notes.length], audio.currentTime);
    const level = 0.025 * settings.masterVolume * settings.musicVolume;
    gain.gain.setValueAtTime(level, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.16);
    oscillator.connect(gain).connect(audio.destination); oscillator.start(); oscillator.stop(audio.currentTime + 0.17);
  };
  playNote(); musicTimer = window.setInterval(playNote, 190);
}
function button(label: string, action: () => void, className = '') {
  const b = document.createElement('button'); b.className = `retro-button ${className}`.trim(); b.textContent = label;
  b.onclick = () => { beep(420, 0.045); action(); }; return b;
}
function setPage(next: Page) { if (next !== 'battle') Object.assign(touchInput, NEUTRAL_INPUT); page = next; render(); }
function render() {
  if (page !== 'battle' && game) { game.destroy(true); game = null; }
  app.innerHTML = '';
  const shell = document.createElement('main'); shell.className = `shell ${page}`;
  app.append(shell);
  if (page === 'menu') renderMenu(shell);
  if (page === 'select') renderSelect(shell);
  if (page === 'versus') renderVersus(shell);
  if (page === 'battle') renderBattle(shell);
  if (page === 'result') renderResult(shell);
  if (page === 'sprites') renderSprites(shell);
  if (page === 'settings') renderSettings(shell);
}
function renderMenu(shell: HTMLElement) {
  shell.innerHTML = `<div class="menu-moon"></div><div class="menu-clouds"></div><div class="menu-ground"></div><img class="menu-fighter left" src="/assets/characters/mamang-grrovy/idle_0.png" alt="Mamang Grrovy"><img class="menu-fighter right" src="/assets/characters/king-etanol/idle_0.png" alt="King Etanol"><div class="menu-content"><div class="eyebrow">KONOHA FIGHTER <span>MOBILE LANDSCAPE EDITION</span></div><h1>KONOHA FIGHTER</h1><p class="tagline">DUA PETARUNG. SATU ARENA.</p><div class="menu-actions" id="actions"></div><div class="footer-note">ARCADE BUILD // 2026</div></div>`;
  const logo = document.createElement('img'); logo.className = 'menu-logo'; logo.alt = 'Konoha Fighter';
  shell.querySelector('h1')!.replaceWith(logo);
  const logoFrames = Array.from({ length: 10 }, (_, i) => `/assets/ui/logo/intro_${String(i).padStart(2, '0')}.png`);
  logoFrames.forEach(src => { const preload = new Image(); preload.src = src; });
  logo.src = logoFrames[0];
  let frame = 0;
  const animateLogo = () => { if (!logo.isConnected || frame >= logoFrames.length - 1) return; logo.src = logoFrames[++frame]; window.setTimeout(animateLogo, frame < 5 ? 90 : 115); };
  window.setTimeout(animateLogo, 100);
  const actions = shell.querySelector('#actions')!;
  actions.append(button('ARCADE / VERSUS', () => { void enterImmersive(); selectionMode = 'versus'; setPage('select'); }, 'primary'));
  actions.append(button('TRAINING', () => { void enterImmersive(); selectionMode = 'training'; setPage('select'); }, 'secondary'));
  actions.append(button('SPRITE LAB', () => setPage('sprites'), 'secondary'));
  actions.append(button('SETTINGS', () => setPage('settings'), 'secondary'));
  actions.append(button('LAYAR PENUH', () => { void enterImmersive(); }, 'secondary fullscreen-button'));
}
function renderSettings(shell: HTMLElement) {
  shell.innerHTML = `<header class="topbar"><button class="text-button" id="settingsBack">← KEMBALI</button><span>KONOHA FIGHTER <i>●</i> SETTINGS</span><span>PLAYER PROFILE</span></header>
    <section class="settings-stage">
      <article class="settings-panel audio-settings">
        <span class="section-number">01 / AUDIO</span><h2>SUARA</h2>
        <label><span>MASTER <output id="masterValue"></output></span><input id="masterVolume" type="range" min="0" max="1" step="0.05"></label>
        <label><span>EFEK SUARA <output id="sfxValue"></output></span><input id="sfxVolume" type="range" min="0" max="1" step="0.05"></label>
        <label><span>BACKSOUND <output id="musicValue"></output></span><input id="musicVolume" type="range" min="0" max="1" step="0.05"></label>
        <div class="setting-toggles"><label><input id="musicEnabled" type="checkbox"><span>BACKSOUND ON</span></label><label><input id="muted" type="checkbox"><span>MUTE ALL</span></label></div>
        <button class="secondary" id="testSound">TEST SUARA</button>
      </article>
      <article class="settings-panel control-settings">
        <span class="section-number">02 / TOUCH CONTROL</span><h2>TATA LETAK</h2>
        <div class="control-presets"><button data-preset="standard">STANDARD</button><button data-preset="compact">COMPACT</button><button data-preset="mirrored">MIRROR</button></div>
        <div class="control-layout-preview" id="controlPreview">
          <div class="preview-grid"></div><button class="layout-marker analog-marker" data-marker="stick"><span>ANALOG</span></button><button class="layout-marker cluster-marker" data-marker="cluster"><span>SKILL + ATTACK</span></button>
          <small>GESER KONTROL KE POSISI YANG NYAMAN</small>
        </div>
        <label class="scale-setting"><span>UKURAN KONTROL <output id="scaleValue"></output></span><input id="controlScale" type="range" min="0.8" max="1.15" step="0.05"></label>
        <div class="settings-actions"><button class="secondary" id="resetSettings">RESET</button><button class="primary" id="saveSettings">SIMPAN</button></div>
      </article>
    </section>`;
  shell.querySelector<HTMLButtonElement>('#settingsBack')!.onclick = () => setPage('menu');
  const bindRange = (id: 'masterVolume' | 'sfxVolume' | 'musicVolume' | 'controlScale', outputId: string) => {
    const input = shell.querySelector<HTMLInputElement>(`#${id}`)!, output = shell.querySelector<HTMLOutputElement>(`#${outputId}`)!;
    const refresh = () => { output.value = id === 'controlScale' ? `${Math.round(settings[id] * 100)}%` : `${Math.round(settings[id] * 100)}`; input.value = String(settings[id]); };
    input.oninput = () => { settings[id] = Number(input.value); refresh(); saveSettings(); updateMarkers(); };
    refresh();
  };
  bindRange('masterVolume', 'masterValue'); bindRange('sfxVolume', 'sfxValue'); bindRange('musicVolume', 'musicValue'); bindRange('controlScale', 'scaleValue');
  for (const id of ['musicEnabled', 'muted'] as const) {
    const checkbox = shell.querySelector<HTMLInputElement>(`#${id}`)!; checkbox.checked = settings[id];
    checkbox.onchange = () => { settings[id] = checkbox.checked; saveSettings(); };
  }
  shell.querySelector<HTMLButtonElement>('#testSound')!.onclick = () => { beep(620, .08); window.setTimeout(() => beep(840, .1), 90); };
  const preview = shell.querySelector<HTMLElement>('#controlPreview')!;
  const markers = {
    stick: shell.querySelector<HTMLElement>('[data-marker="stick"]')!,
    cluster: shell.querySelector<HTMLElement>('[data-marker="cluster"]')!,
  };
  function updateMarkers() {
    markers.stick.style.left = `${settings.stickX}%`; markers.stick.style.top = `${settings.stickY}%`;
    markers.cluster.style.left = `${settings.clusterX}%`; markers.cluster.style.top = `${settings.clusterY}%`;
    markers.stick.style.scale = String(settings.controlScale); markers.cluster.style.scale = String(settings.controlScale);
  }
  (Object.keys(markers) as (keyof typeof markers)[]).forEach(kind => {
    const marker = markers[kind];
    const move = (event: PointerEvent) => {
      if (!marker.hasPointerCapture(event.pointerId)) return;
      const rect = preview.getBoundingClientRect();
      const x = Math.max(0, Math.min(kind === 'stick' ? 85 : 70, (event.clientX - rect.left - marker.offsetWidth / 2) / rect.width * 100));
      const y = Math.max(8, Math.min(72, (event.clientY - rect.top - marker.offsetHeight / 2) / rect.height * 100));
      if (kind === 'stick') { settings.stickX = x; settings.stickY = y; }
      else { settings.clusterX = x; settings.clusterY = y; }
      updateMarkers();
    };
    marker.onpointerdown = event => { marker.setPointerCapture(event.pointerId); marker.classList.add('dragging'); move(event); };
    marker.onpointermove = move;
    marker.onpointerup = marker.onpointercancel = () => { marker.classList.remove('dragging'); saveSettings(); };
  });
  shell.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach(preset => preset.onclick = () => {
    Object.assign(settings, CONTROL_PRESETS[preset.dataset.preset!]); saveSettings(); updateMarkers(); beep(520, .05);
  });
  shell.querySelector<HTMLButtonElement>('#resetSettings')!.onclick = () => { settings = { ...DEFAULT_SETTINGS }; saveSettings(); renderSettings(shell); };
  shell.querySelector<HTMLButtonElement>('#saveSettings')!.onclick = () => { saveSettings(); beep(760, .08); setPage('menu'); };
  updateMarkers();
}
function renderSprites(shell: HTMLElement) {
  const frames = CHARACTER_FRAMES;
  shell.innerHTML = `<header class="topbar"><button class="text-button" id="back">← KEMBALI</button><span>KONOHA FIGHTER <i>●</i> SPRITE LAB</span><span>${frames.length} POSE / FIGHTER</span></header><section class="sprite-header"><span class="section-number">ASSET REVIEW</span><h2>SPRITE LAB</h2><p>Pose kanonik menghadap kanan. Tekan tombol untuk melihat versi cermin.</p><button id="flip" class="secondary">BALIK ARAH ↔</button></section><div class="sprite-gallery" id="gallery"></div>`;
  shell.querySelector<HTMLButtonElement>('#back')!.onclick = () => setPage('menu');
  shell.querySelector<HTMLButtonElement>('#flip')!.onclick = () => shell.querySelector('#gallery')?.classList.toggle('flipped');
  const gallery = shell.querySelector('#gallery')!;
  CHARACTERS.forEach(c => {
    const group = document.createElement('section'); group.className = 'sprite-group';
    group.innerHTML = `<h3>${c.name}</h3><div class="sprite-grid"></div>`;
    const grid = group.querySelector('.sprite-grid')!;
    [...frames, ...(c.id === 'king-etanol' ? ROBOT_FRAMES : [])].forEach(frame => { const tile = document.createElement('figure'); tile.innerHTML = `<img loading="lazy" src="/assets/characters/${c.id}/${frame}.png" alt="${c.name}: ${frame.replaceAll('_', ' ')}"><figcaption>${frame.replaceAll('_', ' ')}</figcaption>`; grid.append(tile); });
    gallery.append(group);
  });
  const botGroup = document.createElement('section'); botGroup.className = 'sprite-group bot-group';
  botGroup.innerHTML = '<h3>BOT SAWIT / TRAINING DUMMY</h3><div class="sprite-grid"></div>';
  for (const frame of ['idle', 'hit_right', 'hit_left', 'recover']) {
    const tile = document.createElement('figure');
    tile.innerHTML = `<img loading="lazy" src="/assets/characters/bot-sawit/${frame}.png" alt="Bot Sawit: ${frame.replaceAll('_', ' ')}"><figcaption>${frame.replaceAll('_', ' ')}</figcaption>`;
    botGroup.querySelector('.sprite-grid')!.append(tile);
  }
  gallery.append(botGroup);
  for (const [id, label] of [['boar-charge', 'BABI HUTAN / MAMANG'], ['ethanol-flame', 'TONG API / KING'], ['ethanol-jet', 'SEMBURAN API / KING'], ['black-oil', 'BLACK OIL / KING'], ['robot-laser', 'LASER ROBOT TONG / KING'], ['mamang-shuuu', 'TEMBAKAN SHUUU / MAMANG'], ['mamang-angels', 'MALAIKAT / MAMANG'], ['mamang-lightning', 'PETIR / MAMANG'], ['stun-aura', 'EFEK STUN / SEMUA KARAKTER']] as const) {
    const group = document.createElement('section'); group.className = 'sprite-group vfx-group';
    group.innerHTML = `<h3>${label}</h3><div class="sprite-grid"></div>`;
    const grid = group.querySelector('.sprite-grid')!;
    for (let i = 0; i < 8; i++) { const tile = document.createElement('figure'); tile.innerHTML = `<img loading="lazy" src="/assets/vfx/${id}/${String(i).padStart(2, '0')}.png" alt="${label} frame ${i + 1}"><figcaption>FRAME ${String(i + 1).padStart(2, '0')}</figcaption>`; grid.append(tile); }
    gallery.append(group);
  }
  const logoGroup = document.createElement('section'); logoGroup.className = 'sprite-group logo-group';
  logoGroup.innerHTML = '<h3>LOGO INTRO</h3><div class="sprite-grid"></div>';
  const logoGrid = logoGroup.querySelector('.sprite-grid')!;
  for (let i = 0; i < 10; i++) { const tile = document.createElement('figure'); tile.innerHTML = `<img loading="lazy" src="/assets/ui/logo/intro_${String(i).padStart(2, '0')}.png" alt="Logo intro frame ${i + 1}"><figcaption>FRAME ${String(i + 1).padStart(2, '0')}</figcaption>`; logoGrid.append(tile); }
  gallery.append(logoGroup);
  for (const [label, folder] of [['K.O. ANNOUNCEMENT', 'combat-announcements/ko'], ['VS TRANSITION', 'combat-announcements/vs'], ['SKILL BUTTON CHARGE', 'skill-button'], ['ANALOG RETRO', 'mobile-controls/analog'], ['PUNCH BUTTON', 'mobile-controls/punch'], ['KICK BUTTON', 'mobile-controls/kick'], ['DEF BUTTON', 'mobile-controls/def']] as const) {
    const group = document.createElement('section'); group.className = 'sprite-group ui-animation-group';
    group.innerHTML = `<h3>${label}</h3><div class="sprite-grid"></div>`;
    for (let i = 0; i < 8; i++) { const tile = document.createElement('figure'); tile.innerHTML = `<img loading="lazy" src="/assets/ui/${folder}/${String(i).padStart(2, '0')}.png" alt="${label} frame ${i + 1}"><figcaption>FRAME ${String(i + 1).padStart(2, '0')}</figcaption>`; group.querySelector('.sprite-grid')!.append(tile); }
    gallery.append(group);
  }
}
function renderSelect(shell: HTMLElement) {
  if (selectionMode === 'training') shell.classList.add('training-select');
  shell.innerHTML = `<header class="topbar"><button class="text-button" id="back">← KEMBALI</button><span>KONOHA FIGHTER <i>●</i> PILIH PETARUNG</span><span>LOCAL VERSUS</span></header><section class="select-stage"><article class="selected-showcase p1"><span>PLAYER 1</span><img id="p1portrait" alt="Petarung Player 1"><h2 id="p1name"></h2><div class="preview-skills" id="p1skills"></div></article><div class="roster-console"><div class="roster-title">CHOOSE YOUR FIGHTER</div><div class="roster-slots" id="roster"></div><div class="slot-selector"><button data-active-slot="0">ATUR P1</button><button data-active-slot="1">ATUR P2</button></div><button class="primary" id="start">MULAI PERTANDINGAN ↗</button></div><article class="selected-showcase p2"><span>PLAYER 2</span><img id="p2portrait" alt="Petarung Player 2"><h2 id="p2name"></h2><div class="preview-skills" id="p2skills"></div></article></section>`;
  shell.querySelector<HTMLButtonElement>('#back')!.onclick = () => setPage('menu');
  let activeSlot: 0 | 1 = 0;
  if (selectionMode === 'training') {
    shell.querySelector('.topbar span:last-child')!.textContent = 'MODE TRAINING';
    shell.querySelector('#start')!.textContent = 'MULAI TRAINING  ↗';
    shell.querySelector('.selected-showcase.p2')!.innerHTML = '<span>TARGET LATIHAN</span><img src="/assets/characters/bot-sawit/idle.png" alt="Bot Sawit"><h2>BOT SAWIT</h2>';
    shell.querySelector<HTMLButtonElement>('[data-active-slot="1"]')!.remove();
  }
  const roster = shell.querySelector('#roster')!;
  CHARACTERS.forEach((c, index) => {
    const tile = document.createElement('button'); tile.className = `roster-tile fighter-${c.id}`; tile.dataset.character = c.id;
    tile.innerHTML = `<img src="/assets/characters/${c.id}/idle_0.png" alt="${c.name}"><span>${c.name}</span>`;
    tile.onclick = () => { chosen[activeSlot] = c.id; beep(index ? 520 : 620); updateSelected(); if (selectionMode === 'versus') activeSlot = activeSlot === 0 ? 1 : 0; updateActiveSlot(); };
    roster.append(tile);
  });
  for (let i = 0; i < 10; i++) { const locked = document.createElement('div'); locked.className = 'roster-tile locked'; locked.innerHTML = '<b>?</b><span>COMING SOON</span>'; roster.append(locked); }
  const updateActiveSlot = () => shell.querySelectorAll<HTMLButtonElement>('[data-active-slot]').forEach(button => button.classList.toggle('active', Number(button.dataset.activeSlot) === activeSlot));
  shell.querySelectorAll<HTMLButtonElement>('[data-active-slot]').forEach(button => button.onclick = () => { activeSlot = Number(button.dataset.activeSlot) as 0 | 1; updateActiveSlot(); });
  const updateSelected = () => {
    const p1 = CHARACTERS.find(c => c.id === chosen[0])!, p2 = CHARACTERS.find(c => c.id === chosen[1])!;
    shell.querySelector('#p1name')!.textContent = p1.name; shell.querySelector<HTMLImageElement>('#p1portrait')!.src = `/assets/characters/${p1.id}/idle_0.png`;
    shell.querySelector('#p1skills')!.innerHTML = skillDetailMarkup(p1.id);
    if (selectionMode === 'versus') { shell.querySelector('#p2name')!.textContent = p2.name; shell.querySelector<HTMLImageElement>('#p2portrait')!.src = `/assets/characters/${p2.id}/idle_0.png`; shell.querySelector('#p2skills')!.innerHTML = skillDetailMarkup(p2.id); }
    shell.querySelectorAll<HTMLElement>('[data-character]').forEach(tile => { tile.classList.toggle('selected-p1', tile.dataset.character === chosen[0]); tile.classList.toggle('selected-p2', selectionMode === 'versus' && tile.dataset.character === chosen[1]); });
  }; updateSelected(); updateActiveSlot();
  let idleFrame = 0;
  const animatePreviews = () => {
    if (!shell.isConnected) return;
    idleFrame = 1 - idleFrame;
    const p1 = shell.querySelector<HTMLImageElement>('#p1portrait'); if (p1) p1.src = `/assets/characters/${chosen[0]}/idle_${idleFrame}.png`;
    const p2 = shell.querySelector<HTMLImageElement>('#p2portrait'); if (p2 && selectionMode === 'versus') p2.src = `/assets/characters/${chosen[1]}/idle_${idleFrame}.png`;
    window.setTimeout(animatePreviews, 420);
  };
  window.setTimeout(animatePreviews, 420);
  shell.querySelector<HTMLButtonElement>('#start')!.onclick = () => { void enterImmersive(); beginMatchTransition(); };
}

function beginMatchTransition() {
  world = selectionMode === 'training' ? createTrainingWorld(chosen[0]) : createWorld(chosen);
  queuedSkill[0] = queuedSkill[1] = null;
  setPage('versus');
}

function battleAssetUrls() {
  const urls = ['/assets/stages/civic-plaza.webp'];
  for (const id of [...new Set(world.fighters.map(f => f.characterId))]) {
    if (id === 'bot-sawit') for (const frame of ['idle', 'hit_right', 'hit_left', 'recover']) urls.push(`/assets/characters/bot-sawit/${frame}.png`);
    else for (const frame of [...CHARACTER_FRAMES, ...(id === 'king-etanol' ? ROBOT_FRAMES : [])]) urls.push(`/assets/characters/${id}/${frame}.png`);
  }
  for (const folder of ['boar-charge', 'ethanol-flame', 'ethanol-jet', 'black-oil', 'robot-laser', 'mamang-shuuu', 'mamang-angels', 'mamang-lightning', 'stun-aura']) for (let frame = 0; frame < 8; frame++) urls.push(`/assets/vfx/${folder}/${String(frame).padStart(2, '0')}.png`);
  for (const folder of ['skill-button', 'combat-announcements/ko', 'mobile-controls/analog', 'mobile-controls/punch', 'mobile-controls/kick', 'mobile-controls/def']) for (let frame = 0; frame < 8; frame++) urls.push(`/assets/ui/${folder}/${String(frame).padStart(2, '0')}.png`);
  return [...new Set(urls)];
}

async function preloadBattleAssets(urls: string[], onProgress: (loaded: number, total: number) => void) {
  let cursor = 0, loaded = 0;
  const worker = async () => {
    while (cursor < urls.length) {
      const url = urls[cursor++];
      await new Promise<void>(resolve => {
        const image = new Image();
        image.onload = image.onerror = () => resolve();
        image.src = url;
      });
      onProgress(++loaded, urls.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(6, urls.length) }, worker));
}

function renderVersus(shell: HTMLElement) {
  const serial = ++transitionSerial;
  const left = characterFor(world.fighters[0]), right = characterFor(world.fighters[1]);
  const rightIdle = right.id === 'bot-sawit' ? '/assets/characters/bot-sawit/idle.png' : `/assets/characters/${right.id}/idle_0.png`;
  shell.innerHTML = `<div class="versus-backdrop"></div><header class="versus-heading"><span>${world.mode === 'training' ? 'TRAINING MODE' : `ROUND ${String(world.round).padStart(2, '0')}`}</span><b>NEXT BATTLE</b></header><section class="versus-fighter left"><img id="versusP1" src="/assets/characters/${left.id}/idle_0.png" alt="${left.name}"><div><small>PLAYER 1</small><h2>${left.name}</h2><p>${left.title}</p></div></section><img id="versusMark" class="versus-mark" src="/assets/ui/combat-announcements/vs/00.png" alt="VS"><section class="versus-fighter right"><img id="versusP2" src="${rightIdle}" alt="${right.name}"><div><small>${world.mode === 'training' ? 'TARGET' : 'PLAYER 2'}</small><h2>${right.name}</h2><p>${right.title}</p></div></section><footer class="versus-loading"><div class="versus-loading-copy"><span id="loadingLabel">MEMUAT ARENA</span><strong id="loadingPercent">0%</strong></div><div class="versus-loading-track"><i id="loadingBar"></i></div><small>MENYIAPKAN SPRITE DAN EFEK PERTARUNGAN</small></footer>`;
  const mark = shell.querySelector<HTMLImageElement>('#versusMark')!;
  animateImage(mark, '/assets/ui/combat-announcements/vs', false, 230);
  let idleFrame = 0;
  const animateIdle = () => {
    if (!shell.isConnected || page !== 'versus') return;
    idleFrame = 1 - idleFrame;
    shell.querySelector<HTMLImageElement>('#versusP1')!.src = `/assets/characters/${left.id}/idle_${idleFrame}.png`;
    if (right.id !== 'bot-sawit') shell.querySelector<HTMLImageElement>('#versusP2')!.src = `/assets/characters/${right.id}/idle_${idleFrame}.png`;
    window.setTimeout(animateIdle, 430);
  };
  window.setTimeout(animateIdle, 430);
  const started = performance.now();
  void preloadBattleAssets(battleAssetUrls(), (loaded, total) => {
    if (!shell.isConnected) return;
    const percent = Math.round(loaded / total * 100);
    shell.querySelector<HTMLElement>('#loadingPercent')!.textContent = `${percent}%`;
    shell.querySelector<HTMLElement>('#loadingBar')!.style.width = `${percent}%`;
  }).then(() => {
    if (!shell.isConnected || page !== 'versus' || serial !== transitionSerial) return;
    shell.querySelector('#loadingLabel')!.textContent = 'PERTANDINGAN SIAP';
    const remaining = Math.max(0, 3200 - (performance.now() - started));
    window.setTimeout(() => { if (page === 'versus' && serial === transitionSerial) setPage('battle'); }, remaining);
  });
}

function renderBattle(shell: HTMLElement) {
  if (world.mode === 'training') shell.classList.add('training-battle');
  shell.innerHTML = `<div class="battle-wrap"><div class="battle-top"><button class="text-button" id="leave">← MENU</button><span>LOCAL VERSUS / ROUND <span id="roundLabel">1</span></span><button class="text-button" id="pause">PAUSE Ⅱ</button></div><div class="game-frame"><div id="game"></div><div class="hud"><div class="hud-side"><div class="hud-name"><span>P1</span><b id="name1"></b><small id="wins1"></small></div><div class="health"><div id="hp1"></div></div><div class="energy"><div id="en1"></div></div></div><div class="hud-center"><span>ROUND <b id="round">01</b></span><strong id="timer">60</strong><small>TIME</small></div><div class="hud-side right"><div class="hud-name"><small id="wins2"></small><b id="name2"></b><span>P2</span></div><div class="health"><div id="hp2"></div></div><div class="energy"><div id="en2"></div></div></div></div><div class="announce" id="announce"></div><div class="pause-overlay" id="pauseOverlay"><h2>PAUSED</h2><p>TEKAN ESC UNTUK LANJUT</p></div></div><div class="battle-bottom"><span>P1: A D W S · J K L · U BLOCK</span><span>H: HITBOX DEBUG <i>✦</i> ESC: PAUSE</span><span>P2: ← → ↑ ↓ · 1 2 3 · 0 BLOCK</span></div></div>`;
  const training = world.mode === 'training';
  if (training) {
    shell.querySelector<HTMLButtonElement>('#leave')!.textContent = 'SELESAI TRAINING';
    shell.querySelector('.battle-top > span')!.textContent = 'MODE TRAINING / BOT SAWIT';
    shell.querySelector('.battle-bottom span:last-child')!.textContent = 'BOT SAWIT: TARGET ABADI';
    shell.querySelector('.hud-center > span')!.textContent = 'TRAINING';
    shell.querySelector('.hud-center small')!.textContent = 'TANPA BATAS WAKTU';
    shell.querySelector('.hud-side.right .hud-name span')!.textContent = 'BOT';
  }
  shell.querySelector<HTMLButtonElement>('#leave')!.onclick = () => { paused = false; queuedSkill[0] = queuedSkill[1] = null; setPage('menu'); };
  shell.querySelector<HTMLButtonElement>('#pause')!.onclick = togglePause;
  const gameFrame = shell.querySelector('.game-frame')!;
  const koImage = document.createElement('img'); koImage.id = 'koAnimation'; koImage.className = 'combat-announcement ko-announcement'; koImage.alt = 'K.O.'; gameFrame.append(koImage);
  const comboFlash = document.createElement('div'); comboFlash.id = 'comboFlash'; comboFlash.className = 'combo-flash'; comboFlash.textContent = '3 HIT COMBO!'; gameFrame.append(comboFlash);
  const strip = document.createElement('div'); strip.className = 'skill-strip';
  for (const slot of (training ? [0] : [0, 1]) as (0 | 1)[]) {
    const group = document.createElement('div'); group.className = `skill-group skill-group-${slot}`;
    const details = SKILL_DETAILS[world.fighters[slot].characterId];
    for (const [key, hotkey] of [['special', slot === 0 ? 'L' : '3'], ['normal', slot === 0 ? 'I' : '4'], ['ultimate', slot === 0 ? 'O' : '5']] as [SkillKey, string][]) {
      const b = document.createElement('button'); b.className = 'skill-button'; b.dataset.slot = String(slot); b.dataset.skill = key;
      b.title = details[key].description;
      b.innerHTML = `<strong>${details[key].name}</strong><small>${hotkey} · <span class="skill-status">READY</span></small>`;
      b.onclick = () => { queuedSkill[slot] = key; beep(slot === 0 ? 420 : 560, 0.06); };
      group.append(b);
    }
    strip.append(group);
  }
  shell.querySelector('.battle-bottom')!.before(strip);
  const labels = shell.querySelectorAll('.battle-bottom span');
  labels[0].textContent = 'P1: A D W S · J K · L I O SKILL · U BLOCK';
  labels[2].textContent = training ? 'BOT SAWIT: TARGET ABADI' : 'P2: ← → ↑ ↓ · 1 2 · 3 4 5 SKILL · 0 BLOCK';
  shell.querySelector('#name1')!.textContent = characterFor(world.fighters[0]).name;
  shell.querySelector('#name2')!.textContent = characterFor(world.fighters[1]).name;
  const mobileSkillDetails = SKILL_DETAILS[world.fighters[0].characterId];
  const mobileAttacks = characterFor(world.fighters[0]).attacks;
  const controls = document.createElement('div'); controls.className = 'mobile-controls controls-custom';
  controls.style.setProperty('--stick-x', `${settings.stickX}%`); controls.style.setProperty('--stick-y', `${settings.stickY}%`);
  controls.style.setProperty('--cluster-x', `${settings.clusterX}%`); controls.style.setProperty('--cluster-y', `${settings.clusterY}%`);
  controls.style.setProperty('--control-scale', String(settings.controlScale));
  const skillEmblem = (key: SkillKey) => `<img class="button-skill-emblem" src="/assets/ui/skill-emblems/${world.fighters[0].characterId}-${key}.png" alt="">`;
  controls.innerHTML = `
    <div class="mobile-stick" aria-label="Analog: gerak, lompat, dan merunduk">
      <img class="control-sprite analog-sprite" src="/assets/ui/mobile-controls/analog/00.png" alt="">
      <div class="stick-knob"></div>
      <strong><span>MOVE</span><i>↑ JUMP · ↓ CROUCH</i></strong>
    </div>
    <div class="mobile-combat-cluster" aria-label="Kontrol serangan dan skill">
      <div class="mobile-skills">
        <button data-skill="special" title="${mobileSkillDetails.special.description}"><b>S1</b><img src="/assets/ui/skill-button/00.png" alt="">${skillEmblem('special')}<span>${mobileSkillDetails.special.short}</span><small>${mobileAttacks.special.energyCost} EN</small></button>
        <button data-skill="normal" title="${mobileSkillDetails.normal.description}"><b>S2</b><img src="/assets/ui/skill-button/02.png" alt="">${skillEmblem('normal')}<span>${mobileSkillDetails.normal.short}</span><small>${mobileAttacks.normal.energyCost} EN</small></button>
        <button data-skill="ultimate" title="${mobileSkillDetails.ultimate.description}"><b>S3</b><img src="/assets/ui/skill-button/05.png" alt="">${skillEmblem('ultimate')}<span>${mobileSkillDetails.ultimate.short}</span><small>${mobileAttacks.ultimate.energyCost} EN</small></button>
      </div>
      <div class="mobile-actions">
        <button data-action="block" aria-label="Tahan untuk menangkis"><img src="/assets/ui/mobile-controls/def/00.png" alt=""><span>DEF</span></button>
        <button data-action="heavy"><img src="/assets/ui/mobile-controls/kick/00.png" alt=""><span>KICK</span></button>
        <button data-action="light"><img src="/assets/ui/mobile-controls/punch/00.png" alt=""><span>PUNCH</span></button>
      </div>
    </div>`;
  gameFrame.append(controls); bindMobileControls(controls);
  game = new Phaser.Game({ type: Phaser.AUTO, parent: 'game', width: 960, height: 540,
    backgroundColor: '#121b2a', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { pixelArt: true, antialias: false }, scene: [BattleScene] });
}
function togglePause() { if (page !== 'battle') return; paused = !paused; document.querySelector('#pauseOverlay')?.classList.toggle('show', paused); }
function renderResult(shell: HTMLElement) {
  const winner = world.winner ?? 0, c = characterFor(world.fighters[winner]);
  shell.innerHTML = `<div class="result-glow"></div><header class="topbar"><span>KONOHA FIGHTER</span><span>FINAL RESULT / ROUND ${world.round}</span></header><img class="result-fighter" src="/assets/characters/${c.id}/victory.png" alt="${c.name}"><section class="result-content"><span class="section-number">MATCH COMPLETE</span><div class="result-symbol">勝</div><p>THE WINNER IS</p><h1>${c.name}</h1><h2>${c.title}</h2><div class="scoreline"><span>${characterFor(world.fighters[0]).name}</span><strong>${world.fighters[0].wins} : ${world.fighters[1].wins}</strong><span>${characterFor(world.fighters[1]).name}</span></div><div class="result-actions" id="resultActions"></div></section>`;
  shell.querySelector('#resultActions')!.append(button('REMATCH  ↗', () => { selectionMode = 'versus'; beginMatchTransition(); }, 'primary'), button('KEMBALI KE MENU', () => setPage('menu'), 'secondary'));
}

const MAP: [Record<keyof Input, string>, Record<keyof Input, string>] = [
  { left: 'KeyA', right: 'KeyD', jump: 'KeyW', crouch: 'KeyS', block: 'KeyU', light: 'KeyJ', heavy: 'KeyK', special: 'KeyL', normal: 'KeyI', ultimate: 'KeyO' },
  { left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp', crouch: 'ArrowDown', block: 'Numpad0', light: 'Numpad1', heavy: 'Numpad2', special: 'Numpad3', normal: 'Numpad4', ultimate: 'Numpad5' },
];
const held = new Set<string>();
window.addEventListener('keydown', e => {
  if (page === 'battle' && (e.code.startsWith('Arrow') || e.code.startsWith('Numpad') || e.code === 'Space')) e.preventDefault();
  if (e.code === 'Escape' && !e.repeat) togglePause();
  if (e.code === 'KeyH' && !e.repeat) debug = !debug;
  held.add(e.code);
});
window.addEventListener('keyup', e => held.delete(e.code));
window.addEventListener('blur', () => held.clear());
function inputFor(slot: 0 | 1): Input {
  const mapping = MAP[slot], value = { ...NEUTRAL_INPUT };
  for (const action of Object.keys(mapping) as (keyof Input)[]) value[action] = held.has(mapping[action]) || (slot === 0 && touchInput[action]) || (slot === 1 && ['block', 'light', 'heavy', 'special', 'normal', 'ultimate'].includes(action) && held.has(`Digit${({ block: 0, light: 1, heavy: 2, special: 3, normal: 4, ultimate: 5 } as Record<string, number>)[action]}`)) || queuedSkill[slot] === action;
  queuedSkill[slot] = null;
  return value;
}

function bindMobileControls(root: HTMLElement) {
  const stick = root.querySelector<HTMLElement>('.mobile-stick')!, knob = root.querySelector<HTMLElement>('.stick-knob')!;
  const moveStick = (event: PointerEvent) => {
    const rect = stick.getBoundingClientRect(), dx = event.clientX - (rect.left + rect.width / 2), dy = event.clientY - (rect.top + rect.height / 2);
    const limit = rect.width * .28, length = Math.hypot(dx, dy) || 1, scale = Math.min(1, limit / length);
    knob.style.transform = `translate(${dx * scale}px,${dy * scale}px)`;
    touchInput.left = dx < -rect.width * .13; touchInput.right = dx > rect.width * .13;
    touchInput.jump = dy < -rect.height * .18; touchInput.crouch = dy > rect.height * .18;
  };
  const releaseStick = () => { touchInput.left = touchInput.right = touchInput.jump = touchInput.crouch = false; knob.style.transform = ''; stick.classList.remove('active'); };
  stick.onpointerdown = event => { stick.setPointerCapture(event.pointerId); stick.classList.add('active'); moveStick(event); };
  stick.onpointermove = event => { if (stick.hasPointerCapture(event.pointerId)) moveStick(event); };
  stick.onpointerup = stick.onpointercancel = releaseStick;
  root.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button => {
    const action = button.dataset.action as 'light' | 'heavy' | 'block';
    const release = () => { touchInput[action] = false; button.classList.remove('pressed'); };
    button.onpointerdown = event => { event.preventDefault(); button.setPointerCapture(event.pointerId); touchInput[action] = true; button.classList.add('pressed'); beep(action === 'block' ? 520 : action === 'heavy' ? 190 : 280, .04); };
    button.onpointerup = button.onpointercancel = release;
  });
  root.querySelectorAll<HTMLButtonElement>('[data-skill]').forEach((button, index) => {
    const skill = button.dataset.skill as SkillKey;
    button.onclick = () => { queuedSkill[0] = skill; button.classList.add('burst'); window.setTimeout(() => button.classList.remove('burst'), 400); beep(480 + index * 120, .07); };
    const image = button.querySelector('img')!; animateImage(image, '/assets/ui/skill-button', true, 82);
  });
  animateImage(root.querySelector<HTMLImageElement>('.analog-sprite')!, '/assets/ui/mobile-controls/analog', true, 88);
  root.querySelectorAll<HTMLButtonElement>('.mobile-actions button').forEach(button => {
    const action = button.dataset.action as 'light' | 'heavy' | 'block';
    animateImage(button.querySelector('img')!, `/assets/ui/mobile-controls/${action === 'light' ? 'punch' : action === 'heavy' ? 'kick' : 'def'}`, true, 78);
  });
}

class BattleScene extends Phaser.Scene {
  private art!: Phaser.GameObjects.Graphics;
  private fighterImages!: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private effectImages = new Map<number, { body: Phaser.GameObjects.Image; jet?: Phaser.GameObjects.Image; angels?: Phaser.GameObjects.Image[]; lightning?: Phaser.GameObjects.Image }>();
  private stunImages!: [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
  private cinematicShade!: Phaser.GameObjects.Rectangle;
  private elapsed = 0;
  private shake = 0;
  private sparks: { x: number; y: number; life: number; color: number }[] = [];
  constructor() { super('Battle'); }
  preload() {
    this.load.image('arena', '/assets/stages/civic-plaza.webp');
    for (const name of ['idle', 'hit_right', 'hit_left', 'recover']) this.load.image(`bot-sawit-${name}`, `/assets/characters/bot-sawit/${name}.png`);
    for (const id of ['boar-charge', 'ethanol-flame', 'ethanol-jet', 'black-oil', 'robot-laser', 'mamang-shuuu', 'mamang-angels', 'mamang-lightning', 'stun-aura'])
      for (let i = 0; i < 8; i++) this.load.image(`${id}-${i}`, `/assets/vfx/${id}/${String(i).padStart(2, '0')}.png`);
    for (const c of CHARACTERS) {
      for (const name of [...CHARACTER_FRAMES, ...(c.id === 'king-etanol' ? ROBOT_FRAMES : [])])
        this.load.image(`${c.id}-${name}`, `/assets/characters/${c.id}/${name}.png`);
    }
  }
  create() {
    this.add.image(480, 270, 'arena').setDisplaySize(960, 540);
    this.cinematicShade = this.add.rectangle(480, 270, 960, 540, 0x050414, 0).setDepth(1);
    this.fighterImages = [0, 1].map((index) => {
      const id = world.fighters[index].characterId;
      return this.add.image(0, 0, id === 'bot-sawit' ? 'bot-sawit-idle' : `${id}-idle_0`).setOrigin(0.5, 1).setScale(id === 'bot-sawit' ? 0.43 : 0.39).setDepth(2);
    }) as [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
    this.stunImages = [0, 1].map(() => this.add.image(0, 0, 'stun-aura-0').setDepth(3).setVisible(false).setScale(0.32)) as [Phaser.GameObjects.Image, Phaser.GameObjects.Image];
    this.art = this.add.graphics().setDepth(3);
  }
  update(_time: number, delta: number) {
    if (!paused) {
      this.elapsed = Math.min(this.elapsed + delta, 250);
      let count = 0;
      while (this.elapsed >= 1000 / RULES.hz && count++ < 15) {
        this.elapsed -= 1000 / RULES.hz;
        stepWorld(world, [inputFor(0), world.mode === 'training' ? NEUTRAL_INPUT : inputFor(1)]);
        for (const event of world.events) {
          if (event.type === 'hit' || event.type === 'ko' || event.type === 'block') {
            const target = world.fighters[event.player ?? 0];
            this.sparks.push({ x: target.x, y: target.y - 74, life: 13, color: event.type === 'block' ? 0x83dfff : 0xffca70 });
            this.shake = event.type === 'block' ? 2 : 6; beep(event.type === 'block' ? 700 : 160, 0.11);
            if (event.type === 'ko') {
              const ko = document.querySelector<HTMLImageElement>('#koAnimation');
              if (ko) { ko.classList.add('show'); animateImage(ko, '/assets/ui/combat-announcements/ko', false, 85); window.setTimeout(() => ko.classList.remove('show'), 1500); }
            }
          }
          if (event.type === 'fight') beep(740, 0.25);
          if (event.type === 'round') beep(100, 0.5);
          if (event.type === 'combo') {
            const flash = document.querySelector<HTMLElement>('#comboFlash');
            if (flash) { flash.classList.remove('show'); void flash.offsetWidth; flash.classList.add('show'); window.setTimeout(() => flash.classList.remove('show'), 1200); }
            beep(960, 0.22);
          }
        }
        if (world.phase === 'matchEnd') { setPage('result'); return; }
        this.sparks.forEach(s => s.life--); this.sparks = this.sparks.filter(s => s.life > 0);
      }
    }
    this.drawArena(); this.updateHud();
  }
  private drawArena() {
    const g = this.art; g.clear();
    const shakeX = this.shake > 0 ? Math.sin(this.shake * 9) * this.shake : 0;
    this.shake = Math.max(0, this.shake - 0.5);
    g.setPosition(shakeX, -mobileFloorLift());
    const cinematic = world.effects.find(effect => effect.kind === 'angels' || effect.kind === 'robot-laser');
    const shadeStrength = cinematic?.kind === 'angels' ? 0.68 : 0.42;
    this.cinematicShade.setAlpha(cinematic ? Math.min(shadeStrength, cinematic.age / 15 * shadeStrength) * Math.min(1, (cinematic.life - cinematic.age) / 10) : 0);
    world.fighters.forEach(f => {
      if (f.slowFrames <= 0) return;
      g.fillStyle(0x170b2f, 0.5); g.fillEllipse(f.x, f.y - 3, 112, 23);
      g.lineStyle(3, 0x8f56ff, 0.72); g.strokeEllipse(f.x, f.y - 3, 112 + Math.sin(world.tick / 5) * 8, 23);
    });
    world.fighters.forEach((f, i) => this.drawFighter(f, i, shakeX));
    world.fighters.forEach((f, i) => {
      const aura = this.stunImages[i], visible = f.state === 'STUN';
      aura.setVisible(visible);
      if (visible) aura.setTexture(`stun-aura-${Math.floor(world.tick / 5) % 8}`).setPosition(f.x + shakeX, f.y - (f.characterId === 'bot-sawit' ? 160 : 115) - mobileFloorLift());
    });
    this.syncEffects(shakeX);
    for (const s of this.sparks) { g.lineStyle(3, s.color, s.life / 13); const radius = 19 - s.life;
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.lineBetween(s.x + Math.cos(a) * 3, s.y + Math.sin(a) * 3, s.x + Math.cos(a) * (radius + 13), s.y + Math.sin(a) * (radius + 13)); } }
    if (debug) world.fighters.forEach(f => {
      const h = hurtbox(f), p = pushbox(f), a = hitbox(f);
      g.lineStyle(2, 0x49e7a7); g.strokeRect(h.x, h.y, h.w, h.h);
      g.lineStyle(2, 0xf4de74); g.strokeRect(p.x, p.y, p.w, p.h);
      if (a) { g.lineStyle(2, 0xff636f); g.strokeRect(a.x, a.y, a.w, a.h); }
    });
    if (debug) world.effects.forEach(effect => {
      if ((effect.kind === 'boar' && effect.hitCount > 0) || (effect.kind === 'flame' && (effect.age < 10 || effect.age > 48))) return;
      const box = skillEffectHitbox(effect); g.lineStyle(2, 0xff636f); g.strokeRect(box.x, box.y, box.w, box.h);
    });
  }
  private syncEffects(shakeX: number) {
    const active = new Set<number>();
    const floorLift = mobileFloorLift();
    for (const effect of world.effects) {
      active.add(effect.id);
      let visual = this.effectImages.get(effect.id);
      const name = ({ boar: 'boar-charge', flame: 'ethanol-flame', shuuu: 'mamang-shuuu', angels: 'mamang-angels', 'black-oil': 'black-oil', 'robot-laser': 'robot-laser' } as const)[effect.kind];
      const frame = effect.kind === 'boar' ? Math.floor(effect.age / 4) % 8
        : effect.kind === 'flame' ? Math.min(7, Math.floor(effect.age / 7))
        : effect.kind === 'black-oil' ? Math.min(7, Math.floor(effect.age / 12))
        : effect.kind === 'robot-laser' ? Math.min(7, Math.floor(effect.age / 5))
        : effect.kind === 'shuuu' ? (effect.hitCount
          ? 4 + Math.min(3, Math.floor((10 - (effect.life - effect.age)) / 3))
          : Math.floor(effect.age / 12) % 4)
        : Math.floor(effect.age / 5) % 8;
      if (!visual) {
        visual = { body: this.add.image(effect.x, effect.y, `${name}-${frame}`).setOrigin(0.5, 1).setDepth(4) };
        if (effect.kind === 'flame') visual.jet = this.add.image(effect.x, effect.y, 'ethanol-jet-0').setDepth(4.1);
        if (effect.kind === 'angels') {
          visual.angels = Array.from({ length: 4 }, () => this.add.image(effect.x, effect.y, 'mamang-angels-0').setDepth(4));
          visual.lightning = this.add.image(effect.x, effect.y, 'mamang-lightning-0').setOrigin(0.5, 1).setDepth(4.5);
        }
        this.effectImages.set(effect.id, visual);
      }
      visual.body.setTexture(`${name}-${frame}`);
      if (effect.kind === 'angels') {
        const angels = [visual.body, ...(visual.angels ?? [])];
        angels.forEach((sprite, index) => {
          const angle = effect.age * 0.075 + index * Math.PI * 2 / 5;
          const orbitX = Math.cos(angle) * 84, orbitY = Math.sin(angle) * 26;
          sprite.setTexture(`mamang-angels-${(frame + index) % 8}`)
            .setOrigin(0.5, 0.5).setPosition(effect.x + orbitX + shakeX, effect.y - 183 + orbitY - floorLift)
            .setScale(0.22 + (orbitY + 26) / 26 * 0.018).setAlpha(Math.min(1, Math.max(0, (effect.age - index * 5) / 12)));
        });
        const strike = effect.age >= 67 && effect.age <= 100;
        visual.lightning?.setVisible(strike);
        if (strike) visual.lightning?.setTexture(`mamang-lightning-${Math.min(7, Math.floor((effect.age - 67) / 4))}`)
          .setPosition(effect.x + shakeX, effect.y - floorLift).setScale(0.76).setAlpha(effect.age > 94 ? (101 - effect.age) / 7 : 1);
        continue;
      }
      if (effect.kind === 'black-oil') {
        visual.body.setOrigin(0.5, 1).setPosition(effect.x + shakeX, effect.y + 5 - floorLift)
          .setFlipX(false).setScale(1.84, 0.68).setDepth(1.8)
          .setAlpha(effect.age > effect.life - 30 ? (effect.life - effect.age) / 30 : 1);
        continue;
      }
      if (effect.kind === 'robot-laser') {
        visual.body.setOrigin(effect.facing === 1 ? 0 : 1, 0.5)
          .setPosition(effect.x + shakeX, effect.y - 105 - floorLift).setFlipX(effect.facing === -1)
          .setScale(1.28).setAlpha(effect.age > effect.life - 8 ? (effect.life - effect.age) / 8 : 1);
        continue;
      }
      visual.body.setPosition(effect.x + shakeX, effect.y + (effect.kind === 'shuuu' ? -55 : 2) - floorLift);
      visual.body.setFlipX(effect.facing === -1);
      visual.body.setScale(effect.kind === 'boar' ? 0.30 : effect.kind === 'shuuu' ? 0.53 : 0.34);
      visual.body.setAlpha(effect.kind === 'shuuu' && effect.hitCount ? Math.max(0, (effect.life - effect.age) / 10) : 1);
      if (visual.jet) {
        const visible = effect.age >= 10 && effect.age <= 48;
        visual.jet.setVisible(visible);
        if (visible) {
          visual.jet.setTexture(`ethanol-jet-${Math.min(7, Math.floor((effect.age - 10) / 5))}`);
          visual.jet.setOrigin(effect.facing === 1 ? 0 : 1, 0.5);
          visual.jet.setPosition(effect.x + effect.facing * 18 + shakeX, effect.y - 135 - floorLift);
          visual.jet.setFlipX(effect.facing === -1);
          visual.jet.setScale(0.68);
        }
      }
    }
    for (const [id, visual] of this.effectImages) if (!active.has(id)) {
      visual.body.destroy(); visual.jet?.destroy(); visual.angels?.forEach(sprite => sprite.destroy()); visual.lightning?.destroy(); this.effectImages.delete(id);
    }
  }
  private drawFighter(f: Fighter, index: number, shakeX: number) {
    const image = this.fighterImages[index];
    const visualY = f.y - mobileFloorLift();
    if (f.characterId === 'bot-sawit') {
      const frame = f.state === 'HIT_STUN' || f.state === 'STUN' ? (f.stateFrame % 8 < 4 ? 'hit_right' : 'hit_left') : f.stateFrame < 15 ? 'recover' : 'idle';
      image.setTexture(`bot-sawit-${frame}`).setPosition(f.x + shakeX, visualY).setFlipX(false).setAlpha(1);
      return;
    }
    const specialFrame = f.characterId === 'king-etanol' && f.attack === 'ultimate'
      ? `robot_${Math.min(7, Math.floor(f.stateFrame / 8))}`
      : f.characterId === 'king-etanol' && f.attack === 'normal' ? `crouch_punch_${Math.floor(f.stateFrame / 8) % 2}` : 'special';
    const frame = f.state === 'IDLE' ? `idle_${Math.floor(world.tick / 22) % 2}`
      : f.state.startsWith('WALK') ? `walk_${Math.floor(world.tick / 7) % 2}`
      : ({ CROUCH: 'crouch', JUMP_ASCEND: 'jump_start', JUMP_FALL: 'jump_air', LIGHT_ATTACK: 'light', HEAVY_ATTACK: 'heavy', AIR_LIGHT_ATTACK: `jump_punch_${Math.floor(f.stateFrame / 5) % 2}`, AIR_HEAVY_ATTACK: `jump_kick_${Math.floor(f.stateFrame / 6) % 2}`, CROUCH_LIGHT_ATTACK: `crouch_punch_${Math.floor(f.stateFrame / 5) % 2}`, CROUCH_HEAVY_ATTACK: `crouch_kick_${Math.floor(f.stateFrame / 6) % 2}`, SPECIAL_ATTACK: specialFrame, BLOCK: `block_${Math.floor(f.stateFrame / 10) % 2}`, BLOCK_HIT: 'block_hit', HIT_STUN: 'hit', STUN: `stun_${Math.floor(f.stateFrame / 8) % 2}`, KNOCKDOWN: 'knockdown', GET_UP: 'get_up', KO: 'ko', ROUND_WIN: 'victory' } as Record<string, string>)[f.state] ?? 'land';
    image.setTexture(`${f.characterId}-${frame}`);
    image.setPosition(f.x + shakeX, visualY);
    image.setFlipX(f.facing === -1);
    image.setAlpha((f.state === 'HIT_STUN' || f.state === 'STUN') && Math.floor(world.tick / 4) % 2 ? 0.72 : 1);
    image.clearTint();
    if (f.slowFrames > 0) image.setTint(0xb994ff);
  }
  private updateHud() {
    const [a, b] = world.fighters;
    const put = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
    const width = (id: string, value: number) => { const el = document.getElementById(id); if (el) el.style.width = `${value}%`; };
    width('hp1', a.hp / RULES.maxHp * 100); width('hp2', b.hp / RULES.maxHp * 100); width('en1', a.energy); width('en2', b.energy);
    document.querySelectorAll<HTMLButtonElement>('.skill-button').forEach(button => {
      const slot = Number(button.dataset.slot), key = button.dataset.skill as SkillKey;
      const fighter = world.fighters[slot], attack = characterFor(fighter).attacks[key];
      const cooldown = fighter.cooldowns[key];
      button.disabled = world.phase !== 'fight' || fighter.energy < attack.energyCost || cooldown > 0;
      button.querySelector('.skill-status')!.textContent = world.mode === 'training' ? 'READY' : cooldown > 0 ? `${(cooldown / RULES.hz).toFixed(1)}s` : `${attack.energyCost} EN`;
    });
    document.querySelectorAll<HTMLButtonElement>('.mobile-skills [data-skill]').forEach(button => {
      const key = button.dataset.skill as SkillKey, attack = characterFor(a).attacks[key], cooldown = a.cooldowns[key];
      const unavailable = world.phase !== 'fight' || a.energy < attack.energyCost || cooldown > 0;
      button.classList.toggle('unavailable', unavailable);
      const status = button.querySelector('small');
      if (status) status.textContent = world.mode === 'training' ? 'READY' : cooldown > 0 ? `${(cooldown / RULES.hz).toFixed(1)}s` : `${attack.energyCost} EN`;
    });
    put('timer', world.mode === 'training' ? '∞' : String(Math.ceil(world.timeFrames / RULES.hz)).padStart(2, '0'));
    put('round', String(world.round).padStart(2, '0')); put('roundLabel', String(world.round));
    put('wins1', world.mode === 'training' ? 'HP + EN PENUH' : '◆'.repeat(a.wins) + '◇'.repeat(RULES.roundsToWin - a.wins));
    put('wins2', world.mode === 'training' ? 'TIDAK BISA KO' : '◆'.repeat(b.wins) + '◇'.repeat(RULES.roundsToWin - b.wins));
    const announce = document.querySelector<HTMLElement>('#announce');
    if (announce) {
      announce.textContent = world.phase === 'countdown' ? (world.phaseFrames > 120 ? `ROUND ${world.round}` : String(Math.max(1, Math.ceil(world.phaseFrames / 60)))) : world.phase === 'roundEnd' ? (world.roundWinner === null ? 'DRAW' : world.fighters.some(f => f.hp <= 0) ? '' : 'TIME UP') : '';
      announce.classList.toggle('show', Boolean(announce.textContent));
    }
  }
}
render();
