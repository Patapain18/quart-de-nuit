// Les textures du voilier, peintes par le code au démarrage (pas d'images à charger) :
// le teck du cockpit, l'antidérapant du pont, la toile des voiles, le tressage des
// cordages. Chacune a une image de couleur et, pour le relief, une « carte de normales »
// (l'orientation de la surface pixel par pixel : creux des joints, bosses de
// l'antidérapant, coutures des voiles).
import * as THREE from 'three';

// Bruit de valeur lissé et répétable (période p) : de petites variations naturelles
function creerBruit(graine) {
  const table = new Float32Array(256 * 256);
  let a = graine >>> 0;
  for (let i = 0; i < table.length; i++) {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    table[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  // (p : période en x ; py : période en y, la même par défaut)
  return (x, y, p = 256, py = p) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = x - xi;
    const fy = y - yi;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const v = (i, j) => table[((((j % py) + py) % py) & 255) * 256 + ((((i % p) + p) % p) & 255)];
    const a0 = v(xi, yi) + (v(xi + 1, yi) - v(xi, yi)) * sx;
    const a1 = v(xi, yi + 1) + (v(xi + 1, yi + 1) - v(xi, yi + 1)) * sx;
    return a0 + (a1 - a0) * sy;
  };
}

function fbm(bruit, x, y, octaves, periode, periodeY = periode) {
  let s = 0;
  let amp = 0.5;
  let f = 1;
  for (let i = 0; i < octaves; i++) {
    s += amp * bruit(x * f, y * f, periode * f, periodeY * f);
    amp *= 0.5;
    f *= 2;
  }
  return s;
}

// Fabrique une texture de couleur et une carte de normales à partir d'une fonction
// qui donne, pour chaque pixel, une couleur [r, g, b] (0-255) et une hauteur (0-1).
function peindre(taille, pixel, { relief = 1, repetition = 1 } = {}) {
  const couleur = new Uint8Array(taille * taille * 4);
  const hauteurs = new Float32Array(taille * taille);
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const { c, h } = pixel(x / taille, y / taille);
      const i = y * taille + x;
      couleur[i * 4] = c[0];
      couleur[i * 4 + 1] = c[1];
      couleur[i * 4 + 2] = c[2];
      couleur[i * 4 + 3] = 255;
      hauteurs[i] = h;
    }
  }
  const normales = new Uint8Array(taille * taille * 4);
  const H = (x, y) => hauteurs[((y + taille) % taille) * taille + ((x + taille) % taille)];
  for (let y = 0; y < taille; y++) {
    for (let x = 0; x < taille; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * relief;
      const dy = (H(x, y + 1) - H(x, y - 1)) * relief;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * taille + x) * 4;
      normales[i] = Math.round((0.5 - (0.5 * dx) / l) * 255);
      normales[i + 1] = Math.round((0.5 - (0.5 * dy) / l) * 255);
      normales[i + 2] = Math.round((0.5 + 0.5 / l) * 255);
      normales[i + 3] = 255;
    }
  }
  const fabriquer = (donnees, srgb) => {
    const t = new THREE.DataTexture(donnees, taille, taille, THREE.RGBAFormat);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repetition, repetition);
    t.generateMipmaps = true;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.anisotropy = 8;
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.needsUpdate = true;
    return t;
  };
  return { couleur: fabriquer(couleur, true), normales: fabriquer(normales, false) };
}

// Le teck : des lattes de 6 cm séparées par des joints noirs (le caoutchouc qui les
// rend étanches), le fil du bois, une teinte un peu différente par latte, grisée
// par le sel et le soleil. Une texture couvre 1 m × 1 m.
export function texturesTeck() {
  const bruit = creerBruit(11);
  const lattes = 16; // 16 lattes par mètre (6,25 cm)
  return peindre(512, (u, v) => {
    const position = u * lattes;
    const latte = Math.floor(position);
    const dansLatte = position - latte;
    const joint = dansLatte < 0.07 ? 1 : 0;
    const teinte = bruit(latte * 7.3, 3.1) - 0.5;
    const fil = fbm(bruit, u * 120 + latte * 13, v * 6, 4, 256);
    const veines = Math.pow(Math.abs(Math.sin((v * 18 + fil * 6 + latte) * Math.PI)), 12);
    let r = 150 + teinte * 30 - fil * 40 - veines * 25;
    let g = 118 + teinte * 22 - fil * 32 - veines * 20;
    let b = 88 + teinte * 15 - fil * 25 - veines * 15;
    // grisé par le soleil
    const gris = 0.35 + 0.2 * bruit(u * 9, v * 9);
    const moyenne = (r + g + b) / 3;
    r = r + (moyenne + 10 - r) * gris;
    g = g + (moyenne + 8 - g) * gris;
    b = b + (moyenne + 6 - b) * gris;
    if (joint) { r = 28; g = 26; b = 24; }
    return { c: [r, g, b], h: joint ? 0 : 0.6 + fil * 0.2 };
  }, { relief: 6 });
}

// L'antidérapant du pont : un semis de petits losanges en relief dans le gelcoat
export function texturesAntiderapant() {
  const bruit = creerBruit(23);
  return peindre(256, (u, v) => {
    const n = 48; // losanges par texture (une texture = 0,5 m)
    const a = (u + v) * n;
    const b = (u - v) * n;
    const fa = a - Math.floor(a);
    const fb = b - Math.floor(b);
    const bosse = Math.min(fa, 1 - fa, fb, 1 - fb) * 2; // 0 au bord, 1 au centre du losange
    const h = Math.min(1, bosse * 2.2) * 0.8 + bruit(u * 90, v * 90) * 0.2;
    const c = 228 - (1 - h) * 14 + (bruit(u * 6, v * 6) - 0.5) * 10;
    return { c: [c, c, c - 3], h };
  }, { relief: 3.5 });
}

// La toile des voiles : un tissage serré, des laizes (bandes de tissu) cousues tous
// les 90 cm, et quelques salissures. Couleur « toile » chaude comme sur la vidéo.
export function texturesToile({ couleur = [222, 206, 176] } = {}) {
  const bruit = creerBruit(37);
  return peindre(512, (u, v) => {
    const trame = (Math.sin(u * 512 * Math.PI) * Math.sin(v * 512 * Math.PI)) * 0.5 + 0.5;
    const tache = fbm(bruit, u * 5, v * 5, 4, 256);
    const k = 0.92 + trame * 0.05 - (tache - 0.5) * 0.12;
    return { c: couleur.map((x) => x * k), h: trame * 0.5 };
  }, { relief: 1.2 });
}

// Le tressage d'un cordage : des torons en diagonale
export function texturesCordage({ couleur = [235, 232, 222], fil = [40, 70, 140] } = {}) {
  return peindre(128, (u, v) => {
    const toron = (u * 8 + v * 4) % 1;
    const toron2 = (u * 8 - v * 4 + 100) % 1;
    const h = Math.max(Math.sin(toron * Math.PI), Math.sin(toron2 * Math.PI));
    const marque = Math.floor(u * 8 + v * 4) % 6 === 0 ? 1 : 0; // un fil de couleur
    const c = marque ? fil : couleur.map((x) => x * (0.8 + 0.2 * h));
    return { c, h };
  }, { relief: 2 });
}

// ---------- L'intérieur (la timonerie) ----------
// Ces textures se répètent sans couture : le bruit a la même période que la texture
// (x de 0 à P quand u va de 0 à 1), dans chaque direction.

// Le bois verni des meubles et des cloisons : un placage de teck chaud, sans joints.
// Le fil suit v ; quelques « flammes » larges et des veines fines. 1 texture = 50 cm.
export function texturesBoisVerni() {
  const bruit = creerBruit(51);
  return peindre(512, (u, v) => {
    const fil = fbm(bruit, u * 96, v * 4, 4, 96, 4);
    const flamme = fbm(bruit, u * 8 + fil * 1.2, v * 2, 3, 8, 2);
    const veines = Math.pow(Math.abs(Math.sin((u * 64 + fil * 4 + flamme * 3) * Math.PI)), 10);
    const pores = bruit(u * 256, v * 32, 256, 32) > 0.82 ? 1 : 0;
    const k = 1.04 - 0.12 * fil - 0.14 * veines - 0.04 * pores + 0.12 * (flamme - 0.5);
    return { c: [182 * k, 112 * k, 66 * k], h: 0.6 - veines * 0.2 - pores * 0.12 };
  }, { relief: 1 });
}

// Le plancher de la timonerie : du teck et du houx (le bois clair), comme sur les voiliers
// d'autrefois : 14 lattes de teck par mètre, séparées d'un filet de houx.
// 1 texture = 1 m ; les lattes suivent v (la longueur du bateau).
export function texturesSolCabine() {
  const bruit = creerBruit(61);
  return peindre(512, (u, v) => {
    const n = 14;
    const position = u * n;
    const latte = Math.floor(position);
    const t = position - latte;
    const houx = t > 0.88;
    const teinte = bruit(latte * 9.7, 4.3, 256) - 0.5;
    const fil = fbm(bruit, u * 112, v * 4, 4, 112, 4);
    const veines = Math.pow(Math.abs(Math.sin((v * 7 + fil * 3 + latte * 0.37) * Math.PI)), 10);
    // le bout des lattes : un joint fin, à une hauteur différente pour chaque latte
    const bout = Math.abs(((v + bruit(latte * 3.1, 7.7, 256)) % 1) - 0.5) > 0.497;
    let c;
    if (houx) {
      const k = 0.95 + 0.05 * fil;
      c = [226 * k, 212 * k, 182 * k];
    } else {
      const k = 1 + teinte * 0.18 - fil * 0.22 - veines * 0.12;
      c = [150 * k, 92 * k, 52 * k];
    }
    if (bout && !houx) c = c.map((x) => x * 0.45);
    return { c, h: houx ? 0.55 : bout ? 0.3 : 0.6 + fil * 0.1 };
  }, { relief: 2.5 });
}

// Les vaigrages en lattes (« à claire-voie ») : des lattes de frêne verni le long de la
// coque, séparées par un jour sombre. Les lattes suivent u (la longueur) ; 1 texture = 1 m.
export function texturesLattes() {
  const bruit = creerBruit(71);
  return peindre(256, (u, v) => {
    const n = 14;
    const position = v * n;
    const latte = Math.floor(position);
    const t = position - latte;
    const jour = t > 0.74;
    const fil = fbm(bruit, u * 4, v * 64, 3, 4, 64);
    const teinte = bruit(3.3, latte * 7.9, 256) - 0.5;
    const k = 1 + teinte * 0.12 - fil * 0.16;
    // l'arête de la latte prend un peu la lumière
    const arete = t < 0.06 ? 1.08 : 1;
    const c = jour ? [52, 44, 36] : [196 * k * arete, 148 * k * arete, 100 * k * arete];
    return { c, h: jour ? 0 : Math.min(1, t * 8) };
  }, { relief: 4 });
}

// Le plafond : une moleskine crème au grain fin, tenue par des tasseaux de teck
// tous les 50 cm (en travers du bateau). 1 texture = 1 m ; u suit la longueur.
export function texturesPlafond() {
  const bruit = creerBruit(81);
  return peindre(256, (u, v) => {
    const grain = bruit(u * 128, v * 128, 128) * 0.6 + bruit(u * 64, v * 64, 64) * 0.4;
    const t = (u * 2) % 1;
    const tasseau = t < 0.07;
    if (tasseau) {
      const fil = fbm(bruit, u * 32, v * 8, 3, 32, 8);
      const k = 1 - fil * 0.2;
      // un bord plus sombre de chaque côté du tasseau (l'ombre du relief)
      const bord = t < 0.008 || t > 0.062 ? 0.7 : 1;
      return { c: [150 * k * bord, 94 * k * bord, 56 * k * bord], h: 1 };
    }
    const c = 236 - grain * 14;
    return { c: [c, c - 4, c - 14], h: 0.2 + grain * 0.1 };
  }, { relief: 3 });
}

// Le tissu des coussins : une toile bleu marine au tissage visible. 1 texture = 25 cm.
export function texturesTissu() {
  const bruit = creerBruit(91);
  return peindre(256, (u, v) => {
    const trame = Math.abs(Math.sin(u * 128 * Math.PI)) * 0.5 + Math.abs(Math.sin(v * 128 * Math.PI)) * 0.5;
    const chine = bruit(u * 32, v * 32, 32) - 0.5;
    const k = 0.86 + trame * 0.16 + chine * 0.1;
    return { c: [40 * k, 56 * k, 84 * k], h: trame };
  }, { relief: 1.5 });
}
