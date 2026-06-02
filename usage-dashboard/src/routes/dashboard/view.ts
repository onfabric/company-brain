export const DASHBOARD_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AI Usage</title>
    <style>
      :root {
        color-scheme: light;
        --bg: #f6f7f4;
        --panel: #ffffff;
        --panel-soft: #eef3ef;
        --ink: #202421;
        --muted: #626b66;
        --line: #d9dfda;
        --teal: #0f8f83;
        --teal-dark: #0a675f;
        --amber: #c47a12;
        --rose: #b4465a;
        --blue: #376ba6;
        --shadow: 0 10px 28px rgb(24 30 26 / 8%);
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        background: var(--bg);
        color: var(--ink);
        font-family:
          Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
          sans-serif;
        letter-spacing: 0;
      }

      button,
      input,
      select {
        font: inherit;
      }

      .shell {
        min-height: 100vh;
      }

      .topbar {
        align-items: center;
        background: #ffffff;
        border-bottom: 1px solid var(--line);
        display: flex;
        gap: 16px;
        justify-content: space-between;
        min-height: 68px;
        padding: 14px clamp(16px, 3vw, 34px);
        position: sticky;
        top: 0;
        z-index: 10;
      }

      h1 {
        font-size: 22px;
        line-height: 1.1;
        margin: 0;
      }

      .status {
        color: var(--muted);
        font-size: 13px;
        min-height: 18px;
      }

      .button {
        align-items: center;
        background: var(--ink);
        border: 1px solid var(--ink);
        border-radius: 8px;
        color: #ffffff;
        cursor: pointer;
        display: inline-flex;
        gap: 8px;
        height: 38px;
        justify-content: center;
        padding: 0 14px;
        white-space: nowrap;
      }

      .button:hover {
        background: #343a35;
      }

      .content {
        display: grid;
        gap: 18px;
        padding: 18px clamp(16px, 3vw, 34px) 34px;
      }

      .filters {
        align-items: end;
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(6, minmax(120px, 1fr));
      }

      .field {
        display: grid;
        gap: 6px;
      }

      label {
        color: var(--muted);
        font-size: 12px;
        font-weight: 650;
      }

      input,
      select {
        background: #ffffff;
        border: 1px solid var(--line);
        border-radius: 8px;
        color: var(--ink);
        height: 38px;
        min-width: 0;
        padding: 0 10px;
      }

      .segments {
        background: #ffffff;
        border: 1px solid var(--line);
        border-radius: 8px;
        display: grid;
        grid-template-columns: repeat(5, minmax(64px, 1fr));
        min-height: 38px;
        overflow: hidden;
      }

      .segment {
        background: transparent;
        border: 0;
        border-right: 1px solid var(--line);
        color: var(--muted);
        cursor: pointer;
        min-width: 0;
        padding: 0 8px;
      }

      .segment:last-child {
        border-right: 0;
      }

      .segment.active {
        background: var(--teal);
        color: #ffffff;
      }

      .metrics {
        display: grid;
        gap: 12px;
        grid-template-columns: repeat(5, minmax(140px, 1fr));
      }

      .metric {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
        min-height: 94px;
        padding: 16px;
      }

      .metric span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        font-weight: 650;
        margin-bottom: 10px;
      }

      .metric strong {
        display: block;
        font-size: 26px;
        line-height: 1.1;
        overflow-wrap: anywhere;
      }

      .grid {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 1.1fr) minmax(360px, 0.9fr);
      }

      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 8px;
        box-shadow: var(--shadow);
        min-width: 0;
        overflow: hidden;
      }

      .panel-head {
        align-items: center;
        border-bottom: 1px solid var(--line);
        display: flex;
        justify-content: space-between;
        min-height: 52px;
        padding: 14px 16px;
      }

      .panel-head h2 {
        font-size: 15px;
        margin: 0;
      }

      .panel-head span {
        color: var(--muted);
        font-size: 12px;
      }

      .chart-wrap {
        height: 310px;
        padding: 12px 14px 16px;
      }

      canvas {
        display: block;
        height: 100%;
        width: 100%;
      }

      table {
        border-collapse: collapse;
        font-size: 13px;
        width: 100%;
      }

      th,
      td {
        border-bottom: 1px solid var(--line);
        padding: 11px 12px;
        text-align: left;
        vertical-align: top;
      }

      th {
        background: var(--panel-soft);
        color: var(--muted);
        font-size: 12px;
        font-weight: 700;
        position: sticky;
        top: 0;
      }

      td.num,
      th.num {
        text-align: right;
      }

      tbody tr:hover {
        background: #fbfcfa;
      }

      .table-scroll {
        max-height: 420px;
        overflow: auto;
      }

      .session-title {
        color: var(--ink);
        display: block;
        font-weight: 650;
        max-width: 420px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .subtle {
        color: var(--muted);
        font-size: 12px;
      }

      .empty {
        color: var(--muted);
        padding: 24px 16px;
      }

      @media (max-width: 1100px) {
        .filters {
          grid-template-columns: repeat(3, minmax(120px, 1fr));
        }

        .metrics {
          grid-template-columns: repeat(2, minmax(140px, 1fr));
        }

        .grid {
          grid-template-columns: 1fr;
        }
      }

      @media (max-width: 640px) {
        .topbar {
          align-items: flex-start;
          flex-direction: column;
        }

        .filters {
          grid-template-columns: 1fr;
        }

        .segments {
          grid-template-columns: repeat(2, minmax(96px, 1fr));
        }

        .metrics {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <div class="shell">
      <header class="topbar">
        <div>
          <h1>AI Usage</h1>
          <div id="status" class="status"></div>
        </div>
        <button id="refresh" class="button" type="button">Refresh</button>
      </header>

      <main class="content">
        <section class="filters" aria-label="Filters">
          <div class="field">
            <label for="from">From</label>
            <input id="from" type="date" />
          </div>
          <div class="field">
            <label for="to">To</label>
            <input id="to" type="date" />
          </div>
          <div class="field">
            <label for="user">User</label>
            <select id="user"></select>
          </div>
          <div class="field">
            <label for="source">Source</label>
            <select id="source"></select>
          </div>
          <div class="field">
            <label for="model">Model</label>
            <select id="model"></select>
          </div>
          <div class="field">
            <label>Split</label>
            <div id="dimensions" class="segments">
              <button class="segment active" type="button" data-dimension="user">User</button>
              <button class="segment" type="button" data-dimension="day">Day</button>
              <button class="segment" type="button" data-dimension="session">Session</button>
              <button class="segment" type="button" data-dimension="model">Model</button>
              <button class="segment" type="button" data-dimension="source">Source</button>
            </div>
          </div>
        </section>

        <section class="metrics" aria-label="Totals">
          <div class="metric"><span>Spend</span><strong id="metric-cost">$0.00</strong></div>
          <div class="metric"><span>Tokens</span><strong id="metric-tokens">0</strong></div>
          <div class="metric"><span>Sessions</span><strong id="metric-sessions">0</strong></div>
          <div class="metric"><span>Messages</span><strong id="metric-messages">0</strong></div>
          <div class="metric"><span>Output tokens</span><strong id="metric-output">0</strong></div>
        </section>

        <section class="grid">
          <section class="panel">
            <div class="panel-head">
              <h2>Daily Usage</h2>
              <span id="chart-caption"></span>
            </div>
            <div class="chart-wrap">
              <canvas id="chart" aria-label="Daily usage chart"></canvas>
            </div>
          </section>

          <section class="panel">
            <div class="panel-head">
              <h2 id="breakdown-title">Breakdown</h2>
              <span id="breakdown-caption"></span>
            </div>
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th id="breakdown-key">User</th>
                    <th class="num">Spend</th>
                    <th class="num">Tokens</th>
                    <th class="num">Sessions</th>
                  </tr>
                </thead>
                <tbody id="breakdown-body"></tbody>
              </table>
            </div>
          </section>
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>Recent Sessions</h2>
            <span id="sessions-caption"></span>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Session</th>
                  <th>User</th>
                  <th>Model</th>
                  <th class="num">Spend</th>
                  <th class="num">Tokens</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody id="sessions-body"></tbody>
            </table>
          </div>
        </section>
      </main>
    </div>

    <script>
      const state = {
        data: null,
        dimension: 'user',
      };

      const els = {
        breakdownBody: document.querySelector('#breakdown-body'),
        breakdownCaption: document.querySelector('#breakdown-caption'),
        breakdownKey: document.querySelector('#breakdown-key'),
        breakdownTitle: document.querySelector('#breakdown-title'),
        chart: document.querySelector('#chart'),
        chartCaption: document.querySelector('#chart-caption'),
        dimensions: document.querySelector('#dimensions'),
        from: document.querySelector('#from'),
        metricCost: document.querySelector('#metric-cost'),
        metricMessages: document.querySelector('#metric-messages'),
        metricOutput: document.querySelector('#metric-output'),
        metricSessions: document.querySelector('#metric-sessions'),
        metricTokens: document.querySelector('#metric-tokens'),
        model: document.querySelector('#model'),
        refresh: document.querySelector('#refresh'),
        sessionsBody: document.querySelector('#sessions-body'),
        sessionsCaption: document.querySelector('#sessions-caption'),
        source: document.querySelector('#source'),
        status: document.querySelector('#status'),
        to: document.querySelector('#to'),
        user: document.querySelector('#user'),
      };

      initDates();
      bindEvents();
      loadUsage();

      function bindEvents() {
        els.refresh.addEventListener('click', loadUsage);
        for (const el of [els.from, els.to, els.user, els.source, els.model]) {
          el.addEventListener('change', loadUsage);
        }
        els.dimensions.addEventListener('click', (event) => {
          const button = event.target.closest('button[data-dimension]');
          if (!button) return;
          state.dimension = button.dataset.dimension;
          for (const segment of els.dimensions.querySelectorAll('.segment')) {
            segment.classList.toggle('active', segment === button);
          }
          loadUsage();
        });
      }

      function initDates() {
        const today = new Date();
        const from = new Date(today);
        from.setUTCDate(from.getUTCDate() - 30);
        els.from.value = toDateInput(from);
        els.to.value = toDateInput(today);
      }

      async function loadUsage() {
        setStatus('Loading');
        const params = new URLSearchParams({
          dimension: state.dimension,
          from: els.from.value,
          to: els.to.value,
        });
        addParam(params, 'user', els.user.value);
        addParam(params, 'source', els.source.value);
        addParam(params, 'model', els.model.value);

        const response = await fetch('/api/usage?' + params.toString());
        if (!response.ok) {
          setStatus('Error loading usage');
          return;
        }

        state.data = await response.json();
        render(state.data);
        setStatus('Updated ' + formatTime(new Date(state.data.generated_at)));
      }

      function render(data) {
        syncSelect(els.user, data.filters.users, data.selected.user, 'All users');
        syncSelect(els.source, data.filters.sources, data.selected.source, 'All sources');
        syncSelect(els.model, data.filters.models, data.selected.model, 'All models');
        renderMetrics(data.totals);
        renderChart(data.timeseries);
        renderBreakdown(data.breakdown, data.selected.dimension);
        renderSessions(data.sessions);
      }

      function renderMetrics(totals) {
        els.metricCost.textContent = formatMoney(totals.cost_usd);
        els.metricTokens.textContent = formatNumber(totals.total_tokens);
        els.metricSessions.textContent = formatNumber(totals.sessions);
        els.metricMessages.textContent = formatNumber(totals.messages);
        els.metricOutput.textContent = formatNumber(totals.output_tokens);
      }

      function renderChart(rows) {
        const canvas = els.chart;
        const rect = canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = Math.max(1, Math.floor(rect.width * dpr));
        canvas.height = Math.max(1, Math.floor(rect.height * dpr));
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, rect.width, rect.height);

        const padding = { top: 12, right: 12, bottom: 34, left: 54 };
        const width = rect.width - padding.left - padding.right;
        const height = rect.height - padding.top - padding.bottom;
        const values = rows.map((row) => row.total_tokens || 0);
        const max = Math.max(1, ...values);

        ctx.strokeStyle = '#d9dfda';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + height);
        ctx.lineTo(padding.left + width, padding.top + height);
        ctx.stroke();

        rows.forEach((row, index) => {
          const barWidth = Math.max(4, width / Math.max(rows.length, 1) - 6);
          const x = padding.left + index * (width / Math.max(rows.length, 1)) + 3;
          const barHeight = ((row.total_tokens || 0) / max) * height;
          const y = padding.top + height - barHeight;
          ctx.fillStyle = index % 3 === 0 ? '#0f8f83' : index % 3 === 1 ? '#c47a12' : '#376ba6';
          ctx.fillRect(x, y, barWidth, barHeight);
        });

        ctx.fillStyle = '#626b66';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText(formatCompact(max), 8, padding.top + 12);
        if (rows.length > 0) {
          ctx.fillText(rows[0].label, padding.left, rect.height - 10);
          const last = rows[rows.length - 1].label;
          ctx.fillText(last, Math.max(padding.left, rect.width - padding.right - ctx.measureText(last).width), rect.height - 10);
        }

        els.chartCaption.textContent = rows.length + ' days';
      }

      function renderBreakdown(rows, dimension) {
        els.breakdownTitle.textContent = titleCase(dimension) + ' Breakdown';
        els.breakdownKey.textContent = titleCase(dimension);
        els.breakdownCaption.textContent = rows.length + ' rows';
        els.breakdownBody.innerHTML = '';
        if (rows.length === 0) {
          els.breakdownBody.innerHTML = '<tr><td class="empty" colspan="4">No usage in this range</td></tr>';
          return;
        }

        for (const row of rows) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td>' + escapeHtml(row.label) + '</td>' +
            '<td class="num">' + formatMoney(row.cost_usd) + '</td>' +
            '<td class="num">' + formatNumber(row.total_tokens) + '</td>' +
            '<td class="num">' + formatNumber(row.sessions) + '</td>';
          els.breakdownBody.appendChild(tr);
        }
      }

      function renderSessions(rows) {
        els.sessionsCaption.textContent = rows.length + ' sessions';
        els.sessionsBody.innerHTML = '';
        if (rows.length === 0) {
          els.sessionsBody.innerHTML = '<tr><td class="empty" colspan="6">No sessions in this range</td></tr>';
          return;
        }

        for (const row of rows) {
          const tr = document.createElement('tr');
          tr.innerHTML = '<td><span class="session-title">' + escapeHtml(row.title || row.session_id) + '</span><span class="subtle">' + escapeHtml(row.source) + '</span></td>' +
            '<td>' + escapeHtml(row.user) + '</td>' +
            '<td>' + escapeHtml(row.model) + '</td>' +
            '<td class="num">' + formatMoney(row.cost_usd) + '</td>' +
            '<td class="num">' + formatNumber(row.total_tokens) + '</td>' +
            '<td>' + formatDateTime(row.updated_at) + '</td>';
          els.sessionsBody.appendChild(tr);
        }
      }

      function syncSelect(select, values, selected, emptyLabel) {
        const current = selected || select.value;
        select.innerHTML = '';
        select.appendChild(option('', emptyLabel));
        for (const value of values) {
          select.appendChild(option(value, value));
        }
        select.value = values.includes(current) ? current : '';
      }

      function option(value, label) {
        const el = document.createElement('option');
        el.value = value;
        el.textContent = label;
        return el;
      }

      function addParam(params, key, value) {
        if (value) params.set(key, value);
      }

      function setStatus(text) {
        els.status.textContent = text;
      }

      function formatMoney(value) {
        return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 4 }).format(value || 0);
      }

      function formatNumber(value) {
        return new Intl.NumberFormat().format(value || 0);
      }

      function formatCompact(value) {
        return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(value || 0);
      }

      function formatDateTime(value) {
        return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
      }

      function formatTime(date) {
        return new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(date);
      }

      function toDateInput(date) {
        return date.toISOString().slice(0, 10);
      }

      function titleCase(value) {
        return value.slice(0, 1).toUpperCase() + value.slice(1);
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;');
      }

      window.addEventListener('resize', () => {
        if (state.data) renderChart(state.data.timeseries);
      });
    </script>
  </body>
</html>`;
