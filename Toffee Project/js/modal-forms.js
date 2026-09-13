/* ==========================================================================
   Modals & Form Submission Handling with Toast Feedback
   ========================================================================== */

(function () {
  const toastContainer = document.getElementById('toastContainer');

  // Helper: Show Toast
  window.showToast = function (message, type = 'success') {
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <div class="toast-icon">
        ${
          type === 'success'
            ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`
            : `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`
        }
      </div>
      <div>${message}</div>
    `;

    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4500);
  };

  async function submitLead(payload) {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Unable to submit the form');
    }
    return result;
  }

  // Generic Modal Close Handlers
  document.querySelectorAll('.modal-close-btn, .modal-overlay').forEach((elem) => {
    elem.addEventListener('click', (e) => {
      if (e.target === elem) {
        document.querySelectorAll('.modal-overlay').forEach((m) => m.classList.remove('open'));
      }
    });
  });

  // Open Demo Modal Triggers
  document.querySelectorAll('.open-demo-modal').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const demoModal = document.getElementById('demoBookingModal');
      if (demoModal) demoModal.classList.add('open');
    });
  });

  // Open Video Demo Modal Triggers
  document.querySelectorAll('.open-video-modal').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const videoModal = document.getElementById('videoDemoModal');
      if (videoModal) videoModal.classList.add('open');
    });
  });

  // Demo Booking Form Submit
  const demoForm = document.getElementById('demoBookingForm');
  if (demoForm) {
    demoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = demoForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.innerHTML = `<span class="pulse-dot"></span> Scheduling VIP Demo...`;
      submitBtn.disabled = true;

      try {
        const result = await submitLead({
          type: 'demo',
          name: document.getElementById('demoName').value,
          email: document.getElementById('demoEmail').value,
          company: document.getElementById('demoCompany').value,
          team_size: document.getElementById('demoTeamSize').value,
          plan: document.getElementById('demoPlanInterest').value,
          notes: document.getElementById('demoNotes').value,
        });
        window.dispatchEvent(new CustomEvent('leadSubmitted', { detail: result.lead }));
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        document.getElementById('demoBookingModal').classList.remove('open');
        demoForm.reset();
        window.showToast('Demo request received! We will contact you shortly.', 'success');
      } catch (error) {
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        window.showToast(error.message, 'error');
      }
    });
  }

  // Newsletter Form Submit
  const newsletterForms = document.querySelectorAll('.newsletter-form');
  newsletterForms.forEach((form) => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const input = form.querySelector('input[type="email"]');
      if (input && input.value) {
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        try {
          const result = await submitLead({ type: 'newsletter', email: input.value });
          window.dispatchEvent(new CustomEvent('leadSubmitted', { detail: result.lead }));
          input.value = '';
          window.showToast('Subscribed! You will receive our engineering breakdown.', 'success');
        } catch (error) {
          window.showToast(error.message, 'error');
        } finally {
          submitBtn.disabled = false;
        }
      }
    });
  });
})();
