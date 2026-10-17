const fs = require('fs');
const path = require('path');

class MemoryManager {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.overridesPath = path.join(dataDir, 'overrides_ledger.json');
    this.sharedNotesPath = path.join(dataDir, 'human_notes.json');
    
    // In-memory private session store: userId -> { recentWells: Set, messages: [] }
    this.userSessions = new Map();
    
    // Load overrides ledger
    this.overrides = this.loadOverrides();
  }

  loadOverrides() {
    if (fs.existsSync(this.overridesPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.overridesPath, 'utf8'));
      } catch (e) {
        console.error('Error loading overrides ledger, resetting:', e);
      }
    }
    // Pre-populate with baseline corrections from initial notes
    const defaultOverrides = [
      {
        override_id: 'OVR-0001',
        scope: 'WELL_INSTANCE',
        target_id: 'WELL-0045',
        target_inspection_id: 'INSP-035624',
        target_date: '2024-06-10',
        field: 'spill_volume_bbl',
        original_value: 6.4,
        corrected_value: 0.0,
        author: 'Bob Martinez (Field Operator)',
        reason: 'Ground truth verification confirmed dark patch was non-hydrocarbon rainwater puddle. Soil samples negative.',
        timestamp: '2024-06-11T14:30:00Z'
      }
    ];
    this.saveOverrides(defaultOverrides);
    return defaultOverrides;
  }

  saveOverrides(overrides) {
    this.overrides = overrides;
    try {
      fs.writeFileSync(this.overridesPath, JSON.stringify(this.overrides, null, 2));
    } catch (e) {
      console.error('Failed to persist overrides ledger:', e);
    }
  }

  getOverrides() {
    return this.overrides;
  }

  /**
   * Adds a user correction / feedback entry
   */
  addOverride(entry) {
    const override = {
      override_id: `OVR-${String(this.overrides.length + 1).padStart(4, '0')}`,
      scope: entry.scope || 'WELL_INSTANCE', // 'WELL_INSTANCE' or 'WELL_TYPE'
      target_id: entry.target_id || null, // e.g. 'WELL-0012'
      target_type: entry.target_type || null, // e.g. 'Type B'
      target_inspection_id: entry.target_inspection_id || null,
      target_date: entry.target_date || null,
      field: entry.field,
      original_value: entry.original_value,
      corrected_value: entry.corrected_value,
      author: entry.author || 'Anonymous Operator',
      reason: entry.reason || 'User correction via Copilot feedback',
      timestamp: new Date().toISOString()
    };

    this.overrides.unshift(override);
    this.saveOverrides(this.overrides);
    return override;
  }

  /**
   * Shared Knowledge: Retrieves all global notes, planned maintenance, and observations for a well
   */
  getSharedWellKnowledge(wellId, allNotes = []) {
    const directNotes = allNotes.filter(n => n.well_id === wellId);
    const overrides = this.overrides.filter(o => o.target_id === wellId);
    return {
      well_id: wellId,
      notes: directNotes,
      overrides: overrides
    };
  }

  /**
   * Private Memory: Track conversation and mentioned assets for a specific user
   */
  recordUserInteraction(userId, query, responsePayload, referencedWells = []) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        discussedWells: new Set(),
        history: []
      });
    }

    const session = this.userSessions.get(userId);
    referencedWells.forEach(w => session.discussedWells.add(w));
    
    session.history.push({
      timestamp: new Date().toISOString(),
      query: query,
      visual_type: responsePayload.visual_type,
      referencedWells: [...referencedWells]
    });

    // Keep history bounded to last 50 turns
    if (session.history.length > 50) {
      session.history.shift();
    }
  }

  /**
   * Retrieves private session data for a user
   */
  getUserSession(userId) {
    if (!this.userSessions.has(userId)) {
      return {
        discussedWells: [],
        history: []
      };
    }
    const session = this.userSessions.get(userId);
    return {
      discussedWells: Array.from(session.discussedWells),
      history: session.history
    };
  }

  clearUserSession(userId) {
    this.userSessions.delete(userId);
  }
}

module.exports = MemoryManager;
