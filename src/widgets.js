// -----------------------------------------------------------------------------
// The "Honeywell thermostat" dashboard widget: what the thermostat reads and
// does at a glance, and the two gestures a wall panel needs — set the
// temperature (with how long it holds), and give the thermostat back to its
// schedule. The setpoint +/- and the mode stay the core's device controls.
//
// Pure builders: the data comes from src/app.js. Texts in the viewer's
// language (the core caches the content per language).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { FEATURE } from './devices.js';
import { quarterToTime } from './tcc/model.js';

export const WIDGET_KEY = 'thermostat';

export const WIDGET_ACTION = {
  SET_SETPOINTS: 'set_setpoints',
  RESUME_SCHEDULE: 'resume_schedule',
  PERMANENT_HOLD: 'permanent_hold',
};

export const TEXT = {
  en: {
    indoor: 'Indoor',
    humidity: 'Humidity',
    outdoor: 'Outdoor',
    heatTo: 'Heat to',
    coolTo: 'Cool to',
    mode: 'Mode',
    equipment: 'Equipment',
    fan: 'Fan',
    schedule: 'Schedule',
    link: 'Connection',
    off: 'Off',
    heat: 'Heat',
    cool: 'Cool',
    auto: 'Auto',
    emheat: 'Emergency heat',
    idle: 'Idle',
    heating: 'Heating',
    cooling: 'Cooling',
    fanOnly: 'Fan only',
    running: 'running',
    followSchedule: 'Following',
    holdUntil: 'Hold until',
    permanent: 'Permanent hold',
    vacation: 'Vacation hold',
    online: 'Online',
    offline: 'Offline',
    unknown: 'Unknown',
    setTemperature: 'Set temperature',
    resume: 'Resume schedule',
    hold: 'Hold',
    heatField: 'Heat setpoint',
    coolField: 'Cool setpoint',
    holdField: 'Keep it',
    holdNext: 'Until the next period',
    holdPermanent: 'Until I resume',
    pick: 'Pick a thermostat in the settings of this widget.',
    notConfigured: 'Enter your Total Connect Comfort account in the integration settings.',
    unknownThermostat: 'Thermostat not read yet. It appears after the next portal read.',
    blocked: 'The portal refused the login: see the integration settings.',
    done: 'Sent to the thermostat.',
  },
  fr: {
    indoor: 'Intérieur',
    humidity: 'Humidité',
    outdoor: 'Extérieur',
    heatTo: 'Chauffer à',
    coolTo: 'Refroidir à',
    mode: 'Mode',
    equipment: 'Équipement',
    fan: 'Ventilation',
    schedule: 'Programme',
    link: 'Connexion',
    off: 'Arrêt',
    heat: 'Chauffage',
    cool: 'Climatisation',
    auto: 'Auto',
    emheat: "Chauffage d'urgence",
    idle: 'Au repos',
    heating: 'Chauffe',
    cooling: 'Refroidit',
    fanOnly: 'Ventilation seule',
    running: 'en marche',
    followSchedule: 'Suivi',
    holdUntil: "Maintien jusqu'à",
    permanent: 'Maintien permanent',
    vacation: 'Maintien vacances',
    online: 'En ligne',
    offline: 'Hors ligne',
    unknown: 'Inconnu',
    setTemperature: 'Régler',
    resume: 'Reprendre le prog.',
    hold: 'Maintenir',
    heatField: 'Consigne de chauffage',
    coolField: 'Consigne de climatisation',
    holdField: 'Maintenir',
    holdNext: "Jusqu'à la période suivante",
    holdPermanent: "Jusqu'à la reprise",
    pick: 'Choisissez un thermostat dans les réglages de ce widget.',
    notConfigured:
      "Saisissez votre compte Total Connect Comfort dans les réglages de l'intégration.",
    unknownThermostat:
      'Thermostat pas encore lu. Il apparaît après la prochaine lecture du portail.',
    blocked: "Le portail a refusé la connexion : voyez les réglages de l'intégration.",
    done: 'Envoyé au thermostat.',
  },
  de: {
    indoor: 'Innen',
    humidity: 'Feuchte',
    outdoor: 'Außen',
    heatTo: 'Heizen auf',
    coolTo: 'Kühlen auf',
    mode: 'Modus',
    equipment: 'Anlage',
    fan: 'Lüfter',
    schedule: 'Programm',
    link: 'Verbindung',
    off: 'Aus',
    heat: 'Heizen',
    cool: 'Kühlen',
    auto: 'Auto',
    emheat: 'Notheizung',
    idle: 'Bereit',
    heating: 'Heizt',
    cooling: 'Kühlt',
    fanOnly: 'Nur Lüfter',
    running: 'läuft',
    followSchedule: 'Aktiv',
    holdUntil: 'Halten bis',
    permanent: 'Dauerhaft gehalten',
    vacation: 'Urlaubsmodus',
    online: 'Online',
    offline: 'Offline',
    unknown: 'Unbekannt',
    setTemperature: 'Einstellen',
    resume: 'Programm fortsetzen',
    hold: 'Halten',
    heatField: 'Solltemperatur Heizen',
    coolField: 'Solltemperatur Kühlen',
    holdField: 'Halten',
    holdNext: 'Bis zur nächsten Periode',
    holdPermanent: 'Bis ich fortsetze',
    pick: 'Wähle ein Thermostat in den Einstellungen dieses Widgets.',
    notConfigured: 'Gib dein Total-Connect-Comfort-Konto in den Einstellungen der Integration ein.',
    unknownThermostat: 'Thermostat noch nicht gelesen. Es erscheint nach dem nächsten Abruf.',
    blocked:
      'Das Portal hat die Anmeldung abgelehnt: sieh in den Einstellungen der Integration nach.',
    done: 'An das Thermostat gesendet.',
  },
  es: {
    indoor: 'Interior',
    humidity: 'Humedad',
    outdoor: 'Exterior',
    heatTo: 'Calentar a',
    coolTo: 'Enfriar a',
    mode: 'Modo',
    equipment: 'Equipo',
    fan: 'Ventilador',
    schedule: 'Programa',
    link: 'Conexión',
    off: 'Apagado',
    heat: 'Calefacción',
    cool: 'Refrigeración',
    auto: 'Auto',
    emheat: 'Calefacción de emergencia',
    idle: 'En reposo',
    heating: 'Calentando',
    cooling: 'Enfriando',
    fanOnly: 'Solo ventilador',
    running: 'en marcha',
    followSchedule: 'Activo',
    holdUntil: 'Mantener hasta',
    permanent: 'Mantenido siempre',
    vacation: 'Modo vacaciones',
    online: 'En línea',
    offline: 'Sin conexión',
    unknown: 'Desconocido',
    setTemperature: 'Ajustar',
    resume: 'Reanudar programa',
    hold: 'Mantener',
    heatField: 'Consigna de calefacción',
    coolField: 'Consigna de refrigeración',
    holdField: 'Mantener',
    holdNext: 'Hasta el siguiente período',
    holdPermanent: 'Hasta que lo reanude',
    pick: 'Elija un termostato en los ajustes de este widget.',
    notConfigured: 'Introduzca su cuenta Total Connect Comfort en los ajustes de la integración.',
    unknownThermostat: 'Termostato aún no leído. Aparecerá tras la próxima lectura del portal.',
    blocked: 'El portal ha rechazado el inicio de sesión: consulte los ajustes de la integración.',
    done: 'Enviado al termostato.',
  },
};

const textFor = (language) => TEXT[language] ?? TEXT.en;

/** A one-sentence content (empty and error states). */
export function messageContent(language, key) {
  return {
    ttl_seconds: 60,
    components: [{ type: 'text', variant: 'body', text: textFor(language)[key] }],
  };
}

const heats = (mode) => ['heat', 'emheat', 'auto'].includes(mode);
const cools = (mode) => ['cool', 'auto'].includes(mode);

/**
 * @param {object} options
 * @param {object} options.thermostat parsed state
 * @param {(key: string) => string} options.feature feature external id of the thermostat
 * @param {string} options.language
 */
export function buildThermostatContent({ thermostat: t, feature, language }) {
  const text = textFor(language);
  const unit = `°${t.unit}`;
  const components = [];

  // Tiles bound to the features: live, they follow the published states.
  components.push({
    type: 'value',
    label: text.indoor,
    device_feature: feature(FEATURE.INDOOR_TEMPERATURE),
    icon: 'thermometer',
  });
  if (t.hasIndoorHumidity) {
    components.push({
      type: 'value',
      label: text.humidity,
      device_feature: feature(FEATURE.INDOOR_HUMIDITY),
      icon: 'droplet',
    });
  }
  if (t.hasOutdoorTemperature) {
    components.push({
      type: 'value',
      label: text.outdoor,
      device_feature: feature(FEATURE.OUTDOOR_TEMPERATURE),
      icon: 'cloud',
    });
  }
  if (heats(t.systemMode) && t.heatSetpoint !== null) {
    components.push({
      type: 'value',
      label: text.heatTo,
      device_feature: feature(FEATURE.HEAT_SETPOINT),
      icon: 'sun',
      color: WIDGET_COLORS.WARNING,
    });
  }
  if (cools(t.systemMode) && t.coolSetpoint !== null) {
    components.push({
      type: 'value',
      label: text.coolTo,
      device_feature: feature(FEATURE.COOL_SETPOINT),
      icon: 'wind',
      color: WIDGET_COLORS.INFO,
    });
  }

  const items = [
    { label: text.mode, value: text[t.systemMode] ?? text.unknown, icon: 'sliders' },
    equipmentItem(t, text),
  ];
  if (t.hasFan && t.fanMode) {
    items.push({
      label: text.fan,
      value: `${fanLabel(t.fanMode, language)}${t.fanRunning ? ` · ${text.running}` : ''}`,
      icon: 'wind',
    });
  }
  if (t.scheduleCapable && t.hold) {
    items.push(holdItem(t, text));
  }
  items.push(
    t.online
      ? { label: text.link, value: text.online, icon: 'wifi', color: WIDGET_COLORS.SUCCESS }
      : { label: text.link, value: text.offline, icon: 'wifi-off', color: WIDGET_COLORS.DANGER },
  );
  components.push({ type: 'status', items });

  if (t.online && t.setpointChangeAllowed && t.systemMode !== 'off') {
    components.push(setButton(t, language, unit));
  }
  if (t.online && t.scheduleCapable) {
    if (t.hold === 'temporary' || t.hold === 'permanent') {
      components.push({
        type: 'button',
        label: text.resume,
        icon: 'calendar',
        action: { key: WIDGET_ACTION.RESUME_SCHEDULE },
      });
    } else if (t.hold === 'schedule' && t.systemMode !== 'off') {
      components.push({
        type: 'button',
        label: text.hold,
        icon: 'lock',
        action: { key: WIDGET_ACTION.PERMANENT_HOLD, confirm: true },
      });
    }
  }
  return { ttl_seconds: 300, components };
}

function equipmentItem(t, text) {
  if (t.systemMode === 'off') {
    return { label: text.equipment, value: text.idle, icon: 'power', color: WIDGET_COLORS.NEUTRAL };
  }
  if (t.equipment === 'heat') {
    return {
      label: text.equipment,
      value: text.heating,
      icon: 'sun',
      color: WIDGET_COLORS.WARNING,
    };
  }
  if (t.equipment === 'cool') {
    return { label: text.equipment, value: text.cooling, icon: 'wind', color: WIDGET_COLORS.INFO };
  }
  if (t.fanRunning) {
    return {
      label: text.equipment,
      value: text.fanOnly,
      icon: 'wind',
      color: WIDGET_COLORS.NEUTRAL,
    };
  }
  if (t.equipment === 'idle') {
    return { label: text.equipment, value: text.idle, icon: 'pause', color: WIDGET_COLORS.NEUTRAL };
  }
  return {
    label: text.equipment,
    value: text.unknown,
    icon: 'help-circle',
    color: WIDGET_COLORS.NEUTRAL,
  };
}

function holdItem(t, text) {
  if (t.hold === 'temporary') {
    const quarter = t.heatNextPeriod ?? t.coolNextPeriod;
    const value = quarter === null ? text.holdUntil : `${text.holdUntil} ${quarterToTime(quarter)}`;
    return { label: text.schedule, value, icon: 'clock', color: WIDGET_COLORS.WARNING };
  }
  if (t.hold === 'permanent') {
    return {
      label: text.schedule,
      value: text.permanent,
      icon: 'lock',
      color: WIDGET_COLORS.WARNING,
    };
  }
  if (t.hold === 'vacation') {
    return {
      label: text.schedule,
      value: text.vacation,
      icon: 'briefcase',
      color: WIDGET_COLORS.INFO,
    };
  }
  return {
    label: text.schedule,
    value: text.followSchedule,
    icon: 'calendar',
    color: WIDGET_COLORS.SUCCESS,
  };
}

const FAN_TEXT = {
  en: { auto: 'Auto', on: 'On', circulate: 'Circulate', schedule: 'Schedule' },
  fr: { auto: 'Auto', on: 'Marche', circulate: 'Brassage', schedule: 'Programme' },
  de: { auto: 'Auto', on: 'Ein', circulate: 'Umwälzen', schedule: 'Programm' },
  es: { auto: 'Auto', on: 'Encendido', circulate: 'Recircular', schedule: 'Programa' },
};

const fanLabel = (mode, language) => (FAN_TEXT[language] ?? FAN_TEXT.en)[mode] ?? mode;

// The form behind "Set temperature": the setpoints the current mode uses,
// pre-filled with the current values, and how long they hold.
function setButton(t, language, unit) {
  const text = textFor(language);
  // Field labels are multi-language objects with `en`: the viewer's language
  // and the English fallback.
  const label = (key, suffix = '') => ({
    en: `${TEXT.en[key]}${suffix}`,
    [language]: `${text[key]}${suffix}`,
  });
  const fields = [];
  if (heats(t.systemMode) && t.heatSetpoint !== null) {
    fields.push({
      key: 'heat',
      type: 'number',
      label: label('heatField', ` (${unit})`),
      min: t.heatLimits.min,
      max: t.heatLimits.max,
      default: t.heatSetpoint,
    });
  }
  if (cools(t.systemMode) && t.coolSetpoint !== null) {
    fields.push({
      key: 'cool',
      type: 'number',
      label: label('coolField', ` (${unit})`),
      min: t.coolLimits.min,
      max: t.coolLimits.max,
      default: t.coolSetpoint,
    });
  }
  if (t.scheduleCapable) {
    fields.push({
      key: 'hold',
      type: 'select',
      label: label('holdField'),
      required: true,
      default: 'next',
      options: [
        { value: 'next', label: label('holdNext') },
        { value: 'permanent', label: label('holdPermanent') },
      ],
    });
  }
  return {
    type: 'button',
    label: text.setTemperature,
    icon: 'thermometer',
    action: { key: WIDGET_ACTION.SET_SETPOINTS, fields },
  };
}
