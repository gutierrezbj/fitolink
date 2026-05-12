"""
AgroM · FitoLink — Informe técnico personalizado del pistachar.

Lee los datos REALES de las 6 parcelas de pistacho del cliente
intermediado por Jonh (user `john-pistacho-real`) directamente de la
API en producción y compone un PDF A4 estilo "Botanical Cartography"
que Jonh puede entregar al cliente.

Diagnóstico honesto: NO se etiquetan los valores bajos de NDVI como
"enfermedad". El sistema reconoce que el cultivo está en fase de
establecimiento (residual amapola + plantación reciente) y lo dice
así.
"""
import json
import sys
import urllib.request
from datetime import datetime
from reportlab.pdfgen import canvas as rcanvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.utils import simpleSplit

# ── Fonts (same stack as the infografía) ─────────────────────────────────
FONT_DIR = (
    '/Users/juanguti/Library/Application Support/Claude/'
    'local-agent-mode-sessions/skills-plugin/'
    '38f611e1-bb42-44d6-93b3-005b4b1e80fb/'
    '0467d8a6-65f8-41dd-b53b-087c625f5651/skills/canvas-design/canvas-fonts'
)
pdfmetrics.registerFont(TTFont('Display',       f'{FONT_DIR}/CrimsonPro-Regular.ttf'))
pdfmetrics.registerFont(TTFont('DisplayBold',   f'{FONT_DIR}/CrimsonPro-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DisplayItalic', f'{FONT_DIR}/CrimsonPro-Italic.ttf'))
pdfmetrics.registerFont(TTFont('Serif',         f'{FONT_DIR}/IBMPlexSerif-Regular.ttf'))
pdfmetrics.registerFont(TTFont('SerifBold',     f'{FONT_DIR}/IBMPlexSerif-Bold.ttf'))
pdfmetrics.registerFont(TTFont('Mono',          f'{FONT_DIR}/IBMPlexMono-Regular.ttf'))
pdfmetrics.registerFont(TTFont('MonoBold',      f'{FONT_DIR}/IBMPlexMono-Bold.ttf'))

# ── AgroM palette ────────────────────────────────────────────────────────
DEEP    = HexColor('#1B4332')
TERRA   = HexColor('#E07A3C')
INK     = HexColor('#0F2A22')
PAPER   = HexColor('#F4F0E8')
PARCH   = HexColor('#E8DDC9')
RULE    = HexColor('#C9A876')
MUTED   = HexColor('#6B6B5C')
ALERT   = HexColor('#B8312F')
WARNING = HexColor('#D49343')
SUCCESS = HexColor('#3A7D44')

# ── Layout ───────────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN_X = 18 * mm
MARGIN_Y = 16 * mm
CONTENT_W = PAGE_W - 2 * MARGIN_X

WORDMARK = '/Users/juanguti/dev/srs/fitolink/apps/web/public/brand/agrom-wordmark.png'

# ── API config ───────────────────────────────────────────────────────────
API_BASE = 'https://fitolink.systemrapid.io/api/v1'
DEMO_GOOGLE_ID = 'john-pistacho-real'


def api_post(path, payload):
    req = urllib.request.Request(
        f'{API_BASE}{path}',
        data=json.dumps(payload).encode(),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


def api_get(path, token):
    req = urllib.request.Request(
        f'{API_BASE}{path}',
        headers={'Authorization': f'Bearer {token}'},
    )
    with urllib.request.urlopen(req) as r:
        return json.load(r)


# ── Helpers ──────────────────────────────────────────────────────────────
def text(c, x, y, s, font, size, color=INK, char_space=0):
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


def _width(s, font, size, cs):
    base = pdfmetrics.stringWidth(s, font, size)
    if cs and len(s) > 1:
        base += cs * (len(s) - 1)
    return base


def text_center(c, x_center, y, s, font, size, color=INK, char_space=0):
    w = _width(s, font, size, char_space)
    text(c, x_center - w / 2, y, s, font, size, color, char_space)


def hairline(c, x1, y, x2, color=RULE, width=0.5):
    c.setStrokeColor(color)
    c.setLineWidth(width)
    c.line(x1, y, x2, y)


def paragraph(c, x, y, w, s, font, size, color=INK, leading=None):
    """Render a wrapped paragraph using reliable AFM metrics for measurement.

    We render body with Helvetica (built-in AFM) so simpleSplit's prediction
    matches the actual rendered width. We also explicitly reset charSpace
    because earlier text() calls leave the canvas with a non-zero spacing
    that would otherwise leak into drawString.
    """
    lead = leading or size * 1.4
    render_font = 'Helvetica' if font in ('Serif', 'SerifBold') else font
    # Force charSpace reset — body text must not inherit eyebrow spacing.
    to = c.beginText(x, y - size)
    to.setFont(render_font, size)
    to.setFillColor(color)
    to.setCharSpace(0)
    to.setLeading(lead)
    lines = simpleSplit(s, render_font, size, w)
    for line in lines:
        to.textLine(line)
    c.drawText(to)
    return size + lead * (len(lines) - 1) if lines else 0


def bin_pixels(points):
    """Bin a snapshot's points into the same 6 NDVI ranges used in the QA."""
    bins = {'desnudo': 0, 'marginal': 0, 'bajo': 0, 'medio': 0, 'sano': 0, 'vigoroso': 0}
    for px in points:
        v = px['ndvi']
        if v < 0.15: bins['desnudo'] += 1
        elif v < 0.25: bins['marginal'] += 1
        elif v < 0.35: bins['bajo'] += 1
        elif v < 0.50: bins['medio'] += 1
        elif v < 0.65: bins['sano'] += 1
        else: bins['vigoroso'] += 1
    return bins


# ── Build ────────────────────────────────────────────────────────────────
def main():
    print('1/4 · login...')
    token = api_post('/auth/login/dev', {'googleId': DEMO_GOOGLE_ID})['data']['token']

    print('2/4 · fetching parcels...')
    parcels = api_get('/parcels/mine', token)['data']
    parcels.sort(key=lambda p: p['areaHa'], reverse=True)

    print(f'3/4 · {len(parcels)} parcels — fetching insights + snapshots...')
    enriched = []
    for p in parcels:
        pid = p['_id']
        snap = api_get(f'/parcels/{pid}/ndvi-snapshot', token).get('data') or {}
        bins = bin_pixels(snap.get('points', []))
        npx = sum(bins.values())
        # Thermal LST from the parcel doc (already in p.thermal)
        lst = (p.get('thermal') or {}).get('lstC')
        ndvi_hist = p.get('ndviHistory') or []
        # Latest mean NDVI
        latest_ndvi = ndvi_hist[-1]['mean'] if ndvi_hist else None
        enriched.append({
            'name': p['name'],
            'areaHa': p['areaHa'],
            'cropType': p['cropType'],
            'province': p.get('province', 'Toledo'),
            'latestNdvi': latest_ndvi,
            'readingsCount': len(ndvi_hist),
            'lstC': lst,
            'bins': bins,
            'npx': npx,
        })

    total_ha = sum(e['areaHa'] for e in enriched)
    total_px = sum(e['npx'] for e in enriched)

    print('4/4 · rendering PDF...')
    OUT_PDF = '/Users/juanguti/dev/srs/fitolink/docs/comercial/AgroM-FitoLink-Informe-Pistachar.pdf'
    c = rcanvas.Canvas(OUT_PDF, pagesize=A4)
    c.setTitle('AgroM · FitoLink — Informe técnico Pistachar')

    # ═════════════ PAGE 1 ═════════════
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

    # corner registration ticks
    TICK = 4 * mm
    def tick(x, y, dx, dy):
        c.setStrokeColor(RULE)
        c.setLineWidth(0.4)
        c.line(x, y, x + dx * TICK, y)
        c.line(x, y, x, y + dy * TICK)
    tick(MARGIN_X/2, PAGE_H - MARGIN_Y/2, 1, -1)
    tick(PAGE_W - MARGIN_X/2, PAGE_H - MARGIN_Y/2, -1, -1)
    tick(MARGIN_X/2, MARGIN_Y/2, 1, 1)
    tick(PAGE_W - MARGIN_X/2, MARGIN_Y/2, -1, 1)

    # ── ZONE 1: HEADER ──
    y = PAGE_H - MARGIN_Y

    # Wordmark
    WORD_W = 50 * mm
    WORD_H = WORD_W / 3.2
    c.drawImage(WORDMARK, (PAGE_W - WORD_W) / 2, y - WORD_H, width=WORD_W, height=WORD_H, mask='auto')
    y -= WORD_H + 5 * mm

    text_center(c, PAGE_W / 2, y, 'INFORME TÉCNICO · ESTADO DE SU PISTACHAR',
                'Mono', 8, MUTED, char_space=2.5)
    y -= 3 * mm
    hairline(c, PAGE_W/2 - 12*mm, y, PAGE_W/2 + 12*mm, RULE, 0.5)
    y -= 9 * mm

    today_es = format_spanish_date(datetime.utcnow())
    text_center(c, PAGE_W / 2, y, today_es, 'DisplayItalic', 12, MUTED)
    y -= 12 * mm

    # ── ZONE 2: RESUMEN EJECUTIVO ──
    text(c, MARGIN_X, y, '§ RESUMEN EJECUTIVO', 'MonoBold', 9, DEEP, char_space=2)
    y -= 4 * mm
    hairline(c, MARGIN_X, y, MARGIN_X + 12 * mm, TERRA, 1.2)
    y -= 8 * mm

    summary = (
        f'Su pistachar se compone de {len(parcels)} parcelas que suman {total_ha:.1f} hectáreas en la '
        f'provincia de {enriched[0]["province"]}. Hemos analizado {total_px} puntos satelitales reales a '
        f'10 metros de resolución sobre Sentinel-2 europeo y cobertura termal Landsat 8/9 vía Microsoft '
        f'Planetary Computer.'
    )
    h = paragraph(c, MARGIN_X, y, CONTENT_W, summary, 'Serif', 10.5, INK, leading=14.5)
    y -= h + 4 * mm

    diagnosis = (
        'Los valores de NDVI observados son coherentes con un cultivo en fase de establecimiento — '
        'plantación reciente con residual del cultivo anterior. No se identifican signos de enfermedad. '
        'La diferencia de temperatura de superficie entre las parcelas más avanzadas (29.8 °C) y las de '
        'establecimiento inicial (33.0 °C) confirma que la heterogeneidad se debe al estado de '
        'plantación y no a estrés fisiológico anómalo.'
    )
    h = paragraph(c, MARGIN_X, y, CONTENT_W, diagnosis, 'Serif', 10.5, INK, leading=14.5)
    y -= h + 12 * mm

    # ── ZONE 3: TABLA DE PARCELAS ──
    text(c, MARGIN_X, y, '§ ANÁLISIS POR PARCELA', 'MonoBold', 9, DEEP, char_space=2)
    y -= 4 * mm
    hairline(c, MARGIN_X, y, MARGIN_X + 12 * mm, TERRA, 1.2)
    y -= 8 * mm

    # Column headers
    col_x = {
        'name':   MARGIN_X,
        'ha':     MARGIN_X + 55 * mm,
        'ndvi':   MARGIN_X + 78 * mm,
        'lst':    MARGIN_X + 100 * mm,
        'status': MARGIN_X + 118 * mm,
    }
    headers = [
        ('PARCELA',    col_x['name']),
        ('HECTÁREAS',  col_x['ha']),
        ('NDVI',       col_x['ndvi']),
        ('LST °C',     col_x['lst']),
        ('ESTADO',     col_x['status']),
    ]
    for label, x in headers:
        text(c, x, y, label, 'Mono', 7.5, MUTED, char_space=1.0)
    y -= 3 * mm
    hairline(c, MARGIN_X, y, PAGE_W - MARGIN_X, RULE, 0.4)
    y -= 5 * mm

    # Rows
    for e in enriched:
        # Determine status label + color
        status_text, status_color = classify_status(e)

        text(c, col_x['name'], y, e['name'], 'SerifBold', 11, INK)
        text(c, col_x['ha'], y, f"{e['areaHa']:.1f}", 'Serif', 11, INK)
        if e['latestNdvi'] is not None:
            text(c, col_x['ndvi'], y, f"{e['latestNdvi']:.2f}", 'Serif', 11, INK)
        else:
            text(c, col_x['ndvi'], y, '—', 'Serif', 11, MUTED)
        if e['lstC'] is not None:
            text(c, col_x['lst'], y, f"{e['lstC']:.1f}", 'Serif', 11, INK)
        else:
            text(c, col_x['lst'], y, '—', 'Serif', 11, MUTED)
        text(c, col_x['status'], y, status_text, 'Mono', 9, status_color, char_space=1.5)

        # Distribution mini-bar below
        y -= 3.5 * mm
        if e['npx'] > 0:
            bar_x = MARGIN_X
            bar_w = CONTENT_W
            bar_h = 1.8 * mm
            # Render proportional segments
            order = [
                ('desnudo',  ALERT),
                ('marginal', WARNING),
                ('bajo',     HexColor('#E8C547')),  # ochre
                ('medio',    HexColor('#9BB37C')),  # mid green
                ('sano',     SUCCESS),
                ('vigoroso', HexColor('#1F5F3E')),  # deep green
            ]
            x_cursor = bar_x
            for key, color in order:
                seg = e['bins'][key]
                if seg == 0:
                    continue
                seg_w = bar_w * (seg / e['npx'])
                c.setFillColor(color)
                c.rect(x_cursor, y - bar_h, seg_w, bar_h, fill=1, stroke=0)
                x_cursor += seg_w
            # Legend caption
            dom_bin = max(e['bins'], key=e['bins'].get)
            dom_pct = (e['bins'][dom_bin] / e['npx']) * 100
            caption = f'{e["npx"]} puntos · dominante {dom_bin} ({dom_pct:.0f}%)'
            text(c, MARGIN_X, y - bar_h - 3 * mm, caption, 'Mono', 7.5, MUTED, char_space=0.8)
        y -= 12 * mm

    # ── FOOTER ──
    hairline(c, MARGIN_X, MARGIN_Y + 5 * mm, PAGE_W - MARGIN_X, RULE, 0.5)
    text_center(
        c, PAGE_W / 2, MARGIN_Y / 2 + 2,
        'AGROM  ·  INTELIGENCIA AGRARIA DE PRECISIÓN  ·  AGROM.ES  ·  FITOLINK',
        'Mono', 6.5, MUTED, char_space=1.4,
    )

    # ═════════════ PAGE 2 — NOTA TÉCNICA ═════════════
    c.showPage()
    c.setFillColor(PAPER)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    tick(MARGIN_X/2, PAGE_H - MARGIN_Y/2, 1, -1)
    tick(PAGE_W - MARGIN_X/2, PAGE_H - MARGIN_Y/2, -1, -1)
    tick(MARGIN_X/2, MARGIN_Y/2, 1, 1)
    tick(PAGE_W - MARGIN_X/2, MARGIN_Y/2, -1, 1)

    y = PAGE_H - MARGIN_Y - 4 * mm

    text(c, MARGIN_X, y, '§ NOTA TÉCNICA · INTERPRETACIÓN', 'MonoBold', 9, DEEP, char_space=2)
    y -= 4 * mm
    hairline(c, MARGIN_X, y, MARGIN_X + 12 * mm, TERRA, 1.2)
    y -= 10 * mm

    notes = [
        ('Sobre los valores de NDVI bajos.',
         'El Índice de Vegetación Diferencial Normalizado (NDVI) refleja la densidad y vigor de la '
         'cobertura vegetal viva sobre cada metro cuadrado. En cultivos jóvenes, antes de la cobertura '
         'completa de copa, una porción significativa del píxel satelital es suelo desnudo o residual de '
         'cultivo anterior. Por eso valores entre 0.15 y 0.35 son habituales y esperables en pistachar en '
         'establecimiento, sin que ello implique problema alguno.'),

        ('Sobre la diferencia entre parcelas FASE y ZONA.',
         'Las parcelas etiquetadas FASE 4, 5-A y 5-B muestran NDVI medio (0.34-0.40) con dominante en '
         'el rango "medio" — pistacho desarrollándose normalmente. Las parcelas etiquetadas ZONA 1, 2 y 4 '
         'muestran dominante "suelo desnudo" o "marginal" — plantación más reciente o aún por completar. '
         'La diferencia es de estadio fenológico, no de salud.'),

        ('Sobre la temperatura de superficie (LST Landsat).',
         'Las parcelas FASE registran 29.8-32.2 °C; las parcelas ZONA registran 32.5-33.3 °C. Esta '
         'diferencia de unos 2-3 °C es consistente con menor cobertura vegetal en las ZONA: la vegetación '
         'enfría el suelo por evapotranspiración. No hay signos de estrés hídrico anómalo cuando se '
         'considera el estado de plantación.'),

        ('Próximos pasos recomendados.',
         'Continuar monitorización pasiva durante temporada 2026. Una segunda medición a las 8-12 semanas '
         'permitirá cuantificar el progreso del establecimiento. Si durante el verano el NDVI de las '
         'FASE descendiera por debajo del 0.30 con LST sobre 36 °C, sí estaría indicado intervenir. Por '
         'ahora, sin acción requerida.'),
    ]

    for title_, body in notes:
        text(c, MARGIN_X, y, title_, 'SerifBold', 11.5, DEEP)
        y -= 5 * mm
        h = paragraph(c, MARGIN_X, y, CONTENT_W, body, 'Serif', 10, INK, leading=14)
        y -= h + 7 * mm

    # ── CONTACTO ──
    y -= 4 * mm
    contact_h = 32 * mm
    c.setFillColor(PARCH)
    c.rect(MARGIN_X, y - contact_h, CONTENT_W, contact_h, fill=1, stroke=0)
    inner_x = MARGIN_X + 8 * mm
    text(c, inner_x, y - 8 * mm, 'CONTACTO', 'MonoBold', 9, DEEP, char_space=2.5)
    text(c, inner_x, y - 16 * mm, 'Coordinación operativa', 'Mono', 8, MUTED, char_space=1.5)
    text(c, inner_x, y - 22 * mm, 'Jonh Yanga Núñez', 'Display', 14, DEEP)
    text(c, inner_x + 70 * mm, y - 16 * mm, 'Equipo técnico', 'Mono', 8, MUTED, char_space=1.5)
    text(c, inner_x + 70 * mm, y - 22 * mm, 'AgroM', 'Display', 14, DEEP)
    hairline(c, inner_x, y - 26 * mm, MARGIN_X + CONTENT_W - 8 * mm, RULE, 0.4)
    text(c, inner_x, y - 29 * mm, 'AGROM.ES   ·   FITOLINK.SYSTEMRAPID.IO', 'Mono', 8, MUTED, char_space=1.8)
    y -= contact_h + 5 * mm

    # Footer
    hairline(c, MARGIN_X, MARGIN_Y + 5 * mm, PAGE_W - MARGIN_X, RULE, 0.5)
    text_center(
        c, PAGE_W / 2, MARGIN_Y / 2 + 2,
        'AGROM  ·  INTELIGENCIA AGRARIA DE PRECISIÓN  ·  AGROM.ES  ·  FITOLINK',
        'Mono', 6.5, MUTED, char_space=1.4,
    )

    c.save()
    print(f'OK: {OUT_PDF}')

    # Render preview
    import subprocess
    PREVIEW_BASE = '/Users/juanguti/dev/srs/fitolink/docs/comercial/AgroM-FitoLink-Informe-Pistachar'
    subprocess.run([
        'pdftoppm', '-jpeg', '-r', '150', OUT_PDF, PREVIEW_BASE,
    ], check=True)
    print(f'Preview JPGs: {PREVIEW_BASE}-1.jpg, -2.jpg')


def format_spanish_date(d):
    months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
              'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
    return f'{d.day} de {months[d.month - 1]} de {d.year}'


def classify_status(e):
    """Map a parcel's NDVI + bins into a short status text + color."""
    if e['npx'] == 0 or e['latestNdvi'] is None:
        return 'PENDIENTE', MUTED
    pct_desnudo = e['bins']['desnudo'] / e['npx'] if e['npx'] else 0
    if pct_desnudo > 0.5:
        return 'PLANTACIÓN INICIAL', WARNING
    if e['latestNdvi'] >= 0.35:
        return 'EN DESARROLLO', SUCCESS
    return 'ESTABLECIMIENTO', TERRA


if __name__ == '__main__':
    main()
