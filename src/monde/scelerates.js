// Les vagues scélérates : ce qui les fait vivre. Une vague naît loin au vent du bateau
// (1 150 m : une minute et demie avant le choc s'il fuit devant elle), grandit en
// approchant, sa crête s'écroule dans les 350 derniers mètres, passe sur le bateau, puis
// s'efface sous le vent. Sa forme est dans mer/scelerate.js (la houle l'ajoute à ses
// vagues : la physique la sent, la mer la dessine).
//
// Comme pour les déferlantes (monde/deferlantes.js), rien ici ne dessine ni ne fait de
// bruit : la nuit (quart/nuit.js), l'atelier de la mer et l'essai automatique
// (scripts/test-scelerate.js) s'en servent de la même façon.
import { Vector3 } from 'three';
import { creerScelerate, repereScelerate } from '../mer/scelerate.js';

export const DISTANCE_NAISSANCE = 1150;
// Les étapes de son passage, selon la distance entre sa crête et le bateau (m, le long de
// sa course ; négative : elle est passée). Les plus proches suivent sa longueur d'onde L
// (le creux de devant est à une demi-longueur de la crête).
export function etapesPour(L) {
  return [
    ['grondement', 980], // on commence à l'entendre
    ['annonce', 880], // on la signale (Jos, le radar)
    ['proche', 2.35 * L], // sa crête commence à s'écrouler
    ['trou', 0.5 * L], // le creux de devant : la mer se dérobe sous le bateau
    // (la nuit) un éclair la montre, le bateau au fond du creux : un mur noir de vingt
    // mètres au-dessus de l'arrière (plus près, le bateau est déjà soulevé sur sa pente :
    // on ne la voit plus au-dessus de soi)
    ['eclair', 0.4 * L],
    ['choc', 2], // sa crête sur le bateau
    ['passee', -1.3 * L], // derrière
    ['finie', -950],
  ];
}
// La poussée de sa crête qui s'écroule sur le bateau (une déferlante ordinaire : 0,3 à 1,2,
// en 0,7 s, sur la hanche ou l'épaule) : une crête de 400 m frappe toute la coque à la fois,
// pendant une seconde. (Pour une vague de 20 m, le plus dur est sa pente : le bateau surfe,
// part en travers s'il ne la prend pas droit derrière ; le choc s'y ajoute — plus fort, il
// couchait le bateau une fois sur trois, même droit dans l'arrière : reglage-scelerate.js)
export const FORCE_CHOC = 0.5;
const CHOC = { levier: 0.35, duree: 1.0 };

const lisse = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export class Scelerates {
  constructor(houle) {
    this.houle = houle;
    this.vague = null; // { v (la forme), distance, travers, age, faites }
  }

  get active() { return this.vague !== null; }

  // En lance une vers le bateau (x, z) : (dx, dz) est la direction où elle va ; sa
  // longueur d'onde et la longueur de sa crête suivent sa hauteur (mer/scelerate.js)
  lancer({ x, z, dx, dz, hauteur = 20, longueur, largeur, distance = DISTANCE_NAISSANCE }) {
    this.finir();
    const n = Math.hypot(dx, dz) || 1;
    const v = creerScelerate({
      x: x - (dx / n) * distance, z: z - (dz / n) * distance, dx, dz, hauteur, longueur, largeur, tPassage: this.houle.temps,
    });
    this.vague = { v, distance, travers: 0, age: 0, faites: new Set(), etapes: etapesPour(v.longueur) };
    this.houle.scelerates.push(v);
    return this.vague;
  }

  // Elle disparaît (finie, ou la partie reprend plus tôt)
  finir() {
    const w = this.vague;
    if (!w) return;
    const i = this.houle.scelerates.indexOf(w.v);
    if (i >= 0) this.houle.scelerates.splice(i, 1);
    this.vague = null;
  }

  // Une image : le bateau est en (x, z) ; renvoie les étapes franchies à cette image
  maj(dt, x, z) {
    const w = this.vague;
    if (!w) return [];
    const v = w.v;
    w.age += dt;
    const [s, l] = repereScelerate(v, x, z, this.houle.temps);
    w.distance = s;
    w.travers = l;
    // (sa crête vise le bateau : s'il file le long d'elle, elle se recentre doucement sur
    // lui — elle est si longue qu'on ne le voit pas)
    if (s > 40 && Math.abs(l) > 4) {
      const pas = Math.sign(l) * Math.min(Math.abs(l) - 4, 3.5 * dt);
      v.x += -v.dz * pas;
      v.z += v.dx * pas;
    }
    // elle grandit en approchant ; derrière le bateau, elle s'efface
    v.force = lisse(DISTANCE_NAISSANCE, 380, s) * (1 - lisse(-80, -750, s));
    // sa crête s'écroule dans les deux dernières longueurs d'onde (350 m), et s'apaise une
    // fois passée
    const L = v.longueur;
    v.deferle = lisse(2.36 * L, 0.82 * L, s) * (1 - lisse(-0.27 * L, -2 * L, s));
    const etapes = [];
    for (const [nom, d] of w.etapes) {
      if (s < d && !w.faites.has(nom)) {
        w.faites.add(nom);
        etapes.push(nom);
      }
    }
    if (w.faites.has('finie')) this.finir();
    return etapes;
  }

  // La direction où elle va (dans le monde)
  direction(sortie = new Vector3()) {
    const v = this.vague?.v;
    return v ? sortie.set(v.dx, 0, v.dz) : sortie.set(0, 0, 0);
  }

  // Le cap (degrés) qui la met droit dans l'arrière du bateau
  get capPourLaFuir() {
    const v = this.vague?.v;
    return v ? ((Math.atan2(v.dx, -v.dz) * 180) / Math.PI + 360) % 360 : null;
  }
}

// Le choc : sa crête qui s'écroule frappe le bateau (physique : physique/voilier.js) ;
// renvoie la force et l'angle d'où elle arrive (0 : de face, 90 : de travers, 180 : de
// l'arrière), et l'eau qui embarque (litres, dans le cockpit et à l'intérieur)
export function chocScelerate(physique, scelerates, { porteOuverte = false } = {}) {
  const v = scelerates.vague?.v;
  if (!v) return null;
  const force = FORCE_CHOC * Math.max(0.4, v.deferle) * Math.min(1, v.hauteur / 11);
  const angle = physique.deferlante(new Vector3(v.dx, 0, v.dz), force, CHOC);
  // de travers, ou par l'arrière, une masse d'eau verte remplit le cockpit
  const r = (angle * Math.PI) / 180;
  const prise = angle < 90 ? 0.3 + 0.7 * Math.sin(r) : 0.8 + 0.2 * Math.sin(r);
  return {
    force, angle, prise,
    cockpit: force * prise * 520,
    interieur: force * prise * (porteOuverte ? 160 : 14),
  };
}
