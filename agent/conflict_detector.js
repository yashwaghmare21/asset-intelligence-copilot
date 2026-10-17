/**
 * Conflict Detector
 * Identifies contradictions between:
 * 1. Human claims vs Sensor/Inspection telemetry
 * 2. User vs User disagreements
 * 3. Raw sensor reports vs Ground-truth corrections
 */

function detectConflictsForWell(wellId, well, inspections = [], notes = [], overrides = []) {
  const conflicts = [];
  if (!wellId || !well) return conflicts;

  // Filter relevant items for this well
  const wellNotes = (notes || []).filter(n => n.well_id === wellId);
  const wellInspections = (inspections || []).filter(i => i.well_id === wellId);
  const wellOverrides = (overrides || []).filter(o => o.target_id === wellId);

  // 1. Detect User vs User Disagreements
  const disputeNotes = wellNotes.filter(n => n.note_type === 'Dispute / Disagreement' || (n.tags && n.tags.includes('conflict_disagreement')));
  if (disputeNotes.length > 0) {
    disputeNotes.forEach(dn => {
      const relatedNote = wellNotes.find(n => n.note_id !== dn.note_id && (n.tags && n.tags.includes('conflict_observation')));
      conflicts.push({
        type: 'USER_DISAGREEMENT',
        severity: 'HIGH',
        title: `Conflicting Operator Reports for ${wellId}`,
        description: `Disagreement between operators: ${dn.author} recorded: "${dn.content}". Meanwhile, ${relatedNote ? relatedNote.author : 'another operator'} reported: "${relatedNote ? relatedNote.content : 'normal operation'}".`,
        parties: [dn.author, relatedNote ? relatedNote.author : 'Field Team'],
        recommendation: 'Physical dispatch requested to verify breaker status and equipment vibration.'
      });
    });
  }

  // 2. Detect Human Claim vs Sensor Telemetry
  wellNotes.forEach(note => {
    if (note.content && (note.content.toLowerCase().includes('humming') || note.content.toLowerCase().includes('producing fine') || note.content.toLowerCase().includes('operational'))) {
      const noteDate = new Date(note.date);
      const nearbyInspections = wellInspections.filter(i => {
        const d = new Date(i.date);
        return Math.abs(d - noteDate) <= 14 * 24 * 60 * 60 * 1000;
      });

      const stoppedSensors = nearbyInspections.filter(i => (i.wellhead_temp_f - i.ambient_temp_f) < well.delta_threshold_f);
      if (stoppedSensors.length > 0) {
        conflicts.push({
          type: 'SENSOR_VS_NOTE',
          severity: 'CRITICAL',
          title: `Sensor Telemetry Contradicts Operator Note (${wellId})`,
          description: `${note.author} noted the asset was operational on ${note.date}, but weekly FLIR telemetry on ${stoppedSensors[0].date} shows wellhead at ${stoppedSensors[0].wellhead_temp_f}°F vs ambient ${stoppedSensors[0].ambient_temp_f}°F (ΔT = ${(stoppedSensors[0].wellhead_temp_f - stoppedSensors[0].ambient_temp_f).toFixed(1)}°F, below the ${well.delta_threshold_f}°F threshold for ${well.type}).`,
          evidence: {
            sensor_delta: (stoppedSensors[0].wellhead_temp_f - stoppedSensors[0].ambient_temp_f).toFixed(1),
            required_delta: well.delta_threshold_f,
            sensor_date: stoppedSensors[0].date
          }
        });
      }
    }
  });

  // 3. Detect Raw Inspection vs Verified Correction
  wellOverrides.forEach(ovr => {
    if (ovr.field === 'spill_volume_bbl' && ovr.original_value > 0 && ovr.corrected_value === 0) {
      conflicts.push({
        type: 'CORRECTION_OVERRIDE',
        severity: 'MEDIUM',
        title: `Inspection Record Overridden by Ground Truth (${wellId})`,
        description: `Initial drone report logged ${ovr.original_value} bbl spill on ${ovr.target_date || 'date'}, but verified by ${ovr.author} as "${ovr.reason}". Official volume corrected to ${ovr.corrected_value} bbl.`,
        author: ovr.author,
        original_value: ovr.original_value,
        corrected_value: ovr.corrected_value
      });
    }
  });

  return conflicts;
}

module.exports = {
  detectConflictsForWell
};
