"""Generate the Magic theme's vector art into client/public/cards/magic/.

The cards themselves are painted full-face WebPs (one per card, five suits of
which each game deals four, drawn whole by Card.tsx), so this only makes what
sits around them, under the papercraft file names that client/src/theme.ts
cardArt() looks up: the card back, the seat-panel icons, and the Dog-dash /
Dragon-flight animation frames.

The sprites reuse the Classic Baroque rigs (scripts/gen-baroque-art.py) in
the painted Magic cards' colours: the Dog card's golden retriever, with soft
floppy ears and the goblin rider's red cape for a collar, and the Dragon
card's golden serpent with violet fins and an ivory mane and antlers. The
back is a midnight spellbook cover: the five realms' orbs (sun, water,
skull, fire, forest, as ringed on the Dragon card) around a gold star.

    python3 scripts/gen-magic-art.py client/public/cards/magic
"""
import importlib.util
import math
import os
import sys

_spec = importlib.util.spec_from_file_location('baroque', os.path.join(os.path.dirname(__file__), 'gen-baroque-art.py'))
B = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(B)

INK = '#2A1E33'
MIDNIGHT, MIDNIGHT_DK, MIDNIGHT_LT = '#243263', '#121735', '#3A4A86'
GOLD, GOLD_LT, GOLD_DK = '#F5BA35', '#FCD670', '#B9841A'
IVORY = '#FFF6DE'
VIOLET, VIOLET_DK = '#8E4FC9', '#5E2E96'
# The five realms, as ringed on the Dragon card: [fill, symbol].
REALMS = [('#FFF3C9', '#E59A1C'), ('#2F7BD8', '#E6F1FF'), ('#2B2433', '#EDE6F2'), ('#D8452E', '#FFE2B0'), ('#2E8A4A', '#E3F7D9')]

# ----- Re-colour the Baroque rigs -----
B.INK = INK
B.FUR, B.FUR_DK, B.FUR_LT = '#E3A64A', '#B9792A', '#F2C778'   # golden retriever
B.CREAM = '#FBEBC8'
B.LACQUER, B.LACQUER_DK = '#C8352A', '#7E1A14'                # red cape collar
B.GOLD, B.GOLD_LT = IVORY, GOLD_LT                             # ivory antlers, whiskers, claws
B.LAPIS, B.LAPIS_DK, B.LAPIS_LT = '#EAC24A', '#B98B1E', '#FFE592'  # golden dragon
B.VERMILION, B.VERMILION_DK = VIOLET, VIOLET_DK
B.BELLY = IVORY


def floppy_ears_profile(cx, cy, s, fill):
    """One soft ear hanging behind the eye (replaces the shiba's pricked ears)."""
    p = lambda x, y: f'{B.f(cx + x * s)} {B.f(cy + y * s)}'
    return (f'<path d="M{p(-8, -10)} Q{p(-2, -14)} {p(2, -9)} Q{p(1, 2)} {p(-5, 9)} Q{p(-12, 9)} {p(-12, 0)} '
            f'Q{p(-12, -7)} {p(-8, -10)} Z" fill="{fill}" stroke-width="2.4"/>')


def retriever_head(cx, cy, s=1.0, happy=False):
    """The shiba's profile head with its three pricked-ear paths (the first
    three it draws) swapped for a floppy ear drawn over the skull."""
    head = B._shiba_head(cx, cy, s, happy)
    skull_at = head.index('<path', head.index('<path', head.index('<path', 1) + 1) + 1)
    return head[skull_at:] + floppy_ears_profile(cx, cy, s, B.FUR_DK)


def plume_tail(cx, cy, s=0.75):
    """A retriever's feathered tail streaming out behind (replaces the
    shiba's curl)."""
    p = lambda x, y: f'{B.f(cx + x * s)} {B.f(cy + y * s)}'
    return (f'<path d="M{p(4, 4)} Q{p(-8, -2)} {p(-20, -10)} Q{p(-16, -2)} {p(-22, 2)} Q{p(-12, 4)} {p(-18, 9)} '
            f'Q{p(-6, 10)} {p(4, 10)} Z" fill="{B.FUR_LT}" stroke-width="2.2"/>'
            f'<path d="M{p(0, 6)} Q{p(-8, 3)} {p(-15, -3)}" fill="none" stroke="{B.FUR}" stroke-width="1.6"/>')


B._shiba_head = B.shiba_head
B.shiba_head = retriever_head
B.curl_tail = plume_tail


def dog_back(a):
    """Running away up the screen: rump, feathery tail, ears down the sides."""
    lift = 5 if a else -5
    leg = B.leg
    wag = 8 if a else -8
    return B.svg(
        f'<path d="M33 18 Q26 22 27 34 Q30 38 35 33 Q38 26 38 20 Z M67 18 Q74 22 73 34 Q70 38 65 33 Q62 26 62 20 Z" fill="{B.FUR_DK}" stroke-width="2.4"/>'
        f'<ellipse cx="50" cy="26" rx="17" ry="13" fill="{B.FUR}" stroke-width="2.6"/>'
        f'<path d="M34 33 Q50 41 66 33" fill="none" stroke-width="6"/><path d="M34 33 Q50 41 66 33" fill="none" stroke="{B.LACQUER}" stroke-width="3.6"/>'
        + leg(40, 66, 39, 84 - lift) + leg(60, 66, 61, 84 + lift)
        + f'<path d="M28 52 Q28 34 50 34 Q72 34 72 52 Q72 72 50 72 Q28 72 28 52 Z" fill="{B.FUR}" stroke-width="2.8"/>'
        f'<path d="M40 70 Q50 62 60 70 Q56 73 50 73 Q44 73 40 70 Z" fill="{B.CREAM}" stroke="none"/>'
        f'<g transform="rotate({wag} 50 50)"><path d="M47 50 Q44 36 50 24 Q56 36 53 50 Z" fill="{B.FUR_LT}" stroke-width="2.2"/>'
        f'<path d="M50 28 L50 46" fill="none" stroke="{B.FUR}" stroke-width="1.6"/></g>')


def dog_front(a):
    """Running toward the viewer: full face, floppy ears, red cape collar."""
    lift = 5 if a else -5
    leg = B.leg
    return B.svg(
        f'<g transform="translate(0 {2 if a else -2})">'
        + leg(40, 66, 39, 86 - lift) + leg(60, 66, 61, 86 + lift)
        + f'<path d="M30 58 Q30 44 50 44 Q70 44 70 58 Q70 74 50 74 Q30 74 30 58 Z" fill="{B.FUR}" stroke-width="2.8"/>'
        f'<path d="M40 50 Q50 46 60 50 Q62 66 50 72 Q38 66 40 50 Z" fill="{B.CREAM}" stroke="none"/>'
        f'<path d="M28 34 Q28 16 50 16 Q72 16 72 34 Q72 50 50 52 Q28 50 28 34 Z" fill="{B.FUR}" stroke-width="2.8"/>'
        f'<path d="M30 20 Q20 22 21 38 Q23 46 29 42 Q33 32 34 22 Z M70 20 Q80 22 79 38 Q77 46 71 42 Q67 32 66 22 Z" fill="{B.FUR_DK}" stroke-width="2.4"/>'
        f'<path d="M38 40 Q40 33 46 34 Q50 36 54 34 Q60 33 62 40 Q60 51 50 51 Q40 51 38 40 Z" fill="{B.CREAM}" stroke="none"/>'
        f'<ellipse cx="41" cy="31" rx="2.6" ry="3.2" fill="{INK}" stroke="none"/><ellipse cx="59" cy="31" rx="2.6" ry="3.2" fill="{INK}" stroke="none"/>'
        f'<circle cx="41.8" cy="30" r=".9" fill="#fff" stroke="none"/><circle cx="59.8" cy="30" r=".9" fill="#fff" stroke="none"/>'
        f'<ellipse cx="50" cy="40" rx="3.8" ry="2.8" fill="{INK}" stroke="none"/>'
        f'<path d="M50 42 L50 45 M45 45 Q50 49 55 45" fill="none" stroke-width="1.6"/>'
        f'<path d="M47.5 46 Q50 53 52.5 46 Z" fill="#E86A6A" stroke-width="1"/>'
        + B.collar(33, 50, 50, 59, 67, 50, (50, 57, 3 if a else -3)) + '</g>')


# ===== Card back and icons =====
def star(cx, cy, R, r, rot=-90):
    pts = []
    for i in range(10):
        a = math.radians(rot + 36 * i)
        rr = R if i % 2 == 0 else r
        pts.append(f'{B.f(cx + rr * math.cos(a))} {B.f(cy + rr * math.sin(a))}')
    return 'M' + ' L'.join(pts) + ' Z'


def realm_symbol(i, cx, cy, col):
    """Tiny sun / drop / skull / flame / tree for each orb."""
    if i == 0:
        rays = ''.join(f'M{B.f(cx + 2.6 * math.cos(a))} {B.f(cy + 2.6 * math.sin(a))}L{B.f(cx + 3.8 * math.cos(a))} {B.f(cy + 3.8 * math.sin(a))}'
                       for a in (k * math.pi / 4 for k in range(8)))
        return f'<circle cx="{cx}" cy="{cy}" r="1.8" fill="{col}" stroke="none"/><path d="{rays}" stroke="{col}" stroke-width=".9"/>'
    if i == 1:
        return f'<path d="M{cx} {cy - 3.6} Q{cx + 3} {cy + .2} {cx + 2.2} {cy + 1.6} Q{cx} {cy + 4} {cx - 2.2} {cy + 1.6} Q{cx - 3} {cy + .2} {cx} {cy - 3.6} Z" fill="{col}" stroke="none"/>'
    if i == 2:
        return (f'<path d="M{cx - 2.8} {cy} Q{cx - 2.8} {cy - 3.4} {cx} {cy - 3.4} Q{cx + 2.8} {cy - 3.4} {cx + 2.8} {cy} '
                f'Q{cx + 2.8} {cy + 1.6} {cx + 1.6} {cy + 2} L{cx + 1.6} {cy + 3.2} L{cx - 1.6} {cy + 3.2} L{cx - 1.6} {cy + 2} Q{cx - 2.8} {cy + 1.6} {cx - 2.8} {cy} Z" fill="{col}" stroke="none"/>'
                f'<circle cx="{cx - 1.1}" cy="{cy - .4}" r=".8" fill="#2B2433" stroke="none"/><circle cx="{cx + 1.1}" cy="{cy - .4}" r=".8" fill="#2B2433" stroke="none"/>')
    if i == 3:
        return f'<path d="M{cx} {cy - 3.8} Q{cx + 3.4} {cy - .4} {cx + 2.4} {cy + 2} Q{cx} {cy + 4.2} {cx - 2.4} {cy + 2} Q{cx - 3.2} {cy} {cx - 1.2} {cy - 1.6} Q{cx - .8} {cy} {cx} {cy - .2} Q{cx + .6} {cy - 2} {cx} {cy - 3.8} Z" fill="{col}" stroke="none"/>'
    return (f'<path d="M{cx} {cy - 3.8} L{cx + 2.4} {cy - .6} L{cx + 1.2} {cy - .6} L{cx + 3} {cy + 2} L{cx - 3} {cy + 2} L{cx - 1.2} {cy - .6} L{cx - 2.4} {cy - .6} Z" fill="{col}" stroke="none"/>'
            f'<rect x="{cx - .6}" y="{cy + 2}" width="1.2" height="1.6" fill="{col}" stroke="none"/>')


def back():
    sky = (f'<radialGradient id="sky" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="{MIDNIGHT_LT}"/>'
           f'<stop offset=".55" stop-color="{MIDNIGHT}"/><stop offset="1" stop-color="{MIDNIGHT_DK}"/></radialGradient>'
           f'<radialGradient id="halo" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="{GOLD_LT}" stop-opacity=".45"/>'
           f'<stop offset="1" stop-color="{GOLD_LT}" stop-opacity="0"/></radialGradient>')
    # Fixed starfield (deterministic so regenerating doesn't churn the file).
    stars = ''
    seed = 7
    for _ in range(46):
        seed = (seed * 1103515245 + 12345) % 2 ** 31
        x = 12 + (seed % 7600) / 100
        seed = (seed * 1103515245 + 12345) % 2 ** 31
        y = 12 + (seed % 11600) / 100
        if math.hypot(x - 50, y - 70) < 30:
            continue
        seed = (seed * 1103515245 + 12345) % 2 ** 31
        r = .35 + (seed % 50) / 100
        stars += f'<circle cx="{B.f(x)}" cy="{B.f(y)}" r="{r:.2f}" fill="#FFFFFF" fill-opacity=".75" stroke="none"/>'
    orbs = ''
    for i, (fill, sym) in enumerate(REALMS):
        a = math.radians(-90 + 72 * i)
        ox, oy = 50 + 19 * math.cos(a), 70 + 19 * math.sin(a)
        orbs += (f'<circle cx="{B.f(ox)}" cy="{B.f(oy)}" r="6.4" fill="{fill}" stroke="{GOLD}" stroke-width="1.4"/>'
                 + realm_symbol(i, round(ox, 1), round(oy, 1), sym))
    ring = ''.join(
        f'<path d="M{B.f(50 + 19 * math.cos(math.radians(-90 + 72 * i) + .38))} {B.f(70 + 19 * math.sin(math.radians(-90 + 72 * i) + .38))} '
        f'A19 19 0 0 1 {B.f(50 + 19 * math.cos(math.radians(-18 + 72 * i) - .38))} {B.f(70 + 19 * math.sin(math.radians(-18 + 72 * i) - .38))}" '
        f'fill="none" stroke="{GOLD}" stroke-opacity=".7" stroke-width=".8"/>' for i in range(5))
    corners = ''.join(f'<path d="{star(x, y, 3.2, 1.3)}" fill="{GOLD}" stroke="none"/>' for x, y in ((18, 18), (82, 18), (18, 122), (82, 122)))
    return B.svg(
        f'<defs>{sky}</defs>'
        f'<rect width="100" height="140" rx="6" fill="{IVORY}" stroke="none"/>'
        f'<rect x="4" y="4" width="92" height="132" rx="3.5" fill="none" stroke="{VIOLET}" stroke-width="1.2"/>'
        f'<rect x="8" y="8" width="84" height="124" rx="2.5" fill="url(#sky)" stroke="none"/>'
        + stars +
        f'<rect x="11" y="11" width="78" height="118" rx="2" fill="none" stroke="{GOLD}" stroke-width="1.3"/>'
        f'<rect x="13.5" y="13.5" width="73" height="113" rx="1.5" fill="none" stroke="{GOLD}" stroke-opacity=".55" stroke-width=".6"/>'
        + corners +
        f'<circle cx="50" cy="70" r="30" fill="url(#halo)" stroke="none"/>'
        + ring + orbs +
        f'<circle cx="50" cy="70" r="9" fill="{VIOLET_DK}" stroke="{GOLD}" stroke-width="1.4"/>'
        f'<path d="{star(50, 70, 7, 2.9)}" fill="{GOLD_LT}" stroke="{GOLD_DK}" stroke-width=".6"/>',
        '0 0 100 140')


def mini_back(x, y, rot=0, cx=20, cy=36):
    return (f'<g transform="rotate({rot} {cx} {cy})">'
            f'<rect x="{x}" y="{y}" width="15" height="22" rx="2" fill="{MIDNIGHT}" stroke="{INK}" stroke-width="1.5"/>'
            f'<rect x="{x + 2.5}" y="{y + 2.5}" width="10" height="17" rx="1" fill="none" stroke="{GOLD}" stroke-width="1.1"/>'
            f'<path d="{star(x + 7.5, y + 11, 3.6, 1.5)}" fill="{GOLD_LT}" stroke="none"/></g>')


ART = {
    'back': back(),
    'icon-hand': B.icon(''.join(mini_back(12.5, 9, r) for r in (-24, 0, 24))),
    'icon-tricks': B.icon(''.join(mini_back(9 + 4 * i, 5 + 4 * i) for i in range(3))),
    'anim-doodle-run-1': B.dog_run(True), 'anim-doodle-run-2': B.dog_run(False),
    'anim-doodle-back-1': dog_back(True), 'anim-doodle-back-2': dog_back(False),
    'anim-doodle-front-1': dog_front(True), 'anim-doodle-front-2': dog_front(False),
    'anim-doodle-lie': B.dog_lie(),
    'anim-dragon-fly-1': B.dragon_fly(True), 'anim-dragon-fly-2': B.dragon_fly(False),
}

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, content in ART.items():
        open(os.path.join(out, f'{name}.svg'), 'w').write(content)
    print('wrote', len(ART))
