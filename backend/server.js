require('dotenv').config();

const app = require('../backend/src/app');
const connectDB = require('../backend/src/config/db');
const initSocket = require('../backend/src/socket');
const realtime = require('../backend/src/socket/realtime');
const driverService = require('../backend/src/services/driverService');
const { STALE_SWEEP_INTERVAL_SECONDS } = require('../backend/src/config/constants');

const PORT = process.env.PORT || 5000;

const checkEnv = () => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error('JWT_SECRET is not defined in .env');
    process.exit(1);
  }
  if (process.env.NODE_ENV === 'production' && secret.startsWith('change_this')) {
    console.error('Set a real JWT_SECRET before running in production');
    process.exit(1);
  }
};

const start = async () => {
  checkEnv();
  await connectDB();

  const server = app.listen(PORT, () => {
    console.log(`Auto Connect API running on port ${PORT} (${process.env.NODE_ENV})`);
  });

  initSocket(server);
  console.log('Socket.IO ready');

  // Drivers who forgot to go offline (or lost signal) are switched to offline
  // and removed from connected passengers' maps.
  const sweeper = setInterval(async () => {
    try {
      const stale = await driverService.markStaleDriversOffline();
      stale.forEach((d) => realtime.broadcastDriverRemoved(d));
      if (stale.length > 0) console.log(`Marked ${stale.length} stale driver(s) offline`);
    } catch (err) {
      console.error('Stale driver sweep failed:', err.message);
    }
  }, STALE_SWEEP_INTERVAL_SECONDS * 1000);

  const shutdown = (signal) => {
    console.log(`${signal} received. Shutting down...`);
    clearInterval(sweeper);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
};

start();
