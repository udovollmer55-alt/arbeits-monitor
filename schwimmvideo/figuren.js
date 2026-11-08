// ============================================================
// Kinderfiguren für das Schwimmvideo: Hendrik (7) und Niklas (3).
// Gezeichnete 3D-Comicfiguren aus einfachen Formen – keine Fotos.
//
// Ursprung der Figur = Becken (Hüfte). Dadurch lässt sich die Figur
// zum Schwimmen einfach um die Hüfte "hinlegen" (rotation.x = PI/2).
// Die Figur schaut ohne Drehung in Richtung +z.
// ============================================================
import * as THREE from './lib/three.module.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...o });
function sphere(r, mat, sx = 1, sy = 1, sz = 1) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), mat);
  m.scale.set(sx, sy, sz);
  return m;
}
function capsule(r, len, mat) {
  return new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 8, 16), mat);
}

/**
 * Baut ein Kind.
 * o = { legL, legR, torsoR, torsoL, headR, armL, armR,
 *       skin, hair, hairStyle ('blond'|'dunkel'), shorts, shirt (Farbe oder null), goggles (bool) }
 */
export function makeKid(o) {
  const group = new THREE.Group();
  const skin = M(o.skin, { roughness: 0.7 });
  const hairMat = M(o.hair, { roughness: 0.85 });
  const shortsMat = M(o.shorts, { roughness: 0.7 });
  const shirtMat = o.shirt ? M(o.shirt, { roughness: 0.8 }) : null;
  const white = M(0xffffff, { roughness: 0.3 });
  const dark = M(0x1a1d26, { roughness: 0.4 });

  // ---------- Beine (Drehpunkt an der Hüfte) ----------
  const legs = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * o.torsoR * 0.5, -0.02, 0);
    const leg = capsule(o.legR, o.legL - o.legR * 2, skin);
    leg.position.y = -o.legL / 2;
    pivot.add(leg);
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(o.legR * 1.35, o.legR * 1.35, o.legL * 0.32, 16), shortsMat);
    thigh.position.y = -o.legL * 0.14;
    pivot.add(thigh);
    const foot = sphere(o.legR * 1.1, skin, 1, 0.6, 1.7);
    foot.position.set(0, -o.legL + 0.01, o.legR * 0.7);
    pivot.add(foot);
    group.add(pivot);
    legs.push(pivot);
  }
  // Badehose
  const pants = new THREE.Mesh(new THREE.CylinderGeometry(o.torsoR * 1.04, o.torsoR * 1.0, 0.16, 20), shortsMat);
  pants.position.y = 0.02;
  group.add(pants);

  // ---------- Rumpf ----------
  const torso = capsule(o.torsoR, o.torsoL, shirtMat || skin);
  const torsoH = o.torsoL + 2 * o.torsoR;
  torso.position.y = torsoH / 2 - 0.02;
  torso.scale.set(1, 1, 0.85);
  group.add(torso);
  if (!shirtMat) { // Bauchnabel als kleines Detail
    const navel = sphere(0.012, M(0xb07a5a));
    navel.position.set(0, torsoH * 0.32, o.torsoR * 0.84);
    group.add(navel);
  }

  // ---------- Kopf ----------
  const head = new THREE.Group();
  const headY = torsoH + o.headR * 0.62;
  head.position.y = headY;
  head.add(sphere(o.headR, skin, 1, 0.98, 0.95));
  const R = o.headR;
  // Ohren
  for (const s of [-1, 1]) {
    const ear = sphere(R * 0.2, skin, 0.6, 1, 0.8);
    ear.position.set(s * R * 0.97, -R * 0.02, 0);
    head.add(ear);
  }
  // Haare
  const cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 26, 18, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
  cap.position.set(0, R * 0.05, -R * 0.05);
  cap.rotation.x = -0.32;
  head.add(cap);
  if (o.hairStyle === 'blond') {
    // Strubbel-Pony: kleine Spitzen nach vorne
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Mesh(new THREE.ConeGeometry(R * 0.2, R * 0.5, 10), hairMat);
      sp.position.set((i - 2) * R * 0.28, R * 0.72, R * 0.42);
      sp.rotation.set(1.1, 0, (i - 2) * -0.18);
      head.add(sp);
    }
    const top = new THREE.Mesh(new THREE.ConeGeometry(R * 0.16, R * 0.45, 10), hairMat);
    top.position.set(R * 0.1, R * 1.08, -R * 0.05);
    top.rotation.z = -0.4;
    head.add(top);
  } else if (o.hairStyle === 'dunkel') {
    // dunkle Locken
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const c = sphere(R * 0.26, hairMat);
      c.position.set(Math.cos(a) * R * 0.62, R * 0.72 + Math.sin(i * 1.7) * R * 0.08, Math.sin(a) * R * 0.55 - R * 0.05);
      head.add(c);
    }
    for (let i = 0; i < 3; i++) {
      const c = sphere(R * 0.22, hairMat);
      c.position.set((i - 1) * R * 0.32, R * 0.62, R * 0.72);
      head.add(c);
    }
  }
  // Augen
  const pupils = [];
  const brows = [];
  for (const s of [-1, 1]) {
    const ew = sphere(R * 0.2, white, 1, 1.15, 0.6);
    ew.position.set(s * R * 0.36, R * 0.1, R * 0.86);
    head.add(ew);
    const p = sphere(R * 0.1, dark);
    p.position.set(s * R * 0.36, R * 0.1, R * 0.97);
    head.add(p);
    pupils.push(p);
    const hl = sphere(R * 0.035, white);
    hl.position.set(s * R * 0.36 + R * 0.04, R * 0.15, R * 1.02);
    head.add(hl);
    const b = new THREE.Mesh(new THREE.CapsuleGeometry(R * 0.04, R * 0.22, 4, 8), hairMat);
    b.rotation.z = Math.PI / 2 + s * 0.15;
    b.position.set(s * R * 0.36, R * 0.38, R * 0.86);
    head.add(b);
    brows.push(b);
  }
  // Nase, Wangen, Mund
  const nose = sphere(R * 0.09, skin);
  nose.position.set(0, -R * 0.05, R * 0.98);
  head.add(nose);
  for (const s of [-1, 1]) {
    const ch = sphere(R * 0.13, M(0xf3a0a0, { roughness: 0.9, transparent: true, opacity: 0.55 }), 1, 0.7, 0.3);
    ch.position.set(s * R * 0.58, -R * 0.18, R * 0.8);
    head.add(ch);
  }
  const mouth = sphere(R * 0.2, M(0x6b2430, { roughness: 0.6 }), 1.25, 1, 0.45);
  mouth.position.set(0, -R * 0.4, R * 0.84);
  head.add(mouth);
  const tongue = sphere(R * 0.11, M(0xe2777f), 1.2, 0.6, 0.5);
  tongue.position.set(0, -R * 0.5, R * 0.88);
  head.add(tongue);

  // Schwimmbrille (Hendrik): auf der Stirn oder über den Augen
  let goggles = null;
  if (o.goggles) {
    goggles = new THREE.Group();
    const frame = M(0x1b5fd6, { roughness: 0.3 });
    const lens = new THREE.MeshStandardMaterial({ color: 0x9fe3ff, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.6 });
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.22, R * 0.05, 10, 24), frame);
      ring.position.set(s * R * 0.36, 0, R * 1.0);
      goggles.add(ring);
      const l = new THREE.Mesh(new THREE.CircleGeometry(R * 0.21, 20), lens);
      l.position.set(s * R * 0.36, 0, R * 1.01);
      goggles.add(l);
    }
    const strap = new THREE.Mesh(new THREE.TorusGeometry(R * 1.0, R * 0.04, 8, 40), frame);
    strap.rotation.x = Math.PI / 2;
    goggles.add(strap);
    head.add(goggles);
  }
  group.add(head);

  // ---------- Arme (Drehpunkt an der Schulter) ----------
  const arms = [];
  const shoulderY = torsoH - o.torsoR * 0.9;
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * (o.torsoR + o.armR * 0.7), shoulderY, 0);
    const arm = capsule(o.armR, o.armL - o.armR * 2, skin);
    arm.position.y = -o.armL / 2;
    pivot.add(arm);
    if (shirtMat) {
      const sleeve = capsule(o.armR * 1.3, o.armL * 0.2, shirtMat);
      sleeve.position.y = -o.armL * 0.15;
      pivot.add(sleeve);
    }
    const hand = sphere(o.armR * 1.35, skin);
    hand.position.y = -o.armL;
    pivot.add(hand);
    group.add(pivot);
    arms.push({ pivot, side: s });
  }

  const standY = o.legL + o.legR * 0.3; // Höhe der Hüfte über dem Boden

  /**
   * p = { crawl 0..1, phase (Armwinkel), kick 0..1, cheer 0..1, shout 0..1, gog 0..1 (Brille runter),
   *       wave 0..1 (ein Arm hoch), fwd 0..1 (ein Arm nach vorn, z. B. Stoppuhr zeigen), lookX, lookY, talk 0..1 }
   */
  function update(t, p = {}) {
    const crawl = p.crawl || 0, cheer = p.cheer || 0, shout = p.shout || 0, talk = p.talk || 0;
    // Arme
    arms.forEach(({ pivot, side }, i) => {
      const ph = (p.phase || 0) + (i ? Math.PI : 0);
      const raise = cheer * (2.55 + Math.sin(t * 9 + i * 1.3) * 0.35);
      const wave = i === 1 ? (p.wave || 0) * (2.7 + Math.sin(t * 10) * 0.3) : 0;
      pivot.rotation.x = crawl * ph - (i === 1 ? (p.fwd || 0) * 1.35 : 0);
      pivot.rotation.z = side * (0.14 * (1 - crawl) + raise * (1 - crawl) + wave * (1 - crawl) + crawl * 0.12);
    });
    // Beine: Kraulbeinschlag
    legs.forEach((pv, i) => {
      pv.rotation.x = (p.kick || 0) * Math.sin(t * 22 + i * Math.PI) * 0.32;
      pv.rotation.z = (i ? 1 : -1) * 0.04;
    });
    // Mund: geschlossen-lächelnd, beim Reden/Rufen offen
    const open = Math.max(shout * (0.65 + 0.35 * Math.abs(Math.sin(t * 13))), talk * (0.25 + 0.3 * Math.abs(Math.sin(t * 11))), 0.12);
    mouth.scale.set(1.25 + shout * 0.25, open * 1.25, 0.45);
    tongue.visible = open > 0.3;
    brows.forEach((b, i) => { b.position.y = R * (0.38 + shout * 0.08); });
    head.rotation.y = (p.lookX || 0) * 0.5;
    head.rotation.x = -(p.lookY || 0) * 0.5 - shout * 0.15;
    pupils.forEach((pp, i) => { pp.position.x = (i ? 1 : -1) * R * 0.36 + (p.lookX || 0) * R * 0.04; });
    if (goggles) {
      const g = p.gog || 0;
      goggles.position.set(0, R * (0.58 - 0.48 * g), R * (-0.1 + 0.03 * g));
      goggles.rotation.x = -0.35 * (1 - g);
    }
  }
  return { group, update, head, standY, headY, arms, torsoH };
}

/** Hendrik, 7 Jahre: blonde Haare, blaue Badehose, Schwimmbrille */
export function makeHendrik() {
  return makeKid({
    legL: 0.44, legR: 0.075, torsoR: 0.15, torsoL: 0.26, headR: 0.22, armL: 0.42, armR: 0.055,
    skin: 0xf6d2b2, hair: 0xf0c75a, hairStyle: 'blond', shorts: 0x1d4fd0, shirt: null, goggles: true,
  });
}

/** Bademeister: Erwachsener in weißem Shirt und dunkelblauer Hose (Stoppuhr/Pfeife kommen in main.js dazu) */
export function makeBademeister() {
  return makeKid({
    legL: 0.86, legR: 0.095, torsoR: 0.24, torsoL: 0.4, headR: 0.21, armL: 0.66, armR: 0.075,
    skin: 0xe8b98f, hair: 0x5a3d2b, hairStyle: 'kurz', shorts: 0x1d2f5a, shirt: 0xf4f6fa, goggles: false,
  });
}

/** Niklas, 3 Jahre: dunkle Haare, großer Kopf, gelbe Badehose und Badeshirt */
export function makeNiklas() {
  return makeKid({
    legL: 0.28, legR: 0.07, torsoR: 0.14, torsoL: 0.16, headR: 0.23, armL: 0.29, armR: 0.055,
    skin: 0xf1c7a3, hair: 0x2b1d15, hairStyle: 'dunkel', shorts: 0xffc800, shirt: 0x4aa3ff, goggles: false,
  });
}
