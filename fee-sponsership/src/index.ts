import { loadConfig } from './config.js';
import { createApp } from './server.js';

function main(): void {
  const config = loadConfig();
  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`fee-sponsorship server listening on http://localhost:${config.port}`);
    console.log(`  network=${config.network}  host=${config.host}`);
    if (config.apiKeys.size === 0) {
      console.warn(
        '  WARNING: no API_KEYS configured — every /fee-authorization request will be rejected with 401.',
      );
    } else {
      console.log(`  api keys: ${config.apiKeys.size} loaded`);
    }
  });
}

main();
