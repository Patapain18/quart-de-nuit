// Le régulateur : garder le jeu fluide sur tous les ordinateurs (la qualité « Auto »).
//
// Il regarde le temps entre deux images — ce que l'œil voit : il compte tout, le calcul du
// jeu comme le dessin de la carte graphique — et choisit un cran (CRANS) : la qualité de
// l'image et sa finesse (la part des pixels de l'écran que l'on dessine ; le navigateur
// agrandit ensuite l'image à la taille de l'écran). Le but : 60 images par seconde.
// Il juge seconde par seconde :
//  - trop lent (moins de 54 images par seconde, deux secondes de suite) : un cran plus bas
//    (deux, sous 36 images par seconde). Si la descente n'a rien changé, il essaie encore un
//    cran (la scène a pu s'alourdir au même moment) ; si rien n'a changé non plus, ce n'est
//    pas la carte graphique qui freine (le processeur, l'écran, le navigateur qui économise
//    la batterie…) : il remonte d'où il venait, et ne redescend plus d'une minute (la
//    deuxième fois, de quatre ; la troisième : plus de la partie) ;
//  - longtemps à l'aise (60 images par seconde, ou le rythme de l'écran) : il essaie le cran
//    au-dessus. S'il y est trop lent dans les 10 secondes, c'est un échec : il redescend, et
//    ne réessaie ce cran qu'une minute plus tard (deux minutes après un deuxième échec, puis
//    quatre, cinq au plus : la nuit change, ce qui était trop lourd peut ne plus l'être) ;
//  - quand le calcul du jeu prend presque tout le temps d'une image, c'est le processeur qui
//    ne suit pas : il ne descend pas (moins de pixels n'y changerait rien).
// Après chaque changement, il laisse passer une seconde et demie sans juger (le temps que
// la nouvelle image s'installe).
//
// Il ne connaît ni le jeu ni la carte graphique : on lui donne chaque image (noter), il rend
// le cran à prendre. On peut donc l'essayer sans navigateur (scripts/test-regulateur.js).

// Les crans, du plus beau au plus léger. Chacun coûte à la carte graphique de 15 à 25 % de
// moins que celui d'avant : d'abord l'anticrénelage et les détails (la qualité), puis le
// nombre de pixels (la finesse : 0,7 → la moitié des pixels).
export const CRANS = [
  { qualite: 'haute', finesse: 1 },
  { qualite: 'moyenne', finesse: 1 },
  { qualite: 'economique', finesse: 1 },
  { qualite: 'economique', finesse: 0.85 },
  { qualite: 'economique', finesse: 0.7 },
  { qualite: 'minimale', finesse: 0.7 },
  { qualite: 'minimale', finesse: 0.6 },
  { qualite: 'minimale', finesse: 0.5 },
];
export const DERNIER_CRAN = CRANS.length - 1;
// Ce que coûte chaque cran à la carte graphique, comparé au premier : mesuré sur le Mac de
// Mathis (1280×800 points, la carte graphique freinée 4 fois pour que ce soit elle qui
// compte ; d'un essai à l'autre, ±30 %), sur son écran Retina et comme sur un écran ordinaire
// (un pixel par point : la qualité Haute n'y a déjà pas plus de pixels que la Moyenne, les
// premiers crans y gagnent peu). Le régulateur s'en sert pour prévoir s'il tiendra au cran
// du dessus.
export const COUTS = {
  retina: [1, 0.7, 0.41, 0.32, 0.28, 0.23, 0.2, 0.18],
  ordinaire: [1, 0.91, 0.75, 0.62, 0.53, 0.43, 0.38, 0.33],
};

export const CIBLE = 60; // images par seconde
// (sous 54 images par seconde, l'écran qui en affiche 60 montre certaines images deux fois :
// la mer avance par à-coups — mieux vaut un cran plus léger, à 60 bien réguliers)
const LENT = CIBLE * 0.9; // (54)
const TRES_LENT = CIBLE * 0.6; // (36)
const AISE = CIBLE * 0.97; // (58)
const FENETRE = 1000; // ms : on juge seconde par seconde
const CALME = 1500; // ms sans juger après un changement
const LENTES_POUR_DESCENDRE = 2;
const AISEES_POUR_MONTER = 8; // (3 pendant les 20 premières secondes : on cherche vite)
const DEBUT = 20000;
const ESSAI = 10000; // ms : trop lent dans ce délai après être monté = un échec
const ATTENTE_APRES_ECHEC = 60000; // (puis le double à chaque nouvel échec, 5 minutes au plus)
const ATTENTE_MAX = 300000;
const GAIN_MINIMUM = 1.04; // (une descente qui gagne moins de 4 % n'a servi à rien)
const PROCESSEUR = 0.85; // (le calcul prend plus de 85 % de l'image : le processeur est au bout)

export class Regulateur {
  // couts : COUTS.retina ou COUTS.ordinaire, selon l'écran
  constructor({ cran = 1, maintenant = 0, couts = COUTS.retina } = {}) {
    this.cran = Math.min(DERNIER_CRAN, Math.max(0, Math.round(cran)));
    this.couts = couts;
    this.debut = maintenant;
    this.calmeJusqua = maintenant + CALME;
    this.fenetre = null;
    this.lentes = 0;
    this.aisees = 0;
    this.ipsAisees = []; // (les images par seconde de ces secondes à l'aise)
    this.echecs = CRANS.map(() => 0);
    this.interditJusqua = CRANS.map(() => 0);
    this.monte = null; // (le dernier cran essayé en montant, et quand)
    this.descente = null; // (la dernière descente, pour voir si elle a servi)
    this.plancher = DERNIER_CRAN; // (on ne descend pas plus bas…)
    this.plancherJusqua = 0; // (… jusqu'à ce moment-là)
    this.inutiles = 0; // (les descentes qui n'ont rien changé)
    this.intervalleEcran = Infinity; // (le plus court intervalle vu : le rythme de l'écran)
    this.changeDepuis = maintenant; // (le dernier changement de cran)
    // la dernière seconde jugée (pour l'afficher) : images par seconde, calcul du processeur
    // par image (ms), et ce qui freine quand c'est trop lent ('carte' ou 'processeur')
    this.dernier = { ips: 0, calcul: 0, limite: null };
    this.journal = []; // (les changements : quand, vers quel cran, pourquoi)
  }

  // Une image de plus. intervalle : le temps depuis la précédente (ms) ; calcul : le temps
  // passé par le processeur sur celle-ci, sans le dessin (ms) ; maintenant : l'heure (ms).
  // Rend le nouveau cran quand il faut en changer, sinon null.
  noter(intervalle, calcul, maintenant) {
    // (une image très longue : l'onglet caché, la fenêtre déplacée, le navigateur occupé
    // ailleurs… elle ne dit rien de la carte graphique : on recommence la seconde)
    if (intervalle > 250) {
      this.fenetre = null;
      return null;
    }
    if (maintenant < this.calmeJusqua) return null;
    const f = (this.fenetre ??= { debut: maintenant - intervalle, images: 0, somme: 0, calcul: 0, intervalles: [] });
    f.images++;
    f.somme += intervalle;
    f.calcul += calcul;
    f.intervalles.push(intervalle);
    if (maintenant - f.debut < FENETRE) return null;
    this.fenetre = null;
    return this.juger(f, maintenant);
  }

  // Ce qui se passe maintenant ne dit rien de l'ordinateur (l'onglet est caché : le
  // navigateur ralentit exprès ses images) : on oublie la seconde en cours, et on attendra
  // un peu, une fois revenu, avant de juger
  interrompre(maintenant) {
    this.fenetre = null;
    this.calmeJusqua = Math.max(this.calmeJusqua, maintenant + CALME);
  }

  juger(f, maintenant) {
    const moyenne = f.somme / f.images;
    const ips = 1000 / moyenne;
    const calcul = f.calcul / f.images;
    // (le rythme de l'écran : l'intervalle médian le plus court vu jusqu'ici — la médiane, car
    // quelques images arrivent en avance juste après une image en retard)
    const tri = f.intervalles.sort((a, b) => a - b);
    this.intervalleEcran = Math.min(this.intervalleEcran, tri[tri.length >> 1]);
    const ipsEcran = 1000 / this.intervalleEcran;
    const processeur = calcul > PROCESSEUR * moyenne;
    const lente = ips < LENT;
    this.dernier = { ips, calcul, limite: lente ? (processeur ? 'processeur' : 'carte') : null };
    if (this.monte && maintenant - this.monte.quand > ESSAI) this.monte = null;

    // la descente d'avant a-t-elle servi ? Une première fois non : on descend encore d'un
    // cran pour voir. Deux fois non : ce n'est pas la carte graphique qui freine — on remonte
    // d'où l'on venait, et on ne redescend plus d'une minute
    const d = this.descente;
    this.descente = null;
    const plancher = maintenant < this.plancherJusqua ? this.plancher : DERNIER_CRAN;
    if (d && ips < d.ips * GAIN_MINIMUM) {
      if (!d.encore && lente && this.cran < plancher) {
        this.descente = { ...d, encore: true };
        return this.aller(this.cran + 1, maintenant, 'lent');
      }
      this.inutiles++;
      this.plancher = d.depuis;
      this.plancherJusqua = this.inutiles >= 3 ? Infinity : maintenant + ATTENTE_APRES_ECHEC * 4 ** (this.inutiles - 1);
      return this.aller(d.depuis, maintenant, 'inutile');
    }

    if (lente) {
      this.aisees = 0;
      this.ipsAisees = [];
      if (processeur) {
        this.lentes = 0;
        return null;
      }
      // (monté il y a peu : ce cran-là est trop lourd — un échec, on redescend tout de suite)
      if (this.monte && this.monte.vers === this.cran) {
        const c = this.cran;
        this.echecs[c]++;
        this.interditJusqua[c] = maintenant + Math.min(ATTENTE_MAX, ATTENTE_APRES_ECHEC * 2 ** (this.echecs[c] - 1));
        this.monte = null;
        return this.aller(c + 1, maintenant, 'echec');
      }
      this.lentes++;
      if (this.lentes < LENTES_POUR_DESCENDRE || this.cran >= plancher) return null;
      const vers = Math.min(plancher, this.cran + (ips < TRES_LENT ? 2 : 1));
      this.descente = { depuis: this.cran, ips };
      return this.aller(vers, maintenant, 'lent');
    }
    this.lentes = 0;
    if (ips < AISE && ips < ipsEcran * 0.95) {
      this.aisees = 0;
      this.ipsAisees = [];
      return null;
    }
    this.aisees++;
    this.ipsAisees.push(ips);
    const attente = maintenant - this.debut < DEBUT ? 3 : AISEES_POUR_MONTER;
    if (this.aisees < attente || this.cran === 0) return null;
    const haut = this.cran - 1;
    if (maintenant < this.interditJusqua[haut]) return null;
    // (assez de marge ? On prend la plus lente de ces secondes à l'aise — la scène change, une
    // seconde rapide ne dit rien — et ce que le cran du dessus coûte de plus. Quand l'écran
    // plafonne le rythme, on ne connaît pas la marge : on essaie)
    const pire = Math.min(...this.ipsAisees);
    const plafonne = pire >= ipsEcran * 0.93;
    const prevu = (pire * this.couts[this.cran]) / this.couts[haut];
    if (!plafonne && prevu < AISE) return null;
    this.monte = { quand: maintenant, vers: haut };
    return this.aller(haut, maintenant, 'aise');
  }

  aller(cran, maintenant, raison) {
    this.cran = cran;
    this.lentes = 0;
    this.aisees = 0;
    this.ipsAisees = [];
    this.fenetre = null;
    this.calmeJusqua = maintenant + CALME;
    this.changeDepuis = maintenant;
    this.journal.push({ quand: maintenant, cran, raison, ips: this.dernier.ips });
    if (this.journal.length > 50) this.journal.shift();
    return cran;
  }
}
