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

// ── Types ────────────────────────────────────────────────────────────────

const SEVERITY_LABELS = {
  critical: 'CRÍTICA',
  high: 'ALTA',
  medium: 'MEDIA',
  low: 'BAJA',
} as const;

const SEVERITY_COLORS = {
  critical: '#dc2626', // red-600
  high: '#ea580c',     // orange-600
  medium: '#ca8a04',   // yellow-600
  low: '#2563eb',      // blue-600
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
  const color = SEVERITY_COLORS[p.severity];
  const sev = SEVERITY_LABELS[p.severity];
  const ndviStr = p.ndviValue.toFixed(2);
  const deltaStr = `${p.ndviDelta >= 0 ? '+' : ''}${p.ndviDelta.toFixed(2)}`;
  const confidencePct = Math.round(p.aiConfidence * 100);
  const detectedStr = p.detectedAt.toISOString().slice(0, 16).replace('T', ' ');
  const parcelUrl = `${STAGING_BASE}/dashboard/parcels/${p.parcelId}`;
  const drought = p.droughtFlag && p.droughtFlag !== 'none'
    ? `<tr><td style="padding:6px 12px;color:#6b7280;font-size:13px;width:140px;">Contexto sequía</td><td style="padding:6px 12px;color:#111827;font-size:13px;font-weight:600;text-transform:capitalize;">${p.droughtFlag}</td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>FitoLink — Alerta ${sev}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f3f4f6;padding:24px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.06);">

        <!-- Severity strip -->
        <tr>
          <td style="background:${color};padding:14px 24px;color:#ffffff;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Alerta ${sev}</td>
                <td align="right" style="font-size:11px;opacity:0.85;">${detectedStr} UTC</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Title -->
        <tr>
          <td style="padding:24px 24px 8px;">
            <h1 style="margin:0;color:#111827;font-size:20px;font-weight:700;line-height:1.3;">${p.parcelName}</h1>
            <p style="margin:4px 0 0;color:#6b7280;font-size:13px;">${[p.cropType, p.parcelProvince].filter(Boolean).join(' · ')}</p>
          </td>
        </tr>

        <!-- KPI row -->
        <tr>
          <td style="padding:16px 24px 8px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
              <tr>
                <td style="padding:12px 16px;background:#f9fafb;border-radius:10px;width:50%;">
                  <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">NDVI actual</p>
                  <p style="margin:4px 0 0;color:${color};font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;">${ndviStr}</p>
                  <p style="margin:2px 0 0;color:#9ca3af;font-size:11px;">delta ${deltaStr}</p>
                </td>
                <td style="width:8px;"></td>
                <td style="padding:12px 16px;background:#f9fafb;border-radius:10px;width:50%;">
                  <p style="margin:0;color:#6b7280;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;">Confianza IA</p>
                  <p style="margin:4px 0 0;color:#111827;font-size:24px;font-weight:700;font-variant-numeric:tabular-nums;">${confidencePct}%</p>
                  <p style="margin:2px 0 0;color:#9ca3af;font-size:11px;">RandomForest V2</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Details -->
        <tr>
          <td style="padding:8px 24px 16px;">
            <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:#f9fafb;border-radius:10px;">
              <tr><td style="padding:8px 12px;color:#6b7280;font-size:13px;width:140px;">Tipo de alerta</td><td style="padding:8px 12px;color:#111827;font-size:13px;font-weight:600;">${p.alertType}</td></tr>
              ${drought}
            </table>
          </td>
        </tr>

        <!-- CTA -->
        <tr>
          <td align="center" style="padding:8px 24px 24px;">
            <a href="${parcelUrl}" style="display:inline-block;background:${color};color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:10px;">Ver parcela en FitoLink →</a>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:0 24px 24px;color:#374151;font-size:14px;line-height:1.6;">
            <p style="margin:0;">Hola ${escapeHtml(p.recipientName)},</p>
            <p style="margin:12px 0 0;">FitoLink ha detectado una caída anómala del NDVI en tu parcela <b>${escapeHtml(p.parcelName)}</b>. La señal cruza los umbrales de severidad ${sev.toLowerCase()} con confianza ${confidencePct}%.</p>
            <p style="margin:12px 0 0;">El siguiente paso es revisar la parcela en el panel y decidir si solicitar una inspección drone para confirmar diagnóstico, o marcar como falso positivo si conoces la causa.</p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 24px;background:#f9fafb;border-top:1px solid #e5e7eb;color:#9ca3af;font-size:11px;text-align:center;">
            FitoLink · monitorización satelital + drone + trazabilidad<br>
            <a href="${STAGING_BASE}" style="color:#9ca3af;text-decoration:none;">${STAGING_BASE.replace('https://', '')}</a>
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
