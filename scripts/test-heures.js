// Vérifie les heures de la nuit, sans navigateur : node scripts/test-heures.js
// (quart/nuit.js : chaque heure plus dure ; ce qu'on entend venir, et quand — le moteur couvre
// tout ; l'éclair qui montre les grosses vagues ; les dalots qui se bouchent et le cockpit qui ne
// se vide plus ; la trombe qui ne vient pas sur le bateau)
import { Quaternion, Vector3 } from 'three';
import { Nuit, HEURES, ENTENDRE, ECLAIR_VAGUE, EAU, BETE, meteoDeLaNuit, programmeDe } from '../src/quart/nuit.js';
import { preavis } from '../src/monde/deferlantes.js';

let echecs = 0;
const verifier = (condition, message) => {
  console.log(`${condition ? '  ✓' : '  ✗'} ${message}`);
  if (!condition) echecs++;
};
const pas = 1 / 30;
const virgule = (x, n = 1) => x.toFixed(n).replace('.', ',');

// Un bateau pour rire : droit, immobile, il prend toutes les vagues par l'arrière (170°)
function contexte({ porteOuverte = false } = {}) {
  return {
    dt: pas,
    m: { gite: 0, ventApparent: 40, cap: 0, incidenceFoc: 10, vitesse: 0 },
    physique: {
      orientation: new Quaternion(), position: new Vector3(), vitesse: new Vector3(),
      deferlante: () => 170, eauCale: 0, eauCockpit: 0, barre: 0, tenueSafran: 1,
    },
    aBord: { descenteOuverte: porteOuverte, dehors: false, attache: true },
    evenements: [],
  };
}
// Une nuit à cette heure-là (sans rien d'autre que ce qu'on regarde)
function nuitA(heure, graine = 3) {
  const n = new Nuit({ graine });
  n.heure = heure;
  n.meteo = meteoDeLaNuit(heure);
  return n;
}
// Une déferlante tout de suite : on suit ses signes jusqu'à ce qu'elle frappe
function suivreUneVague(n, force, ctx = contexte()) {
  const vu = { annonce: null, entendue: null, eclair: null, frappe: null, a: null };
  n.on('deferlante-annonce', (a) => { vu.a = a; vu.annonce = { dans: a.dans, entendue: a.entendue }; });
  n.on('deferlante-entendue', (a) => { vu.entendue = a.dans; });
  n.on('deferlante-eclair', (a) => { vu.eclair = a.dans; });
  n.on('deferlante', () => { vu.frappe = true; });
  n.provoquerDeferlante(force);
  for (let t = 0; t < 8 && !vu.frappe; t += pas) n.suivreDeferlantes(pas, ctx);
  n.ecouteurs = {};
  return vu;
}

console.log('Chaque heure plus dure');
{
  verifier(HEURES.length === 6 && HEURES.every((h) => h.signe && h.signe.endsWith('.')), `six heures, chacune avec son signe (« ${HEURES[1].signe} »…)`);
  verifier(HEURES[5].periode * 3 <= HEURES[0].periode && HEURES[5].periode === Math.min(...HEURES.map((h) => h.periode)),
    `les déferlantes : une toutes les ${HEURES[0].periode} s à minuit, toutes les ${HEURES[5].periode} s à 5 h`);
  verifier(HEURES.every((h, k) => k === 0 || h.force > HEURES[k - 1].force), `et de plus en plus grosses (× ${HEURES.map((h) => virgule(h.force, 2)).join(', ')})`);
  verifier(programmeDe(24.5) === HEURES[0] && programmeDe(29.99) === HEURES[5] && programmeDe(30.2) === HEURES[5], 'chaque heure de la nuit a son programme');
  // (la vraie fréquence, mesurée : les vagues d'une heure entière, sans rien d'autre)
  const compter = (heure) => {
    const n = nuitA(heure + 0.01);
    const ctx = contexte();
    let k = 0;
    n.on('deferlante', () => { k++; });
    for (let t = 0; t < 118; t += pas) {
      n.heure = heure + 0.01 + t / 120;
      n.suivreDeferlantes(pas, ctx);
    }
    return k;
  };
  const minuit = compter(24);
  const cinq = compter(29);
  verifier(cinq >= 2 * minuit && minuit >= 2, `mesuré : ${minuit} déferlantes de minuit à 1 h, ${cinq} de 5 h à 6 h`);
}

console.log('\nCe qu\'on entend venir');
{
  verifier(preavis(0.3) === 2.5 && Math.abs(preavis(1.2) - 6) < 1e-9 && preavis(0.8) > preavis(0.5), `une déferlante gronde ${virgule(preavis(0.3))} s avant de frapper ; les plus grosses, ${virgule(preavis(1.2))} s avant`);
  const seul = suivreUneVague(nuitA(26.5), 1);
  verifier(seul.annonce && Math.abs(seul.annonce.entendue - seul.annonce.dans) < 1e-9 && seul.entendue !== null && seul.entendue > seul.annonce.dans - 0.1,
    `moteur arrêté : on l'entend dès qu'elle s'annonce (${virgule(seul.annonce?.dans ?? 0)} s avant)`);
  verifier(seul.frappe, 'puis elle frappe');
  const n = nuitA(26.5);
  n.systemes.moteur.etat = 'marche';
  const couvert = suivreUneVague(n, 1);
  verifier(couvert.entendue !== null && Math.abs(couvert.entendue - ENTENDRE.moteur * couvert.annonce.dans) < 0.05,
    `moteur en marche : on ne l'entend plus que ${virgule(couvert.entendue ?? 0)} s avant (les volets mettent 2,5 s à descendre)`);
}

console.log('\nL\'éclair qui montre la vague');
{
  const n = nuitA(26.5);
  verifier(n.meteo.orage > ECLAIR_VAGUE.orage, `à 2 h 30, l'orage est partout (${virgule(n.meteo.orage, 2)})`);
  let eclairs = 0;
  let quand = 0;
  for (let k = 0; k < 12; k++) {
    const v = suivreUneVague(n, 1.1);
    if (v.eclair !== null) {
      eclairs++;
      quand = Math.max(quand, v.eclair);
    }
  }
  verifier(eclairs >= 6 && eclairs < 12 && quand <= ECLAIR_VAGUE.avant, `${eclairs} grosses déferlantes sur 12 se découpent sur un éclair, ${virgule(ECLAIR_VAGUE.avant)} s avant de frapper au plus tôt`);
  let petites = 0;
  for (let k = 0; k < 6; k++) if (suivreUneVague(n, 0.55).eclair !== null) petites++;
  verifier(petites === 0, 'les petites, jamais');
}

console.log('\nLes dalots');
{
  const n = nuitA(28.6);
  n.prevu.dalots = 28.5;
  suivreUneVague(n, 0.4);
  verifier(n.avaries.dalots === 'ok', 'une vague qui jette peu d\'eau dans le cockpit ne les bouche pas');
  suivreUneVague(n, 0.9);
  verifier(n.avaries.dalots === 'bouches' && n.journal.at(-1).texte.includes('dalots'), `vers 4 h 30, celle qui remplit le cockpit les bouche (${Math.round(n.eau.cockpit)} L) : « ${n.journal.at(-1).texte} »`);
  // le cockpit plein, porte fermée : il ne se vide plus, et passe sous la porte
  const ctx = contexte();
  n.eau.cockpit = 700;
  n.eau.cale = 0;
  for (let t = 0; t < 20; t += pas) n.suivreEau(pas, ctx);
  verifier(n.eau.cockpit > 560, `bouchés : en vingt secondes, le cockpit ne s'est presque pas vidé (${Math.round(n.eau.cockpit)} L)`);
  verifier(n.eau.cale > 60, `son eau passe sous la porte fermée : ${Math.round(n.eau.cale)} L dans la cale`);
  verifier(n.reparer('dalots', ctx) && n.avaries.dalots === 'degages', 'on les dégage');
  for (let t = 0; t < 45; t += pas) n.suivreEau(pas, ctx);
  verifier(n.eau.cockpit < EAU.seuil, `dégagés, le cockpit se vide (${Math.round(n.eau.cockpit)} L trois quarts de minute plus tard)`);
  // (et on sort par la porte : avec le cockpit plein, son eau entre avec nous)
  const m = nuitA(28.6);
  m.eau.cockpit = 700;
  const ouverte = contexte({ porteOuverte: true });
  for (let t = 0; t < 1.2; t += pas) m.suivreEau(pas, ouverte);
  verifier(m.eau.cale > 150, `ouvrir la porte avec le cockpit plein, le temps de passer (1,2 s) : ${Math.round(m.eau.cale)} L entrent`);
  // (des dalots dégagés : une grosse vague s'écoule en moins d'une minute)
  const o = nuitA(26);
  o.eau.cockpit = 400;
  let t = 0;
  for (; t < 120 && o.eau.cockpit > 100; t += pas) o.suivreEau(pas, contexte());
  verifier(t < 60, `d'ordinaire, 400 L dans le cockpit sont tombés à 100 L en ${Math.round(t)} s`);
}

console.log('\nLa trombe ne vient pas sur le bateau');
{
  // (elle fonce droit sur un bateau arrêté : elle doit s'écarter de sa route)
  const n = nuitA(27.5);
  const ctx = contexte();
  const t = { x: 0, z: -700, vx: 0, vz: 8 };
  let plusPres = Infinity;
  for (let s = 0; s < 180; s += pas) {
    t.x += t.vx * pas;
    t.z += t.vz * pas;
    n.ecarterBete(t, ctx, pas);
    plusPres = Math.min(plusPres, Math.hypot(t.x, t.z));
  }
  verifier(plusPres > 0.8 * BETE.passeMin, `droit sur le bateau arrêté, elle s'écarte : passée à ${Math.round(plusPres)} m (au moins ${BETE.passeMin} m voulus)`);
}

console.log(echecs ? `\n${echecs} vérification(s) en échec` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
