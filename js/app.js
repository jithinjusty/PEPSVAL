document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("ocean");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const splash = document.getElementById("splash");

  let w = 0, h = 0;
  let t = 0;

  // Fine particles (visible but not distracting)
  const particles = [];
  const particleCount = 170;

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

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.6, 2.0),
        v: rand(0.10, 0.45),
        a: rand(0.10, 0.35)
      });
    }
  }

  function drawDeepBackground() {
    // Deep clean water: bright top → deep blue-green bottom
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, "#5fd6ff");
    g.addColorStop(0.22, "#157cc6");
    g.addColorStop(0.55, "#0a3b57");
    g.addColorStop(1.0, "#031522");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Gentle vignette depth (keeps center readable)
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.35, 60, w * 0.5, h * 0.55, Math.max(w, h) * 0.85);
    vg.addColorStop(0, "rgba(255,255,255,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  function drawSurfaceWaves() {
    // Moving wave band near top (clearly visible)
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.18;

    const bandTop = h * 0.08;
    const bandHeight = h * 0.14;

    // soft white foam glow
    const g = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandHeight);
    g.addColorStop(0, "rgba(255,255,255,0.35)");
    g.addColorStop(1, "rgba(255,255,255,0.00)");
    ctx.fillStyle = g;
    ctx.fillRect(0, bandTop, w, bandHeight);

    // ripples
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 5; i++) {
      const y0 = bandTop + i * (bandHeight / 6);
      const amp = 10 + i * 4;
      const freq = 0.010 + i * 0.002;

      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 10) {
        const y = y0 + Math.sin(x * freq + t * 1.4 + i) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, bandTop);
      ctx.lineTo(0, bandTop);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fill();
    }

    ctx.restore();
  }

  function drawGodRays() {
    // Strong, slow moving rays from top center
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const cx = w * 0.5;
    const cy = -h * 0.08;

    for (let i = 0; i < 8; i++) {
      const base = (i - 3.5) * 0.22;
      const sway = Math.sin(t * 0.35 + i) * 0.10;
      const angle = base + sway;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const width = w * (0.12 + (i % 3) * 0.03);

      const rg = ctx.createLinearGradient(0, 0, 0, h * 1.2);
      rg.addColorStop(0.0, "rgba(255,255,255,0.45)");
      rg.addColorStop(0.25, "rgba(255,255,255,0.14)");
      rg.addColorStop(1.0, "rgba(255,255,255,0)");

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = rg;
      ctx.fillRect(-width * 0.5, 0, width, h * 1.2);

      ctx.restore();
    }

    ctx.restore();
  }

  function drawCaustics() {
    // Caustics moving mid-water (noticeable, not too much)
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.18;

    const step = 34;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n =
          Math.sin((x * 0.014) + t * 1.15) +
          Math.cos((y * 0.013) - t * 0.95) +
          Math.sin(((x + y) * 0.011) + t * 0.65);

        const v = (n + 3) / 6; // 0..1
        const a = Math.max(0, v - 0.54) * 0.85;

        if (a > 0.02) {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }
    ctx.restore();
  }

  function drawParticles() {
    // Rising particulate (gives depth)
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const p of particles) {
      p.y -= p.v;
      p.x += Math.sin(t * 0.8 + p.y * 0.01) * 0.25;

      if (p.y < -12) {
        p.y = h + 12;
        p.x = rand(0, w);
      }

      ctx.globalAlpha = p.a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = "white";
      ctx.fill();
    }
    ctx.restore();
  }

  function frame() {
    t += 0.016;

    drawDeepBackground();
    drawSurfaceWaves();
    drawGodRays();
    drawCaustics();
    drawParticles();

    requestAnimationFrame(frame);
  }

  // Init
  resize();
  initParticles();
  window.addEventListener("resize", () => {
    resize();
    initParticles();
  });

  frame();

  // Splash for 3 seconds, then redirect to login
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