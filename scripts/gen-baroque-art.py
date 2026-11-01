"""Generate the Classic Baroque theme's vector art into client/public/cards/baroque/.

The cards themselves are painted full-face WebPs (one per card, drawn whole by
Card.tsx), so this only makes what sits around them, under the papercraft
file names that client/src/theme.ts cardArt() looks up: the card back, the
seat-panel icons, and the Dog-dash / Dragon-flight animation frames.

The sprites follow the painted Dog and Dragon cards: a russet shiba with a
cream mask and a red tasselled collar, and a wingless serpentine Chinese
dragon in lapis blue with vermilion fins, gold antlers and whiskers, which
undulates between its two frames instead of flapping. Ink outlines, flat
colour with a lighter highlight, gold for the accents.

    python3 scripts/gen-baroque-art.py client/public/cards/baroque
"""
import math, os, sys

INK = '#2B1D14'
PARCH, PARCH_DK = '#F6EEDC', '#E6D7B8'
FUR, FUR_DK, FUR_LT = '#D98A3D', '#A9632A', '#E9A75E'
CREAM = '#F7EBD3'
LACQUER, LACQUER_DK = '#A8322A', '#6E1512'
GOLD, GOLD_LT, GOLD_DK = '#D4A945', '#F1DC9C', '#8E6A20'
JADE = '#2F7D55'
LAPIS, LAPIS_DK, LAPIS_LT = '#2F5FA8', '#1D3B73', '#5C8BD0'
VERMILION, VERMILION_DK = '#D2563C', '#9C2F20'
BELLY = '#F2DFA8'


def svg(body, vb='0 0 100 100'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}">'
            f'<g stroke="{INK}" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n')


def f(v):
    return f'{v:.1f}'


# ===== Shiba (Dog dash) =====
def leg(x1, y1, x2, y2, fill=FUR):
    """A rounded leg: ink outline stroke, fur stroke on top, cream paw."""
    d = f'M{f(x1)} {f(y1)} L{f(x2)} {f(y2)}'
    return (f'<path d="{d}" stroke-width="8.5" fill="none"/>'
            f'<path d="{d}" stroke="{fill}" stroke-width="5.5" fill="none"/>'
            f'<circle cx="{f(x2)}" cy="{f(y2)}" r="3.2" fill="{CREAM}" stroke-width="1.6"/>')


def collar(x1, y1, cx, cy, x2, y2, tassel=None):
    band = (f'<path d="M{x1} {y1} Q{cx} {cy} {x2} {y2}" fill="none" stroke-width="6"/>'
            f'<path d="M{x1} {y1} Q{cx} {cy} {x2} {y2}" fill="none" stroke="{LACQUER}" stroke-width="3.6"/>')
    if not tassel:
        return band
    tx, ty, sway = tassel
    return (band + f'<circle cx="{tx}" cy="{ty}" r="2.6" fill="{GOLD}" stroke-width="1.3"/>'
            f'<path d="M{tx} {ty + 2} Q{tx + sway} {ty + 7} {tx + sway * 1.4} {ty + 11}" fill="none" stroke="{LACQUER}" stroke-width="2.6"/>')


def shiba_head(cx, cy, s=1.0, happy=False):
    """Profile head facing right, centred on the skull."""
    p = lambda x, y: f'{f(cx + x * s)} {f(cy + y * s)}'
    ears = (f'<path d="M{p(-9, -6)} L{p(-6, -22)} L{p(2, -10)} Z" fill="{FUR}" stroke-width="2.4"/>'
            f'<path d="M{p(-6.5, -9)} L{p(-5.5, -17)} L{p(-1, -10)} Z" fill="{CREAM}" stroke="none"/>'
            f'<path d="M{p(-1, -9)} L{p(5, -23)} L{p(9, -7)} Z" fill="{FUR}" stroke-width="2.4"/>')
    skull = (f'<path d="M{p(-12, 2)} Q{p(-13, -12)} {p(0, -12)} Q{p(9, -12)} {p(12, -4)} L{p(22, 0)} '
             f'Q{p(25, 3)} {p(22, 6)} L{p(10, 9)} Q{p(0, 13)} {p(-8, 10)} Q{p(-13, 7)} {p(-12, 2)} Z" fill="{FUR}" stroke-width="2.6"/>')
    mask = f'<path d="M{p(4, 2)} Q{p(12, -1)} {p(21, 1)} Q{p(23, 4)} {p(20, 6)} L{p(9, 9)} Q{p(2, 10)} {p(-4, 6)} Q{p(0, 3)} {p(4, 2)} Z" fill="{CREAM}" stroke="none"/>'
    nose = f'<ellipse cx="{f(cx + 22.5 * s)}" cy="{f(cy + 1.5 * s)}" rx="{f(2.6 * s)}" ry="{f(2 * s)}" fill="{INK}" stroke="none"/>'
    eye = (f'<path d="M{p(3, -5)} Q{p(6, -8)} {p(9, -5)}" fill="none" stroke-width="2"/>' if happy else
           f'<ellipse cx="{f(cx + 6 * s)}" cy="{f(cy - 4.5 * s)}" rx="{f(2.1 * s)}" ry="{f(2.6 * s)}" fill="{INK}" stroke="none"/>'
           f'<circle cx="{f(cx + 6.7 * s)}" cy="{f(cy - 5.4 * s)}" r="{f(.8 * s)}" fill="#fff" stroke="none"/>')
    mouth = f'<path d="M{p(13, 7)} Q{p(16, 9)} {p(19, 6.5)}" fill="none" stroke-width="1.4"/>'
    return ears + skull + mask + nose + eye + mouth


def curl_tail(cx, cy, s=1.0):
    """The shiba's tail, curled up over the back."""
    p = lambda x, y: f'{f(cx + x * s)} {f(cy + y * s)}'
    return (f'<path d="M{p(4, 6)} Q{p(-10, 6)} {p(-10, -6)} Q{p(-8, -16)} {p(2, -14)} Q{p(10, -12)} {p(8, -4)} '
            f'Q{p(5, 2)} {p(-1, -2)} Q{p(-3, -7)} {p(1, -8)} Q{p(-4, -2)} {p(1, 1)} Q{p(6, 2)} {p(8, 6)} Z" fill="{FUR}" stroke-width="2.4"/>'
            f'<path d="M{p(-6, -4)} Q{p(-6, -11)} {p(0, -11)}" fill="none" stroke="{CREAM}" stroke-width="{f(2.6 * s)}"/>')


def shiba_body(cx, cy):
    """Barrel body in profile, chest to the right, cream underside."""
    return (f'<path d="M{cx - 26} {cy - 2} Q{cx - 26} {cy - 13} {cx - 12} {cy - 13} L{cx + 12} {cy - 14} '
            f'Q{cx + 26} {cy - 14} {cx + 27} {cy} Q{cx + 26} {cy + 11} {cx + 14} {cy + 11} L{cx - 14} {cy + 11} '
            f'Q{cx - 26} {cy + 11} {cx - 26} {cy - 2} Z" fill="{FUR}" stroke-width="2.8"/>'
            f'<path d="M{cx - 16} {cy + 9} Q{cx} {cy + 4} {cx + 22} {cy + 6} Q{cx + 22} {cy + 10} {cx + 14} {cy + 10.5} L{cx - 14} {cy + 10.5} Z" fill="{CREAM}" stroke="none"/>'
            f'<path d="M{cx - 18} {cy - 8} Q{cx} {cy - 11} {cx + 16} {cy - 9}" fill="none" stroke="{FUR_LT}" stroke-width="2.5"/>')


def dog_run(stretch):
    """Profile gallop, facing right: legs flung out (1) or gathered under (2)."""
    cx, cy = 46, 52
    if stretch:
        legs = (leg(cx - 20, cy + 6, cx - 34, cy + 20) + leg(cx - 14, cy + 6, cx - 26, cy + 22)
                + leg(cx + 18, cy + 6, cx + 34, cy + 16) + leg(cx + 13, cy + 6, cx + 30, cy + 21))
    else:
        legs = (leg(cx - 19, cy + 6, cx - 8, cy + 22) + leg(cx - 14, cy + 6, cx - 2, cy + 24)
                + leg(cx + 17, cy + 6, cx + 6, cy + 22) + leg(cx + 12, cy + 6, cx + 2, cy + 23))
    bob = -3 if stretch else 2
    return svg(f'<g transform="translate(0 {bob})">' + legs + curl_tail(cx - 25, cy - 13)
               + shiba_body(cx, cy) + shiba_head(cx + 27, cy - 18)
               + collar(cx + 18, cy - 10, cx + 23, cy - 4, cx + 30, cy - 9, (cx + 25, cy - 5, -2 if stretch else 2)) + '</g>')


def dog_back(a):
    """Running away up the screen: rump, curled tail, ears over the shoulders."""
    lift = 5 if a else -5
    return svg(
        f'<path d="M34 24 L37 6 L46 20 Z M66 24 L63 6 L54 20 Z" fill="{FUR}" stroke-width="2.4"/>'
        f'<path d="M37 21 L38.5 11 L43 19 Z M63 21 L61.5 11 L57 19 Z" fill="{CREAM}" stroke="none"/>'
        f'<ellipse cx="50" cy="28" rx="18" ry="13" fill="{FUR}" stroke-width="2.6"/>'
        f'<path d="M34 33 Q50 41 66 33" fill="none" stroke-width="6"/><path d="M34 33 Q50 41 66 33" fill="none" stroke="{LACQUER}" stroke-width="3.6"/>'
        + leg(40, 66, 39, 84 - lift) + leg(60, 66, 61, 84 + lift)
        + f'<path d="M28 52 Q28 34 50 34 Q72 34 72 52 Q72 72 50 72 Q28 72 28 52 Z" fill="{FUR}" stroke-width="2.8"/>'
        f'<path d="M40 70 Q50 62 60 70 Q56 73 50 73 Q44 73 40 70 Z" fill="{CREAM}" stroke="none"/>'
        f'<g transform="rotate({8 if a else -8} 50 48)">{curl_tail(51, 52, 1.15)}</g>')


def dog_front(a):
    """Running toward the viewer: full face, cream chest, red tasselled collar."""
    lift = 5 if a else -5
    return svg(
        f'<g transform="translate(0 {2 if a else -2})">'
        + leg(40, 66, 39, 86 - lift) + leg(60, 66, 61, 86 + lift)
        + f'<path d="M30 58 Q30 44 50 44 Q70 44 70 58 Q70 74 50 74 Q30 74 30 58 Z" fill="{FUR}" stroke-width="2.8"/>'
        f'<path d="M40 50 Q50 46 60 50 Q62 66 50 72 Q38 66 40 50 Z" fill="{CREAM}" stroke="none"/>'
        f'<path d="M30 30 L32 8 L44 20 Z M70 30 L68 8 L56 20 Z" fill="{FUR}" stroke-width="2.4"/>'
        f'<path d="M33 25 L34 13 L41 20 Z M67 25 L66 13 L59 20 Z" fill="{CREAM}" stroke="none"/>'
        f'<path d="M28 34 Q28 16 50 16 Q72 16 72 34 Q72 50 50 52 Q28 50 28 34 Z" fill="{FUR}" stroke-width="2.8"/>'
        f'<path d="M36 40 Q38 31 46 32 Q50 35 54 32 Q62 31 64 40 Q62 51 50 51 Q38 51 36 40 Z" fill="{CREAM}" stroke="none"/>'
        f'<path d="M38 27 Q41 25 44 27 M56 27 Q59 25 62 27" fill="none" stroke="{CREAM}" stroke-width="2.4"/>'
        f'<ellipse cx="41" cy="33" rx="2.6" ry="3.2" fill="{INK}" stroke="none"/><ellipse cx="59" cy="33" rx="2.6" ry="3.2" fill="{INK}" stroke="none"/>'
        f'<circle cx="41.8" cy="32" r=".9" fill="#fff" stroke="none"/><circle cx="59.8" cy="32" r=".9" fill="#fff" stroke="none"/>'
        f'<ellipse cx="50" cy="40" rx="3.6" ry="2.6" fill="{INK}" stroke="none"/>'
        f'<path d="M50 42 L50 45 M45 45 Q50 49 55 45" fill="none" stroke-width="1.6"/>'
        f'<path d="M48 46 Q50 51 52 46 Z" fill="{VERMILION}" stroke-width="1"/>'
        + collar(33, 50, 50, 59, 67, 50, (50, 57, 3 if a else -3)) + '</g>')


def dog_lie():
    """Arrived: lying down in profile, front paws out, head up and ready."""
    cx, cy = 46, 66
    return svg(
        curl_tail(cx - 24, cy - 12)
        + f'<path d="M{cx - 26} {cy + 2} Q{cx - 26} {cy - 13} {cx - 10} {cy - 13} L{cx + 12} {cy - 14} Q{cx + 26} {cy - 14} {cx + 26} {cy + 2} '
        f'Q{cx + 26} {cy + 10} {cx + 14} {cy + 10} L{cx - 18} {cy + 10} Q{cx - 26} {cy + 10} {cx - 26} {cy + 2} Z" fill="{FUR}" stroke-width="2.8"/>'
        f'<path d="M{cx - 20} {cy - 9} Q{cx} {cy - 12} {cx + 16} {cy - 10}" fill="none" stroke="{FUR_LT}" stroke-width="2.5"/>'
        f'<ellipse cx="{cx - 14}" cy="{cy + 3}" rx="9" ry="7" fill="{FUR_LT}" stroke-width="2.2"/>'  # folded hind leg
        + leg(cx + 14, cy + 6, cx + 36, cy + 8) + leg(cx + 8, cy + 7, cx + 31, cy + 10)
        + shiba_head(cx + 26, cy - 22)
        + collar(cx + 17, cy - 14, cx + 22, cy - 8, cx + 29, cy - 13, (cx + 24, cy - 9, 2)))


# ===== Serpentine dragon (Dragon flight) =====
def bez(p0, p1, p2, p3, t):
    u = 1 - t
    return tuple(u ** 3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t ** 3 * d for a, b, c, d in zip(p0, p1, p2, p3))


def dragon_fly(phase):
    """A Chinese dragon swimming through the air, facing right. The two frames
    swap the S-curve of the body so it undulates as it flies."""
    amp = 20 if phase else -20
    pts = ((8, 60), (26, 60 - amp), (46, 60 + amp), (64, 46))
    n = 40
    spine = [bez(*pts, i / n) for i in range(n + 1)]

    def normal(i):
        a, b = spine[max(i - 1, 0)], spine[min(i + 1, n)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        ln = math.hypot(dx, dy) or 1
        return dy / ln, -dx / ln  # points up the screen (left of travel)

    width = lambda i: 2 + 7.5 * math.sin(math.pi * min(1, (i / n) * 1.15)) ** .6 if i < n else 7
    top = [(x + nx * width(i), y + ny * width(i)) for i, ((x, y), (nx, ny)) in enumerate(zip(spine, map(normal, range(n + 1))))]
    bot = [(x - nx * width(i), y - ny * width(i)) for i, ((x, y), (nx, ny)) in enumerate(zip(spine, map(normal, range(n + 1))))]
    poly = lambda ps: 'M' + ' L'.join(f'{f(x)} {f(y)}' for x, y in ps) + ' Z'

    # Vermilion dorsal fins along the top edge, a flame tuft at the tail tip.
    fins = ''
    for i in range(6, n - 2, 4):
        (x, y), (nx, ny) = top[i], normal(i)
        tx, ty = spine[min(i + 2, n)][0] - spine[i][0], spine[min(i + 2, n)][1] - spine[i][1]
        tl = math.hypot(tx, ty) or 1
        tx, ty = tx / tl, ty / tl
        h = 3 + width(i) * .55
        fins += (f'<path d="M{f(x - tx * 2.4)} {f(y - ty * 2.4)} L{f(x + nx * h - tx * 1.5)} {f(y + ny * h - ty * 1.5)} '
                 f'L{f(x + tx * 2.4)} {f(y + ty * 2.4)} Z" fill="{VERMILION}" stroke-width="1.2"/>')
    tail = (f'<path d="M{f(spine[0][0] + 2)} {f(spine[0][1])} Q{f(spine[0][0] - 6)} {f(spine[0][1] - 10)} {f(spine[0][0] - 2)} {f(spine[0][1] - 14)} '
            f'Q{f(spine[0][0] - 1)} {f(spine[0][1] - 6)} {f(spine[0][0] + 4)} {f(spine[0][1] - 4)} '
            f'Q{f(spine[0][0] - 2)} {f(spine[0][1] + 8)} {f(spine[0][0] + 2)} {f(spine[0][1])} Z" fill="{VERMILION}" stroke-width="1.4"/>')
    # Cream belly band along the lower edge, scale arcs down the back.
    belly = poly([((x + bx) / 2 * .55 + bx * .45, (y + by) / 2 * .55 + by * .45) for (x, y), (bx, by) in zip(spine[3:], bot[3:])] + bot[3:][::-1])
    scales = ''.join(
        f'<path d="M{f(spine[i][0] - 1.8)} {f(spine[i][1] - 1)} Q{f(spine[i][0])} {f(spine[i][1] + 1.8)} {f(spine[i][0] + 1.8)} {f(spine[i][1] - 1)}" '
        f'fill="none" stroke="{LAPIS_LT}" stroke-width="1.1"/>' for i in range(8, n - 2, 3))
    # Two pairs of little gold-clawed legs.
    claws = ''
    for i, swing in ((14, 1), (30, -1)):
        (x, y), (nx, ny) = bot[i], normal(i)
        kx, ky = x - nx * 7 + swing * (2 if phase else -2), y - ny * 7 + 1
        claws += (f'<path d="M{f(x)} {f(y)} L{f(kx)} {f(ky)}" stroke-width="4.5"/>'
                  f'<path d="M{f(x)} {f(y)} L{f(kx)} {f(ky)}" stroke="{LAPIS}" stroke-width="2.4"/>'
                  f'<path d="M{f(kx - 2)} {f(ky + 2)} L{f(kx)} {f(ky)} L{f(kx + 2)} {f(ky + 2.4)} M{f(kx)} {f(ky)} L{f(kx + .4)} {f(ky + 3)}" '
                  f'fill="none" stroke="{GOLD}" stroke-width="1.3"/>')
    # Head at the front end of the spine: long snout, open jaw, gold antlers,
    # a vermilion mane and long whiskers that trail with the motion.
    hx, hy = spine[-1]
    sway = 3 if phase else -3
    mane = (f'<path d="M{hx - 4} {hy - 2} Q{hx - 14} {hy - 14 + sway} {hx - 18} {hy - 6 + sway} Q{hx - 12} {hy - 6} {hx - 16} {hy + 2 + sway} '
            f'Q{hx - 8} {hy + 1} {hx - 6} {hy + 6} Z" fill="{VERMILION}" stroke-width="1.6"/>')
    antlers = (f'<path d="M{hx + 2} {hy - 7} Q{hx - 2} {hy - 16} {hx - 8} {hy - 20} M{hx - 2} {hy - 14} L{hx + 3} {hy - 19} '
               f'M{hx + 6} {hy - 7} Q{hx + 6} {hy - 15} {hx + 2} {hy - 22} M{hx + 5} {hy - 15} L{hx + 10} {hy - 18}" fill="none" stroke-width="3.6"/>'
               f'<path d="M{hx + 2} {hy - 7} Q{hx - 2} {hy - 16} {hx - 8} {hy - 20} M{hx - 2} {hy - 14} L{hx + 3} {hy - 19} '
               f'M{hx + 6} {hy - 7} Q{hx + 6} {hy - 15} {hx + 2} {hy - 22} M{hx + 5} {hy - 15} L{hx + 10} {hy - 18}" fill="none" stroke="{GOLD}" stroke-width="1.8"/>')
    head = (f'<path d="M{hx - 6} {hy - 4} Q{hx - 4} {hy - 10} {hx + 6} {hy - 9} Q{hx + 14} {hy - 9} {hx + 18} {hy - 6} '
            f'Q{hx + 25} {hy - 6} {hx + 25} {hy - 2} Q{hx + 25} {hy + 1} {hx + 18} {hy + 1} L{hx + 8} {hy + 2} Q{hx} {hy + 6} {hx - 6} {hy - 4} Z" '
            f'fill="{LAPIS}" stroke-width="2.2"/>'
            f'<path d="M{hx + 4} {hy + 3} Q{hx + 14} {hy + 4} {hx + 20} {hy + 7} Q{hx + 13} {hy + 9} {hx + 4} {hy + 6} Z" fill="{LAPIS_DK}" stroke-width="1.8"/>'  # jaw
            f'<path d="M{hx + 9} {hy + 2.5} L{hx + 10.5} {hy + 4.5} L{hx + 12} {hy + 2.8} M{hx + 14} {hy + 3} L{hx + 15.5} {hy + 5} L{hx + 17} {hy + 3.4}" fill="#fff" stroke-width=".8"/>'
            f'<path d="M{hx + 2} {hy - 6} Q{hx + 6} {hy - 10} {hx + 10} {hy - 6}" fill="{GOLD_LT}" stroke-width="1.4"/>'  # brow ridge
            f'<circle cx="{hx + 6}" cy="{hy - 5}" r="2.2" fill="{GOLD_LT}" stroke-width="1.2"/><circle cx="{hx + 6.4}" cy="{hy - 5}" r="1" fill="{INK}" stroke="none"/>'
            f'<circle cx="{hx + 22.5}" cy="{hy - 4}" r=".9" fill="{INK}" stroke="none"/>')
    whiskers = (f'<path d="M{hx + 22} {hy - 2} Q{hx + 29} {hy + 8 - sway} {hx + 23} {hy + 16 - sway} Q{hx + 19} {hy + 21} {hx + 26} {hy + 25 - sway}" '
                f'fill="none" stroke="{GOLD}" stroke-width="1.3"/>'
                f'<path d="M{hx + 18} {hy - 6} Q{hx + 22} {hy - 18 + sway} {hx + 30} {hy - 18 + sway}" fill="none" stroke="{GOLD}" stroke-width="1.3"/>')
    return svg(tail + fins + f'<path d="{poly(top + bot[::-1])}" fill="{LAPIS}" stroke-width="2.4"/>'
               + f'<path d="{belly}" fill="{BELLY}" stroke="none"/>' + scales + claws + mane + antlers + head + whiskers)


# ===== Card back and icons =====
def back():
    lattice = (f'<pattern id="lattice" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45 50 70)">'
               f'<path d="M0 0H10M0 0V10" stroke="#E2BE6A" stroke-opacity=".55" stroke-width="1"/>'
               f'<circle cx="5" cy="5" r="1.1" fill="#E2BE6A" fill-opacity=".5" stroke="none"/></pattern>')
    field = (f'<radialGradient id="field" cx="50%" cy="45%" r="65%"><stop offset="0" stop-color="#A82A22"/>'
             f'<stop offset="1" stop-color="{LACQUER_DK}"/></radialGradient>')
    return svg(
        f'<defs>{lattice}{field}</defs>'
        f'<rect width="100" height="140" rx="6" fill="{PARCH}" stroke="none"/>'
        f'<rect x="4" y="4" width="92" height="132" rx="3.5" fill="none" stroke="{VERMILION}" stroke-width="1.2"/>'
        f'<rect x="8" y="8" width="84" height="124" rx="2" fill="url(#field)" stroke="none"/>'
        f'<rect x="8" y="8" width="84" height="124" rx="2" fill="url(#lattice)" stroke="none"/>'
        f'<rect x="11" y="11" width="78" height="118" rx="1.5" fill="none" stroke="#E8C468" stroke-width="1.4"/>'
        f'<rect x="13.5" y="13.5" width="73" height="113" rx="1" fill="none" stroke="#E8C468" stroke-opacity=".6" stroke-width=".6"/>'
        f'<circle cx="50" cy="70" r="17" fill="{LACQUER_DK}" stroke="#E8C468" stroke-width="2"/>'
        f'<circle cx="50" cy="70" r="12.5" fill="{JADE}" stroke="{GOLD_LT}" stroke-width="1"/>'
        f'<circle cx="50" cy="70" r="4.5" fill="{LACQUER_DK}" stroke="{GOLD_LT}" stroke-width=".8"/>'
        f'<path d="M50 49v-5M50 91v5M29 70h-5M71 70h5" stroke="#E8C468" stroke-width="1.6"/>',
        '0 0 100 140')


def mini_back(x, y, rot=0, cx=20, cy=36):
    return (f'<g transform="rotate({rot} {cx} {cy})">'
            f'<rect x="{x}" y="{y}" width="15" height="22" rx="2" fill="{LACQUER}" stroke="{INK}" stroke-width="1.5"/>'
            f'<rect x="{x + 2.5}" y="{y + 2.5}" width="10" height="17" rx="1" fill="none" stroke="{GOLD}" stroke-width="1.1"/>'
            f'<circle cx="{x + 7.5}" cy="{y + 11}" r="2.8" fill="{JADE}" stroke="{GOLD_LT}" stroke-width=".9"/></g>')


def table_deck(top, stroke, sw, edge, inner):
    """Tricks-won icon: a squared deck lying on the table, seen from the front,
    so it reads flat and wide next to the hand icon's upright fan."""
    return (f'<g stroke-linejoin="round">'
            f'<rect x="6" y="18" width="28" height="13" rx="1.5" fill="{edge}" stroke="{stroke}" stroke-width="{sw}"/>'
            f'<path d="M6.8 22.5H33.2M6.8 26.8H33.2" stroke="{stroke}" stroke-width="1" opacity=".55"/>'
            f'<path d="M10 9H30L34 18H6Z" fill="{top}" stroke="{stroke}" stroke-width="{sw}"/>{inner}</g>')


def icon(body):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="3 3 34 34" stroke-linejoin="round">{body}</svg>\n'


ART = {
    'back': back(),
    'icon-hand': icon(''.join(mini_back(12.5, 9, r) for r in (-24, 0, 24))),
    'icon-tricks': icon(table_deck(LACQUER, INK, 1.5, PARCH,
                                 f'<path d="M12.7 10.8H27.3L29.8 16.2H10.2Z" fill="none" stroke="{GOLD}" stroke-width="1.1"/>'
                                 f'<ellipse cx="20" cy="13.5" rx="3.2" ry="1.7" fill="{JADE}" stroke="{GOLD_LT}" stroke-width=".9"/>')),
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
