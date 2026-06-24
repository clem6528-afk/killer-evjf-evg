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

## 🚀 Mode d'emploi (organisateur)

### 1. (Re)générer
```bash
npm install                 # une fois (dépendance : qrcode)
node generate.mjs           # utilise la baseUrl du config
# ou pour forcer une autre URL :
node generate.mjs --base-url=https://clem6528-afk.github.io/killer-evjf-evg/
```
Le script auto-teste le déchiffrement (round-trip + rejet des mauvais codes) et **refuse de
publier** si une donnée de jeu fuite dans `docs/index.html`.

Produit :
- `docs/index.html` — l'appli (à déployer).
- `out/cards.html` — cartes à **imprimer / découper / distribuer en privé** (nom + QR + code).
- `out/qr/*.png` — les QR individuels.
- `out/host_sheet.md` — **ta feuille maître secrète** (qui vise qui, missions, codes, liens).

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
