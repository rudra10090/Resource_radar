/**
 * ResourceRadar - Main Interactive Client Scripts
 * Smooth mobile navigation, scroll-triggered animations, and live stats counter.
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileNav();
  initScrollAnimations();
  initStatsCounter();
  initReportCardMenus();
  initReportInstituteFilter();
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

/**
 * Real-time Report Filter by Institute
 */
function initReportInstituteFilter() {
  const filterWrapper = document.getElementById('reports-filter-wrapper');
  const toggleBtn = document.getElementById('filter-dropdown-toggle');
  const dropdown = document.getElementById('institute-filter-dropdown');
  const closeBtn = document.getElementById('filter-close-btn');
  const searchInput = document.getElementById('institute-search-input');
  const optionsList = document.getElementById('filter-options-list');
  const resetBtn = document.getElementById('btn-reset-filter');
  const activeBar = document.getElementById('active-filter-bar');
  const activeNameEl = document.getElementById('active-filter-name');
  const activeCountEl = document.getElementById('active-filter-count');
  const removeFilterBtn = document.getElementById('btn-remove-filter');
  const activePill = document.getElementById('filter-active-pill');
  const emptyStateCard = document.getElementById('filter-empty-state');
  const emptyClearBtn = document.getElementById('btn-empty-clear-filter');
  const reportsContainer = document.getElementById('reports-container');

  if (!filterWrapper || !toggleBtn || !dropdown || !reportsContainer) {
    return;
  }

  let currentFilter = 'ALL';
  const reportCards = Array.from(reportsContainer.querySelectorAll('.report-card'));

  // Ensure options list contains all unique institutes found in existing cards
  syncInstituteOptions();

  // Dropdown open/close handlers
  function openDropdown() {
    dropdown.classList.add('is-open');
    toggleBtn.setAttribute('aria-expanded', 'true');
    if (searchInput) {
      searchInput.value = '';
      filterOptions('');
      setTimeout(() => searchInput.focus(), 80);
    }
  }

  function closeDropdown() {
    dropdown.classList.remove('is-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
  }

  function toggleDropdown() {
    const isOpen = dropdown.classList.contains('is-open');
    if (isOpen) {
      closeDropdown();
    } else {
      openDropdown();
    }
  }

  toggleBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdown();
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeDropdown();
    });
  }

  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (
      dropdown.classList.contains('is-open') &&
      !filterWrapper.contains(e.target)
    ) {
      closeDropdown();
    }
  });

  // Close on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dropdown.classList.contains('is-open')) {
      closeDropdown();
      toggleBtn.focus();
    }
  });

  // Live search inside dropdown
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterOptions(searchInput.value.trim().toLowerCase());
    });
  }

  function filterOptions(query) {
    const optionItems = optionsList.querySelectorAll('.filter-option-item');
    const noResultsEl = document.getElementById('filter-search-no-results');
    let visibleCount = 0;

    optionItems.forEach((opt) => {
      const isAllOption = opt.getAttribute('data-value') === 'ALL';
      const nameEl = opt.querySelector('.option-name');
      const text = nameEl ? nameEl.textContent.trim().toLowerCase() : '';

      if (!query || isAllOption || text.includes(query)) {
        opt.style.display = '';
        visibleCount++;
      } else {
        opt.style.display = 'none';
      }
    });

    if (noResultsEl) {
      noResultsEl.style.display = visibleCount === 0 ? 'block' : 'none';
    }
  }

  // Sync institute options from DOM cards in case SSR had empty/partial data
  function syncInstituteOptions() {
    if (!optionsList) return;

    // Count institutes directly from DOM cards
    const counts = {};
    reportCards.forEach((card) => {
      const inst = (card.getAttribute('data-institute') || '').trim();
      if (inst) {
        counts[inst] = (counts[inst] || 0) + 1;
      }
    });

    // Update 'All Institutes' count
    const countAllEl = document.getElementById('count-all');
    if (countAllEl) {
      countAllEl.textContent = reportCards.length;
    }

    // If there are no pre-rendered options other than ALL, dynamically create them
    const existingOptions = optionsList.querySelectorAll('.filter-option-item:not(#opt-all)');
    if (existingOptions.length === 0 && Object.keys(counts).length > 0) {
      const noResultsEl = document.getElementById('filter-search-no-results');
      Object.keys(counts).sort().forEach((inst) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-option-item';
        btn.setAttribute('data-value', inst);
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', 'false');
        btn.title = inst;
        btn.innerHTML = `
          <span class="option-radio-dot" aria-hidden="true"></span>
          <span class="option-name">${escapeHtml(inst)}</span>
          <span class="option-count">${counts[inst]}</span>
        `;
        if (noResultsEl) {
          optionsList.insertBefore(btn, noResultsEl);
        } else {
          optionsList.appendChild(btn);
        }
      });
    }

    bindOptionClicks();
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function bindOptionClicks() {
    const optionItems = optionsList.querySelectorAll('.filter-option-item');
    optionItems.forEach((opt) => {
      // Remove any existing listener by cloning or direct assignment
      opt.onclick = () => {
        const selectedValue = opt.getAttribute('data-value') || 'ALL';
        applyFilter(selectedValue);
        closeDropdown();
      };
    });
  }

  // Core real-time filter function
  function applyFilter(instituteName) {
    currentFilter = instituteName;
    const isAll = !instituteName || instituteName === 'ALL';
    let visibleReportsCount = 0;

    reportCards.forEach((card) => {
      const cardInst = (card.getAttribute('data-institute') || '').trim();
      const matches = isAll || cardInst.toLowerCase() === instituteName.toLowerCase();

      if (matches) {
        card.classList.remove('is-filtered-out');
        visibleReportsCount++;
      } else {
        card.classList.add('is-filtered-out');
      }
    });

    // Update options selection state
    const optionItems = optionsList.querySelectorAll('.filter-option-item');
    optionItems.forEach((opt) => {
      const optVal = opt.getAttribute('data-value');
      const matchesActive = (isAll && optVal === 'ALL') || (!isAll && optVal.toLowerCase() === instituteName.toLowerCase());

      if (matchesActive) {
        opt.classList.add('is-active');
        opt.setAttribute('aria-selected', 'true');
      } else {
        opt.classList.remove('is-active');
        opt.setAttribute('aria-selected', 'false');
      }
    });

    // Update active filter badge & button state
    if (isAll) {
      if (activeBar) activeBar.style.display = 'none';
      if (activePill) activePill.style.display = 'none';
      toggleBtn.classList.remove('has-active-filter');
    } else {
      if (activeBar) activeBar.style.display = 'flex';
      if (activeNameEl) activeNameEl.textContent = instituteName;
      if (activeCountEl) {
        activeCountEl.textContent = `(${visibleReportsCount} report${visibleReportsCount === 1 ? '' : 's'})`;
      }
      if (activePill) {
        activePill.style.display = 'inline-flex';
        activePill.textContent = '1';
      }
      toggleBtn.classList.add('has-active-filter');
    }

    // Toggle filter empty state
    if (emptyStateCard) {
      emptyStateCard.style.display = visibleReportsCount === 0 ? 'block' : 'none';
    }
  }

  // Clear / Reset triggers
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      applyFilter('ALL');
      closeDropdown();
    });
  }

  if (removeFilterBtn) {
    removeFilterBtn.addEventListener('click', () => {
      applyFilter('ALL');
    });
  }

  if (emptyClearBtn) {
    emptyClearBtn.addEventListener('click', () => {
      applyFilter('ALL');
    });
  }
}

