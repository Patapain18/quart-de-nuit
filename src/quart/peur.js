// La peur : ce qui, la nuit, ne s'explique pas. Rien n'est jamais confirmé : ce qu'on voit
// du coin de l'œil disparaît dès qu'on le regarde en face ; ce qu'on entend, personne
// d'autre ne l'a entendu ; le sondeur se trompe une fois, puis plus jamais.
//
// Ce fichier décide QUAND (l'heure, la tension, rien d'autre en cours) et OÙ (ce que le
// marin regarde, où il est) ; il ne dessine rien et ne fait aucun bruit : le jeu montre
// (rendu/apparitions.js) et fait entendre (son/audio.js). L'étrange plus ancien — la lumière
// sur l'eau, la voix sur le 16, les coups derrière la porte de la cabine avant — est dans
// quart/nuit.js ; tout passe par la même tension. (Le livre de bord de l'ancien propriétaire,
// quart/livre-de-bord.js, en parle avant qu'elles n'arrivent… ou pas.)
//
// ctx, à chaque image :
//   heure ; lieu : 'timonerie' (assis au poste ou debout dedans) ou 'pont' (dehors) ; yeux,
//   regard, haut : la position des yeux, la direction du regard et le haut de la vue, dans le
//   repère du bateau (l'avant vers −z, tribord vers +x) ; tanX, tanY : le champ de vision (la
//   tangente du demi-angle, en largeur et en hauteur) ; lampe (la frontale allumée) ;
//   eclairage ('eteint', 'rouge', 'blanc') ; eclair (0 → 1 : un éclair en ce moment) ; noir
//   (0 → 1 : le noir d'encre de la nuit d'orage) ; occupe (une vague scélérate, la trombe, un
//   danger : rien d'étrange ne vient s'y mêler) ; danger (0 → 1) ; calme (secondes depuis la
//   dernière déferlante) ; porteOuverte (celle de la timonerie) ; porteAvant (celle de la
//   cabine avant : 'fermee', 'entrouverte' ou 'ouverte') ; voletsFermes (côté par côté) ; assis
//   (au poste : de là, la console cache la porte de la cabine avant).
import { zDe, hauteurPont, TIMONERIE, PORTE_AVANT } from '../bateau/forme.js';

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
function generateur(graine) {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), a | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// La tension de fond : elle monte d'heure en heure, de minuit (24) jusqu'au plus fort, juste
// avant l'aube (6 h : 30), et ne retombe qu'avec le jour
const FOND = [[24, 0.14], [25, 0.24], [26, 0.34], [27, 0.44], [28, 0.53], [29, 0.62], [29.8, 0.68], [30.3, 0.15]];
export function tensionDeFond(h) {
  if (h <= FOND[0][0]) return FOND[0][1];
  for (let i = 1; i < FOND.length; i++) {
    const [h1, v1] = FOND[i];
    const [h0, v0] = FOND[i - 1];
    if (h <= h1) return v0 + (v1 - v0) * lisse(h0, h1, h);
  }
  return FOND.at(-1)[1];
}

// Où se tient la silhouette : sur le pont avant, près du balcon (les pieds)
export const SILHOUETTE = { x: 0, y: hauteurPont(0.83, 0), z: zDe(0.83), taille: 1.78 };
// La porte basse de la cabine avant (son milieu, sur la cloison, sous le pare-brise)
export const PORTE_CABINE = { x: (PORTE_AVANT.x0 + PORTE_AVANT.x1) / 2, y: (PORTE_AVANT.y0 + PORTE_AVANT.y1) / 2, z: TIMONERIE.zAvant };

// Ce qui peut arriver : combien de fois au plus, entre quelles heures (24 : minuit ; 30 : six
// heures), ce que ça ajoute à la tension, et à quelles conditions (dans quel lieu, en
// regardant quoi). Les plus discrètes viennent tôt, les sursauts tard.
export const EVENEMENTS = {
  // la mer gémit : un long son grave, au loin, qui n'est pas celui du vent
  gemissement: { fois: 3, de: 24.3, a: 29.8, choc: 0.15, attente: 50 },
  // quelqu'un, debout à l'avant (du coin de l'œil seulement)
  silhouette: { fois: 2, de: 25.2, a: 29.7, choc: 0.35 },
  // dans le pare-brise de la timonerie, quelqu'un debout derrière toi (le reflet)
  reflet: { fois: 2, de: 24.8, a: 29.8, choc: 0.4 },
  // une forme pâle dans l'eau, le long de la coque, qui suit le bateau
  forme: { fois: 1, de: 25.5, a: 29.2, choc: 0.3 },
  // quelque chose d'immense passe sous la coque (le sondeur, le raclement, le plancton)
  chose: { fois: 1, de: 26.2, a: 29.4, choc: 0.5 },
  // des pas sur le pont, au-dessus de soi
  pas: { fois: 2, de: 25.6, a: 29.8, choc: 0.35 },
  // ton nom, chuchoté sur le 16
  nom: { fois: 1, de: 27.2, a: 29.6, choc: 0.4 },
  // un choc énorme contre la coque, après un long calme (un sursaut)
  coupCoque: { fois: 1, de: 27, a: 29.8, choc: 0.6 },
  // dans un éclair, quelqu'un à l'avant ; à l'éclair suivant, plus personne (un sursaut)
  eclairSilhouette: { fois: 1, de: 27.5, a: 29.7, choc: 0.7 },
  // sur le radar, un écho qui nous suit : toujours au même relèvement, quel que soit notre
  // cap, et il se rapproche ; dans un éclair, la mer est vide — et il n'est plus là
  echoSuiveur: { fois: 1, de: 24.6, a: 28.4, choc: 0.3 },
  // l'alarme du radar : un écho tout près, dans la zone de garde, presque dans notre
  // sillage ; un éclair montre la mer : il n'y a rien (et l'alarme se tait)
  echoProche: { fois: 1, de: 27.4, a: 29.7, choc: 0.55 },
  // la porte basse de la cabine avant s'entrouvre, quand on ne la regarde pas (son loquet
  // claque, ses gonds grincent) ; derrière, le noir ; on la referme… et elle se rouvre. (C'est
  // une chose du bateau, pas une apparition : elle a sa propre attente, comme les gémissements)
  porteAvant: { fois: 2, de: 28.3, a: 29.85, choc: 0.45, attente: 60 },
};
// (celles qui ne comptent pas dans l'attente des autres, et ont la leur)
const A_PART = new Set(['gemissement', 'porteAvant']);
const ATTENTE = 75; // secondes au moins entre deux choses étranges (hors gémissements)
const DEHORS = new Set(['pont']);

// L'angle (degrés) entre le regard et la direction d'un point, vu des yeux
export function angleVu(yeux, regard, p) {
  const dx = p.x - yeux.x;
  const dy = p.y - yeux.y;
  const dz = p.z - yeux.z;
  const n = Math.hypot(dx, dy, dz) || 1;
  const c = (dx * regard.x + dy * regard.y + dz * regard.z) / n;
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}
// Où est un point sur l'écran : x, y de −1 à 1 (les bords) ; null s'il est derrière
// (sans champ de vision donné : un écran large, 70° en hauteur)
export function surEcran(ctx, p) {
  const { yeux, regard } = ctx;
  const haut = ctx.haut ?? { x: 0, y: 1, z: 0 };
  const vx = p.x - yeux.x;
  const vy = p.y - yeux.y;
  const vz = p.z - yeux.z;
  const f = vx * regard.x + vy * regard.y + vz * regard.z;
  if (f < 0.05) return null;
  // la droite de l'écran (regard × haut), et le vrai haut (droite × regard)
  let dx = regard.y * haut.z - regard.z * haut.y;
  let dy = regard.z * haut.x - regard.x * haut.z;
  let dz = regard.x * haut.y - regard.y * haut.x;
  const n = Math.hypot(dx, dy, dz) || 1;
  dx /= n; dy /= n; dz /= n;
  const hx = dy * regard.z - dz * regard.y;
  const hy = dz * regard.x - dx * regard.z;
  const hz = dx * regard.y - dy * regard.x;
  return {
    x: (vx * dx + vy * dy + vz * dz) / f / (ctx.tanX ?? 1.24),
    y: (vx * hx + vy * hy + vz * hz) / f / (ctx.tanY ?? 0.7),
  };
}
// Du coin de l'œil : sur l'écran, près d'un bord (on le voit sans le voir net) ; en face :
// près du milieu (on le regarde : il disparaît)
export function coinDeLOeil(e) {
  if (!e) return false;
  const r = Math.max(Math.abs(e.x), Math.abs(e.y) * 0.9);
  return r > 0.55 && r < 0.95;
}
export function enFace(e) { return !!e && Math.abs(e.x) < 0.3 && Math.abs(e.y) < 0.38; }
export const EN_FACE = 22; // (degrés : pour vérifier)

export class Peur {
  constructor({ graine = 1 } = {}) {
    this.hasard = generateur(graine * 92821 + 3);
    this.t = 0;
    this.tension = 0;
    this.choc = 0; // (ce que les dernières choses étranges ont ajouté : s'efface en 1 min 30)
    this.fois = Object.fromEntries(Object.keys(EVENEMENTS).map((k) => [k, 0]));
    this.dernier = -999; // (le temps de la dernière chose étrange)
    this.derniers = {}; // (celles qui ont leur propre attente : le temps de la dernière fois)
    this.journal = []; // ce qui est arrivé : { nom, heure, regardee }
    // ce qui est en cours (pour le jeu : ce qu'il doit montrer)
    this.silhouette = null; // { x, y, z, face, opacite, age, duree, eclair }
    this.reflet = null; // { x, y, z (où se tient la chose, derrière toi), age, duree, opacite }
    this.forme = null; // { x, z (repère du bateau), age, duree, opacite }
    this.chose = null; // { x, z, angle (repère du bateau), age, duree, force, sonde }
    this.echo = null; // { nom, releve (depuis l'avant, + vers tribord), distance (m), force, alarme, age, duree }
    this.force = {}; // (l'atelier de la peur : ce qu'on veut voir tout de suite)
    this.tensionForcee = null; // (l'atelier de la peur : une tension choisie)
  }

  // Ajoute à la tension (une chose étrange, venue d'ailleurs : la nuit, le jeu)
  secouer(choc) { this.choc = Math.min(1, this.choc + choc); }

  // Provoquer une chose (l'atelier de la peur) : elle arrive dès que ses conditions le
  // permettent (sans attendre son heure ni les autres)
  provoquer(nom) { if (EVENEMENTS[nom]) this.force[nom] = true; }

  // Une image ; renvoie les choses qui commencent ou finissent à cette image
  maj(dt, ctx) {
    this.t += dt;
    const evts = [];
    this.choc *= Math.exp(-dt / 90);
    // (dehors sans lampe, dans le noir d'encre, on ne voit plus rien : la peur monte)
    const obscurite = DEHORS.has(ctx.lieu) ? (ctx.lampe ? 0 : 0.05 + 0.08 * (ctx.noir ?? 0)) : (ctx.eclairage === 'eteint' && !ctx.lampe ? 0.12 : 0);
    this.tension = this.tensionForcee ?? Math.min(1, tensionDeFond(ctx.heure) + 0.55 * this.choc + 0.35 * (ctx.danger ?? 0) + obscurite);
    this.dernierCtx = ctx; // (pour l'atelier de la peur)
    this.suivreApparitions(dt, ctx, evts);
    this.programmer(dt, ctx, evts);
    return evts;
  }

  // ---------- Quand ----------
  // Pour chaque chose possible : dans sa fenêtre, si ses conditions sont réunies et que
  // rien d'autre n'est en cours, elle arrive (plus vite si la tension est haute ; à coup
  // sûr à la fin de sa fenêtre)
  programmer(dt, ctx, evts) {
    for (const [nom, e] of Object.entries(EVENEMENTS)) {
      const force = this.force[nom];
      if (!force) {
        if (this.fois[nom] >= e.fois || ctx.heure < e.de || ctx.heure > e.a || ctx.occupe) continue;
        const attente = A_PART.has(nom) ? (this.t - (this.derniers[nom] ?? -999) < e.attente) : (this.t - this.dernier < ATTENTE);
        if (attente) continue;
      }
      if (this.enCours(nom) || !this.possible(nom, ctx)) continue;
      // (une chance par seconde, qui grandit avec la tension et la fin de la fenêtre ; au
      // bout de la fenêtre, à coup sûr)
      const fin = lisse(e.a - 0.6, e.a - 0.1, ctx.heure);
      const parSeconde = force ? 1e9 : 0.012 + 0.05 * this.tension + 0.3 * fin;
      if (this.hasard() > parSeconde * dt) continue;
      delete this.force[nom];
      this.commencer(nom, ctx, evts);
      return;
    }
  }

  enCours(nom) {
    if (nom === 'silhouette' || nom === 'eclairSilhouette') return !!this.silhouette;
    if (nom === 'reflet') return !!this.reflet;
    if (nom === 'forme') return !!this.forme;
    if (nom === 'chose') return !!this.chose;
    if (nom === 'echoSuiveur' || nom === 'echoProche') return !!this.echo;
    return false;
  }

  // Les conditions de chacune (où l'on est, ce que l'on regarde)
  possible(nom, ctx) {
    const { lieu, yeux, regard } = ctx;
    switch (nom) {
      case 'silhouette': {
        // (de la timonerie, par le pare-brise ; du cockpit, la timonerie cache l'avant)
        if (lieu !== 'timonerie' || yeux.z < SILHOUETTE.z + 3) return false;
        // (dans le noir d'encre, on ne la voit qu'à la frontale : ses bandes la renvoient)
        if ((ctx.noir ?? 0) > 0.5 && !ctx.lampe) return false;
        const e = surEcran(ctx, this.pointSilhouette(ctx, 1.1));
        return coinDeLOeil(e) && Math.max(Math.abs(e.x), Math.abs(e.y)) < 0.88;
      }
      case 'eclairSilhouette': {
        if (lieu !== 'timonerie' || yeux.z < SILHOUETTE.z + 3 || ctx.eclair < 0.55) return false;
        const e = surEcran(ctx, this.pointSilhouette(ctx, 1.1));
        return !!e && Math.abs(e.x) < 0.7 && Math.abs(e.y) < 0.8;
      }
      case 'reflet':
        // (il faut de la lumière dans la timonerie pour que la vitre fasse miroir, et
        // regarder droit devant, vers le pare-brise)
        return lieu === 'timonerie' && (ctx.eclairage !== 'eteint' || ctx.lampe) && regard.z < -0.8 && Math.abs(regard.y) < 0.45;
      case 'forme': {
        // (dehors, ou debout contre une vitre de côté, ses volets ouverts, à regarder l'eau)
        if (regard.y > 0.1) return false;
        if (lieu === 'timonerie') {
          const cote = yeux.x > 0 ? 'tribord' : 'babord';
          if (Math.abs(yeux.x) < 0.55 || Math.sign(regard.x) !== Math.sign(yeux.x) || Math.abs(regard.x) < 0.45 || regard.y > -0.12 || ctx.voletsFermes?.[cote]) return false;
        } else if (!DEHORS.has(lieu)) return false;
        const p = this.pointForme(ctx);
        const e = surEcran(ctx, { x: p.x, y: 0.2, z: p.z });
        return coinDeLOeil(e) && Math.max(Math.abs(e.x), Math.abs(e.y)) < 0.88;
      }
      case 'pas':
        // (sur le toit de la timonerie, au-dessus de soi ; ou, sa porte ouverte, dans la cabine
        // avant)
        return lieu === 'timonerie' && !ctx.porteOuverte;
      case 'coupCoque':
        return lieu === 'timonerie' && (ctx.calme ?? 0) > 40;
      case 'nom':
        // (la VHF grésille toute la nuit : personne ne répond plus)
        return true;
      case 'echoSuiveur':
      case 'echoProche':
        // (il faut un radar sous les yeux : la console de la timonerie)
        return lieu === 'timonerie';
      case 'porteAvant':
        // (fermée, dans la timonerie, et seulement quand on ne peut pas la voir — assis au
        // poste, la console la cache ; debout, dans son dos : on l'entend s'ouvrir, il faut se
        // retourner, se lever)
        return lieu === 'timonerie' && (ctx.porteAvant ?? 'fermee') === 'fermee' && (ctx.assis || angleVu(yeux, regard, PORTE_CABINE) > 80);
      default:
        return true;
    }
  }

  // Où apparaît la silhouette : sur le pont avant, au milieu (on la voit par le pare-brise),
  // un peu du côté où l'on se tient
  pointSilhouette(ctx, hauteur = 0) {
    const cote = Math.abs(ctx.yeux.x) > 0.3 ? Math.sign(ctx.yeux.x) : 0;
    return { x: SILHOUETTE.x + cote * 0.12, y: SILHOUETTE.y + hauteur, z: SILHOUETTE.z };
  }
  // Où apparaît la forme dans l'eau : à 2 m de la coque, par le travers, du côté où l'on
  // est, un peu en arrière des yeux (pas plus loin que le tableau arrière)
  pointForme(ctx) {
    const cote = ctx.yeux.x >= 0 ? 1 : -1;
    return { x: cote * 4.2, z: Math.min(zDe(0.06), ctx.yeux.z + 1.2) };
  }

  commencer(nom, ctx, evts) {
    const e = EVENEMENTS[nom];
    this.fois[nom]++;
    if (A_PART.has(nom)) this.derniers[nom] = this.t;
    else this.dernier = this.t;
    this.secouer(e.choc);
    const h = this.hasard;
    if (nom === 'silhouette' || nom === 'eclairSilhouette') {
      const p = this.pointSilhouette(ctx);
      // (de dos, regardant la mer ; dans l'éclair, face à nous)
      this.silhouette = { ...p, face: nom === 'eclairSilhouette' ? 0 : Math.PI, opacite: 0, age: 0, duree: nom === 'eclairSilhouette' ? 0.35 : 7 + 3 * h(), eclair: nom === 'eclairSilhouette' };
    } else if (nom === 'reflet') {
      this.reflet = { age: 0, duree: 9 + 4 * h(), opacite: 0, partie: false };
    } else if (nom === 'forme') {
      this.forme = { ...this.pointForme(ctx), age: 0, duree: 8 + 3 * h(), opacite: 0, coule: false };
    } else if (nom === 'chose') {
      // elle passe sous le bateau en biais, d'un bord à l'autre, en 16 secondes
      const cote = h() < 0.5 ? -1 : 1;
      const angle = cote * (0.5 + 0.5 * h()); // (sa route, par rapport au bateau)
      this.chose = { age: 0, duree: 16, cote, angle, x: 0, z: 0, force: 0, sous: false, sonde: null };
    } else if (nom === 'echoSuiveur' || nom === 'echoProche') {
      // le suiveur : abaft du travers, de 1,25 à 0,45 mille ; le proche : presque dans le
      // sillage, de 270 à 110 m (dans la zone de garde : l'alarme sonne)
      const cote = h() < 0.5 ? -1 : 1;
      const proche = nom === 'echoProche';
      const depart = proche ? 270 : 2300;
      this.echo = {
        nom, age: 0, duree: proche ? 26 + 6 * h() : 48 + 10 * h(),
        releve: cote * (proche ? 2.65 + 0.35 * h() : 1.75 + 0.6 * h()),
        depart, arrivee: proche ? 110 : 820, distance: depart, force: 0, alarme: false, vu: false,
      };
    }
    this.journal.push({ nom, heure: ctx.heure, regardee: false });
    evts.push(nom);
  }

  // ---------- Ce qui est en cours ----------
  suivreApparitions(dt, ctx, evts) {
    const { yeux, regard } = ctx;
    // la silhouette : elle reste tant qu'on ne la regarde pas ; regardée en face, elle
    // n'est plus là
    const s = this.silhouette;
    if (s) {
      s.age += dt;
      const e = surEcran(ctx, { x: s.x, y: s.y + 1.1, z: s.z });
      if (s.eclair) {
        // (elle n'existe que le temps de l'éclair)
        s.opacite = s.age < s.duree ? 1 : 0;
        if (s.age > s.duree) this.finir('silhouette', evts, false);
      } else {
        const regardee = enFace(e);
        s.opacite = Math.min(1, s.age / 0.8) * (1 - lisse(s.duree - 1.5, s.duree, s.age));
        if (regardee || s.age > s.duree || ctx.lieu !== 'timonerie') this.finir('silhouette', evts, regardee);
      }
    }
    // le reflet : il reste tant qu'on regarde le pare-brise ; on se retourne, il n'y a
    // personne (et quand on regarde à nouveau la vitre, il n'y est plus)
    const r = this.reflet;
    if (r) {
      r.age += dt;
      const devant = regard.z < -0.55;
      r.opacite = Math.min(1, r.age / 2.5) * (1 - lisse(r.duree - 2, r.duree, r.age));
      // (derrière toi, à 80 cm, la tête un peu plus haute que la tienne)
      r.x = yeux.x * 0.6;
      r.y = yeux.y + 0.08;
      r.z = yeux.z + 0.8;
      if (!devant || r.age > r.duree || ctx.lieu !== 'timonerie') this.finir('reflet', evts, !devant);
    }
    // la forme dans l'eau : elle suit le bateau ; regardée, elle coule
    const f = this.forme;
    if (f) {
      f.age += dt;
      if (enFace(surEcran(ctx, { x: f.x, y: 0.2, z: f.z })) && !f.coule) {
        f.coule = true;
        f.age = Math.max(f.age, f.duree - 0.6);
        this.noter('forme', true);
      }
      f.opacite = Math.min(1, f.age / 1.5) * (1 - lisse(f.duree - (f.coule ? 0.6 : 2), f.duree, f.age));
      if (f.age > f.duree) this.finir('forme', evts, f.coule);
    }
    // la chose sous la coque : elle passe, le sondeur la voit, puis plus rien
    const c = this.chose;
    if (c) {
      c.age += dt;
      const u = c.age / c.duree; // 0 → 1
      // (de 45 m d'un bord à 45 m de l'autre, en biais)
      const d = (u - 0.5) * 90;
      c.x = -c.cote * d * Math.cos(c.angle);
      c.z = d * Math.sin(c.angle) - 2;
      c.force = lisse(0, 0.2, u) * (1 - lisse(0.8, 1, u));
      c.sous = Math.abs(d) < 13;
      c.sonde = c.sous ? 5.6 + 1.6 * Math.abs(Math.sin(c.age * 1.7)) : null;
      if (c.age > c.duree) {
        this.chose = null;
        evts.push('chose-fin');
      }
    }
    // l'écho du radar : il garde son relèvement (il nous suit, quoi qu'on fasse) et se
    // rapproche ; quand un éclair montre la mer, il n'y a rien — au tour d'antenne suivant,
    // il n'est plus là (et l'alarme se tait)
    const o = this.echo;
    if (o) {
      o.age += dt;
      o.distance = o.depart + (o.arrivee - o.depart) * lisse(0, o.duree * 0.85, o.age);
      if (!o.vu && (ctx.eclair ?? 0) > 0.45) {
        o.vu = true;
        o.age = Math.max(o.age, o.duree - 1.2);
        const p = { x: Math.sin(o.releve) * o.distance, y: 0.5, z: -Math.cos(o.releve) * o.distance };
        this.noter(o.nom, enFace(surEcran(ctx, p)));
      }
      o.force = lisse(0, 3, o.age) * (1 - lisse(o.duree - (o.vu ? 1.2 : 4), o.duree, o.age));
      o.alarme = o.nom === 'echoProche' && o.age > 2.5 && o.force > 0.5;
      if (o.age > o.duree) {
        this.echo = null;
        evts.push(`${o.nom}-fin`);
      }
    }
  }

  finir(nom, evts, regardee) {
    if (nom === 'silhouette') this.silhouette = null;
    if (nom === 'reflet') this.reflet = null;
    if (nom === 'forme') this.forme = null;
    this.noter(nom, regardee);
    evts.push(`${nom}-fin`);
  }
  noter(nom, regardee) {
    const j = [...this.journal].reverse().find((e) => e.nom === nom || (nom === 'silhouette' && e.nom === 'eclairSilhouette'));
    if (j && regardee) j.regardee = true;
  }

  // Ce qu'il faut garder d'une nuit à l'autre (une partie reprise)
  instantane() {
    return { fois: { ...this.fois }, choc: this.choc };
  }
  restaurer(s) {
    if (!s) return;
    Object.assign(this.fois, s.fois ?? {});
    this.choc = s.choc ?? 0;
    this.silhouette = this.reflet = this.forme = this.chose = this.echo = null;
    this.dernier = this.t;
  }
}
