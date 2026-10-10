// Le livre de bord de Morgane : celui de son ancien propriétaire, Yves Le Bihan. Il y a un an,
// jour pour jour, on a retrouvé Morgane à la dérive au large de Kervalen, le pilote enclenché,
// la timonerie vide ; le livre de bord était ouvert sur la banquette. Il y est toujours.
//
// Il fait ce que faisait Jos dans l'ancien jeu (apprendre les commandes) : d'abord ses
// consignes, pour qui prendra le quart (le carnet de bord, touche L) ; puis le récit de sa
// dernière nuit, la nuit du 9 au 10 octobre 2025, une page par heure — on ne la lit qu'une
// fois cette heure-là venue. Chacune dit ce qui va arriver (le grain, les vagues qu'on entend
// venir, le foc, les dalots…), et chacune est un peu plus étrange que la précédente (l'écho
// qui suit, la voix sur le 16, quelqu'un à l'avant, la porte de la cabine avant). La
// dernière s'arrête au milieu d'une phrase. Rien n'y est jamais expliqué.
//
// Ce fichier ne dessine rien : il dit ce qu'on peut lire, et à partir de quand.

export const PROPRIETAIRE = 'Yves Le Bihan';
export const SA_NUIT = 'la nuit du 9 au 10 octobre 2025';

// Les pages de sa dernière nuit : l'heure où l'on peut la lire (24 : minuit ; 29 : 5 h), et
// ce qu'il a écrit
export const PAGES = [
  {
    heure: 24,
    texte: 'Minuit. Coup de vent de sud-ouest, comme annoncé. Je fuis devant sous un mouchoir de foc, le pilote à 160° du vent. Morgane tient bien. Ce qui m\'inquiète, c\'est la batterie : sans moteur, elle ne passera pas la nuit. Je l\'écris ici pour ne pas l\'oublier quand je serai fatigué.',
  },
  {
    heure: 25,
    texte: '1 h. Le baromètre baisse. Premier grain, vu au radar dix minutes avant. Quand le pilote chauffe, je lance le moteur — mais avec le diesel, je n\'entends plus venir les vagues : tant qu\'il tourne, je ferme les volets du côté du vent. Sur le radar, un écho, loin derrière nous. Un cargo, sans doute.',
  },
  {
    heure: 26,
    texte: '2 h. La mer se creuse. Les grosses déferlantes grondent avant de frapper, et on les entend venir de leur côté : j\'ai appris à fermer le bon volet. L\'écho est toujours là, au même relèvement, quel que soit mon cap. Pas un feu. Tout à l\'heure, une voix sur le 16 : un mayday, je crois, haché de parasites. J\'ai appelé. Personne.',
  },
  {
    heure: 27,
    texte: '3 h. L\'écoute du foc a cassé dans un grain : sorti le rouler, harnais accroché. En revenant, j\'ai cru voir quelqu\'un debout à l\'avant. La fatigue. Le sondeur a marqué six mètres. Ici, il y en a quatre-vingt-dix.',
  },
  {
    heure: 28,
    texte: '4 h. Le baromètre n\'a jamais été si bas. Une vague a bouché les dalots : ressorti les dégager, dans la mer qui croise, et attendu dehors que le cockpit se vide avant de rouvrir. En rentrant, la porte de la cabine avant était ouverte. Je ne descends plus dans la cabine avant. Je l\'avais fermée.',
  },
  {
    heure: 29,
    texte: '5 h. Des pas sur le toit de la timonerie. La VHF a dit « Morgane », tout bas, tout près du micro. Plus qu\'une heure. Je garde les volets fermés, la lampe allumée. On frappe à la porte de la cabine avant. Trois coups. Je vais',
    // (la dernière : elle s'arrête là)
    inachevee: true,
  },
];

// Les pages qu'on peut lire à cette heure de la nuit
export function pagesLisibles(heure) {
  return PAGES.filter((p) => heure >= p.heure - 1e-6);
}
