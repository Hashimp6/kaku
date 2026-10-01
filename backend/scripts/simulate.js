// Simulates one driver moving and one passenger watching, over Socket.IO.
// Needs: npm install -D socket.io-client
//
// Usage:
//   DRIVER_PHONE=9000000001 DRIVER_PASSWORD=password123 \
//   PASSENGER_PHONE=9000000002 PASSENGER_PASSWORD=password123 \
//   node scripts/simulate.js
//
// The driver must already be APPROVED by an admin.
const { io } = require('socket.io-client');

const BASE = process.env.BASE_URL || 'http://localhost:5050';
const { DRIVER_PHONE, DRIVER_PASSWORD, PASSENGER_PHONE, PASSENGER_PASSWORD } = process.env;

async function login(phone, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(`Login failed for ${phone}: ${data.message}`);
  return data.token;
}

const connect = (token) =>
  new Promise((resolve, reject) => {
    const s = io(BASE, { auth: { token } });
    s.on('connect', () => resolve(s));
    s.on('connect_error', (e) => reject(new Error(`Socket error: ${e.message}`)));
  });

const emit = (socket, event, payload) =>
  new Promise((resolve) => socket.emit(event, payload, resolve));

(async () => {
  if (!DRIVER_PHONE || !PASSENGER_PHONE) throw new Error('Set DRIVER_PHONE and PASSENGER_PHONE (see top of file)');

  const [driverToken, passengerToken] = await Promise.all([
    login(DRIVER_PHONE, DRIVER_PASSWORD),
    login(PASSENGER_PHONE, PASSENGER_PASSWORD),
  ]);
  const driver = await connect(driverToken);
  const passenger = await connect(passengerToken);

  const START = { lat: 11.2588, lng: 75.7804 };

  passenger.on('driver:update', (d) =>
    console.log(`  PASSENGER <- update  ${d.name}  ${d.movementStatus}  ${d.location.lat.toFixed(5)},${d.location.lng.toFixed(5)}`)
  );
  passenger.on('driver:removed', (d) => console.log(`  PASSENGER <- removed ${d.id}`));

  console.log('watch :', JSON.stringify(await emit(passenger, 'passenger:watch', { ...START, radius: 2000 })));
  console.log('online:', JSON.stringify(await emit(driver, 'driver:online', START)));

  let i = 0;
  const timer = setInterval(async () => {
    i += 1;
    const res = await emit(driver, 'driver:location', { lat: START.lat + i * 0.0003, lng: START.lng, speed: 5 });
    console.log(`driver moved #${i} ->`, JSON.stringify(res));
    if (i === 6) {
      clearInterval(timer);
      console.log('offline:', JSON.stringify(await emit(driver, 'driver:offline')));
      setTimeout(() => process.exit(0), 500);
    }
  }, 1500);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
