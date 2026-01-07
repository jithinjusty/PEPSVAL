document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("ocean");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const splash = document.getElementById("splash");

  let w = 0, h = 0;
  let time = 0;

  // Big visible bubbles (stronger than before)
  const bubbles = [];
  const bubbleCount = 55;

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = window.innerWidth;
    h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) {
    return Math.random() * (max - min) + min;
  }

  function initBubbles() {
    bubbles.length = 0;
    for (let i = 0; i < bubbleCount; i++) {
      bubbles.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(2.5, 9.5),          // bigger
        v: rand(0.35, 1.25),        // faster
        drift: rand(0.6, 2.0),
        alpha: rand(0.10, 0.28)
      });
    }
  }

  function drawBackground() {
    // Light underwater base gradient
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, "#d8f6ff");
    g.addColorStop(0.45, "#bfe9f4");
    g.addColorStop(1.0, "#7fc7d8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawMovingLightBands() {
    // Very visible moving shimmer bands
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.globalCompositeOperation = "screen";

    const bandH = 36;
    for (let y = -bandH; y < h + bandH; y += bandH) {
      const shift = Math.sin((y * 0.02) + time * 1.25) * 55;
      const g = ctx.createLinearGradient(0, y, w, y);
      g.addColorStop(0, "rgba(255,255,255,0)");
      g.addColorStop(0.45 + (shift / w), "rgba(255,255,255,0.40)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, y, w, bandH * 0.55);
    }

    ctx.restore();
  }

  function drawCausticsGrid() {
    // A more visible caustics pattern (still tasteful)
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.14;

    const step = 42;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n =
          Math.sin((x * 0.012) + time * 1.1) +
          Math.cos((y * 0.014) - time * 0.9) +
          Math.sin(((x + y) * 0.01) + time * 0.7);

        const v = (n + 3) / 6; // 0..1
        const a = Math.max(0, v - 0.52) * 0.9;

        if (a > 0.03) {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    ctx.restore();
  }

  function drawBubbles() {
    // Big bubbles rising (very noticeable)
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const b of bubbles) {
      b.y -= b.v;
      b.x += Math.sin(time * 0.9 + b.y * 0.01) * b.drift;

      // recycle
      if (b.y < -20) {
        b.y = h + 20;
        b.x = rand(0, w);
      }
      if (b.x < -40) b.x = w + 40;
      if (b.x > w + 40) b.x = -40;

      ctx.globalAlpha = b.alpha;

      // bubble glow
      const rg = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r * 2.2);
      rg.addColorStop(0, "rgba(255,255,255,0.55)");
      rg.addColorStop(0.35, "rgba(255,255,255,0.18)");
      rg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r * 2.2, 0, Math.PI * 2);
      ctx.fill();

      // bubble ring
      ctx.globalAlpha = b.alpha + 0.06;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawTinyIndicator() {
    // Small moving dot, just to prove animation is moving
    ctx.save();
    const x = (time * 60) % w;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(x, 18, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function frame() {
    time += 0.016;

    drawBackground();
    drawMovingLightBands();
    drawCausticsGrid();
    drawBubbles();
    drawTinyIndicator();

    requestAnimationFrame(frame);
  }

  // init
  resize();
  initBubbles();
  window.addEventListener("resize", () => {
    resize();
    initBubbles();
  });

  frame();

  // Splash for 3 seconds, then redirect
  setTimeout(() => {
    if (splash) {
      splash.style.transition = "opacity 0.6s ease";
      splash.style.opacity = "0";
    }
    setTimeout(() => {
      window.location.href = "/auth/login.html";
    }, 600);
  }, 3000);
});