/**
 * ResourceRadar - Main Interactive Client Scripts
 * Smooth mobile navigation, scroll-triggered animations, and live stats counter.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initScrollAnimations();
  initStatsCounter();
  initReportCardMenus();
});

/**
 * Mobile Hamburger Menu Toggle with smooth transition
 */
function initMobileNav() {
  const toggleBtn = document.querySelector('.nav-toggle');
  const mobileMenu = document.querySelector('.mobile-nav-menu');

  if (!toggleBtn || !mobileMenu) return;

  function toggleMenu(forceClose = false) {
    const isExpanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    const shouldOpen = forceClose ? false : !isExpanded;

    toggleBtn.setAttribute('aria-expanded', String(shouldOpen));

    if (shouldOpen) {
      mobileMenu.classList.add('is-open');
    } else {
      mobileMenu.classList.remove('is-open');
    }
  }

  toggleBtn.addEventListener('click', () => toggleMenu());

  // Close when clicking any nav link inside mobile menu
  const mobileLinks = mobileMenu.querySelectorAll('.mobile-link');
  mobileLinks.forEach((link) => {
    link.addEventListener('click', () => {
      toggleMenu(true);
    });
  });

  // Close mobile menu if resized to desktop view
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      toggleMenu(true);
    }
  });

  // Close menu when clicking outside
  document.addEventListener('click', (e) => {
    if (
      toggleBtn.getAttribute('aria-expanded') === 'true' &&
      !toggleBtn.contains(e.target) &&
      !mobileMenu.contains(e.target)
    ) {
      toggleMenu(true);
    }
  });
}

/**
 * Scroll Fade-in Animation using IntersectionObserver
 */
function initScrollAnimations() {
  const animatedElements = document.querySelectorAll('.scroll-fade');
  if (!animatedElements.length) return;

  // If user prefers reduced motion or browser doesn't support IntersectionObserver
  if (
    window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
    !('IntersectionObserver' in window)
  ) {
    animatedElements.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        }
      });
    },
    {
      root: null,
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  animatedElements.forEach((el) => observer.observe(el));
}

/**
 * Animated Number Counter for Live Stats Section
 */
function initStatsCounter() {
  const statsSection = document.querySelector('.stats-section');
  const counterElements = document.querySelectorAll('.stat-number');

  if (!statsSection || !counterElements.length) return;

  let hasAnimated = false;

  function animateNumbers() {
    if (hasAnimated) return;
    hasAnimated = true;

    const duration = 1600; // milliseconds

    counterElements.forEach((el) => {
      const target = parseInt(el.getAttribute('data-target'), 10) || 0;
      const startTime = performance.now();

      function updateCounter(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out cubic: fast start, soft settle
        const easeOutProgress = 1 - Math.pow(1 - progress, 3);
        const currentCount = Math.floor(easeOutProgress * target);

        el.textContent = currentCount.toLocaleString();

        if (progress < 1) {
          requestAnimationFrame(updateCounter);
        } else {
          el.textContent = target.toLocaleString();
        }
      }

      requestAnimationFrame(updateCounter);
    });
  }

  // If reduced motion is preferred, set targets immediately
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    counterElements.forEach((el) => {
      el.textContent = el.getAttribute('data-target') || '0';
    });
    return;
  }

  // Trigger when stats section enters viewport
  if ('IntersectionObserver' in window) {
    const statsObserver = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            animateNumbers();
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.2,
      }
    );

    statsObserver.observe(statsSection);
  } else {
    // Fallback
    animateNumbers();
  }
}

/**
 * Report Card Three-Dot Dropdown Menus
 */
function initReportCardMenus() {
  document.addEventListener('click', (e) => {
    const toggleBtn = e.target.closest('.btn-report-menu');
    const allDropdowns = document.querySelectorAll('.report-dropdown-menu.is-open');
    const allToggleBtns = document.querySelectorAll('.btn-report-menu[aria-expanded="true"]');

    if (toggleBtn) {
      const menuContainer = toggleBtn.closest('.report-menu-container');
      const targetMenu = menuContainer ? menuContainer.querySelector('.report-dropdown-menu') : null;
      const wasOpen = targetMenu && targetMenu.classList.contains('is-open');

      // Close any other open dropdowns
      allDropdowns.forEach((d) => d.classList.remove('is-open'));
      allToggleBtns.forEach((b) => b.setAttribute('aria-expanded', 'false'));

      if (!wasOpen && targetMenu) {
        targetMenu.classList.add('is-open');
        toggleBtn.setAttribute('aria-expanded', 'true');
      }
      return;
    }

    // If clicked inside an open dropdown menu, let links trigger normally
    if (e.target.closest('.report-dropdown-menu')) {
      return;
    }

    // Clicked outside any menu: close all
    allDropdowns.forEach((d) => d.classList.remove('is-open'));
    allToggleBtns.forEach((b) => b.setAttribute('aria-expanded', 'false'));
  });
}
