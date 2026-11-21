"""Generate the Kids' Table theme's card art into client/public/cards/kids-table/.

Same file names as the papercraft set (scripts/gen-card-art.py), so the
client just switches folders (client/src/theme.ts cardArt). The whole deck
looks drawn in crayon by a seven-year-old, mostly by tracing their hand:
scribbled hatch fills (one pattern per crayon), a displacement filter that
wobbles every line, and creative spelling. The suits are a hand turkey
(star), peas (jade), a pilgrim hat (sword) and corn on the cob (pagoda), in
four clearly different crayons.

Readability rules (the art is silly, the game must not be): each court rank
is a different family member with its own headgear and background colour
(J: "ME" in a pilgrim hat on blue, Q: "MOM" with a tiara on pink, K: "DAD"
with a giant crown on gold), and the Dragon is a whole red-winged dragon
breathing fire, not another hand turkey.

The kids' scribbled words are converted to outlines from Gochi Hand (the
theme's display font, installed with the client as @fontsource/gochi-hand),
so the SVGs don't depend on a font when drawn as <img>. Needs fontTools
(`pip install fonttools`) and `npm install` for the font.

    python3 scripts/gen-kids-table-art.py client/public/cards/kids-table
"""
import math
import os
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

INK = '#3A2E2A'
WHITE = '#FFFFFF'
PAPER = '#FFF3D6'
# One entry per crayon; each gets a hatch pattern (see crayon_defs).
CRAYON = dict(
    red='#E0402F', orange='#F28A1E', yellow='#FFD21A', green='#45A845', husk='#3FB83A', blue='#3D7FD8',
    purple='#8C4FC4', brown='#8A5230', black='#2E2A2A', gold='#F2B705', tan='#D9B27C', pink='#F27BA0',
    blush='#FFC2D4', sky='#BFE3FF', grass='#5DBB4C',
)
C = CRAYON
CORN, CORN_DK = '#FFE45C', '#C98A00'
PEA = '#7ED36A'
PLACEMAT = '#E07A2E'
# Court backgrounds: one colour per rank, so J, Q and K tell apart at a glance.
COURT_BG = {'J': '#BEE0FF', 'Q': '#FFC6DA', 'K': '#FFE08A'}
SUIT_CRAYON = {'star': 'red', 'jade': 'green', 'sword': 'black', 'pagoda': 'yellow'}

FONT_PATH = os.path.join(os.path.dirname(__file__), '..', 'node_modules', '@fontsource', 'gochi-hand', 'files',
                         'gochi-hand-latin-400-normal.woff')
FONT = TTFont(FONT_PATH)
GLYPHS = FONT.getGlyphSet()
CMAP = FONT.getBestCmap()
UPM = FONT['head'].unitsPerEm


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


def words(x, y, text, size, fill, rot=0):
    """Text centred on (x, y baseline) as an outline path in Gochi Hand."""
    names = [CMAP[ord(ch)] for ch in text]
    k = size / UPM
    width = sum(FONT['hmtx'][n][0] for n in names) * k
    pen = SVGPathPen(GLYPHS, ntos=f)
    cur = x - width / 2
    for n in names:
        GLYPHS[n].draw(TransformPen(pen, (k, 0, 0, -k, cur, y)))
        cur += FONT['hmtx'][n][0] * k
    rot_attr = f' transform="rotate({rot} {f(x)} {f(y)})"' if rot else ''
    return f'<path d="{pen.getCommands()}" fill="{fill}" stroke="none"{rot_attr}/>'


def crayon_defs(seed=3):
    """Hatch fills (a half-strength wash under dense diagonal strokes) and the
    wobble filter that makes every line look hand-drawn."""
    pats = ''.join(f'<pattern id="h-{k}" width="3.2" height="3.2" patternUnits="userSpaceOnUse" patternTransform="rotate(38)">'
                   f'<rect width="3.2" height="3.2" fill="{v}" opacity=".5"/><rect width="2.3" height="3.2" fill="{v}"/></pattern>'
                   for k, v in CRAYON.items())
    return (pats + f'<filter id="cr" x="-10%" y="-10%" width="120%" height="120%">'
            f'<feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="{seed}"/>'
            '<feDisplacementMap in="SourceGraphic" scale="2.4"/></filter>')


def F(k):
    return f'url(#h-{k})'


def svg(body, vb='0 0 100 100', seed=3, under=''):
    """A crayon drawing: `under` is drawn flat (backgrounds), `body` wobbles."""
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><defs>{crayon_defs(seed)}</defs>{under}'
            f'<g stroke="{INK}" stroke-linejoin="round" stroke-linecap="round" filter="url(#cr)">{body}</g></svg>\n')


# ===== Suit symbols =====
def hand_turkey(fingers=('red', 'orange', 'yellow', 'green'), body='brown', sw=3, legs=True):
    """A traced-hand turkey: the fingers are the feathers, the thumb is the head."""
    out = ''
    for (a, length), col in zip([(-52, 34), (-74, 38), (-96, 38), (-118, 33)], fingers):
        x, y = 54 + length * math.cos(math.radians(a)), 60 + length * math.sin(math.radians(a))
        out += (f'<g transform="rotate({a + 90} {f(x)} {f(y)})"><rect x="{f(x - 7)}" y="{f(y - 10)}" width="14" height="{f(length)}" rx="7" '
                f'fill="{F(col)}" stroke-width="{sw}"/></g>')
    out += (f'<ellipse cx="52" cy="64" rx="24" ry="22" fill="{F(body)}" stroke-width="{sw}"/>'
            f'<path d="M66 54 Q78 40 90 46 Q96 52 88 58 Q80 62 72 70 Z" fill="{F(body)}" stroke-width="{sw}"/>'
            f'<path d="M92 50 L100 53 L92 56 Z" fill="{F("orange")}" stroke-width="{f(sw * .7)}"/>'
            f'<path d="M88 57 Q92 64 88 68 Q84 64 88 57 Z" fill="{F("red")}" stroke-width="{f(sw * .7)}"/>'
            f'<circle cx="84" cy="49" r="2.2" fill="{INK}" stroke="none"/>')
    if legs:
        out += f'<path d="M44 85 L42 96 L36 98 M42 96 L46 99 M58 85 L60 96 L54 98 M60 96 L65 99" fill="none" stroke="{C["orange"]}" stroke-width="{sw}"/>'
    return out


def turkey(sw=4):
    return hand_turkey(sw=sw, legs=False)


def peas(sw=4):
    return (f'<path d="M6 54 Q30 20 70 30 Q92 36 96 26 Q92 66 54 74 Q22 80 6 54 Z" fill="{F("green")}" stroke-width="{sw}"/>'
            + ''.join(f'<circle cx="{x}" cy="{y}" r="11" fill="{PEA}" stroke-width="{f(sw * .8)}"/>' for x, y in ((30, 52), (52, 50), (74, 44)))
            + f'<path d="M96 26 Q98 16 92 10" fill="none" stroke-width="{sw}"/>')


def pilgrim_hat(sw=4):
    return (f'<ellipse cx="50" cy="82" rx="46" ry="12" fill="{F("black")}" stroke-width="{sw}"/>'
            f'<path d="M26 82 L32 18 L68 18 L74 82 Z" fill="{F("black")}" stroke-width="{sw}"/>'
            f'<path d="M29 58 L71 58 L72 70 L28 70 Z" fill="#F2EEE6" stroke-width="{f(sw * .8)}"/>'
            f'<rect x="40" y="54" width="20" height="20" fill="{F("gold")}" stroke-width="{f(sw * .8)}"/>'
            f'<rect x="45" y="59" width="10" height="10" fill="#F2EEE6" stroke-width="{f(sw * .6)}"/>')


def corn(sw=4):
    kernels = ''.join(f'<circle cx="{x}" cy="{y}" r="3.8" fill="{CORN}" stroke="{CORN_DK}" stroke-width="1.3"/>'
                      for x in (41, 50, 59) for y in range(18, 74, 9))
    return (f'<ellipse cx="50" cy="46" rx="18" ry="39" fill="{C["yellow"]}" stroke-width="{sw}"/>' + kernels
            + f'<path d="M50 96 Q16 82 20 34 Q30 60 46 72 Z" fill="{F("husk")}" stroke-width="{sw}"/>'
            f'<path d="M50 96 Q84 82 80 34 Q70 60 54 72 Z" fill="{F("husk")}" stroke-width="{sw}"/>')


SYMBOLS = {'star': turkey, 'jade': peas, 'sword': pilgrim_hat, 'pagoda': corn}


# ===== Court cards (100x150 portraits, cropped to a 2:3 frame) =====
def face(cx=50, cy=46):
    return (f'<circle cx="{cx}" cy="{cy}" r="19" fill="{F("blush")}" stroke-width="2.6"/>'
            f'<circle cx="{cx - 7}" cy="{cy - 3}" r="2.4" fill="{INK}" stroke="none"/><circle cx="{cx + 7}" cy="{cy - 3}" r="2.4" fill="{INK}" stroke="none"/>')


def dad(suit):  # King: a giant crown, a bushy beard, a robe in the suit crayon, a drumstick sceptre
    robe = F(SUIT_CRAYON[suit])
    return (f'<path d="M20 152 L22 116 Q26 96 50 94 Q74 96 78 116 L80 152 Z" fill="{robe}" stroke-width="2.6"/>'
            f'<path d="M44 96 L56 96 L56 152 L44 152 Z" fill="{WHITE}" stroke-width="1.6"/>'
            f'<path d="M84 140 L86 94" stroke-width="5"/><path d="M84 140 L86 94" stroke="{PAPER}" stroke-width="2.6"/>'
            f'<ellipse cx="87" cy="86" rx="7" ry="9" fill="{F("brown")}" stroke-width="2"/>'
            + face(50, 72) +
            f'<path d="M32 76 Q34 100 50 102 Q66 100 68 76 Q60 84 50 82 Q40 84 32 76 Z" fill="{F("brown")}" stroke-width="2.4"/>'
            f'<path d="M44 84 Q50 88 56 84" fill="none" stroke-width="2"/>'
            f'<path d="M28 58 L22 26 L37 42 L50 20 L63 42 L78 26 L72 58 Z" fill="{F("gold")}" stroke-width="2.6"/>'
            f'<circle cx="50" cy="44" r="3.4" fill="{C["red"]}" stroke-width="1.2"/>'
            f'<circle cx="34" cy="49" r="2.4" fill="{C["blue"]}" stroke="none"/><circle cx="66" cy="49" r="2.4" fill="{C["blue"]}" stroke="none"/>'
            + words(18, 128, 'DAD', 15, C['red'], -10))


def mom(suit):  # Queen: long hair, a tiara, pearls, a triangle dress in the suit crayon
    dress = F(SUIT_CRAYON[suit])
    pearls = ''.join(f'<circle cx="{f(50 + 10 * math.sin(math.radians(a)))}" cy="{f(92 + 4 * math.cos(math.radians(a)))}" r="2.2" fill="{WHITE}" stroke-width="1"/>'
                     for a in range(-80, 100, 32))
    return (f'<path d="M30 72 Q26 110 20 118 L36 116 Q32 96 34 76 Z M70 72 Q74 110 80 118 L64 116 Q68 96 66 76 Z" fill="{F("orange")}" stroke-width="2.4"/>'
            f'<path d="M50 90 L16 152 L84 152 Z" fill="{dress}" stroke-width="2.6"/>'
            + face(50, 72) +
            f'<path d="M31 68 Q30 48 50 48 Q70 48 69 68 Q60 56 50 58 Q40 56 31 68 Z" fill="{F("orange")}" stroke-width="2.4"/>'
            f'<path d="M44 78 Q50 83 56 78" fill="none" stroke="{C["red"]}" stroke-width="2.4"/>'
            f'<circle cx="38" cy="76" r="3" fill="{C["pink"]}" stroke="none" opacity=".8"/><circle cx="62" cy="76" r="3" fill="{C["pink"]}" stroke="none" opacity=".8"/>'
            + pearls +
            f'<path d="M34 50 L38 34 L44 44 L50 26 L56 44 L62 34 L66 50 Z" fill="{F("sky")}" stroke-width="2"/>'
            f'<path d="M48 34 L50 30 L52 34 L50 37 Z" fill="{C["pink"]}" stroke-width="1"/>'
            + words(84, 128, 'MOM', 17, C['purple'], 10))


def me(suit):  # Jack: the artist, in a pilgrim hat, with freckles and a missing tooth, waving
    shirt = F(SUIT_CRAYON[suit])
    return (f'<path d="M50 90 L50 120 L38 140 M50 120 L62 140" fill="none" stroke-width="3"/>'
            f'<path d="M34 92 L66 92 L68 118 L32 118 Z" fill="{shirt}" stroke-width="2.4"/>'
            f'<path d="M34 96 L16 76 M66 96 L86 104" stroke-width="3"/>'
            f'<path d="M10 70 L16 76 M12 78 L16 76 M18 68 L16 76" stroke-width="2"/>'
            + face(50, 72) +
            f'<path d="M40 78 Q50 88 60 78 Z" fill="{WHITE}" stroke-width="2"/><rect x="48" y="78" width="4" height="4" fill="{INK}" stroke="none"/>'
            + ''.join(f'<circle cx="{x}" cy="{y}" r="1" fill="{C["brown"]}" stroke="none"/>' for x, y in ((39, 75), (42, 77), (58, 75), (61, 77)))
            + f'<path d="M22 56 L78 56" stroke-width="7"/><path d="M22 56 L78 56" stroke="{C["black"]}" stroke-width="4"/>'
            f'<path d="M33 56 L36 28 L64 28 L67 56 Z" fill="{F("black")}" stroke-width="2.4"/>'
            f'<rect x="44" y="42" width="12" height="11" fill="{F("gold")}" stroke-width="1.6"/>'
            + words(84, 136, 'ME', 19, C['blue'], -8))


def court(rank, suit):
    grass = (f'<path d="M-4 154 L-4 140 Q12 132 26 140 Q42 132 58 140 Q74 132 90 140 Q100 134 104 140 L104 154 Z" fill="{F("grass")}" stroke="none"/>'
             + ''.join(f'<path d="M{x} 141 L{x + 2} 133 M{x + 4} 141 L{x + 7} 135" fill="none" stroke="{C["green"]}" stroke-width="1.4"/>' for x in range(2, 100, 12)))
    figure = {'J': me, 'Q': mom, 'K': dad}[rank](suit)
    sun = (f'<circle cx="88" cy="12" r="9" fill="{F("yellow")}" stroke="{C["orange"]}" stroke-width="1.6"/>'
           + ''.join(f'<path d="M{f(88 + 12 * math.cos(math.radians(a)))} {f(12 + 12 * math.sin(math.radians(a)))} '
                     f'L{f(88 + 17 * math.cos(math.radians(a)))} {f(12 + 17 * math.sin(math.radians(a)))}" stroke="{C["orange"]}" stroke-width="1.6"/>'
                     for a in range(90, 271, 45))) if rank == 'J' else ''
    return svg(sun + grass + figure, '0 0 100 150', seed=ord(rank),
               under=f'<rect width="100" height="150" fill="{COURT_BG[rank]}"/>')


# ===== Specials =====
def mahjong():  # my first turkey: one feather (it's the 1)
    return svg(hand_turkey(fingers=('red',), sw=2.6)
               + words(30, 20, 'my 1st', 13, C['blue'], -8) + words(30, 33, 'turkey', 13, C['blue'], -8), seed=5)


def biskit(cx=48, cy=66, legs=0, happy=False):
    """Biskit the dog, side on, facing left. `legs` swings the legs for a run."""
    sw = 6 * legs
    leg_paths = (f'M{cx - 22} {cy + 12} L{cx - 24 - sw} {cy + 28} M{cx - 10} {cy + 14} L{cx - 10 + sw} {cy + 30} '
                 f'M{cx + 10} {cy + 14} L{cx + 10 - sw} {cy + 30} M{cx + 22} {cy + 12} L{cx + 24 + sw} {cy + 28}')
    eyes = (f'<path d="M{cx - 29} {cy - 24} Q{cx - 26} {cy - 27} {cx - 23} {cy - 24} M{cx - 20} {cy - 24} Q{cx - 17} {cy - 27} {cx - 14} {cy - 24}" fill="none" stroke-width="1.8"/>'
            if happy else f'<circle cx="{cx - 26}" cy="{cy - 24}" r="2.2" fill="{INK}" stroke="none"/><circle cx="{cx - 17}" cy="{cy - 24}" r="2.2" fill="{INK}" stroke="none"/>')
    return (f'<path d="{leg_paths}" stroke="{C["brown"]}" stroke-width="3.6"/>'
            f'<path d="M{cx + 30} {cy - 4} Q{cx + 44} {cy - 16} {cx + 42} {cy - 28}" fill="none" stroke="{C["brown"]}" stroke-width="3"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="30" ry="16" fill="{F("tan")}" stroke-width="2.6"/>'
            f'<circle cx="{cx - 22}" cy="{cy - 20}" r="16" fill="{F("tan")}" stroke-width="2.6"/>'
            f'<path d="M{cx - 34} {cy - 30} Q{cx - 44} {cy - 20} {cx - 38} {cy - 6} Q{cx - 32} {cy - 10} {cx - 32} {cy - 22} Z" fill="{F("brown")}" stroke-width="2"/>'
            + eyes +
            f'<ellipse cx="{cx - 21}" cy="{cy - 16}" rx="3" ry="2.2" fill="{INK}" stroke="none"/>'
            f'<path d="M{cx - 28} {cy - 11} Q{cx - 21} {cy - 5} {cx - 14} {cy - 11}" fill="none" stroke-width="2"/>')


def dog():  # Biskit, who ate the pie (crumbs and all)
    crumbs = ''.join(f'<circle cx="{x}" cy="{y}" r="1.6" fill="{C["orange"]}" stroke="none"/>' for x, y in ((18, 64), (24, 68), (14, 70)))
    return svg(biskit() + words(66, 20, 'BISKIT', 14, C['purple'], -6) + words(62, 34, 'he ate the pie', 9.5, C['purple'], -6) + crumbs, seed=7)


def phoenix():  # the glitter turkey, rising on crayon flames
    sparkles = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="{c}" stroke="none"/>' for x, y, r, c in
                       ((10, 20, 1.6, C['gold']), (22, 8, 1.2, C['pink']), (40, 4, 1.6, C['gold']), (62, 6, 1.3, C['blue']),
                        (80, 14, 1.6, C['gold']), (92, 30, 1.2, C['pink']), (6, 44, 1.3, C['blue']), (16, 30, 1, C['gold']),
                        (70, 22, 1, C['pink']), (30, 16, 1, C['blue']), (52, 14, 1.2, C['gold']), (90, 62, 1.4, C['gold'])))
    return svg(f'<path d="M30 92 Q26 80 34 74 Q34 84 40 84 Q38 72 48 66 Q48 80 56 82 Q58 74 64 72 Q68 82 62 92 Z" fill="{F("orange")}" stroke-width="2"/>'
               f'<g transform="translate(-4 -12) scale(.92)">{hand_turkey(fingers=("purple", "blue", "green", "pink"), body="yellow", legs=False)}</g>'
               + sparkles + words(74, 96, 'GLITTER', 11, C['pink'], -3), seed=9)


def dragon_body(wing_up=True):
    """A whole crayon dragon, side on, facing right: bat wing, horns, back
    spikes, a spade-tipped tail and a plume of fire. Nothing else in the deck
    is shaped like it."""
    wing = ('M34 54 L20 10 L30 20 L36 8 L44 22 L54 14 L56 50 Z', 'M30 20 L38 50 M44 22 L46 50') if wing_up else \
           ('M34 62 L18 96 L30 88 L36 100 L44 88 L54 96 L56 66 Z', 'M30 88 L38 66 M44 88 L46 66')
    spikes = ''.join(f'<path d="M{x} {y} L{x + 4} {y - 9} L{x + 8} {y + 1}" fill="{F("yellow")}" stroke-width="2"/>'
                     for x, y in ((18, 56), (27, 51), (36, 49), (45, 50)))
    limb = lambda d, w: f'<path d="{d}" fill="none" stroke-width="{w + 4}"/><path d="{d}" fill="none" stroke="{C["green"]}" stroke-width="{w}"/>'
    return (f'<path d="{wing[0]}" fill="{F("red")}" stroke-width="2.6"/><path d="{wing[1]}" fill="none" stroke-width="1.6"/>'
            + limb('M16 70 Q2 72 6 88 Q10 96 22 92', 6)
            + f'<path d="M20 86 L32 92 L20 99 Z" fill="{F("red")}" stroke-width="2"/>'
            + spikes + limb('M28 82 L26 96 L34 96 M48 82 L48 96 L56 96', 4)
            + f'<ellipse cx="38" cy="70" rx="26" ry="17" fill="{F("green")}" stroke-width="2.8"/>'
            f'<path d="M22 78 Q38 90 56 78" fill="{F("yellow")}" stroke-width="2"/>'
            f'<path d="M30 81 L30 85 M38 82 L38 87 M46 81 L46 85" stroke-width="1.4"/>'
            + limb('M54 62 Q62 50 60 38', 12)
            + f'<path d="M52 14 L56 26 M64 12 L64 26" stroke-width="6"/><path d="M52 14 L56 26 M64 12 L64 26" stroke="{C["yellow"]}" stroke-width="3"/>'
            f'<path d="M48 32 Q50 20 62 22 Q72 24 76 30 L74 38 Q64 42 52 40 Q46 38 48 32 Z" fill="{F("green")}" stroke-width="2.6"/>'
            f'<circle cx="60" cy="28" r="4.2" fill="{WHITE}" stroke-width="1.6"/><circle cx="61.5" cy="28" r="2" fill="{INK}" stroke="none"/>'
            f'<path d="M54 22 L65 25" stroke-width="2.4"/><path d="M66 38 L68 34 L70 38 L72 34" fill="{WHITE}" stroke-width="1.2"/>'
            f'<path d="M70 30 Q84 16 98 20 Q90 26 99 32 Q90 34 98 44 Q86 42 92 54 Q80 46 72 40 Z" fill="{F("orange")}" stroke-width="2.4"/>'
            f'<path d="M72 33 Q84 26 92 28 Q86 32 92 37 Q84 37 86 44 Q78 40 72 38 Z" fill="{F("yellow")}" stroke-width="1.6"/>')


def dragon():
    return svg(dragon_body(True), seed=11)


# ===== Card back and icons =====
def back():
    """The kids' menu placemat: crayon tic-tac-toe and a firm policy on peas."""
    cream = '#FFF3D6'
    return svg(f'<rect x="8" y="8" width="84" height="134" rx="4" fill="none" stroke="{C["yellow"]}" stroke-width="2.6" stroke-dasharray="7 5"/>'
               + words(50, 30, "KIDS'", 18, cream, -4) + words(50, 48, 'TABLE', 18, cream, -4)
               + f'<path d="M40 62 L40 110 M60 62 L60 110 M24 78 L76 78 M24 94 L76 94" stroke="{cream}" stroke-width="2.6"/>'
               f'<path d="M27 66 L36 75 M36 66 L27 75 M64 97 L73 106 M73 97 L64 106 M45 81 L55 91 M55 81 L45 91" stroke="{C["blue"]}" stroke-width="2.6"/>'
               f'<circle cx="68" cy="70" r="5" fill="none" stroke="{C["red"]}" stroke-width="2.6"/>'
               f'<circle cx="31" cy="102" r="5" fill="none" stroke="{C["red"]}" stroke-width="2.6"/>'
               f'<path d="M26 68 L74 104" stroke="{C["green"]}" stroke-width="2"/>'
               + words(50, 132, 'NO PEAS', 11, cream, 3),
               '0 0 100 150', seed=13, under=f'<rect width="100" height="150" fill="{PLACEMAT}"/>')


def mini_back(x, y, rot=0, cx=20, cy=36):
    return (f'<g transform="rotate({rot} {cx} {cy})">'
            f'<rect x="{x}" y="{y}" width="15" height="22" rx="2.5" fill="{PLACEMAT}" stroke="{INK}" stroke-width="1.4"/>'
            f'<rect x="{x + 2}" y="{y + 2}" width="11" height="18" rx="1.5" fill="none" stroke="{C["yellow"]}" stroke-width="1" stroke-dasharray="2.4 1.6"/></g>')


def table_deck():
    """Tricks-won icon: a squared deck lying on the table, seen from the front,
    so it reads flat and wide next to the hand icon's upright fan."""
    return (f'<g stroke-linejoin="round">'
            f'<rect x="6" y="18" width="28" height="13" rx="1.5" fill="{PAPER}" stroke="{INK}" stroke-width="1.4"/>'
            f'<path d="M6.8 22.5H33.2M6.8 26.8H33.2" stroke="{INK}" stroke-width="1" opacity=".55"/>'
            f'<path d="M10 9H30L34 18H6Z" fill="{PLACEMAT}" stroke="{INK}" stroke-width="1.4"/>'
            f'<path d="M15 11.5H25M13.5 15H26.5" stroke="{C["yellow"]}" stroke-width="1" stroke-dasharray="2 1.4"/></g>')


def icon(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="3 3 34 34">{body}</svg>\n'


# ===== Dog dash and Dragon flight sprites (facing right, two frames) =====
def dog_run(a):
    return svg(f'<g transform="translate(100 {2 if a else 6}) scale(-1 1)">{biskit(48, 62, 1 if a else -1)}</g>', seed=17)


def dog_back(a):  # walking away: rump, ears and a wagging tail
    sway = 6 if a else -6
    return svg(f'<path d="M50 60 Q{56 + sway} 44 {52 + sway} 30" fill="none" stroke="{C["brown"]}" stroke-width="4"/>'
               f'<path d="M36 80 L34 96 M64 80 L66 96" stroke="{C["brown"]}" stroke-width="4"/>'
               f'<ellipse cx="50" cy="70" rx="22" ry="20" fill="{F("tan")}" stroke-width="2.6"/>'
               f'<circle cx="50" cy="40" r="15" fill="{F("tan")}" stroke-width="2.6"/>'
               f'<path d="M36 32 Q26 40 30 54 Q36 50 38 40 Z M64 32 Q74 40 70 54 Q64 50 62 40 Z" fill="{F("brown")}" stroke-width="2"/>', seed=19)


def dog_front(a):  # trotting toward you, bobbing
    bob = 3 if a else -3
    return svg(f'<g transform="translate(0 {bob})">'
               f'<path d="M38 74 L36 96 M62 74 L64 96" stroke="{C["brown"]}" stroke-width="4"/>'
               f'<ellipse cx="50" cy="72" rx="20" ry="18" fill="{F("tan")}" stroke-width="2.6"/>'
               f'<circle cx="50" cy="42" r="18" fill="{F("tan")}" stroke-width="2.6"/>'
               f'<path d="M34 30 Q22 40 26 58 Q34 54 36 42 Z M66 30 Q78 40 74 58 Q66 54 64 42 Z" fill="{F("brown")}" stroke-width="2"/>'
               f'<circle cx="43" cy="40" r="2.4" fill="{INK}" stroke="none"/><circle cx="57" cy="40" r="2.4" fill="{INK}" stroke="none"/>'
               f'<ellipse cx="50" cy="48" rx="3.6" ry="2.6" fill="{INK}" stroke="none"/>'
               f'<path d="M43 53 Q50 59 57 53" fill="none" stroke-width="2"/>'
               f'<path d="M48 56 Q50 64 54 58" fill="{C["pink"]}" stroke-width="1.4"/></g>', seed=23)


def dog_lie():  # flopped over, full of pie
    return svg(f'<g transform="translate(-2 14)">{biskit(52, 64, 0, happy=True)}</g>'
               + words(80, 26, 'Z Z', 14, C['blue'], -10), seed=29)


def dragon_fly(up):
    return svg(f'<g transform="translate(2 4) scale(.94)">{dragon_body(up)}</g>', seed=31)


ART = {
    **{f'suit-{s}': svg(fn(4)) for s, fn in SYMBOLS.items()},
    **{f'pip-{s}': svg(fn(4.5)) for s, fn in SYMBOLS.items()},
    **{f'royal-{r}-{s}': court(r, s) for r in 'JQK' for s in SYMBOLS},
    'mahjong': mahjong(), 'dog': dog(), 'phoenix': phoenix(), 'dragon': dragon(),
    'back': back(),
    'icon-hand': icon(''.join(mini_back(12.5, 9, r) for r in (-24, 0, 24))),
    'icon-tricks': icon(table_deck()),
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
        with open(os.path.join(out, f'{name}.svg'), 'w') as fh:
            fh.write(content)
    print('wrote', len(ART))
