// -----------------------------------------------------------------------------
// One Gladys device per thermostat, and the states of its features.
//
// The external ids are built from the DeviceID the portal gives the
// thermostat, never from its name: Gladys keys the device, its history, its
// scenes and its dashboards on them. The feature keys below are forever.
//
// Category/type choices (the couples of the Gladys 5.2 front):
//   - setpoints, mode and equipment status in the `thermostat` category, as
//     the core thermostat widget and scenes expect them;
//   - the mode uses THERMOSTAT_MODE (off, heating, cooling, auto). Emergency
//     heat is not in that list: it reads as "heating" there and has its own
//     switch, like in Home Assistant;
//   - the fan setting and the schedule hold are text/select: their values
//     (circulate, permanent hold...) exist in no standard enum of the core;
//   - no `should_poll`: the container reads the portal itself (Gladys#3198)
//     at a pace the core scheduler cannot express (minutes).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { NAMES, OPTION_LABELS } from './i18n.js';
import { setpointStep } from './tcc/model.js';

export const DEVICE_TYPE = 'thermostat';

export const FEATURE = {
  INDOOR_TEMPERATURE: 'indoor_temperature',
  INDOOR_HUMIDITY: 'indoor_humidity',
  OUTDOOR_TEMPERATURE: 'outdoor_temperature',
  OUTDOOR_HUMIDITY: 'outdoor_humidity',
  HEAT_SETPOINT: 'heat_setpoint',
  COOL_SETPOINT: 'cool_setpoint',
  MODE: 'mode',
  EMERGENCY_HEAT: 'emergency_heat',
  OPERATING_STATE: 'operating_state',
  FAN_MODE: 'fan_mode',
  FAN_RUNNING: 'fan_running',
  HOLD: 'hold',
};

// THERMOSTAT_MODE and THERMOSTAT_OPERATING_STATE of the core.
export const GLADYS_MODE = { off: 0, heat: 1, cool: 2, auto: 3 };
const MODE_BY_SYSTEM = { off: 0, heat: 1, emheat: 1, cool: 2, auto: 3 };
export const SYSTEM_BY_GLADYS_MODE = { 0: 'off', 1: 'heat', 2: 'cool', 3: 'auto' };
const OPERATING_STATE = { idle: 0, heat: 1, cool: 2 };

export const HOLDS = ['schedule', 'temporary', 'permanent', 'vacation'];

const unitOf = (thermostat) => (thermostat.unit === 'C' ? U.CELSIUS : U.FAHRENHEIT);

// Display bounds of the temperature readings (the gauge needs some).
const TEMPERATURE_RANGE = { F: { min: -40, max: 140 }, C: { min: -40, max: 60 } };

export const thermostatIds = (gladys, id) => gladys.externalIds(DEVICE_TYPE, id);

/** The thermostat DeviceID of one of our device external ids, or null. */
export function thermostatIdOf(gladys, externalId) {
  const prefix = gladys.externalId(`${DEVICE_TYPE}:`);
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  const id = externalId.slice(prefix.length).split(':')[0];
  return id === '' ? null : id;
}

/** The feature key of a feature external id (the part after the device id). */
export function featureKeyOf(gladys, externalId) {
  const id = thermostatIdOf(gladys, externalId);
  if (id === null) {
    return null;
  }
  return externalId.slice(thermostatIds(gladys, id).device.length + 1) || null;
}

const hasHeat = (t) => t.modes.some((mode) => ['heat', 'auto', 'emheat'].includes(mode));
const hasCool = (t) => t.modes.some((mode) => ['cool', 'auto'].includes(mode));

/**
 * The Gladys device of one thermostat.
 * @param {object} gladys
 * @param {{ id: string, name: string }} info from the location list
 * @param {object} thermostat parsed state (decides which features exist)
 * @param {string} language feature names
 */
export function buildDevice(gladys, info, thermostat, language) {
  const ids = thermostatIds(gladys, info.id);
  const names = NAMES[language] ?? NAMES.fr;
  const labels = OPTION_LABELS[language] ?? OPTION_LABELS.fr;
  const unit = unitOf(thermostat);
  const range = TEMPERATURE_RANGE[thermostat.unit];
  const features = [];
  const add = (key, feature) =>
    features.push({
      name: names[key],
      external_id: ids.feature(key),
      read_only: true,
      has_feedback: false,
      keep_history: true,
      ...feature,
    });

  add(FEATURE.INDOOR_TEMPERATURE, {
    category: C.TEMPERATURE_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit,
    ...range,
  });
  if (thermostat.hasIndoorHumidity) {
    add(FEATURE.INDOOR_HUMIDITY, {
      category: C.HUMIDITY_SENSOR,
      type: T.SENSOR.DECIMAL,
      unit: U.PERCENT,
      min: 0,
      max: 100,
    });
  }
  if (thermostat.hasOutdoorTemperature) {
    add(FEATURE.OUTDOOR_TEMPERATURE, {
      category: C.TEMPERATURE_SENSOR,
      type: T.SENSOR.DECIMAL,
      unit,
      ...range,
    });
  }
  if (thermostat.hasOutdoorHumidity) {
    add(FEATURE.OUTDOOR_HUMIDITY, {
      category: C.HUMIDITY_SENSOR,
      type: T.SENSOR.DECIMAL,
      unit: U.PERCENT,
      min: 0,
      max: 100,
    });
  }
  const setpoint = (limits) => ({
    category: C.THERMOSTAT,
    type: T.THERMOSTAT.TARGET_TEMPERATURE,
    unit,
    min: limits.min,
    max: limits.max,
    step: setpointStep(thermostat.unit),
    read_only: false,
    has_feedback: true,
  });
  if (hasHeat(thermostat)) {
    add(FEATURE.HEAT_SETPOINT, setpoint(thermostat.heatLimits));
  }
  if (hasCool(thermostat)) {
    add(FEATURE.COOL_SETPOINT, setpoint(thermostat.coolLimits));
  }
  const gladysModes = [...new Set(thermostat.modes.filter((mode) => mode in GLADYS_MODE))];
  if (gladysModes.length > 0) {
    add(FEATURE.MODE, {
      category: C.THERMOSTAT,
      type: T.THERMOSTAT.MODE,
      min: 0,
      max: 3,
      read_only: false,
      has_feedback: true,
      // The labels come from the core's translations of THERMOSTAT_MODE.
      supported_options: gladysModes
        .map((mode) => ({ value: GLADYS_MODE[mode], label: mode }))
        .sort((a, b) => a.value - b.value),
    });
  }
  if (thermostat.modes.includes('emheat')) {
    add(FEATURE.EMERGENCY_HEAT, {
      category: C.SWITCH,
      type: T.SWITCH.BINARY,
      min: 0,
      max: 1,
      read_only: false,
      has_feedback: true,
    });
  }
  add(FEATURE.OPERATING_STATE, {
    category: C.THERMOSTAT,
    type: T.THERMOSTAT.OPERATING_STATE,
    min: 0,
    max: 2,
  });
  if (thermostat.hasFan && thermostat.fanModes.length > 0) {
    add(FEATURE.FAN_MODE, {
      category: C.TEXT,
      type: T.TEXT.SELECT,
      min: 0,
      max: 0,
      read_only: false,
      has_feedback: true,
      keep_history: false,
      supported_options: thermostat.fanModes.map((mode) => ({
        value: mode,
        label: labels[`fan_${mode}`],
      })),
    });
    add(FEATURE.FAN_RUNNING, {
      category: C.SWITCH,
      type: T.SWITCH.BINARY,
      min: 0,
      max: 1,
    });
  }
  if (thermostat.scheduleCapable) {
    add(FEATURE.HOLD, {
      category: C.TEXT,
      type: T.TEXT.SELECT,
      min: 0,
      max: 0,
      read_only: false,
      has_feedback: true,
      keep_history: false,
      supported_options: HOLDS.filter(
        (hold) => hold !== 'temporary' || thermostat.holdUntilCapable,
      ).map((hold) => ({ value: hold, label: labels[`hold_${hold}`] })),
    });
  }

  return {
    name: info.name || `Honeywell ${info.id}`,
    external_id: ids.device,
    features,
  };
}

/**
 * The states of a thermostat, for the features its device declares.
 * Unknown values (no humidity sensor reading, no equipment status) are left
 * out rather than published as zeros.
 */
export function buildStates(gladys, id, thermostat) {
  const ids = thermostatIds(gladys, id);
  const states = [];
  const number = (key, value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
      states.push({ device_feature_external_id: ids.feature(key), state: value });
    }
  };
  const text = (key, value) => {
    if (typeof value === 'string' && value !== '') {
      states.push({ device_feature_external_id: ids.feature(key), text: value });
    }
  };

  number(FEATURE.INDOOR_TEMPERATURE, thermostat.indoorTemperature);
  number(FEATURE.INDOOR_HUMIDITY, thermostat.indoorHumidity);
  number(FEATURE.OUTDOOR_TEMPERATURE, thermostat.outdoorTemperature);
  number(FEATURE.OUTDOOR_HUMIDITY, thermostat.outdoorHumidity);
  if (hasHeat(thermostat)) number(FEATURE.HEAT_SETPOINT, thermostat.heatSetpoint);
  if (hasCool(thermostat)) number(FEATURE.COOL_SETPOINT, thermostat.coolSetpoint);
  number(FEATURE.MODE, MODE_BY_SYSTEM[thermostat.systemMode]);
  if (thermostat.modes.includes('emheat')) {
    number(FEATURE.EMERGENCY_HEAT, thermostat.systemMode === 'emheat' ? 1 : 0);
  }
  number(
    FEATURE.OPERATING_STATE,
    thermostat.systemMode === 'off' ? OPERATING_STATE.idle : OPERATING_STATE[thermostat.equipment],
  );
  if (thermostat.hasFan && thermostat.fanModes.length > 0) {
    text(FEATURE.FAN_MODE, thermostat.fanMode);
    number(
      FEATURE.FAN_RUNNING,
      thermostat.fanRunning === null ? null : Number(thermostat.fanRunning),
    );
  }
  if (thermostat.scheduleCapable) {
    text(FEATURE.HOLD, thermostat.hold);
  }
  return states;
}
