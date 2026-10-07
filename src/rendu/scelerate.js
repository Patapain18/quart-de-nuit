// La vague scélérate en 3D. Sa forme est dans la mer (eau.js la dessine, avec l'écume qui
// dévale son front et la traîne qu'elle laisse) ; ici, ce qui ne tient pas dans une
// surface : la lèvre de sa crête qui s'écroule — une crête de déferlante
// (rendu/deferlantes.js) en très grand, posée sur la sienne — et les embruns que le vent
// lui arrache. La nuit, toute la lèvre s'allume de plancton : une ligne bleu-vert qui
// avance dans le noir.
import * as THREE from 'three';
import { Crete, materiauEcume, PROFIL, RANG_LEVRE } from './deferlantes.js';
import { positionCrete, repereScelerate } from '../mer/scelerate.js';

const NU = 84; // sommets le long de la crête
// (pour une vague de 11 m : la lèvre grandit avec la vague)
const ECHELLE = 2.2; // le profil en travers des déferlantes, agrandi
const HAUTEUR_LEVRE = 3.4; // m : la hauteur de la lèvre au-dessus de la crête (au plus fort)
const NV = PROFIL.length - 1;

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Scelerate3D {
  constructor(scene, houle, eau, embruns) {
    this.houle = houle;
    this.embruns = embruns;
    this.crete = new Crete(materiauEcume(eau), NU);
    this.crete.materiau.userData.uniforms.uEchelle.value = ECHELLE;
    scene.add(this.crete.mesh);
    this.vie = 0;
    this._c = [0, 0];
    this._r = [0, 0];
    this._p = new THREE.Vector3();
  }

  get mesh() { return this.crete.mesh; }

  // centre : la position du bateau (monde), ou null ; nuit : 0 → 1 ; vent : (m/s, monde)
  maj(dt, temps, { centre = null, nuit = 0, vent = null } = {}) {
    const v = this.houle.scelerates[0];
    const c = this.crete;
    const t = this.houle.temps;
    // (sur le bateau, la lèvre se cache : l'eau verte sur le pont, les embruns et les
    // gouttes sur les yeux prennent le relais)
    let surLeBateau = 0;
    if (v && centre) {
      const [s, l] = repereScelerate(v, centre.x, centre.z, t, this._r);
      surLeBateau = (1 - lisse(1, 5, s)) * lisse(-12, -5, s) * (1 - lisse(40, 90, Math.abs(l)));
    }
    const voulue = v ? v.deferle * (1 - surLeBateau) : 0;
    this.vie += (voulue - this.vie) * Math.min(1, dt * 3);
    if (!v || this.vie < 0.01) {
      c.mesh.visible = false;
      return;
    }
    c.mesh.visible = true;
    const longueur = 2.6 * v.largeur;
    const taille = Math.min(2.2, Math.max(0.8, v.hauteur / 11));
    const u = c.materiau.userData.uniforms;
    u.uEchelle.value = ECHELLE * taille;
    u.uTemps.value = temps;
    u.uVie.value = Math.min(1, this.vie * 1.2);
    u.uPhospho.value = nuit * 2.8;
    u.uLongueur.value = longueur;
    const [cx, cz] = positionCrete(v, t, this._c);
    const dx = v.dx;
    const dz = v.dz;
    const px = -dz;
    const pz = dx;
    const pos = c.positions;
    let k = 0;
    for (let j = 0; j <= NV; j++) {
      const [recul, haut] = PROFIL[j];
      for (let i = 0; i <= NU; i++) {
        const s = i / NU - 0.5;
        const l = s * longueur;
        const el = Math.exp(-((l / v.largeur) ** 2));
        // (la lèvre n'est pas droite : elle ondule, déchiquetée, et ses bouts traînent)
        const courbe = Math.sin(l * 0.031 + 1.3) * 2.2 + Math.sin(l * 0.087 + temps * 0.4) * 0.9 + (1 - el) * 6;
        const r = recul * ECHELLE * taille * (0.55 + 0.45 * el) + courbe;
        const x = cx + px * l - dx * r;
        const z = cz + pz * l - dz * r;
        const bosse = HAUTEUR_LEVRE * taille * this.vie * haut * el * (0.85 + 0.15 * Math.sin(l * 0.21 + temps * 1.7));
        // (le sommet est un point d'eau « au repos » : il suit l'eau, poussé par les vagues
        // — une seule lecture de la houle, au lieu de chercher l'eau qui arrive en (x, z))
        const d = this.houle.lire(x, z);
        pos[k++] = x + d[0];
        pos[k++] = d[1] + bosse + 0.08;
        pos[k++] = z + d[2];
      }
    }
    c.geometrie.attributes.position.needsUpdate = true;
    c.geometrie.computeVertexNormals();
    // le vent arrache des embruns au sommet de la lèvre : une poussière d'eau, et une brume
    // qui fume derrière la crête (plus près du bateau : on les voit passer)
    if (this.embruns && this.vie > 0.25) {
      const n = Math.floor(70 * dt * 30 * this.vie * taille);
      for (let q = 0; q < n; q++) {
        const s = (Math.random() - 0.5) * 0.7;
        const i = Math.round((s + 0.5) * NU);
        const kk = (RANG_LEVRE * (NU + 1) + i) * 3;
        this._p.set(pos[kk], pos[kk + 1] + 0.2, pos[kk + 2]);
        if (centre && this._p.distanceToSquared(centre) > 250 * 250) continue;
        const brume = Math.random() < 0.25;
        this.embruns.emettre(this._p, {
          vx: dx * (v.vitesse + 1) + (vent?.x ?? 0) * 0.35 + (Math.random() - 0.5) * 3,
          vy: (brume ? 1 : 2) + Math.random() * 4.5,
          vz: dz * (v.vitesse + 1) + (vent?.z ?? 0) * 0.35 + (Math.random() - 0.5) * 3,
          vie: brume ? 1.5 + Math.random() * 1.5 : 0.8 + Math.random() * 1.1,
          taille: brume ? 1 + Math.random() * 2 : 0.02 + Math.random() * 0.06,
          opacite: brume ? 0.08 : 0.6,
          phospho: Math.random() < 0.35 ? 1 : 0,
        });
      }
    }
  }
}
