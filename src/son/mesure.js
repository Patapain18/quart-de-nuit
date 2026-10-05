// Le volume ressenti d'un son, mesuré comme le font les radios et le cinéma (la norme
// UIT BS.1770, en « LUFS ») : un filtre imite l'oreille (elle entend mieux les aigus que
// les graves), puis on fait la moyenne de l'énergie par blocs de 400 ms, en ignorant les
// blocs presque silencieux. −14 LUFS : la musique en ligne ; −23 : la télévision ;
// en dessous de −30 : très calme.

// Les deux filtres de la norme, calculés pour la fréquence d'échantillonnage du son
function biquads(fs) {
  const plateau = (() => {
    const A = 10 ** (3.999843853973347 / 40);
    const w0 = (2 * Math.PI * 1681.974450955533) / fs;
    const alpha = Math.sin(w0) / (2 * 0.7071752369554196);
    const c = Math.cos(w0);
    const r = 2 * Math.sqrt(A) * alpha;
    return {
      b: [A * ((A + 1) + (A - 1) * c + r), -2 * A * ((A - 1) + (A + 1) * c), A * ((A + 1) + (A - 1) * c - r)],
      a: [(A + 1) - (A - 1) * c + r, 2 * ((A - 1) - (A + 1) * c), (A + 1) - (A - 1) * c - r],
    };
  })();
  const passeHaut = (() => {
    const w0 = (2 * Math.PI * 38.13547087602444) / fs;
    const alpha = Math.sin(w0) / (2 * 0.5003270373238773);
    const c = Math.cos(w0);
    return { b: [(1 + c) / 2, -(1 + c), (1 + c) / 2], a: [1 + alpha, -2 * c, 1 - alpha] };
  })();
  return [plateau, passeHaut];
}

function filtrer(x, { b, a }) {
  const y = new Float32Array(x.length);
  const [b0, b1, b2] = b.map((v) => v / a[0]);
  const [a1, a2] = [a[1] / a[0], a[2] / a[0]];
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v;
    y[i] = v;
  }
  return y;
}

// tampon : un AudioBuffer ; debut, fin : en secondes. Renvoie le volume en LUFS (-Infinity : silence)
export function lufs(tampon, debut = 0, fin = tampon.duration) {
  const fs = tampon.sampleRate;
  const i0 = Math.floor(debut * fs);
  const i1 = Math.min(tampon.length, Math.floor(fin * fs));
  const filtres = biquads(fs);
  const canaux = [];
  for (let c = 0; c < tampon.numberOfChannels; c++) {
    let x = tampon.getChannelData(c).subarray(i0, i1);
    for (const f of filtres) x = filtrer(x, f);
    canaux.push(x);
  }
  // blocs de 400 ms qui se chevauchent aux trois quarts
  const bloc = Math.floor(0.4 * fs);
  const pas = Math.floor(0.1 * fs);
  const puissances = [];
  for (let s = 0; s + bloc <= i1 - i0; s += pas) {
    let p = 0;
    for (const x of canaux) {
      let m = 0;
      for (let i = s; i < s + bloc; i++) m += x[i] * x[i];
      p += m / bloc;
    }
    puissances.push(p);
  }
  const vol = (p) => -0.691 + 10 * Math.log10(p);
  const audibles = puissances.filter((p) => vol(p) > -70);
  if (!audibles.length) return -Infinity;
  const seuil = vol(audibles.reduce((a, p) => a + p, 0) / audibles.length) - 10;
  const gardes = audibles.filter((p) => vol(p) > seuil);
  return vol(gardes.reduce((a, p) => a + p, 0) / gardes.length);
}
