import express from 'express';
import http from 'http';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { CoreBridge } from './core-bridge';
import { LedgerStorage } from './db/storage';
import { DataPayload, SabotageEvent, LiveComparisonState } from '../shared/types';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const bridge = new CoreBridge();
const storage = new LedgerStorage();

// Current system state
let currentScenario: SabotageEvent = {
  scenario: 'NONE_CLEAN',
  intensity: 0,
  injectedAt: Date.now(),
  description: 'Clean operating baseline'
};

function broadcastState(state: LiveComparisonState) {
  const message = JSON.stringify(state);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 1. Health check & status
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    team: 'Cascade',
    members: ['Akash', 'Thackrey', 'Aryan', 'Manthan'],
    storageStats: storage.getStats()
  });
});

// 2. Submit payload from Expo Go mobile app
app.post('/api/process', (req, res) => {
  const payload: DataPayload = req.body;
  const comparison = bridge.evaluateComparison(payload, currentScenario.intensity);

  // Persist verified engine result
  storage.save(payload, comparison.engine);

  const stats = storage.getStats();
  const comparisonState: LiveComparisonState = {
    currentScenario: currentScenario.scenario,
    sabotageIntensity: currentScenario.intensity,
    latestPayload: payload,
    baseline: comparison.baseline,
    engine: comparison.engine,
    systemMetrics: {
      totalEvents: stats.total,
      baselineFailures: comparison.baseline.crashedOrHallucinated ? 1 : 0,
      engineRecoveries: stats.committed,
      averageEngineLatencyMs: comparison.engine.latencyMs
    }
  };

  // Broadcast live update to all connected Expo Go mobile devices and judge screens
  broadcastState(comparisonState);

  res.json(comparisonState);
});

// 3. Live Sabotage Injection (Triggered by judge slider on phone or laptop)
app.post('/api/sabotage', (req, res) => {
  const { scenario, intensity, description } = req.body;
  currentScenario = {
    scenario: scenario || 'NONE_CLEAN',
    intensity: typeof intensity === 'number' ? intensity : 50,
    injectedAt: Date.now(),
    description: description || 'Adversarial perturbation injected'
  };

  console.log(`[SABOTAGE TRIGGERED] Scenario: ${currentScenario.scenario} | Intensity: ${currentScenario.intensity}%`);

  // Run a synthetic test against the new scenario and broadcast
  const testPayload: DataPayload = {
    id: `test-${Date.now()}`,
    timestamp: currentScenario.scenario === 'CLOCK_DRIFT_1970' ? 0 : Date.now(),
    source: 'live-judge-probe',
    rawInput: `Probe signal under ${currentScenario.scenario} (${currentScenario.intensity}% intensity)`
  };

  const comparison = bridge.evaluateComparison(testPayload, currentScenario.intensity);
  storage.save(testPayload, comparison.engine);

  const stats = storage.getStats();
  const state: LiveComparisonState = {
    currentScenario: currentScenario.scenario,
    sabotageIntensity: currentScenario.intensity,
    latestPayload: testPayload,
    baseline: comparison.baseline,
    engine: comparison.engine,
    systemMetrics: {
      totalEvents: stats.total,
      baselineFailures: comparison.baseline.crashedOrHallucinated ? 1 : 0,
      engineRecoveries: stats.committed,
      averageEngineLatencyMs: comparison.engine.latencyMs
    }
  };

  broadcastState(state);
  res.json({ success: true, activeScenario: currentScenario, state });
});

// 4. Get current audit records
app.get('/api/ledger', (req, res) => {
  res.json(storage.getAll());
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`🚀 Cascade Orchestration Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server live on ws://localhost:${PORT}`);
});
