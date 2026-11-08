#!/usr/bin/env node
// ============================================================
// Render-Skript für das Schwimmvideo (gleiches Verfahren wie beim Erklärvideo).
//
//   Einzelbild ansehen:   node render.mjs still 45.5 bild.png
//   Ganzes Video bauen:   node render.mjs video ausgabe.mp4 [--fps 30] [--workers 4]
//   Nur ein Ausschnitt:   node render.mjs video test.mp4 --from 30 --to 40
//   Mit Stimmen:          node render.mjs video ausgabe.mp4 --voices <ordner mit stimmen.json>
//                         (Ordner kommt von stimmen.py)
//   Nur den Ton bauen:    node render.mjs audio ton.m4a --voices <ordner>
//
// Ablauf: Jede Sekunde T wird im Browser mit renderAt(T) gezeichnet,
// als Bild aufgenommen und an ffmpeg übergeben. Mehrere "Worker" rendern
// verschiedene Zeitabschnitte gleichzeitig; danach werden die Teile
// zusammengesetzt und der Ton daruntergelegt.
// ============================================================
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : d; };
const mode = args[0];

// ---------- kleiner Datei-Server (Module laufen nicht über file://) ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(here, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html');
  if (!p.startsWith(here) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/index.html?render`;

async function openPage() {
  const browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'],
  });
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.error('Seitenfehler:', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.error('Konsole:', m.text()); });
  await page.goto(base);
  await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  return { browser, page };
}

try {
  if (mode === 'still') {
    const T = +args[1], out = args[2] || 'still.png';
    const { browser, page } = await openPage();
    await page.evaluate((t) => window.renderAt(t), T);
    await page.screenshot({ path: out });
    await browser.close();
    console.log('Einzelbild gespeichert:', out);
  } else if (mode === 'audio') {
    const { browser, page } = await openPage();
    const duration = await page.evaluate(() => window.DURATION);
    const cues = await page.evaluate(() => window.CUES);
    await browser.close();
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schwimmvideo-ton-'));
    buildAudio(args[1] || 'ton.m4a', cues, duration, 0, duration, tmp, flag('voices'));
    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('Ton gespeichert:', args[1]);
  } else if (mode === 'video') {
    await renderVideo(args[1] || 'erklaervideo.mp4');
  } else {
    console.log('Benutzung: node render.mjs still <Sekunde> <bild.png>  |  node render.mjs video <datei.mp4>');
  }
} finally {
  server.close();
}

// ============================================================
async function renderVideo(outFile) {
  const fps = +flag('fps', 30);
  const workers = +flag('workers', Math.max(1, Math.min(4, os.cpus().length)));
  const { browser: b0, page: p0 } = await openPage();
  const duration = await p0.evaluate(() => window.DURATION);
  const cues = await p0.evaluate(() => window.CUES);
  await b0.close();

  const from = +flag('from', 0), to = +flag('to', duration);
  const f0 = Math.round(from * fps), f1 = Math.round(to * fps);
  const total = f1 - f0;
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'schwimmvideo-'));
  console.log(`Rendere ${total} Bilder (${from}–${to} s, ${fps} fps) mit ${workers} Workern → ${tmp}`);

  const per = Math.ceil(total / workers);
  let done = 0;
  const t0 = Date.now();
  const parts = await Promise.all([...Array(workers).keys()].map(async (w) => {
    const a = f0 + w * per, b = Math.min(f1, a + per);
    if (a >= b) return null;
    const part = path.join(tmp, `teil${w}.mp4`);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '21', '-pix_fmt', 'yuv420p', '-g', String(fps), '-r', String(fps), part],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const closed = new Promise((r) => ff.on('close', r));
    const { browser, page } = await openPage();
    for (let f = a; f < b; f++) {
      await page.evaluate((t) => window.renderAt(t), f / fps);
      const buf = await page.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      done++;
      if (done % 60 === 0) {
        const el = (Date.now() - t0) / 1000;
        console.log(`  ${done}/${total} Bilder · ${(done / el).toFixed(1)} Bilder/s · noch ca. ${Math.round((total - done) / (done / el))} s`);
      }
    }
    ff.stdin.end();
    await closed;
    await browser.close();
    return part;
  }));

  // Teile zusammenfügen
  const list = path.join(tmp, 'liste.txt');
  fs.writeFileSync(list, parts.filter(Boolean).map((p) => `file '${p}'`).join('\n'));
  const silent = path.join(tmp, 'stumm.mp4');
  run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', silent]);

  // Ton erzeugen und darunterlegen
  const audio = path.join(tmp, 'ton.m4a');
  buildAudio(audio, cues, duration, from, to, tmp, flag('voices'));
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
    '-movflags', '+faststart', outFile]);
  console.log('Fertig:', outFile, `(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

function run(cmd, a) {
  const r = spawnSync(cmd, a, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} fehlgeschlagen`);
}

/**
 * Ton fürs Schwimmvideo, alles aus ffmpeg-Generatoren (keine fremden Sounddateien):
 * Hallenbad-Rauschen, fröhlicher Klangteppich, Pfiff, Platschen, Schwimmgeräusch,
 * Stoppuhr-„Ding“, Fanfare – plus die Stimmen aus stimmen.py.
 */
function buildAudio(outFile, cues, duration, from, to, tmp, voicesDir) {
  const len = to - from;
  const inputs = [], chains = [], labels = [];
  const add = (src, delay, vol = 1, extra = '') => {
    const i = inputs.length;
    inputs.push(['-f', 'lavfi', '-i', src]);
    const ms = Math.max(0, Math.round((delay - from) * 1000));
    chains.push(`[${i}:a]${extra}volume=${vol},adelay=${ms}|${ms}[a${i}]`);
    labels.push(`[a${i}]`);
  };
  const inRange = (t) => t >= from - 0.01 && t < to;
  // Hallenbad-Atmosphäre: leises Rauschen mit Hall
  add(`anoisesrc=d=${len}:c=pink:a=0.5:r=44100,lowpass=f=700,highpass=f=120,afade=t=in:d=2,afade=t=out:st=${Math.max(0, len - 3)}:d=3`, from, 0.18);
  // fröhlicher Klangteppich in Dur (C – E – G), leicht pulsierend
  add(`aevalsrc='0.035*(sin(2*PI*261.6*t)+0.8*sin(2*PI*329.6*t)+0.7*sin(2*PI*392*t)+0.4*sin(2*PI*523.3*t))*(0.75+0.25*sin(2*PI*2*t))':d=${len}:s=44100,afade=t=in:d=2,afade=t=out:st=${Math.max(0, len - 3)}:d=3,lowpass=f=1500`, from, voicesDir ? 0.6 : 1);
  // Trillerpfeife
  cues.whistle.filter(inRange).forEach((t) => add(`aevalsrc='0.5*sin(2*PI*(2900+120*sin(2*PI*28*t))*t)':d=0.75:s=44100,afade=t=in:d=0.03,afade=t=out:st=0.62:d=0.13`, t, 0.8));
  // Platschen (Sprung, Wende, Abstoßen)
  cues.splash.filter(([t]) => inRange(t)).forEach(([t, str]) => add(`anoisesrc=d=1.2:c=white:a=0.9:r=44100,lowpass=f=2500,highpass=f=200,afade=t=in:d=0.02,afade=t=out:st=0.05:d=1.1`, t, 0.9 * str));
  // Schwimmgeräusch: rhythmisches Wasserrauschen im Takt der Armzüge
  cues.swim.filter(([a]) => inRange(a)).forEach(([a, b]) => add(`anoisesrc=d=${b - a}:c=pink:a=0.6:r=44100,bandpass=f=900:w=1400,volume='0.35+0.65*abs(sin(2*PI*1.5*t))':eval=frame,afade=t=in:d=0.4,afade=t=out:st=${Math.max(0, b - a - 0.5)}:d=0.5`, a, 0.4));
  // Stoppuhr: Klick + Ding
  cues.ding.filter(inRange).forEach((t) => add(`aevalsrc='0.6*sin(2*PI*1760*t)*exp(-4*t)+0.3*sin(2*PI*2637*t)*exp(-6*t)+0.4*(2*random(0)-1)*exp(-200*t)':d=1.2:s=44100`, t, 0.8));
  // Fanfare: aufsteigende Dur-Töne
  cues.fanfare.filter(inRange).forEach((t) => {
    [[523.3, 0], [659.3, 0.16], [784, 0.32], [1046.5, 0.5]].forEach(([f, dt], k) =>
      add(`aevalsrc='0.35*(sin(2*PI*${f}*t)+0.4*sin(2*PI*${f * 2}*t)+0.2*sin(2*PI*${f * 3}*t))*exp(-${k === 3 ? 1.5 : 4}*t)':d=${k === 3 ? 1.6 : 0.6}:s=44100,afade=t=in:d=0.015`, t + dt, 0.7));
  });
  // Stimmen (von stimmen.py), starten kurz nach dem Einblenden des Untertitels
  if (voicesDir) {
    const list = JSON.parse(fs.readFileSync(path.join(voicesDir, 'stimmen.json'), 'utf8'));
    list.filter((v) => inRange(v.start)).forEach((v) => {
      const i = inputs.length;
      inputs.push(['-i', path.join(voicesDir, v.datei)]);
      const ms = Math.max(0, Math.round((v.start + 0.12 - from) * 1000));
      chains.push(`[${i}:a]volume=1.0,adelay=${ms}|${ms}[a${i}]`);
      labels.push(`[a${i}]`);
    });
  }
  const script = path.join(tmp, 'ton.txt');
  fs.writeFileSync(script, chains.join(';\n') + `;\n${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,alimiter=limit=0.8,atrim=0:${len}[out]`);
  run('ffmpeg', ['-y', '-loglevel', 'error', ...inputs.flat(), '-filter_complex_script', script, '-map', '[out]', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', outFile]);
}
