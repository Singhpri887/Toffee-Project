document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('resumeBuilderForm');
  const printButton = document.getElementById('printBuilderResumeBtn');
  if (!form) return;

  const fields = {
    name: document.getElementById('builderName'),
    title: document.getElementById('builderTitle'),
    email: document.getElementById('builderEmail'),
    location: document.getElementById('builderLocation'),
    summary: document.getElementById('builderSummary'),
    skills: document.getElementById('builderSkills'),
    experience: document.getElementById('builderExperience'),
    education: document.getElementById('builderEducation'),
    projects: document.getElementById('builderProjects'),
  };

  function updatePreview() {
    document.getElementById('previewName').textContent = fields.name.value || 'Your Name';
    document.getElementById('previewTitle').textContent = fields.title.value || 'Professional Title';
    document.getElementById('previewContact').textContent = [fields.email.value, fields.location.value].filter(Boolean).join(' | ');
    document.getElementById('previewSummary').textContent = fields.summary.value || 'Add a short professional summary.';
    document.getElementById('previewEducation').textContent = fields.education.value || 'Add your education.';

    renderLines('previewExperience', fields.experience.value, (line) => {
      const [role, company, dates] = line.split('|').map((part) => part.trim());
      return `<div class="builder-preview-item"><strong>${escapeHtml(role || line)}</strong><span>${escapeHtml([company, dates].filter(Boolean).join(' | '))}</span></div>`;
    });
    renderLines('previewProjects', fields.projects.value, (line) => `<div class="builder-preview-item">${escapeHtml(line)}</div>`);

    const skills = fields.skills.value.split(',').map((skill) => skill.trim()).filter(Boolean);
    document.getElementById('previewSkills').innerHTML = skills
      .map((skill) => `<span>${escapeHtml(skill)}</span>`)
      .join('');
  }

  function renderLines(targetId, value, renderer) {
    const lines = value.split('\n').map((line) => line.trim()).filter(Boolean);
    document.getElementById(targetId).innerHTML = lines.length ? lines.map(renderer).join('') : '<p class="builder-empty">Add details above.</p>';
  }

  function escapeHtml(value) {
    return value.replace(/[&<>"']/g, (character) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }[character]));
  }

  Object.values(fields).forEach((field) => field.addEventListener('input', updatePreview));
  if (printButton) {
    printButton.addEventListener('click', () => {
      document.body.classList.add('printing-builder-resume');
      openPrintPreview();
    });
  }

  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing-builder-resume');
  });

  function openPrintPreview() {
    const preview = document.getElementById('resumeBuilderPreview');
    const printWindow = window.open('', '_blank', 'width=900,height=1100');

    if (!printWindow) {
      window.print();
      return;
    }

    printWindow.document.write(`<!doctype html>
      <html><head><title>${escapeHtml(fields.name.value || 'Resume')}</title>
      <style>
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: #fff !important; color: #0f172a !important; }
        body { padding: 32px; font: 15px Arial, sans-serif; }
        article { max-width: 760px; margin: 0 auto; background: #fff !important; color: #0f172a !important; }
        article * { background: transparent !important; color: #0f172a !important; }
        header { border-bottom: 2px solid #4f46e5; padding-bottom: 18px; margin-bottom: 22px; }
        h2 { margin: 0 0 5px; font-size: 30px; }
        header p { margin: 0 0 6px; color: #4f46e5 !important; font-weight: 700; }
        header div, p, span { color: #334155; line-height: 1.6; }
        section { margin-bottom: 18px; }
        h4 { margin: 0 0 8px; color: #4f46e5 !important; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; }
        .builder-preview-item { display: grid; gap: 2px; padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
        .builder-preview-skills { display: flex; flex-wrap: wrap; gap: 7px; }
        .builder-preview-skills span { padding: 5px 9px; background: #f1f5f9 !important; border: 1px solid #cbd5e1; border-radius: 999px; }
        @media print { body { padding: 0; } }
      </style></head><body>${preview.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.addEventListener('afterprint', () => printWindow.close());
    setTimeout(() => printWindow.print(), 250);
  }
  updatePreview();
});
