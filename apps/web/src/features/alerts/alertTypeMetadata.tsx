/**
 * alertTypeMetadata · helper centralizado para identificar tipo de alerta
 * de un vistazo en las tarjetas (AlertsPage + DashboardHome + AlertBell +
 * B2BAlertsPage).
 *
 * UX hygiene PM JuanCho 9-jun-2026 cierre del día: "en las tarjetas de
 * alarma sería buena una señal para identificar qué tipo de anomalía o
 * alert tiene la parcela, fuego, agua, plaga". 4 SVG editoriales line-icons
 * monocromáticos (color heredado del parent via currentColor) coherentes
 * con la design-philosophy Botanical Cartography (no emojis decorativos).
 *
 * Cubre los 5 tipos de Alert que el sistema sabe emitir hoy:
 *   - 'ndvi_drop'      → 🍂 hoja seca · caída de vegetación
 *   - 'ndre_anomaly'   → ✦ destello · anomalía foliar
 *   - 'stress_pattern' → 💧 gota · estrés hídrico
 *   - 'fire_proximity' → 🔥 llama · foco térmico cercano
 *   - 'pest_advisory'  → 🐛 bicho · aviso fitosanitario oficial en comarca
 *                        (Sprint Notificación de Plagas · 12-jul-2026 ·
 *                        emitido por el fan-out de pestAdvisoryService)
 *
 * Próximas iteraciones añadirán tipos: heat_extreme, disease_pattern
 * (rule-based futuro).
 */

import type { ReactNode } from 'react';
import { ALERT_TYPES } from '@fitolink/shared';

export type AlertType = (typeof ALERT_TYPES)[number];

export interface AlertTypeMetadata {
  /** SVG inline 14x14 line-icon · color heredado · listo para insertar en cualquier flex row */
  icon: ReactNode;
  /** Etiqueta larga · ideal para badge texto + hover title */
  label: string;
  /** Etiqueta corta · ideal para badges muy comprimidos (sidebar 2x2) */
  shortLabel: string;
}

const ICON_SIZE = 14;
const COMMON_PROPS = {
  width: ICON_SIZE,
  height: ICON_SIZE,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function DropletIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
    </svg>
  );
}

function FlameIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19.2 2.96c.8 6.49 1.74 12.3-2.7 17.05A6.9 6.9 0 0 1 11 20" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6" />
    </svg>
  );
}

function BugIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path d="M8 2l1.88 1.88" />
      <path d="M14.12 3.88L16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg {...COMMON_PROPS}>
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5L11.52 2.365a.5.5 0 0 1 .962 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.962 0z" />
    </svg>
  );
}

/**
 * Devuelve icon + label + shortLabel para un tipo de alerta. Si el tipo
 * es undefined o desconocido (backward-compat con alertas antiguas que
 * no tenían `type`), cae en 'ndvi_drop' como default razonable (caída de
 * vegetación · la alerta más común históricamente).
 */
export function getAlertTypeMetadata(type: AlertType | undefined): AlertTypeMetadata {
  switch (type) {
    case 'pest_advisory':
      return {
        icon: <BugIcon />,
        label: 'Aviso fitosanitario',
        shortLabel: 'Plaga',
      };
    case 'fire_proximity':
      return {
        icon: <FlameIcon />,
        label: 'Foco térmico',
        shortLabel: 'Fuego',
      };
    case 'stress_pattern':
      return {
        icon: <DropletIcon />,
        label: 'Estrés hídrico',
        shortLabel: 'Agua',
      };
    case 'ndre_anomaly':
      return {
        icon: <SparkleIcon />,
        label: 'Anomalía foliar',
        shortLabel: 'NDRE',
      };
    case 'ndvi_drop':
    default:
      return {
        icon: <LeafIcon />,
        label: 'Caída de vegetación',
        shortLabel: 'NDVI',
      };
  }
}
