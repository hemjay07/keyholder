import json, sys
W = json.load(open('words.json')); D = json.load(open('film-times.json')); C = D['CH']; TL = D['TL']
SPEC = []
def w(word, after):  # first word starting with `word` at or after `after` seconds
    for x in W:
        if x['s'] >= after and x['w'].lower().strip('.,?$').startswith(word.lower()): SPEC.append([word, after, 'start', x['s']]); return x['s']
    sys.exit(f'missing {word} after {after}')
def end(word, after):
    for x in W:
        if x['s'] >= after and x['w'].lower().strip('.,?$').startswith(word.lower()): SPEC.append([word, after, 'end', x['e']]); return x['e']
ch = lambda i: C[i - 1]; st = lambda i, name: ch(i)['t'] + ch(i)['st'][ch(i)['st'].index(name) + 1]
fa = lambda i, k: ch(i)['t'] + next(f['a'] for f in ch(i)['focus'] if f['k'] == k)
A = [(0, 0),
  (w('Every', 3), 4.3), (w('The', 7), 6.2), (w('Right', 9), 8.0), (end('period', 14) + .2, 11.6),
  (w('How', 15), ch(1)['qt'] + .4), (w('Keyholders', 22.5) - .5, ch(1)['t']),
  (w('One', 26), st(1, 'stages-0')), (w("can't", 31), st(1, 'stages-3')), (end('all', 32) + .6, ch(1)['t'] + ch(1)['dur']),
  (w('Here', 35) - .4, ch(2)['t']), (w('Pick', 40), st(2, 'map-1')), (end('out', 41.9) + 1.5, ch(2)['t'] + ch(2)['dur']),
  (w('Kamino', 49.5) - .4, ch(3)['t']), (w('admin', 53), fa(3, 'binding')), (end('stage', 57.9) + 1.5, ch(3)['t'] + ch(3)['dur']),
  (w('And', 63.5) - .4, ch(4)['t']), (w('two', 69.5), fa(4, 'alone')), (end('signature', 71) + 1.5, ch(4)['t'] + ch(4)['dur']),
  (w('Some', 76.5) - .4, ch(5)['t']), (w('One', 82), fa(5, 'oldest')), (end('run', 85) + 1.5, ch(5)['t'] + ch(5)['dur']),
  (w('You', 91) - .4, ch(6)['t']), (w('Ask', 94.5), st(6, 'ask-1')), (w('answer', 96), fa(6, 'answer')), (end('record', 97.5) + 1.5, ch(6)['t'] + ch(6)['dur']),
  (w('Would', 104.5), ch(7)['qt'] + .3), (w('We', 106.5) - .2, ch(7)['t']), (w('five', 111.5), st(7, 'drift-3')), (w('285', 112.5), fa(7, 'warning')), (end('moved', 114.4) + 2.0, ch(7)['t'] + ch(7)['dur']),
  (w('And', 125.5) - .4, ch(8)['t']), (w('refuses', 128.5), fa(8, 'refused')), (w('On', 132), st(8, 'build-1')), (w('refused', 132.9), fa(8, 'refusal')), (end('weakened', 136.4) + 1.5, ch(8)['t'] + ch(8)['dur']),
  (w('We', 142) - .4, ch(9)['t']), (w('two', 146), fa(9, 'selfline')), (end('public', 148.7) + 1.5, ch(9)['t'] + ch(9)['dur']),
  (w('Who', 154) - .3, TL['T_END'] - TL['T_OUTRO'] + .2), (end('order', 158.2) + 3.5, TL['T_END'])]
json.dump([dict(say=sp[0], after=sp[1], edge=sp[2], offset=round(a - sp[3], 2), film=round(b, 3)) for sp, (a, b) in zip(SPEC, A[1:])], open('../anchors.json', 'w'), indent=1)
HARD = {0, len(A) - 1}
A = [list(p) for p in A]
for _ in range(50):
    for i in range(1, len(A) - 1):
        (a0, b0), (a1, b1), (a2, b2) = A[i - 1], A[i], A[i + 1]
        lo = max(b0 + .3 * (a1 - a0), b2 - 1.9 * (a2 - a1)); hi = min(b0 + 1.9 * (a1 - a0), b2 - .3 * (a2 - a1))
        A[i][1] = min(max(b1, lo), hi) if lo <= hi else (lo + hi) / 2
for (a0, b0), (a1, b1) in zip(A, A[1:]):
    r = (b1 - b0) / (a1 - a0); print(f'{a0:7.2f}->{a1:7.2f}  film {b0:7.2f}->{b1:7.2f}  speed {r:4.2f}' + ('  <-- check' if r > 2 or r < .3 or r <= 0 else ''))
json.dump([[round(a, 3), round(b, 3)] for a, b in A], open('warp.json', 'w'))
