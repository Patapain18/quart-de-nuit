// La sonothèque : les vrais enregistrements du jeu (public/sons/, fabriqués par
// `npm run sons` à partir de scripts/sons/recette.mjs), chargés et décodés pour la Web
// Audio API.
//
// On les charge en arrière-plan dès l'ouverture de la page : le jeu marche sans eux (les
// sons calculés prennent le relais), et chaque son commence à jouer dès qu'il est prêt.
// La fiche (sons.json) dit, pour chaque son : sa sorte (« boucle » ou « coups »), où
// boucler, où sont les morceaux d'une planche, et d'où vient l'enregistrement.

export class Sonotheque {
  constructor(ctx, base = './sons/') {
    this.ctx = ctx;
    this.base = base;
    this.fiche = null;
    this.tampons = new Map(); // nom → AudioBuffer décodé
    this.enAttente = new Map(); // nom → promesse
    this.quandPret = new Set(); // (des fonctions appelées quand un son arrive : f(nom))
  }

  async lireFiche() {
    if (!this.fiche) {
      const r = await fetch(`${this.base}sons.json`);
      if (!r.ok) throw new Error(`sons.json : ${r.status}`);
      this.fiche = await r.json();
    }
    return this.fiche;
  }

  // Charge les sons demandés (tous si rien n'est dit), quatre à la fois
  async charger(noms = null) {
    const fiche = await this.lireFiche();
    const liste = noms ?? Object.keys(fiche.sons);
    let i = 0;
    const ouvrier = async () => {
      while (i < liste.length) {
        const nom = liste[i++];
        try { await this.son(nom); } catch (e) { console.warn(`son ${nom} :`, e.message); }
      }
    };
    await Promise.all([ouvrier(), ouvrier(), ouvrier(), ouvrier()]);
  }

  son(nom) {
    if (this.tampons.has(nom)) return Promise.resolve(this.tampons.get(nom));
    if (!this.enAttente.has(nom)) {
      this.enAttente.set(nom, (async () => {
        const fiche = await this.lireFiche();
        const s = fiche.sons[nom];
        if (!s) throw new Error('inconnu');
        const r = await fetch(`${this.base}${s.fichier}`);
        if (!r.ok) throw new Error(`${s.fichier} : ${r.status}`);
        const tampon = await this.ctx.decodeAudioData(await r.arrayBuffer());
        this.tampons.set(nom, tampon);
        for (const f of this.quandPret) f(nom);
        return tampon;
      })());
    }
    return this.enAttente.get(nom);
  }

  tampon(nom) { return this.tampons.get(nom) ?? null; }
  infos(nom) { return this.fiche?.sons[nom] ?? null; }

  // Les auteurs des enregistrements (pour les crédits)
  credits() {
    const vus = new Map();
    for (const s of Object.values(this.fiche?.sons ?? {})) {
      for (const c of s.credits) vus.set(c.page, c);
    }
    return [...vus.values()];
  }
}
