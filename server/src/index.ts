import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { vendorRouter } from './routes/vendor';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

app.use('/api/vendor', vendorRouter);

let currentMode = {
  scenario: 'clean',
  intensity: 0
};

function broadcast(payload: any) {
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

server.listen(PORT, HOST, () => {
  console.log(`server on port ${PORT}`);
});
