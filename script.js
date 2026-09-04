(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPointerFine = window.matchMedia('(pointer: fine)').matches;

  // Safe storage wrappers to prevent SecurityError exceptions in sandboxed iframes or private browsing
  const safeSessionStorage = {
    getItem: (key) => {
      try {
        return window.sessionStorage ? window.sessionStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        if (window.sessionStorage) window.sessionStorage.setItem(key, value);
      } catch {}
    },
    removeItem: (key) => {
      try {
        if (window.sessionStorage) window.sessionStorage.removeItem(key);
      } catch {}
    }
  };

  const safeLocalStorage = {
    getItem: (key) => {
      try {
        return window.localStorage ? window.localStorage.getItem(key) : null;
      } catch {
        return null;
      }
    },
    setItem: (key, value) => {
      try {
        if (window.localStorage) window.localStorage.setItem(key, value);
      } catch {}
    },
    removeItem: (key) => {
      try {
        if (window.localStorage) window.localStorage.removeItem(key);
      } catch {}
    }
  };

  // 1. Cinematic Intro Sequence
  const intro = doc.querySelector('[data-intro]');
  if (intro) {
    const hasSeenIntro = safeSessionStorage.getItem('arkuzo_intro_seen');
    if (isReduced || hasSeenIntro) {
      intro.classList.add('done');
    } else {
      setTimeout(() => {
        intro.classList.add('done');
        safeSessionStorage.setItem('arkuzo_intro_seen', '1');
      }, 850);
    }
  }

  // 2. Navigation & Mobile Menu
  const header = doc.querySelector('[data-header]');
  const menuBtn = doc.querySelector('.menu-button');
  const navMenu = doc.querySelector('#nav-menu');
  const navLinks = navMenu ? Array.from(navMenu.querySelectorAll('a[href^="#"], a[href*="#"]')) : [];
  const navProgress = doc.getElementById('nav-progress');

  const updateProgress = () => {
    if (!navProgress) return;
    const scrollable = root.scrollHeight - window.innerHeight;
    if (scrollable > 0) {
      const pct = Math.min(100, Math.max(0, (window.scrollY / scrollable) * 100));
      navProgress.style.width = `${pct}%`;
    } else {
      navProgress.style.width = '0%';
    }
  };

  const updateHeader = () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 20);
    updateProgress();
  };
  window.addEventListener('scroll', updateHeader, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateHeader();

  if (menuBtn && navMenu) {
    const closeMenu = () => {
      navMenu.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      menuBtn.setAttribute('aria-label', 'Open navigation');
    };

    menuBtn.addEventListener('click', () => {
      const isOpen = menuBtn.getAttribute('aria-expanded') === 'true';
      navMenu.classList.toggle('open', !isOpen);
      menuBtn.setAttribute('aria-expanded', String(!isOpen));
      menuBtn.setAttribute('aria-label', isOpen ? 'Open navigation' : 'Close navigation');
    });

    navMenu.addEventListener('click', (e) => {
      if (e.target.closest('a')) closeMenu();
    });

    doc.addEventListener('click', (e) => {
      if (menuBtn.getAttribute('aria-expanded') === 'true') {
        if (!navMenu.contains(e.target) && !menuBtn.contains(e.target)) {
          closeMenu();
        }
      }
    });

    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        menuBtn.focus();
      }
    });
  }

  const launcherDialog = doc.getElementById('arkuzo-launcher');
  const launcherTrigger = doc.querySelector('.launcher-trigger');
  const launcherSearch = doc.getElementById('launcher-search');
  const launcherResults = doc.getElementById('launcher-results');
  const launcherEmpty = doc.getElementById('launcher-empty');
  const launcherCloseButtons = Array.from(doc.querySelectorAll('[data-launcher-close]'));
  const launcherItems = launcherResults ? Array.from(launcherResults.querySelectorAll('.launcher-item')) : [];

  if (launcherDialog && launcherSearch && launcherResults && launcherItems.length) {
    let lastActiveElement = null;
    let visibleItems = [...launcherItems];
    let selectedIndex = 0;

    const isTypingElement = (el) => {
      if (!el) return false;
      const tag = el.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    };

    const updateActiveDescendant = () => {
      launcherItems.forEach((item) => {
        item.classList.remove('active');
        item.setAttribute('aria-selected', 'false');
      });

      if (visibleItems.length > 0 && selectedIndex >= 0 && selectedIndex < visibleItems.length) {
        const currentItem = visibleItems[selectedIndex];
        currentItem.classList.add('active');
        currentItem.setAttribute('aria-selected', 'true');
        launcherSearch.setAttribute('aria-activedescendant', currentItem.id);
        currentItem.scrollIntoView({ block: 'nearest' });
      } else {
        launcherSearch.removeAttribute('aria-activedescendant');
      }
    };

    const filterCommands = (query) => {
      const q = query.trim().toLowerCase();
      visibleItems = [];

      launcherItems.forEach((item) => {
        const title = (item.querySelector('.launcher-item-title')?.textContent || '').toLowerCase();
        const desc = (item.querySelector('.launcher-item-desc')?.textContent || '').toLowerCase();
        const keywords = (item.getAttribute('data-keywords') || '').toLowerCase();
        const fullText = `${title} ${desc} ${keywords}`;

        const matches = !q || fullText.includes(q);
        if (matches) {
          item.style.display = '';
          visibleItems.push(item);
        } else {
          item.style.display = 'none';
        }
      });

      if (launcherEmpty) {
        launcherEmpty.hidden = visibleItems.length > 0;
      }

      selectedIndex = 0;
      updateActiveDescendant();
    };

    const openLauncher = () => {
      lastActiveElement = doc.activeElement;
      if (typeof launcherDialog.showModal === 'function') {
        launcherDialog.showModal();
      } else {
        launcherDialog.setAttribute('open', '');
      }
      launcherDialog.classList.add('open');
      root.style.overflow = 'hidden';

      launcherSearch.value = '';
      filterCommands('');
      setTimeout(() => {
        launcherSearch.focus();
      }, 10);
    };

    const closeLauncher = (targetToFocus) => {
      if (!launcherDialog.hasAttribute('open') && !launcherDialog.classList.contains('open')) return;

      launcherDialog.classList.remove('open');
      if (typeof launcherDialog.close === 'function') {
        launcherDialog.close();
      } else {
        launcherDialog.removeAttribute('open');
      }
      root.style.overflow = '';

      if (targetToFocus) {
        targetToFocus.focus();
      } else if (lastActiveElement && typeof lastActiveElement.focus === 'function') {
        lastActiveElement.focus();
      }
    };

    const executeCommand = (item) => {
      if (!item) return;
      const href = item.getAttribute('href');
      const isExternal = item.getAttribute('target') === '_blank' || (href && href.startsWith('http'));

      if (isExternal) {
        closeLauncher();
        window.open(href, '_blank', 'noopener,noreferrer');
      } else if (href && href.startsWith('#')) {
        const targetEl = doc.querySelector(href);
        closeLauncher();
        if (targetEl) {
          targetEl.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth', block: 'start' });
          if (!targetEl.hasAttribute('tabindex')) {
            targetEl.setAttribute('tabindex', '-1');
          }
          targetEl.focus({ preventScroll: true });
        }
      } else {
        closeLauncher();
      }
    };

    if (launcherTrigger) {
      launcherTrigger.addEventListener('click', openLauncher);
    }

    launcherCloseButtons.forEach((btn) => {
      btn.addEventListener('click', () => closeLauncher());
    });

    launcherDialog.addEventListener('click', (e) => {
      if (e.target === launcherDialog) {
        closeLauncher();
      }
    });

    launcherSearch.addEventListener('input', (e) => {
      filterCommands(e.target.value);
    });

    launcherItems.forEach((item) => {
      item.addEventListener('mouseenter', () => {
        const idx = visibleItems.indexOf(item);
        if (idx !== -1) {
          selectedIndex = idx;
          updateActiveDescendant();
        }
      });

      item.addEventListener('click', (e) => {
        e.preventDefault();
        executeCommand(item);
      });
    });

    launcherDialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeLauncher();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (visibleItems.length > 0) {
          selectedIndex = (selectedIndex + 1) % visibleItems.length;
          updateActiveDescendant();
        }
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (visibleItems.length > 0) {
          selectedIndex = (selectedIndex - 1 + visibleItems.length) % visibleItems.length;
          updateActiveDescendant();
        }
        return;
      }

      if (e.key === 'Enter') {
        e.preventDefault();
        if (visibleItems.length > 0 && selectedIndex >= 0 && selectedIndex < visibleItems.length) {
          executeCommand(visibleItems[selectedIndex]);
        }
        return;
      }

      if (e.key === 'Tab') {
        const focusable = Array.from(launcherDialog.querySelectorAll('button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), [href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'))
          .filter((el) => !el.hidden && el.offsetParent !== null);
        if (focusable.length > 0) {
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (e.shiftKey && doc.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && doc.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    });

    doc.addEventListener('keydown', (e) => {
      const isKeyK = e.key === 'k' || e.key === 'K';
      if ((e.ctrlKey || e.metaKey) && isKeyK) {
        e.preventDefault();
        const isOpen = launcherDialog.hasAttribute('open') || launcherDialog.classList.contains('open');
        if (isOpen) {
          closeLauncher();
        } else {
          openLauncher();
        }
        return;
      }

      if (e.key === '/' && !isTypingElement(doc.activeElement)) {
        const isOpen = launcherDialog.hasAttribute('open') || launcherDialog.classList.contains('open');
        if (!isOpen) {
          e.preventDefault();
          openLauncher();
        }
      }
    });
  }

  // Active section indicator
  const sections = Array.from(doc.querySelectorAll('[data-section]'));
  if ('IntersectionObserver' in window && sections.length && navLinks.length) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            const href = link.getAttribute('href');
            link.classList.toggle('active', href === `#${id}` || href === `index.html#${id}`);
          });
        }
      });
    }, { rootMargin: '-25% 0px -65% 0px', threshold: 0 });
    sections.forEach((sec) => sectionObserver.observe(sec));
  }

  // 3. Scroll Reveal System
  const revealElements = doc.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.1 });
    revealElements.forEach((el) => revealObserver.observe(el));
  } else {
    revealElements.forEach((el) => el.classList.add('in-view'));
  }

  // 4. Pointer Aura & Parallax
  const aura = doc.querySelector('.pointer-aura');
  if (aura && isPointerFine) {
    window.addEventListener('pointermove', (e) => {
      aura.style.left = `${e.clientX}px`;
      aura.style.top = `${e.clientY}px`;
    }, { passive: true });
  }

  const parallaxNode = doc.querySelector('[data-parallax]');
  if (parallaxNode && isPointerFine && !isReduced) {
    const heroSec = doc.querySelector('.hero');
    if (heroSec) {
      let targetX = 0;
      let targetY = 0;
      let currentX = 0;
      let currentY = 0;
      let isHovering = false;
      let rafId = null;

      const updateParallax = () => {
        currentX += (targetX - currentX) * 0.08;
        currentY += (targetY - currentY) * 0.08;
        if (isHovering || Math.abs(currentX) > 0.01 || Math.abs(currentY) > 0.01) {
          parallaxNode.style.transform = `perspective(1000px) rotateY(${currentX.toFixed(2)}deg) rotateX(${(-currentY).toFixed(2)}deg)`;
          rafId = requestAnimationFrame(updateParallax);
        } else {
          parallaxNode.style.transform = '';
          rafId = null;
        }
      };

      heroSec.addEventListener('pointermove', (e) => {
        const rect = heroSec.getBoundingClientRect();
        targetX = ((e.clientX - rect.left) / rect.width - 0.5) * 6;
        targetY = ((e.clientY - rect.top) / rect.height - 0.5) * 6;
        if (!isHovering) {
          isHovering = true;
          if (!rafId) rafId = requestAnimationFrame(updateParallax);
        }
      }, { passive: true });

      heroSec.addEventListener('pointerleave', () => {
        targetX = 0;
        targetY = 0;
        isHovering = false;
      });
    }
  }

  // Tilt cards
  const tiltCards = doc.querySelectorAll('.tilt');
  if (isPointerFine && !isReduced) {
    tiltCards.forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        card.style.transform = `perspective(800px) rotateY(${x * 5}deg) rotateX(${-y * 5}deg) translateY(-4px)`;
      });
      card.addEventListener('pointerleave', () => {
        card.style.transform = '';
      });
    });
  }

  // Magnetic buttons
  const magneticButtons = doc.querySelectorAll('.magnetic');
  magneticButtons.forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const rect = btn.getBoundingClientRect();
      btn.style.setProperty('--x', `${e.clientX - rect.left}px`);
      btn.style.setProperty('--y', `${e.clientY - rect.top}px`);
    });
  });

  // 5. Hero Network Canvas
  const heroCanvas = doc.querySelector('[data-network]');
  if (heroCanvas && !isReduced) {
    const ctx = heroCanvas.getContext('2d');
    if (ctx) {
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      let width = heroCanvas.offsetWidth || 800;
      let height = heroCanvas.offsetHeight || 600;
      heroCanvas.width = Math.round(width * dpr);
      heroCanvas.height = Math.round(height * dpr);

      let particles = [];
      let isVisible = !doc.hidden;
      let isInView = true;
      let animId = null;

      const createParticles = () => {
        const count = Math.min(36, Math.floor(width / 32));
        particles = Array.from({ length: Math.max(12, count) }, () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          vx: (Math.random() - 0.5) * 0.35,
          vy: (Math.random() - 0.5) * 0.35,
          size: Math.random() * 1.6 + 0.8,
          alpha: Math.random() * 0.35 + 0.15
        }));
      };

      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = heroCanvas.offsetWidth || 800;
        height = heroCanvas.offsetHeight || 600;
        heroCanvas.width = Math.round(width * dpr);
        heroCanvas.height = Math.round(height * dpr);
        createParticles();
      };
      window.addEventListener('resize', resize, { passive: true });
      createParticles();

      const render = () => {
        if (!isVisible || !isInView || !ctx) {
          animId = null;
          return;
        }
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;

          if (p.x < 0) p.x = width;
          if (p.x > width) p.x = 0;
          if (p.y < 0) p.y = height;
          if (p.y > height) p.y = 0;

          ctx.fillStyle = `rgba(79, 231, 255, ${p.alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          for (let j = i + 1; j < particles.length; j++) {
            const p2 = particles[j];
            const dx = p.x - p2.x;
            const dy = p.y - p2.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 100) {
              ctx.strokeStyle = `rgba(7, 87, 232, ${(1 - dist / 100) * 0.2})`;
              ctx.lineWidth = 0.8;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(p2.x, p2.y);
              ctx.stroke();
            }
          }
        }
        ctx.restore();
        animId = requestAnimationFrame(render);
      };

      const startAnim = () => {
        if (!animId && isVisible && isInView) {
          animId = requestAnimationFrame(render);
        }
      };

      const stopAnim = () => {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      };

      startAnim();

      doc.addEventListener('visibilitychange', () => {
        isVisible = !doc.hidden;
        if (isVisible) startAnim();
        else stopAnim();
      });

      if ('IntersectionObserver' in window) {
        const heroObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            isInView = entry.isIntersecting;
            if (isInView) startAnim();
            else stopAnim();
          });
        }, { threshold: 0 });
        const heroSec = doc.querySelector('.hero');
        if (heroSec) heroObserver.observe(heroSec);
      }
    }
  }

  const networkNodes = Array.from(doc.querySelectorAll('.network-node'));
  const activeLine = doc.getElementById('net-active-line');
  const statusBar = doc.getElementById('network-status-bar');
  const statusText = statusBar ? statusBar.querySelector('.status-text') : null;

  const nodeMap = {
    gaming: { x: 140, y: 180, text: 'Gaming Node Active — Casual & competitive lobbies · Jump to gaming' },
    squads: { x: 560, y: 150, text: 'Squads Node Active — Find teammates & co-op rosters · Jump to community' },
    voice: { x: 610, y: 390, text: 'Voice Node Active — Drop-in voice lounges & live chat · Jump to community' },
    creators: { x: 500, y: 590, text: 'Creators Node Active — Clips, streamers & media · Jump to paths' },
    tech: { x: 200, y: 580, text: 'Technology Node Active — Bots, digital tools & open stacks · Jump to tech' },
    projects: { x: 90, y: 380, text: 'Projects Node Active — Custom builds & client requests · Jump to brief builder' }
  };

  const defaultStatusText = 'Select any node to navigate or explore';

  const activateNode = (nodeKey) => {
    const item = nodeMap[nodeKey];
    if (!item) return;

    if (activeLine) {
      activeLine.setAttribute('d', `M350 350 L${item.x} ${item.y}`);
      activeLine.classList.add('visible');
    }
    if (statusBar) statusBar.classList.add('active');
    if (statusText) statusText.textContent = item.text;

    networkNodes.forEach((n) => {
      n.classList.toggle('active', n.getAttribute('data-node') === nodeKey);
    });
  };

  const resetNodes = () => {
    if (activeLine) activeLine.classList.remove('visible');
    if (statusBar) statusBar.classList.remove('active');
    if (statusText) statusText.textContent = defaultStatusText;
    networkNodes.forEach((n) => n.classList.remove('active'));
  };

  networkNodes.forEach((node) => {
    const key = node.getAttribute('data-node');
    node.addEventListener('mouseenter', () => activateNode(key));
    node.addEventListener('focus', () => activateNode(key));
    node.addEventListener('mouseleave', resetNodes);
    node.addEventListener('blur', resetNodes);

    node.addEventListener('click', (e) => {
      const targetSelector = node.getAttribute('data-target') || node.getAttribute('href');
      if (targetSelector && targetSelector.startsWith('#')) {
        const targetEl = doc.querySelector(targetSelector);
        if (targetEl) {
          e.preventDefault();
          targetEl.scrollIntoView({ behavior: isReduced ? 'auto' : 'smooth', block: 'start' });
          targetEl.focus({ preventScroll: true });
        }
      }
    });
  });

  const pathControls = doc.querySelector('.path-controls');
  const pathTabs = Array.from(doc.querySelectorAll('.path-tab'));
  const pathPanels = Array.from(doc.querySelectorAll('.path-panel'));

  if (pathTabs.length && pathPanels.length) {
    const validPaths = ['player', 'squad', 'creator', 'developer'];

    const activatePath = (pathKey, shouldFocus) => {
      if (!validPaths.includes(pathKey)) pathKey = 'player';

      pathTabs.forEach((tab) => {
        const isMatch = tab.dataset.path === pathKey;
        tab.classList.toggle('active', isMatch);
        tab.setAttribute('aria-selected', String(isMatch));
        tab.setAttribute('tabindex', isMatch ? '0' : '-1');
        if (isMatch && shouldFocus) {
          tab.focus();
        }
      });

      pathPanels.forEach((panel) => {
        const isMatch = panel.dataset.path === pathKey;
        panel.classList.toggle('active', isMatch);
        panel.hidden = !isMatch;
      });

      safeSessionStorage.setItem('arkuzo_selected_path', pathKey);
    };

    pathTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        activatePath(tab.dataset.path, false);
      });
    });

    if (pathControls) {
      pathControls.addEventListener('keydown', (e) => {
        const currentTab = doc.activeElement;
        const currentIndex = pathTabs.indexOf(currentTab);
        if (currentIndex === -1) return;

        let nextIndex = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % pathTabs.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          nextIndex = (currentIndex - 1 + pathTabs.length) % pathTabs.length;
        } else if (e.key === 'Home') {
          nextIndex = 0;
        } else if (e.key === 'End') {
          nextIndex = pathTabs.length - 1;
        }

        if (nextIndex !== -1) {
          e.preventDefault();
          const nextTab = pathTabs[nextIndex];
          activatePath(nextTab.dataset.path, true);
        }
      });
    }

    let initialPath = 'player';
    const stored = safeSessionStorage.getItem('arkuzo_selected_path');
    if (stored && validPaths.includes(stored)) {
      initialPath = stored;
    }

    activatePath(initialPath, false);
  }

  const communitySection = doc.getElementById('community');
  if (communitySection && !communitySection.dataset.initialized) {
    communitySection.dataset.initialized = 'true';

    const liveRegion = doc.getElementById('community-live-region');
    const announce = (msg) => {
      if (liveRegion) liveRegion.textContent = msg;
    };

    const nodeData = {
      voice: {
        tag: '#voice-lounge',
        badge: 'ILLUSTRATIVE NODE ARCHITECTURE',
        title: 'Voice Lounge',
        desc: 'Drop-in audio spaces with low pressure. Hop in to talk game balance, coordinate upcoming sessions, or listen while hanging out between matches.'
      },
      squad: {
        tag: '#squad-formation',
        badge: 'ILLUSTRATIVE ROSTER MODEL',
        title: 'Squad Coordination Hub',
        desc: 'Connect with balanced teammates matched by game, roles, and playstyles. Form 4-player rosters for ranked runs and casual lobbies.'
      },
      creator: {
        tag: '#creator-signals',
        badge: 'ILLUSTRATIVE SIGNAL RELAY',
        title: 'Creator Signals & Highlights',
        desc: 'Community highlight stream showcasing clutch gameplay moments, montage edits, and creative media from community members.'
      },
      builder: {
        tag: '#tech-lab',
        badge: 'ILLUSTRATIVE LAB TOPOLOGY',
        title: 'Tech Lab & Project Matrix',
        desc: 'Collaborative development space for engineering custom Discord bots, web dashboards, and automation tooling for the Arkuzo ecosystem.'
      }
    };

    const nodeButtons = Array.from(communitySection.querySelectorAll('.space-node-btn'));
    const focusBadge = doc.getElementById('focus-meta-badge');
    const focusTag = doc.getElementById('focus-channel-tag');
    const focusHeading = doc.getElementById('focus-heading');
    const focusDesc = doc.getElementById('focus-description');
    const spaceMap = doc.getElementById('community-space-map');

    const activateNode = (nodeKey) => {
      const data = nodeData[nodeKey];
      if (!data) return;
      nodeButtons.forEach((btn) => {
        const isMatch = btn.dataset.spaceNode === nodeKey;
        btn.classList.toggle('active', isMatch);
        btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      });
      if (spaceMap) spaceMap.setAttribute('data-active-node', nodeKey);
      if (focusBadge) focusBadge.textContent = data.badge;
      if (focusTag) focusTag.textContent = data.tag;
      if (focusHeading) focusHeading.textContent = data.title;
      if (focusDesc) focusDesc.textContent = data.desc;
      announce(`Selected space node: ${data.title}. ${data.desc}`);
    };

    nodeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        activateNode(btn.dataset.spaceNode);
      });
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateNode(btn.dataset.spaceNode);
        }
      });
    });

    const voiceModes = {
      lounge: 'ILLUSTRATIVE FREQUENCY SPECTRUM (LOUNGE)',
      comms: 'ILLUSTRATIVE FREQUENCY SPECTRUM (TACTICAL)',
      quiet: 'ILLUSTRATIVE FREQUENCY SPECTRUM (LATE HANGOUT)'
    };

    const voiceModeBtns = Array.from(communitySection.querySelectorAll('.v-channel-btn'));
    const voiceLabel = doc.getElementById('community-voice-label');
    const voiceBars = doc.getElementById('community-voice-bars');

    voiceModeBtns.forEach((btn) => {
      const handleVoiceSelect = () => {
        const mode = btn.dataset.voiceMode;
        voiceModeBtns.forEach((b) => {
          const isMatch = b === btn;
          b.classList.toggle('active', isMatch);
          b.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
        });
        const label = voiceModes[mode];
        if (label && voiceLabel) voiceLabel.textContent = label;
        if (voiceBars) voiceBars.setAttribute('data-mode', mode);
        announce(`Voice mode changed to ${btn.textContent}`);
      };

      btn.addEventListener('click', handleVoiceSelect);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleVoiceSelect();
        }
      });
    });

    const roleData = {
      vanguard: {
        role: 'Vanguard',
        desc: 'Primary engagement, initiating pushes and creating space for team follow-up.'
      },
      recon: {
        role: 'Recon',
        desc: 'Information gathering, flank vigilance, and scouting enemy positioning.'
      },
      support: {
        role: 'Support',
        desc: 'Utility rotation, team sustain, and maintaining tactical map control.'
      },
      tactician: {
        role: 'Tactician',
        desc: 'Shot-calling, tempo management, and macro objective coordination.'
      }
    };

    const squadBtns = Array.from(communitySection.querySelectorAll('.squad-slot-btn'));
    const readoutText = doc.getElementById('squad-slot-readout');

    squadBtns.forEach((btn) => {
      const handleSquadSelect = () => {
        const roleKey = btn.dataset.role;
        const data = roleData[roleKey];
        if (!data) return;
        squadBtns.forEach((b) => {
          const isMatch = b === btn;
          b.classList.toggle('active', isMatch);
          b.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
        });
        if (readoutText) {
          readoutText.innerHTML = `<span class="slot-readout-label">INSPECTED ROLE:</span> <b id="squad-readout-role">${data.role}</b> — ${data.desc}`;
        }
        announce(`Inspected squad role: ${data.role}. ${data.desc}`);
      };

      btn.addEventListener('click', handleSquadSelect);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSquadSelect();
        }
      });
    });

    const sessionData = {
      casual: {
        title: 'Casual Party',
        desc: 'Low-pressure drop-in game nights open to every member regardless of ranking.'
      },
      bracket: {
        title: 'Bracket Runs',
        desc: 'Structured community tournaments and ranked scrimmages with organized casting.'
      },
      coop: {
        title: 'Co-op Raids',
        desc: 'PVE and cooperative challenges requiring multi-squad coordination and patience.'
      }
    };

    const sessionBtns = Array.from(communitySection.querySelectorAll('.session-pill-btn'));
    const sessionReadout = doc.getElementById('session-readout');

    sessionBtns.forEach((btn) => {
      const handleSessionSelect = () => {
        const sKey = btn.dataset.session;
        const data = sessionData[sKey];
        if (!data) return;
        sessionBtns.forEach((b) => {
          const isMatch = b === btn;
          b.classList.toggle('active', isMatch);
          b.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
        });
        if (sessionReadout) {
          sessionReadout.innerHTML = `<b>${data.title}:</b> ${data.desc}`;
        }
        announce(`Inspected session: ${data.title}. ${data.desc}`);
      };

      btn.addEventListener('click', handleSessionSelect);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSessionSelect();
        }
      });
    });

    const signalBtns = Array.from(communitySection.querySelectorAll('.creator-signal-btn'));
    signalBtns.forEach((btn) => {
      const handleSignalSelect = () => {
        signalBtns.forEach((b) => {
          const isMatch = b === btn;
          b.classList.toggle('active', isMatch);
          b.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
        });
        const titleEl = btn.querySelector('.signal-title');
        announce(`Creator signal: ${titleEl ? titleEl.textContent : btn.dataset.signal}`);
      };
      btn.addEventListener('click', handleSignalSelect);
      btn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleSignalSelect();
        }
      });
    });
  }

  const storySteps = Array.from(doc.querySelectorAll('.story-step'));
  const storyVisual = doc.querySelector('[data-story-visual]');
  if (storySteps.length && storyVisual && !storyVisual.dataset.initialized) {
    storyVisual.dataset.initialized = 'true';

    const storyData = {
      meet: {
        num: '01 / 05',
        fill: '20%',
        title: 'MEET',
        status: 'Stage 01: Discovering welcoming channels and open conversations',
        sats: ['OPEN LOBBY', 'VOICE ROOM', 'SHARED TITLES', 'WELCOME SPACE']
      },
      squad: {
        num: '02 / 05',
        fill: '40%',
        title: 'SQUAD',
        status: 'Stage 02: Teaming up with aligned players and coordinating rosters',
        sats: ['ROLE SYNC', 'CO-OP ROSTER', 'VOICE COMMS', 'SCHEDULE FIT']
      },
      play: {
        num: '03 / 05',
        fill: '60%',
        title: 'PLAY',
        status: 'Stage 03: Queuing into matches, game nights, and cooperative sessions',
        sats: ['MATCH QUEUE', 'GAME NIGHT', 'BRACKET RUNS', 'TEAM VICTORY']
      },
      create: {
        num: '04 / 05',
        fill: '80%',
        title: 'CREATE',
        status: 'Stage 04: Shipping community projects, tools, clips, and creative work',
        sats: ['CLIP RELAY', 'DISCORD BOTS', 'WEB TOOLS', 'CREATIVE LAB']
      },
      grow: {
        num: '05 / 05',
        fill: '100%',
        title: 'GROW',
        status: 'Stage 05: Developing long-term community presence, roles, and initiatives',
        sats: ['LEADERSHIP', 'MENTORSHIP', 'COMMUNITY PILLAR', 'NETWORK HORIZON']
      }
    };

    const stageNumEl = doc.getElementById('story-stage-num');
    const progFill = doc.getElementById('story-progress-fill');
    const coreText = doc.getElementById('story-core-text');
    const statusText = doc.getElementById('story-status-text');

    const updateStory = (key) => {
      const data = storyData[key];
      if (!data) return;
      storyVisual.setAttribute('data-state', key);
      if (stageNumEl) stageNumEl.textContent = data.num;
      if (progFill) progFill.style.width = data.fill;
      if (coreText) coreText.textContent = data.title;
      if (statusText) statusText.textContent = data.status;
      data.sats.forEach((text, idx) => {
        const satEl = doc.getElementById(`story-sat-${idx + 1}`);
        if (satEl) satEl.textContent = text;
      });
    };

    const activateStep = (step, smoothScroll) => {
      storySteps.forEach((s) => {
        const isActive = s === step;
        s.classList.toggle('active', isActive);
        s.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      });
      updateStory(step.dataset.story);
      if (smoothScroll && !isReduced) {
        step.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };

    storySteps.forEach((step) => {
      step.addEventListener('click', () => {
        activateStep(step, false);
      });
      step.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          activateStep(step, true);
        }
      });
    });

    if ('IntersectionObserver' in window) {
      const storyObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const step = entry.target;
            storySteps.forEach((s) => {
              const isActive = s === step;
              s.classList.toggle('active', isActive);
              s.setAttribute('aria-pressed', isActive ? 'true' : 'false');
            });
            updateStory(step.dataset.story);
          }
        });
      }, { rootMargin: '-20% 0px -40% 0px', threshold: 0.15 });
      storySteps.forEach((step) => storyObserver.observe(step));
    }

    updateStory('meet');
  }

  // 7. Gaming Mode Switcher
  const modeButtons = Array.from(doc.querySelectorAll('.mode-nav [data-mode]'));
  const modeDisplay = doc.getElementById('mode-panel-content');
  if (modeButtons.length && modeDisplay) {
    const modeData = {
      casual: {
        tag: 'CASUAL',
        title: 'Drop in.<br>Stay awhile.',
        lead: 'No pressure, no performance requirements. Find an open voice channel, join an ongoing conversation, and play at your own pace.',
        pills: ['OPEN VOICE', 'FLEXIBLE SQUADS', 'CROSS-TITLE DISCOVERY'],
        cta: 'Find Casual Squads'
      },
      competitive: {
        tag: 'COMPETITIVE',
        title: 'Sharpen up.<br>Play to win.',
        lead: 'Queue with members who coordinate, communicate, and push for tactical improvement across ranked titles.',
        pills: ['TACTICAL CALLOUTS', 'COORDINATED ROSTERS', 'RANKED PLAY'],
        cta: 'Find Competitive Squads'
      },
      cooperative: {
        tag: 'COOPERATIVE',
        title: 'Work together.<br>Clear the board.',
        lead: 'Tackle campaign runs, raid nights, and co-op favorites where team synergy and shared progress matter most.',
        pills: ['SHARED PROGRESS', 'OBJECTIVE SYNERGY', 'RAID ROSTERS'],
        cta: 'Assemble Co-op Squad'
      },
      events: {
        tag: 'COMMUNITY EVENTS',
        title: 'Community sessions &amp;<br>game nights.',
        lead: 'Open community lobbies, party-game sessions, and multiplayer evenings where everyone in the server can jump in.',
        pills: ['OPEN SESSIONS', 'SERVER GAME NIGHTS', 'MULTI-GENRE'],
        cta: 'Join Community Events'
      }
    };

    const badgeEl = doc.getElementById('mode-badge-tag');
    const titleEl = doc.getElementById('mode-title');
    const leadEl = doc.getElementById('mode-lead');
    const pillsEl = doc.getElementById('mode-pills');
    const ctaEl = doc.getElementById('mode-cta');
    const visualLayers = Array.from(doc.querySelectorAll('.mode-visual-layer'));
    const modeLayout = doc.querySelector('.mode-layout');
    const gamingSection = doc.getElementById('gaming');

    let userInteracted = false;
    let autoCycleTimer = null;
    let isHoverPaused = false;
    let isSectionInView = true;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    let prefersReducedMotion = motionQuery.matches;

    const stopAutoCycle = () => {
      if (autoCycleTimer) {
        clearInterval(autoCycleTimer);
        autoCycleTimer = null;
      }
    };

    const switchMode = (modeKey, shouldFocus) => {
      const data = modeData[modeKey];
      if (!data) return;

      const targetBtn = modeButtons.find((b) => b.dataset.mode === modeKey);
      if (!targetBtn) return;

      modeButtons.forEach((b) => {
        const isSelected = b === targetBtn;
        b.setAttribute('aria-selected', isSelected ? 'true' : 'false');
        b.setAttribute('tabindex', isSelected ? '0' : '-1');
      });

      if (shouldFocus) {
        targetBtn.focus();
      }

      modeDisplay.setAttribute('aria-labelledby', targetBtn.id);
      modeDisplay.setAttribute('data-active-mode', modeKey);

      if (badgeEl) badgeEl.textContent = data.tag;
      if (titleEl) titleEl.innerHTML = data.title;
      if (leadEl) leadEl.textContent = data.lead;
      if (pillsEl) {
        pillsEl.innerHTML = data.pills.map((pill) => `<i>${pill}</i>`).join('');
      }
      if (ctaEl) {
        ctaEl.innerHTML = `${data.cta} <span>↗</span>`;
        ctaEl.href = 'https://discord.gg/arkuzo';
        ctaEl.target = '_blank';
        ctaEl.rel = 'noopener noreferrer';
      }

      visualLayers.forEach((layer) => {
        const isMatch = layer.dataset.visualMode === modeKey;
        layer.classList.toggle('active', isMatch);
      });
    };

    const startAutoCycle = () => {
      stopAutoCycle();
      if (userInteracted || prefersReducedMotion || doc.hidden || isHoverPaused || !isSectionInView) {
        return;
      }
      autoCycleTimer = setInterval(() => {
        if (userInteracted || prefersReducedMotion || doc.hidden || isHoverPaused || !isSectionInView) {
          stopAutoCycle();
          return;
        }
        const currentIdx = modeButtons.findIndex((b) => b.getAttribute('aria-selected') === 'true');
        const nextIdx = (currentIdx + 1) % modeButtons.length;
        const nextMode = modeButtons[nextIdx].dataset.mode;
        switchMode(nextMode, false);
      }, 8000);
    };

    modeButtons.forEach((btn, index) => {
      btn.addEventListener('click', () => {
        userInteracted = true;
        stopAutoCycle();
        switchMode(btn.dataset.mode, false);
      });

      btn.addEventListener('touchstart', () => {
        userInteracted = true;
        stopAutoCycle();
      }, { passive: true });

      btn.addEventListener('keydown', (e) => {
        let targetIndex = -1;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
          targetIndex = (index + 1) % modeButtons.length;
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
          targetIndex = (index - 1 + modeButtons.length) % modeButtons.length;
        } else if (e.key === 'Home') {
          targetIndex = 0;
        } else if (e.key === 'End') {
          targetIndex = modeButtons.length - 1;
        }

        if (targetIndex >= 0) {
          e.preventDefault();
          userInteracted = true;
          stopAutoCycle();
          const targetMode = modeButtons[targetIndex].dataset.mode;
          switchMode(targetMode, true);
        }
      });
    });

    if (modeDisplay) {
      modeDisplay.addEventListener('click', () => {
        userInteracted = true;
        stopAutoCycle();
      });
      modeDisplay.addEventListener('touchstart', () => {
        userInteracted = true;
        stopAutoCycle();
      }, { passive: true });
    }

    if (modeLayout) {
      modeLayout.addEventListener('mouseenter', () => {
        isHoverPaused = true;
        stopAutoCycle();
      });
      modeLayout.addEventListener('mouseleave', () => {
        isHoverPaused = false;
        if (!userInteracted) startAutoCycle();
      });
      modeLayout.addEventListener('focusin', () => {
        isHoverPaused = true;
        stopAutoCycle();
      });
      modeLayout.addEventListener('focusout', () => {
        isHoverPaused = false;
        if (!userInteracted) startAutoCycle();
      });
    }

    doc.addEventListener('visibilitychange', () => {
      if (doc.hidden) {
        stopAutoCycle();
      } else if (!userInteracted && !isHoverPaused && isSectionInView) {
        startAutoCycle();
      }
    });

    const handleMotionChange = (e) => {
      prefersReducedMotion = e.matches;
      if (prefersReducedMotion) {
        stopAutoCycle();
      } else if (!userInteracted && !isHoverPaused && isSectionInView && !doc.hidden) {
        startAutoCycle();
      }
    };

    if (typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', handleMotionChange);
    } else if (typeof motionQuery.addListener === 'function') {
      motionQuery.addListener(handleMotionChange);
    }

    if ('IntersectionObserver' in window && gamingSection) {
      const modeObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          isSectionInView = entry.isIntersecting;
          if (isSectionInView) {
            if (!userInteracted && !isHoverPaused && !doc.hidden && !prefersReducedMotion) {
              startAutoCycle();
            }
          } else {
            stopAutoCycle();
          }
        });
      }, { threshold: 0.1 });
      modeObserver.observe(gamingSection);
    } else if (!userInteracted && !prefersReducedMotion && !doc.hidden) {
      startAutoCycle();
    }
  }

  const copyInviteBtn = doc.getElementById('copy-invite-btn');
  const toastEl = doc.getElementById('copy-toast');
  let toastTimer = null;

  const showToast = (message, isError) => {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.toggle('error', Boolean(isError));
    toastEl.classList.add('show');
    if (toastTimer) {
      clearTimeout(toastTimer);
    }
    toastTimer = setTimeout(() => {
      toastEl.classList.remove('show');
      toastEl.classList.remove('error');
      toastTimer = null;
    }, 3200);
  };

  if (copyInviteBtn) {
    const inviteUrl = 'https://discord.gg/arkuzo';
    const labelSpan = copyInviteBtn.querySelector('span');
    let resetTimer = null;

    const setButtonState = () => {
      copyInviteBtn.classList.add('copied');
      if (labelSpan) labelSpan.textContent = 'Copied!';
      if (resetTimer) clearTimeout(resetTimer);
      resetTimer = setTimeout(() => {
        copyInviteBtn.classList.remove('copied');
        if (labelSpan) labelSpan.textContent = 'Copy Invite';
        resetTimer = null;
      }, 2500);
    };

    const copyWithFallback = () => {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        return navigator.clipboard.writeText(inviteUrl).then(
          () => true,
          () => false
        );
      }
      return Promise.resolve(false);
    };

    const copyWithExecCommand = () => {
      try {
        const textarea = doc.createElement('textarea');
        textarea.value = inviteUrl;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        textarea.style.opacity = '0';
        doc.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        const success = doc.execCommand('copy');
        doc.body.removeChild(textarea);
        return success;
      } catch {
        return false;
      }
    };

    copyInviteBtn.addEventListener('click', () => {
      copyWithFallback().then((success) => {
        if (success) {
          setButtonState();
          showToast('Copied discord.gg/arkuzo to clipboard!');
        } else {
          const fallbackSuccess = copyWithExecCommand();
          if (fallbackSuccess) {
            setButtonState();
            showToast('Copied discord.gg/arkuzo to clipboard!');
          } else {
            showToast('Invite link: https://discord.gg/arkuzo', false);
          }
        }
      });
    });
  }

  // 8. Interactive Terminal (Coding Section)
  const terminal = doc.querySelector('[data-terminal]');
  if (terminal) {
    let hasRun = false;
    const cmdEl = terminal.querySelector('[data-command]');
    const l1 = terminal.querySelector('.terminal-line.l1');
    const l2 = terminal.querySelector('.terminal-line.l2');
    const success = terminal.querySelector('.terminal-line.success');
    const modules = terminal.querySelectorAll('.module:not(.core)');

    const runTerminal = () => {
      if (hasRun) return;
      hasRun = true;
      const cmdText = 'arkuzo build --target community-stack';
      let idx = 0;

      const typeInterval = setInterval(() => {
        if (cmdEl) cmdEl.textContent += cmdText[idx];
        idx++;
        if (idx >= cmdText.length) {
          clearInterval(typeInterval);
          setTimeout(() => l1 && l1.classList.add('show'), 200);
          setTimeout(() => {
            if (l2) l2.classList.add('show');
            modules.forEach((m) => m.classList.add('active'));
          }, 500);
          setTimeout(() => success && success.classList.add('show'), 800);
        }
      }, 25);
    };

    if ('IntersectionObserver' in window) {
      const termObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            runTerminal();
            termObserver.unobserve(entry.target);
          }
        });
      }, { threshold: 0.3 });
      termObserver.observe(terminal);
    } else {
      runTerminal();
    }
  }

  // 9. FAQ Accordion Keyboard & Mouse System
  const faqItems = Array.from(doc.querySelectorAll('.faq-item'));
  const faqButtons = faqItems.map((item) => item.querySelector('button')).filter(Boolean);

  faqItems.forEach((item, index) => {
    const btn = item.querySelector('button');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const isAlreadyOpen = item.classList.contains('open');
      faqItems.forEach((other) => {
        other.classList.remove('open');
        const otherBtn = other.querySelector('button');
        if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
      });

      if (!isAlreadyOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });

    btn.addEventListener('keydown', (e) => {
      let targetIndex = -1;
      if (e.key === 'ArrowDown') targetIndex = (index + 1) % faqButtons.length;
      if (e.key === 'ArrowUp') targetIndex = (index - 1 + faqButtons.length) % faqButtons.length;
      if (e.key === 'Home') targetIndex = 0;
      if (e.key === 'End') targetIndex = faqButtons.length - 1;

      if (targetIndex >= 0) {
        e.preventDefault();
        faqButtons[targetIndex].focus();
      }
    });
  });

  // 10. Final Canvas
  const finalCanvas = doc.querySelector('[data-final-canvas]');
  if (finalCanvas && !isReduced) {
    const ctx = finalCanvas.getContext('2d');
    if (ctx) {
      let dpr = Math.min(window.devicePixelRatio || 1, 2);
      let width = finalCanvas.offsetWidth || 800;
      let height = finalCanvas.offsetHeight || 300;
      finalCanvas.width = Math.round(width * dpr);
      finalCanvas.height = Math.round(height * dpr);

      let stars = [];
      let isVisible = !doc.hidden;
      let isInView = false;
      let animId = null;

      const makeStars = () => {
        stars = Array.from({ length: 40 }, () => ({
          x: Math.random() * width,
          y: Math.random() * height,
          vy: Math.random() * 0.15 + 0.05,
          size: Math.random() * 1.5 + 0.5,
          alpha: Math.random() * 0.5 + 0.2
        }));
      };

      const resize = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        width = finalCanvas.offsetWidth || 800;
        height = finalCanvas.offsetHeight || 300;
        finalCanvas.width = Math.round(width * dpr);
        finalCanvas.height = Math.round(height * dpr);
        makeStars();
      };
      window.addEventListener('resize', resize, { passive: true });
      makeStars();

      const startAnim = () => {
        if (!animId && isVisible && isInView) {
          animId = requestAnimationFrame(draw);
        }
      };

      const stopAnim = () => {
        if (animId) {
          cancelAnimationFrame(animId);
          animId = null;
        }
      };

      const draw = () => {
        if (!isVisible || !isInView || !ctx) {
          animId = null;
          return;
        }
        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#4fe7ff';
        stars.forEach((s) => {
          s.y -= s.vy;
          if (s.y < 0) s.y = height;
          ctx.globalAlpha = s.alpha;
          ctx.fillRect(s.x, s.y, s.size, s.size);
        });
        ctx.restore();
        animId = requestAnimationFrame(draw);
      };

      doc.addEventListener('visibilitychange', () => {
        isVisible = !doc.hidden;
        if (isVisible) startAnim();
        else stopAnim();
      });

      if ('IntersectionObserver' in window) {
        const finalObserver = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            isInView = entry.isIntersecting;
            if (isInView) startAnim();
            else stopAnim();
          });
        }, { threshold: 0 });
        const finalSection = finalCanvas.closest('.final') || finalCanvas;
        finalObserver.observe(finalSection);
      } else {
        isInView = true;
        startAnim();
      }
    }
  }

  const briefBuilder = doc.getElementById('brief-builder');
  if (briefBuilder) {
    const briefTypesGroup = doc.getElementById('brief-types');
    const briefPrioritiesGroup = doc.getElementById('brief-priorities');
    const briefStagesGroup = doc.getElementById('brief-stages');
    const briefOutcomesGroup = doc.getElementById('brief-outcomes');
    const notesInput = doc.getElementById('brief-notes');
    const charCountEl = doc.getElementById('brief-char-count');
    const outputEl = doc.getElementById('brief-output');
    const copyBtn = doc.getElementById('copy-brief-btn');
    const resetBtn = doc.getElementById('reset-brief-btn');

    const defaultState = {
      type: 'Website',
      priority: 'High performance & speed',
      stage: 'Concept & planning',
      outcome: 'Community growth & engagement',
      notes: ''
    };

    let currentState = { ...defaultState };

    const formatBrief = (state) => {
      const sanitizedNotes = (state.notes || '').trim();
      const notesDisplay = sanitizedNotes.length > 0 ? sanitizedNotes : 'None provided';
      return [
        '========================================',
        'ARKUZO PROJECT BRIEF',
        '========================================',
        `Project Type:     ${state.type}`,
        `Main Priority:    ${state.priority}`,
        `Current Stage:    ${state.stage}`,
        `Desired Outcome:  ${state.outcome}`,
        `Additional Notes: ${notesDisplay}`,
        '----------------------------------------',
        'Destination:      #tech-corner / #project-briefs',
        'Community:        discord.gg/arkuzo',
        'Status:           Client-side brief ready for review',
        '========================================'
      ].join('\n');
    };

    const updatePreview = () => {
      if (outputEl) {
        outputEl.textContent = formatBrief(currentState);
      }
    };

    const setupRadiogroup = (groupEl, stateKey, dataAttr) => {
      if (!groupEl) return;
      const pills = Array.from(groupEl.querySelectorAll('.brief-pill'));

      const selectPill = (pillToSelect, focusIt = false) => {
        pills.forEach((p) => {
          const isTarget = p === pillToSelect;
          p.classList.toggle('active', isTarget);
          p.setAttribute('aria-checked', String(isTarget));
          p.setAttribute('tabindex', isTarget ? '0' : '-1');
        });
        currentState[stateKey] = pillToSelect.getAttribute(dataAttr) || pillToSelect.textContent.trim();
        updatePreview();
        if (focusIt) {
          pillToSelect.focus();
        }
      };

      pills.forEach((pill) => {
        pill.addEventListener('click', () => {
          selectPill(pill, false);
        });

        pill.addEventListener('keydown', (e) => {
          const currentIndex = pills.indexOf(pill);
          let targetIndex = -1;

          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            targetIndex = (currentIndex + 1) % pills.length;
          } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            targetIndex = (currentIndex - 1 + pills.length) % pills.length;
          } else if (e.key === 'Home') {
            e.preventDefault();
            targetIndex = 0;
          } else if (e.key === 'End') {
            e.preventDefault();
            targetIndex = pills.length - 1;
          }

          if (targetIndex !== -1) {
            selectPill(pills[targetIndex], true);
          }
        });
      });
    };

    setupRadiogroup(briefTypesGroup, 'type', 'data-type');
    setupRadiogroup(briefPrioritiesGroup, 'priority', 'data-priority');
    setupRadiogroup(briefStagesGroup, 'stage', 'data-stage');
    setupRadiogroup(briefOutcomesGroup, 'outcome', 'data-outcome');

    if (notesInput) {
      notesInput.addEventListener('input', () => {
        const val = notesInput.value || '';
        currentState.notes = val;
        if (charCountEl) {
          charCountEl.textContent = `${val.length} / 240`;
        }
        updatePreview();
      });
    }

    if (copyBtn) {
      let resetCopyTimer = null;
      const copySpan = copyBtn.querySelector('span');

      const setCopySuccess = () => {
        copyBtn.classList.add('copied');
        if (copySpan) copySpan.textContent = 'Copied!';
        if (resetCopyTimer) clearTimeout(resetCopyTimer);
        resetCopyTimer = setTimeout(() => {
          copyBtn.classList.remove('copied');
          if (copySpan) copySpan.textContent = 'Copy Brief';
          resetCopyTimer = null;
        }, 2500);
      };

      const copyBrief = () => {
        const textToCopy = formatBrief(currentState);
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          navigator.clipboard.writeText(textToCopy).then(
            () => {
              setCopySuccess();
              showToast('Project brief copied to clipboard!');
            },
            () => {
              execCommandFallback(textToCopy);
            }
          );
        } else {
          execCommandFallback(textToCopy);
        }
      };

      const execCommandFallback = (text) => {
        try {
          const ta = doc.createElement('textarea');
          ta.value = text;
          ta.setAttribute('readonly', '');
          ta.style.position = 'fixed';
          ta.style.top = '-9999px';
          ta.style.opacity = '0';
          doc.body.appendChild(ta);
          ta.select();
          const successful = doc.execCommand('copy');
          doc.body.removeChild(ta);
          if (successful) {
            setCopySuccess();
            showToast('Project brief copied to clipboard!');
          } else {
            showToast('Failed to copy. Please select text manually.', true);
          }
        } catch {
          showToast('Failed to copy. Please select text manually.', true);
        }
      };

      copyBtn.addEventListener('click', copyBrief);
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        currentState = { ...defaultState };

        const resetGroup = (groupEl) => {
          if (!groupEl) return;
          const pills = Array.from(groupEl.querySelectorAll('.brief-pill'));
          pills.forEach((p, idx) => {
            const isFirst = idx === 0;
            p.classList.toggle('active', isFirst);
            p.setAttribute('aria-checked', String(isFirst));
            p.setAttribute('tabindex', isFirst ? '0' : '-1');
          });
        };

        resetGroup(briefTypesGroup);
        resetGroup(briefPrioritiesGroup);
        resetGroup(briefStagesGroup);
        resetGroup(briefOutcomesGroup);

        if (notesInput) {
          notesInput.value = '';
        }
        if (charCountEl) {
          charCountEl.textContent = '0 / 240';
        }

        updatePreview();
        showToast('Project brief reset to defaults');

        const firstPill = briefTypesGroup ? briefTypesGroup.querySelector('.brief-pill') : null;
        if (firstPill) firstPill.focus();
      });
    }

    updatePreview();
  }

  const scrollTopBtn = doc.getElementById('scroll-top-btn');
  if (scrollTopBtn) {
    scrollTopBtn.addEventListener('click', () => {
      window.scrollTo({
        top: 0,
        behavior: isReduced ? 'auto' : 'smooth'
      });
    });
  }

  const yearEls = doc.querySelectorAll('[data-year]');
  const currentYear = String(new Date().getFullYear());
  yearEls.forEach((el) => {
    el.textContent = currentYear;
  });
})();
