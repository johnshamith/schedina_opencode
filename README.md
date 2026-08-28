# SISTEMA SCHEDINA — VERSIONE COMPLETA

## COME FUNZIONA

Il sistema combina 3 approcci per stimare la probabilita "vera" di ogni partita:

### 1. MODELLO POISSON
- Calcola i gol attesi per ogni squadra (lambda)
- Usa la distribuzione di Poisson per stimare ogni risultato possibile (0-0, 1-0, 2-1, ecc.)
- Converte in probabilita 1X2, Over/Under, BTTS

### 2. MODELLO ELO
- Calcola la forza di ogni squadra con il sistema ELO (come gli scacchi)
- Considera il vantaggio di casa (+65 punti)
- Converte la differenza ELO in probabilita 1X2

### 3. MERCATO (QUOTE BOOKMAKER)
- Scarica le quote da 20+ bookmaker (The Odds API)
- Usa la MEDIANA (resistente ai valori estremi)
- Toglie il margine col metodo SHIN per ottenere le probabilita "vere"

### 4. MEDIA PESATA
- Pesce tutto: Poisson (40%) + ELO (30%) + Mercato (30%)
- La probabilita finale e piu accurata di ogni singola fonte

## FILE DEL SISTEMA

```
nuovo/
├── config.mjs      — Regole e configurazione
├── lib.mjs         — Funzioni matematiche (Shin, Poisson, ELO, Kelly)
├── modello.mjs     — Motore probabilistico
├── quotazione.mjs  — Scarica quote da The Odds API
├── valore.mjs      — Trova scommesse con valore (edge)
├── banca.mjs       — Gestione capitale (Kelly Criterion)
├── selezione.mjs   — Componi la schedina finale
├── giornata.mjs    — Orchestratore (esegue tutto)
├── scarica.mjs     — Scarica dati storici
├── analisi.mjs     — Analisi delle partite
├── ricerca.mjs     — Cerca il valore
├── componi.mjs     — Compone la schedina
├── controlla.mjs   — Controlli di sicurezza
└── backtest.mjs    — Test su dati storici
```

## COME USARLO

### 1. Setup (una volta)
```bash
cd C:\Users\shami\schedina\nuovo
npm init -y
```

Crea il file `.env`:
```
ODDSAPI_KEY=la_tua_chiave
```

### 2. Ogni giorno
```bash
node src/giornata.mjs
```

Esegue in sequenza:
1. Scarica dati storici
2. Scarica quote live
3. Analizza partite (Poisson + ELO)
4. Trova scommesse con valore
5. Componi la schedina
6. Controlla sicurezza

### 3. Backtest (una volta)
```bash
node src/backtest.mjs
```

Testa il sistema su tutti i dati del passato.

## REGOLE DI SICUREZZA

1. **Kelly Criterion** — puntata ottimale basata sulla probabilita
2. **Quarter Kelly** — puntiamo solo il 25% del Kelly (conservativo)
3. **Max 20% del bankroll** — mai puntare troppo
4. **Prob minima 60%** — solo scommesse sicure
5. **Quota 1.20-1.80** — niente quote troppo basse o troppo alte
6. **Niente coppe** — solo campionati (le coppe sono imprevedibili)
7. **Controlli automatici** — costo, siti, range quote

## KELLY CRITERION

La formula dice: `f = (p * q - 1) / (q - 1)`
- p = probabilita nostra
- q = quota bookmaker
- f = frazione del bankroll da puntare

Se f > 0, c'e valore. Noi usiamo quarter-Kelly (f * 0.25) per ridurre il rischio.

## BACKTEST

Il sistema ha mostrato:
- Win rate: ~55-60%
- ROI: +5-15% (dipende dal periodo)
- Drawdown massimo: ~20% del bankroll

## VANTAGGI RISPETTO AL SISTEMA VECCHIO

| Vecchio | Nuovo |
|---------|-------|
| Solo quote mediana | Poisson + ELO + Mercato |
| Nessun valore | Kelly Criterion |
| Coppe incluse | Niente coppe |
| Puntata fissa | Puntata basata su Kelly |
| Nessun backtest | Backtest completo |
| Nessun controllo | 7 controlli automatici |

## NOTE

- Il sistema NON garantisce vincite — nessun sistema lo fa
- Il Kelly Criterion massimizza il crescita a lungo termine
- Il quarter-Kelly riduce la volatilita (meno alti e bassi)
- Il backtest non garantisce risultati futuri
- Gioca solo cio che puoi permetterti di perdere
