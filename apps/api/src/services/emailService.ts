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

// ── Brand palette · FitoLink como base del ecosistema ───────────────────
// 13-may-2026: decisión de JuanCho. Eliminamos los hex `agrom-*` introducidos
// en mayo y adoptamos la paleta histórica FitoLink (verde topographic +
// terra naranja vivo + earth ocre) como identidad oficial del ecosistema.
// AgroM (empresa) y AgroOps (producto operacional) heredan de aquí.
// Las keys se mantienen para no tocar 145 referencias `c.deep` etc. en el
// código de templates; solo cambian los valores hex.

const AGROM_PALETTE = {
  deep:    '#46632e', // brand-600 · verde topographic FitoLink (mismo que el botón "Acceder" de la landing)
  terra:   '#d45220', // terra-500 · naranja vivo FitoLink
  ink:     '#18230f', // brand-900 · texto principal verde casi negro
  paper:   '#fdf8f0', // earth-50  · fondo cálido tierra
  parch:   '#f5e6cc', // earth-100 · bloque diferenciado
  rule:    '#d4a85a', // earth-300 · hairlines tierra
  muted:   '#6b7280', // gray-500 Tailwind nativo · texto secundario
  // Semantic (alert states)
  alert:   '#b91c1c', // red-700  · critical
  warning: '#c49032', // earth-400 · high / warning
  success: '#15803d', // green-700 · confirmed / ok
  info:    '#64748b', // slate-500 · informational
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

// ────────────────────────────────────────────────────────────────────────
// Transactional emails — bienvenida + primera parcela procesando
// (Ola onboarding · Ronda 2)
// ────────────────────────────────────────────────────────────────────────

export interface WelcomeEmailPayload {
  to: string;
  recipientName: string;
  role: 'farmer' | 'cooperative' | 'pilot' | 'insurer' | 'agronomist' | 'admin';
  needsVerification?: boolean;
}

/**
 * Bienvenida tras alta. Tono Tipo A friendly. Llamada a la acción clara:
 * sube tu primera parcela. Incluye explicación de cuándo llegan los datos
 * y enlace al dashboard. Para roles que requieren verificación manual,
 * el mensaje cambia.
 */
export async function sendWelcomeEmail(payload: WelcomeEmailPayload): Promise<void> {
  const subject = payload.needsVerification
    ? `[AgroM · FitoLink] Hemos recibido tu solicitud — verificación en marcha`
    : `[AgroM · FitoLink] Bienvenido, ${payload.recipientName.split(' ')[0]}`;
  const html = renderWelcomeEmail(payload);
  const text = renderWelcomeText(payload);

  if (!isLive || !transporter) {
    logger.info({ mode: 'dry-run', to: payload.to, subject }, 'Welcome email would be sent');
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
    logger.info({ to: payload.to, messageId: info.messageId }, 'Welcome email sent');
  } catch (err) {
    logger.error({ err, to: payload.to }, 'Welcome email send failed (signup flow unaffected)');
    // Never throw — alta del usuario ya tuvo éxito antes de llamar a este send.
  }
}

function renderWelcomeText(p: WelcomeEmailPayload): string {
  const firstName = p.recipientName.split(' ')[0];
  if (p.needsVerification) {
    return [
      `Hola ${firstName},`,
      '',
      `Hemos recibido tu solicitud de alta como ${p.role}.`,
      'Antes de poder operar comercialmente, nuestro equipo verifica los perfiles',
      'no-agricultor para garantizar la calidad del servicio. Revisaremos tu cuenta',
      'en las próximas 24-48 horas y te avisaremos cuando esté lista.',
      '',
      'Mientras tanto, puedes acceder a tu panel y familiarizarte con la interfaz:',
      `${STAGING_BASE}/dashboard`,
      '',
      '—',
      'AgroM · Inteligencia agraria de precisión',
    ].join('\n');
  }
  return [
    `Buenos días, ${firstName}.`,
    '',
    'Bienvenido a AgroM FitoLink. Estos son tus próximos pasos:',
    '',
    'I. Sube tu primera parcela. Acepta archivos KMZ (SIGPAC, Mapping) o',
    '   dibujado manual del perímetro sobre el mapa.',
    '',
    'II. Elige el cultivo y la provincia. Nuestro sistema consulta el satélite',
    '    europeo Sentinel-2 sobre tus coordenadas y empieza a procesar.',
    '',
    'III. Tu primer informe llega en ~5 días, cuando Sentinel-2 pase por',
    '     tu zona. A partir de ahí, recibirás el informe diario en este email,',
    '     a las 7 de la mañana.',
    '',
    `Acceder al panel: ${STAGING_BASE}/dashboard/parcels/new`,
    '',
    '—',
    'AgroM · Inteligencia agraria de precisión',
    'Para no recibir más emails, responde con "BAJA" en el asunto.',
  ].join('\n');
}

function renderWelcomeEmail(p: WelcomeEmailPayload): string {
  const c = AGROM_PALETTE;
  const firstName = escapeHtml(p.recipientName.split(' ')[0]);
  const ctaUrl = `${STAGING_BASE}/dashboard/parcels/new`;

  if (p.needsVerification) {
    return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><title>Solicitud recibida — AgroM FitoLink</title></head>
<body style="margin:0;padding:0;background:${c.paper};font-family:${FONT_BODY};color:${c.ink};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${c.paper};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid ${c.rule};">
      <tr><td style="padding:30px 36px 20px;border-bottom:1px solid ${c.rule};">
        <p style="margin:0;color:${c.muted};font-size:10px;letter-spacing:3px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · FITOLINK</p>
        <h1 style="margin:10px 0 4px;color:${c.deep};font-size:24px;font-weight:600;font-family:${FONT_DISPLAY};">Hola ${firstName}.</h1>
        <p style="margin:0;color:${c.muted};font-size:14px;font-style:italic;font-family:${FONT_DISPLAY};">Hemos recibido tu solicitud de alta.</p>
      </td></tr>
      <tr><td style="padding:24px 36px;">
        <p style="margin:0 0 8px;color:${c.deep};font-size:12px;font-weight:600;letter-spacing:2.8px;text-transform:uppercase;font-family:${FONT_MONO};">§ VERIFICACIÓN EN MARCHA</p>
        <div style="width:56px;height:2.5px;background:${c.terra};margin-bottom:18px;"></div>
        <p style="margin:0 0 14px;color:${c.ink};font-size:14px;line-height:1.6;">
          Tu perfil de <b>${escapeHtml(p.role)}</b> requiere validación manual por nuestro
          equipo. Es la forma de garantizar que las cooperativas, pilotos y aseguradoras que
          operan en AgroM tienen las credenciales y compromisos adecuados.
        </p>
        <p style="margin:0;color:${c.ink};font-size:14px;line-height:1.6;">
          Revisamos tu cuenta en las próximas 24-48 horas y te avisamos por email cuando
          puedas empezar a operar.
        </p>
      </td></tr>
      <tr><td align="center" style="padding:6px 36px 30px;">
        <a href="${STAGING_BASE}/dashboard" style="display:inline-block;padding:11px 26px;background:${c.deep};color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;font-family:${FONT_BODY};">Acceder al panel →</a>
      </td></tr>
      <tr><td style="padding:18px 36px;background:${c.parch};border-top:1px solid ${c.rule};">
        <p style="margin:0;color:${c.muted};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><title>Bienvenido — AgroM FitoLink</title></head>
<body style="margin:0;padding:0;background:${c.paper};font-family:${FONT_BODY};color:${c.ink};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${c.paper};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid ${c.rule};">

      <tr><td style="padding:30px 36px 20px;border-bottom:1px solid ${c.rule};">
        <p style="margin:0;color:${c.muted};font-size:10px;letter-spacing:3px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · FITOLINK</p>
        <h1 style="margin:10px 0 4px;color:${c.deep};font-size:26px;font-weight:600;font-family:${FONT_DISPLAY};">Buenos días, ${firstName}.</h1>
        <p style="margin:0;color:${c.muted};font-size:14px;font-style:italic;font-family:${FONT_DISPLAY};">Bienvenido a AgroM FitoLink.</p>
      </td></tr>

      <tr><td style="padding:24px 36px 8px;">
        <p style="margin:0 0 8px;color:${c.deep};font-size:12px;font-weight:600;letter-spacing:2.8px;text-transform:uppercase;font-family:${FONT_MONO};">§ TUS PRÓXIMOS PASOS</p>
        <div style="width:56px;height:2.5px;background:${c.terra};margin-bottom:18px;"></div>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td style="padding:0 12px 16px 0;vertical-align:top;width:40px;">
              <span style="font-family:${FONT_DISPLAY};font-size:32px;color:${c.terra};line-height:1;">I</span>
            </td>
            <td style="padding:0 0 16px;vertical-align:top;">
              <p style="margin:0;color:${c.deep};font-family:${FONT_DISPLAY};font-size:16px;font-weight:600;">Sube tu primera parcela.</p>
              <p style="margin:4px 0 0;color:${c.ink};font-size:13px;line-height:1.6;">Acepta KMZ de SIGPAC, Mapping o de tu técnico. También se puede dibujar el perímetro a mano sobre el mapa.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 12px 16px 0;vertical-align:top;">
              <span style="font-family:${FONT_DISPLAY};font-size:32px;color:${c.terra};line-height:1;">II</span>
            </td>
            <td style="padding:0 0 16px;vertical-align:top;">
              <p style="margin:0;color:${c.deep};font-family:${FONT_DISPLAY};font-size:16px;font-weight:600;">Elige cultivo y provincia.</p>
              <p style="margin:4px 0 0;color:${c.ink};font-size:13px;line-height:1.6;">Nuestro sistema consulta el satélite europeo Sentinel-2 sobre tus coordenadas y empieza a procesar.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 12px 18px 0;vertical-align:top;">
              <span style="font-family:${FONT_DISPLAY};font-size:32px;color:${c.terra};line-height:1;">III</span>
            </td>
            <td style="padding:0 0 18px;vertical-align:top;">
              <p style="margin:0;color:${c.deep};font-family:${FONT_DISPLAY};font-size:16px;font-weight:600;">Tu primer informe llega en ~5 días.</p>
              <p style="margin:4px 0 0;color:${c.ink};font-size:13px;line-height:1.6;">Cada 5 días Sentinel-2 pasa sobre tu zona. A partir de ahí, recibirás el informe diario a las 7 de la mañana.</p>
            </td>
          </tr>
        </table>
      </td></tr>

      <tr><td align="center" style="padding:8px 36px 32px;">
        <a href="${ctaUrl}" style="display:inline-block;padding:13px 30px;background:${c.deep};color:#FFFFFF;font-size:15px;font-weight:600;text-decoration:none;font-family:${FONT_BODY};letter-spacing:0.5px;">Subir mi primera parcela →</a>
      </td></tr>

      <tr><td style="padding:18px 36px;background:${c.parch};border-top:1px solid ${c.rule};">
        <p style="margin:0 0 6px;color:${c.muted};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN</p>
        <p style="margin:0;color:${c.muted};font-size:11px;line-height:1.6;">
          Para no recibir más este informe, responda con "BAJA" en el asunto.
          <br>
          <a href="https://agrom.es" style="color:${c.deep};text-decoration:none;">agrom.es</a>
          <span style="color:${c.rule};margin:0 6px;">·</span>
          <a href="${STAGING_BASE}" style="color:${c.deep};text-decoration:none;">fitolink.systemrapid.io</a>
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// ── Email: primera parcela procesando ─────────────────────────────────

export interface FirstParcelEmailPayload {
  to: string;
  recipientName: string;
  parcelName: string;
  cropType: string;
  province: string;
  areaHa: number;
}

export async function sendFirstParcelEmail(payload: FirstParcelEmailPayload): Promise<void> {
  const subject = `[AgroM · FitoLink] Procesando ${payload.parcelName} — primer informe en breve`;
  const html = renderFirstParcelEmail(payload);
  const text = renderFirstParcelText(payload);

  if (!isLive || !transporter) {
    logger.info({ mode: 'dry-run', to: payload.to, subject }, 'First-parcel email would be sent');
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
    logger.info({ to: payload.to, messageId: info.messageId }, 'First-parcel email sent');
  } catch (err) {
    logger.error({ err, to: payload.to }, 'First-parcel email send failed (parcel creation unaffected)');
  }
}

function renderFirstParcelText(p: FirstParcelEmailPayload): string {
  const firstName = p.recipientName.split(' ')[0];
  return [
    `Hola ${firstName},`,
    '',
    `Acabamos de registrar tu parcela "${p.parcelName}" en AgroM FitoLink.`,
    '',
    `Cultivo: ${p.cropType}`,
    `Provincia: ${p.province}`,
    `Superficie: ${p.areaHa} ha`,
    '',
    'El satélite europeo Sentinel-2 tiene revisita de 5 días sobre la península.',
    'En cuanto haga el primer paso por tu zona, generamos el informe inicial y te',
    'llegará en el digest matutino diario que recibes a las 7 de la mañana.',
    '',
    `Acceder a tu parcela: ${STAGING_BASE}/dashboard/parcels`,
    '',
    '—',
    'AgroM · Inteligencia agraria de precisión',
  ].join('\n');
}

function renderFirstParcelEmail(p: FirstParcelEmailPayload): string {
  const c = AGROM_PALETTE;
  const firstName = escapeHtml(p.recipientName.split(' ')[0]);
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><title>Procesando ${escapeHtml(p.parcelName)} — AgroM</title></head>
<body style="margin:0;padding:0;background:${c.paper};font-family:${FONT_BODY};color:${c.ink};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${c.paper};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid ${c.rule};">

      <tr><td style="padding:30px 36px 20px;border-bottom:1px solid ${c.rule};">
        <p style="margin:0;color:${c.muted};font-size:10px;letter-spacing:3px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · FITOLINK</p>
        <h1 style="margin:10px 0 4px;color:${c.deep};font-size:22px;font-weight:600;font-family:${FONT_DISPLAY};">Hola ${firstName}.</h1>
        <p style="margin:0;color:${c.muted};font-size:14px;font-style:italic;font-family:${FONT_DISPLAY};">Hemos registrado tu parcela <b style="color:${c.deep};font-style:normal;">${escapeHtml(p.parcelName)}</b>.</p>
      </td></tr>

      <tr><td style="padding:24px 36px 6px;">
        <p style="margin:0 0 8px;color:${c.deep};font-size:12px;font-weight:600;letter-spacing:2.8px;text-transform:uppercase;font-family:${FONT_MONO};">§ DATOS REGISTRADOS</p>
        <div style="width:56px;height:2.5px;background:${c.terra};margin-bottom:16px;"></div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${c.paper};border:1px solid ${c.rule};">
          <tr>
            <td style="padding:10px 14px;color:${c.muted};font-size:12px;width:120px;font-family:${FONT_MONO};text-transform:uppercase;letter-spacing:1.5px;">Cultivo</td>
            <td style="padding:10px 14px;color:${c.ink};font-size:14px;font-weight:600;">${escapeHtml(p.cropType)}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:${c.muted};font-size:12px;font-family:${FONT_MONO};text-transform:uppercase;letter-spacing:1.5px;border-top:1px solid ${c.rule};">Provincia</td>
            <td style="padding:10px 14px;color:${c.ink};font-size:14px;font-weight:600;border-top:1px solid ${c.rule};">${escapeHtml(p.province)}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;color:${c.muted};font-size:12px;font-family:${FONT_MONO};text-transform:uppercase;letter-spacing:1.5px;border-top:1px solid ${c.rule};">Superficie</td>
            <td style="padding:10px 14px;color:${c.ink};font-size:14px;font-weight:600;border-top:1px solid ${c.rule};">${p.areaHa.toFixed(1)} ha</td>
          </tr>
        </table>
      </td></tr>

      <tr><td style="padding:20px 36px 8px;">
        <p style="margin:0 0 8px;color:${c.deep};font-size:12px;font-weight:600;letter-spacing:2.8px;text-transform:uppercase;font-family:${FONT_MONO};">§ QUÉ PASA AHORA</p>
        <div style="width:56px;height:2.5px;background:${c.terra};margin-bottom:14px;"></div>
        <p style="margin:0;color:${c.ink};font-size:14px;line-height:1.6;">
          El satélite europeo Sentinel-2 tiene revisita de <b>5 días</b> sobre la
          península. En cuanto haga el primer paso por tu zona, generamos el
          informe inicial y te llega en el digest matutino diario a las 7 de la
          mañana. Sin acción requerida.
        </p>
      </td></tr>

      <tr><td align="center" style="padding:14px 36px 32px;">
        <a href="${STAGING_BASE}/dashboard/parcels" style="display:inline-block;padding:13px 28px;background:${c.deep};color:#FFFFFF;font-size:14px;font-weight:600;text-decoration:none;font-family:${FONT_BODY};letter-spacing:0.5px;">Ver mis parcelas →</a>
      </td></tr>

      <tr><td style="padding:18px 36px;background:${c.parch};border-top:1px solid ${c.rule};">
        <p style="margin:0;color:${c.muted};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

// ────────────────────────────────────────────────────────────────────────
// Demo request — formulario "Solicitar demo" desde LandingPage/PricingPage
// (Ola onboarding · Ronda 3)
// ────────────────────────────────────────────────────────────────────────

export interface DemoRequestPayload {
  name: string;
  email: string;
  phone?: string;
  organization?: string;
  hectares?: string;
  cropType?: string;
  message?: string;
}

const DEMO_REQUEST_TO = 'gutierrezbj@gmail.com';
const DEMO_REQUEST_CC = 'johnj@agrom.es';

/**
 * Notifica al equipo comercial (JuanCho + Jonh) que ha llegado un lead.
 * Email texto simple — no es marketing, es operación interna. AgroM brand
 * mínimo (eyebrow + footer) para que el destinatario sepa de dónde viene
 * cuando se mezcle con otras notificaciones.
 */
export async function sendDemoRequestEmail(payload: DemoRequestPayload): Promise<void> {
  const subject = `[AgroM · Lead] ${payload.name}${payload.organization ? ` · ${payload.organization}` : ''}`;
  const text = renderDemoRequestText(payload);
  const html = renderDemoRequestHtml(payload);

  if (!isLive || !transporter) {
    logger.info({ mode: 'dry-run', to: DEMO_REQUEST_TO, cc: DEMO_REQUEST_CC, subject, payload }, 'Demo-request email would be sent');
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: env.SMTP_FROM,
      to: DEMO_REQUEST_TO,
      cc: DEMO_REQUEST_CC,
      replyTo: payload.email, // que un click en "Responder" caiga sobre el prospect directamente
      subject,
      html,
      text,
    });
    logger.info({ from: payload.email, messageId: info.messageId }, 'Demo-request email sent');
  } catch (err) {
    logger.error({ err, from: payload.email }, 'Demo-request email send failed (lead saved in logs)');
  }
}

function renderDemoRequestText(p: DemoRequestPayload): string {
  const lines: string[] = [
    `Nuevo lead AgroM · FitoLink`,
    `Recibido: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    '',
    `Nombre:        ${p.name}`,
    `Email:         ${p.email}`,
  ];
  if (p.phone) lines.push(`Teléfono:      ${p.phone}`);
  if (p.organization) lines.push(`Organización:  ${p.organization}`);
  if (p.hectares) lines.push(`Hectáreas:     ${p.hectares}`);
  if (p.cropType) lines.push(`Cultivo:       ${p.cropType}`);
  if (p.message) {
    lines.push('');
    lines.push('Mensaje:');
    lines.push(p.message);
  }
  lines.push('');
  lines.push('Responde directo a este email — el campo Reply-To está fijado al prospect.');
  return lines.join('\n');
}

function renderDemoRequestHtml(p: DemoRequestPayload): string {
  const c = AGROM_PALETTE;
  const row = (label: string, value?: string) => value
    ? `<tr>
         <td style="padding:8px 14px;color:${c.muted};font-size:12px;width:130px;font-family:${FONT_MONO};text-transform:uppercase;letter-spacing:1.5px;border-bottom:1px solid ${c.rule};">${label}</td>
         <td style="padding:8px 14px;color:${c.ink};font-size:14px;font-weight:600;border-bottom:1px solid ${c.rule};">${escapeHtml(value)}</td>
       </tr>`
    : '';
  return `<!DOCTYPE html>
<html lang="es"><head><meta charset="UTF-8"/><title>Nuevo lead</title></head>
<body style="margin:0;padding:0;background:${c.paper};font-family:${FONT_BODY};color:${c.ink};">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${c.paper};">
  <tr><td align="center" style="padding:32px 16px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border:1px solid ${c.rule};">

      <tr><td style="padding:26px 32px 16px;border-bottom:1px solid ${c.rule};">
        <p style="margin:0;color:${c.muted};font-size:10px;letter-spacing:3px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · LEAD INTERNO</p>
        <h1 style="margin:10px 0 4px;color:${c.deep};font-size:22px;font-weight:600;font-family:${FONT_DISPLAY};">Nuevo lead</h1>
        <p style="margin:0;color:${c.muted};font-size:13px;font-style:italic;font-family:${FONT_DISPLAY};">${new Date().toLocaleString('es-ES')}</p>
      </td></tr>

      <tr><td style="padding:18px 32px 0;">
        <p style="margin:0 0 6px;color:${c.deep};font-size:12px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;font-family:${FONT_MONO};">§ DATOS DEL PROSPECT</p>
        <div style="width:48px;height:2px;background:${c.terra};margin-bottom:14px;"></div>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid ${c.rule};">
          ${row('Nombre', p.name)}
          ${row('Email', p.email)}
          ${row('Teléfono', p.phone)}
          ${row('Organización', p.organization)}
          ${row('Hectáreas', p.hectares)}
          ${row('Cultivo', p.cropType)}
        </table>
      </td></tr>

      ${p.message ? `
      <tr><td style="padding:20px 32px 0;">
        <p style="margin:0 0 6px;color:${c.deep};font-size:12px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;font-family:${FONT_MONO};">§ MENSAJE</p>
        <div style="width:48px;height:2px;background:${c.terra};margin-bottom:12px;"></div>
        <p style="margin:0;color:${c.ink};font-size:14px;line-height:1.6;background:${c.paper};padding:14px;border-left:3px solid ${c.terra};">${escapeHtml(p.message)}</p>
      </td></tr>
      ` : ''}

      <tr><td style="padding:24px 32px;">
        <p style="margin:0;color:${c.muted};font-size:12px;line-height:1.6;font-style:italic;">
          Responde directamente a este email — el campo Reply-To está fijado al prospect (${escapeHtml(p.email)}).
        </p>
      </td></tr>

      <tr><td style="padding:14px 32px;background:${c.parch};border-top:1px solid ${c.rule};">
        <p style="margin:0;color:${c.muted};font-size:10px;letter-spacing:2.5px;text-transform:uppercase;font-family:${FONT_MONO};">AGROM · INTELIGENCIA AGRARIA DE PRECISIÓN</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body></html>`;
}

export const _isLive = isLive; // useful for tests / debug endpoint
