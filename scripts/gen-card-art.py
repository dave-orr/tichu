"""Generate the papercraft card art in client/public/cards/: the four special
cards and the four suit symbols (suit-*.svg).

Same cut-paper look as the achievement badges (see gen-achievement-art.py),
lighter on the filters since cards render far more often. Art only, on a
transparent background; the card face, border and label come from Card.tsx.

    python3 scripts/gen-card-art.py client/public/cards
"""
import os, sys
INK = '#2B2233'
CREAM, WHITE = '#FFF5E2', '#FFFDF7'
CLAY, CLAY_DK, CLAY_LT = '#D97757', '#A84D33', '#F2A283'
OCHRE, OCHRE_DK = '#E8AA38', '#B9802A'
SAP, SAP_DK, SAP_LT = '#6E9F58', '#4E7A3E', '#A9CF8A'
VIOLET, ROSE, SKY = '#7B5CA8', '#E27A92', '#8EC3E6'
TEAL = '#3A9C98'
CRIMSON, CRIMSON_DK = '#C9374A', '#8E2233'
HAIR, STONE = '#5A3A2A', '#B7B1C2'

DEFS = f'''<defs>
<filter id="cut" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="2" seed="3" result="w"/>
  <feDisplacementMap in="SourceGraphic" in2="w" scale="1.6" xChannelSelector="R" yChannelSelector="G" result="d"/>
  <feDropShadow in="d" dx="0.4" dy="1.2" stdDeviation="0.7" flood-color="{INK}" flood-opacity="0.35"/>
</filter>
<filter id="paper" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="5" result="t"/>
  <feColorMatrix in="t" type="matrix" values="0 0 0 0 0.33  0 0 0 0 0.25  0 0 0 0 0.17  0.3 0 0 0 -0.12" result="g"/>
  <feComposite in="g" in2="SourceAlpha" operator="in" result="grain"/>
  <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="grain"/></feMerge>
</filter>
</defs>'''

def layer(*p): return f'<g filter="url(#cut)">{"".join(p)}</g>'
def svg(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{DEFS}'
            f'<g filter="url(#paper)" stroke="{INK}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n')

art = {}

# Mah Jong: a slim sparrow perched on a bamboo stalk (the 1-of-Bamboo bird).
art['mahjong'] = svg(
    layer(  # bamboo: stalk with nodes, a sprig of leaves
        f'<path d="M4 80 L96 70" stroke="{INK}" stroke-width="9"/>'
        f'<path d="M4 80 L96 70" stroke="{SAP}" stroke-width="6"/>'
        f'<path d="M30 74 L31 80 M62 70 L63 77" stroke="{SAP_DK}" stroke-width="2.4"/>'
        f'<path d="M64 72 C72 82 84 86 92 84 C84 80 76 76 64 72 Z" fill="{SAP_LT}"/>'
        f'<path d="M64 72 C70 88 76 94 80 96 C78 88 72 80 64 72 Z" fill="{SAP}"/>'
        f'<path d="M30 78 C24 88 16 92 8 92 C14 86 22 82 30 78 Z" fill="{SAP_LT}"/>')
    + layer(f'<path d="M34 62 C24 66 14 66 8 62 C16 60 24 56 30 52 Z" fill="{HAIR}"/>')                       # tail
    + layer(f'<path d="M30 58 C30 44 42 34 56 34 C70 34 76 44 74 54 C72 66 60 72 48 72 C38 72 31 66 30 58 Z" fill="{CLAY}"/>'
            f'<path d="M48 72 C58 70 68 64 70 56 C62 60 52 62 44 60 C42 66 44 70 48 72 Z" fill="{CREAM}"/>')  # slim body + breast
    + layer(f'<path d="M36 56 C42 46 52 44 60 48 C54 54 46 58 36 56 Z" fill="{HAIR}"/>'
            f'<path d="M42 53 L52 49 M44 56 L55 52" stroke="{CREAM}" stroke-width="1.3"/>')                   # wing
    + layer(f'<circle cx="64" cy="32" r="12" fill="{CLAY}"/>'
            f'<path d="M57 22 C61 19 69 19 74 24 C68 24 62 25 57 26 Z" fill="{HAIR}"/>'
            f'<path d="M75 32 L85 34.5 L75 37 Z" fill="{OCHRE}"/>'
            f'<circle cx="69" cy="30" r="2.3" fill="{INK}" stroke="none"/><circle cx="70" cy="29" r="0.8" fill="{WHITE}" stroke="none"/>'
            f'<circle cx="62" cy="37" r="2.6" fill="{ROSE}" stroke="none" opacity="0.6"/>')                    # head
    + layer(f'<path d="M46 72 L45 77 M54 71 L54 76" stroke="{OCHRE_DK}" stroke-width="2.4"/>'
            f'<path d="M41 77 Q45 74 49 77 M50 76 Q54 73 58 76" fill="none" stroke="{OCHRE_DK}" stroke-width="2"/>')  # feet gripping
)

# Dog: a (blue!) goldendoodle sitting politely: curly coat, fluffy ears, teddy-bear face.
DOODLE, DOODLE_DK, DOODLE_LT = '#7E9FDB', '#3F5FA8', '#BFD3F2'
def curls(pts, r=3.2):
    return ''.join(f'<path d="M{x - r} {y} a{r} {r} 0 1 1 {2 * r} 0" fill="none" stroke="{DOODLE_DK}" stroke-width="1.5"/>' for x, y in pts)
def fluff(cx, cy, rx, ry, n=14, bump=3.4):
    """A blob with a scalloped, curly outline."""
    import math
    pts = []
    for k in range(n):
        a0 = 2 * math.pi * k / n
        a1 = 2 * math.pi * (k + 1) / n
        x0, y0 = cx + rx * math.cos(a0), cy + ry * math.sin(a0)
        x1, y1 = cx + rx * math.cos(a1), cy + ry * math.sin(a1)
        am = (a0 + a1) / 2
        qx, qy = cx + (rx + bump) * math.cos(am), cy + (ry + bump) * math.sin(am)
        pts.append((x0, y0, qx, qy, x1, y1))
    d = f'M{pts[0][0]:.1f} {pts[0][1]:.1f} ' + ' '.join(f'Q{qx:.1f} {qy:.1f} {x1:.1f} {y1:.1f}' for _, _, qx, qy, x1, y1 in pts) + ' Z'
    return d
art['dog'] = svg(
    layer(f'<path d="{fluff(80, 74, 7, 6, 8, 2.4)}" fill="{DOODLE}"/>')                                     # pom-pom tail
    + layer(f'<path d="{fluff(50, 76, 21, 18, 16, 3)}" fill="{DOODLE}"/>',
            curls([(40, 72), (52, 68), (60, 78), (44, 84), (56, 88)]),
            f'<path d="{fluff(38, 93, 7, 3.6, 8, 1.6)}" fill="{DOODLE_LT}"/><path d="{fluff(62, 93, 7, 3.6, 8, 1.6)}" fill="{DOODLE_LT}"/>')  # body, paws
    + layer(f'<path d="{fluff(27, 42, 9, 15, 10, 3)}" fill="{DOODLE_DK}"/><path d="{fluff(73, 42, 9, 15, 10, 3)}" fill="{DOODLE_DK}"/>')  # floppy curly ears
    + layer(f'<path d="{fluff(50, 34, 20, 19, 16, 3.2)}" fill="{DOODLE}"/>',
            curls([(42, 20), (52, 18), (60, 22), (36, 30), (64, 30)], 2.8),
            f'<ellipse cx="50" cy="44" rx="11" ry="8.5" fill="{DOODLE_LT}"/>'
            f'<circle cx="42" cy="34" r="2.7" fill="{INK}" stroke="none"/><circle cx="58" cy="34" r="2.7" fill="{INK}" stroke="none"/>'
            f'<circle cx="43" cy="33" r="0.9" fill="{WHITE}" stroke="none"/><circle cx="59" cy="33" r="0.9" fill="{WHITE}" stroke="none"/>'
            f'<ellipse cx="50" cy="41" rx="4.4" ry="3.3" fill="{INK}"/>'
            f'<path d="M50 44 Q46 49 43 46 M50 44 Q54 49 57 46" fill="none" stroke-width="1.7"/>'
            f'<path d="M47.5 47.5 Q50 53 52.5 47.5 Z" fill="{ROSE}" stroke-width="1.3"/>')                  # head
    + layer(f'<path d="M36 54 Q50 60 64 54 L64 58 Q50 64 36 58 Z" fill="{OCHRE_DK}"/><circle cx="50" cy="61" r="2.6" fill="{OCHRE}"/>')  # collar
)

# Phoenix: crimson and gold, wings raised, a lush fan of flame-shaped tail plumes.
import math
WING = (f'<path d="M46 46 C40 34 30 22 12 14 C16 24 18 30 22 34 C16 34 12 36 10 40 C18 42 22 44 26 48 '
        f'C20 50 18 54 18 56 C28 56 38 58 46 60 Z" fill="{CRIMSON}"/>'
        f'<path d="M45 49 C40 40 32 33 23 28 C25 34 27 38 31 42 C27 44 25 46 25 48 C33 50 40 53 45 56 Z" fill="{OCHRE}"/>')
def feather(bx, by, tx, ty, w, fill, edge, eye):
    """A broad, gently curving plume from base to tip, gold-edged, with an eye-spot."""
    dx, dy = tx - bx, ty - by
    L = math.hypot(dx, dy); nx, ny = -dy / L, dx / L
    mx, my = bx + dx * .55, by + dy * .55
    c1 = (mx + nx * w, my + ny * w); c2 = (mx - nx * w, my - ny * w)
    tip_c = (tx + dx / L * 4, ty + dy / L * 4)
    d = (f'M{bx} {by} Q{c1[0]:.1f} {c1[1]:.1f} {tx + nx * w * .45:.1f} {ty + ny * w * .45:.1f} '
         f'Q{tip_c[0]:.1f} {tip_c[1]:.1f} {tx - nx * w * .45:.1f} {ty - ny * w * .45:.1f} '
         f'Q{c2[0]:.1f} {c2[1]:.1f} {bx} {by} Z')
    ex, ey = bx + dx * .78, by + dy * .78
    vein = f'M{bx} {by} Q{mx + nx * 1.5:.1f} {my + ny * 1.5:.1f} {bx + dx * .7:.1f} {by + dy * .7:.1f}'
    return (f'<path d="{d}" fill="{fill}"/>'
            f'<path d="{vein}" fill="none" stroke="{edge}" stroke-width="1.3"/>'
            f'<ellipse cx="{ex:.1f}" cy="{ey:.1f}" rx="{w * .38:.1f}" ry="{w * .3:.1f}" fill="{edge}" stroke-width="1.2"/>'
            f'<ellipse cx="{ex:.1f}" cy="{ey:.1f}" rx="{w * .16:.1f}" ry="{w * .13:.1f}" fill="{eye}" stroke="none"/>')
art['phoenix'] = svg(
    layer(  # back row: wide outer plumes
        feather(48, 64, 14, 92, 9, CRIMSON, OCHRE, CRIMSON_DK),
        feather(52, 64, 86, 92, 9, CRIMSON, OCHRE, CRIMSON_DK))
    + layer(  # middle row
        feather(49, 66, 30, 98, 8, OCHRE, CRIMSON, CRIMSON_DK),
        feather(51, 66, 70, 98, 8, OCHRE, CRIMSON, CRIMSON_DK))
    + layer(feather(50, 66, 50, 99, 8, CRIMSON, OCHRE, CRIMSON_DK))  # centre plume
    + layer(WING, f'<g transform="translate(100 0) scale(-1 1)">{WING}</g>')
    + layer(f'<path d="M42 68 C38 58 42 44 50 42 C58 44 62 58 58 68 C54 72 46 72 42 68 Z" fill="{CRIMSON}"/>'
            f'<path d="M46 64 C46 56 48 50 50 48 C52 50 54 56 54 64 Z" fill="{OCHRE}" stroke="none" opacity="0.85"/>')
    + layer(f'<path d="M48 28 C44 22 40 20 36 20 C40 24 42 27 44 31 Z M50 26 C48 20 46 16 42 14 C45 19 46 23 47 28 Z" fill="{OCHRE}"/>'
            f'<circle cx="52" cy="33" r="7.5" fill="{CRIMSON}"/>'
            f'<path d="M58 31 C64 30 67 34 64 39 C63 36 61 36 58 36 Z" fill="{OCHRE}"/>'
            f'<circle cx="54" cy="31.5" r="2.2" fill="{OCHRE}"/><circle cx="54.5" cy="31.5" r="1" fill="{INK}" stroke="none"/>')
)

# Dragon: the green dragon, proud this time (no soot, no bomb).
art['dragon'] = svg(
    layer(f'<path d="M26 58 C12 52 6 38 10 28 L16 36 L20 30 L24 40 L30 46 Z" fill="{VIOLET}"/>'
          f'<path d="M74 58 C88 52 94 38 90 28 L84 36 L80 30 L76 40 L70 46 Z" fill="{VIOLET}"/>')            # wings
    + layer(f'<path d="M70 84 Q88 86 90 72" fill="none" stroke="{INK}" stroke-width="7"/>'
            f'<path d="M70 84 Q88 86 90 72" fill="none" stroke="{SAP}" stroke-width="4"/>'
            f'<path d="M90 64 L96 74 L86 74 Z" fill="{SAP}"/>'
            f'<path d="M28 94 Q24 62 50 58 Q76 62 72 94 Z" fill="{SAP}"/>'
            f'<path d="M38 94 Q36 72 50 70 Q64 72 62 94 Z" fill="{OCHRE}"/>'
            f'<path d="M39 78 L61 78 M38 86 L62 86" stroke="{OCHRE_DK}" stroke-width="1.3"/>')                  # tail, body, belly
    + layer(f'<path d="M36 22 L40 8 L46 18 L50 4 L54 18 L60 8 L64 22 Z" fill="{OCHRE}"/>'
            f'<path d="M26 38 Q26 18 50 18 Q74 18 74 38 Q74 48 68 52 Q50 58 32 52 Q26 48 26 38 Z" fill="{SAP}"/>'
            f'<path d="M34 46 Q34 40 50 40 Q66 40 66 46 Q66 56 50 56 Q34 56 34 46 Z" fill="{SAP_LT}"/>'
            f'<ellipse cx="44" cy="45" rx="1.8" ry="1.2" fill="{INK}" stroke="none"/><ellipse cx="56" cy="45" rx="1.8" ry="1.2" fill="{INK}" stroke="none"/>'
            f'<path d="M42 54 L44 59 L46 54 Z M54 54 L56 59 L58 54 Z" fill="{WHITE}" stroke-width="1.2"/>'
            f'<path d="M34 30 Q40 26 46 31 Q40 36 34 30 Z M54 31 Q60 26 66 30 Q60 36 54 31 Z" fill="{OCHRE}"/>'
            f'<ellipse cx="40" cy="31" rx="1.2" ry="3" fill="{INK}" stroke="none"/><ellipse cx="60" cy="31" rx="1.2" ry="3" fill="{INK}" stroke="none"/>'
            f'<path d="M32 26 L46 28 M68 26 L54 28" stroke="{INK}" stroke-width="2.4"/>')                     # head, smug
)


# ===== Suit symbols =====
# Drawn a touch bolder than the special cards so they hold up small. Each
# keeps its suit's colour (Card.tsx / index.css suit-* classes).
JADE, JADE_DK = '#2F8A55', '#1E6440'
STEEL, STEEL_DK = '#B9C3CF', '#7F8C9C'
BLUE, BLUE_DK = '#3B6FD6', '#24489A'
RED, RED_DK, RED_LT = '#D93A3A', '#9E2323', '#F08A7E'
HILT, STONE_DK = '#3A2A33', '#8C8699'
def suit_svg(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">{DEFS}'
            f'<g filter="url(#paper)" stroke="{INK}" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n')
suits = {}

# Jade: the green 發 (as on the mahjong tile), cut from paper. The outline is
# traced from Noto Serif SC Black (SIL Open Font License 1.1, (c) Google) so
# it looks the same on every device; the ink outline is a silhouette drawn
# underneath, since the glyph's strokes overlap.
FA = ('M29 53.1H25.7L26.9 52.7Q26.7 54.3 26.3 57Q25.8 59.6 25.3 62.3Q24.9 64.9 24.4 66.7H25.2L21 71.9L11.5 65.8Q12.5 64.8 14.1 64Q15.7 63.3 17.2 62.9L14.3 66.1Q14.9 64.1 15.4 60.8Q16 57.5 16.4 54.1Q16.9 50.7 17 48.5ZM48.5 69.3Q58.4 69.6 65.1 71.5Q71.8 73.3 75.7 76Q79.6 78.7 81.1 81.6Q82.6 84.4 82.2 86.7Q81.7 89.1 79.7 90.2Q77.7 91.3 74.7 90.5Q72.5 87.9 69.3 85Q66.2 82.1 62.5 79.3Q58.8 76.6 55 74.2Q51.3 71.8 47.9 70.1ZM34.7 38.9 39.2 33.9 47.4 42Q46.3 43.2 44.3 43.5V56.9Q44.3 57 42.8 57.5Q41.4 58 39.2 58.3Q37 58.7 34.8 58.7H32.6V38.9ZM63.7 38.5 69.1 32.7 78.8 40.4Q78.4 40.7 77.6 41.1Q76.8 41.4 75.7 41.6V48.7Q75.7 49.3 75.9 49.6Q76.1 49.9 76.6 49.9H77.2Q77.4 49.9 77.6 49.9Q77.7 49.9 78.1 49.9Q78.3 49.9 79 49.8Q79.7 49.8 80 49.7Q80.4 49.7 81 49.6Q81.7 49.4 82.1 49.3H82.9L83.4 49.5Q85.1 50.4 85.7 51.2Q86.3 52 86.3 53.3Q86.3 56.5 83.6 57.5Q80.9 58.5 75.5 58.5H72.3Q68.8 58.5 67.2 57.7Q65.6 56.8 65.1 55Q64.7 53.3 64.7 50.3V38.5ZM49.2 37.6V33.3L62.1 38.5H60.4V44Q60.4 46 59.9 48.4Q59.3 50.8 57.6 53.3Q55.9 55.9 52.6 58.1Q49.2 60.3 43.7 61.9L43.2 61.1Q46.1 58.5 47.3 55.5Q48.6 52.6 48.9 49.6Q49.2 46.7 49.2 44V38.5ZM32.8 64.3 38.3 59.2 48 67.1Q47 68.2 44.6 68.6Q43.7 77.1 42.1 82Q40.5 86.9 37.3 88.9Q35.3 90.1 32.6 90.8Q29.9 91.4 26.1 91.4Q26.1 89.2 25.7 87.3Q25.4 85.5 24.3 84.4Q23.1 83.2 21 82.3Q18.8 81.3 16 80.7L16.1 79.7Q17.9 79.9 20.2 80Q22.5 80.1 24.5 80.2Q26.4 80.3 27.3 80.3Q29.3 80.3 30 79.7Q31.2 78.8 32.2 74.8Q33.1 70.8 33.7 64.3ZM74.4 62.1V64.6H46.8L46 62.1ZM38.1 38.9V41.3H21.7L20.9 38.9ZM39.7 64.3V66.7H20.3V64.3ZM37.9 53.1V55.5H22.3V53.1ZM70.6 38.5V40.9H54.6V38.5ZM90.4 25.5Q90.1 26.1 89.3 26.4Q88.6 26.7 87.1 26.4Q84.4 27.5 80.8 28.7Q77.1 29.8 73.7 30.5L72.8 29.6Q74 28 75.3 25.8Q76.5 23.7 77.6 21.6Q78.7 19.4 79.2 18ZM78.3 16.9Q77.9 17.5 77.2 17.8Q76.5 18.1 75 17.8Q72.1 19.2 68.2 20.7Q64.3 22.1 60.4 23.2L59.6 22.2Q61 20.4 62.4 18Q63.9 15.7 65.2 13.4Q66.4 11.1 67.1 9.4ZM52.1 8.3Q54.6 13.9 58.9 18Q63.1 22 68.6 25Q74 27.9 80 29.8Q86 31.8 92 33L91.8 34Q88.1 34.9 85.6 37.8Q83 40.7 81.8 45.2Q74.3 41.6 68.3 36.9Q62.3 32.1 58 25.3Q53.7 18.5 51.1 8.8ZM15.3 20.8Q21.2 20.8 24.4 22Q27.7 23.3 28.7 25.1Q29.7 26.9 29 28.7Q28.4 30.6 26.7 31.8Q24.9 33 22.5 32.9Q20.2 32.8 17.7 30.9Q18 28.2 17.1 25.6Q16.2 22.9 14.7 21.3ZM68.3 62.1 74.9 55.9 85.7 65Q85.2 65.6 84.5 65.9Q83.8 66.2 82.3 66.4Q77.2 76.3 66.9 82.7Q56.6 89.1 41.8 91.7L41.4 90.7Q52.3 86.3 59.4 78.9Q66.6 71.5 69.4 62.1ZM34.4 15.3 41 9 51.7 18.1Q51.3 18.8 50.6 19.1Q49.8 19.3 48.3 19.5Q43.3 29.9 33.3 37.4Q23.2 44.9 8.4 48.5L8 47.5Q18.5 42.1 25.6 33.7Q32.6 25.2 35.5 15.3ZM41.7 15.3V17.7H13.7L12.9 15.3Z')
suits['jade'] = suit_svg(
    layer(f'<path d="{FA}" fill="{JADE_DK}" stroke="{JADE_DK}" stroke-width="2.6" transform="translate(1.6 2.4)"/>')
    + layer(f'<path d="{FA}" fill="{INK}" stroke="{INK}" stroke-width="2.6"/>'
            f'<path d="{FA}" fill="{JADE}" stroke="none"/>')
)

# Sword: two crossed jian, steel blades, gold guards, dark hilts with red tassels.
def jian(rot):
    return (f'<g transform="rotate({rot} 50 50)">'
            f'<path d="M50 6 L55 14 L55 66 L45 66 L45 14 Z" fill="{STEEL}"/>'
            f'<path d="M50 9 L50 64" stroke="{STEEL_DK}" stroke-width="1.4"/>'
            f'<path d="M36 66 Q50 72 64 66 L64 71 Q50 77 36 71 Z" fill="{OCHRE}"/>'
            f'<rect x="46" y="73" width="8" height="15" rx="2" fill="{HILT}"/>'
            f'<circle cx="50" cy="91" r="4" fill="{OCHRE}"/>'
            f'<path d="M50 95 Q46 100 44 99 M50 95 Q54 100 56 99" fill="none" stroke="{RED}" stroke-width="2.4"/></g>')
suits['sword'] = suit_svg(layer(jian(-38)) + layer(jian(38)))

# Pagoda: after Kyoto's To-ji five-storey pagoda: five wide, gently upturned
# eaves that shrink only a little toward the top, slim bodies tucked beneath,
# and a tall ringed spire (sorin).
def eave(y, half):
    """A thin roof: shallow pitch up to the ridge, gently upturned eave tips."""
    return (f'<path d="M{50 - half} {y} L{50 - half * .55} {y - 4.5} L{50 + half * .55} {y - 4.5} L{50 + half} {y} '
            f'Q{50 + half * .7} {y + 3} {50 + half * .45} {y + 3} L{50 - half * .45} {y + 3} Q{50 - half * .7} {y + 3} {50 - half} {y} Z" '
            f'fill="{BLUE}"/>')
def body(top, bot, half):
    return (f'<rect x="{50 - half}" y="{top}" width="{2 * half}" height="{bot - top}" fill="{CREAM}"/>'
            f'<path d="M{50 - half + 3} {top} L{50 - half + 3} {bot} M{50 + half - 3} {top} L{50 + half - 3} {bot}" stroke="{RED}" stroke-width="2"/>'
            f'<path d="M{50 - half} {bot - 2.5} L{50 + half} {bot - 2.5}" stroke="{RED_DK}" stroke-width="1.4"/>')
tiers = [(84, 42), (69, 38.5), (54, 35), (39, 31.5), (24, 28)]  # (eave y, half-width), bottom up
pag = layer(f'<path d="M16 96 L84 96 L80 92 L20 92 Z" fill="{STONE_DK}"/>')
for k, (y, half) in enumerate(tiers):
    bot = 92 if k == 0 else tiers[k - 1][0] - 4
    pag += layer(body(y + 2, bot, half * .5), eave(y, half))
suits['pagoda'] = suit_svg(
    layer(f'<path d="M50 3 L50 20" stroke="{OCHRE_DK}" stroke-width="3"/>'
          + ''.join(f'<path d="M46.5 {y} L53.5 {y}" stroke="{OCHRE_DK}" stroke-width="2"/>' for y in (9, 12, 15, 18))
          + f'<circle cx="50" cy="4.5" r="2.4" fill="{OCHRE}"/>')
    + pag
)

# Star: a faceted five-point paper star.
pts = [(50 + (42 if i % 2 == 0 else 18) * math.cos(-math.pi / 2 + i * math.pi / 5),
        54 + (42 if i % 2 == 0 else 18) * math.sin(-math.pi / 2 + i * math.pi / 5)) for i in range(10)]
star = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'
facets = ''.join(
    f'<path d="M50 54 L{pts[i][0]:.1f} {pts[i][1]:.1f} L{pts[(i + 1) % 10][0]:.1f} {pts[(i + 1) % 10][1]:.1f} Z" fill="{RED_LT if i % 2 == 0 else RED_DK}" stroke="none" opacity="0.5"/>'
    for i in range(10))
suits['star'] = suit_svg(layer(f'<path d="{star}" fill="{RED}"/>' + facets + f'<path d="{star}" fill="none"/>'))



# ===== Pip versions of the suit symbols =====
# For the corner index and the pips, drawn at 10-25px many times per hand:
# the same designs, simplified and bolder, with no paper filters, so they
# stay crisp at that size and cost almost nothing to draw.
def pip_svg(body, sw=6):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            f'<g stroke="{INK}" stroke-width="{sw}" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n')
pips = {}
pips['star'] = pip_svg(f'<path d="{star}" fill="{RED}"/>')
pips['jade'] = pip_svg(
    f'<path d="{FA}" fill="{INK}" stroke="{INK}" stroke-width="4"/>'
    f'<path d="{FA}" fill="{JADE}" stroke="{JADE}" stroke-width="2.2"/>', 0)
def pip_jian(rot):
    return (f'<g transform="rotate({rot} 50 50)">'
            f'<path d="M50 4 L58 14 L58 64 L42 64 L42 14 Z" fill="{STEEL_DK}"/>'
            f'<path d="M32 64 L68 64 L68 74 L32 74 Z" fill="{OCHRE}"/>'
            f'<rect x="44" y="74" width="12" height="20" rx="3" fill="{HILT}"/></g>')
pips['sword'] = pip_svg(pip_jian(-38) + pip_jian(38))
def pip_eave(y, half):
    return (f'<path d="M{50 - half} {y} L{50 - half * .5} {y - 8} L{50 + half * .5} {y - 8} L{50 + half} {y} '
            f'Q{50 + half * .6} {y + 5} {50 + half * .4} {y + 5} L{50 - half * .4} {y + 5} Q{50 - half * .6} {y + 5} {50 - half} {y} Z" fill="{BLUE}"/>')
pips['pagoda'] = pip_svg(
    f'<path d="M50 4 L50 22" stroke="{OCHRE_DK}" stroke-width="7"/>'
    f'<rect x="36" y="72" width="28" height="22" fill="{CREAM}"/>' + pip_eave(70, 46)
    + f'<rect x="38" y="50" width="24" height="16" fill="{CREAM}"/>' + pip_eave(48, 38)
    + f'<rect x="41" y="30" width="18" height="14" fill="{CREAM}"/>' + pip_eave(28, 30), 5)


# ===== Royals: papercraft court portraits for J / Q / K =====
# After the standard deck's East Asian court theme: the King an emperor in a
# mian crown, the Queen an empress in a phoenix headdress, the Jack a
# scholar-official in a winged hat. Each wears a robe in its suit's colour
# with the suit emblem on a gold chest medallion. Portrait (100x150), drawn
# to fill the gold frame on the card face.
ROBES = {  # suit: (robe, robe dark, backdrop tint)
    'star': ('#D93A3A', '#9E2323', '#FBE4E0'),
    'jade': ('#2F8A55', '#1E6440', '#E1F2E6'),
    'pagoda': ('#3B6FD6', '#24489A', '#E2EAF9'),
    'sword': ('#5B6472', '#3A414C', '#ECEEF1'),
}
HAIR_BLACK = '#2A2230'
SKIN = '#F1C9A0'

def royal_svg(body):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150">{DEFS}'
            f'<g filter="url(#paper)" stroke="{INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">{body}</g></svg>\n')

def emblem(suit):
    """The suit emblem, drawn in a 100-unit box (scaled onto the medallion)."""
    if suit == 'star':
        return f'<path d="{star}" fill="{RED}" stroke-width="6"/>'
    if suit == 'jade':
        return f'<path d="{FA}" fill="{INK}" stroke="{INK}" stroke-width="5"/><path d="{FA}" fill="{JADE}" stroke="none"/>'
    if suit == 'sword':
        return f'<g stroke-width="6">{pip_jian(-38)}{pip_jian(38)}</g>'
    return (f'<g stroke-width="6"><rect x="36" y="72" width="28" height="22" fill="{CREAM}"/>{pip_eave(70, 46)}'
            f'<rect x="38" y="50" width="24" height="16" fill="{CREAM}"/>{pip_eave(48, 38)}'
            f'<rect x="41" y="30" width="18" height="14" fill="{CREAM}"/>{pip_eave(28, 30)}</g>')

def royal(rank, suit):
    robe, robe_dk, tint = ROBES[suit]
    back = layer(f'<rect x="0" y="0" width="100" height="150" fill="{tint}" stroke="none"/>',
                 f'<circle cx="50" cy="66" r="36" fill="#F6E3B4" stroke="none" opacity="0.9"/>')
    # Robe, cross collar, gold collar band and the chest medallion.
    robe_layer = layer(
        f'<path d="M4 152 Q6 112 50 102 Q94 112 96 152 Z" fill="{robe}"/>'
        f'<path d="M24 120 Q30 136 28 152 M76 120 Q70 136 72 152" fill="none" stroke="{robe_dk}" stroke-width="2.4"/>'
        f'<path d="M38 103 L58 146 L50 150 L33 107 Z" fill="{CREAM}"/>'
        f'<path d="M62 103 L46 136 L42 132 L57 102 Z" fill="{CREAM}"/>'
        f'<path d="M28 106 Q50 120 72 106 L75 112 Q50 129 25 112 Z" fill="{OCHRE}"/>')
    medal = layer(f'<circle cx="50" cy="136" r="11" fill="{OCHRE}"/><circle cx="50" cy="136" r="8.5" fill="{WHITE}" stroke-width="1.2"/>'
                  f'<g transform="translate(43 129) scale(0.14)">{emblem(suit)}</g>')
    neck = layer(f'<path d="M43 86 L57 86 L58 104 L42 104 Z" fill="{SKIN}"/>')
    face = (f'<ellipse cx="50" cy="72" rx="17" ry="19" fill="{SKIN}"/>'
            f'<ellipse cx="33.5" cy="74" rx="3" ry="4.5" fill="{SKIN}"/><ellipse cx="66.5" cy="74" rx="3" ry="4.5" fill="{SKIN}"/>'
            f'<circle cx="41" cy="80" r="3.2" fill="{ROSE}" stroke="none" opacity="0.45"/>'
            f'<circle cx="59" cy="80" r="3.2" fill="{ROSE}" stroke="none" opacity="0.45"/>')
    if rank == 13:  # King: emperor, mian crown with bead tassels, long moustache and beard
        hair = f'<path d="M33 70 Q33 54 50 53 Q67 54 67 70 Q62 61 50 60 Q38 61 33 70 Z" fill="{HAIR_BLACK}"/>'
        eyes = (f'<path d="M40 72 q3 -2 6 0" fill="none" stroke-width="2"/><path d="M54 72 q3 -2 6 0" fill="none" stroke-width="2"/>'
                f'<path d="M39 67 l7 -1.5 M61 67 l-7 -1.5" stroke-width="2.4"/>')
        beard = (f'<path d="M50 83 Q42 81 35 89 Q41 86 46 86 Q48 88 50 88 Q52 88 54 86 Q59 86 65 89 Q58 81 50 83 Z" fill="{HAIR_BLACK}"/>'
                 f'<path d="M45 90 Q50 112 55 90 Q50 93 45 90 Z" fill="{HAIR_BLACK}"/>')
        tassels = ''.join(f'<path d="M{x} 41 L{x} 52" stroke="{OCHRE_DK}" stroke-width="1.4"/>'
                          f'<circle cx="{x}" cy="46" r="1.4" fill="{RED}" stroke="none"/><circle cx="{x}" cy="52" r="1.6" fill="{OCHRE}" stroke-width="0.8"/>'
                          for x in range(27, 76, 8))
        head = layer(f'<path d="M38 42 L62 42 L60 56 L40 56 Z" fill="{HAIR_BLACK}"/>'
                     f'<rect x="20" y="36" width="60" height="6" rx="1" fill="{HAIR_BLACK}"/>'
                     f'<path d="M20 36 L80 36" stroke="{OCHRE}" stroke-width="2"/>' + tassels)
        return royal_svg(back + robe_layer + medal + neck + layer(face, hair, eyes, beard) + head)
    if rank == 12:  # Queen: empress, black hair in a bun, gold phoenix headdress
        hair = (f'<ellipse cx="50" cy="45" rx="15" ry="10" fill="{HAIR_BLACK}"/>'
                f'<path d="M32 78 Q28 54 50 51 Q72 54 68 78 Q66 62 50 60 Q34 62 32 78 Z" fill="{HAIR_BLACK}"/>')
        eyes = (f'<path d="M40 73 q3 2 6 0" fill="none" stroke-width="2"/><path d="M54 73 q3 2 6 0" fill="none" stroke-width="2"/>'
                f'<path d="M46 72 l1.6 -1.6 M54 72 l-1.6 -1.6" stroke-width="1.4"/>')
        lips = f'<path d="M46.5 84 Q50 86.5 53.5 84 Q50 82.5 46.5 84 Z" fill="{RED}" stroke-width="1"/>'
        crown = (f'<path d="M30 56 Q50 30 70 56 L65 57 Q50 39 35 57 Z" fill="{OCHRE}"/>'
                 f'<path d="M50 30 C44 34 40 40 42 46 C46 42 48 40 50 40 C52 40 54 42 58 46 C60 40 56 34 50 30 Z" fill="{OCHRE}"/>'
                 f'<circle cx="50" cy="44" r="3" fill="{RED}" stroke-width="1"/>'
                 f'<circle cx="36" cy="50" r="2" fill="{RED}" stroke-width="0.8"/><circle cx="64" cy="50" r="2" fill="{RED}" stroke-width="0.8"/>'
                 + ''.join(f'<path d="M{x} 56 L{x2} 74" stroke="{OCHRE_DK}" stroke-width="1.3"/><circle cx="{x2}" cy="75.5" r="1.8" fill="{OCHRE}" stroke-width="0.8"/>'
                           for x, x2 in [(31, 29), (69, 71)]))
        return royal_svg(back + robe_layer + medal + neck + layer(hair) + layer(face, eyes, lips) + layer(crown))
    # Jack: scholar-official in the black winged hat (wusha mao), holding a scroll
    hair = f'<path d="M34 68 Q34 58 50 57 Q66 58 66 68 Q60 62 50 62 Q40 62 34 68 Z" fill="{HAIR_BLACK}"/>'
    eyes = (f'<circle cx="43" cy="73" r="2" fill="{INK}" stroke="none"/><circle cx="57" cy="73" r="2" fill="{INK}" stroke="none"/>'
            f'<path d="M46 83 Q50 85.5 54 83" fill="none" stroke-width="1.6"/>')
    hat = (f'<ellipse cx="22" cy="55" rx="15" ry="3.6" fill="{HAIR_BLACK}"/><ellipse cx="78" cy="55" rx="15" ry="3.6" fill="{HAIR_BLACK}"/>'
           f'<path d="M35 61 Q35 44 50 44 Q65 44 65 61 Z" fill="{HAIR_BLACK}"/>'
           f'<path d="M35 58 L65 58" stroke="{OCHRE}" stroke-width="1.8"/>')
    scroll = (f'<g transform="rotate(-14 50 118)"><rect x="32" y="112" width="36" height="11" rx="2" fill="{CREAM}"/>'
              f'<path d="M37 117.5 L63 117.5" stroke="{robe_dk}" stroke-width="1.2"/>'
              f'<rect x="28" y="110" width="6" height="15" rx="2" fill="{OCHRE}"/><rect x="66" y="110" width="6" height="15" rx="2" fill="{OCHRE}"/></g>')
    return royal_svg(back + robe_layer + medal + neck + layer(face, hair, eyes) + layer(hat) + layer(scroll))

royals = {f'{"JQK"[r - 11]}-{suit}': royal(r, suit) for r in (11, 12, 13) for suit in ROBES}

# ===== Animation sprites (side view, facing right; two frames each) =====
anim = {}

def limb(d, fill, w=5.5):
    return (f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="{w + 2.6}"/>'
            f'<path d="{d}" fill="none" stroke="{fill}" stroke-width="{w}"/>')

# The blue doodle mid-dash. Frame 1: legs stretched out; frame 2: gathered under.
def doodle_run(stretched):
    if stretched:
        legs_far = limb('M64 64 L80 74', DOODLE_DK) + limb('M34 64 L18 72', DOODLE_DK)
        legs_near = limb('M68 64 L86 70', DOODLE) + limb('M30 64 L12 66', DOODLE)
        paws = [(86, 70), (12, 66)]
    else:
        legs_far = limb('M62 64 L58 80', DOODLE_DK) + limb('M36 64 L42 80', DOODLE_DK)
        legs_near = limb('M66 64 L64 82', DOODLE) + limb('M32 64 L36 82', DOODLE)
        paws = [(64, 82), (36, 82)]
    return svg(
        layer(legs_far)
        + layer(f'<path d="{fluff(18, 42, 7, 6, 8, 2.4)}" fill="{DOODLE}"/>')                     # pom-pom tail
        + layer(f'<path d="{fluff(48, 54, 24, 14, 16, 3)}" fill="{DOODLE}"/>',
                curls([(36, 50), (48, 48), (58, 52), (42, 58)], 2.8))                          # body
        + layer(legs_near, ''.join(f'<path d="{fluff(x, y, 4, 3, 7, 1.4)}" fill="{DOODLE_LT}"/>' for x, y in paws))
        + layer(f'<path d="M66 50 Q72 56 78 52 L78 56 Q72 60 66 54 Z" fill="{OCHRE_DK}"/>')        # collar
        + layer(f'<path d="{fluff(76, 38, 13, 12, 12, 2.8)}" fill="{DOODLE}"/>',
                curls([(72, 28), (80, 27)], 2.4),
                f'<ellipse cx="88" cy="43" rx="8" ry="6" fill="{DOODLE_LT}"/>'
                f'<ellipse cx="95" cy="40.5" rx="3" ry="2.4" fill="{INK}"/>'
                f'<circle cx="80" cy="35" r="2.2" fill="{INK}" stroke="none"/><circle cx="80.8" cy="34.2" r="0.7" fill="{WHITE}" stroke="none"/>'
                f'<path d="M88 47 Q91 50 94 47" fill="none" stroke-width="1.5"/>'
                f'<path d="M90 48 Q91 54 93 48 Z" fill="{ROSE}" stroke-width="1.2"/>')                # head
        + layer(f'<path d="{fluff(66, 40, 5.5, 9, 8, 2.2)}" fill="{DOODLE_DK}" transform="rotate({30 if stretched else -6} 66 33)"/>')  # flopping ear
    )
anim['doodle-run-1'] = doodle_run(True)
anim['doodle-run-2'] = doodle_run(False)


# Facing away (running up the screen). Frames alternate which hind paw is up.
def doodle_back(left_up):
    lp, rp = (78, 88) if left_up else (88, 78)
    return svg(
        layer(limb(f'M40 72 L38 {lp}', DOODLE) + limb(f'M60 72 L62 {rp}', DOODLE),
              f'<path d="{fluff(38, lp + 1, 5, 3.4, 7, 1.4)}" fill="{DOODLE_LT}"/>'
              f'<path d="{fluff(62, rp + 1, 5, 3.4, 7, 1.4)}" fill="{DOODLE_LT}"/>')       # hind legs, pads showing
        + layer(f'<path d="{fluff(50, 60, 21, 18, 16, 3)}" fill="{DOODLE}"/>',
                curls([(40, 54), (52, 50), (60, 60), (44, 66)], 2.8))                      # body from behind
        + layer(f'<path d="M36 46 Q50 52 64 46 L64 50 Q50 56 36 50 Z" fill="{OCHRE_DK}"/>')  # collar, back of the neck
        + layer(f'<path d="{fluff(50, 32, 15, 13, 12, 2.8)}" fill="{DOODLE}"/>',
                curls([(44, 26), (54, 24), (50, 34)], 2.4))                                # back of the head
        + layer(f'<path d="{fluff(33, 36, 6, 10, 8, 2.2)}" fill="{DOODLE_DK}" transform="rotate({-28 if left_up else -12} 36 28)"/>'
                f'<path d="{fluff(67, 36, 6, 10, 8, 2.2)}" fill="{DOODLE_DK}" transform="rotate({12 if left_up else 28} 64 28)"/>')  # ears flying out
        + layer(f'<path d="{fluff(50, 70, 7, 6, 8, 2.4)}" fill="{DOODLE_LT}"/>')           # pom-pom tail on the rump
    )
anim['doodle-back-1'] = doodle_back(True)
anim['doodle-back-2'] = doodle_back(False)

# Running toward the camera (down the screen). Frames alternate front paws.
def doodle_front(left_up):
    lp, rp = (76, 88) if left_up else (88, 76)
    return svg(
        layer(f'<path d="{fluff(50, 64, 19, 16, 14, 3)}" fill="{DOODLE}"/>',
              curls([(42, 62), (56, 66)], 2.6))                                            # body
        + layer(limb(f'M42 70 L40 {lp}', DOODLE) + limb(f'M58 70 L60 {rp}', DOODLE),
                f'<path d="{fluff(40, lp + 1, 5, 3.4, 7, 1.4)}" fill="{DOODLE_LT}"/>'
                f'<path d="{fluff(60, rp + 1, 5, 3.4, 7, 1.4)}" fill="{DOODLE_LT}"/>')     # front legs
        + layer(f'<path d="{fluff(28, 38, 7, 11, 8, 2.2)}" fill="{DOODLE_DK}" transform="rotate({-34 if left_up else -18} 32 30)"/>'
                f'<path d="{fluff(72, 38, 7, 11, 8, 2.2)}" fill="{DOODLE_DK}" transform="rotate({18 if left_up else 34} 68 30)"/>')  # ears flying
        + layer(f'<path d="{fluff(50, 34, 17, 15, 14, 3.2)}" fill="{DOODLE}"/>',
                curls([(42, 22), (52, 20), (60, 24)], 2.6),
                f'<ellipse cx="50" cy="43" rx="10" ry="8" fill="{DOODLE_LT}"/>'
                f'<circle cx="43" cy="33" r="2.6" fill="{INK}" stroke="none"/><circle cx="57" cy="33" r="2.6" fill="{INK}" stroke="none"/>'
                f'<circle cx="44" cy="32" r="0.9" fill="{WHITE}" stroke="none"/><circle cx="58" cy="32" r="0.9" fill="{WHITE}" stroke="none"/>'
                f'<ellipse cx="50" cy="40" rx="4.2" ry="3.1" fill="{INK}"/>'
                f'<path d="M50 43 Q46 48 43 45 M50 43 Q54 48 57 45" fill="none" stroke-width="1.6"/>'
                f'<path d="M47.5 46 Q50 54 52.5 46 Z" fill="{ROSE}" stroke-width="1.2"/>')        # happy face, tongue out
        + layer(f'<path d="M37 50 Q50 56 63 50 L63 54 Q50 60 37 54 Z" fill="{OCHRE_DK}"/>')  # collar
    )
anim['doodle-front-1'] = doodle_front(True)
anim['doodle-front-2'] = doodle_front(False)

# Arrived: down on its belly but head up, ears perked, tongue out, tail
# going: ready for its partner to take the lead.
anim['doodle-lie'] = svg(
    layer(f'<path d="{fluff(82, 60, 7, 6, 8, 2.4)}" fill="{DOODLE}"/>',
          f'<path d="M88 50 q4 -2 6 2 M90 44 q5 -2 7 3" fill="none" stroke="{INK}" stroke-width="1.6"/>')  # wagging tail
    + layer(f'<path d="{fluff(50, 72, 30, 13, 18, 3)}" fill="{DOODLE}"/>',
            curls([(30, 68), (44, 66), (64, 66), (72, 72)], 2.6))                              # body, down
    + layer(f'<path d="{fluff(38, 84, 7, 4, 8, 1.6)}" fill="{DOODLE_LT}"/><path d="{fluff(62, 84, 7, 4, 8, 1.6)}" fill="{DOODLE_LT}"/>')  # paws out front
    + layer(f'<path d="{fluff(31, 40, 6.5, 10, 8, 2.2)}" fill="{DOODLE_DK}" transform="rotate(-30 34 32)"/>'
            f'<path d="{fluff(69, 40, 6.5, 10, 8, 2.2)}" fill="{DOODLE_DK}" transform="rotate(30 66 32)"/>')  # ears perked up and out
    + layer(f'<path d="{fluff(50, 44, 16, 14, 14, 3)}" fill="{DOODLE}"/>',
            curls([(42, 33), (52, 31), (58, 35)], 2.4),
            f'<ellipse cx="50" cy="53" rx="9.5" ry="7" fill="{DOODLE_LT}"/>'
            f'<circle cx="43" cy="43" r="2.6" fill="{INK}" stroke="none"/><circle cx="57" cy="43" r="2.6" fill="{INK}" stroke="none"/>'
            f'<circle cx="44" cy="42" r="0.9" fill="{WHITE}" stroke="none"/><circle cx="58" cy="42" r="0.9" fill="{WHITE}" stroke="none"/>'
            f'<ellipse cx="50" cy="50" rx="4" ry="3" fill="{INK}"/>'
            f'<path d="M50 53 Q46 58 43 55 M50 53 Q54 58 57 55" fill="none" stroke-width="1.5"/>'
            f'<path d="M47.5 56 Q50 64 52.5 56 Z" fill="{ROSE}" stroke-width="1.2"/>')            # head up, bright eyes, tongue out
    + layer(f'<path d="M37 59 Q50 64 63 59 L63 62 Q50 67 37 62 Z" fill="{OCHRE_DK}"/>')        # collar
)

# The green Dragon in flight. Frame 1: wings up; frame 2: wings down.
def dragon_fly(up):
    wing = ('M46 46 C40 26 30 12 16 6 C20 16 20 22 24 26 C18 26 14 28 12 32 C20 34 26 38 30 44 Z' if up else
            'M46 54 C40 70 30 82 16 88 C20 78 20 72 24 68 C18 68 14 66 12 62 C20 60 26 56 30 52 Z')
    return svg(
        layer(f'<path d="{wing}" fill="{VIOLET}" transform="translate(10 0)"/>')                # far wing
        + layer(limb('M28 52 Q14 54 6 44', SAP, 6), f'<path d="M2 36 L10 44 L2 48 Z" fill="{SAP}"/>')  # tail + spade
        + layer(f'<path d="M24 52 Q30 40 50 40 Q66 40 72 46 Q70 60 50 62 Q32 62 24 52 Z" fill="{SAP}"/>'
                f'<path d="M30 56 Q48 64 66 54" fill="none" stroke="{OCHRE}" stroke-width="4"/>'
                f'<path d="M34 42 L37 34 L41 41 L45 32 L49 40 L53 32 L57 41 Z" fill="{OCHRE}"/>'
                + limb('M44 60 L42 68', SAP, 4) + limb('M58 58 L58 66', SAP, 4))                # body, belly, back spikes, tucked legs
        + layer(f'<path d="{wing}" fill="{VIOLET}"/>')                                          # near wing
        + layer(f'<path d="M66 44 Q70 32 82 32 Q96 34 98 44 Q98 52 86 52 Q72 54 66 44 Z" fill="{SAP}"/>'
                f'<path d="M84 44 Q96 44 98 48 Q92 53 84 50 Z" fill="{SAP_LT}"/>'
                f'<path d="M72 34 L66 24 L76 30 Z M78 32 L76 20 L84 30 Z" fill="{OCHRE}"/>'
                f'<circle cx="81" cy="39" r="4" fill="{WHITE}" stroke-width="1.6"/><circle cx="82.5" cy="39" r="1.8" fill="{INK}" stroke="none"/>'
                f'<path d="M76.5 35.5 Q81 33 86 35.5" fill="none" stroke-width="2"/>'
                f'<circle cx="95" cy="45" r="1" fill="{INK}" stroke="none"/>'
                f'<path d="M89 51 L90.5 55 L92 51 Z" fill="{WHITE}" stroke-width="1"/>')             # head: horns, half-lidded grumpy eye, fang
    )
anim['dragon-fly-1'] = dragon_fly(True)
anim['dragon-fly-2'] = dragon_fly(False)

out = sys.argv[1]
os.makedirs(out, exist_ok=True)
for k, v in art.items():
    open(os.path.join(out, f'{k}.svg'), 'w').write(v)
for k, v in suits.items():
    open(os.path.join(out, f'suit-{k}.svg'), 'w').write(v)
for k, v in pips.items():
    open(os.path.join(out, f'pip-{k}.svg'), 'w').write(v)
for k, v in royals.items():
    open(os.path.join(out, f'royal-{k}.svg'), 'w').write(v)
for k, v in anim.items():
    open(os.path.join(out, f'anim-{k}.svg'), 'w').write(v)
print('wrote', len(art) + len(suits) + len(pips) + len(royals) + len(anim))
