// Les systèmes du bord : ce qu'il faut tenir en marche toute la nuit, comme le gardien de nuit
// de Five Nights at Freddy's tient son courant et ses portes.
//
//  - Le courant : une seule batterie (de vieilles batteries de 60 Ah, sur leur étagère, au
//    fond de la cale). Tout ce qui est électrique la vide : le pilote (d'autant plus qu'il
//    force), le radar, le traceur, la VHF, les feux, les plafonniers, la baladeuse, la pompe
//    électrique quand elle tourne, les volets quand ils bougent. Chaque appareil a son
//    disjoncteur au tableau : on coupe ce dont on peut se passer. À zéro, tout s'éteint.
//  - Le moteur (un diesel, sous le cockpit) : il recharge la batterie (son alternateur) et
//    soulage le pilote (le souffle de l'hélice sur le safran : le bateau répond mieux) ; mais il
//    chauffe — dans la grosse mer, sa prise d'eau aspire de l'air quand l'arrière se soulève —
//    et il couvre tous les bruits : on n'entend plus venir les vagues. Il démarre sur la
//    batterie : sans courant, il ne démarre plus.
//  - Le pilote : il chauffe quand il force (quand il doit sans cesse redresser le bateau dans
//    les vagues), et disjoncte ; son disjoncteur thermique ne se réarme qu'une fois refroidi.
//  - L'eau : la pompe électrique se met en route toute seule (un flotteur) ; la pompe à main
//    ne coûte rien, mais il faut rester à pomper. Si l'eau monte jusqu'aux batteries, elle les
//    noie : le coupe-batterie saute, c'est le noir. Quand l'eau est redescendue, on le réarme
//    (près de la trappe), mais elles y ont perdu la moitié de leur charge.
//  - Les vitres : chaque déferlante qui frappe un côté fatigue les vitres de ce côté dont le
//    volet est ouvert ; elles se fendent, puis éclatent. Une vitre brisée laisse entrer la mer
//    à chaque vague ; son volet fermé bouche presque le trou. Les volets sont les portes de
//    FNAF : ils ne bougent qu'avec du courant, et fermés, leurs moteurs les tiennent serrés
//    contre la mer — ils tirent un peu sur la batterie, côté par côté. Sans courant (ou leur
//    disjoncteur coupé), plus rien ne les tient : la mer les force, ils ne protègent plus qu'à
//    moitié.
//
// Comme la nuit, ce fichier ne dessine rien et ne fait aucun bruit : il calcule, et il dit au
// jeu ce qui arrive (ses événements). Les veilleurs automatiques s'en servent aussi.
//
// Le temps : la nuit passe trente fois plus vite que la vraie (une heure en deux minutes :
// dureeHeure, donné par la nuit) ; les ampères sont de vrais ampères, mais ils vident la
// batterie en heures de la nuit.

export const COTES = ['avant', 'tribord', 'babord', 'arriere'];
// les vitres, côté par côté (comme les volets : timonerie.js, interieur-timonerie.js)
export const VITRES = [
  { id: 'tribord-ar', cote: 'tribord', nom: 'la vitre arrière de tribord' },
  { id: 'tribord-av', cote: 'tribord', nom: 'la vitre avant de tribord' },
  { id: 'babord-ar', cote: 'babord', nom: 'la vitre arrière de bâbord' },
  { id: 'babord-av', cote: 'babord', nom: 'la vitre avant de bâbord' },
  { id: 'avant-babord', cote: 'avant', nom: 'le pare-brise, à bâbord' },
  { id: 'avant-milieu', cote: 'avant', nom: 'le pare-brise, au milieu' },
  { id: 'avant-tribord', cote: 'avant', nom: 'le pare-brise, à tribord' },
  { id: 'arriere-tribord', cote: 'arriere', nom: 'la fenêtre arrière de tribord' },
  { id: 'arriere-babord', cote: 'arriere', nom: 'la fenêtre arrière de bâbord' },
];
// les disjoncteurs du tableau, dans l'ordre (de gauche à droite)
export const DISJONCTEURS = ['pilote', 'radar', 'traceur', 'vhf', 'feux', 'eclairage', 'pompe', 'volets'];
export const NOMS_DISJONCTEURS = {
  pilote: 'pilote', radar: 'radar', traceur: 'traceur et sondeur', vhf: 'VHF', feux: 'feux de navigation',
  eclairage: 'éclairage', pompe: 'pompe de cale électrique', volets: 'moteurs des volets',
};

// Ce que tire chaque appareil (ampères, sous 12 volts)
export const CONSO = {
  piloteVeille: 0.4, piloteMin: 1.6, piloteMax: 13, // (le pilote : de veille à forçant de toutes ses forces)
  radar: 3.6, traceur: 1.4, vhf: 0.6, feux: 2.2,
  eclairageBlanc: 2.4, eclairageRouge: 0.5, baladeuse: 1.2,
  pompe: 11, volets: 9, // (la pompe quand elle tourne, les volets quand ils bougent)
  voletsTenus: 1.5, // (par côté fermé : ses moteurs le tiennent serré)
  demarreur: 160, // (le démarreur du moteur, pendant qu'il lance)
};
export const BATTERIE = {
  capacite: 60, // Ah (de vieilles batteries)
  depart: 0.8, // à minuit, chargées à 80 %
  faible: 0.2, // l'alarme sonne
  vide: 0.06, // les lumières faiblissent ; à zéro, tout s'éteint
  demarrage: 0.12, // il en faut au moins autant pour lancer le moteur
};
export const MOTEUR = {
  regime: 0.6, // (sa manette : un peu plus de la moitié des gaz, le régime où il charge bien)
  lancement: 2.5, // s de démarreur
  alternateur: 55, // A, quand il tourne
  // sa température (0 : froid, 0,5 : en marche normale, 85 °C ; 1 : il se coupe tout seul) ;
  // il ne redémarre qu'une fois redescendu sous « refroidi »
  alarme: 0.88, refroidi: 0.7,
};
export const PILOTE = {
  alarme: 0.85, // il bipe : il chauffe trop
  rearmement: 0.7, // son disjoncteur thermique ne se réarme qu'en dessous
  // ce qui le fait forcer davantage : le foc qui bat (il secoue le bateau) ; le cockpit plein
  // d'eau (au-delà de 300 L, l'arrière alourdi tire sur la barre : jusqu'à 1,9 fois plus à 750 L)
  focBat: 1.6, cockpit: [300, 750, 0.9],
};
export const EAU_BATTERIES = {
  mouillees: 600, // litres dans la cale : l'eau touche les batteries (elles sont à 20 cm du fond… de l'eau)
  noyees: 760, // l'eau atteint leurs bornes : le coupe-batterie saute
  perte: 0.5, // (et elles y perdent la moitié de ce qui leur restait)
};
export const ALARME_CALE = 300; // litres : l'alarme de cale sonne
// les volets : 2,5 s pour descendre ou remonter
const VITESSE_VOLETS = 1 / 2.5;

const borne = (x, a, b) => Math.min(b, Math.max(a, x));

// Combien une vague qui arrive sous cet angle (0 : de face, 180 : de l'arrière ; cote : 1 si
// elle vient de tribord, -1 de bâbord) frappe les vitres d'un côté de la timonerie (0 → 1)
export function exposition(cote, angle, vientDe) {
  const a = Math.abs(angle);
  if (cote === 'avant') return borne(1 - a / 65, 0, 1);
  if (cote === 'arriere') return borne((a - 115) / 55, 0, 1);
  if ((cote === 'tribord') !== (vientDe > 0)) return 0;
  return Math.max(0, Math.sin((a * Math.PI) / 180)) ** 1.5;
}

export class Systemes {
  // dureeHeure : combien de secondes de jeu dure une heure de la nuit
  constructor({ hasard = Math.random, dureeHeure = 120 } = {}) {
    this.hasard = hasard;
    this.accelere = 3600 / dureeHeure; // (une seconde de jeu = trente secondes de la nuit)
    this.batterie = { charge: BATTERIE.depart, coupee: false, courant: 0, tension: 12.6 };
    this.disjoncteurs = Object.fromEntries(DISJONCTEURS.map((d) => [d, true]));
    this.eclairage = 'rouge'; // ('blanc', 'rouge', 'eteint' : les plafonniers)
    this.baladeuse = false;
    this.moteur = { etat: 'arrete', lance: 0, temperature: 0.22, heures: 0 };
    this.pilote = { engage: true, temperature: 0.3, effort: 0, travail: 0, barre: null, disjoncte: false };
    this.pompe = { marche: false, pompee: 0 };
    this.volets = Object.fromEntries(COTES.map((c) => [c, { fraction: 0, cible: 0 }]));
    this.vitres = VITRES.map((v) => ({ ...v, integrite: 1, etat: 'ok' }));
    this.alarmes = new Set();
    this.evenements = [];
    this.stats = { chargeMin: BATTERIE.depart, noir: 0, moteur: 0, vitresBrisees: 0, piloteChaud: 0 };
  }

  // ---------- Ce qu'on demande ----------
  get courant() { return !this.batterie.coupee && this.batterie.charge > 0; }
  // (un appareil marche : son disjoncteur est mis, et il y a du courant)
  alimente(nom) { return this.courant && this.disjoncteurs[nom]; }
  // le pilote tient le bateau : engagé, alimenté, et pas disjoncté
  get piloteEnMarche() { return this.pilote.engage && !this.pilote.disjoncte && this.alimente('pilote'); }
  get moteurEnMarche() { return this.moteur.etat === 'marche'; }
  // (0 : arrêté → le régime du moteur, pour la physique : la poussée de l'hélice)
  get regime() { return this.moteurEnMarche ? MOTEUR.regime : 0; }
  voletsFermes(cote) { return this.volets[cote].cible > 0.5; }
  // ce que les volets d'un côté protègent ses vitres (0 : ouverts → 1 : fermés et tenus par
  // leurs moteurs ; fermés sans courant, la mer les force : 0,5)
  protection(cote) {
    if (this.volets[cote].fraction <= 0.95) return 0;
    return this.alimente('volets') ? 1 : 0.5;
  }

  // ---------- Ce qu'on fait ----------
  basculerDisjoncteur(nom) {
    this.disjoncteurs[nom] = !this.disjoncteurs[nom];
    return this.disjoncteurs[nom];
  }
  // le moteur : on le lance (il faut du courant), ou on l'arrête
  demarrerMoteur() {
    const m = this.moteur;
    if (m.etat !== 'arrete') return 'deja';
    if (m.temperature > MOTEUR.refroidi) return 'chaud';
    if (!this.courant || this.batterie.charge < BATTERIE.demarrage) {
      this.emettre('moteur-refuse');
      return 'batterie';
    }
    m.etat = 'lancement';
    m.lance = MOTEUR.lancement;
    this.emettre('moteur-lance');
    return 'ok';
  }
  arreterMoteur() {
    if (this.moteur.etat === 'arrete') return false;
    this.moteur.etat = 'arrete';
    this.emettre('moteur-arrete', 'main');
    return true;
  }
  // le pilote : en veille (il ne fait plus rien, il refroidit) ou engagé
  basculerPilote() {
    this.pilote.engage = !this.pilote.engage;
    return this.pilote.engage;
  }
  // son disjoncteur thermique a sauté : on ne le réarme que froid
  rearmerPilote() {
    const p = this.pilote;
    if (!p.disjoncte) return 'ok';
    if (p.temperature > PILOTE.rearmement) return 'chaud';
    p.disjoncte = false;
    this.disjoncteurs.pilote = true;
    return 'ok';
  }
  fermerVolets(cote, fermes) {
    if (!this.alimente('volets')) return false;
    this.volets[cote].cible = fermes ? 1 : 0;
    return true;
  }
  // le coupe-batterie (près de la trappe) : l'eau l'a fait sauter ; on le réarme une fois
  // l'eau redescendue sous les batteries
  rearmerBatterie(litresCale) {
    if (!this.batterie.coupee) return 'ok';
    if (litresCale > EAU_BATTERIES.mouillees) return 'eau';
    this.batterie.coupee = false;
    this.emettre('courant-revenu');
    return 'ok';
  }

  emettre(nom, ...args) { this.evenements.push([nom, ...args]); }

  // ---------- Chaque image ----------
  // physique : le bateau ; eau : l'eau à bord (la nuit : { cale, cockpit }) ; heure ; mer : la
  // hauteur des vagues (Hs, m) ; vent (nœuds)
  maj(dt, { physique, eau, heure, mer = 3, vent = 35 }) {
    this.evenements.length = 0;
    const b = this.batterie;
    const avant = { courant: this.courant, alarmes: new Set(this.alarmes) };
    // l'eau : jusqu'aux batteries, elle les noie
    if (!b.coupee && eau.cale > EAU_BATTERIES.noyees) {
      b.coupee = true;
      b.charge *= EAU_BATTERIES.perte;
      this.emettre('batteries-noyees');
    }
    this.majPilote(dt, physique, heure, vent, eau);
    this.majMoteur(dt, physique, mer);
    this.majVolets(dt);
    // ce que tire le bord, ce que rend l'alternateur
    const a = this.consommation();
    const charge = this.moteurEnMarche && !b.coupee ? MOTEUR.alternateur * (1 - 0.7 * Math.max(0, b.charge - 0.9) / 0.1) : 0;
    b.courant = charge - a;
    if (!b.coupee) {
      b.charge = borne(b.charge + (b.courant * dt * this.accelere) / 3600 / BATTERIE.capacite, 0, 1);
      if (b.charge <= 0 && avant.courant) this.emettre('batterie-vide');
    }
    // (la tension : celle de la charge, moins ce que tire le bord ; l'alternateur la remonte)
    b.tension = b.coupee || b.charge <= 0 ? 0 : charge > 0 ? 14.1 : 11.5 + 1.3 * b.charge - 0.012 * a;
    // la pompe électrique (son flotteur), seulement quand elle a du courant
    this.majPompe(dt, eau);
    // les alarmes : la cale, la batterie, le pilote, le moteur
    this.alarmes.clear();
    if (eau.cale > ALARME_CALE && this.courant) this.alarmes.add('cale');
    if (this.courant && b.charge < BATTERIE.faible) this.alarmes.add('batterie');
    if (this.alimente('pilote') && this.pilote.temperature > PILOTE.alarme && !this.pilote.disjoncte) this.alarmes.add('pilote');
    if (this.moteurEnMarche && this.moteur.temperature > MOTEUR.alarme) this.alarmes.add('moteur');
    for (const nom of this.alarmes) if (!avant.alarmes.has(nom)) this.emettre('alarme', nom);
    if (avant.courant !== this.courant) this.emettre(this.courant ? 'courant-revenu' : 'noir');
    // ce qu'on note
    const s = this.stats;
    s.chargeMin = Math.min(s.chargeMin, b.charge);
    if (!this.courant) s.noir += dt;
    if (this.moteurEnMarche) s.moteur += dt;
    if (this.pilote.temperature > PILOTE.alarme) s.piloteChaud += dt;
    return this.evenements;
  }

  // Ce que tire le bord en ce moment (A)
  consommation() {
    if (!this.courant) return 0;
    const d = this.disjoncteurs;
    let a = 0;
    if (d.pilote && !this.pilote.disjoncte) {
      a += this.pilote.engage ? CONSO.piloteMin + (CONSO.piloteMax - CONSO.piloteMin) * borne(this.pilote.travail / 0.006, 0, 1) : CONSO.piloteVeille;
    }
    if (d.radar) a += CONSO.radar;
    if (d.traceur) a += CONSO.traceur;
    if (d.vhf) a += CONSO.vhf;
    if (d.feux) a += CONSO.feux;
    if (d.eclairage) a += this.eclairage === 'blanc' ? CONSO.eclairageBlanc : this.eclairage === 'rouge' ? CONSO.eclairageRouge : 0;
    if (d.eclairage && this.baladeuse) a += CONSO.baladeuse;
    if (this.pompe.marche) a += CONSO.pompe;
    if (d.volets && COTES.some((c) => this.volets[c].fraction !== this.volets[c].cible)) a += CONSO.volets;
    if (d.volets) a += CONSO.voletsTenus * COTES.filter((c) => this.volets[c].fraction > 0.5).length;
    if (this.moteur.etat === 'lancement') a += CONSO.demarreur;
    return a;
  }

  // Le pilote : son travail, c'est de retenir l'arrière que chaque vague pousse de côté —
  // d'autant plus dur que la mer est grosse (le vent qui monte) ; ses coups de barre (la
  // vitesse de sa barre, rapportée au plus vite qu'il peut) en disent l'effort du moment. Il
  // chauffe avec son travail (de plus en plus, la nuit avançant : il fatigue) ; le moteur le
  // soulage (le souffle de l'hélice fait mordre le safran : il corrige moins). Le foc qui bat
  // le fait forcer (il secoue le bateau), et le cockpit plein d'eau aussi (l'arrière alourdi
  // tire sur la barre). Il refroidit doucement en travaillant, plus vite en veille ; trop
  // chaud, son disjoncteur thermique saute.
  majPilote(dt, physique, heure, vent, eau = null) {
    const p = this.pilote;
    const barre = physique.barre;
    const vitesse = p.barre === null || dt <= 0 ? 0 : Math.abs(barre - p.barre) / dt;
    p.barre = barre;
    const marche = this.piloteEnMarche;
    const effort = marche ? borne(vitesse / 0.9, 0, 1) : 0;
    // (lissé sur trois secondes : un coup de barre ne fait pas l'effort)
    p.effort += (effort - p.effort) * Math.min(1, dt / 3);
    const mer = 0.0024 + 0.0055 * borne((vent - 32) / 14, 0, 1);
    const coups = 0.75 + 0.25 * Math.min(3, p.effort / 0.07);
    const fatigue = 1 + 0.05 * Math.max(0, heure - 24);
    const [c0, c1, plus] = PILOTE.cockpit;
    const charge = (physique.ecouteFocLibre && physique.deroule > 0.03 ? PILOTE.focBat : 1)
      * (1 + plus * borne(((eau?.cockpit ?? 0) - c0) / (c1 - c0), 0, 1));
    p.travail = marche ? mer * coups * fatigue * charge * (this.moteurEnMarche ? 0.55 : 1) : 0;
    const refroidit = (marche ? 0.006 : 0.015) * (p.temperature - 0.25);
    p.temperature = borne(p.temperature + (p.travail - refroidit) * dt, 0, 1);
    if (marche && p.temperature >= 1) {
      p.disjoncte = true;
      this.emettre('pilote-disjoncte');
    }
  }

  // Le moteur : il se lance, il tourne (il chauffe, d'autant plus vite que la mer est grosse :
  // sa prise d'eau aspire de l'air quand l'arrière se soulève), il se coupe tout seul s'il est
  // trop chaud ; arrêté, il refroidit (en une minute et demie)
  majMoteur(dt, physique, mer) {
    const m = this.moteur;
    if (m.etat === 'lancement') {
      m.lance -= dt;
      if (!this.courant) {
        m.etat = 'arrete';
        this.emettre('moteur-refuse');
      } else if (m.lance <= 0) {
        m.etat = 'marche';
        this.emettre('moteur-demarre');
      }
    }
    if (m.etat === 'marche') {
      m.heures += (dt * this.accelere) / 3600;
      // (la prise d'eau à l'air : l'arrière qui se soulève, le safran qui ventile)
      const air = (1 - (physique.tenueSafran ?? 1)) * 0.6 + borne((mer - 3) / 4, 0, 1) * 0.4;
      const chauffe = 0.0063 * (0.3 + 2 * air);
      m.temperature = borne(m.temperature + (chauffe - 0.008 * (m.temperature - 0.5)) * dt, 0, 1.05);
      if (m.temperature >= 1) {
        m.etat = 'arrete';
        this.emettre('moteur-arrete', 'surchauffe');
      }
    } else {
      m.temperature += (0.22 - m.temperature) * dt / 90;
    }
  }

  majVolets(dt) {
    const bougent = this.alimente('volets');
    for (const c of COTES) {
      const v = this.volets[c];
      if (!bougent || v.fraction === v.cible) continue;
      const pas = dt * VITESSE_VOLETS;
      v.fraction = v.cible > v.fraction ? Math.min(v.cible, v.fraction + pas) : Math.max(v.cible, v.fraction - pas);
    }
  }

  // La pompe électrique : son flotteur la met en route au-dessus de 60 L, l'arrête sous 15 L ;
  // elle sort trois litres par seconde
  majPompe(dt, eau) {
    const p = this.pompe;
    const peut = this.alimente('pompe');
    if (!peut) p.marche = false;
    else if (eau.cale > 60) p.marche = true;
    else if (eau.cale < 15) p.marche = false;
    if (p.marche) {
      const v = Math.min(eau.cale, 3 * dt);
      eau.cale -= v;
      p.pompee += v;
    }
  }

  // ---------- Les vitres ----------
  // Une vague frappe : sa force (0 → 1,3), d'où elle vient (angle depuis l'étrave, 0 → 180 ;
  // vientDe : 1 tribord, -1 bâbord), et sa prise (l'eau qu'elle jette à bord, 0 → 1). Chaque
  // vitre de ce côté, volet ouvert, en prend un coup (volet fermé sans courant : la moitié).
  // Rend l'eau qui entre : par les vitres que ce coup brise, et par celles qui l'étaient déjà.
  frapper(force, angle, vientDe, prise, { scelerate = false } = {}) {
    let eauEntree = 0;
    for (const v of this.vitres) {
      const e = exposition(v.cote, angle, vientDe);
      if (e <= 0.02) continue;
      const protection = this.protection(v.cote);
      if (v.etat === 'brisee') {
        // (par le trou : la mer entre ; le volet fermé le bouche presque)
        eauEntree += force * e * prise * (scelerate ? 400 : 140) * (1 - 0.85 * protection);
        continue;
      }
      if (protection >= 1) continue;
      const coup = force * e * (0.35 + 0.65 * prise) * (scelerate ? 1.6 : 0.55) * (0.7 + 0.6 * this.hasard()) * (1 - protection);
      v.integrite -= coup;
      if (v.integrite <= 0) {
        v.etat = 'brisee';
        v.integrite = 0;
        this.stats.vitresBrisees++;
        eauEntree += force * e * prise * (scelerate ? 300 : 90);
        this.emettre('vitre-brisee', v);
      } else if (v.integrite < 0.5 && v.etat === 'ok') {
        v.etat = 'fendue';
        this.emettre('vitre-fendue', v);
      }
    }
    return eauEntree;
  }

  // Par les vitres brisées, la pluie et les embruns entrent sans cesse (L/s)
  infiltration(vent) {
    let l = 0;
    for (const v of this.vitres) {
      if (v.etat !== 'brisee') continue;
      l += (0.15 + 0.35 * borne((vent - 30) / 15, 0, 1)) * (1 - 0.9 * this.protection(v.cote));
    }
    return l;
  }

  // ---------- Garder, reprendre ----------
  instantane() {
    return {
      batterie: { charge: this.batterie.charge, coupee: this.batterie.coupee },
      disjoncteurs: { ...this.disjoncteurs }, eclairage: this.eclairage,
      moteur: { etat: this.moteur.etat === 'marche' ? 'marche' : 'arrete', temperature: this.moteur.temperature, heures: this.moteur.heures },
      pilote: { engage: this.pilote.engage, temperature: this.pilote.temperature, disjoncte: this.pilote.disjoncte },
      volets: Object.fromEntries(COTES.map((c) => [c, this.volets[c].cible])),
      vitres: this.vitres.map((v) => ({ id: v.id, integrite: v.integrite, etat: v.etat })),
      stats: { ...this.stats },
    };
  }
  restaurer(s) {
    if (!s) return;
    Object.assign(this.batterie, s.batterie);
    Object.assign(this.disjoncteurs, s.disjoncteurs);
    this.eclairage = s.eclairage ?? this.eclairage;
    Object.assign(this.moteur, s.moteur, { lance: 0 });
    Object.assign(this.pilote, s.pilote, { effort: 0, barre: null });
    for (const c of COTES) this.volets[c] = { fraction: s.volets?.[c] ?? 0, cible: s.volets?.[c] ?? 0 };
    for (const v of this.vitres) Object.assign(v, (s.vitres ?? []).find((x) => x.id === v.id) ?? {});
    this.pompe.marche = false;
    Object.assign(this.stats, s.stats);
    this.alarmes.clear();
  }
}
