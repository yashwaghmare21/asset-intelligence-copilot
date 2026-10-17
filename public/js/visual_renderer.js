/**
 * Visual Renderer for Generative UI
 * Inline components: Status Card, Table, Line Chart, Bar Chart, Map, Heatmap
 */

const VisualRenderer = {
  
  // 1. Status Card Component
  renderStatusCard(container, data) {
    if (!data) return;
    const cardEl = document.createElement('div');
    cardEl.className = 'status-card';

    const isProducing = data.current_status && data.current_status.toLowerCase().includes('producing');
    const statusClass = isProducing ? 'producing' : (data.is_shut_in ? 'shut-in' : 'stopped');

    const wellIdSafe = escapeAttr(data.well_id || 'WELL-0001');
    const wellTypeSafe = escapeAttr(data.type || 'Type A');

    cardEl.innerHTML = `
      <div class="status-card-header">
        <div class="card-title-group">
          <h4>${escapeHtml(data.well_id || 'ASSET SUMMARY')} ${data.name ? `· ${escapeHtml(data.name)}` : ''}</h4>
          <span class="card-subtitle">${escapeHtml(data.area || 'Field Wide')} · ${escapeHtml(data.team || 'All Teams')} · ${escapeHtml(data.equipment || 'Production Lift')}</span>
        </div>
        <span class="status-badge ${statusClass}">${escapeHtml(data.current_status || 'Active')}</span>
      </div>

      <div class="telemetry-grid">
        ${data.latest_inspection ? `
          <div class="telemetry-box">
            <span class="telemetry-label">Wellhead Temp</span>
            <span class="telemetry-val highlight-cyan">${data.latest_inspection.wellhead_temp_f}°F</span>
          </div>
          <div class="telemetry-box">
            <span class="telemetry-label">Ambient Air</span>
            <span class="telemetry-val">${data.latest_inspection.ambient_temp_f}°F</span>
          </div>
          <div class="telemetry-box">
            <span class="telemetry-label">Delta (ΔT)</span>
            <span class="telemetry-val ${data.latest_inspection.delta_t >= data.latest_inspection.threshold ? 'highlight-emerald' : 'highlight-amber'}">${data.latest_inspection.delta_t}°F</span>
          </div>
          <div class="telemetry-box">
            <span class="telemetry-label">SOP Threshold</span>
            <span class="telemetry-val">${data.latest_inspection.threshold}°F</span>
          </div>
        ` : ''}
        <div class="telemetry-box">
          <span class="telemetry-label">2024 Downtime</span>
          <span class="telemetry-val highlight-amber">${data.downtime_2024_days !== undefined ? data.downtime_2024_days + ' days' : 'N/A'}</span>
        </div>
        <div class="telemetry-box">
          <span class="telemetry-label">Total Repairs</span>
          <span class="telemetry-val">${data.repairs_count !== undefined ? data.repairs_count : 'N/A'}</span>
        </div>
      </div>

      <div class="card-actions-bar">
        <span style="font-size: 0.72rem; color: var(--text-dim);">
          ${data.sop_citation ? `📖 SOP Reference: <strong>${escapeHtml(data.sop_citation.doc || '')}</strong>` : 'Verified Field Telemetry'}
        </span>
        <button class="btn-correction" onclick="openCorrectionModal('${wellIdSafe}', '${wellTypeSafe}')">
          ✏️ Correct Data
        </button>
      </div>
    `;

    container.appendChild(cardEl);
  },

  // 2. Interactive Data Table Component
  renderTable(container, data) {
    if (!data || !data.headers) return;
    const wrap = document.createElement('div');
    wrap.className = 'table-responsive';

    let tableHtml = `<table class="gen-table"><thead><tr>`;
    data.headers.forEach(h => {
      tableHtml += `<th>${escapeHtml(h)}</th>`;
    });
    tableHtml += `</tr></thead><tbody>`;

    if (!data.rows || data.rows.length === 0) {
      tableHtml += `<tr><td colspan="${data.headers.length}" style="text-align:center; padding: 24px; color: var(--text-dim);">No matching records found.</td></tr>`;
    } else {
      data.rows.forEach(row => {
        tableHtml += `<tr>`;
        data.headers.forEach(h => {
          const val = row[h] !== undefined ? row[h] : '';
          tableHtml += `<td>${escapeHtml(String(val))}</td>`;
        });
        tableHtml += `</tr>`;
      });
    }

    tableHtml += `</tbody></table>`;
    wrap.innerHTML = tableHtml;
    container.appendChild(wrap);
  },

  // 3. Line Chart Component
  renderLineChart(container, data) {
    if (!data || !data.labels || !data.series) return;
    const chartWrap = document.createElement('div');
    chartWrap.className = 'chart-wrapper';
    const canvasId = 'chart-' + Math.random().toString(36).substring(2, 9);
    chartWrap.innerHTML = `<canvas id="${canvasId}"></canvas>`;
    container.appendChild(chartWrap);

    setTimeout(() => {
      if (typeof Chart === 'undefined') {
        chartWrap.innerHTML = `<div style="padding: 20px; color: var(--text-muted); text-align: center;">Chart library initializing...</div>`;
        return;
      }
      const canvasEl = document.getElementById(canvasId);
      if (!canvasEl) return;
      const ctx = canvasEl.getContext('2d');
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: data.labels,
          datasets: [
            {
              label: 'Wellhead Temp (°F)',
              data: data.series.wellhead,
              borderColor: '#06b6d4',
              backgroundColor: 'rgba(6, 182, 212, 0.1)',
              borderWidth: 2.5,
              tension: 0.3,
              fill: false
            },
            {
              label: 'Ambient Air Temp (°F)',
              data: data.series.ambient,
              borderColor: '#94a3b8',
              borderWidth: 1.5,
              borderDash: [4, 4],
              tension: 0.3,
              fill: false
            },
            {
              label: `SOP Threshold (${data.threshold}°F)`,
              data: data.series.threshold,
              borderColor: '#f59e0b',
              borderWidth: 2,
              borderDash: [6, 6],
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }
            },
            title: {
              display: true,
              text: `${data.well_id || 'Well'} Temperature Profile vs SOP Production Threshold`,
              color: '#fff',
              font: { family: 'Outfit', size: 13, weight: 'bold' }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#64748b', maxRotation: 45, maxTicksLimit: 12 }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#64748b' }
            }
          }
        }
      });
    }, 60);
  },

  // 4. Bar Chart Component
  renderBarChart(container, data) {
    if (!data || !data.labels || !data.values) return;
    const chartWrap = document.createElement('div');
    chartWrap.className = 'chart-wrapper';
    const canvasId = 'chart-' + Math.random().toString(36).substring(2, 9);
    chartWrap.innerHTML = `<canvas id="${canvasId}"></canvas>`;
    container.appendChild(chartWrap);

    setTimeout(() => {
      if (typeof Chart === 'undefined') {
        chartWrap.innerHTML = `<div style="padding: 20px; color: var(--text-muted); text-align: center;">Chart library initializing...</div>`;
        return;
      }
      const canvasEl = document.getElementById(canvasId);
      if (!canvasEl) return;
      const ctx = canvasEl.getContext('2d');
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: data.labels,
          datasets: [{
            label: data.title || 'Value',
            data: data.values,
            backgroundColor: 'rgba(6, 182, 212, 0.65)',
            borderColor: '#06b6d4',
            borderWidth: 1.5,
            borderRadius: 6
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: data.title || 'Operational Comparison',
              color: '#fff',
              font: { family: 'Outfit', size: 13, weight: 'bold' }
            },
            tooltip: {
              callbacks: {
                afterLabel: function(context) {
                  if (data.reasons && data.reasons[context.dataIndex]) {
                    return 'Cause: ' + data.reasons[context.dataIndex];
                  }
                  return '';
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }
            },
            y: {
              grid: { color: 'rgba(255, 255, 255, 0.05)' },
              ticks: { color: '#94a3b8' }
            }
          }
        }
      });
    }, 60);
  },

  // 5. Leaflet Geospatial Map Component
  renderMap(container, data) {
    if (!data || !data.wells) return;
    const mapWrap = document.createElement('div');
    mapWrap.className = 'map-wrapper';
    const mapId = 'map-' + Math.random().toString(36).substring(2, 9);
    mapWrap.id = mapId;
    container.appendChild(mapWrap);

    setTimeout(() => {
      if (typeof L === 'undefined') {
        mapWrap.innerHTML = `<div style="padding: 30px; color: var(--text-muted); text-align: center;">Geospatial map library initializing...</div>`;
        return;
      }
      const mapEl = document.getElementById(mapId);
      if (!mapEl) return;

      const centerLat = data.wells.length > 0 ? (data.wells[0].latitude || 31.85) : 31.85;
      const centerLon = data.wells.length > 0 ? (data.wells[0].longitude || -102.35) : -102.35;

      const map = L.map(mapId).setView([centerLat, centerLon], 10);
      
      // 100% Free Open Map Tile Layers (Zero API Key Required)
      const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Aerial Imagery',
        maxZoom: 18
      });

      const darkCanvas = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Dark Canvas',
        maxZoom: 16
      });

      const openStreetMap = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      });

      // Default to Satellite (best suited for oil field / wellhead aerial visualization)
      satellite.addTo(map);

      // Add free layer toggle control (Satellite / Dark Canvas / Street Map)
      L.control.layers({
        "🛰️ Satellite (Aerial)": satellite,
        "🌑 Dark Theme": darkCanvas,
        "🗺️ OpenStreetMap": openStreetMap
      }, null, { position: 'topright' }).addTo(map);

      data.wells.forEach(w => {
        if (!w.latitude || !w.longitude) return;
        const isProducing = w.status === 'Producing';
        const color = isProducing ? '#10b981' : '#f43f5e';

        const circleMarker = L.circleMarker([w.latitude, w.longitude], {
          radius: 6,
          fillColor: color,
          color: '#fff',
          weight: 1.5,
          opacity: 1,
          fillOpacity: 0.85
        }).addTo(map);

        circleMarker.bindPopup(`
          <div style="font-family: Inter, sans-serif; font-size: 12px; color: #1e293b;">
            <strong style="font-size: 13px;">${escapeHtml(w.well_id)}</strong> (${escapeHtml(w.type || 'Well')})<br/>
            <strong>Name:</strong> ${escapeHtml(w.name || w.well_id)}<br/>
            <strong>Area:</strong> ${escapeHtml(w.area || 'Field')} (${escapeHtml(w.team || '')})<br/>
            <strong>Status:</strong> <span style="color: ${color}; font-weight: bold;">${escapeHtml(w.status || 'Active')}</span><br/>
            <strong>Equipment:</strong> ${escapeHtml(w.equipment || 'Standard Lift')}
          </div>
        `);
      });

      if (data.wells.length > 1) {
        const validCoords = data.wells.filter(w => w.latitude && w.longitude).map(w => [w.latitude, w.longitude]);
        if (validCoords.length > 0) {
          const bounds = L.latLngBounds(validCoords);
          map.fitBounds(bounds, { padding: [20, 20] });
        }
      }

      // Invalidate size to guarantee no blank tiles in dynamic flex containers
      setTimeout(() => { map.invalidateSize(); }, 200);
      setTimeout(() => { map.invalidateSize(); }, 600);
    }, 80);
  },

  // 6. Heatmap Grid Component
  renderHeatmap(container, data) {
    if (!data || !data.matrix || !data.y_labels || !data.x_labels) return;
    const wrap = document.createElement('div');
    wrap.className = 'heatmap-wrapper';

    let maxVal = 1;
    data.y_labels.forEach(area => {
      const row = data.matrix[area] || [];
      row.forEach(v => { if (v > maxVal) maxVal = v; });
    });

    let html = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <h5 style="color:#fff; font-family: Outfit; font-size: 0.95rem;">Cumulative Field Downtime Matrix (${data.year || 2024})</h5>
        <span style="font-size: 0.72rem; color: var(--text-dim);">Unit: Cumulative Downtime Days</span>
      </div>
      <div class="table-responsive">
        <table class="heatmap-table">
          <thead>
            <tr>
              <th style="text-align: left;">Field Area</th>
    `;

    data.x_labels.forEach(m => {
      html += `<th>${escapeHtml(m)}</th>`;
    });
    html += `</tr></thead><tbody>`;

    data.y_labels.forEach(area => {
      const row = data.matrix[area] || [];
      html += `<tr><td class="row-label">${escapeHtml(area)}</td>`;
      row.forEach((val, idx) => {
        const ratio = maxVal > 0 ? (val / maxVal) : 0;
        let bg = 'rgba(16, 22, 35, 0.7)';
        let textCol = '#64748b';
        if (val > 0) {
          if (ratio < 0.3) {
            bg = `rgba(6, 182, 212, ${0.2 + ratio})`;
            textCol = '#a5f3fc';
          } else if (ratio < 0.7) {
            bg = `rgba(245, 158, 11, ${0.4 + ratio * 0.5})`;
            textCol = '#fef3c7';
          } else {
            bg = `rgba(244, 63, 94, ${0.5 + ratio * 0.5})`;
            textCol = '#fff';
          }
        }
        html += `<td class="heatmap-cell" style="background: ${bg}; color: ${textCol};" title="${escapeAttr(area)} - ${escapeAttr(data.x_labels[idx])}: ${val} downtime days">${val}d</td>`;
      });
      html += `</tr>`;
    });

    html += `</tbody></table></div>`;
    wrap.innerHTML = html;
    container.appendChild(wrap);
  },

  // Conflict Alert Banner
  renderConflictBanner(container, conflicts) {
    if (!conflicts || conflicts.length === 0) return;
    conflicts.forEach(c => {
      const alertEl = document.createElement('div');
      alertEl.className = 'conflict-alert';
      alertEl.innerHTML = `
        <div class="conflict-icon">⚠️</div>
        <div class="conflict-content">
          <h5>${escapeHtml(c.title || 'Discrepancy Detected')}</h5>
          <p>${escapeHtml(c.description || '')}</p>
        </div>
      `;
      container.appendChild(alertEl);
    });
  },

  // Citations Pills Bar
  renderCitations(container, citations) {
    if (!citations || citations.length === 0) return;
    const wrap = document.createElement('div');
    wrap.className = 'citations-wrapper';
    wrap.innerHTML = `<span class="citation-header">Grounded Citations:</span>`;

    citations.forEach(c => {
      const pill = document.createElement('span');
      pill.className = 'citation-pill';
      pill.title = `${escapeAttr(c.record || '')} ${c.detail ? '· ' + escapeAttr(c.detail) : ''}`;
      pill.innerHTML = `📄 ${escapeHtml(c.source || 'Knowledge Base')}`;
      wrap.appendChild(pill);
    });

    container.appendChild(wrap);
  }
};

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
