import re, json, sys, html
src = open(sys.argv[1], encoding='utf-8').read()
pages = re.findall(r'<page .*?</page>', src, re.S)
entries = []  # dicts: word, level, alt
level = 0
levels = {'One':1,'Two':2,'Three':3}
for p in pages:
    lines = []
    for m in re.finditer(r'<line xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">(.*?)</line>', p, re.S):
        x0,y0,x1,y1 = map(float, m.groups()[:4])
        words = [html.unescape(w) for w in re.findall(r'<word[^>]*>(.*?)</word>', m.group(5))]
        lines.append((x0,y0,x1,y1,' '.join(words)))
    # level header
    for l in lines:
        mm = re.match(r'Difficulty Level: (\w+) Bee', l[4])
        if mm: level = levels[mm.group(1)]
    # find paragraph bottom (wide lines)
    wide = [l for l in lines if l[2]-l[0] > 200]
    top = max([l[3] for l in wide], default=0)
    items = [l for l in lines if l[1] > top and l[2]-l[0] <= 200]
    def col(l):
        c = (l[0]+l[2])/2
        return 0 if c < 208 else (1 if c < 376 else 2)
    items.sort(key=lambda l:(col(l), l[1], l[0]))
    for l in items:
        t = l[4].strip()
        if not t or re.fullmatch(r'[A-Z]', t): continue
        if re.fullmatch(r'\d+', t): continue
        alt = False
        if t.startswith('OR '):
            alt = True; t = t[3:].strip()
        entries.append({'w':t,'level':level,'alt':alt})
# group alternates
out = []
for e in entries:
    if e['alt'] and out:
        out[-1]['alts'].append(e['w'])
    else:
        out.append({'word':e['w'],'level':e['level'],'alts':[]})
json.dump(out, open(sys.argv[2],'w'), ensure_ascii=False, indent=0)
from collections import Counter
print(len(out), Counter(o['level'] for o in out))
