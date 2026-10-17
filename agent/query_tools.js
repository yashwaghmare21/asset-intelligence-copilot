const fs = require('fs');
const path = require('path');
const { computeDowntime, evaluateProductionStatus, resolveSpillVolume, getEffectiveThreshold, SOP_CITATIONS } = require('./domain_rules');

class QueryTools {
  constructor(data, manualsDir) {
    this.wells = data.wells;
    this.inspections = data.inspections;
    this.repairs = data.repairs;
    this.regulatorEvents = data.regulatorEvents;
    this.humanNotes = data.humanNotes;
    this.manualsDir = manualsDir;
    
    // Quick index lookups
    this.wellMap = new Map();
    this.wells.forEach(w => this.wellMap.set(w.well_id, w));

    // Load manuals into memory for fast RAG search
    this.manuals = this.loadManuals();
  }

  loadManuals() {
    const docs = [];
    if (fs.existsSync(this.manualsDir)) {
      const files = fs.readdirSync(this.manualsDir);
      files.forEach(f => {
        if (f.endsWith('.md') || f.endsWith('.txt')) {
          const content = fs.readFileSync(path.join(this.manualsDir, f), 'utf8');
          docs.push({
            filename: f,
            title: f.replace('.md', ''),
            content: content
          });
        }
      });
    }
    return docs;
  }

  /**
   * Comprehensive single well summary (status card generator)
   */
  getWellSummary(wellId, overrides = []) {
    const well = this.wellMap.get(wellId);
    if (!well) return null;

    const wellInspections = this.inspections
      .filter(i => i.well_id === wellId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const latestInspection = wellInspections[0] || null;
    let currentStatus = 'Unknown';
    let latestEval = null;

    if (latestInspection) {
      latestEval = evaluateProductionStatus(latestInspection, well, overrides);
      currentStatus = latestEval.is_producing ? 'Producing' : 'Stopped';
    }

    // Planned shut in check from shared notes
    const plannedNotes = this.humanNotes.filter(n => n.well_id === wellId && (n.note_type === 'Planned Shutdown' || (n.tags && n.tags.includes('shut_in'))));
    const isShutIn = plannedNotes.length > 0;
    if (isShutIn && currentStatus === 'Stopped') {
      currentStatus = 'Shut In (Planned Maintenance)';
    }

    // Calculate year-to-date or 2024 downtime
    const dt2024 = computeDowntime(this.inspections, well, overrides, { startDate: '2024-01-01', endDate: '2024-12-31' });

    // Recent repairs
    const wellRepairs = this.repairs
      .filter(r => r.well_id === wellId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    // Regulator citations
    const wellRegEvents = this.regulatorEvents.filter(r => r.well_id === wellId);

    // Spills
    const spills = wellInspections
      .filter(i => i.spill_found || i.spill_volume_bbl > 0)
      .map(i => {
        const resolved = resolveSpillVolume(i, overrides, this.humanNotes);
        return {
          date: i.date,
          volume_bbl: resolved.volume_bbl,
          original_volume: resolved.original_volume,
          is_corrected: resolved.is_corrected,
          reason: resolved.reason
        };
      });

    const sopInfo = SOP_CITATIONS[well.type] || { doc: 'Field Operating Manual', rule: `Standard production threshold` };

    return {
      well_id: well.well_id,
      name: well.name,
      type: well.type,
      type_name: well.type_name,
      area: well.area,
      team: well.team,
      equipment: well.equipment,
      latitude: well.latitude,
      longitude: well.longitude,
      current_status: currentStatus,
      is_shut_in: isShutIn,
      latest_inspection: latestInspection ? {
        date: latestInspection.date,
        ambient_temp_f: latestInspection.ambient_temp_f,
        wellhead_temp_f: latestInspection.wellhead_temp_f,
        delta_t: latestEval ? latestEval.delta_t : 0,
        threshold: latestEval ? latestEval.threshold : well.delta_threshold_f,
        photo_reference: latestInspection.photo_reference,
        inspector_method: latestInspection.inspector_method
      } : null,
      downtime_2024_days: dt2024.downtime_days,
      downtime_2024_weeks: dt2024.downtime_weeks,
      repairs_count: wellRepairs.length,
      total_repair_cost_usd: wellRepairs.reduce((acc, r) => acc + (r.cost_usd || 0), 0),
      recent_repairs: wellRepairs.slice(0, 3),
      regulator_events: wellRegEvents,
      spills: spills,
      sop_citation: sopInfo
    };
  }

  /**
   * Top downtime wells ranking (for bar chart or table)
   */
  getTopDowntimeWells(filters = {}, overrides = []) {
    const { area, startDate, endDate, limit = 10, minDowntime = 0 } = filters;

    let targetWells = this.wells;
    if (area && area !== 'All') {
      targetWells = targetWells.filter(w => w.area.toLowerCase() === area.toLowerCase());
    }

    const results = [];
    for (const well of targetWells) {
      const dt = computeDowntime(this.inspections, well, overrides, { startDate, endDate });
      if (dt.downtime_days >= minDowntime) {
        // Find most frequent / prominent repair issue for "why"
        const wellRepairs = this.repairs
          .filter(r => r.well_id === well.well_id && (!startDate || r.date >= startDate) && (!endDate || r.date <= endDate));
        
        let primaryReason = 'Thermal cooldown / stopped flow';
        if (wellRepairs.length > 0) {
          primaryReason = wellRepairs[0].issue;
        }

        // Check if planned shut in
        const shutInNote = this.humanNotes.find(n => n.well_id === well.well_id && (n.note_type === 'Planned Shutdown' || (n.tags && n.tags.includes('shut_in'))));
        if (shutInNote) {
          primaryReason = `Planned Maintenance: ${shutInNote.content.slice(0, 60)}...`;
        }

        results.push({
          well_id: well.well_id,
          name: well.name,
          type: well.type,
          area: well.area,
          team: well.team,
          downtime_days: dt.downtime_days,
          downtime_weeks: dt.downtime_weeks,
          stopped_inspections: dt.stopped_inspections,
          total_inspections: dt.total_inspections,
          primary_reason: primaryReason,
          recent_repair: wellRepairs[0] || null
        });
      }
    }

    results.sort((a, b) => b.downtime_days - a.downtime_days);
    return results.slice(0, limit);
  }

  /**
   * Temperature time series for line chart
   */
  getTemperatureTimeSeries(wellId, startDate = null, endDate = null, overrides = []) {
    const well = this.wellMap.get(wellId);
    if (!well) return null;

    let relevant = this.inspections.filter(i => i.well_id === wellId);
    if (startDate) relevant = relevant.filter(i => i.date >= startDate);
    if (endDate) relevant = relevant.filter(i => i.date <= endDate);

    relevant.sort((a, b) => new Date(a.date) - new Date(b.date));

    const thresholdInfo = getEffectiveThreshold(well, overrides);

    const labels = [];
    const wellheadTemps = [];
    const ambientTemps = [];
    const deltaTemps = [];
    const thresholdLine = [];
    const statusPoints = [];

    relevant.forEach(i => {
      const evalRes = evaluateProductionStatus(i, well, overrides);
      labels.push(i.date);
      wellheadTemps.push(i.wellhead_temp_f);
      ambientTemps.push(i.ambient_temp_f);
      deltaTemps.push(evalRes.delta_t);
      thresholdLine.push(thresholdInfo.threshold);
      statusPoints.push(evalRes.is_producing ? 'Producing' : 'Stopped');
    });

    return {
      well_id: well.well_id,
      well_name: well.name,
      well_type: well.type,
      threshold: thresholdInfo.threshold,
      is_threshold_overridden: thresholdInfo.overridden,
      labels,
      series: {
        wellhead: wellheadTemps,
        ambient: ambientTemps,
        delta: deltaTemps,
        threshold: thresholdLine,
        status: statusPoints
      }
    };
  }

  /**
   * Heatmap Data: Area x Month downtime matrix
   */
  getDowntimeHeatmap(year = 2024, overrides = []) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const areas = ['North Field', 'South Basin', 'East Ridge', 'West Valley'];

    // Matrix: area -> monthIndex -> downtime_days
    const matrix = {};
    areas.forEach(a => {
      matrix[a] = new Array(12).fill(0);
    });

    this.wells.forEach(well => {
      const wellInsps = this.inspections.filter(i => i.well_id === well.well_id && i.date.startsWith(String(year)));
      wellInsps.forEach(insp => {
        const evalRes = evaluateProductionStatus(insp, well, overrides);
        if (!evalRes.is_producing) {
          const monthIdx = new Date(insp.date).getUTCMonth();
          if (matrix[well.area]) {
            matrix[well.area][monthIdx] += 7; // 7 days per stopped inspection
          }
        }
      });
    });

    return {
      year,
      x_labels: months,
      y_labels: areas,
      matrix: matrix
    };
  }

  /**
   * Environmental Spill and Compliance summary
   */
  getSpillsAndCompliance(year = 2024, overrides = []) {
    const spills = [];
    const datePrefix = String(year);

    this.inspections.forEach(insp => {
      if (insp.date.startsWith(datePrefix) && (insp.spill_found || insp.spill_volume_bbl > 0)) {
        const well = this.wellMap.get(insp.well_id);
        const resolved = resolveSpillVolume(insp, overrides, this.humanNotes);
        
        // Find if a regulatory event exists for this spill
        const regEvent = this.regulatorEvents.find(re => re.well_id === insp.well_id && Math.abs(new Date(re.date) - new Date(insp.date)) <= 30 * 24 * 60 * 60 * 1000);

        const isReportable = resolved.volume_bbl >= 5.0;
        let complianceStatus = 'Compliant';
        if (isReportable) {
          if (regEvent && regEvent.event_type.includes('Violation')) {
            complianceStatus = 'Late Reported / Violation';
          } else if (regEvent) {
            complianceStatus = 'Reported within 24h';
          } else {
            complianceStatus = 'Under Investigation';
          }
        } else {
          complianceStatus = resolved.is_corrected ? 'Reclassified (Mud Puddle)' : 'Minor (<5 bbl) Contained';
        }

        spills.push({
          well_id: insp.well_id,
          well_name: well ? well.name : insp.well_id,
          area: well ? well.area : 'Unknown',
          date: insp.date,
          original_volume_bbl: resolved.original_volume,
          effective_volume_bbl: resolved.volume_bbl,
          is_corrected: resolved.is_corrected,
          correction_reason: resolved.reason,
          correction_author: resolved.author,
          is_reportable: isReportable,
          compliance_status: complianceStatus,
          regulator_event: regEvent || null
        });
      }
    });

    // Also get fines total
    const totalFines = this.regulatorEvents
      .filter(re => re.date.startsWith(datePrefix))
      .reduce((acc, re) => acc + (re.fine_usd || 0), 0);

    return {
      year,
      spill_count: spills.length,
      reportable_spill_count: spills.filter(s => s.effective_volume_bbl >= 5.0).length,
      total_fines_usd: totalFines,
      spills,
      sop_citation: SOP_CITATIONS.SPILL
    };
  }

  /**
   * Repair cost analytics by Team or Technician
   */
  getRepairAnalytics(year = 2024, groupBy = 'team') {
    const yearRepairs = this.repairs.filter(r => r.date.startsWith(String(year)));
    const grouped = {};

    yearRepairs.forEach(rep => {
      const well = this.wellMap.get(rep.well_id);
      let key = 'Other';
      if (groupBy === 'team') {
        key = well ? well.team : 'Unknown Team';
      } else if (groupBy === 'technician') {
        key = rep.technician || 'Unknown';
      } else if (groupBy === 'issue') {
        key = rep.issue;
      }

      if (!grouped[key]) {
        grouped[key] = { count: 0, total_cost: 0, total_hours: 0, repairs: [] };
      }
      grouped[key].count++;
      grouped[key].total_cost += (rep.cost_usd || 0);
      grouped[key].total_hours += (rep.time_stopped_hours || 0);
      grouped[key].repairs.push(rep);
    });

    const categories = Object.keys(grouped);
    const costs = categories.map(k => grouped[k].total_cost);
    const counts = categories.map(k => grouped[k].count);

    return {
      year,
      grouped_by: groupBy,
      categories,
      costs,
      counts,
      data: grouped,
      total_field_cost: costs.reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Geospatial wells coordinates & statuses for Map visual
   */
  getGeospatialWells(area = null, overrides = []) {
    let target = this.wells;
    if (area && area !== 'All') {
      target = target.filter(w => w.area.toLowerCase() === area.toLowerCase());
    }

    return target.map(well => {
      const wellInsps = this.inspections.filter(i => i.well_id === well.well_id);
      const latest = wellInsps[wellInsps.length - 1];
      let status = 'Producing';
      if (latest) {
        const ev = evaluateProductionStatus(latest, well, overrides);
        status = ev.is_producing ? 'Producing' : 'Stopped';
      }
      return {
        well_id: well.well_id,
        name: well.name,
        type: well.type,
        area: well.area,
        team: well.team,
        latitude: well.latitude,
        longitude: well.longitude,
        status: status,
        equipment: well.equipment
      };
    });
  }

  /**
   * SOP / Manual Search (Semantic & Keyword RAG)
   */
  searchManuals(query) {
    const qLower = query.toLowerCase();
    const hits = [];

    this.manuals.forEach(doc => {
      const contentLower = doc.content.toLowerCase();
      let score = 0;
      const terms = qLower.split(/\s+/).filter(t => t.length > 2);
      
      terms.forEach(t => {
        if (contentLower.includes(t)) score += 1;
      });

      if (qLower.includes('type b') && doc.filename.includes('TYPE-B')) score += 10;
      if (qLower.includes('type a') && doc.filename.includes('TYPE-A')) score += 10;
      if (qLower.includes('type c') && doc.filename.includes('TYPE-C')) score += 10;
      if (qLower.includes('type d') && doc.filename.includes('TYPE-D')) score += 10;
      if ((qLower.includes('spill') || qLower.includes('barrel') || qLower.includes('regulator')) && doc.filename.includes('SPILL')) score += 10;
      if ((qLower.includes('repair') || qLower.includes('downtime')) && doc.filename.includes('MAINT')) score += 10;

      if (score > 0) {
        // Extract most relevant snippet
        const lines = doc.content.split('\n');
        const matchingLines = lines.filter(l => terms.some(t => l.toLowerCase().includes(t)));
        hits.push({
          filename: doc.filename,
          title: doc.title,
          score,
          snippet: matchingLines.slice(0, 5).join('\n') || doc.content.slice(0, 300)
        });
      }
    });

    hits.sort((a, b) => b.score - a.score);
    return hits;
  }
}

module.exports = QueryTools;
