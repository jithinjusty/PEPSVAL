document.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("ocean");
  if (!canvas) return;

  const ctx = canvas.getContext("2d", { alpha: false });
  const splash = document.getElementById("splash");

  let w = 0, h = 0, t = 0;
  const particles = [];
  const particleCount = 140;

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    // Use window size to avoid 0-size issues on mobile
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
        r: rand(0.6, 2.2),
        v: rand(0.08, 0.35),
        a: rand(0.10, 0.32)
      });
    }
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0.0, "#d8f6ff");
    g.addColorStop(0.40, "#bfe9f4");
    g.addColorStop(1.0, "#7fc7d8");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawSurfaceWaves() {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = "#ffffff";
    const y0 = h * 0.12;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const amp = 8 + i * 5;
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
    ctx.save();
    ctx.globalCompositeOperation = "screen";
    ctx.globalAlpha = 0.18;

    const cx = w * 0.5;
    const cy = -h * 0.1;

    for (let i = 0; i < 6; i++) {
      const angle = (i * 0.35) + Math.sin(t * 0.35 + i) * 0.10;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(angle);

      const rg = ctx.createLinearGradient(0, 0, 0, h * 1.2);
      rg.addColorStop(0.0, "rgba(255,255,255,0.35)");
      rg.addColorStop(0.30, "rgba(255,255,255,0.10)");
      rg.addColorStop(1.0, "rgba(255,255,255,0)");

      ctx.fillStyle = rg;
      ctx.fillRect(-w * 0.12, 0, w * 0.24, h * 1.2);
      ctx.restore();
    }
    ctx.restore();
  }

  function drawCaustics() {
    ctx.save();
    ctx.globalCompositeOperation = "overlay";
    ctx.globalAlpha = 0.16;

    const step = 30;
    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const n =
          Math.sin((x * 0.015) + (t * 1.2)) +
          Math.cos((y * 0.013) - (t * 1.0)) +
          Math.sin(((x + y) * 0.01) + (t * 0.7));

        const v = (n + 3) / 6;
        const a = Math.max(0, v - 0.55) * 0.8;

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

  // DEBUG: show “RUNNING” for 1 second so we KNOW this JS is loading
  let debugUntil = Date.now() + 1000;

  function frame() {
    t += 0.016;

    drawBackground();
    drawSurfaceWaves();
    drawLightRays();
    drawCaustics();
    drawParticles();

    if (Date.now() < debugUntil) {
      ctx.save();
      ctx.font = "16px Arial";
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillText("RUNNING", 14, 26);
      ctx.restore();
    }

    requestAnimationFrame(frame);
  }

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