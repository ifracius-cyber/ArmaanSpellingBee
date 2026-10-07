"""Merge the cleaned word list with the study data (definitions, synonyms, ...) into src/data/words.json.

Usage: python3 scripts/build_words.py <words_clean.json> <defs_dir> [--allow-missing]
"""
import glob, json, os, sys

words = json.load(open(sys.argv[1], encoding='utf-8'))
defs = {}
for path in sorted(glob.glob(os.path.join(sys.argv[2], 'chunk*.jsonl'))):
    for line in open(path, encoding='utf-8'):
        if line.strip():
            d = json.loads(line)
            defs[d['id']] = d

missing = [w['word'] for w in words if w['id'] not in defs]
if missing and '--allow-missing' not in sys.argv:
    sys.exit(f'{len(missing)} words have no study data, e.g. {missing[:5]}')

out = []
for w in words:
    d = defs.get(w['id'], {})
    syn = [s for s in d.get('syn', []) if s.lower() != w['word'].lower()]
    out.append({
        'id': w['id'], 'word': w['word'], 'level': w['level'], 'alts': w['alts'],
        'pos': d.get('pos', ''), 'def': d.get('def', ''), 'syn': syn or ['—'],
        'sent': d.get('sent', ''), 'origin': d.get('origin', ''), 'hint': d.get('hint', ''),
    })

dest = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'words.json')
with open(dest, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, separators=(',', ':'))
print(f'wrote {len(out)} words ({len(missing)} missing study data)')
