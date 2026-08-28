// analisi.mjs — ANALISI PROBABILISTICA DELLE PARTITE
// Carica i dati, calcola Poisson + ELO, e salva le probabilita

import fs from 'node:fs';
import path from 'node:path';
import { DATI, log } from './lib.mjs';
import {
  caricaStorico, calcolaTuttiELO,
  analizzaGiornata, stampaAnalisi,
} from './modello.mjs';

// Carica quote
const quoteFile = path.join(DATI, 'quote.json');
if (!fs.existsSync(quoteFile)) {
  log('Mancano le quote. Lancia prima quotazione.mjs');
  process.exit(1);
}

const { eventi } = JSON.parse(fs.readFileSync(quoteFile, 'utf8'));
if (!eventi || eventi.length === 0) {
  log('Nessuna partita trovata nelle quote');
  process.exit(0);
}

log(`Analizzo ${eventi.length} partite...`);

// Analizza
const risultati = analizzaGiornata(eventi);

// Stampa
stampaAnalisi(risultati);

// Salva
fs.writeFileSync(path.join(DATI, 'analisi.json'), JSON.stringify({
  quando: new Date().toISOString(),
  nPartite: risultati.length,
  partite: risultati,
}, null, 1));

log(`Analisi completata: ${risultati.length} partite`);
