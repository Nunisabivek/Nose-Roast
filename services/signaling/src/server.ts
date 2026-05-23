import { PeerServer } from 'peer';

// Railway automatically sets the PORT environment variable
const port = parseInt(process.env.PORT || '9000', 10);

const server = PeerServer({
  port: port,
  path: '/noseroast',
  // proxied: true is CRITICAL for Railway/Heroku to parse secure HTTPS/WSS handshakes behind their load balancer
  proxied: true
});

console.log(`🚀 Nose Roast Signaling Server running on port ${port}`);

server.on('connection', (client) => {
  console.log(`🔗 Player connected: ${client.getId()}`);
});

server.on('disconnect', (client) => {
  console.log(`❌ Player disconnected: ${client.getId()}`);
});
