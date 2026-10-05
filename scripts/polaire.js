// La « polaire » du voilier : sa vitesse selon la force du vent et l'angle sous lequel
// il le reçoit. C'est le tableau que tout navigateur connaît pour son bateau.
//   node scripts/polaire.js            → le tableau (et le temps de calcul)
//   node scripts/polaire.js --json     → enregistre aussi src/physique/polaire.json
//
// Chaque case : on lance le bateau sur une mer plate, un pilote automatique garde
// l'angle au vent, et un « régleur » automatique borde ou choque les écoutes pour que
// les voiles travaillent à leur meilleur angle (~20° d'incidence). On note la vitesse
// moyenne une fois le bateau lancé.
import fs from 'node:fs';
import { Vector3 } from 'three';
import { PhysiqueVoilier, NOEUD } from '../src/physique/voilier.js';
import { reglerAutomatiquement } from '../src/physique/regleur.js';

const merPlate = { hauteur: () => 0 };
const VENTS = [6, 10, 14, 20, 26];
const ANGLES = [30, 38, 45, 52, 60, 75, 90, 110, 130, 150, 165, 180];

function essai(noeuds, angle, ris = 0, deroule = 1) {
  const b = new PhysiqueVoilier();
  b.placer(0, 0, angle, merPlate); // vent du nord (0°), le bateau au cap « angle »
  b.ris = ris;
  b.deroule = deroule;
  b.vitesse.set(Math.sin((angle * Math.PI) / 180), 0, -Math.cos((angle * Math.PI) / 180)).multiplyScalar(2);
  const vent = new Vector3(0, 0, noeuds * NOEUD); // venant du nord : l'air va vers le sud (+z)
  let somme = 0;
  let gite = 0;
  let barre = 0;
  let n = 0;
  const duree = 45;
  for (let i = 0; i < duree * 60; i++) {
    const erreur = ((b.mesures.cap - angle + 540) % 360) - 180;
    b.barre = Math.max(-0.5, Math.min(0.5, -erreur * 0.03 + b.rotation.y * 1.5));
    reglerAutomatiquement(b, 1 / 60);
    b.avancer(1 / 60, merPlate, vent, 2);
    if (i > (duree - 12) * 60) {
      somme += b.mesures.vitesse;
      gite += Math.abs(b.mesures.gite);
      barre += b.barre;
      n++;
    }
  }
  return { vitesse: somme / n, gite: gite / n, barre: (barre / n) * 57.3, b };
}

const debut = performance.now();
const resultats = {};
console.log(`vent (nds) │ ${ANGLES.map((a) => String(a).padStart(5)).join(' ')}   ← angle du vent (°)`);
console.log('───────────┼' + '──────'.repeat(ANGLES.length));
for (const v of VENTS) {
  // par vent fort, on réduit la toile comme un marin prudent
  const ris = v >= 24 ? 2 : v >= 18 ? 1 : 0;
  const deroule = v >= 24 ? 0.55 : v >= 18 ? 0.8 : 1;
  const ligne = [];
  const gites = [];
  const barres = [];
  resultats[v] = {};
  for (const a of ANGLES) {
    const r = essai(v, a, ris, deroule);
    ligne.push(r.vitesse.toFixed(1).padStart(5));
    gites.push(Math.round(r.gite));
    barres.push(Math.round(r.barre));
    resultats[v][a] = { vitesse: +r.vitesse.toFixed(2), gite: +r.gite.toFixed(1) };
  }
  console.log(`${String(v).padStart(6)}     │ ${ligne.join(' ')}   (gîte ${gites.join('/')}° · barre ${barres.join('/')}°)`);
}
const ms = performance.now() - debut;
const images = VENTS.length * ANGLES.length * 45 * 60;
console.log(`\n${(ms / 1000).toFixed(1)} s de calcul, soit ${(ms / images).toFixed(3)} ms par image simulée (2 sous-pas)`);
if (process.argv.includes('--json')) {
  fs.writeFileSync('src/physique/polaire.json', JSON.stringify({ vents: VENTS, angles: ANGLES, resultats }, null, 1));
  console.log('→ src/physique/polaire.json');
}
