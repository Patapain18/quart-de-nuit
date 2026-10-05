// Transformée de Fourier rapide (FFT) en deux dimensions.
//
// Pourquoi ? Une mer réaliste, c'est la somme de dizaines de milliers de petites
// vagues (des sinusoïdes) de tailles et de directions différentes. Les additionner
// une par une en chaque point serait beaucoup trop lent ; la FFT fait exactement
// ce calcul pour toute une grille de points d'un coup (méthode de Tessendorf,
// celle des films et des jeux).
//
// Les nombres complexes sont rangés dans deux tableaux : les parties réelles (re)
// et les parties imaginaires (im). La grille fait n × n cases, rangées ligne par
// ligne : la case (x, z) est à l'indice z * n + x.

export function creerFFT(n) {
  const bits = Math.log2(n);
  if (!Number.isInteger(bits)) throw new Error(`FFT : la taille doit être une puissance de 2 (reçu ${n})`);

  // Table d'inversion des bits : la FFT « en place » commence par ranger les cases
  // dans cet ordre (0, 4, 2, 6, 1, 5, 3, 7 pour n = 8).
  const ordre = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    ordre[i] = r;
  }

  // Les « facteurs de rotation » e^(+2iπk/n), calculés une fois pour toutes.
  // Signe + : c'est la transformée INVERSE (on part des vagues pour obtenir la mer).
  const cosinus = new Float64Array(n / 2);
  const sinus = new Float64Array(n / 2);
  for (let k = 0; k < n / 2; k++) {
    cosinus[k] = Math.cos((2 * Math.PI * k) / n);
    sinus[k] = Math.sin((2 * Math.PI * k) / n);
  }

  // Une ligne de travail (on y copie une ligne ou une colonne de la grille)
  const ligneRe = new Float64Array(n);
  const ligneIm = new Float64Array(n);

  // FFT d'une seule ligne, en place (algorithme de Cooley-Tukey, base 2)
  function fft1d(re, im) {
    for (let i = 0; i < n; i++) {
      const j = ordre[i];
      if (j > i) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let taille = 2; taille <= n; taille <<= 1) {
      const moitie = taille >> 1;
      const pas = n / taille;
      for (let debut = 0; debut < n; debut += taille) {
        for (let k = 0; k < moitie; k++) {
          const wr = cosinus[k * pas];
          const wi = sinus[k * pas];
          const a = debut + k;
          const b = a + moitie;
          const tr = re[b] * wr - im[b] * wi;
          const ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr;
          im[b] = im[a] - ti;
          re[a] += tr;
          im[a] += ti;
        }
      }
    }
  }

  // FFT inverse 2D, en place : d'abord chaque ligne, puis chaque colonne.
  // Résultat : x[p] = somme sur m de X[m] · e^(2iπ m p / n), sans division par n
  // (nos amplitudes sont déjà celles des vagues).
  return function fftInverse2D(re, im) {
    for (let z = 0; z < n; z++) {
      const o = z * n;
      for (let x = 0; x < n; x++) { ligneRe[x] = re[o + x]; ligneIm[x] = im[o + x]; }
      fft1d(ligneRe, ligneIm);
      for (let x = 0; x < n; x++) { re[o + x] = ligneRe[x]; im[o + x] = ligneIm[x]; }
    }
    for (let x = 0; x < n; x++) {
      for (let z = 0; z < n; z++) { ligneRe[z] = re[z * n + x]; ligneIm[z] = im[z * n + x]; }
      fft1d(ligneRe, ligneIm);
      for (let z = 0; z < n; z++) { re[z * n + x] = ligneRe[z]; im[z * n + x] = ligneIm[z]; }
    }
  };
}
