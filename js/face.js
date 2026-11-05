/* Face Lab — Module 4 · The animated face.
   The face is animation code, not an AI model. Every value moves with a spring:  a = k × (target − x) − c × v.
   Missions: tune the spring so expressions never snap (slight overshoot, quick settle), give it idle life,
   then drive it with emotion tags from the brain:  {"emotion":"happy","intensity":0.7,"look":"user"}. */
(function () {
  'use strict';
  const { h, clamp, lerp } = AC;
  AC.boot({ game: 'face', week: 4, topic: 'The animated face', title: 'Face Lab', help: () => help() });
  const S = AC.scene({ fov: 40, near: 0.1, far: 200, background: 0x070b12 });
  const { scene, camera, renderer } = S;
  AC.lights(scene, { sky: 0xcfe6ff, ground: 0x1a1410, hemi: 0.55, sun: 0.65, dir: [-6, 12, 10] });
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 9.5, min: 5, max: 20, phi: 1.42, theta: 0.0, minPhi: 0.8, maxPhi: 1.6, target: new THREE.Vector3(0, 2.15, 0) });

  // ---------------------------------------------------------------- the robot on a desk
  const mat = (c, r = 0.6, m = 0.2) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const desk = new THREE.Mesh(new THREE.BoxGeometry(16, 0.3, 7), mat(0x3a2c22, 0.8));
  desk.position.y = -0.15;
  scene.add(desk);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 20), mat(0x0d1420, 1));
  wall.position.set(0, 6, -4);
  scene.add(wall);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.1, 0.28, 32), mat(0x1c2430, 0.5, 0.5));
  base.position.y = 0.14;
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.22, 1.3, 16), mat(0x2a3442, 0.4, 0.6));
  neck.position.y = 0.9;
  scene.add(base, neck);
  const head = new THREE.Group();
  head.position.y = 2.75;
  scene.add(head);
  const shell = new THREE.Mesh(new THREE.BoxGeometry(4.3, 2.8, 1.3), mat(0x1b2230, 0.35, 0.55));
  head.add(shell);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(4.0, 2.5, 0.05), mat(0x05070b, 0.3, 0.1));
  bezel.position.z = 0.66;
  head.add(bezel);
  const earMat = new THREE.MeshStandardMaterial({ color: 0x2fe0cf, emissive: 0x2fe0cf, emissiveIntensity: 0.6 });
  for (const x of [-2.3, 2.3]) {
    const ear = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.3, 24), earMat);
    ear.rotation.z = Math.PI / 2;
    ear.position.x = x;
    head.add(ear);
  }
  const lamp = new THREE.PointLight(0x2fe0cf, 0.8, 10);
  lamp.position.set(0, 2.7, 2.2);
  scene.add(lamp);

  // face canvas → texture on the screen
  const FW = 640, FH = 400;
  const fc = document.createElement('canvas');
  fc.width = FW; fc.height = FH;
  const g0 = fc.getContext('2d');
  // eyes are drawn on their own layer so lids and smile arches can be cut out cleanly (destination-out)
  const ec = document.createElement('canvas');
  ec.width = FW; ec.height = FH;
  let g = ec.getContext('2d');
  const tex = new THREE.CanvasTexture(fc);
  tex.minFilter = THREE.LinearFilter;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.84, 2.4), new THREE.MeshBasicMaterial({ map: tex }));
  screen.position.z = 0.69;
  head.add(screen);

  // ---------------------------------------------------------------- face parameters + springs
  const KEYS = ['open', 'wide', 'lookX', 'lookY', 'tilt', 'smile', 'mouth', 'glow', 'dots', 'zz', 'lid'];
  const EXP = {
    neutral:   { open: 1, wide: 1, lookX: 0, lookY: 0, tilt: 0, smile: 0.1, mouth: 0, glow: 1, dots: 0, zz: 0, lid: 0 },
    happy:     { open: 0.8, wide: 1.06, lookX: 0, lookY: 0.05, tilt: 0, smile: 1, mouth: 0.1, glow: 1.25, dots: 0, zz: 0, lid: 0 },
    curious:   { open: 1.15, wide: 0.96, lookX: 0.25, lookY: 0.1, tilt: 0.2, smile: 0.25, mouth: 0, glow: 1.1, dots: 0, zz: 0, lid: 0 },
    thinking:  { open: 0.85, wide: 1, lookX: 0.5, lookY: 0.45, tilt: -0.08, smile: 0, mouth: 0, glow: 0.95, dots: 1, zz: 0, lid: 0.18 },
    sleepy:    { open: 0.32, wide: 1.05, lookX: 0, lookY: -0.3, tilt: 0.05, smile: 0, mouth: 0, glow: 0.45, dots: 0, zz: 1, lid: 0.55 },
    surprised: { open: 1.38, wide: 0.82, lookX: 0, lookY: 0.15, tilt: 0, smile: 0, mouth: 1, glow: 1.35, dots: 0, zz: 0, lid: 0 },
  };
  const NAMES = Object.keys(EXP);
  const F = {}, V = {}, T = {};
  KEYS.forEach((k) => { F[k] = EXP.neutral[k]; V[k] = 0; T[k] = EXP.neutral[k]; });
  const spring = { k: 170, c: 18, snap: false };
  let intensity = 1, emotion = 'neutral';
  function setTarget(name, inten = 1) {
    emotion = name; intensity = inten;
    KEYS.forEach((k) => { T[k] = lerp(EXP.neutral[k], EXP[name][k], inten); });
  }
  // idle life settings (mission 2 changes them)
  const idle = { blink: 'random', drift: 'tiny', breath: 'slow' };
  let blinkT = 2.5, blinkPhase = -1, driftX = 0, driftY = 0, driftTX = 0, driftTY = 0, driftT = 0;
  const blinkLog = [];
  let speakT = 0;

  // fixed 1/120 s sub-steps keep stiff springs stable even when a slow device drops to 10 frames per second
  function stepSprings(dt) {
    const n = Math.max(1, Math.ceil(dt * 120)), h1 = dt / n;
    for (const k of KEYS) {
      if (spring.snap) { F[k] = T[k]; V[k] = 0; continue; }
      for (let i = 0; i < n; i++) {
        V[k] += (spring.k * (T[k] - F[k]) - spring.c * V[k]) * h1;
        F[k] += V[k] * h1;
      }
    }
  }

  // ---------------------------------------------------------------- drawing the face (2D canvas)
  function rr(x, y, w, hh, r) {
    r = Math.max(0, Math.min(r, w / 2, hh / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + hh, r);
    g.arcTo(x + w, y + hh, x, y + hh, r);
    g.arcTo(x, y + hh, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function draw(time) {
    const bg = g0.createRadialGradient(FW / 2, FH / 2, 40, FW / 2, FH / 2, FW * 0.7);
    bg.addColorStop(0, '#0a1119'); bg.addColorStop(1, '#020407');
    g0.fillStyle = bg;
    g0.fillRect(0, 0, FW, FH);
    g.clearRect(0, 0, FW, FH);
    // breathing glow
    const br = idle.breath === 'off' ? 1 : idle.breath === 'slow' ? 1 + Math.sin(time * 1.6) * 0.12 : 1 + Math.sin(time * 14) * 0.35;
    const glowAmt = Math.max(0, F.glow) * br;
    // blink: squash and stretch (eyes get a bit wider as they close)
    let blink = 1;
    if (blinkPhase >= 0) { const p = blinkPhase / 0.16; blink = p < 0.5 ? 1 - p * 1.9 : 0.05 + (p - 0.5) * 1.9; blink = clamp(blink, 0.05, 1); }
    const squash = 1 + (1 - blink) * 0.18;
    g.save();
    g.translate(FW / 2, FH / 2 - 14);
    g.rotate(F.tilt * 0.22);
    const lx = (F.lookX + driftX) * 46, ly = -(F.lookY + driftY) * 34;
    for (const side of [-1, 1]) {
      const curiousScale = side === 1 ? 1 + Math.max(0, F.tilt) * 0.6 : 1 - Math.max(0, F.tilt) * 0.2;
      const ew = 118 * F.wide * squash * (side === 1 ? 1 + Math.max(0, F.tilt) * 0.25 : 1);
      const eh = Math.max(6, 148 * Math.max(0.04, F.open) * blink * curiousScale);
      const cx = side * 118 + lx, cy = ly;
      g.fillStyle = 'rgb(' + Math.round(lerp(24, 70, clamp(glowAmt - 0.4, 0, 1))) + ',' + Math.round(lerp(150, 232, clamp(glowAmt - 0.3, 0, 1))) + ',' + Math.round(lerp(140, 214, clamp(glowAmt - 0.3, 0, 1))) + ')';
      rr(cx - ew / 2, cy - eh / 2, ew, eh, Math.min(ew, eh) * 0.42);
      g.fill();
      g.shadowBlur = 0;
      g.globalCompositeOperation = 'destination-out';
      g.fillStyle = '#000';
      // happy: lower lid curves up into a smiling arch
      if (F.smile > 0.15) {
        const s = clamp((F.smile - 0.15) / 0.85, 0, 1.2);
        g.beginPath();
        g.ellipse(cx, cy + eh * 0.5 + eh * 0.42 * (1 - s * 0.55), ew * 0.78, eh * 0.62 * s, 0, 0, Math.PI * 2);
        g.fill();
      }
      // sleepy / thinking: upper lid
      if (F.lid > 0.02) g.fillRect(cx - ew, cy - eh / 2 - 60, ew * 2, eh * clamp(F.lid, 0, 0.9) + 60);
      g.globalCompositeOperation = 'source-atop';
      // highlight (only where the eye still is)
      g.fillStyle = 'rgba(255,255,255,0.28)';
      rr(cx - ew * 0.3, cy - eh * 0.36, ew * 0.18, Math.max(3, eh * 0.16), 6);
      g.fill();
      g.globalCompositeOperation = 'source-over';
    }
    g.restore();
    // glow is added once, to the finished (cut) eye shapes
    g0.shadowColor = 'rgba(47,224,207,' + clamp(0.55 * glowAmt, 0, 1) + ')';
    g0.shadowBlur = 38 * glowAmt;
    g0.drawImage(ec, 0, 0);
    g0.shadowBlur = 0;
    // mouth and extras go straight onto the screen
    g = g0;
    g.save();
    g.translate(FW / 2, FH / 2 - 14);
    g.rotate(F.tilt * 0.22);
    // mouth (orange accent): a curve, or an "O" when surprised / speaking
    const talk = speakT > 0 ? Math.abs(Math.sin(time * 17)) * 0.6 + Math.abs(Math.sin(time * 7.3)) * 0.4 : 0;
    const mo = clamp(F.mouth + talk * 0.8, 0, 1.3);
    g.strokeStyle = '#ff8a3d';
    g.fillStyle = '#ff8a3d';
    g.lineCap = 'round';
    g.lineWidth = 9;
    g.shadowColor = 'rgba(255,138,61,0.6)';
    g.shadowBlur = 14;
    const my = 128;
    if (mo > 0.12) {
      g.beginPath();
      g.ellipse(0, my, 18 + mo * 12, 6 + mo * 22, 0, 0, Math.PI * 2);
      g.lineWidth = 7;
      g.stroke();
    } else {
      g.beginPath();
      g.moveTo(-42, my);
      g.quadraticCurveTo(0, my + clamp(F.smile, -0.5, 1.4) * 34, 42, my);
      g.stroke();
    }
    g.shadowBlur = 0;
    // thinking dots
    if (F.dots > 0.03) {
      for (let i = 0; i < 3; i++) {
        const a = clamp(F.dots, 0, 1) * (0.35 + 0.65 * Math.max(0, Math.sin(time * 5 - i * 0.9)));
        g.fillStyle = 'rgba(255,138,61,' + a + ')';
        g.beginPath();
        g.arc(200 + i * 30, -132 - Math.max(0, Math.sin(time * 5 - i * 0.9)) * 8, 9, 0, 7);
        g.fill();
      }
    }
    // sleepy Zz
    if (F.zz > 0.03) {
      g.font = 'bold 44px "Chakra Petch", sans-serif';
      for (let i = 0; i < 2; i++) {
        const ph = (time * 0.4 + i * 0.5) % 1;
        g.fillStyle = 'rgba(47,224,207,' + clamp(F.zz, 0, 1) * (1 - ph) + ')';
        g.fillText(i ? 'z' : 'Z', 190 + i * 40 + ph * 20, -100 - ph * 60 - i * 20);
      }
    }
    g.restore();
    g = ec.getContext('2d');
    tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- panel + HUD
  const panel = h('div', { class: 'opt-panel ac-panel' });
  AC.root().appendChild(panel);
  const hud = AC.ui.hud();
  hud.section('Face engine').row('e', 'Expression', 'neutral').row('k', 'Stiffness k', '--').row('c', 'Damping c', '--').row('o', 'Overshoot', '--').row('s', 'Settle time', '--').row('n', 'Tests', '0');
  const graphCanvas = hud.canvas('springGraph');
  const graph = new AC.Graph(graphCanvas, { xMin: 0, xMax: 1.5, yMin: 0, yMax: 1.8, xLabel: 's', yLabel: 'value', xTicks: 3, yTicks: 3 });
  hud.formula('f', 'a = k × (target − x) − c × v');
  const labels = (arr) => [...hud.el.querySelectorAll('.ac-row .k')].forEach((k, i) => { if (arr[i]) k.textContent = arr[i]; });
  let trace = [];
  function drawGraph(done) {
    graph.draw({
      series: [{ pts: trace, color: AC.css('--cyan'), width: 2 }],
      hlines: [{ y: 1, color: AC.css('--dim'), label: 'target' }, { y: 1.15, color: AC.css('--amber'), label: '+15%' }, { y: 1.03, color: AC.css('--green') }],
      vlines: [{ x: 0.5, color: AC.css('--magenta'), label: '0.5 s' }],
      marks: done && trace.length ? [{ x: trace[trace.length - 1][0], y: trace[trace.length - 1][1], color: AC.css('--cyan') }] : [],
    });
  }
  const seg = (opts, cur, onPick) => {
    const el = h('div', { class: 'ac-seg' });
    opts.forEach(([v, label]) => {
      const b = h('button', { type: 'button', class: v === cur ? 'on' : '', onclick: () => { [...el.children].forEach((c) => c.classList.toggle('on', c === b)); AC.audio.click(); onPick(v); } }, label);
      el.appendChild(b);
    });
    return el;
  };
  const Q = (id) => AC.QUESTIONS.find((q) => q.id === id);

  // ---------------------------------------------------------------- spring step test (fixed 60 Hz so results are repeatable)
  let test = null; // {t, acc, samples}
  function runStepTest() {
    KEYS.forEach((k) => { F[k] = EXP.neutral[k]; V[k] = 0; });
    setTarget('happy', 1);
    test = { t: 0, acc: 0, x: 0, v: 0, peak: 0, settle: 0 };
    trace = [[0, 0]];
    AC.audio.whoosh();
  }
  function stepTest(dt) {
    test.acc += dt;
    while (test.acc >= 1 / 60 && test.t < 1.5) {
      test.acc -= 1 / 60;
      test.t += 1 / 60;
      if (spring.snap) { test.x = 1; test.v = 0; }
      else { test.v += (spring.k * (1 - test.x) - spring.c * test.v) / 60; test.x += test.v / 60; }
      test.peak = Math.max(test.peak, test.x);
      if (Math.abs(test.x - 1) > 0.02) test.settle = test.t;
      trace.push([test.t, test.x]);
    }
    return test.t >= 1.5;
  }

  // ---------------------------------------------------------------- missions
  const SITUATIONS = [
    { t: 'User: "THANK YOU! The robot finally works!"', e: 'happy', lo: 0.7, hi: 1, look: 'user', why: 'Big, happy news from the user: happy, high intensity, looking at the user.' },
    { t: 'The user starts talking to you', e: 'curious', look: 'user', why: 'Listening is the curious face, eyes on the user.' },
    { t: 'Your model is generating a long answer', e: 'thinking', why: 'While the model runs, show thinking: eyes up and the orange dots.' },
    { t: 'Nobody has spoken for 15 minutes', e: 'sleepy', why: 'Standby is the sleepy face.' },
    { t: 'Camera: a new person walks into the room', e: 'surprised', why: 'The vision model can trigger surprise when something new appears.' },
    { t: 'User: "ok... that is fine, I guess."', e: 'happy', lo: 0, hi: 0.4, look: 'user', why: 'Mildly positive: happy, but low intensity. Intensity is how strong the expression is.' },
    { t: 'Idle: waiting for the next question', e: 'neutral', why: 'Nothing is happening: neutral, with idle life (blinks, drift, breathing glow).' },
  ];
  const missions = [
    {
      id: 'spring', title: 'Never Snap',
      objective: 'Tune the spring: 3–15% overshoot and settled within 0.5 s',
      story: 'The face must look as smooth as a film character. Never snap between expressions: every value moves like a spring, with a slight overshoot. Tune stiffness and damping, then test a neutral → happy change.',
      learn: [
        { t: 'Spring', p: 'Each value is pulled toward its target. Stiffness pulls harder; damping slows it down.', f: 'a = k × (target − x) − c × v' },
        { t: 'Slight overshoot', p: 'Going a little past the target and settling back is what looks alive. Too much looks like jelly.', f: '3% ≤ overshoot ≤ 15%' },
        { t: 'Quick to settle', p: 'The face must also react fast, inside half a second.', f: 'settle ≤ 0.5 s' },
      ],
      controls: ['Drag the sliders', '<b>Test</b> runs neutral → happy', 'Watch the graph'],
      proved: 'Every face value now moves with spring physics: a slight overshoot and a quick settle, never a snap. This is the "smooth movie feel" from section 4, and it costs no GPU at all: the face is animation code, not an AI model.',
      tip: 'Graph too wavy? Add damping. Too slow to reach the target? Add stiffness. "Snap" always fails: it has no movement at all.',
      quiz: Q('f-code'),
      start(api) {
        const st = api.state;
        Object.assign(spring, { k: 120, c: 3, snap: false });
        Object.assign(idle, { blink: 'random', drift: 'tiny', breath: 'slow' });
        setTarget('neutral');
        st.tests = 0;
        labels(['Expression', 'Stiffness k', 'Damping c', 'Overshoot', 'Settle time', 'Tests']);
        graphCanvas.style.display = '';
        trace = []; drawGraph();
        hud.set('o', '--'); hud.set('s', '--'); hud.set('n', '0');
        hud.setFormula('f', 'a = k × (target − x) − c × v');
        panel.innerHTML = '';
        const outK = h('output', {}, String(spring.k)), outC = h('output', {}, String(spring.c));
        const sk = h('input', { type: 'range', min: '20', max: '800', step: '10', value: String(spring.k), 'aria-label': 'Stiffness' });
        const sc = h('input', { type: 'range', min: '1', max: '60', step: '1', value: String(spring.c), 'aria-label': 'Damping' });
        sk.addEventListener('input', () => { spring.k = +sk.value; outK.textContent = sk.value; });
        sc.addEventListener('input', () => { spring.c = +sc.value; outC.textContent = sc.value; });
        const snap = h('label', { class: 'dim', style: { fontSize: '0.82rem', display: 'flex', gap: '6px', alignItems: 'center' } }, h('input', { type: 'checkbox', onchange: (e) => (spring.snap = e.target.checked) }), 'Snap instantly (no spring)');
        panel.append(
          h('div', { class: 'q' }, h('small', {}, 'Spring tuner'), 'Make neutral → happy smooth'),
          h('div', { class: 'ac-field' }, h('label', {}, 'Stiffness k', outK), sk),
          h('div', { class: 'ac-field' }, h('label', {}, 'Damping c', outC), sc),
          h('div', { class: 'ac-actions', style: { justifyContent: 'space-between', alignItems: 'center' } }, snap, h('button', { class: 'ac-btn', type: 'button', onclick: () => go() }, 'Test'))
        );
        st.go = go; st.sk = sk; st.sc = sc;
        function go() {
          if (test) return;
          st.tests++;
          hud.set('n', String(st.tests));
          runStepTest();
        }
      },
      update(dt, api) {
        const st = api.state;
        hud.set('k', String(spring.snap ? '∞' : spring.k));
        hud.set('c', String(spring.snap ? '--' : spring.c));
        if (!test) return;
        const done = stepTest(dt);
        drawGraph(done);
        // the whole face follows the same normalised spring
        KEYS.forEach((k) => { F[k] = lerp(EXP.neutral[k], EXP.happy[k], test.x); V[k] = 0; T[k] = F[k]; });
        if (!done) return;
        const over = Math.max(0, test.peak - 1) * 100, settle = test.settle;
        test = null;
        setTarget('happy');
        hud.set('o', AC.fmt(over, 1) + ' %', over >= 3 && over <= 15 ? '' : 'bad');
        hud.set('s', AC.fmt(settle, 2) + ' s', settle <= 0.5 ? '' : 'bad');
        if (spring.snap) { AC.fact('It snapped', 'Zero movement: the expression jumps in one frame. The notes say never snap between expressions.', { tag: 'Test', color: 'var(--amber)' }); return; }
        if (over >= 3 && over <= 15 && settle <= 0.5) api.win(st.tests <= 3 ? 3 : st.tests <= 6 ? 2 : 1, 'k = ' + spring.k + ', c = ' + spring.c + ': ' + AC.fmt(over, 1) + '% overshoot, settled in ' + AC.fmt(settle, 2) + ' s, after ' + st.tests + (st.tests === 1 ? ' test.' : ' tests.'));
        else AC.fact('Not yet', over > 15 ? 'Too bouncy (' + AC.fmt(over) + '% overshoot): add damping.' : over < 3 ? 'No real overshoot (' + AC.fmt(over, 1) + '%): it looks stiff. Lower the damping a little, or add stiffness.' : 'Too slow: it took ' + AC.fmt(settle, 2) + ' s to settle. Add stiffness.', { tag: 'Test result', color: 'var(--amber)' });
      },
    },
    {
      id: 'alive', title: 'Life When Idle',
      objective: 'Set blinks, eye drift and glow so the idle face passes the "alive" test',
      story: 'Most of the time the companion is just waiting. A frozen face looks switched off; a twitchy one looks broken. Set the three idle behaviours, then run the 8-second idle test.',
      learn: [
        { t: 'Idle matters most', p: 'Idle motion matters more than the big expressions. People notice a frozen face immediately.', f: 'idle > big expressions' },
        { t: 'Blinks', p: 'Occasional blinks with random timing, plus squash-and-stretch on each blink.', f: 'random blink timing' },
        { t: 'Drift and glow', p: 'Tiny eye drifts and a slow breathing glow.', f: 'tiny drift · slow glow' },
      ],
      controls: ['Choose one option per row', '<b>Run idle test</b>'],
      proved: 'Random blinks, tiny eye drifts and a slow breathing glow: the three idle behaviours from section 4. Fixed-interval blinks read as robotic, no blinks read as a photo, and big or fast movement reads as nervous.',
      tip: 'Read each verdict in the facts panel: it names the behaviour that looked wrong.',
      quiz: Q('f-idle'),
      start(api) {
        const st = api.state;
        Object.assign(spring, { k: 300, c: 22, snap: false });
        Object.assign(idle, { blink: 'never', drift: 'off', breath: 'off' });
        setTarget('neutral');
        st.runs = 0;
        labels(['Expression', 'Blinks', 'Eye drift', 'Glow', 'Blinks seen', 'Test runs']);
        graphCanvas.style.display = 'none';
        hud.set('o', '--'); hud.set('s', '--'); hud.set('n', '0');
        hud.setFormula('f', 'idle life = blinks + drift + breathing');
        panel.innerHTML = '';
        const row = (label, el) => h('div', { class: 'row2' }, h('span', {}, label), el);
        panel.append(
          h('div', { class: 'q' }, h('small', {}, 'Idle behaviour'), 'Make it look alive'),
          row('Blinks', seg([['never', 'Never'], ['fixed', 'Every 3 s exactly'], ['random', 'Random 2–6 s']], idle.blink, (v) => (idle.blink = v))),
          row('Eye drift', seg([['off', 'Off'], ['tiny', 'Tiny'], ['big', 'Big']], idle.drift, (v) => (idle.drift = v))),
          row('Glow', seg([['off', 'Off'], ['slow', 'Slow breathing'], ['fast', 'Fast pulse']], idle.breath, (v) => (idle.breath = v))),
          h('div', { class: 'ac-actions' }, h('button', { class: 'ac-btn', type: 'button', onclick: () => go() }, 'Run idle test'))
        );
        function go() {
          if (st.testT != null) return;
          st.runs++;
          st.testT = 0;
          blinkLog.length = 0;
          hud.set('n', String(st.runs));
          AC.audio.ping();
        }
        st.go = go;
      },
      update(dt, api) {
        const st = api.state;
        hud.set('k', idle.blink); hud.set('c', idle.drift);
        hud.set('o', idle.breath);
        if (st.testT == null) return;
        st.testT += dt;
        api.progress(st.testT / 8, 'Idle test running');
        hud.set('s', String(blinkLog.length));
        if (st.testT < 8) return;
        st.testT = null;
        api.progress(0, 'Objective');
        const v = [];
        if (idle.blink === 'never') v.push(['Blinks', 'It never blinked: it stares like a photo.']);
        if (idle.blink === 'fixed') v.push(['Blinks', 'It blinks like a metronome, exactly every 3 s: robotic. Use random timing.']);
        if (idle.drift === 'off') v.push(['Eye drift', 'The eyes are frozen in place: it looks paused.']);
        if (idle.drift === 'big') v.push(['Eye drift', 'The eyes dart around: it looks nervous. Drifts should be tiny.']);
        if (idle.breath === 'off') v.push(['Glow', 'No breathing glow: it looks switched off.']);
        if (idle.breath === 'fast') v.push(['Glow', 'A fast pulse looks like an alarm. The glow should breathe slowly.']);
        if (!v.length) return api.win(st.runs === 1 ? 3 : st.runs === 2 ? 2 : 1, 'The idle face passed on run ' + st.runs + ': ' + blinkLog.length + ' blinks at random times, tiny drifts and a slow breathing glow.');
        v.slice(0, 2).forEach(([t, p]) => AC.fact(t + ': not alive yet', p, { tag: 'Idle test', color: 'var(--amber)', ms: 10000 }));
        if (v.length > 2) AC.ui.toast(v.length + ' things look wrong', 'var(--amber)');
      },
    },
    {
      id: 'tags', title: 'Emotion Tags',
      objective: 'Send the right emotion tag for 7 moments in a conversation',
      story: 'With every reply, the brain returns one short structured line, the emotion tag. The face engine blends toward it, so the face reacts to what the AI is actually thinking. You are the brain: write the tag.',
      learn: [
        { t: 'The tag', p: 'A tiny structured line with every reply. It costs almost nothing.', f: '{"emotion":"happy","intensity":0.7,"look":"user"}' },
        { t: 'Six expressions', p: 'Neutral (idle), happy, curious (listening), thinking (model running), sleepy (standby), surprised.', f: '6 expressions' },
        { t: 'Intensity', p: 'How strong the expression is, from 0 to 1. A mild "fine, I guess" is not a 1.0 smile.', f: '0 ≤ intensity ≤ 1' },
      ],
      controls: ['Pick emotion, intensity and look', '<b>Send tag</b>'],
      proved: 'You produced the structured emotion tag the brain sends with every reply, and the face blended toward it. Teaching a model to always return this tag in the right JSON shape is the first fine-tuning project in section 6.',
      tip: 'Listening = curious. Model running = thinking. Standby = sleepy. Something new on camera = surprised. Watch the intensity on mild replies.',
      quiz: Q('f-tag'),
      start(api) {
        const st = api.state;
        Object.assign(spring, { k: 300, c: 22, snap: false });
        Object.assign(idle, { blink: 'random', drift: 'tiny', breath: 'slow' });
        setTarget('neutral');
        st.i = 0; st.mistakes = 0; st.e = 'neutral'; st.inten = 0.5; st.look = 'user';
        labels(['Expression', 'Intensity', 'Look', 'Moment', 'Mistakes', 'Sent']);
        graphCanvas.style.display = 'none';
        hud.set('o', '1 / ' + SITUATIONS.length); hud.set('s', '0'); hud.set('n', '0');
        panel.innerHTML = '';
        const qEl = h('div', { class: 'q' });
        const outI = h('output', {}, '0.5');
        const si = h('input', { type: 'range', min: '0', max: '1', step: '0.1', value: '0.5', 'aria-label': 'Intensity' });
        si.addEventListener('input', () => { st.inten = +si.value; outI.textContent = (+si.value).toFixed(1); json(); });
        const row = (label, el) => h('div', { class: 'row2' }, h('span', {}, label), el);
        const emo = seg(NAMES.map((n) => [n, n]), 'neutral', (v) => { st.e = v; json(); });
        const look = seg([['user', 'user'], ['screen', 'screen'], ['away', 'away']], 'user', (v) => { st.look = v; json(); });
        panel.append(qEl, row('Emotion', emo), row('Intensity', h('div', { class: 'ac-field' }, h('label', {}, 'how strong', outI), si)), row('Look', look),
          h('div', { class: 'ac-actions' }, h('button', { class: 'ac-btn', type: 'button', onclick: () => send() }, 'Send tag')));
        const show = () => { const s = SITUATIONS[st.i]; qEl.innerHTML = ''; qEl.append(h('small', {}, 'Moment ' + (st.i + 1) + ' of ' + SITUATIONS.length), s.t); hud.set('o', st.i + 1 + ' / ' + SITUATIONS.length); };
        function json() { hud.setFormula('f', '{"emotion": "' + st.e + '",\n "intensity": ' + st.inten.toFixed(1) + ',\n "look": "' + st.look + '"}'); }
        function send() {
          if (st.i >= SITUATIONS.length) return;
          const s = SITUATIONS[st.i];
          setTarget(st.e, st.e === 'neutral' ? 1 : Math.max(0.15, st.inten));
          st.lookTarget = st.look;
          st.sent = (st.sent || 0) + 1;
          hud.set('n', String(st.sent));
          const okE = st.e === s.e, okI = s.lo == null || (st.inten >= s.lo - 1e-6 && st.inten <= s.hi + 1e-6), okL = !s.look || st.look === s.look;
          if (okE && okI && okL) {
            AC.audio.good();
            st.i++;
            api.progress(st.i / SITUATIONS.length);
            if (st.i >= SITUATIONS.length) return api.win(st.mistakes === 0 ? 3 : st.mistakes <= 2 ? 2 : 1, 'All 7 moments tagged with ' + st.mistakes + (st.mistakes === 1 ? ' mistake.' : ' mistakes.'));
            setTimeout(() => { if (MR.api.state === st) show(); }, 700);
          } else {
            st.mistakes++;
            hud.set('s', String(st.mistakes), 'warn');
            AC.audio.bad();
            const what = !okE ? 'Emotion: ' + s.why : !okI ? 'Intensity: should be ' + (s.lo >= 0.5 ? 'at least ' + s.lo : 'at most ' + s.hi) + '. ' + s.why : 'Look: the eyes should be on the user here.';
            AC.fact('Not quite', what, { tag: 'Tag check', color: 'var(--amber)', ms: 9000 });
          }
        }
        st.send = send;
        json(); show();
      },
      update(dt, api) {
        hud.set('k', AC.fmt(intensity, 1));
        hud.set('c', api.state.lookTarget || 'user');
      },
    },
  ];
  const MR = AC.missions({ game: 'face', week: 4, list: missions, onSelect() { test = null; speakT = 0; } });

  AC.ui.tools([
    { label: 'Reset view', onclick: () => Object.assign(oc, { theta: 0, phi: 1.42, dist: 9.5 }) },
    { label: 'Say hello', onclick: () => { speakT = 1.6; AC.audio.ping(); } },
  ]);
  function help() {
    AC.ui.card({ eyebrow: 'Face Lab', title: 'How to play', body: [
      'The robot\'s face is drawn by code at 60 frames per second. Every value (eye height, lid, tilt, mouth curve, glow) moves toward its target with a spring.',
      'Use the panel at the bottom for each mission. The HUD on the right shows the live numbers.',
      '"Say hello" makes the mouth move as if speaking, while the eyes keep their emotion.',
    ] });
  }

  // ---------------------------------------------------------------- loop
  S.onFrame((dt, time) => {
    // idle life
    if (dt > 0) {
      blinkT -= dt;
      if (blinkPhase >= 0) { blinkPhase += dt; if (blinkPhase > 0.16) blinkPhase = -1; }
      if (blinkT <= 0 && idle.blink !== 'never') { blinkPhase = 0; blinkLog.push(time); blinkT = idle.blink === 'fixed' ? 3 : AC.rand(2, 6); }
      if (idle.blink === 'never') blinkT = 3;
      driftT -= dt;
      const amp = idle.drift === 'off' ? 0 : idle.drift === 'tiny' ? 0.07 : 0.6;
      if (driftT <= 0) { driftTX = AC.rand(-amp, amp); driftTY = AC.rand(-amp, amp) * 0.6; driftT = idle.drift === 'big' ? AC.rand(0.25, 0.6) : AC.rand(1.2, 2.8); }
      const dk = idle.drift === 'big' ? 14 : 3;
      driftX = AC.damp(driftX, driftTX, dk, dt);
      driftY = AC.damp(driftY, driftTY, dk, dt);
      if (speakT > 0) speakT -= dt;
      if (!test) stepSprings(dt);
    }
    // look target for "away" / "screen"
    const lk = MR.current && MR.current.id === 'tags' ? MR.api.state.lookTarget : null;
    if (lk === 'away') T.lookX = -0.6; else if (lk === 'screen') T.lookY = -0.35;
    head.rotation.z = -F.tilt * 0.12;
    head.rotation.y = (F.lookX + driftX) * 0.08;
    head.position.y = 2.75 + Math.sin(time * 1.6) * 0.015;
    earMat.emissiveIntensity = 0.35 + 0.4 * clamp(F.glow, 0, 1.5);
    lamp.intensity = 0.4 + 0.5 * clamp(F.glow, 0, 1.5);
    hud.set('e', emotion);
    draw(time);
    MR.update(dt);
    oc.update(dt);
  });
  window.GAME = { MR, spring, idle, F, SITUATIONS, busy: () => !!test };
  S.start();
  MR.begin();
})();
