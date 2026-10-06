// Les essais de marche : un marin automatique fait le tour du bord dans le vrai jeu (le
// bateau qui bouge, la bôme, la barre, les vraies images), va à chaque chose que l'on
// peut manier, la regarde, et vérifie que le geste est proposé.
//
// À chaque image, il mesure aussi ce que le joueur verrait de travers :
//  - la caméra trop près d'une paroi (moins de 6 cm : l'écran montrerait l'envers du décor) ;
//  - un saut des yeux (plus de 12 cm d'une image à l'autre : un « téléport ») ;
//  - un blocage (il n'avance plus pendant une seconde alors qu'il marche).
// (Outil de mise au point : window.__jeu.essayerLaMarche() dans le jeu.)
import { zDe } from '../bateau/forme.js';

// Les tournées : des points de passage (x, z dans le repère du bateau), puis la chose à regarder
function tournees(interieur) {
  const radio = interieur.positionRadio;
  const tableau = interieur.positionTableau;
  const cire = interieur.positionCire;
  return [
    { nom: 'le winch tribord', chemin: [[0.32, zDe(0.25)]], geste: 'winch-tribord' },
    { nom: 'le winch bâbord', chemin: [[-0.32, zDe(0.25)]], geste: 'winch-babord' },
    { nom: 'la pompe de cale', chemin: [[-0.2, zDe(0.12)]], geste: 'pompe' },
    { nom: 'l\'écoute de grand-voile', chemin: [[0.25, zDe(0.09)]], geste: 'ecoute-gv' },
    { nom: 'la porte de la timonerie', chemin: [[0, zDe(0.24)]], geste: 'descente' },
    {
      nom: 'le pied de mât, par tribord',
      chemin: [[0.6, zDe(0.2)], [1.12, zDe(0.2)], [1.15, zDe(0.42)], [0.95, zDe(0.58)]],
      geste: 'mat',
    },
    { nom: 'le pied de l\'étai', chemin: [[1.0, zDe(0.68)], [0.35, zDe(0.88)]], geste: 'etai' },
    {
      nom: 'retour au cockpit par bâbord',
      chemin: [[-0.95, zDe(0.68)], [-1.15, zDe(0.45)], [-1.12, zDe(0.2)], [-0.25, zDe(0.2)]],
      geste: null,
    },
    // la timonerie : on entre par la porte, on va à la radio, au tableau, au radar, au poste
    { nom: 'la radio, dans la timonerie', chemin: [[0, zDe(0.27)], [-0.12, 1.25], [-0.15, 1.0]], geste: 'radio' },
    { nom: 'le tableau électrique', chemin: [[-0.1, 1.3]], geste: 'tableau' },
    { nom: 'le radar et le traceur', chemin: [[-0.15, 1.0]], geste: 'traceur' },
    { nom: 'le pilote, au poste', chemin: [[-0.15, 0.98]], geste: 'poste' },
    { nom: 'le siège de quart', chemin: [[-0.15, 1.1]], geste: 'siege' },
    // en bas : l'escalier (à bâbord), le ciré au pied de l'escalier, le carré
    { nom: 'descendre au carré', chemin: [[-0.18, 1.0], [-0.3, 0.88], [-0.3, 0.3], [-0.3, 0.0], [0.39, -0.25], [0.39, -1.05]], geste: null },
    { nom: 'le ciré, au pied de l\'escalier', chemin: [[0.39, -0.2], [0.1, 0.0]], geste: 'cire' },
    {
      nom: 'remonter, et prendre la barre',
      chemin: [[-0.3, 0.0], [-0.3, 0.3], [-0.3, 0.6], [-0.25, 0.95], [-0.1, 1.3], [0, zDe(0.24)], [0.3, zDe(0.15)]],
      geste: 'barre',
    },
  ];
}

// ctx : ce que le jeu prête (voir jeu.js)
export async function essayerLaMarche(ctx, { dt = 1 / 60 } = {}) {
  const { marin, gestes, gesteVise, uneImage, commandes, seLever, bateau, regarder } = ctx;
  const g = marin.encombrement;
  if (!bateau.descenteOuverte) ctx.basculerDescente();
  seLever();
  const resultats = [];
  for (const t of tournees(bateau.interieur)) {
    const r = { nom: t.nom, ok: true, secondes: 0, cameraMin: Infinity, ou: '', sautMax: 0, remarque: '' };
    let yeuxAvant = null;
    let hauteurAvant = marin.hauteurYeux();
    for (const [cx, cz] of t.chemin) {
      let immobile = 0;
      let tSegment = 0;
      commandes.enfoncees.add('KeyW');
      try {
        while (Math.hypot(cx - marin.position.x, cz - marin.position.z) > 0.08) {
          marin.lacet = Math.atan2(-(cx - marin.position.x), -(cz - marin.position.z));
          const avant = marin.position.clone();
          uneImage(dt);
          r.secondes += dt;
          tSegment += dt;
          // ce que voit la caméra
          const yeux = marin.position.y + marin.hauteurYeux();
          const d = g.distance(marin.position.x, yeux, marin.position.z, 0.3);
          if (d < r.cameraMin) { r.cameraMin = d; r.ou = `${g.dernierePiece ?? '—'} en (${marin.position.x.toFixed(2)}, ${yeux.toFixed(2)}, ${marin.position.z.toFixed(2)})`; }
          if (yeuxAvant !== null && Math.abs(yeux - yeuxAvant) > r.sautMax) {
            r.sautMax = Math.abs(yeux - yeuxAvant);
            r.saut = `pieds ${((marin.position.y - avant.y) * 100).toFixed(0)} cm, tête ${((marin.hauteurYeux() - hauteurAvant) * 100).toFixed(0)} cm, zone ${marin.zone} en (${marin.position.x.toFixed(2)}, ${marin.position.z.toFixed(2)})`;
          }
          yeuxAvant = yeux;
          hauteurAvant = marin.hauteurYeux();
          immobile = avant.distanceTo(marin.position) < 0.002 ? immobile + dt : 0;
          if (immobile > 1 || tSegment > 15) {
            r.ok = false;
            r.remarque = `bloqué en (${marin.position.x.toFixed(2)}, ${marin.position.y.toFixed(2)}, ${marin.position.z.toFixed(2)}), zone ${marin.zone}, en allant vers (${cx.toFixed(2)}, ${cz.toFixed(2)})`;
            break;
          }
          if (Math.round(r.secondes / dt) % 20 === 0) await new Promise((f) => setTimeout(f, 0));
        }
      } finally {
        commandes.enfoncees.delete('KeyW');
      }
      if (!r.ok) break;
    }
    // il regarde la chose : le geste est-il proposé ?
    if (r.ok && t.geste) {
      const cible = gestes.find((x) => x.id === t.geste);
      const monde = cible.point.clone().applyMatrix4(bateau.groupe.matrixWorld);
      regarder(monde.x, monde.y, monde.z);
      for (let i = 0; i < 6; i++) uneImage(dt);
      const oeil = marin.position.clone();
      oeil.y += marin.hauteurYeux();
      const vu = gesteVise(gestes, oeil, marin.direction());
      if (vu?.id !== t.geste) {
        r.ok = false;
        r.remarque = `en regardant ${t.geste} (à ${oeil.distanceTo(cible.point).toFixed(2)} m), le jeu propose : ${vu?.id ?? 'rien'}`;
      }
    }
    if (r.ok && r.cameraMin < 0.06) { r.ok = false; r.remarque = `la caméra frôle une paroi (${(r.cameraMin * 100).toFixed(0)} cm : ${r.ou})`; }
    if (r.ok && r.sautMax > 0.12) { r.ok = false; r.remarque = `les yeux sautent de ${(r.sautMax * 100).toFixed(0)} cm d'une image à l'autre (${r.saut})`; }
    resultats.push(r);
  }
  return resultats.map((r) => `${r.ok ? '✓' : '✗'} ${r.nom} : ${r.secondes.toFixed(1)} s, caméra à ${(Math.min(r.cameraMin, 0.3) * 100).toFixed(0)} cm des parois au plus près, saut des yeux ${(r.sautMax * 100).toFixed(0)} cm${r.sautMax > 0.06 && r.ok ? ` (${r.saut})` : ''}${r.remarque ? ` — ${r.remarque}` : ''}`);
}
