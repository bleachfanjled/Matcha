import { useEffect, useRef } from 'react';

// Fullscreen winter blizzard background. Optimized for performance:
// fewer flakes, batched draw calls grouped by opacity, capped DPR, and
// paused entirely when the tab is hidden.
export default function BlizzardCanvas({ intensity = 1, speed = 1 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { alpha: true });
    let width = 0;
    let height = 0;
    let dpr = 1;
    let flakes = [];
    let raf = 0;
    let t = 0;
    let last = performance.now();
    let running = true;

    const MAX_FLAKES = 1400;

    function spawn(initY) {
      return {
        x: Math.random() * width,
        y: initY !== undefined ? initY : Math.random() * height - height,
        r: Math.random() * 3.3 + 1,
        d: Math.random() * 1.4 + 0.7,
        sway: Math.random() * 2.6,
        swayOff: Math.random() * Math.PI * 2,
        wind: (Math.random() - 0.3) * 55,
        op: Math.random() * 0.4 + 0.6,
      };
    }

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.min(Math.floor(((width * height) / 1100) * intensity), MAX_FLAKES);
      flakes = new Array(target).fill(0).map(() => spawn());
    }

    // Group flakes into 3 opacity buckets so we can batch each group into a
    // single fill() call instead of one beginPath/arc/fill per flake.
    const BUCKETS = [
      { op: 0.6, items: [] },
      { op: 0.8, items: [] },
      { op: 1.0, items: [] },
    ];

    function draw(now) {
      if (!running) return;
      now = now || performance.now();
      let dt = (now - last) / 1000;
      if (dt > 0.05) dt = 0.05;
      last = now;
      ctx.clearRect(0, 0, width, height);
      t += dt;

      for (let b = 0; b < BUCKETS.length; b++) BUCKETS[b].items.length = 0;

      for (let i = 0; i < flakes.length; i++) {
        const f = flakes[i];
        f.y += f.d * 120 * speed * dt;
        f.x += Math.sin(t + f.swayOff) * f.sway * 30 * dt + f.wind * dt;
        if (f.y > height + 6) { f.y = -6; f.x = Math.random() * width; }
        if (f.x < -6) f.x = width + 6;
        else if (f.x > width + 6) f.x = -6;
        // Pick bucket by opacity — 3 levels keeps state changes to 3 per frame.
        const bi = f.op < 0.65 ? 0 : f.op < 0.85 ? 1 : 2;
        BUCKETS[bi].items.push(f);
      }

      ctx.fillStyle = '#ffffff';
      for (let b = 0; b < BUCKETS.length; b++) {
        const bucket = BUCKETS[b];
        if (bucket.items.length === 0) continue;
        ctx.globalAlpha = bucket.op;
        ctx.beginPath();
        for (let j = 0; j < bucket.items.length; j++) {
          const f = bucket.items[j];
          ctx.moveTo(f.x + f.r, f.y);
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(draw);
      }
    }

    resize();
    raf = requestAnimationFrame(draw);
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [intensity, speed]);

  return <canvas ref={canvasRef} className="blizzard-canvas" aria-hidden="true" />;
}