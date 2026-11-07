#!/usr/bin/env node
// ============================================================
// Render-Skript für das Erklärvideo.
//
//   Einzelbild ansehen:   node render.mjs still 45.5 bild.png
//   Ganzes Video bauen:   node render.mjs video ausgabe.mp4 [--fps 30] [--workers 4]
//   Nur ein Ausschnitt:   node render.mjs video test.mp4 --from 30 --to 40
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
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'erklaervideo-'));
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
  buildAudio(audio, cues, duration, from, to, tmp);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', silent, '-i', audio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
    '-movflags', '+faststart', outFile]);
  console.log('Fertig:', outFile, `(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  fs.rmSync(tmp, { recursive: true, force: true });
}

function run(cmd, a) {
  const r = spawnSync(cmd, a, { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`${cmd} fehlgeschlagen`);
}

/** Einfacher Ton aus ffmpeg-Generatoren: sanfter Klangteppich, PLING, Wusch, Absturz, Stempel. */
function buildAudio(outFile, cues, duration, from, to, tmp) {
  const len = to - from;
  const inputs = [], chains = [], labels = [];
  const add = (src, delay, vol = 1, name) => {
    const i = inputs.length;
    inputs.push(['-f', 'lavfi', '-i', src]);
    const ms = Math.max(0, Math.round((delay - from) * 1000));
    chains.push(`[${i}:a]volume=${vol},adelay=${ms}|${ms}[a${i}]`);
    labels.push(`[a${i}]`);
  };
  // Klangteppich (leise, ruhig)
  add(`aevalsrc='0.05*(sin(2*PI*110*t)+0.8*sin(2*PI*164.8*t)+0.6*sin(2*PI*220*t)+0.4*sin(2*PI*277.2*t))*(0.8+0.2*sin(2*PI*0.1*t))':d=${len}:s=44100,afade=t=in:d=2,afade=t=out:st=${Math.max(0, len - 3)}:d=3,lowpass=f=900`, from, 1);
  const inRange = (t) => t >= from - 0.01 && t < to;
  cues.pling.filter(inRange).forEach((t) => add(`aevalsrc='0.32*sin(2*PI*1568*t)*exp(-6*t)+0.2*sin(2*PI*2349*t)*exp(-8*t)+0.1*sin(2*PI*3136*t)*exp(-12*t)':d=0.8:s=44100`, t, 1));
  cues.whoosh.filter(inRange).forEach((t) => add(`anoisesrc=d=0.9:c=pink:a=0.6:r=44100,highpass=f=300,lowpass=f=2600,afade=t=in:d=0.4,afade=t=out:st=0.4:d=0.5`, Math.max(from, t - 0.25), 0.55));
  cues.crash.filter(inRange).forEach((t) => add(`aevalsrc='0.55*sin(2*PI*(110-60*t)*t)*exp(-3.5*t)+0.35*(2*random(0)-1)*exp(-7*t)':d=1.2:s=44100`, t, 1));
  cues.thud.filter(inRange).forEach((t) => add(`aevalsrc='0.8*sin(2*PI*62*t)*exp(-9*t)+0.2*(2*random(0)-1)*exp(-30*t)':d=0.6:s=44100`, t, 1));
  const script = path.join(tmp, 'ton.txt');
  fs.writeFileSync(script, chains.join(';\n') + `;\n${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,alimiter=limit=0.9,atrim=0:${len}[out]`);
  const argv = ['-y', '-loglevel', 'error', ...inputs.flat(), '-filter_complex_script', script, '-map', '[out]', '-ar', '44100', '-c:a', 'aac', '-b:a', '192k', outFile];
  run('ffmpeg', argv);
}
