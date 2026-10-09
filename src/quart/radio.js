// La radio VHF du bord. Cette nuit, personne n'y parle : elle grésille, elle claque à chaque
// éclair… et parfois une voix passe sur le 16, trop faible pour qu'on la comprenne (fantome),
// ou tout près du micro (chuchoter). Ce qu'elle sait encore faire de l'ancien jeu (la voix de
// synthèse, le bulletin de « Kervalen Radio », la file des messages) reste là, sans servir.
// Le canal 16 est celui de la veille et des appels de détresse.
import { leverCoucher } from '../monde/astres.js';
import { tendanceEnMots } from '../monde/pression.js';

const BEAUFORT = [1, 3, 6, 10, 16, 21, 27, 33, 40, 47, 55, 63];
export function beaufort(noeuds) {
  let f = 0;
  while (f < BEAUFORT.length && noeuds >= BEAUFORT[f]) f++;
  return f;
}
const NOMS_BEAUFORT = ['calme', 'très légère brise', 'légère brise', 'petite brise', 'jolie brise', 'bonne brise',
  'vent frais', 'grand frais', 'coup de vent', 'fort coup de vent', 'tempête', 'violente tempête', 'ouragan'];

export function directionEnMots(degres) {
  const noms = ['nord', 'nord-nord-est', 'nord-est', 'est-nord-est', 'est', 'est-sud-est', 'sud-est', 'sud-sud-est',
    'sud', 'sud-sud-ouest', 'sud-ouest', 'ouest-sud-ouest', 'ouest', 'ouest-nord-ouest', 'nord-ouest', 'nord-nord-ouest'];
  return noms[Math.round((((degres % 360) + 360) % 360) / 22.5) % 16];
}

// Vers où, avec son article : « au nord », « à l'est », « à l'ouest-sud-ouest »
export function aLaDirection(degres) {
  const d = directionEnMots(degres);
  return /^[eo]/.test(d) ? `à l'${d}` : `au ${d}`;
}

// État de la mer selon la hauteur des vagues (échelle de Douglas)
export function etatMerEnMots(hs) {
  if (hs < 0.1) return 'calme';
  if (hs < 0.5) return 'belle';
  if (hs < 1.25) return 'peu agitée';
  if (hs < 2.5) return 'agitée';
  if (hs < 4) return 'forte';
  if (hs < 6) return 'très forte';
  if (hs < 9) return 'grosse';
  return 'très grosse';
}

const FREQUENCES = { 16: '156.800', 72: '156.625' };

export class Radio {
  // afficher(texte) : montre les sous-titres ; audio : pour le grésillement
  constructor({ afficher, audio, ecran }) {
    this.afficher = afficher;
    this.audio = audio;
    this.ecran = ecran; // l'écran de la VHF (interieur.radio)
    this.voix = null;
    this.occupee = false;
    this.file = []; // les messages qui attendent leur tour
    this.canal = 16;
    this.muette = false; // (les options : sans la voix de Jos, on lit les sous-titres)
    // la tempête brouille les transmissions (0 → 1) : des mots se perdent dans les
    // parasites, la voix faiblit
    this.brouillage = 0;
    if ('speechSynthesis' in window) {
      const choisir = () => {
        const voix = speechSynthesis.getVoices().filter((v) => v.lang?.startsWith('fr'));
        // une voix grave et posée si possible
        this.voix = voix.find((v) => /thomas|daniel|nicolas/i.test(v.name)) ?? voix[0] ?? null;
      };
      choisir();
      speechSynthesis.addEventListener?.('voiceschanged', choisir);
    }
  }

  // La radio se tait et n'a plus rien à dire
  get libre() { return !this.occupee && this.file.length === 0; }

  // Met un message dans la file : il sera lu phrase par phrase, avec les sous-titres.
  // siLibre : seulement si personne ne parle (un conseil ne fait pas la queue).
  // Renvoie une promesse tenue quand le message a été lu.
  parler(phrases, { emetteur = 'Kervalen Radio', canal = 16, siLibre = false } = {}) {
    if (siLibre && !this.libre) return Promise.resolve(false);
    return new Promise((fini) => {
      this.file.push({ phrases, emetteur, canal, fini });
      if (!this.occupee) this.lireLaFile();
    });
  }

  // Une transmission que personne n'explique : une voix, trop faible et trop brouillée
  // pour comprendre (pas de synthèse vocale : un son), et ce que l'on croit en saisir
  fantome(texte, { canal = 16, duree = 7 } = {}) {
    return new Promise((fini) => {
      this.file.push({ fantome: true, texte, canal, duree, fini });
      if (!this.occupee) this.lireLaFile();
    });
  }

  // Une voix qui chuchote sur un canal, tout près du micro (personne n'appelle) : la voix
  // de synthèse, très grave et lente, à peine audible dans les parasites
  chuchoter(texte, { canal = 16, sousTitre = null } = {}) {
    return new Promise((fini) => {
      this.file.push({ chuchote: true, texte, canal, sousTitre, fini });
      if (!this.occupee) this.lireLaFile();
    });
  }

  async lireLaFile() {
    this.occupee = true;
    while (this.file.length) {
      const message = this.file.shift();
      const { phrases, emetteur, canal, fini } = message;
      this.interrompu = false;
      this.canal = canal;
      this.ecran?.dessiner(`CH ${canal}`, 'RX', true);
      if (message.fantome) {
        this.audio?.voixFantome?.(message.duree);
        this.afficher(message.texte);
        await new Promise((r) => { this.finPhrase = r; setTimeout(r, message.duree * 1000); });
        this.afficher('');
        this.ecran?.dessiner(`CH ${canal}`, FREQUENCES[canal] ?? '');
        fini(true);
        continue;
      }
      if (message.chuchote) {
        this.audio?.parasites?.(4.5, 0.4);
        this.afficher(message.sousTitre ?? `Canal ${canal} : une voix, tout près du micro : « ${message.texte} »`);
        await new Promise((r) => setTimeout(r, 900));
        await this.dire(message.texte, { pitch: 0.05, rate: 0.6, volume: 0.42 });
        await new Promise((r) => setTimeout(r, 1200));
        this.afficher('');
        this.ecran?.dessiner(`CH ${canal}`, FREQUENCES[canal] ?? '');
        fini(true);
        continue;
      }
      this.audio?.gresillement?.();
      for (const phrase of phrases) {
        if (this.interrompu) break;
        this.afficher(`${emetteur} : « ${this.brouiller(phrase)} »`);
        if (this.brouillage > 0.15 && Math.random() < this.brouillage) this.audio?.parasites?.(0.6 + Math.random() * 1.2, 0.35 * this.brouillage);
        await this.dire(phrase);
      }
      this.audio?.gresillement?.();
      this.afficher('');
      this.ecran?.dessiner(`CH ${canal}`, FREQUENCES[canal] ?? '');
      fini(!this.interrompu);
      if (this.file.length) await new Promise((r) => setTimeout(r, 450));
    }
    this.occupee = false;
  }

  // Coupe ce qui est en cours et vide la file (un message urgent, une nouvelle partie)
  taire() {
    for (const m of this.file) m.fini(false);
    this.file = [];
    this.interrompu = this.occupee;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // Passer la phrase en cours (on l'a déjà lue dans les sous-titres)
  passerPhrase() {
    if (!this.occupee) return;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    this.finPhrase?.();
  }

  // Dans les sous-titres, les mots que les parasites ont mangés (jamais le premier)
  brouiller(phrase) {
    if (this.brouillage < 0.1) return phrase;
    let avant = false;
    return phrase.split(' ').map((mot, k) => {
      const perdu = k > 0 && Math.random() < this.brouillage * 0.3;
      const texte = perdu ? (avant ? '' : '…') : mot;
      avant = perdu;
      return texte;
    }).filter((m) => m !== '').join(' ');
  }

  dire(phrase, { pitch = 0.9, rate = 1.02, volume = null } = {}) {
    return new Promise((resoudre) => {
      this.finPhrase = resoudre;
      if (this.muette || !('speechSynthesis' in window) || !this.voix) {
        setTimeout(resoudre, 900 + phrase.length * 55); // sans voix : le temps de lire
        return;
      }
      const u = new SpeechSynthesisUtterance(phrase);
      u.voice = this.voix;
      u.lang = 'fr-FR';
      u.rate = rate;
      u.pitch = pitch;
      u.volume = volume ?? 1 - 0.45 * this.brouillage; // (la voix faiblit dans les parasites)
      // (la synthèse vocale des navigateurs reste parfois bloquée sans jamais dire qu'elle
      // a fini : au-delà du temps qu'il faut pour lire la phrase, on passe à la suite)
      const secours = setTimeout(() => {
        speechSynthesis.cancel();
        resoudre();
      }, 3000 + phrase.length * 95);
      const fin = () => {
        clearTimeout(secours);
        resoudre();
      };
      u.onend = fin;
      u.onerror = fin;
      speechSynthesis.speak(u);
    });
  }

  // baro : { pression (hPa), tendance (hPa en trois heures, ou null) } — ce qu'en dit le
  // bulletin : la situation générale, et la pression avec sa tendance
  bulletin(meteo, hs, baro = null) {
    const f = beaufort(meteo.vent);
    const { coucher } = leverCoucher(meteo);
    const heure = Math.floor(coucher);
    const minutes = String(Math.round((coucher % 1) * 60)).padStart(2, '0');
    const phrases = [
      'Bulletin météo pour la zone du large.',
      `Vent ${directionEnMots(meteo.directionVent)}, force ${f}, ${NOMS_BEAUFORT[f]}.`,
      `Mer ${etatMerEnMots(hs ?? meteo.houle.hs)}, houle de ${directionEnMots(meteo.houle.direction)} de ${meteo.houle.hs.toFixed(1).replace('.', ',')} mètre.`,
      meteo.pluie > 0.3 ? 'Pluie, visibilité médiocre.' : meteo.nuages > 0.6 ? 'Ciel très nuageux.' : 'Bonne visibilité.',
      `Coucher du soleil à ${heure} heures ${minutes}.`,
      f >= 8 ? 'Avis de coup de vent en cours.' : 'Évolution : le vent fraîchira en soirée.',
    ];
    if (baro) {
      const dp = baro.tendance;
      // (la situation générale : ce que fait la dépression, d'après ce que fait la pression)
      if (dp !== null) phrases.splice(1, 0, `Situation générale : ${dp <= -2 ? 'dépression se creusant à l\'ouest, se déplaçant vers l\'est' : dp >= 2 ? 'la dépression s\'éloigne vers l\'est' : 'peu de changement'}.`);
      phrases.push(`Pression : ${Math.round(baro.pression)} hectopascals${dp === null ? '' : `, ${tendanceEnMots(dp)}`}.`);
    }
    this.parler(phrases);
  }

  appeler() {
    this.parler(['Voilier qui appelle, ici Kervalen Radio, je vous reçois cinq sur cinq.', 'Gardez la veille sur le canal seize. Terminé.']);
  }
}
