# 🌊 Swimulation

**International Swimming Results Predictor**

Swimulation predicts finishing times and medal probabilities for all Olympic swimming events across major international competitions — World Aquatics Championships, Olympic Games, Pan Pacific Championships, European Aquatics Championships, and Commonwealth Games.

Live demo: [proteeti89.github.io/swimulation](https://proteeti89.github.io/swimulation)

---

## Features

- **Leaderboard predictions** for all 26 Olympic swimming events (50m–1500m, all strokes)
- **Medal probability bars** powered by 300-run Monte Carlo simulation
- **Historical form charts** showing each athlete's trajectory from 2022–2025
- **Head-to-head comparisons** with win probability between any two athletes
- **Competition selector**: World Aquatics Championships, Olympics, Pan Pacs, Europeans, Commonwealth
- **Gender toggle** and full stroke/distance navigation
- **Regenerate** button for fresh prediction runs
- Dark navy / teal / gold sports theme, fully responsive

---

## How It Works

### Prediction Model

Each athlete's predicted race time is based on a weighted average of their season best and personal best:

```
baseTime = 0.65 × seasonBest + 0.35 × personalBest
```

Two small adjustments (each capped at ±0.5%) are applied:
- **Consistency adjustment**: athletes with more variable historical results are penalised slightly
- **Trend adjustment**: athletes who are improving get a small boost; declining athletes are penalised

### Monte Carlo Simulation

300 race simulations are run per event. Each simulation applies ±0.5% random variance to the base time. Medal probabilities reflect how often each athlete finishes gold/silver/bronze across all runs.

- Positions 1–3 show **medal probability**
- Positions 4–8 show **top-8 probability**

---

## Data Sources

Athlete data (personal bests, season bests, historical results 2022–2025) is sourced from:

- [World Aquatics](https://www.worldaquatics.com) — World Championships Singapore 2025
- [USA Swimming](https://www.usaswimming.org) — US Nationals 2025
- [TYR Pro Swim Series](https://www.usaswimming.org/pro-swim-series) — 2025 meets
- Olympic Games Paris 2024 results

Data reflects competition results through early 2026. For analytical and entertainment purposes only.

---

## File Structure

```
swimulation/
├── index.html              # App shell
├── css/
│   └── styles.css          # Dark theme, all component styles
├── js/
│   ├── data/
│   │   ├── events.js       # Event config, category mappings, world records
│   │   └── athletes.js     # Full athlete dataset (~200 athletes, 26 events)
│   ├── simulation.js       # Scoring engine + Monte Carlo
│   ├── render.js           # DOM rendering (leaderboard, charts, H2H)
│   └── app.js              # State management, event handlers, init
└── README.md
```

No build tools, no framework, no dependencies. Pure HTML/CSS/JS — runs directly in the browser or on GitHub Pages.

---

## Running Locally

```bash
git clone https://github.com/proteeti89/swimulation.git
cd swimulation
# Open index.html in any browser, or use a local server:
npx serve .
```

---

## GitHub Pages Deployment

The `main` branch is configured for GitHub Pages deployment. Any push to `main` automatically updates the live site at `proteeti89.github.io/swimulation`.

---

## Roadmap

- [ ] Relay events (4×100m, 4×200m Medley)
- [ ] Athlete profile pages with full career stats
- [ ] Real-time data updates via World Aquatics API
- [ ] World record probability calculation
- [ ] Mobile app version
- [ ] Export predictions as PDF/image

---

*Swimulation is a fan project for analytical and entertainment purposes. Not affiliated with World Aquatics, USA Swimming, or any governing body.*
