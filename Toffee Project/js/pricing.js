/* ==========================================================================
   Pricing Toggle & Plan Selector Module
   ========================================================================== */

(function () {
  const billingToggle = document.getElementById('billingToggle');
  const starterPrice = document.getElementById('priceStarter');
  const growthPrice = document.getElementById('priceGrowth');
  const enterprisePrice = document.getElementById('priceEnterprise');
  const starterPeriod = document.getElementById('periodStarter');
  const growthPeriod = document.getElementById('periodGrowth');
  const enterprisePeriod = document.getElementById('periodEnterprise');

  let isAnnual = true;

  const prices = {
    monthly: {
      starter: '$39',
      growth: '$99',
      enterprise: '$299',
      period: '/month, billed monthly',
    },
    annual: {
      starter: '$29',
      growth: '$74',
      enterprise: '$224',
      period: '/month, billed annually (Save 25%)',
    },
  };

  function updatePricing() {
    const tier = isAnnual ? prices.annual : prices.monthly;

    if (starterPrice) starterPrice.innerText = tier.starter;
    if (growthPrice) growthPrice.innerText = tier.growth;
    if (enterprisePrice) enterprisePrice.innerText = tier.enterprise;

    if (starterPeriod) starterPeriod.innerText = tier.period;
    if (growthPeriod) growthPeriod.innerText = tier.period;
    if (enterprisePeriod) enterprisePeriod.innerText = tier.period;

    if (billingToggle) {
      if (isAnnual) {
        billingToggle.classList.add('active');
      } else {
        billingToggle.classList.remove('active');
      }
    }
  }

  if (billingToggle) {
    billingToggle.addEventListener('click', () => {
      isAnnual = !isAnnual;
      updatePricing();
    });
  }

  // Quick Select Buttons
  document.querySelectorAll('.select-plan-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const planName = btn.getAttribute('data-plan') || 'Growth Plan';
      const demoModal = document.getElementById('demoBookingModal');
      const planSelectInput = document.getElementById('demoPlanInterest');

      if (planSelectInput) {
        planSelectInput.value = planName;
      }

      if (demoModal) {
        demoModal.classList.add('open');
      }
    });
  });

  // Initial update
  updatePricing();
})();
