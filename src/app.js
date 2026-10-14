// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake Gladys)
// and runs the integration: index.js stays a few lines, and the tests drive the
// very same wiring.
//
// The rhythm: the portal is read by the container's own timer (the core does
// not reliably poll external devices, Gladys#3198), every 5 minutes by
// default, each thermostat added to Gladys once per period; a command is
// followed by a re-read. The core's onPoll is only a fallback.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { isConfigured, normalizeConfig, refreshMs } from './config.js';
import {
  FEATURE,
  SYSTEM_BY_GLADYS_MODE,
  buildDevice,
  buildStates,
  featureKeyOf,
  thermostatIdOf,
  thermostatIds,
} from './devices.js';
import { localized, messagesFor } from './i18n.js';
import { createIssueLog } from './issues.js';
import { SessionStore } from './store.js';
import { TccClient, TccError } from './tcc/client.js';
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
} from './tcc/model.js';
import {
  TEXT as WIDGET_TEXT,
  WIDGET_ACTION,
  WIDGET_KEY,
  buildThermostatContent,
  messageContent,
} from './widgets.js';
import { TccPortal } from './tcc/portal.js';

const logger = createLogger({ name: 'honeywell-tcc' });

export const ACTION_TEST = 'test_connection';
export const SCENE_ACTION_HOLD_UNTIL = 'hold_until';
export const TRIGGER = { LOST: 'connection_lost', RESTORED: 'connection_restored' };

// Causes carried by the connection_lost trigger.
export const LOST_CAUSE = {
  THERMOSTAT: 'thermostat_offline',
  PORTAL: 'portal_unreachable',
  LOGIN: 'login_refused',
};

const DEFAULT_TIMINGS = {
  // An unchanged value is published again past this age, so Gladys never
  // shows "no recent value" (48 h) on a stable setpoint.
  heartbeatMs: 6 * 60 * 60 * 1000,
  // The portal applies a command at once, the thermostat a little later.
  rereadAfterCommandMs: 15 * 1000,
  // Data younger than this is fresh enough to build a command on.
  commandFreshMs: 60 * 1000,
  // Portal failures in a row before the thermostats count as lost.
  lostAfterFailures: 3,
};

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: client, fetch, store, timers, now, timings, portalTimings
 */
export function registerHandlers(gladys, options = {}) {
  const hub = new TccHub(gladys, options);
  hub.register();
  return hub;
}

export class TccHub {
  constructor(gladys, options = {}) {
    this.gladys = gladys;
    this.now = options.now ?? (() => Date.now());
    this.timers = options.timers ?? true;
    this.timings = { ...DEFAULT_TIMINGS, ...options.timings };
    this.client = options.client ?? new TccClient({ fetch: options.fetch });
    this.portal = new TccPortal({
      client: this.client,
      store: options.store ?? new SessionStore(),
      now: this.now,
      timings: options.portalTimings,
    });
    this.config = normalizeConfig();
    /** @type {Map<string, { info: object, data: object, readAt: number, lost: string|null }>} */
    this.thermostats = new Map();
    this.discovered = false;
    this.portalFailures = 0;
    this.lastStatus = null;
    this.timer = null;
    this.rereads = new Map();
    this.stopped = false;
    this.issues = createIssueLog(logger);
    // One refresh at a time; a second caller waits for the running one.
    this.refreshing = Promise.resolve();
    this.thermostatCount = null;
    this.lastError = null;
  }

  register() {
    const { gladys } = this;
    gladys.onScanRequest(() => this.refresh({ discover: true }));
    gladys.onSetValue((device, feature, value) => this.setValue(device, feature, value));
    gladys.onPoll((device) => this.pollFromCore(device));
    gladys.onDeviceCreated((device) => this.deviceAdded(device));
    gladys.onDeviceUpdated((device) => this.deviceAdded(device));
    gladys.onAction(ACTION_TEST, () => this.testConnection());
    gladys.onSceneAction(SCENE_ACTION_HOLD_UNTIL, (fields) => this.holdUntil(fields));
    gladys.onWidgetGet(WIDGET_KEY, (request) => this.widgetGet(request));
    gladys.onWidgetAction(WIDGET_KEY, (actionKey, params, context) =>
      this.widgetAction(actionKey, context),
    );
    gladys.onConfigUpdated(async (config) => {
      logger.info('Configuration saved');
      await this.applyConfig(config);
      await this.refresh({ discover: true });
      this.schedule();
    });
    gladys.on('connected', () => this.start());
  }

  /** (Re)connection to Gladys: read the config, the portal, then every period. */
  async start() {
    try {
      // A reconnection: what Gladys showed may predate a restart of its own.
      this.lastStatus = null;
      await this.applyConfig(await this.gladys.getConfig());
      await this.refresh({ discover: true });
    } catch (err) {
      logger.error(`Post-connection initialization failed: ${err.message}`);
      await this.gladys.setConnectionStatus(false, localized('initFailed')).catch(() => {});
    }
    this.schedule();
  }

  stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    this.timer = null;
    for (const timer of this.rereads.values()) {
      clearTimeout(timer);
    }
    this.rereads.clear();
  }

  async applyConfig(raw) {
    const previous = this.config;
    this.config = normalizeConfig(raw);
    if (this.portal.configure(this.config.username, this.config.password)) {
      if (previous.username !== this.config.username) {
        // Another account: its thermostats are not these.
        this.thermostats.clear();
      }
      this.discovered = false;
      this.portalFailures = 0;
    }
  }

  schedule() {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.timers || this.stopped) {
      return;
    }
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.cycle();
      this.schedule();
    }, refreshMs(this.config));
    this.timer.unref?.();
  }

  /** One period of the timer: every thermostat added to Gladys, read once. */
  async cycle() {
    if (this.gladys.connected === false) {
      logger.debug('Gladys unreachable: portal read skipped');
      return;
    }
    await this.refresh();
  }

  /**
   * Read the portal. `discover` lists the thermostats of the account and
   * publishes them in the Discovery tab; otherwise the thermostats added to
   * Gladys are read, those read less than half a period ago skipped.
   * Never throws: failures become the connection status and the logs.
   */
  refresh({ discover = false, force = false } = {}) {
    const run = this.refreshing.then(() => this.refreshNow({ discover, force }));
    this.refreshing = run.catch(() => {});
    return run;
  }

  async refreshNow({ discover, force }) {
    if (!isConfigured(this.config)) {
      await this.setStatus('notConfigured');
      return;
    }
    try {
      if (discover || !this.discovered) {
        await this.discover();
      } else {
        await this.readAdded({ force });
      }
      await this.portalOk();
    } catch (err) {
      await this.portalFailed(err);
    }
  }

  async discover() {
    const locations = await this.portal.run((client) => client.getLocations());
    const list = listThermostats(locations);
    for (const info of list) {
      const raw = await this.portal.run((client) => client.getThermostat(info.id));
      const entry = this.thermostats.get(info.id);
      this.thermostats.set(info.id, {
        info,
        data: parseThermostat(raw),
        readAt: this.now(),
        lost: entry?.lost ?? null,
      });
    }
    const devices = list.map((info) =>
      buildDevice(this.gladys, info, this.thermostats.get(info.id).data, this.config.language),
    );
    await this.gladys.publishDiscoveredDevices(devices);
    if (!this.discovered) {
      logger.info(`Connected to Total Connect Comfort: ${list.length} thermostat(s)`);
    }
    this.discovered = true;
    this.thermostatCount = list.length;
    for (const info of list) {
      await this.publishThermostat(info.id);
      await this.publishTransport(info.id);
    }
  }

  /** The thermostat ids of the devices the user added to Gladys. */
  addedIds() {
    return (this.gladys.devices ?? [])
      .map((device) => thermostatIdOf(this.gladys, device.external_id))
      .filter((id) => id !== null);
  }

  async readAdded({ force = false } = {}) {
    const half = refreshMs(this.config) / 2;
    for (const id of this.addedIds()) {
      const entry = this.thermostats.get(id);
      if (!entry) {
        // Added in Gladys but no longer on the account: nothing to read.
        logger.debug(`Thermostat ${id} is not on the account any more`);
        continue;
      }
      if (!force && this.now() - entry.readAt < half) {
        continue;
      }
      await this.read(id);
    }
  }

  async read(id) {
    const raw = await this.portal.run((client) => client.getThermostat(id));
    const entry = this.thermostats.get(id);
    if (!entry) {
      // Forgotten meanwhile (another account was configured).
      return;
    }
    entry.data = parseThermostat(raw);
    entry.readAt = this.now();
    await this.publishThermostat(id);
  }

  /** Publish what changed, and the thermostat's link with the portal. */
  async publishThermostat(id) {
    const entry = this.thermostats.get(id);
    if (!entry || !this.isAdded(id)) {
      // Gladys drops the states of a device it does not know.
      return;
    }
    const states = buildStates(this.gladys, id, entry.data);
    const result = await this.gladys.publishChangedStates(states, {
      heartbeat: this.timings.heartbeatMs,
    });
    await this.setLink(id, entry.data.online ? null : LOST_CAUSE.THERMOSTAT);
    if (result?.count > 0) {
      logger.debug(`${entry.info.name || id}: ${result.count} state(s) published`);
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    }
  }

  isAdded(id) {
    return this.addedIds().includes(id);
  }

  /**
   * The link of one thermostat: null when it answers through the portal,
   * else why not. A change fires the scene trigger and the transport badge.
   */
  async setLink(id, cause) {
    const entry = this.thermostats.get(id);
    if (!entry || entry.lost === cause) {
      return;
    }
    const wasLost = entry.lost !== null;
    entry.lost = cause;
    const name = entry.info.name || id;
    const device = thermostatIds(this.gladys, id).device;
    if (!this.isAdded(id)) {
      return;
    }
    await this.publishTransport(id);
    if (cause === null) {
      logger.info(`${name}: reachable again`);
      await this.fire(TRIGGER.RESTORED, { thermostat: device, thermostat_name: name });
    } else if (!wasLost) {
      logger.warn(`${name}: connection lost (${cause})`);
      await this.fire(TRIGGER.LOST, { thermostat: device, thermostat_name: name, cause });
    }
  }

  /** The cloud / unreachable badge of a thermostat's device. */
  async publishTransport(id) {
    const entry = this.thermostats.get(id);
    if (!entry || !this.isAdded(id)) {
      return;
    }
    const transport = entry.lost === null ? 'cloud' : 'unreachable';
    await this.gladys
      .publishTransports([{ external_id: thermostatIds(this.gladys, id).device, transport }])
      .catch((err) => logger.debug(`Transport badge not published: ${err.message}`));
  }

  async fire(key, data) {
    await this.gladys
      .publishSceneEvent(key, data)
      .catch((err) => logger.warn(`Scene trigger ${key} not published: ${err.message}`));
  }

  async portalOk() {
    this.portalFailures = 0;
    this.issues.ok('portal', 'Total Connect Comfort answers again');
    if (this.thermostatCount === 0) {
      await this.setStatus('noThermostat');
    } else {
      await this.setStatus(null);
    }
  }

  async portalFailed(err) {
    if (!(err instanceof TccError)) {
      // A Gladys API error (publishing refused...): not the portal's doing.
      this.issues.fail('gladys', `Publishing to Gladys failed: ${err.message}`);
      return;
    }
    switch (err.kind) {
      case 'config':
        await this.setStatus('notConfigured');
        return;
      case 'credentials':
      case 'locked':
        this.issues.fail(
          'login',
          err.kind === 'locked'
            ? 'Total Connect Comfort says the account is locked: no new login until "Test the connection"'
            : 'Total Connect Comfort refused the credentials: no new login until they change',
        );
        await this.setStatus(err.kind);
        await this.loseAll(LOST_CAUSE.LOGIN);
        return;
      case 'throttled':
        logger.debug('Login attempt postponed');
        return;
      default:
        break;
    }
    if (this.portal.blocked) {
      this.issues.fail('login', `Total Connect Comfort login stopped: ${err.message}`);
      await this.setStatus('loginUnclear');
      await this.loseAll(LOST_CAUSE.LOGIN);
      return;
    }
    this.portalFailures += 1;
    this.lastError = err;
    this.issues.fail('portal', `Total Connect Comfort unreachable: ${err.message}`);
    await this.setStatus('unreachable', err.message);
    if (this.portalFailures >= this.timings.lostAfterFailures) {
      await this.loseAll(LOST_CAUSE.PORTAL);
    }
  }

  async loseAll(cause) {
    for (const id of this.thermostats.keys()) {
      await this.setLink(id, cause);
    }
  }

  /** The status of the Configuration screen, sent only when it changes. */
  async setStatus(key, ...args) {
    const message = key === null ? null : localized(key, ...args);
    const signature = JSON.stringify([key, message]);
    if (signature === this.lastStatus) {
      return;
    }
    this.lastStatus = signature;
    await (
      key === null
        ? this.gladys.setConnectionStatus(true)
        : this.gladys.setConnectionStatus(false, message)
    ).catch((err) => logger.debug(`Connection status not sent: ${err.message}`));
  }

  // --- Commands ----------------------------------------------------------------

  async setValue(device, feature, value) {
    const id = thermostatIdOf(this.gladys, device.external_id);
    const key = featureKeyOf(this.gladys, feature.external_id);
    const name = this.thermostats.get(id)?.info.name || id;
    logger.info(`Command from Gladys: ${name} ${key} = ${value}`);
    await this.command(id, (t) => featureChanges(t, key, value));
  }

  /**
   * Send one command, built on fresh data, then publish its result at once
   * and read the thermostat again a little later.
   * @param {string|null} id
   * @param {(thermostat: object) => object} build the portal changes
   * @throws {Error} a message for the user, in the configured language
   */
  async command(id, build) {
    const messages = messagesFor(this.config.language);
    const entry = id === null ? undefined : this.thermostats.get(id);
    if (!entry) {
      throw new Error(messages.unknown_thermostat);
    }
    try {
      if (this.now() - entry.readAt > this.timings.commandFreshMs) {
        await this.read(id);
      }
      if (!entry.data.online) {
        throw new Error(messages.offline);
      }
      const changes = build(entry.data);
      if (Object.keys(changes).length > 0) {
        await this.portal.run((client) => client.submitChanges(id, changes));
        entry.data = applyChanges(entry.data, changes);
        await this.publishThermostat(id);
        this.scheduleReread(id);
      }
      return entry.data;
    } catch (err) {
      throw this.commandError(err);
    }
  }

  commandError(err) {
    const messages = messagesFor(this.config.language);
    if (err instanceof CommandError) {
      const message = messages[err.code];
      return new Error(typeof message === 'function' ? message(err.details) : message);
    }
    if (err instanceof TccError) {
      logger.warn(`Command failed: ${err.message}`);
      if (err.kind === 'rejected') return new Error(messages.rejected);
      if (err.kind === 'credentials' || err.kind === 'locked') return new Error(messages[err.kind]);
      if (err.kind === 'config') return new Error(messages.notConfigured);
      return new Error(messages.failed(err.message));
    }
    return err;
  }

  scheduleReread(id) {
    if (!this.timers) {
      return;
    }
    clearTimeout(this.rereads.get(id));
    const timer = setTimeout(() => {
      this.rereads.delete(id);
      this.read(id)
        .then(() => this.portalOk())
        .catch((err) => this.portalFailed(err));
    }, this.timings.rereadAfterCommandMs);
    timer.unref?.();
    this.rereads.set(id, timer);
  }

  // --- Core callbacks -----------------------------------------------------------

  /** The core's onPoll: a fallback, skipped while the timer keeps up. */
  async pollFromCore(device) {
    const id = thermostatIdOf(this.gladys, device.external_id);
    const entry = id === null ? undefined : this.thermostats.get(id);
    if (!entry || this.now() - entry.readAt < refreshMs(this.config) * 0.9) {
      return;
    }
    try {
      await this.read(id);
      await this.portalOk();
    } catch (err) {
      await this.portalFailed(err);
    }
  }

  /**
   * A thermostat added (or updated) in Gladys: the SDK forgot what it had
   * published for it, and Gladys dropped the states sent before the device
   * existed. Everything is sent again now, from the last read when it is
   * recent enough.
   */
  async deviceAdded(device) {
    const id = thermostatIdOf(this.gladys, device.external_id);
    const entry = id === null ? undefined : this.thermostats.get(id);
    if (!entry) {
      return;
    }
    try {
      if (this.now() - entry.readAt >= refreshMs(this.config) / 2) {
        await this.read(id);
        await this.portalOk();
      } else {
        await this.publishThermostat(id);
      }
    } catch (err) {
      await this.portalFailed(err);
    }
    await this.publishTransport(id);
    this.gladys.requestWidgetRefresh(WIDGET_KEY);
  }

  /** "Test the connection": the one way to try again after a refused login. */
  async testConnection() {
    logger.info('Action: test the connection');
    if (!isConfigured(this.config)) {
      return localized('notConfigured');
    }
    this.portal.reset();
    this.lastStatus = null;
    await this.refresh({ discover: true });
    if (this.portal.blocked) {
      const kind = this.portal.blocked.kind;
      return localized(kind === 'credentials' || kind === 'locked' ? kind : 'loginUnclear');
    }
    if (!this.discovered || this.portalFailures > 0) {
      return localized('unreachable', this.lastError?.message ?? '?');
    }
    const names = [...this.thermostats.values()].map((entry) => entry.info.name || entry.info.id);
    return names.length === 0
      ? localized('testNone')
      : localized('testOk', names.length, names.join(', '));
  }

  /** Scene action: hold given setpoints until a time of day. */
  async holdUntil(fields) {
    const messages = messagesFor(this.config.language);
    const id = thermostatIdOf(this.gladys, fields.thermostat);
    const quarter = parseQuarter(fields.until);
    if (quarter === null) {
      throw new Error(messages.invalid_time);
    }
    const heat = parseSetpoint(fields.heat_setpoint);
    const cool = parseSetpoint(fields.cool_setpoint);
    if (heat === undefined || cool === undefined) {
      throw new Error(messages.invalid_value);
    }
    const name = this.thermostats.get(id)?.info.name || id;
    logger.info(`Scene action: ${name} hold until ${quarterToTime(quarter)}`);
    await this.command(id, (t) => holdUntilChanges(t, { heat, cool, quarter }));
    return { until: quarterToTime(quarter) };
  }

  // --- Widget ------------------------------------------------------------------------

  async widgetGet({ settings = {}, language = 'en' } = {}) {
    if (!isConfigured(this.config)) {
      return messageContent(language, 'notConfigured');
    }
    if (this.portal.blocked) {
      return messageContent(language, 'blocked');
    }
    if (!settings.thermostat) {
      return messageContent(language, 'pick');
    }
    const id = thermostatIdOf(this.gladys, settings.thermostat);
    const entry = id === null ? undefined : this.thermostats.get(id);
    if (!entry) {
      return messageContent(language, 'unknownThermostat');
    }
    const ids = thermostatIds(this.gladys, id);
    return buildThermostatContent({ thermostat: entry.data, feature: ids.feature, language });
  }

  async widgetAction(actionKey, { settings = {}, values } = {}) {
    const id = thermostatIdOf(this.gladys, settings.thermostat);
    const name = this.thermostats.get(id)?.info.name || id;
    logger.info(`Widget action: ${name} ${actionKey}`);
    if (actionKey === WIDGET_ACTION.SET_SETPOINTS) {
      if (!values) {
        // A core without action forms relays no values: nothing to set.
        throw new Error(messagesFor(this.config.language).no_setpoint);
      }
      await this.command(id, (t) =>
        setpointsChanges(t, {
          heat: parseSetpoint(values.heat) ?? null,
          cool: parseSetpoint(values.cool) ?? null,
          hold: values.hold === 'permanent' ? 'permanent' : 'next',
        }),
      );
    } else if (actionKey === WIDGET_ACTION.RESUME_SCHEDULE) {
      await this.command(id, (t) => holdChanges(t, 'schedule'));
    } else if (actionKey === WIDGET_ACTION.PERMANENT_HOLD) {
      await this.command(id, (t) => holdChanges(t, 'permanent'));
    } else {
      throw new Error(`Unknown widget action ${actionKey}`);
    }
    return Object.fromEntries(Object.entries(WIDGET_TEXT).map(([lang, text]) => [lang, text.done]));
  }
}

/**
 * A setpoint typed by a user or a scene: a number, or a text with a decimal
 * point or comma. Empty is null (not given); garbage is undefined (refused).
 */
export function parseSetpoint(value) {
  if (value === null || value === undefined || `${value}`.trim() === '') {
    return null;
  }
  const number = typeof value === 'number' ? value : Number(`${value}`.trim().replace(',', '.'));
  return Number.isFinite(number) ? number : undefined;
}

/** The portal changes of a Gladys command on one feature. */
export function featureChanges(thermostat, key, value) {
  switch (key) {
    case FEATURE.HEAT_SETPOINT:
      return setpointChanges(thermostat, 'heat', Number(value));
    case FEATURE.COOL_SETPOINT:
      return setpointChanges(thermostat, 'cool', Number(value));
    case FEATURE.MODE: {
      const mode = SYSTEM_BY_GLADYS_MODE[Number(value)];
      if (mode === undefined) throw new CommandError('mode_unsupported');
      // Emergency heat already heats: "heating" asked again changes nothing.
      if (mode === 'heat' && thermostat.systemMode === 'emheat') return {};
      return modeChanges(thermostat, mode);
    }
    case FEATURE.EMERGENCY_HEAT:
      if (Number(value) === 1) {
        return modeChanges(thermostat, 'emheat');
      }
      // Turning emergency heat off goes back to normal heating, never to
      // "off": the house keeps its heat.
      return thermostat.systemMode === 'emheat'
        ? modeChanges(thermostat, thermostat.modes.includes('heat') ? 'heat' : 'off')
        : {};
    case FEATURE.FAN_MODE:
      return fanChanges(thermostat, `${value}`);
    case FEATURE.HOLD:
      return holdChanges(thermostat, `${value}`);
    default:
      throw new CommandError('invalid_value');
  }
}
