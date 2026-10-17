const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const QueryTools = require('./agent/query_tools');
const MemoryManager = require('./agent/memory_manager');
const AgentEngine = require('./agent/engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load datasets
const dataDir = path.join(__dirname, 'data');
const manualsDir = path.join(dataDir, 'manuals_and_sops');

const wells = JSON.parse(fs.readFileSync(path.join(dataDir, 'wells.json'), 'utf8'));
const inspections = JSON.parse(fs.readFileSync(path.join(dataDir, 'inspections.json'), 'utf8'));
const repairs = JSON.parse(fs.readFileSync(path.join(dataDir, 'repairs.json'), 'utf8'));
const regulatorEvents = JSON.parse(fs.readFileSync(path.join(dataDir, 'regulator_events.json'), 'utf8'));
const humanNotes = JSON.parse(fs.readFileSync(path.join(dataDir, 'human_notes.json'), 'utf8'));
const users = JSON.parse(fs.readFileSync(path.join(dataDir, 'users.json'), 'utf8'));
const testQuestions = JSON.parse(fs.readFileSync(path.join(dataDir, 'test_questions.json'), 'utf8'));

// Initialize agent components
const queryTools = new QueryTools({ wells, inspections, repairs, regulatorEvents, humanNotes }, manualsDir);
const memoryManager = new MemoryManager(dataDir);
const engine = new AgentEngine(queryTools, memoryManager);

// API Endpoints

// 1. Get users for user picker
app.get('/api/users', (req, res) => {
  res.json({ users });
});

// 2. Chat Query Endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { query, user_id, visual_preference } = req.body;
    if (!query) {
      return res.status(400).json({ error: 'Query text is required' });
    }

    const userId = user_id || 'user_alice';
    const result = await engine.processQuery(query, userId, visual_preference);
    res.json(result);
  } catch (error) {
    console.error('Error processing query:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

// 3. Get user session / private memory
app.get('/api/session/:userId', (req, res) => {
  const session = memoryManager.getUserSession(req.params.userId);
  res.json({ user_id: req.params.userId, session });
});

// Clear user session
app.delete('/api/session/:userId', (req, res) => {
  memoryManager.clearUserSession(req.params.userId);
  res.json({ success: true, message: `Session cleared for ${req.params.userId}` });
});

// 4. Overrides and Feedback Ledger
app.get('/api/overrides', (req, res) => {
  res.json({ overrides: memoryManager.getOverrides() });
});

app.post('/api/overrides', (req, res) => {
  try {
    const { scope, target_id, target_type, target_inspection_id, field, original_value, corrected_value, author, reason } = req.body;
    if (!field || corrected_value === undefined) {
      return res.status(400).json({ error: 'Field and corrected value are required' });
    }

    const override = memoryManager.addOverride({
      scope,
      target_id,
      target_type,
      target_inspection_id,
      field,
      original_value,
      corrected_value,
      author,
      reason
    });

    res.json({ success: true, override });
  } catch (error) {
    console.error('Error saving override:', error);
    res.status(500).json({ error: error.message });
  }
});

// 5. Shared Well Knowledge
app.get('/api/wells/:wellId/knowledge', (req, res) => {
  const knowledge = memoryManager.getSharedWellKnowledge(req.params.wellId, humanNotes);
  const summary = queryTools.getWellSummary(req.params.wellId, memoryManager.getOverrides());
  res.json({ knowledge, summary });
});

// 6. Test Questions / Benchmark
app.get('/api/benchmark', (req, res) => {
  res.json({ questions: testQuestions });
});

// 7. Well search / directory
app.get('/api/wells', (req, res) => {
  res.json({
    total: wells.length,
    wells: wells.map(w => ({
      well_id: w.well_id,
      name: w.name,
      type: w.type,
      area: w.area,
      team: w.team,
      status: w.recorded_status
    }))
  });
});

app.listen(PORT, () => {
  console.log(`========================================================================`);
  console.log(`🚀 Asset Intelligence Copilot server running at http://localhost:${PORT}`);
  console.log(`========================================================================`);
});
