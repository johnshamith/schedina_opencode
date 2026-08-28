// lib.mjs — FUNZIONI MATEMATICHE AVANZATE (MULTI-SPORT)
// Poisson, ELO, Kelly, modelli basket/tennis, utilities

import fs from 'node:fs';
import path from 'node:path';
export const DATI = path.join(process.cwd(), 'dati');
export const LOG = path.join(process.cwd(), 'log');

// ── UTILITIES ───────────────────────────────────────────────
export const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : null; };
export const fmt = (n, d = 2) => Number(n).toFixed(d).replace('.', ',');
export const pct = p => (p * 100).toFixed(1).replace('.', ',') + '%';
export const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

// ── LETTURA CSV ─────────────────────────────────────────────
export function leggiCsv(file) {
  if (!fs.existsSync(file)) return [];
  const testo = fs.readFileSync(file, 'utf8').replace(/\r/g, '').trim();
  if (!testo) return [];
  const righe = testo.split('\n');
  const intes = righe[0].replace(/^﻿/, '').split(',');
  const out = [];
  for (const r of righe.slice(1)) {
    if (!r.trim()) continue;
    const c = r.split(',');
    const o = {};
    for (let i = 0; i < intes.length; i++) o[intes[i]] = c[i] ?? '';
    if (o.HomeTeam || o.Home) out.push(o);
  }
  return out;
}

// ── DATA ITALIANA ───────────────────────────────────────────
export function dataIt(s) {
  if (!s) return null;
  const p = s.split('/');
  if (p.length !== 3) return null;
  let [g, m, a] = p.map(x => parseInt(x, 10));
  if (a < 100) a += 2000;
  const d = new Date(Date.UTC(a, m - 1, g));
  return Number.isNaN(d.getTime()) ? null : d;
}

// ── SHIN MODEL (toglie margine bookmaker) ───────────────────
export function togliMargine(quote) {
  if (!quote || quote.length < 2) return { prob: [], margine: 0 };
  const inv = quote.map(q => 1 / q);
  const somma = inv.reduce((a, b) => a + b, 0);
  let z = 0;
  for (let i = 0; i < 100; i++) {
    const p = inv.map(x => (Math.sqrt(z * z + 4 * (1 - z) * (x * x) / somma) - z) / (2 * (1 - z)));
    const err = p.reduce((a, b) => a + b, 0) - 1;
    z += err * 0.5;
    z = clamp(z, 0, 0.3);
  }
  const p = inv.map(x => (Math.sqrt(z * z + 4 * (1 - z) * (x * x) / somma) - z) / (2 * (1 - z)));
  const s = p.reduce((a, b) => a + b, 0);
  return { prob: p.map(x => x / s), margine: somma - 1 };
}

// ── MEDIANA ─────────────────────────────────────────────────
export function mediana(v) {
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ── POISSON MODEL (CALCIO) ─────────────────────────────────
export function poissonMatrix(lambdaCasa, lambdaTrasf, maxGol = 6) {
  const poisson = (k, lam) => {
    if (lam <= 0) return k === 0 ? 1 : 0;
    return (Math.pow(lam, k) * Math.exp(-lam)) / factorial(k);
  };
  const matrix = [];
  for (let i = 0; i <= maxGol; i++) {
    matrix[i] = [];
    for (let j = 0; j <= maxGol; j++) {
      matrix[i][j] = poisson(i, lambdaCasa) * poisson(j, lambdaTrasf);
    }
  }
  return matrix;
}

const factCache = [1, 1];
function factorial(n) {
  if (factCache[n] !== undefined) return factCache[n];
  factCache[n] = n * factorial(n - 1);
  return factCache[n];
}

// ── PROBABILITA DA POISSON (CALCIO) ────────────────────────
export function probDaPoisson(matrix) {
  const maxGol = matrix.length - 1;
  let p1 = 0, pX = 0, p2 = 0;
  let pOver25 = 0, pUnder25 = 0;
  let pBttsSi = 0, pBttsNo = 0;
  let golAttesi = 0;

  for (let i = 0; i <= maxGol; i++) {
    for (let j = 0; j <= maxGol; j++) {
      const p = matrix[i][j];
      if (i > j) p1 += p;
      else if (i === j) pX += p;
      else p2 += p;
      if (i + j > 2.5) pOver25 += p;
      else pUnder25 += p;
      if (i > 0 && j > 0) pBttsSi += p;
      else pBttsNo += p;
      golAttesi += (i + j) * p;
    }
  }

  return {
    h2h: [p1, pX, p2],
    over25: pOver25,
    under25: pUnder25,
    btts: [pBttsSi, pBttsNo],
    golAttesi,
  };
}

// ── ELO RATING ──────────────────────────────────────────────
export function calcolaELO(partite, kFactor = 20) {
  const elo = {};
  const BASE = 1500;

  for (const p of partite) {
    const casa = p.HomeTeam || p.home_team || p.casa;
    const trasf = p.awayTeam || p.away_team || p.trasf;
    if (!casa || !trasf) continue;

    if (elo[casa] === undefined) elo[casa] = BASE;
    if (elo[trasf] === undefined) elo[trasf] = BASE;

    const fthg = num(p.FTHG) ?? num(p.home_score) ?? num(p.home_pts);
    const ftag = num(p.FTAG) ?? num(p.away_score) ?? num(p.away_pts);
    const ftr = p.FTR || p.result;
    if (fthg === null || ftag === null) continue;

    const diff = elo[casa] - elo[trasf] + 65;
    const ecasa = 1 / (1 + Math.pow(10, -diff / 400));
    const etrasf = 1 - ecasa;

    let scasa, strasf;
    if (ftr === 'H' || fthg > ftag) { scasa = 1; strasf = 0; }
    else if (ftr === 'A' || fthg < ftag) { scasa = 0; strasf = 1; }
    else { scasa = 0.5; strasf = 0.5; }

    elo[casa] += kFactor * (scasa - ecasa);
    elo[trasf] += kFactor * (strasf - etrasf);
  }

  return elo;
}

// ── PROBABILITA DA ELO ──────────────────────────────────────
export function probDaELO(eloCasa, eloTrasf) {
  const diff = eloCasa - eloTrasf + 65;
  const pCasa = 1 / (1 + Math.pow(10, -diff / 400));
  const pTrasf = 1 / (1 + Math.pow(10, diff / 400));
  const pPareggio = 1 - pCasa - pTrasf;
  return [pCasa, Math.max(0.1, pPareggio), pTrasf];
}

// ── MEDIA PESATA ────────────────────────────────────────────
export function mediaPesata(fonti) {
  const totalePeso = fonti.reduce((a, f) => a + f.peso, 0);
  if (totalePeso === 0) return fonti[0]?.prob || [];
  const n = fonti[0].prob.length;
  const risultato = [];
  for (let i = 0; i < n; i++) {
    let somma = 0;
    for (const f of fonti) somma += f.prob[i] * f.peso;
    risultato.push(somma / totalePeso);
  }
  return risultato;
}

// ── KELLY CRITERION ─────────────────────────────────────────
export function kelly(prob, quota, fraction = 0.25) {
  if (prob <= 0 || quota <= 1) return 0;
  const q = quota - 1;
  const f = (prob * q - 1) / q;
  if (f <= 0) return 0;
  return clamp(f * fraction, 0, 0.20);
}

// ── VALORE DELLA SCOMMESSA ──────────────────────────────────
export function calcolaValore(prob, quota) {
  const edge = prob * quota - 1;
  const k = kelly(prob, quota);
  const ev = prob * (quota - 1) - (1 - prob);
  return { edge, kelly: k, ev };
}

// ── QUOTA GIUSTA ────────────────────────────────────────────
export function quotaGiusta(prob) {
  if (prob <= 0 || prob >= 1) return 0;
  return round(1 / prob, 2);
}

// ── MARGINE BOOKMAKER ───────────────────────────────────────
export function margineBookmaker(quote) {
  const inv = quote.map(q => 1 / q);
  return inv.reduce((a, b) => a + b, 0) - 1;
}

// ── STIMA LAMBDA (CALCIO) ───────────────────────────────────
export function stimaLambda(partite, nRecenti = 10) {
  if (partite.length === 0) return { casa: 1.3, trasf: 1.0 };
  const ultime = partite.slice(-nRecenti);
  const golFatti = ultime.map(p => num(p.FTHG) ?? num(p.home_score) ?? 0);
  const golSubiti = ultime.map(p => num(p.FTAG) ?? num(p.away_score) ?? 0);
  const mediaGolFatti = golFatti.reduce((a, b) => a + b, 0) / golFatti.length;
  const mediaGolSubiti = golSubiti.reduce((a, b) => a + b, 0) / golSubiti.length;
  return {
    attacco: mediaGolFatti,
    difesa: mediaGolSubiti,
    lambdaCasa: mediaGolFatti * 1.15,
    lambdaTrasf: mediaGolFatti * 0.85,
  };
}

// ══════════════════════════════════════════════════════════════
// MODELLO BASKET — Media punti + ELO
// ══════════════════════════════════════════════════════════════

// Stima punti attesi per squadra di basket
export function stimaPuntiBasket(partiteCasa, partiteTrasf, nRecenti = 10) {
  const calcMediaPunti = (partite, campo) => {
    if (!partite || partite.length === 0) return 80;
    const ultime = partite.slice(-nRecenti);
    const punti = ultime.map(p => {
      if (campo === 'casa') return num(p.home_pts) ?? num(p.FTHG) ?? 80;
      return num(p.away_pts) ?? num(p.FTAG) ?? 75;
    });
    return punti.reduce((a, b) => a + b, 0) / punti.length;
  };

  const calcMediaSubiti = (partite, campo) => {
    if (!partite || partite.length === 0) return 78;
    const ultime = partite.slice(-nRecenti);
    const subiti = ultime.map(p => {
      if (campo === 'casa') return num(p.away_pts) ?? num(p.FTAG) ?? 75;
      return num(p.home_pts) ?? num(p.FTHG) ?? 80;
    });
    return subiti.reduce((a, b) => a + b, 0) / subiti.length;
  };

  const puntiCasa = calcMediaPunti(partiteCasa, 'casa');
  const puntiTrasf = calcMediaPunti(partiteTrasf, 'trasf');
  const subitiCasa = calcMediaSubiti(partiteCasa, 'casa');
  const subitiTrasf = calcMediaSubiti(partiteTrasf, 'trasf');

  // Punti attesi = media attacco vs media difesa avversaria
  const attesiCasa = (puntiCasa + subitiTrasf) / 2;
  const attesiTrasf = (puntiTrasf + subitiCasa) / 2;

  return {
    casa: round(attesiCasa, 1),
    trasf: round(attesiTrasf, 1),
    mediaCasa: round(puntiCasa, 1),
    mediaTrasf: round(puntiTrasf, 1),
  };
}

// Probabilita vittoria basket da punti attesi
// Usa distribuzione normale (i punti seguono una curva di Gauss)
export function probVittoriaBasket(puntiCasa, puntiTrasf) {
  // Differenza attesa
  const diff = puntiCasa - puntiTrasf;
  // Deviazione standard tipica basket (~11 punti)
  const stdDev = 11;
  // Probabilita che la casa vinca (normale CDF approx)
  const z = diff / stdDev;
  const pCasa = normalCDF(z);
  const pTrasf = 1 - pCasa;
  return [pCasa, pTrasf];
}

// Funzione CDF normale (approssimazione)
function normalCDF(x) {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

// Over/Under punti totali basket
export function probOverUnderBasket(puntiCasa, puntiTrasf, linea = 165) {
  const totale = puntiCasa + puntiTrasf;
  const stdDev = 14; // deviazione standard totale punti
  const z = (totale - linea) / stdDev;
  const pOver = normalCDF(z);
  return { over: round(pOver, 4), under: round(1 - pOver, 4), totaleAtteso: round(totale, 1) };
}

// ══════════════════════════════════════════════════════════════
// MODELLO TENNIS — Ranking + Forma + Superficie
// ══════════════════════════════════════════════════════════════

// Probabilita vittoria tennis basata su ranking e forma
export function probVittoriaTennis(rankingCasa, rankingTrasf, formaCasa, formaTrasf) {
  // ELO tennis (ranking ATP/WTA in punti)
  const eloCasa = rankingToElo(rankingCasa);
  const eloTrasf = rankingToElo(rankingTrasf);

  // Forma: win rate ultime 10 partite (0-1)
  const fCasa = clamp(formaCasa || 0.6, 0.3, 0.9);
  const fTrasf = clamp(formaTrasf || 0.5, 0.3, 0.9);

  // Combina ELO + Forma
  const probElo = probDaELO(eloCasa, eloTrasf);
  const pCasa = probElo[0] * 0.6 + fCasa * 0.4;
  const pTrasf = probElo[2] * 0.6 + fTrasf * 0.4;

  // Normalizza
  const totale = pCasa + pTrasf;
  return [pCasa / totale, pTrasf / totale];
}

// Ranking ATP/WTA → ELO (approssimazione)
function rankingToElo(ranking) {
  if (!ranking || ranking <= 0) return 1500;
  // Rank 1 ~ ELO 2000, Rank 100 ~ ELO 1400
  return Math.max(1300, 2100 - ranking * 7);
}

// Over/Under game totali tennis
export function probOverUnderTennis(mediaGames, linea = 22.5) {
  const stdDev = 3.5;
  const z = (mediaGames - linea) / stdDev;
  const pOver = normalCDF(z);
  return { over: round(pOver, 4), under: round(1 - pOver, 4), mediaAttesa: round(mediaGames, 1) };
}

// ══════════════════════════════════════════════════════════════
// RILEVAMENTO VALORE MULTI-SPORT
// ══════════════════════════════════════════════════════════════

// Trova valore per mercato moneyline (basket/tennis)
export function trovaValoreMoneyline(probabilita, quote, nomi) {
  const scommesse = [];
  if (!probabilita || !quote || probabilita.length !== quote.length) return scommesse;

  for (let i = 0; i < probabilita.length; i++) {
    const pr = probabilita[i];
    const q = quote[i];
    if (!pr || !q || q <= 1 || pr <= 0) continue;

    const valore = calcolaValore(pr, q);
    if (valore.kelly > 0) {
      scommesse.push({
        esito: nomi[i],
        probNostra: pr,
        quotaBookmaker: q,
        quotaFair: quotaGiusta(pr),
        edge: valore.edge,
        kelly: valore.kelly,
        ev: valore.ev,
      });
    }
  }
  return scommesse;
}

// Trova valore per Over/Under
export function trovaValoreOU(probOver, probUnder, quotaOver, quotaUnder) {
  const scommesse = [];
  if (quotaOver > 1 && probOver > 0) {
    const v = calcolaValore(probOver, quotaOver);
    if (v.kelly > 0) {
      scommesse.push({
        esito: 'Over',
        probNostra: probOver,
        quotaBookmaker: quotaOver,
        quotaFair: quotaGiusta(probOver),
        edge: v.edge, kelly: v.kelly, ev: v.ev,
      });
    }
  }
  if (quotaUnder > 1 && probUnder > 0) {
    const v = calcolaValore(probUnder, quotaUnder);
    if (v.kelly > 0) {
      scommesse.push({
        esito: 'Under',
        probNostra: probUnder,
        quotaBookmaker: quotaUnder,
        quotaFair: quotaGiusta(probUnder),
        edge: v.edge, kelly: v.kelly, ev: v.ev,
      });
    }
  }
  return scommesse;
}

// ══════════════════════════════════════════════════════════════
// LOGGING
// ══════════════════════════════════════════════════════════════
export function log(msg) {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
  console.log(`[${now}] ${msg}`);
}

export function logFile(nomeFile, msg) {
  fs.mkdirSync(LOG, { recursive: true });
  const now = new Date().toISOString().slice(0, 10);
  const file = path.join(LOG, `${now}_${nomeFile}.txt`);
  const now2 = new Date().toISOString().slice(11, 19);
  fs.appendFileSync(file, `[${now2}] ${msg}\n`);
}
