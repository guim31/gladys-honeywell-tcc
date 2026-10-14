# Honeywell Total Connect Comfort for Gladys Assistant

External integration for [Gladys Assistant](https://gladysassistant.com) that
controls the **Honeywell / Resideo Wi-Fi thermostats** of the **Total Connect
Comfort** portal ([mytotalconnectcomfort.com](https://mytotalconnectcomfort.com/portal),
United States and Canada), like the Home Assistant
[`honeywell`](https://www.home-assistant.io/integrations/honeywell/) integration.

> **Developed without the hardware: feedback welcome.** The integration is
> built on recorded answers of the portal and tested against a simulated one;
> it has not been tried on a real thermostat or account yet.

User documentation: [English](docs/en.md) · [Français](docs/fr.md) ·
[Deutsch](docs/de.md) · [Español](docs/es.md).

## Features

- **One device per thermostat**, in the unit it displays (°F or °C): indoor
  temperature and humidity, outdoor temperature and humidity when an outdoor
  sensor is connected, heat and cool setpoints, system mode (off, heat, cool,
  auto), emergency heat (heat pumps), equipment status (idle, heating,
  cooling), fan setting and fan running, schedule hold.
- **Commands**: setpoints (whole °F or half °C, within the thermostat's
  limits and deadband), mode, emergency heat, fan, hold (follow schedule,
  until the next period, permanent).
- **Dashboard widget** "Honeywell thermostat": live temperatures and
  setpoints, mode, equipment, fan, hold, connection; a form to set the
  temperature and choose how long it holds, and a resume-schedule button.
- **Scene triggers** "Thermostat connection lost" (with its cause: thermostat
  offline, portal unreachable, login refused) and "Thermostat connection
  restored".
- **Scene action** "Hold a temperature until a time": a temporary hold that
  hands the thermostat back to its schedule at the given time.
- **Gentle with the portal**: read every 5 minutes by default (2 to 15),
  one request at a time, a re-read 15 seconds after a command, only changes
  sent to Gladys. A refused password is **never retried automatically**: the
  portal locks accounts after too many failed logins.

## Requirements

- Gladys Assistant **5.2.0** or later (widget buttons that open a form).
- A Total Connect Comfort account with at least one Wi-Fi thermostat
  (RTH6580WF, RTH8580WF, RTH9580WF, TH6320WF, TH8320WF, VisionPRO Wi-Fi...).
- Outbound HTTPS access from Gladys to `mytotalconnectcomfort.com`.

**Out of scope**: Lyric and T-series thermostats (T5, T6, T9, T10) and anything
managed by the Resideo / Honeywell Home app use another cloud (the Resideo
API); the European Evohome portal is another one too.

## Installation

In Gladys: **Integrations → Install from GitHub**, enter
`https://github.com/guim31/gladys-honeywell-tcc`, then fill in the e-mail
address and password of the Total Connect Comfort account, press **Test the
connection**, and add the thermostats from the **Discovery** tab.

## How it works

Total Connect Comfort has no public API. The integration logs in to the web
portal like a browser (form login, ASP.NET session cookie), then calls the
JSON endpoints of the portal's own pages: the location list, the state of
each thermostat (`CheckDataSession`) and the control screen
(`SubmitControlScreenChanges`). Its client is written from scratch
([`src/tcc/client.js`](src/tcc/client.js)); the login policy that protects the
account from locks is in [`src/tcc/portal.js`](src/tcc/portal.js).

- The session cookies are kept in `/data/tcc-session.json` (owner-only, keyed
  by a hash of the e-mail address, never the password), so a restart needs no
  new login.
- The container reads the portal with its own timer: the Gladys core does not
  reliably poll external devices (GladysAssistant/Gladys#3198), and cannot
  poll every few minutes anyway. The core's `onPoll` stays as a fallback.
- Devices are keyed on the portal's `DeviceID`, never on the thermostat name.

## Limitations

- Developed without the hardware: feedback welcome.
- United States and Canada portal only (see "Out of scope").
- Humidifiers, dehumidifiers, schedules and vacation holds are not managed (a
  vacation hold is shown, not set).
- The portal is not an official API and may change without notice. The lock
  wording of the portal is not documented: a lock is recognized by the words
  "locked" or "too many attempts" in the login error.

## Development

```bash
npm ci
npm run format:check
npm run lint
npm test
npx -y github:GladysAssistant/integration-store --skip-image-check .
node scripts/probe.mjs   # one refused login on the real portal, invented account
```

The tests use the fake Gladys of the SDK (`@gladysassistant/integration-sdk/testing`)
and an in-memory portal (`test/helpers/fakePortal.js`) built on recorded
answers (`test/fixtures/tcc/`). `TCC_USERNAME=... TCC_PASSWORD=... node scripts/probe.mjs`
reads a real account once, read only, without printing anything private. See
[`CLAUDE.md`](CLAUDE.md) for the project rules; releases go through the
**Release** workflow.

## Credits

- [mkmer/AIOSomecomfort](https://github.com/mkmer/AIOSomecomfort) and
  [kk7ds/somecomfort](https://github.com/kk7ds/somecomfort) (GPL-3.0): read to
  understand the portal (endpoints, `uiData` fields, mode and hold values);
  **no code was copied**. The fixtures follow the answers recorded in the
  somecomfort test cassettes, with their identifiers replaced.
- Home Assistant's
  [`honeywell`](https://github.com/home-assistant/core/tree/dev/homeassistant/components/honeywell)
  integration (Apache-2.0): the mapping of the modes, the emergency heat
  switch and the choice of sensors.
- The architecture and the conformity tests follow
  [gladys-wled](https://github.com/guim31/gladys-wled) and
  [gladys-subsonic](https://github.com/guim31/gladys-subsonic).

## Disclaimer

This project is not affiliated with, endorsed or sponsored by Honeywell or
Resideo. "Honeywell", "Total Connect Comfort", "Lyric" and "Resideo" are
trademarks of their respective owners.

## License

[Apache-2.0](LICENSE)
