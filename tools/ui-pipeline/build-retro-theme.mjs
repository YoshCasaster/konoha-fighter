import sharp from 'sharp';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const root = path.resolve(import.meta.dirname, '../..');
const stageSource = path.join(root, 'assets/stages/source');
const stageOutput = path.join(root, 'apps/web/public/assets/stages');
const themeOutput = path.join(root, 'apps/web/public/assets/ui/retro-theme');
await Promise.all([mkdir(stageOutput, { recursive: true }), mkdir(themeOutput, { recursive: true })]);

for (const [input, output, quality] of [
  ['retro-temple.png', 'retro-temple.webp', 78],
  ['civic-plaza.png', 'civic-plaza.webp', 80],
  ['pemilihan-karakter.jpg', 'pemilihan-karakter.webp', 80],
]) {
  await sharp(path.join(stageSource, input))
    .resize(1600, 900, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
    .webp({ quality, effort: 6, smartSubsample: true })
    .toFile(path.join(stageOutput, output));
}

const colors = [
  ['#10172c', '#293d67', '#f2b84f', '#fff0a8'],
  ['#141a30', '#314a7b', '#e6a53b', '#fff7c5'],
  ['#34121b', '#8b2530', '#ffb342', '#fff1ac'],
  ['#080b17', '#151b32', '#a76a2a', '#e5a75a'],
];
const buttonSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="96" shape-rendering="crispEdges">
  ${colors.map((c, i) => `<g transform="translate(${i * 320})">
    <path fill="${c[0]}" d="M10 0h300v4h6v6h4v76h-4v6h-6v4H10v-4H4v-6H0V10h4V4h6z"/>
    <path fill="${c[2]}" d="M10 0h300v4H10zM4 4h6v4H4zm306 0h6v4h-6zM0 10h4v76H0zm316 0h4v76h-4zM10 92h300v4H10z"/>
    <path fill="${c[1]}" d="M10 8h300v80H10z"/><path fill="#03050b" opacity=".35" d="M10 60h300v28H10z"/>
    <path fill="${c[3]}" d="M16 8h80v3H16zm-4 4h3v23h-3zm292 73h-80v3h80zm4-24h3v23h-3z"/>
    <path fill="#fff" opacity=".07" d="M18 17h284v3H18zM18 26h284v2H18z"/>
  </g>`).join('')}
</svg>`;
await sharp(Buffer.from(buttonSvg)).webp({ lossless: true, effort: 6 }).toFile(path.join(themeOutput, 'button-strip.webp'));

const panelColors = ['#efb54a', '#ffe19a', '#f36b42', '#64baf2'];
const panelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="128" shape-rendering="crispEdges">
 ${panelColors.map((color, i) => `<g transform="translate(${i * 128})">
  <path fill="#050813" opacity=".76" d="M8 0h112v4h4v4h4v112h-4v4h-4v4H8v-4H4v-4H0V8h4V4h4z"/>
  <path fill="${color}" opacity=".9" d="M8 0h34v3H8zM86 0h34v3H86zM0 8h3v34H0zm0 78h3v34H0zm125-78h3v34h-3zm0 78h3v34h-3zM8 125h34v3H8zm78 0h34v3H86z"/>
  <path fill="${color}" opacity=".28" d="M8 7h112v2H8zM8 119h112v2H8z"/>
  <path fill="#fff" opacity=".05" d="M8 18h112v2H8zm0 12h112v1H8zm0 70h112v2H8z"/>
  <path fill="${color}" d="M4 4h12v3H7v9H4zm108 0h12v12h-3V7h-9zM4 112h3v9h9v3H4zm117 0h3v12h-12v-3h9z"/>
 </g>`).join('')}
</svg>`;
await sharp(Buffer.from(panelSvg)).webp({ lossless: true, effort: 6 }).toFile(path.join(themeOutput, 'panel-strip.webp'));

await writeFile(path.join(themeOutput, 'manifest.json'), JSON.stringify({
  button: { frames: 4, canvas: [320, 96], states: ['idle-a', 'idle-b', 'focus', 'pressed'] },
  panel: { frames: 4, canvas: [128, 128], fps: 3, loop: true },
}, null, 2));
console.log('Built compressed retro backgrounds and animated UI theme sprites');
