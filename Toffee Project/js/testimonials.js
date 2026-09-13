/* ==========================================================================
   Testimonial Carousel & Review Slider
   ========================================================================== */

(function () {
  const track = document.getElementById('testimonialTrack');
  const prevBtn = document.getElementById('prevTestimonial');
  const nextBtn = document.getElementById('nextTestimonial');
  const dotsContainer = document.getElementById('testimonialDots');

  if (!track) return;

  const slides = track.querySelectorAll('.testimonial-slide');
  let currentIndex = 0;
  let autoPlayTimer = null;

  // Render Dots
  if (dotsContainer) {
    dotsContainer.innerHTML = '';
    slides.forEach((_, idx) => {
      const dot = document.createElement('div');
      dot.className = `slider-dot ${idx === 0 ? 'active' : ''}`;
      dot.addEventListener('click', () => {
        goToSlide(idx);
        resetAutoPlay();
      });
      dotsContainer.appendChild(dot);
    });
  }

  function updateSlideVisibility() {
    slides.forEach((slide, idx) => {
      slide.style.display = idx === currentIndex ? 'block' : 'none';
      slide.classList.toggle('active', idx === currentIndex);
    });

    if (dotsContainer) {
      const dots = dotsContainer.querySelectorAll('.slider-dot');
      dots.forEach((dot, idx) => {
        dot.classList.toggle('active', idx === currentIndex);
      });
    }
  }

  function goToSlide(index) {
    currentIndex = (index + slides.length) % slides.length;
    updateSlideVisibility();
  }

  function nextSlide() {
    goToSlide(currentIndex + 1);
  }

  function prevSlide() {
    goToSlide(currentIndex - 1);
  }

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      nextSlide();
      resetAutoPlay();
    });
  }

  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      prevSlide();
      resetAutoPlay();
    });
  }

  function startAutoPlay() {
    autoPlayTimer = setInterval(nextSlide, 6500);
  }

  function resetAutoPlay() {
    clearInterval(autoPlayTimer);
    startAutoPlay();
  }

  // Initial
  updateSlideVisibility();
  startAutoPlay();
})();
