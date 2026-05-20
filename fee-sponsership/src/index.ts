import { loadConfig } from './config.js';
import { createApp } from './server.js';

function main(): void {
  const config = loadConfig();
  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`fee-sponsorship server listening on http://localhost:${config.port}`);
    console.log(`  network=${config.network}  host=${config.host}`);
    const programs = Object.keys(config.allowlist);
    if (programs.length === 0) {
      console.warn('  WARNING: allowlist is empty — every /sponsor request will be rejected.');
    } else {
      console.log(`  allowlist: ${programs.join(', ')}`);
    }
  });
}

main();
