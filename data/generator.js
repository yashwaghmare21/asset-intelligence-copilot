const fs = require('fs');
const path = require('path');

const SEED = 42;
function pseudoRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}
const rand = pseudoRandom(SEED);

function choice(arr) {
  return arr[Math.floor(rand() * arr.length)];
}
function randRange(min, max) {
  return min + rand() * (max - min);
}
function randInt(min, max) {
  return Math.floor(randRange(min, max + 1));
}

console.log('Generating synthetic dataset for Asset Intelligence Copilot...');

const areas = ['North Field', 'South Basin', 'East Ridge', 'West Valley'];
const teams = ['Team Alpha', 'Team Bravo', 'Team Charlie', 'Team Delta'];
const wellTypes = [
  { type: 'Type A', name: 'Beam Pumping Unit', deltaThreshold: 15.0, equip: 'Lufkin Mark II 640' },
  { type: 'Type B', name: 'Electric Submersible Pump', deltaThreshold: 18.0, equip: 'Baker Hughes Centrilift ESP' },
  { type: 'Type C', name: 'Gas Lift', deltaThreshold: 12.0, equip: 'Cameron High-Pressure Mandrel' },
  { type: 'Type D', name: 'Progressive Cavity Pump', deltaThreshold: 20.0, equip: 'Weatherford PCP Series 500' }
];

// 1. Generate 200 Wells
const wells = [];
const baseLat = 31.85;
const baseLon = -102.35;

for (let i = 1; i <= 200; i++) {
  const wellId = `WELL-${String(i).padStart(4, '0')}`;
  const wellTypeObj = wellTypes[(i - 1) % wellTypes.length];
  const area = areas[(i - 1) % areas.length];
  const team = teams[(i - 1) % teams.length];
  
  // Specific interesting test wells
  let recordedStatus = 'Active';
  if (i === 7) recordedStatus = 'Shut In';
  else if (i % 25 === 0) recordedStatus = 'Under Maintenance';
  else if (i % 40 === 0) recordedStatus = 'Active'; // but may actually be down

  wells.push({
    well_id: wellId,
    name: `Permian ${area.split(' ')[0]} ${String(i).padStart(3, '0')}`,
    type: wellTypeObj.type,
    type_name: wellTypeObj.name,
    delta_threshold_f: wellTypeObj.deltaThreshold,
    area: area,
    team: team,
    equipment: wellTypeObj.equip,
    recorded_status: recordedStatus,
    latitude: parseFloat((baseLat + randRange(-0.35, 0.35)).toFixed(6)),
    longitude: parseFloat((baseLon + randRange(-0.35, 0.35)).toFixed(6)),
    depth_ft: randInt(4500, 11500),
    spud_date: `201${randInt(5, 9)}-0${randInt(1, 9)}-15`
  });
}

// 2. Generate 4 Years of Weekly Inspections (~208 weeks)
// 2021-01-04 to 2024-12-23
const inspections = [];
const startDate = new Date('2021-01-04T00:00:00Z');
const totalWeeks = 208;

// Specific downtime patterns for test wells:
// WELL-0007: down for summer 2024 (planned maintenance)
// WELL-0012: chronic motor failure in summer 2024 (down 8 weeks in summer 2024)
// WELL-0033: down in West Valley during July-August 2024
// WELL-0045: had a reported spill on 2024-06-10 that was later corrected to mud puddle
// WELL-0088: subject to user contradiction (Alice says running, Bob says burned out)

let inspectionSeq = 1;

for (let w = 0; w < totalWeeks; w++) {
  const currentWeekDate = new Date(startDate.getTime() + w * 7 * 24 * 60 * 60 * 1000);
  const dateStr = currentWeekDate.toISOString().split('T')[0];
  const month = currentWeekDate.getUTCMonth(); // 0-11
  const year = currentWeekDate.getUTCFullYear();
  const isSummer2024 = (year === 2024 && month >= 5 && month <= 7); // June, July, August

  // Seasonal ambient temp (45F in winter to 98F in summer)
  const seasonalBaseTemp = 70 + 26 * Math.sin(((month - 3) / 12) * 2 * Math.PI);
  const ambientJitter = randRange(-6, 6);
  const ambientTemp = parseFloat((seasonalBaseTemp + ambientJitter).toFixed(1));

  for (let i = 0; i < wells.length; i++) {
    const well = wells[i];
    const wellNum = i + 1;

    // Small chance of missed inspection (weather/access) -> adds 0 downtime
    if (rand() < 0.015 && wellNum !== 7 && wellNum !== 12 && wellNum !== 45) {
      continue; // Missed inspection!
    }

    let isProducing = true;

    // Inherent unreliability / stoppage probability:
    if (wellNum === 7 && isSummer2024 && month <= 6) {
      // WELL-0007 down in June/July 2024
      isProducing = false;
    } else if (wellNum === 12 && isSummer2024) {
      // WELL-0012 down throughout summer 2024 (highest downtime)
      isProducing = false;
    } else if (wellNum === 33 && year === 2024 && (month === 6 || month === 7)) {
      isProducing = false;
    } else if (wellNum === 88 && year === 2024 && month === 7) {
      // Stopped in August 2024
      isProducing = false;
    } else if (rand() < 0.06) {
      // Typical random 6% downtime rate
      isProducing = false;
    }

    let wellheadTemp;
    if (isProducing) {
      // Warm oil flow: delta exceeds threshold
      const deltaT = well.delta_threshold_f + randRange(3.5, 25.0);
      wellheadTemp = parseFloat((ambientTemp + deltaT).toFixed(1));
    } else {
      // Stopped: cools down to ambient temperature +/- 2F
      const deltaT = randRange(-1.5, 2.5);
      wellheadTemp = parseFloat((ambientTemp + deltaT).toFixed(1));
    }

    // Spill generation
    let spillFound = false;
    let spillVolume = 0.0;
    let spillAreaSqft = 0.0;

    if (wellNum === 45 && dateStr === '2024-06-10') {
      spillFound = true;
      spillVolume = 6.4; // Initial drone inspection noted 6.4 bbl (later corrected to 0)
      spillAreaSqft = 120.0;
    } else if (wellNum === 23 && dateStr === '2024-04-15') {
      spillFound = true;
      spillVolume = 8.5; // Unreported spill that resulted in regulatory fine
      spillAreaSqft = 250.0;
    } else if (wellNum === 104 && dateStr === '2023-09-18') {
      spillFound = true;
      spillVolume = 5.2; // Reported compliant spill
      spillAreaSqft = 95.0;
    } else if (rand() < 0.003) {
      spillFound = true;
      spillVolume = parseFloat(randRange(0.2, 4.2).toFixed(1)); // minor spills
      spillAreaSqft = parseFloat(randRange(10, 80).toFixed(1));
    }

    const inspId = `INSP-${String(inspectionSeq++).padStart(6, '0')}`;
    inspections.push({
      inspection_id: inspId,
      well_id: well.well_id,
      date: dateStr,
      ambient_temp_f: ambientTemp,
      wellhead_temp_f: wellheadTemp,
      spill_found: spillFound,
      spill_volume_bbl: spillVolume,
      spill_area_sqft: spillAreaSqft,
      inspector_method: rand() < 0.7 ? 'Drone Aerial FLIR' : 'Ground Inspection Crew',
      photo_reference: spillFound ? `media/spill_${well.well_id}_${dateStr}.jpg` : `media/drone_${well.well_id}_${dateStr}.jpg`,
      notes: spillFound ? `Fluid detected near containment apron. Estimated ${spillVolume} bbl.` : 'Routine thermal inspection.'
    });
  }
}

// 3. Generate Repairs
const repairs = [];
const issues = [
  { issue: 'Rod pump parted', fix: 'Pulled rod string and replaced sheared coupling', costMin: 4500, costMax: 9000, timeMin: 18, timeMax: 36 },
  { issue: 'ESP motor trip / electrical burnout', fix: 'Rig workover: pulled tubing and installed replacement Centrilift ESP downhole unit', costMin: 28000, costMax: 48000, timeMin: 48, timeMax: 96 },
  { issue: 'Gas lift injection valve plugged', fix: 'Wireline intervention to retrieve and replace orifice valve', costMin: 3200, costMax: 6500, timeMin: 12, timeMax: 24 },
  { issue: 'PCP rotor elastomer delamination', fix: 'Replaced progressive cavity rotor and flushed sand debris', costMin: 8500, costMax: 16000, timeMin: 24, timeMax: 48 },
  { issue: 'Stuffing box packing leak', fix: 'Repacked packing gland with Kevlar rings and adjusted gland bolts', costMin: 850, costMax: 1800, timeMin: 4, timeMax: 10 },
  { issue: 'Flowline corrosion pinhole', fix: 'Installed steel enclosure sleeve and composite wrap', costMin: 2100, costMax: 4200, timeMin: 8, timeMax: 16 }
];

const technicians = ['Frank Miller', 'Sam Rodriguez', 'Dave Jenkins', 'Marcus Vance', 'Elena Rostova'];
let repairSeq = 1;

// Special known repairs:
repairs.push({
  repair_id: `REP-${String(repairSeq++).padStart(4, '0')}`,
  well_id: 'WELL-0012',
  date: '2024-06-25',
  issue: 'ESP motor trip / electrical burnout',
  fix: 'Rig workover: pulled tubing and installed replacement Centrilift ESP downhole unit',
  technician: 'Frank Miller',
  time_stopped_hours: 86.5,
  cost_usd: 39500,
  report_text: 'Well 12 tripped during heatwave. Downhole motor insulation failed. Rig crew mobilized on June 27. Replaced complete assembly. Required 86.5 hours of crew workover time.'
});

repairs.push({
  repair_id: `REP-${String(repairSeq++).padStart(4, '0')}`,
  well_id: 'WELL-0023',
  date: '2024-04-18',
  issue: 'Flowline corrosion pinhole',
  fix: 'Installed steel enclosure sleeve and composite wrap',
  technician: 'Sam Rodriguez',
  time_stopped_hours: 14.0,
  cost_usd: 5400,
  report_text: 'Pinhole leak on 3-inch high pressure flowline caused surface containment spray. Sleeve welded and pressure tested to 450 psi.'
});

// Generate ~800 more realistic repairs over 4 years
for (let r = 0; r < 800; r++) {
  const well = choice(wells);
  const iss = choice(issues);
  const repDate = new Date(startDate.getTime() + randRange(0, totalWeeks * 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  repairs.push({
    repair_id: `REP-${String(repairSeq++).padStart(4, '0')}`,
    well_id: well.well_id,
    date: repDate,
    issue: iss.issue,
    fix: iss.fix,
    technician: choice(technicians),
    time_stopped_hours: parseFloat(randRange(iss.timeMin, iss.timeMax).toFixed(1)),
    cost_usd: randInt(iss.costMin, iss.costMax),
    report_text: `Work order executed for ${well.well_id}. ${iss.fix}. System returned to readiness.`
  });
}

// 4. Regulator Events
const regulatorEvents = [
  {
    event_id: 'REG-0001',
    well_id: 'WELL-0023',
    date: '2024-05-02',
    event_type: 'Violation Notice & Fine',
    fine_usd: 25000,
    details: 'Civil Citation C-2024-88: Failure to provide mandatory 24-hour statutory notification for 8.5 bbl crude release on 2024-04-15 (reported on day 4).',
    citation_ref: 'EPA Region 6 / Rule 112.4'
  },
  {
    event_id: 'REG-0002',
    well_id: 'WELL-0104',
    date: '2023-09-19',
    event_type: 'Compliant Spill Notification',
    fine_usd: 0,
    details: 'Spill incident report submitted at 14:20 (5 hours after drone discovery). Remedial boom deployed. Audit confirmed timely compliance.',
    citation_ref: 'State Energy Commission Notice 2023-401'
  },
  {
    event_id: 'REG-0003',
    well_id: 'WELL-0045',
    date: '2024-06-15',
    event_type: 'Site Inspection Closed',
    fine_usd: 0,
    details: 'State inspector visited site following initial drone report. Verified field correction: ponding was non-hydrocarbon rainwater runoff. Incident record closed with zero citation.',
    citation_ref: 'Site Inspection Report SR-2024-912'
  },
  {
    event_id: 'REG-0004',
    well_id: 'WELL-0012',
    date: '2024-07-10',
    event_type: 'Workover Permit Approval',
    fine_usd: 0,
    details: 'Subsurface workover permit approved for ESP motor retrieval and electrical diagnostics.',
    citation_ref: 'Permit WO-2024-118'
  }
];

// Add 30 random routine site visits/compliance audits
for (let re = 5; re <= 35; re++) {
  const well = choice(wells);
  const evDate = new Date(startDate.getTime() + randRange(0, totalWeeks * 7) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  regulatorEvents.push({
    event_id: `REG-${String(re).padStart(4, '0')}`,
    well_id: well.well_id,
    date: evDate,
    event_type: 'Routine Environmental Audit',
    fine_usd: 0,
    details: `Standard quadrennial environmental compliance walk-through at ${well.well_id}. No uncontained hydrocarbons observed.`,
    citation_ref: 'Regional Field Audit Routine Log'
  });
}

// 5. Human Notes & Corrections (The Memory & Feedback baseline)
const humanNotes = [
  {
    note_id: 'NOTE-0001',
    well_id: 'WELL-0007',
    author: 'Alice Chen (Senior Operator)',
    date: '2024-05-28',
    note_type: 'Planned Shutdown',
    scope: 'WELL_INSTANCE',
    content: 'WELL-0007 is scheduled for planned surface valve replacement and reservoir pressure test starting June 1 through mid-July 2024. All thermal low-readings during this window are planned shut-in, not unexpected equipment failure.',
    tags: ['planned_maintenance', 'shut_in', 'summer_2024']
  },
  {
    note_id: 'NOTE-0002',
    well_id: 'WELL-0045',
    author: 'Bob Martinez (Field Operator)',
    date: '2024-06-11',
    note_type: 'Field Correction',
    scope: 'WELL_INSTANCE',
    target_inspection_id: 'INSP-035624',
    target_field: 'spill_volume_bbl',
    original_value: 6.4,
    corrected_value: 0.0,
    reason: 'Physical walk-through on June 11 confirmed dark patch was muddy rainwater puddle from thunderstorm, not oil. Containment soil samples 100% negative for crude.',
    content: 'Correction: The 6.4 bbl drone report on WELL-0045 was a mud puddle. Ground truth oil volume is 0.0 bbl.',
    tags: ['correction', 'spill_override', 'ground_truth']
  },
  {
    note_id: 'NOTE-0003',
    well_id: 'WELL-0088',
    author: 'Alice Chen (Senior Operator)',
    date: '2024-08-15',
    note_type: 'Operator Observation',
    scope: 'WELL_INSTANCE',
    content: 'Alice notes: WELL-0088 seemed to be humming normally and producing fine during my drive-by visual on Aug 12.',
    tags: ['conflict_observation']
  },
  {
    note_id: 'NOTE-0004',
    well_id: 'WELL-0088',
    author: 'Bob Martinez (Field Operator)',
    date: '2024-08-16',
    note_type: 'Dispute / Disagreement',
    scope: 'WELL_INSTANCE',
    content: 'Bob disagrees with Alice: WELL-0088 tripped its breaker on Aug 3 and was silent. The drive-by hum was likely neighboring pumpjack WELL-0089.',
    tags: ['conflict_disagreement', 'contradiction']
  },
  {
    note_id: 'NOTE-0005',
    well_id: 'ALL_TYPE_B',
    author: 'David Kim (Production Engineer)',
    date: '2024-01-10',
    note_type: 'Technical Calibration',
    scope: 'WELL_TYPE',
    target_type: 'Type B',
    target_field: 'delta_threshold_f',
    original_value: 18.0,
    corrected_value: 18.0,
    reason: 'Re-verified in winter bench tests that 18.0 deg F is optimal delta threshold across all Type B ESP installations.',
    content: 'All Type B ESP wells must strictly maintain 18.0 deg F delta above air temperature to be considered producing.',
    tags: ['well_type_rule', 'sop_calibration']
  }
];

// 6. Users List
const users = [
  { user_id: 'user_alice', name: 'Alice Chen', role: 'Senior Field Operator', area: 'West Valley & North Field' },
  { user_id: 'user_bob', name: 'Bob Martinez', role: 'Field Operator & Drone Pilot', area: 'South Basin' },
  { user_id: 'user_carol', name: 'Carol Danvers', role: 'Compliance & Regulatory Officer', area: 'Field-Wide' },
  { user_id: 'user_david', name: 'David Kim', role: 'Chief Production Engineer', area: 'Field-Wide' },
  { user_id: 'user_frank', name: 'Frank Miller', role: 'Lead Maintenance Technician', area: 'East Ridge & South Basin' }
];

// 7. Benchmark 18 Example Questions (matching hackathon requirements)
const testQuestions = [
  {
    id: 1,
    question: "Which wells in North Field were down the longest this summer (June to August 2024), and why?",
    category: "Aggregation & Cause Analysis",
    expected_visual: "bar_chart",
    expected_focus: "WELL-0012 downtime calculation (weekly inspection 7-day rule), citing repair logs and motor burnout."
  },
  {
    id: 2,
    question: "Is WELL-0007 currently producing oil or is it shut in? Show me its temperature trends.",
    category: "Status & Time Series",
    expected_visual: "line_chart",
    expected_focus: "Wellhead temp vs air temp, delta threshold comparison, and citing Alice Chen's planned maintenance note."
  },
  {
    id: 3,
    question: "Did we have any reportable spills over 5 barrels this year, and were any reported late to the regulator?",
    category: "Environmental Compliance",
    expected_visual: "table",
    expected_focus: "5.0 bbl / 24-hr rule in SOP-SPILL-ENV, cite WELL-0023 fine vs WELL-0045 puddle correction."
  },
  {
    id: 4,
    question: "Show the geographical distribution of all wells in South Basin colored by their operating status.",
    category: "Geospatial",
    expected_visual: "map",
    expected_focus: "Interactive map with pins for South Basin wells, color-coded by active vs stopped."
  },
  {
    id: 5,
    question: "Compare total downtime across all four areas by month for 2024 as a heatmap.",
    category: "Multi-dimensional Heatmap",
    expected_visual: "heatmap",
    expected_focus: "Area x Month 2D intensity grid showing where cumulative downtime concentrated."
  },
  {
    id: 6,
    question: "What is the rule for determining if a Type B well is producing oil? Cite the manual.",
    category: "SOP & Document Grounding",
    expected_visual: "status_card",
    expected_focus: "Cites SOP-ENG-TYPE-B-REV3, explaining ΔT >= 18.0°F rule."
  },
  {
    id: 7,
    question: "Show me a comparison of repair costs across maintenance teams in 2024 as a bar chart.",
    category: "Cost & Team Comparison",
    expected_visual: "bar_chart",
    expected_focus: "Aggregated repair costs grouped by team (Alpha, Bravo, Charlie, Delta)."
  },
  {
    id: 8,
    question: "What happened with the spill on WELL-0045 on June 10, 2024?",
    category: "Ground Truth Correction",
    expected_visual: "status_card",
    expected_focus: "Initial drone report was 6.4 bbl, superseded by Bob Martinez ground check (0 bbl puddle). Regulator inspection closed with 0 fine."
  },
  {
    id: 9,
    question: "Is there any contradiction or conflict regarding WELL-0088's status in August 2024?",
    category: "Conflict Detection & Honesty",
    expected_visual: "status_card",
    expected_focus: "Flags conflict: Alice reported normal operation, but Bob reported breaker trip, and sensor data shows wellhead at ambient air temp."
  },
  {
    id: 10,
    question: "List all wells with more than 35 days of downtime in 2024 as a table.",
    category: "Tabular Ranking",
    expected_visual: "table",
    expected_focus: "Downtime calculated strictly as 7 days per stopped inspection, sorted descending."
  },
  {
    id: 11,
    question: "What were the total regulatory fines paid in 2024 across the entire field?",
    category: "Regulatory Aggregation",
    expected_visual: "status_card",
    expected_focus: "Identifies $25,000 fine on WELL-0023 for late spill report, citing regulatory notice."
  },
  {
    id: 12,
    question: "Explain why repair duration hours differ from official downtime days.",
    category: "Domain Rule Clarification",
    expected_visual: "status_card",
    expected_focus: "Cites SOP-OPS-MAINT-REV2: Weekly inspections govern downtime (7 days/inspection), repair hours measure work duration."
  },
  {
    id: 13,
    question: "Show a status card for WELL-0012 with its latest inspection and active issues.",
    category: "Single Entity Status",
    expected_visual: "status_card",
    expected_focus: "Comprehensive status card with equipment, wellhead temp, ambient temp, delta T, and repair history."
  },
  {
    id: 14,
    question: "Show me all repairs performed by technician Frank Miller in 2024.",
    category: "Filtered List",
    expected_visual: "table",
    expected_focus: "Table of Frank Miller work orders, costs, and issue descriptions."
  },
  {
    id: 15,
    question: "How many total inspections were conducted in 2024, and how many were missed?",
    category: "Operational Audit",
    expected_visual: "status_card",
    expected_focus: "Counts total inspections vs expected (200 wells x 52 weeks = 10,400) and notes missed inspections add 0 downtime."
  },
  {
    id: 16,
    question: "Show the temperature profile of WELL-0033 over the last 6 months as a line chart.",
    category: "Time Series Visualization",
    expected_visual: "line_chart",
    expected_focus: "Line chart showing wellhead temp, air temp, and threshold boundary line."
  },
  {
    id: 17,
    question: "Which well type had the highest average downtime per well in 2024?",
    category: "Comparative Analysis",
    expected_visual: "bar_chart",
    expected_focus: "Average downtime days broken down by Type A, B, C, D."
  },
  {
    id: 18,
    question: "Recall the wells we discussed earlier in our conversation.",
    category: "Private User Memory",
    expected_visual: "table",
    expected_focus: "Recalls only the wells discussed in the current active user's session, isolated from other users."
  }
];

// Write all datasets to data/ folder
const dataDir = path.join(__dirname);
fs.writeFileSync(path.join(dataDir, 'wells.json'), JSON.stringify(wells, null, 2));
fs.writeFileSync(path.join(dataDir, 'inspections.json'), JSON.stringify(inspections, null, 2));
fs.writeFileSync(path.join(dataDir, 'repairs.json'), JSON.stringify(repairs, null, 2));
fs.writeFileSync(path.join(dataDir, 'regulator_events.json'), JSON.stringify(regulatorEvents, null, 2));
fs.writeFileSync(path.join(dataDir, 'human_notes.json'), JSON.stringify(humanNotes, null, 2));
fs.writeFileSync(path.join(dataDir, 'users.json'), JSON.stringify(users, null, 2));
fs.writeFileSync(path.join(dataDir, 'test_questions.json'), JSON.stringify(testQuestions, null, 2));

console.log(`Generation complete!`);
console.log(`- Wells: ${wells.length}`);
console.log(`- Inspections: ${inspections.length} (~${(inspections.length / 1000).toFixed(1)}k)`);
console.log(`- Repairs: ${repairs.length}`);
console.log(`- Regulator Events: ${regulatorEvents.length}`);
console.log(`- Human Notes: ${humanNotes.length}`);
console.log(`- Users: ${users.length}`);
console.log(`- Test Questions: ${testQuestions.length}`);
