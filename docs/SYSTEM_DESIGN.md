# Asset Intelligence Copilot: System Design & Architecture
**FlytBase Local Challenge · Hacktoberfest 2026**  
**Author:** Pair-Programming Engineering Team  
**Focus:** Agentic AI orchestration layer for oil field production, compliance, and thermal telemetry.

---

### 1. Data Storage, Indexing & Hybrid Retrieval
The copilot unifies four heterogeneous data modalities across 200 wells and ~41,000 inspections:
* **Relational & Time-Series Engine (In-Memory Columnar Store):** Weekly FLIR temperature readings ($T_{wellhead}, T_{ambient}$), work order logs ($802$ repairs), and regulatory citation filings are indexed in memory with compound primary keys (`well_id`, `date`, `inspection_id`). This delivers sub-millisecond aggregations over 40k rows without database round-trips.
* **Unstructured Knowledge RAG (SOPs & Manuals):** Wellhead engineering manuals (`SOP-TYPE-A/B/C/D`), spill procedures (`SOP-SPILL-ENV`), and maintenance metrics (`SOP-MAINTENANCE`) are tokenized into semantic operational chunks. BM25 and dense bi-encoders extract exact thermal thresholds ($\Delta T \ge 15.0^\circ\text{F}$ for Type A, $18.0^\circ\text{F}$ for Type B, $12.0^\circ\text{F}$ for Type C, $20.0^\circ\text{F}$ for Type D).
* **Ground-Truth Overrides & Audit Ledger:** Field corrections and operator feedback are stored in an append-only JSON audit ledger (`overrides_ledger.json`) with provenance tracking (`author`, `timestamp`, `scope`, `reason`).

---

### 2. The Agentic Toolset & Domain Calculation Logic
Instead of relying on LLM arithmetic (which fails on downtime counts), the copilot orchestrates deterministic tools:
1. **`evaluateProductionStatus(inspection, well, overrides)`**: Dynamically looks up the well-type threshold from SOPs (or active overrides) and calculates whether $\Delta T = T_{wellhead} - T_{air} \ge \text{threshold}$.
2. **`computeDowntime(inspections, well, overrides, dateFilter)`**: Implements the non-negotiable oilfield rule: **each weekly inspection showing a stopped well accrues exactly 7 days (1 week) of downtime**. Missed inspections accrue **0 days**. Workover repair hours are kept strictly separate from inspection downtime.
3. **`resolveSpillVolume(inspection, overrides, notes)`**: Enforces the **"Correction Wins"** rule. Initial drone estimates (e.g. 6.4 bbl) are superseded by ground-truth human inspections (e.g. 0.0 bbl rainwater puddle), recalculating 24-hour reporting obligations.
4. **`detectConflicts(wellId)`**: Cross-checks operator claims against thermal sensors and flags user-vs-user or sensor-vs-note disagreements transparently.

---

### 3. Two-Tier Memory & Feedback Engine
* **Level 1: Shared Asset Knowledge:**
  * When Operator Alice logs *"WELL-0007 is down for planned maintenance through mid-July"*, the fact is indexed to the global Asset Knowledge Base.
  * When Operator Bob or Compliance Officer Carol asks about WELL-0007 later, the assistant incorporates this shared context and classifies the downtime as planned turn-around.
* **Level 2: Private User Session Memory:**
  * User context is strictly isolated per `user_id` (e.g., Alice, Bob, Carol, David, Frank).
  * A query like *"the wells we discussed earlier"* accesses only that specific user's session trajectory. Switching the user persona isolates the session completely.
* **Scoped Feedback & Learning:**
  * Corrections can target a **Single Well** (`WELL_INSTANCE`) or **All Wells of a Type** (`WELL_TYPE`).
  * Changes take effect immediately in all subsequent calculations across all users while maintaining the original value for auditability.

---

### 4. Generative UI Architecture
Answers are paired with inline, context-adaptive visual components:
* **Status Card:** Single asset telemetry, temperature gauge, downtime counter, photo reference, and SOP link.
* **Interactive Table:** Multi-column filtered rankings with sortable headers and citation pills.
* **Line Chart:** Temperature profiles over time ($T_{wellhead}$ vs $T_{air}$ vs SOP threshold).
* **Bar Chart:** Category rankings (top wells down the longest, repair costs by maintenance team).
* **Geospatial Map (Leaflet):** Interactive field map with color-coded wellhead markers (producing vs stopped).
* **Heatmap Matrix:** 2D Area $\times$ Month downtime intensity grid.

---

### 5. Cost, Models & Future Extensions
* **Model Layer:** Designed to operate deterministically via native orchestrator tools, with an optional LLM interface (e.g. Gemini 1.5 Flash / GPT-4o-mini) for query parsing.
* **Cost per Query:** Under **$0.0005** per turn; zero inference cost in deterministic tool-execution mode.
* **Handling Unseen Test Datasets:** The data ingestion layer uses standardized JSON/CSV loaders. When the test dataset drops, loading new wells and inspections requires a single script execution without model retraining.
* **Next Steps:** Integrating real-time SCADA streaming webhooks and automated thermal drone flight path replays.
