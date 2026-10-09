// Les essais de marche : un marin automatique fait le tour du bord dans le vrai jeu (le
// bateau qui bouge, la bôme, les vraies images), va à chaque chose que l'on peut manier, la
// regarde, et vérifie que le geste est proposé.
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
    { nom: 'la pompe de cale', chemin: [[-0.2, zDe(0.12)]], geste: 'pompe' },
    { nom: 'la bosse d\'enrouleur', chemin: [[0.32, zDe(0.28)]], geste: 'enrouleur' },
    { nom: 'la porte de la timonerie', chemin: [[0, zDe(0.24)]], geste: 'descente' },
    {
      nom: 'le pied de l\'étai, par tribord',
      chemin: [[0.6, zDe(0.2)], [1.12, zDe(0.2)], [1.15, zDe(0.42)], [1.0, zDe(0.68)], [0.35, zDe(0.88)], [0.12, zDe(0.93)]],
      geste: 'etai',
    },
    {
      nom: 'retour au cockpit par bâbord',
      chemin: [[-0.35, zDe(0.88)], [-0.95, zDe(0.68)], [-1.15, zDe(0.45)], [-1.12, zDe(0.2)], [-0.25, zDe(0.2)]],
      geste: null,
    },
    // la timonerie : on entre par la porte, on va à la radio, au tableau, au radar, au poste
    { nom: 'la radio, dans la timonerie', chemin: [[0, zDe(0.27)], [-0.12, 1.25], [-0.15, 1.0]], geste: 'radio' },
    { nom: 'le tableau électrique (sur la console)', chemin: [[-0.05, 0.85]], geste: 'tableau' },
    { nom: 'le radar et le traceur', chemin: [[-0.15, 1.0]], geste: 'traceur' },
    { nom: 'le pilote, au poste', chemin: [[-0.15, 0.98]], geste: 'poste' },
    { nom: 'le siège de quart', chemin: [[-0.15, 1.1]], geste: 'siege' },
    // en bas : l'escalier (à bâbord), le ciré au pied de l'escalier, le carré
    { nom: 'descendre au carré', chemin: [[-0.18, 1.0], [-0.3, 0.88], [-0.3, 0.3], [-0.3, 0.0], [0.39, -0.25], [0.39, -1.05]], geste: null },
    { nom: 'le ciré, au pied de l\'escalier', chemin: [[0.39, -0.2], [0.1, 0.0]], geste: 'cire' },
    {
      nom: 'remonter, et ressortir dans le cockpit',
      chemin: [[-0.3, 0.0], [-0.3, 0.3], [-0.3, 0.6], [-0.25, 0.95], [-0.1, 1.3], [0, zDe(0.24)], [-0.2, zDe(0.12)]],
      geste: 'pompe',
    },
  ];
}

// ctx : ce que le jeu prête (voir quart.js)
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
      const vu = gesteVise(gestes, oeil, marin.direction(), { encombrement: g, obstacle: ctx.obstacle });
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

// Les essais d'entrée : un joueur ne marche pas sur des rails. Il vise à peu près un
// point de l'autre côté d'une porte (ou de l'escalier), garde Z enfoncé et tourne la tête
// vers ce point à chaque image — rien de plus. On le lâche de plusieurs endroits, en
// visant un peu à gauche, au milieu, un peu à droite, et l'on compte ceux qui passent.
// Chaque essai : { nom, depart: [x, z], vise: [x, z], arrivee: (marin) => bool }
export function essaisEntree(ZP) {
  const essais = [];
  const dedans = (m) => m.position.z < ZP - 0.4 && m.position.y > 0.5;
  // du cockpit vers la timonerie : depuis la barre, le banc, les winchs
  for (const [nom, depart] of [['de la barre', [0, 2.35]], ['du banc tribord', [0.32, 2.0]], ['du banc bâbord', [-0.32, 2.0]], ['du winch tribord', [0.36, 1.75]], ['du winch bâbord', [-0.36, 1.75]]]) {
    // (à gauche du passage, au milieu, et devant le siège : là où l'on va vraiment)
    for (const [xv, zv] of [[-0.2, 0.95], [0, 0.95], [0.08, 0.7]]) essais.push({ nom: `entrer ${nom}, visant (${xv}, ${zv})`, depart, vise: [xv, zv], arrivee: dedans });
  }
  // de la timonerie vers le cockpit : du siège, du haut de l'escalier, de la cuisine
  const dehors = (m) => m.position.z > ZP + 0.35;
  for (const [nom, depart] of [['du siège', [0.05, 0.82]], ['du haut de l\'escalier', [-0.3, 0.95]], ['du milieu', [0, 1.05]]]) {
    for (const xv of [-0.25, 0, 0.25]) essais.push({ nom: `sortir ${nom}, visant ${xv}`, depart, vise: [xv, 2.3], arrivee: dehors });
  }
  // de la timonerie vers le carré (l'escalier), et du carré vers la timonerie
  const enBas = (m) => m.position.y < 0 && m.position.z < 0.2;
  for (const depart of [[0, 1.3], [0.05, 0.9], [-0.15, 1.3]]) essais.push({ nom: `descendre au carré depuis (${depart})`, depart, vise: [-0.3, -0.3], arrivee: enBas });
  const enHaut = (m) => m.position.y > 0.5 && m.position.z > 0.95;
  for (const depart of [[0.35, -0.6], [-0.3, -0.2], [0.3, -0.3]]) essais.push({ nom: `monter à la timonerie depuis (${depart})`, depart, vise: [-0.25, 1.3], arrivee: enHaut });
  return essais;
}

export async function essayerLesEntrees(ctx, { dt = 1 / 60, tMax = 7, essais } = {}) {
  const { marin, uneImage, commandes, seLever, bateau } = ctx;
  if (!bateau.descenteOuverte) ctx.basculerDescente();
  const resultats = [];
  for (const e of essais) {
    seLever();
    const yDepart = e.depart[1] < 0.2 ? -0.3 : e.depart[1] < 1.48 ? 0.55 : 0.45;
    marin.placer(e.depart[0], yDepart + 0.05, e.depart[1]);
    uneImage(dt);
    const points = [[marin.position.x, marin.position.z]];
    let t = 0;
    let bloque = 0;
    let pireBlocage = 0;
    let ok = false;
    commandes.enfoncees.add('KeyW');
    try {
      while (t < tMax) {
        const p = marin.position;
        marin.lacet = Math.atan2(-(e.vise[0] - p.x), -(e.vise[1] - p.z));
        marin.site = -0.15;
        const avant = p.clone();
        uneImage(dt);
        t += dt;
        bloque = avant.distanceTo(marin.position) < 0.15 * dt ? bloque + dt : 0;
        pireBlocage = Math.max(pireBlocage, bloque);
        if (Math.round(t / dt) % 6 === 0) points.push([marin.position.x, marin.position.z]);
        if (e.arrivee(marin)) { ok = true; break; }
        if (Math.round(t / dt) % 30 === 0) await new Promise((f) => setTimeout(f, 0));
      }
    } finally {
      commandes.enfoncees.delete('KeyW');
    }
    points.push([marin.position.x, marin.position.z]);
    resultats.push({ nom: e.nom, ok, secondes: t, pireBlocage, points, fin: [marin.position.x, marin.position.y, marin.position.z], zone: marin.zone });
  }
  return resultats;
}

// D'où atteint-on chaque chose ? On se tient debout (et accroupi) partout où le corps
// tient, tous les 10 cm, on regarde la chose, et l'on note dans quelle zone on était
// quand le jeu l'a proposée. (Le ciré ne doit pas s'attraper depuis la timonerie, ni le
// tableau depuis le cockpit…) Renvoie, pour chaque geste, le nombre de places par zone, et
// la place la plus lointaine (des yeux au point de la chose).
export function carteDesGestes({ marin, gestes, gesteVise, obstacle, surfacesEn }, { pas = 0.1 } = {}) {
  const g = marin.encombrement;
  const resultat = Object.fromEntries(gestes.map((x) => [x.id, { zones: {}, plusLoin: 0 }]));
  const oeil = { x: 0, y: 0, z: 0 };
  const dir = { x: 0, y: 0, z: 0 };
  const _o = new (gestes[0].point.constructor)();
  const _d = new (gestes[0].point.constructor)();
  for (let z = -5.2; z <= 5.4; z += pas) {
    for (let x = -1.6; x <= 1.6; x += pas) {
      for (const s of surfacesEn(x, z)) {
        for (const hYeux of [1.62, 1.1]) {
          const h = Math.min(hYeux, marin.yeuxEn(x, z, s.y));
          if (marin.degagement(x, z, s.y, h) < 0.75) continue;
          oeil.x = x; oeil.y = s.y + h; oeil.z = z;
          _o.set(oeil.x, oeil.y, oeil.z);
          for (const geste of gestes) {
            _d.subVectors(geste.point, _o);
            const d = _d.length();
            if (d > 3) continue;
            _d.divideScalar(d);
            dir.x = _d.x; dir.y = _d.y; dir.z = _d.z;
            const vu = gesteVise(gestes, _o, _d, { encombrement: g, obstacle });
            if (vu !== geste) continue;
            const r = resultat[geste.id];
            r.zones[s.nom] = (r.zones[s.nom] ?? 0) + 1;
            if (d > r.plusLoin) { r.plusLoin = d; r.depuis = `${s.nom} (${x.toFixed(1)}, ${z.toFixed(1)})`; }
          }
        }
      }
    }
  }
  return resultat;
}
