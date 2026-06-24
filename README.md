# 🔪💍 Killer — EVJF / EVG de Camille & Alex

Jeu du *Killer* (fil rouge) pour le week-end commun de Camille (mariée) et Alex (marié) à
Génolhac, Lozère. Livré comme **appli web** : chaque joueur ouvre **son lien perso** (ou scanne
**son QR**), entre **son code**, et découvre **sa** cible + **sa** mission. Personne d'autre ne
peut lire sa carte.

> **Pourquoi c'est incrackable** — Le fichier publié (`docs/index.html`) ne contient **aucune
> donnée de jeu**. Chaque carte est chiffrée (PBKDF2 + AES-GCM, Web Crypto natif) et le charabia
> vit **dans le lien perso de chaque joueur** (`…/#xxxxx`), déchiffrable seulement avec son code.
> Coller le code source — ou même son propre lien — à une IA ne révèle **rien**.

---

## 🎮 Le jeu en bref

- **8 tueurs** en boucle fermée : Louison, Maxime, Elsa, Anne-Charlotte, Corentin, Pierre (de
  Marion), Marion, Pierre #2. Chacun a une cible + une mission. Réussir = hériter de la cible et
  de la mission du défunt. Dernier survivant **et** plus gros collectionneur de cartes = vainqueurs.
- **Camille & Alex = cibles VIP intouchables.** Ils ne tuent pas, ne meurent pas, mais **tout le
  monde** a une *mission VIP* secrète pour les piéger. Eux peuvent crier « GRILLÉ ! » pour
  neutraliser un piégeur pris la main dans le sac (titre d'« Incorruptible »).
- **Fenêtres :** repas / temps libres / piscine. Suspendu pendant loup-garou, escape box,
  blindtest. Jamais après minuit. Du vendredi soir au brunch du dimanche.

Tout le contenu (cibles, missions, codes, ton coquin/fun) est dans `config/game.json` — **édite-le
librement**, puis relance le générateur.

---

## 🧩 Architecture

```
config/game.json   ← LA SOURCE (assignations en clair). JAMAIS publié (gitignoré).
src/reader.html    ← gabarit de l'appli (placeholders __XXX__)
generate.mjs       ← chiffre chaque carte, fabrique liens + QR + feuille maître, build docs/
docs/index.html    ← LE LECTEUR, sans aucune donnée. ➜ la SEULE chose servie par GitHub Pages.
out/               ← généré, local, JAMAIS publié : cards.html, qr/*.png, host_sheet.md
```

---

## 🎮 Multijoueur : espace joueur, kills, classement

Chaque joueur ouvre son lien/QR + code → **son espace** : sa cible/mission, son défi marié,
ses actions, et le **classement live**.

- **Kill validé à deux** : le tueur tape « j'ai éliminé X » → X reçoit la demande et **confirme**
  (ou conteste). À la confirmation, la cible de X est **transmise au tueur, chiffrée de bout en
  bout (ECDH P-256)** — la base ne voit jamais qui chasse qui. Le tueur gagne **+100** et hérite.
- **Défi marié** : n'importe qui (même éliminé !) tape « défi marié réussi » → choisit Camille/Alex
  → le marié **valide** (+40) ou refuse = **GRILLÉ** (+20 pour le marié).
- **Mission secrète des mariés** : le marié la réalise puis **choisit un témoin** parmi les joueurs ;
  le témoin atteste depuis son espace (+50). **Aucune action de l'orga requise pendant le jeu.**
- **Dernier survivant** : **+150 attribué automatiquement** quand la chaîne se referme sur une
  seule personne (garde anti-double atomique). Bouton orga de secours conservé.
- **Barème** (modifiable dans `config/game.json` → `meta.scoring`) : kill 100 · défi 40 · GRILLÉ
  20 · secret 50 · survivant 150.

> **Sans Firebase configuré**, l'appli tourne en **mode hors-ligne** : la carte s'affiche, mais
> kills/validations/classement sont désactivés. Tout le reste marche.

### Activer le multijoueur (Firebase Realtime Database — gratuit)

1. Va sur https://console.firebase.google.com → **Ajouter un projet** (nom au choix, désactive
   Google Analytics). Connecte-toi avec un compte Google.
2. Menu **Build → Realtime Database → Créer une base** → région *europe-west1* → démarrer en
   **mode test** (lecture/écriture ouvertes ~30 jours : parfait pour un week-end).
3. Menu ⚙️ **Paramètres du projet → Tes applications → Web (`</>`)** → enregistre l'app →
   copie l'objet `firebaseConfig` affiché.
4. Colle les valeurs dans `config/game.json` → `meta.firebase` (surtout `apiKey`, `databaseURL`,
   `authDomain`, `projectId`, `appId`). **`databaseURL` est obligatoire** (du type
   `https://xxxx-default-rtdb.europe-west1.firebasedatabase.app`).
5. Régénère et redéploie :
   ```bash
   node generate.mjs
   git add docs/index.html && git commit -m "Active le multijoueur" && git push
   ```
6. Ouvre ton espace organisateur (code `patrondujeu`) → **« Démarrer / Réinitialiser la partie »**
   pour initialiser le classement. À refaire juste avant le vrai départ (après tes tests).

> La config Firebase n'est PAS secrète (elle est faite pour vivre dans le client) ; la sécurité
> vient des règles de la base. Pour un week-end, le mode test suffit. La base ne contient jamais
> les cibles/missions — uniquement scores, statuts vivant/mort et le matériel crypto éphémère.

---

## 🚀 Mode d'emploi (organisateur)

### 1. (Re)générer
```bash
npm install                 # une fois (dépendance : qrcode)
node generate.mjs           # utilise la baseUrl du config
# ou pour forcer une autre URL :
node generate.mjs --base-url=https://clem6528-afk.github.io/killer-evjf-evg/

# ⚠️ Après distribution des cartes : pour redéployer un changement d'APPLI sans
# invalider les liens/QR/PDF déjà donnés (ils sont ré-chiffrés à chaque run complet) :
node generate.mjs --app-only   # reconstruit UNIQUEMENT docs/index.html
```
Le script auto-teste le déchiffrement (round-trip + rejet des mauvais codes) et **refuse de
publier** si une donnée de jeu fuite dans `docs/index.html`.

Produit :
- `docs/index.html` — l'appli (à déployer).
- `out/cartes/carte_<Nom>.pdf` **et** `.html` — **une carte autonome par joueur** (QR intégré,
  nom + code). Format A6, prêt à imprimer ou à **envoyer individuellement** sans exposer les autres
  joueurs. `out/cartes/_index.txt` liste qui correspond à quel fichier.
- `out/cartes_killer.pdf` — **PDF combiné** (1 carte par page) si tu préfères tout imprimer d'un coup.
- `out/cards.html` — variante « planche unique » (tous les joueurs sur une page à découper).
- `out/qr/*.png` — les QR individuels (images seules).
- `out/host_sheet.md` — **ta feuille maître secrète** (qui vise qui, missions, codes, liens).

> **Distribution sans tout voir** : pour qu'une personne de confiance distribue les cartes sans
> connaître les assignations, envoie/imprime **un `carte_<Nom>.html` par personne**. Le mieux pour
> la confidentialité : transmettre chaque fichier **directement à son joueur** (AirDrop, message
> privé) — personne d'autre ne le manipule. Un code seul ne révèle rien (il faut le QR/lien
> **et** le code pour ouvrir une carte).

### 2. Déployer sur GitHub Pages (compte `clem6528-afk`)
```bash
# Connecter gh au nouveau compte (étape interactive, navigateur) :
gh auth login          # choisir clem6528-afk, GitHub.com, HTTPS, navigateur

# Créer le repo + premier push (depuis le dossier du projet) :
git add .
git commit -m "Killer EVJF/EVG — appli chiffrée"
gh repo create clem6528-afk/killer-evjf-evg --public --source=. --remote=origin --push
```
Puis sur **github.com → repo → Settings → Pages** :
**Source = Deploy from a branch**, **Branch = `main` / dossier `/docs`** → Save.
L'appli sera en ligne à `https://clem6528-afk.github.io/killer-evjf-evg/` (1–2 min).

> ⚠️ **Important :** la source Pages doit être **`/docs`** (qui ne contient que le lecteur). Ne
> publie jamais `config/` ni `out/` — le `.gitignore` les exclut déjà.

### 3. Distribuer
Imprime `out/cards.html`, découpe, remets à chaque joueur **sa** carte (QR + code) en privé.
Garde `out/host_sheet.md` pour toi pour suivre la partie.

---

## 🥚 Easter eggs
- **Konami code** (↑↑↓↓←→←→ B A) → pluie de cœurs + « Mode parano activé ».
- **Logo 🔪💍 cliqué 7×** → message d'amour caché pour Camille & Alex.
- **Mot secret** `mariés` dans le champ code → petite animation.
- **Code organisateur** (`patrondujeu`) dans le champ code ou via « Espace organisateur ».
- **Leurres** : faux indices + commentaire moqueur planqués dans le source pour les curieux.

---

## 🔐 Note sécurité (honnête)
Comme chaque lien ne contient que **la carte d'un seul joueur**, un joueur ne peut déchiffrer
que la sienne (il connaît déjà sa propre mission). Pour lire celle d'un autre il lui faudrait à
la fois **son lien** ET **son code** — distribués en privé. Les codes sont volontairement
simples (faciles à taper) car l'architecture *sans données* rend leur force secondaire.

Test local avant déploiement : `python3 -m http.server 8000 --directory docs`, puis ouvre
`http://localhost:8000/#<fragment>` (un fragment depuis `out/host_sheet.md`) et entre le code.
`localhost` est un contexte sécurisé, donc le déchiffrement fonctionne.
