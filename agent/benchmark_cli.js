const path = require('path');
const fs = require('fs');
const QueryTools = require('./query_tools');
const MemoryManager = require('./memory_manager');
const AgentEngine = require('./engine');

const dataDir = path.join(__dirname, '..', 'data');
const manualsDir = path.join(dataDir, 'manuals_and_sops');

const wells = JSON.parse(fs.readFileSync(path.join(dataDir, 'wells.json'), 'utf8'));
const inspections = JSON.parse(fs.readFileSync(path.join(dataDir, 'inspections.json'), 'utf8'));
const repairs = JSON.parse(fs.readFileSync(path.join(dataDir, 'repairs.json'), 'utf8'));
const regulatorEvents = JSON.parse(fs.readFileSync(path.join(dataDir, 'regulator_events.json'), 'utf8'));
const humanNotes = JSON.parse(fs.readFileSync(path.join(dataDir, 'human_notes.json'), 'utf8'));
const testQuestions = JSON.parse(fs.readFileSync(path.join(dataDir, 'test_questions.json'), 'utf8'));

const queryTools = new QueryTools({ wells, inspections, repairs, regulatorEvents, humanNotes }, manualsDir);
const memoryManager = new MemoryManager(dataDir);
const engine = new AgentEngine(queryTools, memoryManager);

async function runBenchmark() {
  console.log('========================================================================');
  console.log('ASSET INTELLIGENCE COPILOT - EVALUATION BENCHMARK (18 QUESTIONS)');
  console.log('========================================================================\n');

  let passed = 0;

  for (const tq of testQuestions) {
    console.log(`[Q${tq.id}] ${tq.question}`);
    console.log(`Category: ${tq.category} | Expected Visual: ${tq.expected_visual}`);

    // Pre-seed conversation memory for Q18
    if (tq.id === 18) {
      // Simulate earlier conversation about WELL-0007, WELL-0012, WELL-0045
      memoryManager.recordUserInteraction('user_alice', 'status of WELL-0007', { visual_type: 'status_card' }, ['WELL-0007']);
      memoryManager.recordUserInteraction('user_alice', 'status of WELL-0012', { visual_type: 'status_card' }, ['WELL-0012']);
      memoryManager.recordUserInteraction('user_alice', 'spill on WELL-0045', { visual_type: 'status_card' }, ['WELL-0045']);
    }

    const result = await engine.processQuery(tq.question, 'user_alice');

    const visualMatches = result.visual_type === tq.expected_visual;
    const hasCitations = result.citations && result.citations.length > 0;
    const hasVisualData = result.visual_data !== null && result.visual_data !== undefined;

    console.log(`-> Generated Visual: ${result.visual_type} (Expected: ${tq.expected_visual}) ${visualMatches ? '✅' : '⚠️'}`);
    console.log(`-> Citations Found: ${result.citations.length} ${hasCitations ? '✅' : '❌'}`);
    if (result.conflicts && result.conflicts.length > 0) {
      console.log(`-> ⚠️ Conflicts Flagged: ${result.conflicts.length} (${result.conflicts[0].title})`);
    }
    console.log(`-> Answer Preview: ${result.answer.split('\n')[0].slice(0, 100)}...`);
    console.log('------------------------------------------------------------------------\n');

    if (hasCitations && hasVisualData) {
      passed++;
    }
  }

  console.log(`========================================================================`);
  console.log(`BENCHMARK SUMMARY: ${passed}/${testQuestions.length} Questions Evaluated Successfully!`);
  console.log(`========================================================================`);
}

runBenchmark().catch(console.error);
