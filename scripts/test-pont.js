// Vérifie le plan de pont : node scripts/test-pont.js
import { Vector3 } from 'three';
import { solEn, surfacesEn, ouvrirDescente } from '../src/joueur/pont.js';
import { Marin } from '../src/joueur/marin.js';
import { zDe, PANNEAU_PONT, TIMONERIE } from '../src/bateau/forme.js';

let echecs = 0;
const verifier = (c, m) => { console.log(`${c ? '  ✓' : '  ✗'} ${m}`); if (!c) echecs++; };
const nom = (x, z, y) => solEn(x, z, y)?.nom ?? 'rien';

console.log('Hauteurs');
verifier(Math.abs(solEn(0, zDe(0.18), 0.45).y - 0.45) < 1e-6, 'plancher du cockpit à 0,45 m');
verifier(nom(0.6, zDe(0.18), 0.45) === 'banc', 'on monte sur le banc depuis le plancher');
verifier(nom(0.88, zDe(0.18), 0.82) === 'hiloire', 'du banc, on enjambe l\'hiloire');
verifier(nom(1.2, zDe(0.18), 1.17) === 'passavant', 'puis on descend sur le passavant');
verifier(nom(0.88, zDe(0.18), 0.45) === 'rien', 'mais pas d\'un coup depuis le plancher (mur)');
verifier(nom(0.6, zDe(0.45), 0.97) === 'rouf', 'du passavant, on grimpe sur le toit du rouf');
verifier(nom(0.72, zDe(0.45), 0.97) === 'rien', 'mais pas sur son bord penché (on l\'enjambe)');
verifier(nom(0, (PANNEAU_PONT.z0 + PANNEAU_PONT.z1) / 2, 1.4) === 'rouf-panneau', 'le panneau de pont dépasse du toit');
verifier(nom(0.3, zDe(0.8), 1.05) === 'pont-avant', 'le pont avant');
verifier(nom(1.6, zDe(0.38), 0.97) === 'rien', 'les filières arrêtent au bord');
verifier(nom(0, zDe(0.6), 1.4) === 'rien', 'le mât est un obstacle');

console.log('La timonerie et l\'escalier');
verifier(nom(0, TIMONERIE.zArriere - 0.1, 0.45) === 'timonerie', 'du cockpit, on entre dans la timonerie (une marche de 10 cm)');
verifier(Math.abs(solEn(0.3, 1.2, 0.55).y - TIMONERIE.plancher) < 1e-6, 'son plancher est surélevé (0,55 m : on voit dehors)');
verifier(nom(-0.3, 0.7, 0.55) === 'marches' && nom(-0.3, 0.5, 0.27) === 'marches', 'l\'escalier descend vers l\'avant, à bâbord');
verifier(nom(-0.3, 0.3, -0.01) === 'carre', 'puis on arrive dans le carré');
verifier(nom(0.2, 0.7, 0.55) === 'timonerie', 'à côté de l\'escalier, le plancher de la timonerie');
verifier(nom(0, 0.0, -0.3) === 'carre' && nom(0, -0.7, -0.3) === 'rien', 'la table du carré est un obstacle');
verifier(nom(0.4, -0.7, -0.3) === 'carre', 'on passe à côté de la table');
verifier(nom(0, 0.7, 1.45) === 'rien', 'du toit du rouf, on ne tombe pas dans la timonerie (le pare-brise)');
verifier(nom(1.0, 0.9, 0.55) === 'rien', 'de la timonerie, on ne passe pas sur le passavant (la paroi)');
verifier(nom(0.5, 0.9, 0.97) === 'rien', 'du passavant, on n\'entre pas dans la timonerie (la paroi)');
ouvrirDescente(false);
verifier(nom(0, TIMONERIE.zArriere, 0.45) === 'rien', 'porte fermée : on ne passe pas');
// (le marin enjambe les petits vides : il ne doit pas enjamber la porte fermée)
{
  const m = new Marin();
  const pousser = (x, z, y, lacet) => {
    m.placer(x, y, z);
    m.lacet = lacet;
    for (let i = 0; i < 120; i++) m.maj(1 / 60, { avance: 1, lateral: 0 }, new Vector3(0, -9.81, 0));
    return m.position.z;
  };
  const dehors = pousser(0.05, TIMONERIE.zArriere + 0.4, 0.45, 0);
  const dedans = pousser(0, TIMONERIE.zArriere - 0.5, 0.55, Math.PI);
  const biais = pousser(0.22, TIMONERIE.zArriere + 0.4, 0.45, 0.4);
  verifier(dehors > TIMONERIE.zArriere && dedans < TIMONERIE.zArriere - 0.2 && biais > TIMONERIE.zArriere,
    `porte fermée : le marin ne la traverse ni de face ni en biais, ni du dedans (arrêté à ${((dehors - TIMONERIE.zArriere) * 100).toFixed(0)} cm dehors, ${((TIMONERIE.zArriere - dedans) * 100).toFixed(0)} cm dedans)`);
  ouvrirDescente(true);
  const ouverte = pousser(0.05, TIMONERIE.zArriere + 0.4, 0.45, 0);
  verifier(ouverte < TIMONERIE.zArriere - 0.3, 'porte ouverte : il entre tout droit');
}
ouvrirDescente(true);

console.log('Un tour du pont, du cockpit à l\'étrave par tribord, sans jamais être bloqué');
{
  let x = 0;
  let z = zDe(0.15);
  let y = 0.45;
  const chemin = [[0.6, zDe(0.15)], [0.88, zDe(0.15)], [1.15, zDe(0.15)], [1.2, zDe(0.4)], [1.0, zDe(0.62)], [0.4, zDe(0.85)], [0.1, zDe(0.92)]];
  let bloque = null;
  for (const [cx, cz] of chemin) {
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
    let t = 0;
    for (const [cx, cz] of chemin) {
      let tSegment = 0;
      while (Math.hypot(cx - m.position.x, cz - m.position.z) > 0.05) {
        m.lacet = Math.atan2(-(cx - m.position.x), -(cz - m.position.z));
        m.maj(1 / 60, { avance: 1, lateral: 0, tenir: false, accroupir: false }, pesanteur);
        t += 1 / 60;
        tSegment += 1 / 60;
        if (tSegment > 8) return `bloqué en (${m.position.x.toFixed(2)}, ${m.position.y.toFixed(2)}, ${m.position.z.toFixed(2)}), zone ${m.zone}`;
      }
    }
    return m.zone === 'cockpit' && Math.abs(m.position.y - 0.45) < 0.01 ? null : `arrivé en zone ${m.zone}`;
  };
  const zc = zDe(0.17);
  const departs = {
    'du passavant tribord': [[1.15, 0.92, zDe(0.2)], [[0, zDe(0.2)]]],
    'du passavant bâbord': [[-1.15, 0.92, zDe(0.2)], [[0, zDe(0.2)]]],
    'du passavant, en biais depuis le rouf': [[1.2, 0.92, zDe(0.4)], [[0, zDe(0.15)]]],
    'du pont arrière': [[0, 0.9, zDe(0.015)], [[0, zc]]],
    'du toit du rouf, par le passavant': [[0, 1.4, zDe(0.5)], [[0.6, -0.15], [1.15, -0.05], [1.15, zDe(0.2)], [0, zDe(0.2)]]],
    'du pont avant, par tribord': [[0.3, 1.05, zDe(0.8)], [[1.0, zDe(0.62)], [1.2, zDe(0.4)], [1.15, zDe(0.2)], [0, zDe(0.2)]]],
    'du carré, par l\'escalier et la timonerie': [[-0.3, -0.3, 0.1], [[-0.3, 0.95], [0, 1.3], [0, zc]]],
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
