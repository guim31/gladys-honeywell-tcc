// -----------------------------------------------------------------------------
// Reading the portal's answers, and the commands built from them.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CommandError,
  applyChanges,
  fanChanges,
  holdChanges,
  holdUntilChanges,
  listThermostats,
  modeChanges,
  parseQuarter,
  parseThermostat,
  quarterToTime,
  setpointChanges,
  setpointsChanges,
} from '../src/tcc/model.js';
import { json } from './helpers/fakePortal.js';

const furnace = () => parseThermostat(json('thermostat-furnace-ac.json'));
const heatPump = () => parseThermostat(json('thermostat-heat-pump.json'));
const celsius = () => parseThermostat(json('thermostat-celsius-heat-only.json'));

test('the recorded answer reads as the thermostat it was', () => {
  // The values the somecomfort tests assert on the same recording.
  const t = furnace();
  assert.equal(t.unit, 'F');
  assert.equal(t.indoorTemperature, 58);
  assert.equal(t.heatSetpoint, 58);
  assert.equal(t.coolSetpoint, 77);
  assert.equal(t.systemMode, 'heat');
  assert.equal(t.fanMode, 'circulate');
  assert.equal(t.fanRunning, false);
  assert.equal(t.hold, 'permanent');
  assert.equal(t.online, true);
  assert.equal(t.indoorHumidity, 57);
  // The absent outdoor sensor reports 128: never a reading.
  assert.equal(t.outdoorTemperature, null);
  assert.equal(t.hasOutdoorTemperature, false);
  assert.deepEqual(t.modes, ['off', 'heat', 'cool']);
  assert.deepEqual(t.fanModes, ['auto', 'on', 'circulate']);
  assert.deepEqual(t.heatLimits, { min: 40, max: 90 });
  assert.deepEqual(t.coolLimits, { min: 50, max: 99 });
  assert.equal(t.equipment, 'idle');
});

test('heat pump: auto, emergency heat, outdoor sensor, schedule', () => {
  const t = heatPump();
  assert.equal(t.systemMode, 'auto');
  assert.deepEqual(t.modes, ['off', 'heat', 'cool', 'auto', 'emheat']);
  assert.equal(t.outdoorTemperature, 34);
  assert.equal(t.outdoorHumidity, 72);
  assert.equal(t.hold, 'schedule');
  assert.equal(t.equipment, 'heat');
  assert.equal(t.fanRunning, true);
  assert.deepEqual(t.fanModes, ['auto', 'on', 'circulate', 'schedule']);
});

test('Celsius heat-only: no fan, no humidity, no equipment status', () => {
  const t = celsius();
  assert.equal(t.unit, 'C');
  assert.equal(t.heatSetpoint, 20.5);
  assert.equal(t.hasFan, false);
  assert.equal(t.fanMode, null);
  assert.equal(t.indoorHumidity, null);
  assert.equal(t.equipment, null, 'unknown, not idle');
  assert.equal(t.hold, 'temporary');
});

test('the system switch positions, 5 included', () => {
  const position = (p) => {
    const data = json('thermostat-furnace-ac.json');
    data.latestData.uiData.SystemSwitchPosition = p;
    return parseThermostat(data).systemMode;
  };
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(position), [
    'emheat',
    'heat',
    'off',
    'cool',
    'auto',
    'auto',
    null,
  ]);
});

test('a vacation hold reads as such', () => {
  const data = json('thermostat-furnace-ac.json');
  data.latestData.uiData.IsInVacationHoldMode = true;
  assert.equal(parseThermostat(data).hold, 'vacation');
});

test('an offline thermostat', () => {
  assert.equal(parseThermostat(json('thermostat-furnace-ac-offline.json')).online, false);
});

test('the location list gives the thermostats once', () => {
  const locations = json('locations.json');
  locations[0].Devices.push({ ...locations[0].Devices[0] });
  locations[1].Devices.push({ DeviceID: 42, HasUIData: false, ThermostatData: null });
  assert.deepEqual(listThermostats(locations), [
    { id: '1234567', name: 'Downstairs', mac: '00D02D000001' },
    { id: '2345678', name: 'Upstairs', mac: '00D02D000002' },
    { id: '3456789', name: 'Cabin', mac: '00D02D000003' },
  ]);
});

test('a setpoint during a permanent hold changes the setpoint only', () => {
  assert.deepEqual(setpointChanges(furnace(), 'heat', 62), { HeatSetpoint: 62, CoolSetpoint: 77 });
});

test('a setpoint while the schedule runs holds it until the next period', () => {
  assert.deepEqual(setpointChanges(heatPump(), 'heat', 70), {
    HeatSetpoint: 70,
    CoolSetpoint: 76,
    StatusHeat: 1,
    StatusCool: 1,
    HeatNextPeriod: 88,
    CoolNextPeriod: 88,
  });
});

test('the deadband pushes the other setpoint', () => {
  // 3 °F deadband: heat 75 needs cool >= 78.
  const heat = setpointChanges(heatPump(), 'heat', 75);
  assert.equal(heat.CoolSetpoint, 78);
  const cool = setpointChanges(heatPump(), 'cool', 69);
  assert.equal(cool.HeatSetpoint, 66);
});

test('setpoints are rounded on the unit step and kept within the limits', () => {
  assert.equal(setpointChanges(furnace(), 'heat', 61.6).HeatSetpoint, 62);
  assert.equal(setpointChanges(celsius(), 'heat', 21.3).HeatSetpoint, 21.5);
  assert.throws(
    () => setpointChanges(furnace(), 'heat', 91),
    (err) => {
      assert.ok(err instanceof CommandError);
      assert.equal(err.code, 'out_of_range');
      assert.deepEqual(err.details, { min: 40, max: 90, unit: 'F' });
      return true;
    },
  );
  assert.throws(() => setpointChanges(furnace(), 'heat', NaN), { code: 'invalid_value' });
});

test('a thermostat that refuses setpoint changes', () => {
  const t = { ...furnace(), setpointChangeAllowed: false };
  assert.throws(() => setpointChanges(t, 'heat', 60), { code: 'setpoint_locked' });
});

test('modes: the portal values, and only those the thermostat allows', () => {
  assert.deepEqual(modeChanges(heatPump(), 'emheat'), { SystemSwitch: 0 });
  assert.deepEqual(modeChanges(heatPump(), 'heat'), { SystemSwitch: 1 });
  assert.deepEqual(modeChanges(heatPump(), 'off'), { SystemSwitch: 2 });
  assert.deepEqual(modeChanges(heatPump(), 'cool'), { SystemSwitch: 3 });
  assert.deepEqual(modeChanges(heatPump(), 'auto'), { SystemSwitch: 4 });
  assert.throws(() => modeChanges(furnace(), 'auto'), { code: 'mode_unsupported' });
});

test('fan modes', () => {
  assert.deepEqual(fanChanges(furnace(), 'auto'), { FanMode: 0 });
  assert.deepEqual(fanChanges(heatPump(), 'schedule'), { FanMode: 3 });
  assert.throws(() => fanChanges(furnace(), 'schedule'), { code: 'fan_unsupported' });
  assert.throws(() => fanChanges(celsius(), 'auto'), { code: 'fan_unsupported' });
});

test('holds', () => {
  assert.deepEqual(holdChanges(furnace(), 'schedule'), { StatusHeat: 0, StatusCool: 0 });
  assert.deepEqual(holdChanges(heatPump(), 'permanent'), { StatusHeat: 2, StatusCool: 2 });
  assert.deepEqual(holdChanges(heatPump(), 'temporary'), {
    StatusHeat: 1,
    StatusCool: 1,
    HeatNextPeriod: 88,
    CoolNextPeriod: 88,
  });
  assert.throws(() => holdChanges(furnace(), 'vacation'), { code: 'vacation_read_only' });
  const noSchedule = { ...furnace(), scheduleCapable: false };
  assert.throws(() => holdChanges(noSchedule, 'permanent'), { code: 'hold_unsupported' });
});

test('hold until a time', () => {
  assert.equal(parseQuarter('22:00'), 88);
  assert.equal(parseQuarter('7h30'), 30);
  assert.equal(parseQuarter('22'), 88);
  assert.equal(parseQuarter('22:05'), 89, 'rounded up: never ends before the time asked');
  assert.equal(parseQuarter('23:50'), 0);
  assert.equal(parseQuarter('24:00'), null);
  assert.equal(parseQuarter('soon'), null);
  assert.equal(quarterToTime(89), '22:15');

  assert.deepEqual(holdUntilChanges(heatPump(), { heat: 72, quarter: 92 }), {
    HeatSetpoint: 72,
    CoolSetpoint: 76,
    StatusHeat: 1,
    StatusCool: 1,
    HeatNextPeriod: 92,
    CoolNextPeriod: 92,
  });
  // No setpoint: the current ones are held.
  assert.deepEqual(holdUntilChanges(furnace(), { quarter: 4 }), {
    StatusHeat: 1,
    StatusCool: 1,
    HeatNextPeriod: 4,
    CoolNextPeriod: 4,
  });
  assert.throws(() => holdUntilChanges(heatPump(), { quarter: 96 }), { code: 'invalid_time' });
});

test('both setpoints from the widget form, with their hold', () => {
  assert.deepEqual(setpointsChanges(heatPump(), { heat: 69, cool: 75, hold: 'permanent' }), {
    HeatSetpoint: 69,
    CoolSetpoint: 75,
    StatusHeat: 2,
    StatusCool: 2,
  });
  assert.deepEqual(setpointsChanges(furnace(), { heat: 60, hold: 'next' }), {
    HeatSetpoint: 60,
    CoolSetpoint: 77,
    StatusHeat: 1,
    StatusCool: 1,
    HeatNextPeriod: 76,
    CoolNextPeriod: 76,
  });
  assert.throws(() => setpointsChanges(furnace(), {}), { code: 'no_setpoint' });
});

test('applied changes read back like the portal will report them', () => {
  const t = applyChanges(heatPump(), { SystemSwitch: 0, FanMode: 1, StatusHeat: 2, StatusCool: 2 });
  assert.equal(t.systemMode, 'emheat');
  assert.equal(t.fanMode, 'on');
  assert.equal(t.hold, 'permanent');
});
