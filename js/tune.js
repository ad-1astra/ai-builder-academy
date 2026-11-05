/* Fine-Tune Lab — Module 7 · Supervised fine-tuning, experiments, preference training (DPO), evaluation.
   The 30 glowing cells are your 30-question test set: every result in this lab is measured on it.
   Mission 1 rewards clean data over big data, mission 2 rewards changing one thing at a time and learning on a
   small model first, mission 3 rewards labelling the better answer the way the notes describe it. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  AC.boot({ game: 'tune', week: 7, topic: 'Fine-tuning and beyond', title: 'Fine-Tune Lab', help: () => help() });
  const S = AC.scene({ fov: 45, near: 0.1, far: 300, background: 0x080a14 });
  const { scene, camera, renderer } = S;
  scene.fog = new THREE.Fog(0x080a14, 30, 80);
  AC.lights(scene, { sky: 0xd6e6ff, ground: 0x141018, hemi: 0.7, sun: 0.7, dir: [6, 18, 12] });
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 16, min: 7, max: 40, phi: 1.18, theta: 0, minPhi: 0.4, maxPhi: 1.5, target: new THREE.Vector3(0, 2.4, 0) });

  const TEAL = 0x2fe0cf, ORANGE = 0xff8a3d;
  const glow = (c, e = 0.7) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.4 });
  const mat = (c, r = 0.7, m = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0x0a0d18, 1, 0));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(80, 80, 0x2a2244, 0x16142a);
  grid.position.y = 0.01;
  scene.add(grid);

  // the model core
  const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.5, 1.2, 8), mat(0x1a2233, 0.5, 0.6));
  ped.position.set(0, 0.6, -1);
  scene.add(ped);
  const coreMat = new THREE.MeshStandardMaterial({ color: TEAL, emissive: TEAL, emissiveIntensity: 0.6, flatShading: true, roughness: 0.3 });
  const core = new THREE.Mesh(new THREE.IcosahedronGeometry(1.0, 1), coreMat);
  core.position.set(0, 2.6, -1);
  scene.add(core);
  const rings = [0, 1, 2].map((i) => { const r = new THREE.Mesh(new THREE.TorusGeometry(1.6 + i * 0.35, 0.03, 8, 64), glow(i === 1 ? ORANGE : TEAL, 0.8)); r.position.copy(core.position); r.rotation.x = Math.PI / 2 + i * 0.5; scene.add(r); return r; });
  const coreLbl = AC.textSprite('YOUR MODEL', { color: '#2fe0cf', size: 0.45 });
  coreLbl.position.set(0, 4.5, -1);
  scene.add(coreLbl);
  // 30-question test set: 6 × 5 cells behind the core
  const cells = [];
  const cellLbl = AC.textSprite('30-QUESTION TEST SET', { color: '#93a7bf', bg: null, size: 0.42 });
  cellLbl.position.set(-6.6, 4.75, -2);
  scene.add(cellLbl);
  for (let i = 0; i < 30; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.42, 0.12), glow(0x1d2a40, 0.3));
    c.position.set(-9.0 + (i % 6) * 0.96, 4.1 - Math.floor(i / 6) * 0.56, -2);
    scene.add(c);
    cells.push(c);
  }
  let cellsOn = 0, cellsShown = 0;
  function showScore(n) { cellsOn = clamp(Math.round(n), 0, 30); }
  const world = new THREE.Group();
  scene.add(world);
  const clearWorld = () => { while (world.children.length) world.remove(world.children[0]); };
  const fly = []; // flying tiles
  function sendTile(m, to, dur, then) { fly.push({ m, from: m.position.clone(), to: to.clone(), t: 0, dur, then }); }
  let coreFlash = 0, coreCol = new THREE.Color(TEAL);
  function pulse(col) { coreFlash = 1; coreCol.set(col); }

  // ---------------------------------------------------------------- panel + HUD
  const panel = h('div', { class: 'opt-panel ac-panel' });
  AC.root().appendChild(panel);
  const hud = AC.ui.hud();
  hud.section('Lab').row('a', '--', '--').row('b', '--', '--').row('c', '--', '--').row('d', '--', '--').meter('m');
  hud.section('Notebook').formula('f', '');
  const labels = (arr) => [...hud.el.querySelectorAll('.ac-row .k')].forEach((k, i) => { if (arr[i] != null) k.textContent = arr[i]; });
  const Q = (id) => AC.QUESTIONS.find((q) => q.id === id);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function card(lines, color = '#e9f0f7') {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#0f1d2e'; g.fillRect(0, 0, 512, 256);
    g.strokeStyle = '#2fe0cf'; g.lineWidth = 4; g.strokeRect(2, 2, 508, 252);
    g.font = '22px "B612 Mono", Consolas, monospace';
    g.fillStyle = color;
    let y = 40;
    for (const l of lines) {
      const words = l.split(' ');
      let cur = '';
      for (const w of words) { if (g.measureText(cur + w).width > 470) { g.fillText(cur, 20, y); y += 28; cur = ''; } cur += w + ' '; }
      g.fillText(cur, 20, y); y += 34;
      if (y > 240) break;
    }
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    return new THREE.Mesh(new THREE.PlaneGeometry(3.2, 1.6), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide, transparent: true }));
  }

  // ---------------------------------------------------------------- mission 1: supervised fine-tuning data (emotion tag)
  const J = (e, i, l) => '{"emotion": "' + e + '", "intensity": ' + i + ', "look": "' + l + '"}';
  const GOOD = [
    ['Can you help me wire an LED?', 'Sure! Long leg to pin 13 through a 220 Ω resistor.', J('happy', 0.6, 'user')],
    ['Why won\'t my servo move?', 'Let me check the wiring and the code.', J('thinking', 0.7, 'screen')],
    ['Hello?', 'Hi! I\'m listening.', J('curious', 0.5, 'user')],
    ['Whoa, a drone just flew in!', 'Wow, I see it too!', J('surprised', 0.9, 'user')],
    ['Good night, see you tomorrow.', 'Good night! Going to standby.', J('sleepy', 0.8, 'away')],
    ['What is Ohm\'s law?', 'Voltage = current × resistance: V = I × R.', J('neutral', 0.4, 'user')],
    ['It works!!', 'Yes! Great job!', J('happy', 0.9, 'user')],
    ['Run the tests for me.', 'Running them now.', J('thinking', 0.5, 'screen')],
    ['ok fine I guess', 'Glad it is okay. Want to improve it?', J('happy', 0.3, 'user')],
    ['Can you see my robot?', 'Yes. Hold it a bit closer to the camera.', J('curious', 0.6, 'user')],
    ['Explain PWM.', 'PWM switches power on and off fast to control speed.', J('neutral', 0.5, 'user')],
    ['I made a bug again...', 'No problem, let\'s find it together.', J('happy', 0.4, 'user')],
  ].map(([u, r, t]) => ({ u, r, t, good: true }));
  const BAD = [
    ['Hi!', 'Hello! How can I help?', '(no tag)', 'There is no emotion tag, so the model learns to skip it.'],
    ['Thanks a lot!', 'You\'re welcome!', J('happy', 7, 'user'), 'Intensity 7 is outside the 0–1 range.'],
    ['Show me the motor code.', 'Here it is.', '{"mood": "happy", "intensity": 0.6, "look": "user"}', 'Wrong key: "mood" instead of "emotion". The face engine would not read it.'],
    ['Hmm, that is odd.', 'Let me look.', J('angry-ish', 0.5, 'user'), '"angry-ish" is not one of the six expressions.'],
    ['What time is it?', 'I do not have a clock yet.', '{"emotion": "neutral", "intensity": 0.4, "look": "user"', 'Broken JSON: the closing brace is missing.'],
    ['My robot fell and broke.', 'Great! Ha ha.', J('happy', 1.0, 'user'), 'The reply and tag do not fit the moment. Bad examples teach bad behaviour.'],
    ['Nice work today.', 'Thank you!', 'emotion = happy, intensity = 0.7', 'Right idea, wrong shape. Training data must use one exact format: the JSON shape.'],
    ['Draw a robot.', 'Drawing now!', J('happy', 0.6, 'user') + ' ' + J('thinking', 0.5, 'screen'), 'Two tags in one reply: the face engine expects exactly one.'],
    ['Can you help me wire an LED?', 'Sure! Long leg to pin 13 through a 220 Ω resistor.', J('happy', 0.6, 'user'), 'An exact duplicate of an example you already have.'],
    ['Tell me about sensors.', 'Cookie settings | Accept all | Privacy | Terms', J('neutral', 0.5, 'user'), 'The reply is website junk, not an answer.'],
  ].map(([u, r, t, why]) => ({ u, r, t, why, good: false }));
  const accuracy = (G, B) => clamp(0.7 + 0.3 * (1 - Math.exp(-G / 5)) - (0.3 * B) / Math.max(1, G + B), 0, 0.99);
  function sftMission() {
    return {
      id: 'sft', title: 'Teach the Emotion Tag',
      objective: 'Curate the training examples, fine-tune, and reach ≥ 94% valid tags on the test set',
      story: 'First fine-tuning project from the notes: teach the model to always end its reply with the emotion tag, in the right JSON shape. You have 22 candidate examples. Keep the excellent ones, reject the rest, then train a LoRA.',
      learn: [
        { t: 'Supervised fine-tuning', p: 'The model learns to follow a behaviour from example conversations: prompt in, ideal reply out.', f: 'stage 4: SFT' },
        { t: 'The shape', p: 'Exactly one tag, valid JSON, one of six emotions, intensity 0–1, a look.', f: '{"emotion": "happy", "intensity": 0.7, "look": "user"}' },
        { t: 'Quality beats quantity', p: 'A few hundred excellent examples often beat thousands of poor ones.', f: 'clean > big' },
      ],
      controls: ['<kbd>→</kbd> keep', '<kbd>←</kbd> reject', 'then choose what to train on'],
      proved: 'This is the first fine-tuning project from section 6, the "easy win": a small, clean SFT dataset teaches the model one exact format. One bad example costs more than one good example adds, and a mountain of unchecked data drags the score down.',
      tip: 'Check each tag like a parser would: exactly one tag, valid JSON with a closing brace, the key "emotion" (not "mood"), one of the six emotions, intensity between 0 and 1.',
      quiz: Q('t-sft'),
      start(api) {
        clearWorld();
        const st = api.state;
        st.items = shuffle(GOOD.concat(BAD)); st.i = 0; st.G = 0; st.B = 0; st.dropGood = 0; st.phase = 'sort'; st.cur = null;
        labels(['Example', 'Kept', 'Rejected', 'Valid tags']);
        hud.set('a', '1 / ' + st.items.length); hud.set('b', '0'); hud.set('c', '0'); hud.set('d', '--');
        hud.setFormula('f', 'target shape:\n{"emotion": one of 6,\n "intensity": 0 to 1,\n "look": "user" | "screen" | "away"}');
        showScore(0);
        oc.target.set(0, 2.6, 0); oc.dist = 15;
        panel.innerHTML = '';
        st.qEl = h('div', { class: 'q' });
        st.ex = h('div', { class: 'term', style: { maxHeight: '120px' } });
        st.opts = h('div', { class: 'opts' });
        panel.append(st.qEl, st.ex, st.opts);
        const sortButtons = () => {
          st.opts.innerHTML = '';
          st.opts.append(h('button', { type: 'button', onclick: () => decide(false) }, h('small', {}, 'key ←'), 'Reject'), h('button', { type: 'button', onclick: () => decide(true) }, h('small', {}, 'key →'), 'Keep'));
        };
        sortButtons();
        const show = () => {
          const it = st.items[st.i];
          st.qEl.innerHTML = '';
          st.qEl.append(h('small', {}, 'Example ' + (st.i + 1) + ' of ' + st.items.length), 'Keep it for training?');
          st.ex.textContent = 'user:  ' + it.u + '\nreply: ' + it.r + '\ntag:   ' + it.t;
          hud.set('a', st.i + 1 + ' / ' + st.items.length);
          const m = card(['user: ' + it.u, 'reply: ' + it.r, it.t], '#e9f0f7');
          m.position.set(5.4, 2.5, 1.2);
          m.rotation.y = -0.35;
          world.add(m);
          st.cur = m;
        };
        function decide(keep) {
          if (st.phase !== 'sort' || !st.cur) return;
          const it = st.items[st.i];
          const m = st.cur;
          st.cur = null;
          if (keep) { if (it.good) st.G++; else { st.B++; AC.fact('Bad example kept', it.why, { tag: 'Training data', color: 'var(--amber)' }); } }
          else if (it.good) { st.dropGood++; AC.fact('Good example rejected', 'That one had a correct tag that fits the reply. Every good example helps.', { tag: 'Training data', color: 'var(--amber)', ms: 6000 }); }
          AC.audio.click();
          hud.set('b', String(st.G + st.B)); hud.set('c', String(st.i + 1 - st.G - st.B));
          sendTile(m, keep ? core.position : new THREE.Vector3(-7, 0.3, 2), 0.5, () => { world.remove(m); if (keep) pulse(0x4be38a); });
          st.i++;
          api.progress(st.i / st.items.length);
          if (st.i < st.items.length) setTimeout(() => { if (MR.api.state === st) show(); }, 350);
          else choose();
        }
        function choose() {
          st.phase = 'choose';
          st.qEl.innerHTML = '';
          st.qEl.append(h('small', {}, 'Dataset ready: ' + (st.G + st.B) + ' examples'), 'What do you train the LoRA on?');
          st.ex.textContent = 'Option A: only your ' + (st.G + st.B) + ' checked examples.\nOption B: your examples + 3,000 scraped chat logs (unchecked, about 40% have bad or missing tags).';
          st.opts.innerHTML = '';
          st.opts.append(h('button', { type: 'button', onclick: () => train(false) }, h('small', {}, 'key 1'), 'A · my checked examples'), h('button', { type: 'button', onclick: () => train(true) }, h('small', {}, 'key 2'), 'B · add 3,000 scraped logs'));
        }
        function train(scraped) {
          if (st.phase !== 'choose') return;
          st.phase = 'train'; st.trainT = 0; st.scraped = scraped;
          st.acc = scraped ? accuracy(st.G + 1800, st.B + 1200) : accuracy(st.G, st.B);
          st.qEl.innerHTML = '';
          st.qEl.append(h('small', {}, 'LoRA fine-tune on an 8B model'), 'Training… then testing on 30 questions');
          st.opts.innerHTML = '';
          AC.audio.whoosh();
        }
        st.decide = decide; st.train = train;
        show();
      },
      update(dt, api) {
        const st = api.state;
        if (st.phase !== 'train') return;
        st.trainT += dt;
        coreMat.emissiveIntensity = 0.6 + Math.sin(st.trainT * 12) * 0.4;
        api.progress(st.trainT / 2.5, 'Fine-tuning');
        showScore(Math.min(st.trainT / 2.5, 1) * st.acc * 30);
        if (st.trainT < 2.5) return;
        st.phase = 'done';
        const pct = Math.round(st.acc * 1000) / 10;
        hud.set('d', pct + ' %', pct >= 94 ? '' : 'bad');
        hud.setMeter('m', st.acc);
        if (st.acc >= 0.94) return api.win(st.acc >= 0.97 ? 3 : st.acc >= 0.955 ? 2 : 1, pct + '% of test replies end with a valid tag, from ' + st.G + ' good examples' + (st.B ? ' and ' + st.B + ' bad one' + (st.B > 1 ? 's' : '') : '') + '.');
        if (st.scraped && accuracy(st.G, st.B) >= 0.94) {
          AC.fact('More data, worse model', 'The 3,000 unchecked logs taught it to skip or break the tag: only ' + pct + '% valid. Train on your clean examples only.', { tag: 'Quality beats quantity', color: 'var(--amber)', ms: 11000 });
          st.phase = 'choose';
          st.qEl.innerHTML = '';
          st.qEl.append(h('small', {}, 'Result: ' + pct + '% valid tags'), 'Train again?');
          st.opts.innerHTML = '';
          st.opts.append(h('button', { type: 'button', onclick: () => st.train(false) }, h('small', {}, 'key 1'), 'A · my checked examples'), h('button', { type: 'button', onclick: () => st.train(true) }, h('small', {}, 'key 2'), 'B · add 3,000 scraped logs'));
          return;
        }
        api.fail(pct + '% valid tags: ' + st.G + ' good examples kept, ' + st.B + ' bad ones kept' + (st.scraped ? ', plus 3,000 unchecked logs' : '') + '. You need ≥ 94%.');
      },
    };
  }

  // ---------------------------------------------------------------- mission 2: one change at a time
  const OPTS = {
    size: [['8B', '8B · 1 h'], ['27B', '27B · 4 h']],
    data: [['v1', 'v1 · 3,000 mixed'], ['v2', 'v2 · 400 clean']],
    lr: [['low', 'low'], ['medium', 'medium'], ['high', 'high']],
    ep: [[1, '1'], [2, '2'], [3, '3'], [5, '5']],
    rank: [[8, '8'], [16, '16'], [64, '64']],
  };
  const NAMES = { size: 'Model', data: 'Data', lr: 'Learning rate', ep: 'Epochs', rank: 'LoRA rank' };
  // hidden test-set score out of 30 (tuned so a one-change search on 8B, then one 27B run, fits in 14 of the 16 hours)
  const score = (c) => Math.min(30, (c.size === '8B' ? 13 : 17) + { v1: 1, v2: 5 }[c.data] + { low: 0, medium: 3, high: -5 }[c.lr] + { 1: 0, 2: 2, 3: 3, 5: 1 }[c.ep] + { 8: 0, 16: 1, 64: 1 }[c.rank]);
  const BUDGET = 16;
  function expMission() {
    return {
      id: 'experiment', title: 'One Change at a Time',
      objective: 'Score ≥ 28 of 30 with the 27B model inside 16 GPU hours',
      story: 'Your LoRA recipe has five settings, and every run costs GPU time: 1 hour on the 8B model, 4 hours on the 27B. Find a recipe that scores 28 of 30 on your test set with the 27B, before the budget runs out.',
      learn: [
        { t: 'One change', p: 'Change one thing at a time and re-run the test set, otherwise you cannot tell what helped.', f: '1 run = 1 change' },
        { t: 'Small first', p: 'Start fine-tuning on a smaller model (about 8B) to learn fast, then repeat the recipe on the bigger one.', f: '8B: 1 h · 27B: 4 h' },
        { t: 'Notebook', p: 'Keep a notebook of every experiment: data version, settings, score.', f: 'data · settings · score' },
      ],
      controls: ['Change a setting', '<b>Run experiment</b>', 'Read the notebook'],
      proved: 'You ran the experiment loop from "tips from practice": change one setting, re-run the test set, write it down. You learned the recipe cheaply on the 8B model, then repeated it on the 27B. That is how real fine-tuning work is done, and it is why the 30-question test set matters.',
      tip: 'Exploring on the 27B costs 4 hours a run, so you can afford only four. Find the best recipe on the 8B first, one setting at a time, then switch only the model.',
      quiz: Q('t-onechange'),
      start(api) {
        clearWorld();
        const st = api.state;
        st.cfg = { size: '8B', data: 'v1', lr: 'high', ep: 1, rank: 8 };
        st.last = { ...st.cfg }; st.hours = BUDGET; st.runs = []; st.multi = 0; st.busy = false;
        st.runs.push({ n: 0, cfg: { ...st.cfg }, s: score(st.cfg), note: 'starting recipe', cost: 0 });
        labels(['GPU hours left', 'Runs', 'Best on 8B', 'Best on 27B']);
        showScore(st.runs[0].s);
        oc.target.set(0, 3.2, -1); oc.dist = 15;
        panel.innerHTML = '';
        const rows = h('div', { class: 'stack' });
        st.segs = {};
        for (const k of Object.keys(OPTS)) {
          const seg = h('div', { class: 'ac-seg' });
          OPTS[k].forEach(([v, l]) => {
            const b = h('button', { type: 'button', class: st.cfg[k] === v ? 'on' : '', onclick: () => { if (st.busy) return; st.cfg[k] = v; [...seg.children].forEach((c) => c.classList.toggle('on', c === b)); AC.audio.click(); preview(); } }, l);
            seg.appendChild(b);
          });
          st.segs[k] = seg;
          rows.appendChild(h('div', { class: 'row2' }, h('span', {}, NAMES[k]), seg));
        }
        st.prev = h('span', { class: 'dim', style: { fontSize: '0.82rem' } });
        st.runBtn = h('button', { class: 'ac-btn', type: 'button', onclick: () => run() }, 'Run experiment');
        panel.append(h('div', { class: 'q' }, h('small', {}, 'LoRA recipe'), 'Change a setting, then run'), rows, h('div', { class: 'ac-actions', style: { justifyContent: 'space-between', alignItems: 'center' } }, st.prev, st.runBtn));
        const diff = () => Object.keys(st.cfg).filter((k) => st.cfg[k] !== st.last[k]);
        function preview() { const d = diff(); st.prev.textContent = d.length === 0 ? 'Nothing changed yet' : d.length === 1 ? 'Testing: ' + NAMES[d[0]] : '⚠ ' + d.length + ' changes at once'; st.prev.style.color = d.length > 1 ? 'var(--amber)' : ''; }
        function notebook() {
          const best = (sz) => { const r = st.runs.filter((x) => x.cfg.size === sz); return r.length ? Math.max(...r.map((x) => x.s)) + ' / 30' : '--'; };
          hud.set('a', st.hours + ' h', st.hours < 4 ? 'warn' : ''); hud.set('b', String(st.runs.length - 1)); hud.set('c', best('8B')); hud.set('d', best('27B'));
          hud.setMeter('m', st.hours / BUDGET, st.hours < 4 ? 'var(--amber)' : 'var(--cyan)');
          hud.setFormula('f', st.runs.slice(-7).map((r) => '#' + r.n + ' ' + r.cfg.size + ' ' + r.cfg.data + ' ' + r.cfg.lr + ' e' + r.cfg.ep + ' r' + r.cfg.rank + ' → ' + r.s + (r.note ? '  ' + r.note : '')).join('\n'));
        }
        function run() {
          if (st.busy) return;
          const d = diff();
          if (!d.length) return AC.ui.toast('Change one setting first', 'var(--amber)');
          const cost = st.cfg.size === '8B' ? 1 : 4;
          if (cost > st.hours) return AC.ui.toast('Not enough GPU hours for a ' + st.cfg.size + ' run', 'var(--red)');
          st.hours -= cost;
          st.busy = true; st.runT = 0; st.cost = cost;
          const s = score(st.cfg);
          const note = d.length > 1 ? '⚠ ' + d.length + ' changes' : 'changed ' + NAMES[d[0]].toLowerCase();
          if (d.length > 1) { st.multi++; AC.fact(d.length + ' changes in one run', 'You changed ' + d.map((k) => NAMES[k].toLowerCase()).join(' and ') + ' together. If the score moves, you cannot tell which change did it.', { tag: 'Notebook', color: 'var(--amber)' }); }
          st.pending = { n: st.runs.length, cfg: { ...st.cfg }, s, note, cost };
          st.last = { ...st.cfg };
          preview();
          AC.audio.whoosh();
        }
        st.run = run; st.notebook = notebook;
        notebook(); preview();
      },
      update(dt, api) {
        const st = api.state;
        if (!st.busy) return;
        st.runT += dt;
        const dur = st.cost === 1 ? 1.2 : 2.4;
        api.progress(st.runT / dur, 'Training run #' + st.pending.n);
        coreMat.emissiveIntensity = 0.6 + Math.sin(st.runT * 14) * 0.4;
        if (st.runT < dur) return;
        st.busy = false;
        st.runs.push(st.pending);
        const r = st.pending, prev = st.runs[st.runs.length - 2];
        showScore(r.s);
        pulse(r.s > prev.s ? 0x4be38a : r.s < prev.s ? 0xff5a4f : 0xffb547);
        r.s > prev.s ? AC.audio.good() : AC.audio.bad();
        st.notebook();
        api.progress(0, 'Objective');
        if (r.cfg.size === '27B' && r.s >= 28) {
          const used = BUDGET - st.hours;
          return api.win(st.multi === 0 && used <= 14 ? 3 : st.multi <= 1 ? 2 : 1, 'Run #' + r.n + ' on the 27B scored ' + r.s + ' / 30 using ' + used + ' of 16 GPU hours, with ' + st.multi + ' multi-change run' + (st.multi === 1 ? '.' : 's.'));
        }
        if (st.hours < 1) api.fail('Out of GPU hours. The best 27B score was ' + (Math.max(0, ...st.runs.filter((x) => x.cfg.size === '27B').map((x) => x.s)) || 'none') + '.');
      },
    };
  }

  // ---------------------------------------------------------------- mission 3: preference pairs (DPO)
  const PAIRS = [
    ['Can the prototype do long coding runs like Claude?', 'Not yet. It is solid on routine tasks but weaker on long runs. Let me show you what it does well.', 'Yes, it is exactly as good as the best closed models.', 'Be honest about the quality gap: do not promise Claude-level agent work from the prototype.'],
    ['Delete the old build folder.', 'This deletes files, so I need your approval first. Run rm -rf build/ ?', 'Done, I deleted it.', 'Delete needs human approval.'],
    ['Can we sell images made with FLUX.2 [dev]?', 'Only with a paid licence from Black Forest Labs: FLUX.2 [dev] is non-commercial.', 'Yes, all open models are free to sell.', 'FLUX.2 [dev] is non-commercial without a paid licence.'],
    ['Hi!', 'Hi! What are we building today? {"emotion": "happy", "intensity": 0.6, "look": "user"}', 'Hi! What are we building today?', 'Every reply needs the emotion tag.'],
    ['What fits on a 24GB card?', 'Qwen3.8-27B at 4-bit: about 16–19GB.', 'A 70B model at FP8.', '70B at FP8 is about 72GB: that needs an 80GB H100.'],
    ['Clone my teacher\'s voice for a prank.', 'I can only clone a voice with the speaker\'s permission.', 'Sure, send me a recording.', 'Only clone voices with the speaker\'s permission.'],
    ['The test fails: expected 5, got 6.', 'Line 3 adds 1 by mistake. I\'ll fix the code and run the tests again.', 'I\'ll change the test to expect 6.', 'Fix the cause, not the test.'],
    ['Use my real server password to deploy.', 'I work with test values in the sandbox, and deploys need your approval.', 'OK, paste the password here.', 'Keep keys and passwords out of the sandbox.'],
    ['How do I know my fine-tune helped?', 'Re-run your 30-question test set and compare the scores.', 'If it feels smarter, it worked.', 'Evaluation: never skip the test set.'],
    ['Which model should I fine-tune first?', 'Start on a smaller model (about 8B) to learn fast, then repeat on the bigger one.', 'Always start on the biggest model.', 'Tips from practice: learn on about 8B first.'],
    ['Is the face an AI model?', 'No. It is animation code, driven by emotion tags from the brain.', 'Yes, it needs its own GPU.', 'The face is animation code, not an AI model.'],
    ['How much data do I need?', 'A few hundred excellent examples often beat thousands of poor ones.', 'As much as possible; quality does not matter.', 'Quality beats quantity.'],
  ];
  function dpoMission() {
    return {
      id: 'dpo', title: 'Prefer the Better Answer',
      objective: 'Label 12 answer pairs from your test failures; the model must prefer good answers ≥ 83%',
      story: 'Stage 5: preference training. You collected pairs of answers to questions your model got wrong. For each pair, choose the better answer. DPO then nudges the model toward the chosen answer and away from the rejected one.',
      learn: [
        { t: 'Pairs', p: 'Each training example is a prompt, a chosen answer and a rejected answer.', f: 'prompt · chosen · rejected' },
        { t: 'From failures', p: 'Use pairs of good and bad answers from your own test failures.', f: 'test failures → DPO data' },
        { t: 'Labels matter', p: 'A wrong label pushes the model the wrong way.', f: 'stage 5: DPO' },
      ],
      controls: ['<kbd>1</kbd> or <kbd>2</kbd> choose the better answer'],
      proved: 'You built a DPO dataset: chosen versus rejected answers, taken from real failures. The answers you preferred are the rules from your notes: be honest about limits, ask before risky commands, respect licences and consent, fix causes, and always measure on the test set.',
      tip: 'Pick the answer that follows the notes: honest about limits, asks before risky commands, respects licences and permissions, and fixes the real cause.',
      quiz: Q('t-dpo'),
      start(api) {
        clearWorld();
        const st = api.state;
        st.pairs = shuffle(PAIRS).map(([q, good, bad, why]) => { const flip = Math.random() < 0.5; return { q, a: flip ? bad : good, b: flip ? good : bad, right: flip ? 1 : 0, why }; });
        st.i = 0; st.right = 0; st.wrong = 0; st.busy = false;
        labels(['Pair', 'Labelled right', 'Labelled wrong', 'Prefers good']);
        hud.set('a', '1 / 12'); hud.set('b', '0'); hud.set('c', '0'); hud.set('d', '50 %');
        hud.setFormula('f', 'P(prefers good) = 50% + 50% × (right − wrong) ÷ 12');
        showScore(15);
        oc.target.set(0, 2.4, 0); oc.dist = 16;
        panel.innerHTML = '';
        const qEl = h('div', { class: 'q' });
        const opts = h('div', { class: 'opts', style: { gridTemplateColumns: '1fr 1fr' } });
        panel.append(qEl, opts);
        let tiles = [];
        function show() {
          const p = st.pairs[st.i];
          qEl.innerHTML = '';
          qEl.append(h('small', {}, 'Pair ' + (st.i + 1) + ' of 12 · prompt'), p.q);
          opts.innerHTML = '';
          [p.a, p.b].forEach((t, j) => opts.appendChild(h('button', { type: 'button', style: { textAlign: 'left' }, onclick: () => pick(j) }, h('small', {}, 'key ' + (j + 1)), t)));
          tiles.forEach((m) => world.remove(m));
          tiles = [p.a, p.b].map((t, j) => { const m = card([(j + 1) + ') ' + t]); m.position.set(j ? 4.3 : -4.3, 2.6, 2); world.add(m); return m; });
          hud.set('a', st.i + 1 + ' / 12');
        }
        function pick(j) {
          if (st.busy || st.i >= 12) return;
          const p = st.pairs[st.i];
          const ok = j === p.right;
          st.busy = true;
          if (ok) { st.right++; AC.audio.good(); } else { st.wrong++; AC.audio.bad(); AC.fact('Wrong label', p.why + ' Now the model is pushed toward the worse answer.', { tag: 'Preference data', color: 'var(--amber)' }); }
          [...opts.children].forEach((b, k) => { b.disabled = true; b.classList.add(k === p.right ? 'right' : k === j ? 'wrong' : 'x'); });
          const chosen = tiles[j], other = tiles[1 - j];
          sendTile(chosen, core.position, 0.6, () => { world.remove(chosen); pulse(ok ? 0x4be38a : 0xff5a4f); });
          sendTile(other, new THREE.Vector3(other.position.x * 2, -1, 2), 0.6, () => world.remove(other));
          tiles = [];
          const pref = 0.5 + (0.5 * (st.right - st.wrong)) / 12;
          hud.set('b', String(st.right)); hud.set('c', String(st.wrong), st.wrong ? 'warn' : ''); hud.set('d', Math.round(pref * 100) + ' %');
          hud.setMeter('m', pref, pref >= 0.83 ? 'var(--green)' : 'var(--amber)');
          showScore(pref * 30);
          st.i++;
          api.progress(st.i / 12);
          setTimeout(() => {
            if (MR.api.state !== st) return;
            st.busy = false;
            if (st.i < 12) return show();
            if (pref >= 0.83) api.win(st.wrong === 0 ? 3 : st.wrong === 1 ? 2 : 1, 'After DPO the model prefers the good answer ' + Math.round(pref * 100) + '% of the time (' + st.right + ' right labels, ' + st.wrong + ' wrong).');
            else api.fail('The model prefers the good answer only ' + Math.round(pref * 100) + '% of the time: ' + st.wrong + ' pairs were labelled the wrong way round.');
          }, 900);
        }
        st.pick = pick;
        show();
      },
    };
  }

  const missions = [sftMission(), expMission(), dpoMission()];
  const MR = AC.missions({ game: 'tune', week: 7, list: missions, onSelect() { fly.forEach((f) => world.remove(f.m)); fly.length = 0; } });
  window.addEventListener('keydown', (e) => {
    if (AC.paused || !MR.current || MR.done || e.repeat) return;
    const st = MR.api.state, id = MR.current.id;
    if (id === 'sft') {
      if (st.phase === 'sort') { if (e.code === 'ArrowRight' || e.code === 'KeyD') st.decide(true); if (e.code === 'ArrowLeft' || e.code === 'KeyA') st.decide(false); }
      if (st.phase === 'choose') { if (e.code === 'Digit1') st.train(false); if (e.code === 'Digit2') st.train(true); }
    }
    if (id === 'experiment' && e.code === 'Enter') st.run();
    if (id === 'dpo') { if (e.code === 'Digit1') st.pick(0); if (e.code === 'Digit2') st.pick(1); }
  });

  AC.ui.tools([{ label: 'Reset view', onclick: () => Object.assign(oc, { theta: 0, phi: 1.18 }) }]);
  function help() {
    AC.ui.card({ eyebrow: 'Fine-Tune Lab', title: 'How to play', body: [
      'The glowing core is your model. The 30 cells behind it are your 30-question test set: lit cells are questions it gets right.',
      'Every mission ends by measuring on the test set, because "measure whether it really improved" is a stage you never skip.',
      'Drag to orbit, scroll or pinch to zoom.',
    ] });
  }

  S.onFrame((dt, time) => {
    core.rotation.y += dt * 0.5;
    core.rotation.x += dt * 0.2;
    rings.forEach((r, i) => { r.rotation.z += dt * (0.3 + i * 0.2); });
    coreFlash = Math.max(0, coreFlash - dt * 1.2);
    coreMat.color.set(TEAL).lerp(coreCol, coreFlash);
    coreMat.emissive.copy(coreMat.color);
    if (cellsShown !== cellsOn) {
      cellsShown = cellsOn;
      cells.forEach((c, i) => { const on = i < cellsOn; c.material.color.set(on ? 0x4be38a : 0x1d2a40); c.material.emissive.set(on ? 0x4be38a : 0x1d2a40); c.material.emissiveIntensity = on ? 0.8 : 0.3; });
    }
    for (let i = fly.length - 1; i >= 0; i--) {
      const f = fly[i];
      f.t += dt;
      const k = clamp(f.t / f.dur, 0, 1);
      f.m.position.lerpVectors(f.from, f.to, k);
      f.m.scale.setScalar(1 - k * 0.8);
      if (k >= 1) { fly.splice(i, 1); f.then && f.then(); }
    }
    MR.update(dt);
    oc.update(dt);
  });
  window.GAME = { MR, score, accuracy, PAIRS };
  S.start();
  MR.begin();
})();
