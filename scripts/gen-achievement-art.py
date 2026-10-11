"""Generate the papercraft SVG achievement badges in client/public/achievements/.

Each badge is a scalloped paper rosette holding a little cut-paper scene. The
papercraft look comes from SVG filters rather than the shapes themselves:

- `cut`: a slight turbulence warp so edges look hand-cut, plus a soft drop
  shadow so each layer sits on the one below it.
- `paper`: grain and watercolour-ish mottling multiplied over the whole badge.

Wrap each piece of paper in `layer(...)`, back to front. Edit an icon here and
rerun rather than editing the SVG output by hand:

    python3 scripts/gen-achievement-art.py client/public/achievements
"""
import math
import os
import sys

# Palette (after the papercraft reference): warm paper, ink, clay and friends.
INK = '#2B2233'
PAPER, CREAM = '#F3EBDC', '#FFF5E2'
CLAY, CLAY_DK, CLAY_LT = '#D97757', '#A84D33', '#F2A283'
NIGHT, INDIGO, SKY = '#1F2550', '#2F3C7A', '#8EC3E6'
ROSE, OCHRE, OCHRE_DK = '#E27A92', '#E8AA38', '#B9802A'
SAP, SAP_DK, TEAL, VIOLET = '#6E9F58', '#4E7A3E', '#3A9C98', '#7B5CA8'
SAP_LT = '#A9CF8A'
STONE, STONE_DK, ASH, ASH_DK = '#B7B1C2', '#8C8699', '#A39D97', '#77716C'
BLUE, BLUE_DK = '#4F7BD6', '#2F3C7A'  # Grand Tichu blue
CRIMSON, CRIMSON_DK = '#C9374A', '#8E2233'
SKIN, SKIN_DK, HAIR = '#EDBB92', '#C98D63', '#5A3A2A'
WHITE = '#FFFDF7'

DEFS = f'''<defs>
<filter id="cut" x="-25%" y="-25%" width="150%" height="150%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves="2" seed="3" result="w"/>
  <feDisplacementMap in="SourceGraphic" in2="w" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feDropShadow in="d" dx="0.5" dy="1.6" stdDeviation="0.9" flood-color="{INK}" flood-opacity="0.38"/>
</filter>
<filter id="paper" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="t"/>
  <feColorMatrix in="t" type="matrix" values="0 0 0 0 0.33  0 0 0 0 0.25  0 0 0 0 0.17  0.3 0 0 0 -0.12" result="g"/>
  <feComposite in="g" in2="SourceAlpha" operator="in" result="grain"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" seed="11" result="m"/>
  <feColorMatrix in="m" type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.33  0 0 0 0 0.2  0.45 0 0 0 -0.18" result="mo"/>
  <feComposite in="mo" in2="SourceAlpha" operator="in" result="mottle"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="mottle"/><feMergeNode in="grain"/></feMerge>
</filter>
<clipPath id="disc"><circle cx="64" cy="64" r="49"/></clipPath>
</defs>'''


def layer(*parts):
    return f'<g filter="url(#cut)">{"".join(parts)}</g>'


def scallops(r=61, n=18, bump=3.6):
    pts = []
    for i in range(n * 8):
        a = 2 * math.pi * i / (n * 8)
        rr = r - bump + bump * abs(math.cos(n * a / 2))
        pts.append(f'{64 + rr * math.cos(a):.2f} {64 + rr * math.sin(a):.2f}')
    return 'M' + ' L'.join(pts) + ' Z'


def badge(bg, backdrop, scene):
    """Rosette + tinted disc; `backdrop` is clipped to the disc, `scene` is not."""
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
{DEFS}
<g filter="url(#paper)">
{layer(f'<path d="{scallops()}" fill="{OCHRE}" stroke="{OCHRE_DK}" stroke-width="1.5"/>')}
{layer(f'<circle cx="64" cy="64" r="50" fill="{bg}" stroke="{OCHRE_DK}" stroke-width="1.5"/>')}
<g clip-path="url(#disc)">{backdrop}</g>
<g stroke="{INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">{scene}</g>
</g>
</svg>
'''


def sparkle(x, y, s=5, c=OCHRE):
    return (f'<path d="M{x} {y - s} Q{x + s * .2} {y - s * .2} {x + s} {y} Q{x + s * .2} {y + s * .2} {x} {y + s} '
            f'Q{x - s * .2} {y + s * .2} {x - s} {y} Q{x - s * .2} {y - s * .2} {x} {y - s} Z" fill="{c}" stroke-width="1.2"/>')


def spark(x, y, s=7):
    pts = []
    for i in range(16):
        a = math.pi * i / 8
        rr = s if i % 2 == 0 else s * 0.45
        pts.append(f'{x + rr * math.cos(a):.1f} {y + rr * math.sin(a):.1f}')
    inner = [f'{x + (s * .55 if i % 2 == 0 else s * .25) * math.cos(math.pi * i / 8):.1f} '
             f'{y + (s * .55 if i % 2 == 0 else s * .25) * math.sin(math.pi * i / 8):.1f}' for i in range(16)]
    return (f'<path d="M{" L".join(pts)} Z" fill="{CLAY}" stroke-width="1.2"/>'
            f'<path d="M{" L".join(inner)} Z" fill="{OCHRE}" stroke="none"/>')


def bomb(cx, cy, r, face='', lit=True, squash=1.0, fuse_dir=1):
    ry = r * squash
    capx, capy = cx + fuse_dir * r * .55, cy - ry * .8
    s = ''
    if lit:
        fx, fy = capx + fuse_dir * 3, capy - 5
        ex, ey = fx + fuse_dir * 12, fy - 9
        s += (f'<path d="M{fx} {fy} q{fuse_dir * 3} -9 {fuse_dir * 12} -9" fill="none" stroke="{INK}" stroke-width="5"/>'
              f'<path d="M{fx} {fy} q{fuse_dir * 3} -9 {fuse_dir * 12} -9" fill="none" stroke="{OCHRE}" stroke-width="2.6"/>')
        s += spark(ex, ey, 7)
    s += (f'<rect x="{capx - 6}" y="{capy - 5}" width="12" height="9" rx="2" fill="{OCHRE}" '
          f'transform="rotate({fuse_dir * 35} {capx} {capy})"/>')
    s += f'<ellipse cx="{cx}" cy="{cy}" rx="{r}" ry="{ry}" fill="{NIGHT}"/>'
    s += (f'<path d="M{cx - r * .62} {cy - ry * .15} Q{cx - r * .55} {cy - ry * .62} {cx - r * .12} {cy - ry * .72}" '
          f'fill="none" stroke="{SKY}" stroke-width="3" opacity="0.7"/>')
    return layer(s + face)


icons = {}

# ---- Double Tap: two lit bombs, one cheeky, one determined.
icons['double-tap'] = badge(CLAY_LT, layer(
    f'<path d="M14 100 Q64 88 114 100 L114 120 L14 120 Z" fill="{CLAY}" stroke="none"/>'),
    bomb(46, 74, 20,
         face=f'<circle cx="39" cy="73" r="2.6" fill="{WHITE}" stroke="none"/>'
              f'<path d="M48 73 q3 -3 6 0" fill="none" stroke="{WHITE}" stroke-width="2"/>'
              f'<path d="M40 82 Q46 87 53 81" fill="none" stroke="{WHITE}" stroke-width="2"/>')
    + bomb(84, 82, 18, fuse_dir=1,
           face=f'<path d="M76 77 l6 2 M92 77 l-6 2" stroke="{WHITE}" stroke-width="2"/>'
                f'<circle cx="79" cy="82" r="2.2" fill="{WHITE}" stroke="none"/><circle cx="89" cy="82" r="2.2" fill="{WHITE}" stroke="none"/>'
                f'<path d="M79 90 L90 90" stroke="{WHITE}" stroke-width="2"/>')
)

# ---- Out-Bombed: a big smug bomb squashing a dizzy little one.
icons['out-bombed'] = badge(SKY, layer(
    f'<path d="M14 104 Q64 96 114 104 L114 120 L14 120 Z" fill="{SAP}" stroke="none"/>'),
    bomb(44, 96, 19, squash=0.5, lit=False,
         face=f'<path d="M36 94 l4 4 M40 94 l-4 4 M49 94 l4 4 M53 94 l-4 4" stroke="{WHITE}" stroke-width="1.8"/>')
    + bomb(68, 58, 25,
           face=f'<path d="M58 55 q4 -4 8 0" fill="none" stroke="{WHITE}" stroke-width="2.4"/>'
                f'<path d="M72 55 q4 -4 8 0" fill="none" stroke="{WHITE}" stroke-width="2.4"/>'
                f'<path d="M60 66 Q69 74 79 65" fill="{CLAY}" stroke="{WHITE}" stroke-width="2"/>')
    + layer(sparkle(26, 82, 4.5), sparkle(36, 74, 3.5, ROSE), sparkle(60, 86, 3.5))
)

# ---- Friendly Fire: you bombed your own (green, as in game) Dragon. It is sooty,
# frazzled, and staring at the lit bomb.
burst = []
for i in range(22):
    a = 2 * math.pi * i / 22
    rr = 44 if i % 2 == 0 else 30
    burst.append(f'{62 + rr * math.cos(a):.1f} {58 + rr * math.sin(a):.1f}')
icons['friendly-fire'] = badge(CREAM, layer(
    f'<path d="M{" L".join(burst)} Z" fill="{OCHRE}" stroke="none"/>'),
    layer(  # wings
        f'<path d="M44 70 C30 64 22 50 26 40 L32 48 L36 42 L40 52 L46 58 Z" fill="{VIOLET}"/>'
        f'<path d="M84 70 C98 64 106 50 102 40 L96 48 L92 42 L88 52 L82 58 Z" fill="{VIOLET}"/>')
    + layer(  # tail with a spade tip, body, belly scutes, feet
        f'<path d="M84 98 Q100 100 104 88" fill="none" stroke="{INK}" stroke-width="7"/>'
        f'<path d="M84 98 Q100 100 104 88" fill="none" stroke="{SAP}" stroke-width="4"/>'
        f'<path d="M104 80 L110 90 L100 90 Z" fill="{SAP}"/>'
        f'<path d="M44 106 Q40 74 64 70 Q88 74 84 106 Z" fill="{SAP}"/>'
        f'<path d="M54 106 Q52 84 64 82 Q76 84 74 106 Z" fill="{OCHRE}"/>'
        f'<path d="M55 90 L73 90 M54 97 L74 97" stroke="{OCHRE_DK}" stroke-width="1.4"/>'
        f'<ellipse cx="52" cy="107" rx="7" ry="3.5" fill="{SAP}"/><ellipse cx="76" cy="107" rx="7" ry="3.5" fill="{SAP}"/>')
    + layer(  # head: spiky crest, long snout, fangs, soot, stunned eyes
        f'<path d="M50 36 L54 22 L60 32 L64 18 L68 32 L74 22 L78 36 Z" fill="{OCHRE}"/>'
        f'<path d="M42 50 Q42 32 64 32 Q86 32 86 50 Q86 60 80 64 Q64 70 48 64 Q42 60 42 50 Z" fill="{SAP}"/>'
        f'<path d="M50 58 Q50 52 64 52 Q78 52 78 58 Q78 68 64 68 Q50 68 50 58 Z" fill="{SAP_LT}"/>'
        f'<ellipse cx="59" cy="57" rx="1.8" ry="1.2" fill="{INK}" stroke="none"/><ellipse cx="69" cy="57" rx="1.8" ry="1.2" fill="{INK}" stroke="none"/>'
        f'<path d="M56 66 L58 71 L60 66 Z M68 66 L70 71 L72 66 Z" fill="{WHITE}" stroke-width="1.2"/>'
        f'<path d="M44 46 Q50 40 56 48 Q50 52 44 46 Z M72 48 Q80 40 86 46 Q80 52 72 48 Z M60 36 Q66 32 70 38 Q64 40 60 36 Z" '
        f'fill="{INK}" stroke="none" opacity="0.5"/>'
        f'<circle cx="55" cy="45" r="5.5" fill="{WHITE}"/><circle cx="73" cy="45" r="5.5" fill="{WHITE}"/>'
        f'<circle cx="52" cy="48" r="1.8" fill="{INK}" stroke="none"/><circle cx="70" cy="48" r="1.8" fill="{INK}" stroke="none"/>')
    + bomb(32, 92, 14, fuse_dir=1,
           face=f'<path d="M25 89 l5 2 M39 89 l-5 2" stroke="{WHITE}" stroke-width="1.8"/>'
                f'<path d="M27 97 Q32 94 37 97" fill="none" stroke="{WHITE}" stroke-width="1.8"/>')
    + layer(  # frazzled smoke curls off the head
        f'<path d="M56 22 q-4 -4 1 -7" fill="none" stroke="{ASH_DK}" stroke-width="2.2"/>'
        f'<path d="M73 22 q4 -4 -1 -7" fill="none" stroke="{ASH_DK}" stroke-width="2.2"/>')
)

# ---- Phoenix Rising: a crimson-and-gold phoenix (after Fawkes) rises out of
# the ashes and flames, wings raised, lyre-tail plumes trailing into the fire.
def plume(d, w=5, fill=OCHRE):
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w + 3}"/>'
            f'<path d="{d}" fill="none" stroke="{fill}" stroke-width="{w}"/>')
WING = (f'<path d="M58 56 C50 40 38 28 22 20 C26 30 28 36 32 40 C26 40 22 42 20 46 C28 48 32 50 36 54 '
        f'C30 56 28 60 28 62 C38 62 48 64 56 66 Z" fill="{CRIMSON}"/>'
        f'<path d="M57 59 C50 49 42 41 33 35 C35 41 37 45 41 49 C37 51 35 53 35 55 C43 57 50 60 56 63 Z" fill="{OCHRE}"/>')
icons['phoenix-rising'] = badge(NIGHT, layer(
    sparkle(30, 82, 2.5, OCHRE) + sparkle(98, 82, 2.5, OCHRE) + sparkle(64, 18, 2.5, CLAY_LT)),
    layer(  # tail plumes, lyre-shaped, with eye-spots
        plume('M62 72 C56 84 44 88 40 98', 5, OCHRE),
        plume('M66 72 C72 84 84 88 88 98', 5, OCHRE),
        plume('M64 74 C64 84 64 92 64 100', 5, CRIMSON),
        f'<circle cx="40" cy="98" r="3.4" fill="{CRIMSON}"/><circle cx="88" cy="98" r="3.4" fill="{CRIMSON}"/>'
        f'<circle cx="64" cy="100" r="3.4" fill="{OCHRE}"/>')
    + layer(  # flames
        f'<path d="M34 112 C26 100 32 92 38 86 C38 94 44 96 46 100 C48 92 54 86 56 80 C60 88 62 94 62 100 '
        f'C64 94 68 88 72 80 C76 88 80 94 82 100 C84 96 90 94 90 86 C96 92 100 102 94 112 Z" fill="{CLAY}"/>'
        f'<path d="M44 112 C40 104 44 98 48 94 C48 100 52 102 54 104 C56 98 60 92 64 88 C68 94 72 100 74 104 '
        f'C76 102 80 100 80 96 C86 102 86 108 84 112 Z" fill="{OCHRE}"/>')
    + layer(  # ash heap
        f'<path d="M16 116 Q30 104 46 108 Q56 100 70 108 Q86 102 112 116 Z" fill="{ASH}"/>'
        f'<circle cx="38" cy="111" r="1.6" fill="{OCHRE}" stroke="none"/><circle cx="84" cy="110" r="1.6" fill="{CLAY}" stroke="none"/>')
    + layer(WING, f'<g transform="translate(128 0) scale(-1 1)">{WING}</g>')
    + layer(  # body with a golden breast
        f'<path d="M56 74 C52 64 56 50 64 48 C72 50 76 64 72 74 C68 78 60 78 56 74 Z" fill="{CRIMSON}"/>'
        f'<path d="M60 70 C60 62 62 56 64 54 C66 56 68 62 68 70 Z" fill="{OCHRE}" stroke="none" opacity="0.85"/>')
    + layer(  # head, golden crest, hooked beak
        f'<path d="M62 36 C58 30 54 28 50 28 C54 32 56 35 58 39 Z M64 34 C62 28 60 24 56 22 C59 27 60 31 61 36 Z" fill="{OCHRE}"/>'
        f'<circle cx="66" cy="40" r="7.5" fill="{CRIMSON}"/>'
        f'<path d="M72 38 C78 37 81 41 78 46 C77 43 75 43 72 43 Z" fill="{OCHRE}"/>'
        f'<circle cx="68" cy="38.5" r="2.2" fill="{OCHRE}"/><circle cx="68.5" cy="38.5" r="1" fill="{INK}" stroke="none"/>')
)

# ---- Grand Theft: while its owner dozes, a raccoon tiptoes off with the Grand crown.
icons['grand-theft'] = badge(PAPER, layer(
    f'<path d="M14 104 Q64 98 114 104 L114 120 L14 120 Z" fill="{CLAY_LT}" stroke="none"/>'),
    layer(  # the owner, staring at a butterfly, oblivious
        f'<path d="M30 106 L31 96 M42 106 L41 96" stroke="{INK}" stroke-width="4"/>'
        f'<path d="M24 98 Q22 74 36 72 Q50 74 48 98 Z" fill="{TEAL}"/>'
        f'<path d="M28 80 Q20 66 24 56" fill="none" stroke="{INK}" stroke-width="7"/>'
        f'<path d="M28 80 Q20 66 24 56" fill="none" stroke="{TEAL}" stroke-width="4"/>'
        f'<circle cx="24" cy="54" r="3" fill="{SKIN}"/>'
        f'<circle cx="38" cy="60" r="11" fill="{SKIN}"/>'
        f'<path d="M30 54 Q34 46 44 48 Q50 52 48 62 Q44 56 38 54 Z" fill="{HAIR}"/>'
        f'<circle cx="33" cy="58" r="1.7" fill="{INK}" stroke="none"/>'
        f'<path d="M30 64 Q33 67 36 65" fill="none" stroke-width="1.5"/>')
    + layer(  # the butterfly
        f'<path d="M30 32 Q22 24 22 32 Q22 38 30 34 Q24 42 30 40 Q34 38 31 33 Z" fill="{ROSE}"/>'
        f'<path d="M31 33 Q40 24 40 32 Q40 38 32 35 Q38 42 32 40 Z" fill="{ROSE}"/>'
        f'<path d="M28 26 l-2 -4 M33 26 l2 -4" stroke-width="1.2"/>'
        f'<path d="M36 44 q2 -3 0 -5 M40 44 q3 -2 2 -5" fill="none" stroke="{INK}" stroke-width="1.2" stroke-dasharray="2 2"/>')
    + layer(  # raccoon tail
        f'<path d="M98 92 C112 90 114 74 106 68 C108 80 102 86 94 86 Z" fill="{STONE}"/>'
        f'<path d="M105 72 L110 74 M107 79 L112 80 M103 86 L107 90" stroke="{INK}" stroke-width="3"/>')
    + layer(  # body on tiptoe
        f'<path d="M74 106 L76 96 M92 106 L90 96" stroke="{INK}" stroke-width="4"/>'
        f'<ellipse cx="84" cy="84" rx="15" ry="15" fill="{STONE}"/>'
        f'<ellipse cx="84" cy="88" rx="8" ry="8" fill="{PAPER}"/>')
    + layer(  # head: mask, sly side-eye toward the sleeper, grin
        f'<path d="M70 44 L68 32 L78 38 Z M100 44 L102 32 L92 38 Z" fill="{STONE_DK}"/>'
        f'<path d="M66 54 Q70 38 85 38 Q100 38 104 54 Q100 68 85 70 Q70 68 66 54 Z" fill="{STONE}"/>'
        f'<path d="M67 52 Q85 44 103 52 L101 60 Q85 54 69 60 Z" fill="{INK}"/>'
        f'<circle cx="76" cy="54" r="2.8" fill="{WHITE}" stroke="none"/><circle cx="93" cy="54" r="2.8" fill="{WHITE}" stroke="none"/>'
        f'<circle cx="75" cy="54" r="1.3" fill="{INK}" stroke="none"/><circle cx="92" cy="54" r="1.3" fill="{INK}" stroke="none"/>'
        f'<circle cx="85" cy="62" r="2" fill="{INK}" stroke="none"/>'
        f'<path d="M79 65 Q85 69 91 64" fill="none" stroke-width="1.6"/>')
    + layer(  # the crown, clutched to its chest
        f'<path d="M64 86 L61 72 L69 77 L76 66 L83 77 L91 72 L88 86 Z" fill="{BLUE}"/>'
        f'<rect x="64" y="83" width="24" height="5" rx="1.5" fill="{BLUE_DK}"/>'
        f'<circle cx="61" cy="71" r="2.2" fill="{OCHRE}"/><circle cx="76" cy="65" r="2.2" fill="{OCHRE}"/><circle cx="91" cy="71" r="2.2" fill="{OCHRE}"/>'
        f'<ellipse cx="64" cy="86" rx="3.5" ry="3" fill="{STONE_DK}"/><ellipse cx="88" cy="86" rx="3.5" ry="3" fill="{STONE_DK}"/>')
    + layer(f'<path d="M66 102 l-5 -2 M68 108 l-6 0" stroke="{INK}" stroke-width="1.8"/>')
)

# ---- Lazarus: a delighted zombie sits up out of a fresh grave by moonlight.
stars = ''.join(sparkle(x, y, s, CREAM) for x, y, s in [(30, 34, 3), (46, 22, 2.5), (100, 44, 2.5)])
icons['lazarus'] = badge(NIGHT, layer(
    f'<circle cx="88" cy="30" r="11" fill="{CREAM}" stroke="none"/>'
    f'<circle cx="84" cy="27" r="2.5" fill="{PAPER}" stroke="none"/>' + stars),
    layer(  # tombstone behind
        f'<path d="M22 92 L22 50 A16 16 0 0 1 54 50 L54 92 Z" fill="{STONE}"/>'
        f'<path d="M30 54 L46 54 M38 46 L38 66" stroke="{STONE_DK}" stroke-width="3"/>'
        f'<path d="M48 40 l-4 8 l4 4 l-3 6" fill="none" stroke="{INK}" stroke-width="1.5"/>')
    + layer(  # zombie: arms flung up in a ta-da, head, shoulders
        f'<path d="M50 82 C44 74 40 64 34 58" fill="none" stroke="{INK}" stroke-width="10"/>'
        f'<path d="M50 82 C44 74 40 64 34 58" fill="none" stroke="{SAP}" stroke-width="6"/>'
        f'<path d="M84 82 C92 74 96 64 100 56" fill="none" stroke="{INK}" stroke-width="10"/>'
        f'<path d="M84 82 C92 74 96 64 100 56" fill="none" stroke="{SAP}" stroke-width="6"/>'
        f'<circle cx="33" cy="56" r="5" fill="{SAP}"/><circle cx="101" cy="54" r="5" fill="{SAP}"/>'
        f'<path d="M48 100 Q50 80 68 78 Q86 80 88 100 Z" fill="{VIOLET}"/>'
        f'<path d="M56 86 l3 4 M76 84 l3 5" stroke="{INK}" stroke-width="1.5"/>')
    + layer(
        f'<ellipse cx="68" cy="62" rx="17" ry="16" fill="{SAP}"/>'
        f'<circle cx="61" cy="59" r="5.5" fill="{WHITE}"/><circle cx="76" cy="59" r="3.8" fill="{WHITE}"/>'
        f'<circle cx="62" cy="60" r="2" fill="{INK}" stroke="none"/><circle cx="76" cy="60" r="1.6" fill="{INK}" stroke="none"/>'
        f'<path d="M60 70 Q68 78 77 70 Z" fill="{CLAY_DK}"/>'
        f'<path d="M64 71 l0 3 M71 71 l0 3" stroke="{WHITE}" stroke-width="1.6"/>'
        f'<path d="M74 48 l4 3 M76 46 l-1 5 M79 47 l-2 5" stroke="{INK}" stroke-width="1.2"/>'
        f'<path d="M56 48 Q60 44 66 46" fill="none" stroke="{SAP_DK}" stroke-width="3"/>')
    + layer(  # dirt mound in front
        f'<path d="M14 120 L14 102 Q30 90 48 96 Q66 86 86 96 Q104 90 114 102 L114 120 Z" fill="{CLAY_DK}"/>'
        f'<circle cx="34" cy="104" r="2" fill="{CLAY}" stroke="none"/><circle cx="74" cy="100" r="2.4" fill="{CLAY}" stroke="none"/>'
        f'<circle cx="96" cy="106" r="2" fill="{CLAY}" stroke="none"/>')
)

# ---- Photo Finish: two horses at full gallop hit the line nose to nose; the
# camera flashes.
def horse(dx, dy, coat, mane, cloth, s=0.9):
    leg = lambda d: (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="6.5"/>'
                     f'<path d="{d}" fill="none" stroke="{coat}" stroke-width="3.6"/>')
    return layer(
        f'<g transform="translate({dx} {dy}) scale({s})">'
        # far legs, then tail, body, near legs
        + leg('M42 32 L52 38 L58 36') + leg('M16 32 L6 38 L0 44')
        + f'<path d="M10 20 C2 18 -6 24 -10 32 C-2 30 4 28 10 26 Z" fill="{mane}"/>'
        f'<path d="M10 20 C14 14 30 12 40 14 C44 10 46 4 50 0 L51 -5 L54 1 C58 2 62 6 64 11 '
        f'C64 14 61 15 58 13 C54 11 51 13 49 18 C48 24 45 30 39 32 C30 34 18 34 12 30 C8 28 8 24 10 20 Z" fill="{coat}"/>'
        f'<path d="M40 14 C44 9 46 5 50 0 L46 3 C42 7 38 11 35 14 Z" fill="{mane}"/>'
        f'<path d="M22 15 L34 14 L35 24 L23 25 Z" fill="{cloth}"/>'
        f'<circle cx="54" cy="5" r="1.6" fill="{INK}" stroke="none"/>'
        f'<circle cx="62" cy="11" r="1" fill="{INK}" stroke="none"/>'
        + leg('M38 30 L50 40 L56 40') + leg('M14 30 L4 42 L-2 44')
        + '</g>')
checks = ''.join(
    f'<rect x="{94 + c * 5}" y="{18 + r * 5}" width="5" height="5" fill="{WHITE if (r + c) % 2 == 0 else INK}" stroke="none"/>'
    for r in range(18) for c in range(2))
icons['photo-finish'] = badge(SKY, layer(
    f'<path d="M14 92 Q64 86 114 92 L114 120 L14 120 Z" fill="{SAP}" stroke="none"/>'
    f'<path d="M14 100 Q64 94 114 100" fill="none" stroke="{WHITE}" stroke-width="2" opacity="0.7"/>'),
    horse(36, 36, INDIGO, INK, ROSE)
    + layer(checks, f'<rect x="94" y="18" width="10" height="90" fill="none"/>')
    + horse(37, 62, CLAY, CLAY_DK, TEAL)
    + layer(sparkle(30, 30, 7, WHITE), f'<path d="M30 19 L30 15 M19 30 L15 30 M38 22 L41 19" stroke="{OCHRE}" stroke-width="2"/>')
)

# ---- Wire to Wire: the tortoise breaks the tape, never once passed; the hare
# is still way back up the hill.
icons['wire-to-wire'] = badge(SKY, layer(
    f'<path d="M14 64 Q40 52 64 62 L64 120 L14 120 Z" fill="{SAP_DK}" stroke="none"/>'
    f'<path d="M14 92 Q64 84 114 92 L114 120 L14 120 Z" fill="{SAP}" stroke="none"/>'),
    layer(  # the hare, far behind on the hill, dumbfounded
        f'<path d="M30 52 C28 44 30 38 33 38 C35 42 34 48 33 52 Z M35 52 C35 44 38 40 40 40 C41 44 39 49 37 53 Z" fill="{WHITE}"/>'
        f'<ellipse cx="34" cy="58" rx="7" ry="6" fill="{WHITE}"/>'
        f'<circle cx="32" cy="57" r="1.2" fill="{INK}" stroke="none"/><circle cx="36" cy="57" r="1.2" fill="{INK}" stroke="none"/>'
        f'<ellipse cx="34" cy="61" rx="1.4" ry="1.8" fill="{INK}" stroke="none"/>')
    + layer(  # finish posts and the snapping tape
        f'<path d="M96 100 L96 50" stroke="{INK}" stroke-width="3"/>'
        + ''.join(f'<rect x="{96 + c * 5}" y="{50 + r * 5}" width="5" height="5" fill="{WHITE if (r + c) % 2 == 0 else INK}" stroke="none"/>'
                  for r in range(3) for c in range(3))
        + f'<rect x="96" y="50" width="15" height="15" fill="none"/>')
    + layer(  # the tortoise: stubby legs, dome shell, chin up
        f'<path d="M48 98 L46 104 M58 99 L58 105 M72 99 L72 105 M80 98 L82 104" stroke="{INK}" stroke-width="5"/>'
        f'<path d="M48 98 L46 104 M58 99 L58 105 M72 99 L72 105 M80 98 L82 104" stroke="{SAP}" stroke-width="2.6"/>'
        f'<path d="M42 98 Q42 70 64 70 Q86 70 86 98 Z" fill="{OCHRE}"/>'
        f'<path d="M54 98 L56 84 L64 78 L72 84 L74 98 M56 84 L46 88 M72 84 L82 88 M64 78 L64 71" fill="none" stroke="{OCHRE_DK}" stroke-width="2"/>'
        f'<path d="M84 92 Q90 82 98 80 Q106 80 106 86 Q104 92 96 92 Z" fill="{SAP}"/>'
        f'<circle cx="100" cy="84" r="1.6" fill="{INK}" stroke="none"/>'
        f'<path d="M98 88 Q101 90 104 88" fill="none" stroke-width="1.3"/>')
    + layer(f'<path d="M36 78 L26 78 M36 86 L22 86 M38 94 L28 94" stroke="{WHITE}" stroke-width="2.2"/>'
            + sparkle(110, 76, 3.5, CREAM) + sparkle(84, 62, 3, CREAM))
)

# ---- Hat Trick: a rabbit sits in an upturned top hat, fanning three cards.
def card(x, y, w, h, rot, cx, cy, pip):
    return (f'<g transform="rotate({rot} {cx} {cy})"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2.5" fill="{WHITE}"/>'
            f'<path d="M{x + w / 2} {y + h / 2 - 5} L{x + w / 2 + 4} {y + h / 2} L{x + w / 2} {y + h / 2 + 5} '
            f'L{x + w / 2 - 4} {y + h / 2} Z" fill="{pip}" stroke="none"/></g>')
icons['hat-trick'] = badge(TEAL, '',
    layer(  # back of the brim and the hat's dark inside
        f'<ellipse cx="62" cy="80" rx="32" ry="8" fill="{NIGHT}"/>'
        f'<ellipse cx="62" cy="80" rx="23" ry="5" fill="{INK}"/>')
    + layer(  # ears
        f'<path d="M54 48 C46 32 46 16 54 12 C62 18 62 34 60 48 Z" fill="{WHITE}"/>'
        f'<path d="M54 44 C50 32 50 20 54 17 C58 22 58 34 57 44 Z" fill="{ROSE}" stroke="none"/>'
        f'<path d="M68 48 C72 34 78 20 86 18 C90 26 82 38 74 50 Z" fill="{WHITE}"/>'
        f'<path d="M70 46 C74 36 78 26 84 23 C86 29 80 38 73 47 Z" fill="{ROSE}" stroke="none"/>')
    + layer(  # body sitting down in the hat, head on top
        f'<path d="M46 84 Q44 66 62 64 Q80 66 78 84 Z" fill="{WHITE}"/>'
        f'<ellipse cx="62" cy="60" rx="15" ry="13" fill="{WHITE}"/>'
        f'<circle cx="57" cy="58" r="2.2" fill="{INK}" stroke="none"/><circle cx="68" cy="58" r="2.2" fill="{INK}" stroke="none"/>'
        f'<path d="M60.5 63.5 L64 63.5 L62.2 66 Z" fill="{ROSE}" stroke-width="1"/>'
        f'<path d="M62 66 Q58.5 69.5 57 67 M62 66 Q65.5 69.5 67 67" fill="none" stroke-width="1.3"/>'
        f'<circle cx="52" cy="64" r="2.8" fill="{ROSE}" stroke="none" opacity="0.5"/><circle cx="72" cy="64" r="2.8" fill="{ROSE}" stroke="none" opacity="0.5"/>')
    + layer(  # cards fanned in its paws
        card(78, 50, 14, 20, -24, 85, 74, CLAY),
        card(78, 48, 14, 20, 0, 85, 74, INDIGO),
        card(78, 50, 14, 20, 24, 85, 74, SAP),
        f'<ellipse cx="80" cy="72" rx="4.5" ry="3.6" fill="{WHITE}"/><ellipse cx="88" cy="73" rx="4.5" ry="3.6" fill="{WHITE}"/>')
    + layer(  # front of the hat: the crown below and the front lip of the brim
        f'<path d="M40 82 L44 108 Q62 114 80 108 L84 82 Z" fill="{NIGHT}"/>'
        f'<path d="M42 94 L82 94 L81 101 L43 101 Z" fill="{CLAY}"/>'
        f'<path d="M30 80 A32 8 0 0 0 94 80 L85 80 A23 5 0 0 1 39 80 Z" fill="{NIGHT}"/>')
    + layer(sparkle(26, 50, 5, CREAM), sparkle(102, 36, 4.5, CREAM), sparkle(32, 28, 3, OCHRE))
)

# ---- Ganis!: all fourteen cards fanned into a rainbow.
fan = ''
pips = [CLAY, INDIGO, SAP, ROSE]
for i in range(14):
    a = -78 + i * 12
    fill = CREAM if i in (0, 13) else WHITE
    pip = OCHRE if i in (0, 13) else pips[i % 4]
    fan += (f'<g transform="rotate({a} 64 96)"><rect x="57" y="34" width="14" height="32" rx="2.5" fill="{fill}"/>'
            f'<circle cx="64" cy="41" r="3" fill="{pip}" stroke="none"/></g>')
icons['ganis'] = badge(VIOLET, '',
    layer(fan)
    + layer(f'<circle cx="64" cy="96" r="13" fill="{OCHRE}"/>'
            f'<text x="64" y="101.5" font-family="system-ui, sans-serif" font-size="14" font-weight="900" '
            f'text-anchor="middle" fill="{INK}" stroke="none">14</text>')
    + layer(sparkle(64, 22, 5, CREAM), sparkle(24, 60, 3.5, CREAM), sparkle(104, 60, 3.5, CREAM))
)

# ---- Score-Based Grand: a tiny player in a Grand crown shrugs up at a giant.
icons['score-based-grand'] = badge(SKY, layer(
    f'<path d="M14 100 Q64 94 114 100 L114 120 L14 120 Z" fill="{SAP}" stroke="none"/>'
    f'<circle cx="34" cy="34" r="8" fill="{WHITE}" stroke="none" opacity="0.7"/>'
    f'<circle cx="42" cy="32" r="6" fill="{WHITE}" stroke="none" opacity="0.7"/>'),
    layer(  # the giant: only its legs and boots fit in frame
        f'<path d="M70 10 L72 92 L88 92 L90 10 Z M92 10 L96 92 L110 92 L112 10 Z" fill="{INDIGO}"/>'
        f'<path d="M68 88 Q66 104 72 106 L94 106 Q96 98 90 88 Z" fill="{HAIR}"/>'
        f'<path d="M94 88 Q92 104 98 106 L118 106 Q120 98 112 88 Z" fill="{HAIR}"/>'
        f'<path d="M70 40 L88 40 M94 40 L111 40" stroke="{NIGHT}" stroke-width="2"/>')
    + layer(  # the little player: shoulders up, palms up, eyebrows up
        f'<path d="M34 106 L35 98 M44 106 L43 98" stroke="{INK}" stroke-width="3.5"/>'
        f'<path d="M30 100 Q28 82 39 80 Q50 82 48 100 Z" fill="{CLAY}"/>'
        f'<path d="M32 86 L24 88 L20 80" fill="none" stroke="{INK}" stroke-width="6"/>'
        f'<path d="M32 86 L24 88 L20 80" fill="none" stroke="{CLAY}" stroke-width="3.5"/>'
        f'<path d="M46 86 L54 88 L58 80" fill="none" stroke="{INK}" stroke-width="6"/>'
        f'<path d="M46 86 L54 88 L58 80" fill="none" stroke="{CLAY}" stroke-width="3.5"/>'
        f'<ellipse cx="19" cy="78" rx="3.5" ry="2.2" fill="{SKIN}"/><ellipse cx="59" cy="78" rx="3.5" ry="2.2" fill="{SKIN}"/>'
        f'<circle cx="39" cy="70" r="10" fill="{SKIN}"/>'
        f'<circle cx="38" cy="69" r="1.5" fill="{INK}" stroke="none"/><circle cx="44" cy="68" r="1.5" fill="{INK}" stroke="none"/>'
        f'<path d="M35 64 l4 -1 M42 63 l4 0" stroke-width="1.4"/>'
        f'<path d="M37 75 Q41 73 45 75" fill="none" stroke-width="1.4"/>')
    + layer(  # its (much too big) Grand crown
        f'<path d="M29 62 L27 50 L34 55 L39 46 L44 55 L51 50 L49 62 Z" fill="{BLUE}"/>'
        f'<circle cx="27" cy="49" r="2" fill="{OCHRE}"/><circle cx="39" cy="45" r="2" fill="{OCHRE}"/><circle cx="51" cy="49" r="2" fill="{OCHRE}"/>')
)

# ---- Careful What You Wish For: the lamp's wish-smoke billows up into... a bomb.
icons['wish-bomb'] = badge(VIOLET, layer(
    sparkle(26, 40, 2.5, CREAM) + sparkle(40, 24, 2, CREAM) + sparkle(104, 76, 2.5, CREAM)),
    layer(  # mist ribbon rising from the spout
        f'<path d="M34 86 C26 74 40 70 36 60 C32 50 46 46 52 52" fill="none" stroke="{INK}" stroke-width="11"/>'
        f'<path d="M34 86 C26 74 40 70 36 60 C32 50 46 46 52 52" fill="none" stroke="{TEAL}" stroke-width="7"/>')
    + layer(  # the wish cloud
        f'<path d="M50 60 C40 60 40 44 52 44 C52 30 70 26 76 36 C84 26 102 32 98 46 C108 48 106 64 94 62 '
        f'C90 70 74 70 70 64 C64 70 52 68 50 60 Z" fill="{CREAM}"/>')
    + bomb(76, 50, 11, face=f'<circle cx="72" cy="50" r="1.6" fill="{WHITE}" stroke="none"/>'
                             f'<circle cx="79" cy="50" r="1.6" fill="{WHITE}" stroke="none"/>'
                             f'<path d="M72 55 Q76 58 80 55" fill="none" stroke="{WHITE}" stroke-width="1.4"/>')
    + layer(  # the lamp
        f'<path d="M20 86 Q30 82 38 88 L44 92 Z" fill="{OCHRE}"/>'
        f'<path d="M40 96 Q42 82 66 82 Q90 82 92 96 Q86 104 66 104 Q46 104 40 96 Z" fill="{OCHRE}"/>'
        f'<path d="M90 88 Q104 84 102 96 Q100 102 90 100" fill="none" stroke="{INK}" stroke-width="6"/>'
        f'<path d="M90 88 Q104 84 102 96 Q100 102 90 100" fill="none" stroke="{OCHRE}" stroke-width="3"/>'
        f'<path d="M54 82 Q66 72 78 82 Z" fill="{OCHRE_DK}"/>'
        f'<circle cx="66" cy="74" r="3" fill="{OCHRE}"/>'
        f'<path d="M58 108 L74 108 L70 104 L62 104 Z" fill="{OCHRE_DK}"/>'
        f'<path d="M48 92 Q66 98 84 92" fill="none" stroke="{CLAY_DK}" stroke-width="1.6"/>')
)

# ---- Super Partner: bomb the trick, then lead the Dog — a caped Dog rockets
# out of the blast to its partner.
burst2 = []
for i in range(20):
    a = 2 * math.pi * i / 20
    rr = 30 if i % 2 == 0 else 20
    burst2.append(f'{40 + rr * math.cos(a):.1f} {84 + rr * math.sin(a):.1f}')
icons['super-partner'] = badge(SKY, layer(
    f'<path d="M{" L".join(burst2)} Z" fill="{OCHRE}" stroke="none"/>'
    f'<circle cx="40" cy="84" r="10" fill="{CLAY_LT}" stroke="none"/>'
    f'<circle cx="96" cy="40" r="7" fill="{WHITE}" stroke="none" opacity="0.7"/>'
    f'<circle cx="104" cy="44" r="5" fill="{WHITE}" stroke="none" opacity="0.7"/>'),
    layer(  # speed lines
        f'<path d="M30 70 L46 62 M34 80 L50 72 M40 90 L54 80" stroke="{INK}" stroke-width="2"/>')
    + layer(  # the cape, streaming back
        f'<path d="M62 58 C52 62 44 72 40 82 C48 78 52 80 56 78 C56 74 60 70 66 68 Z" fill="{CRIMSON}"/>')
    + layer(  # the Dog in flight: front paw forward, back legs streaming
        f'<path d="M58 72 L48 80 M62 74 L54 84" stroke="{INK}" stroke-width="6"/>'
        f'<path d="M58 72 L48 80 M62 74 L54 84" stroke="{CREAM}" stroke-width="3.4"/>'
        f'<path d="M56 66 Q60 52 78 50 Q92 50 92 58 Q88 70 70 72 Q60 74 56 66 Z" fill="{CREAM}"/>'
        f'<path d="M66 60 q4 -4 8 0" fill="none" stroke="{CLAY}" stroke-width="2.6"/>')
    + layer(  # head with floppy ear and a little mask
        f'<path d="M80 44 Q80 30 92 30 Q104 32 104 42 Q104 52 92 52 Q82 52 80 44 Z" fill="{CREAM}"/>'
        f'<path d="M84 34 Q74 32 74 44 Q78 46 84 40 Z" fill="{HAIR}"/>'
        f'<path d="M86 38 Q94 34 102 38 L101 42 Q94 40 87 42 Z" fill="{CRIMSON}"/>'
        f'<circle cx="92" cy="39.5" r="1.4" fill="{WHITE}" stroke="none"/><circle cx="99" cy="39.5" r="1.4" fill="{WHITE}" stroke="none"/>'
        f'<ellipse cx="104" cy="44" rx="2.2" ry="1.8" fill="{INK}"/>'
        f'<path d="M94 47 Q98 50 102 47" fill="none" stroke-width="1.4"/>')
    + layer(  # one paw thrust forward, Superman-style
        f'<path d="M80 58 Q96 58 110 50" fill="none" stroke="{INK}" stroke-width="6.5"/>'
        f'<path d="M80 58 Q96 58 110 50" fill="none" stroke="{CREAM}" stroke-width="3.8"/>'
        f'<circle cx="110" cy="49" r="3.4" fill="{CREAM}"/>')
    + layer(sparkle(104, 68, 4, CREAM), sparkle(70, 26, 3.5, CREAM))
)

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for name, svg in icons.items():
    with open(os.path.join(out, f'{name}.svg'), 'w') as f:
        f.write(svg)
print('wrote', len(icons))
