/* GPU Rack — Module 3 · Hosting: GPUs and architecture.
   The win condition is the concept: a model only loads when its memory (parameters × bits ÷ 8, plus context and runtime)
   fits inside the GPU memory you rented. Numbers are the ones in the notes' GPU table. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  AC.boot({ game: 'gpu', week: 3, topic: 'Hosting on GPUs', title: 'GPU Rack', help: () => help() });
  const S = AC.scene({ fov: 45, near: 0.1, far: 300, background: 0x060c16 });
  const { scene, camera, renderer } = S;
  scene.fog = new THREE.Fog(0x060c16, 30, 80);
  AC.lights(scene, { sky: 0xbfe6ff, ground: 0x0c1626, hemi: 0.75, sun: 0.7, dir: [8, 20, 14] });
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 17, min: 7, max: 40, phi: 1.2, theta: 0.0, minPhi: 0.4, maxPhi: 1.5, target: new THREE.Vector3(0, 2.4, 0) });

  const TEAL = 0x2fe0cf;
  const glow = (c, e = 0.7) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.4 });
  const dark = (c = 0x111c2b) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, metalness: 0.4 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x08111d, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(80, 80, 0x16384a, 0x0e2232);
  grid.position.y = 0.01;
  scene.add(grid);
  // background server aisle for atmosphere
  for (let i = -6; i <= 6; i++) {
    const r = new THREE.Mesh(new THREE.BoxGeometry(1.6, 4.5, 1.2), dark(0x0c1522));
    r.position.set(i * 2.1, 2.25, -14);
    scene.add(r);
    for (let k = 0; k < 6; k++) {
      const led = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.02), glow(Math.random() < 0.7 ? 0x4be38a : 0x2fe0cf, 1));
      led.position.set(i * 2.1 - 0.5 + Math.random(), 0.6 + k * 0.65, -13.39);
      scene.add(led);
    }
  }

  // ---------------------------------------------------------------- racks
  const racksG = new THREE.Group();
  scene.add(racksG);
  let racks = [];
  function makeRack({ cards, cap, name, sub, x = 0, colH = 4 }) {
    const g = new THREE.Group();
    g.position.x = x;
    const per = Math.min(0.42, 3.6 / cards);
    const H = 0.4 + cards * per + 0.2;
    const frame = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(2.3, H, 1.5)), new THREE.LineBasicMaterial({ color: 0x2a5068 }));
    frame.position.y = H / 2;
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 1.6), dark(0x1a2a3e));
    base.position.y = 0.1;
    g.add(frame, base);
    const strips = [];
    for (let i = 0; i < cards; i++) {
      const y = 0.4 + i * per + per / 2;
      const card = new THREE.Mesh(new THREE.BoxGeometry(2.0, per * 0.7, 1.25), dark(0x18261f));
      card.position.y = y;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(1.7, per * 0.18, 0.04), glow(0x24405a, 0.4));
      strip.position.set(0, y, 0.64);
      g.add(card, strip);
      for (const fx of [-0.55, 0.55]) {
        const fan = new THREE.Mesh(new THREE.CircleGeometry(per * 0.26, 16), new THREE.MeshBasicMaterial({ color: 0x0a0f14 }));
        fan.position.set(fx, y, 0.63);
        g.add(fan);
      }
      strips.push(strip);
    }
    // VRAM column: glass tank whose height is this rack's GPU memory; the fill is the model's memory
    const tank = new THREE.Mesh(new THREE.BoxGeometry(0.8, colH, 0.8), new THREE.MeshStandardMaterial({ color: 0x9fdcff, transparent: true, opacity: 0.1, roughness: 0.1, depthWrite: false }));
    tank.position.set(1.75, colH / 2 + 0.2, 0);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.8, colH, 0.8)), new THREE.LineBasicMaterial({ color: 0x5fb8d8 }));
    edge.position.copy(tank.position);
    const fillMat = glow(TEAL, 0.8);
    const fill = new THREE.Mesh(new THREE.BoxGeometry(0.72, 1, 0.72), fillMat);
    fill.position.set(1.75, 0.2, 0);
    fill.scale.y = 0.001;
    const spill = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1, 0.9), glow(0xff5a4f, 0.9));
    spill.visible = false;
    spill.position.set(1.75, colH + 0.2, 0);
    g.add(tank, edge, fill, spill);
    const lbl = AC.textSprite(name, { color: '#e9f0f7', size: 0.5 });
    lbl.position.set(0.4, Math.max(H, colH + 0.2) + 0.75, 0);
    const subl = AC.textSprite(sub, { color: '#2fe0cf', bg: null, size: 0.42 });
    subl.position.set(0.4, Math.max(H, colH + 0.2) + 0.3, 0);
    g.add(lbl, subl);
    racksG.add(g);
    const R = { g, strips, fill, fillMat, spill, cap, colH, frac: 0, target: 0, over: 0, state: 'idle', shake: 0 };
    return R;
  }
  function clearRacks() {
    while (racksG.children.length) racksG.remove(racksG.children[0]);
    racks = [];
  }
  function setStrips(R, col) { R.strips.forEach((s) => { s.material.color.set(col); s.material.emissive.set(col); s.material.emissiveIntensity = col === 0x24405a ? 0.4 : 1.1; }); }
  function emptyRack(R) { R.frac = 0; R.target = 0; R.over = 0; R.spill.visible = false; R.state = 'idle'; R.fillMat.color.set(TEAL); R.fillMat.emissive.set(TEAL); setStrips(R, 0x24405a); }
  // start loading `need` GB into rack R; resolves after the fill animation
  let loading = null;
  function load(R, need, done) {
    emptyRack(R);
    R.target = Math.min(1, need / R.cap);
    R.over = Math.max(0, need / R.cap - 1);
    R.state = 'filling';
    loading = { R, t: 0, done, ok: need <= R.cap };
    AC.audio.whoosh();
  }

  // ---------------------------------------------------------------- panel + HUD
  const panel = h('div', { class: 'opt-panel ac-panel' });
  const qEl = h('div', { class: 'q' });
  const optsEl = h('div', { class: 'opts' });
  const actEl = h('div', { class: 'ac-actions' });
  panel.append(qEl, optsEl, actEl);
  AC.root().appendChild(panel);
  const setQ = (small, text) => { qEl.innerHTML = ''; qEl.append(h('small', {}, small), text); };

  const hud = AC.ui.hud();
  hud.section('Memory').row('p', 'Parameters', '--').row('b', 'Precision', '--').row('w', 'Weights', '--').row('c', '+ context, runtime', '--').row('need', 'Total need', '--').row('cap', 'GPU memory', '--').meter('m');
  hud.section('Rule').formula('f', 'weights (GB) = parameters (billions) × bits ÷ 8');
  const fmtGB = (g) => (g >= 100 ? AC.fmt(g) : AC.fmt(g, g % 1 ? 1 : 0)) + ' GB';
  function showNeed(M, bits, reveal, cap) {
    hud.set('p', M.params + 'B');
    hud.set('b', bits ? bits + '-bit (' + bits / 8 + ' byte' + (bits === 8 ? '' : 's') + ')' : '--');
    const w = (M.params * bits) / 8;
    hud.set('w', reveal ? fmtGB(w) : '?', reveal ? '' : 'mag');
    hud.set('c', reveal ? '+' + AC.fmt(M.need - w, M.need - w < 10 ? 1 : 0) + ' GB' : '?', reveal ? '' : 'mag');
    hud.set('need', reveal ? M.needTxt : '?', reveal ? (M.need <= cap ? '' : 'bad') : 'mag');
    hud.set('cap', fmtGB(cap), 'cyan');
    hud.setFormula('f', 'weights = ' + M.params + ' × ' + (bits || '?') + ' ÷ 8 = ' + (reveal ? fmtGB(w) : '?') + '\n' + (M.note || 'context length adds a few GB on top'));
    hud.setMeter('m', reveal ? M.need / cap : 0, reveal && M.need > cap ? 'var(--red)' : 'var(--green)');
  }

  // ---------------------------------------------------------------- data from the notes (GPU table, section 3)
  const TIERS = [
    { id: 't24', name: 'RTX 4090 / 5090', sub: '24 GB', cards: 1, cap: 24 },
    { id: 't48', name: 'L40S', sub: '48 GB', cards: 1, cap: 48 },
    { id: 't80', name: 'H100', sub: '80 GB', cards: 1, cap: 80 },
    { id: 't320', name: '4 × H100', sub: '4 × 80 = 320 GB', cards: 4, cap: 320 },
    { id: 't1128', name: '8 × H200 node', sub: '8 × 141 = 1,128 GB', cards: 8, cap: 1128 },
  ];
  // need = what the notes say it takes; note = the notes' own wording
  const MODELS = [
    { n: 'Gemma 4 12B', params: 12, bits: 8, need: 16, needTxt: '12–16 GB', best: 't24', note: 'notes: 12B fits 12–16GB' },
    { n: 'Qwen3.8-27B', params: 27, bits: 4, need: 19, needTxt: '16–19 GB', best: 't24', note: 'notes: about 16–19GB at 4-bit' },
    { n: 'A 70B model', params: 70, bits: 4, need: 40, needTxt: '36–40 GB', best: 't48', note: 'notes: about 36–40GB at 4-bit' },
    { n: 'A 70B model', params: 70, bits: 8, need: 72, needTxt: 'about 72 GB', best: 't80', note: 'notes: about 72GB at FP8' },
    { n: 'Llama 4 Scout', params: 109, bits: 4, need: 55, needTxt: 'about 55 GB', best: 't80', note: 'notes: about 55GB at 4-bit (109B total)' },
    { n: 'GLM-5.3-Flash', params: 320, bits: 4, need: 210, needTxt: '162–210 GB', best: 't320', note: 'notes: 162–210GB at 4-bit' },
    { n: 'GLM-5.3', params: 744, bits: 4, need: 410, needTxt: 'about 410 GB', best: 't1128', note: 'estimate: 372 GB weights + context' },
    { n: 'MiMo-V2.6-Pro', params: 1020, bits: 4, need: 560, needTxt: 'about 560 GB', best: 't1128', note: 'estimate: 510 GB weights + context' },
  ];
  const QWEN = MODELS[1];
  const Q = (id) => AC.QUESTIONS.find((q) => q.id === id);

  // ---------------------------------------------------------------- missions
  const BITS = [16, 8, 4];
  const missions = [
    {
      id: 'fit', title: 'Fit the Brain on One Card',
      objective: 'Choose a precision so Qwen3.8-27B fits one 24GB card, then load it',
      story: 'Week 1: you rented one RTX 4090 with 24GB of GPU memory. The brain is Qwen3.8-27B: 27 billion parameters. Work out which precision fits before you press Load.',
      learn: [
        { t: 'Bytes per parameter', p: 'Every parameter is stored as a number. Fewer bits per number means less memory.', f: '16-bit = 2 bytes · 8-bit = 1 · 4-bit = 0.5' },
        { t: 'Weights', p: 'Multiply the parameter count by the bytes per parameter.', f: 'GB = billions × bits ÷ 8' },
        { t: 'Plus context', p: 'Context length and runtime add a few GB on top of the weights.', f: 'test with your real prompts' },
      ],
      controls: ['<kbd>1</kbd><kbd>2</kbd><kbd>3</kbd> choose precision', '<kbd>Enter</kbd> or <b>Load</b>'],
      proved: '27 × 4 ÷ 8 = 13.5 GB of weights, plus context and runtime, gives the notes\' "about 16–19GB at 4-bit": it fits one 24GB card. At 16-bit it needs 54 GB, at 8-bit 27 GB. Quantising (compression, stage 7) is what lets a big brain run on a cheap GPU.',
      tip: 'Work it out: 27 × 16 ÷ 8 = 54, 27 × 8 ÷ 8 = 27. Both are more than 24. Try the smallest precision.',
      quiz: Q('h-fit'),
      start(api) {
        clearRacks();
        const R = makeRack({ cards: 1, cap: 24, name: 'RTX 4090', sub: '24 GB', x: 0 });
        racks.push(R);
        oc.target.set(0.5, 2.2, 0); oc.dist = 11;
        const st = api.state;
        st.bits = 16; st.loads = 0;
        setQ('Qwen3.8-27B · 27 billion parameters', 'Which precision fits a 24GB card?');
        optsEl.innerHTML = ''; optsEl.className = 'opts';
        BITS.forEach((b, i) => optsEl.appendChild(h('button', { type: 'button', class: b === st.bits ? 'on' : '', onclick: () => choose(i) }, h('small', {}, 'key ' + (i + 1)), b + '-bit', h('small', {}, b / 8 + ' byte' + (b === 8 ? '' : 's') + ' per parameter'))));
        actEl.innerHTML = '';
        actEl.appendChild(h('button', { class: 'ac-btn', type: 'button', onclick: go }, 'Load model'));
        function choose(i) { if (loading) return; st.bits = BITS[i]; [...optsEl.children].forEach((c, k) => c.classList.toggle('on', k === i)); emptyRack(R); showNeed(fitModel(), st.bits, false, 24); AC.audio.click(); }
        function go() {
          if (loading) return;
          st.loads++;
          const M = fitModel();
          showNeed(M, st.bits, true, 24);
          load(R, M.need, (ok) => {
            if (ok) api.win(st.loads === 1 ? 3 : st.loads === 2 ? 2 : 1, 'Loaded at ' + st.bits + '-bit on try ' + st.loads + ': ' + M.needTxt + ' inside 24 GB.');
            else { AC.ui.toast('OUT OF MEMORY', 'var(--red)'); AC.fact(st.bits + '-bit needs ' + M.needTxt, '27 × ' + st.bits + ' ÷ 8 = ' + (27 * st.bits) / 8 + ' GB of weights alone. That is more than the card\'s 24 GB.', { tag: 'Out of memory', color: 'var(--red)' }); }
          });
        }
        st.choose = choose; st.go = go;
        showNeed(fitModel(), st.bits, false, 24);
        function fitModel() { const w = (27 * st.bits) / 8; return st.bits === 4 ? QWEN : { n: 'Qwen3.8-27B', params: 27, need: w + 3, needTxt: 'about ' + AC.fmt(w + 3) + ' GB', note: 'weights + about 3 GB context and runtime' }; }
      },
      keys(code, api) {
        const m = /^Digit([1-3])$/.exec(code);
        if (m) api.state.choose(+m[1] - 1);
        if (code === 'Enter') api.state.go();
      },
    },
    {
      id: 'match', title: 'Rent the Right GPU',
      objective: 'Load 8 models, each on the smallest GPU that fits it',
      story: 'Machines are rented by the hour, so a bigger GPU than you need is wasted money, and a smaller one crashes with "out of memory". For each model, work out its memory and pick the smallest card that holds it.',
      learn: [
        { t: 'The table', p: '24GB: a 27B model at 4-bit. 48GB: a 70B at 4-bit. 80GB: a 70B at FP8 or Llama 4 Scout at 4-bit.', f: '27B·4bit → 24GB · 70B·4bit → 48GB' },
        { t: 'Groups', p: 'Bigger models are split across several GPUs: GLM-5.3-Flash on 3–4 × 80GB, the top open weights on an 8 × H200 node.', f: '320B × 4 ÷ 8 = 160 GB' },
        { t: 'Smallest that fits', p: 'Pick the smallest card whose memory is more than the model needs. Leave room for context.', f: 'need ≤ GPU memory' },
      ],
      controls: ['<kbd>1</kbd>…<kbd>5</kbd> or tap a GPU to rent it for this model'],
      proved: 'You used the GPU table from section 3: weights = parameters × bits ÷ 8, plus room for context. The GPU size decides which brain you can run, which is why the plan starts on one 24–48GB card and only moves to bigger models after the prototype proves its value.',
      tip: 'Do the sum before you tap: 70B at 4-bit is 35 GB of weights (48GB card); at 8-bit it is 70 GB (80GB card).',
      quiz: Q('h-tier'),
      start(api) {
        clearRacks();
        TIERS.forEach((t, i) => racks.push(makeRack({ cards: t.cards, cap: t.cap, name: (i + 1) + ' · ' + t.name, sub: t.sub, x: -11 + i * 5.4 })));
        oc.target.set(0.2, 1.4, 0); oc.dist = 30; oc.phi = 1.25;
        const st = api.state;
        st.i = 0; st.perfect = 0; st.waste = 0; st.oom = 0;
        optsEl.innerHTML = ''; optsEl.className = 'opts five';
        TIERS.forEach((t, i) => optsEl.appendChild(h('button', { type: 'button', onclick: () => pick(i) }, h('small', {}, 'key ' + (i + 1)), t.name, h('small', {}, t.sub))));
        actEl.innerHTML = '';
        const show = () => {
          const M = MODELS[st.i];
          setQ('Model ' + (st.i + 1) + ' of ' + MODELS.length + ' · ' + M.params + 'B parameters at ' + M.bits + '-bit', M.n + ': which GPU do you rent?');
          showNeed(M, M.bits, false, 0);
          hud.set('cap', 'pick one', 'cyan');
          [...optsEl.children].forEach((c) => c.classList.remove('right', 'wrong', 'on'));
        };
        function pick(i) {
          if (loading || st.i >= MODELS.length) return;
          const M = MODELS[st.i], T = TIERS[i];
          racks.forEach(emptyRack);
          showNeed(M, M.bits, true, T.cap);
          optsEl.children[i].classList.add('on');
          load(racks[i], M.need, (ok) => {
            if (!ok) {
              st.oom++;
              optsEl.children[i].classList.add('wrong');
              AC.ui.toast('OUT OF MEMORY', 'var(--red)');
              AC.fact(M.n + ' needs ' + M.needTxt, M.params + ' × ' + M.bits + ' ÷ 8 = ' + AC.fmt((M.params * M.bits) / 8, 1) + ' GB of weights. The ' + T.name + ' has ' + T.sub + '.', { tag: 'Out of memory', color: 'var(--red)' });
              if (st.oom + st.waste > 6) api.fail('Too many crashes and oversized rentals.');
              return;
            }
            const best = TIERS.findIndex((t) => t.id === M.best);
            if (i === best) { st.perfect++; AC.audio.good(); AC.ui.toast('Perfect fit', 'var(--green)'); }
            else { st.waste++; AC.audio.ping(); AC.fact('It fits, but you overpaid', M.n + ' (' + M.needTxt + ') fits on the ' + TIERS[best].name + ' (' + TIERS[best].sub + '). Rent the smallest card that fits.', { tag: 'Wasted money', color: 'var(--amber)' }); }
            optsEl.children[best].classList.add('right');
            st.i++;
            api.progress(st.i / MODELS.length);
            if (st.i >= MODELS.length) {
              const errs = st.oom + st.waste;
              return api.win(errs === 0 ? 3 : errs <= 2 ? 2 : 1, st.perfect + ' of 8 perfect fits · ' + st.waste + ' oversized · ' + st.oom + ' out-of-memory crashes.');
            }
            setTimeout(() => { if (st.i < MODELS.length && MR.api.state === st) show(); }, 900);
          });
        }
        st.pick = pick;
        show();
      },
      keys(code, api) { const m = /^Digit([1-5])$/.exec(code); if (m) api.state.pick(+m[1] - 1); },
    },
    {
      id: 'scale', title: 'The Scale Step',
      objective: 'Serve GLM-5.3-Flash with long context on the fewest 80GB GPUs',
      story: 'The prototype proved its value, so the brain moves up to GLM-5.3-Flash: 320 billion parameters (18B active) at 4-bit. With long prompts it needs about 210 GB. How many 80GB H100s do you rent?',
      learn: [
        { t: 'All weights load', p: 'Only 18B parameters are active per token, but all 320B must sit in GPU memory.', f: '320 × 4 ÷ 8 = 160 GB' },
        { t: 'Context adds up', p: 'Short prompts: about 162 GB. Long context: about 210 GB.', f: '162–210 GB' },
        { t: 'Split it', p: 'vLLM or SGLang split the model across the GPUs in one machine.', f: 'total = cards × 80 GB' },
      ],
      controls: ['<kbd>←</kbd><kbd>→</kbd> fewer / more GPUs', '<kbd>Enter</kbd> or <b>Load</b>'],
      proved: '210 GB ÷ 80 GB = 2.6, so you need 3 cards (240 GB). That is why the notes say "3–4 × 80GB GPUs at 4-bit". Active parameters make it fast, but every parameter still has to fit in memory.',
      tip: '2 × 80 = 160 GB, less than the 162 GB even short prompts need. Divide 210 by 80 and round up.',
      quiz: Q('h-active'),
      start(api) {
        const st = api.state;
        st.n = 2; st.loads = 0;
        const rebuild = () => {
          clearRacks();
          racks.push(makeRack({ cards: st.n, cap: st.n * 80, name: st.n + ' × H100', sub: st.n * 80 + ' GB', x: 0, colH: 0.9 + st.n * 0.75 }));
          hud.set('cap', st.n * 80 + ' GB', 'cyan');
        };
        rebuild();
        oc.target.set(0.5, 2.6, 0); oc.dist = 13;
        const M = MODELS[5];
        setQ('GLM-5.3-Flash · 320B parameters at 4-bit · long context', 'How many 80GB GPUs?');
        optsEl.innerHTML = ''; optsEl.className = 'opts';
        const count = h('button', { type: 'button', class: 'on' }, h('small', {}, 'GPUs'), String(st.n));
        optsEl.append(h('button', { type: 'button', onclick: () => change(-1) }, h('small', {}, 'key ←'), '− one GPU'), count, h('button', { type: 'button', onclick: () => change(1) }, h('small', {}, 'key →'), '+ one GPU'));
        actEl.innerHTML = '';
        actEl.appendChild(h('button', { class: 'ac-btn', type: 'button', onclick: go }, 'Load model'));
        showNeed(M, 4, false, st.n * 80);
        function change(d) { if (loading) return; st.n = clamp(st.n + d, 1, 6); count.lastChild.textContent = String(st.n); rebuild(); showNeed(M, 4, false, st.n * 80); AC.audio.click(); }
        function go() {
          if (loading) return;
          st.loads++;
          showNeed(M, 4, true, st.n * 80);
          load(racks[0], M.need, (ok) => {
            if (!ok) { AC.ui.toast('OUT OF MEMORY', 'var(--red)'); AC.fact(st.n + ' × 80 = ' + st.n * 80 + ' GB', 'Not enough for about 210 GB. Add GPUs until the total is bigger than the need.', { tag: 'Out of memory', color: 'var(--red)' }); return; }
            const stars = st.n === 3 ? (st.loads <= 2 ? 3 : 2) : st.n === 4 ? (st.loads === 1 ? 2 : 1) : 1;
            api.win(stars, 'Served on ' + st.n + ' × H100 = ' + st.n * 80 + ' GB after ' + st.loads + (st.loads === 1 ? ' load.' : ' loads.') + (st.n > 3 ? ' 3 cards (240 GB) would have been enough.' : ''));
          });
        }
        st.change = change; st.go = go;
      },
      keys(code, api) {
        if (code === 'ArrowLeft' || code === 'ArrowDown') api.state.change(-1);
        if (code === 'ArrowRight' || code === 'ArrowUp') api.state.change(1);
        if (code === 'Enter') api.state.go();
      },
    },
  ];
  const MR = AC.missions({ game: 'gpu', week: 3, list: missions, onSelect() { loading = null; } });
  window.addEventListener('keydown', (e) => {
    if (AC.paused || !MR.current || MR.done || e.repeat) return;
    if (MR.current.keys) MR.current.keys(e.code, MR.api);
  });

  AC.ui.tools([{ label: 'Reset view', onclick: () => Object.assign(oc, { theta: 0, phi: 1.2 }) }]);
  function help() {
    AC.ui.card({ eyebrow: 'GPU Rack', title: 'How to play', body: [
      'The glass column next to each rack is its GPU memory. When you load a model, the column fills with the memory the model needs.',
      'If it overflows, the model crashes with "out of memory". Work out the size first: parameters (billions) × bits ÷ 8 = GB of weights, then add a few GB for context.',
      'Drag to orbit, scroll or pinch to zoom.',
    ] });
  }

  // ---------------------------------------------------------------- loop
  S.onFrame((dt, time) => {
    if (loading) {
      const L = loading, R = L.R;
      L.t += dt;
      R.frac = AC.damp(R.frac, R.target, 3.5, dt);
      if (L.t > 1.1 && !L.fired) {
        L.fired = true;
        if (L.ok) { setStrips(R, 0x4be38a); AC.audio.good(); }
        else { R.spill.visible = true; R.shake = 0.6; setStrips(R, 0xff5a4f); R.fillMat.color.set(0xff5a4f); R.fillMat.emissive.set(0xff5a4f); AC.audio.boom(); }
      }
      if (L.t > 1.6) { loading = null; L.done(L.ok); }
    }
    for (const R of racks) {
      R.fill.scale.y = Math.max(0.001, R.frac * R.colH);
      R.fill.position.y = 0.2 + (R.frac * R.colH) / 2;
      if (R.spill.visible) {
        const sh = Math.min(1.5, R.over * R.colH) * (0.85 + Math.sin(time * 8) * 0.15);
        R.spill.scale.y = Math.max(0.05, sh);
        R.spill.position.y = R.colH + 0.2 + sh / 2;
      }
      if (R.shake > 0) { R.shake = Math.max(0, R.shake - dt); R.g.position.z = Math.sin(time * 60) * 0.06 * R.shake; } else R.g.position.z = 0;
    }
    MR.update(dt);
    oc.update(dt);
  });
  window.GAME = { MR, MODELS, TIERS, busy: () => !!loading };
  S.start();
  MR.begin();
})();
