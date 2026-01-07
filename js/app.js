document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("ocean");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const splash = document.getElementById("splash");

  let w = 0, h = 0, t = 0;

  // Keep performance safe
  const particles = [];
  const particleCount = 160;

  let seabed = [];

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = window.innerWidth;
    h = window.innerHeight;

    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    buildSeabed();
    initParticles();
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
        a: rand(0.08, 0.28)
      });
    }
  }

  // --- Deep dark ocean background (clean) ---
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, "#1f8fbe");
    g.addColorStop(0.16, "#075786");
    g.addColorStop(0.42, "#032b44");
    g.addColorStop(0.75, "#011624");
    g.addColorStop(1.00, "#010b12");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Depth vignette
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.35, 80, w * 0.5, h * 0.65, Math.max(w, h));
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.40)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // --- Heavy surface waves (very visible) ---
  function drawSurfaceWaves() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const bandTop = h * 0.04;
    const bandHeight = h * 0.24;

    // shimmer sweep
    const sweep = (Math.sin(t * 0.9) * 0.5 + 0.5) * w;
    ctx.globalAlpha = 0.18;
    const shimmer = ctx.createLinearGradient(sweep - w * 0.8, bandTop, sweep + w * 0.8, bandTop + bandHeight);
    shimmer.addColorStop(0, "rgba(255,255,255,0)");
    shimmer.addColorStop(0.5, "rgba(255,255,255,0.32)");
    shimmer.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shimmer;
    ctx.fillRect(0, bandTop, w, bandHeight);

    // foam glow band
    ctx.globalAlpha = 0.18;
    const g = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandHeight);
    g.addColorStop(0, "rgba(255,255,255,0.40)");
    g.addColorStop(0.55, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0.00)");
    ctx.fillStyle = g;
    ctx.fillRect(0, bandTop, w, bandHeight);

    // heavy multi-wave layers
    for (let i = 0; i < 7; i++) {
      const y0 = bandTop + i * (bandHeight / 8);
      const amp = 20 + i * 7;          // heavy
      const freq = 0.012 + i * 0.0022;
      const speed = 1.9 + i * 0.12;

      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 10) {
        const y =
          y0 +
          Math.sin(x * freq + t * speed + i) * amp +
          Math.sin(x * (freq * 0.55) - t * (speed * 0.78) + i * 2) * (amp * 0.35);
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, bandTop);
      ctx.lineTo(0, bandTop);
      ctx.closePath();

      ctx.globalAlpha = 0.14 + i * 0.02;
      ctx.fillStyle = "rgba(255,255,255,0.26)";
      ctx.fill();
    }

    ctx.restore();
  }

  // --- Warm golden god rays ---
  function drawGodRays() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const cx = w * 0.5;
    const cy = -h * 0.10;

    for (let i = 0; i < 9; i++) {
      const base = (i - 4) * 0.20;
      const sway = Math.sin(t * 0.33 + i) * 0.12;
      const angle = base + sway;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const width = w * (0.15 + (i % 3) * 0.04);

      const rg = ctx.createLinearGradient(0, 0, 0, h * 1.25);
      rg.addColorStop(0.00, "rgba(255,215,130,0.85)");
      rg.addColorStop(0.22, "rgba(255,205,115,0.38)");
      rg.addColorStop(0.55, "rgba(255,195,95,0.12)");
      rg.addColorStop(1.00, "rgba(255,195,95,0)");

      ctx.globalAlpha = 0.32;
      ctx.fillStyle = rg;
      ctx.fillRect(-width * 0.5, 0, width, h * 1.25);

      ctx.restore();
    }

    ctx.restore();
  }

  // --- Light caustics (safe) ---
  function drawCaustics() {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.14;

    const step = 42; // bigger step = faster + lighter CPU
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n =
          Math.sin(x * 0.013 + t * 1.05) +
          Math.cos(y * 0.012 - t * 0.92) +
          Math.sin((x + y) * 0.010 + t * 0.62);

        const v = (n + 3) / 6;
        const a = Math.max(0, v - 0.56) * 0.9;
        if (a > 0.03) {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    ctx.restore();
  }

  // --- Particles (depth dust) ---
  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const p of particles) {
      p.y -= p.v;
      p.x += Math.sin(t * 0.85 + p.y * 0.01) * 0.25;

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

  // --- Seabed (more visible, but still classy) ---
  function buildSeabed() {
    seabed = [];

    const rockCount = Math.max(12, Math.floor(w / 85));
    for (let i = 0; i < rockCount; i++) {
      seabed.push({
        type: "rock",
        x: rand(-80, w + 80),
        y: h - rand(10, 85),
        r: rand(60, 160)
      });
    }

    const weedCount = Math.max(22, Math.floor(w / 42));
    for (let i = 0; i < weedCount; i++) {
      seabed.push({
        type: "weed",
        x: rand(0, w),
        baseY: h - rand(6, 34),
        hh: rand(70, 190),
        sway: rand(0.9, 2.4),
        thick: rand(2.2, 3.4)
      });
    }
  }

  function drawSeabed() {
    ctx.save();

    // Dark floor haze (brings seabed out clearly)
    const floor = ctx.createLinearGradient(0, h * 0.58, 0, h);
    floor.addColorStop(0, "rgba(0,0,0,0)");
    floor.addColorStop(1, "rgba(0,0,0,0.82)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, h * 0.58, w, h * 0.42);

    for (const s of seabed) {
      if (s.type === "rock") {
        ctx.globalAlpha = 0.62;
        ctx.fillStyle = "rgba(0,0,0,0.78)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const sway = Math.sin(t * 1.05 + s.x * 0.02) * (16 * s.sway);

        ctx.globalAlpha = 0.62;
        ctx.strokeStyle = "rgba(0,0,0,0.88)";
        ctx.lineWidth = s.thick;

        ctx.beginPath();
        ctx.moveTo(s.x, s.baseY);
        ctx.quadraticCurveTo(
          s.x + sway * 0.45,
          s.baseY - s.hh * 0.45,
          s.x + sway,
          s.baseY - s.hh
        );
        ctx.stroke();
      }
    }

    ctx.restore();
  }

  function frame() {
    t += 0.016;
    drawBackground();
    drawSurfaceWaves();
    drawGodRays();
    drawCaustics();
    drawParticles();
    drawSeabed();
    requestAnimationFrame(frame);
  }

  // Start
  resize();
  window.addEventListener("resize", resize);
  frame();

  // Keep splash for 3s, fade, then go to login
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