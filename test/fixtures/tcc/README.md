# Total Connect Comfort fixtures

Answers of the portal (`mytotalconnectcomfort.com`), used by the tests and by
the fake portal of `test/helpers/fakePortal.js`.

| File                                 | What it is                                                                                                                                                                                                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `thermostat-furnace-ac.json`         | A real `CheckDataSession` answer (recorded in the test cassettes of [kk7ds/somecomfort](https://github.com/kk7ds/somecomfort)): °F, heat / cool / off, fan with circulate, indoor humidity, no outdoor sensor, permanent hold, heating. Only the `DeviceID` is replaced. |
| `thermostat-heat-pump.json`          | The same answer turned into a heat pump: auto and emergency heat allowed, 3 °F deadband, outdoor sensor, fan "follow schedule" and running, following its schedule, heating.                                                                                             |
| `thermostat-celsius-heat-only.json`  | The same answer turned into a Canadian heat-only thermostat: °C with half degrees, no cooling, no fan, no humidity sensor, temporary hold, no equipment status reported.                                                                                                 |
| `thermostat-furnace-ac-offline.json` | The first one with `deviceLive: false` and `communicationLost: true`: the thermostat lost its Wi-Fi.                                                                                                                                                                     |
| `locations.json`                     | A `GetLocationListData` answer in the recorded shape: two locations, three thermostats. Names, ids and MAC addresses are invented.                                                                                                                                       |
| `login-refused.html`                 | The login page the portal answers to a refused login (abridged, recorded in the same cassettes).                                                                                                                                                                         |
| `login-locked.html`                  | **Invented**: the lock wording of the portal is not documented. To replace with a real answer when one is seen.                                                                                                                                                          |

The recorded answers are from 2016: `scripts/probe.mjs` checks the live portal
against the same reading.
