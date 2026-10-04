/**
 * Pixel sprites for the fantasy worlds, drawn by code into an atlas once per faction.
 *
 * Every frame is painted at art resolution (one art pixel = one canvas pixel), its alpha
 * snapped to on/off, and given a one-pixel dark outline, so it reads as pixel art at any
 * size. Drawing scales the art up with smoothing off: `P` CSS pixels per art pixel.
 * Each frame is stored facing right and mirrored.
 *
 * Kinds and frames:
 *   inf     spear and shield    walk0 walk1 attack dead
 *   arch    bow and quiver      walk0 walk1 draw dead
 *   cav     rider and mount     run0 run1 run2 attack dead
 *   mage    staff and robe      idle cast dead
 *   lord    caped rider, crown  run0 run1 idle dead
 *   treb    trebuchet           idle throw
 *   dragon  (own colors)        fly0 fly1 fly2 fly3
 *   crow                        up down
 *   peasant                     walk0 walk1
 */

export type Helm = 'kettle' | 'great' | 'horned' | 'hood' | 'skull';
export type Rider = 'horse' | 'wolf' | 'elk' | 'bone';

/** How a faction's people look. */
export type Kit = {
  cloth: string;
  cloth2: string;
  metal: string;
  metalDark: string;
  leather: string;
  wood: string;
  skin: string[];
  mount: string;
  mountDark: string;
  magic: string;
  helm: Helm;
  shield: 'kite' | 'round' | 'none';
  rider: Rider;
  undead: boolean;
};

type Pen = {
  p(x: number, y: number, w?: number, h?: number, c?: string): void;
  g: CanvasRenderingContext2D;
};

export type Kind = 'inf' | 'arch' | 'cav' | 'mage' | 'lord' | 'treb' | 'dragon' | 'crow' | 'peasant';

/** Cell size (art pixels), frame count, and the anchor (feet) within the cell. */
export const SHAPES: Record<Kind, { w: number; h: number; frames: number; ax: number; ay: number }> = {
  inf: { w: 16, h: 16, frames: 4, ax: 6, ay: 15 },
  arch: { w: 16, h: 16, frames: 4, ax: 6, ay: 15 },
  cav: { w: 24, h: 19, frames: 5, ax: 11, ay: 18 },
  mage: { w: 15, h: 19, frames: 3, ax: 6, ay: 18 },
  lord: { w: 24, h: 21, frames: 4, ax: 11, ay: 20 },
  treb: { w: 26, h: 26, frames: 2, ax: 12, ay: 25 },
  dragon: { w: 56, h: 36, frames: 4, ax: 28, ay: 22 },
  crow: { w: 7, h: 5, frames: 2, ax: 3, ay: 4 },
  peasant: { w: 12, h: 15, frames: 2, ax: 5, ay: 14 },
};

const OUTLINE = [12, 10, 16];

// ---- the people -----------------------------------------------------------------------

function head(d: Pen, k: Kit, x: number, y: number, skin: string) {
  const { p } = d;
  const face = k.undead ? '#d6d3c4' : skin;
  // Face and eye.
  p(x + 1, y + 3, 3, 2, face);
  p(x + 3, y + 3, 1, 1, '#1a1410');
  switch (k.helm) {
    case 'kettle':
      p(x + 1, y + 1, 3, 1, k.metal);
      p(x + 2, y, 2, 1, k.metal);
      p(x, y + 2, 5, 1, k.metalDark);
      break;
    case 'great':
      p(x + 1, y, 3, 5, k.metal);
      p(x + 2, y + 2, 2, 1, '#14110e');
      p(x + 1, y, 1, 5, k.metalDark);
      break;
    case 'horned':
      p(x + 1, y + 1, 3, 2, k.metal);
      p(x, y, 1, 1, '#e7e1cf');
      p(x - 1, y - 1, 1, 1, '#e7e1cf');
      p(x + 4, y, 1, 1, '#e7e1cf');
      p(x + 5, y - 1, 1, 1, '#e7e1cf');
      break;
    case 'hood':
      p(x + 1, y, 3, 3, k.cloth2);
      p(x, y + 1, 1, 4, k.cloth2);
      p(x + 2, y + 3, 2, 1, face);
      break;
    case 'skull':
      p(x + 1, y + 1, 3, 4, '#d6d3c4');
      p(x + 2, y + 2, 1, 1, '#0c0a08');
      p(x + 3, y + 2, 1, 1, '#0c0a08');
      p(x + 1, y, 3, 1, k.metalDark);
      break;
  }
}

function legs(d: Pen, k: Kit, x: number, y: number, frame: number) {
  const { p } = d;
  const c = k.undead ? '#bdb8a6' : k.leather;
  if (frame === 0) {
    p(x, y, 1, 4, c);
    p(x - 1, y + 3, 2, 1, k.leather);
    p(x + 3, y, 1, 4, c);
    p(x + 3, y + 3, 2, 1, k.leather);
  } else {
    p(x + 1, y, 1, 4, c);
    p(x + 2, y, 1, 4, c);
    p(x + 1, y + 3, 3, 1, k.leather);
  }
}

function infantry(d: Pen, k: Kit, frame: number, skin: string) {
  const { p } = d;
  if (frame === 3) return corpse(d, k, skin, 'spear');
  head(d, k, 4, 1, skin);
  // Shoulders, tabard, belt.
  p(4, 6, 4, 1, k.metal);
  p(4, 7, 4, 3, k.undead ? k.metalDark : k.cloth);
  p(4, 10, 4, 1, k.leather);
  p(3, 7, 1, 3, k.cloth2);
  legs(d, k, 4, 11, frame);
  if (frame === 2) {
    // Thrust: the spear level, the arm out.
    p(8, 8, 2, 1, k.undead ? '#d6d3c4' : skin);
    p(6, 8, 9, 1, k.wood);
    p(14, 7, 2, 3, k.metal);
    p(15, 8, 1, 1, '#f1f5f9');
  } else {
    p(10, 2, 1, 13, k.wood);
    p(10, 0, 1, 2, k.metal);
    p(9, 1, 3, 1, k.metal);
    p(9, 8, 1, 1, k.undead ? '#d6d3c4' : skin);
  }
  shield(d, k, 7, 6);
}

function shield(d: Pen, k: Kit, x: number, y: number) {
  const { p } = d;
  if (k.shield === 'kite') {
    // A darker face than the tabard behind it, a metal rim, the side's color as a stripe.
    p(x, y, 3, 5, k.cloth2);
    p(x + 1, y + 5, 1, 1, k.cloth2);
    p(x + 1, y + 1, 1, 3, k.cloth);
    p(x, y, 3, 1, k.metal);
    p(x + 2, y + 1, 1, 4, k.metalDark);
  } else if (k.shield === 'round') {
    p(x, y + 1, 3, 3, k.cloth2);
    p(x + 1, y, 1, 5, k.cloth2);
    p(x + 1, y + 2, 1, 1, k.metal);
  }
}

function archer(d: Pen, k: Kit, frame: number, skin: string) {
  const { p } = d;
  if (frame === 3) return corpse(d, k, skin, 'bow');
  head(d, { ...k, helm: k.helm === 'great' || k.helm === 'kettle' ? 'hood' : k.helm }, 4, 1, skin);
  // Quiver with fletching.
  p(3, 6, 1, 4, k.leather);
  p(3, 5, 1, 1, '#e5e7eb');
  p(2, 5, 1, 1, k.cloth);
  p(4, 6, 4, 4, k.cloth2);
  p(4, 10, 4, 1, k.leather);
  legs(d, k, 4, 11, frame);
  const hand = k.undead ? '#d6d3c4' : skin;
  if (frame === 2) {
    // Drawn: bow raised ahead, string at the cheek, an arrow nocked.
    p(11, 2, 1, 1, k.wood);
    p(12, 3, 1, 5, k.wood);
    p(11, 8, 1, 1, k.wood);
    p(8, 5, 4, 1, '#e5e7eb');
    p(12, 5, 2, 1, k.metal);
    p(8, 6, 1, 1, hand);
    p(11, 5, 1, 1, hand);
  } else {
    p(9, 5, 1, 1, k.wood);
    p(10, 6, 1, 4, k.wood);
    p(9, 10, 1, 1, k.wood);
    p(9, 6, 1, 4, '#cbd5e1');
    p(9, 8, 1, 1, hand);
  }
}

function corpse(d: Pen, k: Kit, skin: string, weapon: 'spear' | 'bow' | 'staff') {
  const { p } = d;
  p(2, 13, 2, 2, k.undead ? '#d6d3c4' : skin);
  p(1, 13, 1, 2, k.helm === 'hood' ? k.cloth2 : k.metal);
  p(4, 13, 6, 2, k.undead ? '#bdb8a6' : k.cloth);
  p(10, 14, 4, 1, k.leather);
  if (weapon === 'spear') p(1, 15, 14, 1, k.wood);
  else if (weapon === 'bow') {
    p(5, 12, 5, 1, k.wood);
  } else p(0, 15, 12, 1, k.wood);
}

/** Horse, wolf, elk, or bone horse, facing right. `frame` 0..2 is the gait. */
function mount(d: Pen, k: Kit, frame: number, x: number, y: number) {
  const { p } = d;
  const c = k.mount;
  const dk = k.mountDark;
  if (k.rider === 'wolf') {
    p(x + 2, y + 2, 11, 4, c);
    p(x + 2, y + 5, 11, 1, dk);
    p(x + 12, y, 4, 3, c);
    p(x + 15, y + 1, 3, 2, c);
    p(x + 12, y - 1, 1, 1, dk);
    p(x + 14, y - 1, 1, 1, dk);
    p(x + 16, y + 1, 1, 1, '#facc15');
    p(x, y + 1, 2, 2, c);
    p(x - 1, y, 1, 1, c);
  } else {
    // Body, neck, head.
    p(x + 3, y + 2, 11, 5, c);
    p(x + 3, y + 6, 11, 1, dk);
    p(x + 13, y - 2, 3, 5, c);
    p(x + 15, y - 3, 3, 3, c);
    p(x + 18, y - 2, 1, 2, c);
    p(x + 15, y - 4, 1, 1, dk);
    p(x + 16, y - 2, 1, 1, '#0b0a08');
    // Mane and tail.
    p(x + 12, y - 2, 1, 4, dk);
    p(x + 1, y + 2, 2, 1, dk);
    p(x, y + 3, 1, 4, dk);
    if (k.rider === 'elk') {
      p(x + 14, y - 6, 1, 3, '#e7dcc4');
      p(x + 13, y - 7, 1, 1, '#e7dcc4');
      p(x + 16, y - 7, 1, 2, '#e7dcc4');
      p(x + 17, y - 8, 1, 1, '#e7dcc4');
    }
    if (k.rider === 'bone') {
      for (let i = 0; i < 4; i++) p(x + 5 + i * 2, y + 3, 1, 3, '#16130f');
      p(x + 16, y - 2, 1, 1, '#4ade80');
    }
  }
  // Legs: three gait frames.
  const ly = y + 7;
  const leg = (lx: number, dx: number) => {
    p(x + lx, ly, 1, 2, c);
    p(x + lx + dx, ly + 2, 1, 2, c);
    p(x + lx + dx, ly + 3, 1, 1, dk);
  };
  if (frame === 0) {
    leg(4, -2);
    leg(6, -1);
    leg(11, 1);
    leg(13, 2);
  } else if (frame === 1) {
    leg(5, 0);
    leg(6, 1);
    leg(11, 0);
    leg(12, -1);
  } else {
    leg(4, 1);
    leg(6, 2);
    leg(11, -1);
    leg(13, -2);
  }
}

function cavalry(d: Pen, k: Kit, frame: number, skin: string, lord = false) {
  const { p } = d;
  const top = lord ? 2 : 0;
  if ((lord && frame === 3) || (!lord && frame === 4)) {
    // Fallen: the mount on its side, the rider thrown.
    p(3, 14 + top, 13, 3, k.mount);
    p(3, 16 + top, 13, 1, k.mountDark);
    p(15, 13 + top, 3, 3, k.mount);
    p(4, 17 + top, 6, 1, k.mountDark);
    corpse(d, k, skin, 'spear');
    return;
  }
  const gait = lord ? (frame === 2 ? 1 : frame) : frame === 3 ? 1 : frame;
  mount(d, k, gait, 2, 10 + top);
  // Caparison in the side's color.
  if (k.rider !== 'wolf') {
    p(5, 12 + top, 8, 3, k.cloth);
    p(5, 15 + top, 8, 1, k.cloth2);
  }
  // Rider.
  head(d, k, 7, top, skin);
  p(7, 5 + top, 4, 1, k.metal);
  p(7, 6 + top, 4, 4, k.undead ? k.metalDark : k.cloth);
  p(8, 10 + top, 2, 2, k.leather);
  if (lord) {
    // Cape streaming back, and a crown.
    p(3, 5 + top, 4, 1, k.cloth);
    p(2, 6 + top, 4, 3, k.cloth);
    p(1, 8 + top, 3, 2, k.cloth2);
    p(8, top - 1, 3, 1, '#facc15');
    p(8, top - 2, 1, 1, '#facc15');
    p(10, top - 2, 1, 1, '#facc15');
    // A sword held up.
    p(12, 1 + top, 1, 6, '#e5e7eb');
    p(11, 6 + top, 3, 1, '#a16207');
  } else if (frame === 3) {
    // Lance couched for the charge.
    p(10, 7, 14, 1, k.wood);
    p(22, 6, 2, 3, k.metal);
  } else {
    p(12, 0, 1, 10, k.wood);
    p(12, -1, 1, 2, k.metal);
    p(11, 1, 1, 1, k.cloth);
    p(11, 2, 1, 1, k.cloth);
  }
}

function mage(d: Pen, k: Kit, frame: number, skin: string) {
  const { p } = d;
  if (frame === 2) return corpse(d, { ...k, cloth: k.cloth2 }, skin, 'staff');
  const robe = k.cloth2;
  // Hat or cowl.
  if (k.helm === 'horned') {
    p(4, 2, 4, 3, k.leather);
    p(3, 0, 1, 3, '#e7e1cf');
    p(8, 0, 1, 3, '#e7e1cf');
  } else if (k.undead) {
    p(4, 1, 4, 4, '#1c1917');
    p(5, 3, 2, 2, '#d6d3c4');
    p(6, 3, 1, 1, k.magic);
  } else {
    p(5, 0, 2, 1, robe);
    p(4, 1, 4, 2, robe);
    p(3, 3, 6, 1, robe);
  }
  if (!k.undead) {
    p(5, 4, 3, 2, skin);
    p(7, 4, 1, 1, '#1a1410');
    p(5, 6, 3, 1, '#e5e7eb');
  }
  // Robe, widening to the hem.
  p(4, 6, 4, 4, robe);
  p(3, 10, 6, 4, robe);
  p(2, 14, 8, 4, robe);
  p(5, 9, 2, 1, k.metal);
  p(2, 17, 8, 1, k.cloth);
  const hand = k.undead ? '#d6d3c4' : skin;
  if (frame === 1) {
    // Casting: staff raised high, the orb blazing.
    p(10, 0, 1, 10, k.wood);
    p(9, 4, 1, 1, hand);
    p(10, -1, 1, 1, '#ffffff');
    p(9, 0, 3, 1, k.magic);
    p(10, 0, 1, 1, '#ffffff');
    p(8, 2, 1, 1, k.magic);
    p(12, 2, 1, 1, k.magic);
    p(3, 5, 1, 2, hand);
  } else {
    p(10, 2, 1, 16, k.wood);
    p(9, 1, 3, 2, k.magic);
    p(10, 1, 1, 1, '#ffffff');
    p(9, 9, 1, 1, hand);
  }
}

function trebuchet(d: Pen, k: Kit, frame: number) {
  const { p } = d;
  const w = k.wood;
  const dk = '#3f2a17';
  // Base, wheels, A-frame.
  p(3, 21, 20, 2, dk);
  for (const wx of [5, 18]) {
    p(wx - 1, 22, 3, 3, '#2a1c10');
    p(wx, 23, 1, 1, '#8b6b4a');
  }
  for (let i = 0; i < 9; i++) {
    p(7 + i, 21 - i * 1.1, 1, 2, w);
    p(17 - i, 21 - i * 1.1, 1, 2, w);
  }
  p(11, 10, 3, 2, dk);
  // The arm, its counterweight, and the sling.
  if (frame === 0) {
    for (let i = 0; i < 12; i++) p(12 - i, 11 + i * 0.75, 1, 1, w);
    p(13, 8, 4, 4, '#57534e');
    p(13, 8, 4, 1, '#78716c');
    p(1, 20, 2, 2, '#57534e');
  } else {
    for (let i = 0; i < 12; i++) p(12 + i * 0.7, 10 - i * 0.8, 1, 1, w);
    p(9, 12, 4, 4, '#57534e');
    p(20, 0, 2, 2, '#57534e');
  }
  p(12, 10, 1, 1, '#a8a29e');
}

function peasant(d: Pen, k: Kit, frame: number, skin: string) {
  const { p } = d;
  p(4, 1, 3, 1, '#a16207');
  p(3, 2, 5, 1, '#a16207');
  p(4, 3, 3, 2, skin);
  p(6, 3, 1, 1, '#1a1410');
  p(3, 5, 5, 5, frame ? k.cloth2 : '#78716c');
  p(4, 10, 3, 1, k.leather);
  legs(d, k, 3, 11, frame);
  p(8, 3, 1, 11, k.wood);
  p(7, 3, 3, 1, '#9ca3af');
}

// ---- beasts ---------------------------------------------------------------------------

export type DragonColors = { body: string; dark: string; belly: string; wing: string; eye: string };

function dragon(d: Pen, c: DragonColors, frame: number) {
  const { g } = d;
  const blob = (x: number, y: number, rx: number, ry: number, col: string, rot = 0) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
    g.fill();
  };
  const poly = (pts: number[], col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
    g.closePath();
    g.fill();
  };
  // The far wing, behind the body.
  const lift = [-14, -6, 4, -6][frame];
  poly([27, 19, 22, 19 + lift * 0.6 - 4, 15, 19 + lift * 0.7 - 6, 21, 22], c.dark);
  // Tail: tapering beads back to a barb.
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    blob(19 - i * 2.2, 22 + Math.sin(t * 3 + frame) * 1.5 + t * 2, 3.2 - t * 2.4, 2.4 - t * 1.6, c.body);
  }
  poly([0, 22, 3, 19, 4, 25], c.dark);
  // Body and belly.
  blob(26, 22, 9, 4.5, c.body);
  blob(27, 24, 7, 2, c.belly);
  // Legs tucked.
  blob(22, 26, 2, 2.5, c.dark);
  blob(30, 26, 2, 2.5, c.dark);
  // Neck and head.
  for (let i = 0; i < 5; i++) blob(34 + i * 2.6, 20 - i * 1.8, 3.2 - i * 0.2, 2.6, c.body);
  blob(47, 11, 4.2, 2.8, c.body, -0.2);
  poly([49, 11, 55, 10, 54, 13, 49, 13], c.body);
  poly([45, 9, 41, 5, 46, 8], c.belly);
  poly([47, 9, 45, 4, 48, 8], c.belly);
  g.fillStyle = c.eye;
  g.fillRect(49, 10, 1, 1);
  // Spines.
  for (let i = 0; i < 6; i++) poly([20 + i * 3, 18, 21.5 + i * 3, 15.5, 23 + i * 3, 18], c.dark);
  // The near wing: bone and membrane, four beats.
  const tip = [
    [12, 0],
    [8, 8],
    [10, 34],
    [8, 14],
  ][frame];
  const elbow = [
    [22, 6],
    [20, 12],
    [22, 28],
    [20, 16],
  ][frame];
  poly([30, 18, elbow[0], elbow[1], tip[0], tip[1], 14, (tip[1] + 22) / 2, 18, 20, 24, 21], c.wing);
  g.strokeStyle = c.dark;
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(30, 18);
  g.lineTo(elbow[0], elbow[1]);
  g.lineTo(tip[0], tip[1]);
  g.moveTo(elbow[0], elbow[1]);
  g.lineTo(14, (tip[1] + 22) / 2);
  g.moveTo(elbow[0], elbow[1]);
  g.lineTo(18, 20);
  g.stroke();
}

function crow(d: Pen, frame: number) {
  const { p } = d;
  const c = '#0c0a09';
  p(2, 2, 3, 1, c);
  p(5, 1, 1, 1, c);
  if (frame === 0) {
    p(1, 1, 1, 1, c);
    p(0, 0, 1, 1, c);
    p(5, 0, 1, 1, c);
    p(6, 0, 1, 1, c);
  } else {
    p(0, 3, 2, 1, c);
    p(5, 3, 2, 1, c);
  }
}

// ---- the atlas -------------------------------------------------------------------------

export type Atlas = {
  canvas: HTMLCanvasElement;
  /** Source rect of a frame: [x, y, w, h], facing right or mirrored. */
  rect(kind: Kind, frame: number, flip: boolean, variant?: number): [number, number, number, number];
};

/** Snap alpha to on/off and add a dark one-pixel outline: the frame now reads as pixel art. */
export function finish(g: CanvasRenderingContext2D, w: number, h: number) {
  const img = g.getImageData(0, 0, w, h);
  const a = img.data;
  const solid = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    solid[i] = a[i * 4 + 3] > 110 ? 1 : 0;
    a[i * 4 + 3] = solid[i] ? 255 : 0;
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (solid[i]) continue;
      const near = (x > 0 && solid[i - 1]) || (x < w - 1 && solid[i + 1]) || (y > 0 && solid[i - w]) || (y < h - 1 && solid[i + w]);
      if (!near) continue;
      a[i * 4] = OUTLINE[0];
      a[i * 4 + 1] = OUTLINE[1];
      a[i * 4 + 2] = OUTLINE[2];
      a[i * 4 + 3] = 235;
    }
  }
  g.putImageData(img, 0, 0);
}

const KINDS: Kind[] = ['inf', 'arch', 'cav', 'mage', 'lord', 'treb', 'crow', 'peasant'];
/** Skin-tone variants baked per kind, so a crowd is not all one face. */
const VARIANTS = 3;

/**
 * One faction's atlas: every kind, frame, and skin variant, facing right and mirrored,
 * plus the dragon if colors are given. Built once (it needs a DOM).
 */
export function buildAtlas(k: Kit, dragonColors?: DragonColors, only?: Kind[]): Atlas {
  const pad = 2;
  // Layout: one row per (kind, variant); right-facing frames, then mirrored ones.
  const rows: { kind: Kind; variant: number; y: number }[] = [];
  let y = 0;
  let width = 0;
  const kinds: Kind[] = only ?? (dragonColors ? [...KINDS, 'dragon'] : KINDS);
  for (const kind of kinds) {
    const s = SHAPES[kind];
    const variants = kind === 'treb' || kind === 'dragon' || kind === 'crow' ? 1 : VARIANTS;
    for (let v = 0; v < variants; v++) {
      rows.push({ kind, variant: v, y });
      y += s.h + pad;
    }
    width = Math.max(width, (s.w + pad) * s.frames * 2);
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = y;
  const g = canvas.getContext('2d', { willReadFrequently: true })!;
  const scratch = document.createElement('canvas');
  const sg = scratch.getContext('2d', { willReadFrequently: true })!;
  const index = new Map<string, number>();
  for (const row of rows) {
    const s = SHAPES[row.kind];
    index.set(`${row.kind}:${row.variant}`, row.y);
    scratch.width = s.w;
    scratch.height = s.h;
    for (let f = 0; f < s.frames; f++) {
      sg.clearRect(0, 0, s.w, s.h);
      const pen: Pen = {
        g: sg,
        p(x, yy, w = 1, h = 1, c = '#ff00ff') {
          sg.fillStyle = c;
          sg.fillRect(Math.round(x), Math.round(yy), w, h);
        },
      };
      const skin = k.skin[row.variant % k.skin.length];
      switch (row.kind) {
        case 'inf':
          infantry(pen, k, f, skin);
          break;
        case 'arch':
          archer(pen, k, f, skin);
          break;
        case 'cav':
          cavalry(pen, k, f, skin);
          break;
        case 'mage':
          mage(pen, k, f, skin);
          break;
        case 'lord':
          cavalry(pen, k, f, skin, true);
          break;
        case 'treb':
          trebuchet(pen, k, f);
          break;
        case 'dragon':
          dragon(pen, dragonColors!, f);
          break;
        case 'crow':
          crow(pen, f);
          break;
        case 'peasant':
          peasant(pen, k, f, skin);
          break;
      }
      finish(sg, s.w, s.h);
      const x = f * (s.w + pad);
      g.drawImage(scratch, x, row.y);
      // Mirrored copy after the right-facing frames.
      g.save();
      g.translate((s.frames + f) * (s.w + pad) + s.w, row.y);
      g.scale(-1, 1);
      g.drawImage(scratch, 0, 0);
      g.restore();
    }
  }
  return {
    canvas,
    rect(kind, frame, flip, variant = 0) {
      const s = SHAPES[kind];
      const v = kind === 'treb' || kind === 'dragon' || kind === 'crow' ? 0 : variant % VARIANTS;
      const ry = index.get(`${kind}:${v}`) ?? 0;
      const f = Math.max(0, Math.min(s.frames - 1, frame));
      return [((flip ? s.frames : 0) + f) * (s.w + pad), ry, s.w, s.h];
    },
  };
}

/**
 * Stamp a frame with its feet at (x, y), `P` CSS pixels per art pixel. Positions snap to
 * whole art pixels on screen, so the art never shimmers as it moves.
 */
export function stamp(ctx: CanvasRenderingContext2D, atlas: Atlas, kind: Kind, frame: number, flip: boolean, x: number, y: number, P: number, variant = 0) {
  const [sx, sy, w, h] = atlas.rect(kind, frame, flip, variant);
  const s = SHAPES[kind];
  const ax = flip ? s.w - 1 - s.ax : s.ax;
  const dx = Math.round(x / P - ax) * P;
  const dy = Math.round(y / P - s.ay) * P;
  ctx.drawImage(atlas.canvas, sx, sy, w, h, dx, dy, w * P, h * P);
}
