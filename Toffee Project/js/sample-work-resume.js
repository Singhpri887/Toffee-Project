/* ==========================================================================
   Sample Work & Interactive Resume Dossier Module (ATS & Interview Kit)
   ========================================================================== */

(function () {
  // Tab Switcher between "Featured SaaS Works", "ATS Resume Kit", "Full Dossier", and "Resume Builder"
  const tabBtns = document.querySelectorAll('.sample-tab-btn');
  const portfolioView = document.getElementById('samplePortfolioView');
  const resumeKitView = document.getElementById('sampleResumeKitView');
  const resumeView = document.getElementById('sampleResumeView');
  const builderView = document.getElementById('resumeBuilderView');

  function switchSampleTab(target) {
    tabBtns.forEach((b) => b.classList.remove('active'));
    const activeBtn = document.querySelector(`.sample-tab-btn[data-view="${target}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (portfolioView) portfolioView.style.display = target === 'portfolio' ? 'grid' : 'none';
    if (resumeKitView) resumeKitView.style.display = target === 'resume-kit' ? 'flex' : 'none';
    if (resumeView) resumeView.style.display = target === 'resume' ? 'block' : 'none';
    if (builderView) builderView.style.display = target === 'builder' ? 'block' : 'none';
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-view');
      switchSampleTab(target);
    });
  });

  // Role ATS Resume Bullets Data
  const roleBullets = {
    fullstack: [
      {
        tag: 'REAL-TIME SSE PIPELINE',
        text: 'Architected real-time cloud operations dashboard using Python (ThreadingHTTPServer) and Server-Sent Events (SSE) streaming live telemetry to 500+ client sessions with sub-15ms edge latency.',
      },
      {
        tag: 'CHAOS SIMULATION',
        text: 'Engineered interactive chaos engineering and dynamic load-simulation controls, enabling users to inject traffic surges (+10k req/s) and observe automated cluster failovers in real time.',
      },
      {
        tag: 'ZERO-DEPENDENCY BACKEND',
        text: 'Implemented zero-external-dependency RESTful microservice in Python standard library handling asynchronous lead ingestion, SSE streaming, and an AI multi-lingual architecture advisor.',
      },
      {
        tag: 'HIGH-PERFORMANCE DATA VIZ',
        text: 'Crafted a responsive, dark-mode glassmorphic frontend utilizing modern CSS variables, semantic HTML5, and HTML Canvas for 60fps real-time data visualization.',
      },
    ],
    backend: [
      {
        tag: 'CONCURRENCY & THREADING',
        text: 'Engineered high-concurrency event-driven streaming server using Python standard library threading sockets, maintaining thread safety with lock-protected state engines.',
      },
      {
        tag: 'FAULT TOLERANCE',
        text: 'Designed fault-tolerant SSE streaming protocol with automatic client reconnection, heartbeat detection, and graceful handling of network drops (WinError 10053 / BrokenPipe).',
      },
      {
        tag: 'DISTRIBUTED SIMULATION',
        text: 'Built dynamic simulation engine calculating real-time cluster metrics (P99 latency, cost arbitrage, SLO compliance, and threat mitigation) across 5 global simulated regions.',
      },
      {
        tag: 'ZERO LATENCY OVERHEAD',
        text: 'Optimized HTTP request/response cycle, achieving sub-2ms JSON serialization overhead without relying on third-party frameworks.',
      },
    ],
    devops: [
      {
        tag: 'MULTI-CLOUD TOPOLOGY',
        text: 'Simulated enterprise multi-region cloud topology (AWS, GCP, Azure) featuring automated zero-trust WAF filtering, DDoS mitigation, and canary release workflows.',
      },
      {
        tag: 'SYSTEM DIAGNOSTICS',
        text: 'Created comprehensive health check and runtime diagnostic API (/api/system-status) exposing thread count, memory profile, uptime, and active telemetry streams.',
      },
      {
        tag: 'AUTOMATED FAILOVER',
        text: 'Designed an architecture playbook for automated failovers, shifting traffic from degraded availability zones (us-east-1) to healthy redundant clusters within 1 cycle.',
      },
      {
        tag: 'CANARY WORKFLOWS',
        text: 'Constructed canary release automation pipeline with progressive traffic routing (10% to 100%) and automatic rollback triggers based on error rate thresholds.',
      },
    ],
  };

  const atsBulletsGrid = document.getElementById('atsBulletsGrid');
  let currentRole = 'fullstack';

  function renderAtsBullets(role) {
    if (!atsBulletsGrid) return;
    const bullets = roleBullets[role] || roleBullets.fullstack;

    atsBulletsGrid.innerHTML = bullets
      .map(
        (b) => `
      <div class="ats-bullet-card">
        <div class="ats-bullet-text">
          <span class="ats-bullet-tag">${b.tag}</span>
          ${b.text}
        </div>
        <button class="copy-bullet-btn" data-text="${escapeQuotes(b.text)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <span>Copy</span>
        </button>
      </div>
    `
      )
      .join('');

    // Attach copy handlers
    atsBulletsGrid.querySelectorAll('.copy-bullet-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const text = btn.getAttribute('data-text');
        copyToClipboard(text);
        if (window.toffeeToast) {
          window.toffeeToast('Copied bullet to clipboard! Ready to paste in your resume.', '📋');
        }
      });
    });
  }

  function escapeQuotes(str) {
    return str.replace(/"/g, '&quot;');
  }

  // Wire up Role Tab Buttons
  document.querySelectorAll('.role-tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.role-tab-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      currentRole = btn.getAttribute('data-role');
      renderAtsBullets(currentRole);
    });
  });

  // Copy All Bullets Button
  const btnCopyAll = document.getElementById('btnCopyAllBullets');
  if (btnCopyAll) {
    btnCopyAll.addEventListener('click', () => {
      const bullets = roleBullets[currentRole] || roleBullets.fullstack;
      const combined = bullets.map((b) => `• ${b.text}`).join('\n\n');
      copyToClipboard(combined);
      if (window.toffeeToast) {
        window.toffeeToast(`Copied all ${bullets.length} bullets to clipboard!`, '📋');
      }
    });
  }

  // Copy Pitch Button
  const btnCopyPitch = document.getElementById('btnCopyPitch');
  const pitchTextEl = document.getElementById('pitchText');
  if (btnCopyPitch && pitchTextEl) {
    btnCopyPitch.addEventListener('click', () => {
      copyToClipboard(pitchTextEl.textContent.trim());
      if (window.toffeeToast) {
        window.toffeeToast('Copied 2-Minute Interview Pitch to clipboard!', '⭐');
      }
    });
  }

  // Print Resume Kit Button
  const btnPrintKit = document.getElementById('btnPrintResumeKit');
  if (btnPrintKit) {
    btnPrintKit.addEventListener('click', () => {
      window.print();
    });
  }

  // Render Interview FAQs Accordions
  const interviewFaqs = [
    {
      q: 'Why did you choose Server-Sent Events (SSE) over WebSockets for this telemetry platform?',
      a: 'Telemetry is inherently server-to-client streaming. Server-Sent Events run over standard HTTP (HTTP/1.1 or HTTP/2), requiring no custom protocol handshakes like WebSockets. SSE provides native automatic client reconnection, simple UTF-8 text framing, and easily traverses corporate proxies and firewalls without connection termination issues. It is significantly more lightweight and battery-friendly for browser clients.',
    },
    {
      q: 'How does the Python server handle high concurrency without external async frameworks?',
      a: 'We leverage Python’s native `ThreadingHTTPServer` from the standard `http.server` library. Each incoming HTTP request and long-lived SSE stream is assigned a dedicated lightweight OS thread. Synchronization between the control API (`/api/control`) and active SSE streams is managed via atomic lock protection (`threading.Lock`), ensuring thread-safe state mutations with zero race conditions.',
    },
    {
      q: 'How did you handle client disconnections without leaking threads or memory?',
      a: 'In long-lived streaming loops, when a user closes their browser tab or refreshes, sockets raise OS-level signals such as `BrokenPipeError`, `ConnectionResetError`, or Windows `ConnectionAbortedError [WinError 10053]`. We wrap the stream loop in dedicated exception handlers that detect socket termination immediately, unregister the stream from active counters, and cleanly release socket buffers without throwing unhandled exceptions or leaking server threads.',
    },
    {
      q: 'Why build with zero external pip dependencies?',
      a: 'Zero external dependencies guarantees 100% portability and instant execution: any recruiter, interviewer, or container environment can run `python app.py` on any Python 3.10+ installation worldwide without `pip install` failures, conflicting version wheels, or supply-chain security vulnerabilities.',
    },
  ];

  const interviewFaqList = document.getElementById('interviewFaqList');
  if (interviewFaqList) {
    interviewFaqList.innerHTML = interviewFaqs
      .map(
        (faq, idx) => `
      <div class="interview-faq-item ${idx === 0 ? 'is-open' : ''}">
        <button class="interview-faq-trigger" type="button">
          <span>${idx + 1}. ${faq.q}</span>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="interview-faq-body">
          <p>${faq.a}</p>
        </div>
      </div>
    `
      )
      .join('');

    interviewFaqList.querySelectorAll('.interview-faq-trigger').forEach((trigger) => {
      trigger.addEventListener('click', () => {
        const item = trigger.parentElement;
        item.classList.toggle('is-open');
      });
    });
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
  }

  // Initial render
  renderAtsBullets('fullstack');

  // Case Study Data for Modal
  const caseStudies = {
    cloudscale: {
      title: 'CloudScale AI - Autonomous Multi-Cloud Orchestration',
      tagline: 'Enterprise Cloud Fleet Management with Autonomous Cost Optimizer',
      role: 'Lead Full-Stack & Systems Architect',
      timeline: '2024 - 2025',
      metrics: [
        { label: 'Cloud Bill Reduction', val: '-44%' },
        { label: 'Nodes Managed', val: '250,000+' },
        { label: 'Cluster Provisioning Time', val: '1.2s' },
      ],
      description:
        'Architected an enterprise-scale distributed orchestration platform that autonomously redistributes compute workloads across AWS, Google Cloud, and Azure based on real-time spot pricing and carbon intensity metrics.',
      techStack: ['Python', 'ThreadingHTTPServer', 'SSE', 'TypeScript', 'Docker', 'PostgreSQL', 'Redis'],
      highlights: [
        'Built real-time telemetry streaming engine processing over 120,000 telemetry events per second via SSE channels.',
        'Designed SOC-2 Type II compliant role-based access control with biometric & hardware key multi-factor authentication.',
        'Scaled to 40+ Enterprise Tier customers including several Y-Combinator unicorns.',
      ],
    },
    finflow: {
      title: 'FinFlow Metrics - Real-time SaaS Revenue & Churn Analytics',
      tagline: 'Instant ARR Forecasting, Stripe/Paddle Integration, and Churn Prevention',
      role: 'Principal SaaS Engineer',
      timeline: '2023 - 2024',
      metrics: [
        { label: 'MRR Tracked', val: '$85M+' },
        { label: 'Sync Latency', val: '< 200ms' },
        { label: 'Customer Retention Lift', val: '+28%' },
      ],
      description:
        'Developed a mission-critical financial analytics engine that aggregates real-time subscription events, cohort retention metrics, and churn warning signals with sub-second dashboard rendering.',
      techStack: ['Python', 'ClickHouse', 'TimescaleDB', 'Docker', 'Stripe API', 'Chart.js'],
      highlights: [
        'Implemented high-throughput ClickHouse column-store database queries reducing dashboard load time from 4.8s to 85ms.',
        'Engineered predictive churn warning machine-learning heuristic with 91% precision.',
        'Automated dunning recovery sequences that reclaimed $1.4M in overdue SaaS receivables.',
      ],
    },
    hypersecure: {
      title: 'HyperSecure - Zero-Trust Identity & API Security Gateway',
      tagline: 'Distributed Edge WAF with Autonomous Anomaly Detection',
      role: 'Staff Security & Backend Engineer',
      timeline: '2023',
      metrics: [
        { label: 'Threats Blocked/Day', val: '4.2M' },
        { label: 'Global Edge PoPs', val: '140+' },
        { label: 'P99 Edge Overhead', val: '< 2.4ms' },
      ],
      description:
        'Constructed a global zero-trust edge security gateway that intercepts malicious bot traffic, prevents DDoS attacks, and provides unified developer API token management across multi-region clusters.',
      techStack: ['Python', 'Rust', 'WebAssembly', 'Cloudflare Workers', 'eBPF'],
      highlights: [
        'Wrote custom edge filters running with zero cold-start penalty.',
        'Integrated automated OAuth2/OIDC token exchange and JWT verification supporting 50M daily calls.',
        'Achieved ISO 27001 and FedRAMP readiness standards.',
      ],
    },
    pulsedesk: {
      title: 'PulseDesk - AI Customer Support & Omnichannel CRM',
      tagline: 'Autonomous Support Agents with Real-time Human Hand-off',
      role: 'Founding Engineer & UI/UX Lead',
      timeline: '2022 - 2023',
      metrics: [
        { label: 'Tickets Auto-Resolved', val: '64%' },
        { label: 'Avg First Response', val: '4 sec' },
        { label: 'CSAT Improvement', val: '4.9 / 5.0' },
      ],
      description:
        'Spearheaded the engineering and user experience of an omnichannel customer support SaaS platform integrating email, chat, WhatsApp, and voice with generative AI co-pilots.',
      techStack: ['Python', 'FastAPI', 'Vue 3', 'OpenAI API', 'PostgreSQL', 'WebRTC'],
      highlights: [
        'Engineered an ultra-responsive split-screen workspace allowing support agents to triage 3x more inquiries per hour.',
        'Implemented semantic RAG vector retrieval indexing over 500,000 knowledge base articles.',
        'Acquired by an enterprise CRM suite for 8-figure valuation in late 2023.',
      ],
    },
  };

  // Case Study Modal Trigger
  const modalOverlay = document.getElementById('caseStudyModal');
  const modalTitle = document.getElementById('modalCaseTitle');
  const modalTagline = document.getElementById('modalCaseTagline');
  const modalRole = document.getElementById('modalCaseRole');
  const modalMetrics = document.getElementById('modalCaseMetrics');
  const modalDesc = document.getElementById('modalCaseDesc');
  const modalTech = document.getElementById('modalCaseTech');
  const modalHighlights = document.getElementById('modalCaseHighlights');

  document.querySelectorAll('.open-case-study-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const studyKey = btn.getAttribute('data-case');
      const data = caseStudies[studyKey];
      if (!data || !modalOverlay) return;

      modalTitle.innerText = data.title;
      modalTagline.innerText = data.tagline;
      modalRole.innerText = `${data.role} - ${data.timeline}`;
      modalDesc.innerText = data.description;

      modalMetrics.innerHTML = data.metrics
        .map(
          (m) => `
        <div style="background: var(--bg-tertiary); padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); text-align: center;">
          <div style="font-size: 1.4rem; font-weight: 800; color: var(--accent-emerald);">${m.val}</div>
          <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">${m.label}</div>
        </div>
      `
        )
        .join('');

      modalTech.innerHTML = data.techStack
        .map((t) => `<span class="skill-pill" style="border-color: var(--primary); color: var(--primary-light);">${t}</span>`)
        .join('');

      modalHighlights.innerHTML = data.highlights.map((h) => `<li>${h}</li>`).join('');

      modalOverlay.classList.add('open');
    });
  });

  // Printable Resume Export Button Handler
  const printResumeBtn = document.getElementById('printResumeBtn');
  if (printResumeBtn) {
    printResumeBtn.addEventListener('click', () => {
      document.body.classList.add('printing-demo-resume');
      window.print();
    });
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-demo-resume');
  });
})();
