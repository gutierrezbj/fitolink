"""
AgroM · FitoLink — Infografía A4 de capacidades.
Design philosophy: Botanical Cartography (see design-philosophy.md).

Generates the PDF + a PNG preview rendered via Poppler.
"""
import os
import subprocess
from reportlab.pdfgen import canvas as rcanvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

# ── Fonts ────────────────────────────────────────────────────────────────────
FONT_DIR = (
    '/Users/juanguti/Library/Application Support/Claude/'
    'local-agent-mode-sessions/skills-plugin/'
    '38f611e1-bb42-44d6-93b3-005b4b1e80fb/'
    '0467d8a6-65f8-41dd-b53b-087c625f5651/skills/canvas-design/canvas-fonts'
)

# CrimsonPro reserved for display only (title, headlines). Body uses IBM
# Plex Serif because its stringWidth metric matches its rendered glyph
# widths reliably, so simpleSplit produces lines that fit inside the column.
pdfmetrics.registerFont(TTFont('Display',       f'{FONT_DIR}/CrimsonPro-Regular.ttf'))
pdfmetrics.registerFont(TTFont('DisplayBold',   f'{FONT_DIR}/CrimsonPro-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DisplayItalic', f'{FONT_DIR}/CrimsonPro-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Serif',         f'{FONT_DIR}/IBMPlexSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SerifBold',     f'{FONT_DIR}/IBMPlexSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SerifItalic',   f'{FONT_DIR}/IBMPlexSerif-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Sans',          f'{FONT_DIR}/BricolageGrotesque-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SansBold',      f'{FONT_DIR}/BricolageGrotesque-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Mono',          f'{FONT_DIR}/IBMPlexMono-Regular.ttf'))
pdfmetrics.registerFont(TTFont('MonoBold',      f'{FONT_DIR}/IBMPlexMono-Bold.ttf'))

# ── AgroM palette ────────────────────────────────────────────────────────────
DEEP    = HexColor('#1B4332')   # brand primary
TERRA   = HexColor('#E07A3C')   # accent, numerals
INK     = HexColor('#0F2A22')   # primary text
PAPER   = HexColor('#F4F0E8')   # warm neutral canvas
PARCH   = HexColor('#E8DDC9')   # differentiated block
RULE    = HexColor('#C9A876')   # hairlines
MUTED   = HexColor('#6B6B5C')   # secondary text

# ── Layout grid ──────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4  # 595 × 842 pt (210 × 297 mm)
MARGIN_X = 20 * mm
MARGIN_Y = 18 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

WORDMARK = '/Users/juanguti/dev/srs/fitolink/apps/web/public/brand/agrom-wordmark.png'

# ── Helpers ──────────────────────────────────────────────────────────────────
def hairline(c, x1, y, x2, color=RULE, width=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


def text(c, x, y, s, font, size, color=INK, char_space=0):
    """Left-anchored text with optional inter-character spacing (pt)."""
    if char_space:
        to = c.beginText(x, y)
        to.setFont(font, size)
        to.setFillColor(color)
        to.setCharSpace(char_space)
        to.textLine(s)
        c.drawText(to)
    else:
        c.setFont(font, size)
        c.setFillColor(color)
        c.drawString(x, y, s)


def _width_with_spacing(s, font, size, char_space):
    """Approximate the rendered width when char spacing is applied."""
    base = pdfmetrics.stringWidth(s, font, size)
    if char_space and len(s) > 1:
        base += char_space * (len(s) - 1)
    return base


def text_center(c, x_center, y, s, font, size, color=INK, char_space=0):
    w = _width_with_spacing(s, font, size, char_space)
    x = x_center - w / 2
    text(c, x, y, s, font, size, color, char_space)


def paragraph(c, x, y, w, h, s, font, size, color=INK, leading=None):
    """
    Top-anchored multi-line paragraph with strict width-aware wrapping.
    simpleSplit respects the width argument exactly (unlike Paragraph.wrapOn
    which under some font configurations renders a single overflowing line).
    Returns the total height consumed.
    """
    lead = leading or size * 1.35
    lines = simpleSplit(s, font, size, w)
    c.setFont(font, size)
    c.setFillColor(color)
    line_y = y - size  # first baseline sits one font-size below the anchor
    for line in lines:
        c.drawString(x, line_y, line)
        line_y -= lead
    return (y - line_y)


# ════════════════════════════════════════════════════════════════════════════
# Build PDF
# ════════════════════════════════════════════════════════════════════════════
OUT_PDF = '/Users/juanguti/dev/srs/fitolink/docs/comercial/AgroM-FitoLink-Infografia.pdf'
c = rcanvas.Canvas(OUT_PDF, pagesize=A4)
c.setTitle('AgroM · FitoLink — Capacidades')

# Page background
c.setFillColor(PAPER)
c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

# ── Sublime margin frame: 4 outer corner ticks (cartographic registration) ──
TICK_LEN = 4 * mm
def corner_tick(x, y, dx, dy):
    c.setStrokeColor(RULE)
    c.setLineWidth(0.4)
    c.line(x, y, x + dx * TICK_LEN, y)
    c.line(x, y, x, y + dy * TICK_LEN)

corner_tick(MARGIN_X / 2, PAGE_H - MARGIN_Y / 2, 1, -1)
corner_tick(PAGE_W - MARGIN_X / 2, PAGE_H - MARGIN_Y / 2, -1, -1)
corner_tick(MARGIN_X / 2, MARGIN_Y / 2, 1, 1)
corner_tick(PAGE_W - MARGIN_X / 2, MARGIN_Y / 2, -1, 1)

# ════════════════════════════════════════════════════════════════════════════
# ZONE 1 · HEADER
# ════════════════════════════════════════════════════════════════════════════
y = PAGE_H - MARGIN_Y

# Wordmark — agrom-wordmark.png is 1600x500 (aspect 3.2:1)
WORDMARK_W = 55 * mm
WORDMARK_H = WORDMARK_W / 3.2
c.drawImage(WORDMARK,
            (PAGE_W - WORDMARK_W) / 2, y - WORDMARK_H,
            width=WORDMARK_W, height=WORDMARK_H,
            mask='auto')
y -= WORDMARK_H + 6 * mm

# Eyebrow under logo
text_center(c, PAGE_W / 2, y, 'INTELIGENCIA AGRARIA DE PRECISIÓN',
            'Mono', 8, MUTED, char_space=2)
y -= 3 * mm

# Hairline centered
mid = PAGE_W / 2
hairline_w = 24 * mm
hairline(c, mid - hairline_w / 2, y, mid + hairline_w / 2, RULE, 0.5)
y -= 8 * mm

# Main title
text_center(c, PAGE_W / 2, y, 'Cómo trabajamos su parcela',
            'Display', 26, DEEP)
y -= 7 * mm

# Subtitle
text_center(c, PAGE_W / 2, y, 'Cuatro capas de tecnología, un único equipo técnico.',
            'DisplayItalic', 14, MUTED)
y -= 12 * mm

# ════════════════════════════════════════════════════════════════════════════
# ZONE 2 · THE FOUR LAYERS
# ════════════════════════════════════════════════════════════════════════════
hairline(c, MARGIN_X, y, PAGE_W - MARGIN_X, RULE, 0.7)
y -= 6 * mm

LAYERS = [
    {
        'roman': 'I',
        'eyebrow': '§ I  ·  OBSERVACIÓN SATELITAL',
        'body': 'El satélite Sentinel-2 europeo capta imágenes de sus parcelas cada cinco días. Calculamos cinco índices del estado real del cultivo.',
        'tech': 'RESOLUCIÓN 10 m   ·   REVISITA 5 DÍAS   ·   HISTÓRICO 5 AÑOS',
    },
    {
        'roman': 'II',
        'eyebrow': '§ II  ·  INTELIGENCIA ARTIFICIAL',
        'body': 'Un modelo propio detecta caídas anómalas parcela a parcela. Aprende qué es normal en su pistachar y avisa cuando algo se desvía.',
        'tech': '13 INDICADORES POR PARCELA   ·   BASELINE PROPIO   ·   CONFIANZA IA POR ALERTA',
    },
    {
        'roman': 'III',
        'eyebrow': '§ III  ·  APLICACIÓN CON DRON',
        'body': 'Un piloto certificado aplica solo donde hace falta. Tasa variable basada en datos reales, no en cálculo a ojo.',
        'tech': 'PILOTO AESA CERTIFICADO   ·   DRON DJI T50/T30   ·   HASTA 30% MENOS PRODUCTO',
    },
    {
        'roman': 'IV',
        'eyebrow': '§ IV  ·  CUADERNO DIGITAL',
        'body': 'Cada aplicación queda registrada con firma electrónica y trazabilidad. Cumple normativa PAC sin papeleo añadido.',
        'tech': 'FIRMA eIDAS   ·   TRAZABILIDAD INMUTABLE   ·   CUADERNO PAC AUTOMÁTICO',
    },
]

ROW_H = 27 * mm        # compact row keeps everything inside one page
NUM_COL_W = 22 * mm    # generous gutter between roman and text column
# Aggressive width buffer. After multiple iterations comparing simpleSplit
# output against the actual rendered glyph extents, holding the body
# column to ~115 mm guarantees every line ends well inside the right
# margin regardless of the font's reported AFM widths.
text_x = MARGIN_X + NUM_COL_W
body_w = 115 * mm

for i, layer in enumerate(LAYERS):
    row_top = y
    # Roman numeral
    c.setFont('Display', 42)
    c.setFillColor(TERRA)
    c.drawString(MARGIN_X, row_top - 14 * mm, layer['roman'])

    # Eyebrow (mono uppercase tracking)
    text(c, text_x, row_top - 5 * mm, layer['eyebrow'], 'MonoBold', 8, DEEP, char_space=1.5)

    # Body paragraph — Helvetica (PDF built-in) has exact AFM metrics so
    # simpleSplit's measurements match the rendered output to the point.
    # IBM Plex Serif + CrimsonPro both reported widths several mm short of
    # their rendered glyphs, causing the right edge to overshoot the column.
    paragraph(
        c, text_x, row_top - 8 * mm,
        body_w, 20 * mm,
        layer['body'],
        'Helvetica', 9.5, INK, leading=13,
    )

    # Tech eyebrow — anchored close to the row bottom
    text(c, text_x, row_top - 21 * mm, layer['tech'], 'Mono', 7, TERRA, char_space=1.2)

    # Row separator (except after last)
    y -= ROW_H
    if i < len(LAYERS) - 1:
        hairline(c, MARGIN_X, y, PAGE_W - MARGIN_X, RULE, 0.3)
        y -= 2 * mm

hairline(c, MARGIN_X, y, PAGE_W - MARGIN_X, RULE, 0.7)
y -= 10 * mm

# ════════════════════════════════════════════════════════════════════════════
# ZONE 3 · WHAT YOU RECEIVE (parch block)
# ════════════════════════════════════════════════════════════════════════════
BLOCK_H = 48 * mm
block_top = y
c.setFillColor(PARCH)
c.rect(MARGIN_X, block_top - BLOCK_H, CONTENT_W, BLOCK_H, fill=1, stroke=0)

# Inner padding
inner_x = MARGIN_X + 8 * mm
inner_w = CONTENT_W - 16 * mm
inner_top = block_top - 8 * mm

# Eyebrow
text(c, inner_x, inner_top, '§   ENTREGABLES PARA USTED', 'Mono', 8, MUTED, char_space=2)

# Title
c.setFont('Display', 18)
c.setFillColor(DEEP)
c.drawString(inner_x, inner_top - 9 * mm, 'Cada mañana, en su correo a las 7.')

# Three items horizontal
ITEMS = [
    {
        'eb': 'INFORME DIARIO',
        'body': 'Estado de sus parcelas, meteo operativa y avisos en su comarca, resumidos en una página.',
    },
    {
        'eb': 'ALERTAS CRÍTICAS',
        'body': 'Cuando algo importante cambia, recibe un correo aparte con la información necesaria para decidir.',
    },
    {
        'eb': 'REPORTE DE APLICACIÓN',
        'body': 'Tras cada vuelo del dron, PDF firmado con condiciones, dosis y zonas tratadas.',
    },
]

ITEM_GAP = 10 * mm
ITEM_W = (inner_w - ITEM_GAP * 2) / 3
# Extra safety: shrink the column slightly more so the last word in any
# wrap never collides with the next column's text.
ITEM_TEXT_W = ITEM_W - 3 * mm
items_top = inner_top - 20 * mm
for i, item in enumerate(ITEMS):
    ix = inner_x + i * (ITEM_W + ITEM_GAP)
    # Hairline above each item — only above the item's own column
    hairline(c, ix, items_top + 4 * mm, ix + ITEM_W, RULE, 0.3)

    # Eyebrow terra
    text(c, ix, items_top - 2 * mm, item['eb'], 'MonoBold', 7, TERRA, char_space=1.5)

    # Body — same Helvetica metric story as the layer body
    paragraph(
        c, ix, items_top - 5 * mm,
        ITEM_TEXT_W, 22 * mm,
        item['body'],
        'Helvetica', 9, INK, leading=11.5,
    )

y = block_top - BLOCK_H - 10 * mm

# ════════════════════════════════════════════════════════════════════════════
# ZONE 4 · FOOTER / CONTACT
# ════════════════════════════════════════════════════════════════════════════
hairline(c, MARGIN_X, y, PAGE_W - MARGIN_X, RULE, 0.5)
y -= 6 * mm

# Eyebrow
text_center(c, PAGE_W / 2, y, 'PARA HABLAR CON NOSOTROS',
            'Mono', 8, MUTED, char_space=2.5)
y -= 6 * mm

# Two contact lines
text_center(c, PAGE_W / 2, y, 'Coordinación operativa  —  Jonh Yanga Núñez',
            'Display', 13, DEEP)
y -= 5 * mm
text_center(c, PAGE_W / 2, y, 'Equipo técnico  —  AgroM',
            'Display', 13, DEEP)
y -= 8 * mm

# Master footer at absolute bottom — short enough to fit comfortably within margins
text_center(
    c, PAGE_W / 2, MARGIN_Y / 2 + 2,
    'AGROM  ·  INTELIGENCIA AGRARIA DE PRECISIÓN  ·  AGROM.ES  ·  2026',
    'Mono', 6.5, MUTED, char_space=1.4,
)

c.save()
print(f'OK: {OUT_PDF}')

# ════════════════════════════════════════════════════════════════════════════
# Generate PNG preview for visual QA
# ════════════════════════════════════════════════════════════════════════════
PREVIEW_BASE = '/Users/juanguti/dev/srs/fitolink/docs/comercial/AgroM-FitoLink-Infografia'
subprocess.run([
    'pdftoppm', '-jpeg', '-r', '180',
    '-singlefile',
    OUT_PDF,
    PREVIEW_BASE,
], check=True)
print(f'Preview: {PREVIEW_BASE}.jpg')
