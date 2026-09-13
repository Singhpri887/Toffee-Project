/* ==========================================================================
   Main Application Script - Toffee SaaS Platform
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Sticky Navbar on Scroll
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      navbar.classList.add('scrolled');
    } else {
      navbar.classList.remove('scrolled');
    }
  });

  // 2. Mobile Navigation Toggle
  const mobileToggle = document.querySelector('.mobile-nav-toggle');
  const navLinks = document.querySelector('.nav-links');

  if (mobileToggle && navLinks) {
    mobileToggle.addEventListener('click', () => {
      navLinks.classList.toggle('mobile-open');
      const isOpen = navLinks.classList.contains('mobile-open');
      mobileToggle.innerHTML = isOpen
        ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
        : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
    });

    // Close on link click
    navLinks.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('mobile-open');
        mobileToggle.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
      });
    });
  }

  // 3. Scroll Reveal Animations
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    },
    { threshold: 0.1 }
  );

  document.querySelectorAll('.fade-in-up').forEach((el) => observer.observe(el));

  // 4. FAQ Accordion & Live Filter
  const faqItems = document.querySelectorAll('.faq-accordion-item');
  faqItems.forEach((item) => {
    const header = item.querySelector('.faq-accordion-header');
    const body = item.querySelector('.faq-accordion-body');

    header.addEventListener('click', () => {
      const isActive = item.classList.contains('active');

      // Close all others
      faqItems.forEach((other) => {
        other.classList.remove('active');
        const otherBody = other.querySelector('.faq-accordion-body');
        if (otherBody) otherBody.style.maxHeight = null;
      });

      if (!isActive) {
        item.classList.add('active');
        body.style.maxHeight = body.scrollHeight + 30 + 'px';
      }
    });
  });

  // FAQ Live Search
  const faqSearchInput = document.getElementById('faqSearch');
  if (faqSearchInput) {
    faqSearchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      faqItems.forEach((item) => {
        const text = item.textContent.toLowerCase();
        if (text.includes(term)) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  }

  // 5. Scroll Spy for Navigation Active State
  const sections = document.querySelectorAll('section[id]');
  window.addEventListener('scroll', () => {
    const scrollY = window.pageYOffset;
    sections.forEach((section) => {
      const sectionHeight = section.offsetHeight;
      const sectionTop = section.offsetTop - 120;
      const sectionId = section.getAttribute('id');
      const navLink = document.querySelector(`.nav-links a[href*='${sectionId}']`);

      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        if (navLink) navLink.classList.add('active');
      } else {
        if (navLink) navLink.classList.remove('active');
      }
    });
  });
});
