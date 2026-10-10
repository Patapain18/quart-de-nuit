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
// (« dedans » : un geste qu'on ne fait que de l'intérieur de la timonerie)
import { Vector3 } from 'three';
import { COCKPIT, TIMONERIE, zDe, hauteurPont, hauteurLivet } from '../bateau/forme.js';
import { SIEGE, surPupitre } from '../bateau/interieur-timonerie.js';
import { UW_ENROULEUR } from '../bateau/modele.js';
import { NOMS_DISJONCTEURS } from '../quart/systemes.js';

// (un appareil électrique : sans courant, ou son disjoncteur coupé, il ne fait rien)
const sousTension = (jeu, nom, appareil) => ({
  possible: () => !jeu.nuit || jeu.nuit.systemes.alimente(nom),
  refus: () => (jeu.nuit?.systemes.courant ? `${appareil} : son disjoncteur est coupé, au tableau` : `${appareil} : plus de courant`),
});
const NOMS_COTES = { avant: 'à l\'avant', tribord: 'à tribord', babord: 'à bâbord', arriere: 'à l\'arrière' };

// jeu : l'objet qui sait agir (voir quart.js) ; interieur : pour placer la radio, le
// tableau, la pompe, la trappe et les volets
export function creerGestes(jeu, interieur) {
  return [
    {
      // la bosse d'enrouleur du foc, sur son winch, au bout avant de l'hiloire tribord
      id: 'enrouleur',
      point: new Vector3(COCKPIT.demiLargeur + 0.04, hauteurPont(UW_ENROULEUR, COCKPIT.demiLargeur) + COCKPIT.hiloire + 0.12, zDe(UW_ENROULEUR)),
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
      point: new Vector3(0, TIMONERIE.plancher + 0.85, TIMONERIE.zArriere),
      rayon: 0.4,
      soi: ['timonerie', 'lambris-timonerie', 'timonerie-mains-courantes', 'timonerie-joints'],
      titre: () => 'La porte de la timonerie',
      principal: { texte: () => (jeu.bateau.descenteOuverte ? 'fermer la porte' : 'ouvrir la porte'), faire: () => jeu.basculerDescente() },
    },
    {
      // la commande du pilote, au milieu du pupitre : on le met en veille (il refroidit, mais
      // plus personne ne tient la barre) ou on l'enclenche
      id: 'pilote',
      point: surPupitre(0, 0.2).position,
      rayon: 0.08,
      dedans: true,
      soi: ['noir', 'sans-nom', 'instruments'],
      titre: () => {
        const sy = jeu.nuit?.systemes;
        return sy ? `Le pilote automatique (moteur à ${Math.round(sy.pilote.temperature * 100)} %)` : 'Le pilote automatique';
      },
      principal: {
        texte: () => (jeu.nuit?.systemes.pilote.engage === false ? 'l\'enclencher' : 'le mettre en veille'),
        possible: () => !!jeu.nuit,
        faire: () => jeu.basculerPilote(),
      },
    },
    {
      // le bouton du moteur, sur son tableau, à gauche du pupitre
      id: 'moteur',
      point: interieur.positionMoteur.clone(),
      rayon: 0.05,
      dedans: true,
      soi: ['tableau-moteur', 'noir', 'sans-nom'],
      titre: () => {
        const m = jeu.nuit?.systemes.moteur;
        return m ? `Le moteur (${m.etat === 'marche' ? 'en marche' : m.etat === 'lancement' ? 'il démarre' : 'arrêté'}, ${Math.round(20 + 90 * m.temperature)} °C)` : 'Le moteur';
      },
      principal: {
        texte: () => (jeu.nuit?.systemes.moteur.etat === 'arrete' ? 'démarrer' : 'arrêter'),
        possible: () => !!jeu.nuit,
        faire: () => jeu.basculerMoteur(),
      },
    },
    // les disjoncteurs du tableau électrique, un par un
    ...Object.entries(interieur.tableau.positionsDisjoncteurs).map(([nom, point]) => ({
      id: `disjoncteur-${nom}`,
      point: point.clone(),
      rayon: 0.021,
      dedans: true,
      soi: ['tableau-electrique', 'noir', 'sans-nom'],
      titre: () => {
        const sy = jeu.nuit?.systemes;
        const etat = !sy ? '' : nom === 'pilote' && sy.pilote.disjoncte ? ' (sauté)' : sy.disjoncteurs[nom] ? '' : ' (coupé)';
        return `Disjoncteur : ${NOMS_DISJONCTEURS[nom]}${etat}`;
      },
      principal: {
        texte: () => {
          const sy = jeu.nuit?.systemes;
          if (nom === 'pilote' && sy?.pilote.disjoncte) return 'le réarmer';
          return sy?.disjoncteurs[nom] === false ? 'le remettre' : 'le couper';
        },
        possible: () => !!jeu.nuit,
        faire: () => jeu.basculerDisjoncteur(nom),
      },
      ...(nom === 'eclairage' ? { secondaire: { texte: () => (jeu.etat.eclairage === 'rouge' ? 'passer en blanc' : jeu.etat.eclairage === 'blanc' ? 'éteindre' : 'passer en rouge'), faire: () => jeu.basculerEclairage() } } : {}),
    })),
    {
      // le coupe-batterie, sur la paroi bâbord, derrière la pompe : l'eau des batteries le fait
      // sauter ; on le réarme une fois l'eau redescendue
      id: 'coupe-batterie',
      point: interieur.positionCoupeBatterie.clone(),
      rayon: 0.09,
      dedans: true,
      soi: ['coupe-batterie', 'noir', 'lambris-timonerie'],
      titre: () => (jeu.nuit?.systemes.batterie.coupee ? 'Le coupe-batterie : il a sauté !' : 'Le coupe-batterie (le courant passe)'),
      principal: {
        texte: 'le réarmer',
        possible: () => !!jeu.nuit?.systemes.batterie.coupee,
        refus: () => 'Le courant passe : le coupe-batterie est en place',
        faire: () => jeu.rearmerBatterie(),
      },
    },
    {
      id: 'siege',
      point: new Vector3(SIEGE.x, SIEGE.assise + 0.1, SIEGE.z),
      rayon: 0.3,
      soi: ['coussins-timonerie', 'inox'],
      titre: () => 'Le siège de quart',
      principal: { texte: 't\'asseoir au poste (barrer au pilote)', faire: () => jeu.allerAuPoste() },
    },
    {
      // la pompe de cale à main, sur la paroi bâbord de la timonerie (on tient son levier)
      id: 'pompe',
      point: interieur.positionPompe.clone(),
      rayon: 0.28,
      dedans: true,
      soi: ['pompe-corps', 'noir', 'lambris-timonerie'],
      titre: () => 'Pompe de cale (à main)',
      principal: { texte: 'pomper', maintenir: true, faire: (dt) => jeu.pomper(dt) },
    },
    {
      // la trappe de la cale, dans le plancher : on la soulève pour voir l'eau
      id: 'trappe',
      point: interieur.positionTrappe.clone(),
      rayon: 0.35,
      dedans: true,
      soi: ['plancher-timonerie', 'lambris-timonerie'],
      titre: () => 'La trappe de la cale',
      principal: { texte: () => (interieur.trappeOuverte ? 'refermer la trappe' : 'ouvrir la trappe'), faire: () => jeu.basculerTrappe() },
    },
    // les volets de tempête : un bouton par côté, sur la commande du plafond
    ...Object.entries(interieur.boutonsVolets).map(([cote, point]) => ({
      id: `volets-${cote}`,
      point: point.clone(),
      rayon: 0.024,
      dedans: true,
      soi: ['commande-volets', 'boiseries'],
      titre: () => `Les volets de tempête ${NOMS_COTES[cote]}`,
      principal: {
        texte: () => (interieur.voletsFermes(cote) ? 'ouvrir les volets' : 'fermer les volets'),
        faire: () => jeu.basculerVolets(cote),
      },
    })),
    {
      id: 'radio',
      point: interieur.positionRadio.clone(),
      rayon: 0.13,
      soi: ['noir', 'sans-nom'],
      titre: () => `Radio VHF (canal ${jeu.radio.canal})`,
      principal: { texte: 'écouter', faire: () => jeu.ecouterMeteo(), ...sousTension(jeu, 'vhf', 'La VHF') },
      // (on appelle sur le 16, le canal de détresse : personne ne répond)
      secondaire: { texte: 'appeler', faire: () => jeu.appelerJos(), ...sousTension(jeu, 'vhf', 'La VHF') },
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
        principal: { texte: 'changer de portée', faire: () => jeu.radarPortee(), ...sousTension(jeu, 'radar', 'Le radar') },
        secondaire: { texte: () => (jeu.bateau.radar.filtreMer ? 'couper le filtre de mer' : 'remettre le filtre de mer'), faire: () => jeu.radarFiltre(), ...sousTension(jeu, 'radar', 'Le radar') },
      })),
    {
      // le traceur de cartes : on change l'échelle de la carte
      id: 'traceur',
      point: jeu.bateau.electronique.positionTraceur.clone(),
      rayon: 0.12,
      soi: ['noir', 'sans-nom'],
      titre: () => `Traceur de cartes : ${String(jeu.bateau.electronique.milles).replace('.', ',')} milles`,
      principal: { texte: 'agrandir la carte', faire: () => jeu.zoomTraceur(-1), ...sousTension(jeu, 'traceur', 'Le traceur') },
      secondaire: { texte: 'voir plus loin', faire: () => jeu.zoomTraceur(1), ...sousTension(jeu, 'traceur', 'Le traceur') },
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
