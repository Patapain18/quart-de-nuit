// Les commandes : clavier et souris.
//
// On lit la POSITION des touches (e.code), pas la lettre : sur un clavier français
// (AZERTY), la touche « Z » est à la place du « W » d'un clavier anglais. Ainsi les
// commandes tombent sous les mêmes doigts sur tous les claviers. Les noms affichés à
// l'écran sont ceux du clavier français (celui de Mathis).
export const TOUCHES = {
  barreGauche: { code: 'KeyA', nom: 'Q' },
  barreDroite: { code: 'KeyD', nom: 'D' },
  borderGV: { code: 'KeyW', nom: 'Z' },
  choquerGV: { code: 'KeyS', nom: 'S' },
  borderFoc: { code: 'KeyQ', nom: 'A' },
  choquerFoc: { code: 'KeyE', nom: 'E' },
  ris: { code: 'KeyR', nom: 'R' },
  enrouler: { code: 'KeyC', nom: 'C' },
  derouler: { code: 'KeyV', nom: 'V' },
  lampe: { code: 'KeyF', nom: 'F' },
  regleur: { code: 'KeyT', nom: 'T' },
  pilote: { code: 'KeyP', nom: 'P' },
  // à pied
  avancer: { code: 'KeyW', nom: 'Z' },
  reculer: { code: 'KeyS', nom: 'S' },
  gauche: { code: 'KeyA', nom: 'Q' },
  droite: { code: 'KeyD', nom: 'D' },
  agir: { code: 'KeyE', nom: 'E' },
  accroupir: { code: 'KeyC', nom: 'C' },
  harnais: { code: 'KeyX', nom: 'X' },
  lever: { code: 'Space', nom: 'Espace' },
  aide: { code: 'KeyH', nom: 'H' },
  carnet: { code: 'KeyL', nom: 'L' },
  passerPhrase: { code: 'Enter', nom: 'Entrée' },
};

export class Commandes {
  constructor(element) {
    this.element = element;
    this.enfoncees = new Set();
    this.appuis = []; // touches tout juste enfoncées (lues une fois par image)
    this.souris = { dx: 0, dy: 0 };
    this.verrouillee = false;
    addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.repeat) return;
      this.enfoncees.add(e.code);
      this.appuis.push({ code: e.code, maj: e.shiftKey });
    });
    addEventListener('keyup', (e) => this.enfoncees.delete(e.code));
    addEventListener('blur', () => this.enfoncees.clear());
    // la souris tourne la tête quand elle est « capturée » (un clic sur l'image)
    document.addEventListener('pointerlockchange', () => {
      this.verrouillee = document.pointerLockElement === element;
    });
    addEventListener('mousemove', (e) => {
      if (!this.verrouillee) return;
      this.souris.dx += e.movementX;
      this.souris.dy += e.movementY;
    });
  }

  capturer() {
    // (le navigateur peut refuser : juste après avoir quitté avec Échap, il faut attendre
    // un instant ; on recliquera. Pas la peine d'en faire une erreur.)
    const demande = this.element.requestPointerLock?.();
    demande?.catch?.(() => {});
  }

  enfoncee(nom) { return this.enfoncees.has(TOUCHES[nom].code); }

  // la touche Maj (l'une ou l'autre)
  get maj() { return this.enfoncees.has('ShiftLeft') || this.enfoncees.has('ShiftRight'); }
  get ctrl() { return this.enfoncees.has('ControlLeft') || this.enfoncees.has('ControlRight'); }

  // -1, 0 ou +1 selon les deux touches opposées
  axe(moins, plus) { return (this.enfoncee(plus) ? 1 : 0) - (this.enfoncee(moins) ? 1 : 0); }

  // les touches appuyées depuis la dernière image (et on vide la liste)
  lireAppuis() {
    const a = this.appuis;
    this.appuis = [];
    return a;
  }

  lireSouris() {
    const s = { ...this.souris };
    this.souris.dx = 0;
    this.souris.dy = 0;
    return s;
  }
}
