document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("ocean");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const splash = document.getElementById("splash");

  let w = 0, h = 0;
  let t = 0;

  const particles = [];
  const particleCount = 210;

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
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.6, 2.4),
        v: rand(0.12, 0.60),
        a: rand(0.08, 0.34)
      });
    }
  }

  // --- DEEP OCEAN BACKGROUND ---
  function drawDeepBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, "#249fd1");
    g.addColorStop(0.16, "#0a5d97");
    g.addColorStop(0.45, "#04324f");
    g.addColorStop(0.78, "#021725");
    g.addColorStop(1.00, "#010b13");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const vg = ctx.createRadialGradient(w * 0.5, h * 0.32, 60, w * 0.5, h * 0.62, Math.max(w, h) * 1.05);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.38)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // --- HEAVIER SURFACE WAVES + SHIMMER ---
  function drawSurfaceWaves() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const bandTop = h * 0.045;
    const bandHeight = h * 0.22;

    // shimmering moving highlight across the surface
    ctx.globalAlpha = 0.22;
    const shimmerX = (Math.sin(t * 0.9) * 0.5 + 0.5) * w;
    const shimmer = ctx.createLinearGradient(shimmerX - w * 0.6, bandTop, shimmerX + w * 0.6, bandTop + bandHeight);
    shimmer.addColorStop(0, "rgba(255,255,255,0)");
    shimmer.addColorStop(0.5, "rgba(255,255,255,0.32)");
    shimmer.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = shimmer;
    ctx.fillRect(0, bandTop, w, bandHeight);

    // foam glow band
    ctx.globalAlpha = 0.22;
    const g = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandHeight);
    g.addColorStop(0, "rgba(255,255,255,0.40)");
    g.addColorStop(0.5, "rgba(255,255,255,0.12)");
    g.addColorStop(1, "rgba(255,255,255,0.00)");
    ctx.fillStyle = g;
    ctx.fillRect(0, bandTop, w, bandHeight);

    // HEAVY waves (bigger amplitude + layered)
    for (let i = 0; i < 7; i++) {
      const y0 = bandTop + i * (bandHeight / 8);
      const amp = 18 + i * 6;              // heavier
      const freq = 0.012 + i * 0.0022;
      const speed = 1.8 + i * 0.12;

      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 10) {
        const y =
          y0 +
          Math.sin(x * freq + t * speed + i) * amp +
          Math.sin(x * (freq * 0.55) - t * (speed * 0.75) + i * 2) * (amp * 0.35);

        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, bandTop);
      ctx.lineTo(0, bandTop);
      ctx.closePath();

      ctx.globalAlpha = 0.18 + i * 0.02;
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.fill();
    }

    ctx.restore();
  }

  // --- GOLDEN GOD RAYS ---
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

      const width = w * (0.14 + (i % 3) * 0.04);

      const rg = ctx.createLinearGradient(0, 0, 0, h * 1.25);
      rg.addColorStop(0.00, "rgba(255,220,140,0.80)");
      rg.addColorStop(0.22, "rgba(255,210,120,0.38)");
      rg.addColorStop(0.55, "rgba(255,200,100,0.12)");
      rg.addColorStop(1.00, "rgba(255,200,100,0)");

      ctx.globalAlpha = 0.30;
      ctx.fillStyle = rg;
      ctx.fillRect(-width * 0.5, 0, width, h * 1.25);

      ctx.restore();
    }

    ctx.restore();
  }

  // --- CAUSTICS ---
  function drawCaustics() {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.17;

    const step = 34;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n =
          Math.sin(x * 0.014 + t * 1.10) +
          Math.cos(y * 0.013 - t * 0.95) +
          Math.sin((x + y) * 0.011 + t * 0.62);

        const v = (n + 3) / 6;
        const a = Math.max(0, v - 0.56) * 0.90;

        if (a > 0.02) {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }

    ctx.restore();
  }

  // --- PARTICLES ---
  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    for (const p of particles) {
      p.y -= p.v;
      p.x += Math.sin(t * 0.85 + p.y * 0.01) * 0.30;

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

  // --- SEABED (more visible + more elements) ---
  function buildSeabed() {
    seabed = [];

    // more + bigger rock lumps
    const lumps = Math.max(10, Math.floor(w / 90));
    for (let i = 0; i < lumps; i++) {
      seabed.push({
        type: "rock",
        x: rand(-60, w + 60),
        y: h - rand(18, 75),
        r: rand(45, 140)
      });
    }

    // more seaweed
    const weeds = Math.max(18, Math.floor(w / 45));
    for (let i = 0; i < weeds; i++) {
      seabed.push({
        type: "weed",
        x: rand(0, w),
        baseY: h - rand(6, 34),
        h: rand(55, 160),
        sway: rand(0.8, 2.2),
        thick: rand(2.2, 3.2)
      });
    }
  }

  function drawSeabed() {
    ctx.save();

    // darker floor gradient and higher contrast so it shows
    const floor = ctx.createLinearGradient(0, h * 0.62, 0, h);
    floor.addColorStop(0, "rgba(0,0,0,0)");
    floor.addColorStop(1, "rgba(0,0,0,0.75)");
    ctx.fillStyle = floor;
    ctx.fillRect(0, h * 0.62, w, h * 0.38);

    for (const s of seabed) {
      if (s.type === "rock") {
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = "rgba(0,0,0,0.78)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        const sway = Math.sin(t * 1.05 + s.x * 0.02) * (14 * s.sway);

        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = "rgba(0,0,0,0.88)";
        ctx.lineWidth = s.thick;

        ctx.beginPath();
        ctx.moveTo(s.x, s.baseY);
        ctx.quadraticCurveTo(
          s.x + sway * 0.45,
          s.baseY - s.h * 0.45,
          s.x + sway,
          s.baseY - s.h
        );
        ctx.stroke();
      }
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
    drawSeabed();

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

  // Splash timing
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