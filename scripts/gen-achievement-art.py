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
STONE, STONE_DK, ASH, ASH_DK = '#B7B1C2', '#8C8699', '#A39D97', '#77716C'
BLUE, BLUE_DK = '#4F7BD6', '#2F3C7A'  # Grand Tichu blue
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

# ---- Friendly Fire: you bombed your own Dragon. It is sooty, frazzled, betrayed.
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
        f'<path d="M84 98 Q100 100 104 88" fill="none" stroke="{CLAY}" stroke-width="4"/>'
        f'<path d="M104 80 L110 90 L100 90 Z" fill="{CLAY}"/>'
        f'<path d="M44 106 Q40 74 64 70 Q88 74 84 106 Z" fill="{CLAY}"/>'
        f'<path d="M54 106 Q52 84 64 82 Q76 84 74 106 Z" fill="{OCHRE}"/>'
        f'<path d="M55 90 L73 90 M54 97 L74 97" stroke="{OCHRE_DK}" stroke-width="1.4"/>'
        f'<ellipse cx="52" cy="107" rx="7" ry="3.5" fill="{CLAY}"/><ellipse cx="76" cy="107" rx="7" ry="3.5" fill="{CLAY}"/>')
    + layer(  # head: spiky crest, long snout, fangs, soot, stunned eyes
        f'<path d="M50 36 L54 22 L60 32 L64 18 L68 32 L74 22 L78 36 Z" fill="{OCHRE}"/>'
        f'<path d="M42 50 Q42 32 64 32 Q86 32 86 50 Q86 60 80 64 Q64 70 48 64 Q42 60 42 50 Z" fill="{CLAY}"/>'
        f'<path d="M50 58 Q50 52 64 52 Q78 52 78 58 Q78 68 64 68 Q50 68 50 58 Z" fill="{CLAY_LT}"/>'
        f'<ellipse cx="59" cy="57" rx="1.8" ry="1.2" fill="{INK}" stroke="none"/><ellipse cx="69" cy="57" rx="1.8" ry="1.2" fill="{INK}" stroke="none"/>'
        f'<path d="M56 66 L58 71 L60 66 Z M68 66 L70 71 L72 66 Z" fill="{WHITE}" stroke-width="1.2"/>'
        f'<path d="M44 46 Q50 40 56 48 Q50 52 44 46 Z M72 48 Q80 40 86 46 Q80 52 72 48 Z M60 36 Q66 32 70 38 Q64 40 60 36 Z" '
        f'fill="{INK}" stroke="none" opacity="0.5"/>'
        f'<circle cx="55" cy="45" r="5.5" fill="{WHITE}"/><circle cx="73" cy="45" r="5.5" fill="{WHITE}"/>'
        f'<circle cx="55" cy="45" r="1.6" fill="{INK}" stroke="none"/><circle cx="73" cy="45" r="1.6" fill="{INK}" stroke="none"/>')
    + layer(  # the culprit: a spent bomb, still smoking
        f'<ellipse cx="34" cy="98" rx="9" ry="8" fill="{NIGHT}"/>'
        f'<path d="M35 90 L37 85" stroke="{INK}" stroke-width="3"/>'
        f'<path d="M38 83 q-4 -5 1 -9 q5 -4 1 -9" fill="none" stroke="{ASH_DK}" stroke-width="2.2"/>')
    + layer(  # frazzled smoke curls off the head
        f'<path d="M56 22 q-4 -4 1 -7" fill="none" stroke="{ASH_DK}" stroke-width="2.2"/>'
        f'<path d="M73 22 q4 -4 -1 -7" fill="none" stroke="{ASH_DK}" stroke-width="2.2"/>')
)

# ---- Phoenix Rising: flames lick up out of a heap of ash; the phoenix bursts free.
icons['phoenix-rising'] = badge(CREAM, layer(
    f'<path d="M14 104 Q64 92 114 104 L114 120 L14 120 Z" fill="{PAPER}" stroke="none"/>'),
    layer(  # flames
        f'<path d="M44 100 C34 86 42 72 48 66 C48 76 54 80 56 86 C58 76 62 70 64 58 C70 70 76 76 74 88 '
        f'C78 82 80 76 82 70 C90 80 92 92 84 100 Z" fill="{CLAY}"/>'
        f'<path d="M52 100 C48 92 52 84 56 80 C56 86 60 90 62 94 C64 86 66 80 68 74 C74 84 76 92 72 100 Z" fill="{OCHRE}"/>')
    + layer(  # ash heap with embers
        f'<path d="M24 106 Q40 90 56 96 Q64 88 74 96 Q90 88 104 106 Z" fill="{ASH}"/>'
        f'<path d="M36 102 Q46 96 54 100 M70 100 Q80 95 90 102" fill="none" stroke="{ASH_DK}" stroke-width="1.6"/>'
        f'<circle cx="46" cy="101" r="1.8" fill="{CLAY}" stroke="none"/><circle cx="82" cy="100" r="1.8" fill="{CLAY}" stroke="none"/>'
        f'<circle cx="62" cy="99" r="1.5" fill="{OCHRE}" stroke="none"/>')
    + layer(  # wings, up and out
        f'<path d="M60 56 C46 56 32 46 24 26 C34 34 40 34 44 32 C40 40 46 44 52 44 C50 48 54 52 60 50 Z" fill="{CLAY}"/>'
        f'<path d="M60 54 C50 54 42 48 38 40 C44 44 50 44 58 46 Z" fill="{OCHRE}"/>'
        f'<path d="M68 56 C82 56 96 46 104 26 C94 34 88 34 84 32 C88 40 82 44 76 44 C78 48 74 52 68 50 Z" fill="{CLAY}"/>'
        f'<path d="M68 54 C78 54 86 48 90 40 C84 44 78 44 70 46 Z" fill="{OCHRE}"/>')
    + layer(  # body, head, crest
        f'<path d="M56 76 C52 66 56 52 64 46 C72 52 76 66 72 76 C68 80 60 80 56 76 Z" fill="{ROSE}"/>'
        f'<path d="M60 34 C58 28 62 24 64 20 C64 26 68 26 68 32 Z" fill="{OCHRE}"/>'
        f'<circle cx="64" cy="40" r="8" fill="{CLAY}"/>'
        f'<path d="M71 40 l8 3 l-8 3 Z" fill="{OCHRE}"/>'
        f'<circle cx="66" cy="38" r="1.8" fill="{INK}" stroke="none"/>')
    + layer(sparkle(30, 64, 4), sparkle(98, 62, 4), sparkle(88, 84, 3, ROSE))
)

# ---- Grand Theft: while its owner dozes, a raccoon tiptoes off with the Grand crown.
icons['grand-theft'] = badge(PAPER, layer(
    f'<path d="M14 104 Q64 98 114 104 L114 120 L14 120 Z" fill="{CLAY_LT}" stroke="none"/>'),
    layer(  # the sleeping owner: a little clay card-player, bare-headed now
        f'<rect x="20" y="70" width="34" height="28" rx="4" fill="{CLAY}"/>'
        f'<path d="M24 98 L24 106 M32 98 L32 106 M42 98 L42 106 M50 98 L50 106" stroke="{INK}" stroke-width="3.5"/>'
        f'<path d="M28 82 q3 3 6 0 M40 82 q3 3 6 0" fill="none" stroke="{INK}" stroke-width="2"/>'
        f'<ellipse cx="37" cy="90" rx="3" ry="2" fill="{CLAY_DK}"/>')
    + layer(  # zzz
        f'<text x="24" y="62" font-family="system-ui, sans-serif" font-size="9" font-weight="900" fill="{INDIGO}" stroke="none">z</text>'
        f'<text x="30" y="54" font-family="system-ui, sans-serif" font-size="12" font-weight="900" fill="{INDIGO}" stroke="none">Z</text>')
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

# ---- Photo Finish: two horses hit the line nose to nose; the camera flashes.
def horse(dx, dy, coat, mane, cap):
    return layer(
        f'<g transform="translate({dx} {dy}) scale(0.72)">'
        f'<path d="M-6 60 C-6 40 0 26 12 16 L12 8 L18 14 C28 14 40 20 48 28 C52 32 51 39 45 40 '
        f'C38 40 30 37 26 38 C22 44 20 52 22 60 Z" fill="{coat}"/>'
        f'<path d="M12 16 C4 24 -2 36 -6 48 L-10 40 C-6 30 0 20 10 12 Z" fill="{mane}"/>'
        f'<circle cx="24" cy="22" r="2.4" fill="{INK}" stroke="none"/>'
        f'<circle cx="44" cy="34" r="1.6" fill="{INK}" stroke="none"/>'
        f'<path d="M22 30 L36 36 L28 44" fill="none" stroke="{OCHRE}" stroke-width="2"/>'
        f'</g>')
checks = ''.join(
    f'<rect x="{90 + c * 5}" y="{18 + r * 5}" width="5" height="5" fill="{WHITE if (r + c) % 2 == 0 else INK}" stroke="none"/>'
    for r in range(18) for c in range(2))
icons['photo-finish'] = badge(SKY, layer(
    f'<path d="M14 98 Q64 92 114 98 L114 120 L14 120 Z" fill="{SAP}" stroke="none"/>'
    f'<path d="M14 104 Q64 98 114 104" fill="none" stroke="{WHITE}" stroke-width="2" opacity="0.7"/>'),
    horse(54, 30, INDIGO, INK, ROSE)
    + layer(checks, f'<rect x="90" y="18" width="10" height="90" fill="none"/>')
    + horse(55, 62, CLAY, CLAY_DK, TEAL)
    + layer(sparkle(34, 40, 8, WHITE), f'<path d="M34 28 L34 23 M22 40 L17 40 M43 31 L47 27" stroke="{OCHRE}" stroke-width="2"/>')
)

# ---- Wire to Wire: our car leads the whole way round; theirs is still in the mirror.
def car(x, y, body, s=1.0):
    return layer(
        f'<g transform="translate({x} {y}) scale({s})">'
        f'<path d="M-18 4 L-18 -4 Q-16 -8 -8 -8 L-4 -16 L8 -16 L14 -8 Q20 -8 20 -2 L20 4 Z" fill="{body}"/>'
        f'<path d="M-2 -14 L7 -14 L11 -8 L-5 -8 Z" fill="{SKY}"/>'
        f'<circle cx="-10" cy="5" r="5" fill="{INK}"/><circle cx="12" cy="5" r="5" fill="{INK}"/>'
        f'<circle cx="-10" cy="5" r="1.8" fill="{STONE}" stroke="none"/><circle cx="12" cy="5" r="1.8" fill="{STONE}" stroke="none"/>'
        f'</g>')
icons['wire-to-wire'] = badge(SKY, layer(
    f'<path d="M14 70 Q40 60 64 66 Q90 72 114 62 L114 120 L14 120 Z" fill="{SAP}" stroke="none"/>'),
    layer(f'<path d="M10 102 C30 96 40 84 60 84 C80 84 90 72 112 70" fill="none" stroke="{INK}" stroke-width="16"/>'
          f'<path d="M10 102 C30 96 40 84 60 84 C80 84 90 72 112 70" fill="none" stroke="{STONE_DK}" stroke-width="12"/>'
          f'<path d="M10 102 C30 96 40 84 60 84 C80 84 90 72 112 70" fill="none" stroke="{WHITE}" stroke-width="1.6" stroke-dasharray="5 6"/>')
    + layer(f'<path d="M98 72 L98 30" stroke="{INK}" stroke-width="3"/>'
            + ''.join(f'<rect x="{98 + c * 5}" y="{30 + r * 5}" width="5" height="5" fill="{WHITE if (r + c) % 2 == 0 else INK}" stroke="none"/>'
                      for r in range(3) for c in range(4))
            + f'<rect x="98" y="30" width="20" height="15" fill="none"/>')
    + car(28, 90, STONE, 0.6)
    + car(78, 70, CLAY)
    + layer(f'<path d="M50 66 l-8 0 M52 72 l-10 1 M50 78 l-7 1" stroke="{INK}" stroke-width="1.8"/>')
    + layer(sparkle(40, 38, 4, CREAM), sparkle(66, 30, 3, CREAM))
)

# ---- Hat Trick: a rabbit pops out of an upturned top hat, fanning three cards.
def card(x, y, w, h, rot, cx, cy, pip):
    return (f'<g transform="rotate({rot} {cx} {cy})"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="2.5" fill="{WHITE}"/>'
            f'<path d="M{x + w / 2} {y + h / 2 - 5} L{x + w / 2 + 4} {y + h / 2} L{x + w / 2} {y + h / 2 + 5} '
            f'L{x + w / 2 - 4} {y + h / 2} Z" fill="{pip}" stroke="none"/></g>')
icons['hat-trick'] = badge(TEAL, '',
    layer(  # ears
        f'<path d="M52 44 C44 28 44 12 52 8 C60 14 60 30 58 44 Z" fill="{WHITE}"/>'
        f'<path d="M52 40 C48 28 48 16 52 13 C56 18 56 30 55 40 Z" fill="{ROSE}" stroke="none"/>'
        f'<path d="M70 44 C74 30 80 16 88 14 C92 22 84 34 76 46 Z" fill="{WHITE}"/>'
        f'<path d="M72 42 C76 32 80 22 86 19 C88 25 82 34 75 43 Z" fill="{ROSE}" stroke="none"/>')
    + layer(  # head
        f'<ellipse cx="62" cy="58" rx="17" ry="15" fill="{WHITE}"/>'
        f'<circle cx="56" cy="55" r="2.3" fill="{INK}" stroke="none"/><circle cx="68" cy="55" r="2.3" fill="{INK}" stroke="none"/>'
        f'<path d="M60 62 L64 62 L62 65 Z" fill="{ROSE}" stroke-width="1"/>'
        f'<path d="M62 65 Q58 69 56 66 M62 65 Q66 69 68 66" fill="none" stroke-width="1.4"/>'
        f'<circle cx="51" cy="62" r="3" fill="{ROSE}" stroke="none" opacity="0.5"/><circle cx="73" cy="62" r="3" fill="{ROSE}" stroke="none" opacity="0.5"/>')
    + layer(  # fanned cards with a paw
        card(84, 44, 15, 22, -24, 92, 70, CLAY),
        card(84, 42, 15, 22, 0, 92, 70, INDIGO),
        card(84, 44, 15, 22, 24, 92, 70, SAP),
        f'<ellipse cx="86" cy="68" rx="5" ry="4" fill="{WHITE}"/>')
    + layer(  # upturned hat: opening up top, crown below
        f'<path d="M40 76 L44 106 Q62 112 80 106 L84 76 Z" fill="{NIGHT}"/>'
        f'<path d="M42 90 L82 90 L81 98 L43 98 Z" fill="{CLAY}"/>'
        f'<ellipse cx="62" cy="76" rx="32" ry="8" fill="{NIGHT}"/>'
        f'<ellipse cx="62" cy="76" rx="22" ry="4.5" fill="{INK}"/>')
    + layer(f'<ellipse cx="62" cy="74" rx="12" ry="3" fill="{WHITE}" stroke="none"/>')
    + layer(sparkle(26, 52, 5, CREAM), sparkle(104, 34, 4.5, CREAM), sparkle(34, 30, 3, OCHRE))
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

# ---- Score-Based Grand: a Grand crown teetering atop a house of low cards.
def lean(x1, y1, x2, y2, num):
    mx, my = (x1 + x2) / 2, (y1 + y2) / 2
    ang = math.degrees(math.atan2(y2 - y1, x2 - x1)) - 90
    return (f'<g transform="translate({mx} {my}) rotate({ang:.1f})">'
            f'<rect x="-7.5" y="-15" width="15" height="30" rx="2" fill="{WHITE}"/>'
            f'<text x="0" y="4" font-family="system-ui, sans-serif" font-size="10" font-weight="800" '
            f'text-anchor="middle" fill="{STONE_DK}" stroke="none">{num}</text></g>')
icons['score-based-grand'] = badge(SKY, layer(
    f'<path d="M14 104 Q64 100 114 104 L114 120 L14 120 Z" fill="{CLAY_LT}" stroke="none"/>'),
    layer(lean(30, 104, 44, 76, 2), lean(58, 104, 44, 76, 3), lean(70, 104, 84, 76, 2), lean(98, 104, 84, 76, 3))
    + layer(f'<rect x="38" y="73" width="52" height="5" rx="1" fill="{WHITE}"/>')
    + layer(lean(50, 74, 64, 46, 3), lean(78, 74, 64, 46, 2))
    + layer(f'<g transform="rotate(-12 64 36)">'
            f'<path d="M48 44 L45 26 L55 33 L64 20 L73 33 L83 26 L80 44 Z" fill="{BLUE}"/>'
            f'<rect x="48" y="40" width="32" height="6" rx="1.5" fill="{BLUE_DK}"/>'
            f'<circle cx="45" cy="25" r="2.5" fill="{OCHRE}"/><circle cx="64" cy="19" r="2.5" fill="{OCHRE}"/>'
            f'<circle cx="83" cy="25" r="2.5" fill="{OCHRE}"/></g>')
    + layer(f'<path d="M34 34 q-4 2 -3 6 M94 30 q4 2 3 6" fill="none" stroke="{INK}" stroke-width="1.8"/>')
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

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for name, svg in icons.items():
    with open(os.path.join(out, f'{name}.svg'), 'w') as f:
        f.write(svg)
print('wrote', len(icons))
