"""Generate the theme achievement badges in client/public/achievements/.

One badge per theme, earned by finishing a game on that table. Each is drawn
in its own theme's style rather than the papercraft rosette the other badges
share (the papercraft one, `crafty`, lives with those in
scripts/gen-achievement-art.py):

- `totally-kawaii`: flat pastels with soft same-hue outlines, a puffy flower
  frame and a blushing star (palette from scripts/gen-kawaii-art.py).
- `old-master`: a gilded cartouche with beading and scrolls around jade
  lacquer, gradients for a painted finish, and a painter's palette
  (palette from scripts/gen-baroque-art.py).
- `trick-or-treat`: flat cut shapes with a dark ink outline, a bat-wing rim
  and a black cat with glowing eyes against a crescent moon
  (palette from scripts/gen-halloween-art.py).
- `spellbound`: fine sepia ink like the watercolour Magic cards: a gold rim
  studded with the five realms' orbs around a parchment pool, and the Mah
  Jong card's black lotus on a lily pad (palette from scripts/gen-magic-art.py).

    python3 scripts/gen-theme-achievement-art.py client/public/achievements
"""
import math
import os
import sys


def f(v):
    return f'{v:.1f}'


def rim(r, n, bump, phase=0.0, pointed=False):
    """A closed outline of `n` bumps around (64, 64): rounded bumps, or
    pointed tips joined by concave arcs (bat wings)."""
    pts = []
    for i in range(n * 12):
        a = 2 * math.pi * i / (n * 12) + phase
        k = abs(math.sin(n * a / 2)) if pointed else 1 - abs(math.cos(n * a / 2))
        rr = r - bump * k
        pts.append(f'{f(64 + rr * math.cos(a))} {f(64 + rr * math.sin(a))}')
    return 'M' + ' L'.join(pts) + ' Z'


def star_path(cx, cy, R, r, rot=-90):
    pts = []
    for i in range(10):
        a = math.radians(rot + 36 * i)
        rr = R if i % 2 == 0 else r
        pts.append(f'{f(cx + rr * math.cos(a))} {f(cy + rr * math.sin(a))}')
    return 'M' + ' L'.join(pts) + ' Z'


def svg(body, defs=''):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">'
            f'<defs>{defs}</defs>'
            f'<g stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n')


icons = {}

# ===== Totally Kawaii =====
K_INK = '#5B4B63'
K_WHITE = '#FFFFFF'
K_BLUSH = '#FFB3C7'
K_PINK, K_PINK_DK = '#FF8FA6', '#E5587A'
K_MINT, K_MINT_DK = '#7FDCB2', '#3FAF80'
K_LILAC, K_LILAC_DK = '#C3A6EC', '#8E6CC9'
K_GOLD, K_GOLD_DK = '#FFE29A', '#F0C14B'
K_CREAM = '#FFF4F7'


def k_heart(x, y, s, fill=K_PINK, edge=K_PINK_DK):
    return (f'<path d="M{f(x)} {f(y + 4 * s)} C{f(x - 7 * s)} {f(y - 1 * s)} {f(x - 4 * s)} {f(y - 7 * s)} {f(x)} {f(y - 3.5 * s)} '
            f'C{f(x + 4 * s)} {f(y - 7 * s)} {f(x + 7 * s)} {f(y - 1 * s)} {f(x)} {f(y + 4 * s)} Z" '
            f'fill="{fill}" stroke="{edge}" stroke-width="1.6"/>')


def k_twinkle(x, y, s, c=K_GOLD, e=K_GOLD_DK):
    return (f'<path d="M{f(x)} {f(y - s)} Q{f(x + s * .25)} {f(y - s * .25)} {f(x + s)} {f(y)} Q{f(x + s * .25)} {f(y + s * .25)} {f(x)} {f(y + s)} '
            f'Q{f(x - s * .25)} {f(y + s * .25)} {f(x - s)} {f(y)} Q{f(x - s * .25)} {f(y - s * .25)} {f(x)} {f(y - s)} Z" '
            f'fill="{c}" stroke="{e}" stroke-width="1.2"/>')


icons['totally-kawaii'] = svg(
    # puffy flower frame, a candy-stripe ring, then the mint disc
    f'<path d="{rim(61, 12, 6)}" fill="{K_PINK}" stroke="{K_PINK_DK}" stroke-width="2.4"/>'
    + ''.join(f'<circle cx="{f(64 + 55.5 * math.cos(math.radians(a)))}" cy="{f(64 + 55.5 * math.sin(math.radians(a)))}" r="2" '
              f'fill="{K_WHITE}" opacity=".85"/>' for a in range(15, 360, 30))
    + f'<circle cx="64" cy="64" r="48" fill="{K_CREAM}" stroke="{K_PINK_DK}" stroke-width="2.4"/>'
    f'<circle cx="64" cy="64" r="43" fill="{K_MINT}" stroke="{K_MINT_DK}" stroke-width="2"/>'
    f'<path d="M30 90 Q64 78 98 90 Q90 104 64 107 Q38 104 30 90 Z" fill="{K_WHITE}" opacity=".45"/>'
    # the star buddy: chubby, blushing, waving a little heart
    f'<path d="{star_path(64, 66, 34, 19)}" fill="{K_GOLD}" stroke="{K_GOLD_DK}" stroke-width="3.5"/>'
    f'<path d="M50 54 Q54 46 62 44" fill="none" stroke="{K_WHITE}" stroke-width="3" opacity=".8"/>'
    + ''.join(f'<circle cx="{x}" cy="66" r="3.6" fill="{K_INK}"/><circle cx="{x + 1.3}" cy="64.6" r="1.3" fill="{K_WHITE}"/>'
              for x in (55, 73))
    + ''.join(f'<ellipse cx="{x}" cy="73" rx="4.4" ry="2.6" fill="{K_BLUSH}"/>' for x in (49, 79))
    + f'<path d="M60 72 Q64 77 68 72" fill="none" stroke="{K_INK}" stroke-width="2"/>'
    + k_heart(96, 46, 1.25) + k_heart(30, 42, 0.9, K_LILAC, K_LILAC_DK)
    + k_twinkle(38, 96, 4) + k_twinkle(92, 98, 3.2) + k_twinkle(64, 26, 3.6, K_WHITE, K_PINK_DK)
)

# ===== Old Master =====
B_INK = '#2B1D14'
B_PARCH, B_PARCH_DK = '#F6EEDC', '#E6D7B8'
B_LACQUER, B_LACQUER_DK = '#A8322A', '#6E1512'
B_GOLD, B_GOLD_LT, B_GOLD_DK = '#D4A945', '#F1DC9C', '#8E6A20'
B_JADE, B_JADE_DK, B_JADE_LT = '#2F7D55', '#163F2B', '#5FA982'
B_LAPIS, B_LAPIS_LT = '#2F5FA8', '#5C8BD0'
B_VERMILION = '#D2563C'
B_WOOD, B_WOOD_DK = '#8A5A32', '#5A3820'

B_DEFS = (
    f'<linearGradient id="gilt" x1="0" y1="0" x2="1" y2="1">'
    f'<stop offset="0" stop-color="{B_GOLD_LT}"/><stop offset=".45" stop-color="{B_GOLD}"/>'
    f'<stop offset=".7" stop-color="{B_GOLD_DK}"/><stop offset="1" stop-color="{B_GOLD}"/></linearGradient>'
    f'<radialGradient id="lacquer" cx=".38" cy=".32" r=".8">'
    f'<stop offset="0" stop-color="{B_JADE_LT}"/><stop offset=".55" stop-color="{B_JADE}"/>'
    f'<stop offset="1" stop-color="{B_JADE_DK}"/></radialGradient>'
    f'<radialGradient id="board" cx=".4" cy=".35" r=".75">'
    f'<stop offset="0" stop-color="{B_PARCH}"/><stop offset="1" stop-color="{B_PARCH_DK}"/></radialGradient>'
)


def b_scroll(angle):
    """A gilt C-scroll flourish on the frame, pointing outward at `angle`."""
    return (f'<g transform="rotate({angle} 64 64)">'
            f'<path d="M52 12 C50 4 58 1 61 6 C63 9 60 12 58 10 M76 12 C78 4 70 1 67 6 C65 9 68 12 70 10 '
            f'M58 10 Q64 16 70 10" fill="none" stroke="{B_GOLD_DK}" stroke-width="5"/>'
            f'<path d="M52 12 C50 4 58 1 61 6 C63 9 60 12 58 10 M76 12 C78 4 70 1 67 6 C65 9 68 12 70 10 '
            f'M58 10 Q64 16 70 10" fill="none" stroke="url(#gilt)" stroke-width="2.6"/>'
            f'<path d="M64 1 L68 7 L64 13 L60 7 Z" fill="url(#gilt)" stroke="{B_GOLD_DK}" stroke-width="1.2"/>'
            '</g>')


paint = ((48, 60, B_LACQUER), (60, 52, B_GOLD), (74, 52, B_LAPIS), (84, 62, B_JADE_LT), (80, 76, B_VERMILION))
icons['old-master'] = svg(
    # gilt frame: scrolls at the compass points and diagonals, beaded ring
    ''.join(b_scroll(a) for a in range(0, 360, 45))
    + f'<circle cx="64" cy="64" r="53" fill="url(#gilt)" stroke="{B_GOLD_DK}" stroke-width="2"/>'
    + ''.join(f'<circle cx="{f(64 + 49 * math.cos(math.radians(a)))}" cy="{f(64 + 49 * math.sin(math.radians(a)))}" r="1.9" '
              f'fill="{B_GOLD_LT}" stroke="{B_GOLD_DK}" stroke-width=".7"/>' for a in range(0, 360, 12))
    + f'<circle cx="64" cy="64" r="44" fill="url(#lacquer)" stroke="{B_LACQUER_DK}" stroke-width="2.4"/>'
    f'<circle cx="64" cy="64" r="40.5" fill="none" stroke="{B_GOLD}" stroke-width=".9" opacity=".8"/>'
    # the painter's palette: a parchment kidney with a thumb hole and paint dabs
    f'<g stroke="{B_INK}">'
    f'<path d="M30 72 C24 52 46 36 68 40 C90 44 102 60 94 76 C90 84 82 82 76 86 C70 90 74 98 64 98 '
    f'C46 98 34 88 30 72 Z" fill="url(#board)" stroke-width="2.2"/>'
    f'<ellipse cx="46" cy="78" rx="5.5" ry="4.5" fill="url(#lacquer)" stroke-width="1.8"/>'
    + ''.join(f'<path d="M{x - 5} {y + 1} Q{x - 5} {y - 5} {x} {y - 5} Q{x + 6} {y - 4} {x + 5} {y + 1} '
              f'Q{x + 4} {y + 5} {x} {y + 5} Q{x - 5} {y + 5} {x - 5} {y + 1} Z" fill="{c}" stroke-width="1.3"/>'
              f'<circle cx="{x - 1.6}" cy="{y - 1.8}" r="1.3" fill="#fff" stroke="none" opacity=".55"/>' for x, y, c in paint)
    # the brush, laid across the palette: wood handle, gilt ferrule, loaded tip
    + f'<path d="M104 30 L72 78" stroke-width="6.4"/>'
    f'<path d="M104 30 L72 78" stroke="{B_WOOD}" stroke-width="4"/>'
    f'<path d="M102 33 L98 39" stroke="{B_WOOD_DK}" stroke-width="1.4"/>'
    f'<path d="M75 73 L80 66 L84 69 L79 76 Z" fill="url(#gilt)" stroke-width="1.4"/>'
    f'<path d="M75 73 L79 76 Q74 84 66 88 Q68 80 75 73 Z" fill="{B_LACQUER}" stroke-width="1.4"/>'
    '</g>',
    B_DEFS,
)

# ===== Trick or Treat =====
H_INK = '#1E1428'
H_NIGHT = '#2C1E3E'
H_MOON = '#FFE9A8'
H_PUMPKIN = '#F2851F'
H_HAUNT, H_HAUNT_DK = '#8E5CD9', '#5B3A9A'
H_BAT = '#2E2638'
H_GLOW = '#FFD54A'
H_WHITE = '#FFFFFF'


def h_bat(x, y, s):
    p = lambda dx, dy: f'{f(x + dx * s)} {f(y + dy * s)}'
    return (f'<path d="M{p(0, 0)} Q{p(-5, -6)} {p(-14, -6)} Q{p(-11, -2)} {p(-12, 3)} Q{p(-8, 1)} {p(-6, 5)} '
            f'Q{p(-3, 2)} {p(0, 5)} Q{p(3, 2)} {p(6, 5)} Q{p(8, 1)} {p(12, 3)} Q{p(11, -2)} {p(14, -6)} '
            f'Q{p(5, -6)} {p(0, 0)} Z" fill="{H_BAT}" stroke-width="1.2"/>'
            f'<path d="M{p(-2, -1)} L{p(-2.5, -4)} L{p(-.6, -2)} L{p(.6, -2)} L{p(2.5, -4)} L{p(2, -1)} Z" fill="{H_BAT}" stroke-width="1"/>')


def h_stars(pts):
    return ''.join(f'<path d="{star_path(x, y, r, r * .45)}" fill="{H_MOON}" stroke="none"/>' for x, y, r in pts)


icons['trick-or-treat'] = svg(
    f'<g stroke="{H_INK}">'
    # bat-wing rim in haunted purple, an orange band, then the night sky
    f'<path d="{rim(62, 14, 6, pointed=True)}" fill="{H_HAUNT_DK}" stroke-width="2.4"/>'
    f'<circle cx="64" cy="64" r="51" fill="{H_PUMPKIN}" stroke-width="2.2"/>'
    f'<circle cx="64" cy="64" r="46" fill="{H_NIGHT}" stroke-width="2.2"/>'
    f'<g clip-path="url(#night)">'
    # a crescent moon: a full moon with the night sky biting into it
    f'<circle cx="60" cy="62" r="34" fill="{H_MOON}" stroke-width="2.2"/>'
    f'<circle cx="74" cy="50" r="30" fill="{H_NIGHT}" stroke="none"/>'
    + h_stars(((96, 28, 3), (104, 50, 2.2), (34, 34, 2.4), (52, 24, 2)))
    # the black cat sitting in front of it: body, curling tail, head and ears
    + f'<path d="M52 92 Q48 76 56 68 Q60 54 74 56 Q86 58 86 72 Q88 86 82 94 Z" fill="{H_BAT}" stroke-width="2.2"/>'
    f'<path d="M84 90 Q100 92 100 78 Q100 70 94 70" fill="none" stroke-width="6.4"/>'
    f'<path d="M84 90 Q100 92 100 78 Q100 70 94 70" fill="none" stroke="{H_BAT}" stroke-width="3.6"/>'
    f'<path d="M50 62 Q46 48 54 38 L58 46 Q64 44 70 46 L74 38 Q82 48 78 62 Q74 72 64 72 Q54 72 50 62 Z" fill="{H_BAT}" stroke-width="2.2"/>'
    f'<path d="M56 41 L57 46 M76 41 L75 46" stroke="{H_HAUNT}" stroke-width="2"/>'
    # glowing slit eyes, a pink nose and whiskers
    f'<ellipse cx="58" cy="57" rx="4.2" ry="4.6" fill="{H_GLOW}" stroke="none"/><ellipse cx="70" cy="57" rx="4.2" ry="4.6" fill="{H_GLOW}" stroke="none"/>'
    f'<ellipse cx="58" cy="57.5" rx="1.2" ry="3.4" fill="{H_INK}" stroke="none"/><ellipse cx="70" cy="57.5" rx="1.2" ry="3.4" fill="{H_INK}" stroke="none"/>'
    f'<path d="M62 64 L64 66 L66 64 Z" fill="#FFB3C7" stroke="none"/>'
    f'<path d="M48 64 L40 62 M48 67 L40 69 M80 64 L88 62 M80 67 L88 69" stroke="{H_WHITE}" stroke-width="1" opacity=".7"/>'
    + h_bat(30, 90, .8)
    + '</g></g>',
    '<clipPath id="night"><circle cx="64" cy="64" r="45"/></clipPath>',
)

# ===== Spellbound =====
M_INK = '#5B4636'
M_GOLD, M_GOLD_LT, M_GOLD_DK = '#D9AE52', '#F2D894', '#A8803A'
M_FRAME = '#1F4A3A'
M_LOTUS, M_LOTUS_DK, M_LOTUS_LT = '#3A3048', '#221B2C', '#6B5A86'
M_PAD, M_PAD_DK = '#7FA88A', '#4F7A60'
M_REALMS = ('#F1ECE2', '#5B86C4', '#4A4250', '#D2553F', '#5E9E6E')


def m_sparkle(x, y, s, c=M_GOLD_LT):
    return (f'<path d="M{f(x)} {f(y - s)} Q{f(x + s * .2)} {f(y - s * .2)} {f(x + s)} {f(y)} Q{f(x + s * .2)} {f(y + s * .2)} {f(x)} {f(y + s)} '
            f'Q{f(x - s * .2)} {f(y + s * .2)} {f(x - s)} {f(y)} Q{f(x - s * .2)} {f(y - s * .2)} {f(x)} {f(y - s)} Z" fill="{c}" stroke="none"/>')


def m_petal(cx, cy, angle, length, width, fill):
    a = math.radians(angle)
    ux, uy = math.sin(a), -math.cos(a)
    nx, ny = -uy, ux
    pt = lambda u, n: f'{f(cx + ux * u + nx * n)} {f(cy + uy * u + ny * n)}'
    return (f'<path d="M{pt(0, 0)} Q{pt(length * .45, width)} {pt(length, 0)} Q{pt(length * .45, -width)} {pt(0, 0)} Z" fill="{fill}" stroke-width="1.6"/>'
            f'<path d="M{pt(length * .3, 0)} L{pt(length * .8, 0)}" stroke="{M_LOTUS_LT}" stroke-width="1"/>')


icons['spellbound'] = svg(
    f'<g stroke="{M_INK}" stroke-linejoin="round" stroke-linecap="round">'
    # gold rim with the five realms' orbs set into it, then the parchment pool
    f'<circle cx="64" cy="64" r="58" fill="url(#mgold)" stroke-width="2.2"/>'
    f'<circle cx="64" cy="64" r="46" fill="url(#mpool)" stroke="{M_FRAME}" stroke-width="2.4"/>'
    + ''.join(f'<circle cx="{f(64 + 52 * math.cos(math.radians(-90 + 72 * i)))}" cy="{f(64 + 52 * math.sin(math.radians(-90 + 72 * i)))}" '
              f'r="7" fill="{c}" stroke-width="1.8"/>'
              f'<circle cx="{f(62 + 52 * math.cos(math.radians(-90 + 72 * i)))}" cy="{f(62 + 52 * math.sin(math.radians(-90 + 72 * i)))}" '
              f'r="2" fill="#fff" stroke="none" opacity=".6"/>' for i, c in enumerate(M_REALMS))
    + ''.join(f'<circle cx="{f(64 + 52 * math.cos(math.radians(-54 + 72 * i)))}" cy="{f(64 + 52 * math.sin(math.radians(-54 + 72 * i)))}" '
              f'r="1.8" fill="{M_GOLD_LT}" stroke="none"/>' for i in range(5))
    + f'<g clip-path="url(#mdisc)">'
    # ripples and lily pads on the water
    + f'<path d="M24 92 Q44 88 64 92 Q84 96 104 92 M30 102 Q50 98 70 102 Q88 106 100 102" fill="none" stroke="#8FB3C2" stroke-width="1.4" opacity=".8"/>'
    f'<ellipse cx="36" cy="96" rx="11" ry="3.6" fill="{M_PAD}" stroke-width="1.4"/>'
    f'<ellipse cx="96" cy="88" rx="8" ry="2.8" fill="{M_PAD}" stroke-width="1.4"/>'
    # the Mah Jong card's black lotus
    f'<ellipse cx="64" cy="86" rx="30" ry="8" fill="{M_PAD}" stroke-width="1.8"/>'
    f'<path d="M64 86 L82 82" stroke="{M_PAD_DK}" stroke-width="1.2"/>'
    + ''.join(m_petal(64, 82, a, 26, 9, M_LOTUS_DK) for a in (-75, -45, 45, 75))
    + ''.join(m_petal(64, 82, a, 21, 8, M_LOTUS) for a in (-62, 62))
    + ''.join(m_petal(64, 82, a, 28, 9.6, M_LOTUS) for a in (-30, 0, 30))
    + f'<ellipse cx="64" cy="76" rx="7" ry="3.2" fill="{M_GOLD}" stroke-width="1.2"/>'
    + ''.join(f'<circle cx="{x}" cy="{y}" r="1.1" fill="{M_GOLD_LT}" stroke="none"/>' for x, y in ((60, 72), (64, 71), (68, 72)))
    + '</g>'
    + m_sparkle(40, 40, 5) + m_sparkle(90, 44, 3.6) + m_sparkle(82, 32, 2.4)
    + '</g>',
    f'<clipPath id="mdisc"><circle cx="64" cy="64" r="45"/></clipPath>'
    f'<linearGradient id="mgold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{M_GOLD_LT}"/>'
    f'<stop offset=".5" stop-color="{M_GOLD}"/><stop offset="1" stop-color="{M_GOLD_DK}"/></linearGradient>'
    f'<radialGradient id="mpool" cx=".5" cy=".35" r=".75"><stop offset="0" stop-color="#FFFDF6"/>'
    f'<stop offset=".55" stop-color="#F6EFDC"/><stop offset="1" stop-color="#BFD6DA"/></radialGradient>',
)

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for name, body in icons.items():
    with open(os.path.join(out, f'{name}.svg'), 'w') as fh:
        fh.write(body)
print('wrote', len(icons))
