// componi.mjs — COMPONE LA SCHEDINA FINALE
// Prende le scommesse con valore e le combina in una schedina

import fs from 'node:fs';
import path from 'node:path';
import { DATI, log } from './lib.mjs';
import { componiSchedina, stampaSchedina, salvaSchedina } from './selezione.mjs';
import { caricaBankroll } from './banca.mjs';

// Carica scommesse con valore
const valoreFile = path.join(DATI, 'valore.json');
if (!fs.existsSync(valoreFile)) {
  log('Mancano le scommesse con valore. Lancia prima ricerca.mjs');
  process.exit(1);
}

const { scommesse } = JSON.parse(fs.readFileSync(valoreFile, 'utf8'));
if (!scommesse || scommesse.length === 0) {
  log('Nessuna scommessa con valore');
  salvaSchedina(null);
  process.exit(0);
}

// Carica bankroll
const cassa = caricaBankroll();
log(`Bankroll: ${cassa.euro} e`);

// Componi schedina
const schedina = componiSchedina(scommesse, cassa.euro);

// Stampa
stampaSchedina(schedina);

// Salva
salvaSchedina(schedina);

if (schedina) {
  log(`Schedina ${schedina.tipo}: quota ${schedina.quota}, puntata ${schedina.puntata} e`);
}
