import 'tsx/esm';

const { main } = await import('./tools/data-seeder/cli.ts');

process.exitCode = await main();
