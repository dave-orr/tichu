"""Generate the Kawaii theme's card art into client/public/cards/kawaii/.

Same file names as the papercraft set (scripts/gen-card-art.py), so the
client just switches folders (client/src/theme.ts cardArt). Flat pastel
shapes with a soft darker outline, little faces (dot eyes, blush, smile) on
the suit symbols, chibi court cards and round, chubby special cards.

    python3 scripts/gen-kawaii-art.py client/public/cards/kawaii
"""
import math, os, sys

INK = '#5B4B63'            # soft plum instead of near-black
WHITE = '#FFFFFF'
BLUSH = '#FFB3C7'
SKIN, SKIN_DK = '#FFE9DC', '#E9BFA8'
GOLD, GOLD_DK = '#FFE29A', '#F0C14B'
# Suit colours: (fill, outline). Saturated enough to tell apart at pip size;
# the sword is lilac-purple and the pagoda periwinkle-blue, with very
# different silhouettes.
SUIT = {
    'star': ('#FF8FA6', '#E5587A'),
    'jade': ('#7FDCB2', '#3FAF80'),
    'pagoda': ('#8FAAF5', '#5B7FE0'),
    'sword': ('#C3A6EC', '#8E6CC9'),
}
HAIR = {'J': ('#B07A5A', '#8A5A40'), 'Q': ('#F4A3BF', '#D97C9D'), 'K': ('#7A6694', '#56466E')}


def svg(body, vb='0 0 100 100'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">'
            f'<g stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n')


# ===== Faces =====
def eyes(cx, cy, s, kind='dot'):
    d = 7 * s
    if kind == 'happy':  # ^ ^
        return ''.join(f'<path d="M{x - 3.5 * s:.1f} {cy + 1.5 * s:.1f} Q{x:.1f} {cy - 3.5 * s:.1f} {x + 3.5 * s:.1f} {cy + 1.5 * s:.1f}" '
                       f'fill="none" stroke="{INK}" stroke-width="{2.2 * s:.2f}"/>' for x in (cx - d, cx + d))
    return ''.join(f'<circle cx="{x:.1f}" cy="{cy}" r="{3.2 * s:.2f}" fill="{INK}"/>'
                   f'<circle cx="{x + 1.1 * s:.1f}" cy="{cy - 1.2 * s:.1f}" r="{1.1 * s:.2f}" fill="{WHITE}"/>' for x in (cx - d, cx + d))


def blush(cx, cy, s):
    return ''.join(f'<ellipse cx="{x:.1f}" cy="{cy + 5 * s:.1f}" rx="{3.6 * s:.2f}" ry="{2.2 * s:.2f}" fill="{BLUSH}" opacity=".9"/>'
                   for x in (cx - 11 * s, cx + 11 * s))


def smile(cx, cy, s, w=3):
    return (f'<path d="M{cx - w * s:.1f} {cy + 3 * s:.1f} Q{cx} {cy + 6.5 * s:.1f} {cx + w * s:.1f} {cy + 3 * s:.1f}" '
            f'fill="none" stroke="{INK}" stroke-width="{1.6 * s:.2f}"/>')


def face(cx, cy, s=1.0, kind='dot'):
    return eyes(cx, cy, s, kind) + blush(cx, cy, s) + smile(cx, cy, s)


def brows(cx, cy, s, c):
    return ''.join(f'<path d="M{x - 4.5 * s:.1f} {cy - 6 * s:.1f} Q{x:.1f} {cy - 8.5 * s:.1f} {x + 4.5 * s:.1f} {cy - 6 * s:.1f}" '
                   f'fill="none" stroke="{c}" stroke-width="{2.6 * s:.2f}"/>' for x in (cx - 7 * s, cx + 7 * s))


# ===== Suit symbols =====
def star_path(cx, cy, R, r):
    pts = [(cx + (R if i % 2 == 0 else r) * math.cos(-math.pi / 2 + i * math.pi / 5),
            cy + (R if i % 2 == 0 else r) * math.sin(-math.pi / 2 + i * math.pi / 5)) for i in range(10)]
    return 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'


def symbol(suit, sw=5, faced=True, fs=1.15):
    f, e = SUIT[suit]
    if suit == 'star':
        body, fy = f'<path d="{star_path(50, 54, 47, 25)}" fill="{f}" stroke="{e}" stroke-width="{sw}"/>', 56
    elif suit == 'jade':  # a round jade coin with a little knot on top
        body = (f'<path d="M38 20 Q50 6 62 20" fill="none" stroke="{e}" stroke-width="{sw}"/>'
                f'<circle cx="50" cy="56" r="38" fill="{f}" stroke="{e}" stroke-width="{sw}"/>'
                f'<circle cx="50" cy="56" r="29" fill="none" stroke="{WHITE}" stroke-width="2.5" opacity=".55"/>')
        fy = 58
    elif suit == 'pagoda':  # a little house-pagoda: curly roof, rounded walls
        body = (f'<path d="M50 4 L50 16" stroke="{e}" stroke-width="{sw}"/>'
                f'<rect x="25" y="40" width="50" height="52" rx="14" fill="{f}" stroke="{e}" stroke-width="{sw}"/>'
                f'<path d="M12 44 Q30 40 50 14 Q70 40 88 44 Q70 46 50 42 Q30 46 12 44 Z" fill="{f}" stroke="{e}" stroke-width="{sw}"/>')
        fy = 64
    else:  # sword: a chubby sword with its face on the round guard
        body = (f'<path d="M50 3 L61 17 L61 50 L39 50 L39 17 Z" fill="{WHITE}" stroke="{e}" stroke-width="{sw}"/>'
                f'<circle cx="50" cy="66" r="23" fill="{f}" stroke="{e}" stroke-width="{sw}"/>'
                f'<rect x="43" y="86" width="14" height="12" rx="4" fill="{e}" stroke="{e}" stroke-width="2"/>')
        fy = 64
    return body + (face(50, fy, fs) if faced else '')


# ===== Court cards (100x150 portraits, cropped to a 2:3 frame) =====
def hat(rank, suit, top):
    f, e = SUIT[suit]
    y = top
    if rank == 'J':
        return (f'<path d="M24 {y + 13} Q50 {y - 17} 76 {y + 13} Q50 {y + 4} 24 {y + 13} Z" fill="{f}" stroke="{e}" stroke-width="4"/>'
                f'<circle cx="50" cy="{y - 5}" r="4.5" fill="{GOLD}" stroke="{GOLD_DK}" stroke-width="2"/>')
    tall = 4 if rank == 'K' else 0
    return (f'<path d="M{32 - tall / 2} {y + 9} L{35 - tall / 2} {y - 9 - tall} L43 {y} L50 {y - 13 - tall} L57 {y} '
            f'L{65 + tall / 2} {y - 9 - tall} L{68 + tall / 2} {y + 9} Z" fill="{GOLD}" stroke="{GOLD_DK}" stroke-width="3.5"/>'
            f'<circle cx="50" cy="{y - 1}" r="3.5" fill="{f}"/>')


def fluffy(c, d):
    puffs = [(50, 33, 13), (34, 37, 12), (66, 37, 12), (23, 49, 11), (77, 49, 11), (20, 65, 10), (80, 65, 10), (24, 79, 9), (76, 79, 9)]
    back = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="{d}" stroke-width="3.5"/>' for x, y, r in puffs)
    back += ''.join(f'<circle cx="{x}" cy="{y}" r="{r - 1.8}" fill="{c}"/>' for x, y, r in puffs)
    bangs = [(36, 47, 8), (50, 44, 9), (64, 47, 8)]
    front = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="{d}" stroke-width="3"/>' for x, y, r in bangs)
    front += ''.join(f'<circle cx="{x}" cy="{y}" r="{r - 1.5}" fill="{c}"/>' for x, y, r in bangs)
    return back, front, 25


def long_hair(c, d):
    back = (f'<path d="M20 128 Q8 43 50 30 Q92 43 80 128 Q72 120 66 128 L66 77 L34 77 L34 128 Q28 120 20 128 Z" '
            f'fill="{c}" stroke="{d}" stroke-width="3.5"/>')
    front = (f'<path d="M21 69 Q20 33 50 32 Q80 33 79 69 Q74 51 52 43 Q56 55 48 59 Q46 49 40 45 Q28 53 21 69 Z" '
             f'fill="{c}" stroke="{d}" stroke-width="3.5"/>'
             f'<path d="M36 40 Q42 36 47 38" fill="none" stroke="{WHITE}" stroke-width="3" opacity=".6"/>')
    return back, front, 33


def royal(rank, suit):
    f, e = SUIT[suit]
    c, d = HAIR[rank]
    back, front, top = long_hair(c, d) if rank == 'Q' else fluffy(c, d)
    cx, cy, s = 50, 69, 1.45
    if rank == 'K':  # happy closed eyes and brows: a jolly, calm king
        mug = eyes(cx, cy, s, 'happy') + brows(cx, cy, s, d) + blush(cx, cy, s) + smile(cx, cy + 3, s, 3.5)
    else:
        mug = face(cx, cy, s)
    return svg(
        f'<rect width="100" height="150" fill="{f}" opacity=".24"/>'
        + ''.join(f'<circle cx="{x}" cy="{y}" r="2.2" fill="{WHITE}" opacity=".8"/>' for x, y in ((14, 18), (86, 24), (10, 96), (90, 104)))
        + back
        + f'<path d="M16 150 Q16 100 50 100 Q84 100 84 150 Z" fill="{f}" stroke="{e}" stroke-width="4"/>'
        f'<path d="M41 100 L50 111 L59 100" fill="{WHITE}" stroke="{e}" stroke-width="3"/>'
        f'<circle cx="50" cy="66" r="29" fill="{SKIN}" stroke="{SKIN_DK}" stroke-width="3.5"/>'
        + front + mug + hat(rank, suit, top)
        + f'<g transform="translate(37 116) scale(.26)">{symbol(suit, 6, False)}</g>',
        '0 0 100 150')


# ===== Specials =====
def chick():  # Mah Jong: a round chick on a bamboo sprig
    return svg(
        f'<path d="M4 86 L96 80" stroke="#5DB893" stroke-width="7"/><path d="M4 86 L96 80" stroke="#9BE3C2" stroke-width="3.5"/>'
        f'<path d="M70 81 Q80 92 92 90 Q82 84 70 81 Z" fill="#9BE3C2" stroke="#5DB893" stroke-width="2.5"/>'
        f'<ellipse cx="50" cy="52" rx="34" ry="31" fill="#FFE08A" stroke="#F2C14E" stroke-width="5"/>'
        f'<path d="M44 21 Q48 9 54 19" fill="none" stroke="#F2C14E" stroke-width="5"/>'
        f'<path d="M83 50 L95 54 L83 58 Z" fill="#FFAE6B" stroke="#F08A3C" stroke-width="3"/>'
        f'<path d="M26 56 Q34 68 42 58" fill="none" stroke="#F2C14E" stroke-width="4"/>'
        f'<path d="M42 82 L40 88 M56 82 L56 88" stroke="#F08A3C" stroke-width="3.5"/>'
        + face(57, 47, 1.35))


def shiba_head(cx, cy, s=1.0, kind='dot'):
    return (f'<path d="M{cx - 27 * s} {cy - 14 * s} Q{cx - 34 * s} {cy - 42 * s} {cx - 12 * s} {cy - 28 * s} Z '
            f'M{cx + 27 * s} {cy - 14 * s} Q{cx + 34 * s} {cy - 42 * s} {cx + 12 * s} {cy - 28 * s} Z" '
            f'fill="#F7C08B" stroke="#E0A46E" stroke-width="{4 * s}"/>'
            f'<path d="M{cx - 25 * s} {cy - 18 * s} Q{cx - 27 * s} {cy - 32 * s} {cx - 16 * s} {cy - 25 * s} Z '
            f'M{cx + 25 * s} {cy - 18 * s} Q{cx + 27 * s} {cy - 32 * s} {cx + 16 * s} {cy - 25 * s} Z" fill="#FFE3CC"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{32 * s}" ry="{29 * s}" fill="#F7C08B" stroke="#E0A46E" stroke-width="{4.5 * s}"/>'
            f'<ellipse cx="{cx}" cy="{cy + 11 * s}" rx="{19 * s}" ry="{14 * s}" fill="#FFF3E4"/>'
            f'<ellipse cx="{cx}" cy="{cy + 5 * s}" rx="{4.5 * s}" ry="{3.2 * s}" fill="{INK}"/>'
            + eyes(cx, cy - 4 * s, 1.3 * s, kind) + blush(cx, cy - 2 * s, 1.3 * s)
            + f'<path d="M{cx - 4 * s} {cy + 10 * s} Q{cx - 2 * s} {cy + 13 * s} {cx} {cy + 9 * s} Q{cx + 2 * s} {cy + 13 * s} {cx + 4 * s} {cy + 10 * s}" '
              f'fill="none" stroke="{INK}" stroke-width="{1.6 * s}"/>')


def dog():
    return svg(shiba_head(50, 56, 1.15))


def phoenix():
    plumes = ''.join(f'<ellipse cx="50" cy="80" rx="8" ry="21" fill="{c}" stroke="#E5587A" stroke-width="3" transform="rotate({a} 50 62)"/>'
                     for a, c in ((-44, '#FFD1A6'), (-15, '#FFB3C7'), (15, '#FFB3C7'), (44, '#FFD1A6')))
    return svg(plumes
               + f'<path d="M22 46 Q8 36 12 24 Q24 34 30 42 Z M78 46 Q92 36 88 24 Q76 34 70 42 Z" fill="#FFD1A6" stroke="#E5587A" stroke-width="3"/>'
               f'<circle cx="50" cy="46" r="27" fill="#FF8FA6" stroke="#E5587A" stroke-width="5"/>'
               f'<path d="M40 21 Q45 5 50 18 Q55 5 60 21" fill="#FFD1A6" stroke="#E5587A" stroke-width="3"/>'
               f'<path d="M47 52 L50 57 L53 52 Z" fill="#FFAE6B" stroke="#F08A3C" stroke-width="2"/>'
               + eyes(50, 44, 1.3) + blush(50, 46, 1.3))


def dragon_body(cx, cy, s=1.0, wings_up=True):
    wing = ('M{a} {b} L{c} {d} L{e} {f} Z')
    wy = -14 if wings_up else 6
    wings = (f'<path d="M{cx - 30 * s} {cy - 4 * s} L{cx - 46 * s} {cy + wy * s - 6 * s} L{cx - 26 * s} {cy - 14 * s} Z '
             f'M{cx + 30 * s} {cy - 4 * s} L{cx + 46 * s} {cy + wy * s - 6 * s} L{cx + 26 * s} {cy - 14 * s} Z" '
             f'fill="{SUIT["sword"][0]}" stroke="{SUIT["sword"][1]}" stroke-width="{4 * s}"/>')
    return (wings
            + f'<ellipse cx="{cx}" cy="{cy}" rx="{34 * s}" ry="{32 * s}" fill="#9FE0C2" stroke="#3FAF80" stroke-width="{5 * s}"/>'
            f'<path d="M{cx - 14 * s} {cy - 30 * s} L{cx - 10 * s} {cy - 44 * s} L{cx - 4 * s} {cy - 31 * s} '
            f'M{cx + 4 * s} {cy - 31 * s} L{cx + 10 * s} {cy - 44 * s} L{cx + 14 * s} {cy - 30 * s}" fill="{GOLD}" stroke="{GOLD_DK}" stroke-width="{3 * s}"/>'
            f'<ellipse cx="{cx}" cy="{cy + 17 * s}" rx="{18 * s}" ry="{11 * s}" fill="#E8FFF4"/>'
            + face(cx, cy - 4 * s, 1.4 * s))


def dragon():
    return svg(dragon_body(50, 56, 1.0, True))


# ===== Card back and table icons =====
def heart(cx, cy, r, fill, op=1.0):
    return (f'<path d="M{cx} {cy + r} C{cx - 2.2 * r} {cy - 0.2 * r} {cx - 1.1 * r} {cy - 1.6 * r} {cx} {cy - 0.6 * r} '
            f'C{cx + 1.1 * r} {cy - 1.6 * r} {cx + 2.2 * r} {cy - 0.2 * r} {cx} {cy + r} Z" fill="{fill}" opacity="{op}"/>')


def back():
    dots = ''.join(heart(x, y, 3.2, WHITE, .55) if (i + j) % 2 == 0 else f'<circle cx="{x}" cy="{y}" r="1.8" fill="{WHITE}" opacity=".6"/>'
                   for i, y in enumerate(range(18, 140, 12)) for j, x in enumerate(range(18 + (6 if i % 2 else 0), 90, 12)))
    return svg(
        f'<rect width="100" height="150" fill="#C9B6EE"/>'
        f'<rect x="7" y="7" width="86" height="136" rx="10" fill="#B9A2E6" stroke="{WHITE}" stroke-width="3"/>'
        f'<clipPath id="in"><rect x="7" y="7" width="86" height="136" rx="10"/></clipPath><g clip-path="url(#in)">{dots}</g>'
        f'<circle cx="50" cy="75" r="22" fill="{WHITE}" stroke="#9C86D4" stroke-width="3"/>'
        f'<g transform="translate(32 57) scale(.36)">{symbol("star", 5, True, 1.2)}</g>',
        '0 0 100 150')


def mini_back(x, y, rot=0, cx=20, cy=36):
    return (f'<g transform="rotate({rot} {cx} {cy})">'
            f'<rect x="{x}" y="{y}" width="15" height="22" rx="3.5" fill="#C9B6EE" stroke="#8E6CC9" stroke-width="1.6"/>'
            + heart(x + 7.5, y + 11, 3, WHITE) + '</g>')


def icon(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="3 3 34 34">{body}</svg>\n'


# ===== Dog dash and Dragon flight sprites (facing right, two frames) =====
def leg(x1, y1, x2, y2, c='#E0A46E'):
    return (f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{c}" stroke-width="10"/>'
            f'<path d="M{x1} {y1} L{x2} {y2}" stroke="#F7C08B" stroke-width="6"/>')


def shiba_run(stretched):
    legs = (leg(66, 66, 84, 72) + leg(34, 66, 16, 70)) if stretched else (leg(64, 66, 62, 84) + leg(36, 66, 40, 84))
    return svg(
        f'<path d="M22 48 Q8 44 14 32 Q22 28 24 40" fill="#F7C08B" stroke="#E0A46E" stroke-width="4"/>'  # curly tail
        + legs
        + f'<ellipse cx="48" cy="56" rx="28" ry="16" fill="#F7C08B" stroke="#E0A46E" stroke-width="4.5"/>'
        f'<ellipse cx="50" cy="62" rx="16" ry="7" fill="#FFF3E4"/>'
        + f'<g transform="translate(46 2) scale(.62)">{shiba_head(50, 56, 1.0)}</g>')


def shiba_back(left_up):
    lf, rf = (-6, 0) if left_up else (0, -6)
    return svg(
        leg(38, 74, 36, 90 + lf) + leg(62, 74, 64, 90 + rf)
        + f'<ellipse cx="50" cy="66" rx="24" ry="20" fill="#F7C08B" stroke="#E0A46E" stroke-width="4.5"/>'
        f'<path d="M28 36 Q24 12 40 22 Z M72 36 Q76 12 60 22 Z" fill="#F7C08B" stroke="#E0A46E" stroke-width="4"/>'
        f'<ellipse cx="50" cy="38" rx="24" ry="20" fill="#F7C08B" stroke="#E0A46E" stroke-width="4.5"/>'
        f'<path d="M50 80 Q62 76 60 66 Q52 60 48 70" fill="none" stroke="#E0A46E" stroke-width="10"/>'
        f'<path d="M50 80 Q62 76 60 66 Q52 60 48 70" fill="none" stroke="#FFF3E4" stroke-width="5.5"/>')  # curled tail


def shiba_front(left_up):
    lf, rf = (-6, 0) if left_up else (0, -6)
    return svg(
        leg(38, 76, 36, 92 + lf) + leg(62, 76, 64, 92 + rf)
        + f'<ellipse cx="50" cy="72" rx="22" ry="16" fill="#F7C08B" stroke="#E0A46E" stroke-width="4.5"/>'
        f'<ellipse cx="50" cy="75" rx="12" ry="9" fill="#FFF3E4"/>'
        + f'<g transform="translate(17 2) scale(.66)">{shiba_head(50, 56, 1.0)}</g>')


def shiba_lie():
    return svg(
        f'<path d="M80 70 Q94 64 88 54 Q80 52 80 62" fill="#F7C08B" stroke="#E0A46E" stroke-width="4"/>'
        f'<ellipse cx="54" cy="74" rx="34" ry="16" fill="#F7C08B" stroke="#E0A46E" stroke-width="4.5"/>'
        f'<ellipse cx="30" cy="86" rx="10" ry="5" fill="#FFF3E4" stroke="#E0A46E" stroke-width="3"/>'
        f'<ellipse cx="50" cy="88" rx="10" ry="5" fill="#FFF3E4" stroke="#E0A46E" stroke-width="3"/>'
        + f'<g transform="translate(4 18) scale(.62)">{shiba_head(50, 56, 1.0, "happy")}</g>')


def dragon_fly(up):
    tail = f'<path d="M20 60 Q6 62 4 50 Q12 54 18 50" fill="#9FE0C2" stroke="#3FAF80" stroke-width="4"/>'
    return svg(tail + f'<g transform="translate(14 8) scale(.8)">{dragon_body(50, 56, 1.0, up)}</g>')


ART = {
    **{f'suit-{s}': svg(symbol(s)) for s in SUIT},
    **{f'pip-{s}': svg(symbol(s, 6, True, 1.2)) for s in SUIT},
    **{f'royal-{r}-{s}': royal(r, s) for r in 'JQK' for s in SUIT},
    'mahjong': chick(), 'dog': dog(), 'phoenix': phoenix(), 'dragon': dragon(),
    'back': back(),
    'icon-hand': icon(''.join(mini_back(12.5, 9, r) for r in (-24, 0, 24))),
    'icon-tricks': icon(''.join(mini_back(9 + 4 * i, 5 + 4 * i) for i in range(3))),
    'anim-doodle-run-1': shiba_run(True), 'anim-doodle-run-2': shiba_run(False),
    'anim-doodle-back-1': shiba_back(True), 'anim-doodle-back-2': shiba_back(False),
    'anim-doodle-front-1': shiba_front(True), 'anim-doodle-front-2': shiba_front(False),
    'anim-doodle-lie': shiba_lie(),
    'anim-dragon-fly-1': dragon_fly(True), 'anim-dragon-fly-2': dragon_fly(False),
}

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for name, content in ART.items():
    if not content.endswith('\n'):
        content += '\n'
    open(os.path.join(out, f'{name}.svg'), 'w').write(content)
print('wrote', len(ART))
