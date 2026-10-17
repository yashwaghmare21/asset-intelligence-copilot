# Asset Intelligence Copilot
**FlytBase Local Challenge · Hacktoberfest 2026 Hack Day**  
*Agentic AI Chat Assistant for Oil Field Asset Intelligence & Operations*

An intelligent, multi-tier copilot designed to empower oil field operators with instant, grounded operational answers. Built to handle 200+ wells, ~41,000 thermal inspections, work orders, environmental compliance mandates, and field SOP manuals.

---

## 🌟 Key Features

1. **Domain Business Logic Engine**:
   * **Temperature Delta Rule:** Evaluates whether a wellhead is actively producing crude by comparing wellhead temperature against ambient air ($T_{wellhead} - T_{ambient} \ge \Delta T_{threshold}$) based on specific well type SOP manuals (Type A: $\ge 15^\circ\text{F}$, Type B: $\ge 18^\circ\text{F}$, Type C: $\ge 12^\circ\text{F}$, Type D: $\ge 20^\circ\text{F}$).
   * **7-Day Downtime Accounting:** Each weekly inspection confirming non-production accrues **exactly 7 days (1 week)** of downtime. Missed inspections accrue **0 days**. Workover repair hours are kept distinct from inspection-based availability metrics.
   * **Environmental Compliance:** Mandates 24-hour statutory notification for crude spills $\ge 5$ barrels (bbl).
   * **Correction Wins Rule:** Human field ground-truth verification supersedes initial drone inspection estimates (e.g., reclassifying mud puddles to 0.0 bbl and waiving regulatory penalties).

2. **Adaptive Generative UI**:
   * **Status Cards:** Single well telemetry, live temperature delta gauges, downtime counters, equipment specs, and SOP citation links.
   * **Interactive Tables:** Multi-attribute sortable records with formatted days, currency, and provenance pills.
   * **Line Charts (Chart.js):** Temperature profiles over time showing wellhead temp, air temp, delta, and SOP threshold limits.
   * **Bar Charts (Chart.js):** Comparative downtime rankings and maintenance expenditures by field team or technician.
   * **Interactive Geospatial Maps (Leaflet.js):** Real-time GPS-located wellheads color-coded by production status (🟢 Producing vs 🔴 Stopped).
   * **2D Downtime Heatmaps:** Area $\times$ Month operational intensity matrix.

3. **Two-Tier Memory & Learning Engine**:
   * **Shared Asset Knowledge:** Notes logged by any operator (e.g., planned turnarounds) are globally indexed and accessible to all users.
   * **Private User Session Memory:** Conversation context is isolated per operator profile (`user_alice`, `user_bob`, etc.) via a real-time persona switcher.
   * **Audited Ground-Truth Overrides:** Inline modal allowing operators to correct raw sensor data or AI analyses with scoped inheritance (`WELL_INSTANCE` vs `WELL_TYPE`).

4. **Honesty About Conflicts**:
   * Explicitly detects and highlights discrepancies between sensor telemetry and human claims, or disagreements between operators (e.g. WELL-0088), rather than hallucinating or silently guessing.

---

## 🚀 Quick Start Guide

### 1. Prerequisites
* **Node.js** (v18+ recommended)
* **npm** (v9+ recommended)

### 2. Installation
Navigate to the project directory and install dependencies:
```bash
cd project
npm install
```

### 3. Generate / Refresh Dataset
Generate the 200 wells, ~41,000 weekly inspections, repairs, notes, and SOPs:
```bash
npm run generate-data
```

### 4. Run the Evaluation Benchmark (18 Questions)
Execute the CLI test suite across all 18 representative hackathon questions:
```bash
npm run test-benchmark
```

### 5. Launch the Web Application
Start the Copilot server:
```bash
npm start
```
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📂 Project Structure

```
project/
├── server.js                  # Express API Server & Agent Dispatcher
├── package.json               # Scripts & dependencies
├── data/
│   ├── generator.js           # High-fidelity synthetic dataset generator
│   ├── wells.json             # 200 oil wells (coordinates, types, equipment)
│   ├── inspections.json       # ~41,000 weekly thermal inspections
│   ├── repairs.json           # 802 maintenance work orders & repair costs
│   ├── regulator_events.json  # Spill notifications, site visits, and fines
│   ├── human_notes.json       # Operator observations, planned shutdowns & disputes
│   ├── users.json             # Operator personas (Alice, Bob, Carol, David, Frank)
│   ├── test_questions.json    # 18 benchmark evaluation questions
│   ├── overrides_ledger.json  # Audited ground-truth user corrections
│   └── manuals_and_sops/      # Standard Operating Procedures & Engineering Manuals
│       ├── SOP-TYPE-A.md      # Beam Pump (ΔT >= 15°F rule)
│       ├── SOP-TYPE-B.md      # ESP Well (ΔT >= 18°F rule)
│       ├── SOP-TYPE-C.md      # Gas Lift (ΔT >= 12°F rule)
│       ├── SOP-TYPE-D.md      # PCP Well (ΔT >= 20°F rule)
│       ├── SOP-SPILL-ENV.md   # 5 bbl / 24-hr rule & Correction Wins protocol
│       └── SOP-MAINTENANCE.md # 7-day weekly downtime vs repair hours
├── agent/
│   ├── engine.js              # Intent parser, visual picker & grounded response synthesis
│   ├── domain_rules.js        # Mathematical thermal checks & discrete downtime math
│   ├── query_tools.js         # Analytical query engine, aggregations & RAG search
│   ├── memory_manager.js      # Two-tier memory (Shared vs Private) & Overrides ledger
│   ├── conflict_detector.js   # Sensor vs Human & User vs User disagreement detector
│   └── benchmark_cli.js       # Automated CLI evaluation runner
├── public/
│   ├── index.html             # Single-page Copilot web app with glassmorphic UI
│   ├── css/
│   │   └── style.css          # Design system, dark mode, responsive cards & charts
│   └── js/
│       ├── app.js             # Chat client, user persona switcher & benchmark runner
│       └── visual_renderer.js # Generative UI renderer (Cards, Tables, Charts, Maps)
└── docs/
    ├── SYSTEM_DESIGN.md       # Page 1 Submission: Architecture & System Design
    └── RESULTS.md             # Page 2 Submission: Benchmark Results & Evaluation
```

---

## 📝 Loading the Final Test Dataset (Last 2 Hours)
When organizers release the final test dataset:
1. Place the new dataset files into the `data/` folder (or overwrite `wells.json` / `inspections.json`).
2. Restart the server (`npm start`) or re-run the generator.
3. Open `http://localhost:3000` and navigate to the **18 Evaluation Qs** tab to run the final questions suite with 1 click.
