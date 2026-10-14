// -----------------------------------------------------------------------------
// HTTP client of the Total Connect Comfort web portal
// (https://mytotalconnectcomfort.com, the US and Canada portal of the Honeywell
// / Resideo Wi-Fi thermostats).
//
// The portal has no public API: this is the browser session of its web pages.
// A form login sets an ASP.NET authentication cookie, then the pages' own
// XHR endpoints answer JSON:
//   POST /portal                                      form login
//   POST /portal/Location/GetLocationListData/?page=N  locations and thermostats
//   GET  /portal/Device/CheckDataSession/<id>          the state of one thermostat
//   POST /portal/Device/SubmitControlScreenChanges     a command
// The protocol was learnt by reading mkmer/AIOSomecomfort and kk7ds/somecomfort
// (GPL-3.0, read only, nothing copied) and the responses they recorded.
//
// This module only speaks HTTP and classifies the answers. When to log in, how
// often, and when to stop are decided by src/tcc/portal.js.
// -----------------------------------------------------------------------------

export const PORTAL_URL = 'https://mytotalconnectcomfort.com';

// The ASP.NET forms-authentication cookie: present and non-empty once logged in.
export const AUTH_COOKIE = '.ASPXAUTH_TRUEHOME';

/**
 * Why a portal call failed. `kind`:
 * - `credentials`: the portal refused the e-mail address or the password;
 * - `locked`: the portal says the account is locked (too many attempts);
 * - `login`: the login answer is none of the above (never retried blindly);
 * - `session`: the session expired (the portal answers its login page);
 * - `rejected`: the portal refused a command;
 * - `portal`: network error, timeout, server error, unexpected answer.
 */
export class TccError extends Error {
  constructor(kind, message, { status } = {}) {
    super(message);
    this.name = 'TccError';
    this.kind = kind;
    this.status = status;
  }
}

// What the login page says when it refuses a login: an ASP.NET validation
// summary ("Login was unsuccessful."). The lock wording is not documented:
// any mention of a lock or of too many attempts is taken as one.
const LOGIN_REFUSED = /validation-summary-errors|login was unsuccessful/i;
const ACCOUNT_LOCKED = /\blocked\b|too many (failed |unsuccessful )?(login |sign[- ]in )?attempts/i;

/**
 * @param {object} [options]
 * @param {typeof fetch} [options.fetch]
 * @param {string} [options.baseUrl]
 * @param {number} [options.timeoutMs] per request; the portal can be slow
 */
export class TccClient {
  constructor({ fetch = globalThis.fetch, baseUrl = PORTAL_URL, timeoutMs = 30_000 } = {}) {
    this.fetch = fetch;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    /** @type {Map<string, string>} */
    this.cookies = new Map();
    // The portal keeps a request counter in its XHR URLs (jQuery cache buster).
    this.counter = Date.now();
  }

  /** True when an authentication cookie is held (it may have expired). */
  hasSession() {
    return Boolean(this.cookies.get(AUTH_COOKIE));
  }

  /** The cookies to persist under /data, so a restart needs no new login. */
  exportCookies() {
    return Object.fromEntries(this.cookies);
  }

  importCookies(cookies) {
    this.cookies = new Map(
      Object.entries(cookies ?? {}).filter(
        ([name, value]) => typeof name === 'string' && typeof value === 'string' && value !== '',
      ),
    );
  }

  clearSession() {
    this.cookies.clear();
  }

  /**
   * One login attempt. Never retried here: a refused password tried again
   * is how the portal locks an account.
   * @throws {TccError} credentials | locked | login | portal
   */
  async login(username, password) {
    this.cookies.clear();
    // The login page first: it sets the load-balancer and anti-forgery
    // cookies the form post is expected to carry.
    const page = await this.send('GET', '/portal');
    if (page.status >= 500) {
      throw new TccError('portal', `login page answered HTTP ${page.status}`, {
        status: page.status,
      });
    }
    const response = await this.send('POST', '/portal', {
      form: {
        timeOffset: '480',
        UserName: username,
        Password: password,
        RememberMe: 'false',
      },
    });
    if (this.hasSession()) {
      return;
    }
    const body = await readText(response);
    // Older portal versions answered the XHR login with `{"Redirect":"/portal/"}`.
    if (/^\s*\{\s*"Redirect"\s*:/.test(body)) {
      return;
    }
    // The lock is looked for in the error summary when there is one: the rest
    // of the page is static text that may well mention locks.
    const summary = body.match(/validation-summary-errors[\s\S]{0,2000}?<\/div>/i)?.[0] ?? body;
    if (ACCOUNT_LOCKED.test(stripTags(summary))) {
      throw new TccError('locked', 'the portal says the account is locked', {
        status: response.status,
      });
    }
    if (LOGIN_REFUSED.test(body)) {
      throw new TccError('credentials', 'the portal refused the e-mail address or the password', {
        status: response.status,
      });
    }
    if (response.status >= 500) {
      throw new TccError('portal', `login answered HTTP ${response.status}`, {
        status: response.status,
      });
    }
    throw new TccError('login', `unexpected login answer (HTTP ${response.status})`, {
      status: response.status,
    });
  }

  /**
   * Every location of the account, with its thermostats. The portal pages
   * the list; an empty or repeated page ends it.
   * @returns {Promise<object[]>} the raw locations
   */
  async getLocations() {
    const locations = new Map();
    for (let page = 1; page <= 5; page += 1) {
      const list = await this.json(
        'POST',
        `/portal/Location/GetLocationListData/?page=${page}&filter=`,
      );
      if (!Array.isArray(list)) {
        throw new TccError('portal', 'the location list is not a list');
      }
      const fresh = list.filter((location) => location && !locations.has(location.LocationID));
      if (fresh.length === 0) {
        break;
      }
      for (const location of fresh) {
        locations.set(location.LocationID, location);
      }
    }
    return [...locations.values()];
  }

  /**
   * The current state of one thermostat.
   * @param {number|string} deviceId
   * @returns {Promise<object>} `{ success, deviceLive, communicationLost, latestData: { uiData, fanData, ... } }`
   */
  async getThermostat(deviceId) {
    this.counter += 1;
    const data = await this.json(
      'GET',
      `/portal/Device/CheckDataSession/${encodeURIComponent(deviceId)}?_=${this.counter}`,
    );
    if (!data || typeof data !== 'object' || !data.latestData?.uiData) {
      throw new TccError('portal', `no data for thermostat ${deviceId}`);
    }
    return data;
  }

  /**
   * Send a command. Every field the portal expects is present, null meaning
   * "unchanged".
   * @param {number|string} deviceId
   * @param {object} changes e.g. `{ HeatSetpoint: 68, StatusHeat: 1, StatusCool: 1 }`
   * @throws {TccError} rejected when the portal does not confirm it
   */
  async submitChanges(deviceId, changes) {
    const body = {
      DeviceID: Number(deviceId),
      SystemSwitch: null,
      HeatSetpoint: null,
      CoolSetpoint: null,
      HeatNextPeriod: null,
      CoolNextPeriod: null,
      StatusHeat: null,
      StatusCool: null,
      FanMode: null,
      ...changes,
    };
    const result = await this.json('POST', '/portal/Device/SubmitControlScreenChanges', {
      json: body,
    });
    if (!result || (result.success !== 1 && result.success !== true)) {
      throw new TccError('rejected', 'the portal refused the command');
    }
  }

  /**
   * A JSON endpoint. The portal answers an expired session with a redirect
   * to its login page, its login page itself, or 401/403.
   */
  async json(method, path, options) {
    const response = await this.send(method, path, options);
    const { status } = response;
    if (status === 401 || status === 403 || (status >= 300 && status < 400)) {
      await readText(response);
      throw new TccError('session', `session expired (HTTP ${status})`, { status });
    }
    if (status !== 200) {
      await readText(response);
      throw new TccError('portal', `${pathOnly(path)} answered HTTP ${status}`, { status });
    }
    const type = response.headers.get('content-type') ?? '';
    const text = await readText(response);
    if (!type.includes('json')) {
      // A web page instead of JSON: the login page of an expired session.
      if (/<html|<form/i.test(text)) {
        throw new TccError('session', 'session expired (login page)', { status });
      }
      throw new TccError('portal', `${pathOnly(path)} did not answer JSON`, { status });
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new TccError('portal', `${pathOnly(path)} answered invalid JSON`, { status });
    }
  }

  /** One HTTP exchange, cookies in and out, redirects never followed. */
  async send(method, path, { form, json } = {}) {
    const headers = {
      Accept: 'application/json, text/javascript, */*; q=0.01',
      'X-Requested-With': 'XMLHttpRequest',
      'User-Agent': 'Mozilla/5.0 (compatible; gladys-honeywell-tcc)',
    };
    let body;
    if (form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    } else if (json) {
      headers['Content-Type'] = 'application/json; charset=utf-8';
      body = JSON.stringify(json);
    }
    const cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    if (cookie) {
      headers.Cookie = cookie;
    }
    let response;
    try {
      response = await this.fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body,
        redirect: 'manual',
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (err) {
      // The error of fetch names the URL at most, never the body.
      const reason = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err?.message);
      throw new TccError('portal', `${pathOnly(path)}: ${reason}`);
    }
    this.storeCookies(response.headers);
    return response;
  }

  storeCookies(headers) {
    const lines = typeof headers.getSetCookie === 'function' ? headers.getSetCookie() : [];
    for (const line of lines) {
      const { name, value, expired } = parseSetCookie(line);
      if (!name) {
        continue;
      }
      if (value === '' || expired) {
        this.cookies.delete(name);
      } else {
        this.cookies.set(name, value);
      }
    }
  }
}

/**
 * The name and value of a Set-Cookie line. The portal sends its
 * authentication cookie with a malformed `expires` (the reason
 * AIOSomecomfort rewrites it): `expires` is ignored, the session lives until
 * the portal refuses it. An empty value, or `Max-Age=0`, deletes the cookie —
 * the portal's way of ending a session.
 */
export function parseSetCookie(line) {
  const [pair, ...attributes] = `${line}`.split(';');
  const index = pair.indexOf('=');
  if (index <= 0) {
    return { name: '', value: '', expired: false };
  }
  const name = pair.slice(0, index).trim();
  const value = pair.slice(index + 1).trim();
  const expired = attributes.some((attribute) => {
    const [key, ...rest] = attribute.split('=');
    return key.trim().toLowerCase() === 'max-age' && Number(rest.join('=')) <= 0;
  });
  return { name, value, expired };
}

async function readText(response) {
  try {
    return await response.text();
  } catch {
    return '';
  }
}

const stripTags = (html) =>
  html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ');

// Paths only in messages: a query string could one day carry something private.
const pathOnly = (path) => path.split('?')[0];
