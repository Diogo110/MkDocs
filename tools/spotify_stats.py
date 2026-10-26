"""Lê o export "Extended streaming history" do Spotify e gera docs/data/spotify_stats.json.

Uso:
    python tools/spotify_stats.py                      # lê de data/spotify/
    python tools/spotify_stats.py "C:/caminho/da/pasta"

Privacidade: o JSON final só tem totais (nada de IP, dispositivo, país...).
"""
import json                                    # json: ler e escrever ficheiros .json
import sys                                     # sys: acede aos argumentos do terminal e permite sair com erro
from collections import Counter, defaultdict   # Counter = "contador de coisas"; defaultdict = dicionário com valor inicial automático
from datetime import datetime, timedelta       # datetime = data+hora; timedelta = diferença entre duas datas
from pathlib import Path                       # Path: forma moderna de trabalhar com caminhos de ficheiros
from zoneinfo import ZoneInfo                  # ZoneInfo: fusos horários (o Spotify guarda tudo em UTC)

# sys.argv é a lista de palavras que escreveste no terminal; [1] é a primeira depois do nome do script
INPUT_DIR = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("data/spotify")  # pasta com os ficheiros do Spotify
OUTPUT_FILE = Path("docs/data/spotify_stats.json")  # ficheiro que vamos criar (o site lê este)
MIN_PLAY_MS = 30_000                           # 30 000 milissegundos = 30 s; abaixo disto o Spotify não conta como "play"
TIMEZONE = ZoneInfo("Europe/Lisbon")           # queremos as horas do relógio de Lisboa
MS_PER_HOUR = 3_600_000                        # 1 hora = 3 600 000 milissegundos
MIN_HEATMAP_YEAR_HOURS = 1000                  # o mapa de calor só conta anos com MAIS de 1000 h de música (anos quase vazios distorcem a média)


def load_plays():                              # função que junta todos os registos de todos os ficheiros
    plays = []                                 # lista vazia onde vamos acumular os registos
    # rglob procura também dentro de subpastas; sorted põe os ficheiros por ordem
    for file in sorted(INPUT_DIR.rglob("Streaming_History_Audio_*.json")):  # repete para cada ficheiro encontrado
        with open(file, encoding="utf-8") as f:  # abre o ficheiro (e fecha-o sozinho no fim do "with")
            plays.extend(json.load(f))         # json.load lê o ficheiro; extend junta os registos à lista grande
    return plays                               # devolve a lista completa a quem chamou a função


def to_hours(ms):                              # converte milissegundos em horas
    return round(ms / MS_PER_HOUR, 1)          # divide por 3 600 000 e arredonda a 1 casa decimal


def compute_stats(plays):                      # recebe os registos e devolve o dicionário final com as estatísticas
    artist_ms = Counter()                      # artista -> milissegundos ouvidos
    artist_plays = Counter()                   # artista -> nº de plays
    track_ms = Counter()                       # (música, artista) -> milissegundos
    track_plays = Counter()                    # (música, artista) -> nº de plays
    year_ms = Counter()                        # ano -> milissegundos
    year_artist_ms = defaultdict(Counter)      # ano -> (artista -> milissegundos); serve para achar o artista de cada ano
    month_ms = Counter()                       # "2024-05" -> milissegundos
    day_ms = Counter()                         # data -> milissegundos
    week_hour_ms = [[0] * 24 for _ in range(7)]  # tabela 7 dias x 24 horas (todos os anos): usada em by_hour e by_weekday
    year_week_hour_ms = defaultdict(lambda: [[0] * 24 for _ in range(7)])  # ano -> tabela 7x24 própria; serve para o mapa de calor escolher só os anos fortes
    attempts = skipped = valid = shuffled = 0  # quatro contadores a começar em zero

    for play in plays:                         # percorre os registos um a um
        artist = play.get("master_metadata_album_artist_name")  # .get devolve None se o campo não existir (não dá erro)
        track = play.get("master_metadata_track_name")          # nome da música
        ms = play.get("ms_played", 0)          # quanto tempo ouviste (0 se o campo faltar)
        if not artist or not track:            # sem artista ou música = podcast/vídeo
            continue                           # ignora este registo e passa ao seguinte

        # os skips contam-se ANTES de descartar os plays curtos
        # (senão o filtro dos 30 s apagava quase todos os skips, e a taxa saía baixa demais)
        attempts += 1                          # mais uma música que começou a tocar (curta ou não)
        # "fwdbtn" = carregaste no botão "seguinte"; o campo "skipped" só vem preenchido em exports antigos
        skipped += bool(play.get("skipped")) or play.get("reason_end") == "fwdbtn"  # True conta como 1, False como 0

        if ms < MIN_PLAY_MS:                   # play com menos de 30 s
            continue                           # não entra nas restantes estatísticas

        # converte "2024-05-01T12:00:00Z" (UTC) para a hora de Lisboa
        moment = datetime.fromisoformat(play["ts"].replace("Z", "+00:00")).astimezone(TIMEZONE)  # Z vira +00:00 porque o Python não percebe "Z"

        valid += 1                             # mais um play válido
        shuffled += bool(play.get("shuffle"))  # se estava em modo aleatório soma 1

        artist_ms[artist] += ms                # soma o tempo ao artista
        artist_plays[artist] += 1              # soma 1 play ao artista
        key = (track, artist)                  # uma música é identificada pelo par (nome, artista)
        track_ms[key] += ms                    # soma o tempo à música
        track_plays[key] += 1                  # soma 1 play à música
        year_ms[moment.year] += ms             # soma o tempo ao ano
        year_artist_ms[moment.year][artist] += ms  # soma o tempo ao artista dentro desse ano
        month_ms[moment.strftime("%Y-%m")] += ms   # strftime formata a data como texto, ex.: "2024-05"
        day_ms[moment.date()] += ms            # soma o tempo ao dia
        week_hour_ms[moment.weekday()][moment.hour] += ms  # weekday(): segunda=0 ... domingo=6; hour: 0-23
        year_week_hour_ms[moment.year][moment.weekday()][moment.hour] += ms  # o mesmo, mas guardado por ano

    if not valid:                              # se nada passou nos filtros, não há nada para calcular
        sys.exit("No music plays longer than 30 s were found.")  # termina o programa com esta mensagem

    # maior sequência de dias seguidos a ouvir música
    days = sorted(day_ms)                      # todos os dias com música, por ordem
    best = current = 1                         # sequência recorde e sequência atual (começam em 1 dia)
    for before, after in zip(days, days[1:]):  # zip junta pares vizinhos: (dia1,dia2), (dia2,dia3)...
        current = current + 1 if after - before == timedelta(days=1) else 1  # dias seguidos? +1 : recomeça em 1
        best = max(best, current)              # guarda o maior valor que já vimos

    # MAPA DE CALOR: só entram os anos com mais de 1000 h de música (ex.: 2023 a 2026); os anos quase vazios ficam de fora
    heat_years = sorted(y for y, ms in year_ms.items() if ms / MS_PER_HOUR > MIN_HEATMAP_YEAR_HOURS) or sorted(year_ms)  # "or": se nenhum ano chegar às 1000 h, usa todos
    heat_week_hour_ms = [[sum(year_week_hour_ms[y][d][h] for y in heat_years) for h in range(24)] for d in range(7)]  # soma só esses anos
    heat_days = [d for d in days if d.year in heat_years]  # dias com música dentro desses anos

    # nº de dias do CALENDÁRIO de cada dia da semana, do primeiro ao último dia com música (só nos anos escolhidos)
    # (conta também os dias em que não ouvi nada: assim cada quadrado mostra um dia típico, não só os dias bons)
    first_day, last_day = heat_days[0], heat_days[-1]
    calendar_days_per_weekday = Counter((first_day + timedelta(days=i)).weekday() for i in range((last_day - first_day).days + 1))
    # média de MINUTOS de música em cada hora de um dia típico (ex.: uma segunda-feira qualquer)
    avg_minutes = [
        [round(heat_week_hour_ms[d][h] / 60_000 / max(calendar_days_per_weekday[d], 1), 1) for h in range(24)]
        for d in range(7)
    ]

    top_day, top_day_ms = day_ms.most_common(1)[0]  # most_common(1) = o dia com mais ms; [0] tira-o da lista
    total_ms = sum(artist_ms.values())         # milissegundos totais ouvidos
    hour_ms = [sum(week_hour_ms[d][h] for d in range(7)) for h in range(24)]  # total de cada hora do dia (somando os 7 dias)
    weekday_ms = [sum(row) for row in week_hour_ms]  # total de cada dia da semana (somando as 24 horas)

    return {                                   # o dicionário que vai virar o JSON
        "total_hours": round(total_ms / MS_PER_HOUR),                # horas totais (inteiro)
        "total_plays": valid,                                        # nº de plays válidos
        "unique_artists": len(artist_ms),                            # quantos artistas diferentes
        "unique_tracks": len(track_ms),                              # quantas músicas diferentes
        "first_year": min(year_ms),                                  # ano mais antigo
        "last_year": max(year_ms),                                   # ano mais recente
        "active_days": len(day_ms),                                  # dias com pelo menos 1 play
        "total_minutes": round(total_ms / 60_000),                   # minutos totais (o site converte entre min / h / dias)
        "avg_minutes_per_active_day": round(total_ms / len(day_ms) / 60_000),  # média de minutos por dia com música (exato, sem arredondar a horas)
        "avg_hours_per_active_day": to_hours(total_ms / len(day_ms)),  # média de horas por dia com música
        "skip_rate": round(100 * skipped / attempts),                # % de músicas saltadas (sobre TODAS as tentativas)
        "shuffle_rate": round(100 * shuffled / valid),               # % de plays em aleatório
        "skipped_plays": skipped,                                    # nº de músicas saltadas (o site mostra "X de Y")
        "total_attempts": attempts,                                  # nº de músicas que começaram a tocar (base da taxa de skips)
        "shuffled_plays": shuffled,                                  # nº de plays em aleatório
        "last_date": days[-1].isoformat(),                           # último dia com música: serve para marcar o ano em curso como parcial
        "longest_streak_days": best,                                 # recorde de dias seguidos
        "busiest_day": {"date": top_day.isoformat(), "hours": to_hours(top_day_ms), "minutes": round(top_day_ms / 60_000)},  # isoformat -> "2026-09-29"
        "top_artists": [                                             # lista dos 15 artistas com mais horas
            {"name": name, "hours": to_hours(ms), "plays": artist_plays[name]}  # um dicionário por artista
            for name, ms in artist_ms.most_common(15)                # most_common ordena do maior para o menor
        ],
        "top_tracks": [                                              # lista das 10 músicas com mais plays
            {"name": name, "artist": artist, "plays": count, "hours": to_hours(track_ms[(name, artist)])}  # count = nº de plays
            for (name, artist), count in track_plays.most_common(10)  # ordenado por plays
        ],
        "by_year": [                                                 # uma entrada por ano
            {"year": year, "hours": to_hours(ms), "top_artist": year_artist_ms[year].most_common(1)[0][0]}  # [0][0] = nome do nº 1
            for year, ms in sorted(year_ms.items())                  # sorted põe os anos por ordem
        ],
        "by_month": [{"month": month, "hours": to_hours(ms)} for month, ms in sorted(month_ms.items())],  # uma entrada por mês
        "by_hour": [to_hours(ms) for ms in hour_ms],                 # 24 valores (hora 0 a 23)
        "by_weekday": [to_hours(ms) for ms in weekday_ms],           # 7 valores (segunda a domingo)
        "heatmap_avg_min": avg_minutes,                              # tabela 7x24: média de MINUTOS de música por hora, num dia típico
        "heatmap_years": heat_years,                                 # anos usados no mapa de calor (os que têm mais de 1000 h)
    }


if __name__ == "__main__":                     # só corre isto se executares ESTE ficheiro (não se for importado)
    plays = load_plays()                       # 1) lê todos os ficheiros do Spotify
    if not plays:                              # lista vazia = pasta errada ou ficheiros não encontrados
        sys.exit(f"No Streaming_History_Audio_*.json files found in {INPUT_DIR}")  # avisa e termina
    stats = compute_stats(plays)               # 2) faz todas as contas
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)  # 3) cria a pasta docs/data se ainda não existir
    OUTPUT_FILE.write_text(json.dumps(stats, indent=2, ensure_ascii=False), encoding="utf-8")  # 4) grava o JSON (indent = legível)
    print(f"{len(plays)} records read -> {stats['total_hours']} h of music, {stats['unique_artists']} artists, {stats['skip_rate']}% skips")  # resumo