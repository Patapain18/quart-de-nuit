// Vérifie la physique du voilier, sans navigateur : node scripts/test-physique.js
import { Vector3 } from 'three';
import { PhysiqueVoilier, NOEUD } from '../src/physique/voilier.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const merPlate = { hauteur: () => 0 };
const sansVent = new Vector3();
// vent réel (m/s, repère du monde) venant du cap « depuis » (degrés)
const vent = (noeuds, depuis) => {
  const a = (depuis * Math.PI) / 180;
  return new Vector3(-Math.sin(a), 0, Math.cos(a)).multiplyScalar(noeuds * NOEUD);
};

console.log('1. Le bateau');
{
  const b = new PhysiqueVoilier();
  console.log(`  ${b.volumes.length} volumes, déplacement ${b.deplacement.toFixed(2)} m³, masse ${Math.round(b.masse)} kg`);
  console.log(`  centre de carène y ${b.centreCarene.y.toFixed(2)} z ${b.centreCarene.z.toFixed(2)} · centre de gravité y ${b.centreGravite.y.toFixed(2)}`);
  verifier(b.masse > 10000 && b.masse < 17000, 'une masse de voilier de 14 m à timonerie (10 à 17 t)');
}

console.log('2. Au repos sur une mer plate');
{
  const b = new PhysiqueVoilier();
  b.placer(0, 0, 0, merPlate);
  for (let i = 0; i < 600; i++) b.avancer(1 / 60, merPlate, sansVent);
  const o = b.origine(new Vector3());
  verifier(Math.abs(o.y) < 0.05, `flotte à sa ligne de flottaison (écart ${o.y.toFixed(3)} m)`);
  verifier(Math.abs(b.mesures.gite) < 0.5 && Math.abs(b.mesures.assiette) < 0.5, `reste droit (gîte ${b.mesures.gite.toFixed(2)}°, assiette ${b.mesures.assiette.toFixed(2)}°)`);
  verifier(Math.hypot(o.x, o.z) < 0.05, `ne dérive pas (${Math.hypot(o.x, o.z).toFixed(3)} m)`);
}

console.log('3. Penché à 35°, il se redresse');
{
  const b = new PhysiqueVoilier();
  b.placer(0, 0, 0, merPlate);
  for (let i = 0; i < 120; i++) b.avancer(1 / 60, merPlate, sansVent);
  // on le penche sur tribord autour de son axe longitudinal
  const q = b.orientation.clone();
  b.orientation.multiply(new (q.constructor)().setFromAxisAngle(new Vector3(0, 0, 1), (-35 * Math.PI) / 180));
  let max = 0;
  let passages = 0;
  let avant = b.mesures.gite;
  const temps = [];
  for (let i = 0; i < 60 * 12; i++) {
    b.avancer(1 / 60, merPlate, sansVent);
    const g = b.mesures.gite;
    if (i > 5 && Math.sign(g) !== Math.sign(avant)) { passages++; temps.push(i / 60); }
    avant = g;
    if (i > 60 * 8) max = Math.max(max, Math.abs(g));
  }
  const periode = temps.length >= 3 ? (temps[2] - temps[0]) : NaN;
  console.log(`  période de roulis ${periode.toFixed(2)} s, gîte restante après 8 s : ${max.toFixed(2)}°`);
  verifier(periode > 1.8 && periode < 5, 'une période de roulis de bateau (2 à 5 s)');
  verifier(max < 4, 'le roulis s\'amortit');
}

console.log('4. Sous voiles : 12 nœuds de vent, à 60° du vent');
{
  const b = new PhysiqueVoilier();
  b.placer(0, 0, 0, merPlate);
  b.ecouteGV = 0.32;
  b.ecouteFoc = 0.3;
  const w = vent(12, 300); // cap 0, vent venant de 300° (bâbord, 60° de l'avant)
  // (un bateau de 13 t met près de deux minutes à prendre sa vitesse)
  for (let i = 0; i < 60 * 110; i++) {
    // pilote automatique simple : garder le cap 0
    const erreur = ((b.mesures.cap + 540) % 360) - 180;
    b.barre = Math.max(-0.5, Math.min(0.5, -erreur * 0.03 + b.rotation.y * 1.5));
    b.avancer(1 / 60, merPlate, w);
  }
  const m = b.mesures;
  console.log(`  vitesse ${m.vitesse.toFixed(2)} nds, gîte ${m.gite.toFixed(1)}°, dérive ${m.derive.toFixed(1)}°, vent apparent ${m.ventApparent.toFixed(1)} nds à ${m.angleVentApparent.toFixed(0)}°, bôme ${(b.angleBome * 57.3).toFixed(0)}°, incidence GV ${m.incidenceGV.toFixed(1)}° foc ${m.incidenceFoc.toFixed(1)}°, barre ${(b.barre * 57.3).toFixed(1)}°`);
  verifier(m.vitesse > 5 && m.vitesse < 8.5, 'une vitesse plausible pour un 14 m (5 à 8,5 nœuds)');
  verifier(Math.abs(m.gite) > 5 && Math.abs(m.gite) < 25, 'il gîte sous le vent (5 à 25°)');
  verifier(m.gite > 0, 'il penche sur tribord (le vent vient de bâbord)');
}

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
