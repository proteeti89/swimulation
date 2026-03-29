/* ─── Events Config ─────────────────────────────────────────────────────────── */
'use strict';

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

/* ─── World Records (as of early 2026) ─────────────────────────────────────── */
const WORLD_RECORDS = {
  'M-Free-50':    { time: 20.91, holder: 'César Cielo', year: 2009 },
  'M-Free-100':   { time: 46.40, holder: 'Pan Zhanle',  year: 2024 },
  'M-Free-200':   { time: 102.00, holder: 'Paul Biedermann', year: 2009 },
  'M-Free-400':   { time: 220.07, holder: 'Paul Biedermann', year: 2009 },
  'M-Free-800':   { time: 454.04, holder: 'Zhang Lin',  year: 2009 },
  'M-Free-1500':  { time: 870.21, holder: 'Sun Yang',   year: 2012 },
  'M-Back-100':   { time: 51.60,  holder: 'Thomas Ceccon', year: 2022 },
  'M-Back-200':   { time: 113.59, holder: 'Evgeny Rylov', year: 2021 },
  'M-Breast-100': { time: 56.88, holder: 'Adam Peaty',  year: 2019 },
  'M-Breast-200': { time: 125.95, holder: 'Zac Stubblety-Cook', year: 2022 },
  'M-Fly-100':    { time: 49.45, holder: 'Caeleb Dressel', year: 2021 },
  'M-Fly-200':    { time: 111.51, holder: 'Michael Phelps', year: 2009 },
  'M-IM-200':     { time: 112.69, holder: 'Leon Marchand', year: 2024 },
  'M-IM-400':     { time: 243.36, holder: 'Leon Marchand', year: 2023 },
  'W-Free-50':    { time: 23.67, holder: 'Sarah Sjöström', year: 2017 },
  'W-Free-100':   { time: 51.71, holder: 'Sarah Sjöström', year: 2017 },
  'W-Free-200':   { time: 112.98, holder: 'Federica Pellegrini', year: 2009 },
  'W-Free-400':   { time: 235.54, holder: 'Katie Ledecky', year: 2016 },
  'W-Free-800':   { time: 483.36, holder: 'Katie Ledecky', year: 2016 },
  'W-Free-1500':  { time: 924.16, holder: 'Katie Ledecky', year: 2018 },
  'W-Back-100':   { time: 57.16, holder: 'Kaylee McKeown', year: 2025 },
  'W-Back-200':   { time: 122.05, holder: 'Regan Smith', year: 2019 },
  'W-Breast-100': { time: 64.13, holder: 'Lilly King',  year: 2017 },
  'W-Breast-200': { time: 138.35, holder: 'Tatjana Schoenmaker', year: 2021 },
  'W-Fly-100':    { time: 55.48, holder: 'Sarah Sjöström', year: 2016 },
  'W-Fly-200':    { time: 121.81, holder: 'Liu Zige',    year: 2009 },
  'W-IM-200':     { time: 126.12, holder: 'Katinka Hosszu', year: 2015 },
  'W-IM-400':     { time: 271.50, holder: 'Katinka Hosszu', year: 2016 },
};
