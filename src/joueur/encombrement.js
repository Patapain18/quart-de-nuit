// L'encombrement du bateau : où sont les choses dures (cloisons, boiseries, mât, winchs,
// plafond de la cabine…), tirées du vrai modèle 3D.
//
// Le plan du pont (pont.js) dit où l'on pose les pieds ; mais le marin a aussi un corps
// et des yeux : la caméra ne doit jamais entrer dans un mur (l'écran montrerait l'envers
// du décor). Pour le savoir sans deviner, on range une fois pour toutes les triangles du
// modèle dans une grille de petites boîtes de 12 cm ; chaque question (« y a-t-il quelque
// chose à moins de 15 cm de ce point ? ») ne regarde que les triangles des boîtes voisines :
// quelques dizaines au lieu de 40 000.
//
// Les pièces qui bougent (la bôme, la porte de la timonerie, la trappe de la cale, les
// volets) n'y sont pas : le marin les traite à part (marin.js, pont.js), là où elles sont à
// l'instant.

// Ce qui ne compte pas : les voiles, les câbles fins, l'eau, les cordages, et les pièces mobiles
const IGNORER = new Set([
  'grand-voile', 'foc', 'haubans', 'filieres', 'lignes-de-vie', 'cordages', 'eau-cockpit', 'eau-cabine',
  'pivot-bome', 'pivot-safran', 'voile-ferlee', 'porte-timonerie', 'pompe', 'trappe-cale', 'volets', 'timonerie-felure',
  'dalot', 'dalots-bouches', 'porte-cabine-avant',
]);
const IGNORER_TOUJOURS = new Set(['grand-voile', 'foc', 'haubans', 'filieres', 'lignes-de-vie', 'cordages', 'eau-cockpit', 'eau-cabine']);
const Y_MIN = -0.7; // (sous le fond de la cale et au-dessus de la tête, debout sur le rouf : inutile)
const Y_MAX = 4.2;

// Distance au carré d'un point à un triangle (Ericson, « Real-Time Collision Detection », 5.1.5)
function distance2(px, py, pz, t, i) {
  const ax = t[i], ay = t[i + 1], az = t[i + 2];
  const abx = t[i + 3] - ax, aby = t[i + 4] - ay, abz = t[i + 5] - az;
  const acx = t[i + 6] - ax, acy = t[i + 7] - ay, acz = t[i + 8] - az;
  const apx = px - ax, apy = py - ay, apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  if (d1 <= 0 && d2 <= 0) return apx * apx + apy * apy + apz * apz;
  const bpx = px - t[i + 3], bpy = py - t[i + 4], bpz = pz - t[i + 5];
  const d3 = abx * bpx + aby * bpy + abz * bpz;
  const d4 = acx * bpx + acy * bpy + acz * bpz;
  if (d3 >= 0 && d4 <= d3) return bpx * bpx + bpy * bpy + bpz * bpz;
  let qx, qy, qz;
  const vc = d1 * d4 - d3 * d2;
  if (vc <= 0 && d1 >= 0 && d3 <= 0) {
    const v = d1 / (d1 - d3);
    qx = ax + v * abx; qy = ay + v * aby; qz = az + v * abz;
  } else {
    const cpx = px - t[i + 6], cpy = py - t[i + 7], cpz = pz - t[i + 8];
    const d5 = abx * cpx + aby * cpy + abz * cpz;
    const d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) return cpx * cpx + cpy * cpy + cpz * cpz;
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      const w = d2 / (d2 - d6);
      qx = ax + w * acx; qy = ay + w * acy; qz = az + w * acz;
    } else {
      const va = d3 * d6 - d5 * d4;
      if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        const w = (d4 - d3) / ((d4 - d3) + (d5 - d6));
        qx = t[i + 3] + w * (t[i + 6] - t[i + 3]); qy = t[i + 4] + w * (t[i + 7] - t[i + 4]); qz = t[i + 5] + w * (t[i + 8] - t[i + 5]);
      } else {
        const k = 1 / (va + vb + vc);
        const v = vb * k;
        const w = vc * k;
        qx = ax + abx * v + acx * w; qy = ay + aby * v + acy * w; qz = az + abz * v + acz * w;
      }
    }
  }
  const dx = px - qx, dy = py - qy, dz = pz - qz;
  return dx * dx + dy * dy + dz * dz;
}

// Distance le long du rayon (o, d) à laquelle il coupe un triangle (Möller et Trumbore) ;
// Infinity s'il le manque
function intersecter(ox, oy, oz, dx, dy, dz, t, i) {
  const e1x = t[i + 3] - t[i], e1y = t[i + 4] - t[i + 1], e1z = t[i + 5] - t[i + 2];
  const e2x = t[i + 6] - t[i], e2y = t[i + 7] - t[i + 1], e2z = t[i + 8] - t[i + 2];
  const px = dy * e2z - dz * e2y, py = dz * e2x - dx * e2z, pz = dx * e2y - dy * e2x;
  const det = e1x * px + e1y * py + e1z * pz;
  if (Math.abs(det) < 1e-12) return Infinity;
  const inv = 1 / det;
  const sx = ox - t[i], sy = oy - t[i + 1], sz = oz - t[i + 2];
  const u = (sx * px + sy * py + sz * pz) * inv;
  if (u < 0 || u > 1) return Infinity;
  const qx = sy * e1z - sz * e1y, qy = sz * e1x - sx * e1z, qz = sx * e1y - sy * e1x;
  const v = (dx * qx + dy * qy + dz * qz) * inv;
  if (v < 0 || u + v > 1) return Infinity;
  const d = (e2x * qx + e2y * qy + e2z * qz) * inv;
  return d > 1e-5 ? d : Infinity;
}

export class GrilleTriangles {
  constructor(cellule = 0.12) {
    this.cellule = cellule;
    this.brut = []; // les coordonnées, 9 nombres par triangle (le temps de la construction)
    this.nomsBruts = [];
    this.noms = []; // le nom de chaque pièce
  }

  // ajoute les triangles d'un mesh ; matrice : du mesh vers le repère voulu
  ajouterMesh(mesh, matrice, nom) {
    let n = this.noms.indexOf(nom);
    if (n < 0) n = this.noms.push(nom) - 1;
    const pos = mesh.geometry.attributes.position;
    const index = mesh.geometry.index;
    const nb = index ? index.count : pos.count;
    const e = matrice.elements;
    const p = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i + 2 < nb; i += 3) {
      let yMin = Infinity;
      let yMax = -Infinity;
      for (let s = 0; s < 3; s++) {
        const v = index ? index.getX(i + s) : i + s;
        const x = pos.getX(v), y = pos.getY(v), z = pos.getZ(v);
        p[s * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
        p[s * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        p[s * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        yMin = Math.min(yMin, p[s * 3 + 1]);
        yMax = Math.max(yMax, p[s * 3 + 1]);
      }
      if (yMax < Y_MIN || yMin > Y_MAX) continue;
      this.brut.push(...p);
      this.nomsBruts.push(n);
    }
  }

  cle(i, j, k) { return ((k + 128) * 256 + (j + 128)) * 256 + (i + 128); }

  // range les triangles dans les boîtes (à appeler une fois, après les ajouts)
  terminer() {
    const t = (this.triangles = Float32Array.from(this.brut));
    this.nomDe = Uint16Array.from(this.nomsBruts);
    this.brut = null;
    this.nomsBruts = null;
    const nb = t.length / 9;
    this.marques = new Uint32Array(nb);
    this.tampon = 0;
    const listes = new Map();
    const c = this.cellule;
    for (let n = 0; n < nb; n++) {
      const i = n * 9;
      const x0 = Math.floor(Math.min(t[i], t[i + 3], t[i + 6]) / c), x1 = Math.floor(Math.max(t[i], t[i + 3], t[i + 6]) / c);
      const y0 = Math.floor(Math.min(t[i + 1], t[i + 4], t[i + 7]) / c), y1 = Math.floor(Math.max(t[i + 1], t[i + 4], t[i + 7]) / c);
      const z0 = Math.floor(Math.min(t[i + 2], t[i + 5], t[i + 8]) / c), z1 = Math.floor(Math.max(t[i + 2], t[i + 5], t[i + 8]) / c);
      for (let a = x0; a <= x1; a++) {
        for (let b = y0; b <= y1; b++) {
          for (let d = z0; d <= z1; d++) {
            const cle = this.cle(a, b, d);
            let l = listes.get(cle);
            if (!l) listes.set(cle, (l = []));
            l.push(n);
          }
        }
      }
    }
    this.cases = new Map();
    for (const [cle, l] of listes) this.cases.set(cle, Int32Array.from(l));
    return this;
  }

  get nombre() { return this.triangles.length / 9; }

  // passe sur chaque triangle des boîtes qui touchent la boîte [x0,x1]×[y0,y1]×[z0,z1]
  // (une seule fois chacun) ; f(n) renvoie true pour arrêter
  parcourir(x0, y0, z0, x1, y1, z1, f) {
    const c = this.cellule;
    const marque = ++this.tampon;
    for (let a = Math.floor(x0 / c); a <= Math.floor(x1 / c); a++) {
      for (let b = Math.floor(y0 / c); b <= Math.floor(y1 / c); b++) {
        for (let d = Math.floor(z0 / c); d <= Math.floor(z1 / c); d++) {
          const l = this.cases.get(this.cle(a, b, d));
          if (!l) continue;
          for (let k = 0; k < l.length; k++) {
            const n = l[k];
            if (this.marques[n] === marque) continue;
            this.marques[n] = marque;
            if (f(n)) return;
          }
        }
      }
    }
  }

  // la distance du point à la chose dure la plus proche, jusqu'à r (r si rien de plus près)
  distance(x, y, z, r) {
    let meilleur = r * r;
    let piece = -1;
    const t = this.triangles;
    this.parcourir(x - r, y - r, z - r, x + r, y + r, z + r, (n) => {
      const d = distance2(x, y, z, t, n * 9);
      if (d < meilleur) { meilleur = d; piece = n; }
      return false;
    });
    this.dernierePiece = piece >= 0 ? this.noms[this.nomDe[piece]] : null;
    return Math.sqrt(meilleur);
  }

  // y a-t-il quelque chose à moins de r du point ? (s'arrête au premier trouvé)
  touche(x, y, z, r) {
    const r2 = r * r;
    const t = this.triangles;
    let oui = false;
    this.parcourir(x - r, y - r, z - r, x + r, y + r, z + r, (n) => (oui = distance2(x, y, z, t, n * 9) < r2));
    return oui;
  }

  // La distance à la première chose dure que touche le rayon parti de o dans la direction
  // d (unitaire), jusqu'à tMax ; Infinity si rien. On suit le rayon de boîte en boîte
  // (Amanatides et Woo) : seules les boîtes qu'il traverse sont regardées. ignorer : un
  // ensemble de noms de pièces qui ne comptent pas (la chose que l'on vise elle-même)
  rayon(o, d, tMax, ignorer = null) {
    const c = this.cellule;
    const t = this.triangles;
    let i = Math.floor(o.x / c), j = Math.floor(o.y / c), k = Math.floor(o.z / c);
    const pasI = d.x > 0 ? 1 : -1, pasJ = d.y > 0 ? 1 : -1, pasK = d.z > 0 ? 1 : -1;
    const deltaI = d.x !== 0 ? c / Math.abs(d.x) : Infinity;
    const deltaJ = d.y !== 0 ? c / Math.abs(d.y) : Infinity;
    const deltaK = d.z !== 0 ? c / Math.abs(d.z) : Infinity;
    let prochainI = d.x !== 0 ? ((d.x > 0 ? (i + 1) * c - o.x : o.x - i * c) / Math.abs(d.x)) : Infinity;
    let prochainJ = d.y !== 0 ? ((d.y > 0 ? (j + 1) * c - o.y : o.y - j * c) / Math.abs(d.y)) : Infinity;
    let prochainK = d.z !== 0 ? ((d.z > 0 ? (k + 1) * c - o.z : o.z - k * c) / Math.abs(d.z)) : Infinity;
    const marque = ++this.tampon;
    let meilleur = Infinity;
    let entree = 0; // (où le rayon entre dans la boîte en cours)
    for (let n = 0; n < 400 && entree <= Math.min(tMax, meilleur); n++) {
      const l = this.cases.get(this.cle(i, j, k));
      if (l) {
        for (let m = 0; m < l.length; m++) {
          const tri = l[m];
          if (this.marques[tri] === marque) continue;
          this.marques[tri] = marque;
          if (ignorer && ignorer.has(this.noms[this.nomDe[tri]])) continue;
          const dist = intersecter(o.x, o.y, o.z, d.x, d.y, d.z, t, tri * 9);
          if (dist < meilleur) {
            meilleur = dist;
            this.dernierePiece = this.noms[this.nomDe[tri]];
          }
        }
      }
      if (prochainI < prochainJ && prochainI < prochainK) { i += pasI; entree = prochainI; prochainI += deltaI; }
      else if (prochainJ < prochainK) { j += pasJ; entree = prochainJ; prochainJ += deltaJ; }
      else { k += pasK; entree = prochainK; prochainK += deltaK; }
    }
    return meilleur <= tMax ? meilleur : Infinity;
  }

  // les hauteurs où la verticale (x, z) traverse le modèle entre yBas et yHaut
  verticale(x, z, yBas, yHaut) {
    const t = this.triangles;
    const sortie = [];
    this.parcourir(x, yBas, z, x, yHaut, z, (n) => {
      const i = n * 9;
      // le point (x, z) dans le triangle vu de dessus (coordonnées barycentriques)
      const ax = t[i], az = t[i + 2];
      const v0x = t[i + 3] - ax, v0z = t[i + 5] - az;
      const v1x = t[i + 6] - ax, v1z = t[i + 8] - az;
      const det = v0x * v1z - v1x * v0z;
      if (Math.abs(det) < 1e-12) return false;
      const px = x - ax, pz = z - az;
      const u = (px * v1z - v1x * pz) / det;
      const v = (v0x * pz - px * v0z) / det;
      if (u < 0 || v < 0 || u + v > 1) return false;
      const y = t[i + 1] + u * (t[i + 4] - t[i + 1]) + v * (t[i + 7] - t[i + 1]);
      if (y >= yBas && y <= yHaut) sortie.push({ y, nom: this.noms[this.nomDe[n]] });
      return false;
    });
    return sortie;
  }
}

// Construit l'encombrement fixe du bateau (dans le repère du bateau).
// tout : avec aussi les pièces qui bougent, là où elles sont (pour l'inspection du pont)
export function construireEncombrement(bateau, { tout = false } = {}) {
  const groupe = bateau.groupe;
  groupe.updateMatrixWorld(true);
  const versBateau = groupe.matrixWorld.clone().invert();
  const grille = new GrilleTriangles();
  groupe.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh) return;
    for (let p = o; p && p !== groupe; p = p.parent) {
      if (tout ? !p.visible || IGNORER_TOUJOURS.has(p.name) : IGNORER.has(p.name)) return;
    }
    const matrice = versBateau.clone().multiply(o.matrixWorld);
    grille.ajouterMesh(o, matrice, o.name || o.parent?.name || 'sans-nom');
  });
  return grille.terminer();
}
