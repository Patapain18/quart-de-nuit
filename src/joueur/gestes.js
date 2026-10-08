// Les gestes du bord : ce que l'on peut faire en regardant une chose et en appuyant sur E.
//
// Chaque geste a une place sur le bateau (repère du bateau) : une boule que le regard
// doit traverser, à portée de main (1,25 m des yeux au bord de la boule : le bras tendu, en
// se penchant un peu), sans rien de dur entre les yeux et elle — on n'attrape rien à travers une
// cloison, le plancher, une vitre ou la porte fermée (« soi » : les pièces de la chose
// elle-même, qui ne la cachent pas). Et une ou deux actions :
//  - E : l'action principale (border, prendre la barre, prendre un ris…)
//  - Maj + E : l'action inverse (choquer, larguer un ris…)
// Une action est soit instantanée (un appui), soit « maintenue » (tant qu'on tient la
// touche : border un winch, pomper), soit « longue » (il faut tenir un certain temps
// pour qu'elle aboutisse : prendre un ris demande 4 secondes au pied du mât).
import { Vector3 } from 'three';
import { COCKPIT, MAT, TIMONERIE, zDe, hauteurPont, hauteurRouf, hauteurLivet } from '../bateau/forme.js';
import { SIEGE, surPupitre } from '../bateau/interieur-timonerie.js';

// jeu : l'objet qui sait agir (voir jeu.js) ; interieur : pour placer radio et tableau
export function creerGestes(jeu, interieur) {
  const yHiloire = hauteurPont(0.27, COCKPIT.demiLargeur) + COCKPIT.hiloire;
  const winch = (cote) => ({
    id: cote > 0 ? 'winch-tribord' : 'winch-babord',
    point: new Vector3(cote * (COCKPIT.demiLargeur + 0.04), yHiloire + 0.1, zDe(0.27)),
    rayon: 0.2,
    soi: ['winchs', 'accastillage'],
    titre: () => `Winch ${cote > 0 ? 'tribord' : 'bâbord'} : écoute de foc`,
    principal: {
      texte: 'border', maintenir: true,
      faire: (dt) => jeu.borderFoc(cote, -dt),
    },
    secondaire: {
      texte: 'choquer', maintenir: true,
      faire: (dt) => jeu.borderFoc(cote, dt),
    },
  });
  return [
    {
      id: 'barre',
      point: new Vector3(0, 1.0, 2.47),
      rayon: 0.32,
      soi: ['accastillage', 'instruments'],
      titre: () => 'La barre',
      principal: { texte: 'prendre la barre', faire: () => jeu.prendreBarre() },
    },
    winch(1),
    winch(-1),
    {
      id: 'ecoute-gv',
      point: new Vector3(0, hauteurPont(0.03, 0) + 0.12, zDe(0.03)),
      rayon: 0.3,
      soi: ['accastillage', 'winchs'],
      titre: () => 'Écoute de grand-voile',
      principal: { texte: 'border', maintenir: true, faire: (dt) => jeu.borderGrandVoile(-dt) },
      secondaire: { texte: 'choquer', maintenir: true, faire: (dt) => jeu.borderGrandVoile(dt) },
    },
    {
      id: 'enrouleur',
      point: new Vector3(COCKPIT.demiLargeur + 0.04, hauteurPont(0.302, COCKPIT.demiLargeur) + COCKPIT.hiloire + 0.12, zDe(0.302)),
      rayon: 0.2,
      soi: ['accastillage', 'winchs'],
      titre: () => 'Bosse d\'enrouleur (le foc)',
      principal: { texte: 'enrouler le foc', maintenir: true, faire: (dt) => jeu.enrouler(-dt) },
      secondaire: { texte: 'dérouler', maintenir: true, faire: (dt) => jeu.enrouler(dt) },
    },
    {
      id: 'mat',
      point: new Vector3(0, hauteurRouf(MAT.u, 0) + 0.55, zDe(MAT.u) + 0.12),
      rayon: 0.35,
      soi: ['mat', 'accastillage', 'voilier'],
      titre: () => 'Pied de mât : les bosses de ris, la drisse de grand-voile',
      // après deux ris, on peut encore affaler la grand-voile (la descendre entièrement et
      // la ferler sur la bôme) : par très gros temps, on fuit sous un bout de foc
      principal: {
        texte: () => (jeu.physique.ris >= 2 ? 'affaler la grand-voile' : 'prendre un ris'),
        duree: 4,
        possible: () => jeu.autorise('ris') && (jeu.physique.ris < 2 || (jeu.physique.ris === 2 && jeu.autorise('affaler'))),
        refus: () => (!jeu.autorise('ris') ? 'Jos te montrera comment prendre un ris cet après-midi'
          : jeu.physique.ris >= 3 ? 'La grand-voile est déjà affalée'
            : 'Deux ris : la grand-voile est au plus petit. (On ne l\'affale que dans la tempête)'),
        faire: () => jeu.prendreRis(1),
      },
      secondaire: {
        texte: () => (jeu.physique.ris >= 3 ? 'rehisser la grand-voile (2 ris)' : 'larguer un ris'),
        duree: 3,
        possible: () => jeu.physique.ris > 0 && !(jeu.physique.ris >= 3 && jeu.physique.grandVoileDechiree),
        refus: () => (jeu.physique.grandVoileDechiree ? 'La grand-voile est déchirée : elle reste affalée' : 'Pas de ris à larguer'),
        faire: () => jeu.prendreRis(-1),
      },
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
      principal: { texte: 'écouter la météo', faire: () => jeu.ecouterMeteo() },
      // pendant la journée et la nuit, on appelle Jos ; quand un cargo arrive sur nous, on
      // l'appelle, lui, sur le canal 16
      secondaire: {
        texte: () => (jeu.nuit?.cargo?.etat === 'route' ? 'appeler le cargo (canal 16)' : jeu.journee || jeu.nuit ? 'appeler Jos' : 'appeler'),
        faire: () => (jeu.journee || jeu.nuit ? jeu.appelerJos() : jeu.radio.appeler()),
      },
    },
    {
      // le baromètre : on tapote le verre (l'aiguille colle un peu), et on cale l'aiguille
      // témoin sur la noire — plus tard, on verra de combien elle a bougé
      id: 'barometre',
      point: interieur.positionBarometre.clone(),
      rayon: 0.08,
      soi: ['inox', 'sans-nom', 'barometre'],
      titre: () => jeu.titreBarometre(),
      principal: { texte: 'tapoter le verre, caler l\'aiguille témoin', faire: () => jeu.lireBarometre() },
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
      secondaire: { texte: 'éclairage du carré', faire: () => jeu.basculerEclairage() },
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
