/* ==========================================================================
   Real-Time SaaS Dashboard Preview & Telemetry Stream (Python SSE Engine)
   ========================================================================== */

(function () {
  const canvas = document.getElementById('telemetryChart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const MAX_POINTS = 24;

  const metricEls = {
    clusters: document.getElementById('dashActiveClusters'),
    throughput: document.getElementById('dashLiveThroughput'),
    latency: document.getElementById('dashLatency'),
    cost: document.getElementById('dashCostSavings'),
    success: document.getElementById('dashSuccessRate'),
  };

  const streamStatus = document.getElementById('dashStreamStatus');
  const streamStatusText = document.getElementById('dashStreamStatusText');
  const streamDot = document.getElementById('dashStreamDot');
  const regionEl = document.getElementById('dashLiveRegion');
  const eventEl = document.getElementById('dashEventId');
  const tickEl = document.getElementById('dashLastTick');
  const feedList = document.getElementById('dashFeedList') || document.querySelector('.dash-feed-list');
  const chartTitleEl = document.getElementById('dashChartTitle');

  // Simulation & Topology Elements
  const simCurrentModePill = document.getElementById('simCurrentModePill');
  const simModeText = document.getElementById('simModeText');
  const simPythonHostPill = document.getElementById('simPythonHostPill');
  const pythonHostText = document.getElementById('pythonHostText');
  const canaryWrapper = document.getElementById('canaryProgressWrapper');
  const canaryPct = document.getElementById('canaryProgressPct');
  const canaryFill = document.getElementById('canaryProgressFill');

  // Topology Nodes
  const topoClient = document.getElementById('topoClient');
  const topoGateway = document.getElementById('topoGateway');
  const topoUsEast = document.getElementById('topoUsEast');
  const topoUsEastStatus = document.getElementById('topoUsEastStatus');
  const topoEuCentral = document.getElementById('topoEuCentral');
  const topoEuCentralStatus = document.getElementById('topoEuCentralStatus');
  const topoApSouth = document.getElementById('topoApSouth');
  const topoApSouthStatus = document.getElementById('topoApSouthStatus');

  const tabData = {
    analytics: {
      title: 'Global API Throughput & Latency (Live SSE)',
      color: '#6366F1',
      glow: 'rgba(99, 102, 241, 0.35)',
      unit: 'req/s',
      baseMax: 340,
      max: 340,
      metricKey: 'throughput',
      seed: 190,
      variance: 45,
    },
    automation: {
      title: 'Autonomous AI Agent Execution Pipeline',
      color: '#06B6D4',
      glow: 'rgba(6, 182, 212, 0.35)',
      unit: 'jobs',
      baseMax: 430,
      max: 430,
      metricKey: 'automationJobs',
      seed: 230,
      variance: 70,
    },
    security: {
      title: 'Zero-Trust Threat Filtering Events',
      color: '#10B981',
      glow: 'rgba(16, 185, 129, 0.35)',
      unit: 'blocked',
      baseMax: 35,
      max: 35,
      metricKey: 'threatsBlocked',
      seed: 9,
      variance: 8,
    },
  };

  const history = {};
  let activeTab = 'analytics';
  let fallbackTimer = null;
  let fallbackSequence = 0;
  let lastStreamPayloadAt = 0;
  let currentMode = 'nominal';

  Object.keys(tabData).forEach((key) => {
    const config = tabData[key];
    history[key] = Array.from({ length: MAX_POINTS }, (_, index) => {
      const wave = Math.sin(index / 2.2) * config.variance;
      const jitter = (Math.random() - 0.5) * config.variance;
      return clamp(config.seed + wave + jitter, 1, config.max);
    });
  });

  function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawChart();
  }

  function drawChart() {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.width / dpr;
    const height = canvas.height / dpr;
    const config = tabData[activeTab];
    const points = history[activeTab] || [];

    ctx.clearRect(0, 0, width, height);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const gridColor = isLight ? 'rgba(15, 23, 42, 0.07)' : 'rgba(255, 255, 255, 0.06)';
    const textColor = isLight ? '#64748B' : '#94A3B8';
    const rows = 4;

    for (let i = 0; i <= rows; i++) {
      const y = (height / rows) * i;
      ctx.beginPath();
      ctx.strokeStyle = gridColor;
      ctx.lineWidth = 1;
      ctx.moveTo(42, y);
      ctx.lineTo(width - 10, y);
      ctx.stroke();

      ctx.fillStyle = textColor;
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${Math.round(config.max - (config.max / rows) * i)}`, 8, y + 4);
    }

    if (points.length < 2) return;

    const leftPad = 50;
    const rightPad = 14;
    const bottomPad = 16;
    const topPad = 14;
    const chartWidth = width - leftPad - rightPad;
    const chartHeight = height - topPad - bottomPad;

    ctx.beginPath();
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 2.5;

    let firstX = leftPad;
    let firstY = height - bottomPad;
    let lastX = firstX;
    let lastY = firstY;

    points.forEach((point, index) => {
      const x = leftPad + (index / (MAX_POINTS - 1)) * chartWidth;
      const ratio = clamp(point / config.max, 0, 1);
      const y = height - bottomPad - ratio * chartHeight;

      if (index === 0) {
        firstX = x;
        firstY = y;
        ctx.moveTo(x, y);
      } else {
        const prevIndex = index - 1;
        const prevX = leftPad + (prevIndex / (MAX_POINTS - 1)) * chartWidth;
        const prevRatio = clamp(points[prevIndex] / config.max, 0, 1);
        const prevY = height - bottomPad - prevRatio * chartHeight;
        const cpX = (prevX + x) / 2;
        ctx.bezierCurveTo(cpX, prevY, cpX, y, x, y);
      }

      if (index === points.length - 1) {
        lastX = x;
        lastY = y;
      }
    });

    ctx.stroke();

    const gradient = ctx.createLinearGradient(0, topPad, 0, height - bottomPad);
    gradient.addColorStop(0, config.glow);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.lineTo(lastX, height - bottomPad);
    ctx.lineTo(firstX, height - bottomPad);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lastX, lastY, 5, 0, Math.PI * 2);
    ctx.fillStyle = config.color;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(lastX, lastY, 10, 0, Math.PI * 2);
    ctx.strokeStyle = config.color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = textColor;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(config.unit, width - 76, 18);
  }

  function applyTelemetry(payload, source) {
    const metrics = payload.metrics || {};
    lastStreamPayloadAt = source === 'stream' ? Date.now() : lastStreamPayloadAt;

    currentMode = payload.mode || 'nominal';

    // Dynamic max adjustment based on incoming spike/ddos values
    if (metrics.throughput && metrics.throughput > tabData.analytics.max * 0.8) {
      tabData.analytics.max = Math.ceil(metrics.throughput * 1.25);
    } else if (currentMode === 'nominal' && tabData.analytics.max > tabData.analytics.baseMax * 2) {
      tabData.analytics.max = tabData.analytics.baseMax;
    }

    if (metrics.threatsBlocked && metrics.threatsBlocked > tabData.security.max * 0.8) {
      tabData.security.max = Math.ceil(metrics.threatsBlocked * 1.25);
    } else if (currentMode === 'nominal' && tabData.security.max > tabData.security.baseMax * 2) {
      tabData.security.max = tabData.security.baseMax;
    }

    pushPoint('analytics', metrics.throughput);
    pushPoint('automation', metrics.automationJobs);
    pushPoint('security', metrics.threatsBlocked);

    updateText(metricEls.clusters, `${formatNumber(metrics.activeClusters)} Nodes`);
    updateText(metricEls.throughput, `${formatNumber(metrics.throughput)} req/s`);
    updateText(metricEls.latency, `${Number(metrics.latency || 0).toFixed(1)} ms`);
    updateText(metricEls.cost, `$${formatNumber(metrics.costSavings)}`);
    updateText(metricEls.success, `${Number(metrics.successRate || 0).toFixed(3)}% Success`);

    updateText(regionEl, payload.region || 'local');
    updateText(eventEl, `#${payload.id || 0}`);
    updateText(tickEl, formatTime(payload.timestamp));

    // Update Simulation Mode Pill & Styling
    if (simModeText) {
      updateText(simModeText, payload.modeLabel || 'Nominal Baseline');
    }
    if (simCurrentModePill) {
      simCurrentModePill.classList.remove('is-alert', 'is-warning', 'is-info');
      if (currentMode === 'spike') simCurrentModePill.classList.add('is-warning');
      else if (currentMode === 'chaos' || currentMode === 'ddos') simCurrentModePill.classList.add('is-alert');
      else if (currentMode === 'canary') simCurrentModePill.classList.add('is-info');
    }

    // Update Canary Progress
    if (canaryWrapper) {
      if (currentMode === 'canary') {
        canaryWrapper.style.display = 'block';
        const pct = payload.canaryProgress || 10;
        if (canaryPct) canaryPct.textContent = `${pct}%`;
        if (canaryFill) canaryFill.style.width = `${pct}%`;
      } else {
        canaryWrapper.style.display = 'none';
      }
    }

    // Update Cluster Topology Visualizer Nodes
    updateTopology(payload);

    if (payload.activity && payload.activity.text) {
      pushFeed(payload.activity.text, payload.activity.type);
    }

    setStatus(source === 'stream' ? 'Live SSE' : 'Demo stream', source === 'stream' ? 'online' : 'warning');
    drawChart();
  }

  function updateTopology(payload) {
    if (!topoUsEast) return;

    // Reset base classes
    topoUsEast.classList.remove('degraded-route');
    topoEuCentral.classList.remove('active-route');
    topoApSouth.classList.remove('active-route');

    if (currentMode === 'chaos') {
      topoUsEast.classList.add('degraded-route');
      if (topoUsEastStatus) topoUsEastStatus.textContent = 'Degraded (Bypassed)';
      topoEuCentral.classList.add('active-route');
      if (topoEuCentralStatus) topoEuCentralStatus.textContent = 'Accepting Failover';
      if (topoApSouthStatus) topoApSouthStatus.textContent = 'Quorum Active';
    } else if (currentMode === 'spike') {
      if (topoUsEastStatus) topoUsEastStatus.textContent = 'Autoscaling (+120 Nodes)';
      topoEuCentral.classList.add('active-route');
      if (topoEuCentralStatus) topoEuCentralStatus.textContent = 'Spike Absorption';
      if (topoApSouthStatus) topoApSouthStatus.textContent = 'Hot Standby';
    } else if (currentMode === 'ddos') {
      if (topoUsEastStatus) topoUsEastStatus.textContent = 'WAF Filter Active';
      if (topoEuCentralStatus) topoEuCentralStatus.textContent = 'Threat Shielded';
      if (topoApSouthStatus) topoApSouthStatus.textContent = 'Threat Shielded';
    } else if (currentMode === 'canary') {
      if (topoUsEastStatus) topoUsEastStatus.textContent = `Canary ${payload.canaryProgress || 10}%`;
      if (topoEuCentralStatus) topoEuCentralStatus.textContent = 'Baseline (v2.3)';
      if (topoApSouthStatus) topoApSouthStatus.textContent = 'Baseline (v2.3)';
    } else {
      // Nominal
      if (topoUsEastStatus) topoUsEastStatus.textContent = 'Nominal (Primary)';
      if (topoEuCentralStatus) topoEuCentralStatus.textContent = 'Hot Standby';
      if (topoApSouthStatus) topoApSouthStatus.textContent = 'Hot Standby';
    }
  }

  function pushPoint(key, value) {
    const config = tabData[key];
    if (typeof value !== 'number' || Number.isNaN(value)) return;
    history[key].push(clamp(value, 0, config.max));
    while (history[key].length > MAX_POINTS) {
      history[key].shift();
    }
  }

  function pushFeed(text, type = 'info') {
    if (!feedList) return;

    const item = document.createElement('div');
    item.className = `feed-item ${type === 'alert' ? 'alert' : type === 'success' ? 'success' : ''}`;
    item.innerHTML = `
      <div class="feed-icon"><span class="pulse-dot"></span></div>
      <div class="feed-text">${escapeHtml(text)}</div>
      <div class="feed-time">Just now</div>
    `;

    feedList.insertBefore(item, feedList.firstChild);
    while (feedList.children.length > 6) {
      feedList.removeChild(feedList.lastChild);
    }
  }

  function startTelemetryStream() {
    if (!window.EventSource || window.location.protocol === 'file:') {
      startFallbackStream();
      return;
    }

    setStatus('Connecting', 'warning');

    const source = new EventSource('/api/telemetry');
    source.addEventListener('open', () => setStatus('Live SSE', 'online'));
    source.addEventListener('telemetry', (event) => {
      try {
        stopFallbackStream();
        applyTelemetry(JSON.parse(event.data), 'stream');
      } catch (error) {
        pushFeed(`Telemetry parse error: ${error.message}`, 'alert');
      }
    });

    source.onerror = () => {
      if (lastStreamPayloadAt) {
        setStatus('Reconnecting', 'warning');
        return;
      }
      startFallbackStream();
    };

    window.setTimeout(() => {
      if (!lastStreamPayloadAt) startFallbackStream();
    }, 3500);
  }

  function startFallbackStream() {
    if (fallbackTimer) return;
    setStatus('Demo stream', 'warning');
    fallbackTimer = window.setInterval(() => {
      applyTelemetry(buildLocalTelemetry(fallbackSequence), 'fallback');
      fallbackSequence += 1;
    }, 1200);
  }

  function stopFallbackStream() {
    if (!fallbackTimer) return;
    window.clearInterval(fallbackTimer);
    fallbackTimer = null;
  }

  function buildLocalTelemetry(sequence) {
    const regions = ['us-east-1', 'eu-central-1', 'ap-south-1', 'us-west-2'];
    const region = regions[sequence % regions.length];
    const throughput = 170 + Math.round(Math.random() * 105) + ((sequence % 5) * 8);
    const latency = 9 + Math.random() * 15;
    const automationJobs = 165 + Math.round(Math.random() * 220);
    const threatsBlocked = 1 + Math.round(Math.random() * 26);
    const costDelta = 120 + Math.round(Math.random() * 740);

    return {
      id: sequence,
      timestamp: new Date().toISOString(),
      region,
      mode: 'nominal',
      modeLabel: 'Nominal Baseline (Local Demo)',
      canaryProgress: 0,
      metrics: {
        activeClusters: 138 + Math.round(Math.random() * 26),
        throughput,
        latency,
        costSavings: 42850 + (sequence * 44) + costDelta,
        successRate: 99.935 + Math.random() * 0.064,
        automationJobs,
        threatsBlocked,
      },
      activity: {
        type: sequence % 4 === 0 ? 'alert' : 'success',
        text: sequence % 4 === 0
          ? `Latency guard rerouted ${region} traffic before SLO breach`
          : `${region} processed ${throughput} req/s with ${latency.toFixed(1)} ms p99`,
      },
    };
  }

  function setStatus(label, state) {
    updateText(streamStatusText, label);
    if (streamStatus) {
      streamStatus.dataset.state = state;
    }
    if (streamDot) {
      streamDot.dataset.state = state;
    }
  }

  function updateText(element, value) {
    if (!element || value === 'undefined' || value === 'NaN') return;
    element.textContent = value;
    element.classList.remove('is-updating');
    window.requestAnimationFrame(() => element.classList.add('is-updating'));
  }

  function formatNumber(value) {
    return Number(value || 0).toLocaleString();
  }

  function formatTime(timestamp) {
    const date = timestamp ? new Date(timestamp) : new Date();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[character]));
  }

  // Toast Notification Helper
  function showToast(msg, icon = '⚡') {
    const toast = document.getElementById('toffeeToast');
    if (!toast) return;
    const msgEl = document.getElementById('toastMsg');
    const iconEl = document.getElementById('toastIcon');
    if (msgEl) msgEl.textContent = msg;
    if (iconEl) iconEl.textContent = icon;

    toast.classList.add('show');
    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => {
      toast.classList.remove('show');
    }, 3200);
  }

  // Wire up Interactive Simulation Controls
  document.querySelectorAll('.sim-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const action = btn.getAttribute('data-action');
      document.querySelectorAll('.sim-btn').forEach((b) => b.classList.remove('is-active'));
      btn.classList.add('is-active');

      const actionTitles = {
        spike: '🚀 Injected 10,000 req/s Traffic Surge',
        chaos: '⚡ Regional Chaos Injected: us-east-1 Failover',
        ddos: '🛡️ Layer 7 DDoS Mitigation & WAF Engaged',
        canary: '🔄 Canary Release Rollout Initiated (v2.4.0)',
        nominal: '↺ Cluster Returned to Nominal Baseline',
      };

      showToast(actionTitles[action] || 'Action Dispatched', '⚡');

      try {
        const response = await fetch('/api/control', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const data = await response.json();
        if (data.label && simModeText) {
          updateText(simModeText, data.label);
        }
        if (data.event) {
          pushFeed(data.event.text, data.event.type);
        }
      } catch (err) {
        console.warn('Simulation control fetch warning:', err);
      }
    });
  });

  // Fetch Python System Diagnostics on Load
  async function fetchSystemStatus() {
    try {
      const res = await fetch('/api/system-status');
      if (!res.ok) return;
      const data = await res.json();
      if (pythonHostText && data.runtime) {
        pythonHostText.textContent = `Python ${data.runtime.pythonVersion} • ${data.runtime.activeThreads} Active Threads`;
      }
    } catch (e) {
      // Running offline / demo
    }
  }

  document.querySelectorAll('.dash-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dash-tab-btn').forEach((tab) => tab.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.getAttribute('data-tab');
      if (!tabData[target]) return;

      activeTab = target;
      if (chartTitleEl) chartTitleEl.textContent = tabData[target].title;
      drawChart();
    });
  });

  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('themeChanged', drawChart);
  window.addEventListener('leadSubmitted', (event) => {
    const lead = event.detail || {};
    const label = lead.type === 'newsletter' ? 'Newsletter subscription' : 'Demo request';
    pushFeed(`${label} received from ${lead.email || 'new contact'}`, 'success');
  });

  resizeCanvas();
  drawChart();
  startTelemetryStream();
  fetchSystemStatus();

  // Expose toast helper globally for other modules
  window.toffeeToast = showToast;
})();
