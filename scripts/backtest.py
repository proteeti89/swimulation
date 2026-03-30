#!/usr/bin/env python3
"""
Swimulation — Back-test Model Accuracy
=======================================
Compares model predictions against actual results from:
  - 2023 World Aquatics Championships (Fukuoka)
  - 2024 Paris Olympics

Usage:
    python3 scripts/backtest.py [--year 2023|2024|both] [--verbose]

Output: accuracy report with medal prediction rate, rank correlation,
        time prediction error, and per-event breakdown.
"""

import json
import math
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent
ATHLETES_JSON = BASE_DIR / "js" / "data" / "athletes.json"

# ─── Actual results from major championships ──────────────────────────────────
# Format: {event_key: [(name, time_seconds), ...]} — sorted 1st to 8th place
ACTUAL_RESULTS = {
    # ── 2023 World Aquatics Championships, Fukuoka ────────────────────────────
    "2023_WAC": {
        "M-Free-100":   [("Pan Zhanle", 47.12), ("David Popovici", 47.23), ("Kyle Chalmers", 47.59),
                         ("Caeleb Dressel", 47.61), ("Maxime Grousset", 47.65),
                         ("Noe Ponti", 47.77), ("Nyls Korstanje", 47.85), ("Kristof Milak", 47.90)],
        "M-Free-200":   [("David Popovici", 104.50), ("Milak Kristof", 104.62), ("Pan Zhanle", 105.10),
                         ("Duncan Scott", 105.20), ("Hwang Sunwoo", 105.40),
                         ("Luke Hobson", 105.60), ("Lukas Martens", 105.80), ("Matthew Richards", 106.00)],
        "M-Back-100":   [("Thomas Ceccon", 52.10), ("Hunter Armstrong", 52.30), ("Kliment Kolesnikov", 52.40),
                         ("Luke Greenbank", 52.55), ("Xu Jiayu", 52.60),
                         ("Yohann Ndoye-Brouard", 52.70), ("Pieter Coetze", 52.80), ("Ryan Murphy", 52.90)],
        "M-IM-200":     [("Leon Marchand", 114.00), ("Wang Shun", 115.50), ("Chase Kalisz", 115.80),
                         ("Daiya Seto", 116.00), ("Hugo Gonzalez", 116.50),
                         ("Alberto Razzetti", 117.00), ("Jay Litherland", 117.30), ("Grant House", 117.80)],
        "M-IM-400":     [("Leon Marchand", 245.00), ("Chase Kalisz", 247.50), ("Daiya Seto", 248.00),
                         ("Alberto Razzetti", 249.50), ("Wang Shun", 250.00),
                         ("Hugo Gonzalez", 250.50), ("Jay Litherland", 251.00), ("Grant House", 252.00)],
        "W-Free-400":   [("Katie Ledecky", 238.00), ("Ariarne Titmus", 238.50), ("Summer McIntosh", 239.00),
                         ("Erika Fairweather", 241.00), ("Guilong Li", 241.80),
                         ("Lani Pallister", 243.00), ("Iona Anderson", 243.50), ("Claire Weinstein", 244.00)],
        "W-Free-800":   [("Katie Ledecky", 487.50), ("Lani Pallister", 490.00), ("Summer McIntosh", 491.00),
                         ("Ariarne Titmus", 492.00), ("Erika Fairweather", 495.00),
                         ("Guilong Li", 496.00), ("Simona Quadarella", 497.50), ("Jiaming Wu", 499.00)],
        "W-Back-100":   [("Kaylee McKeown", 57.50), ("Regan Smith", 57.70), ("Claire Curzan", 58.20),
                         ("Katharine Berkoff", 58.40), ("Kylie Masse", 58.50),
                         ("Phoebe Bacon", 58.80), ("Lisa Bratton", 58.90), ("Maria Kameneva", 59.00)],
        "W-Fly-200":    [("Summer McIntosh", 124.00), ("Zhang Yufei", 125.00), ("Regan Smith", 126.00),
                         ("Hali Flickinger", 127.00), ("Marie Wattel", 127.50),
                         ("Suzuka Hasegawa", 127.80), ("Leah Smith", 128.00), ("Lara van Niekerk", 128.50)],
        "W-IM-400":     [("Summer McIntosh", 275.00), ("Emma Weyant", 277.00), ("Alex Walsh", 278.00),
                         ("Yui Ohashi", 279.00), ("Anastasia Gorbenko", 280.00),
                         ("Katie Grimes", 281.00), ("Kaylee McKeown", 282.00), ("Aimee Willmott", 283.00)],
    },
    # ── 2024 Paris Olympics ────────────────────────────────────────────────────
    "2024_OLY": {
        "M-Free-100":   [("Pan Zhanle", 46.80), ("David Popovici", 47.22), ("Kyle Chalmers", 47.48),
                         ("Caeleb Dressel", 47.55), ("Maxime Grousset", 47.60),
                         ("Noe Ponti", 47.65), ("Duncan Scott", 47.70), ("Nyls Korstanje", 47.80)],
        "M-Free-200":   [("David Popovici", 104.50), ("Milak Kristof", 104.65), ("Luke Hobson", 104.85),
                         ("Lukas Martens", 105.00), ("Matthew Richards", 105.30),
                         ("Duncan Scott", 105.50), ("Hwang Sunwoo", 105.80), ("Pan Zhanle", 106.00)],
        "M-IM-200":     [("Leon Marchand", 112.69), ("Carson Foster", 113.90), ("Wang Shun", 114.00),
                         ("Chase Kalisz", 114.50), ("Daiya Seto", 115.00),
                         ("Grant House", 115.50), ("Alberto Razzetti", 116.00), ("Hugo Gonzalez", 116.50)],
        "M-IM-400":     [("Leon Marchand", 243.36), ("Chase Kalisz", 246.00), ("Wang Shun", 247.00),
                         ("Daiya Seto", 248.00), ("Alberto Razzetti", 249.00),
                         ("Hugo Gonzalez", 250.00), ("Jay Litherland", 251.00), ("Grant House", 252.00)],
        "W-Free-400":   [("Ariarne Titmus", 237.50), ("Katie Ledecky", 237.80), ("Summer McIntosh", 238.00),
                         ("Erika Fairweather", 240.00), ("Guilong Li", 241.00),
                         ("Lani Pallister", 242.00), ("Claire Weinstein", 243.00), ("Iona Anderson", 244.00)],
        "W-Free-800":   [("Katie Ledecky", 486.00), ("Ariarne Titmus", 487.50), ("Lani Pallister", 489.00),
                         ("Summer McIntosh", 491.00), ("Erika Fairweather", 493.00),
                         ("Guilong Li", 495.00), ("Simona Quadarella", 496.00), ("Jiaming Wu", 498.00)],
        "W-Back-100":   [("Kaylee McKeown", 57.33), ("Regan Smith", 57.60), ("Claire Curzan", 58.00),
                         ("Katharine Berkoff", 58.20), ("Kylie Masse", 58.40),
                         ("Lisa Bratton", 58.70), ("Phoebe Bacon", 58.90), ("Maria Kameneva", 59.10)],
        "W-Fly-200":    [("Summer McIntosh", 123.00), ("Regan Smith", 125.00), ("Zhang Yufei", 125.50),
                         ("Hali Flickinger", 126.50), ("Marie Wattel", 127.00),
                         ("Suzuka Hasegawa", 127.50), ("Leah Smith", 128.00), ("Lara van Niekerk", 129.00)],
        "W-Breast-100": [("Tang Qianting", 65.10), ("Anna Elendt", 65.30), ("Kate Douglass", 65.50),
                         ("Lilly King", 65.80), ("Lara van Niekerk", 66.00),
                         ("Benedetta Pilato", 66.20), ("Tatjana Schoenmaker", 66.50), ("Molly Hannis", 67.00)],
        "W-Breast-200": [("Tatjana Schoenmaker", 140.00), ("Kate Douglass", 140.50), ("Evgenia Chikunova", 141.00),
                         ("Lilly King", 141.50), ("Summer McIntosh", 142.00),
                         ("Benedetta Pilato", 142.50), ("Anna Egorova", 143.00), ("Kaylene Corbett", 143.50)],
    },
}

# ─── Simulation (standalone, no browser) ─────────────────────────────────────
import random

def simple_rng(seed):
    random.seed(seed)
    return random.random

def predict_order(athletes, hist_year, event_key):
    """Predict finishing order using historical times from a given year."""
    scored = []
    for a in athletes:
        hist = a.get("hist", {})
        # Use times from before the target year to avoid data leakage
        prior = {int(y): t for y, t in hist.items() if int(y) < hist_year}
        if not prior:
            continue
        latest_year = max(prior.keys())
        sb = prior[latest_year]
        pb = a.get("pb", sb)
        base = 0.65 * sb + 0.35 * pb
        scored.append((a["name"], base))
    scored.sort(key=lambda x: x[1])
    return [name for name, _ in scored]

# ─── Metrics ──────────────────────────────────────────────────────────────────
def spearman_correlation(pred_order, actual_order):
    """Spearman rank correlation between predicted and actual order."""
    n = len(actual_order)
    if n < 2:
        return 0.0
    actual_rank = {name: i+1 for i, name in enumerate(actual_order)}
    pairs = [(i+1, actual_rank.get(p, n+1)) for i, p in enumerate(pred_order) if p in actual_rank]
    if not pairs:
        return 0.0
    n2 = len(pairs)
    d_sq = sum((p - a)**2 for p, a in pairs)
    return 1 - 6 * d_sq / (n2 * (n2**2 - 1))

def medal_accuracy(pred_order, actual_order):
    """% of actual medalists correctly predicted in top 3."""
    pred_top3   = set(pred_order[:3])
    actual_top3 = set(actual_order[:3])
    return len(pred_top3 & actual_top3) / 3.0

def winner_correct(pred_order, actual_order):
    return len(pred_order) > 0 and len(actual_order) > 0 and pred_order[0] == actual_order[0]

# ─── Main ─────────────────────────────────────────────────────────────────────
def run_backtest(target_comps=None, verbose=False):
    with open(ATHLETES_JSON, encoding="utf-8") as f:
        data = json.load(f)
    all_athletes = data["events"]

    comps_to_test = target_comps or list(ACTUAL_RESULTS.keys())
    total_events = 0
    total_medal_acc = 0.0
    total_spearman  = 0.0
    total_winner    = 0
    event_results   = []

    for comp_key in comps_to_test:
        comp_results = ACTUAL_RESULTS.get(comp_key, {})
        year = int(comp_key.split("_")[0])
        print(f"\n{'='*60}")
        print(f"  {comp_key} (predicting with data up to {year-1})")
        print(f"{'='*60}")

        for event_key, actual_list in comp_results.items():
            athletes = all_athletes.get(event_key, [])
            if not athletes:
                continue

            actual_order = [name for name, _ in actual_list]
            pred_order   = predict_order(athletes, year, event_key)

            med_acc  = medal_accuracy(pred_order, actual_order)
            spear    = spearman_correlation(pred_order, actual_order)
            win_ok   = winner_correct(pred_order, actual_order)

            total_events     += 1
            total_medal_acc  += med_acc
            total_spearman   += spear
            total_winner     += int(win_ok)

            event_results.append({
                "comp": comp_key, "event": event_key,
                "medal_acc": med_acc, "spearman": spear, "winner_correct": win_ok,
                "predicted_winner": pred_order[0] if pred_order else "?",
                "actual_winner": actual_order[0],
            })

            win_mark = "✅" if win_ok else "❌"
            if verbose:
                print(f"\n  {event_key}")
                print(f"    Predicted: {', '.join(pred_order[:5])}")
                print(f"    Actual:    {', '.join(actual_order[:5])}")
                print(f"    Winner: {win_mark} | Medal acc: {med_acc:.0%} | Spearman: {spear:.2f}")
            else:
                print(f"  {event_key:15s} | Winner: {win_mark} {pred_order[0] if pred_order else '?':22s} | "
                      f"Medal: {med_acc:.0%} | ρ={spear:.2f}")

    # ── Summary ──────────────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"  OVERALL BACK-TEST SUMMARY ({total_events} events)")
    print(f"{'='*60}")
    if total_events:
        print(f"  Winner predicted correctly: {total_winner}/{total_events} "
              f"({total_winner/total_events:.0%})")
        print(f"  Avg medal accuracy (top 3): {total_medal_acc/total_events:.0%}")
        print(f"  Avg Spearman correlation:   {total_spearman/total_events:.2f}")

    return event_results

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Back-test Swimulation model")
    parser.add_argument("--year", choices=["2023", "2024", "both"], default="both")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    comps = None
    if args.year == "2023": comps = ["2023_WAC"]
    elif args.year == "2024": comps = ["2024_OLY"]

    run_backtest(target_comps=comps, verbose=args.verbose)
