// Petits outils de géométrie partagés par l'intérieur du bateau (le carré, la timonerie).
import * as THREE from 'three';

// Une boîte de dimensions (l, h, p) centrée en (x, y, z)
export function boite(l, h, p, x, y, z) {
  const g = new THREE.BoxGeometry(l, h, p);
  g.translate(x, y, z);
  return g;
}
// une boîte entre deux coins (dans n'importe quel ordre)
export function entre(x0, x1, y0, y1, z0, z1) {
  return boite(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2);
}

// Des coordonnées de texture en mètres (× echelle), projetées selon la face : le dessus
// des meubles garde le fil le long du bateau, les côtés le gardent vertical
export function uvBois(g, echelle = 2) {
  const p = g.attributes.position;
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ny = Math.abs(n.getY(i));
    const nx = Math.abs(n.getX(i));
    if (ny > 0.5) {
      uv[i * 2] = p.getX(i) * echelle;
      uv[i * 2 + 1] = p.getZ(i) * echelle;
    } else {
      uv[i * 2] = (nx > 0.5 ? p.getZ(i) : p.getX(i)) * echelle;
      uv[i * 2 + 1] = p.getY(i) * echelle;
    }
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return g;
}
export function echelleUV(g, k) {
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * k, uv.getY(i) * k);
  return g;
}

// Colore une géométrie d'une seule couleur (pour un matériau à couleurs par sommet)
export function teinter(g, couleur) {
  const c = new THREE.Color(couleur);
  const n = g.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.toArray(col, i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

// Une bande entre deux lignes de points (même nombre de points)
export function bande(a, b) {
  const positions = [];
  for (let k = 0; k < a.length; k++) positions.push(a[k].x, a[k].y, a[k].z, b[k].x, b[k].y, b[k].z);
  const indices = [];
  for (let k = 0; k < a.length - 1; k++) {
    const i = k * 2;
    indices.push(i, i + 1, i + 2, i + 1, i + 3, i + 2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((positions.length / 3) * 2), 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// Pour fusionner des géométries, elles doivent toutes avoir les mêmes attributs (et
// toutes, ou aucune, des indices) : on garde la position, la normale et ce qu'on demande
export function preparer(g, garder) {
  const h = g.index ? g.toNonIndexed() : g;
  for (const nom of Object.keys(h.attributes)) {
    if (nom !== 'position' && nom !== 'normal' && !garder.includes(nom)) h.deleteAttribute(nom);
  }
  if (!h.attributes.normal) h.computeVertexNormals();
  if (garder.includes('uv') && !h.attributes.uv) h.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(h.attributes.position.count * 2), 2));
  return h;
}
