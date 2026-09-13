/* ==========================================================================
   Dynamic ROI & Cost-Savings Calculator
   ========================================================================== */

(function () {
  const teamSizeSlider = document.getElementById('teamSizeRange');
  const spendSlider = document.getElementById('monthlySpendRange');
  const teamSizeVal = document.getElementById('teamSizeValue');
  const spendVal = document.getElementById('spendValue');

  const annualSavingsEl = document.getElementById('roiAnnualSavings');
  const hoursReclaimedEl = document.getElementById('roiHoursReclaimed');
  const roiMultiplierEl = document.getElementById('roiMultiplier');
  const paybackPeriodEl = document.getElementById('roiPaybackPeriod');

  if (!teamSizeSlider || !spendSlider) return;

  function animateValue(element, start, end, duration, formatFn) {
    if (!element) return;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * easeProgress;

      element.innerText = formatFn ? formatFn(current) : Math.round(current);

      if (progress < 1) {
        requestAnimationFrame(update);
      }
    }

    requestAnimationFrame(update);
  }

  let prevSavings = 0;
  let prevHours = 0;

  function calculateROI() {
    const teamSize = parseInt(teamSizeSlider.value, 10);
    const monthlySpend = parseInt(spendSlider.value, 10);

    // Update labels
    if (teamSizeVal) teamSizeVal.innerText = `${teamSize} Engineers / Ops`;
    if (spendVal) spendVal.innerText = `$${monthlySpend.toLocaleString()}/mo`;

    // Mathematical formula for SaaS automation efficiency:
    // Average 15 hours saved per engineer/month
    const hoursSavedPerMonth = teamSize * 18.5;
    // Blended hourly rate $65/hr + 40% reduction in SaaS tool stack redundancies
    const opsSavingsMonthly = (hoursSavedPerMonth * 65) + (monthlySpend * 0.35);
    const annualSavings = opsSavingsMonthly * 12;

    // Toffee platform cost estimate based on team tier
    const toffeeCostAnnual = Math.max(1200, teamSize * 45 * 12);
    const netMultiplier = (annualSavings / toffeeCostAnnual).toFixed(1);
    const paybackMonths = ((toffeeCostAnnual / (annualSavings / 12))).toFixed(1);

    // Animate to targets
    animateValue(annualSavingsEl, prevSavings, annualSavings, 600, (val) => `$${Math.round(val).toLocaleString()}`);
    animateValue(hoursReclaimedEl, prevHours, hoursSavedPerMonth, 600, (val) => `${Math.round(val).toLocaleString()} hrs`);

    if (roiMultiplierEl) roiMultiplierEl.innerText = `${netMultiplier}x ROI`;
    if (paybackPeriodEl) paybackPeriodEl.innerText = `${paybackMonths} Months`;

    prevSavings = annualSavings;
    prevHours = hoursSavedPerMonth;
  }

  teamSizeSlider.addEventListener('input', calculateROI);
  spendSlider.addEventListener('input', calculateROI);

  // Initial Calculation
  calculateROI();
})();
