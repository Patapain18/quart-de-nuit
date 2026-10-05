// La barre assistée tient-elle le cap ? node scripts/test-barre.js
// Le voilier navigue sans écran, les voiles réglées automatiquement, et la barre assistée
// (src/jeu/barre-assistee.js) le mène : on mesure de combien il s'écarte du cap voulu, à
// toutes les allures, par beau temps puis dans la tempête, et s'il tourne franchement
// quand on le lui demande (sans dépasser le cap en revenant).
import { PhysiqueVoilier } from '../src/physique/voilier.js';
import { reglerAutomatiquement } from '../src/physique/regleur.js';
import { Houle, CASCADES } from '../src/mer/houle.js';
import { Vent } from '../src/monde/vent.js';
import { Deferlantes } from '../src/monde/deferlantes.js';
import { AMBIANCES, etatMeteo, etatMer } from '../src/monde/meteo.js';
import { BarreAssistee } from '../src/jeu/barre-assistee.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const ecartCap = (a, b) => ((a - b + 540) % 360) - 180;
const DT = 1 / 60;

// Fait naviguer un bateau. programme(t) : l'axe des touches (-1, 0, 1) à l'instant t ;
// renvoie les écarts au cap voulu, seconde par seconde, et la trace du cap
function naviguer({ ambiance, angle, duree, programme = () => 0, ris = 0, deroule = 1, deferlantes = false, graine = 5, assistee = true }) {
  const meteo = etatMeteo(AMBIANCES[ambiance]);
  // (la houle « légère » des marins automatiques : les vagues qui comptent pour le bateau,
  // en grilles de 64 : quatre fois plus rapide)
  const houle = new Houle({ graine, cascades: CASCADES.filter((c) => c.physique).map((c) => ({ ...c, n: 64 })) });
  houle.regler(etatMer(meteo));
  const b = new PhysiqueVoilier();
  b.placer(0, 0, (meteo.directionVent + angle + 360) % 360, houle);
  b.vitesse.copy(b.avant).multiplyScalar(3);
  b.ris = ris;
  b.deroule = deroule;
  const vent = new Vent(7);
  const vagues = deferlantes ? new Deferlantes(graine * 3) : null;
  const barre = new BarreAssistee();
  b.mesurer();
  barre.reprendre(b.mesures.cap);
  const ecarts = [];
  const caps = [];
  for (let i = 0; i < duree * 60; i++) {
    const t = i * DT;
    houle.calculer(t, DT);
    const axe = programme(t);
    if (assistee) barre.maj(DT, axe, b);
    else b.barre -= Math.sign(b.barre) * Math.min(Math.abs(b.barre), 0.5 * DT); // la barre lâchée revient au milieu
    reglerAutomatiquement(b, DT);
    const frappe = vagues?.maj(DT, meteo);
    if (frappe) b.deferlante(frappe.vers, frappe.force);
    b.avancer(DT, houle, vent.maj(t, DT, meteo), 4);
    if (i % 60 === 0) {
      ecarts.push(assistee ? ecartCap(b.mesures.cap, barre.capVoulu) : 0);
      caps.push(b.mesures.cap);
    }
  }
  return { ecarts, caps, barre, vitesse: b.mesures.vitesse };
}
const rms = (v) => Math.sqrt(v.reduce((a, x) => a + x * x, 0) / v.length);
const maxAbs = (v) => Math.max(...v.map(Math.abs));

// (allures : l'angle entre le cap et le vent ; « tribord amures » : le vent vient de tribord)
const ALLURES = [[50, 'au près'], [90, 'de travers'], [135, 'au largue'], [165, 'au vent arrière']];
console.log('Bonne brise (midi, 13 nœuds), le cap tenu à chaque allure');
for (const [angle, nom] of ALLURES) {
  for (const cote of [1, -1]) {
    const r = naviguer({ ambiance: 'midi', angle: angle * cote, duree: 70 });
    const apres = r.ecarts.slice(15);
    // (au près, chaque saute de vent fait varier la vitesse, et le cap voulu doit parfois
    // s'écarter du vent qui refuse : on tolère un peu plus)
    verifier(rms(apres) < (angle < 60 ? 5 : 4) && maxAbs(apres) < (angle < 60 ? 15 : 10), `${nom} (${cote > 0 ? 'tribord' : 'bâbord'} amures) : écart moyen ${rms(apres).toFixed(1)}°, au plus ${maxAbs(apres).toFixed(1)}°, ${r.vitesse.toFixed(1)} nœuds`);
  }
}
// à 17 nœuds avec toute la toile, les risées couchent le bateau : le safran ventile (il
// sort de l'eau) et le bateau part au lof de 10 à 20°, quoi que fasse la barre (c'est le
// moment de choquer ou de prendre un ris) ; on vérifie seulement qu'il revient
console.log('Vent frais (fin d\'après-midi, 17 nœuds, toute la toile) : les départs au lof restent courts');
for (const [angle, nom] of ALLURES) {
  for (const cote of [1, -1]) {
    const r = naviguer({ ambiance: 'fin-apres-midi', angle: angle * cote, duree: 70 });
    const apres = r.ecarts.slice(15);
    verifier(rms(apres) < 7 && maxAbs(apres) < 25, `${nom} (${cote > 0 ? 'tribord' : 'bâbord'} amures) : écart moyen ${rms(apres).toFixed(1)}°, au plus ${maxAbs(apres).toFixed(1)}°, ${r.vitesse.toFixed(1)} nœuds`);
  }
}

console.log('Sans la barre assistée (la barre lâchée), le bateau ne garde pas son cap');
{
  const r = naviguer({ ambiance: 'fin-apres-midi', angle: 90, duree: 40, assistee: false });
  const derive = Math.abs(ecartCap(r.caps.at(-1), r.caps[0]));
  verifier(derive > 20, `barre lâchée au travers : il part de ${derive.toFixed(0)}° en 40 s (il lofe)`);
}

console.log('Tourner : D tenu (60° puis 120°), puis lâché, par bonne brise et par petit temps');
for (const [ambiance, degres] of [['fin-apres-midi', 60], ['fin-apres-midi', 120], ['matin-calme', 60]]) {
  const duree = degres / 18;
  const r = naviguer({ ambiance, angle: 60, duree: 45, programme: (t) => (t > 10 && t < 10 + duree ? 1 : 0) });
  const avant = r.caps[9];
  const tourne = (ecartCap(r.caps.at(-1), avant) + 360) % 360;
  const depassement = Math.max(...r.caps.slice(13).map((c) => (ecartCap(c, avant) + 360) % 360)) - degres;
  verifier(Math.abs(tourne - degres) < 6 && depassement < 12, `${ambiance} : il a tourné de ${tourne.toFixed(0)}° (${degres}° demandés), en dépassant de ${Math.max(0, depassement).toFixed(1)}°`);
}

console.log('Près du vent : le cap voulu ne reste pas dans le cône interdit');
{
  // au près (50°), on lofe un peu (D, 1 s : le cap voulu entre dans le cône) : il reste au
  // près du même bord, sans virer
  const r = naviguer({ ambiance: 'midi', angle: -50, duree: 30, programme: (t) => (t > 8 && t < 9 ? 1 : 0) });
  const vent = (r.caps[0] + 50 + 360) % 360;
  const fin = ecartCap(vent, r.caps.at(-1));
  verifier(fin > 38 && fin < 52, `lofer un peu au près : il reste au près du même bord (le vent à ${fin.toFixed(0)}° tribord)`);
  // on tourne franchement à travers le vent (D, 5 s : 90°) : il finit le virement de bord
  const v = naviguer({ ambiance: 'midi', angle: -50, duree: 40, programme: (t) => (t > 8 && t < 13 ? 1 : 0) });
  const finV = ecartCap(vent, v.caps.at(-1));
  verifier(finV < -38 && finV > -60, `tourner à travers le vent : il vire de bord (le vent à ${(-finV).toFixed(0)}° bâbord)`);
}

console.log('Dans la tempête (40 nœuds, vagues de 5 m, déferlantes), en fuite sous un bout de foc');
for (const graine of [9, 21]) {
  const r = naviguer({ ambiance: 'nuit-tempete', angle: 160, duree: 90, ris: 3, deroule: 0.25, deferlantes: true, graine });
  const apres = r.ecarts.slice(15);
  const embardees = apres.filter((e) => Math.abs(e) > 45).length;
  verifier(rms(apres) < 15 && embardees <= 3, `mer ${graine} : écart moyen ${rms(apres).toFixed(1)}°, au plus ${maxAbs(apres).toFixed(0)}°, ${embardees} s à plus de 45°`);
}

console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
