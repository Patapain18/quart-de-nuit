// Le marin : ce que l'on est dans le jeu, à pied sur le bateau.
//
// Sa position est gardée dans le repère du BATEAU (le bateau l'emporte avec lui quand
// il avance, tangue et roule). Chaque image :
//  1. il marche où on lui dit (Z Q S D), plus lentement s'il se tient (Maj) ou s'accroupit ;
//  2. le pont penche et bouge : la « pesanteur ressentie » (la vraie, plus les secousses
//     du bateau) n'est plus perpendiculaire au pont. Tant que l'antidérapant tient
//     (frottement), il reste debout ; au-delà, il glisse vers le bas du pont — sauf s'il
//     se tient. Les filières l'arrêtent… tant que le bateau ne se couche pas ;
//  3. il suit les surfaces du pont (pont.js) : monte les marches, descend, se cogne aux murs.
import { Vector3 } from 'three';
import { solEn, plafondEn, margeAuBord } from './pont.js';
import { zDe } from '../bateau/forme.js';

const SUR_LE_PONT = new Set(['passavant', 'pont-avant', 'pont-arriere', 'rouf', 'hiloire']);

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
    this.yeux = 1.62;
    this.phasePas = 0;
    this.balancement = 0;
    this.vitesseMarche = 0;
    this._f = new Vector3();
    this._d = new Vector3();
  }

  get dehors() { return this.position.y > 0.3; }
  get surLePont() { return SUR_LE_PONT.has(this.zone); }

  // Direction du regard dans le repère du bateau
  direction(sortie = new Vector3()) {
    const c = Math.cos(this.site);
    return sortie.set(-Math.sin(this.lacet) * c, Math.sin(this.site), -Math.cos(this.lacet) * c);
  }

  // Hauteur des yeux au-dessus du pont (lissée) : debout, accroupi, ou tête baissée sous un plafond
  hauteurYeux() { return this.yeux + this.balancement; }

  // entrees : { avance, lateral (-1 → 1), tenir, accroupir }
  // pesanteur : la pesanteur ressentie, dans le repère du bateau (m/s², vers le bas)
  // renvoie ce qui s'est passé : { horsBord: true } si le marin passe par-dessus bord
  maj(dt, entrees, pesanteur) {
    const evenements = {};
    this.etourdi = Math.max(0, this.etourdi - dt);
    this.accroupi = entrees.accroupir;

    // 1. là où il veut aller
    let vitesse = 1.35;
    if (entrees.tenir) vitesse *= 0.4;
    if (this.accroupi) vitesse *= 0.55;
    if (!this.dehors) vitesse *= 0.8;
    if (this.etourdi > 0) vitesse = 0;
    const f = this._f.set(-Math.sin(this.lacet), 0, -Math.cos(this.lacet));
    const d = this._d.set(Math.cos(this.lacet), 0, -Math.sin(this.lacet));
    const souhait = f.multiplyScalar(entrees.avance).addScaledVector(d, entrees.lateral);
    if (souhait.lengthSq() > 1) souhait.normalize();
    souhait.multiplyScalar(vitesse);

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
    const dep = souhait.clone().add(this.glissade).multiplyScalar(dt);
    const avant = this.position.clone();
    if (!this.essayer(dep.x, dep.z)) {
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

    // 4. la hauteur : il monte les marches tout de suite, il tombe en descendant
    const sol = solEn(this.position.x, this.position.z, this.position.y);
    const ySol = sol ? sol.y : this.position.y;
    if (sol) this.zone = sol.nom;
    if (ySol > this.position.y) {
      this.position.y += Math.min(ySol - this.position.y, dt * 2.5);
      this.vy = 0;
    } else if (ySol < this.position.y) {
      this.vy -= 9.81 * dt;
      this.position.y = Math.max(ySol, this.position.y + this.vy * dt);
      if (this.position.y === ySol) this.vy = 0;
    }

    // 5. les yeux : debout 1,62 m, accroupi 1,10 m, et on baisse la tête sous un plafond
    let cible = this.accroupi ? 1.1 : 1.62;
    const plafond = plafondEn(this.position.x, this.position.z, this.position.y);
    cible = Math.min(cible, plafond - this.position.y - 0.13);
    this.yeux += (cible - this.yeux) * Math.min(1, dt * 7);
    // le léger balancement de la tête quand on marche
    if (this.vitesseMarche > 0.25) this.phasePas += dt * this.vitesseMarche * 5.2;
    this.balancement = Math.sin(this.phasePas) * 0.022 * Math.min(1, this.vitesseMarche);
    return evenements;
  }

  // déplace si la destination est praticable ; sinon ne bouge pas
  essayer(dx, dz) {
    if (dx === 0 && dz === 0) return true;
    const x = this.position.x + dx;
    const z = this.position.z + dz;
    const sol = solEn(x, z, this.position.y);
    if (!sol) return false;
    this.position.x = x;
    this.position.z = z;
    return true;
  }

  // Le replacer quelque part (prendre la barre, se relever, ressortir de la cabine)
  placer(x, y, z) {
    this.position.set(x, y, z);
    this.vy = 0;
    this.glissade.set(0, 0, 0);
    const sol = solEn(x, z, y + 0.1);
    if (sol) this.zone = sol.nom;
  }
}
