#!/usr/bin/env node
/**
 * generate.mjs — Générateur du Killer EVJF/EVG (exécuté EN LOCAL par l'organisateur).
 *
 * Pour chaque joueur :
 *   1. construit sa carte (cible + mission + VIP, ou rôle marié) ;
 *   2. la chiffre (PBKDF2 + AES-GCM) avec SON code perso ;
 *   3. fabrique son lien perso (charabia chiffré dans le fragment #...) et son QR.
 * Produit aussi : out/cards.html (à imprimer/découper), out/host_sheet.md (feuille maître),
 * et docs/index.html (le lecteur, SANS aucune donnée de jeu).
 *
 * Usage :  node generate.mjs  [--base-url https://compte.github.io/killer-evjf-evg/]
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const p = (...x) => path.join(ROOT, ...x);

// ───────── Lecture config ─────────
const cfg = JSON.parse(fs.readFileSync(p('config', 'game.json'), 'utf8'));
const ITER = cfg.meta.pbkdf2Iterations || 250000;
const argBase = process.argv.find(a => a.startsWith('--base-url='));
let BASE = argBase ? argBase.split('=').slice(1).join('=') : cfg.meta.baseUrl;
if (!BASE.endsWith('/')) BASE += '/';

// ───────── Crypto (compatible Web Crypto du navigateur) ─────────
function b64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function encryptCard(code, obj) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(Buffer.from(code, 'utf8'), salt, ITER, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return b64url(Buffer.concat([salt, iv, ct, tag])); // salt | iv | ciphertext | tag
}
function decryptCard(code, payloadB64) {
  let s = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const packed = Buffer.from(s, 'base64');
  const salt = packed.subarray(0, 16), iv = packed.subarray(16, 28);
  const tag = packed.subarray(packed.length - 16);
  const ct = packed.subarray(28, packed.length - 16);
  const key = crypto.pbkdf2Sync(Buffer.from(code, 'utf8'), salt, ITER, 32, 'sha256');
  const d = crypto.createDecipheriv('aes-256-gcm', key, iv);
  d.setAuthTag(tag);
  return JSON.parse(Buffer.concat([d.update(ct), d.final()]).toString('utf8'));
}

// ───────── Roster (non secret : pid + nom + rôle) et carte nom→pid ─────────
const roster = Object.entries(cfg.players).map(([pid, pl]) => ({ pid, name: pl.name, role: pl.role }));
const nameToPid = Object.fromEntries(roster.map(r => [r.name, r.pid]));

// ───────── Construction du payload par joueur (ce que verra l'appli) ─────────
function payloadFor(pid, pl) {
  if (pl.role === 'marie') {
    return { pid, name: pl.name, role: 'marie', marieText: pl.marieText, secret: pl.secret };
  }
  const targetPid = nameToPid[pl.target];
  if (!targetPid) throw new Error(`Cible introuvable dans le roster : "${pl.target}" (joueur ${pid})`);
  return { pid, name: pl.name, role: 'killer', target: pl.target, targetPid, mission: pl.mission, vip: pl.vip };
}

// ───────── Génération ─────────
fs.mkdirSync(p('out', 'qr'), { recursive: true });
fs.mkdirSync(p('docs'), { recursive: true });

const players = cfg.players;
const rows = [];
let cardsHtml = '';
let failures = 0;

for (const [keyId, pl] of Object.entries(players)) {
  const payload = payloadFor(keyId, pl);
  const enc = encryptCard(pl.code, payload);
  const url = BASE + '#' + enc;

  // auto-test : on doit pouvoir redéchiffrer avec le bon code, et échouer avec un mauvais
  try {
    const back = decryptCard(pl.code, enc);
    if (back.name !== pl.name) throw new Error('round-trip mismatch');
    let wrongOk = false;
    try { decryptCard(pl.code + 'x', enc); wrongOk = true; } catch { /* attendu */ }
    if (wrongOk) throw new Error('mauvais code accepté !');
  } catch (e) {
    failures++;
    console.error(`  ✗ ${pl.name} : ${e.message}`);
  }

  // QR
  const qrFile = `qr/${keyId}.png`;
  await QRCode.toFile(p('out', qrFile), url, { width: 600, margin: 2, errorCorrectionLevel: 'M' });

  // carte imprimable
  const roleTag = pl.role === 'marie' ? '💍 Cible VIP' : '☠️ Tueur';
  cardsHtml += `
    <div class="card">
      <div class="role">${roleTag}</div>
      <div class="name">${pl.name}</div>
      <img src="${qrFile}" alt="QR ${pl.name}" />
      <div class="code">Code : <b>${pl.code}</b></div>
      <div class="hint">Scanne le QR (ou ouvre ton lien) puis entre ton code.</div>
    </div>`;

  rows.push({ keyId, pl, url });
  console.log(`  ✓ ${pl.name.padEnd(20)} code=${pl.code}`);
}

// ───────── out/cards.html (à imprimer, découper, distribuer en privé) ─────────
const cardsPage = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8">
<title>Cartes Killer — à découper</title><style>
  body{font-family:system-ui,sans-serif;background:#eee;margin:0;padding:18px}
  .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;max-width:760px;margin:auto}
  .card{background:#fff;border:2px dashed #b3122e;border-radius:14px;padding:16px;text-align:center;
    break-inside:avoid;page-break-inside:avoid}
  .role{font-size:.7rem;letter-spacing:2px;text-transform:uppercase;color:#b3122e}
  .name{font-size:1.4rem;font-weight:800;margin:.2em 0}
  .card img{width:190px;height:190px}
  .code{margin-top:6px;font-size:1.05rem} .code b{font-size:1.2rem;letter-spacing:1px}
  .hint{font-size:.72rem;color:#777;margin-top:6px}
  @media print{body{background:#fff} .note{display:none}}
</style></head><body>
<p class="note" style="max-width:760px;margin:0 auto 14px;color:#555">
  Imprime, découpe, et remets chaque carte <b>en privé</b> à son joueur. Ne montre à personne la feuille maître.</p>
<div class="grid">${cardsHtml}</div></body></html>`;
fs.writeFileSync(p('out', 'cards.html'), cardsPage, 'utf8');

// ───────── out/host_sheet.md (feuille maître — JAMAIS publiée) ─────────
let sheet = `# 🔪 Feuille maître — ${cfg.meta.title}\n\n`;
sheet += `> ⚠️ SECRET ORGANISATEUR. Ne jamais montrer ni publier ce fichier.\n\n`;
sheet += `Base URL : \`${BASE}\`\nItérations PBKDF2 : ${ITER}\nCode organisateur : \`${cfg.meta.hostCode}\`\n\n`;
sheet += `## Chaîne d'élimination (les 8 tueurs)\n\n`;
sheet += `| Joueur | Code | Cible | Mission | Mission VIP |\n|---|---|---|---|---|\n`;
for (const { pl } of rows.filter(r => r.pl.role === 'killer')) {
  sheet += `| ${pl.name} | \`${pl.code}\` | ${pl.target} | ${pl.mission} | ${pl.vip} |\n`;
}
sheet += `\n## Les mariés (cibles VIP)\n\n| Joueur | Code | Rôle / mission secrète |\n|---|---|---|\n`;
for (const { pl } of rows.filter(r => r.pl.role === 'marie')) {
  sheet += `| ${pl.name} | \`${pl.code}\` | ${pl.secret} |\n`;
}
sheet += `\n## Liens personnels (à distribuer en privé)\n\n`;
for (const { pl, url } of rows) sheet += `- **${pl.name}** (\`${pl.code}\`) : ${url}\n`;
fs.writeFileSync(p('out', 'host_sheet.md'), sheet, 'utf8');

// ───────── docs/index.html — le LECTEUR, sans aucune donnée de jeu ─────────
let reader = fs.readFileSync(p('src', 'reader.html'), 'utf8');
const firebaseCfg = { ...(cfg.meta.firebase || {}) };
delete firebaseCfg._comment;
const firebaseEnabled = !!(firebaseCfg.databaseURL && firebaseCfg.apiKey);
reader = reader
  .replaceAll('__TITLE__', cfg.meta.title)
  .replaceAll('__SUBTITLE__', cfg.meta.subtitle || '')
  .replaceAll('__ITER__', String(ITER))
  .replaceAll('__HOSTCODE__', cfg.meta.hostCode)
  .replaceAll('__BASEURL__', BASE)
  .replaceAll('__GAMEID__', cfg.meta.gameId || 'game')
  .replaceAll('__SCORING__', JSON.stringify(cfg.meta.scoring || {}))
  .replaceAll('__ROSTER__', JSON.stringify(roster))
  .replaceAll('__FIREBASE_CONFIG__', JSON.stringify(firebaseEnabled ? firebaseCfg : null))
  .replaceAll('__RULES_HTML__', cfg.rulesHtml);
fs.writeFileSync(p('docs', 'index.html'), reader, 'utf8');

// garde-fou anti-fuite : aucune mission/cible/code ne doit traîner dans le fichier publié
const leak = Object.values(players).some(pl =>
  (pl.mission && reader.includes(pl.mission)) ||
  (pl.vip && reader.includes(pl.vip)) ||
  reader.includes(pl.code) && pl.code !== cfg.meta.hostCode);
if (leak) { console.error('\n❌ FUITE : une donnée de jeu apparaît dans docs/index.html'); process.exit(1); }

console.log(`\n${failures ? '⚠️  ' + failures + ' échec(s) crypto' : '✅ crypto OK (round-trip + rejet mauvais code)'}`);
console.log('✅ docs/index.html (lecteur sans données)');
console.log('✅ out/cards.html · out/qr/*.png · out/host_sheet.md');
console.log(`\nBase URL utilisée : ${BASE}`);
if (BASE.includes('clem6528-afk')) console.log('→ lié au compte GitHub clem6528-afk');
