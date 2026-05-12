import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import type {
  DigestPayload,
  DigestParcelForecast,
  DigestWeatherEvent,
  DigestPestAdvisory,
} from './digestService.js';

/**
 * Email notifications via Gmail SMTP (nodemailer).
 *
 * Aligned with OverWatch's email stack — both products operate under the
 * SRS Google Workspace and share the deliverability story. Use a Google
 * App Password (not the account password) in SMTP_PASS.
 *
 * Dual mode: if SMTP_HOST is unset, emails are logged structurally
 * instead of sent (useful for dev/staging without secrets and for tests).
 * Toggle is just pasting env vars in `.env` — zero code change.
 *
 * Workspace plan caps: ~500 emails/day per sender. Abundant for the wedge
 * (1 farmer ≈ 10 emails/day). If we hit the cap, swap to a transactional
 * provider (Resend/SES/SendGrid) — the function signature stays the same.
 */

const isLive = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

let transporter: Transporter | null = null;
if (isLive) {
  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465, // SSL for 465, STARTTLS for 587/others
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

const STAGING_BASE = 'https://fitolink.systemrapid.io';

// ── AgroM brand palette (inherited Identity Sprint AgroM v0.1) ──────────
// Single source of truth for email — keeps the channel consistent with the
// AgroM web and product UI. Update here if the brand evolves.

const AGROM_PALETTE = {
  deep:    '#1B4332', // brand primary, headers, CTA
  terra:   '#E07A3C', // accent, monogram bullet, highlights
  ink:     '#0F2A22', // primary text
  paper:   '#F4F0E8', // warm neutral canvas
  parch:   '#E8DDC9', // differentiated block background
  rule:    '#C9A876', // hairlines, separators
  muted:   '#6B6B5C', // secondary text, labels
  // Semantic (alert states)
  alert:   '#B8312F', // critical
  warning: '#D49343', // high / warning
  success: '#3A7D44', // confirmed / ok
  info:    '#5B7A8F', // informational
} as const;

// AgroM-approved type stack with email-safe fallbacks (Outlook desktop
// can't load custom fonts, so fallbacks must carry the same character).
const FONT_DISPLAY = "'Fraunces', 'Georgia', 'Cambria', serif";
const FONT_BODY = "'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const FONT_MONO = "'IBM Plex Mono', 'SF Mono', 'Consolas', 'Courier New', monospace";

// ── Types ────────────────────────────────────────────────────────────────

const SEVERITY_LABELS = {
  critical: 'CRÍTICA',
  high: 'ALTA',
  medium: 'MEDIA',
  low: 'BAJA',
} as const;

// Severity → AgroM semantic palette
const SEVERITY_COLORS = {
  critical: AGROM_PALETTE.alert,
  high:     AGROM_PALETTE.warning,
  medium:   AGROM_PALETTE.rule,
  low:      AGROM_PALETTE.info,
} as const;

type Severity = keyof typeof SEVERITY_LABELS;

export interface AlertEmailPayload {
  to: string;
  recipientName: string;
  parcelId: string;
  parcelName: string;
  parcelProvince?: string;
  cropType?: string;
  severity: Severity;
  ndviValue: number;
  ndviDelta: number;
  aiConfidence: number;
  detectedAt: Date;
  alertType: string;
  droughtFlag?: string | null;
}

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Send a critical alert email. Never throws — failures are logged and
 * swallowed so the alert creation flow is never blocked by SMTP.
 */
export async function sendAlertEmail(payload: AlertEmailPayload): Promise<void> {
  const subject = subjectFor(payload);
  const html = renderAlertEmail(payload);
  const text = renderAlertText(payload);

  if (!isLive || !transporter) {
    logger.info(
      {
        mode: 'dry-run',
        to: payload.to,
        subject,
        severity: payload.severity,
        ndvi: payload.ndviValue,
      },
      'Email would be sent (SMTP_* not configured)',
    );
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: payload.to,
      subject,
      html,
      text,
    });
    logger.info(
      { to: payload.to, severity: payload.severity, messageId: info.messageId },
      'Alert email sent',
    );
  } catch (err) {
    logger.error({ err, to: payload.to }, 'Email send failed (alert flow unaffected)');
  }
}

// ── Internals ────────────────────────────────────────────────────────────

function subjectFor(p: AlertEmailPayload): string {
  const sev = SEVERITY_LABELS[p.severity];
  return `[FitoLink ${sev}] ${p.parcelName} — NDVI ${p.ndviValue.toFixed(2)}`;
}

function renderAlertText(p: AlertEmailPayload): string {
  const sev = SEVERITY_LABELS[p.severity];
  return [
    `Alerta ${sev} en ${p.parcelName}`,
    p.parcelProvince ? `Provincia: ${p.parcelProvince}` : null,
    p.cropType ? `Cultivo: ${p.cropType}` : null,
    `NDVI actual: ${p.ndviValue.toFixed(2)} (delta ${p.ndviDelta >= 0 ? '+' : ''}${p.ndviDelta.toFixed(2)})`,
    `Confianza IA: ${Math.round(p.aiConfidence * 100)}%`,
    p.droughtFlag && p.droughtFlag !== 'none' ? `Contexto sequía: ${p.droughtFlag}` : null,
    `Detectada: ${p.detectedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    `Ver parcela: ${STAGING_BASE}/dashboard/parcels/${p.parcelId}`,
    '',
    '—',
    'FitoLink · monitorización satelital + drone + trazabilidad',
  ]
    .filter(Boolean)
    .join('\n');
}

function renderAlertEmail(p: AlertEmailPayload): string {
  const sev = SEVERITY_LABELS[p.severity];
  const sevColor = SEVERITY_COLORS[p.severity];
  const ndviStr = p.ndviValue.toFixed(2);
  const deltaStr = `${p.ndviDelta >= 0 ? '+' : ''}${p.ndviDelta.toFixed(2)}`;
  const confidencePct = Math.round(p.aiConfidence * 100);
  const detectedStr = p.detectedAt.toISOString().slice(0, 16).replace('T', ' ');
  const parcelUrl = `${STAGING_BASE}/dashboard/parcels/${p.parcelId}`;
  const c = AGROM_PALETTE;

  const drought = p.droughtFlag && p.droughtFlag !== 'none'
    ? `<tr>
         <td style="padding:8px 14px;color:${c.muted};font-size:13px;width:140px;font-family:${FONT_BODY};">Contexto sequía</td>
         <td style="padding:8px 14px;color:${c.ink};font-size:13px;font-weight:600;text-transform:capitalize;font-family:${FONT_BODY};">${p.droughtFlag}</td>
       </tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AgroM — Alerta ${sev}</title>
<!-- Email-safe font import (Gmail picks up, Outlook desktop falls back to serif/sans system) -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${c.paper};font-family:${FONT_BODY};color:${c.ink};">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${c.paper};padding:28px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border:1px solid ${c.rule}30;border-radius:14px;overflow:hidden;">

        <!-- Brand bar with real AgroM wordmark on paper background -->
        <tr>
          <td style="background:${c.paper};padding:22px 24px;border-bottom:1px solid ${c.rule}40;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="vertical-align:middle;">
                  <img src="${STAGING_BASE}/brand/agrom-wordmark.png" alt="AgroM" width="140" height="44" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;height:auto;">
                </td>
                <td align="right" style="vertical-align:middle;">
                  <span style="font-family:${FONT_MONO};font-size:10px;color:${c.muted};letter-spacing:2px;text-transform:uppercase;border-left:1px solid ${c.rule};padding-left:12px;">FitoLink · ${detectedStr} UTC</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Severity strip -->
        <tr>
          <td style="background:${sevColor};padding:12px 24px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="font-family:${FONT_MONO};font-size:11px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;color:#ffffff;">§ Alerta ${sev}</td>
                <td align="right" style="font-family:${FONT_MONO};font-size:11px;color:#ffffff;opacity:0.85;letter-spacing:1px;">${p.alertType}</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:28px 24px 12px;">
            <p style="margin:0 0 6px;font-family:${FONT_MONO};font-size:10px;color:${c.muted};letter-spacing:1.5px;text-transform:uppercase;">Parcela</p>
            <h1 style="margin:0;color:${c.ink};font-size:26px;font-weight:600;line-height:1.2;font-family:${FONT_DISPLAY};">${escapeHtml(p.parcelName)}</h1>
            ${(p.cropType || p.parcelProvince) ? `<p style="margin:6px 0 0;color:${c.muted};font-size:13px;font-family:${FONT_BODY};">${[p.cropType, p.parcelProvince].filter(Boolean).join(' · ')}</p>` : ''}
          </td>
        </tr>

        <!-- KPI row -->
        <tr>
          <td style="padding:12px 24px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding:14px 16px;background:${c.parch};border-radius:10px;width:50%;">
                  <p style="margin:0;font-family:${FONT_MONO};font-size:10px;color:${c.muted};text-transform:uppercase;letter-spacing:1.5px;">NDVI actual</p>
                  <p style="margin:6px 0 0;color:${sevColor};font-size:30px;font-weight:600;font-variant-numeric:tabular-nums;font-family:${FONT_DISPLAY};line-height:1;">${ndviStr}</p>
                  <p style="margin:4px 0 0;color:${c.muted};font-size:11px;font-family:${FONT_MONO};">Δ ${deltaStr}</p>
                </td>
                <td style="width:10px;"></td>
                <td style="padding:14px 16px;background:${c.parch};border-radius:10px;width:50%;">
                  <p style="margin:0;font-family:${FONT_MONO};font-size:10px;color:${c.muted};text-transform:uppercase;letter-spacing:1.5px;">Confianza IA</p>
                  <p style="margin:6px 0 0;color:${c.deep};font-size:30px;font-weight:600;font-variant-numeric:tabular-nums;font-family:${FONT_DISPLAY};line-height:1;">${confidencePct}<span style="font-size:18px;color:${c.muted};font-weight:400;">%</span></p>
                  <p style="margin:4px 0 0;color:${c.muted};font-size:11px;font-family:${FONT_MONO};">RandomForest V2</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${drought ? `
        <!-- Drought context row -->
        <tr>
          <td style="padding:4px 24px 16px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="border:1px solid ${c.rule}50;border-radius:10px;">
              ${drought}
            </table>
          </td>
        </tr>
        ` : ''}

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:12px 24px 28px;">
            <a href="${parcelUrl}" style="display:inline-block;background:${c.deep};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:10px;font-family:${FONT_BODY};letter-spacing:0.3px;">Ver parcela en FitoLink →</a>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:0 28px 28px;color:${c.ink};font-size:14px;line-height:1.65;font-family:${FONT_BODY};">
            <p style="margin:0;">Hola ${escapeHtml(p.recipientName)},</p>
            <p style="margin:14px 0 0;">FitoLink ha detectado una caída anómala del NDVI en tu parcela <b style="color:${c.deep};">${escapeHtml(p.parcelName)}</b>. La señal cruza los umbrales de severidad ${sev.toLowerCase()} con confianza ${confidencePct}%.</p>
            <p style="margin:14px 0 0;">El siguiente paso es revisar la parcela en el panel y decidir si solicitar una inspección drone para confirmar diagnóstico, o marcar como falso positivo si conoces la causa.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 24px;background:${c.paper};border-top:1px solid ${c.rule}40;color:${c.muted};font-size:11px;text-align:center;font-family:${FONT_MONO};letter-spacing:0.5px;">
            <p style="margin:0 0 4px;">AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN</p>
            <p style="margin:0;">
              <a href="${STAGING_BASE}" style="color:${c.muted};text-decoration:none;">fitolink.systemrapid.io</a>
              <span style="color:${c.rule};margin:0 8px;">·</span>
              <a href="https://agrom.es" style="color:${c.muted};text-decoration:none;">agrom.es</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ────────────────────────────────────────────────────────────────────────
// Morning digest email (Ola 1.5 · Pieza 4) — types imported up top.
// ────────────────────────────────────────────────────────────────────────

const WEATHER_TYPE_LABELS: Record<DigestWeatherEvent['type'], string> = {
  cold_front: 'Frente frío',
  warm_front: 'Subida térmica',
  storm: 'Tormenta',
  low_pressure: 'Lluvias persistentes',
  frost: 'Riesgo de helada',
  extreme_heat: 'Calor extremo',
  high_wind: 'Viento fuerte',
};

const WEATHER_SEVERITY_COLORS: Record<DigestWeatherEvent['severity'], string> = {
  alert: AGROM_PALETTE.alert,
  warning: AGROM_PALETTE.warning,
  info: AGROM_PALETTE.info,
};

const PEST_SEVERITY_LABELS: Record<DigestPestAdvisory['severity'], string> = {
  high: 'ALTA',
  medium: 'MEDIA',
  low: 'BAJA',
};

const PEST_SEVERITY_COLORS: Record<DigestPestAdvisory['severity'], string> = {
  high: AGROM_PALETTE.alert,
  medium: AGROM_PALETTE.warning,
  low: AGROM_PALETTE.info,
};

export interface DigestEmailPayload {
  digest: DigestPayload;
  /** Override the recipient email — useful when User.email is a placeholder. */
  to?: string;
  /** Carbon copy (visible to both parties). Used for ops monitoring + partner share. */
  cc?: string;
}

/**
 * Send the morning digest. Never throws — failures are logged so a single
 * recipient hiccup doesn't block the cron loop. The caller is responsible
 * for stamping `lastDigestSentAt` only after this returns without throwing.
 */
export async function sendDigestEmail(payload: DigestEmailPayload): Promise<void> {
  const { digest } = payload;
  const recipient = payload.to ?? digest.user.email;
  const subject = digestSubject(digest);
  const html = renderDigestHtml(digest);
  const text = renderDigestText(digest);

  if (!isLive || !transporter) {
    logger.info(
      {
        mode: 'dry-run',
        to: recipient,
        cc: payload.cc,
        subject,
        ndviActionable: digest.ndviSection.actionable.length,
        weatherEvents: digest.weatherSection.length,
        pestAdvisories: digest.pestSection.length,
      },
      'Digest email would be sent (SMTP_* not configured)',
    );
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: recipient,
      cc: payload.cc,
      subject,
      html,
      text,
    });
    logger.info(
      {
        to: recipient,
        cc: payload.cc,
        messageId: info.messageId,
        ndviActionable: digest.ndviSection.actionable.length,
        weatherEvents: digest.weatherSection.length,
        pestAdvisories: digest.pestSection.length,
      },
      'Digest email sent',
    );
  } catch (err) {
    logger.error({ err, to: recipient, cc: payload.cc }, 'Digest email send failed');
    throw err; // surface to caller so lastDigestSentAt is NOT stamped
  }
}

function digestSubject(d: DigestPayload): string {
  const parts: string[] = [];
  if (d.ndviSection.actionable.length > 0) parts.push(`${d.ndviSection.actionable.length} parcela${d.ndviSection.actionable.length === 1 ? '' : 's'} a vigilar`);
  if (d.weatherSection.length > 0) parts.push('meteo 7d');
  if (d.pestSection.length > 0) parts.push('aviso fitosanitario');
  const tag = parts.length > 0 ? parts.join(' · ') : 'sin novedades';
  return `[AgroM · FitoLink] Informe del día — ${tag}`;
}

function spanishLongDate(iso: string): string {
  const d = new Date(iso);
  const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`;
}

function renderDigestText(d: DigestPayload): string {
  const lines: string[] = [];
  lines.push(`Buenos días, ${d.user.name}.`);
  lines.push('');
  lines.push(`Resumen del ${spanishLongDate(d.generatedAt)} · ${d.parcelCount} parcela${d.parcelCount === 1 ? '' : 's'} (${d.totalHectares} ha)`);
  lines.push('');

  lines.push('§ 01 · ESTADO DE SUS PARCELAS');
  if (d.ndviSection.actionable.length === 0) {
    lines.push(`Tendencia estable en sus ${d.ndviSection.stableCount} parcela${d.ndviSection.stableCount === 1 ? '' : 's'}. Sin acción requerida.`);
  } else {
    for (const f of d.ndviSection.actionable) {
      lines.push(`- ${f.parcelName}: ${f.message}`);
    }
    if (d.ndviSection.stableCount > 0) {
      lines.push(`(Resto de parcelas — ${d.ndviSection.stableCount} — con tendencia estable.)`);
    }
  }
  lines.push('');

  lines.push('§ 02 · METEOROLOGÍA OPERATIVA (próximos 7 días)');
  if (d.weatherSection.length === 0) {
    lines.push('Sin eventos meteorológicos relevantes en la ventana de 7 días.');
  } else {
    for (const ev of d.weatherSection) {
      lines.push(`- ${WEATHER_TYPE_LABELS[ev.type]} · ${ev.dayLabel}: ${ev.message}`);
    }
  }
  lines.push('');

  lines.push('§ 03 · AVISOS DE SU COMARCA');
  if (d.pestSection.length === 0) {
    lines.push('Sin avisos fitosanitarios activos en sus parcelas.');
  } else {
    for (const adv of d.pestSection) {
      lines.push(`- ${adv.pestName} [${PEST_SEVERITY_LABELS[adv.severity]}] · ${adv.province}${adv.comarca ? ' / ' + adv.comarca : ''}`);
      lines.push(`  ${adv.message}`);
    }
  }
  lines.push('');

  lines.push(`Ver detalle completo: ${STAGING_BASE}/dashboard`);
  lines.push('');
  lines.push('—');
  lines.push('AgroM · Inteligencia agraria de precisión');
  lines.push('Para no recibir más este informe: responda con "BAJA" en el asunto.');
  return lines.join('\n');
}

function renderDigestHtml(d: DigestPayload): string {
  const c = AGROM_PALETTE;
  const url = `${STAGING_BASE}/dashboard`;
  const dateStr = spanishLongDate(d.generatedAt);

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<title>${escapeHtml(digestSubject(d))}</title>
</head>
<body style="margin:0;padding:0;background:${c.paper};font-family:${FONT_BODY};color:${c.ink};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${c.paper};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;background:#FFFFFF;border:1px solid ${c.rule};">

        <!-- Header -->
        <tr>
          <td style="padding:28px 32px 18px;border-bottom:1px solid ${c.rule};">
            <p style="margin:0;color:${c.muted};font-size:10px;letter-spacing:3px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · FITOLINK</p>
            <h1 style="margin:8px 0 4px;color:${c.deep};font-size:24px;font-weight:600;line-height:1.2;font-family:${FONT_DISPLAY};">Buenos días, ${escapeHtml(d.user.name)}</h1>
            <p style="margin:0;color:${c.muted};font-size:13px;font-style:italic;font-family:${FONT_DISPLAY};">Informe del ${dateStr} · ${d.parcelCount} parcela${d.parcelCount === 1 ? '' : 's'} · ${d.totalHectares} ha</p>
          </td>
        </tr>

        <!-- § 01 — NDVI -->
        <tr>
          <td style="padding:28px 32px 8px;">
            <p style="margin:0 0 8px;color:${c.deep};font-size:12px;font-weight:600;letter-spacing:2.8px;text-transform:uppercase;font-family:${FONT_MONO};">§ 01 · ESTADO DE SUS PARCELAS</p>
            <div style="width:56px;height:2.5px;background:${c.terra};margin-bottom:18px;"></div>
            ${renderNdviSection(d)}
          </td>
        </tr>

        <!-- § 02 — Weather -->
        <tr>
          <td style="padding:14px 32px 8px;">
            <p style="margin:0 0 8px;color:${c.deep};font-size:12px;font-weight:600;letter-spacing:2.8px;text-transform:uppercase;font-family:${FONT_MONO};">§ 02 · METEOROLOGÍA OPERATIVA · 7 DÍAS</p>
            <div style="width:56px;height:2.5px;background:${c.terra};margin-bottom:18px;"></div>
            ${renderWeatherSection(d)}
          </td>
        </tr>

        <!-- § 03 — Pest advisories -->
        <tr>
          <td style="padding:14px 32px 22px;">
            <p style="margin:0 0 8px;color:${c.deep};font-size:12px;font-weight:600;letter-spacing:2.8px;text-transform:uppercase;font-family:${FONT_MONO};">§ 03 · AVISOS FITOSANITARIOS DE SU COMARCA</p>
            <div style="width:56px;height:2.5px;background:${c.terra};margin-bottom:18px;"></div>
            ${renderPestSection(d)}
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:8px 32px 28px;">
            <a href="${url}" style="display:inline-block;padding:12px 28px;background:${c.deep};color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;font-family:${FONT_BODY};letter-spacing:0.5px;">Ver detalle completo →</a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:18px 32px;background:${c.parch};border-top:1px solid ${c.rule};">
            <p style="margin:0 0 6px;color:${c.muted};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN</p>
            <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.6;font-family:${FONT_BODY};">
              Recibe este informe porque su cuenta en AgroM FitoLink está suscrita al digest matutino.
              Para no recibirlo más, responda con "BAJA" en el asunto.
              <br>
              <a href="https://agrom.es" style="color:${c.deep};text-decoration:none;">agrom.es</a>
              <span style="color:${c.rule};margin:0 6px;">·</span>
              <a href="${STAGING_BASE}" style="color:${c.deep};text-decoration:none;">fitolink.systemrapid.io</a>
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function renderNdviSection(d: DigestPayload): string {
  const c = AGROM_PALETTE;
  if (d.ndviSection.actionable.length === 0) {
    return `<p style="margin:0;color:${c.ink};font-size:14px;line-height:1.55;font-family:${FONT_BODY};">
      Tendencia estable en sus <b>${d.ndviSection.stableCount}</b> parcela${d.ndviSection.stableCount === 1 ? '' : 's'}. Sin acción requerida hoy.
    </p>`;
  }
  const items = d.ndviSection.actionable.map((f) => renderNdviItem(f)).join('');
  const stableNote = d.ndviSection.stableCount > 0
    ? `<p style="margin:12px 0 0;color:${c.muted};font-size:12px;font-style:italic;font-family:${FONT_DISPLAY};">Resto de parcelas (${d.ndviSection.stableCount}) con tendencia estable.</p>`
    : '';
  return items + stableNote;
}

function renderNdviItem(f: DigestParcelForecast): string {
  const c = AGROM_PALETTE;
  const accent = f.alreadyCritical ? c.alert : c.warning;
  const ndviStr = f.currentNdvi !== null ? f.currentNdvi.toFixed(2) : '—';
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px;border-left:3px solid ${accent};">
    <tr>
      <td style="padding:10px 14px;background:${c.paper};">
        <p style="margin:0 0 4px;color:${c.deep};font-size:14px;font-weight:600;font-family:${FONT_DISPLAY};">${escapeHtml(f.parcelName)} <span style="color:${c.muted};font-weight:400;font-size:12px;">· NDVI ${ndviStr}</span></p>
        <p style="margin:0;color:${c.ink};font-size:13px;line-height:1.5;font-family:${FONT_BODY};">${escapeHtml(f.message)}</p>
      </td>
    </tr>
  </table>`;
}

function renderWeatherSection(d: DigestPayload): string {
  const c = AGROM_PALETTE;
  if (d.weatherSection.length === 0) {
    return `<p style="margin:0;color:${c.ink};font-size:14px;line-height:1.55;font-family:${FONT_BODY};">
      Sin eventos meteorológicos relevantes en la ventana de 7 días.
    </p>`;
  }
  return d.weatherSection.map((ev) => renderWeatherItem(ev)).join('');
}

function renderWeatherItem(ev: DigestWeatherEvent): string {
  const c = AGROM_PALETTE;
  const accent = WEATHER_SEVERITY_COLORS[ev.severity];
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;">
    <tr>
      <td style="padding:8px 12px;background:${c.paper};border-left:3px solid ${accent};">
        <p style="margin:0 0 2px;color:${c.muted};font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:${FONT_MONO};">${WEATHER_TYPE_LABELS[ev.type]} · ${escapeHtml(ev.dayLabel)}</p>
        <p style="margin:0;color:${c.ink};font-size:13px;line-height:1.5;font-family:${FONT_BODY};">${escapeHtml(ev.message)}</p>
      </td>
    </tr>
  </table>`;
}

function renderPestSection(d: DigestPayload): string {
  const c = AGROM_PALETTE;
  if (d.pestSection.length === 0) {
    return `<p style="margin:0;color:${c.ink};font-size:14px;line-height:1.55;font-family:${FONT_BODY};">
      Sin avisos fitosanitarios activos en su zona.
    </p>`;
  }
  return d.pestSection.map((adv) => renderPestItem(adv)).join('');
}

function renderPestItem(adv: DigestPestAdvisory): string {
  const c = AGROM_PALETTE;
  const accent = PEST_SEVERITY_COLORS[adv.severity];
  const location = `${escapeHtml(adv.province)}${adv.comarca ? ' · ' + escapeHtml(adv.comarca) : ''}`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:10px;">
    <tr>
      <td style="padding:10px 14px;background:${c.paper};border-left:3px solid ${accent};">
        <p style="margin:0 0 2px;color:${c.muted};font-size:10px;letter-spacing:2px;text-transform:uppercase;font-family:${FONT_MONO};">${escapeHtml(PEST_SEVERITY_LABELS[adv.severity])} · ${location}</p>
        <p style="margin:0 0 4px;color:${c.deep};font-size:14px;font-weight:600;font-family:${FONT_DISPLAY};">${escapeHtml(adv.pestName)}</p>
        <p style="margin:0;color:${c.ink};font-size:13px;line-height:1.5;font-family:${FONT_BODY};">${escapeHtml(adv.message)}</p>
      </td>
    </tr>
  </table>`;
}

export const _isLive = isLive; // useful for tests / debug endpoint
