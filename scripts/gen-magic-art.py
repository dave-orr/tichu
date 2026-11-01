"""Generate the Magic theme's vector art into client/public/cards/magic/.

The cards themselves are painted full-face WebPs (one per card, five suits of
which each game deals four, drawn whole by Card.tsx), so this only makes what
sits around them, under the papercraft file names that client/src/theme.ts
cardArt() looks up: the card back, the seat-panel icons, and the Dog-dash /
Dragon-flight animation frames.

The sprites reuse the Classic Baroque rigs (scripts/gen-baroque-art.py) in
the painted Magic cards' colours: the Dog card's golden retriever, with soft
floppy ears and the goblin rider's red cape for a collar. The Dragon is its
own: a golden western dragon with bat wings that beat between the two
frames, the Dragon card's thick ridged cream horns, a fanged open jaw and
cream belly plates (no whiskers). The
back is a midnight spellbook cover: the five realms' orbs (sun, water,
skull, fire, forest, as ringed on the Dragon card) around the Mah Jong
parrot's starry wizard hat, which also marks the seat-panel card icons.

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
B.LACQUER, B.LACQUER_DK = '#7A4A26', '#4E2C14'                # leather harness
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


# ----- The Dog card's rider and kit -----
GOB, GOB_DK = '#8ED45A', '#5E9E34'
CAPE, CAPE_DK = '#E0352B', '#9C1E18'
TIN, TIN_DK = '#B8BEC6', '#7E8690'
TUNIC = '#7A4A26'
WOOD, WOOD_DK = '#C98A44', '#8A5A26'
STICK = '#8A5A32'


def medallion(x, y):
    return (f'<circle cx="{x}" cy="{y}" r="3" fill="{GOLD}" stroke-width="1.3"/>'
            f'<circle cx="{x - .7}" cy="{y - .7}" r="1" fill="{GOLD_LT}" stroke="none"/>')


def harness(x1, y1, cx, cy, x2, y2):
    """The leather chest strap with its gold medallion (the card's harness)."""
    mx, my = (x1 + 2 * cx + x2) / 4, (y1 + 2 * cy + y2) / 4
    return B.collar(x1, y1, cx, cy, x2, y2) + medallion(round(mx, 1), round(my + 1, 1))


def stick(x, y, rot=0):
    """The stick carried crosswise in the mouth."""
    return (f'<g transform="rotate({rot} {x} {y})">'
            f'<path d="M{x - 9} {y} L{x + 9} {y}" stroke-width="5"/><path d="M{x - 9} {y} L{x + 9} {y}" stroke="{STICK}" stroke-width="3"/>'
            f'<path d="M{x + 4} {y} l3 -3.4" stroke-width="3.4"/><path d="M{x + 4} {y} l3 -3.4" stroke="{STICK}" stroke-width="1.6"/>'
            f'<circle cx="{x + 9}" cy="{y}" r="1.4" fill="{WOOD}" stroke-width=".8"/></g>')


def goblin(x, y, flap, arm_up=True, s=1.0):
    """The goblin rider in profile facing right, seated at (x, y): red cape
    streaming behind, colander helmet, big ear, grin, wooden spoon raised."""
    p = lambda dx, dy: f'{B.f(x + dx * s)} {B.f(y + dy * s)}'
    cape = (f'<path d="M{p(-1, -14)} Q{p(-10, -16 + flap)} {p(-20, -12 + flap * 1.6)} L{p(-17, -8 + flap)} L{p(-22, -5 + flap * 1.4)} '
            f'Q{p(-11, -6)} {p(-2, -6)} Z" fill="{CAPE}" stroke-width="1.8"/>')
    leg = (f'<path d="M{p(-1, -2)} Q{p(3, 2)} {p(2, 8)}" fill="none" stroke-width="5"/>'
           f'<path d="M{p(-1, -2)} Q{p(3, 2)} {p(2, 8)}" fill="none" stroke="#5A5F6A" stroke-width="3"/>'
           f'<path d="M{p(0, 8)} Q{p(5, 7)} {p(6, 10)} L{p(0, 11)} Z" fill="{TUNIC}" stroke-width="1.4"/>')
    body = f'<path d="M{p(-5, -1)} Q{p(-6, -12)} {p(1, -14)} Q{p(6, -12)} {p(5, -1)} Z" fill="{TUNIC}" stroke-width="1.8"/>'
    if arm_up:
        arm = (f'<path d="M{p(3, -11)} L{p(8, -18)}" stroke-width="4"/><path d="M{p(3, -11)} L{p(8, -18)}" stroke="{GOB}" stroke-width="2.2"/>'
               f'<path d="M{p(7, -15)} L{p(12, -30)}" stroke-width="3.6"/><path d="M{p(7, -15)} L{p(12, -30)}" stroke="{WOOD}" stroke-width="2"/>'
               f'<ellipse cx="{B.f(x + 12.8 * s)}" cy="{B.f(y - 32 * s)}" rx="{B.f(2.6 * s)}" ry="{B.f(3.8 * s)}" transform="rotate(18 {B.f(x + 12.8 * s)} {B.f(y - 32 * s)})" fill="{WOOD}" stroke-width="1.4"/>'
               f'<circle cx="{B.f(x + 8 * s)}" cy="{B.f(y - 18 * s)}" r="{B.f(1.8 * s)}" fill="{GOB}" stroke-width="1.1"/>')
    else:
        arm = (f'<path d="M{p(3, -10)} L{p(9, -5)}" stroke-width="4"/><path d="M{p(3, -10)} L{p(9, -5)}" stroke="{GOB}" stroke-width="2.2"/>')
    head = (f'<path d="M{p(-3, -20)} L{p(-13, -24)} L{p(-4, -16)} Z" fill="{GOB}" stroke-width="1.5"/>'  # ear, swept back
            f'<circle cx="{B.f(x + 1 * s)}" cy="{B.f(y - 19 * s)}" r="{B.f(6 * s)}" fill="{GOB}" stroke-width="1.8"/>'
            f'<path d="M{p(1, -16.5)} Q{p(4, -13)} {p(6.5, -17)} Z" fill="#E86A6A" stroke-width="1"/>'  # open grin
            f'<path d="M{p(2.5, -21)} Q{p(4, -22.6)} {p(5.5, -21)}" fill="none" stroke-width="1.2"/>'  # happy closed eye
            f'<circle cx="{B.f(x + 3 * s)}" cy="{B.f(y - 18.4 * s)}" r="{B.f(1 * s)}" fill="#F6A0A0" stroke="none" opacity=".8"/>')
    helmet = (f'<path d="M{p(-6.5, -21)} Q{p(-6, -30)} {p(1, -30)} Q{p(8, -30)} {p(8, -21)} Z" fill="{TIN}" stroke-width="1.8"/>'
              f'<path d="M{p(-7.5, -21)} L{p(9, -21)}" stroke-width="3"/><path d="M{p(-7.5, -21)} L{p(9, -21)}" stroke="{TIN_DK}" stroke-width="1.6"/>'
              + ''.join(f'<circle cx="{B.f(x + dx * s)}" cy="{B.f(y + dy * s)}" r="{B.f(.7 * s)}" fill="{TIN_DK}" stroke="none"/>' for dx, dy in ((-2, -25), (1.5, -26), (5, -24.5), (-3.6, -23), (2.4, -23)))
              + f'<path d="M{p(-6.5, -24)} q-3 0 -2.6 2.4" fill="none" stroke="{TIN_DK}" stroke-width="1.4"/>')
    return cape + leg + body + arm + head + helmet


def dog_run(stretch):
    """The Dog card in a gallop: retriever with a stick in its mouth and the
    goblin riding, cape flapping between the frames."""
    cx, cy = 46, 60
    leg = B.leg
    if stretch:
        legs = (leg(cx - 20, cy + 6, cx - 34, cy + 20) + leg(cx - 14, cy + 6, cx - 26, cy + 22)
                + leg(cx + 18, cy + 6, cx + 34, cy + 16) + leg(cx + 13, cy + 6, cx + 30, cy + 21))
    else:
        legs = (leg(cx - 19, cy + 6, cx - 8, cy + 22) + leg(cx - 14, cy + 6, cx - 2, cy + 24)
                + leg(cx + 17, cy + 6, cx + 6, cy + 22) + leg(cx + 12, cy + 6, cx + 2, cy + 23))
    bob = -3 if stretch else 2
    girth = f'<path d="M{cx - 3} {cy - 13} Q{cx - 5} {cy} {cx - 2} {cy + 11}" fill="none" stroke-width="5"/><path d="M{cx - 3} {cy - 13} Q{cx - 5} {cy} {cx - 2} {cy + 11}" fill="none" stroke="{B.LACQUER}" stroke-width="3"/>'
    return B.svg(f'<g transform="translate(0 {bob})">' + legs + B.curl_tail(cx - 25, cy - 13)
                 + B.shiba_body(cx, cy) + girth + B.shiba_head(cx + 27, cy - 18)
                 + stick(cx + 42, cy - 12, -8)
                 + harness(cx + 18, cy - 10, cx + 23, cy - 2, cx + 30, cy - 9)
                 + goblin(cx - 4, cy - 12, 4 if stretch else -2, arm_up=True, s=1.25) + '</g>')


def dog_lie():
    """Arrived: lying down with the stick, the goblin still aboard, spoon down."""
    cx, cy = 46, 66
    leg = B.leg
    return B.svg(
        B.curl_tail(cx - 24, cy - 12)
        + f'<path d="M{cx - 26} {cy + 2} Q{cx - 26} {cy - 13} {cx - 10} {cy - 13} L{cx + 12} {cy - 14} Q{cx + 26} {cy - 14} {cx + 26} {cy + 2} '
        f'Q{cx + 26} {cy + 10} {cx + 14} {cy + 10} L{cx - 18} {cy + 10} Q{cx - 26} {cy + 10} {cx - 26} {cy + 2} Z" fill="{B.FUR}" stroke-width="2.8"/>'
        f'<ellipse cx="{cx - 14}" cy="{cy + 3}" rx="9" ry="7" fill="{B.FUR_LT}" stroke-width="2.2"/>'
        + leg(cx + 14, cy + 6, cx + 36, cy + 8) + leg(cx + 8, cy + 7, cx + 31, cy + 10)
        + B.shiba_head(cx + 26, cy - 22) + stick(cx + 41, cy - 16, -4)
        + harness(cx + 17, cy - 14, cx + 22, cy - 6, cx + 29, cy - 13)
        + goblin(cx - 4, cy - 13, 0, arm_up=False, s=1.25))


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
        f'<path d="M50 28 L50 46" fill="none" stroke="{B.FUR}" stroke-width="1.6"/></g>'
        # the goblin from behind: ears out, colander helmet, cape over the dog's back
        f'<path d="M41 22 L30 16 L42 27 Z M59 22 L70 16 L58 27 Z" fill="{GOB}" stroke-width="1.6"/>'
        f'<path d="M42 26 Q50 22 58 26 Q{62 + (3 if a else -3)} 44 {58 + (3 if a else -3)} 50 L50 47 L{42 - (3 if a else -3)} 50 Q{38 - (3 if a else -3)} 44 42 26 Z" fill="{CAPE}" stroke-width="2"/>'
        f'<path d="M50 30 L50 46" fill="none" stroke="{CAPE_DK}" stroke-width="1.2"/>'
        f'<path d="M41 22 Q41 10 50 10 Q59 10 59 22 Z" fill="{TIN}" stroke-width="1.8"/>'
        f'<path d="M39.5 22 L60.5 22" stroke-width="3"/><path d="M39.5 22 L60.5 22" stroke="{TIN_DK}" stroke-width="1.6"/>'
        + ''.join(f'<circle cx="{x}" cy="{y}" r=".8" fill="{TIN_DK}" stroke="none"/>' for x, y in ((45, 16), (50, 15), (55, 16), (47.5, 19), (52.5, 19))))


def dog_front(a):
    """Running toward the viewer: full face, floppy ears, red cape collar."""
    lift = 5 if a else -5
    leg = B.leg
    wave = 3 if a else -3
    rider = (f'<path d="M36 14 L24 {8 + wave} L38 20 Z M64 14 L76 {8 - wave} L62 20 Z" fill="{GOB}" stroke-width="1.6"/>'
             f'<path d="M37 18 Q37 6 50 6 Q63 6 63 18 Z" fill="{GOB}" stroke-width="1.8"/>'
             f'<path d="M43 12 Q45 10 47 12 M53 12 Q55 10 57 12" fill="none" stroke-width="1.2"/>'
             f'<path d="M37 9 Q37 -2 50 -2 Q63 -2 63 9 Z" fill="{TIN}" stroke-width="1.8"/>'
             f'<path d="M35.5 9 L64.5 9" stroke-width="3"/><path d="M35.5 9 L64.5 9" stroke="{TIN_DK}" stroke-width="1.6"/>'
             f'<path d="M67 18 L{74 + wave} 2" stroke-width="3.6"/><path d="M67 18 L{74 + wave} 2" stroke="{WOOD}" stroke-width="2"/>'
             f'<ellipse cx="{75 + wave}" cy="0" rx="2.6" ry="3.6" fill="{WOOD}" stroke-width="1.4"/>')
    return B.svg(
        f'<g transform="translate(5 {8 + (2 if a else -2)}) scale(.9)">' + rider
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
        + stick(50, 45, 0) + harness(33, 52, 50, 61, 67, 52) + '</g>')


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


HAT, HAT_DK, HAT_LT = '#4B3AA8', '#2E2275', '#6E5CD0'


def wizard_hat(cx, cy, s=1.0, detail=True):
    """The Mah Jong parrot's wizard hat, centred on (cx, cy): a wide brim,
    a gold band, and a starry cone whose tip flops over to the right."""
    p = lambda x, y: f'{B.f(cx + x * s)} {B.f(cy + y * s)}'
    brim = f'<path d="M{p(-13, 6)} Q{p(0, 1)} {p(13, 6)} Q{p(10, 10)} {p(0, 10)} Q{p(-10, 10)} {p(-13, 6)} Z" fill="{HAT_DK}" stroke-width="{1.6 * s:.2f}"/>'
    cone = (f'<path d="M{p(-9, 6)} Q{p(-7, -4)} {p(-3, -10)} Q{p(1, -16)} {p(7, -15)} Q{p(12, -14)} {p(12, -9)} '
            f'Q{p(8, -12)} {p(5, -9)} Q{p(6, -2)} {p(9, 6)} Q{p(0, 8)} {p(-9, 6)} Z" fill="{HAT}" stroke-width="{1.6 * s:.2f}"/>')
    shine = f'<path d="M{p(-5, 2)} Q{p(-4, -5)} {p(-1, -9)}" fill="none" stroke="{HAT_LT}" stroke-width="{1.4 * s:.2f}"/>'
    band = f'<path d="M{p(-8.6, 3)} Q{p(0, 5)} {p(8.4, 3)} L{p(9, 6)} Q{p(0, 8)} {p(-9, 6)} Z" fill="{GOLD}" stroke-width="{1.1 * s:.2f}"/>'
    bell = f'<circle cx="{B.f(cx + 12 * s)}" cy="{B.f(cy - 8 * s)}" r="{B.f(1.8 * s)}" fill="{GOLD}" stroke-width="{.9 * s:.2f}"/>'
    deco = ''
    if detail:
        deco = (f'<path d="{star(cx + 1.6 * s, cy - 2.4 * s, 2.6 * s, 1.1 * s)}" fill="{GOLD_LT}" stroke="none"/>'
                f'<path d="{star(cx - 4.4 * s, cy - 6 * s, 1.5 * s, .65 * s)}" fill="{GOLD_LT}" stroke="none"/>'
                f'<path d="{star(cx + 4.6 * s, cy - 11.6 * s, 1.3 * s, .55 * s)}" fill="{GOLD_LT}" stroke="none"/>'
                f'<path d="M{p(-3.6, 1.4)} A2.4 2.4 0 1 0 {p(-2.4, -2.6)} A1.9 1.9 0 1 1 {p(-3.6, 1.4)} Z" fill="{GOLD_LT}" stroke="none"/>')
    return brim + cone + shine + band + deco + bell


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
        if math.hypot(x - 50, y - 70) < 34:
            continue
        seed = (seed * 1103515245 + 12345) % 2 ** 31
        r = .35 + (seed % 50) / 100
        stars += f'<circle cx="{B.f(x)}" cy="{B.f(y)}" r="{r:.2f}" fill="#FFFFFF" fill-opacity=".75" stroke="none"/>'
    orbs = ''
    for i, (fill, sym) in enumerate(REALMS):
        a = math.radians(-90 + 72 * i)
        ox, oy = 50 + 22 * math.cos(a), 70 + 22 * math.sin(a)
        orbs += (f'<circle cx="{B.f(ox)}" cy="{B.f(oy)}" r="6.4" fill="{fill}" stroke="{GOLD}" stroke-width="1.4"/>'
                 + realm_symbol(i, round(ox, 1), round(oy, 1), sym))
    ring = ''.join(
        f'<path d="M{B.f(50 + 22 * math.cos(math.radians(-90 + 72 * i) + .38))} {B.f(70 + 22 * math.sin(math.radians(-90 + 72 * i) + .38))} '
        f'A22 22 0 0 1 {B.f(50 + 22 * math.cos(math.radians(-18 + 72 * i) - .38))} {B.f(70 + 22 * math.sin(math.radians(-18 + 72 * i) - .38))}" '
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
        f'<circle cx="50" cy="70" r="33" fill="url(#halo)" stroke="none"/>'
        + ring + orbs +
        f'<circle cx="50" cy="70" r="15" fill="{MIDNIGHT_LT}" stroke="{GOLD}" stroke-width="1.4"/>'
        + wizard_hat(50, 71, 1.05),
        '0 0 100 140')


def mini_back(x, y, rot=0, cx=20, cy=36):
    return (f'<g transform="rotate({rot} {cx} {cy})">'
            f'<rect x="{x}" y="{y}" width="15" height="22" rx="2" fill="{MIDNIGHT}" stroke="{INK}" stroke-width="1.5"/>'
            f'<rect x="{x + 2.5}" y="{y + 2.5}" width="10" height="17" rx="1" fill="none" stroke="{GOLD}" stroke-width="1.1"/>'
            + f'<g stroke="{INK}">' + wizard_hat(x + 7.5, y + 11.4, .3, detail=False) + '</g></g>')


# ===== Golden dragon (Dragon flight) =====
SCALE, SCALE_DK, SCALE_LT = '#EDC33E', '#B5861A', '#FFE37A'
WING, WING_DK = '#E0A93A', '#B27B22'
BELLY, BELLY_DK = '#FFF0C2', '#C9A04A'
EYE = '#E8572A'
SPINE, SPINE_DK = '#FBE7B0', '#C9A04A'
HORN, HORN_BAND = '#FBEBC2', '#C8A666'


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
    fill, edge = (WING_DK, SCALE_DK) if far else (WING, SCALE_DK)
    bones = ''.join(f'<path d="M{f(wrist[0])} {f(wrist[1])} L{f(x)} {f(y)}" fill="none" stroke="{SCALE_LT if not far else SCALE}" stroke-width="1.6"/>' for x, y in tips)
    arm = (f'<path d="M{f(sx)} {f(sy)} L{f(wrist[0])} {f(wrist[1])}" fill="none" stroke-width="4.6"/>'
           f'<path d="M{f(sx)} {f(sy)} L{f(wrist[0])} {f(wrist[1])}" fill="none" stroke="{SCALE if not far else SCALE_DK}" stroke-width="2.6"/>'
           f'<path d="M{f(wrist[0] - 1.5)} {f(wrist[1] + (-1 if up else 1))} l-2 {-2.5 if up else 2.5} l3.5 1 Z" fill="{HORN}" stroke-width=".8"/>')
    return f'<path d="{" ".join(pts)}" fill="{fill}" stroke-width="2"/>' + bones + arm


def dragon_fly(up):
    """A golden western dragon flying right, wings beating between the frames:
    horned head with a fanged open jaw and a spiked frill, gold belly plates,
    a long spined tail ending in a spade."""
    bob = 3 if up else -3
    f = B.f
    # Tail: a tapering curve back from the hip, spade at the tip.
    tail = (f'<path d="M30 58 Q16 60 10 68 Q6 74 2 74 Q8 70 10 64 Q16 54 30 52 Z" fill="{SCALE}" stroke-width="2.2"/>'
            f'<path d="M2 74 L-1 68 L5 70 L4 64 L8 71 Z" fill="{SCALE_DK}" stroke-width="1.4"/>')
    tail_spines = ''.join(f'<path d="M{x} {y} l2 -4 l2 3.4 Z" fill="{SPINE}" stroke-width="1"/>' for x, y in ((12, 61.5), (18, 56.5), (24, 53.6)))
    body = (f'<path d="M28 54 Q34 44 50 44 Q60 44 66 40 Q70 36 72 30 L78 33 Q76 42 70 48 Q64 56 52 60 Q38 64 28 58 Z" fill="{SCALE}" stroke-width="2.4"/>'
            f'<path d="M32 58 Q42 62 52 58 Q62 54 68 47 Q66 52 60 56 Q48 64 34 61 Z" fill="{BELLY}" stroke="none"/>')
    plates = ''.join(f'<path d="M{x} {y} l1.6 3.4" fill="none" stroke="{BELLY_DK}" stroke-width="1"/>'
                     for x, y in ((38, 59), (44, 58.6), (50, 57.4), (55, 55.4), (60, 52.6), (64, 49.4)))
    back_spines = ''.join(f'<path d="M{x} {y} l2.4 -5 l2.2 4.4 Z" fill="{SPINE}" stroke-width="1"/>'
                          for x, y in ((36, 47.4), (43, 44.6), (51, 44), (59, 42.6), (66, 38.6)))
    legs = (f'<path d="M36 58 Q34 66 40 70" fill="none" stroke-width="5"/><path d="M36 58 Q34 66 40 70" fill="none" stroke="{SCALE_DK}" stroke-width="3"/>'
            f'<path d="M40 70 l3 -1 M40 70 l3 1.4 M40 70 l1.6 2.6" stroke="{HORN}" stroke-width="1.2"/>'
            f'<path d="M60 54 Q62 62 66 62" fill="none" stroke-width="4.4"/><path d="M60 54 Q62 62 66 62" fill="none" stroke="{SCALE}" stroke-width="2.6"/>'
            f'<path d="M66 62 l2.6 -1.4 M66 62 l2.8 .8 M66 62 l1.2 2.6" stroke="{HORN}" stroke-width="1.2"/>')
    # Head: brow ridge, swept-back horns, open fanged jaw, spiked frill.
    hx, hy = 78, 30
    def horn(bx, by, tx, ty, cx, cy, w):
        """A thick curved horn from base (bx, by) to tip (tx, ty) bowing
        through (cx, cy), with ridge bands across it."""
        pts = [B.bez((bx, by), (cx, cy), (cx, cy), (tx, ty), i / 10) for i in range(11)]
        nrm = []
        for i, (x, y) in enumerate(pts):
            ax, ay = pts[max(i - 1, 0)]
            zx, zy = pts[min(i + 1, 10)]
            dx, dy = zx - ax, zy - ay
            ln = math.hypot(dx, dy) or 1
            nrm.append((-dy / ln, dx / ln))
        half = lambda i: w * (1 - i / 10) ** .8 / 2
        side1 = [(x + nx * half(i), y + ny * half(i)) for i, ((x, y), (nx, ny)) in enumerate(zip(pts, nrm))]
        side2 = [(x - nx * half(i), y - ny * half(i)) for i, ((x, y), (nx, ny)) in enumerate(zip(pts, nrm))]
        outline = 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in side1 + side2[::-1]) + ' Z'
        bands = ''.join(f'<path d="M{f(side1[i][0])} {f(side1[i][1])} L{f(side2[i][0])} {f(side2[i][1])}" stroke="{HORN_BAND}" stroke-width=".8"/>'
                        for i in (2, 4, 6))
        return f'<path d="{outline}" fill="{HORN}" stroke-width="1.3"/>' + bands

    horns = (horn(hx - 3, hy - 3, hx - 17, hy - 13, hx - 6, hy - 17, 4.4)
             + horn(hx + 2, hy - 5, hx - 11, hy - 20, hx + 1, hy - 22, 4.8))
    frill = ''.join(f'<path d="M{hx - 4 - 2.4 * i} {hy + 2 + 2.6 * i} l-5 1 l4 2.6 Z" fill="{SPINE}" stroke-width="1"/>' for i in range(3))
    head = (f'<path d="M{hx - 6} {hy + 2} Q{hx - 6} {hy - 6} {hx + 2} {hy - 6} Q{hx + 10} {hy - 7} {hx + 18} {hy - 3} '
            f'Q{hx + 21} {hy - 1} {hx + 19} {hy + 1} L{hx + 8} {hy + 2} Q{hx + 2} {hy + 7} {hx - 6} {hy + 2} Z" fill="{SCALE}" stroke-width="2.2"/>'
            f'<path d="M{hx + 3} {hy + 4} Q{hx + 11} {hy + 6} {hx + 17} {hy + 10} Q{hx + 9} {hy + 11} {hx + 2} {hy + 8} Z" fill="{SCALE_DK}" stroke-width="1.8"/>'  # jaw, dropped open
            f'<path d="M{hx + 6} {hy + 3} Q{hx + 12} {hy + 5} {hx + 16} {hy + 8.6}" fill="none" stroke="#E86A7A" stroke-width="1.6"/>'  # tongue
            f'<path d="M{hx + 9} {hy + 1.8} l1 2.4 l1 -2.3 M{hx + 13} {hy + 1.2} l1 2.4 l1 -2.4 M{hx + 16.5} {hy + .6} l.8 2.2 l.9 -2" fill="#fff" stroke-width=".7"/>'
            f'<path d="M{hx + 8} {hy + 6} l.8 -2 l1 1.8 M{hx + 12} {hy + 7.4} l.8 -2 l1 1.9" fill="#fff" stroke-width=".7"/>'
            f'<path d="M{hx + 1} {hy - 4} Q{hx + 5} {hy - 8} {hx + 10} {hy - 4.6}" fill="{SCALE_LT}" stroke-width="1.3"/>'  # brow ridge
            f'<ellipse cx="{hx + 5.4}" cy="{hy - 2.4}" rx="2.2" ry="1.5" fill="{EYE}" stroke-width="1"/>'
            f'<ellipse cx="{hx + 5.8}" cy="{hy - 2.4}" rx=".6" ry="1.3" fill="{INK}" stroke="none"/>'
            f'<circle cx="{hx + 17}" cy="{hy - 2}" r=".8" fill="{INK}" stroke="none"/>'
            + ''.join(f'<path d="M{hx + 11 + 3 * i} {hy - 5.6 + .6 * i} l1 -2.6 l1.4 2.4" fill="{SCALE_DK}" stroke-width=".8"/>' for i in range(2)))
    return B.svg(f'<g transform="translate(3 {bob + 3}) scale(.94)">' + wing(54, 44, up, True) + tail + tail_spines + legs + body + plates
                 + back_spines + frill + horns + head + wing(50, 46, up, False) + '</g>')


ART = {
    'back': back(),
    'icon-hand': B.icon(''.join(mini_back(12.5, 9, r) for r in (-24, 0, 24))),
    'icon-tricks': B.icon(''.join(mini_back(9 + 4 * i, 5 + 4 * i) for i in range(3))),
    'anim-doodle-run-1': dog_run(True), 'anim-doodle-run-2': dog_run(False),
    'anim-doodle-back-1': dog_back(True), 'anim-doodle-back-2': dog_back(False),
    'anim-doodle-front-1': dog_front(True), 'anim-doodle-front-2': dog_front(False),
    'anim-doodle-lie': dog_lie(),
    'anim-dragon-fly-1': dragon_fly(True), 'anim-dragon-fly-2': dragon_fly(False),
}

if __name__ == '__main__':
    out = sys.argv[1]
    os.makedirs(out, exist_ok=True)
    for name, content in ART.items():
        open(os.path.join(out, f'{name}.svg'), 'w').write(content)
    print('wrote', len(ART))
