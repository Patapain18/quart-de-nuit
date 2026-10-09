// Les gestes du bord : ce que l'on peut faire en regardant une chose et en appuyant sur E.
//
// Chaque geste a une place sur le bateau (repère du bateau) : une boule que le regard
// doit traverser, à portée de main (1,25 m des yeux au bord de la boule : le bras tendu, en
// se penchant un peu), sans rien de dur entre les yeux et elle — on n'attrape rien à travers une
// cloison, le plancher, une vitre ou la porte fermée (« soi » : les pièces de la chose
// elle-même, qui ne la cachent pas). Et une ou deux actions :
//  - E : l'action principale (pomper, réarmer le pilote, fermer la porte…)
//  - Maj + E : l'action inverse, ou une autre (l'éclairage, au tableau…)
// Une action est soit instantanée (un appui), soit « maintenue » (tant qu'on tient la
// touche : pomper, rouler le foc), soit « longue » (il faut tenir un certain temps pour
// qu'elle aboutisse : passer une nouvelle écoute de foc demande 6 secondes, tout à l'avant).
import { Vector3 } from 'three';
import { COCKPIT, TIMONERIE, zDe, hauteurPont, hauteurLivet } from '../bateau/forme.js';
import { SIEGE, surPupitre } from '../bateau/interieur-timonerie.js';

// jeu : l'objet qui sait agir (voir quart.js) ; interieur : pour placer radio et tableau
export function creerGestes(jeu, interieur) {
  return [
    {
      id: 'enrouleur',
      point: new Vector3(COCKPIT.demiLargeur + 0.04, hauteurPont(0.302, COCKPIT.demiLargeur) + COCKPIT.hiloire + 0.12, zDe(0.302)),
      rayon: 0.2,
      soi: ['accastillage', 'winchs'],
      titre: () => 'Bosse d\'enrouleur (le foc)',
      principal: { texte: 'rouler le foc', maintenir: true, faire: (dt) => jeu.enrouler(-dt) },
    },
    {
      // tout à l'avant, au pied de l'étai : le tambour de l'enrouleur et le point d'écoute
      // du foc roulé (pour passer une nouvelle écoute quand elle a cassé)
      id: 'etai',
      point: new Vector3(0, hauteurLivet(0.965) + 0.3, zDe(0.965)),
      rayon: 0.3,
      soi: ['accastillage', 'balcons', 'voilier'],
      titre: () => 'Pied de l\'étai : l\'enrouleur du foc',
      principal: {
        texte: 'passer une nouvelle écoute de foc',
        duree: 6,
        possible: () => jeu.nuit?.avaries.ecouteFoc === 'cassee' && jeu.physique.deroule < 0.05 && jeu.marin.attache,
        refus: () => (jeu.nuit?.avaries.ecouteFoc !== 'cassee' ? 'L\'écoute de foc est en bon état'
          : jeu.physique.deroule >= 0.05 ? 'Roule d\'abord le foc entièrement : il bat trop pour l\'attraper'
            : 'Accroche d\'abord ton harnais (X) : tout à l\'avant, une vague t\'emporterait'),
        faire: () => jeu.reparer('ecouteFoc'),
      },
    },
    {
      // la porte coulissante de la timonerie (on l'atteint des deux côtés)
      id: 'descente',
      point: new Vector3(0, 1.35, TIMONERIE.zArriere),
      rayon: 0.34,
      soi: ['timonerie', 'lambris-timonerie', 'timonerie-mains-courantes', 'timonerie-joints'],
      titre: () => 'La porte de la timonerie',
      principal: { texte: () => (jeu.bateau.descenteOuverte ? 'fermer la porte' : 'ouvrir la porte'), faire: () => jeu.basculerDescente() },
    },
    {
      // le poste de pilotage : on s'assied, et l'on règle le cap du pilote automatique
      id: 'poste',
      point: surPupitre(0.08, 0.14).position,
      rayon: 0.13,
      soi: ['noir', 'sans-nom', 'instruments'],
      titre: () => 'Le poste de pilotage : la commande du pilote',
      principal: { texte: 't\'asseoir au poste (barrer au pilote)', faire: () => jeu.allerAuPoste() },
    },
    {
      id: 'siege',
      point: new Vector3(SIEGE.x, SIEGE.assise + 0.1, SIEGE.z),
      rayon: 0.25,
      soi: ['coussins-timonerie', 'inox'],
      titre: () => 'Le siège de quart',
      principal: { texte: 't\'asseoir au poste (barrer au pilote)', faire: () => jeu.allerAuPoste() },
    },
    {
      id: 'pompe',
      point: new Vector3(-COCKPIT.demiLargeurPuits, COCKPIT.plancher + 0.25, zDe(0.12)),
      rayon: 0.25,
      soi: ['accastillage'],
      titre: () => 'Pompe de cale',
      principal: { texte: 'pomper', maintenir: true, faire: (dt) => jeu.pomper(dt) },
    },
    {
      id: 'radio',
      point: interieur.positionRadio.clone(),
      rayon: 0.13,
      soi: ['noir', 'sans-nom'],
      titre: () => `Radio VHF (canal ${jeu.radio.canal})`,
      principal: { texte: 'écouter', faire: () => jeu.ecouterMeteo() },
      // (on appelle sur le 16, le canal de détresse : personne ne répond)
      secondaire: { texte: 'appeler', faire: () => jeu.appelerJos() },
    },
    {
      // le baromètre : on tapote le verre (l'aiguille colle un peu)
      id: 'barometre',
      point: interieur.positionBarometre.clone(),
      rayon: 0.08,
      soi: ['inox', 'sans-nom', 'barometre'],
      titre: () => jeu.titreBarometre(),
      principal: { texte: 'tapoter le verre', faire: () => jeu.lireBarometre() },
    },
    {
      id: 'cire',
      point: interieur.positionCire.clone(),
      rayon: 0.3,
      soi: ['cire-et-gilet'],
      titre: () => 'Ton ciré et ton gilet de sauvetage',
      principal: { texte: () => (jeu.etat.gilet ? 'les ôter' : 'les enfiler'), faire: () => jeu.basculerGilet() },
    },
    // le radar : l'écran de la console de la timonerie, et son répétiteur dans le cockpit
    ...[['radar', jeu.bateau.radar.positionPrincipal, 0.13, 'Radar (timonerie)'], ['radar-cockpit', jeu.bateau.radar.positionRepetiteur, 0.12, 'Radar (répétiteur du cockpit)']]
      .map(([id, point, rayon, nom]) => ({
        id,
        point: point.clone(),
        rayon,
        soi: ['noir', 'sans-nom', 'instruments'],
        titre: () => `${nom} : ${String(jeu.bateau.radar.milles).replace('.', ',')} milles`,
        principal: { texte: 'changer de portée', faire: () => jeu.radarPortee() },
        secondaire: { texte: () => (jeu.bateau.radar.filtreMer ? 'couper le filtre de mer' : 'remettre le filtre de mer'), faire: () => jeu.radarFiltre() },
      })),
    {
      // le traceur de cartes : on change l'échelle de la carte
      id: 'traceur',
      point: jeu.bateau.electronique.positionTraceur.clone(),
      rayon: 0.12,
      soi: ['noir', 'sans-nom'],
      titre: () => `Traceur de cartes : ${String(jeu.bateau.electronique.milles).replace('.', ',')} milles`,
      principal: { texte: 'agrandir la carte', faire: () => jeu.zoomTraceur(-1) },
      secondaire: { texte: 'voir plus loin', faire: () => jeu.zoomTraceur(1) },
    },
    {
      id: 'tableau',
      point: interieur.positionTableau.clone(),
      rayon: 0.1,
      soi: ['noir', 'sans-nom', 'tableau-electrique'],
      titre: () => 'Tableau électrique',
      // (le pilote en panne : son disjoncteur a sauté, on le réarme ici)
      principal: {
        texte: () => (jeu.nuit?.avaries.pilote === 'panne' ? 'réarmer le disjoncteur du pilote'
          : jeu.etat.feux ? 'éteindre les feux de navigation' : 'allumer les feux de navigation'),
        faire: () => (jeu.nuit?.avaries.pilote === 'panne' ? jeu.reparer('pilote') : jeu.basculerFeux()),
      },
      secondaire: { texte: 'éclairage', faire: () => jeu.basculerEclairage() },
    },
  ];
}

// Le geste que l'on regarde : parmi les boules que traverse le regard, à portée de main,
// la première atteinte (quand deux boules se recouvrent, la plus centrée sur le regard, si
// elle est presque aussi près) — et rien de dur entre les yeux et elle.
//   encombrement : ce qui est dur à bord (encombrement.js) ; obstacle(oeil, direction, t) :
//   ce qui n'y est pas (les pièces qui bougent : la porte fermée), true s'il cache la chose
export const PORTEE = 1.25;
const _v = new Vector3();
export function gesteVise(gestes, oeil, direction, { portee = PORTEE, encombrement = null, obstacle = null } = {}) {
  const candidats = [];
  for (const g of gestes) {
    _v.subVectors(g.point, oeil);
    const t = _v.dot(direction);
    if (t < 0.05) continue;
    const ecart = _v.addScaledVector(direction, -t).length();
    if (ecart >= g.rayon) continue;
    // (où le regard entre dans la boule)
    const entree = Math.max(0.02, t - Math.sqrt(g.rayon * g.rayon - ecart * ecart));
    if (entree > portee) continue;
    candidats.push({ g, entree, centre: ecart / g.rayon });
  }
  if (!candidats.length) return null;
  candidats.sort((a, b) => a.entree - b.entree);
  // (l'ordre de préférence : la plus proche, sauf une autre presque aussi proche et mieux visée)
  const ordre = [];
  const restants = [...candidats];
  while (restants.length) {
    let choix = 0;
    for (let k = 1; k < restants.length; k++) {
      if (restants[k].entree < restants[0].entree + 0.2 && restants[k].centre < restants[choix].centre) choix = k;
    }
    ordre.push(restants.splice(choix, 1)[0]);
  }
  for (const c of ordre) {
    const jusque = c.entree - 0.02;
    if (encombrement && jusque > 0) {
      const soi = (c.g._soi ??= new Set(c.g.soi ?? []));
      if (encombrement.rayon(oeil, direction, jusque, soi) < jusque) continue;
    }
    if (obstacle?.(oeil, direction, c.entree, c.g)) continue;
    return c.g;
  }
  return null;
}
