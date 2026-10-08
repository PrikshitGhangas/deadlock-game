/**
 * Captures docs/screenshots/*.png with a headless Chromium browser (Edge or Chrome, already
 * installed on Windows/macOS/Linux desktops — nothing to npm install).
 *
 *   npm run dev            # app must be running on :5173
 *   node scripts/screenshots.mjs
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, '..', 'docs', 'screenshots');
fs.mkdirSync(outDir, { recursive: true });

const candidates = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
];
const browser = process.env.BROWSER_PATH || candidates.find((c) => fs.existsSync(c));
if (!browser) { console.error('No Chromium-based browser found. Set BROWSER_PATH.'); process.exit(1); }

const BASE = process.env.APP_URL || 'http://localhost:5173';
const shots = [
  ['01-detection-deadlock', '/?sample=classic-2&step=5&theme=light#detection'],
  ['02-detection-dark', '/?sample=ring-3&step=7&theme=dark#detection'],
  ['03-detection-victim', '/?sample=classic-2&step=6&theme=light#detection'],
  ['04-prevention-wait-die', '/?sample=prevention-compare&scheme=wait-die&step=4&theme=light#prevention'],
  ['05-prevention-wound-wait', '/?sample=prevention-compare&scheme=wound-wait&step=3&theme=light#prevention'],
  ['06-bankers-safe', '/?sample=bankers-safe&step=4&theme=light#bankers'],
  ['07-bankers-denied', '/?sample=bankers-unsafe&step=20&theme=light#bankers'],
  ['08-game-level', '/?level=L3&theme=light#game'],
  ['09-history-analytics', '/?theme=light#history'],
  ['10-theory', '/?theme=light#theory'],
  ['11-innovation', '/?theme=light#innovation'],
  ['12-developed-by', '/?theme=light#about'],
];

for (const [name, url] of shots) {
  const file = path.join(outDir, `${name}.png`);
  const args = [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    '--window-size=1440,1000', '--virtual-time-budget=8000', `--screenshot=${file}`, `${BASE}${url}`,
  ];
  try {
    execFileSync(browser, args, { stdio: 'ignore', timeout: 60000 });
    console.log('✓', path.relative(process.cwd(), file));
  } catch (e) {
    console.error('✗', name, e.message);
  }
}
