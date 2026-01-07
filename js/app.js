document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("ocean");
  const ctx = canvas.getContext("2d", { alpha: false });

  const splash = document.getElementById("splash");
  const app = document.getElementById("app");

  // Hide app until splash ends (prevents login flash)
  app.style.display = "none";

  let w = 0, h = 0, t = 0;
  const particles = [];
  const particleCount = 140;

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function rand(min, max) { return Math.random() * (max - min) + min; }

  function initParticles() {
    particles.length = 0;
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: rand(0, w),
        y: rand(0, h),
        r: rand(0.6, 2.2),
        v: rand(0.08, 0.35),
        a: rand(0.12, 0.40)
      });
    }
  }

  function drawBackground() {
    // Depth gradient: bright top -> deep blue
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, "#6fe0ff");
    g.addColorStop(0.22, "#167fc9");
    g.addColorStop(1.0, "#041a2b");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawSurfaceWaves() {
    // Soft ripples near the top to hint "surface"
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#ffffff";
    const y0 = h * 0.12;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const amp = 10 + i * 6;
      const freq = 0.008 + i * 0.002;
      ctx.moveTo(0, y0 + i * 14);
      for (let x = 0; x <= w; x += 10) {
        const y = y0 + i * 14 + Math.sin((x * freq) + (t * 0.8) + i) * amp;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, 0);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLightRays() {
    // Procedural rays: multiple rotating gradients
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.35;

    const cx = w * 0.5;
    const cy = -h * 0.1;

    for (let i = 0; i < 6; i++) {
      const angle = (i * 0.35) + Math.sin(t * 0.35 + i) * 0.12;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const rg = ctx.createLinearGradient(0, 0, 0, h * 1.2);
      rg.addColorStop(0.0, "rgba(255,255,255,0.55)");
      rg.addColorStop(0.25, "rgba(255,255,255,0.12)");
      rg.addColorStop(1.0, "rgba(255,255,255,0)");

      ctx.fillStyle = rg;
      ctx.fillRect(-w * 0.12, 0, w * 0.24, h * 1.2);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCaustics() {
    // Moving caustics pattern using layered sin fields
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.22;

    const step = 28;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n =
          Math.sin((x * 0.015) + (t * 1.2)) +
          Math.cos((y * 0.013) - (t * 1.0)) +
          Math.sin(((x + y) * 0.01) + (t * 0.7));

        const v = (n + 3) / 6; // normalize 0..1
        const a = Math.max(0, v - 0.55) * 0.9;

        if (a > 0.02) {
          ctx.fillStyle = `rgba(255,255,255,${a})`;
          ctx.fillRect(x, y, step, step);
        }
      }
    }
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    for (const p of particles) {
      p.y -= p.v;
      p.x += Math.sin(t * 0.8 + p.y * 0.01) * 0.15;

      if (p.y < -10) {
        p.y = h + 10;
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

    drawBackground();
    drawSurfaceWaves();
    drawLightRays();
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

  // Splash timing (3s) then fade to app
  setTimeout(() => {
    splash.style.opacity = "0";
    splash.style.transition = "opacity 0.6s ease";
    setTimeout(() => {
      splash.style.display = "none";
      app.style.display = "flex";
    }, 600);
  }, 3000);
});