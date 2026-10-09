// Le marin : ce que l'on est dans le jeu, à pied sur le bateau.
//
// Sa position est gardée dans le repère du BATEAU (le bateau l'emporte avec lui quand
// il avance, tangue et roule). Chaque image :
//  1. il marche où on lui dit (Z Q S D), plus lentement s'il se tient (Maj) ou s'accroupit ;
//  2. le pont penche et bouge : la « pesanteur ressentie » (la vraie, plus les secousses
//     du bateau) n'est plus perpendiculaire au pont. Tant que l'antidérapant tient
//     (frottement), il reste debout ; au-delà, il glisse vers le bas du pont — sauf s'il
//     se tient. Les filières l'arrêtent… tant que le bateau ne se couche pas ;
//  3. il suit les surfaces du pont (pont.js) : monte les marches, les descend, enjambe le
//     bord penché du rouf, se cogne aux murs ;
//  4. il a un corps : rien de dur n'entre dans ses hanches, sa poitrine ni ses yeux (la
//     caméra). Ce qui est dur vient du vrai modèle 3D (encombrement.js), plus la bôme,
//     qui bouge : il baisse la tête dessous, ou, trop basse, elle lui barre le passage.
//     (La barre franche, à hauteur des genoux, on l'enjambe.) Quand quelque chose l'arrête,
//     il glisse le long (un coin de meuble, un montant de porte ne le collent pas sur
//     place), et quand il marche vers la porte de la timonerie, il s'aligne sur son milieu.
import { Vector3 } from 'three';
import { solEn, plafondEn, margeAuBord, dansLaTimonerie, PASSAGES, bloqueParLaPorte } from './pont.js';
import { zDe, MAT } from '../bateau/forme.js';

const SUR_LE_PONT = new Set(['passavant', 'pont-avant', 'pont-arriere', 'rouf', 'rouf-panneau', 'hiloire']);

const YEUX_DEBOUT = 1.62;
const YEUX_ACCROUPI = 1.1;
const YEUX_PLIE = 0.95; // plié en deux : le plus bas qu'on baisse la tête pour passer sous la bôme
const SOUS_PLAFOND = 0.17; // les yeux restent à 17 cm sous un plafond (le haut du crâne est 12 cm au-dessus)
const RAYON_YEUX = 0.15; // la caméra voit à partir de 5 cm : avec 15 cm de marge, elle ne traverse rien
const CORPS = [[0.75, 0.13], [1.2, 0.16]]; // [hauteur au-dessus des pieds, rayon] : les hanches, la poitrine
const ENJAMBEE = 0.12; // on enjambe un vide de 12 cm (le bord penché du rouf, entre le passavant et le toit)

// Distance (vue de dessus) du point (x, z) au segment [a, b] ; t : où sur le segment (0 → 1)
function versSegment(x, z, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
  return { d: Math.hypot(x - (ax + dx * t), z - (az + dz * t)), t };
}

export class Marin {
  constructor() {
    this.position = new Vector3(-0.2, 0.45, zDe(0.17)); // ses pieds (repère du bateau)
    this.lacet = 0; // vers où il est tourné (rad) : 0 = vers l'avant, + = vers bâbord
    this.site = -0.1; // hauteur du regard (rad)
    this.vy = 0;
    this.glissade = new Vector3();
    this.accroupi = false;
    this.attache = false; // harnais accroché à la ligne de vie
    this.etourdi = 0; // secondes pendant lesquelles il ne peut plus bouger (choc)
    this.zone = 'cockpit';
    this.yeux = YEUX_DEBOUT;
    this.phasePas = 0;
    this.balancement = 0;
    this.vitesseMarche = 0;
    // ce qui est dur à bord (encombrement.js) : donné par le jeu une fois le bateau construit
    this.encombrement = null;
    // les pièces qui bougent, mises à jour par le jeu à chaque image (repère du bateau) :
    // bome : { x, y, z (le pivot au mât), angle, longueur, rayon }
    this.pieces = { bome: null };
    this.sousLaBome = false; // (il a baissé la tête pour passer dessous)
    this.coteGlisse = 1; // (le côté par lequel il a contourné un obstacle à l'image d'avant)
    this._f = new Vector3();
    this._d = new Vector3();
    this._dep = new Vector3();
    this._avant = new Vector3();
  }

  // (dehors : sur le pont ou dans le cockpit ; la timonerie est dedans)
  get dehors() { return this.position.y > 0.3 && !dansLaTimonerie(this.position.x, this.position.z); }
  get dansLaTimonerie() { return dansLaTimonerie(this.position.x, this.position.z); }
  get surLePont() { return SUR_LE_PONT.has(this.zone); }

  // Direction du regard dans le repère du bateau
  direction(sortie = new Vector3()) {
    const c = Math.cos(this.site);
    return sortie.set(-Math.sin(this.lacet) * c, Math.sin(this.site), -Math.cos(this.lacet) * c);
  }

  // Hauteur des yeux au-dessus du pont (lissée) : debout, accroupi, ou tête baissée sous un plafond
  hauteurYeux() { return this.yeux + this.balancement; }

  // La hauteur des yeux voulue en (x, z), les pieds à y : debout ou accroupi, moins ce
  // qu'il faut pour passer sous un plafond (le plan, le vrai modèle) ou sous la bôme.
  // (sous la bôme trop basse pour s'y glisser, même plié en deux : une valeur négative)
  yeuxEn(x, z, y) {
    let h = this.accroupi ? YEUX_ACCROUPI : YEUX_DEBOUT;
    h = Math.min(h, plafondEn(x, z, y) - y - SOUS_PLAFOND);
    const g = this.encombrement;
    if (g) {
      // le plafond dessiné, au-dessus de la tête et un peu autour (un barrot, le bord d'un
      // trou) ; plus bas que ce sous quoi l'on passe plié en deux, ce n'est pas un plafond
      // mais un mur (une étagère, un ciré pendu) : le corps s'y arrête
      for (const [ox, oz] of [[0, 0], [0.1, 0], [-0.1, 0], [0, 0.1], [0, -0.1]]) {
        for (const p of g.verticale(x + ox, z + oz, y + YEUX_PLIE + SOUS_PLAFOND, y + YEUX_DEBOUT + SOUS_PLAFOND)) {
          h = Math.min(h, p.y - y - SOUS_PLAFOND);
        }
      }
      // une paroi penchée au-dessus de soi (le pare-brise, la console du plafond) : on
      // baisse la tête jusqu'à ce qu'elle passe (un mur droit, lui, reste
      // un mur : plié en deux, la tête le touche encore, et le corps s'y arrête)
      // (le même seuil que degagement() : sinon, entre les deux, la tête « passe » ici et
      // « touche » là, et le marin reste coincé)
      for (let k = 0; k < 6 && h > YEUX_PLIE + 0.05 && g.distance(x, y + h, z, RAYON_YEUX) < RAYON_YEUX; k++) h -= 0.06;
    }
    const b = this.pieces.bome;
    if (b) {
      const s = versSegment(x, z, b.x, b.z, b.x + Math.sin(b.angle) * b.longueur, b.z + Math.cos(b.angle) * b.longueur);
      // (on commence à baisser la tête 30 cm avant d'être dessous)
      if (s.d < b.rayon + 0.3) {
        const sous = b.y - b.rayon - RAYON_YEUX - y;
        if (sous < h) {
          // trop basse pour passer dessous, même plié en deux : elle barre le passage (une
          // valeur négative, d'autant plus qu'on est près d'elle : s'en éloigner est permis)
          if (sous >= YEUX_PLIE) h = sous;
          else h = s.d < b.rayon + 0.2 ? s.d / (b.rayon + 0.2) - 1 : YEUX_PLIE;
        }
      }
    }
    return h;
  }

  // À quel point le marin est-il dégagé en (x, z), les pieds à y, les yeux à hYeux au-dessus ?
  // ≥ 1 : rien ne le touche ; moins : quelque chose entre dans son corps ou ses yeux.
  degagement(x, z, y, hYeux) {
    if (hYeux < 0) return hYeux;
    let d = 1;
    const g = this.encombrement;
    if (g) {
      d = Math.min(d, g.distance(x, y + hYeux, z, RAYON_YEUX) / RAYON_YEUX);
      for (const [h, r] of CORPS) {
        if (h < hYeux - 0.2) d = Math.min(d, g.distance(x, y + h, z, r) / r);
      }
    }
    return d;
  }

  // entrees : { avance, lateral (-1 → 1), tenir, accroupir }
  // pesanteur : la pesanteur ressentie, dans le repère du bateau (m/s², vers le bas)
  // renvoie ce qui s'est passé : { horsBord: true } si le marin passe par-dessus bord,
  // { chute: hauteur } s'il est tombé de haut
  maj(dt, entrees, pesanteur) {
    const evenements = {};
    this.etourdi = Math.max(0, this.etourdi - dt);
    this.accroupi = entrees.accroupir;

    // 1. là où il veut aller
    let vitesse = 1.35;
    if (entrees.tenir) vitesse *= 0.4;
    if (this.accroupi) vitesse *= 0.55;
    if (!this.dehors) vitesse *= 0.8;
    if (this.sousLaBome) vitesse *= 0.6;
    if (this.etourdi > 0) vitesse = 0;
    const f = this._f.set(-Math.sin(this.lacet), 0, -Math.cos(this.lacet));
    const d = this._d.set(Math.cos(this.lacet), 0, -Math.sin(this.lacet));
    const souhait = f.multiplyScalar(entrees.avance).addScaledVector(d, entrees.lateral);
    if (souhait.lengthSq() > 1) souhait.normalize();
    souhait.multiplyScalar(vitesse);
    this.guiderVersLesPassages(souhait, vitesse, dt);

    // 2. le pont penche : la part de la pesanteur « dans le plan du pont » le pousse
    const normale = Math.max(0, -pesanteur.y);
    const tangente = new Vector3(pesanteur.x, 0, pesanteur.z);
    const pente = tangente.length();
    const couche = pente > normale * 1.6; // pont incliné de plus de ~58° : le bateau se couche
    const frottement = (this.accroupi ? 0.95 : 0.72) * normale;
    const exces = pente - frottement;
    const peutGlisser = this.surLePont || this.zone === 'banc';
    if (exces > 0 && peutGlisser && !(entrees.tenir && exces < 6)) {
      this.glissade.addScaledVector(tangente.normalize(), exces * dt);
    }
    this.glissade.multiplyScalar(Math.exp(-dt * (exces > 0 ? 1.2 : 7)));

    // 3. le déplacement, surface par surface (on glisse le long des murs)
    const dep = this._dep.copy(souhait).add(this.glissade).multiplyScalar(dt);
    const avant = this._avant.copy(this.position);
    // (arrêté : il contourne ce qui le bloque, sauf quand le bateau se couche — là, plaqué
    // contre les filières, il ne glisse pas le long : il y reste, ou passe par-dessus)
    if (!this.essayer(dep.x, dep.z) && (couche || !this.contourner(dep.x, dep.z))) {
      const okX = this.essayer(dep.x, 0);
      const okZ = this.essayer(0, dep.z);
      if (!okX) this.glissade.x = 0;
      if (!okZ) this.glissade.z = 0;
      // poussé contre les filières alors que le bateau se couche : par-dessus bord
      const versLeBord = Math.sign(dep.x) === Math.sign(this.position.x);
      const marge = margeAuBord(this.position.x, this.position.z);
      if (!okX && versLeBord && marge < 0.3 && this.surLePont && couche) {
        if (!this.attache && !entrees.tenir) evenements.horsBord = true;
        else if (this.attache) evenements.retenu = true; // le harnais l'a retenu
      }
    }
    const parcouru = avant.distanceTo(this.position) / Math.max(dt, 1e-4);
    this.vitesseMarche += (parcouru - this.vitesseMarche) * Math.min(1, dt * 8);

    // 4. la hauteur : il monte et descend les marches en souplesse ; d'un endroit plus
    // haut qu'une marche, il tombe
    const sol = solEn(this.position.x, this.position.z, this.position.y);
    const ySol = sol ? sol.y : this.position.y;
    if (sol) this.zone = sol.nom;
    const ecart = ySol - this.position.y;
    if (ecart > 0) {
      this.position.y += Math.min(ecart, dt * Math.max(1.2, ecart * 8));
      this.vy = 0;
    } else if (ecart < 0) {
      if (this.vy === 0 && ecart > -0.5) {
        // une marche : on descend en posant le pied
        this.position.y += Math.max(ecart, -dt * Math.max(1.2, -ecart * 8));
      } else {
        if (this.vy === 0) this.hautChute = this.position.y;
        this.vy -= 9.81 * dt;
        this.position.y = Math.max(ySol, this.position.y + this.vy * dt);
        if (this.position.y === ySol) {
          if (this.hautChute - ySol > 0.8) evenements.chute = this.hautChute - ySol;
          this.vy = 0;
        }
      }
    }

    // 5. les yeux : debout 1,62 m, accroupi 1,10 m, et on baisse la tête sous un plafond
    // ou sous la bôme (en regardant un peu devant soi)
    const p = this.position;
    let cible = this.yeuxEn(p.x, p.z, p.y);
    const vx = (p.x - avant.x) / Math.max(dt, 1e-4);
    const vz = (p.z - avant.z) / Math.max(dt, 1e-4);
    const debout = this.accroupi ? YEUX_ACCROUPI : YEUX_DEBOUT;
    const v = Math.hypot(vx, vz);
    if (v > 0.1) {
      // (35 cm devant, s'il y a un plafond ou la bôme : les yeux ne devront pas dépasser
      // cette hauteur-là ; les pieds seront sur le sol de là-bas, plus bas d'une marche)
      const ax = p.x + (vx / v) * 0.35;
      const az = p.z + (vz / v) * 0.35;
      const solDevant = solEn(ax, az, p.y);
      const hDevant = solDevant ? this.yeuxEn(ax, az, solDevant.y) : debout;
      if (hDevant < debout - 0.01) cible = Math.min(cible, hDevant + solDevant.y - p.y);
    }
    this.sousLaBome = cible < debout - 0.05 && p.y > 0.3;
    cible = Math.max(cible, YEUX_PLIE * 0.9);
    // (on baisse la tête plus vite qu'on ne la relève, et jamais d'un coup)
    const pas = (cible - this.yeux) * Math.min(1, dt * (cible < this.yeux ? 9 : 6));
    this.yeux += Math.max(-2.5 * dt, Math.min(1.5 * dt, pas));
    // le léger balancement de la tête quand on marche
    if (this.vitesseMarche > 0.25) this.phasePas += dt * this.vitesseMarche * 5.2;
    this.balancement = Math.sin(this.phasePas) * 0.022 * Math.min(1, this.vitesseMarche);
    return evenements;
  }

  // Le marin peut-il aller en (x, z) ? (une surface où poser le pied, et de la place pour
  // son corps : plus que là où il est, s'il est déjà serré)
  praticable(x, z, maintenant) {
    const sol = solEn(x, z, this.position.y);
    if (!sol) return null;
    if (!this.encombrement && !this.pieces.bome) return sol;
    const libre = this.degagement(x, z, sol.y, this.yeuxEn(x, z, sol.y));
    return libre >= 1 || libre > maintenant + 1e-6 ? sol : null;
  }

  // déplace si la destination est praticable ; sinon ne bouge pas. Un vide étroit (le
  // bord penché du rouf) s'enjambe : on pose le pied juste derrière.
  essayer(dx, dz) {
    if (dx === 0 && dz === 0) return true;
    const p = this.position;
    const maintenant = this.encombrement || this.pieces.bome
      ? this.degagement(p.x, p.z, p.y, this.yeuxEn(p.x, p.z, p.y)) : 1;
    let x = p.x + dx;
    let z = p.z + dz;
    if (bloqueParLaPorte(p.x, p.z, x, z)) return false;
    if (!this.praticable(x, z, maintenant)) {
      if (solEn(x, z, p.y)) return false; // (un sol, mais pas la place : un mur pour le corps)
      // un vide : y a-t-il un sol juste derrière ?
      const l = Math.hypot(dx, dz);
      let trouve = false;
      for (let s = 0.04; s <= ENJAMBEE + 1e-6 && !trouve; s += 0.04) {
        const ex = x + (dx / l) * s;
        const ez = z + (dz / l) * s;
        if (!bloqueParLaPorte(p.x, p.z, ex, ez) && this.praticable(ex, ez, maintenant)) { x = ex; z = ez; trouve = true; }
      }
      if (!trouve) return false;
    }
    p.x = x;
    p.z = z;
    return true;
  }

  // Arrêté net dans la direction (dx, dz) : il essaie la même direction, tournée de plus
  // en plus d'un côté puis de l'autre (20°, 40°, 60°), en n'avançant que de ce qui reste
  // dans la direction voulue — il glisse le long d'un mur, contourne un coin. Il commence
  // par le côté qui a marché la dernière fois (sinon, devant un coin, il hésiterait d'une
  // image à l'autre). Renvoie true s'il a bougé.
  contourner(dx, dz) {
    const cotes = this.coteGlisse < 0 ? [-1, 1] : [1, -1];
    for (const a of [0.35, 0.7, 1.05]) {
      const c = Math.cos(a);
      const s = Math.sin(a);
      for (const k of cotes) {
        const gx = (dx * c - dz * s * k) * c;
        const gz = (dx * s * k + dz * c) * c;
        if (this.essayer(gx, gz)) {
          this.coteGlisse = k;
          return true;
        }
      }
    }
    return false;
  }

  // En marchant vers un passage étroit (la porte de la timonerie), à peu près de face et
  // à moins de 90 cm de son seuil, il dérive vers son milieu : de plus en plus près du
  // seuil, jamais au-delà du milieu. (S'il marche de biais, de plus de 45°, ou s'il s'en
  // éloigne, rien ne change : il va peut-être ailleurs.)
  guiderVersLesPassages(souhait, vitesse, dt) {
    const v = Math.hypot(souhait.x, souhait.z);
    if (v < 0.05) return;
    for (const p of PASSAGES) {
      const versSeuil = p.z - this.position.z;
      if (Math.abs(versSeuil) > 0.9 || Math.abs(versSeuil) < 0.02) continue;
      // (il va vers le seuil, de face à 45° près)
      if (souhait.z * Math.sign(versSeuil) < 0.7 * v) continue;
      const ecart = this.position.x - p.x;
      if (Math.abs(ecart) > p.demiLargeur + 0.5) continue;
      const proche = Math.min(1, (0.9 - Math.abs(versSeuil)) / 0.6);
      const derive = -ecart * 3.2 * proche * (v / Math.max(vitesse, 0.1));
      // (sans dépasser le milieu d'ici la prochaine image)
      souhait.x += Math.sign(derive) * Math.min(Math.abs(derive), Math.abs(ecart) / Math.max(dt, 1e-3));
    }
  }

  // Le replacer quelque part (prendre la barre, se relever, ressortir de la cabine)
  placer(x, y, z) {
    this.position.set(x, y, z);
    this.vy = 0;
    this.glissade.set(0, 0, 0);
    const sol = solEn(x, z, y + 0.1);
    if (sol) this.zone = sol.nom;
  }

  // Les pièces qui bougent, lues sur le modèle 3D du bateau (à appeler à chaque image)
  suivrePieces(bateau) {
    const pb = bateau.pivotBome;
    const b = (this.pieces.bome ??= { x: 0, y: 0, z: 0, angle: 0, longueur: MAT.bome, rayon: 0.075 });
    b.x = pb.position.x;
    b.y = pb.position.y;
    b.z = pb.position.z;
    b.angle = pb.rotation.y;
  }
}
