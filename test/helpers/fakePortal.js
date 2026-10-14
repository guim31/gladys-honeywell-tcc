// -----------------------------------------------------------------------------
// A Total Connect Comfort portal in memory, behind a `fetch`: form login with
// cookies, the location list, the thermostat data and the commands, built on
// the fixtures of test/fixtures/tcc. Nothing leaves the process.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

const fixture = (name) => readFileSync(new URL(`../fixtures/tcc/${name}`, import.meta.url), 'utf8');
export const json = (name) => JSON.parse(fixture(name));

export const USERNAME = 'someone@example.com';
export const PASSWORD = 'correct horse battery staple';

export const THERMOSTATS = {
  1234567: 'thermostat-furnace-ac.json',
  2345678: 'thermostat-heat-pump.json',
  3456789: 'thermostat-celsius-heat-only.json',
};

/**
 * @param {object} [options]
 * @param {Record<string, string>} [options.thermostats] DeviceID → fixture file
 * @param {object[]} [options.locations]
 * @param {'ok'|'locked'|'unclear'} [options.login] how the login answers good credentials
 */
export function createFakePortal({
  thermostats = THERMOSTATS,
  locations = json('locations.json'),
  login = 'ok',
} = {}) {
  const portal = {
    login,
    locations,
    data: new Map(Object.entries(thermostats).map(([id, file]) => [id, json(file)])),
    sessions: new Set(),
    logins: 0,
    requests: [],
    commands: [],
    down: false,
    rejectCommands: false,
    serverError: false,
    counter: 0,

    /** Every session ends (the portal restarted, the cookie timed out). */
    expireSessions() {
      portal.sessions.clear();
    },

    /** Change the uiData of a thermostat, as the thermostat itself would. */
    update(id, ui = {}, top = {}) {
      const data = portal.data.get(`${id}`);
      Object.assign(data.latestData.uiData, ui);
      Object.assign(data, top);
    },

    fetch: async (url, init = {}) => {
      const { pathname, search } = new URL(url);
      const method = init.method ?? 'GET';
      portal.requests.push({ method, path: pathname, search, body: init.body });
      if (portal.down) {
        throw new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } });
      }
      if (portal.serverError) {
        return new Response('<html>Unexpected Error</html>', { status: 503 });
      }
      const cookies = parseCookies(init.headers?.Cookie);

      if (pathname === '/portal' && method === 'GET') {
        return html('<html><form>login</form></html>', ['EccMyTcc=R0001; path=/']);
      }
      if (pathname === '/portal' && method === 'POST') {
        portal.logins += 1;
        const form = new URLSearchParams(init.body);
        const good = form.get('UserName') === USERNAME && form.get('Password') === PASSWORD;
        if (good && portal.login === 'ok') {
          portal.counter += 1;
          const token = `TOKEN${portal.counter}`;
          portal.sessions.add(token);
          // The portal's real cookie carries a malformed expiry.
          return new Response(null, {
            status: 302,
            headers: headersWith({ Location: '/portal/' }, [
              `.ASPXAUTH_TRUEHOME=${token}; expires=Mon, 01-Jan-0001 00:00:00 GMT+; path=/; HttpOnly`,
            ]),
          });
        }
        if (good && portal.login === 'unclear') {
          return html('<html><body>Down for maintenance</body></html>');
        }
        if (portal.login === 'locked') {
          return html(fixture('login-locked.html'));
        }
        return html(fixture('login-refused.html'));
      }

      if (!portal.sessions.has(cookies['.ASPXAUTH_TRUEHOME'])) {
        return new Response(null, {
          status: 302,
          headers: { Location: `/portal/?ReturnUrl=${encodeURIComponent(pathname)}` },
        });
      }

      if (pathname === '/portal/Location/GetLocationListData/' && method === 'POST') {
        const page = Number(new URLSearchParams(search).get('page'));
        return jsonResponse(page === 1 ? portal.locations : []);
      }
      const check = pathname.match(/^\/portal\/Device\/CheckDataSession\/(\d+)$/);
      if (check && method === 'GET') {
        const data = portal.data.get(check[1]);
        return data
          ? jsonResponse(data)
          : jsonResponse({ success: false, deviceLive: false, latestData: null });
      }
      if (pathname === '/portal/Device/SubmitControlScreenChanges' && method === 'POST') {
        const body = JSON.parse(init.body);
        portal.commands.push(body);
        const data = portal.data.get(`${body.DeviceID}`);
        if (!data || portal.rejectCommands) {
          return jsonResponse({ success: 0 });
        }
        applyCommand(data, body);
        return jsonResponse({ success: 1 });
      }
      return new Response('Not found', { status: 404 });
    },
  };
  return portal;
}

function applyCommand(data, body) {
  const ui = data.latestData.uiData;
  const fields = {
    SystemSwitch: 'SystemSwitchPosition',
    HeatSetpoint: 'HeatSetpoint',
    CoolSetpoint: 'CoolSetpoint',
    HeatNextPeriod: 'HeatNextPeriod',
    CoolNextPeriod: 'CoolNextPeriod',
    StatusHeat: 'StatusHeat',
    StatusCool: 'StatusCool',
  };
  for (const [key, field] of Object.entries(fields)) {
    if (body[key] !== null && body[key] !== undefined) {
      ui[field] = body[key];
    }
  }
  if (body.FanMode !== null && body.FanMode !== undefined) {
    data.latestData.fanData.fanMode = body.FanMode;
  }
}

function parseCookies(header) {
  return Object.fromEntries(
    `${header ?? ''}`
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => [part.slice(0, part.indexOf('=')), part.slice(part.indexOf('=') + 1)]),
  );
}

function headersWith(values, setCookies = []) {
  const headers = new Headers(values);
  for (const cookie of setCookies) {
    headers.append('Set-Cookie', cookie);
  }
  return headers;
}

const html = (body, cookies = []) =>
  new Response(body, {
    status: 200,
    headers: headersWith({ 'Content-Type': 'text/html; charset=utf-8' }, cookies),
  });

const jsonResponse = (value) =>
  new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
