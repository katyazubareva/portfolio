/* =========================================================
   HERO HANDS — dot-art hands behind the hero

   Usage on the main page:
     <canvas class="hero-hands"></canvas> inside .hero,
     <script src="assets/hands-data.js" defer></script>
     <script src="hands.js" defer></script>

   A robot hand (left) and the hand from The Creation of Adam
   (right) are stored as dot grids (assets/hands-data.js) and
   reach towards each other from the screen edges. Both are
   drawn as a halftone: dots grow with the shade, highlights stay
   empty, and the deepest shadows turn into $ and #.

   Idle: every dot trembles on its own rhythm and glyphs
   flicker now and then.
   Hover: a lens follows the pointer — dots under it grow,
   darken, turn into dense glyphs and bulge outwards — and the
   closer the pointer gets to the gap between the fingers, the
   further the hands reach towards each other.

   The loop runs at ~30 fps and pauses while the hero is off
   screen or the tab is hidden; with reduced motion the hands
   are drawn once and stay still.
========================================================= */

(() => {

  const data = window.HANDS;
  const canvas = document.querySelector(".hero-hands");

  if (!data || !canvas) {
    return;
  }

  const hero = canvas.closest(".hero");
  const ctx = canvas.getContext("2d");

  const calm =
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const LENS = 150;      // lens radius, px
  const BULGE = 16;      // how far dots are pushed out, px
  const REACH = 26;      // how far the hands move together, px

  let dots = [];
  let width = 0;
  let height = 0;
  let spacing = 8;
  let centerX = 0;
  let centerY = 0;

  // Smoothed pointer state.
  let target = null;
  const lens = { x: 0, y: 0, s: 0 };
  let reach = 0;

  function build() {

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    width = hero.clientWidth;
    height = hero.clientHeight;

    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const mobile = width < 700;

    const tipLeft = data.left.x + data.left.cols * data.step;

    // Desktop: fingertips stop beside the content, the arms run
    // off the screen edges. Phone: there is no room beside the
    // content, so the hands sit under it, larger, fingertips
    // almost meeting in the middle and the arms cut off by the
    // screen edges.
    const gapHalf = mobile ? width * .03 : width * .17;
    const scale = mobile
      ? width * .0011
      : Math.min(1.15, (width / 2 - gapHalf) / tipLeft);

    // Layout position of an element inside the hero. offsetTop
    // ignores CSS transforms, so lifting the hero content does
    // not move the hands.
    const layoutTop = el => {
      let top = 0;
      for (let node = el; node && node !== hero; node = node.offsetParent) {
        top += node.offsetTop;
      }
      return top;
    };

    centerX = width / 2;

    const button = hero.querySelector(".resume-button");
    const content = hero.querySelector(".hero-content");

    if (mobile && content) {
      // Just under the hero content, with room for the arms.
      centerY = layoutTop(content) + content.offsetHeight + 90 * (width / 375);
    } else if (button) {
      // Vertically centred on the resume button.
      centerY = layoutTop(button) + button.offsetHeight / 2;
    } else {
      centerY = height * .6;
    }

    // Source centre between the two hands.
    const srcMidY = 410;

    // Keep dots at least ~3.5px apart on small screens.
    spacing = data.step * scale;
    const skip = Math.max(1, Math.round(3.5 / spacing));

    dots = [];

    [["left", -1], ["right", 1]].forEach(([side, dir]) => {

      const hand = data[side];
      const pts = hand.pts;

      for (let i = 0; i < pts.length; i += 3) {

        const col = pts[i];
        const row = pts[i + 1];

        if (col % skip || row % skip) {
          continue;
        }

        const sx = hand.x + col * data.step;
        const sy = hand.y + row * data.step;

        const x =
          dir < 0
            ? centerX - gapHalf - (tipLeft - sx) * scale
            : centerX + gapHalf + (sx - data.right.x) * scale;

        const y =
          centerY + (sy - srcMidY) * scale;

        dots.push({
          hx: x,
          hy: y,
          dir,
          t: pts[i + 2],
          flick: 0,
          p1: Math.random() * Math.PI * 2,
          p2: Math.random() * Math.PI * 2,
          sp: .7 + Math.random() * .8
        });
      }
    });

    spacing *= skip;

    render(performance.now());
  }

  function render(now) {

    const time = now / 1000;

    ctx.clearRect(0, 0, width, height);

    const base = Math.max(6, spacing * 1.5);
    const tremble = calm ? 0 : Math.max(.35, spacing * .09);

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    let font = "";

    for (const d of dots) {

      // Idle tremble.
      let x = d.hx + Math.sin(time * 2.1 * d.sp + d.p1) * tremble;
      let y = d.hy + Math.cos(time * 1.7 * d.sp + d.p2) * tremble;

      // Hands reach towards each other.
      x -= d.dir * reach * REACH;

      let tone = d.t + d.flick;
      let grow = 1;

      // Lens under the pointer.
      if (lens.s > .01) {

        const dx = x - lens.x;
        const dy = y - lens.y;
        const dist = Math.hypot(dx, dy);

        if (dist < LENS) {

          const k = (1 - dist / LENS) ** 2 * lens.s;

          if (dist > .01) {
            x += dx / dist * k * BULGE;
            y += dy / dist * k * BULGE;
          }

          grow += k * 1.1;
          tone += k * 5;
        }
      }

      tone = Math.min(11, tone);

      // Halftone: the brightest spots stay empty, dots grow with
      // the shade, and only the deepest shadows (on the robot,
      // its joints) turn into $ and #.
      if (tone < .5) {
        continue;
      }

      const alpha = Math.min(.92, .25 + tone * .075);

      ctx.fillStyle = `rgba(95, 95, 100, ${alpha})`;

      if (tone >= 8.5) {

        const g = tone >= 9.5 ? "#" : "$";
        const size = Math.round(base * grow);
        const f = `600 ${size}px ui-monospace, Menlo, monospace`;

        if (f !== font) {
          ctx.font = f;
          font = f;
        }

        ctx.fillText(g, x, y);

      } else {

        const r = spacing * .5 * (.18 + .82 * Math.min(tone, 8) / 8) ** .9 * grow;

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  // ---- animation loop ----

  let running = false;
  let visible = true;
  let last = 0;

  function tick(now) {

    if (!running) {
      return;
    }

    requestAnimationFrame(tick);

    // ~30 fps is plenty for this and saves battery.
    if (now - last < 32) {
      return;
    }

    last = now;

    // Ease the lens towards the pointer and in/out.
    if (target) {
      lens.x += (target.x - lens.x) * .18;
      lens.y += (target.y - lens.y) * .18;
    }

    lens.s += ((target ? 1 : 0) - lens.s) * .12;

    // Reach grows as the pointer nears the gap between fingers.
    let want = 0;

    if (target) {
      const near = Math.hypot(target.x - centerX, (target.y - centerY) * 1.6);
      want = Math.max(0, 1 - near / (width * .3));
    }

    reach += (want - reach) * .08;

    // Random glyph flicker on a few dots each frame.
    for (let i = 0; i < 6; i++) {
      const d = dots[(Math.random() * dots.length) | 0];
      if (d) {
        d.flick = d.flick ? 0 : (Math.random() < .5 ? 1 : -1);
      }
    }

    render(now);
  }

  function start() {
    if (!running && !calm && visible && !document.hidden) {
      running = true;
      requestAnimationFrame(tick);
    }
  }

  function stop() {
    running = false;
  }

  if ("IntersectionObserver" in window) {
    new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      visible ? start() : stop();
    }).observe(hero);
  }

  document.addEventListener("visibilitychange", () => {
    document.hidden ? stop() : start();
  });

  // ---- pointer ----

  hero.addEventListener("pointermove", event => {

    const box = hero.getBoundingClientRect();

    const x = event.clientX - box.left;
    const y = event.clientY - box.top;

    if (!target) {
      lens.x = x;
      lens.y = y;
    }

    target = { x, y };
  });

  hero.addEventListener("pointerleave", () => {
    target = null;
  });

  // ---- setup ----

  let resizeTimer = null;

  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 150);
  });

  // Fonts change the hero layout, so build once they are in.
  (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => {
    build();
    start();
  });

})();
