/* ==========================================================================
   Interactive SaaS Playground & Workflow Sandbox
   ========================================================================== */

(function () {
  const triggerSelect = document.getElementById('sandboxTrigger');
  const actionSelect = document.getElementById('sandboxAction');
  const modelSelect = document.getElementById('sandboxModel');
  const runBtn = document.getElementById('sandboxRunBtn');
  const outputEl = document.getElementById('sandboxJsonOutput');
  const step1 = document.getElementById('wfStep1');
  const step2 = document.getElementById('wfStep2');
  const step3 = document.getElementById('wfStep3');

  if (!runBtn || !outputEl) return;

  const workflows = {
    'customer_signup': {
      label: 'New Customer Enterprise Signup',
      event: 'user.provisioning.started',
      data: {
        userId: 'usr_98a41df2',
        tier: 'Enterprise Scale',
        region: 'us-east-1',
        orgName: 'Acme Global Corp',
        allocatedCompute: '16 vCPU / 64GB Ram / Edge Replicas',
      },
      duration: '42ms',
    },
    'latency_alert': {
      label: 'Edge Latency Threshold Exceeded',
      event: 'infra.edge.latency_spike',
      data: {
        service: 'global-gateway',
        thresholdMs: 120,
        detectedP99: 184,
        autoReroute: 'eu-west-3 -> eu-central-1',
        resolvedTime: '12ms',
      },
      duration: '18ms',
    },
    'financial_anomaly': {
      label: 'Autonomous AI Fraud & Anomaly Audit',
      event: 'billing.transaction.audit',
      data: {
        transactionId: 'txn_8849201',
        amount: '$48,250.00 USD',
        riskScore: '0.02 (Safe)',
        complianceCheck: 'SOC-2 / PCI-DSS Certified',
        status: 'Auto-Approved',
      },
      duration: '35ms',
    },
  };

  let isRunning = false;

  runBtn.addEventListener('click', () => {
    if (isRunning) return;
    isRunning = true;
    runBtn.innerHTML = `<span class="pulse-dot"></span> Executing Pipeline...`;
    runBtn.style.opacity = '0.7';

    // Reset steps
    step1.classList.add('active-step');
    step2.classList.remove('active-step');
    step3.classList.remove('active-step');
    outputEl.textContent = '// Initializing Toffee Autonomous Pipeline Engine...\n// Connecting to Edge Cluster...';

    const currentTrigger = triggerSelect.value || 'customer_signup';
    const currentAction = actionSelect.value || 'ai_agent';
    const currentModel = modelSelect ? modelSelect.value : 'Toffee-Neural-v3';
    const wf = workflows[currentTrigger] || workflows['customer_signup'];

    setTimeout(() => {
      step1.classList.remove('active-step');
      step2.classList.add('active-step');
      outputEl.textContent = `// [Step 1 OK]: Ingested event "${wf.event}"\n// [Step 2]: Dispatching Autonomous Worker via ${currentModel}...\n// Synthesizing zero-latency security payload...`;
    }, 600);

    setTimeout(() => {
      step2.classList.remove('active-step');
      step3.classList.add('active-step');

      const responsePayload = {
        status: 'SUCCESS_200',
        timestamp: new Date().toISOString(),
        executionTime: wf.duration,
        pipelineId: 'pipe_' + Math.random().toString(36).substring(2, 10),
        engine: currentModel,
        actionTriggered: currentAction,
        telemetry: {
          cpuLoad: '14.2%',
          memoryAllocated: '320 MB',
          distributedNodes: 8,
          zeroTrustAudit: 'PASSED (100%)',
        },
        payloadResult: wf.data,
      };

      outputEl.textContent = JSON.stringify(responsePayload, null, 2);

      runBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg> Test Workflow Again`;
      runBtn.style.opacity = '1';
      isRunning = false;
    }, 1400);
  });
})();
