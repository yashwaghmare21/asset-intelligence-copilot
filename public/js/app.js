/**
 * Main Application Logic for Asset Intelligence Copilot
 */

let currentUserId = 'user_alice';
let selectedVisualPreference = null;
let allQuestions = [];

const USER_AVATARS = {
  'user_alice': 'AC',
  'user_bob': 'BM',
  'user_carol': 'CD',
  'user_david': 'DK',
  'user_frank': 'FM'
};

document.addEventListener('DOMContentLoaded', () => {
  initUser();
  loadBenchmarkQuestions();
  loadOverridesLedger();

  // Auto-resize textarea as user types
  const inputEl = document.getElementById('queryInput');
  if (inputEl) {
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    });
  }
});

// User Persona Switcher (Private Session Isolation)
function initUser() {
  const savedUser = localStorage.getItem('copilot_active_user') || 'user_alice';
  currentUserId = savedUser;
  const selectEl = document.getElementById('userSelect');
  if (selectEl) selectEl.value = currentUserId;
  updateUserAvatar();
}

function onUserChange() {
  const selectEl = document.getElementById('userSelect');
  currentUserId = selectEl.value;
  localStorage.setItem('copilot_active_user', currentUserId);
  updateUserAvatar();
  
  // Update memory session view if open
  loadUserPrivateSession();

  // Notify in chat
  appendSystemNotice(`Switched active operator persona to: <strong>${escapeHtml(selectEl.options[selectEl.selectedIndex].text)}</strong>. Your conversation memory is now isolated to this profile.`);
}

function updateUserAvatar() {
  const avatarEl = document.getElementById('currentUserAvatar');
  if (avatarEl) {
    avatarEl.innerText = USER_AVATARS[currentUserId] || 'OP';
  }
}

// View Navigation (Chat vs 18 Benchmarks vs Overrides)
function switchView(viewName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.view-panel').forEach(panel => panel.classList.remove('active'));

  const tabBtn = document.getElementById(`tab-${viewName}`);
  const viewPanel = document.getElementById(`view-${viewName}`);

  if (tabBtn) tabBtn.classList.add('active');
  if (viewPanel) viewPanel.classList.add('active');

  if (viewName === 'overrides') {
    loadOverridesLedger();
    loadUserPrivateSession();
  }
}

// Generative UI Visual Selector
function setVisualPreference(btn, visualType) {
  document.querySelectorAll('.visual-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  selectedVisualPreference = visualType;
}

// Quick Prompt Chips
function askQuickPrompt(promptText) {
  switchView('chat');
  const inputEl = document.getElementById('queryInput');
  inputEl.value = promptText;
  handleChatSubmit();
}

// Keyboard Enter handler
function handleKeyDown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleChatSubmit();
  }
}

// Main Chat Submission
async function handleChatSubmit(e) {
  if (e) e.preventDefault();
  const inputEl = document.getElementById('queryInput');
  const query = inputEl.value.trim();
  if (!query) return;

  // Append user bubble
  appendUserMessage(query);
  inputEl.value = '';
  inputEl.style.height = 'auto';

  // Loading indicator
  const loadingBubble = appendLoadingMessage();

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: query,
        user_id: currentUserId,
        visual_preference: selectedVisualPreference
      })
    });

    const data = await res.json();
    loadingBubble.remove();

    if (data.error) {
      appendAssistantError(data.error);
    } else {
      appendAssistantResponse(data);
    }
  } catch (err) {
    loadingBubble.remove();
    appendAssistantError('Failed to connect to Copilot backend. Ensure the server is running on port 3000.');
  }
}

function appendUserMessage(text) {
  const stream = document.getElementById('chatStream');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message user-message';
  msgEl.innerHTML = `<div class="user-bubble">${escapeHtml(text)}</div>`;
  stream.appendChild(msgEl);
  stream.scrollTop = stream.scrollHeight;
}

function appendLoadingMessage() {
  const stream = document.getElementById('chatStream');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message assistant-message';
  msgEl.innerHTML = `
    <div class="message-header">
      <div class="agent-badge"><span class="ai-dot"></span> Synthesizing Field Data...</div>
    </div>
    <div class="message-body" style="color: var(--text-dim); font-style: italic;">
      Analyzing 41,000 thermal inspections, checking well SOPs & computing downtime...
    </div>
  `;
  stream.appendChild(msgEl);
  stream.scrollTop = stream.scrollHeight;
  return msgEl;
}

function appendAssistantError(errorMsg) {
  const stream = document.getElementById('chatStream');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message assistant-message';
  msgEl.innerHTML = `
    <div class="message-header">
      <div class="agent-badge" style="color: var(--accent-rose);">⚠️ System Alert</div>
    </div>
    <div class="message-body" style="border-color: var(--accent-rose); background: rgba(244, 63, 94, 0.08);">
      ${escapeHtml(errorMsg)}
    </div>
  `;
  stream.appendChild(msgEl);
  stream.scrollTop = stream.scrollHeight;
}

function appendSystemNotice(htmlText) {
  const stream = document.getElementById('chatStream');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message assistant-message';
  msgEl.innerHTML = `
    <div class="message-body" style="background: rgba(6, 182, 212, 0.08); border-color: rgba(6, 182, 212, 0.3); font-size: 0.82rem;">
      ℹ️ ${htmlText}
    </div>
  `;
  stream.appendChild(msgEl);
  stream.scrollTop = stream.scrollHeight;
}

function appendAssistantResponse(data) {
  const stream = document.getElementById('chatStream');
  const msgEl = document.createElement('div');
  msgEl.className = 'chat-message assistant-message';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'message-body';
  bodyEl.innerHTML = formatMarkdown(data.answer);

  // 1. Render Inline Conflicts if any
  if (data.conflicts && data.conflicts.length > 0) {
    VisualRenderer.renderConflictBanner(bodyEl, data.conflicts);
  }

  // 2. Render Inline Generative UI
  if (data.visual_type && data.visual_data) {
    const genWrap = document.createElement('div');
    genWrap.className = 'gen-ui-container';

    switch (data.visual_type) {
      case 'status_card':
        VisualRenderer.renderStatusCard(genWrap, data.visual_data);
        break;
      case 'table':
        VisualRenderer.renderTable(genWrap, data.visual_data);
        break;
      case 'line_chart':
        VisualRenderer.renderLineChart(genWrap, data.visual_data);
        break;
      case 'bar_chart':
        VisualRenderer.renderBarChart(genWrap, data.visual_data);
        break;
      case 'map':
        VisualRenderer.renderMap(genWrap, data.visual_data);
        break;
      case 'heatmap':
        VisualRenderer.renderHeatmap(genWrap, data.visual_data);
        break;
    }
    bodyEl.appendChild(genWrap);
  }

  // 3. Render Citations Bar
  if (data.citations && data.citations.length > 0) {
    VisualRenderer.renderCitations(bodyEl, data.citations);
  }

  msgEl.innerHTML = `
    <div class="message-header">
      <div class="agent-badge"><span class="ai-dot"></span> Asset Intelligence Copilot</div>
      <span class="timestamp">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
    </div>
  `;
  msgEl.appendChild(bodyEl);
  stream.appendChild(msgEl);
  stream.scrollTop = stream.scrollHeight;
}

/**
 * Enhanced Markdown Parser
 * Handles LaTeX formulas, ordered/unordered lists, code snippets, headers, and emphasis
 */
function formatMarkdown(text) {
  if (!text) return '';

  // Clean mathematical blocks like $$\Delta T = ...$$
  let cleaned = text.replace(/\$\$(.*?)\$\$/gs, (match, formula) => {
    let cleanFormula = formula
      .replace(/\\Delta/g, 'Δ')
      .replace(/\\ge/g, '≥')
      .replace(/\\le/g, '≤')
      .replace(/\\text\{([^}]+)\}/g, '$1')
      .replace(/\\quad/g, ' ')
      .replace(/\\circ/g, '°')
      .replace(/\\/g, '');
    return `<div style="background: rgba(6, 182, 212, 0.08); border-left: 3px solid var(--accent-cyan); padding: 8px 12px; margin: 8px 0; border-radius: 4px; font-family: var(--font-mono); font-size: 0.88rem; color: #a5f3fc;">📐 ${cleanFormula}</div>`;
  });

  // Headers
  cleaned = cleaned
    .replace(/^### (.*$)/gim, '<h4>$1</h4>')
    .replace(/^## (.*$)/gim, '<h3>$1</h3>')
    .replace(/^# (.*$)/gim, '<h2>$1</h2>');

  // Code snippets `code`
  cleaned = cleaned.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; font-family: var(--font-mono); font-size: 0.85em; color: var(--accent-cyan);">$1</code>');

  // Bold & Italic
  cleaned = cleaned
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>');

  // Split into paragraphs / lines
  const lines = cleaned.split('\n');
  let result = '';
  let inList = false;

  lines.forEach(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
      if (!inList) {
        result += '<ul style="margin: 8px 0; padding-left: 20px;">';
        inList = true;
      }
      result += `<li style="margin-bottom: 4px;">${trimmed.substring(2)}</li>`;
    } else {
      if (inList) {
        result += '</ul>';
        inList = false;
      }
      if (trimmed.length > 0) {
        if (trimmed.startsWith('<h') || trimmed.startsWith('<div')) {
          result += trimmed;
        } else {
          result += `<p style="margin-bottom: 8px;">${trimmed}</p>`;
        }
      }
    }
  });

  if (inList) {
    result += '</ul>';
  }

  return result;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// -------------------------------------------------------------
// BENCHMARK VIEW LOGIC (18 QUESTIONS)
// -------------------------------------------------------------
async function loadBenchmarkQuestions() {
  try {
    const res = await fetch('/api/benchmark');
    const data = await res.json();
    allQuestions = data.questions || [];
    renderQuestionsGrid(allQuestions);
  } catch (err) {
    console.error('Error loading benchmark questions:', err);
  }
}

function renderQuestionsGrid(questions) {
  const grid = document.getElementById('questionsGrid');
  if (!grid) return;
  grid.innerHTML = '';

  questions.forEach(q => {
    const card = document.createElement('div');
    card.className = 'question-card';
    card.id = `qcard-${q.id}`;
    card.innerHTML = `
      <div>
        <span class="q-badge">Question ${q.id} · ${escapeHtml(q.category)}</span>
        <div class="q-text">${escapeHtml(q.question)}</div>
      </div>
      <div>
        <div class="q-meta">
          <span>Expected: <strong>${escapeHtml(q.expected_visual)}</strong></span>
          <button class="btn-secondary" style="padding: 4px 10px; font-size: 0.75rem;" onclick="runSingleBenchmark(${q.id})">Run Test ▶</button>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

async function runSingleBenchmark(qId) {
  const q = allQuestions.find(item => item.id === qId);
  if (!q) return;

  switchView('chat');
  const inputEl = document.getElementById('queryInput');
  inputEl.value = q.question;
  handleChatSubmit();
}

async function runAllBenchmarks() {
  const progressEl = document.getElementById('benchmarkProgress');
  const barFill = document.getElementById('progressBarFill');
  progressEl.style.display = 'block';

  let completed = 0;
  for (const q of allQuestions) {
    const card = document.getElementById(`qcard-${q.id}`);
    if (card) {
      card.style.borderColor = 'var(--accent-cyan)';
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q.question, user_id: currentUserId })
      });
      const data = await res.json();
      
      const isVisualMatch = data.visual_type === q.expected_visual;
      if (card) {
        card.style.borderColor = isVisualMatch ? 'var(--accent-emerald)' : 'var(--accent-amber)';
        const meta = card.querySelector('.q-meta');
        if (meta) {
          const citesCount = (data.citations || []).length;
          meta.innerHTML = `
            <span>Visual: <strong style="color: ${isVisualMatch ? 'var(--accent-emerald)' : 'var(--accent-amber)'}">${escapeHtml(data.visual_type)}</strong> ${isVisualMatch ? '✅' : '⚠️'}</span>
            <span style="font-size: 0.7rem; color: var(--text-dim);">${citesCount} Cites</span>
          `;
        }
      }
    } catch (e) {
      console.error(e);
    }

    completed++;
    barFill.style.width = `${(completed / allQuestions.length) * 100}%`;
  }

  setTimeout(() => {
    alert(`Benchmark finished: ${completed}/${allQuestions.length} evaluation questions executed!`);
  }, 300);
}

// -------------------------------------------------------------
// OVERRIDES & MEMORY VIEW LOGIC
// -------------------------------------------------------------
async function loadOverridesLedger() {
  try {
    const res = await fetch('/api/overrides');
    const data = await res.json();
    renderOverridesList(data.overrides || []);
  } catch (e) {
    console.error('Error loading overrides:', e);
  }
}

function renderOverridesList(overrides) {
  const listEl = document.getElementById('overridesList');
  if (!listEl) return;
  listEl.innerHTML = '';

  if (overrides.length === 0) {
    listEl.innerHTML = `<div style="color: var(--text-dim); font-size: 0.8rem;">No active ground-truth overrides recorded yet.</div>`;
    return;
  }

  overrides.forEach(ovr => {
    const item = document.createElement('div');
    item.className = 'ledger-item';
    item.innerHTML = `
      <div class="ledger-top">
        <span class="ledger-id">${escapeHtml(ovr.override_id)} · ${escapeHtml(ovr.scope)}</span>
        <span style="font-size: 0.72rem; color: var(--accent-emerald); font-weight: 600;">ACTIVE OVERRIDE</span>
      </div>
      <div class="ledger-values">
        Target: <strong>${escapeHtml(ovr.target_id || ovr.target_type || 'Field')}</strong> | Field: <code>${escapeHtml(ovr.field)}</code><br/>
        Original: <del style="color: var(--accent-rose);">${escapeHtml(String(ovr.original_value))}</del> → Ground Truth: <strong style="color: var(--accent-emerald);">${escapeHtml(String(ovr.corrected_value))}</strong>
      </div>
      <div class="ledger-reason">
        "${escapeHtml(ovr.reason)}" — <em>${escapeHtml(ovr.author)} (${new Date(ovr.timestamp).toLocaleDateString()})</em>
      </div>
    `;
    listEl.appendChild(item);
  });
}

async function loadUserPrivateSession() {
  const userLabel = document.getElementById('sessionUserLabel');
  const box = document.getElementById('privateSessionWells');
  if (userLabel) userLabel.innerText = `${currentUserId}`;
  if (!box) return;

  try {
    const res = await fetch(`/api/session/${currentUserId}`);
    const data = await res.json();
    box.innerHTML = '';

    const wells = (data.session && data.session.discussedWells) ? data.session.discussedWells : [];
    if (wells.length === 0) {
      box.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-dim);">No wells discussed yet in this private session.</span>`;
    } else {
      wells.forEach(w => {
        const pill = document.createElement('span');
        pill.className = 'session-well-pill';
        pill.innerText = w;
        box.appendChild(pill);
      });
    }
  } catch (e) {
    console.error('Error loading private session:', e);
  }
}

async function clearCurrentSession() {
  try {
    await fetch(`/api/session/${currentUserId}`, { method: 'DELETE' });
    loadUserPrivateSession();
    appendSystemNotice(`Private session cleared for ${currentUserId}.`);
  } catch (e) {
    console.error(e);
  }
}

// -------------------------------------------------------------
// CORRECTION MODAL LOGIC
// -------------------------------------------------------------
function openCorrectionModal(wellId = 'WELL-0045', wellType = 'Type B') {
  const modal = document.getElementById('correctionModal');
  if (!modal) return;

  const validWellId = (wellId && wellId !== 'undefined') ? wellId : 'WELL-0045';
  const validWellType = (wellType && wellType !== 'undefined') ? wellType : 'Type B';

  if (document.getElementById('corrTargetId')) {
    document.getElementById('corrTargetId').value = validWellId;
  }
  if (document.getElementById('corrTargetType')) {
    document.getElementById('corrTargetType').value = validWellType;
  }
  modal.classList.add('active');
}

function closeCorrectionModal() {
  const modal = document.getElementById('correctionModal');
  if (modal) modal.classList.remove('active');
}

function toggleScopeInputs() {
  const scope = document.getElementById('corrScope').value;
  const idGroup = document.getElementById('targetIdGroup');
  const typeGroup = document.getElementById('targetTypeGroup');

  if (scope === 'WELL_INSTANCE') {
    idGroup.style.display = 'flex';
    typeGroup.style.display = 'none';
  } else {
    idGroup.style.display = 'none';
    typeGroup.style.display = 'flex';
  }
}

async function handleCorrectionSubmit(e) {
  e.preventDefault();
  const scope = document.getElementById('corrScope').value;
  const targetId = document.getElementById('corrTargetId').value.trim();
  const targetType = document.getElementById('corrTargetType').value;
  const field = document.getElementById('corrField').value;
  const originalVal = document.getElementById('corrOriginalVal').value.trim();
  const newVal = document.getElementById('corrNewVal').value.trim();
  const reason = document.getElementById('corrReason').value.trim();

  const userSelect = document.getElementById('userSelect');
  const authorName = userSelect ? userSelect.options[userSelect.selectedIndex].text : 'Field Operator';

  try {
    const res = await fetch('/api/overrides', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scope,
        target_id: scope === 'WELL_INSTANCE' ? targetId : null,
        target_type: scope === 'WELL_TYPE' ? targetType : null,
        field,
        original_value: isNaN(originalVal) ? originalVal : Number(originalVal),
        corrected_value: isNaN(newVal) ? newVal : Number(newVal),
        author: authorName,
        reason
      })
    });

    const data = await res.json();
    if (data.success) {
      closeCorrectionModal();
      loadOverridesLedger();
      switchView('chat');
      appendSystemNotice(`Ground-truth correction logged by <strong>${escapeHtml(authorName)}</strong>: <code>${escapeHtml(field)}</code> updated to <strong>${escapeHtml(newVal)}</strong> for ${scope === 'WELL_INSTANCE' ? escapeHtml(targetId) : escapeHtml(targetType)}. All subsequent calculations will reflect this override.`);
    }
  } catch (err) {
    alert('Failed to submit correction: ' + err.message);
  }
}
