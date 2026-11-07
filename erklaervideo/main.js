// ============================================================
// Robobert & Sepp – Erklärvideo (9:16, 3D-Motion-Graphics)
//
// Alles hängt an EINER Funktion: renderAt(T) zeichnet den Bildzustand
// für die Sekunde T. Dadurch ist jedes Einzelbild exakt reproduzierbar:
//   * Vorschau im Browser:   index.html            (läuft in Echtzeit)
//   * Einzelbild ansehen:    index.html?t=45.5
//   * Videorendern:          node render.mjs        (ruft renderAt je Bild)
//
// Aufbau: Szenen-Liste (SCENES) + Untertitel (CAPTIONS) + Soundmarken (CUES).
// ============================================================
import * as THREE from './lib/three.module.js';
import { makeRobobert, makeSepp, makeUdo, rbox } from './chars.js';

const W = 1080, H = 1920;
export const DURATION = 113;           // Gesamtlänge in Sekunden
const params = new URLSearchParams(location.search);

// ---------- kleine Mathe-Helfer ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const eOut = (x) => 1 - Math.pow(1 - x, 3);
const eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---------- Bühne & Renderer ----------
const stage = document.getElementById('stage');
const ui = document.getElementById('ui');
const canvas = document.getElementById('gl');
function fit() {
  if (params.has('render')) return;
  const k = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `scale(${k})`;
  stage.style.left = (innerWidth - W * k) / 2 + 'px';
  stage.style.top = (innerHeight - H * k) / 2 + 'px';
}
fit(); addEventListener('resize', fit);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
camera.position.set(0, 0, 22);

// Umgebungslicht-Spiegelung (macht Metall hübscher) aus einer kleinen Hilfsszene
{
  const env = new THREE.Scene();
  const sky = new THREE.Mesh(new THREE.SphereGeometry(20, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x1d3a7a, side: THREE.BackSide }));
  env.add(sky);
  [[0, 12, 6, 0xffffff, 10], [-10, 3, 4, 0x8fb4ff, 6], [10, 2, 3, 0xffd9a0, 6]].forEach(([x, y, z, c, s]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p);
  });
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(env, 0.04).texture;
}
scene.add(new THREE.HemisphereLight(0xbcd4ff, 0x20284a, 0.6));
const key = new THREE.DirectionalLight(0xfff1de, 2.4); key.position.set(4, 7, 9); scene.add(key);
const fill = new THREE.DirectionalLight(0x6f9cff, 1.1); fill.position.set(-6, 2, 6); scene.add(fill);
const rim = new THREE.DirectionalLight(0xffffff, 1.6); rim.position.set(0, 5, -8); scene.add(rim);

// Schwebende Lichtpunkte im Hintergrund (Tiefe)
const motes = new THREE.Group();
for (let i = 0; i < 70; i++) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.03 + rnd() * 0.05, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0x9cc2ff, transparent: true, opacity: 0.25 + rnd() * 0.35 }));
  m.position.set((rnd() - 0.5) * 9, (rnd() - 0.5) * 14, -2 - rnd() * 5);
  m.userData = { sp: 0.1 + rnd() * 0.25, ph: rnd() * 6.28, y0: m.position.y };
  motes.add(m);
}
scene.add(motes);

// ---------- Texturen & Projektion ----------
/** Beschriftete, abgerundete Kachel als Textur (für 3D-Flächen). */
function labelTex(text, o = {}) {
  const { w = 512, h = 128, bg = '#1c2f63', fg = '#ffffff', border = '#6fa0ff', font = '800 52px Inter, sans-serif' } = o;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const r = h * 0.22;
  g.beginPath();
  g.moveTo(r, 4); g.lineTo(w - r, 4); g.quadraticCurveTo(w - 4, 4, w - 4, r);
  g.lineTo(w - 4, h - r); g.quadraticCurveTo(w - 4, h - 4, w - r, h - 4);
  g.lineTo(r, h - 4); g.quadraticCurveTo(4, h - 4, 4, h - r);
  g.lineTo(4, r); g.quadraticCurveTo(4, 4, r, 4); g.closePath();
  g.fillStyle = bg; g.fill(); g.lineWidth = 6; g.strokeStyle = border; g.stroke();
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((ln, i) => g.fillText(ln, w / 2, h / 2 + (i - (lines.length - 1) / 2) * (h * 0.36) + 3));
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}
function tilePlane(text, w, h, o) {
  const tex = labelTex(text, { w: 512, h: Math.round(512 * h / w), ...o });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}
/** 3D-Punkt -> Pixelposition auf der 1080x1920-Bühne */
function toPx(v) {
  const p = v.clone().project(camera);
  return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H];
}
function place(el, v3, dx = 0, dy = 0) {
  const [x, y] = toPx(v3);
  el.style.left = (x + dx) + 'px'; el.style.top = (y + dy) + 'px';
}

// ---------- Figuren (immer unten im Bild) ----------
const robobert = makeRobobert(), sepp = makeSepp(), udo = makeUdo();
const trio = new THREE.Group();
robobert.group.position.set(-2.3, 0, 0); robobert.group.scale.setScalar(0.78); robobert.group.rotation.y = 0.28;
sepp.group.position.set(-0.05, 0, 0.3); sepp.group.scale.setScalar(0.95); sepp.group.rotation.y = 0.05;
udo.group.position.set(2.35, 0, 0); udo.group.scale.setScalar(0.8); udo.group.rotation.y = -0.3;
trio.add(robobert.group, sepp.group, udo.group);
trio.position.y = -4.8;
scene.add(trio);
// weicher Kontaktschatten unter den Figuren
{
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  [[-2.3, 1.5], [-0.05, 1.7], [2.35, 1.2]].forEach(([x, w]) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.3, 0.7), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
    s.position.set(x, -4.78, 0.1);
    scene.add(s);
  });
}

// ============================================================
// Untertitel (wer sagt wann was) – Zeiten in Sekunden
// ============================================================
const WHO = {
  udo: { name: 'Papa Udo', color: 'var(--udo)' },
  robobert: { name: 'Robobert', color: 'var(--robobert)' },
  sepp: { name: 'Sepp', color: 'var(--sepp)' },
};
export const CAPTIONS = [
  [0.5, 4.6, 'udo', 'Hallo Oliver! Das ist unsere Robobert-und-Sepp-Automation.'],
  [4.7, 7.5, 'robobert', 'Ich bin die klügste KI der Welt!'],
  [8.1, 12.4, 'udo', 'Ein Kreislauf mit sechs Stationen – jede Woche von vorn.'],
  [12.5, 16.3, 'udo', 'Blau erledigt Claude. Gelb entscheide ich selbst.'],
  [16.4, 19.6, 'sepp', 'Maschine liefert, Papa gibt frei. Passt scho.'],
  [20.1, 25.0, 'udo', '1 · Claude sammelt Kandidaten aus Trends, Pinterest und Marktplätzen.'],
  [25.1, 29.2, 'udo', 'Pro Woche 6 Videos – plus 2 bis 4 Reserve-Kandidaten.'],
  [29.4, 32.0, 'robobert', 'Ich durchsuche das ganze Internet!'],
  [32.1, 34.5, 'sepp', 'Fünfzehn Seiten. Ned hundert.'],
  [35.1, 40.2, 'udo', '2 · Jeder Kandidat durchläuft sieben Prüfungen – jede Zahl mit Quelle.'],
  [40.3, 45.4, 'sepp', 'Kleingedrucktes, Fakten, Schwächen, Bewertungen, Nachfrage, Provision.'],
  [45.5, 48.4, 'robobert', 'Perfekt! Fünf Sterne! SOFORT kaufen!'],
  [48.5, 51.8, 'sepp', 'Gelb heißt: prüfen. Udo entscheidet.'],
  [52.3, 57.0, 'udo', '3 · Ich sehe den Bericht an und sage: „Nimm 1, 3 und 4.“'],
  [57.1, 61.8, 'udo', 'Erst dann bekommt ein Produkt den Status „ja“ und einen Steckbrief.'],
  [62.3, 67.6, 'udo', '4 · Claude Code baut aus dem Steckbrief erst ein Drehbuch – zur Freigabe.'],
  [67.7, 72.4, 'udo', 'Aus 17 Szenen-Arten entsteht ein 35-Sekunden-Video im Hochformat.'],
  [72.5, 76.0, 'robobert', 'Dieses Gerät ist das Beste der— FEHLER!'],
  [76.1, 79.8, 'sepp', 'Der Absturz is der Gag. Die Fakten prüf i nach.'],
  [80.3, 84.3, 'udo', '5 · Ohne meine Freigabe wird nichts veröffentlicht.'],
  [84.4, 90.2, 'sepp', 'Vorher: Werbung und KI kennzeichnen, keine Preise, Link auf die eigene Seite.'],
  [91.3, 95.2, 'udo', '6 · Einmal pro Woche werden die Klicks ausgewertet.'],
  [95.3, 99.6, 'udo', 'Gewinner bekommen ein Folgevideo, Schwache fliegen raus.'],
  [99.7, 102.7, 'robobert', 'Und ich bleibe natürlich der Star!'],
  [104.3, 108.9, 'udo', 'So ist die Maschine schnell – und der Mensch hat das letzte Wort.'],
  [109.0, 112.6, 'udo', 'Danke, Oliver! Fragen beantworte ich gern.'],
];

// ============================================================
// Soundmarken für das Tonmischen (render.mjs liest window.CUES)
// ============================================================
const ROW0 = 34.8 + 5.5;              // Prüfzeilen starten hier (absolut)
export const CUES = {
  whoosh: [7.8, 19.8, 34.8, 52.0, 62.0, 80.0, 91.0, 104.0],
  pling: [32.5, ...Array.from({ length: 7 }, (_, i) => ROW0 + 0.4 + i * 0.7), 48.9, 58.0, 76.6, 77.6, 78.6,
    85.0, 86.3, 87.6, 88.9, 97.0, 112.9],
  crash: [75.0],
  thud: [82.5],
};
window.CUES = CUES;

// ============================================================
// Szenen
// ============================================================
const STEPS = ['Finden', 'Prüfen', 'Wählen', 'Bauen', 'Freigeben', 'Auswerten'];
const SCENES = [];
const head = (chip, cls, title, sub) =>
  `<div class="head el" data-in="0.15"><span class="chip ${cls}">${chip}</span><h1>${title}</h1><p>${sub}</p></div>`;

/** Neue Szene anlegen: 3D-Gruppe + HTML-Ebene. */
function addScene(def) {
  const g = new THREE.Group();
  scene.add(g);
  const el = document.createElement('div');
  el.className = 'scene';
  el.innerHTML = def.html;
  ui.appendChild(el);
  const s = { ...def, g, el, upd: null };
  s.upd = def.build ? def.build(g, el, s) : () => {};
  s.reveals = [...el.querySelectorAll('[data-in]')].map((n) => ({
    n, a: +n.dataset.in, b: n.dataset.out ? +n.dataset.out : null, k: n.dataset.k || 'rise',
  }));
  SCENES.push(s);
  return s;
}

// ---------- Ring (Kreislauf) – in Szene 1 und 8 genutzt ----------
const BLAU = 0x2f7bff, GELB = 0xffc800;
function makeRing(radius) {
  const g = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.rotation.x = -0.75;
  g.add(tilt);
  const band = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.07, 14, 96),
    new THREE.MeshStandardMaterial({ color: 0x6f9cff, emissive: 0x1d4fd0, emissiveIntensity: 0.7, roughness: 0.3 }));
  tilt.add(band);
  const nodes = [], owner = [BLAU, BLAU, GELB, BLAU, GELB, BLAU];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 - i * (Math.PI / 3);
    const n = new THREE.Group();
    n.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.46, 28, 20),
      new THREE.MeshStandardMaterial({ color: owner[i], roughness: 0.3, metalness: 0.2, emissive: owner[i], emissiveIntensity: 0.25 }));
    n.add(body);
    if (i === 5) { // Auswerten: Mischung aus Maschine und Mensch
      const moon = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), new THREE.MeshStandardMaterial({ color: GELB, emissive: GELB, emissiveIntensity: 0.4 }));
      moon.position.set(0.62, 0.0, 0.2);
      n.add(moon);
    }
    tilt.add(n);
    nodes.push(n);
  }
  // Pfeilspitzen zwischen den Stationen
  const arrows = [];
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 2 - (i + 0.5) * (Math.PI / 3);
    const c = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.4, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x88aaff, emissiveIntensity: 0.6 }));
    c.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0);
    c.rotation.z = a;         // Spitze zeigt im Uhrzeigersinn
    tilt.add(c);
    arrows.push(c);
  }
  // wandernder Lichtpunkt mit Schweif
  const pulse = [];
  for (let k = 0; k < 9; k++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.17 - k * 0.013, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1 - k * 0.1 }));
    tilt.add(m); pulse.push(m);
  }
  return {
    g, tilt, nodes, arrows,
    update(t, show, glow = 1) {
      g.rotation.y = Math.sin(t * 0.5) * 0.28;
      nodes.forEach((n, i) => {
        const p = eBack(seg(t, show + i * 0.9, show + i * 0.9 + 0.6));
        n.scale.setScalar(Math.max(0.0001, p));
        n.rotation.y = t * 0.8;
      });
      arrows.forEach((c, i) => c.scale.setScalar(Math.max(0.0001, eOut(seg(t, show + 0.4 + i * 0.9, show + 0.9 + i * 0.9)))));
      const base = -(t - show) * 1.05 + Math.PI / 2;
      pulse.forEach((m, k) => {
        const a = base + k * 0.11;
        m.position.set(Math.cos(a) * radius, Math.sin(a) * radius, 0.1);
        m.visible = t > show;
      });
    },
    /** Weltposition eines Knotens (für DOM-Beschriftung) */
    pos(i) { return nodes[i].getWorldPosition(new THREE.Vector3()); },
  };
}

// ============================================================
// Szene 0 · Titel
// ============================================================
addScene({
  id: 'titel', t0: 0, t1: 7.8, step: 0,
  html: `
  <div class="el" data-in="0.2" data-k="pop" style="left:60px;right:60px;top:300px;text-align:center">
    <div style="font-size:156px;line-height:.95;font-weight:900;letter-spacing:-.03em;color:#ffb066;
      text-shadow:0 3px 0 #b5611f,0 6px 0 #8c4a16,0 9px 0 #6b3910,0 22px 36px rgba(0,0,0,.5)">ROBOBERT</div>
    <div style="font-size:92px;font-weight:900;color:var(--gelb);margin:8px 0 2px;text-shadow:0 4px 0 #8a6a00,0 16px 28px rgba(0,0,0,.45)">&amp;</div>
    <div style="font-size:156px;line-height:.95;font-weight:900;letter-spacing:-.03em;color:#cfe0ff;
      text-shadow:0 3px 0 #7e93bd,0 6px 0 #5d7099,0 9px 0 #435577,0 22px 36px rgba(0,0,0,.5)">SEPP</div>
  </div>
  <div class="el" data-in="1.2" style="left:60px;right:60px;top:820px;text-align:center;font-size:48px;font-weight:800">So läuft die Automation</div>
  <div class="el" data-in="1.6" style="left:60px;right:60px;top:895px;text-align:center;font-size:32px;font-weight:600;color:var(--leise)">von der Produktidee bis zum fertigen Video</div>
  <div class="el" data-in="2.1" data-k="pop" style="left:0;right:0;top:1010px;text-align:center"><span class="chip gelb" style="font-size:34px;padding:12px 34px">Erklärt für Oliver</span></div>`,
  build(g) {
    // schwebende „Produktpakete“ als Sinnbild für die Kandidaten
    const boxes = [];
    for (let i = 0; i < 7; i++) {
      const col = [0x2f7bff, 0xffc800, 0x9cc2ff][i % 3];
      const b = rbox(0.55, 0.55, 0.55, 0.1, new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.2 }));
      const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      b.add(ribbon);
      const a = (i / 7) * Math.PI * 2;
      b.userData = { a, r: 3.0 };
      g.add(b); boxes.push(b);
    }
    return (t) => {
      boxes.forEach((b, i) => {
        const a = b.userData.a + t * 0.35;
        const p = eBack(seg(t, 0.4 + i * 0.12, 1.1 + i * 0.12));
        b.position.set(Math.cos(a) * 3.0, -1.4 + Math.sin(a) * 0.5 + Math.sin(t * 2 + i) * 0.1, Math.sin(a) * 1.5);
        b.scale.setScalar(Math.max(0.001, p));
        b.rotation.set(t * 0.8 + i, t * 0.6, 0);
      });
    };
  },
});

// ============================================================
// Szene 1 · Der Kreislauf
// ============================================================
addScene({
  id: 'kreislauf', t0: 7.8, t1: 19.8, step: 0,
  html: head('ÜBERBLICK', 'grau', 'Der Kreislauf', 'Sechs Stationen – ein Rhythmus pro Woche.') +
    [0, 1, 2, 3, 4, 5].map((i) => {
      // Beschriftung: oben/unten mittig, an den Seiten nach innen (zur Ringmitte)
      const [lx, ty, al] = [[-125, -152, 'center'], [-345, -40, 'right'], [-345, -40, 'right'], [-125, 80, 'center'], [95, -40, 'left'], [95, -40, 'left']][i];
      return `
    <div class="el nl" id="nl${i}" style="width:0;height:0">
      <div style="position:absolute;left:-30px;top:-30px;width:60px;height:60px;border-radius:50%;background:#fff;color:#0b1330;font-weight:900;font-size:36px;text-align:center;line-height:60px;box-shadow:0 6px 16px rgba(0,0,0,.4)">${i + 1}</div>
      <div style="position:absolute;left:${lx}px;top:${ty}px;width:250px;text-align:${al};font-weight:900;font-size:36px;line-height:1.15;text-shadow:0 3px 10px rgba(0,0,0,.6)">${STEPS[i]}</div>
      <div style="position:absolute;left:${lx}px;top:${ty + 42}px;width:250px;text-align:${al};font-weight:700;font-size:23px;color:var(--leise);text-shadow:0 2px 8px rgba(0,0,0,.6)">${['Claude · Chat', 'Claude · Chat', 'Papa Udo', 'Claude Code', 'Papa Udo', 'Claude + Udo'][i]}</div>
    </div>`;
    }).join('') + `
    <div class="el" id="ringmid" style="width:0;height:0"><div style="position:absolute;left:-130px;top:-34px;width:260px;text-align:center;font-weight:800;font-size:30px;color:#cfe0ff">↻ jede Woche</div></div>
    <div class="el" data-in="6.8" style="left:60px;right:60px;top:1252px;display:flex;gap:18px;justify-content:center">
      <span class="chip blau" style="font-size:28px">■ Claude arbeitet</span>
      <span class="chip gelb" style="font-size:28px">■ Papa Udo entscheidet</span>
    </div>`,
  build(g, el) {
    const ring = makeRing(2.35);
    ring.g.position.y = 0.85;
    g.add(ring.g);
    const nl = [...Array(6).keys()].map((i) => el.querySelector('#nl' + i));
    const mid = el.querySelector('#ringmid');
    return (t) => {
      ring.update(t, 1.0);
      scene.updateMatrixWorld(true);
      nl.forEach((n, i) => {
        place(n, ring.pos(i));
        n.style.opacity = eOut(seg(t, 1.1 + i * 0.9, 1.6 + i * 0.9));
      });
      place(mid, ring.g.getWorldPosition(new THREE.Vector3()));
      mid.style.opacity = eOut(seg(t, 6.2, 6.8));
    };
  },
});

// ============================================================
// Szene 2 · Schritt 1 – Produkte finden
// ============================================================
addScene({
  id: 'finden', t0: 19.8, t1: 34.8, step: 1,
  html: head('SCHRITT 1 · CLAUDE IM CHAT', 'blau', 'Produkte finden', 'Trend-Check über mehrere Quellen.') + `
  <div class="el card" data-in="10.3" style="left:60px;right:60px;top:1180px;height:140px;padding:0;display:flex;align-items:center;justify-content:space-around;text-align:center">
    <div><div style="font-size:44px;font-weight:900;color:var(--gelb)">6</div><div class="small">Videos pro Woche</div></div>
    <div><div style="font-size:44px;font-weight:900;color:#9cc2ff">3 + 3</div><div class="small">allgemein / 60+</div></div>
    <div><div style="font-size:44px;font-weight:900;color:#fff">60 / 40</div><div class="small">% neu / Folgevideo</div></div>
  </div>
  <div class="el" data-in="11.3" data-k="pop" style="left:0;right:0;top:1105px;text-align:center"><span class="chip gelb" style="font-size:26px">+ 2 bis 4 Reserve-Kandidaten</span></div>`,
  build(g) {
    const names = ['Amazon\nAufsteiger', 'Amazon\nBestseller', 'Google\nTrends', 'Pinterest\nTrends', 'vidIQ', 'Digistore24', 'last30days'];
    const tiles = names.map((n, i) => {
      const m = tilePlane(n, 1.55, 0.62, { font: '800 50px Inter, sans-serif', border: i < 4 ? '#6fa0ff' : '#ffc800' });
      g.add(m); return m;
    });
    const start = [[-2.7, 2.75], [-0.9, 2.75], [0.9, 2.75], [2.7, 2.75], [-1.8, 2.05], [0.0, 2.05], [1.8, 2.05]];
    // Trichter
    const fun = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 0.45, 1.4, 40, 1, true),
      new THREE.MeshPhysicalMaterial({ color: 0x7fb0ff, transparent: true, opacity: 0.38, roughness: 0.15, side: THREE.DoubleSide, emissive: 0x1d4fd0, emissiveIntensity: 0.35 }));
    fun.position.set(0, 0.55, 0);
    g.add(fun);
    const rimT = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.06, 10, 48), new THREE.MeshStandardMaterial({ color: 0xcfe0ff, emissive: 0x4f7fe0, emissiveIntensity: 0.5 }));
    rimT.rotation.x = Math.PI / 2; rimT.position.set(0, 1.25, 0); g.add(rimT);
    const spout = cylinderPipe();
    spout.position.set(0, -0.35, 0);
    g.add(spout);
    // Ergebnis-Karten
    const cards = ['Kandidat 1', 'Kandidat 2', 'Kandidat 3'].map((n, i) => {
      const m = tilePlane(n, 1.75, 0.62, { bg: '#0f2a66', border: '#ffc800', font: '800 56px Inter, sans-serif' });
      g.add(m); return m;
    });
    return (t) => {
      const floatY = Math.sin(t * 1.5) * 0.04;
      fun.rotation.y = t * 0.4;
      tiles.forEach((m, i) => {
        const t0 = 1.2 + i * 1.05;
        const fall = eInOut(seg(t, t0, t0 + 1.3));
        const sx = start[i][0], sy = start[i][1];
        const appear = eBack(seg(t, 0.2 + i * 0.12, 0.8 + i * 0.12));
        // Bogen: seitlich -> zur Trichtermitte
        m.position.set(sx * (1 - fall), sy + (0.95 - sy) * fall + floatY, 0.5 - fall * 0.6);
        const s = (1 - fall * 0.85) * appear;
        m.scale.setScalar(Math.max(0.0001, s));
        m.rotation.z = fall * 1.2 * (i % 2 ? 1 : -1);
        m.visible = fall < 0.995;
      });
      cards.forEach((m, i) => {
        const t0 = 8.0 + i * 0.7;
        const p = eOut(seg(t, t0, t0 + 0.9));
        m.position.set((i - 1) * 2.05 * p, -0.35 + (-1.35 + 0.35) * p + floatY, 0.3);
        m.scale.setScalar(Math.max(0.0001, p));
        m.rotation.z = (1 - p) * 0.6;
      });
    };
  },
});
function cylinderPipe() {
  return new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.5, 24, 1, true),
    new THREE.MeshPhysicalMaterial({ color: 0x7fb0ff, transparent: true, opacity: 0.4, side: THREE.DoubleSide }));
}

// ============================================================
// Szene 3 · Schritt 2 – Kandidaten prüfen
// ============================================================
const KRIT = [
  ['Kleingedrucktes', 'Versprechen, die Sepp prüfen kann', 'gut'],
  ['Harte Fakten', 'nur aus der Amazon-Beschreibung', 'gut'],
  ['Echte Schwächen', 'laut Käufern (1–3 Sterne)', 'pruef'],
  ['Bewertungen', 'ab ca. 4,2 ★ und vielen Stimmen', 'gut'],
  ['Darstellbar', 'mit den vorhandenen Szenen-Arten', 'gut'],
  ['Nachfrage', 'Verkaufsrang, Trends, Saison', 'gut'],
  ['Provision', 'Preis × Satz = € pro Verkauf', 'pruef'],
];
addScene({
  id: 'pruefen', t0: 34.8, t1: 52.0, step: 2,
  html: head('SCHRITT 2 · CLAUDE IM CHAT', 'blau', 'Kandidaten prüfen', 'Sieben Kriterien, jede Zahl mit Quelle.') +
    `<div class="el small" data-in="1.5" style="left:60px;top:490px;font-size:22px;letter-spacing:.1em">BEISPIEL-KANDIDAT</div>` +
    KRIT.map((r, i) => {
      const a = 5.5 + i * 0.7;
      const b = r[2] === 'gut' ? '<span class="badge b-gut">✔ GUT</span>' : '<span class="badge b-pruef">⚠ PRÜFEN</span>';
      return `<div class="el card" data-in="${a}" style="left:60px;right:60px;top:${700 + i * 80}px;height:68px;border-radius:18px;display:flex;align-items:center;padding:0 24px;box-sizing:border-box">
        <div style="font-size:33px;font-weight:900;width:330px">${r[0]}</div>
        <div class="small" style="flex:1;font-size:23px">${r[1]}</div>
        <div class="el" data-in="${a + 0.35}" data-k="pop" style="position:static">${b}</div></div>`;
    }).join('') + `
    <div class="el" data-in="14.0" data-k="pop" style="left:60px;right:60px;top:1268px;height:64px;border-radius:18px;background:var(--gelb);color:#111;display:flex;align-items:center;justify-content:center;font-size:33px;font-weight:900">
      ⚠ PRÜFEN – Udo entscheidet</div>
    <div class="el small" data-in="14.6" style="left:60px;right:60px;top:1340px;text-align:center;font-size:22px">Ampel: Symbol + Wort + Farbe · ✔ GUT blau · ⚠ PRÜFEN gelb · ✖ NEIN grau</div>`,
  build(g) {
    // Förderband
    const belt = rbox(7.0, 0.2, 1.3, 0.08, new THREE.MeshStandardMaterial({ color: 0x1b2850, roughness: 0.6, metalness: 0.4 }));
    belt.position.set(0, 1.98, 0); g.add(belt);
    // Scanner-Bogen
    const arch = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 12, 48), new THREE.MeshStandardMaterial({ color: 0x9cc2ff, emissive: 0x3d7bff, emissiveIntensity: 0.9 }));
    arch.rotation.y = Math.PI / 2 - 0.55; arch.position.set(0, 2.55, 0); g.add(arch);
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.05), new THREE.MeshBasicMaterial({ color: 0xbcdcff, transparent: true, opacity: 0.9 }));
    beam.position.set(0, 2.5, 0.2); g.add(beam);
    // Produkt-Paket
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x5b8def, roughness: 0.35, metalness: 0.2, emissive: 0x000000 });
    const pk = rbox(0.9, 0.9, 0.9, 0.14, boxMat);
    const rb = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.14, 0.96), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pk.add(rb);
    const rb2 = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.96, 0.96), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pk.add(rb2);
    g.add(pk);
    return (t) => {
      const enter = eOut(seg(t, 0.4, 2.2));
      const leave = eInOut(seg(t, 14.6, 16.4));
      pk.position.set(-3.4 * (1 - enter) + 0 + leave * 3.8, 2.55, 0);
      pk.rotation.y = t * 0.9;
      const done = seg(t, 14.0, 14.4);
      boxMat.color.setRGB(0.36 + done * 0.64, 0.55 + done * 0.25, 0.94 - done * 0.94);
      boxMat.emissive.setRGB(done * 0.35, done * 0.25, 0);
      const scanning = t > 2.0 && t < 14.0;
      beam.visible = scanning;
      beam.position.y = 2.55 + Math.sin(t * 3.2) * 0.8;
      arch.scale.setScalar(1 + Math.sin(t * 6) * 0.01);
    };
  },
});

// ============================================================
// Szene 4 · Schritt 3 – Udo wählt aus
// ============================================================
const KAND = [
  ['1', 'Luftbefeuchter', 'allgemein', 'gut', true],
  ['2', 'Seniorenhandy', '60+', 'pruef', false],
  ['3', 'KI-Werkzeug-Kurs', 'allgemein', 'gut', true],
  ['4', 'Lupe mit Licht', '60+', 'gut', true],
  ['5', 'Notruf-Uhr', '60+', 'pruef', false],
  ['6', '„Geheimnis“-Kurs', 'allgemein', 'nein', false],
];
addScene({
  id: 'waehlen', t0: 52.0, t1: 62.0, step: 3,
  html: head('SCHRITT 3 · PAPA UDO', 'gelb', 'Udo wählt aus', 'Der Mensch trifft die Entscheidung.') +
    KAND.map((k, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const b = { gut: '<span class="badge b-gut" style="font-size:21px;padding:4px 12px">✔ GUT</span>', pruef: '<span class="badge b-pruef" style="font-size:21px;padding:4px 12px">⚠ PRÜFEN</span>', nein: '<span class="badge b-nein" style="font-size:21px;padding:4px 12px">✖ NEIN</span>' }[k[3]];
      return `<div class="el card kc" data-sel="${k[4] ? 1 : 0}" data-in="${1.0 + i * 0.25}" style="left:${60 + col * 490}px;top:${490 + row * 166}px;width:470px;height:148px;box-sizing:border-box;padding:18px 22px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="font-size:60px;font-weight:900;color:var(--gelb);width:48px">${k[0]}</div>
          <div><div style="font-size:30px;font-weight:900">${k[1]}</div><div class="small" style="font-size:21px">${k[2]}</div></div></div>
        <div style="position:absolute;right:20px;bottom:16px">${b}</div>
        <div class="ja" style="position:absolute;left:86px;bottom:16px;font-size:26px;font-weight:900;color:#111;background:var(--gelb);padding:2px 14px;border-radius:12px;opacity:0">ja ✔</div></div>`;
    }).join('') + `
  <div class="el" data-in="5.2" style="left:60px;right:60px;top:1180px;display:flex;justify-content:center;align-items:center;gap:14px;font-size:27px;font-weight:800">
    <span class="chip grau mono" style="font-size:24px">vorgeschlagen</span>→<span class="chip gelb mono" style="font-size:24px">ja</span>→<span class="chip blau mono" style="font-size:24px">steckbrief</span></div>
  <div class="el small" data-in="5.8" style="left:60px;right:60px;top:1250px;text-align:center;font-size:23px">Status steht in der Produktliste (CSV) – Zeilen werden nie gelöscht.</div>`,
  build(g, el) {
    const cards = [...el.querySelectorAll('.kc')];
    const sheets = ['luftbefeuchter.md', 'ki-kurs.md', 'lupe.md'].map((n) => {
      const m = tilePlane('Steckbrief\n' + n, 1.35, 1.0, { w: 512, h: 380, bg: '#f4f1ea', fg: '#16213f', border: '#ffc800', font: '800 44px Inter, sans-serif' });
      g.add(m); return m;
    });
    return (t) => {
      const sel = seg(t, 3.8, 4.4);
      cards.forEach((c) => {
        const isSel = c.dataset.sel === '1';
        const ja = c.querySelector('.ja');
        ja.style.opacity = isSel ? sel : 0;
        c.style.borderColor = isSel && sel > 0.5 ? 'var(--gelb)' : '';
        c.dataset.dim = isSel ? 1 : 1 - sel * 0.65;
      });
      sheets.forEach((m, i) => {
        const p = eBack(seg(t, 6.0 + i * 0.5, 6.7 + i * 0.5));
        m.position.set((i - 1) * 2.0, -0.78 + Math.sin(t * 1.6 + i) * 0.05, 0.2);
        m.rotation.z = (i - 1) * -0.08;
        m.scale.setScalar(Math.max(0.0001, p));
      });
    };
  },
});

// ============================================================
// Szene 5 · Schritt 4 – Video bauen (Claude Code)
// ============================================================
const BLOECKE = ['hook', 'produkt', 'speed', 'zahl', 'traum', 'wasser', 'glanz', 'pruef', 'fehler', 'apps', 'text3d', 'morph', 'winzig', 'projektion', 'supernova', 'dunkel', 'schluss'];
addScene({
  id: 'bauen', t0: 62.0, t1: 80.0, step: 4,
  html: head('SCHRITT 4 · CLAUDE CODE', 'blau', 'Video bauen', 'Steckbrief → Drehbuch → Szenen-Bausteine.') + `
  <div class="el" data-in="1.0" style="left:50px;right:50px;top:490px;display:flex;align-items:center;justify-content:space-between;font-size:26px;font-weight:900">
    <span class="chip grau" style="font-size:24px">Steckbrief</span><span>→</span>
    <span class="chip gelb" style="font-size:24px">Drehbuch ✔</span><span>→</span>
    <span class="chip blau" style="font-size:24px">Bausteine</span><span>→</span>
    <span class="chip blau" style="font-size:24px">Video</span></div>
  <div class="el small" data-in="5.0" style="left:50px;right:50px;top:545px;font-size:21px;text-align:center">Drehbuch zur Freigabe: ca. 10 Zeilen · ca. 35 Sekunden · 9:16</div>
  <div class="el card" data-in="10.0" style="left:60px;right:60px;top:1192px;height:112px;box-sizing:border-box;padding:12px 26px;font-size:24px;font-weight:700;line-height:1.3">
    ✔ Keine Preise im Video<br>✔ Nur Angaben aus der Amazon-Beschreibung<br>✔ Eigene Bilder, markiert als „Symbolbild“</div>
  <div class="boom el" id="boom" style="left:0;right:0;top:860px;text-align:center;opacity:0">FEHLER!</div>`,
  build(g, el) {
    const blocks = BLOECKE.map((n, i) => {
      const col = n === 'pruef' ? { bg: '#6b5200', border: '#ffc800' } : n === 'fehler' ? { bg: '#6b3410', border: '#ee8a3c' } : n === 'schluss' ? { bg: '#0b3d91', border: '#ffffff' } : {};
      const m = tilePlane(n, 1.0, 0.5, { w: 512, h: 256, font: '800 78px Inter, sans-serif', ...col });
      g.add(m);
      m.userData = { from: new THREE.Vector3((rnd() - 0.5) * 9, (rnd() - 0.5) * 6 + 0.5, 3 + rnd() * 4), rot: (rnd() - 0.5) * 3 };
      return m;
    });
    const play = tilePlane('▶ Video', 1.0, 0.5, { w: 512, h: 256, bg: '#ffc800', fg: '#111', border: '#ffffff', font: '900 70px Inter, sans-serif' });
    play.userData = { from: new THREE.Vector3(0, -3, 6), rot: 0 };
    g.add(play); blocks.push(play);
    const boom = el.querySelector('#boom');
    return (t, T) => {
      blocks.forEach((m, i) => {
        const t0 = 2.5 + i * 0.16;
        const p = eInOut(seg(t, t0, t0 + 0.9));
        const col = i % 3, row = Math.floor(i / 3);
        const tx = (col - 1) * 1.12, ty = 2.0 - row * 0.62;
        const f = m.userData.from;
        m.position.set(f.x + (tx - f.x) * p, f.y + (ty - f.y) * p + (i === 17 ? Math.sin(t * 4) * 0.02 : 0), f.z * (1 - p));
        m.rotation.z = m.userData.rot * (1 - p);
        const pulse = i === 17 && p >= 1 ? 1 + Math.sin(t * 6) * 0.03 : 1;
        m.scale.setScalar((0.001 + p * 1.0) * pulse);
        m.visible = p > 0.001;
      });
      // „FEHLER!“-Absturz bei 75.0 s (absolut)
      const bt = T - 75.0;
      boom.style.opacity = bt > 0 && bt < 1.2 ? clamp01(1 - (bt - 0.6) / 0.6) : 0;
      boom.style.transform = `scale(${0.6 + eBack(seg(bt, 0, 0.35)) * 0.5}) rotate(${-6 + Math.sin(T * 40) * (bt < 0.6 ? 2 : 0)}deg)`;
    };
  },
});

// ============================================================
// Szene 6 · Schritt 5 – Freigabe
// ============================================================
const CHECKS = ['„WERBUNG“ dauerhaft sichtbar', 'KI-Kennzeichnung beim Upload', 'Keine Preise im Video', 'Link zur eigenen Webseite, nicht direkt zu Amazon'];
addScene({
  id: 'freigabe', t0: 80.0, t1: 91.0, step: 5,
  html: head('SCHRITT 5 · PAPA UDO', 'gelb', 'Freigabe', 'Erst prüfen, dann veröffentlichen.') + `
  <div class="el" id="stamp" style="left:130px;right:130px;top:640px;text-align:center;opacity:0">
    <span style="display:inline-block;border:8px solid var(--gelb);color:var(--gelb);border-radius:18px;padding:6px 28px;font-size:64px;font-weight:900;letter-spacing:.06em;transform:rotate(-8deg);background:rgba(7,16,42,.78)">FREIGEGEBEN</span></div>` +
    CHECKS.map((c, i) => `<div class="el card" data-in="${4.5 + i * 1.3}" style="left:60px;right:60px;top:${910 + i * 100}px;height:80px;border-radius:20px;display:flex;align-items:center;padding:0 26px;box-sizing:border-box">
      <span style="font-size:40px;color:var(--gelb);margin-right:20px">✔</span><span style="font-size:31px;font-weight:800">${c}</span></div>`).join(''),
  build(g, el) {
    // Dokument + Stempel
    const doc = rbox(2.5, 1.7, 0.08, 0.1, new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.8 }));
    doc.position.set(0, 1.55, 0); g.add(doc);
    for (let i = 0; i < 5; i++) {
      const ln = new THREE.Mesh(new THREE.BoxGeometry(i === 0 ? 1.4 : 2.0 - (i % 2) * 0.4, 0.07, 0.02), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x2f7bff : 0xaab4cc }));
      ln.position.set(i === 0 ? -0.4 : -0.1, 0.55 - i * 0.28, 0.06); doc.add(ln);
    }
    const stampG = new THREE.Group();
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.18, 28), new THREE.MeshStandardMaterial({ color: 0xffc800, metalness: 0.4, roughness: 0.35 }));
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.55, 20), new THREE.MeshStandardMaterial({ color: 0x2b3550 }));
    neck.position.y = 0.35;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 16), new THREE.MeshStandardMaterial({ color: 0x2b3550 }));
    knob.position.y = 0.72;
    stampG.add(base, neck, knob);
    stampG.rotation.x = Math.PI / 2 * 0.15;
    g.add(stampG);
    const stampEl = el.querySelector('#stamp');
    return (t) => {
      const drop = seg(t, 2.0, 2.5);          // 82.0–82.5 s: Stempel kommt runter
      const lift = seg(t, 2.8, 3.6);
      const h = (1 - eOut(drop)) * 2.0 + eOut(lift) * 1.6;
      stampG.position.set(0.5, 1.55 + 0.3 + h, 0.4);
      stampG.visible = t < 3.6;
      doc.rotation.z = Math.sin(t * 0.9) * 0.015;
      const hit = seg(t, 2.5, 2.8);
      doc.position.z = -hit * 0.05 * (1 - lift);
      stampEl.style.opacity = hit > 0 ? 1 : 0;
      stampEl.style.transform = `scale(${1.6 - 0.6 * eBack(hit)})`;
    };
  },
});

// ============================================================
// Szene 7 · Schritt 6 – Auswerten
// ============================================================
const BARS = [
  ['A', 0.95, 142, 0x2f7bff, 'Folgevideo'],
  ['B', 0.78, 118, 0x2f7bff, 'Folgevideo'],
  ['C', 0.48, 64, 0xffc800, 'beobachten'],
  ['D', 0.26, 31, 0x8a94a6, 'raus'],
  ['E', 0.12, 12, 0x8a94a6, 'raus'],
];
addScene({
  id: 'auswerten', t0: 91.0, t1: 104.0, step: 6,
  html: head('SCHRITT 6 · WÖCHENTLICH', 'blau', 'Klicks auswerten', 'Gewinner wachsen, Schwache fliegen raus.') + `
  <div class="el" data-in="0.8" style="left:60px;right:60px;top:490px;display:flex;flex-wrap:wrap;gap:10px 12px;align-items:center;justify-content:center;font-weight:800;font-size:22px">
    <span class="chip grau mono" style="font-size:21px">vorgeschlagen</span>→<span class="chip gelb mono" style="font-size:21px">ja</span>→<span class="chip blau mono" style="font-size:21px">steckbrief</span>→<span class="chip blau mono" style="font-size:21px">video_fertig</span>→<span class="chip blau mono" style="font-size:21px">veröffentlicht</span>
    <span style="flex-basis:100%;height:0"></span>
    <span class="small" style="font-size:21px">Ausgang:</span><span class="chip grau mono" style="font-size:21px">abgelehnt</span><span class="chip grau mono" style="font-size:21px">raus</span></div>
  <div class="el small" data-in="1.4" style="left:60px;right:60px;top:660px;text-align:center;font-size:22px;letter-spacing:.08em">KLICKS PRO PRODUKT · BEISPIELDATEN</div>` +
    BARS.map((b, i) => `<div class="el" id="bv${i}" style="width:0;height:0;opacity:0"><div style="position:absolute;left:-60px;top:-18px;width:120px;text-align:center;font-weight:900;font-size:32px">0</div></div>
      <div class="el" id="bl${i}" style="width:0;height:0;opacity:0"><div style="position:absolute;left:-75px;top:0;width:150px;text-align:center;font-weight:900;font-size:26px">${b[0]}</div>
      <div style="position:absolute;left:-75px;top:34px;width:150px;text-align:center;font-weight:800;font-size:20px;color:${b[3] === 0x2f7bff ? '#9cc2ff' : b[3] === 0xffc800 ? '#ffc800' : '#a9b2c3'}">${b[4]}</div></div>`).join('') + `
  <div class="el card" data-in="8.5" style="left:60px;right:60px;top:1235px;height:100px;display:flex;align-items:center;justify-content:space-around;text-align:center;box-sizing:border-box">
    <div><div style="font-size:30px;font-weight:900">≈ 0,25–0,40 €</div><div class="small" style="font-size:20px">neues Video</div></div>
    <div style="font-size:30px;color:var(--leise)">vs.</div>
    <div><div style="font-size:30px;font-weight:900;color:var(--gelb)">≈ 0,10–0,15 €</div><div class="small" style="font-size:20px">Folgevideo</div></div></div>`,
  build(g, el) {
    const bars = BARS.map((b, i) => {
      const m = rbox(0.8, 1, 0.8, 0.12, new THREE.MeshStandardMaterial({ color: b[3], roughness: 0.35, metalness: 0.2, emissive: b[3], emissiveIntensity: 0.15 }));
      g.add(m); return m;
    });
    const floor = rbox(6.6, 0.12, 1.5, 0.05, new THREE.MeshStandardMaterial({ color: 0x1b2850, roughness: 0.6 }));
    floor.position.set(0, -1.18, 0); g.add(floor);
    const baseY = -1.12;
    const bv = BARS.map((_, i) => el.querySelector('#bv' + i));
    const bl = BARS.map((_, i) => el.querySelector('#bl' + i));
    return (t) => {
      scene.updateMatrixWorld(true);
      BARS.forEach((b, i) => {
        const p = eOut(seg(t, 1.8 + i * 0.45, 3.4 + i * 0.45));
        const hgt = Math.max(0.001, b[1] * 2.5 * p);
        const x = (i - 2) * 1.3;
        bars[i].scale.set(1, hgt, 1);
        bars[i].position.set(x, baseY + hgt / 2, 0);
        bars[i].rotation.y = Math.sin(t * 0.6 + i) * 0.08;
        place(bv[i], new THREE.Vector3(x, baseY + hgt + 0.35, 0));
        bv[i].firstElementChild.textContent = Math.round(b[2] * p);
        bv[i].style.opacity = seg(t, 2.0 + i * 0.45, 2.5 + i * 0.45);
        place(bl[i], new THREE.Vector3(x, baseY - 0.2, 0.6));
        bl[i].style.opacity = eOut(seg(t, 6.0, 6.6));
      });
    };
  },
});

// ============================================================
// Szene 8 · Schluss
// ============================================================
addScene({
  id: 'schluss', t0: 104.0, t1: 113.0, step: 7,
  html: `
  <div class="el" data-in="0.6" data-k="pop" style="left:60px;right:60px;top:240px;text-align:center"><span class="chip gelb" style="font-size:30px">DER KREISLAUF IN EINEM SATZ</span></div>
  <div class="el" data-in="1.2" style="left:60px;right:60px;top:830px;text-align:center;font-size:72px;font-weight:900;line-height:1.08;text-shadow:0 4px 0 #17306a,0 14px 30px rgba(0,0,0,.45)">Maschine <span style="color:#7db0ff">liefert</span>.<br>Mensch <span style="color:var(--gelb)">entscheidet</span>.</div>
  <div class="el" data-in="3.0" style="left:60px;right:60px;top:1100px;text-align:center;font-size:36px;font-weight:700;color:var(--leise)">Ehrlich vor verkaufsstark.</div>
  <div class="el" data-in="4.2" data-k="pop" style="left:0;right:0;top:1190px;text-align:center"><span class="chip blau" style="font-size:36px;padding:12px 36px">Danke, Oliver!</span></div>`,
  build(g, el) {
    const ring = makeRing(1.55);
    ring.g.position.y = 2.6;
    g.add(ring.g);
    return (t) => ring.update(t, 0.2);
  },
});

// ============================================================
// Zeichnen eines Einzelbildes
// ============================================================
// Kopfzeile: Fortschritt der sechs Schritte
const stepsEl = document.getElementById('steps');
stepsEl.innerHTML = STEPS.map((s, i) => `<div class="stepcell"><div class="stepbar"><i></i></div><div class="steplabel">${i + 1} ${s}</div></div>`).join('');
const stepCells = [...stepsEl.children];

const capEl = document.getElementById('cap');
let capKey = -2;

// PLING-Beschriftungen (je Soundmarke eine)
const plingEls = CUES.pling.map(() => {
  const d = document.createElement('div'); d.className = 'pling'; d.textContent = 'PLING!'; d.style.opacity = 0;
  ui.appendChild(d); return d;
});

export function renderAt(T) {
  // Kamera: ganz leichte Bewegung für Tiefenwirkung
  camera.position.x = Math.sin(T * 0.25) * 0.35;
  camera.position.y = Math.sin(T * 0.19) * 0.12;
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);

  motes.children.forEach((m) => {
    const u = m.userData;
    m.position.y = u.y0 + Math.sin(T * u.sp + u.ph) * 0.5;
  });

  // aktive Szene(n)
  let current = null;
  for (const s of SCENES) {
    const active = T >= s.t0 - 0.001 && T < s.t1;
    s.el.style.display = active ? 'block' : 'none';
    s.g.visible = active;
    if (!active) continue;
    current = s;
    const local = T - s.t0;
    const fadeOut = clamp01((s.t1 - T) / 0.4);
    s.el.style.opacity = fadeOut;
    s.g.scale.setScalar(0.9 + 0.1 * fadeOut);
    s.upd(local, T);
    // einblenden der HTML-Elemente
    for (const r of s.reveals) {
      const p = r.k === 'pop' ? eBack(seg(local, r.a, r.a + 0.5)) : eOut(seg(local, r.a, r.a + 0.55));
      const o = clamp01(seg(local, r.a, r.a + 0.35)) * (r.b !== null ? 1 - seg(local, r.b, r.b + 0.3) : 1);
      r.n.style.opacity = o;
      const dim = r.n.dataset.dim ? +r.n.dataset.dim : 1;
      if (r.n.classList.contains('kc')) r.n.style.opacity = o * (0.35 + 0.65 * dim);
      r.n.style.transform = r.k === 'pop' ? `scale(${0.6 + 0.4 * p})` : `translateY(${(1 - p) * 34}px)`;
      r.n.style.visibility = o > 0.001 ? 'visible' : 'hidden';
    }
  }

  // Sprecher bestimmen -> Figuren bewegen sich
  const c = CAPTIONS.find((x) => T >= x[0] && T < x[1]);
  const who = c ? c[2] : null;
  const talk = (name) => (who === name ? 1 : 0);

  // Toast-Sprung bei PLING
  let toast = 0;
  CUES.pling.forEach((cue, i) => {
    const dt = T - cue;
    const e = plingEls[i];
    if (dt >= 0 && dt < 1.0) {
      const up = dt < 0.14 ? eOut(dt / 0.14) : 1 - eInOut(seg(dt, 0.14, 0.9));
      toast = Math.max(toast, up);
      const sp = sepp.group.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0.5, 3.1, 0));
      place(e, sp, -80 + (i % 2 ? 40 : -10), -dt * 60);
      e.style.opacity = dt < 0.7 ? 1 : 1 - (dt - 0.7) / 0.3;
      e.style.transform = `scale(${0.7 + 0.5 * eBack(seg(dt, 0, 0.25))}) rotate(${(i % 2 ? 6 : -6)}deg)`;
    } else e.style.opacity = 0;
  });

  // Posen
  const crashT = T - 75.0;
  const crash = crashT > 0 && crashT < 1.6 ? 1 : 0;
  const udoWave = (T > 0.5 && T < 4.2) || (T > 109 && T < 113) ? 1 : 0;
  const udoThumb = (T > 82.4 && T < 90) ? 1 : (T > 57.5 && T < 61) ? 1 : 0;
  robobert.update(T, { talk: talk('robobert'), boast: talk('robobert') * (crash ? 0 : 1), crash, lookX: 0.5 });
  sepp.update(T, { talk: talk('sepp'), toast, lookX: -0.5 });
  udo.update(T, { talk: talk('udo') * (1 - udoWave * 0.0), wave: udoWave, thumb: udoThumb, lookX: 0 });
  trio.visible = true;

  // Kopfzeile
  const step = current ? current.step : 0;
  stepCells.forEach((cell, i) => {
    const idx = i + 1;
    let fill = 0;
    if (step === 7) fill = 1;
    else if (step > 0) fill = idx < step ? 1 : idx === step ? clamp01((T - current.t0) / (current.t1 - current.t0)) : 0;
    cell.querySelector('i').style.width = fill * 100 + '%';
    cell.classList.toggle('aktiv', idx === step);
  });

  // Untertitel
  const key2 = c ? CAPTIONS.indexOf(c) : -1;
  if (key2 !== capKey) {
    capKey = key2;
    capEl.innerHTML = c
      ? `<div class="capbox"><span class="who" style="background:${WHO[c[2]].color}">${WHO[c[2]].name}</span><div class="txt">${c[3]}</div></div>`
      : '';
  }
  if (c) {
    const o = Math.min(seg(T, c[0], c[0] + 0.2), 1 - seg(T, c[1] - 0.15, c[1]));
    capEl.style.opacity = o;
    capEl.style.transform = `translateY(${(1 - eOut(seg(T, c[0], c[0] + 0.25))) * 24}px)`;
  }

  renderer.render(scene, camera);
}
window.renderAt = renderAt;
window.DURATION = DURATION;
window.READY = true;

// ---------- Vorschau-Modus ----------
if (params.has('t')) {
  renderAt(+params.get('t'));
} else if (!params.has('render')) {
  const t0 = performance.now();
  const loop = () => {
    renderAt(((performance.now() - t0) / 1000) % DURATION);
    requestAnimationFrame(loop);
  };
  loop();
} else {
  renderAt(0);
}
