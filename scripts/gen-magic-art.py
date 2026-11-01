"""Generate the Magic theme's vector art into client/public/cards/magic/.

The cards themselves are painted full-face WebPs (one per card, five suits of
which each game deals four, drawn whole by Card.tsx), so this only makes what
sits around them, under the papercraft file names that client/src/theme.ts
cardArt() looks up: the card back, the seat-panel icons, and the Dog-dash /
Dragon-flight animation frames.

Everything follows the painted cards' storybook watercolour: fine sepia ink
lines that wobble slightly (an SVG displacement filter), soft washed-out
colour, and cream parchment stock with a dark green keyline.

- Dog: the Dog card's golden retriever, tongue out, with the two fairies that
  flit around it. The profile body reuses the Classic Baroque rig
  (scripts/gen-baroque-art.py) with a retriever's floppy ear and plumed tail.
- Dragon: the Dragon card's five-headed dragon, a golden body and bat wings
  with one head per realm (green, red, blue, black, white), wings beating
  between the two frames.
- Back and icons: the Mah Jong card's black lotus on parchment, ringed by the
  five realms' colours.

    python3 scripts/gen-magic-art.py client/public/cards/magic
"""
import importlib.util
import math
import os
import re
import sys

_spec = importlib.util.spec_from_file_location('baroque', os.path.join(os.path.dirname(__file__), 'gen-baroque-art.py'))
B = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(B)
f = B.f

SEPIA = '#5B4636'
PARCH, PARCH_DK = '#FBF5E6', '#EFE3C6'
FRAME = '#1F4A3A'          # the cards' dark green keyline
GOLD, GOLD_LT, GOLD_DK = '#D9AE52', '#F2D894', '#A8803A'
LOTUS, LOTUS_DK, LOTUS_LT = '#3A3048', '#221B2C', '#6B5A86'
PAD, PAD_DK = '#7FA88A', '#4F7A60'
# The five realms, as the five heads of the Dragon card.
REALM_COLOURS = {'white': '#F1ECE2', 'blue': '#5B86C4', 'black': '#4A4250', 'red': '#D2553F', 'green': '#5E9E6E'}

# A watercolour edge: lines and fills wobble a touch, as if inked by hand.
WOBBLE = ('<filter id="wc" x="-5%" y="-5%" width="110%" height="110%">'
          '<feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="4" result="n"/>'
          '<feDisplacementMap in="SourceGraphic" in2="n" scale="1.1" xChannelSelector="R" yChannelSelector="G"/></filter>')


def wc_svg(body, vb='0 0 100 100', stroke_scale=1.0):
    """Wrap drawing code in a sepia-inked, slightly wobbly watercolour SVG.
    `stroke_scale` thins the outlines of rigs drawn for the bolder themes."""
    if stroke_scale != 1.0:
        body = re.sub(r'stroke-width="([\d.]+)"', lambda m: f'stroke-width="{float(m.group(1)) * stroke_scale:.2f}"', body)
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><defs>{WOBBLE}</defs>'
            f'<g filter="url(#wc)" stroke="{SEPIA}" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n')


# ===== Golden retriever (Dog dash) =====
B.INK = SEPIA
B.FUR, B.FUR_DK, B.FUR_LT = '#E8B36A', '#C08440', '#F6D49C'
B.CREAM = '#FBEBD0'


def floppy_ear(cx, cy, s, fill):
    p = lambda x, y: f'{f(cx + x * s)} {f(cy + y * s)}'
    return (f'<path d="M{p(-8, -10)} Q{p(-2, -14)} {p(2, -9)} Q{p(1, 2)} {p(-5, 9)} Q{p(-12, 9)} {p(-12, 0)} '
            f'Q{p(-12, -7)} {p(-8, -10)} Z" fill="{fill}" stroke-width="2.4"/>')


def retriever_head(cx, cy, s=1.0, happy=False):
    """The shiba's profile head with its three pricked-ear paths (the first
    three it draws) swapped for a floppy ear, and a tongue lolling out."""
    head = B._shiba_head(cx, cy, s, happy)
    skull_at = head.index('<path', head.index('<path', head.index('<path', 1) + 1) + 1)
    p = lambda x, y: f'{f(cx + x * s)} {f(cy + y * s)}'
    tongue = f'<path d="M{p(13, 7)} Q{p(16, 15)} {p(19, 13)} Q{p(20, 9)} {p(18, 7)} Z" fill="#EE8A8E" stroke-width="1.6"/>'
    return tongue + head[skull_at:] + floppy_ear(cx, cy, s, B.FUR_DK)


def plume_tail(cx, cy, s=0.8):
    """A retriever's feathered tail streaming out behind."""
    p = lambda x, y: f'{f(cx + x * s)} {f(cy + y * s)}'
    return (f'<path d="M{p(4, 4)} Q{p(-8, -2)} {p(-20, -10)} Q{p(-16, -2)} {p(-22, 2)} Q{p(-12, 4)} {p(-18, 9)} '
            f'Q{p(-6, 10)} {p(4, 10)} Z" fill="{B.FUR_LT}" stroke-width="2.2"/>'
            f'<path d="M{p(0, 6)} Q{p(-8, 3)} {p(-15, -3)}" fill="none" stroke="{B.FUR}" stroke-width="1.6"/>')


B._shiba_head = B.shiba_head
B.shiba_head = retriever_head
B.curl_tail = plume_tail


def fairy(x, y, flap, wing_col, dress, s=1.0):
    """A tiny fairy: translucent wings that open and close, a dress, a head
    of hair, and a trail of sparkles."""
    p = lambda dx, dy: f'{f(x + dx * s)} {f(y + dy * s)}'
    spread = 1 if flap else .45
    wings = (f'<path d="M{p(0, 0)} Q{p(-7 * spread - 2, -9)} {p(-9 * spread - 1, -3)} Q{p(-5 * spread, 2)} {p(0, 0)} Z" fill="{wing_col}" fill-opacity=".55" stroke-width=".5"/>'
             f'<path d="M{p(0, 0)} Q{p(7 * spread + 2, -9)} {p(9 * spread + 1, -3)} Q{p(5 * spread, 2)} {p(0, 0)} Z" fill="{wing_col}" fill-opacity=".55" stroke-width=".5"/>')
    body = (f'<path d="M{p(-1.6, 0)} L{p(-2.8, 5)} L{p(2.8, 5)} L{p(1.6, 0)} Z" fill="{dress}" stroke-width=".5"/>'
            f'<path d="M{p(-1, 5)} L{p(-1.6, 8)} M{p(1, 5)} L{p(1.8, 7.6)}" stroke="#F3D3B5" stroke-width=".9"/>'
            f'<circle cx="{f(x)}" cy="{f(y - 2.2 * s)}" r="{f(1.8 * s)}" fill="#F7DCC4" stroke-width=".5"/>'
            f'<path d="M{p(-2, -2.6)} Q{p(0, -5.4)} {p(2.2, -2.8)} Q{p(1, -3.6)} {p(-2, -2.6)} Z" fill="#C9874A" stroke-width=".4"/>')
    sparks = ''.join(f'<circle cx="{f(x + dx * s)}" cy="{f(y + dy * s)}" r="{f(r * s)}" fill="{GOLD_LT}" stroke="none"/>'
                     for dx, dy, r in ((-6, 7, .7), (-9, 10, .5), (-12, 9, .4)))
    return sparks + wings + body


def fairies(t):
    """The Dog card's two fairies (lilac and green), bobbing out of step."""
    return (fairy(62, 12 + (2 if t else -1), t, '#C9B6F0', '#B78BD6', 1.25)
            + fairy(80, 20 + (-1 if t else 2), not t, '#BEE3B0', '#7DB86A', 1.1))


def dog_run(stretch):
    """Profile gallop, facing right, fairies overhead."""
    cx, cy = 44, 58
    leg = B.leg
    if stretch:
        legs = (leg(cx - 20, cy + 6, cx - 34, cy + 20) + leg(cx - 14, cy + 6, cx - 26, cy + 22)
                + leg(cx + 18, cy + 6, cx + 34, cy + 16) + leg(cx + 13, cy + 6, cx + 30, cy + 21))
    else:
        legs = (leg(cx - 19, cy + 6, cx - 8, cy + 22) + leg(cx - 14, cy + 6, cx - 2, cy + 24)
                + leg(cx + 17, cy + 6, cx + 6, cy + 22) + leg(cx + 12, cy + 6, cx + 2, cy + 23))
    bob = -3 if stretch else 2
    dog = (f'<g transform="translate(0 {bob})">' + legs + B.curl_tail(cx - 25, cy - 13)
           + B.shiba_body(cx, cy) + B.shiba_head(cx + 27, cy - 18) + '</g>')
    return wc_svg(dog + fairies(stretch), stroke_scale=.6)


def dog_lie():
    """Arrived: lying down, head up, one fairy settling beside it."""
    cx, cy = 46, 66
    leg = B.leg
    body = (B.curl_tail(cx - 24, cy - 12)
            + f'<path d="M{cx - 26} {cy + 2} Q{cx - 26} {cy - 13} {cx - 10} {cy - 13} L{cx + 12} {cy - 14} Q{cx + 26} {cy - 14} {cx + 26} {cy + 2} '
            f'Q{cx + 26} {cy + 10} {cx + 14} {cy + 10} L{cx - 18} {cy + 10} Q{cx - 26} {cy + 10} {cx - 26} {cy + 2} Z" fill="{B.FUR}" stroke-width="2.8"/>'
            f'<path d="M{cx - 20} {cy - 9} Q{cx} {cy - 12} {cx + 16} {cy - 10}" fill="none" stroke="{B.FUR_LT}" stroke-width="2.5"/>'
            f'<ellipse cx="{cx - 14}" cy="{cy + 3}" rx="9" ry="7" fill="{B.FUR_LT}" stroke-width="2.2"/>'
            + leg(cx + 14, cy + 6, cx + 36, cy + 8) + leg(cx + 8, cy + 7, cx + 31, cy + 10)
            + B.shiba_head(cx + 26, cy - 22))
    return wc_svg(body + fairy(30, 30, True, '#C9B6F0', '#B78BD6', 1.25), stroke_scale=.6)


def dog_back(a):
    """Running away up the screen: rump, feathery tail, ears down the sides."""
    lift = 5 if a else -5
    leg = B.leg
    wag = 8 if a else -8
    body = (f'<path d="M33 18 Q26 22 27 34 Q30 38 35 33 Q38 26 38 20 Z M67 18 Q74 22 73 34 Q70 38 65 33 Q62 26 62 20 Z" fill="{B.FUR_DK}" stroke-width="2.4"/>'
            f'<ellipse cx="50" cy="26" rx="17" ry="13" fill="{B.FUR}" stroke-width="2.6"/>'
            + leg(40, 66, 39, 84 - lift) + leg(60, 66, 61, 84 + lift)
            + f'<path d="M28 52 Q28 34 50 34 Q72 34 72 52 Q72 72 50 72 Q28 72 28 52 Z" fill="{B.FUR}" stroke-width="2.8"/>'
            f'<path d="M40 70 Q50 62 60 70 Q56 73 50 73 Q44 73 40 70 Z" fill="{B.CREAM}" stroke="none"/>'
            f'<g transform="rotate({wag} 50 50)"><path d="M47 50 Q44 36 50 24 Q56 36 53 50 Z" fill="{B.FUR_LT}" stroke-width="2.2"/>'
            f'<path d="M50 28 L50 46" fill="none" stroke="{B.FUR}" stroke-width="1.6"/></g>')
    return wc_svg(body + fairy(24, 14 + (2 if a else 0), a, '#C9B6F0', '#B78BD6', 1.2)
                  + fairy(78, 12 + (0 if a else 2), not a, '#BEE3B0', '#7DB86A', 1.1), stroke_scale=.6)


def dog_front(a):
    """Running toward the viewer: full face, floppy ears, tongue out."""
    lift = 5 if a else -5
    leg = B.leg
    body = (f'<g transform="translate(0 {6 + (2 if a else -2)})">'
            + leg(40, 66, 39, 86 - lift) + leg(60, 66, 61, 86 + lift)
            + f'<path d="M30 58 Q30 44 50 44 Q70 44 70 58 Q70 74 50 74 Q30 74 30 58 Z" fill="{B.FUR}" stroke-width="2.8"/>'
            f'<path d="M40 50 Q50 46 60 50 Q62 66 50 72 Q38 66 40 50 Z" fill="{B.CREAM}" stroke="none"/>'
            f'<path d="M28 34 Q28 16 50 16 Q72 16 72 34 Q72 50 50 52 Q28 50 28 34 Z" fill="{B.FUR}" stroke-width="2.8"/>'
            f'<path d="M30 20 Q20 22 21 38 Q23 46 29 42 Q33 32 34 22 Z M70 20 Q80 22 79 38 Q77 46 71 42 Q67 32 66 22 Z" fill="{B.FUR_DK}" stroke-width="2.4"/>'
            f'<path d="M38 40 Q40 33 46 34 Q50 36 54 34 Q60 33 62 40 Q60 51 50 51 Q40 51 38 40 Z" fill="{B.CREAM}" stroke="none"/>'
            f'<ellipse cx="41" cy="31" rx="2.6" ry="3.2" fill="{SEPIA}" stroke="none"/><ellipse cx="59" cy="31" rx="2.6" ry="3.2" fill="{SEPIA}" stroke="none"/>'
            f'<circle cx="41.8" cy="30" r=".9" fill="#fff" stroke="none"/><circle cx="59.8" cy="30" r=".9" fill="#fff" stroke="none"/>'
            f'<ellipse cx="50" cy="40" rx="3.8" ry="2.8" fill="{SEPIA}" stroke="none"/>'
            f'<path d="M50 42 L50 45 M45 45 Q50 49 55 45" fill="none" stroke-width="1.6"/>'
            f'<path d="M46.5 45.6 Q50 56 53.5 45.6 Z" fill="#EE8A8E" stroke-width="1"/></g>')
    return wc_svg(body + fairy(20, 14 + (2 if a else 0), a, '#C9B6F0', '#B78BD6', 1.2)
                  + fairy(82, 18 + (0 if a else 2), not a, '#BEE3B0', '#7DB86A', 1.1), stroke_scale=.6)


# ===== Five-headed dragon (Dragon flight) =====
SCALE, SCALE_DK, SCALE_LT = '#E3C27A', '#B8924A', '#F3DDA6'
WING, WING_DK = '#D9B27A', '#B48C56'
BELLY, BELLY_DK = '#F6E7C4', '#C9A866'
CLAW = '#3E3328'


def shade(hex_col, t):
    """Mix a colour toward black (t < 0) or white (t > 0)."""
    to = 0 if t < 0 else 255
    return '#' + ''.join(f'{round(int(hex_col[i:i + 2], 16) + (to - int(hex_col[i:i + 2], 16)) * abs(t)):02X}' for i in (1, 3, 5))


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
    pts = [f'M{f(sx)} {f(sy)}', f'L{f(wrist[0])} {f(wrist[1])}', f'L{f(tips[2][0])} {f(tips[2][1])}']
    for a, b in ((tips[2], tips[1]), (tips[1], tips[0])):
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        cx, cy = mx + (wrist[0] - mx) * .5, my + (wrist[1] - my) * .5
        pts.append(f'Q{f(cx)} {f(cy)} {f(b[0])} {f(b[1])}')
    pts.append(f'Q{f((tips[0][0] + root_back[0]) / 2 + 2)} {f((tips[0][1] + root_back[1]) / 2 + (6 if up else -6))} {f(root_back[0])} {f(root_back[1])} Z')
    fill = WING_DK if far else WING
    bones = ''.join(f'<path d="M{f(wrist[0])} {f(wrist[1])} L{f(x)} {f(y)}" fill="none" stroke="{SCALE_DK}" stroke-width=".9"/>' for x, y in tips)
    arm = (f'<path d="M{f(sx)} {f(sy)} L{f(wrist[0])} {f(wrist[1])}" fill="none" stroke-width="3"/>'
           f'<path d="M{f(sx)} {f(sy)} L{f(wrist[0])} {f(wrist[1])}" fill="none" stroke="{SCALE}" stroke-width="1.8"/>')
    return f'<path d="{" ".join(pts)}" fill="{fill}" fill-opacity=".9" stroke-width="1.1"/>' + bones + arm


def neck_and_head(base, head_at, c1, c2, colour, s=.8):
    """One of the five necks: a tapering curve from the shoulders (gold at the
    root, the head's colour along its length) and a horned, open-jawed head
    facing right."""
    hx, hy = head_at
    dk, lt = shade(colour, -.35), shade(colour, .3)
    pts = [B.bez(base, c1, c2, (hx - 3 * s, hy + 1 * s), i / 12) for i in range(13)]
    def side(sign):
        out = []
        for i, (x, y) in enumerate(pts):
            ax, ay = pts[max(i - 1, 0)]
            zx, zy = pts[min(i + 1, 12)]
            dx, dy = zx - ax, zy - ay
            ln = math.hypot(dx, dy) or 1
            w = 5.2 - 2.6 * i / 12
            out.append((x - dy / ln * w * sign, y + dx / ln * w * sign))
        return out
    a, b = side(1), side(-1)
    neck = (f'<path d="M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in a + b[::-1]) + f' Z" fill="{colour}" stroke-width="1"/>')
    scales = ''.join(f'<path d="M{f(x - 1.2)} {f(y)} Q{f(x)} {f(y + 1.3)} {f(x + 1.2)} {f(y)}" fill="none" stroke="{dk}" stroke-width=".5"/>'
                     for x, y in pts[3:11:2])
    p = lambda x, y: f'{f(hx + x * s)} {f(hy + y * s)}'
    head = (f'<path d="M{p(-3, -4)} Q{p(-10, -12)} {p(-16, -12)} Q{p(-9, -8)} {p(-5, -1)} Z" fill="{BELLY}" stroke-width=".8"/>'  # swept horn
            f'<path d="M{p(-6, 2)} Q{p(-6, -6)} {p(2, -6)} Q{p(10, -7)} {p(18, -3)} Q{p(21, -1)} {p(19, 1)} L{p(8, 2)} Q{p(2, 7)} {p(-6, 2)} Z" fill="{colour}" stroke-width="1.1"/>'
            f'<path d="M{p(3, 4)} Q{p(11, 6)} {p(17, 10)} Q{p(9, 11)} {p(2, 8)} Z" fill="{dk}" stroke-width=".9"/>'  # open jaw
            f'<path d="M{p(9, 1.8)} l{f(s)} {f(2.4 * s)} l{f(s)} {f(-2.3 * s)} M{p(13, 1.2)} l{f(s)} {f(2.4 * s)} l{f(s)} {f(-2.4 * s)}" fill="#fff" stroke-width=".4"/>'
            f'<path d="M{p(1, -4)} Q{p(5, -8)} {p(10, -4.6)}" fill="{lt}" stroke-width=".7"/>'
            f'<circle cx="{f(hx + 5.6 * s)}" cy="{f(hy - 2.4 * s)}" r="{f(1.2 * s)}" fill="#F2C14E" stroke-width=".4"/>'
            + ''.join(f'<path d="M{p(-5 - 2 * i, 2 + 2.4 * i)} l{f(-4 * s)} {f(.8 * s)} l{f(3.4 * s)} {f(2 * s)} Z" fill="{lt}" stroke-width=".5"/>' for i in range(3)))
    return neck + scales + head


def dragon_fly(up):
    """The Dragon card's five-headed dragon flying right: a golden body on
    beating bat wings, five necks fanning from the shoulders, each head in
    one realm's colour."""
    bob = 3 if up else -3
    tail = (f'<path d="M30 58 Q16 60 10 68 Q6 74 2 74 Q8 70 10 64 Q16 54 30 52 Z" fill="{SCALE}" stroke-width="1.2"/>'
            f'<path d="M2 74 L-1 68 L5 70 L4 64 L8 71 Z" fill="{SCALE_DK}" stroke-width="1"/>')
    body = (f'<path d="M28 54 Q34 44 50 44 Q60 42 66 42 Q72 46 70 52 Q64 60 52 61 Q38 63 28 58 Z" fill="{SCALE}" stroke-width="1.3"/>'
            f'<path d="M32 58 Q42 62 52 59 Q62 57 68 51 Q66 56 60 58 Q48 64 34 61 Z" fill="{BELLY}" stroke="none"/>')
    plates = ''.join(f'<path d="M{x} {y} l1.4 3" fill="none" stroke="{BELLY_DK}" stroke-width=".6"/>'
                     for x, y in ((38, 59), (44, 59), (50, 58.4), (56, 57.2), (62, 55)))
    scales = ''.join(f'<path d="M{x - 1.6} {y} Q{x} {y + 1.6} {x + 1.6} {y}" fill="none" stroke="{SCALE_DK}" stroke-width=".5"/>'
                     for x, y in ((36, 50), (42, 48), (48, 48), (54, 47), (60, 46), (40, 53), (46, 52), (52, 52), (58, 51)))
    legs = (f'<path d="M36 58 Q34 66 40 70" fill="none" stroke-width="3.6"/><path d="M36 58 Q34 66 40 70" fill="none" stroke="{SCALE_DK}" stroke-width="2.4"/>'
            f'<path d="M40 70 l3 -1 M40 70 l3 1.4 M40 70 l1.6 2.6" stroke="{CLAW}" stroke-width="1"/>'
            f'<path d="M62 56 Q64 64 68 64" fill="none" stroke-width="3.4"/><path d="M62 56 Q64 64 68 64" fill="none" stroke="{SCALE}" stroke-width="2.2"/>'
            f'<path d="M68 64 l2.6 -1.4 M68 64 l2.8 .8 M68 64 l1.2 2.6" stroke="{CLAW}" stroke-width="1"/>')
    sway = 1.5 if up else -1.5
    # (head position, two curve controls, colour); far heads first so the near ones overlap them.
    far = [((64, 12 + sway), (58, 34), (70, 22), REALM_COLOURS['green']),
           ((88, 26 + sway), (74, 40), (92, 40), REALM_COLOURS['blue'])]
    near = [((80, 6 - sway), (70, 30), (86, 22), REALM_COLOURS['red']),
            ((88, 46 - sway), (76, 46), (82, 56), REALM_COLOURS['white']),
            ((78, 66 + sway), (70, 56), (66, 70), REALM_COLOURS['black'])]
    necks = lambda heads: ''.join(neck_and_head((62, 47), h, c1, c2, col) for h, c1, c2, col in heads)
    return wc_svg(f'<g transform="translate(4 {bob + 10}) scale(.88)">' + wing(54, 44, up, True) + necks(far) + tail + legs + body
                  + scales + plates + necks(near) + wing(50, 46, up, False) + '</g>')


# ===== Black lotus, card back and icons =====
def lotus(cx, cy, s=1.0, detail=True):
    """The Mah Jong card's black lotus on a lily pad: two rings of pointed
    petals in violet-black with lighter tips, and a gold heart."""
    p = lambda x, y: f'{f(cx + x * s)} {f(cy + y * s)}'
    def petal(angle, length, width, fill):
        a = math.radians(angle)
        ux, uy = math.sin(a), -math.cos(a)        # along the petal
        nx, ny = -uy, ux                          # across it
        tip = (ux * length, uy * length)
        l = (ux * length * .45 + nx * width, uy * length * .45 + ny * width)
        r = (ux * length * .45 - nx * width, uy * length * .45 - ny * width)
        return (f'<path d="M{p(0, 0)} Q{p(*l)} {p(*tip)} Q{p(*r)} {p(0, 0)} Z" fill="{fill}" stroke-width="{.9 * s:.2f}"/>'
                + (f'<path d="M{p(ux * length * .3, uy * length * .3)} L{p(ux * length * .8, uy * length * .8)}" stroke="{LOTUS_LT}" stroke-width="{.5 * s:.2f}"/>' if detail else ''))
    pad = f'<ellipse cx="{f(cx)}" cy="{f(cy + 2 * s)}" rx="{f(15 * s)}" ry="{f(4.2 * s)}" fill="{PAD}" stroke-width="{.9 * s:.2f}"/>'
    if detail:
        pad += f'<path d="M{p(0, 2)} L{p(9, 0)}" stroke="{PAD_DK}" stroke-width="{.6 * s:.2f}"/>'
    back = ''.join(petal(a, 12, 4.2, LOTUS_DK) for a in (-75, -45, 45, 75))
    front = ''.join(petal(a, 13, 4.6, LOTUS) for a in (-30, 0, 30))
    side = ''.join(petal(a, 10, 4, LOTUS) for a in (-62, 62))
    heart = (f'<ellipse cx="{f(cx)}" cy="{f(cy - 3 * s)}" rx="{f(3.4 * s)}" ry="{f(1.6 * s)}" fill="{GOLD}" stroke-width="{.6 * s:.2f}"/>'
             + (''.join(f'<circle cx="{f(cx + dx * s)}" cy="{f(cy + dy * s)}" r="{f(.5 * s)}" fill="{GOLD_LT}" stroke="none"/>'
                        for dx, dy in ((-2, -4.6), (0, -5.2), (2, -4.6))) if detail else ''))
    return pad + back + side + front + heart


def back():
    wash = (f'<radialGradient id="wash" cx="50%" cy="48%" r="60%"><stop offset="0" stop-color="#FFFDF6"/>'
            f'<stop offset=".7" stop-color="{PARCH}"/><stop offset="1" stop-color="{PARCH_DK}"/></radialGradient>'
            f'<radialGradient id="pool" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#9FC3CF" stop-opacity=".45"/>'
            f'<stop offset="1" stop-color="#9FC3CF" stop-opacity="0"/></radialGradient>')
    orbs = ''
    for i, key in enumerate(('white', 'blue', 'black', 'red', 'green')):
        a = math.radians(-90 + 72 * i)
        ox, oy = 50 + 25 * math.cos(a), 72 + 25 * math.sin(a)
        orbs += f'<circle cx="{f(ox)}" cy="{f(oy)}" r="4.2" fill="{REALM_COLOURS[key]}" stroke="{GOLD_DK}" stroke-width=".8"/>'
    ring = f'<circle cx="50" cy="72" r="25" fill="none" stroke="{GOLD}" stroke-opacity=".7" stroke-width=".6"/>'
    corners = ''.join(f'<path d="M{x} {y - 2.6} Q{x + .6} {y - .6} {x + 2.6} {y} Q{x + .6} {y + .6} {x} {y + 2.6} Q{x - .6} {y + .6} {x - 2.6} {y} Q{x - .6} {y - .6} {x} {y - 2.6} Z" fill="{GOLD}" stroke="none"/>'
                      for x, y in ((17, 17), (83, 17), (17, 123), (83, 123)))
    return wc_svg(
        f'<defs>{wash}</defs>'
        f'<rect width="100" height="140" rx="6" fill="{PARCH}" stroke="none"/>'
        f'<rect x="3" y="3" width="94" height="134" rx="4.5" fill="none" stroke="{FRAME}" stroke-width="1.8"/>'
        f'<rect x="7" y="7" width="86" height="126" rx="2.5" fill="url(#wash)" stroke="{GOLD_DK}" stroke-width=".6"/>'
        f'<rect x="10" y="10" width="80" height="120" rx="2" fill="none" stroke="{GOLD}" stroke-opacity=".6" stroke-width=".5"/>'
        + corners + f'<circle cx="50" cy="72" r="30" fill="url(#pool)" stroke="none"/>' + ring + orbs + lotus(50, 76, 1.45),
        '0 0 100 140')


def mini_back(x, y, rot=0, cx=20, cy=36):
    return (f'<g transform="rotate({rot} {cx} {cy})">'
            f'<rect x="{x}" y="{y}" width="15" height="22" rx="2" fill="{PARCH}" stroke="{FRAME}" stroke-width="1.5"/>'
            f'<rect x="{x + 2.5}" y="{y + 2.5}" width="10" height="17" rx="1" fill="none" stroke="{GOLD}" stroke-width=".9"/>'
            f'<g stroke="{SEPIA}">' + lotus(x + 7.5, y + 11.6, .3, detail=False) + '</g></g>')


ART = {
    'back': back(),
    'icon-hand': B.icon(''.join(mini_back(12.5, 9, r) for r in (-24, 0, 24))),
    'icon-tricks': B.icon(B.table_deck(PARCH, FRAME, 1.5, PARCH_DK,
                                       f'<path d="M12.7 10.8H27.3L29.8 16.2H10.2Z" fill="none" stroke="{GOLD}" stroke-width="1.1"/>'
                                       f'<g stroke="{SEPIA}" transform="translate(20 14) scale(1 .6) translate(-20 -14)">'
                                       + lotus(20, 15, .28, detail=False) + '</g>')),
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
