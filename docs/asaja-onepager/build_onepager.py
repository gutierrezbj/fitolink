"""
FitoLink onepager PDF generator — for ASAJA outreach.
Design philosophy: Botanical Telemetry (see design-philosophy.md).
"""
from reportlab.pdfgen import canvas as rcanvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor

# ── Fonts ────────────────────────────────────────────────────────────────────
FONT_DIR = (
    '/Users/juanguti/Library/Application Support/Claude/'
    'local-agent-mode-sessions/skills-plugin/'
    '38f611e1-bb42-44d6-93b3-005b4b1e80fb/'
    '0467d8a6-65f8-41dd-b53b-087c625f5651/skills/canvas-design/canvas-fonts'
)

pdfmetrics.registerFont(TTFont('Serif',         f'{FONT_DIR}/CrimsonPro-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SerifBold',     f'{FONT_DIR}/CrimsonPro-Bold.ttf'))
pdfmetrics.registerFont(TTFont('SerifItalic',   f'{FONT_DIR}/CrimsonPro-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Sans',          f'{FONT_DIR}/BricolageGrotesque-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SansBold',      f'{FONT_DIR}/BricolageGrotesque-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Mono',          f'{FONT_DIR}/IBMPlexMono-Regular.ttf'))
pdfmetrics.registerFont(TTFont('MonoBold',      f'{FONT_DIR}/IBMPlexMono-Bold.ttf'))

# ── Palette (Botanical Telemetry) ────────────────────────────────────────────
INK         = HexColor('#18230f')   # near-black green, body text
DEEP        = HexColor('#253518')   # title weight
FOREST      = HexColor('#354b23')   # primary
OLIVE       = HexColor('#46632e')   # secondary
SAGE        = HexColor('#779757')   # muted accents
SAGE_LIGHT  = HexColor('#c1ceaa')   # field tints
PAPER_TINT  = HexColor('#f3f5ee')   # backdrop
PAPER       = HexColor('#fbfaf6')   # page
SIGNAL      = HexColor('#d4a017')   # telemetry marker (toned-down #fbbf24)
RULE        = HexColor('#a8b294')   # hairline rules
LABEL       = HexColor('#6b7a52')   # mono labels

# ── Layout grid ──────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_Y = 16 * mm
GUTTER = 6 * mm
COL_W = (PAGE_W - 2 * MARGIN_X - 2 * GUTTER) / 3


def hairline(c, x1, y1, x2, y2, color=RULE, width=0.4):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y1, x2, y2)


def crosshair(c, x, y, size=2.5, color=FOREST):
    c.setStrokeColor(color)
    c.setLineWidth(0.5)
    c.line(x - size, y, x + size, y)
    c.line(x, y - size, x, y + size)


def draw_logo(c, x, y, size=12):
    """FitoLink emblem — circle with wheat + satellite arc, telemetry-style."""
    r = size / 2
    cx, cy = x + r, y + r
    # Outer ring (hairline)
    c.setStrokeColor(FOREST)
    c.setLineWidth(0.6)
    c.circle(cx, cy, r, stroke=1, fill=0)
    # Inner filled disc
    c.setFillColor(FOREST)
    c.circle(cx, cy, r * 0.78, stroke=0, fill=1)
    # Stem
    c.setStrokeColor(PAPER)
    c.setLineWidth(0.9)
    c.line(cx, cy - r * 0.5, cx, cy + r * 0.45)
    # Grain ellipses (simplified: two short angled strokes)
    c.setLineWidth(0.7)
    c.line(cx - r * 0.35, cy + r * 0.05, cx, cy + r * 0.30)
    c.line(cx + r * 0.35, cy + r * 0.05, cx, cy + r * 0.30)
    c.line(cx - r * 0.35, cy - r * 0.20, cx, cy + r * 0.05)
    c.line(cx + r * 0.35, cy - r * 0.20, cx, cy + r * 0.05)
    # Satellite arc — signal yellow
    c.setStrokeColor(SIGNAL)
    c.setLineWidth(0.7)
    # two arcs to suggest signal
    c.arc(cx + r * 0.05, cy - r * 0.55, cx + r * 0.95, cy + r * 0.35, -60, 120)


def field_label(c, x, y, text, size=6.5):
    """Mono uppercase label — like a botanical plate identifier."""
    c.setFillColor(LABEL)
    c.setFont('Mono', size)
    c.drawString(x, y, text)


def coord_label(c, x, y, text, size=5.8):
    """Tiny corner coordinate marker."""
    c.setFillColor(LABEL)
    c.setFont('Mono', size)
    c.drawString(x, y, text)


# ── Page ─────────────────────────────────────────────────────────────────────

def draw_lattice(c, x, y, w, h, step=2.5 * mm, color=SAGE_LIGHT):
    """A faint planted-row lattice — restrained, like graph paper seen through paper."""
    c.saveState()
    c.setStrokeColor(color)
    c.setLineWidth(0.25)
    nx = int(w / step)
    ny = int(h / step)
    for i in range(nx + 1):
        cx = x + i * step
        c.line(cx, y, cx, y + h)
    for j in range(ny + 1):
        cy = y + j * step
        c.line(x, cy, x + w, cy)
    c.restoreState()


def build(out_path):
    c = rcanvas.Canvas(out_path, pagesize=A4)
    c.setTitle('FitoLink — Botanical Telemetry · Onepager ASAJA')
    c.setAuthor('System Rapid Solutions')
    c.setSubject('Plataforma de detección satelital + drones agrícolas')

    # Paper backdrop
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, stroke=0, fill=1)

    # Outer crop marks
    for cx, cy in [
        (MARGIN_X, PAGE_H - MARGIN_Y),
        (PAGE_W - MARGIN_X, PAGE_H - MARGIN_Y),
        (MARGIN_X, MARGIN_Y),
        (PAGE_W - MARGIN_X, MARGIN_Y),
    ]:
        crosshair(c, cx, cy, size=2.2, color=RULE)

    # Top corner registration — coordinate (Estepa olive grove, real lat/lng)
    coord_label(c, MARGIN_X, PAGE_H - MARGIN_Y + 3 * mm,
                '37°19′16″N  ·  4°53′02″W')
    coord_label(
        c,
        PAGE_W - MARGIN_X - 30 * mm,
        PAGE_H - MARGIN_Y + 3 * mm,
        'PLATE Nº FL—01 / MMXXVI',
    )

    # ── HEADER ──────────────────────────────────────────────────────────────
    y = PAGE_H - MARGIN_Y
    # Hairline above title
    hairline(c, MARGIN_X, y - 1 * mm, PAGE_W - MARGIN_X, y - 1 * mm,
             color=FOREST, width=0.7)

    # Logo
    draw_logo(c, MARGIN_X, y - 16 * mm, size=12 * mm)

    # Wordmark
    c.setFillColor(DEEP)
    c.setFont('SerifBold', 38)
    c.drawString(MARGIN_X + 16 * mm, y - 13 * mm, 'FitoLink')

    # Subtitle (serif italic, restrained)
    c.setFillColor(OLIVE)
    c.setFont('SerifItalic', 11)
    c.drawString(
        MARGIN_X + 16 * mm,
        y - 18 * mm,
        'Detección satelital + drones agrícolas — temporada 2026',
    )

    # Status badge — right aligned
    badge_text = 'EN PRODUCCIÓN · VALIDACIÓN 2026'
    c.setFont('MonoBold', 7)
    bw = c.stringWidth(badge_text, 'MonoBold', 7)
    bx = PAGE_W - MARGIN_X - bw - 6 * mm
    by = y - 12 * mm
    c.setStrokeColor(SIGNAL)
    c.setFillColor(SIGNAL)
    c.setLineWidth(0.6)
    c.roundRect(bx - 3 * mm, by - 1.5 * mm, bw + 6 * mm, 5 * mm, 1 * mm,
                stroke=1, fill=0)
    c.drawString(bx, by, badge_text)

    # Field label below header
    field_label(c, MARGIN_X, y - 24 * mm, '§ I  ·  ESPECIMEN')

    # Hairline closing the header band
    hairline(c, MARGIN_X, y - 26 * mm, PAGE_W - MARGIN_X, y - 26 * mm,
             color=RULE, width=0.4)

    # ── PROBLEMA — three observations, set with editorial breathing room ───
    y_block = y - 34 * mm
    field_label(c, MARGIN_X, y_block, '§ II  ·  OBSERVACIONES DE CAMPO')
    hairline(c, MARGIN_X + 60 * mm, y_block + 1.5 * mm,
             PAGE_W - MARGIN_X, y_block + 1.5 * mm)

    problems = [
        ('I',
         'El estrés vegetal se detecta tarde — cuando hay síntomas '
         'visibles, ya hay pérdida en la cosecha.'),
        ('II',
         'El agricultor no tiene acceso ágil a pilotos de drones '
         'certificados cuando los necesita.'),
        ('III',
         'El cumplimiento PAC exige cuaderno digital — la mayoría sigue '
         'en papel.'),
    ]
    py = y_block - 9 * mm
    indent = 14 * mm
    leading = 4.8 * mm
    for num, text in problems:
        # Roman numeral — small, signal yellow, baseline-aligned with first text line
        c.setFillColor(SIGNAL)
        c.setFont('MonoBold', 8.5)
        c.drawString(MARGIN_X + 1 * mm, py, num.rjust(3))
        # Body — Crimson Pro, generous leading
        c.setFillColor(INK)
        c.setFont('Serif', 11)
        words = text.split()
        max_w = PAGE_W - 2 * MARGIN_X - indent
        line = ''
        cy = py
        for w in words:
            trial = (line + ' ' + w).strip()
            if c.stringWidth(trial, 'Serif', 11) <= max_w:
                line = trial
            else:
                c.drawString(MARGIN_X + indent, cy, line)
                cy -= leading
                line = w
        if line:
            c.drawString(MARGIN_X + indent, cy, line)
        # Vertical gap between observations, larger than line leading
        py = cy - 8.5 * mm

    # ── SOLUCIÓN — three columns of instrumentation ─────────────────────────
    y_block = py - 3 * mm
    field_label(c, MARGIN_X, y_block, '§ III  ·  INSTRUMENTACIÓN')
    hairline(c, MARGIN_X + 60 * mm, y_block + 1.5 * mm,
             PAGE_W - MARGIN_X, y_block + 1.5 * mm)

    columns = [
        ('01', 'SATÉLITE',
         'Sentinel-2 cada 5 días + IA con baseline histórico de 5 años '
         '(NASA MODIS) detecta anomalías antes de que sean visibles a '
         'simple vista.'),
        ('02', 'ALERTA',
         'El agricultor recibe notificación con severidad, causa probable '
         'y comparativa frente a la media histórica de su parcela.'),
        ('03', 'DRON',
         'Pilotos AESA certificados (AgroXdron, Drovinci) resuelven '
         'aplicación, inspección o diagnóstico en menos de 48 horas.'),
    ]
    cy = y_block - 8 * mm
    col_top = cy
    for i, (num, title, body) in enumerate(columns):
        cx = MARGIN_X + i * (COL_W + GUTTER)
        # Top hairline above each column
        hairline(c, cx, col_top + 5 * mm, cx + COL_W, col_top + 5 * mm,
                 color=FOREST, width=0.6)
        # Mono number, top-left of column
        c.setFillColor(LABEL)
        c.setFont('MonoBold', 8)
        c.drawString(cx, col_top + 1 * mm, num)
        # Title
        c.setFillColor(DEEP)
        c.setFont('SansBold', 13)
        c.drawString(cx, col_top - 5 * mm, title)
        # Body — wrap
        c.setFillColor(INK)
        c.setFont('Serif', 10.2)
        words = body.split()
        line = ''
        ty = col_top - 11 * mm
        for w in words:
            trial = (line + ' ' + w).strip()
            if c.stringWidth(trial, 'Serif', 10.2) <= COL_W - 1 * mm:
                line = trial
            else:
                c.drawString(cx, ty, line)
                ty -= 4.3 * mm
                line = w
        if line:
            c.drawString(cx, ty, line)

    # ── DATOS REALES — instrumentation field ────────────────────────────────
    y_block = col_top - 50 * mm
    # Tinted field
    field_h = 50 * mm
    c.setFillColor(PAPER_TINT)
    c.rect(MARGIN_X, y_block - field_h, PAGE_W - 2 * MARGIN_X, field_h,
           stroke=0, fill=1)
    # Frame
    c.setStrokeColor(SAGE_LIGHT)
    c.setLineWidth(0.6)
    c.rect(MARGIN_X, y_block - field_h, PAGE_W - 2 * MARGIN_X, field_h,
           stroke=1, fill=0)
    # Section label inside the field
    field_label(c, MARGIN_X + 4 * mm, y_block - 5 * mm,
                '§ IV  ·  PIPELINE EN PRODUCCIÓN  —  FUENTES DE DATOS REALES')

    # Two-column data sheet inside the field
    data_y = y_block - 11 * mm
    sources = [
        ('Sentinel-2',  'Copernicus / ESA',  '10 m · cada 5 días',
         'NDVI, NDRE, máscara de nubes'),
        ('MODIS NDVI',  'NASA',              '250 m · 16 días · 5 años',
         'Baseline histórico por parcela'),
        ('ERA5',        'ECMWF',             'reanálisis 30 años',
         'T, lluvia, ET₀ — anomalía 30 d'),
        ('CDSE openEO', 'Copernicus',        'cómputo en la nube',
         'NDVI sin descarga local'),
    ]
    col1_x = MARGIN_X + 6 * mm
    col2_x = MARGIN_X + 60 * mm
    col3_x = MARGIN_X + 100 * mm
    col4_x = MARGIN_X + 140 * mm
    # Header row
    c.setFillColor(LABEL)
    c.setFont('MonoBold', 6.5)
    c.drawString(col1_x, data_y, 'FUENTE')
    c.drawString(col2_x, data_y, 'PROVEEDOR')
    c.drawString(col3_x, data_y, 'RESOLUCIÓN')
    c.drawString(col4_x, data_y, 'OBSERVABLE')
    hairline(c, col1_x, data_y - 1.5 * mm, PAGE_W - MARGIN_X - 4 * mm,
             data_y - 1.5 * mm, color=SAGE_LIGHT)
    data_y -= 5 * mm
    for src, prov, res, obs in sources:
        c.setFillColor(DEEP)
        c.setFont('SansBold', 9)
        c.drawString(col1_x, data_y, src)
        c.setFillColor(INK)
        c.setFont('Serif', 9)
        c.drawString(col2_x, data_y, prov)
        c.setFillColor(LABEL)
        c.setFont('Mono', 8)
        c.drawString(col3_x, data_y, res)
        c.setFillColor(INK)
        c.setFont('Serif', 9)
        c.drawString(col4_x, data_y, obs)
        data_y -= 4.5 * mm

    # Separator hairline between data table and quote
    sep_y = data_y - 1 * mm
    hairline(c, MARGIN_X + 50 * mm, sep_y, PAGE_W - MARGIN_X - 50 * mm,
             sep_y, color=SAGE_LIGHT)

    # Sample alert — caption + italic quote, anchored below the data
    cap_y = sep_y - 4.5 * mm
    c.setFillColor(LABEL)
    c.setFont('MonoBold', 6.5)
    c.drawCentredString(
        PAGE_W / 2, cap_y,
        'EJEMPLO DE ALERTA PRODUCIDA HOY POR EL SISTEMA',
    )

    quote = (
        '«NDVI 0,14 frente a baseline 5 años MODIS 0,22 — '
        'desviación −38 %, severidad crítica».'
    )
    c.setFillColor(OLIVE)
    c.setFont('SerifItalic', 10.5)
    qy = cap_y - 5.5 * mm
    inner_w = PAGE_W - 2 * MARGIN_X - 16 * mm
    words = quote.split()
    line = ''
    quote_lines: list[str] = []
    for w in words:
        trial = (line + ' ' + w).strip()
        if c.stringWidth(trial, 'SerifItalic', 10.5) <= inner_w:
            line = trial
        else:
            quote_lines.append(line)
            line = w
    if line:
        quote_lines.append(line)
    for ln in quote_lines:
        c.drawCentredString(PAGE_W / 2, qy, ln)
        qy -= 4.6 * mm

    # ── PROPUESTA — two paired plots ────────────────────────────────────────
    y_block = y_block - field_h - 6 * mm
    field_label(c, MARGIN_X, y_block, '§ V  ·  PROPUESTA DE COLABORACIÓN')
    hairline(c, MARGIN_X + 60 * mm, y_block + 1.5 * mm,
             PAGE_W - MARGIN_X, y_block + 1.5 * mm)

    box_w = (PAGE_W - 2 * MARGIN_X - GUTTER) / 2
    box_h = 38 * mm
    box_y = y_block - 5 * mm - box_h

    boxes = [
        ('A',
         'FORMACIÓN',
         'AgroXdron y Drovinci tenemos experiencia formativa en '
         'pilotaje AESA y agricultura de precisión. El seguimiento '
         'satelital ya forma parte de nuestros planes formativos. '
         'Disponibles como partners formativos cuando ASAJA lo necesite.'),
        ('B',
         'PILOTO 2026',
         '10–20 explotaciones de socios ASAJA usan FitoLink gratis '
         'durante mayo–octubre 2026. Incluye un vuelo de dron gratuito '
         'por explotación e informe agronómico al cierre. A cambio: '
         'feedback estructurado y testimoniales.'),
    ]
    for i, (letter, title, body) in enumerate(boxes):
        bx = MARGIN_X + i * (box_w + GUTTER)
        # Frame
        c.setStrokeColor(FOREST)
        c.setLineWidth(0.6)
        c.rect(bx, box_y, box_w, box_h, stroke=1, fill=0)
        # Inner top tinted band
        c.setFillColor(SAGE_LIGHT)
        c.rect(bx, box_y + box_h - 8 * mm, box_w, 8 * mm, stroke=0, fill=1)
        # Letter — large monospace
        c.setFillColor(DEEP)
        c.setFont('MonoBold', 18)
        c.drawString(bx + 4 * mm, box_y + box_h - 7 * mm, letter)
        # Title — sans bold
        c.setFillColor(DEEP)
        c.setFont('SansBold', 12)
        c.drawString(bx + 14 * mm, box_y + box_h - 6 * mm, title)
        # Body — serif, wrapped
        c.setFillColor(INK)
        c.setFont('Serif', 9.8)
        ty = box_y + box_h - 14 * mm
        words = body.split()
        line = ''
        for w in words:
            trial = (line + ' ' + w).strip()
            if c.stringWidth(trial, 'Serif', 9.8) <= box_w - 8 * mm:
                line = trial
            else:
                c.drawString(bx + 4 * mm, ty, line)
                ty -= 4.3 * mm
                line = w
        if line:
            c.drawString(bx + 4 * mm, ty, line)

    # ── FOOTER ──────────────────────────────────────────────────────────────
    fy = MARGIN_Y + 2 * mm
    hairline(c, MARGIN_X, fy + 8 * mm, PAGE_W - MARGIN_X, fy + 8 * mm,
             color=FOREST, width=0.6)

    # Crosshair markers framing footer
    crosshair(c, MARGIN_X, fy + 8 * mm, size=1.8, color=FOREST)
    crosshair(c, PAGE_W - MARGIN_X, fy + 8 * mm, size=1.8, color=FOREST)

    # URL — left
    c.setFillColor(DEEP)
    c.setFont('MonoBold', 8.5)
    c.drawString(MARGIN_X, fy + 3.5 * mm, 'fitolink.systemrapid.io')

    # Equipo — center
    c.setFillColor(LABEL)
    c.setFont('Mono', 7.5)
    c.drawCentredString(
        PAGE_W / 2, fy + 3.5 * mm,
        'AGROXDRON  ·  DROVINCI  ·  SYSTEM RAPID',
    )

    # Plate signature — right
    c.setFillColor(LABEL)
    c.setFont('Mono', 7.5)
    c.drawRightString(PAGE_W - MARGIN_X, fy + 3.5 * mm,
                      'PLATE FL-01 · MMXXVI')

    # Bottom imprint line — set at the very baseline of the page
    c.setFillColor(SAGE)
    c.setFont('SerifItalic', 7.2)
    c.drawCentredString(
        PAGE_W / 2, MARGIN_Y / 2 + 1 * mm,
        'Botanical Telemetry — instrumented observation of cultivated land',
    )

    c.showPage()
    c.save()


if __name__ == '__main__':
    out = '/Users/juanguti/dev/srs/fitolink/docs/asaja-onepager/FitoLink_ASAJA_Onepager.pdf'
    build(out)
    print('Wrote', out)
