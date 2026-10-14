// -----------------------------------------------------------------------------
// Entry point of the Honeywell Total Connect Comfort integration for Gladys.
//
// Everything is wired in src/app.js, so the tests drive the very same code.
// The SDK reads GLADYS_HOST_API_URL, GLADYS_INTEGRATION_TOKEN and
// GLADYS_INTEGRATION_SELECTOR, provided by the Gladys supervisor.
// -----------------------------------------------------------------------------

import { GladysIntegration, logger } from '@gladysassistant/integration-sdk';
import { registerHandlers } from './src/app.js';

const gladys = new GladysIntegration();
const hub = registerHandlers(gladys);

// The SDK disconnects cleanly and exits with code 0 when the supervisor stops
// the container (SIGTERM/SIGINT).
gladys.handleShutdown((signal) => {
  logger.info(`Received ${signal}: shutting down`);
  hub.stop();
});

logger.info('Starting the Honeywell Total Connect Comfort integration');
gladys.connect().catch((err) => {
  logger.error(`Initial connection to Gladys failed: ${err.message}`);
  process.exit(1);
});
