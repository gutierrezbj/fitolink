import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

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

export const _isLive = isLive; // useful for tests / debug endpoint
