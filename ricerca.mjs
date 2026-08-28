// ricerca.mjs — CERCA SCOMMESSE CON VALORE
// Confronta le probabilita nostre con le quote del mercato

import fs from 'node:fs';
import path from 'node:path';
import { DATI, log } from './lib.mjs';
import { eseguiValore } from './valore.mjs';

// Carica analisi
const analisiFile = path.join(DATI, 'analisi.json');
const quoteFile = path.join(DATI, 'quote.json');

if (!fs.existsSync(analisiFile) || !fs.existsSync(quoteFile)) {
  log('Mancano analisi o quote. Lancia prima i passi precedenti.');
  process.exit(1);
}

const { partite: partiteAnalizzate } = JSON.parse(fs.readFileSync(analisiFile, 'utf8'));
const { eventi: quoteRaw } = JSON.parse(fs.readFileSync(quoteFile, 'utf8'));

// Unisci le probabilita nostre con le quote del mercato
const partiteConQuote = [];
for (const p of partiteAnalizzate) {
  // Trova la corrispondenza nelle quote
  const q = quoteRaw.find(q =>
    q.casa === p.casa && q.trasf === p.trasf
  );
  if (q) {
    partiteConQuote.push({
      ...p,
      migliorQuota: q.migliorQuota,
      mediana: q.mediana,
      probMercato: q.probMercato,
      nSiti: q.nSiti,
    });
  } else {
    partiteConQuote.push(p);
  }
}

// Cerca valore
const scommesse = eseguiValore(partiteConQuote);
log(`Trovate ${scommesse.length} scommesse con valore`);
