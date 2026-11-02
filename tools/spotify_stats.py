import json
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo


INPUT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/spotify")
OUTPUT_FILE = Path("docs/data/spotify_stats.json")
MIN_PLAY_MS = 30_000
TIMEZONE = ZoneInfo("Europe/Lisbon")
MS_PER_HOUR = 3_600_000
MIN_HEATMAP_YEAR_HOURS = 1000


def load_plays():
    plays = []

    for file in sorted(INPUT_DIR.rglob("Streaming_History_Audio_*.json")):
        with open(file, encoding="utf-8") as f:
            plays.extend(json.load(f))
    return plays


def to_hours(ms):
    return round(ms / MS_PER_HOUR, 1)


def compute_stats(plays):
    artist_ms = Counter()
    artist_plays = Counter()
    track_ms = Counter()
    track_plays = Counter()
    year_ms = Counter()
    year_artist_ms = defaultdict(Counter)
    month_ms = Counter()
    day_ms = Counter()
    week_hour_ms = [[0] * 24 for _ in range(7)]
    year_week_hour_ms = defaultdict(lambda: [[0] * 24 for _ in range(7)])
    attempts = skipped = valid = shuffled = 0

    for play in plays:
        artist = play.get("master_metadata_album_artist_name")
        track = play.get("master_metadata_track_name")
        ms = play.get("ms_played", 0)
        if not artist or not track:
            continue


        attempts += 1

        skipped += bool(play.get("skipped")) or play.get("reason_end") == "fwdbtn"

        if ms < MIN_PLAY_MS:
            continue


        moment = datetime.fromisoformat(play["ts"].replace("Z", "+00:00")).astimezone(TIMEZONE)

        valid += 1
        shuffled += bool(play.get("shuffle"))

        artist_ms[artist] += ms
        artist_plays[artist] += 1
        key = (track, artist)
        track_ms[key] += ms
        track_plays[key] += 1
        year_ms[moment.year] += ms
        year_artist_ms[moment.year][artist] += ms
        month_ms[moment.strftime("%Y-%m")] += ms
        day_ms[moment.date()] += ms
        week_hour_ms[moment.weekday()][moment.hour] += ms
        year_week_hour_ms[moment.year][moment.weekday()][moment.hour] += ms

    if not valid:
        sys.exit("No music plays longer than 30 s were found.")


    days = sorted(day_ms)
    best = current = 1
    for before, after in zip(days, days[1:]):
        current = current + 1 if after - before == timedelta(days=1) else 1
        best = max(best, current)


    heat_years = sorted(y for y, ms in year_ms.items() if ms / MS_PER_HOUR > MIN_HEATMAP_YEAR_HOURS) or sorted(year_ms)
    heat_week_hour_ms = [[sum(year_week_hour_ms[y][d][h] for y in heat_years) for h in range(24)] for d in range(7)]
    heat_days = [d for d in days if d.year in heat_years]


    first_day, last_day = heat_days[0], heat_days[-1]
    calendar_days_per_weekday = Counter((first_day + timedelta(days=i)).weekday() for i in range((last_day - first_day).days + 1))

    avg_minutes = [
        [round(heat_week_hour_ms[d][h] / 60_000 / max(calendar_days_per_weekday[d], 1), 1) for h in range(24)]
        for d in range(7)
    ]

    top_day, top_day_ms = day_ms.most_common(1)[0]
    total_ms = sum(artist_ms.values())
    hour_ms = [sum(week_hour_ms[d][h] for d in range(7)) for h in range(24)]
    weekday_ms = [sum(row) for row in week_hour_ms]

    return {
        "total_hours": round(total_ms / MS_PER_HOUR),
        "total_plays": valid,
        "unique_artists": len(artist_ms),
        "unique_tracks": len(track_ms),
        "first_year": min(year_ms),
        "last_year": max(year_ms),
        "active_days": len(day_ms),
        "total_minutes": round(total_ms / 60_000),
        "avg_minutes_per_active_day": round(total_ms / len(day_ms) / 60_000),
        "avg_hours_per_active_day": to_hours(total_ms / len(day_ms)),
        "skip_rate": round(100 * skipped / attempts),
        "shuffle_rate": round(100 * shuffled / valid),
        "skipped_plays": skipped,
        "total_attempts": attempts,
        "shuffled_plays": shuffled,
        "last_date": days[-1].isoformat(),
        "longest_streak_days": best,
        "busiest_day": {"date": top_day.isoformat(), "hours": to_hours(top_day_ms), "minutes": round(top_day_ms / 60_000)},
        "top_artists": [
            {"name": name, "hours": to_hours(ms), "plays": artist_plays[name]}
            for name, ms in artist_ms.most_common(15)
        ],
        "top_tracks": [
            {"name": name, "artist": artist, "plays": count, "hours": to_hours(track_ms[(name, artist)])}
            for (name, artist), count in track_plays.most_common(10)
        ],
        "by_year": [
            {"year": year, "hours": to_hours(ms), "top_artist": year_artist_ms[year].most_common(1)[0][0]}
            for year, ms in sorted(year_ms.items())
        ],
        "by_month": [{"month": month, "hours": to_hours(ms)} for month, ms in sorted(month_ms.items())],
        "by_hour": [to_hours(ms) for ms in hour_ms],
        "by_weekday": [to_hours(ms) for ms in weekday_ms],
        "heatmap_avg_min": avg_minutes,
        "heatmap_years": heat_years,
    }


if __name__ == "__main__":
    plays = load_plays()
    if not plays:
        sys.exit(f"No Streaming_History_Audio_*.json files found in {INPUT_DIR}")
    stats = compute_stats(plays)
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"{len(plays)} records read -> {stats['total_hours']} h of music, {stats['unique_artists']} artists, {stats['skip_rate']}% skips")