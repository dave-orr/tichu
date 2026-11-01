"""Generate the Magic theme's vector art into client/public/cards/magic/.

The cards themselves are painted full-face WebPs (one per card, five suits of
which each game deals four, drawn whole by Card.tsx), so this only makes what
sits around them, under the papercraft file names that client/src/theme.ts
cardArt() looks up: the card back, the seat-panel icons, and the Dog-dash /
Dragon-flight animation frames.

The sprites reuse the Classic Baroque rigs (scripts/gen-baroque-art.py) in
the painted Magic cards' colours: the Dog card's golden retriever, with soft
floppy ears and the goblin rider's red cape for a collar. The Dragon is its
own: a red western dragon with bat wings that beat between the two frames,
ivory horns, a fanged open jaw and gold belly plates. The
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


# ===== Red dragon (Dragon flight) =====
RED, RED_DK, RED_LT = '#C42A2A', '#7E1418', '#E8574A'
WING, WING_DK = '#A41E24', '#6A1016'
BELLY_GOLD, BELLY_GOLD_DK = '#F2C46A', '#C48A2E'
HORN = '#F3E3B8'


def wing(sx, sy, up, far):
    """A bat wing from the shoulder: an arm out to the wrist, three finger
    bones fanning to the tips, and the membrane scalloped between them."""
    if up:
        wrist, tips = (sx - 4, sy - 24), [(sx - 36, sy - 26), (sx - 22, sy - 42), (sx + 2, sy - 44)]
    else:
        wrist, tips = (sx - 6, sy + 20), [(sx - 38, sy + 20), (sx - 26, sy + 36), (sx - 6, sy + 40)]
    if far:  # the far wing peeks out a little further along and darker
        wrist = (wrist[0] + 10, wrist[1] + (4 if up else -4))
        tips = [(x + 12, y + (6 if up else -6)) for x, y in tips]
    root_back = (sx - 18, sy + 4)
    f = B.f
    pts = [f'M{f(sx)} {f(sy)}', f'L{f(wrist[0])} {f(wrist[1])}', f'L{f(tips[2][0])} {f(tips[2][1])}']
    # scallops between the tips, bowing toward the wrist
    for a, b in ((tips[2], tips[1]), (tips[1], tips[0])):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        cx, cy = mx + (wrist[0] - mx) * .5, my + (wrist[1] - my) * .5
        pts.append(f'Q{f(cx)} {f(cy)} {f(b[0])} {f(b[1])}')
    pts.append(f'Q{f((tips[0][0] + root_back[0]) / 2 + 2)} {f((tips[0][1] + root_back[1]) / 2 + (6 if up else -6))} {f(root_back[0])} {f(root_back[1])} Z')
    fill, edge = (WING_DK, RED_DK) if far else (WING, RED_DK)
    bones = ''.join(f'<path d="M{f(wrist[0])} {f(wrist[1])} L{f(x)} {f(y)}" fill="none" stroke="{RED_LT if not far else RED}" stroke-width="1.6"/>' for x, y in tips)
    arm = (f'<path d="M{f(sx)} {f(sy)} L{f(wrist[0])} {f(wrist[1])}" fill="none" stroke-width="4.6"/>'
           f'<path d="M{f(sx)} {f(sy)} L{f(wrist[0])} {f(wrist[1])}" fill="none" stroke="{RED if not far else RED_DK}" stroke-width="2.6"/>'
           f'<path d="M{f(wrist[0] - 1.5)} {f(wrist[1] + (-1 if up else 1))} l-2 {-2.5 if up else 2.5} l3.5 1 Z" fill="{HORN}" stroke-width=".8"/>')
    return f'<path d="{" ".join(pts)}" fill="{fill}" stroke-width="2"/>' + bones + arm


def red_dragon_fly(up):
    """A red western dragon flying right, wings beating between the frames:
    horned head with a fanged open jaw and a spiked frill, gold belly plates,
    a long spined tail ending in a spade."""
    bob = 3 if up else -3
    f = B.f
    # Tail: a tapering curve back from the hip, spade at the tip.
    tail = (f'<path d="M30 58 Q16 60 10 68 Q6 74 2 74 Q8 70 10 64 Q16 54 30 52 Z" fill="{RED}" stroke-width="2.2"/>'
            f'<path d="M2 74 L-1 68 L5 70 L4 64 L8 71 Z" fill="{RED_DK}" stroke-width="1.4"/>')
    tail_spines = ''.join(f'<path d="M{x} {y} l2 -4 l2 3.4 Z" fill="{RED_DK}" stroke-width="1"/>' for x, y in ((12, 61.5), (18, 56.5), (24, 53.6)))
    body = (f'<path d="M28 54 Q34 44 50 44 Q60 44 66 40 Q70 36 72 30 L78 33 Q76 42 70 48 Q64 56 52 60 Q38 64 28 58 Z" fill="{RED}" stroke-width="2.4"/>'
            f'<path d="M32 58 Q42 62 52 58 Q62 54 68 47 Q66 52 60 56 Q48 64 34 61 Z" fill="{BELLY_GOLD}" stroke="none"/>')
    plates = ''.join(f'<path d="M{x} {y} l1.6 3.4" fill="none" stroke="{BELLY_GOLD_DK}" stroke-width="1"/>'
                     for x, y in ((38, 59), (44, 58.6), (50, 57.4), (55, 55.4), (60, 52.6), (64, 49.4)))
    back_spines = ''.join(f'<path d="M{x} {y} l2.4 -5 l2.2 4.4 Z" fill="{RED_DK}" stroke-width="1"/>'
                          for x, y in ((36, 47.4), (43, 44.6), (51, 44), (59, 42.6), (66, 38.6)))
    legs = (f'<path d="M36 58 Q34 66 40 70" fill="none" stroke-width="5"/><path d="M36 58 Q34 66 40 70" fill="none" stroke="{RED_DK}" stroke-width="3"/>'
            f'<path d="M40 70 l3 -1 M40 70 l3 1.4 M40 70 l1.6 2.6" stroke="{HORN}" stroke-width="1.2"/>'
            f'<path d="M60 54 Q62 62 66 62" fill="none" stroke-width="4.4"/><path d="M60 54 Q62 62 66 62" fill="none" stroke="{RED}" stroke-width="2.6"/>'
            f'<path d="M66 62 l2.6 -1.4 M66 62 l2.8 .8 M66 62 l1.2 2.6" stroke="{HORN}" stroke-width="1.2"/>')
    # Head: brow ridge, swept-back horns, open fanged jaw, spiked frill.
    hx, hy = 78, 30
    horns = (f'<path d="M{hx - 2} {hy - 4} Q{hx - 8} {hy - 12} {hx - 16} {hy - 14} Q{hx - 8} {hy - 8} {hx - 4} {hy - 1} Z" fill="{HORN}" stroke-width="1.4"/>'
             f'<path d="M{hx + 2} {hy - 5} Q{hx - 1} {hy - 14} {hx - 6} {hy - 19} Q{hx + 1} {hy - 12} {hx + 5} {hy - 4} Z" fill="{HORN}" stroke-width="1.4"/>')
    frill = ''.join(f'<path d="M{hx - 4 - 2.4 * i} {hy + 2 + 2.6 * i} l-5 1 l4 2.6 Z" fill="{RED_DK}" stroke-width="1"/>' for i in range(3))
    head = (f'<path d="M{hx - 6} {hy + 2} Q{hx - 6} {hy - 6} {hx + 2} {hy - 6} Q{hx + 10} {hy - 7} {hx + 18} {hy - 3} '
            f'Q{hx + 21} {hy - 1} {hx + 19} {hy + 1} L{hx + 8} {hy + 2} Q{hx + 2} {hy + 7} {hx - 6} {hy + 2} Z" fill="{RED}" stroke-width="2.2"/>'
            f'<path d="M{hx + 3} {hy + 4} Q{hx + 11} {hy + 6} {hx + 17} {hy + 10} Q{hx + 9} {hy + 11} {hx + 2} {hy + 8} Z" fill="{RED_DK}" stroke-width="1.8"/>'  # jaw, dropped open
            f'<path d="M{hx + 6} {hy + 3} Q{hx + 12} {hy + 5} {hx + 16} {hy + 8.6}" fill="none" stroke="#E86A7A" stroke-width="1.6"/>'  # tongue
            f'<path d="M{hx + 9} {hy + 1.8} l1 2.4 l1 -2.3 M{hx + 13} {hy + 1.2} l1 2.4 l1 -2.4 M{hx + 16.5} {hy + .6} l.8 2.2 l.9 -2" fill="#fff" stroke-width=".7"/>'
            f'<path d="M{hx + 8} {hy + 6} l.8 -2 l1 1.8 M{hx + 12} {hy + 7.4} l.8 -2 l1 1.9" fill="#fff" stroke-width=".7"/>'
            f'<path d="M{hx + 1} {hy - 4} Q{hx + 5} {hy - 8} {hx + 10} {hy - 4.6}" fill="{RED_LT}" stroke-width="1.3"/>'  # brow ridge
            f'<ellipse cx="{hx + 5.4}" cy="{hy - 2.4}" rx="2.2" ry="1.5" fill="{BELLY_GOLD}" stroke-width="1"/>'
            f'<ellipse cx="{hx + 5.8}" cy="{hy - 2.4}" rx=".6" ry="1.3" fill="{INK}" stroke="none"/>'
            f'<circle cx="{hx + 17}" cy="{hy - 2}" r=".8" fill="{INK}" stroke="none"/>'
            + ''.join(f'<path d="M{hx + 11 + 3 * i} {hy - 5.6 + .6 * i} l1 -2.6 l1.4 2.4" fill="{RED_DK}" stroke-width=".8"/>' for i in range(2)))
    return B.svg(f'<g transform="translate(3 {bob + 3}) scale(.94)">' + wing(54, 44, up, True) + tail + tail_spines + legs + body + plates
                 + back_spines + frill + horns + head + wing(50, 46, up, False) + '</g>')


ART = {
    'back': back(),
    'icon-hand': B.icon(''.join(mini_back(12.5, 9, r) for r in (-24, 0, 24))),
    'icon-tricks': B.icon(''.join(mini_back(9 + 4 * i, 5 + 4 * i) for i in range(3))),
    'anim-doodle-run-1': B.dog_run(True), 'anim-doodle-run-2': B.dog_run(False),
    'anim-doodle-back-1': dog_back(True), 'anim-doodle-back-2': dog_back(False),
    'anim-doodle-front-1': dog_front(True), 'anim-doodle-front-2': dog_front(False),
    'anim-doodle-lie': B.dog_lie(),
    'anim-dragon-fly-1': red_dragon_fly(True), 'anim-dragon-fly-2': red_dragon_fly(False),
}

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, content in ART.items():
        open(os.path.join(out, f'{name}.svg'), 'w').write(content)
    print('wrote', len(ART))
