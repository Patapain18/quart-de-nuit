// L'inspection du pont : le plan où l'on marche (joueur/pont.js) et le corps du marin
// (joueur/marin.js) collent-ils au vrai modèle 3D du bateau ?
//
// Elle quadrille tout le bateau, tous les 4 cm, et pour chaque endroit où le plan dit
// qu'on peut poser le pied, elle regarde :
//  - la place : le corps et les yeux du marin y tiennent-ils ? (sinon il n'y va pas :
//    « trop serré », ce n'est pas un défaut, c'est un mur pour lui) ;
//  - le sol : y a-t-il vraiment un sol dessiné à la hauteur du plan ? (« vide » : on
//    marche sur l'air ; « enfoncé » : le sol dessiné est plus haut que les pieds ;
//    « flotte » : il est plus bas) ;
//  - le chemin : depuis le cockpit, en marchant comme le marin (les mêmes règles, la
//    même enjambée), arrive-t-on jusque-là ? (« inaccessible » : un coin du bateau où
//    l'on ne peut plus aller, par exemple si le corps était trop large pour la descente).
// (Outil de mise au point : window.__jeu.inspecterPont() dans le jeu.)
import { surfacesEn, solEn } from '../joueur/pont.js';
import { Marin } from '../joueur/marin.js';
import { construireEncombrement } from '../joueur/encombrement.js';
import { zDe } from '../bateau/forme.js';

// Les couleurs de la carte
const COULEURS = {
  ok: '#3f8f5a',
  serre: '#3a4247', // trop serré : le marin n'y va pas (un mur pour son corps)
  vide: '#e8443a', // on marche sur l'air
  enfonce: '#f08a24', // le sol dessiné est au-dessus des pieds
  flotte: '#e8c33a', // le sol dessiné est sous les pieds
  inaccessible: '#d23fd0', // on tiendrait debout, mais on ne peut pas y aller
};

// pas : finesse du quadrillage (m) ; tolerance : écart permis entre le plan et le dessin (m)
export async function inspecterPont(bateau, { pas = 0.04, tolerance = 0.035, encombrement = null } = {}) {
  const t0 = performance.now();
  const fixe = encombrement ?? construireEncombrement(bateau);
  const dessin = construireEncombrement(bateau, { tout: true }); // (avec le capot, les planches…)
  const marin = new Marin();
  marin.encombrement = fixe;
  marin.suivrePieces(bateau);
  const zMin = zDe(1) - 0.2;
  const zMax = zDe(0) + 0.2;
  const xMax = 1.8;
  const colonnes = Math.round((2 * xMax) / pas) + 1;
  const lignes = Math.round((zMax - zMin) / pas) + 1;
  const xDe = (k) => -xMax + k * pas;
  const zDeLigne = (l) => zMin + l * pas;

  // 1. chaque case, chaque surface : la place, puis le sol
  const points = new Map(); // `${k},${l},${surface}` → { k, l, x, z, y, surface, verdict, detail }
  for (let l = 0; l < lignes; l++) {
    const z = zDeLigne(l);
    for (let k = 0; k < colonnes; k++) {
      const x = xDe(k);
      for (const s of surfacesEn(x, z)) {
        const p = { k, l, x, z, y: s.y, surface: s.nom, verdict: 'ok', detail: '' };
        const libre = marin.degagement(x, z, s.y, marin.yeuxEn(x, z, s.y));
        if (libre < 1) {
          p.verdict = 'serre';
        } else {
          const hauteurs = dessin.verticale(x, z, s.y - 0.5, s.y + 0.12);
          if (!hauteurs.length) {
            p.verdict = 'vide';
          } else {
            let proche = hauteurs[0];
            for (const h of hauteurs) if (Math.abs(h.y - s.y) < Math.abs(proche.y - s.y)) proche = h;
            const ecart = proche.y - s.y;
            if (ecart > tolerance) { p.verdict = 'enfonce'; p.detail = `${proche.nom} ${(ecart * 100).toFixed(0)} cm au-dessus`; }
            else if (ecart < -tolerance) { p.verdict = 'flotte'; p.detail = `${proche.nom} ${(-ecart * 100).toFixed(0)} cm dessous`; }
          }
        }
        points.set(`${k},${l},${s.nom}`, p);
      }
    }
    if (l % 40 === 39) await new Promise((r) => setTimeout(r, 0));
  }

  // 2. le chemin : on part du plancher du cockpit (là où l'on se lève de la barre, à côté
  // de la barre franche) et on marche comme le marin, case par case
  let depart = null;
  for (const p of points.values()) {
    if (p.surface !== 'cockpit' || p.verdict === 'serre') continue;
    const d = Math.hypot(p.x - 0.3, p.z - zDe(0.17));
    if (!depart || d < Math.hypot(depart.x - 0.3, depart.z - zDe(0.17))) depart = p;
  }
  const atteint = new Set();
  if (depart) {
    const file = [depart];
    atteint.add(depart);
    const voisins = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let n = 0;
    while (file.length) {
      const p = file.pop();
      for (const [dk, dl] of voisins) {
        marin.position.set(p.x, p.y, p.z);
        if (!marin.essayer(dk * pas, dl * pas)) continue;
        // (où il a posé le pied : la case la plus proche, la surface sur laquelle il est)
        const sol = solEn(marin.position.x, marin.position.z, p.y);
        if (!sol) continue;
        const k = Math.round((marin.position.x + xMax) / pas);
        const l = Math.round((marin.position.z - zMin) / pas);
        const q = points.get(`${k},${l},${sol.nom}`);
        if (q && !atteint.has(q) && q.verdict !== 'serre') {
          atteint.add(q);
          file.push(q);
        }
      }
      if (++n % 3000 === 0) await new Promise((r) => setTimeout(r, 0));
    }
  }
  for (const p of points.values()) {
    if (p.verdict !== 'serre' && !atteint.has(p)) {
      p.detail = p.verdict === 'ok' ? '' : `${p.verdict} : ${p.detail}`;
      p.verdict = 'inaccessible';
    }
  }

  // le résumé : par surface et par sorte de défaut, combien, où (la boîte qui les contient)
  const resume = {};
  const compte = {};
  for (const p of points.values()) {
    compte[p.verdict] = (compte[p.verdict] ?? 0) + 1;
    if (p.verdict === 'ok' || p.verdict === 'serre') continue;
    const cle = `${p.surface} / ${p.verdict}`;
    const r = (resume[cle] ??= { nombre: 0, x: [Infinity, -Infinity], z: [Infinity, -Infinity], exemples: [] });
    r.nombre++;
    r.x[0] = Math.min(r.x[0], p.x); r.x[1] = Math.max(r.x[1], p.x);
    r.z[0] = Math.min(r.z[0], p.z); r.z[1] = Math.max(r.z[1], p.z);
    if (p.detail && r.exemples.length < 2 && !r.exemples.some((e) => e.startsWith(p.detail.split(' ')[0]))) {
      r.exemples.push(`${p.detail} en (${p.x.toFixed(2)}, ${p.z.toFixed(2)})`);
    }
  }
  const lignesResume = Object.entries(resume)
    .sort((a, b) => b[1].nombre - a[1].nombre)
    .map(([cle, r]) => `${cle} : ${r.nombre} points, x ${r.x[0].toFixed(2)} → ${r.x[1].toFixed(2)}, z ${r.z[0].toFixed(2)} → ${r.z[1].toFixed(2)}${r.exemples.length ? ` — ${r.exemples.join(' ; ')}` : ''}`);

  // les deux cartes vues de dessus : dehors (le pont) et dedans (la cabine)
  const cartes = { dehors: new Array(colonnes * lignes).fill(null), dedans: new Array(colonnes * lignes).fill(null) };
  const ordre = ['ok', 'serre', 'flotte', 'enfonce', 'vide', 'inaccessible']; // (le pire l'emporte)
  for (const p of points.values()) {
    const carte = cartes[p.y > 0.3 ? 'dehors' : 'dedans'];
    const i = p.l * colonnes + p.k;
    if (!carte[i] || ordre.indexOf(p.verdict) > ordre.indexOf(carte[i])) carte[i] = p.verdict;
  }
  return {
    triangles: fixe.nombre,
    secondes: (performance.now() - t0) / 1000,
    compte,
    resume: lignesResume,
    image: dessinerCartes(cartes, colonnes, lignes, { xMax, zMin, pas }),
  };
}

// Les deux cartes côte à côte, vues de dessus, l'avant en haut
function dessinerCartes(cartes, colonnes, lignes, { xMax, zMin, pas }) {
  const e = 4; // pixels par case
  const marge = 30;
  const canvas = document.createElement('canvas');
  canvas.width = colonnes * e * 2 + marge * 3;
  canvas.height = lignes * e + marge * 2 + 70;
  const g = canvas.getContext('2d');
  g.fillStyle = '#111518';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.font = '14px system-ui, sans-serif';
  ['dehors', 'dedans'].forEach((nom, n) => {
    const ox = marge + n * (colonnes * e + marge);
    g.fillStyle = '#c9d4d6';
    g.fillText(nom === 'dehors' ? 'Le pont (dehors)' : 'La cabine (dedans)', ox, 20);
    g.fillStyle = '#1c2226';
    g.fillRect(ox, marge, colonnes * e, lignes * e);
    const carte = cartes[nom];
    for (let l = 0; l < lignes; l++) {
      for (let k = 0; k < colonnes; k++) {
        const v = carte[l * colonnes + k];
        if (!v) continue;
        g.fillStyle = COULEURS[v];
        g.fillRect(ox + k * e, marge + l * e, e, e);
      }
    }
    // l'axe du bateau, et un trait tous les mètres
    g.strokeStyle = 'rgba(255,255,255,0.15)';
    g.beginPath();
    g.moveTo(ox + (xMax / pas) * e, marge);
    g.lineTo(ox + (xMax / pas) * e, marge + lignes * e);
    for (let z = Math.ceil(zMin); z < zMin + lignes * pas; z++) {
      const y = marge + ((z - zMin) / pas) * e;
      g.moveTo(ox, y);
      g.lineTo(ox + colonnes * e, y);
    }
    g.stroke();
  });
  // la légende
  const legende = [['ok', 'on y va, rien ne gêne'], ['serre', 'trop serré : le marin n\'y va pas'], ['inaccessible', 'on ne peut pas y aller'], ['vide', 'on marche sur l\'air'], ['enfonce', 'les pieds dans le dessin'], ['flotte', 'les pieds au-dessus du dessin']];
  legende.forEach(([cle, texte], n) => {
    const x = marge + (n % 3) * 250;
    const y = canvas.height - 50 + Math.floor(n / 3) * 22;
    g.fillStyle = COULEURS[cle];
    g.fillRect(x, y - 11, 14, 14);
    g.fillStyle = '#c9d4d6';
    g.fillText(texte, x + 20, y);
  });
  return canvas.toDataURL('image/png');
}
