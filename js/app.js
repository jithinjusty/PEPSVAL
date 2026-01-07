document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("ocean");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const splash = document.getElementById("splash");

  let w = 0, h = 0;
  let t = 0;

  // Particles for depth
  const particles = [];
  const particleCount = 190;

  // Seabed silhouettes (generated once per resize)
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
        r: rand(0.6, 2.2),
        v: rand(0.10, 0.50),
        a: rand(0.08, 0.34)
      });
    }
  }

  // --- DARK DEEP WATER BACKGROUND ---
  function drawDeepBackground() {
    // Darker, deeper ocean gradient (blue -> near-black)
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.00, "#2aa7d8");  // brighter top water
    g.addColorStop(0.18, "#0b5f9a");  // mid blue
    g.addColorStop(0.45, "#05324d");  // deep blue
    g.addColorStop(0.75, "#021a2a");  // very deep
    g.addColorStop(1.00, "#010d16");  // near black
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Depth vignette
    const vg = ctx.createRadialGradient(w * 0.5, h * 0.35, 60, w * 0.5, h * 0.60, Math.max(w, h) * 0.95);
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // --- MOVING SURFACE WAVES (TOP BAND) ---
  function drawSurfaceWaves() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.20;

    const bandTop = h * 0.06;
    const bandHeight = h * 0.16;

    const g = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandHeight);
    g.addColorStop(0, "rgba(255,255,255,0.28)");
    g.addColorStop(1, "rgba(255,255,255,0.00)");
    ctx.fillStyle = g;
    ctx.fillRect(0, bandTop, w, bandHeight);

    ctx.globalAlpha = 0.24;
    for (let i = 0; i < 6; i++) {
      const y0 = bandTop + i * (bandHeight / 7);
      const amp = 10 + i * 4.5;
      const freq = 0.010 + i * 0.002;

      ctx.beginPath();
      ctx.moveTo(0, y0);
      for (let x = 0; x <= w; x += 10) {
        const y = y0 + Math.sin(x * freq + t * 1.55 + i) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, bandTop);
      ctx.lineTo(0, bandTop);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.fill();
    }

    ctx.restore();
  }

  // --- GOD RAYS (slight warm/yellow tint) ---
  function drawGodRays() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";

    const cx = w * 0.5;
    const cy = -h * 0.10;

    for (let i = 0; i < 9; i++) {
      const base = (i - 4) * 0.20;
      const sway = Math.sin(t * 0.33 + i) * 0.10;
      const angle = base + sway;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const width = w * (0.13 + (i % 3) * 0.03);

      // warm ray gradient
      const rg = ctx.createLinearGradient(0, 0, 0, h * 1.25);
      rg.addColorStop(0.00, "rgba(255,244,200,0.55)"); // warm/yellow
      rg.addColorStop(0.22, "rgba(255,244,200,0.16)");
      rg.addColorStop(1.00, "rgba(255,244,200,0)");

      ctx.globalAlpha = 0.20;
      ctx.fillStyle = rg;
      ctx.fillRect(-width * 0.5, 0, width, h * 1.25);

      ctx.restore();
    }

    ctx.restore();
  }

  // --- CAUSTICS (subtle, moving) ---
  function drawCaustics() {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.16;

    const step = 36;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n =
          Math.sin((x * 0.014) + t * 1.10) +
          Math.cos((y * 0.013) - t * 0.95) +
          Math.sin(((x + y) * 0.011) + t * 0.62);

        const v = (n + 3) / 6;
        const a = Math.max(0, v - 0.56) * 0.85;

        if (a > 0.02) {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }
    ctx.restore();
  }

  // --- PARTICLES (depth dust) ---
  function drawParticles() {
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
      ctx.fillStyle = "rgba(255,255,255,0.95)";
      ctx.fill();
    }

    ctx.restore();
  }

  // --- SEABED for originality (very subtle silhouette) ---
  function buildSeabed() {
    seabed = [];

    // rock lumps
    const lumps = Math.max(7, Math.floor(w / 120));
    for (let i = 0; i < lumps; i++) {
      seabed.push({
        type: "rock",
        x: rand(-30, w + 30),
        y: h - rand(18, 55),
        r: rand(28, 90)
      });
    }

    // seaweed strands
    const weeds = Math.max(10, Math.floor(w / 70));
    for (let i = 0; i < weeds; i++) {
      seabed.push({
        type: "weed",
        x: rand(0, w),
        baseY: h - rand(8, 28),
        h: rand(35, 110),
        sway: rand(0.6, 1.6)
      });
    }
  }

  function drawSeabed() {
    ctx.save();
    // keep it dark so it doesn't distract
    ctx.globalAlpha = 0.38;
    ctx.fillStyle = "rgba(0,0,0,0.55)";

    // soft ground haze
    const haze = ctx.createLinearGradient(0, h * 0.78, 0, h);
    haze.addColorStop(0, "rgba(0,0,0,0)");
    haze.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = haze;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // draw rocks and weed
    for (const s of seabed) {
      if (s.type === "rock") {
        ctx.globalAlpha = 0.22;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0,0,0,0.70)";
        ctx.fill();
      } else {
        // seaweed: gently waving strands
        ctx.globalAlpha = 0.18;
        ctx.strokeStyle = "rgba(0,0,0,0.75)";
        ctx.lineWidth = 2;

        const sway = Math.sin(t * 0.9 + s.x * 0.02) * (6 * s.sway);
        const topX = s.x + sway;
        const topY = s.baseY - s.h;

        ctx.beginPath();
        ctx.moveTo(s.x, s.baseY);
        ctx.quadraticCurveTo(
          s.x + sway * 0.5,
          s.baseY - s.h * 0.55,
          topX,
          topY
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

  // Splash for 3 seconds then redirect
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