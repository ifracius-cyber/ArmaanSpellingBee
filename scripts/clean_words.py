import json, sys, re
d = json.load(open(sys.argv[1]))
out = []
seen = set()
for x in d:
    w = x['word']
    if 'study list' in w: continue
    w = w.replace(' (need to add)', '')
    alts = list(x['alts'])
    if '/' in w:
        a, b = w.split('/'); w = a; alts.insert(0, b)
    preferred = w.endswith('**')
    w = w.rstrip('*')
    alts = [a.rstrip('*') for a in alts]
    alts = [a for a in alts if a != w]
    w = w.replace('’', "'")
    out.append({'id': len(out), 'word': w, 'level': x['level'], 'alts': alts})
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False)
from collections import Counter
print(len(out), Counter(o['level'] for o in out))
print([o for o in out if "'" in o['word'] or ' ' in o['word']][:20])
