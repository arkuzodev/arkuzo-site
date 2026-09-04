(() => {
  'use strict';

  const doc = document;
  const root = doc.documentElement;
  const isReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isPointerFine = window.matchMedia('(pointer: fine)').matches;

  // 1. Cinematic Intro Sequence
  const intro = doc.querySelector('[data-intro]');
  if (intro) {
    const hasSeenIntro = sessionStorage.getItem('arkuzo_intro_seen');
    if (isReduced || hasSeenIntro) {
      intro.classList.add('done');
    } else {
      setTimeout(() => {
        intro.classList.add('done');
        sessionStorage.setItem('arkuzo_intro_seen', '1');
      }, 850);
    }
  }

  // 2. Navigation & Mobile Menu
  const header = doc.querySelector('[data-header]');
  const menuBtn = doc.querySelector('.menu-button');
  const navMenu = doc.querySelector('#nav-menu');
  const navLinks = navMenu ? Array.from(navMenu.querySelectorAll('a[href^="#"]')) : [];

  const updateHeader = () => {
    if (header) header.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', updateHeader, { passive: true });
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

    doc.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuBtn.getAttribute('aria-expanded') === 'true') {
        closeMenu();
        menuBtn.focus();
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
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
          });
        }
      });
    }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
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
      heroSec.addEventListener('pointermove', (e) => {
        const rect = heroSec.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        parallaxNode.style.transform = `perspective(1000px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(10px)`;
      });
      heroSec.addEventListener('pointerleave', () => {
        parallaxNode.style.transform = '';
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
    let width = (heroCanvas.width = heroCanvas.offsetWidth);
    let height = (heroCanvas.height = heroCanvas.offsetHeight);
    let particles = [];
    let isVisible = true;
    let animId;

    const createParticles = () => {
      const count = Math.min(48, Math.floor(width / 24));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: Math.random() * 1.8 + 0.8,
        alpha: Math.random() * 0.4 + 0.2
      }));
    };

    const resize = () => {
      width = heroCanvas.width = heroCanvas.offsetWidth;
      height = heroCanvas.height = heroCanvas.offsetHeight;
      createParticles();
    };
    window.addEventListener('resize', resize, { passive: true });
    createParticles();

    const render = () => {
      if (!isVisible || !ctx) return;
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

        // Connecting lines between nearby particles
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dx = p.x - p2.x;
          const dy = p.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(7, 87, 232, ${(1 - dist / 110) * 0.22})`;
            ctx.lineWidth = 0.8;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      animId = requestAnimationFrame(render);
    };

    render();

    doc.addEventListener('visibilitychange', () => {
      isVisible = !doc.hidden;
      cancelAnimationFrame(animId);
      if (isVisible) render();
    });
  }

  // 6. Sticky Community Story (Meet, Play, Create)
  const storySteps = Array.from(doc.querySelectorAll('.story-step'));
  const storyVisual = doc.querySelector('[data-story-visual]');
  if (storySteps.length && storyVisual) {
    const storyData = {
      meet: {
        num: '01',
        title: 'MEET',
        status: 'Finding your place in the network',
        sat: 'OPEN LOBBY'
      },
      play: {
        num: '02',
        title: 'PLAY',
        status: 'Queuing up with the community',
        sat: 'ACTIVE SQUADS'
      },
      create: {
        num: '03',
        title: 'CREATE',
        status: 'Building and sharing together',
        sat: 'NEW PROJECTS'
      }
    };

    const numEl = storyVisual.querySelector('.story-top b');
    const labelEl = storyVisual.querySelector('.story-core span');
    const statusEl = storyVisual.querySelector('.story-status span');
    const s1El = storyVisual.querySelector('.story-satellite.s1');

    const updateStory = (key) => {
      const data = storyData[key];
      if (!data) return;
      if (numEl) numEl.textContent = data.num;
      if (labelEl) labelEl.textContent = data.title;
      if (statusEl) statusEl.textContent = data.status;
      if (s1El) s1El.textContent = data.sat;
    };

    if ('IntersectionObserver' in window) {
      const storyObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const step = entry.target;
            storySteps.forEach((s) => s.classList.toggle('active', s === step));
            updateStory(step.dataset.story);
          }
        });
      }, { threshold: 0.6 });
      storySteps.forEach((step) => storyObserver.observe(step));
    }
  }

  // 7. Gaming Mode Switcher
  const modeButtons = Array.from(doc.querySelectorAll('[data-mode]'));
  const modeDisplay = doc.querySelector('[data-mode-display]');
  if (modeButtons.length && modeDisplay) {
    const modeData = {
      casual: {
        tag: 'CASUAL',
        title: 'Drop in.<br>Stay awhile.',
        lead: 'No pressure, no performance. Find a room, join a conversation, and play at your own pace.',
        pills: ['OPEN VOICE', 'FLEXIBLE SQUADS']
      },
      competitive: {
        tag: 'COMPETITIVE',
        title: 'Sharpen up.<br>Play to win.',
        lead: 'Queue with people who coordinate, communicate, and push to improve round after round.',
        pills: ['COORDINATION', 'RANKED TEAMS']
      },
      cooperative: {
        tag: 'COOPERATIVE',
        title: 'Work together.<br>Clear the board.',
        lead: 'Tackle campaigns, community raids, and co-op favorites where everyone shares the victory.',
        pills: ['SHARED PROGRESS', 'STRATEGY']
      },
      events: {
        tag: 'COMMUNITY EVENTS',
        title: 'Game nights &amp;<br>challenges.',
        lead: 'Organized sessions, friendly tournaments, and memorable evenings across favorite titles.',
        pills: ['GAME NIGHTS', 'CHALLENGES']
      }
    };

    modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const modeKey = btn.dataset.mode;
        const data = modeData[modeKey];
        if (!data) return;

        modeButtons.forEach((b) => {
          const isSelected = b === btn;
          b.setAttribute('aria-selected', String(isSelected));
        });

        const copyContainer = modeDisplay.querySelector('.mode-copy');
        if (copyContainer) {
          copyContainer.innerHTML = `
            <span>PLAY MODE / <b>${data.tag}</b></span>
            <h3>${data.title}</h3>
            <p>${data.lead}</p>
            <div>${data.pills.map((pill) => `<i>${pill}</i>`).join('')}</div>
          `;
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
    let width = (finalCanvas.width = finalCanvas.offsetWidth);
    let height = (finalCanvas.height = finalCanvas.offsetHeight);
    let stars = [];
    let isVisible = true;
    let animId;

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
      width = finalCanvas.width = finalCanvas.offsetWidth;
      height = finalCanvas.height = finalCanvas.offsetHeight;
      makeStars();
    };
    window.addEventListener('resize', resize, { passive: true });
    makeStars();

    const draw = () => {
      if (!isVisible || !ctx) return;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#4fe7ff';
      stars.forEach((s) => {
        s.y -= s.vy;
        if (s.y < 0) s.y = height;
        ctx.globalAlpha = s.alpha;
        ctx.fillRect(s.x, s.y, s.size, s.size);
      });
      ctx.globalAlpha = 1;
      animId = requestAnimationFrame(draw);
    };
    draw();

    doc.addEventListener('visibilitychange', () => {
      isVisible = !doc.hidden;
      cancelAnimationFrame(animId);
      if (isVisible) draw();
    });
  }

  // 11. Dynamic Year
  const yearEl = doc.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());
})();
