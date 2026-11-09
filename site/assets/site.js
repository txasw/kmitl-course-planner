// Progressive enhancement for the KCP landing page (ADR-0066). The page is complete
// without this file. It runs in the head, before the stylesheet, so the classes that
// switch the motion on exist before the first layout and nothing shifts or flashes:
// .motion unless the reader prefers reduced motion, and .no-sda where the browser has no
// scroll driven animations, so the stylesheet plays each moment from the classes this
// file adds as blocks come into view. The two pinned scenes step on their own clock in
// every browser once the scroll crosses each of their lines. It also puts the Firefox
// badge first for a Firefox visitor, and carries the section in the address
// across the language switch. It listens to no scroll event; while a keep scrolling cue
// shows, it listens for the reader's next wheel, touch or key alone. It sends nothing
// anywhere and stores nothing.

(() => {
  const root = document.documentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Every moment needs an observer to find its place, so a browser without one keeps
  // the still page.
  function syncMotion() {
    root.classList.toggle(
      'motion',
      !reduce.matches && 'IntersectionObserver' in window,
    );
  }

  syncMotion();
  reduce.addEventListener('change', syncMotion);
  if (!CSS.supports('animation-timeline: view()')) {
    root.classList.add('no-sda');
  }
  // A Firefox visitor finds the Firefox badge first, and focus reaches it first too, so
  // the badge moves in the document, not only on screen. It moves as the parser inserts
  // it, in the microtask before any paint can show the other order, so nothing shifts.
  if (navigator.userAgent.includes('Firefox/')) {
    const firefoxFirst = (badge) => {
      const chrome = badge.previousElementSibling;
      if (chrome?.classList.contains('store--chrome') === true) {
        chrome.before(badge);
      }
    };
    const parsing = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (
            node instanceof Element &&
            node.classList.contains('store--firefox')
          ) {
            firefoxFirst(node);
          }
        });
      });
    });
    parsing.observe(root, { childList: true, subtree: true });
    document.addEventListener('DOMContentLoaded', () => {
      parsing.disconnect();
      document.querySelectorAll('.store--firefox').forEach(firefoxFirst);
    });
  }

  const scrollDriven = () => !root.classList.contains('no-sda');

  /** Copy a numeric data attribute into a custom property through the CSSOM. */
  function indexVar(el, data, name) {
    const value = el.getAttribute(data);
    if (value !== null) {
      el.style.setProperty(name, value);
    }
  }

  // Path B: each block reveals once, the first time a fifth of it is in view.
  function revealOnView() {
    const blocks = document.querySelectorAll('[data-reveal]');
    if (scrollDriven()) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -10% 0px' },
    );
    blocks.forEach((block) => {
      observer.observe(block);
    });
  }

  // Path B: the closing band plays once, when a third of it is in view.
  function playClose() {
    const band = document.querySelector('.download');
    if (band === null || scrollDriven()) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting === true) {
          band.classList.add('is-in');
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(band);
  }

  // Path B: the hero frame stands up once its track is well in view; a third of the
  // track on a window that pins it, a fifth elsewhere.
  function standHeroFrame() {
    const track = document.querySelector('.hero__track');
    if (
      track === null ||
      scrollDriven() ||
      !('IntersectionObserver' in window)
    ) {
      return;
    }
    const pinned = window.matchMedia(
      '(min-width: 768px) and (min-height: 680px)',
    );
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (
          entry !== undefined &&
          entry.intersectionRatio >= (pinned.matches ? 0.35 : 0.2)
        ) {
          track.classList.add('is-in');
          observer.disconnect();
        }
      },
      { threshold: [0.2, 0.35] },
    );
    observer.observe(track);
  }

  /**
   * Watch a pinned track's lines, each a fraction of the track's scroll distance, and
   * report how many of them lie above the line under the header, for each crossed line
   * whether the reader reached it fast, and whether the scroll jumped there. Every line
   * has a gate a little before it, `gap` of the distance, and a reader who crosses the
   * gate and then the line within GATE_MS is moving at a few hundred pixels a second or
   * more. A scroll that crosses a line together with its gate, or several lines, in one
   * frame is a jump: an anchor link, a restored position, the End key. Each point is a
   * zero height sentinel one header height above it, so it meets the window's top edge as
   * its point meets the line under the header, and the observed band runs from far above
   * the window down to that edge. Its margins are set in pixels and percentages alone, so
   * setting it up reads no size and forces no layout, and it follows any change of window
   * size by itself. A fast scroll that jumps a sentinel past the edge in one frame still
   * changes its state, and the entry's own time says when.
   */
  function watchLines(track, lines, gap, onChange) {
    const points = lines.flatMap((at) => [at - gap, at]);
    const since = points.map(() => -1);
    const sentinels = points.map((at) => {
      const sentinel = document.createElement('div');
      sentinel.className = 'sentinel';
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.setProperty('--at', String(at));
      track.append(sentinel);
      return sentinel;
    });
    let before = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        const moved = new Set();
        entries.forEach((entry) => {
          const index = sentinels.indexOf(entry.target);
          moved.add(index);
          since[index] = entry.isIntersecting ? entry.time : -1;
        });
        let crossed = 0;
        const fast = lines.map((_, k) => {
          const gate = since[2 * k] ?? -1;
          const line = since[2 * k + 1] ?? -1;
          if (line >= 0) crossed = k + 1;
          return gate >= 0 && line >= 0 && line - gate < GATE_MS;
        });
        const jumped =
          crossed - before > 1 ||
          (crossed > before &&
            moved.has(2 * crossed - 2) &&
            moved.has(2 * crossed - 1));
        before = crossed;
        onChange(crossed, fast, jumped);
      },
      { rootMargin: '100000px 0px -100% 0px' },
    );
    sentinels.forEach((sentinel) => {
      observer.observe(sentinel);
    });
  }

  // A reader who crosses a gate and its line within this many ms is scrolling on.
  const GATE_MS = 250;
  // A step that has played stays whole this long before the next one plays, unless the
  // reader had already crossed the next one's line while it played.
  const HOLD = 650;
  // A reader already past the next line gets the next step after this short beat, and a
  // lead in step always hands on to the next one after it.
  const CHAIN = 100;
  // A step for a reader who is scrolling on plays its transitions at this share of their
  // length, which site.css reads as --pace.
  const QUICK = 0.4;
  // Stepping back plays the reverse transitions, which are short.
  const STEP_BACK = 350;

  /**
   * Move a scene one step at a time toward the step its scroll position asks for, which
   * `goalFor` reads from the number of lines crossed. Each step names its longest
   * transition in site.css, `time` in ms, and the share of it a reader who stops gets,
   * `scale`; a `lead` step only opens the next one and never holds. Each step plays on
   * its own clock, so a fast flick that crosses every line at once still shows each step
   * whole instead of a blur. The pace follows the reader. A reader who stops before the
   * next line gets each step at full length, and the next step waits until this one has
   * finished and held, so a line crossed soon after still leaves the finished step in
   * view. A reader who is scrolling on, who crossed the line fast or had already passed
   * the next line when a step finished, gets the steps quick and chained, so the scene
   * finishes while it is still pinned instead of trailing the scroll. A jump sets the
   * steps it passed at once and plays only the last, at full length, since the reader has
   * landed. Scrolling back steps down at once, the same way.
   */
  function stepper(el, steps, goalFor, meter) {
    let shown = 0;
    let crossed = 0;
    let fast = [];
    let jump = false;
    let cancel = null;
    let readyAt = 0;
    let quick = false;
    let landed = false;
    const show = (step, pace) => {
      shown = step;
      el.style.setProperty('--pace', String(pace));
      el.dataset.step = String(step);
      meter.playing(step);
    };
    const after = (ms, next) => {
      const id = window.setTimeout(() => {
        cancel = null;
        next();
      }, ms);
      cancel = () => {
        window.clearTimeout(id);
      };
    };
    // Two frames, so the state set now is styled before the next step plays from it.
    const afterStyle = (next) => {
      let id = window.requestAnimationFrame(() => {
        id = window.requestAnimationFrame(() => {
          cancel = null;
          next();
        });
      });
      cancel = () => {
        window.cancelAnimationFrame(id);
      };
    };
    const move = () => {
      const goal = goalFor(crossed);
      if (goal < shown) {
        jump = false;
        quick = false;
        landed = false;
        readyAt = 0;
        show(shown - 1, 1);
        after(STEP_BACK, move);
        return;
      }
      if (goal === shown) {
        meter.settled();
        return;
      }
      if (jump) {
        jump = false;
        quick = false;
        landed = true;
        readyAt = 0;
        if (goal > shown + 1) {
          show(goal - 1, 0);
          afterStyle(move);
          return;
        }
      }
      const early = readyAt - performance.now();
      if (early > 0) {
        after(early, move);
        return;
      }
      const step = steps[shown] ?? { time: 0 };
      const scale = step.scale ?? 1;
      const pace =
        !landed && (quick || fast[shown] === true)
          ? Math.min(QUICK, scale)
          : scale;
      landed = false;
      show(shown + 1, pace);
      after(step.time * pace, () => {
        quick = crossed > shown;
        readyAt =
          performance.now() + (quick || step.lead === true ? CHAIN : HOLD);
        move();
      });
    };
    el.dataset.step = '0';
    return (lines, gates, jumped) => {
      crossed = lines;
      fast = gates;
      const goal = goalFor(crossed);
      jump = jumped || (jump && goal > shown);
      if (cancel !== null && (goal < shown || (jump && goal > shown + 1))) {
        cancel();
        cancel = null;
      }
      if (cancel === null) move();
    };
  }

  // A pinned scene's progress, in RAIL_STEPS equal parts of its pinned scroll, and how far
  // it has left, in EXIT_STEPS equal parts of the scroll over which its stage leaves the
  // window, from sentinels placed as the step lines are: so the rail and the exit can
  // follow the scroll where the browser has no scroll driven animations, and so the scene
  // knows the reader is moving, without a scroll listener.
  // Reports how many points lie above the line under the header: 0 before the pin,
  // RAIL_STEPS + 1 once the pin has let go, RAIL_STEPS + 1 + EXIT_STEPS once the exit is
  // done.
  const RAIL_STEPS = 60;
  const EXIT_STEPS = 12;
  // The exit plays over this share of a window of scroll after the pin lets go, the range
  // the scroll driven exit uses.
  const EXIT_SPAN = 0.8;

  function watchProgress(track, onChange) {
    const points = [
      ...Array.from({ length: RAIL_STEPS + 1 }, (_, k) => [k / RAIL_STEPS, 0]),
      ...Array.from({ length: EXIT_STEPS }, (_, k) => [
        1,
        ((k + 1) / EXIT_STEPS) * EXIT_SPAN,
      ]),
    ];
    const above = points.map(() => false);
    const sentinels = points.map(([at, past]) => {
      const sentinel = document.createElement('div');
      sentinel.className = 'sentinel';
      sentinel.setAttribute('aria-hidden', 'true');
      sentinel.style.setProperty('--at', String(at));
      sentinel.style.setProperty('--past', String(past));
      track.append(sentinel);
      return sentinel;
    });
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          above[sentinels.indexOf(entry.target)] = entry.isIntersecting;
        });
        onChange(above.filter(Boolean).length);
      },
      { rootMargin: '100000px 0px -100% 0px' },
    );
    sentinels.forEach((sentinel) => {
      observer.observe(sentinel);
    });
  }

  // A reader who has stopped this long on a finished step is told the page goes on.
  const IDLE_MS = 1000;
  // Past this share of its pinned scroll a scene is about to let go and the next section
  // is coming into view, so the cue stays away.
  const CUE_UNTIL = 0.9;
  // The first touch of a wheel, a screen or a key while the cue shows hides it at once,
  // even when the nudge is too small to cross the next progress point. These listeners
  // exist only while the cue shows, are passive and never read or change the scroll.
  const NUDGES = ['wheel', 'touchstart', 'keydown'];

  /**
   * Drive a pinned scene's meter. The rail takes a mark for each step line, filled once
   * its step has played. Where the browser has no scroll driven animations the pin
   * carries --progress, from 0 to 1 across the pinned scroll, which fills the rail, and
   * --leave, from 0 to 1 across the exit, which plays the exit at the pace of the scroll.
   * The cue shows when a step has finished, the scene is pinned and no progress point has
   * moved for IDLE_MS, and it hides at the next point the scroll crosses, the next step,
   * or the reader's first nudge.
   */
  function sceneMeter(pin, track, lines) {
    const meter = pin.querySelector('.scene-meter');
    const rail = meter?.querySelector('.scene-rail');
    const marks = lines.map((at) => {
      const mark = document.createElement('i');
      mark.className = 'scene-rail__mark';
      mark.style.setProperty('--at', String(Math.max(0, at)));
      rail?.append(mark);
      return mark;
    });
    let crossed = 0;
    let busy = false;
    let timer = 0;
    let listening = null;
    const rest = () => {
      window.clearTimeout(timer);
      meter?.classList.remove('is-idle');
      listening?.abort();
      listening = null;
    };
    const idle = () => {
      meter?.classList.add('is-idle');
      const nudged = new AbortController();
      listening = nudged;
      NUDGES.forEach((type) => {
        window.addEventListener(type, rest, {
          passive: true,
          signal: nudged.signal,
        });
      });
    };
    const wait = () => {
      rest();
      const progress = (crossed - 1) / RAIL_STEPS;
      if (!busy && progress >= 0 && progress < CUE_UNTIL) {
        timer = window.setTimeout(idle, IDLE_MS);
      }
    };
    watchProgress(track, (count) => {
      crossed = count;
      const progress = Math.min(Math.max((count - 1) / RAIL_STEPS, 0), 1);
      const leave = Math.min(
        Math.max((count - RAIL_STEPS - 1) / EXIT_STEPS, 0),
        1,
      );
      pin.style.setProperty('--progress', String(progress));
      pin.style.setProperty('--leave', String(leave));
      wait();
    });
    return {
      playing(step) {
        busy = true;
        rest();
        marks.forEach((mark, k) => {
          mark.classList.toggle('is-passed', step > k);
        });
      },
      settled() {
        busy = false;
        wait();
      },
    };
  }

  // The dedupe stage plays from its first line, which it crosses while the card is still
  // rising the last tenth of its track to the header, so the merge is done early in the
  // pinned scroll. Its first step is a lead in: the repeats fade while the counter turns
  // from rows to sections, and a beat later the sections close up and take their labels,
  // so the merge completes within about 1.4 s and no stop rests on a card the repeats
  // have left half empty. The second line only tells the stage the reader has moved on,
  // which quickens the close up. The thirteen rows show before the first line and the
  // merged sections hold for the rest of the track.
  const DEDUPE_LINES = [-0.1, 0.05];
  const DEDUPE_STEPS = [
    { time: 800, scale: 0.65, lead: true },
    { time: 1000, scale: 0.75 },
  ];

  function enhanceDedupe(pin) {
    const track = pin.closest('.dedupe-track');
    if (track === null) return;
    pin.querySelectorAll('tbody tr').forEach((row) => {
      indexVar(row, 'data-i', '--i');
      indexVar(row, 'data-slot', '--t');
    });
    // How many rows stay and go, which size the merged card.
    indexVar(pin, 'data-kept', '--kept');
    indexVar(pin, 'data-gone', '--gone');
    watchLines(
      track,
      DEDUPE_LINES,
      0.06,
      stepper(
        pin,
        DEDUPE_STEPS,
        (crossed) => (crossed > 0 ? 2 : 0),
        sceneMeter(pin, track, DEDUPE_LINES.slice(0, 1)),
      ),
    );
  }

  // The story's three beats start at these fractions of its pinned scroll; the first
  // while the dark band is still rising to the header, so the grid is drawn by the time
  // it pins. The lines leave each beat room to play and hold at a steady scroll, and the
  // last beat a stretch of the track to stay in view before the pin lets go.
  const STORY_LINES = [-0.15, 0.24, 0.6];
  const STORY_STEPS = [{ time: 1000 }, { time: 1000 }, { time: 1100 }];

  function enhanceStory(track) {
    const pin = track.querySelector('.story__pin');
    if (pin === null) return;
    track.querySelectorAll('.story__block[data-b]').forEach((block) => {
      indexVar(block, 'data-b', '--b');
    });
    watchLines(
      track,
      STORY_LINES,
      0.04,
      stepper(
        pin,
        STORY_STEPS,
        (crossed) => crossed,
        sceneMeter(pin, track, STORY_LINES),
      ),
    );
  }

  // Both language pages share their section ids, so switching language keeps the reader
  // at the section the address names instead of returning them to the top.
  const SHARED_SECTIONS = new Set(['features', 'privacy', 'faq', 'download']);

  function keepSectionAcrossLanguages() {
    document.querySelectorAll('a[lang][hreflang]').forEach((link) => {
      link.addEventListener('click', () => {
        const id = window.location.hash.slice(1);
        if (SHARED_SECTIONS.has(id)) {
          link.hash = id;
        }
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.fact[data-i]').forEach((fact) => {
      indexVar(fact, 'data-i', '--i');
    });
    revealOnView();
    standHeroFrame();
    playClose();
    if ('IntersectionObserver' in window) {
      document.querySelectorAll('[data-dedupe]').forEach(enhanceDedupe);
      document.querySelectorAll('.story__track').forEach(enhanceStory);
    }
    keepSectionAcrossLanguages();
  });
})();
