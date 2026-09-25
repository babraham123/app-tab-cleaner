// Renders assets/icon.svg to the PNG sizes browsers need, plus a greyscale variant for the paused state.
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const SIZES = [16, 32, 48, 128];
const svg = readFileSync(new URL('../assets/icon.svg', import.meta.url), 'utf8');

const toGrey = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  // Compress toward mid-grey so the paused icon reads as inactive.
  const v = Math.round(90 + (l / 255) * 110).toString(16).padStart(2, '0');
  return `#${v}${v}${v}`;
};
const paused = svg.replace(/#[0-9a-f]{6}\b/gi, toGrey).replace(/#fff\b/gi, '#e6e6e6');

for (const [prefix, source] of [['', svg], ['paused-', paused]]) {
  for (const size of SIZES) {
    const png = new Resvg(source, { fitTo: { mode: 'width', value: size } }).render().asPng();
    writeFileSync(new URL(`../public/icon/${prefix}${size}.png`, import.meta.url), png);
  }
}
console.log('Rendered', SIZES.length * 2, 'icons');
