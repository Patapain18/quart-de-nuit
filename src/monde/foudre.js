// La foudre : les éclairs partent des nuages d'orage, et de nulle part ailleurs.
//
// Chaque nuage d'orage se charge et se décharge :
//  - les grains orageux (monde/grains.js), d'autant plus qu'ils sont forts et dans la force
//    de l'âge : un grain ne s'électrise qu'une fois sa tour montée, et ses éclairs cessent
//    un peu avant sa pluie ;
//  - le nuage qui porte la bête (la trombe du crépuscule) : une cellule d'orage énorme ;
//  - le front orageux, au loin, au coucher du soleil : on voit ses nuages s'allumer sur
//    l'horizon, sans tonnerre (il est trop loin : les « éclairs de chaleur »).
// Trois sortes d'éclairs, comme les vrais :
//  - dans le nuage (plus de la moitié) : on ne voit pas le trait, le nuage s'allume de
//    l'intérieur, tout le long de l'éclair ;
//  - jusqu'à la mer (un sur trois) : le trait sort de la base du nuage, sous le cœur de
//    pluie le plus souvent — mais parfois loin devant le grain, sous son enclume (la foudre
//    peut tomber avant la pluie) ; un à quatre éclats sur le même trait : le premier montre
//    toutes ses branches, les suivants seulement le tronc ;
//  - « en araignée » : un trait qui court sous la base des nuages sur des kilomètres, en se
//    ramifiant, et qui finit parfois dans la mer.
// Le tonnerre part de là où l'éclair passe au plus près de nous (le son fait 340 m par
// seconde : trois secondes par kilomètre), et roule tant qu'arrive le son des parties plus
// lointaines du trait. La radio crépite à chaque éclair. Sous un nuage d'orage, l'air se
// charge : le feu de Saint-Elme s'allume en tête de mât. Et le mât, seul point haut à des
// milles à la ronde, attire la foudre qui tombe près de lui.
//
// Ce fichier ne dessine rien et ne fait aucun bruit : il dit où et quand partent les
// éclairs, et quand leur tonnerre arrive (rendu/eclairs.js et rendu/monde3d.js les
// dessinent ; le jeu fait le bruit ; la nuit en tire les conséquences).
import { NOEUD, angleVers, geometrieFront, couchesNuages } from './meteo.js';
import { positionsAstres } from './astres.js';
import { REGLAGES_GRAINS } from './grains.js';

export const REGLAGES_FOUDRE = {
  parMinute: 10, // éclairs par minute d'un grain d'orage au plus fort (orage 1, force 1)
  trombe: 8, // ceux du nuage qui porte la bête, quand elle est au plus fort
  exposant: 2, // (un grain deux fois moins actif lance quatre fois moins d'éclairs)
  mer: 0.3, // la part des éclairs qui descendent jusqu'à la mer…
  araignee: 0.12, // … et de ceux qui courent sous la base des nuages (les autres : dans le nuage)
  avantLaPluie: 0.07, // la part des éclairs vers la mer qui tombent loin devant le grain
  intervalle: 0.36, // s : jamais deux éclats plus près (photosensibilité : trois par seconde au plus)
  son: 340, // m/s : la vitesse du son
  audible: 15000, // m : plus loin, le tonnerre se perd dans le bruit de la tempête
  parasites: 25000, // m : la radio crépite à chaque éclair, jusqu'à cette distance
  hauteurMat: 14.5, // m : la tête du mât, au-dessus de l'eau
  proche: 600, // m : une frappe plus près que ça, on la prend en pleine figure
  fond: 4, // (un décor sans grains : autant de cellules d'orage au plus fort de l'orage)
};

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// L'électricité d'un grain (0 → 1) : orageux ou pas, sa force, et son âge — ses premiers
// éclairs viennent quand sa tour a fini de monter, les derniers un peu avant la fin de sa
// pluie ; et l'air qu'il traverse : quand l'orage s'en va (orage du moment, 0 → 1), les
// grains qui restent ne font plus guère d'éclairs
export function activiteDuGrain(g, orage = 1) {
  if (!g.orage) return 0;
  const mur = lisse(0.5 * g.naissance, 1.3 * g.naissance, g.age);
  const fin = 1 - lisse(g.duree - REGLAGES_GRAINS.mort, g.duree - 0.3 * REGLAGES_GRAINS.mort, g.age);
  return g.orage * g.force * mur * fin * (0.4 + 0.6 * lisse(0.3, 0.8, orage));
}

// Le nombre moyen d'éclairs par seconde d'une cellule d'orage de cette activité
export function eclairsParSeconde(activite, parMinute = REGLAGES_FOUDRE.parMinute) {
  return activite > 0 ? (parMinute / 60) * activite ** REGLAGES_FOUDRE.exposant : 0;
}

// La lumière d'un éclair à l'instant t : v (0 → ~1,5) et l'éclat en cours (k, −1 avant le
// premier). Chaque éclat s'allume d'un coup et s'éteint en un dixième de seconde ; dans le
// nuage, un peu plus lentement ; en araignée, il court pendant un quart de seconde avant de
// s'éteindre. doux : pour les yeux sensibles, un seul éclat, moins fort, qui s'éteint
// lentement au lieu de claquer
export function lumiereEclair(e, t, doux = false, sortie = {}) {
  let v = 0;
  let k = -1;
  const n = doux ? Math.min(1, e.eclats.length) : e.eclats.length;
  for (let i = 0; i < n; i++) {
    const age = t - e.eclats[i].t;
    if (age < 0) break;
    const f = e.eclats[i].force;
    let x;
    if (doux) x = 0.4 * f * Math.exp(-age * 3.5) * Math.min(1, age / 0.25);
    else if (e.type === 'araignee') x = f * Math.min(1, age / 0.25) * Math.exp(-Math.max(0, age - 0.25) * 7);
    else if (e.type === 'front') x = f * Math.exp(-age * 12) * (age < 0.015 ? age / 0.015 : 1);
    else x = f * Math.exp(-age * (e.type === 'nuage' ? 12 : 18)) * (age < 0.02 ? age / 0.02 : 1);
    if (x >= v) {
      v = x;
      k = i;
    }
  }
  sortie.v = v;
  sortie.k = k;
  return sortie;
}

// La distance du point o au segment [a, b] ; le point le plus proche dans « proche »
function distanceAuSegment(o, a, b, proche) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  const s = l2 > 0 ? Math.max(0, Math.min(1, ((o.x - a.x) * abx + (o.y - a.y) * aby + (o.z - a.z) * abz) / l2)) : 0;
  proche.x = a.x + abx * s;
  proche.y = a.y + aby * s;
  proche.z = a.z + abz * s;
  return Math.hypot(o.x - proche.x, o.y - proche.y, o.z - proche.z);
}

const point = (x, y, z) => ({ x, y, z });

export class Foudre {
  constructor(graine = 1) {
    this.etatHasard = (graine * 2654435761 + 211) >>> 0;
    this.t = 0;
    this.meteo = null;
    this.eclairs = []; // les éclairs en cours, et ceux dont les éclats vont venir
    this.tonnerres = []; // les tonnerres en route (le son va moins vite que la lumière)
    // ce qui s'est passé pendant la dernière mise à jour : { type : 'eclair' (un éclair
    // commence), 'tonnerre' (son tonnerre arrive ici), 'frappe' (la foudre tombe près du
    // bateau, ou sur lui) }
    this.evenements = [];
    this.prochainId = 1;
    this.dernierEclat = -Infinity; // (l'heure du dernier éclat prévu)
    this.retenue = -Infinity; // (pas d'éclairs naturels avant cette heure : retenir())
    this.fond = []; // (les cellules d'orage d'un décor sans grains)
    this.front = { prochain: 4 };
    // l'électricité de l'air autour du bateau (0 → 1 : le feu de Saint-Elme s'allume vers
    // 0,4), et la cellule d'orage qui la fait
    this.champ = 0;
    this.cellule = null;
    this.couches = { base: 1300, epaisseur: 1800 };
    this.bateau = { x: 0, z: 0 };
    this.ecoute = { x: 0, y: 2, z: 0 };
    // (des comptes, pour les essais, l'atelier et le bilan)
    this.compte = { nuage: 0, mer: 0, araignee: 0, front: 0, frappes: 0, surLeMat: 0, avantLaPluie: 0 };
    this._q = {};
    this._p = {};
    this._cellules = [];
  }

  // Un petit hasard reproductible (son état se garde avec la partie)
  hasard() {
    const a = (this.etatHasard = (this.etatHasard + 0x6d2b79f5) >>> 0);
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // (un nombre tiré en cloche : moyenne 0, écart 1)
  cloche() {
    const u = Math.max(1e-9, this.hasard());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.hasard());
  }

  // ---------- À chaque image ----------
  // meteo : le temps qu'il fait ; grains : monde/grains.js, ou null (un décor : la foudre a
  // alors ses propres cellules d'orage, invisibles) ; trombe : { x, z, force } ou null ;
  // (x, z) : le bateau ; ecoute : où l'on entend (la caméra ; par défaut, le bateau)
  maj(dt, { meteo, grains = null, trombe = null, x = 0, z = 0, ecoute = null } = {}) {
    this.evenements.length = 0;
    this.t += dt;
    this.meteo = meteo;
    this.couches = couchesNuages(meteo);
    this.bateau.x = x;
    this.bateau.z = z;
    if (ecoute) {
      this.ecoute.x = ecoute.x;
      this.ecoute.y = ecoute.y;
      this.ecoute.z = ecoute.z;
    } else {
      this.ecoute.x = x;
      this.ecoute.y = 2;
      this.ecoute.z = z;
    }
    // les nuages d'orage se déchargent (chacun à son rythme, au hasard) — sauf quand un
    // atelier les retient
    const cellules = this.cellules(dt, meteo, grains, trombe);
    const libre = this.t >= this.retenue;
    for (const c of cellules) {
      if (this.hasard() < eclairsParSeconde(c.activite, c.parMinute) * dt && libre) this.decharger(c);
    }
    if (libre) this.majFront(dt, meteo);
    // l'air autour du bateau : chargé sous le cœur d'un nuage d'orage, et sous son enclume,
    // qui déborde loin devant lui
    let champ = 0;
    this.cellule = null;
    for (const c of cellules) {
      const dx = x - c.x;
      const dz = z - c.z;
      const r = Math.hypot(dx, dz);
      const v = Math.hypot(c.vx, c.vz) || 1;
      const devant = r > 1 ? (dx * c.vx + dz * c.vz) / (r * v) : 0;
      const k = c.activite * (1 - lisse(0.5 * c.rayon, 1.8 * c.rayon, r / (1 + 0.3 * Math.max(0, devant))));
      if (k > champ) {
        champ = k;
        this.cellule = c;
      }
    }
    this.champ = champ;
    // les éclairs qui commencent maintenant : la radio crépite, la foudre tombe
    for (const e of this.eclairs) {
      if (e.annonce || this.t < e.t0) continue;
      e.annonce = true;
      this.evenements.push({ type: 'eclair', eclair: e, distance: e.distance });
      if (e.bas && e.type !== 'front') {
        const d = Math.hypot(e.bas.x - x, e.bas.z - z);
        if (e.surLeMat || d < REGLAGES_FOUDRE.proche) {
          this.compte.frappes++;
          if (e.surLeMat) this.compte.surLeMat++;
          this.evenements.push({ type: 'frappe', eclair: e, distance: e.surLeMat ? 0 : d, surLeMat: !!e.surLeMat });
        }
      }
    }
    // les tonnerres qui arrivent jusqu'ici
    if (this.tonnerres.length) {
      for (const th of this.tonnerres) if (this.t >= th.arrivee) this.evenements.push({ type: 'tonnerre', ...th });
      this.tonnerres = this.tonnerres.filter((th) => this.t < th.arrivee);
    }
    // on oublie les éclairs finis
    if (this.eclairs.length && this.eclairs[0].fin < this.t) this.eclairs = this.eclairs.filter((e) => e.fin >= this.t);
  }

  // Les nuages d'orage du moment : { type, x, z, rayon, activite (0 → 1), vx, vz (m/s),
  // parMinute, grain }
  cellules(dt, meteo, grains, trombe) {
    const liste = this._cellules;
    liste.length = 0;
    if (grains) {
      for (const g of grains.liste) {
        const a = activiteDuGrain(g, meteo.orage ?? 0);
        if (a > 0.005) liste.push({ type: 'grain', grain: g, grains, x: g.x, z: g.z, rayon: g.rayon, activite: a, vx: g.vx, vz: g.vz, parMinute: REGLAGES_FOUDRE.parMinute });
      }
    } else this.majFond(dt, meteo, liste);
    if (trombe && trombe.force > 0.3) {
      liste.push({ type: 'trombe', x: trombe.x, z: trombe.z, rayon: 1400, activite: trombe.force, vx: 0, vz: 0, parMinute: REGLAGES_FOUDRE.trombe });
    }
    return liste;
  }

  // Un décor sans grains (un atelier, par gros temps) : quelques cellules d'orage qui
  // existent quelque part autour de nous, avancent avec le vent, naissent et meurent — les
  // éclairs viennent toujours des mêmes endroits
  majFond(dt, meteo, liste) {
    const voulu = Math.round(lisse(0.45, 1, meteo.orage ?? 0) * REGLAGES_FOUDRE.fond);
    const a = angleVers(meteo.directionVent + REGLAGES_GRAINS.derive);
    const vitesse = Math.max(3, meteo.vent * NOEUD * REGLAGES_GRAINS.vitesse);
    const vx = Math.cos(a) * vitesse;
    const vz = Math.sin(a) * vitesse;
    const { x, z } = this.bateau;
    for (const c of this.fond) {
      c.x += vx * dt;
      c.z += vz * dt;
      c.age += dt;
    }
    this.fond = this.fond.filter((c) => c.age < c.duree && Math.hypot(c.x - x, c.z - z) < 18000);
    while (this.fond.length < voulu) {
      const ang = this.hasard() * Math.PI * 2;
      const r = 2500 + this.hasard() * 9500;
      const duree = 400 + this.hasard() * 500;
      this.fond.push({ x: x + Math.cos(ang) * r, z: z + Math.sin(ang) * r, rayon: 900 + this.hasard() * 600, force: 0.5 + this.hasard() * 0.5, age: this.hasard() * duree * 0.5, duree });
    }
    if (this.fond.length > voulu) this.fond.length = voulu;
    for (const c of this.fond) {
      const vie = lisse(0, 60, c.age) * (1 - lisse(c.duree - 60, c.duree, c.age));
      liste.push({ type: 'fond', x: c.x, z: c.z, rayon: c.rayon, activite: c.force * vie, vx, vz, parMinute: REGLAGES_FOUDRE.parMinute });
    }
  }

  // ---------- Un éclair ----------
  decharger(c) {
    const r = this.hasard();
    const P = REGLAGES_FOUDRE;
    const type = r < P.mer ? 'mer' : r < P.mer + P.araignee ? 'araignee' : 'nuage';
    return this.creer(type, c);
  }

  // Un point sous le cœur de pluie de la cellule : là où tombe la foudre, le plus souvent.
  // Surtout sous l'avant du cœur, le plus dense, là où l'air chaud monte dans le nuage (sept
  // fois sur dix) ; sinon sous la traîne
  sousLeCoeur(c, sortie) {
    if (c.type === 'grain') {
      const g = c.grain;
      const n = g.noyaux.length > 1 && this.hasard() < 0.3 ? g.noyaux[1 + Math.floor(this.hasard() * (g.noyaux.length - 1))] : g.noyaux[0];
      const q = c.grains.noyau(g, n, this._q);
      sortie.x = q.x + this.cloche() * q.s * 0.45;
      sortie.z = q.z + this.cloche() * q.s * 0.45;
    } else {
      // (la bête : autour d'elle, jamais dessus)
      const r = c.type === 'trombe' ? 250 + this.hasard() * 900 : Math.abs(this.cloche()) * c.rayon * 0.45;
      const a = this.hasard() * Math.PI * 2;
      sortie.x = c.x + Math.cos(a) * r;
      sortie.z = c.z + Math.sin(a) * r;
    }
    sortie.y = 0;
    return sortie;
  }

  // Le mât attire la foudre qui tombe près de lui : un éclair « choisit » son point d'impact
  // à la fin de sa descente, quand il est à quelques dizaines de mètres de la mer (la
  // « distance d'amorçage », plus grande pour un éclair plus fort : 90 m pour 30 000
  // ampères). Seul point haut à des milles, le mât capte tout ce qui tomberait dans ce rayon
  // (une sphère de cette taille, qu'on roule sur la mer, touche son sommet avant l'eau).
  attirer(b, courant) {
    const h = REGLAGES_FOUDRE.hauteurMat;
    const amorcage = 10 * courant ** 0.65;
    const rayon = Math.sqrt(Math.max(0, 2 * amorcage * h - h * h));
    if (Math.hypot(b.x - this.bateau.x, b.z - this.bateau.z) >= rayon) return false;
    b.x = this.bateau.x;
    b.y = h;
    b.z = this.bateau.z;
    return true;
  }

  creer(type, c, impose = null) {
    const { base, epaisseur } = this.couches;
    const h = () => this.hasard();
    const e = {
      id: this.prochainId++, type, source: c?.type ?? 'scene', grain: c?.grain?.id ?? null,
      graine: Math.floor(h() * 4294967296) >>> 0,
      haut: null, bas: null, bout: null, nuage: null, surLeMat: false, avantLaPluie: false,
      courant: 30 * Math.exp(0.7 * this.cloche()), // kA (des éclairs de 10 000 à 100 000 ampères)
      visible: type !== 'nuage',
    };
    // la route de la cellule (sa direction), pour l'enclume qui déborde devant elle
    const v = c ? Math.hypot(c.vx, c.vz) : 0;
    const ux = v > 0.1 ? c.vx / v : 1;
    const uz = v > 0.1 ? c.vz / v : 0;
    const activite = c?.activite ?? 1;
    if (type === 'mer') {
      const b = impose ? point(impose.x, 0, impose.z) : point(0, 0, 0);
      if (!impose) {
        if (c.type === 'grain' && h() < REGLAGES_FOUDRE.avantLaPluie) {
          // loin devant le grain, sous son enclume : la foudre tombe avant la pluie
          const devant = (1.3 + 1.2 * h()) * c.rayon;
          const cote = (h() - 0.5) * 1.4 * c.rayon;
          b.x = c.x + ux * devant - uz * cote;
          b.z = c.z + uz * devant + ux * cote;
          e.avantLaPluie = true;
        } else this.sousLeCoeur(c, b);
      }
      if (impose?.surLeMat) {
        Object.assign(b, { x: this.bateau.x, y: REGLAGES_FOUDRE.hauteurMat, z: this.bateau.z });
        e.surLeMat = true;
      } else e.surLeMat = this.attirer(b, e.courant);
      e.bas = b;
      // (le trait part de plus haut, dans le nuage, un peu à côté)
      e.haut = point(b.x + this.cloche() * 250, base + 150 + h() * 600, b.z + this.cloche() * 250);
      // dans le nuage, ses branches courent sur un ou deux kilomètres
      const a = h() * Math.PI * 2;
      const L = 1000 + h() * 2000;
      e.nuage = [e.haut, point(e.haut.x + Math.cos(a) * L, e.haut.y + (h() - 0.3) * 600, e.haut.z + Math.sin(a) * L)];
    } else if (type === 'araignee') {
      // elle part du cœur et court sous la base, vers l'avant de la cellule (son enclume),
      // sur des kilomètres
      const p = impose ? point(impose.x, 0, impose.z) : this.sousLeCoeur(c, point(0, 0, 0));
      e.haut = point(p.x, base - 40 - 60 * h(), p.z);
      const ang = (impose?.angle ?? Math.atan2(uz, ux)) + (impose?.angle != null ? 0 : (h() - 0.5) * 2.2);
      const L = impose?.longueur ?? (2500 + 7000 * h()) * (0.6 + 0.4 * activite);
      e.bout = point(e.haut.x + Math.cos(ang) * L, base - 80 - 150 * h(), e.haut.z + Math.sin(ang) * L);
      e.nuage = [e.haut, e.bout];
      // (une sur trois finit dans la mer)
      if (impose?.finitALaMer ?? h() < 0.3) {
        const b = point(e.bout.x + this.cloche() * 300, 0, e.bout.z + this.cloche() * 300);
        e.surLeMat = this.attirer(b, e.courant);
        e.bas = b;
      }
    } else {
      // dans le nuage : le trait court à l'intérieur, sur un à quatre kilomètres
      const p = impose ? point(impose.x, 0, impose.z) : point(c.x + this.cloche() * c.rayon * 0.7, 0, c.z + this.cloche() * c.rayon * 0.7);
      const y = base + (0.2 + 0.6 * h()) * epaisseur;
      const a = h() * Math.PI * 2;
      const L = (1200 + 2800 * h()) * (0.5 + 0.5 * activite);
      const yb = Math.min(base + 0.95 * epaisseur, Math.max(base + 100, y + (h() - 0.5) * 900));
      e.haut = point(p.x, y, p.z);
      e.bout = point(p.x + Math.cos(a) * L, yb, p.z + Math.sin(a) * L);
      e.nuage = [e.haut, e.bout];
    }
    // ses éclats : un à quatre (vers la mer, les suivants reprennent le même trait)
    const n = impose?.eclats ?? (type === 'mer' ? 1 + Math.floor(h() ** 0.8 * 4) : type === 'nuage' ? 1 + Math.floor(h() * 3) : 1 + (h() < 0.35 ? 1 : 0));
    const premier = impose?.force ?? (type === 'nuage' ? 0.5 + 0.7 * h() : 0.7 + 0.8 * h());
    const forces = [premier];
    for (let k = 1; k < n; k++) forces.push(premier * (0.5 + 0.45 * h()));
    if (!this.planifier(e, forces)) return null;
    this.mesurer(e);
    this.eclairs.push(e);
    this.compte[type]++;
    if (e.avantLaPluie) this.compte.avantLaPluie++;
    // son tonnerre : il part avec le premier éclat
    if (e.distance < REGLAGES_FOUDRE.audible) {
      const P = REGLAGES_FOUDRE;
      this.tonnerres.push({
        id: e.id, sorte: type, arrivee: e.t0 + e.distance / P.son, distance: e.distance,
        // (il roule tant qu'arrive le son des parties plus lointaines du trait)
        duree: Math.max(2, Math.min(28, (e.loin - e.distance) / P.son + 1.5)),
        force: (1 - lisse(150, P.audible, e.distance)) ** 1.2 * (type === 'nuage' ? 0.7 : 1),
        claque: type !== 'nuage' && e.distance < 1500,
        x: e.proche.x, y: e.proche.y, z: e.proche.z,
      });
    }
    return e;
  }

  // Les éclats d'un éclair, à la suite : jamais deux éclats (de tous les éclairs) à moins
  // d'un tiers de seconde (au-delà de trois éclats par seconde, des éclairs sur tout l'écran
  // peuvent être dangereux pour les personnes photosensibles)
  planifier(e, forces) {
    const P = REGLAGES_FOUDRE;
    let t = Math.max(this.t, this.dernierEclat + P.intervalle);
    // (trop d'éclairs à la fois : celui-ci n'a pas lieu)
    if (t - this.t > 2) return false;
    e.eclats = [];
    for (const force of forces) {
      e.eclats.push({ t, force });
      t += P.intervalle + this.hasard() * 0.25;
    }
    e.t0 = e.eclats[0].t;
    this.dernierEclat = e.eclats[e.eclats.length - 1].t;
    e.fin = this.dernierEclat + 1.5;
    return true;
  }

  // Ce que l'éclair est pour nous : où il passe au plus près, au plus loin (le tonnerre
  // part du plus près et roule jusqu'au plus loin), et ce qu'il éclaire autour de nous
  // (tout, s'il est proche ; loin, il ne nous arrive que la lumière diffuse des nuages)
  mesurer(e) {
    const o = this.ecoute;
    const q = this._p;
    let dmin = Infinity;
    let dmax = 0;
    const proche = point(0, 0, 0);
    const segments = [e.nuage];
    if (e.bas) segments.push([e.type === 'araignee' ? e.bout : e.haut, e.bas]);
    for (const [a, b] of segments) {
      const d = distanceAuSegment(o, a, b, q);
      if (d < dmin) {
        dmin = d;
        Object.assign(proche, q);
      }
      dmax = Math.max(dmax, Math.hypot(o.x - a.x, o.y - a.y, o.z - a.z), Math.hypot(o.x - b.x, o.y - b.y, o.z - b.z));
    }
    e.distance = dmin;
    e.loin = dmax;
    e.proche = proche;
    const sorte = e.type === 'mer' ? 1 : e.type === 'araignee' ? 0.8 : 0.55;
    e.eclaire = sorte * (0.22 + 0.78 * (1 - lisse(2500, 9000, dmin)));
  }

  // ---------- Le front, au loin ----------
  // Au crépuscule, on voit ses nuages s'allumer sur l'horizon, une boule après l'autre (trop
  // loin pour voir le trait, et pour entendre le tonnerre)
  majFront(dt, meteo) {
    const f = geometrieFront(meteo);
    if (f.visibilite <= 0.05) return;
    const s = positionsAstres(meteo).soleil.y;
    const crepuscule = Math.max(1 - lisse(-0.12, 0.08, s), (meteo.orage ?? 0) > 0.6 ? 1 : 0);
    if (crepuscule <= 0.2) return;
    const fr = this.front;
    fr.prochain -= dt * crepuscule;
    if (fr.prochain > 0) return;
    fr.prochain = 2 + this.hasard() * 8;
    this.eclairDuFront(f);
  }

  // Un éclair dans le front, tout de suite (s'il est en vue)
  eclairDuFront(f = this.meteo && geometrieFront(this.meteo)) {
    if (!f || f.visibilite <= 0.05) return null;
    const h = () => this.hasard();
    const n = 1 + Math.floor(h() * 4);
    const e = {
      id: this.prochainId++, type: 'front', source: 'front', visible: false,
      az: f.azimut + (h() * 2 - 1) * f.demiLargeur * 0.75,
      el: f.sommet * (0.15 + h() * 0.6),
      rayon: f.sommet * (0.1 + h() * 0.16),
      distance: f.distance, loin: f.distance, eclaire: 0, eclats: [],
    };
    let t = this.t;
    for (let k = 0; k < n; k++) {
      e.eclats.push({ t, force: 0.5 + h() });
      t += 0.06 + h() * 0.18;
    }
    e.t0 = e.eclats[0].t;
    e.fin = t + 0.5;
    this.eclairs.push(e);
    this.compte.front++;
    if (e.distance < REGLAGES_FOUDRE.audible) {
      this.tonnerres.push({ id: e.id, sorte: 'front', arrivee: e.t0 + e.distance / REGLAGES_FOUDRE.son, distance: e.distance, duree: 12, force: 0.3, claque: false, x: this.ecoute.x + Math.sin(e.az) * e.distance, y: 1000, z: this.ecoute.z - Math.cos(e.az) * e.distance });
    }
    return e;
  }

  // ---------- Pour la mise en scène et les outils ----------
  // Un éclair tout de suite, là où on le demande (une vague scélérate se découpe sur lui ;
  // l'atelier en envoie un) : type 'mer' (le trait tombe en (x, z), ou sur le mât :
  // surLeMat), 'nuage' ou 'araignee' (angle, longueur, finitALaMer) ; eclats : combien
  lancer({ type = 'mer', x = this.bateau.x, z = this.bateau.z, eclats = null, force = null, surLeMat = false, angle = null, longueur = null, finitALaMer = null } = {}) {
    // (avant la première mise à jour, les nuages sont à leur hauteur par défaut)
    const e = this.creer(type, null, { x, z, eclats, force, surLeMat, angle, longueur, finitALaMer });
    if (e) e.source = 'scene';
    return e;
  }

  // Un éclair tout de suite au-dessus du point (x, z), en trois éclats, qui tombe à côté
  eclairSur(x, z) {
    const a = this.hasard() * Math.PI * 2;
    const r = 100 + this.hasard() * 300;
    return this.lancer({ type: 'mer', x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, eclats: 3, force: 1.1 + this.hasard() * 0.5 });
  }

  // Plus d'éclairs naturels pendant « duree » secondes (une photo, un film : l'atelier lance
  // les siens) ; ceux qui allaient venir n'auront pas lieu
  retenir(duree) {
    this.retenue = Math.max(this.retenue, this.t + duree);
    this.eclairs = this.eclairs.filter((e) => e.t0 <= this.t);
  }

  liberer() {
    this.retenue = -Infinity;
  }

  vider() {
    this.eclairs = [];
    this.tonnerres = [];
    this.evenements.length = 0;
    this.fond = [];
    this.dernierEclat = -Infinity;
  }

  // ---------- La partie gardée ----------
  instantane() {
    return {
      etatHasard: this.etatHasard, t: this.t, prochainId: this.prochainId, dernierEclat: this.dernierEclat,
      fond: this.fond.map((c) => ({ ...c })), front: { ...this.front }, compte: { ...this.compte },
    };
  }

  restaurer(s) {
    if (!s) return;
    Object.assign(this, {
      etatHasard: s.etatHasard, t: s.t, prochainId: s.prochainId, dernierEclat: s.dernierEclat ?? -Infinity,
      fond: (s.fond ?? []).map((c) => ({ ...c })), front: { ...(s.front ?? { prochain: 4 }) }, compte: { ...this.compte, ...(s.compte ?? {}) },
    });
    this.eclairs = [];
    this.tonnerres = [];
  }
}
