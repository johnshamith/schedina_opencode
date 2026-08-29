import { analizzaPartita, formattaAnalisi } from './analisiCompleta.mjs';

// Partite di oggi da analizzare
const partite = [
  { casa: 'Juventus', trasf: 'Parma', ora: '20:45' },
  { casa: 'Borussia Dortmund', trasf: 'Hamburger SV', ora: '18:30' },
  { casa: 'Barcelona', trasf: 'Rayo Vallecano', ora: '21:30' }
];

console.log('=== ANALISI COMPLETA PARTITE ===\n');

// Simula dati web (in produzione verranno da websearch)
const datiWebSimulati = {
  infortuni: [
    'Juventus: Vlahovic dubbio, Chiesa out',
    'Parma: tutti disponibili',
    'Dortmund: Brandt in forma',
    'Hamburg: nessun infortunato',
    'Barcelona: Yamal disponibile',
    'Rayo: tutti ok'
  ],
  news: [
    'Juventus in forte forma, ultime 5 vinte',
    'Parma in crisi, 3 sconfitte consecutive',
    'Dortmund favorita in casa',
    'Barcelona testa classifica'
  ],
  tipster: [
    'Juventus favorita al 78%',
    'Dortmund vince al 71%',
    'Barcelona al 83%'
  ]
};

// Analizza ogni partita
for (const p of partite) {
  const risultato = analizzaPartita(p.casa, p.trasf, datiWebSimulati);
  console.log(formattaAnalisi(risultato));
  console.log('---');
}

console.log('\n=== FINE ANALISI ===');
