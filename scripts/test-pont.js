// Vérifie le plan de pont : node scripts/test-pont.js
import { Vector3 } from 'three';
import { solEn, surfacesEn, ouvrirDescente, ouvrirTrappe } from '../src/joueur/pont.js';
import { Marin } from '../src/joueur/marin.js';
import {
  zDe, COCKPIT, ROUF, MAT, TIMONERIE, TRAPPE_CALE, demiLargeur, hauteurPont, hauteurRouf, bordInterieur,
} from '../src/bateau/forme.js';

let echecs = 0;
const verifier = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) echecs++; };
const nom = (x, z, y) => solEn(x, z, y)?.nom ?? 'rien';
const C = COCKPIT;
const zC = zDe(0.12); // le milieu du cockpit
const yHiloire = hauteurPont(0.12, C.demiLargeur) + C.hiloire;
const yPassavant = hauteurPont(0.12, 1.65);

console.log('Hauteurs');
verifier(Math.abs(solEn(0, zC, C.plancher).y - C.plancher) < 1e-6, `plancher du cockpit à ${C.plancher} m`);
verifier(nom(1.2, zC, C.plancher) === 'banc', 'on monte sur le banc depuis le plancher');
verifier(nom(C.demiLargeur + 0.03, zC, C.banc) === 'hiloire', 'du banc, on enjambe l\'hiloire');
verifier(nom(1.65, zC, yHiloire) === 'passavant', 'puis on descend sur le passavant');
verifier(nom(C.demiLargeur + 0.03, zC, C.plancher) === 'rien', 'mais pas d\'un coup depuis le plancher (mur)');
{
  const u = 0.55;
  const yP = hauteurPont(u, bordInterieur(u) + 0.1);
  verifier(nom(0.6, zDe(u), yP) === 'rouf', `du passavant, on grimpe sur le toit du rouf (${Math.round((hauteurRouf(u, 0.6) - yP) * 100)} cm plus haut)`);
  verifier(nom(bordInterieur(u) - ROUF.rentree / 2, zDe(u), yP) === 'rien', 'mais pas sur son bord penché (on l\'enjambe)');
}
verifier(nom(0.3, zDe(0.8), hauteurPont(0.8, 0.3)) === 'pont-avant', 'le pont avant');
verifier(nom(demiLargeur(0.38) - 0.05, zDe(0.38), hauteurPont(0.38, 2)) === 'rien', 'les filières arrêtent au bord');
verifier(nom(0, zDe(MAT.u), hauteurRouf(MAT.u, 0)) === 'rien', 'le mât est un obstacle');

console.log('La timonerie');
verifier(nom(0, TIMONERIE.zArriere - 0.1, C.plancher) === 'timonerie', `du cockpit, on entre dans la timonerie (une marche de ${Math.round((TIMONERIE.plancher - C.plancher) * 100)} cm)`);
verifier(Math.abs(solEn(0.3, 2.5, TIMONERIE.plancher).y - TIMONERIE.plancher) < 1e-6, `son plancher est surélevé (${TIMONERIE.plancher} m : assis, on voit dehors)`);
{
  const t = TRAPPE_CALE;
  const x = (t.x0 + t.x1) / 2;
  const z = (t.z0 + t.z1) / 2;
  verifier(nom(x, z, TIMONERIE.plancher) === 'timonerie', 'la trappe de la cale fermée : on marche dessus');
  ouvrirTrappe(true);
  verifier(nom(x, z, TIMONERIE.plancher) === 'rien' && nom(x, t.z1 + 0.08, TIMONERIE.plancher) === 'rien', 'ouverte : on n\'y marche pas (ni sur son couvercle, debout)');
  verifier(nom(0, z, TIMONERIE.plancher) === 'timonerie', 'et l\'on passe à côté');
  ouvrirTrappe(false);
}
verifier(nom(0, 0.9, hauteurRouf(0.43, 0)) === 'rien', 'du toit du rouf, on ne tombe pas dans la timonerie (le pare-brise)');
verifier(nom(1.6, 2.5, TIMONERIE.plancher) === 'rien', 'de la timonerie, on ne passe pas sur le passavant (la paroi)');
verifier(nom(1.3, 2.5, hauteurPont(0.3, 1.6)) === 'rien', 'du passavant, on n\'entre pas dans la timonerie (la paroi)');
ouvrirDescente(false);
verifier(nom(0, TIMONERIE.zArriere, C.plancher) === 'rien', 'porte fermée : on ne passe pas');
// (le marin enjambe les petits vides : il ne doit pas enjamber la porte fermée)
{
  const m = new Marin();
  const pousser = (x, z, y, lacet) => {
    m.placer(x, y, z);
    m.lacet = lacet;
    for (let i = 0; i < 120; i++) m.maj(1 / 60, { avance: 1, lateral: 0 }, new Vector3(0, -9.81, 0));
    return m.position.z;
  };
  const dehors = pousser(0.05, TIMONERIE.zArriere + 0.4, C.plancher, 0);
  const dedans = pousser(0, TIMONERIE.zArriere - 0.5, TIMONERIE.plancher, Math.PI);
  const biais = pousser(0.22, TIMONERIE.zArriere + 0.4, C.plancher, 0.4);
  verifier(dehors > TIMONERIE.zArriere && dedans < TIMONERIE.zArriere - 0.2 && biais > TIMONERIE.zArriere,
    `porte fermée : le marin ne la traverse ni de face ni en biais, ni du dedans (arrêté à ${((dehors - TIMONERIE.zArriere) * 100).toFixed(0)} cm dehors, ${((TIMONERIE.zArriere - dedans) * 100).toFixed(0)} cm dedans)`);
  ouvrirDescente(true);
  const ouverte = pousser(0.05, TIMONERIE.zArriere + 0.4, C.plancher, 0);
  verifier(ouverte < TIMONERIE.zArriere - 0.3, 'porte ouverte : il entre tout droit');
}
ouvrirDescente(true);

// le tour du pont : du cockpit à l'étrave par tribord (le banc, l'hiloire, le passavant le
// long de la timonerie et du rouf, le pont avant)
const VERS_L_ETRAVE = [[1.2, zC], [1.48, zC], [1.65, zC], [1.7, zDe(0.3)], [1.65, zDe(0.45)], [1.45, zDe(0.6)], [0.9, zDe(0.72)], [0.4, zDe(0.85)], [0.1, zDe(0.93)]];
console.log('Un tour du pont, du cockpit à l\'étrave par tribord, sans jamais être bloqué');
{
  let x = 0;
  let z = zC;
  let y = C.plancher;
  let bloque = null;
  for (const [cx, cz] of VERS_L_ETRAVE) {
    const n = 60;
    const x0 = x;
    const z0 = z;
    for (let i = 1; i <= n; i++) {
      const px = x0 + ((cx - x0) * i) / n;
      const pz = z0 + ((cz - z0) * i) / n;
      const s = solEn(px, pz, y);
      if (!s) { bloque = `bloqué en (${px.toFixed(2)}, ${pz.toFixed(2)}) à y ${y.toFixed(2)} : ${JSON.stringify(surfacesEn(px, pz))}`; break; }
      x = px; z = pz; y = s.y;
    }
    if (bloque) break;
  }
  verifier(!bloque, bloque ?? `arrivé à l'étrave (y ${y.toFixed(2)} m)`);
}
// Le vrai marin (marin.js : sa marche, ses marches, sa glissade) rentre dans le cockpit
// depuis chaque endroit du bateau, le bateau droit ou gîté (bâbord ou tribord en bas)
console.log('Rentrer dans le cockpit depuis partout, le bateau droit ou gîté');
{
  const marcher = (depart, chemin, giteDeg) => {
    const m = new Marin();
    m.placer(...depart);
    const a = (giteDeg * Math.PI) / 180;
    const pesanteur = new Vector3(-9.81 * Math.sin(a), -9.81 * Math.cos(a), 0);
    for (const [cx, cz] of chemin) {
      let tSegment = 0;
      while (Math.hypot(cx - m.position.x, cz - m.position.z) > 0.05) {
        m.lacet = Math.atan2(-(cx - m.position.x), -(cz - m.position.z));
        m.maj(1 / 60, { avance: 1, lateral: 0, tenir: false, accroupir: false }, pesanteur);
        tSegment += 1 / 60;
        if (tSegment > 8) return `bloqué en (${m.position.x.toFixed(2)}, ${m.position.y.toFixed(2)}, ${m.position.z.toFixed(2)}), zone ${m.zone}`;
      }
    }
    return m.zone === 'cockpit' && Math.abs(m.position.y - C.plancher) < 0.01 ? null : `arrivé en zone ${m.zone}`;
  };
  const retour = [...VERS_L_ETRAVE].reverse().slice(1);
  const departs = {
    'du passavant tribord': [[1.65, yPassavant, zC], [[1.2, zC], [0, zC]]],
    'du passavant bâbord': [[-1.65, yPassavant, zC], [[-1.2, zC], [0, zC]]],
    'du passavant, en biais depuis le travers de la timonerie': [[1.7, hauteurPont(0.3, 1.7), zDe(0.3)], [[0.3, zDe(0.1)]]],
    'du pont arrière': [[0, hauteurPont(0.02, 0), zDe(0.015)], [[0, zC]]],
    'du toit du rouf, par le passavant': [[0, hauteurRouf(0.5, 0), zDe(0.5)], [[0.6, zDe(0.5)], [1.65, zDe(0.47)], [1.7, zDe(0.3)], [1.65, zC], [1.2, zC], [0, zC]]],
    'du pont avant, par tribord': [[0.1, hauteurPont(0.93, 0.1), zDe(0.93)], [...retour, [0, zC]]],
    'de la timonerie, par la porte': [[0, TIMONERIE.plancher, 2.6], [[0, zC]]],
  };
  for (const gite of [0, 15, -15, 30, -30]) {
    const rates = [];
    for (const [nomDepart, [depart, chemin]] of Object.entries(departs)) {
      const r = marcher(depart, chemin, gite);
      if (r) rates.push(`${nomDepart} : ${r}`);
    }
    verifier(!rates.length, `gîte ${gite}° : ${rates.length ? rates.join(' ; ') : `on rentre depuis les ${Object.keys(departs).length} endroits`}`);
  }
}
console.log(echecs ? `\n${echecs} échec(s)` : '\nTout est bon.');
process.exit(echecs ? 1 : 0);
