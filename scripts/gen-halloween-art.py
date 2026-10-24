"""Generate the Halloween theme's card art into client/public/cards/halloween/.

Same file names as the papercraft set (scripts/gen-card-art.py), so the
client just switches folders (client/src/theme.ts cardArt). Flat cut-paper
shapes with a dark ink outline; spooky but friendly. The four suits become
a jack-o'-lantern (star), a bubbling cauldron (jade), a haunted house
(pagoda) and a bat (sword), in four clearly different colours.

    python3 scripts/gen-halloween-art.py client/public/cards/halloween
"""
import math, os, sys

INK = '#1E1428'
BONE, BONE_DK = '#F4EBDA', '#C9B99C'
WHITE = '#FFFFFF'
NIGHT, NIGHT_LT = '#2C1E3E', '#45305E'
MOON = '#FFE9A8'
PUMPKIN, PUMPKIN_DK, PUMPKIN_LT = '#F2851F', '#B95A0E', '#FFB15E'
SLIME, SLIME_DK, SLIME_LT = '#6CC24A', '#3F8A2A', '#A6E67F'
HAUNT, HAUNT_DK, HAUNT_LT = '#8E5CD9', '#5B3A9A', '#C4A2F2'
BAT, BAT_LT = '#2E2638', '#5E536B'
BLOOD = '#C2352B'
GLOW = '#FFD54A'
SKIN = '#E8F0D8'          # pale undead complexion
SUIT = {  # robe / accent colour per suit, for the court cards
    'star': (PUMPKIN, PUMPKIN_DK), 'jade': (SLIME, SLIME_DK), 'pagoda': (HAUNT, HAUNT_DK), 'sword': (BAT_LT, BAT),
}


def svg(body, vb='0 0 100 100'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">'
            f'<g stroke="{INK}" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n')


# ===== Suit symbols =====
def pumpkin(sw=4):
    ribs = ''.join(f'<ellipse cx="{x}" cy="58" rx="{rx}" ry="34" fill="{PUMPKIN}" stroke-width="{sw}"/>'
                   for x, rx in ((30, 20), (70, 20), (50, 22)))
    return (f'<path d="M48 24 Q46 12 54 6 L59 10 Q53 16 55 26 Z" fill="{SLIME_DK}" stroke-width="{sw * .8}"/>'
            + ribs +
            f'<path d="M30 50 L40 42 L42 54 Z M70 50 L60 42 L58 54 Z" fill="{GLOW}" stroke-width="{sw * .6}"/>'
            f'<path d="M30 66 Q50 80 70 66 L64 70 L60 64 L55 71 L50 65 L45 71 L40 64 L36 70 Z" fill="{GLOW}" stroke-width="{sw * .6}"/>')


def cauldron(sw=4):
    return (f'<circle cx="34" cy="20" r="7" fill="{SLIME_LT}" stroke-width="{sw * .6}"/>'
            f'<circle cx="60" cy="13" r="5" fill="{SLIME_LT}" stroke-width="{sw * .6}"/>'
            f'<path d="M14 40 Q14 92 50 92 Q86 92 86 40 Z" fill="{BAT}" stroke-width="{sw}"/>'
            f'<path d="M22 84 L18 96 M78 84 L82 96" stroke-width="{sw * 1.4}"/>'
            f'<path d="M12 38 Q30 26 50 34 Q70 26 88 38 Q88 46 50 46 Q12 46 12 38 Z" fill="{SLIME}" stroke-width="{sw}"/>'
            f'<path d="M30 46 Q30 58 35 58 Q40 58 39 46 M60 46 Q61 54 65 54 Q69 54 68 46" fill="{SLIME}" stroke-width="{sw * .7}"/>'
            f'<path d="M24 60 Q30 74 44 80" fill="none" stroke="{BAT_LT}" stroke-width="{sw}"/>')


def haunted_house(sw=4):
    return (f'<path d="M22 46 L22 94 L78 94 L78 46 Z" fill="{HAUNT}" stroke-width="{sw}"/>'
            f'<path d="M12 50 L50 12 L88 50 Z" fill="{HAUNT_DK}" stroke-width="{sw}"/>'
            f'<path d="M64 26 L64 12 L72 12 L72 34" fill="{HAUNT_DK}" stroke-width="{sw}"/>'
            f'<rect x="31" y="56" width="13" height="13" fill="{GLOW}" stroke-width="{sw * .6}"/>'
            f'<rect x="56" y="56" width="13" height="13" fill="{GLOW}" stroke-width="{sw * .6}"/>'
            f'<path d="M43 94 L43 80 Q50 72 57 80 L57 94 Z" fill="{BAT}" stroke-width="{sw * .6}"/>'
            f'<circle cx="50" cy="36" r="5" fill="{GLOW}" stroke-width="{sw * .5}"/>')


def bat(sw=4):
    # Wings swept up in a V so the bat fills its square about as tall as the
    # other suits (a flat wingspan read as a thin dark dash at pip size), with
    # lighter wing ribs so it doesn't go to a solid blot on bone card stock.
    return (f'<path d="M50 42 Q36 32 22 22 Q12 16 4 10 Q7 30 12 48 Q18 45 23 53 Q29 49 33 59 Q39 55 43 65 Q47 61 50 67 '
            f'Q53 61 57 65 Q61 55 67 59 Q71 49 77 53 Q82 45 88 48 Q93 30 96 10 Q88 16 78 22 Q64 32 50 42 Z" fill="{BAT}" stroke-width="{sw * .7}"/>'
            f'<path d="M43 47 Q30 36 13 20 M42 52 Q32 49 23 51 M57 47 Q70 36 87 20 M58 52 Q68 49 77 51" fill="none" stroke="{BAT_LT}" stroke-width="{sw * .55}"/>'
            f'<ellipse cx="50" cy="58" rx="9" ry="13" fill="{BAT}" stroke-width="{sw * .7}"/>'
            f'<path d="M40 38 L39 22 L46.5 31 Q50 30 53.5 31 L61 22 L60 38 Q61 50 50 51 Q39 50 40 38 Z" fill="{BAT}" stroke-width="{sw * .7}"/>'
            f'<circle cx="45.5" cy="38.5" r="3" fill="{GLOW}" stroke="none"/><circle cx="54.5" cy="38.5" r="3" fill="{GLOW}" stroke="none"/>'
            f'<path d="M47 45 L48 48.5 L49 45 M51 45 L52 48.5 L53 45" fill="{WHITE}" stroke="{WHITE}" stroke-width="1.2"/>')


SYMBOLS = {'star': pumpkin, 'jade': cauldron, 'pagoda': haunted_house, 'sword': bat}


# ===== Court cards (100x150 portraits, cropped to a 2:3 frame) =====
def backdrop(suit):
    acc = SUIT[suit][0]
    return (f'<rect width="100" height="150" fill="{NIGHT}"/>'
            f'<circle cx="78" cy="26" r="15" fill="{MOON}" stroke="none" opacity=".9"/>'
            f'<circle cx="84" cy="22" r="13" fill="{NIGHT}" stroke="none"/>'
            + ''.join(f'<circle cx="{x}" cy="{y}" r="1.3" fill="{WHITE}" stroke="none" opacity=".7"/>' for x, y in ((14, 16), (30, 34), (90, 60), (8, 70)))
            + f'<path d="M0 150 L0 132 Q50 118 100 132 L100 150 Z" fill="{acc}" stroke="none" opacity=".25"/>')


def emblem(suit, x=37, y=118, s=.26):
    return f'<g transform="translate({x} {y}) scale({s})">{SYMBOLS[suit](5)}</g>'


def eyes(cx, cy, r=3.4, glint=True):
    return ''.join(f'<circle cx="{x}" cy="{cy}" r="{r}" fill="{INK}" stroke="none"/>'
                   + (f'<circle cx="{x + 1}" cy="{cy - 1.2}" r="1.1" fill="{WHITE}" stroke="none"/>' if glint else '')
                   for x in (cx - 10, cx + 10))


def vampire(suit):  # Jack: slicked widow's-peak hair, high collar, tiny fangs
    acc, acc_dk = SUIT[suit]
    return svg(
        backdrop(suit)
        + f'<path d="M8 150 L16 104 Q50 92 84 104 L92 150 Z" fill="{BAT}" stroke-width="3"/>'
        f'<path d="M22 104 L14 78 L40 98 Z M78 104 L86 78 L60 98 Z" fill="{acc}" stroke-width="3"/>'  # collar, suit-lined
        f'<path d="M36 150 L40 104 L60 104 L64 150 Z" fill="{WHITE}" stroke-width="3"/>'
        f'<path d="M44 104 L50 116 L56 104 Z" fill="{BLOOD}" stroke-width="2.5"/>'
        f'<ellipse cx="50" cy="66" rx="25" ry="29" fill="{SKIN}" stroke-width="3.5"/>'
        f'<path d="M25 64 Q22 34 50 32 Q78 34 75 64 Q70 46 58 44 L50 56 L42 44 Q30 46 25 64 Z" fill="{BAT}" stroke-width="3.5"/>'
        + eyes(50, 68) +
        f'<path d="M38 60 L46 62 M62 60 L54 62" stroke-width="2.5"/>'
        f'<path d="M42 80 Q50 86 58 80" fill="none" stroke-width="2.4"/>'
        f'<path d="M44 81 L45.5 86 L47 82 M53 82 L54.5 86 L56 81" fill="{WHITE}" stroke-width="1.4"/>'
        + emblem(suit),
        '0 0 100 150')


def witch(suit):  # Queen: tall bent hat with a suit band, long hair, little smile
    acc, acc_dk = SUIT[suit]
    return svg(
        backdrop(suit)
        + f'<path d="M22 150 L20 70 Q50 60 80 70 L78 150 Z" fill="{HAUNT_DK if suit != "pagoda" else PUMPKIN_DK}" stroke-width="3"/>'  # hair
        + f'<path d="M12 150 Q14 104 50 100 Q86 104 88 150 Z" fill="{acc}" stroke-width="3"/>'
        f'<ellipse cx="50" cy="72" rx="24" ry="27" fill="{SKIN}" stroke-width="3.5"/>'
        f'<path d="M26 66 Q34 52 50 56 Q66 52 74 66 Q66 58 50 62 Q34 58 26 66 Z" fill="{HAUNT_DK if suit != "pagoda" else PUMPKIN_DK}" stroke-width="3"/>'
        + eyes(50, 74) +
        f'<path d="M43 85 Q50 90 57 85" fill="none" stroke-width="2.4"/>'
        f'<circle cx="35" cy="81" r="3.5" fill="{BLOOD}" stroke="none" opacity=".3"/><circle cx="65" cy="81" r="3.5" fill="{BLOOD}" stroke="none" opacity=".3"/>'
        f'<path d="M10 54 Q50 40 90 54 Q50 64 10 54 Z" fill="{BAT}" stroke-width="3"/>'               # brim
        f'<path d="M30 52 L50 6 Q58 2 70 16 Q60 14 58 20 L70 50 Z" fill="{BAT}" stroke-width="3"/>'   # crooked cone
        f'<path d="M31 48 Q50 54 69 47 L67 41 Q50 47 34 42 Z" fill="{acc}" stroke-width="2.5"/>'      # band
        + emblem(suit),
        '0 0 100 150')


def skeleton_king(suit):  # King: friendly skull, crown, robe in the suit colour
    acc, acc_dk = SUIT[suit]
    teeth = ''.join(f'<path d="M{x} 86 L{x} 92" stroke-width="1.6"/>' for x in (44, 48, 52, 56))
    return svg(
        backdrop(suit)
        + f'<path d="M10 150 Q12 102 50 98 Q88 102 90 150 Z" fill="{acc}" stroke-width="3"/>'
        f'<path d="M30 102 Q50 116 70 102" fill="none" stroke="{WHITE}" stroke-width="5"/>'           # ermine trim
        f'<path d="M30 102 Q50 116 70 102" fill="none" stroke-width="1.5" stroke-dasharray="2 5"/>'
        f'<path d="M26 66 Q26 38 50 38 Q74 38 74 66 Q74 80 64 84 L64 92 Q50 98 36 92 L36 84 Q26 80 26 66 Z" fill="{BONE}" stroke-width="3.5"/>'
        f'<ellipse cx="40" cy="66" rx="7" ry="8" fill="{INK}" stroke="none"/><ellipse cx="60" cy="66" rx="7" ry="8" fill="{INK}" stroke="none"/>'
        f'<circle cx="41.5" cy="64" r="2" fill="{GLOW}" stroke="none"/><circle cx="61.5" cy="64" r="2" fill="{GLOW}" stroke="none"/>'
        f'<path d="M50 74 L46.5 80 L53.5 80 Z" fill="{INK}" stroke="none"/>'
        + teeth +
        f'<path d="M28 44 L30 22 L40 34 L50 16 L60 34 L70 22 L72 44 Q50 38 28 44 Z" fill="{GLOW}" stroke-width="3"/>'
        f'<circle cx="50" cy="32" r="3.6" fill="{acc}" stroke-width="1.5"/>'
        + emblem(suit),
        '0 0 100 150')


# ===== Specials =====
def owl():  # Mah Jong: a round owl on a crooked branch
    return svg(
        f'<path d="M2 84 Q40 76 98 82" fill="none" stroke-width="8"/><path d="M2 84 Q40 76 98 82" fill="none" stroke="{BAT_LT}" stroke-width="4.5"/>'
        f'<ellipse cx="50" cy="52" rx="28" ry="32" fill="{HAUNT_DK}" stroke-width="4"/>'
        f'<path d="M22 30 L30 14 L40 28 M78 30 L70 14 L60 28" fill="{HAUNT_DK}" stroke-width="3.5"/>'
        f'<ellipse cx="50" cy="62" rx="16" ry="18" fill="{HAUNT_LT}" stroke-width="2.5"/>'
        f'<circle cx="38" cy="40" r="11" fill="{GLOW}" stroke-width="3"/><circle cx="62" cy="40" r="11" fill="{GLOW}" stroke-width="3"/>'
        f'<circle cx="38" cy="40" r="5" fill="{INK}" stroke="none"/><circle cx="62" cy="40" r="5" fill="{INK}" stroke="none"/>'
        f'<circle cx="39.5" cy="38.5" r="1.6" fill="{WHITE}" stroke="none"/><circle cx="63.5" cy="38.5" r="1.6" fill="{WHITE}" stroke="none"/>'
        f'<path d="M46 50 L50 57 L54 50 Z" fill="{PUMPKIN}" stroke-width="2.5"/>'
        f'<path d="M40 82 L38 88 M46 83 L46 89 M54 83 L54 89 M60 82 L62 88" stroke="{PUMPKIN_DK}" stroke-width="3"/>')


def ghost_dog_body(cx=50, cy=54, legs=None, face=True, happy=False):
    tail = f'<path d="M{cx - 30} {cy + 6} Q{cx - 44} {cy - 4} {cx - 40} {cy - 18} Q{cx - 34} {cy - 6} {cx - 26} {cy - 2}" fill="{WHITE}" stroke-width="3.5"/>'
    body = (f'<path d="M{cx - 30} {cy - 6} Q{cx - 30} {cy - 22} {cx - 10} {cy - 22} L{cx + 14} {cy - 22} Q{cx + 30} {cy - 22} {cx + 30} {cy - 4} '
            f'L{cx + 30} {cy + 16} Q{cx + 24} {cy + 24} {cx + 18} {cy + 16} Q{cx + 10} {cy + 26} {cx + 2} {cy + 16} '
            f'Q{cx - 6} {cy + 26} {cx - 14} {cy + 16} Q{cx - 22} {cy + 24} {cx - 30} {cy + 16} Z" fill="{WHITE}" stroke-width="3.5"/>')
    head = (f'<path d="M{cx + 14} {cy - 30} Q{cx + 8} {cy - 50} {cx + 20} {cy - 44} Z" fill="{WHITE}" stroke-width="3"/>'
            f'<ellipse cx="{cx + 26}" cy="{cy - 24}" rx="18" ry="16" fill="{WHITE}" stroke-width="3.5"/>'
            f'<path d="M{cx + 36} {cy - 38} Q{cx + 46} {cy - 46} {cx + 44} {cy - 30} Z" fill="{WHITE}" stroke-width="3"/>'
            f'<circle cx="{cx + 42}" cy="{cy - 20}" r="4" fill="{PUMPKIN}" stroke-width="2"/>')        # jack-o'-lantern nose
    eyes_ = (f'<path d="M{cx + 18} {cy - 26} Q{cx + 21} {cy - 30} {cx + 24} {cy - 26} M{cx + 30} {cy - 26} Q{cx + 33} {cy - 30} {cx + 36} {cy - 26}" fill="none" stroke-width="2.4"/>'
             if happy else f'<ellipse cx="{cx + 21}" cy="{cy - 26}" rx="3" ry="4" fill="{INK}" stroke="none"/><ellipse cx="{cx + 33}" cy="{cy - 26}" rx="3" ry="4" fill="{INK}" stroke="none"/>')
    collar = f'<path d="M{cx + 10} {cy - 12} Q{cx + 24} {cy - 4} {cx + 38} {cy - 12}" fill="none" stroke="{PUMPKIN}" stroke-width="4.5"/>'
    return tail + body + head + (eyes_ if face else '') + collar


def ghost_dog():
    return svg(f'<g transform="translate(-6 8)">{ghost_dog_body()}</g>')


def phoenix():  # the undead phoenix: a bone bird reborn in green ghost-fire
    fire = lambda d: (f'<path d="M50 60 Q{50 + 30 * d} 64 {50 + 46 * d} 40 Q{50 + 46 * d} 22 {50 + 40 * d} 8 Q{50 + 34 * d} 22 {50 + 26 * d} 20 '
                      f'Q{50 + 30 * d} 10 {50 + 22 * d} 4 Q{50 + 18 * d} 22 {50 + 10 * d} 30 Z" fill="{SLIME}" stroke="{SLIME_DK}" stroke-width="2.5"/>')
    bone = lambda x1, y1, x2, y2: (f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{INK}" stroke-width="6.5"/>'
                                   f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{BONE}" stroke-width="4"/>'
                                   f'<circle cx="{x2}" cy="{y2}" r="3.2" fill="{BONE}" stroke-width="1.5"/>')
    wing = lambda d: ''.join(bone(50 + 8 * d, 46, 50 + x * d, y) for x, y in ((40, 18), (36, 30), (30, 40)))
    tail = (f'<path d="M42 70 Q30 86 36 96 Q42 88 50 96 Q58 88 64 96 Q70 86 58 70 Z" fill="{SLIME}" stroke="{SLIME_DK}" stroke-width="2.5"/>'
            f'<path d="M46 72 Q42 84 50 90 Q58 84 54 72 Z" fill="{SLIME_LT}" stroke="none"/>')
    ribs = ''.join(f'<path d="M41 {50 + 6 * k} Q50 {55 + 6 * k} 59 {50 + 6 * k}" fill="none" stroke="{INK}" stroke-width="5.5"/>'
                   f'<path d="M41 {50 + 6 * k} Q50 {55 + 6 * k} 59 {50 + 6 * k}" fill="none" stroke="{BONE}" stroke-width="3"/>' for k in range(3))
    skull = (f'<path d="M38 30 Q38 16 50 16 Q62 16 62 30 Q62 37 55 39 L45 39 Q38 37 38 30 Z" fill="{BONE}" stroke-width="2.8"/>'
             f'<circle cx="45" cy="29" r="3.6" fill="{SLIME_LT}" stroke-width="1.6"/><circle cx="55" cy="29" r="3.6" fill="{SLIME_LT}" stroke-width="1.6"/>'
             f'<path d="M47 39 L50 46 L53 39 Z" fill="{BONE_DK}" stroke-width="1.6"/>'
             f'<path d="M44 16 Q46 6 50 12 Q54 6 56 16" fill="{SLIME}" stroke="{SLIME_DK}" stroke-width="2"/>')
    return svg(fire(-1) + fire(1) + tail + wing(-1) + wing(1)
               + f'<path d="M50 42 L50 70" stroke="{INK}" stroke-width="6.5"/><path d="M50 42 L50 70" stroke="{BONE}" stroke-width="4"/>' + ribs + skull)


def dragon_body(cx=50, cy=56, wings_up=True):
    wy = -20 if wings_up else 4
    wing = lambda d: (f'<path d="M{cx + 12 * d} {cy - 10} Q{cx + 34 * d} {cy - 14 + wy} {cx + 46 * d} {cy - 8 + wy} '
                      f'Q{cx + 40 * d} {cy - 2 + wy * .5} {cx + 42 * d} {cy + 4 + wy * .3} Q{cx + 32 * d} {cy - 2} {cx + 30 * d} {cy + 6} '
                      f'Q{cx + 22 * d} {cy - 2} {cx + 16 * d} {cy + 4} Z" fill="{BAT}" stroke-width="3"/>')
    return (wing(-1) + wing(1)
            + f'<ellipse cx="{cx}" cy="{cy + 6}" rx="22" ry="24" fill="{SLIME}" stroke-width="4"/>'
            f'<ellipse cx="{cx}" cy="{cy + 14}" rx="12" ry="14" fill="{SLIME_LT}" stroke-width="2"/>'
            f'<ellipse cx="{cx}" cy="{cy - 22}" rx="20" ry="17" fill="{SLIME}" stroke-width="4"/>'
            f'<path d="M{cx - 12} {cy - 34} L{cx - 16} {cy - 48} L{cx - 4} {cy - 38} M{cx + 12} {cy - 34} L{cx + 16} {cy - 48} L{cx + 4} {cy - 38}" fill="{BONE}" stroke-width="3"/>'
            f'<ellipse cx="{cx - 8}" cy="{cy - 24}" rx="4.5" ry="5.5" fill="{GLOW}" stroke-width="2"/><ellipse cx="{cx + 8}" cy="{cy - 24}" rx="4.5" ry="5.5" fill="{GLOW}" stroke-width="2"/>'
            f'<path d="M{cx - 8} {cy - 27} L{cx - 8} {cy - 21} M{cx + 8} {cy - 27} L{cx + 8} {cy - 21}" stroke-width="2.4"/>'
            f'<path d="M{cx - 8} {cy - 13} Q{cx} {cy - 8} {cx + 8} {cy - 13}" fill="none" stroke-width="2.4"/>'
            f'<path d="M{cx - 5} {cy - 12} L{cx - 3.5} {cy - 8} L{cx - 2} {cy - 11} M{cx + 2} {cy - 11} L{cx + 3.5} {cy - 8} L{cx + 5} {cy - 12}" fill="{WHITE}" stroke-width="1.2"/>')


def dragon():
    return svg(dragon_body(50, 58, True))


# ===== Card back and icons =====
def web(cx, cy, r, a0):
    spokes = ''.join(f'<path d="M{cx} {cy} L{cx + r * math.cos(math.radians(a0 + k * 22.5)):.1f} {cy + r * math.sin(math.radians(a0 + k * 22.5)):.1f}"/>' for k in range(5))
    rings = ''
    for rr in (r * .35, r * .65, r * .95):
        pts = [(cx + rr * math.cos(math.radians(a0 + k * 22.5)), cy + rr * math.sin(math.radians(a0 + k * 22.5))) for k in range(5)]
        rings += '<path d="M' + ' Q'.join(
            f'{(pts[i][0] + pts[i + 1][0]) / 2 * .9 + cx * .1:.1f} {(pts[i][1] + pts[i + 1][1]) / 2 * .9 + cy * .1:.1f} {pts[i + 1][0]:.1f} {pts[i + 1][1]:.1f}'
            if i else f'{pts[0][0]:.1f} {pts[0][1]:.1f}' for i in range(4)) + '"/>'
    return f'<g fill="none" stroke="{HAUNT_LT}" stroke-width="1" opacity=".55">{spokes}{rings}</g>'


def back():
    bats = ''.join(f'<g transform="translate({x} {y}) scale({s})">{bat(5)}</g>' for x, y, s in ((24, 40, .16), (60, 30, .12), (66, 104, .14)))
    return svg(
        f'<rect width="100" height="150" fill="{NIGHT}" stroke="none"/>'
        f'<rect x="6" y="6" width="88" height="138" rx="8" fill="{NIGHT_LT}" stroke="{PUMPKIN}" stroke-width="2.5"/>'
        + web(8, 8, 34, 0) + web(92, 142, 34, 180)
        + f'<circle cx="50" cy="75" r="22" fill="{MOON}" stroke="{PUMPKIN_DK}" stroke-width="2"/>'
        f'<circle cx="43" cy="69" r="4" fill="{BONE_DK}" stroke="none" opacity=".5"/><circle cx="57" cy="83" r="3" fill="{BONE_DK}" stroke="none" opacity=".5"/>'
        f'<g transform="translate(35 64) scale(.3)">{bat(5)}</g>' + bats,
        '0 0 100 150')


def mini_back(x, y, rot=0, cx=20, cy=36):
    return (f'<g transform="rotate({rot} {cx} {cy})">'
            f'<rect x="{x}" y="{y}" width="15" height="22" rx="2.5" fill="{NIGHT_LT}" stroke="{PUMPKIN}" stroke-width="1.6"/>'
            f'<circle cx="{x + 7.5}" cy="{y + 11}" r="3.4" fill="{MOON}" stroke="none"/></g>')


def icon(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="3 3 34 34">{body}</svg>\n'


# ===== Dog dash and Dragon flight sprites (facing right, two frames) =====
def dog_run(a):  # the ghost dog floats; its wavy hem and tail swish between frames
    return svg(f'<g transform="translate(-4 {6 if a else 2})">{ghost_dog_body(46, 58)}</g>')


def dog_back(a):
    sway = 4 if a else -4
    return svg(
        f'<path d="M30 40 Q30 20 50 20 Q70 20 70 40 L70 74 Q64 82 58 74 Q52 84 46 74 Q40 82 34 74 Q30 80 30 74 Z" fill="{WHITE}" stroke-width="3.5"/>'
        f'<path d="M34 24 Q28 6 42 16 Z M66 24 Q72 6 58 16 Z" fill="{WHITE}" stroke-width="3"/>'
        f'<path d="M50 70 Q{58 + sway} 82 {54 + sway} 92" fill="none" stroke-width="7"/><path d="M50 70 Q{58 + sway} 82 {54 + sway} 92" fill="none" stroke="{WHITE}" stroke-width="3.5"/>'
        f'<path d="M34 46 Q50 54 66 46" fill="none" stroke="{PUMPKIN}" stroke-width="4.5"/>')


def dog_front(a):
    bob = 3 if a else -3
    return svg(
        f'<g transform="translate(0 {bob})">'
        f'<path d="M30 48 L30 80 Q36 88 42 80 Q50 90 58 80 Q64 88 70 80 L70 48 Z" fill="{WHITE}" stroke-width="3.5"/>'
        f'<path d="M30 30 Q24 8 40 18 Z M70 30 Q76 8 60 18 Z" fill="{WHITE}" stroke-width="3"/>'
        f'<ellipse cx="50" cy="36" rx="22" ry="19" fill="{WHITE}" stroke-width="3.5"/>'
        f'<ellipse cx="42" cy="34" rx="3" ry="4" fill="{INK}" stroke="none"/><ellipse cx="58" cy="34" rx="3" ry="4" fill="{INK}" stroke="none"/>'
        f'<circle cx="50" cy="44" r="4" fill="{PUMPKIN}" stroke-width="2"/>'
        f'<path d="M34 56 Q50 64 66 56" fill="none" stroke="{PUMPKIN}" stroke-width="4.5"/></g>')


def dog_lie():
    return svg(f'<g transform="translate(-4 18) scale(1 .85)">{ghost_dog_body(46, 58, happy=True)}</g>'
               f'<path d="M78 20 L84 20 L78 26 L84 26 M86 10 L90 10 L86 14 L90 14" fill="none" stroke="{HAUNT_LT}" stroke-width="2"/>')  # zz


def dragon_fly(up):
    return svg(f'<g transform="translate(6 2) scale(.9) rotate(8 50 56)">{dragon_body(50, 58, up)}</g>'
               f'<path d="M30 80 Q12 86 8 72 Q16 76 22 72" fill="{SLIME}" stroke-width="3"/>')


ART = {
    **{f'suit-{s}': svg(f(4)) for s, f in SYMBOLS.items()},
    **{f'pip-{s}': svg(f(6)) for s, f in SYMBOLS.items()},
    **{f'royal-J-{s}': vampire(s) for s in SYMBOLS},
    **{f'royal-Q-{s}': witch(s) for s in SYMBOLS},
    **{f'royal-K-{s}': skeleton_king(s) for s in SYMBOLS},
    'mahjong': owl(), 'dog': ghost_dog(), 'phoenix': phoenix(), 'dragon': dragon(),
    'back': back(),
    'icon-hand': icon(''.join(mini_back(12.5, 9, r) for r in (-24, 0, 24))),
    'icon-tricks': icon(''.join(mini_back(9 + 4 * i, 5 + 4 * i) for i in range(3))),
    'anim-doodle-run-1': dog_run(True), 'anim-doodle-run-2': dog_run(False),
    'anim-doodle-back-1': dog_back(True), 'anim-doodle-back-2': dog_back(False),
    'anim-doodle-front-1': dog_front(True), 'anim-doodle-front-2': dog_front(False),
    'anim-doodle-lie': dog_lie(),
    'anim-dragon-fly-1': dragon_fly(True), 'anim-dragon-fly-2': dragon_fly(False),
}

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for name, content in ART.items():
    open(os.path.join(out, f'{name}.svg'), 'w').write(content)
print('wrote', len(ART))
