// Domain rules engine strictly encoding oil field operational procedures and SOPs

const DEFAULT_THRESHOLDS = {
  'Type A': 15.0, // Beam Pumping Unit (SOP-ENG-TYPE-A-REV4)
  'Type B': 18.0, // Electric Submersible Pump (SOP-ENG-TYPE-B-REV3)
  'Type C': 12.0, // Gas Lift (SOP-ENG-TYPE-C-REV2)
  'Type D': 20.0  // Progressive Cavity Pump (SOP-ENG-TYPE-D-REV5)
};

const SOP_CITATIONS = {
  'Type A': { doc: 'SOP-ENG-TYPE-A-REV4', title: 'Beam Pumping Unit Standard Operating Procedure', rule: 'ΔT >= 15.0°F (8.33°C)' },
  'Type B': { doc: 'SOP-ENG-TYPE-B-REV3', title: 'Electric Submersible Pump SOP', rule: 'ΔT >= 18.0°F (10.0°C)' },
  'Type C': { doc: 'SOP-ENG-TYPE-C-REV2', title: 'Continuous Gas Lift SOP', rule: 'ΔT >= 12.0°F (6.67°C)' },
  'Type D': { doc: 'SOP-ENG-TYPE-D-REV5', title: 'Progressive Cavity Pump SOP', rule: 'ΔT >= 20.0°F (11.11°C)' },
  'SPILL': { doc: 'SOP-ENV-SPILL-COMPLIANCE-2024', title: 'Environmental Safety & Spill Compliance', rule: '>= 5.0 bbl must be reported within 24 hours. Human ground-truth correction strictly supersedes initial inspection.' },
  'MAINTENANCE': { doc: 'SOP-OPS-MAINT-REV2', title: 'Asset Repairs & Maintenance Accounting', rule: 'Official downtime comes strictly from weekly thermal inspections (7 days per stopped inspection), NOT repair workover duration.' }
};

/**
 * Returns the effective delta T threshold for a well, taking into account any type-level or well-level overrides
 */
function getEffectiveThreshold(well, overrides = []) {
  if (!well) return { threshold: 15.0, overridden: false };

  // 1. Check well-specific override
  const wellOverride = (overrides || []).find(o => o.scope === 'WELL_INSTANCE' && o.target_id === well.well_id && o.field === 'delta_threshold_f');
  if (wellOverride) return { threshold: Number(wellOverride.corrected_value), overridden: true, overrideInfo: wellOverride };

  // 2. Check well-type override
  const typeOverride = (overrides || []).find(o => o.scope === 'WELL_TYPE' && o.target_type === well.type && o.field === 'delta_threshold_f');
  if (typeOverride) return { threshold: Number(typeOverride.corrected_value), overridden: true, overrideInfo: typeOverride };

  // 3. Fallback to standard SOP threshold
  return { threshold: DEFAULT_THRESHOLDS[well.type] || 15.0, overridden: false };
}

/**
 * Determines whether a well is producing oil at an inspection instance
 */
function evaluateProductionStatus(inspection, well, overrides = []) {
  if (!inspection || !well) {
    return {
      is_producing: false,
      delta_t: 0,
      threshold: 15.0,
      status_label: 'Unknown',
      overridden: false,
      override_info: null
    };
  }

  const { threshold, overridden, overrideInfo } = getEffectiveThreshold(well, overrides);
  const deltaT = Number(((inspection.wellhead_temp_f || 0) - (inspection.ambient_temp_f || 0)).toFixed(1));
  const isProducing = deltaT >= threshold;

  return {
    is_producing: isProducing,
    delta_t: deltaT,
    threshold: threshold,
    status_label: isProducing ? 'Producing' : 'Stopped',
    overridden,
    override_info: overrideInfo
  };
}

/**
 * Computes downtime according to the domain rule:
 * - Each inspection where the well is stopped counts as 7 days (1 week).
 * - Consecutive stopped inspections accrue 14, 21, etc.
 * - Missed inspections add 0 downtime.
 */
function computeDowntime(inspections, well, overrides = [], dateFilter = null) {
  if (!well || !inspections) {
    return {
      well_id: well ? well.well_id : 'UNKNOWN',
      well_name: 'Unknown',
      well_type: 'Unknown',
      area: 'Unknown',
      team: 'Unknown',
      stopped_inspections: 0,
      producing_inspections: 0,
      total_inspections: 0,
      downtime_days: 0,
      downtime_weeks: 0,
      inspection_history: []
    };
  }

  let relevantInspections = inspections.filter(i => i.well_id === well.well_id);
  
  if (dateFilter) {
    if (dateFilter.startDate) {
      relevantInspections = relevantInspections.filter(i => i.date >= dateFilter.startDate);
    }
    if (dateFilter.endDate) {
      relevantInspections = relevantInspections.filter(i => i.date <= dateFilter.endDate);
    }
  }

  // Sort chronologically
  relevantInspections.sort((a, b) => new Date(a.date) - new Date(b.date));

  let stoppedInspectionsCount = 0;
  let producingInspectionsCount = 0;
  const inspectionHistory = [];

  for (const insp of relevantInspections) {
    const evalResult = evaluateProductionStatus(insp, well, overrides);
    if (!evalResult.is_producing) {
      stoppedInspectionsCount++;
    } else {
      producingInspectionsCount++;
    }
    inspectionHistory.push({
      date: insp.date,
      ambient: insp.ambient_temp_f,
      wellhead: insp.wellhead_temp_f,
      delta: evalResult.delta_t,
      producing: evalResult.is_producing
    });
  }

  const downtimeDays = stoppedInspectionsCount * 7;
  const totalWeeksObserved = relevantInspections.length;

  return {
    well_id: well.well_id,
    well_name: well.name,
    well_type: well.type,
    area: well.area,
    team: well.team,
    stopped_inspections: stoppedInspectionsCount,
    producing_inspections: producingInspectionsCount,
    total_inspections: totalWeeksObserved,
    downtime_days: downtimeDays,
    downtime_weeks: stoppedInspectionsCount,
    inspection_history: inspectionHistory
  };
}

/**
 * Resolves spill volume with human corrections ("correction wins rule")
 */
function resolveSpillVolume(inspection, overrides = [], notes = []) {
  if (!inspection) {
    return { volume_bbl: 0, is_corrected: false, original_volume: 0 };
  }

  // Check direct override in ledger (support matching by target_inspection_id, or by well_id with optional date)
  const directOverride = (overrides || []).find(o => 
    (o.target_inspection_id === inspection.inspection_id || 
     (o.target_id === inspection.well_id && (!o.target_date || o.target_date === inspection.date))) &&
    o.field === 'spill_volume_bbl'
  );

  if (directOverride) {
    return {
      volume_bbl: Number(directOverride.corrected_value),
      is_corrected: true,
      original_volume: directOverride.original_value,
      author: directOverride.author,
      reason: directOverride.reason
    };
  }

  // Check notes for ground-truth field corrections
  const matchingNote = (notes || []).find(n => 
    n.well_id === inspection.well_id && 
    n.note_type === 'Field Correction' &&
    (n.target_inspection_id === inspection.inspection_id || n.target_field === 'spill_volume_bbl')
  );

  if (matchingNote && matchingNote.corrected_value !== undefined) {
    return {
      volume_bbl: Number(matchingNote.corrected_value),
      is_corrected: true,
      original_volume: matchingNote.original_value,
      author: matchingNote.author,
      reason: matchingNote.reason
    };
  }

  return {
    volume_bbl: inspection.spill_volume_bbl || 0.0,
    is_corrected: false,
    original_volume: inspection.spill_volume_bbl || 0.0
  };
}

module.exports = {
  DEFAULT_THRESHOLDS,
  SOP_CITATIONS,
  getEffectiveThreshold,
  evaluateProductionStatus,
  computeDowntime,
  resolveSpillVolume
};
