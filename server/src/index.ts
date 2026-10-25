import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { vendorRouter } from './routes/vendor';
import { initializeDatabase } from './db/database';
import { registerWsClient, broadcast } from './broadcast';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });
wss.on('connection', (ws) => registerWsClient(ws));

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use('/api/vendor', vendorRouter);

let currentMode = {
  scenario: 'clean',
  intensity: 0
};

function _legacyLocalBroadcast(payload: any) {
  const msg = JSON.stringify(payload);
  wss.clients.forEach(c => {
    if (c.readyState === WebSocket.OPEN) c.send(msg);
  });
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: Date.now() });
});

app.post('/api/sabotage', (req, res) => {
  const { scenario, intensity } = req.body;
  currentMode = {
    scenario: scenario || 'clean',
    intensity: intensity ?? 0
  };

  broadcast({ type: 'sabotage', mode: currentMode });
  res.json({ ok: true, mode: currentMode });
});

const PORT = Number(process.env.PORT) || 4000;
const HOST = process.env.HOST || '0.0.0.0';

initializeDatabase();

server.listen(PORT, HOST, () => {
  console.log(`server on port ${PORT}`);
});

process.on('uncaughtException', (err) => {
  console.warn('[Process] Caught unhandled exception:', err?.message || err);
});
process.on('unhandledRejection', (reason: any) => {
  console.warn('[Process] Caught unhandled rejection:', reason?.message || reason);
});
