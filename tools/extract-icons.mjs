// Pulls the icons this site uses out of the Font Awesome Free package into
// tools/icons.json. Run after adding a name to WANTED.
import { readFileSync, writeFileSync } from 'node:fs';

const WANTED = {
  envelope: 'solid', phone: 'solid', 'file-lines': 'solid', play: 'solid',
  'arrow-left': 'solid', 'arrow-right': 'solid', 'arrow-up-right-from-square': 'solid',
  code: 'solid', globe: 'solid', database: 'solid', 'shield-halved': 'solid',
  'dice-five': 'solid', utensils: 'solid', 'location-dot': 'solid',
  'circle-check': 'solid', 'circle-exclamation': 'solid', 'circle-notch': 'solid',
  'folder-open': 'solid', user: 'solid', briefcase: 'solid', 'graduation-cap': 'solid',
  terminal: 'solid', 'lock': 'solid', tag: 'solid', 'code-branch': 'solid',
  expand: 'solid', 'compress': 'solid', 'rotate-right': 'solid', house: 'solid',
  'microchip': 'solid', 'atom': 'solid', 'hospital': 'solid',
  'people-group': 'solid', 'triangle-exclamation': 'solid',
  bars: 'solid', xmark: 'solid',
  'linkedin-in': 'brands', github: 'brands', tiktok: 'brands', 'reddit-alien': 'brands',
};

const out = {};
for (const [name, kind] of Object.entries(WANTED)) {
  const svg = readFileSync(
    `node_modules/@fortawesome/fontawesome-free/svgs/${kind}/${name}.svg`, 'utf8');
  out[name] = {
    viewBox: svg.match(/viewBox="([^"]+)"/)[1],
    d: [...svg.matchAll(/<path[^>]*\bd="([^"]+)"/g)].map((m) => m[1]),
  };
}
writeFileSync('tools/icons.json', JSON.stringify(out));
console.log(`wrote ${Object.keys(out).length} icons`);
