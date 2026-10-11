"""Generate the flat SVG achievement badges in client/public/achievements/.

Each badge is hand-drawn SVG on a shared gold-rimmed disc. Edit an icon here
and rerun rather than editing the SVG output by hand:

    python3 scripts/gen-achievement-art.py client/public/achievements
"""
import os, math, sys
OUT = sys.argv[1]
INK = '#0b1220'
GOLD, AMBER, DAMBER, CREAM = '#facc15', '#f59e0b', '#b45309', '#fef3c7'
BLUE, DBLUE, LBLUE = '#3b82f6', '#1d4ed8', '#93c5fd'
RED, DRED, ORANGE = '#ef4444', '#b91c1c', '#f97316'
GREEN, DGREEN = '#22c55e', '#15803d'
STONE, DSTONE = '#94a3b8', '#64748b'
BOMB, BOMB2 = '#1f2937', '#374151'

def frame(body):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
<circle cx="64" cy="64" r="61" fill="#1e293b"/>
<circle cx="64" cy="64" r="52" fill="#26354d"/>
<circle cx="64" cy="64" r="59" fill="none" stroke="{GOLD}" stroke-width="4"/>
<circle cx="64" cy="64" r="53" fill="none" stroke="{GOLD}" stroke-opacity="0.3" stroke-width="1.5"/>
<g transform="translate(64 64) scale(0.84) translate(-64 -64)" stroke="{INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round">
{body}
</g>
</svg>
'''

def sparkle(x, y, s=5, c=GOLD):
    return (f'<path d="M{x} {y-s} Q{x} {y} {x+s} {y} Q{x} {y} {x} {y+s} Q{x} {y} {x-s} {y} Q{x} {y} {x} {y-s} Z" '
            f'fill="{c}" stroke="none"/>')

def bomb(cx, cy, r, face='', fuse=True, squash=1.0):
    ry = r * squash
    s = f'<ellipse cx="{cx}" cy="{cy}" rx="{r}" ry="{ry}" fill="{BOMB}"/>'
    s += f'<ellipse cx="{cx - r*0.35}" cy="{cy - ry*0.4}" rx="{r*0.22}" ry="{ry*0.14}" fill="#64748b" stroke="none" transform="rotate(-35 {cx - r*0.35} {cy - ry*0.4})"/>'
    # cap
    capx, capy = cx + r*0.5, cy - ry*0.82
    s += f'<rect x="{capx-5}" y="{capy-5}" width="10" height="8" rx="2" fill="{BOMB2}" transform="rotate(35 {capx} {capy})"/>'
    if fuse:
        fx, fy = capx + 3, capy - 4
        s += f'<path d="M{fx} {fy} q6 -8 13 -6" fill="none" stroke="{CREAM}" stroke-width="2.5"/>'
        s += f'<path d="M{fx+13} {fy-14} l3 6 l6 -1 l-4 5 l3 6 l-6 -3 l-5 4 l1 -7 l-5 -4 l7 0 z" fill="{ORANGE}" stroke="none"/>'
        s += f'<circle cx="{fx+15}" cy="{fy-6}" r="3" fill="{GOLD}" stroke="none"/>'
    return s + face

def card(x, y, w, h, fill='#f8fafc', rot=0, cx=None, cy=None, inner=''):
    t = f' transform="rotate({rot} {cx if cx is not None else x+w/2} {cy if cy is not None else y+h/2})"' if rot else ''
    return f'<g{t}><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="3" fill="{fill}"/>{inner}</g>'

icons = {}

# Grand Theft: the Grand crown, wearing a bandit mask.
icons['grand-theft'] = f'''
<path d="M30 92 L26 48 L46 64 L64 38 L82 64 L102 48 L98 92 Z" fill="{BLUE}"/>
<rect x="30" y="84" width="68" height="12" rx="2" fill="{DBLUE}"/>
<circle cx="26" cy="46" r="5" fill="{GOLD}"/><circle cx="64" cy="36" r="5" fill="{GOLD}"/><circle cx="102" cy="46" r="5" fill="{GOLD}"/>
<path d="M30 64 Q64 54 98 64 L96 78 Q64 70 32 78 Z" fill="{INK}"/>
<path d="M30 68 l-10 -4 M30 72 l-9 6" fill="none" stroke="{INK}" stroke-width="4"/>
<ellipse cx="50" cy="69" rx="7" ry="4.5" fill="#f8fafc" stroke="none"/><ellipse cx="78" cy="69" rx="7" ry="4.5" fill="#f8fafc" stroke="none"/>
<circle cx="52" cy="69" r="2.3" fill="{INK}" stroke="none"/><circle cx="80" cy="69" r="2.3" fill="{INK}" stroke="none"/>
<circle cx="64" cy="90" r="3" fill="{GOLD}"/>
{sparkle(104, 26)}{sparkle(22, 26, 4)}
'''

# Phoenix Rising: wings up, flame tail.
wing = f'''<path d="M60 70 C44 70 28 58 20 34 C32 44 40 46 46 44 C40 52 48 60 60 60 Z" fill="{ORANGE}"/>
<path d="M60 66 C48 66 38 58 34 48 C42 54 50 54 60 56 Z" fill="{GOLD}"/>'''
icons['phoenix-rising'] = f'''
<path d="M56 82 C50 94 54 104 64 112 C74 104 78 94 72 82 Z" fill="{RED}"/>
<path d="M59 84 C57 92 59 100 64 106 C69 100 71 92 69 84 Z" fill="{GOLD}" stroke="none"/>
<path d="M54 82 C44 88 40 98 42 104 C48 98 52 94 58 92 Z" fill="{ORANGE}"/>
<path d="M74 82 C84 88 88 98 86 104 C80 98 76 94 70 92 Z" fill="{ORANGE}"/>
{wing}
<g transform="translate(128 0) scale(-1 1)">{wing}</g>
<ellipse cx="64" cy="68" rx="10" ry="17" fill="{RED}"/>
<path d="M60 30 C58 24 62 20 64 18 C64 24 68 24 68 30 Z" fill="{GOLD}"/>
<circle cx="64" cy="44" r="9" fill="{ORANGE}"/>
<path d="M64 46 l10 4 l-10 3 Z" fill="{GOLD}"/>
<circle cx="66" cy="42" r="2" fill="{INK}" stroke="none"/>
{sparkle(30, 92, 4)}{sparkle(100, 88, 4)}
'''

# Lazarus: a cracked tombstone, a comeback arrow bursting up past it.
icons['lazarus'] = f'''
<ellipse cx="64" cy="104" rx="40" ry="8" fill="{DGREEN}"/>
<g transform="translate(-12 0)">
<path d="M36 104 L36 58 A24 24 0 0 1 84 58 L84 104 Z" fill="{STONE}"/>
<path d="M74 37 A24 24 0 0 1 84 58 L84 104 L74 104 Z" fill="{DSTONE}" stroke="none"/>
<text x="60" y="72" font-family="Georgia, serif" font-size="15" font-weight="bold" text-anchor="middle" fill="#475569" stroke="none">RIP</text>
<path d="M44 76 L76 62" stroke="{RED}" stroke-width="3"/>
<path d="M50 46 l6 8 l-4 6 l6 6" fill="none" stroke="{INK}" stroke-width="2"/>
</g>
<path d="M78 106 L96 50" stroke="{INK}" stroke-width="13"/>
<path d="M78 106 L96 50" stroke="{GOLD}" stroke-width="8"/>
<path d="M101.5 32 L106.6 53.8 L85.4 46.2 Z" fill="{GOLD}"/>
{sparkle(104, 58, 5)}{sparkle(24, 40, 4)}
'''

# Out-Bombed: a big grinning bomb sitting on a squashed, dizzy little one.
icons['out-bombed'] = (
    bomb(44, 96, 18, squash=0.6, fuse=False,
         face=f'<path d="M36 93 l5 5 M41 93 l-5 5 M49 93 l5 5 M54 93 l-5 5" stroke="#e2e8f0" stroke-width="2"/>')
    + bomb(70, 58, 26,
           face=f'<circle cx="62" cy="56" r="3" fill="#f8fafc" stroke="none"/><circle cx="78" cy="56" r="3" fill="#f8fafc" stroke="none"/>'
                f'<path d="M60 66 Q70 74 80 66" fill="none" stroke="#f8fafc" stroke-width="2.5"/>')
    + f'<path d="M22 70 q4 -6 8 0 q4 6 8 0" fill="none" stroke="{GOLD}" stroke-width="2"/>'
    + sparkle(24, 52, 4) + sparkle(104, 100, 4)
)

# Double Tap: two lit bombs.
icons['double-tap'] = (
    bomb(46, 76, 22) + bomb(84, 84, 20)
    + f'<text x="64" y="118" font-family="system-ui, sans-serif" font-size="14" font-weight="900" text-anchor="middle" fill="{GOLD}" stroke="none">×2</text>'
)

# Photo Finish: a camera flash catching the finish line.
lens_checks = ''.join(
    f'<rect x="{46 + c*6}" y="{52 + r*6}" width="6" height="6" fill="{"#f8fafc" if (r + c) % 2 == 0 else INK}" stroke="none"/>'
    for r in range(6) for c in range(6))
icons['photo-finish'] = f'''
<path transform="translate(-8 8)" d="M96 14 L100 26 L112 22 L104 32 L114 40 L101 39 L98 52 L93 40 L80 42 L90 33 L84 22 L95 27 Z" fill="{GOLD}"/>
<rect x="38" y="34" width="22" height="12" rx="3" fill="{DSTONE}"/>
<rect x="20" y="42" width="88" height="60" rx="10" fill="{STONE}"/>
<rect x="20" y="56" width="88" height="10" fill="{DSTONE}" stroke="none"/>
<circle cx="64" cy="72" r="24" fill="{BOMB}"/>
<clipPath id="lens"><circle cx="64" cy="70" r="17"/></clipPath>
<g clip-path="url(#lens)">{lens_checks}</g>
<circle cx="64" cy="70" r="17" fill="none" stroke-width="2"/>
<ellipse cx="58" cy="63" rx="5" ry="3" fill="#f8fafc" stroke="none" opacity="0.5" transform="rotate(-30 58 63)"/>
<rect x="88" y="48" width="12" height="7" rx="2" fill="{RED}"/>
'''

# Wire to Wire: our line leads the whole way to the flag.
icons['wire-to-wire'] = f'''<g transform="translate(-4 10)">
<path d="M18 92 L102 92" stroke="{DSTONE}" stroke-width="2" fill="none"/>
<path d="M20 84 C34 80 40 74 50 76 C62 78 70 66 82 68 C90 70 94 64 100 62" fill="none" stroke="{INK}" stroke-width="8"/>
<path d="M20 84 C34 80 40 74 50 76 C62 78 70 66 82 68 C90 70 94 64 100 62" fill="none" stroke="{DSTONE}" stroke-width="4"/>
<path d="M20 70 C32 62 40 54 52 54 C64 54 70 42 82 42 C90 42 94 36 100 34" fill="none" stroke="{INK}" stroke-width="9"/>
<path d="M20 70 C32 62 40 54 52 54 C64 54 70 42 82 42 C90 42 94 36 100 34" fill="none" stroke="{GOLD}" stroke-width="5"/>
<circle cx="20" cy="70" r="5" fill="{GOLD}"/>
<path d="M100 34 L100 14" stroke="{INK}" stroke-width="3"/>
<path d="M100 14 L116 14 L116 26 L100 26 Z" fill="#f8fafc"/>
<rect x="100" y="14" width="4" height="4" fill="{INK}" stroke="none"/><rect x="108" y="14" width="4" height="4" fill="{INK}" stroke="none"/>
<rect x="104" y="18" width="4" height="4" fill="{INK}" stroke="none"/><rect x="112" y="18" width="4" height="4" fill="{INK}" stroke="none"/>
<rect x="100" y="22" width="4" height="4" fill="{INK}" stroke="none"/><rect x="108" y="22" width="4" height="4" fill="{INK}" stroke="none"/>
<circle cx="100" cy="34" r="5" fill="{GOLD}"/>
</g>'''

# Hat Trick: three cards springing out of a top hat.
suit = lambda x, y, c: f'<path d="M{x} {y-5} L{x+4} {y} L{x} {y+5} L{x-4} {y} Z" fill="{c}" stroke="none"/>'
hat_cards = ''.join(
    card(55, 30, 18, 28, rot=a, cx=64, cy=66, inner=suit(64, 42, col))
    for a, col in [(-28, GREEN), (28, BLUE), (0, RED)])
icons['hat-trick'] = f'''
{hat_cards}
<ellipse cx="64" cy="60" rx="24" ry="6" fill="{BOMB2}"/>
<path d="M40 60 L44 98 L84 98 L88 60 Q64 68 40 60 Z" fill="{BOMB}"/>
<path d="M42 84 L86 84 L85 92 L43 92 Z" fill="{RED}"/>
<ellipse cx="64" cy="100" rx="36" ry="7" fill="{BOMB}"/>
{sparkle(28, 40, 5)}{sparkle(102, 36, 5)}{sparkle(96, 62, 3)}
'''

# Dragon's Hoard: a smug dragon guarding its coin pile.
coins = ''.join(f'<ellipse cx="{x}" cy="{y}" rx="12" ry="5" fill="{GOLD}"/>' for x, y in
                [(34, 104), (58, 106), (82, 106), (100, 102), (46, 98), (70, 99), (90, 96), (58, 92), (80, 90)])
icons['dragons-hoard'] = f'''
<path d="M42 30 L40 14 L52 26 Z" fill="{GOLD}"/>
<path d="M86 30 L88 14 L76 26 Z" fill="{GOLD}"/>
<path d="M36 44 L22 36 L30 52 Z" fill="{DRED}"/>
<path d="M92 44 L106 36 L98 52 Z" fill="{DRED}"/>
<ellipse cx="64" cy="48" rx="28" ry="22" fill="{RED}"/>
<path d="M60 26 L64 16 L68 26 Z" fill="{DRED}"/>
<path d="M42 58 Q42 76 64 76 Q86 76 86 58 Q64 64 42 58 Z" fill="#f87171"/>
<ellipse cx="56" cy="62" rx="2.5" ry="1.5" fill="{INK}" stroke="none"/><ellipse cx="72" cy="62" rx="2.5" ry="1.5" fill="{INK}" stroke="none"/>
<path d="M50 70 Q64 74 78 70" fill="none" stroke-width="2"/>
<path d="M54 72 L57 79 L60 73 Z M68 73 L71 79 L74 72 Z" fill="#f8fafc" stroke-width="1.5"/>
<circle cx="53" cy="44" r="7" fill="#f8fafc"/><circle cx="75" cy="44" r="7" fill="#f8fafc"/>
<circle cx="54" cy="44" r="4.5" fill="{GOLD}" stroke="none"/><circle cx="74" cy="44" r="4.5" fill="{GOLD}" stroke="none"/>
<ellipse cx="54" cy="44" rx="1.3" ry="3.5" fill="{INK}" stroke="none"/><ellipse cx="74" cy="44" rx="1.3" ry="3.5" fill="{INK}" stroke="none"/>
<circle cx="52" cy="42" r="1.2" fill="#f8fafc" stroke="none"/><circle cx="72" cy="42" r="1.2" fill="#f8fafc" stroke="none"/>
<path d="M60 70 Q64 73 70 69" fill="none"/>
<path d="M78 56 q6 -6 2 -12 q-4 -6 4 -12" fill="none" stroke="{STONE}" stroke-width="2" opacity="0.0"/>
{coins}
<path d="M42 84 q-4 -6 4 -8 q6 2 4 8 Z" fill="{RED}"/>
<path d="M86 84 q4 -6 -4 -8 q-6 2 -4 8 Z" fill="{RED}"/>
{sparkle(22, 88, 4)}{sparkle(108, 78, 4)}
'''

# Ganis!: a 14-card straight fanned into a rainbow.
fan = ''
for i in range(14):
    a = -78 + i * 12
    fill = CREAM if i in (0, 13) else '#f8fafc'
    pip = (f'<circle cx="64" cy="38" r="3" fill="{[GREEN, BLUE, RED, INK][i % 4]}" stroke="none"/>' if 0 < i < 13 else
           f'<circle cx="64" cy="38" r="3.5" fill="{GOLD}" stroke="none"/>')
    fan += card(57, 30, 14, 34, fill=fill, rot=a, cx=64, cy=96, inner=pip)
icons['ganis'] = f'''
{fan}
<circle cx="64" cy="96" r="12" fill="{GOLD}"/>
<text x="64" y="101" font-family="system-ui, sans-serif" font-size="13" font-weight="900" text-anchor="middle" fill="{INK}" stroke="none">14</text>
{sparkle(64, 18, 5)}
'''

# Score-Based Grand: a humble 2 wearing a Grand crown far too big for it.
icons['score-based-grand'] = f'''
<rect x="42" y="50" width="44" height="60" rx="5" fill="#f8fafc"/>
<text x="64" y="94" font-family="system-ui, sans-serif" font-size="38" font-weight="900" text-anchor="middle" fill="{DSTONE}" stroke="none">2</text>
<path d="M90 60 q4 6 0 10 q-4 -4 0 -10 Z" fill="{LBLUE}" stroke-width="1.5"/>
<g transform="translate(4 -2) rotate(-14 64 40) translate(64 40) scale(0.88) translate(-64 -40)">
<path d="M30 54 L26 24 L44 36 L64 16 L84 36 L102 24 L98 54 Z" fill="{BLUE}"/>
<rect x="30" y="48" width="68" height="9" rx="2" fill="{DBLUE}"/>
<circle cx="26" cy="22" r="4" fill="{GOLD}"/><circle cx="64" cy="14" r="4" fill="{GOLD}"/><circle cx="102" cy="22" r="4" fill="{GOLD}"/>
</g>
'''

os.makedirs(OUT, exist_ok=True)
for name, body in icons.items():
    with open(os.path.join(OUT, f'{name}.svg'), 'w') as f:
        f.write(frame(body))
print('wrote', len(icons))
