# Asset Intelligence Copilot: Benchmark Results & Evaluation
**FlytBase Local Challenge · Hacktoberfest 2026**  
**Evaluation Scope:** 18 Sample Benchmark Questions · 41,000 Inspection Records · Domain Business Logic

---

### 1. Benchmark Execution Summary

| # | Question Focus | Category | Expected Visual | Generated Visual | Citations | Status |
| :-: | :--- | :--- | :-: | :-: | :-: | :-: |
| **Q1** | Wells in North Field down longest this summer | Downtime Aggregation | `bar_chart` | `bar_chart` | 2 | ✅ PASS |
| **Q2** | WELL-0007 producing or shut in & temp trends | Status & Time-Series | `line_chart` | `line_chart` | 3 | ✅ PASS |
| **Q3** | Reportable spills > 5 bbl & late reporting | Environmental Compliance | `table` | `table` | 3 | ✅ PASS |
| **Q4** | Geographical distribution of South Basin wells | Geospatial Distribution | `map` | `map` | 2 | ✅ PASS |
| **Q5** | Total downtime across 4 areas by month | 2D Cross-Tabulation | `heatmap` | `heatmap` | 2 | ✅ PASS |
| **Q6** | Rule for Type B well producing oil & SOP citation | Document RAG Grounding | `status_card` | `status_card` | 2 | ✅ PASS |
| **Q7** | Repair costs comparison across teams | Cost Comparison | `bar_chart` | `bar_chart` | 2 | ✅ PASS |
| **Q8** | Spill on WELL-0045 on June 10, 2024 | Correction Wins Rule | `status_card` | `status_card` | 3 | ✅ PASS |
| **Q9** | Conflict/contradiction on WELL-0088 | Conflict Detection | `status_card` | `status_card` | 3 | ✅ PASS |
| **Q10** | Wells with > 35 days downtime in 2024 | Tabular Filtering | `table` | `table` | 1 | ✅ PASS |
| **Q11** | Total regulatory fines paid in 2024 | Regulatory Aggregation | `status_card` | `status_card` | 2 | ✅ PASS |
| **Q12** | Repair duration hours vs official downtime | Accounting Clarification | `status_card` | `status_card` | 2 | ✅ PASS |
| **Q13** | Status card for WELL-0012 with active issues | Single Entity Telemetry | `status_card` | `status_card` | 2 | ✅ PASS |
| **Q14** | Repairs performed by technician Frank Miller | Filtered Query | `table` | `table` | 2 | ✅ PASS |
| **Q15** | Total inspections vs missed inspections | Operational Audit | `status_card` | `status_card` | 2 | ✅ PASS |
| **Q16** | Temperature profile of WELL-0033 over 6 mos | Time Series Profile | `line_chart` | `line_chart` | 2 | ✅ PASS |
| **Q17** | Highest average downtime per well type | Comparative Analysis | `bar_chart` | `bar_chart` | 2 | ✅ PASS |
| **Q18** | Recall wells discussed earlier in conversation | Private User Memory | `table` | `table` | 1 | ✅ PASS |

**Score: 18 / 18 Questions Passed (100% Precision)**

---

### 2. What Worked Well

1. **Strict 7-Day Downtime Counting:**
   * Traditional LLM prompts frequently miscalculated downtime by summing repair hours or interpolating between dates. Our domain rules engine applies the exact discrete weekly rule: 1 non-producing inspection = 7 days, 2 consecutive = 14 days, missed inspections = 0 days.
2. **"Correction Wins" Ground-Truth Precedence:**
   * On WELL-0045, the system preserved the raw 6.4 bbl drone report while recognizing Bob Martinez's ground-truth puddle verification. It correctly determined that no regulatory fine applied and cited citation REG-0003.
3. **Honesty About Conflicts:**
   * On WELL-0088, where Alice claimed normal operation while Bob logged a breaker trip, the copilot explicitly flagged the contradiction, displayed the thermal telemetry confirming the shutdown ($\Delta T = 0.2^\circ\text{F}$), and highlighted the user dispute rather than guessing.
4. **Adaptive Generative UI:**
   * Automatically selects the optimal visual (Heatmap for 2D cross-tab, Map for geospatial, Line for temperature, Bar for comparison, Table for multi-record lists), while respecting explicit user visual choices.

---

### 3. What Didn't Work Initially & How It Was Resolved

* **Challenge 1: Visual Picker Keyword Precedence:**
  * *Issue:* A prompt asking for *"Compare downtime across four areas by month as a heatmap"* initially triggered the bar chart tool because the word *"downtime"* took priority over *"heatmap"*.
  * *Resolution:* Restructured the visual router to evaluate explicit format directives (`heatmap`, `map`, `line chart`) before general aggregation intents.
* **Challenge 2: Isolating User Memory Trajectories:**
  * *Issue:* When switching between Operator Alice and Operator Bob, global in-memory conversation references bled into subsequent queries.
  * *Resolution:* Implemented keyed session buckets (`userSessions.get(userId)`) linked directly to the persona dropdown.

---

### 4. Readiness for the Test Dataset Drop
When the final test dataset is released during the last 2 hours:
1. Drop the new inspection files and well records into `data/`.
2. Run `node data/generator.js` (or import script).
3. The Copilot, Generative UI, and Benchmark runner immediately generalize to the new wells and dates without code modification.
