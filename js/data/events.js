/* ─── Events Config ─────────────────────────────────────────────────────────── */
'use strict';

/* ─── Competition eligibility ────────────────────────────────────────────────
 * Maps each competition to the set of eligible country codes.
 * null = all countries eligible (open international meet).
 *
 * Pan Pacific Championships  — Asia-Pacific + North America only (PRSO members)
 * European Championships     — European nations only (LEN members)
 * Commonwealth Games         — Commonwealth nations only
 * US Nationals               — USA only
 * World Aquatics / Olympics / TYR Pro Swim — open to all
 */
const COMP_ELIGIBILITY = {
  'World Aquatics Championships':     null,
  'Olympic Games':                    null,
  'TYR Pro Swim Series':              null,
  'Pan Pacific Championships': new Set([
    'USA','AUS','CAN','JPN','CHN','KOR','NZL','HKG','MEX',
    'TPE','MAS','SIN','INA','THA','PHI','GUM','SAM','FIJ',
  ]),
  'European Aquatics Championships': new Set([
    'GBR','FRA','GER','ITA','SUI','SWE','NED','HUN','BEL','DEN',
    'GRE','POL','IRL','MDA','SRB','ESP','ISR','UKR','ANA','NOR',
    'AUT','ROU','ROM','LTU','POR','SVK','CZE','BLR','LAT','EST',
    'FIN','LUX','MON','SLO','CRO','BUL','TUR','RUS',
  ]),
  'Commonwealth Games': new Set([
    'GBR','AUS','CAN','NZL','HKG','IND','RSA','JAM','NGR','MAS',
    'SIN','BAR','BAH','CYP','MLT','SCO','WAL','ENG','NAM','GHA',
  ]),
  'US Nationals': new Set(['USA']),
};

const EVENTS = {
  Freestyle:   [50, 100, 200, 400, 800, 1500],
  Backstroke:  [100, 200],
  Breaststroke:[100, 200],
  Butterfly:   [100, 200],
  IM:          [200, 400],
};

const CAT_ABBR = {
  Freestyle:    'Free',
  Backstroke:   'Back',
  Breaststroke: 'Breast',
  Butterfly:    'Fly',
  IM:           'IM',
};

/* ─── World Records (long course / 50m pool, verified as of March 2026) ────────
 * Sources: World Aquatics official records, SwimSwam, olympics.com
 * All times in decimal seconds. mm:ss.xx → (m*60)+ss.xx
 * ─────────────────────────────────────────────────────────────────────────────*/
const WORLD_RECORDS = {
  // ── Men ──────────────────────────────────────────────────────────────────
  // 20.88 — Cameron McEvoy (AUS), China Open Shenzhen, March 2026 (broke Cielo's 17-year super-suit record)
  'M-Free-50':    { time: 20.88,  holder: 'Cameron McEvoy',     year: 2026 },
  // 46.40 — Pan Zhanle (CHN), Paris Olympics 2024
  'M-Free-100':   { time: 46.40,  holder: 'Pan Zhanle',         year: 2024 },
  // 1:42.00 — Paul Biedermann (GER), Rome 2009 (super-suit)
  'M-Free-200':   { time: 102.00, holder: 'Paul Biedermann',    year: 2009 },
  // 3:39.96 — Lukas Märtens (GER), Stockholm Open 2025
  'M-Free-400':   { time: 219.96, holder: 'Lukas Märtens',      year: 2025 },
  // 7:32.12 — Zhang Lin (CHN), Rome 2009 (super-suit)
  'M-Free-800':   { time: 452.12, holder: 'Zhang Lin',          year: 2009 },
  // 14:31.02 — Sun Yang (CHN), London Olympics 2012
  'M-Free-1500':  { time: 871.02, holder: 'Sun Yang',           year: 2012 },
  // 51.60 — Thomas Ceccon (ITA), Budapest 2022
  'M-Back-100':   { time: 51.60,  holder: 'Thomas Ceccon',      year: 2022 },
  // 1:53.12 — Hubert Kos (HUN), Paris Olympics 2024
  'M-Back-200':   { time: 113.12, holder: 'Hubert Kos',         year: 2024 },
  // 56.88 — Adam Peaty (GBR), Gwangju 2019
  'M-Breast-100': { time: 56.88,  holder: 'Adam Peaty',         year: 2019 },
  // 2:05.48 — Qin Haiyang (CHN), Fukuoka 2023
  'M-Breast-200': { time: 125.48, holder: 'Qin Haiyang',        year: 2023 },
  // 49.45 — Caeleb Dressel (USA), Tokyo Olympics 2021
  'M-Fly-100':    { time: 49.45,  holder: 'Caeleb Dressel',     year: 2021 },
  // 1:50.34 — Kristóf Milák (HUN), Budapest 2022
  'M-Fly-200':    { time: 110.34, holder: 'Kristóf Milák',      year: 2022 },
  // 1:52.69 — Léon Marchand (FRA), Singapore 2025
  'M-IM-200':     { time: 112.69, holder: 'Léon Marchand',      year: 2025 },
  // 4:02.50 — Léon Marchand (FRA), Fukuoka 2023
  'M-IM-400':     { time: 242.50, holder: 'Léon Marchand',      year: 2023 },

  // ── Women ────────────────────────────────────────────────────────────────
  // 23.67 — Sarah Sjöström (SWE), Budapest 2017
  'W-Free-50':    { time: 23.67,  holder: 'Sarah Sjöström',     year: 2017 },
  // 51.71 — Sarah Sjöström (SWE), Budapest 2017
  'W-Free-100':   { time: 51.71,  holder: 'Sarah Sjöström',     year: 2017 },
  // 1:49.77 — Mollie O'Callaghan (AUS), Singapore 2025 (first sub-1:50)
  'W-Free-200':   { time: 109.77, holder: "Mollie O'Callaghan", year: 2025 },
  // 3:54.18 — Summer McIntosh (CAN), Canadian Trials 2025
  'W-Free-400':   { time: 234.18, holder: 'Summer McIntosh',    year: 2025 },
  // 8:04.12 — Katie Ledecky (USA), TYR Pro Swim Fort Lauderdale 2025
  'W-Free-800':   { time: 484.12, holder: 'Katie Ledecky',      year: 2025 },
  // 15:20.48 — Katie Ledecky (USA), Indianapolis 2018
  'W-Free-1500':  { time: 920.48, holder: 'Katie Ledecky',      year: 2018 },
  // 57.13 — Regan Smith (USA), US Olympic Trials 2024
  'W-Back-100':   { time: 57.13,  holder: 'Regan Smith',        year: 2024 },
  // 2:03.14 — Kaylee McKeown (AUS), 2023
  'W-Back-200':   { time: 123.14, holder: 'Kaylee McKeown',     year: 2023 },
  // 1:04.13 — Lilly King (USA), Budapest 2017
  'W-Breast-100': { time: 64.13,  holder: 'Lilly King',         year: 2017 },
  // 2:17.55 — Evgeniia Chikunova (RUS), Russian Championships 2023
  'W-Breast-200': { time: 137.55, holder: 'Evgeniia Chikunova', year: 2023 },
  // 54.60 — Gretchen Walsh (USA), TYR Pro Swim Fort Lauderdale 2025
  'W-Fly-100':    { time: 54.60,  holder: 'Gretchen Walsh',     year: 2025 },
  // 2:01.81 — Liu Zige (CHN), Rome 2009 (super-suit)
  'W-Fly-200':    { time: 121.81, holder: 'Liu Zige',           year: 2009 },
  // 2:05.70 — Summer McIntosh (CAN), Canadian Trials 2025
  'W-IM-200':     { time: 125.70, holder: 'Summer McIntosh',    year: 2025 },
  // 4:23.65 — Summer McIntosh (CAN), Canadian Trials 2025
  'W-IM-400':     { time: 263.65, holder: 'Summer McIntosh',    year: 2025 },
};
