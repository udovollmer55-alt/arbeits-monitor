// ============================================================
// Figuren für das Erklärvideo: Robobert, Sepp und Papa Udo.
// Alles aus einfachen 3D-Formen (Three.js) – keine fremden Bilder,
// keine Fotos. Jede Figur liefert { group, update(t, p) }:
//   t = Zeit in Sekunden, p = Pose-Werte (sprechen, winken, ...).
// ============================================================
import * as THREE from './lib/three.module.js';

// ---------- Hilfsfunktionen ----------

/** Abgerundeter Quader (Comic-Look), Mitte im Ursprung. */
export function rbox(w, h, d, r, mat) {
  const bevel = Math.min(r * 0.45, d * 0.3);
  const rr = Math.max(0.001, Math.min(r, w / 2 - 0.001, h / 2 - 0.001));
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + rr, y);
  s.lineTo(x + w - rr, y);
  s.quadraticCurveTo(x + w, y, x + w, y + rr);
  s.lineTo(x + w, y + h - rr);
  s.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  s.lineTo(x + rr, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - rr);
  s.lineTo(x, y + rr);
  s.quadraticCurveTo(x, y, x + rr, y);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: Math.max(0.01, d - 2 * bevel),
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 4,
    curveSegments: 10,
  });
  geo.center();
  return new THREE.Mesh(geo, mat);
}

const M = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...o });

function sphere(r, mat, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat);
  m.scale.set(sx, sy, sz);
  return m;
}

function cyl(rt, rb, h, mat, seg = 20) {
  return new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat);
}

/** Kleines Textfeld als Textur (z. B. Anzeige am Roboter). */
function textTexture(text, w, h, bg, fg, font) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.fillStyle = fg; g.font = font;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 3);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** Objekt an eine Stelle setzen und zurückgeben (zum Verketten). */
function at(obj, x, y, z) { obj.position.set(x, y, z); return obj; }

// ============================================================
// ROBOBERT – rostiger Roboter, hält sich für die klügste KI
// ============================================================
export function makeRobobert() {
  const group = new THREE.Group();
  const rust = M(0xb9642a, { roughness: 0.5, metalness: 0.45 });
  const rustDark = M(0x7c3d17, { roughness: 0.8, metalness: 0.2 });
  const steel = M(0x59606b, { roughness: 0.4, metalness: 0.7 });
  const white = M(0xffffff, { roughness: 0.25 });
  const dark = M(0x151a24, { roughness: 0.4 });
  const glow = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffc400, emissiveIntensity: 1.2 });

  // Füße / Raupen
  const feet = new THREE.Group();
  for (const sx of [-0.45, 0.45]) {
    const tread = rbox(0.62, 0.34, 0.8, 0.12, steel);
    tread.position.set(sx, 0.17, 0);
    feet.add(tread);
  }
  group.add(feet);

  // Rumpf
  const body = new THREE.Group();
  body.position.y = 0.34;
  const torso = rbox(1.5, 1.2, 0.95, 0.2, rust);
  torso.position.y = 0.72;
  body.add(torso);
  // Brustanzeige „IQ ∞“
  const screenTex = textTexture('IQ ∞', 256, 128, '#0a1a3a', '#6fc3ff', 'bold 78px Inter, sans-serif');
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.85, 0.42),
    new THREE.MeshBasicMaterial({ map: screenTex })
  );
  screen.position.set(0, 0.86, 0.5);
  body.add(screen);
  const frame = rbox(0.97, 0.54, 0.06, 0.06, steel);
  frame.position.set(0, 0.86, 0.47);
  body.add(frame);
  // Rostflecken + Nieten
  [[-0.55, 0.45, 0.49, 0.2], [0.52, 0.5, 0.49, 0.14], [0.3, 1.18, 0.49, 0.12], [-0.4, 1.12, 0.49, 0.09]]
    .forEach(([x, y, z, r]) => {
      const s = sphere(r, rustDark, 1, 0.8, 0.12);
      s.position.set(x, y, z);
      body.add(s);
    });
  [[-0.62, 1.2], [0.62, 1.2], [-0.62, 0.3], [0.62, 0.3]].forEach(([x, y]) => {
    const n = sphere(0.05, steel);
    n.position.set(x, y, 0.5);
    body.add(n);
  });
  group.add(body);

  // Kopf (wackelt, neigt sich)
  const head = new THREE.Group();
  head.position.set(0, 2.1, 0);
  const skull = rbox(1.3, 0.95, 0.95, 0.24, rust);
  head.add(skull);
  const eyes = [];
  for (const sx of [-0.3, 0.3]) {
    const eye = new THREE.Group();
    eye.position.set(sx, 0.08, 0.46);
    eye.add(sphere(0.2, white));
    const pupil = sphere(0.09, dark);
    pupil.position.z = 0.15;
    eye.add(pupil);
    head.add(eye);
    eyes.push({ eye, pupil });
  }
  // Mund (Gitter)
  for (let i = 0; i < 5; i++) {
    const bar = rbox(0.07, 0.2, 0.05, 0.02, dark);
    bar.position.set(-0.24 + i * 0.12, -0.27, 0.48);
    head.add(bar);
  }
  // Ohr-Schrauben
  for (const sx of [-0.7, 0.7]) {
    const ear = cyl(0.14, 0.14, 0.14, steel);
    ear.rotation.z = Math.PI / 2;
    ear.position.set(sx, 0, 0);
    head.add(ear);
  }
  // Antenne
  const ant = cyl(0.03, 0.03, 0.4, steel, 10);
  ant.position.set(0.15, 0.65, 0);
  head.add(ant);
  const bulb = sphere(0.1, glow);
  bulb.position.set(0.15, 0.9, 0);
  head.add(bulb);
  // Rostfleck am Kopf
  const patch = sphere(0.14, rustDark, 1, 0.8, 0.1);
  patch.position.set(-0.45, 0.28, 0.48);
  head.add(patch);
  group.add(head);

  // Arme (Pivot an der Schulter)
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.92, 1.62, 0);
    const upper = cyl(0.12, 0.12, 0.7, steel);
    upper.position.y = -0.35;
    pivot.add(upper);
    const hand = sphere(0.17, rust);
    hand.position.y = -0.76;
    pivot.add(hand);
    const shoulder = sphere(0.17, steel);
    pivot.add(shoulder);
    group.add(pivot);
    arms.push(pivot);
  }

  /** p: { talk 0..1, boast 0..1 (Arme hoch), crash 0..1, look: Vector3 } */
  function update(t, p = {}) {
    const talk = p.talk || 0, boast = p.boast || 0, crash = p.crash || 0;
    group.position.y = Math.sin(t * 2.1) * 0.03 + talk * Math.abs(Math.sin(t * 9)) * 0.06;
    head.rotation.z = Math.sin(t * 1.7) * 0.04 + talk * Math.sin(t * 6) * 0.07 + crash * Math.sin(t * 40) * 0.12;
    head.rotation.y = Math.sin(t * 1.1) * 0.08;
    bulb.material.emissiveIntensity = 0.9 + 0.5 * Math.sin(t * 5);
    // Arme: ruhig hängend oder angeberisch gehoben
    arms[0].rotation.z = -0.15 - boast * (1.9 + Math.sin(t * 7) * 0.2);
    arms[1].rotation.z = 0.15 + boast * (1.9 + Math.sin(t * 7 + 1) * 0.2);
    arms[0].rotation.x = arms[1].rotation.x = 0;
    // Blick
    const lx = p.lookX || 0;
    eyes.forEach((e) => { e.pupil.position.x = lx * 0.08; e.pupil.position.z = 0.15; });
    // Absturz: Wackeln des ganzen Körpers
    group.rotation.z = crash * Math.sin(t * 55) * 0.05;
    body.rotation.z = crash * Math.sin(t * 47) * 0.04;
  }
  return { group, update, head, anchor: new THREE.Vector3(0, 3.0, 0) };
}

// ============================================================
// SEPP – zerbeulter Toaster, bayerisch, prüft alles nach
// ============================================================
export function makeSepp() {
  const group = new THREE.Group();
  const silver = M(0xb3bcc8, { roughness: 0.32, metalness: 0.65 });
  const dent = M(0x8c95a3, { roughness: 0.55, metalness: 0.55 });
  const dark = M(0x151a24, { roughness: 0.5 });
  const white = M(0xffffff, { roughness: 0.25 });
  const toastMat = M(0xe2b070, { roughness: 0.9 });
  const crustMat = M(0xa8702f, { roughness: 0.9 });
  const felt = M(0x6b5a47, { roughness: 0.95 });
  const band = M(0x2c3e6e, { roughness: 0.8 });
  const feather = M(0xffc800, { roughness: 0.6 });
  const stache = M(0x4a4038, { roughness: 0.95 });

  // Füße
  for (const sx of [-0.7, 0.7]) {
    const f = sphere(0.14, dark, 1, 0.7, 1);
    f.position.set(sx, 0.08, 0.2);
    group.add(f);
  }
  // Gehäuse
  const body = rbox(1.9, 1.15, 1.05, 0.3, silver);
  body.position.y = 0.72;
  group.add(body);
  // Beulen
  [[-0.55, 0.55, 0.52, 0.22], [0.62, 0.9, 0.52, 0.16], [0.2, 0.42, 0.53, 0.1]].forEach(([x, y, z, r]) => {
    const d = sphere(r, dent, 1, 0.85, 0.12);
    d.position.set(x, y, z);
    group.add(d);
  });
  // Schlitz oben
  const slot = rbox(1.15, 0.05, 0.3, 0.02, dark);
  slot.position.set(0.28, 1.29, 0.12);
  group.add(slot);
  // Toast (fährt hoch bei „PLING!“)
  const toasts = [];
  for (const sx of [0.0, 0.56]) {
    const tg = new THREE.Group();
    const slice = rbox(0.46, 0.5, 0.12, 0.17, toastMat);
    tg.add(slice);
    const crust = rbox(0.5, 0.54, 0.09, 0.19, crustMat);
    crust.position.z = -0.02;
    tg.add(crust);
    tg.position.set(sx, 1.2, 0.12);
    group.add(tg);
    toasts.push(tg);
  }
  // Gesicht
  const eyes = [];
  for (const sx of [-0.32, 0.16]) {
    const eye = new THREE.Group();
    eye.position.set(sx, 0.9, 0.52);
    eye.add(sphere(0.15, white, 1, 1.1, 0.7));
    const pupil = sphere(0.065, dark);
    pupil.position.z = 0.09;
    eye.add(pupil);
    group.add(eye);
    eyes.push(pupil);
  }
  // Schnauzer (zwei gebogene Hälften)
  for (const s of [-1, 1]) {
    const st = sphere(0.17, stache, 1.5, 0.6, 0.7);
    st.position.set(-0.08 + s * 0.2, 0.64, 0.56);
    st.rotation.z = s * -0.25;
    group.add(st);
  }
  const mouth = sphere(0.08, dark, 1.4, 0.7, 0.5);
  mouth.position.set(-0.08, 0.48, 0.52);
  group.add(mouth);
  // Hebel an der Seite
  const lever = cyl(0.05, 0.05, 0.35, dark);
  lever.rotation.z = Math.PI / 2;
  lever.position.set(1.05, 0.6, 0.1);
  group.add(lever);
  const knob = sphere(0.1, M(0xffc800));
  knob.position.set(1.25, 0.6, 0.1);
  group.add(knob);
  // Hütchen (Gamsbart)
  const hat = new THREE.Group();
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.06, 28), felt);
  hat.add(brim);
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.32, 0.38, 24), felt);
  crown.position.y = 0.2;
  hat.add(crown);
  const hb = cyl(0.33, 0.33, 0.07, band, 24);
  hb.position.y = 0.07;
  hat.add(hb);
  const fe = sphere(0.07, feather, 0.7, 2.6, 0.7);
  fe.position.set(0.28, 0.4, 0);
  fe.rotation.z = -0.5;
  hat.add(fe);
  hat.position.set(-0.62, 1.4, -0.12);
  hat.rotation.z = 0.2;
  group.add(hat);

  /** p: { toast 0..1 (Toast springt hoch), talk 0..1 } */
  function update(t, p = {}) {
    const talk = p.talk || 0;
    const toast = clamp01(p.toast || 0);
    group.position.y = Math.sin(t * 2.4 + 1) * 0.025 + talk * Math.abs(Math.sin(t * 8)) * 0.05;
    body.scale.y = 1 + talk * Math.sin(t * 10) * 0.012;
    toasts.forEach((tg, i) => {
      tg.position.y = 1.2 + toast * 0.55 + (toast > 0.1 ? Math.sin(t * 8 + i) * 0.01 : 0);
      tg.rotation.z = (i ? 1 : -1) * toast * 0.05;
    });
    const lx = p.lookX || 0;
    eyes.forEach((e) => { e.position.x = lx * 0.05; });
    hat.rotation.z = 0.2 + Math.sin(t * 2) * 0.02 + toast * 0.08;
  }
  return { group, update, anchor: new THREE.Vector3(0.3, 2.2, 0) };
}

// ============================================================
// PAPA UDO – freundliche 3D-Comicfigur (kein Foto, nur gezeichnet)
// ============================================================
export function makeUdo() {
  const group = new THREE.Group();
  const skin = M(0xf0c6a0, { roughness: 0.7 });
  const hairMat = M(0xe9ecf1, { roughness: 0.9 });
  const cardigan = M(0x2f5fa8, { roughness: 0.85 });
  const shirt = M(0xf4f1ea, { roughness: 0.9 });
  const pants = M(0x2a3345, { roughness: 0.85 });
  const shoe = M(0x3a2a22, { roughness: 0.6 });
  const dark = M(0x1a1d26, { roughness: 0.4 });
  const gold = M(0xffc800, { roughness: 0.4, metalness: 0.5 });
  const frameMat = M(0x23262e, { roughness: 0.4, metalness: 0.3 });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.25, roughness: 0.1 });

  // Beine + Schuhe
  for (const sx of [-0.28, 0.28]) {
    const leg = cyl(0.17, 0.17, 0.85, pants);
    leg.position.set(sx, 0.62, 0);
    group.add(leg);
    const sh = rbox(0.4, 0.2, 0.62, 0.09, shoe);
    sh.position.set(sx, 0.12, 0.1);
    group.add(sh);
  }
  // Rumpf: Strickjacke mit Hemd
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.55, 8, 20), cardigan);
  torso.scale.set(1, 1, 0.8);
  torso.position.y = 1.55;
  group.add(torso);
  const front = rbox(0.34, 0.95, 0.08, 0.05, shirt);
  front.position.set(0, 1.55, 0.4);
  group.add(front);
  for (let i = 0; i < 3; i++) {
    const b = sphere(0.04, gold);
    b.position.set(0.0, 1.85 - i * 0.28, 0.45);
    group.add(b);
  }

  // Kopf
  const head = new THREE.Group();
  head.position.y = 2.55;
  head.add(sphere(0.52, skin, 1, 1.05, 1));
  // Haare: Kranz an den Seiten + Hinterkopf (Halbkugel hinten)
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.58),
    hairMat
  );
  hair.scale.set(1, 1.06, 1);
  hair.position.set(0, 0.03, -0.08);
  hair.rotation.x = -0.35;
  head.add(hair);
  for (const sx of [-0.52, 0.52]) {
    head.add(at(sphere(0.12, skin), sx, -0.02, 0));
    head.add(at(sphere(0.2, hairMat, 0.7, 1.1, 0.9), sx * 0.9, 0.16, -0.12));
  }
  // Augen, Brille, Augenbrauen
  const pupils = [];
  for (const sx of [-0.2, 0.2]) {
    const eyeWhite = sphere(0.09, M(0xffffff, { roughness: 0.3 }), 1, 1.1, 0.5);
    eyeWhite.position.set(sx, 0.08, 0.46);
    head.add(eyeWhite);
    const pupil = sphere(0.045, dark);
    pupil.position.set(sx, 0.08, 0.5);
    head.add(pupil);
    pupils.push(pupil);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.018, 10, 28), frameMat);
    rim.position.set(sx, 0.08, 0.5);
    head.add(rim);
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.145, 24), glassMat);
    lens.position.set(sx, 0.08, 0.5);
    head.add(lens);
    const brow = rbox(0.2, 0.04, 0.05, 0.02, hairMat);
    brow.position.set(sx, 0.28, 0.46);
    brow.rotation.z = sx > 0 ? -0.1 : 0.1;
    head.add(brow);
  }
  const bridge = cyl(0.012, 0.012, 0.12, frameMat, 8);
  bridge.rotation.z = Math.PI / 2;
  bridge.position.set(0, 0.1, 0.5);
  head.add(bridge);
  // Nase + Lächeln
  head.add(at(sphere(0.07, skin, 1, 1.1, 1), 0, -0.04, 0.52));
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 10, 24, Math.PI), M(0x7a2f2f));
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.2, 0.48);
  head.add(smile);
  // Schnurrbart
  for (const s of [-1, 1]) {
    const st = sphere(0.1, hairMat, 1.5, 0.55, 0.8);
    st.position.set(s * 0.09, -0.12, 0.52);
    st.rotation.z = s * -0.2;
    head.add(st);
  }
  group.add(head);

  // Arme mit Händen (+ Daumen)
  const arms = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.62, 1.95, 0);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.55, 6, 14), cardigan);
    arm.position.y = -0.38;
    pivot.add(arm);
    const hand = sphere(0.15, skin);
    hand.position.y = -0.8;
    pivot.add(hand);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.1, 4, 8), skin);
    thumb.position.set(0, -0.67, 0.1);
    pivot.add(thumb);
    group.add(pivot);
    arms.push({ pivot, thumb });
  }

  /** p: { talk, wave 0..1, thumb 0..1 (Daumen hoch), lookX } */
  function update(t, p = {}) {
    const talk = p.talk || 0, wave = p.wave || 0, thumb = p.thumb || 0;
    group.position.y = Math.sin(t * 2 + 2) * 0.025 + talk * Math.abs(Math.sin(t * 7)) * 0.04;
    head.rotation.z = Math.sin(t * 1.4) * 0.03 + talk * Math.sin(t * 5) * 0.04;
    head.rotation.y = Math.sin(t * 0.9) * 0.1;
    // rechter Arm (im Bild links): winkt oder Daumen hoch
    const r = arms[0];
    r.pivot.rotation.z = -0.12 - wave * (2.5 + Math.sin(t * 9) * 0.28) - thumb * 1.2;
    r.pivot.rotation.x = -thumb * 1.1;
    r.thumb.position.set(0, -0.67 - thumb * 0.1, 0.1);
    // linker Arm: erklärende Geste beim Sprechen
    const l = arms[1];
    l.pivot.rotation.z = 0.12 + talk * (0.5 + Math.sin(t * 4) * 0.18);
    l.pivot.rotation.x = -talk * 0.4;
    const lx = p.lookX || 0;
    pupils.forEach((e, i) => { e.position.x = (i ? 0.2 : -0.2) + lx * 0.04; });
  }
  return { group, update, anchor: new THREE.Vector3(0, 3.3, 0) };
}
