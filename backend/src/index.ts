import { env } from './config/env';
import { createApp } from './app';
import { connectDb } from './db/mongoose';

async function main() {
  await connectDb();
  // eslint-disable-next-line no-console
  console.log(`Connected to MongoDB at ${env.MONGODB_URI}`);

  const app = createApp();
  app.listen(env.PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`InnovChain backend listening on http://localhost:${env.PORT} (CHAIN_MODE=${env.CHAIN_MODE})`);
  });
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed to start server:', err);
  process.exit(1);
});
