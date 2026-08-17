#!/usr/bin/env python3
"""Historique réel des restrictions (Propluvia → VigiEau) → jours d'été sans arroser.

Source : « Historique Communes » du jeu Donnée Sécheresse - VigiEau (data.gouv.fr),
un JSON de ~11 Go listant, commune par commune, le niveau de restriction QUOTIDIEN
par milieu (AEP eau potable / SOU souterraine / SUP superficielle).

Métrique produite, par département et par année :
  moyenne par commune du nombre de jours de juin-août où au moins un milieu est
  au niveau alerte, alerte renforcée ou crise (= arrosage restreint ou interdit).

Le résultat est fusionné dans static/data/real.json (clé `jours` de chaque dépt).

Usage :
  python3 scripts/build-restrictions.py <historique-communes.zip> [real.json]
"""

import io
import json
import re
import sys
import zipfile
from collections import defaultdict

ZIP = sys.argv[1]
REAL = sys.argv[2] if len(sys.argv) > 2 else 'static/data/real.json'

# Un enregistrement quotidien restreint : au moins un niveau ≥ alerte avant la date.
# Les enregistrements ne contiennent pas de '{', donc [^{]* reste dans le record.
RESTRICTED = re.compile(rb'"(?:alerte|alerte_renforcee|crise)"[^{]*?"date":"(\d{4})-(0[678])-\d{2}"')
COMMUNE = re.compile(rb'\{"commune":\{"code":"([0-9AB]{5})"')

restricted = defaultdict(int)   # (dept, year) -> jours restreints cumulés
communes = defaultdict(set)     # dept -> communes vues
years_seen = set()

def dept_of(code: bytes) -> str:
    c = code.decode()
    return c[:2]  # gère 2A/2B nativement (codes INSEE 2Axxx/2Bxxx)

with zipfile.ZipFile(ZIP) as z:
    name = z.infolist()[0].filename
    total = z.getinfo(name).file_size
    done = 0
    buf = b''
    cur_dept = None
    with z.open(name) as f:
        stream = io.BufferedReader(f, buffer_size=1 << 22)
        while True:
            chunk = stream.read(1 << 23)  # 8 Mo
            if not chunk:
                break
            done += len(chunk)
            buf += chunk
            # traite tout sauf la fin (un record peut être coupé) — les blocs commune
            # sont bien plus petits que le chunk, on garde 1 Mo de marge.
            safe, buf = buf[:-(1 << 20)], buf[-(1 << 20):]

            pos = 0
            for m in COMMUNE.finditer(safe):
                # tout ce qui précède ce marqueur appartient à la commune courante
                if cur_dept is not None:
                    for r in RESTRICTED.finditer(safe, pos, m.start()):
                        y = int(r.group(1))
                        restricted[(cur_dept, y)] += 1
                        years_seen.add(y)
                cur_dept = dept_of(m.group(1))
                communes[cur_dept].add(m.group(1))
                pos = m.start()
            if cur_dept is not None:
                for r in RESTRICTED.finditer(safe, pos):
                    y = int(r.group(1))
                    restricted[(cur_dept, y)] += 1
                    years_seen.add(y)
            if done % (1 << 28) < (1 << 23):
                print(f'  {done / 1e9:.1f} Go lus…', file=sys.stderr)
        # reliquat
        if cur_dept is not None:
            for r in RESTRICTED.finditer(buf):
                y = int(r.group(1))
                restricted[(cur_dept, y)] += 1
                years_seen.add(y)

years = sorted(years_seen)
print(f'Années couvertes : {years[0]}–{years[-1]}' if years else 'Aucune donnée', file=sys.stderr)

with open(REAL) as f:
    real = json.load(f)

merged = 0
for dept, deptdata in real['depts'].items():
    n = len(communes.get(dept, ()))
    if not n:
        continue
    jours = {}
    for y in years:
        jours[str(y)] = round(restricted.get((dept, y), 0) / n, 1)
    deptdata['jours'] = jours
    deptdata['joursMeta'] = {'communes': n, 'firstYear': years[0], 'lastYear': years[-1]}
    merged += 1

with open(REAL, 'w') as f:
    json.dump(real, f, ensure_ascii=False)

print(f'Fusionné : {merged} départements, années {years[0]}–{years[-1]} → {REAL}', file=sys.stderr)
# aperçu de contrôle
for d in ('19', '30', '35'):
    j = real['depts'].get(d, {}).get('jours', {})
    print(f'  {d}: 2022={j.get("2022")} 2023={j.get("2023")} 2025={j.get("2025")}', file=sys.stderr)
