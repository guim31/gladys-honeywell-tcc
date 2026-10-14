// -----------------------------------------------------------------------------
// What a Total Connect Comfort thermostat is, read from the portal's answers,
// and the commands that change it.
//
// The portal's `uiData` is the screen of the thermostat: setpoints in the
// display unit (°F or °C), the system switch, the hold, the setpoint limits.
// Everything here is pure: no HTTP, no Gladys.
// -----------------------------------------------------------------------------

// uiData.SystemSwitchPosition. 4 and 5 are both "auto" (5 is the automatic
// changeover some models report); a command writes 4.
const SYSTEM_SWITCH = { 0: 'emheat', 1: 'heat', 2: 'off', 3: 'cool', 4: 'auto', 5: 'auto' };
export const SYSTEM_SWITCH_VALUE = { emheat: 0, heat: 1, off: 2, cool: 3, auto: 4 };

// uiData.StatusHeat / StatusCool. The portal also reports a vacation hold,
// which is set from the Honeywell app and only read here.
export const HOLD_STATUS = { schedule: 0, temporary: 1, permanent: 2 };
const HOLD_BY_STATUS = { 0: 'schedule', 1: 'temporary', 2: 'permanent', 3: 'vacation' };

// fanData.fanMode, and the flag telling whether the model offers each one.
export const FAN_MODES = ['auto', 'on', 'circulate', 'schedule'];
const FAN_MODE_VALUE = { auto: 0, on: 1, circulate: 2, schedule: 3 };
const FAN_ALLOWED_FLAG = {
  auto: 'fanModeAutoAllowed',
  on: 'fanModeOnAllowed',
  circulate: 'fanModeCirculateAllowed',
  schedule: 'fanModeFollowScheduleAllowed',
};

// The portal reports an absent outdoor sensor as 128 with an "unavailable" flag.
const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/**
 * The thermostats of the location list, as `{ id, name, mac }`.
 * @param {object[]} locations raw answer of GetLocationListData
 */
export function listThermostats(locations) {
  const thermostats = [];
  const seen = new Set();
  for (const location of locations ?? []) {
    for (const device of location?.Devices ?? []) {
      const id = device?.DeviceID;
      if (
        (typeof id !== 'number' && typeof id !== 'string') ||
        `${id}` === '' ||
        seen.has(`${id}`)
      ) {
        continue;
      }
      // A device without a thermostat screen (a gateway, a water leak
      // detector of the same account) has no uiData to read.
      if (device.HasUIData === false && !device.ThermostatData) {
        continue;
      }
      seen.add(`${id}`);
      thermostats.push({
        id: `${id}`,
        name: typeof device.Name === 'string' ? device.Name.trim() : '',
        mac: typeof device.MacID === 'string' ? device.MacID : null,
      });
    }
  }
  return thermostats;
}

/**
 * Read the answer of CheckDataSession.
 * @param {object} data the raw answer
 * @returns {object} the thermostat, in plain words
 */
export function parseThermostat(data) {
  const ui = data.latestData?.uiData ?? {};
  const fanData = data.latestData?.fanData;
  const unit = ui.DisplayUnits === 'C' ? 'C' : 'F';

  const modes = [];
  if (ui.SwitchOffAllowed) modes.push('off');
  if (ui.SwitchHeatAllowed) modes.push('heat');
  if (ui.SwitchCoolAllowed) modes.push('cool');
  if (ui.SwitchAutoAllowed) modes.push('auto');
  if (ui.SwitchEmergencyHeatAllowed) modes.push('emheat');

  const humidityOk =
    ui.IndoorHumiditySensorAvailable === true && ui.IndoorHumiditySensorNotFault !== false;
  const outdoorTempOk =
    ui.OutdoorTemperatureAvailable === true && ui.OutdoorTemperatureSensorNotFault !== false;
  const outdoorHumidityOk =
    ui.OutdoorHumidityAvailable === true && ui.OutdoorHumiditySensorNotFault !== false;

  const hasFan = data.latestData?.hasFan === true && fanData && typeof fanData === 'object';
  const fanModes = hasFan
    ? FAN_MODES.filter((mode) => fanData[FAN_ALLOWED_FLAG[mode]] === true)
    : [];

  let hold =
    HOLD_BY_STATUS[Math.max(Number(ui.StatusHeat) || 0, Number(ui.StatusCool) || 0)] ?? null;
  if (ui.IsInVacationHoldMode === true) {
    hold = 'vacation';
  }

  const status = ui.EquipmentOutputStatus;
  let equipment = null;
  if (status === 0) equipment = 'idle';
  if (status === 1) equipment = 'heat';
  if (status === 2) equipment = 'cool';

  return {
    // The portal knows the thermostat and the thermostat talks to it.
    online: data.deviceLive !== false && data.communicationLost !== true,
    unit,
    indoorTemperature: ui.DispTemperatureAvailable === false ? null : finite(ui.DispTemperature),
    indoorHumidity: humidityOk ? finite(ui.IndoorHumidity) : null,
    hasIndoorHumidity: ui.IndoorHumiditySensorAvailable === true,
    outdoorTemperature: outdoorTempOk ? finite(ui.OutdoorTemperature) : null,
    hasOutdoorTemperature: ui.OutdoorTemperatureAvailable === true,
    outdoorHumidity: outdoorHumidityOk ? finite(ui.OutdoorHumidity) : null,
    hasOutdoorHumidity: ui.OutdoorHumidityAvailable === true,
    heatSetpoint: finite(ui.HeatSetpoint),
    coolSetpoint: finite(ui.CoolSetpoint),
    heatLimits: limits(ui.HeatLowerSetptLimit, ui.HeatUpperSetptLimit, unit),
    coolLimits: limits(ui.CoolLowerSetptLimit, ui.CoolUpperSetptLimit, unit),
    deadband: finite(ui.Deadband) ?? 0,
    modes,
    systemMode: SYSTEM_SWITCH[ui.SystemSwitchPosition] ?? null,
    equipment,
    setpointChangeAllowed: ui.SetpointChangeAllowed !== false,
    scheduleCapable: ui.ScheduleCapable === true,
    holdUntilCapable: ui.HoldUntilCapable === true,
    hold,
    heatNextPeriod: Number.isInteger(ui.HeatNextPeriod) ? ui.HeatNextPeriod : null,
    coolNextPeriod: Number.isInteger(ui.CoolNextPeriod) ? ui.CoolNextPeriod : null,
    hasFan: Boolean(hasFan),
    fanModes,
    fanMode: hasFan ? (FAN_MODES[fanData.fanMode] ?? null) : null,
    fanRunning: hasFan ? fanData.fanIsRunning === true : null,
  };
}

// Setpoint bounds when the portal gives none: the widest Honeywell ranges.
const DEFAULT_LIMITS = { F: { min: 40, max: 99 }, C: { min: 4.5, max: 37 } };

function limits(lower, upper, unit) {
  const min = finite(lower);
  const max = finite(upper);
  if (min === null || max === null || min >= max) {
    return { ...DEFAULT_LIMITS[unit] };
  }
  return { min, max };
}

/** The setpoint step: whole degrees in °F, half degrees in °C. */
export const setpointStep = (unit) => (unit === 'C' ? 0.5 : 1);

/** Round a requested setpoint on the step of the unit. */
export function roundSetpoint(value, unit) {
  const step = setpointStep(unit);
  return Math.round(value / step) * step;
}

/** A command the thermostat cannot take, worded for the user. */
export class CommandError extends Error {
  constructor(code, details = {}) {
    super(code);
    this.name = 'CommandError';
    this.code = code;
    this.details = details;
  }
}

/**
 * The changes that set one setpoint. Like the thermostat's own screen, a
 * change made while the schedule runs is a temporary hold until the next
 * schedule period, and the other setpoint moves when the deadband requires.
 * @param {object} thermostat parsed
 * @param {'heat'|'cool'} which
 * @param {number} requested in the display unit
 */
export function setpointChanges(thermostat, which, requested) {
  if (!Number.isFinite(requested)) {
    throw new CommandError('invalid_value');
  }
  if (!thermostat.setpointChangeAllowed) {
    throw new CommandError('setpoint_locked');
  }
  const value = roundSetpoint(requested, thermostat.unit);
  const range = which === 'heat' ? thermostat.heatLimits : thermostat.coolLimits;
  if (value < range.min || value > range.max) {
    throw new CommandError('out_of_range', {
      min: range.min,
      max: range.max,
      unit: thermostat.unit,
    });
  }
  let heat = which === 'heat' ? value : thermostat.heatSetpoint;
  let cool = which === 'cool' ? value : thermostat.coolSetpoint;
  const gap = thermostat.deadband;
  if (gap > 0 && heat !== null && cool !== null && cool - heat < gap) {
    if (which === 'heat') {
      cool = Math.min(heat + gap, thermostat.coolLimits.max);
    } else {
      heat = Math.max(cool - gap, thermostat.heatLimits.min);
    }
  }
  const changes = {};
  if (heat !== null) changes.HeatSetpoint = heat;
  if (cool !== null) changes.CoolSetpoint = cool;
  if (thermostat.hold === 'schedule' && thermostat.scheduleCapable) {
    Object.assign(changes, temporaryHold(thermostat));
  }
  return changes;
}

function temporaryHold(thermostat) {
  const changes = { StatusHeat: HOLD_STATUS.temporary, StatusCool: HOLD_STATUS.temporary };
  if (thermostat.heatNextPeriod !== null) changes.HeatNextPeriod = thermostat.heatNextPeriod;
  if (thermostat.coolNextPeriod !== null) changes.CoolNextPeriod = thermostat.coolNextPeriod;
  return changes;
}

/**
 * @param {object} thermostat parsed
 * @param {'off'|'heat'|'cool'|'auto'|'emheat'} mode
 */
export function modeChanges(thermostat, mode) {
  if (!(mode in SYSTEM_SWITCH_VALUE) || !thermostat.modes.includes(mode)) {
    throw new CommandError('mode_unsupported');
  }
  return { SystemSwitch: SYSTEM_SWITCH_VALUE[mode] };
}

/**
 * @param {object} thermostat parsed
 * @param {string} mode one of FAN_MODES
 */
export function fanChanges(thermostat, mode) {
  if (!thermostat.hasFan || !thermostat.fanModes.includes(mode)) {
    throw new CommandError('fan_unsupported');
  }
  return { FanMode: FAN_MODE_VALUE[mode] };
}

/**
 * @param {object} thermostat parsed
 * @param {'schedule'|'temporary'|'permanent'} hold
 */
export function holdChanges(thermostat, hold) {
  if (hold === 'vacation') {
    throw new CommandError('vacation_read_only');
  }
  if (!thermostat.scheduleCapable || !(hold in HOLD_STATUS)) {
    throw new CommandError('hold_unsupported');
  }
  if (hold === 'temporary') {
    if (!thermostat.holdUntilCapable) {
      throw new CommandError('hold_unsupported');
    }
    return temporaryHold(thermostat);
  }
  return { StatusHeat: HOLD_STATUS[hold], StatusCool: HOLD_STATUS[hold] };
}

/**
 * A temporary hold until a time of day, at the given setpoints. The portal
 * counts the time in quarters of an hour since midnight, thermostat time.
 * @param {object} thermostat parsed
 * @param {{ heat?: number|null, cool?: number|null, quarter: number }} hold
 */
export function holdUntilChanges(thermostat, { heat = null, cool = null, quarter }) {
  if (!thermostat.scheduleCapable || !thermostat.holdUntilCapable) {
    throw new CommandError('hold_unsupported');
  }
  if (!Number.isInteger(quarter) || quarter < 0 || quarter > 95) {
    throw new CommandError('invalid_time');
  }
  let changes = {};
  // Each setpoint goes through the same checks as a single setpoint change;
  // the second sees the first already applied.
  let current = thermostat;
  for (const [which, value] of [
    ['heat', heat],
    ['cool', cool],
  ]) {
    if (value === null) {
      continue;
    }
    const step = setpointChanges({ ...current, hold: 'temporary' }, which, value);
    changes = { ...changes, ...step };
    current = {
      ...current,
      heatSetpoint: step.HeatSetpoint ?? current.heatSetpoint,
      coolSetpoint: step.CoolSetpoint ?? current.coolSetpoint,
    };
  }
  return {
    ...changes,
    StatusHeat: HOLD_STATUS.temporary,
    StatusCool: HOLD_STATUS.temporary,
    HeatNextPeriod: quarter,
    CoolNextPeriod: quarter,
  };
}

/**
 * Parse a time of day ("22:00", "7h30", "22") into quarters of an hour,
 * rounded up to the next quarter: a hold never ends before the time asked.
 * @returns {number|null}
 */
export function parseQuarter(text) {
  const match = `${text ?? ''}`.trim().match(/^(\d{1,2})(?:\s*[:hH.]\s*(\d{1,2})?)?$/);
  if (!match) {
    return null;
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2] ?? 0);
  if (hours > 23 || minutes > 59) {
    return null;
  }
  return Math.ceil((hours * 60 + minutes) / 15) % 96;
}

/** "HH:MM" of a quarter of an hour. */
export function quarterToTime(quarter) {
  const minutes = quarter * 15;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

/**
 * Apply sent changes to a parsed thermostat: what the portal will report once
 * it took them, published at once rather than at the next read.
 */
export function applyChanges(thermostat, changes) {
  const next = { ...thermostat };
  if (changes.HeatSetpoint !== undefined) next.heatSetpoint = changes.HeatSetpoint;
  if (changes.CoolSetpoint !== undefined) next.coolSetpoint = changes.CoolSetpoint;
  if (changes.SystemSwitch !== undefined) next.systemMode = SYSTEM_SWITCH[changes.SystemSwitch];
  if (changes.FanMode !== undefined) next.fanMode = FAN_MODES[changes.FanMode];
  if (changes.StatusHeat !== undefined || changes.StatusCool !== undefined) {
    next.hold = HOLD_BY_STATUS[Math.max(changes.StatusHeat ?? 0, changes.StatusCool ?? 0)];
  }
  return next;
}

/**
 * Both setpoints at once, then how long they hold: until the next schedule
 * period (`next`) or for good (`permanent`). The widget's form.
 * @param {object} thermostat parsed
 * @param {{ heat?: number|null, cool?: number|null, hold?: 'next'|'permanent' }} request
 */
export function setpointsChanges(thermostat, { heat = null, cool = null, hold = 'next' }) {
  if (heat === null && cool === null) {
    throw new CommandError('no_setpoint');
  }
  let changes = {};
  let current = thermostat;
  for (const [which, value] of [
    ['heat', heat],
    ['cool', cool],
  ]) {
    if (value === null) {
      continue;
    }
    // The hold is decided below, not by the single-setpoint rule.
    const step = setpointChanges({ ...current, hold: 'permanent' }, which, value);
    changes = { ...changes, ...step };
    current = {
      ...current,
      heatSetpoint: step.HeatSetpoint ?? current.heatSetpoint,
      coolSetpoint: step.CoolSetpoint ?? current.coolSetpoint,
    };
  }
  if (!thermostat.scheduleCapable) {
    return changes;
  }
  if (hold === 'permanent') {
    return { ...changes, StatusHeat: HOLD_STATUS.permanent, StatusCool: HOLD_STATUS.permanent };
  }
  return { ...changes, ...temporaryHold(thermostat) };
}
