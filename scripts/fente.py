# La fente temporelle : pour juger un mouvement sans regarder la vidéo.
# On prend une ligne (ou une colonne) de chaque image d'un film et on les empile : ce qui
# tourne ou monte y dessine des traînées obliques (leur pente donne la vitesse), ce qui
# est immobile des traits droits, ce qui clignote des stries.
#   python3 scripts/fente.py nom ligne|colonne position x0 x1 [agrandissement]
#   (position, x0, x1 : en fractions de l'image) ; lit captures/film-nom-0001.jpg…
#   → captures/fente-nom-ligne-40.png
import sys, glob
from PIL import Image
nom, sens, position, a0, a1 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4]), float(sys.argv[5])
zoom = int(sys.argv[6]) if len(sys.argv) > 6 else 3
images = sorted(glob.glob(f'captures/film-{nom}-*.jpg'))
if not images:
    sys.exit(f'aucune image captures/film-{nom}-XXXX.jpg (garder les images : node scripts/film.mjs {nom} --garder)')
premiere = Image.open(images[0])
W, H = premiere.size
bandes = []
for f in images:
    im = Image.open(f).convert('RGB')
    if sens == 'ligne':
        y = int(position * H)
        bandes.append(im.crop((int(a0 * W), y, int(a1 * W), y + 1)))
    else:
        x = int(position * W)
        bandes.append(im.crop((x, int(a0 * H), x + 1, int(a1 * H))).rotate(90, expand=True))
largeur = bandes[0].size[0]
sortie = Image.new('RGB', (largeur, len(bandes)))
for i, b in enumerate(bandes):
    sortie.paste(b, (0, i))
sortie = sortie.resize((largeur * zoom // 2, len(bandes) * zoom), Image.NEAREST)
chemin = f'captures/fente-{nom}-{sens}-{int(position * 100)}.png'
sortie.save(chemin)
print(chemin, sortie.size, f'{len(bandes)} images, haut = début')
