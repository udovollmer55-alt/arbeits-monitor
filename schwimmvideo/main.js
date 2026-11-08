// ============================================================
// "Hendrik schwimmt!" – 3D-Motion-Graphics-Video (9:16)
// Hendrik (7) macht im Hallenbad das Sportabzeichen Schwimmen,
// Niklas (3) feuert ihn am Beckenrand an, der Bademeister stoppt die Zeit.
//
// Wie beim Robobert-Video: renderAt(T) zeichnet exakt den Zustand zur Sekunde T.
//   Vorschau:        index.html        Einzelbild: index.html?t=30
//   Video rendern:   node render.mjs video ausgabe.mp4
// ============================================================
import * as THREE from './lib/three.module.js';
import { makeHendrik, makeNiklas, makeBademeister } from './figuren.js';

const W = 1080, H = 1920;
export const DURATION = 96;
const params = new URLSearchParams(location.search);

// ---------- Mathe-Helfer ----------
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const seg = (t, a, b) => clamp01((t - a) / (b - a));
const lerp = (a, b, u) => a + (b - a) * u;
const eOut = (x) => 1 - Math.pow(1 - x, 3);
const eInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const eBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
let seed = 11;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

// ---------- Bühne ----------
const stage = document.getElementById('stage');
const ui = document.getElementById('ui');
function fit() {
  if (params.has('render')) return;
  const k = Math.min(innerWidth / W, innerHeight / H);
  stage.style.transform = `scale(${k})`;
  stage.style.left = (innerWidth - W * k) / 2 + 'px';
  stage.style.top = (innerHeight - H * k) / 2 + 'px';
}
fit(); addEventListener('resize', fit);

const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('gl'), antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xdcefff);
scene.fog = new THREE.Fog(0xdcefff, 30, 70);
const camera = new THREE.PerspectiveCamera(40, W / H, 0.05, 120);
scene.add(camera);

// Umgebungsspiegelung (für Wasser und glänzende Teile)
{
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(30, 24, 16), new THREE.MeshBasicMaterial({ color: 0xbfe4ff, side: THREE.BackSide })));
  [[0, 20, 0, 0xffffff, 24], [-20, 6, 0, 0xffffff, 14], [0, 6, -25, 0xe8f6ff, 14]].forEach(([x, y, z, c, s]) => {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(s, s), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
    p.position.set(x, y, z); p.lookAt(0, 0, 0); env.add(p);
  });
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(env, 0.03).texture;
}
scene.add(new THREE.HemisphereLight(0xeaf4ff, 0x6a8fb0, 0.55));
const sun = new THREE.DirectionalLight(0xffeedd, 2.3); sun.position.set(-5, 9, 6); scene.add(sun);
const fill = new THREE.DirectionalLight(0xbfe0ff, 0.6); fill.position.set(6, 5, 6); scene.add(fill);

// ---------- Texturen ----------
function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
/** Fliesen: n Fliesen pro Texturkachel */
const tiles = (base, line, n = 4) => (g, w, h) => {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  g.strokeStyle = line; g.lineWidth = 3;
  for (let i = 0; i <= n; i++) {
    g.beginPath(); g.moveTo(i * w / n, 0); g.lineTo(i * w / n, h); g.stroke();
    g.beginPath(); g.moveTo(0, i * h / n); g.lineTo(w, i * h / n); g.stroke();
  }
};

// ============================================================
// Hallenbad (1 Einheit = 1 Meter)
// Becken: x von -3.75 bis 1.25 (2 Bahnen), z von -25 bis 0, Tiefe 1,3 m.
// Hendrik schwimmt auf Bahn 1 (Mitte x = -2.5).
// ============================================================
const POOL = { x0: -3.75, x1: 1.25, z0: -25, z1: 0, depth: 1.3 };
const LANE = -2.5;
const DECK = 0.12;          // Höhe des Beckenrands über dem Wasser

// Beckenboden mit Bahnlinien
{
  const floorTex = canvasTex(400, 2000, (g, w, h) => {
    tiles('#9fe0f4', '#86cfe6', 20)(g, w, h);
    for (let y = 0; y < h; y += 20) { g.strokeStyle = '#86cfe6'; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.fillStyle = '#123c9c';
    for (const lx of [LANE, 0]) {
      const px = ((lx - POOL.x0) / 5) * w;
      g.fillRect(px - 10, 160, 20, h - 320);               // Bahnlinie
      g.fillRect(px - 40, 160, 80, 16); g.fillRect(px - 40, h - 176, 80, 16); // T-Enden
    }
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(5, 25), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((POOL.x0 + POOL.x1) / 2, -POOL.depth, -12.5);
  scene.add(floor);
  // Beckenwände innen
  const wallTex = canvasTex(256, 256, tiles('#bdeefc', '#94d6ea', 4), [1, 1]);
  const wallMat = (rx, ry) => { const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(rx, ry); return new THREE.MeshStandardMaterial({ map: t, roughness: 0.5 }); };
  const h = POOL.depth + DECK;
  const mk = (w, mat, x, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, DECK - h / 2, z); m.rotation.y = ry; scene.add(m); };
  mk(25, wallMat(25, h), POOL.x0, -12.5, Math.PI / 2);
  mk(25, wallMat(25, h), POOL.x1, -12.5, -Math.PI / 2);
  mk(5, wallMat(5, h), -1.25, POOL.z0, 0);
  mk(5, wallMat(5, h), -1.25, POOL.z1, Math.PI);
}

// Beckenumgang (Fliesenboden mit Loch für das Becken)
{
  // Shape-Koordinaten: (x, -z), weil die Fläche danach flach gelegt wird
  const hole = new THREE.Path();
  hole.moveTo(POOL.x0, -POOL.z1); hole.lineTo(POOL.x1, -POOL.z1); hole.lineTo(POOL.x1, -POOL.z0); hole.lineTo(POOL.x0, -POOL.z0); hole.lineTo(POOL.x0, -POOL.z1);
  const outer = new THREE.Shape();
  outer.moveTo(-10, -14); outer.lineTo(8, -14); outer.lineTo(8, 33); outer.lineTo(-10, 33); outer.lineTo(-10, -14);
  outer.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(outer, { depth: 0.2, bevelEnabled: false });
  const tex = canvasTex(256, 256, tiles('#eef1f4', '#d3dae2', 3), [1, 1]);
  const deck = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 }));
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = DECK - 0.2;
  scene.add(deck);
  // Beckenkante: weiß-blauer Rand
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x1d6fe0, roughness: 0.4 });
  const edge = (w, d, x, z) => {
    const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), edgeMat); e.position.set(x, DECK + 0.03, z); scene.add(e);
  };
  edge(5.5, 0.25, -1.25, 0.12); edge(5.5, 0.25, -1.25, -25.12); edge(0.25, 25.5, POOL.x0 - 0.12, -12.5); edge(0.25, 25.5, POOL.x1 + 0.12, -12.5);
  const stripe = (w, d, x, z) => { const e = new THREE.Mesh(new THREE.BoxGeometry(w, 0.01, d), stripeMat); e.position.set(x, DECK + 0.005, z); scene.add(e); };
  stripe(6.4, 0.12, -1.25, 0.42); stripe(6.4, 0.12, -1.25, -25.42); stripe(0.12, 25.9, POOL.x0 - 0.42, -12.5);
}

// Hallenwände, Fenster, Banner
{
  const wallTex = canvasTex(256, 256, tiles('#f7fafc', '#e1e8ef', 2), [1, 1]);
  const wall = (w, h, x, z, ry, extra) => {
    const t = wallTex.clone(); t.needsUpdate = true; t.repeat.set(w / 2, h / 2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 }));
    m.position.set(x, h / 2, z); m.rotation.y = ry; scene.add(m);
  };
  wall(47, 9, -10, -9.5, Math.PI / 2);
  wall(47, 9, 8, -9.5, -Math.PI / 2);
  wall(18, 9, -1, -33, 0);
  wall(18, 9, -1, 14, Math.PI);
  // Fensterband an der linken Wand
  const winTex = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#2b4f7a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#e9f7ff'); gr.addColorStop(1, '#a9d8ff');
      g.fillStyle = gr; g.fillRect(i * 128 + 8, 10, 112, h - 20);
    }
  });
  winTex.wrapS = THREE.RepeatWrapping; winTex.repeat.set(3, 1);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(40, 3.2), new THREE.MeshBasicMaterial({ map: winTex }));
  win.position.set(-9.98, 4.6, -10); win.rotation.y = Math.PI / 2; scene.add(win);
  // blauer Fliesenstreifen unten an den Wänden
  const band = new THREE.MeshStandardMaterial({ color: 0x1d6fe0, roughness: 0.6 });
  [[-9.97, -9.5, Math.PI / 2, 47], [-1, -32.97, 0, 18], [-1, 13.97, Math.PI, 18]].forEach(([x, z, ry, w]) => {
    const b = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.5), band); b.position.set(x, 1.2, z); b.rotation.y = ry; scene.add(b);
  });
  // Banner „Sportabzeichen-Tag“ an der Stirnwand hinten und vorne
  const banner = canvasTex(1024, 256, (g, w, h) => {
    g.fillStyle = '#ffc800'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#0b3f9e'; g.fillRect(0, h - 26, w, 26); g.fillRect(0, 0, w, 14);
    g.font = '900 120px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('SPORTABZEICHEN-TAG', w / 2, h / 2 + 4);
  });
  const b1 = new THREE.Mesh(new THREE.PlaneGeometry(9, 2.25), new THREE.MeshBasicMaterial({ map: banner }));
  b1.position.set(-1.5, 4.6, -32.95); scene.add(b1);
  const b2 = b1.clone(); b2.position.set(-1.5, 4.6, 13.95); b2.rotation.y = Math.PI; scene.add(b2);
  // Meterschilder
  const sign = (txt, x, z, ry) => {
    const t = canvasTex(256, 160, (g, w, h) => {
      g.fillStyle = '#0b3f9e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = '900 96px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 4);
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.0), new THREE.MeshBasicMaterial({ map: t }));
    m.position.set(x, 2.2, z); m.rotation.y = ry; scene.add(m);
  };
  sign('0 m', -9.96, -0.5, Math.PI / 2); sign('5 m', -9.96, -5.5, Math.PI / 2); sign('10 m', -9.96, -10.5, Math.PI / 2);
  sign('15 m', -9.96, -15.5, Math.PI / 2); sign('20 m', -9.96, -20.5, Math.PI / 2); sign('25 m', -9.96, -25.3, Math.PI / 2);
  // Deckenlampen (leuchtende Flächen)
  for (let z = 10; z > -32; z -= 6) {
    const l = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    l.rotation.x = Math.PI / 2; l.position.set(-1, 8.9, z); scene.add(l);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(18, 47), new THREE.MeshStandardMaterial({ color: 0xe9f1f8, roughness: 1 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(-1, 9, -9.5); scene.add(ceil);
  // Rückenschwimmer-Fähnchen über dem Becken (5 m vor den Wänden)
  for (const fz of [-5, -20]) {
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 7, 6), new THREE.MeshBasicMaterial({ color: 0x334455 }));
    rope.rotation.z = Math.PI / 2; rope.position.set(-1.25, 1.9, fz); scene.add(rope);
    for (let i = 0; i < 12; i++) {
      const tri = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.28, 3), new THREE.MeshStandardMaterial({ color: [0x1d6fe0, 0xffc800, 0xffffff][i % 3], roughness: 0.6 }));
      tri.rotation.x = Math.PI; tri.position.set(-4.4 + i * 0.58, 1.75, fz); scene.add(tri);
    }
    for (const px of [-4.7, 2.2]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.9, 10), new THREE.MeshStandardMaterial({ color: 0xcfd6de, metalness: 0.6, roughness: 0.3 }));
      pole.position.set(px, DECK + 0.95, fz); scene.add(pole);
    }
  }
}

// Leine zwischen Bahn 1 und 2
const ropeFloats = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 12, 8), new THREE.MeshStandardMaterial({ roughness: 0.4 }), 100);
{
  const cols = [0x1d6fe0, 0xffffff, 0xffc800];
  for (let i = 0; i < 100; i++) {
    const zone = i < 8 || i > 91 ? 2 : i % 2;
    ropeFloats.setColorAt(i, new THREE.Color(cols[zone]));
  }
  scene.add(ropeFloats);
}

// ---------- Wasser (bewegte Oberfläche) ----------
const waterGeo = new THREE.PlaneGeometry(5, 25, 50, 250);
waterGeo.rotateX(-Math.PI / 2);
const water = new THREE.Mesh(waterGeo, new THREE.MeshPhysicalMaterial({
  color: 0x2fa9e4, transparent: true, opacity: 0.7, roughness: 0.08, metalness: 0.0, envMapIntensity: 1.2, side: THREE.DoubleSide,
}));
water.position.set(-1.25, 0, -12.5);
scene.add(water);
const wpos = waterGeo.attributes.position;
const wBase = Float32Array.from(wpos.array);

// ============================================================
// Zeitplan von Hendrik (alle Zeiten in Sekunden)
// ============================================================
const T_FAR = 21.0;      // Schnitt: Hendrik steht am anderen Ende
const T_JUMP = 26.0;     // Sprung ins Wasser (nach dem Pfiff)
const S1 = [27.4, 38.4]; // 25 m auf Zeit (schwimmt Richtung Niklas)
const T_TURN0 = 49.8;    // im Wasser umdrehen
const T_PUSH = 51.2;     // Abstoßen für 50 m
const S2 = [51.9, 62.9]; // 50 m, erste Bahn (weg von Niklas)
const TURN = [62.9, 63.9]; // Wende an der Wand
const S3 = [63.9, 74.9]; // 50 m, zweite Bahn (zurück zu Niklas)
const Z_NEAR = -1.15, Z_FAR = -23.85;   // Hüfte beim Anschlag
const Y_FLOAT = -0.12, Y_TREAD = -0.5; // Hüfthöhe schwimmend / im Wasser stehend

const hendrik = makeHendrik(), niklas = makeNiklas(), bm = makeBademeister();
[hendrik, niklas, bm].forEach((f) => { f.group.rotation.order = 'YXZ'; scene.add(f.group); });

/** Zustand von Hendrik zur Zeit T (reine Funktion – auch für Spritzer gebraucht) */
function hState(T) {
  const st = { x: LANE, y: DECK + hendrik.standY, z: 0.55, head: Math.PI, prone: 0, crawl: 0, kick: 0, gog: 0, cheer: 0, swim: false };
  if (T < T_FAR) return st;
  // am anderen Ende auf dem Beckenrand, Blick zum Becken (+z)
  st.z = -25.5; st.head = 0; st.gog = eInOut(seg(T, 21.7, 22.6));
  if (T < T_JUMP) return st;
  st.gog = 1;
  if (T < T_JUMP + 0.7) { // Sprung (Fußsprung)
    const u = (T - T_JUMP) / 0.7;
    st.z = lerp(-25.5, -24.4, u);
    st.y = lerp(DECK + hendrik.standY, Y_TREAD, u) + 0.5 * Math.sin(Math.PI * u);
    return st;
  }
  if (T < S1[0]) { // hinlegen
    const u = eInOut(seg(T, T_JUMP + 0.7, S1[0]));
    return { ...st, z: lerp(-24.4, Z_FAR, u), y: lerp(Y_TREAD, Y_FLOAT, u), prone: u, crawl: u, kick: u };
  }
  if (T < S1[1]) return swim(st, T, S1, Z_FAR, Z_NEAR, 0);
  // Anschlag, aufrichten, Pause
  st.z = Z_NEAR; st.head = 0;
  if (T < T_PUSH) {
    const up = 1 - eInOut(seg(T, S1[1], S1[1] + 0.7));
    st.prone = up; st.crawl = up; st.kick = up;
    st.y = lerp(Y_TREAD, Y_FLOAT, up) + Math.sin(T * 2.4) * 0.02 * (1 - up);
    st.cheer = seg(T, 39.3, 39.8) * (1 - seg(T, 41.3, 41.8));
    st.head = lerp(0, Math.PI, eInOut(seg(T, T_TURN0, T_TURN0 + 1.0)));
    return st;
  }
  if (T < S2[0]) {
    const u = eInOut(seg(T, T_PUSH, S2[0]));
    return { ...st, head: Math.PI, z: lerp(Z_NEAR, Z_NEAR - 0.5, u), y: lerp(Y_TREAD, Y_FLOAT, u), prone: u, crawl: u, kick: u };
  }
  if (T < S2[1]) return swim(st, T, S2, Z_NEAR - 0.5, Z_FAR, Math.PI);
  if (T < TURN[1]) { // Wende: kurz aufrichten, umdrehen, abstoßen
    const u = seg(T, TURN[0], TURN[1]);
    const p = 1 - Math.sin(Math.PI * u) * 0.75;
    return { ...st, z: Z_FAR + 0.3 * Math.sin(Math.PI * u), head: lerp(Math.PI, 2 * Math.PI, eInOut(u)), prone: p, crawl: p, kick: p, y: lerp(Y_TREAD, Y_FLOAT, p), swim: true };
  }
  if (T < S3[1]) return swim(st, T, S3, Z_FAR, Z_NEAR, 0);
  // Ziel: aufrichten und jubeln
  const up = 1 - eInOut(seg(T, S3[1], S3[1] + 0.7));
  // ab 78 s dreht er sich zur Kamera (zum Becken) um
  return { ...st, z: Z_NEAR, head: lerp(0, Math.PI, eInOut(seg(T, 78.0, 79.2))), prone: up, crawl: up, kick: up, y: lerp(Y_TREAD, Y_FLOAT, up) + Math.sin(T * 2.4) * 0.02, cheer: seg(T, 75.8, 76.4) };
}
function swim(st, T, [a, b], z0, z1, head) {
  const u = (T - a) / (b - a);
  // etwas schneller in der Mitte, langsamer am Ende (wirkt natürlicher)
  const v = u + Math.sin(u * Math.PI * 2) * 0.012;
  return { ...st, z: lerp(z0, z1, v), head, prone: 1, crawl: 1, kick: 1, y: Y_FLOAT + Math.sin(T * 10) * 0.02, swim: true };
}
/** Zurückgelegte Meter je Aufgabe (für die Anzeigetafel) */
function meter(T) {
  if (T < S1[1] + 0.1) return { task: 1, m: 25 * seg(T, S1[0] - 0.6, S1[1]) };
  if (T < S2[0] - 0.6) return { task: 2, m: 0 };
  if (T < S2[1]) return { task: 2, m: 25 * seg(T, S2[0] - 0.6, S2[1]) };
  if (T < S3[0]) return { task: 2, m: 25 };
  return { task: 2, m: 25 + 25 * seg(T, S3[0], S3[1]) };
}

// Stoppuhr + Pfeife für den Bademeister
{
  const watch = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.03, 24), new THREE.MeshStandardMaterial({ color: 0xc9d3dc, metalness: 0.7, roughness: 0.25 }));
  body.rotation.x = Math.PI / 2; watch.add(body);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.062, 24), new THREE.MeshStandardMaterial({ color: 0xffffff }));
  face.position.z = 0.017; watch.add(face);
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8), body.material);
  knob.position.y = 0.09; watch.add(knob);
  watch.position.set(0, bm.arms[1].pivot.children[0].position.y * 2 - 0.02, 0.1);
  bm.arms[1].pivot.add(watch);
  const whistle = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.06, 4, 8), new THREE.MeshStandardMaterial({ color: 0xffc800, roughness: 0.4 }));
  whistle.rotation.z = Math.PI / 2;
  whistle.position.set(0.05, bm.torsoH * 0.72, 0.21);
  bm.group.add(whistle);
  const lanyard = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.008, 6, 30, Math.PI), new THREE.MeshStandardMaterial({ color: 0x1d6fe0 }));
  lanyard.rotation.z = Math.PI; lanyard.position.set(0, bm.torsoH * 0.9, 0.12);
  bm.group.add(lanyard);
  const label = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.09), new THREE.MeshBasicMaterial({
    map: canvasTex(512, 128, (g, w, h) => { g.fillStyle = '#0b3f9e'; g.font = '900 64px Inter, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('BADEMEISTER', w / 2, h / 2 + 3); }),
    transparent: true,
  }));
  label.position.set(0, bm.torsoH * 0.5, 0.205);
  bm.group.add(label);
}

// Kontaktschatten unter den Figuren am Beckenrand
const shadowTex = canvasTex(128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, 'rgba(20,40,70,.45)'); gr.addColorStop(1, 'rgba(20,40,70,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const mkShadow = (w) => {
  const s = new THREE.Mesh(new THREE.PlaneGeometry(w, w * 0.8), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
  s.rotation.x = -Math.PI / 2; scene.add(s); return s;
};
const shH = mkShadow(0.7), shN = mkShadow(0.6), shB = mkShadow(0.9);

// Wasserspritzer (feste Anzahl kleiner Tropfen, deterministisch berechnet)
const drops = [];
const dropMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1, transparent: true, opacity: 0.85 });
for (let i = 0; i < 90; i++) {
  const d = new THREE.Mesh(new THREE.SphereGeometry(0.014 + rnd() * 0.022, 8, 6), dropMat);
  d.userData = { ph: rnd(), ang: rnd() * Math.PI * 2, sp: 0.6 + rnd() * 1.4, up: 1.4 + rnd() * 2.2, side: rnd() - 0.5 };
  scene.add(d); drops.push(d);
}
const BURSTS = [[T_JUMP + 0.62, 1.0], [S1[1] - 0.1, 0.5], [TURN[0] + 0.2, 0.55], [S3[1] - 0.1, 0.5], [T_PUSH + 0.2, 0.4]];

// ============================================================
// Untertitel
// ============================================================
const WHO = {
  bademeister: { name: 'Bademeister', color: 'var(--bade)' },
  hendrik: { name: 'Hendrik', color: 'var(--hendrik)' },
  niklas: { name: 'Niklas', color: 'var(--niklas)' },
};
export const CAPTIONS = [
  [0.5, 4.2, 'bademeister', 'Willkommen im Hallenbad, Hendrik und Niklas!'],
  [4.3, 7.6, 'niklas', 'Hendrik schwimmt heute! Juhu!'],
  [8.2, 12.4, 'bademeister', 'Heute machst du dein Sportabzeichen im Schwimmen.'],
  [12.5, 16.6, 'bademeister', 'Zuerst 25 Meter auf Zeit. Ich stoppe mit der Uhr.'],
  [16.7, 20.8, 'bademeister', 'Danach 50 Meter. Ohne Zeitlimit, aber ohne Pause!'],
  [21.2, 23.3, 'hendrik', 'Ich bin bereit!'],
  [23.5, 25.9, 'bademeister', 'Auf die Plätze … fertig … los!'],
  [27.6, 29.9, 'niklas', 'HENDRIK! HENDRIK!'],
  [30.1, 32.7, 'niklas', 'Schneller, Hendrik! Du schaffst das!'],
  [33.2, 36.6, 'bademeister', 'Super Tempo! Gleich ist die Wand da!'],
  [38.5, 41.4, 'bademeister', 'Anschlag – Stopp! Zeit gestoppt!'],
  [41.6, 44.0, 'hendrik', 'Puh! War ich schnell?'],
  [44.1, 47.0, 'bademeister', 'Eine tolle Zeit! Kurz verschnaufen.'],
  [47.2, 50.8, 'bademeister', 'Jetzt die 50 Meter: hin und zurück, ohne Pause!'],
  [52.2, 54.8, 'niklas', 'Los, Hendrik, los!'],
  [55.2, 58.0, 'niklas', 'HEN-DRIK! HEN-DRIK!'],
  [58.8, 62.2, 'bademeister', 'Nicht anhalten! Immer weiter!'],
  [63.0, 66.0, 'bademeister', 'Wende geschafft! Noch 25 Meter!'],
  [66.4, 69.0, 'niklas', 'Komm, Hendrik! Schneller!'],
  [69.8, 73.4, 'bademeister', 'Gleich ist er da – nur noch ein paar Meter!'],
  [74.6, 76.6, 'niklas', 'HURRAAA!'],
  [77.0, 80.6, 'bademeister', 'Geschafft! 50 Meter ohne Pause. Bestanden!'],
  [80.8, 83.4, 'hendrik', 'Ich hab’s geschafft!'],
  [83.6, 86.6, 'niklas', 'Hendrik ist der Beste!'],
  [86.8, 90.6, 'bademeister', 'Herzlichen Glückwunsch zum Sportabzeichen!'],
  [90.8, 94.2, 'hendrik', 'Danke, Niklas, fürs Anfeuern!'],
];

// Soundmarken (render.mjs liest window.CUES)
export const CUES = {
  whistle: [25.85, 50.95],
  splash: [[T_JUMP + 0.62, 1.0], [TURN[0] + 0.2, 0.45], [T_PUSH + 0.2, 0.35]],
  ding: [38.45, 74.95],
  fanfare: [76.0, 86.9],
  swim: [S1, S2, [TURN[1], S3[1]]],
};
window.CUES = CUES;

// ============================================================
// Kameraschnitte
// ============================================================
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const NIK = V(-3.45, DECK, 0.55), BM = V(-1.2, DECK, 0.85);
const SHOTS = [
  // [von, bis, Funktion(T) -> [Position, Blickziel]]
  [0, 8, (T) => { const u = eInOut(seg(T, 0, 8)); return [V(lerp(-1.2, -2.1, u), lerp(1.45, 1.3, u), lerp(-9.6, -8.0, u)), V(-2.35, 0.75, 0.6)]; }],
  [8, 21, (T) => { const u = eInOut(seg(T, 8, 21)); return [V(lerp(4.5, 3.2, u), lerp(6.5, 4.2, u), lerp(9.5, 6.0, u)), V(lerp(-1.6, -1.8, u), 0, lerp(-9, -13, u))]; }],
  [21, 23.4, (T) => [V(-1.6, 1.25, lerp(-20.4, -21.3, seg(T, 21, 23.4))), V(-2.5, 0.8, -25.5)]],
  [23.4, 26.0, (T) => [V(-1.6, 1.45, lerp(-3.6, -3.1, seg(T, 23.4, 26))), V(-1.4, 1.15, 0.85)]],
  [26.0, 28.6, () => [V(1.6, 1.5, -20.6), V(-2.6, 0.1, -24.3)]],
  [28.6, 30.0, track('front')],
  [30.0, 32.8, nikCam()],
  [32.8, 36.0, track('side')],
  [36.0, 38.0, track('front')],
  [38.0, 51.0, (T) => { const u = eInOut(seg(T, 38, 51)); return [V(lerp(0.2, -0.3, u), lerp(1.55, 1.35, u), lerp(-4.4, -3.9, u)), V(-2.6, 0.45, 0.0)]; }],
  [51.0, 55.0, track('side')],
  [55.0, 58.0, nikCam()],
  [58.0, 62.6, track('back')],
  [62.6, 64.2, () => [V(-0.7, 1.35, -20.3), V(-2.5, 0.1, -23.9)]],
  [64.2, 66.3, track('front')],
  [66.3, 69.0, nikCam()],
  [69.0, 73.0, track('side')],
  [73.0, 78.0, (T) => [V(0.3, 1.5, -4.6), V(-2.65, 0.5, 0.05)]],
  [78.0, 96.0, (T) => { const u = eInOut(seg(T, 78, 96)); return [V(lerp(-1.3, -1.8, u), lerp(1.05, 0.95, u), lerp(-5.6, -4.9, u)), V(-2.95, 0.35, -0.3)]; }],
];
/** Verfolgerkamera: 'front' = vor Hendrik (er schwimmt auf uns zu), 'back' = vor ihm in -z, 'side' = von der Seite */
function track(kind) {
  return (T) => {
    const s = hState(T);
    const dir = s.head === 0 || Math.abs(Math.cos(s.head) - 1) < 1e-6 ? 1 : -1;
    if (kind === 'side') return [V(2.6, 1.9, s.z + 2.0 * dir), V(LANE - 0.4, 0.0, s.z - 0.3 * dir)];
    const d = kind === 'back' ? -1 : 1;
    return [V(0.8, 1.8, s.z + 5.0 * d), V(LANE - 0.3, 0.1, s.z + 0.6 * d)];
  };
}
/** Nahaufnahme von Niklas (Kamera schwebt über dem Wasser vor ihm) */
function nikCam() {
  return (T) => [V(-2.8, 0.95, -2.7), V(-3.3, 0.7, 0.55)];
}
function camAt(T) {
  const s = SHOTS.find((x) => T >= x[0] && T < x[1]) || SHOTS[SHOTS.length - 1];
  return s[2](T);
}

// ---------- Projektion 3D -> Pixel ----------
function toPx(v) {
  const p = v.clone().project(camera);
  return [(p.x * 0.5 + 0.5) * W, (-p.y * 0.5 + 0.5) * H, p.z];
}

// ============================================================
// HTML-Ebenen (Titel, Aufgaben, Anzeigetafel, Finale)
// ============================================================
const LAYERS = [];
function addLayer(t0, t1, html, upd) {
  const el = document.createElement('div');
  el.className = 'scene'; el.innerHTML = html; ui.appendChild(el);
  const reveals = [...el.querySelectorAll('[data-in]')].map((n) => ({ n, a: +n.dataset.in, k: n.dataset.k || 'rise' }));
  LAYERS.push({ t0, t1, el, reveals, upd: upd ? upd(el) : null });
}

// Titel
addLayer(0, 8, `
  <div class="el card" data-in="0.3" data-k="pop" style="left:90px;right:90px;top:130px;padding:20px 0 26px;text-align:center">
    <div class="big shadow3d" style="font-size:150px;line-height:.95;color:#fff">Hendrik</div>
    <div class="big shadow3d" style="font-size:118px;line-height:1;color:var(--gelb)">schwimmt!</div></div>
  <div class="el" data-in="1.2" style="left:40px;right:40px;top:470px;text-align:center">
    <span class="card" style="display:inline-block;padding:14px 34px;font-size:40px;font-weight:900">Sportabzeichen im Hallenbad</span></div>
  <div class="el" data-in="2.0" data-k="pop" style="left:0;right:0;top:585px;text-align:center"><span class="chip gelb" style="font-size:32px;padding:12px 32px">Für Hendrik &amp; Niklas</span></div>`);

// Aufgaben
addLayer(8, 21, `
  <div class="el" data-in="0.3" style="left:40px;right:40px;top:110px;text-align:center"><span class="chip blau" style="font-size:30px">DIE AUFGABEN</span></div>
  <div class="el card" data-in="4.5" style="left:40px;right:40px;top:200px;padding:26px 34px;box-sizing:border-box">
    <div style="display:flex;align-items:center;gap:26px"><div class="big" style="font-size:96px;color:var(--gelb)">1</div>
    <div><div class="big" style="font-size:54px">25 Meter auf Zeit</div><div style="font-size:30px;font-weight:700;color:#cfe6ff">Der Bademeister stoppt die Zeit.</div></div></div></div>
  <div class="el card" data-in="8.7" style="left:40px;right:40px;top:430px;padding:26px 34px;box-sizing:border-box">
    <div style="display:flex;align-items:center;gap:26px"><div class="big" style="font-size:96px;color:var(--gelb)">2</div>
    <div><div class="big" style="font-size:54px">50 Meter ohne Pause</div><div style="font-size:30px;font-weight:700;color:#cfe6ff">Kein Zeitlimit – aber nicht anhalten!</div></div></div></div>`);

// Anzeigetafel (Aufgabe 1 und 2) – Inhalt wird jedes Bild neu gesetzt
function hudHtml(n, titel, max) {
  return `
  <div class="el card hud" data-in="0.2">
    <div class="row"><div><span class="chip ${n === 1 ? 'gelb' : 'blau'}">AUFGABE ${n}</span><div class="titel">${titel}</div></div>
      <div class="meter"><span class="m">0</span><small> m / ${max}</small></div></div>
    <div class="track">${n === 2 ? '<span class="mark" style="left:50%"></span>' : ''}<i></i><b></b></div>
  </div>
  <div class="status el" data-in="0.4"><span class="pill"><span class="uhr"><i></i></span><span class="st"></span></span></div>`;
}
const hudUpd = (max) => (el) => {
  const m = el.querySelector('.m'), bar = el.querySelector('.track i'), dot = el.querySelector('.track b');
  const pill = el.querySelector('.pill'), st = el.querySelector('.st'), hand = el.querySelector('.uhr i');
  return (T) => {
    // Aufgabe 1 zählt nur die 25 m, Aufgabe 2 die 50 m
    const val = max === 25 ? 25 * seg(T, S1[0] - 0.6, S1[1]) : (T < S2[0] - 0.6 ? 0 : meter(T).m);
    m.textContent = Math.floor(val + 0.001);
    const f = clamp01(val / max);
    bar.style.width = f * 100 + '%'; dot.style.left = f * 100 + '%';
    let text, bg, fg, run;
    if (max === 25) {
      if (T < T_JUMP) { text = 'Gleich geht’s los'; bg = '#ffffff'; fg = '#0b3f9e'; run = false; }
      else if (T < S1[1]) { text = 'Zeit läuft'; bg = '#ffc800'; fg = '#111'; run = true; }
      else { text = 'Zeit gestoppt ✔'; bg = '#0b3f9e'; fg = '#fff'; run = false; }
    } else {
      if (T < T_PUSH) { text = 'Gleich geht’s weiter'; bg = '#ffffff'; fg = '#0b3f9e'; run = false; }
      else if (T < S3[1]) {
        const turn = T > TURN[0] - 0.4 && T < TURN[1] + 0.6;
        text = turn ? 'Wende!' : 'Nicht anhalten!'; bg = '#ffc800'; fg = '#111'; run = true;
      } else { text = 'Geschafft ✔'; bg = '#0b3f9e'; fg = '#fff'; run = false; }
    }
    st.textContent = text; pill.style.background = bg; pill.style.color = fg;
    pill.style.transform = run && max === 50 ? `scale(${1 + 0.04 * Math.sin(T * 8)})` : 'none';
    // Stoppuhr-Zeiger: dreht sich, solange die Zeit läuft
    const start = max === 25 ? T_JUMP : T_PUSH, end = max === 25 ? S1[1] : S3[1];
    const tt = Math.min(Math.max(T, start), end) - start;
    hand.style.transform = `rotate(${180 + tt * 36}deg)`;
  };
};
addLayer(23.4, 47.0, hudHtml(1, '25 Meter auf Zeit', 25), hudUpd(25));
addLayer(47.0, 77.0, hudHtml(2, '50 Meter ohne Pause', 50), hudUpd(50));

// Finale
addLayer(77.0, 96, `
  <div class="el card" data-in="0.2" data-k="pop" style="left:110px;right:110px;top:80px;padding:6px 0 14px;text-align:center">
    <div class="big shadow3d" style="font-size:118px;color:var(--gelb)">GESCHAFFT!</div></div>
  <div class="el card" data-in="10.0" style="left:60px;right:60px;top:270px;padding:22px 30px;box-sizing:border-box;text-align:center">
    <div class="big" style="font-size:44px">Sportabzeichen Schwimmen</div>
    <div style="font-size:32px;font-weight:800;margin-top:10px;color:#cfe6ff">25 m auf Zeit ✔ &nbsp;·&nbsp; 50 m ohne Pause ✔</div></div>
  <div class="el" data-in="14.0" data-k="pop" style="left:0;right:0;top:1500px;text-align:center"><span class="chip gelb" style="font-size:34px;padding:12px 34px">Super, Hendrik! Super, Niklas!</span></div>`);

// Medaille (3D, hängt an der Kamera, erscheint im Finale)
const medal = new THREE.Group();
{
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc83d, metalness: 0.85, roughness: 0.22 });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.07, 48), gold);
  disc.rotation.x = Math.PI / 2; medal.add(disc);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.04, 12, 48), gold); medal.add(rim);
  const faceTex = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#ffd35c'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#b8860b'; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 30, 0, Math.PI * 2); g.stroke();
    // Wellen
    g.strokeStyle = '#0b3f9e'; g.lineWidth = 20; g.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      g.beginPath();
      for (let x = 120; x <= 392; x += 4) { const y = 300 + k * 52 + Math.sin((x - 120) / 34) * 16; x === 120 ? g.moveTo(x, y) : g.lineTo(x, y); }
      g.stroke();
    }
    g.fillStyle = '#0b3f9e'; g.font = '900 64px Inter, sans-serif'; g.textAlign = 'center'; g.fillText('SCHWIMMEN', w / 2, 210);
  });
  for (const s of [1, -1]) {
    const f = new THREE.Mesh(new THREE.CircleGeometry(0.37, 48), new THREE.MeshStandardMaterial({ map: faceTex, metalness: 0.4, roughness: 0.35 }));
    f.position.z = s * 0.037; if (s < 0) f.rotation.y = Math.PI; medal.add(f);
  }
  for (const s of [-1, 1]) { // Band
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.02), new THREE.MeshStandardMaterial({ color: s < 0 ? 0x1d6fe0 : 0xffc800, roughness: 0.7 }));
    r.position.set(s * 0.13, 0.62, -0.03); r.rotation.z = s * 0.28; medal.add(r);
  }
  medal.position.set(-0.36, 0.6, -3.4);
  medal.scale.setScalar(0.6);
  medal.visible = false;
  camera.add(medal);
}

// Rufblase über Niklas
const ruf = document.createElement('div'); ruf.className = 'ruf'; ruf.style.opacity = 0; ui.appendChild(ruf);

// ============================================================
// Einzelbild zeichnen
// ============================================================
const capEl = document.getElementById('cap');
let capKey = -2;

export function renderAt(T) {
  // Kamera
  const [cp, cl] = camAt(T);
  camera.position.copy(cp); camera.lookAt(cl);
  camera.updateMatrixWorld(true);

  // ---- Hendrik ----
  const s = hState(T);
  hendrik.group.position.set(s.x, s.y, s.z);
  hendrik.group.rotation.set(s.prone * Math.PI / 2, s.head, 0);
  const c = CAPTIONS.find((x) => T >= x[0] && T < x[1]);
  const who = c ? c[2] : null;
  hendrik.update(T, {
    crawl: s.crawl, phase: T * Math.PI * 2 * 1.5, kick: s.kick, gog: s.gog,
    cheer: s.cheer, talk: who === 'hendrik' ? 1 : 0, lookY: s.prone * -0.55,
  });

  // ---- Niklas: steht am Beckenrand, hüpft und feuert an ----
  const racing = (T > T_JUMP && T < S1[1] + 1.5) || (T > T_PUSH && T < S3[1] + 2);
  const nShout = who === 'niklas' ? 1 : 0;
  const nCheer = Math.max(racing ? 0.8 : 0.15, nShout, T > S3[1] ? 1 : 0);
  const hop = Math.abs(Math.sin(T * (racing ? 8.5 : 5))) * 0.09 * nCheer;
  niklas.group.position.set(NIK.x, DECK + niklas.standY + hop, NIK.z);
  // schaut zu Hendrik (dreht sich leicht mit)
  const toH = Math.atan2(s.x - NIK.x, s.z - NIK.z);
  niklas.group.rotation.set(0, T < T_FAR ? Math.PI : lerp(Math.PI, toH, 0.35), 0);
  niklas.update(T, { cheer: nCheer, shout: nShout, talk: nShout, lookX: 0 });

  // ---- Bademeister ----
  const bTalk = who === 'bademeister' ? 1 : 0;
  const whistleArm = seg(T, 23.6, 24.0) * (1 - seg(T, 26.1, 26.6)) + seg(T, 50.2, 50.5) * (1 - seg(T, 51.3, 51.7));
  const showWatch = Math.max(seg(T, 37.6, 38.0) * (1 - seg(T, 41.0, 41.5)), seg(T, 74.2, 74.6) * (1 - seg(T, 77.5, 78.0)));
  bm.group.position.set(BM.x, DECK + bm.standY, BM.z);
  bm.group.rotation.set(0, Math.PI - 0.35, 0);
  bm.update(T, { talk: bTalk, wave: whistleArm, fwd: showWatch, cheer: T > 86.8 && T < 90.6 ? 0.35 : 0 });

  // Schatten
  shH.visible = T < T_JUMP; shH.position.set(s.x, DECK + 0.006, s.z);
  shN.position.set(NIK.x, DECK + 0.006, NIK.z); shN.scale.setScalar(1 - hop * 2);
  shB.position.set(BM.x, DECK + 0.006, BM.z);

  // ---- Wasseroberfläche ----
  const arr = wpos.array;
  const wakeOn = s.swim ? 1 : 0;
  const jt = T - (T_JUMP + 0.62);
  for (let i = 0; i < arr.length; i += 3) {
    const x = wBase[i] - 1.25, z = wBase[i + 2] - 12.5;
    let h = 0.018 * Math.sin(x * 2.2 + T * 1.6) + 0.014 * Math.sin(z * 1.4 - T * 1.25) + 0.008 * Math.sin((x + z) * 4 + T * 3);
    const dx = x - s.x, dz = z - s.z, d = Math.sqrt(dx * dx + dz * dz);
    if (wakeOn && d < 3.5) h += 0.055 * Math.exp(-d * 1.1) * Math.sin(d * 9 - T * 12);
    if (jt > 0 && jt < 3) { const r = jt * 2.2; const ex = x - LANE, ez = z + 24.4; const dd = Math.sqrt(ex * ex + ez * ez); h += 0.09 * Math.exp(-Math.abs(dd - r) * 3.5) * Math.exp(-jt * 1.2); }
    arr[i + 1] = h;
  }
  wpos.needsUpdate = true;
  waterGeo.computeVertexNormals();

  // Leine schaukelt mit
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < 100; i++) {
    const z = -0.2 - i * 0.248;
    m4.makeScale(1, 0.85, 1.5);
    m4.setPosition(-1.25, 0.03 + 0.015 * Math.sin(z * 1.4 - T * 1.25 + 1), z);
    ropeFloats.setMatrixAt(i, m4);
  }
  ropeFloats.instanceMatrix.needsUpdate = true;

  // ---- Spritzer ----
  drops.forEach((d, j) => {
    const u = d.userData;
    d.visible = false;
    // große Spritzer (Sprung, Anschlag, Wende)
    for (const [bt, str] of BURSTS) {
      const age = T - bt;
      if (age >= 0 && age < 1.0 && u.ph < str) {
        const bs = hState(bt);
        const v = u.sp * 1.4;
        d.position.set(bs.x + Math.cos(u.ang) * v * age, Math.max(-0.05, u.up * 1.3 * age - 4.9 * age * age), bs.z + Math.sin(u.ang) * v * age);
        d.visible = d.position.y > -0.04;
        return;
      }
    }
    // laufende Spritzer beim Kraulen (an Händen und Füßen)
    const P = 0.55;
    const age = (T + u.ph * P) % P;
    const tb = T - age;
    const bs = hState(tb);
    if (!bs.swim || bs.crawl < 0.6) return;
    const dir = Math.abs(Math.cos(bs.head) - 1) < 1e-6 ? 1 : -1;
    if (j % 2) return;
    const atFeet = j % 4 === 0;
    const ox = u.side * 0.6, oz = (atFeet ? -0.75 : 0.55) * dir;
    d.position.set(bs.x + ox + u.side * age * 0.8, (u.up * 0.55) * age - 4.9 * age * age + 0.04, bs.z + oz - dir * 0.5 * age);
    d.visible = d.position.y > -0.02;
  });

  // ---- Medaille ----
  const mIn = seg(T, 86.6, 87.4);
  medal.visible = mIn > 0;
  medal.scale.setScalar(Math.max(0.001, eBack(mIn)) * 0.6);
  medal.rotation.set(0, T * 1.6, Math.sin(T * 2) * 0.06);

  // ---- HTML-Ebenen ----
  for (const L of LAYERS) {
    const active = T >= L.t0 && T < L.t1;
    L.el.style.display = active ? 'block' : 'none';
    if (!active) continue;
    const local = T - L.t0;
    L.el.style.opacity = clamp01((L.t1 - T) / 0.4);
    if (L.upd) L.upd(T);
    for (const r of L.reveals) {
      const p = r.k === 'pop' ? eBack(seg(local, r.a, r.a + 0.5)) : eOut(seg(local, r.a, r.a + 0.55));
      r.n.style.opacity = clamp01(seg(local, r.a, r.a + 0.35));
      r.n.style.transform = r.k === 'pop' ? `scale(${0.6 + 0.4 * p})` : `translateY(${(1 - p) * 34}px)`;
    }
  }

  // ---- Rufblase über Niklas (nur wenn er gut im Bild ist) ----
  scene.updateMatrixWorld(true);
  const headPos = niklas.head.getWorldPosition(new THREE.Vector3()).add(V(0, 0.35, 0));
  const [px, py, pz] = toPx(headPos);
  const inView = pz < 1 && px > 160 && px < 920 && py > 380 && py < 1650;
  if (c && who === 'niklas' && inView) {
    const u = seg(T, c[0], c[0] + 0.25);
    ruf.textContent = c[3].replace(/[.!]+$/, '') + '!';
    ruf.style.left = Math.min(720, Math.max(360, px)) + 'px'; ruf.style.top = py + 'px';
    ruf.style.opacity = Math.min(u, 1 - seg(T, c[1] - 0.15, c[1]));
    ruf.style.transform = `translate(-50%,-100%) scale(${0.7 + 0.3 * eBack(u) + 0.03 * Math.sin(T * 30)}) rotate(${Math.sin(T * 9) * 3}deg)`;
  } else ruf.style.opacity = 0;

  // ---- Untertitel ----
  const key = c ? CAPTIONS.indexOf(c) : -1;
  if (key !== capKey) {
    capKey = key;
    capEl.innerHTML = c
      ? `<div class="capbox${c[2] === 'niklas' ? ' laut' : ''}"><span class="who" style="background:${WHO[c[2]].color}">${WHO[c[2]].name}</span><div class="txt">${c[3]}</div></div>`
      : '';
  }
  if (c) {
    capEl.style.opacity = Math.min(seg(T, c[0], c[0] + 0.2), 1 - seg(T, c[1] - 0.15, c[1]));
    const shake = c[2] === 'niklas' ? Math.sin(T * 40) * 3 : 0;
    capEl.style.transform = `translate(${shake}px, ${(1 - eOut(seg(T, c[0], c[0] + 0.25))) * 24}px)`;
  }

  renderer.render(scene, camera);
}
window.renderAt = renderAt;
window.DURATION = DURATION;
window.READY = true;

if (params.has('t')) renderAt(+params.get('t'));
else if (!params.has('render')) {
  const t0 = performance.now();
  const loop = () => { renderAt(((performance.now() - t0) / 1000) % DURATION); requestAnimationFrame(loop); };
  loop();
} else renderAt(0);
