/**
 * js/db-studio.js — Toffee AI SQLite DB Studio
 * Live table browser, row viewer, and read-only SQL console.
 * Talks to /api/db/tables, /api/db/table-data?table=X, /api/db/query
 */

(function () {
  'use strict';

  let activeTable = null;
  let activeTab = 'data';
  let currentOffset = 0;
  const PAGE_SIZE = 50;

  // DOM refs (initialized after DOMContentLoaded)
  let tableList, dataPanel, queryPanel, sqlInput, queryResult,
      refreshBtn, runSqlBtn, statusBadge;

  /* ─── Init ─── */
  document.addEventListener('DOMContentLoaded', () => {
    tableList   = document.getElementById('dbTableList');
    dataPanel   = document.getElementById('dbDataPanel');
    queryPanel  = document.getElementById('dbQueryPanel');
    sqlInput    = document.getElementById('dbSqlInput');
    queryResult = document.getElementById('dbQueryResult');
    refreshBtn  = document.getElementById('btnRefreshDbStudio');
    runSqlBtn   = document.getElementById('btnRunSql');
    statusBadge = document.getElementById('dbStudioStatus');

    if (!tableList) return; // DB Studio not on this page

    refreshBtn && refreshBtn.addEventListener('click', loadTables);
    runSqlBtn  && runSqlBtn.addEventListener('click',  runSqlQuery);

    // Ctrl+Enter to run query
    sqlInput && sqlInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runSqlQuery();
      }
    });

    // Auto-load when section scrolls into view (IntersectionObserver)
    const section = document.getElementById('db-studio');
    if (section && 'IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
          loadTables();
          observer.disconnect();
        }
      }, { threshold: 0.1 });
      observer.observe(section);
    } else {
      loadTables();
    }
  });

  /* ─── Public API ─── */
  window.DbStudio = {
    switchTab(tab) {
      activeTab = tab;
      const dataBtn  = document.getElementById('dbTabData');
      const queryBtn = document.getElementById('dbTabQuery');

      if (tab === 'data') {
        dataPanel.style.display  = 'block';
        queryPanel.style.display = 'none';
        dataBtn  && dataBtn.classList.add('active');
        queryBtn && queryBtn.classList.remove('active');
      } else {
        dataPanel.style.display  = 'none';
        queryPanel.style.display = 'flex';
        dataBtn  && dataBtn.classList.remove('active');
        queryBtn && queryBtn.classList.add('active');
      }
    }
  };

  /* ─── Load Table List ─── */
  async function loadTables() {
    if (!tableList) return;
    tableList.innerHTML = '<div style="padding:10px;text-align:center;color:#64748B;font-size:0.8rem;">Loading…</div>';
    if (statusBadge) {
      statusBadge.textContent = '⟳ Syncing…';
      statusBadge.style.background = 'rgba(99,102,241,0.2)';
      statusBadge.style.color = '#818CF8';
    }

    try {
      const res  = await fetch('/api/db/tables');
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Failed to load tables');

      if (statusBadge) {
        statusBadge.textContent = '● Connected';
        statusBadge.style.background = 'rgba(16,185,129,0.2)';
        statusBadge.style.color = '#34D399';
      }

      renderTableList(data.tables || []);
    } catch (err) {
      tableList.innerHTML = `<div style="padding:10px;color:#F87171;font-size:0.78rem;">⚠️ ${err.message}</div>`;
      if (statusBadge) {
        statusBadge.textContent = '✕ Error';
        statusBadge.style.background = 'rgba(239,68,68,0.2)';
        statusBadge.style.color = '#F87171';
      }
    }
  }

  function renderTableList(tables) {
    if (!tableList) return;
    if (!tables.length) {
      tableList.innerHTML = '<div style="padding:10px;color:#64748B;font-size:0.8rem;">No tables found</div>';
      return;
    }

    const ICONS = {
      users: '👤', otp_records: '🔑', sessions: '🍪',
      voice_profiles: '🎙️', documents: '📄', activity_logs: '📋'
    };

    tableList.innerHTML = tables.map(t => {
      const icon = ICONS[t.name] || '📦';
      const isActive = t.name === activeTable;
      return `
        <button
          class="db-table-btn${isActive ? ' active' : ''}"
          onclick="window.DbStudio._selectTable('${t.name}')"
          title="${t.row_count} rows">
          <span>${icon} ${t.name}</span>
          <span class="db-row-count">${t.row_count ?? '?'}</span>
        </button>`;
    }).join('');
  }

  window.DbStudio._selectTable = async function (tableName) {
    activeTable  = tableName;
    currentOffset = 0;

    // Highlight active table button
    document.querySelectorAll('.db-table-btn').forEach(b => b.classList.remove('active'));
    const btn = [...document.querySelectorAll('.db-table-btn')]
      .find(b => b.textContent.includes(tableName));
    btn && btn.classList.add('active');

    // Switch to data tab
    window.DbStudio.switchTab('data');
    await loadTableData(tableName, 0);
  };

  /* ─── Load Table Data ─── */
  async function loadTableData(tableName, offset) {
    if (!dataPanel) return;
    dataPanel.innerHTML = '<div style="padding:20px;text-align:center;color:#64748B;">Loading rows…</div>';

    try {
      const res  = await fetch(`/api/db/table-data?table=${encodeURIComponent(tableName)}&limit=${PAGE_SIZE}&offset=${offset}`);
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Failed to load table');
      renderTableData(data, tableName, offset);
    } catch (err) {
      dataPanel.innerHTML = `<div style="padding:16px;color:#F87171;">⚠️ ${err.message}</div>`;
    }
  }

  function renderTableData(data, tableName, offset) {
    const { schema = [], data: rows = [] } = data;

    if (!rows.length) {
      dataPanel.innerHTML = `
        <div style="text-align:center;padding:40px;color:#64748B;">
          <div style="font-size:2rem;margin-bottom:8px;">📭</div>
          <div>No rows found in <strong style="color:#F8FAFC;">${tableName}</strong></div>
        </div>`;
      return;
    }

    // Column headers from schema
    const cols = schema.length
      ? schema.map(c => c.name)
      : Object.keys(rows[0] || {});

    const SENSITIVE = ['password_hash', 'password', 'otp_code', 'feature_vector'];

    const thead = `<thead><tr>${cols.map(c =>
      `<th style="white-space:nowrap;">${c}</th>`
    ).join('')}</tr></thead>`;

    const tbody = `<tbody>${rows.map(row =>
      `<tr>${cols.map(c => {
        const val = row[c];
        if (val === null || val === undefined) return '<td><em style="color:#475569;">NULL</em></td>';
        if (SENSITIVE.includes(c)) return '<td><span style="color:#64748B;font-style:italic;">••••••••</span></td>';
        const display = typeof val === 'object' ? JSON.stringify(val) : String(val);
        const short = display.length > 80 ? display.slice(0, 77) + '…' : display;
        return `<td title="${esc(display)}">${esc(short)}</td>`;
      }).join('')}</tr>`
    ).join('')}</tbody>`;

    const info = `<div style="font-size:0.78rem;color:#64748B;margin-bottom:10px;">
      Showing rows ${offset + 1}–${offset + rows.length} of <strong style="color:#F8FAFC;">${tableName}</strong>
      (page size: ${PAGE_SIZE})
    </div>`;

    const pagination = `<div style="display:flex;gap:8px;margin-top:12px;justify-content:flex-end;">
      ${offset > 0 ? `<button class="btn btn-sm btn-outline" onclick="window.DbStudio._paginate('${tableName}', ${offset - PAGE_SIZE})">← Prev</button>` : ''}
      ${rows.length === PAGE_SIZE ? `<button class="btn btn-sm btn-outline" onclick="window.DbStudio._paginate('${tableName}', ${offset + PAGE_SIZE})">Next →</button>` : ''}
    </div>`;

    dataPanel.innerHTML = `${info}<div style="overflow-x:auto;"><table class="db-data-table">${thead}${tbody}</table></div>${pagination}`;
  }

  window.DbStudio._paginate = async function (tableName, offset) {
    currentOffset = offset;
    await loadTableData(tableName, offset);
  };

  /* ─── SQL Console ─── */
  async function runSqlQuery() {
    const query = sqlInput?.value?.trim();
    if (!query) return;

    queryResult.innerHTML = '<div style="color:#64748B;padding:8px;">Running query…</div>';
    runSqlBtn.disabled = true;

    try {
      const res  = await fetch('/api/db/query', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ query })
      });
      const data = await res.json();

      if (!data.success) throw new Error(data.error || 'Query failed');
      renderQueryResult(data);
    } catch (err) {
      queryResult.innerHTML = `<div style="color:#F87171;padding:8px;font-size:0.82rem;">⚠️ ${err.message}</div>`;
    } finally {
      runSqlBtn.disabled = false;
    }
  }

  function renderQueryResult(data) {
    const { columns = [], rows = [], row_count = 0 } = data;

    if (!rows.length) {
      queryResult.innerHTML = '<div style="color:#34D399;padding:8px;font-size:0.82rem;">✓ Query OK — 0 rows returned.</div>';
      return;
    }

    const thead = `<thead><tr>${columns.map(c => `<th>${esc(c)}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${rows.map(row =>
      `<tr>${row.map(cell => {
        if (cell === null || cell === undefined) return '<td><em style="color:#475569;">NULL</em></td>';
        const display = String(cell);
        const short = display.length > 60 ? display.slice(0, 57) + '…' : display;
        return `<td title="${esc(display)}">${esc(short)}</td>`;
      }).join('')}</tr>`
    ).join('')}</tbody>`;

    queryResult.innerHTML = `
      <div style="font-size:0.78rem;color:#34D399;margin-bottom:8px;">✓ ${row_count} row${row_count !== 1 ? 's' : ''} returned</div>
      <div style="overflow-x:auto;"><table class="db-data-table">${thead}${tbody}</table></div>`;
  }

  /* ─── Util ─── */
  function esc(v) {
    return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

})();
