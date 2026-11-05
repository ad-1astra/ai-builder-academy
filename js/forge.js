/* Model Forge — Module 6 · How AI is made, stages 1–3: data, tokenizer, pre-training.
   Mission 3 trains a REAL tiny language model in the browser (3 characters in → next character out,
   about 2,700 parameters). The loss you see is the real cross-entropy; the learning rate you pick decides
   whether it learns, crawls, or explodes. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  AC.boot({ game: 'forge', week: 6, topic: 'Data, tokens, pre-training', title: 'Model Forge', help: () => help() });
  const S = AC.scene({ fov: 45, near: 0.1, far: 300, background: 0x070a14 });
  const { scene, camera, renderer } = S;
  scene.fog = new THREE.Fog(0x070a14, 30, 80);
  AC.lights(scene, { sky: 0xd6e6ff, ground: 0x141018, hemi: 0.7, sun: 0.75, dir: [6, 18, 12] });
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 17, min: 7, max: 40, phi: 1.12, theta: 0, minPhi: 0.4, maxPhi: 1.5, target: new THREE.Vector3(0, 1.6, 0) });

  const TEAL = 0x2fe0cf, ORANGE = 0xff8a3d;
  const glow = (c, e = 0.7) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.4 });
  const mat = (c, r = 0.7, m = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0x0a0d18, 1, 0));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(80, 80, 0x2a2244, 0x16142a);
  grid.position.y = 0.01;
  scene.add(grid);
  const world = new THREE.Group(); // per-mission props
  scene.add(world);
  const clearWorld = () => { while (world.children.length) world.remove(world.children[0]); };

  // text tile: a box with the text printed on its front
  function tile(text, { w = null, hgt = 0.7, color = '#e9f0f7', bg = '#15283f', edge = 0x2a4a6a, fontPx = 40, depth = 0.25 } = {}) {
    const c = document.createElement('canvas');
    const g = c.getContext('2d');
    g.font = 'bold ' + fontPx + 'px "B612 Mono", Consolas, monospace';
    const tw = Math.ceil(g.measureText(text).width) + 24;
    c.width = Math.max(64, tw); c.height = 64;
    g.fillStyle = bg; g.fillRect(0, 0, c.width, 64);
    g.font = 'bold ' + fontPx + 'px "B612 Mono", Consolas, monospace';
    g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, c.width / 2, 34);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const width = w || (hgt * c.width) / 64;
    const side = new THREE.MeshStandardMaterial({ color: edge, roughness: 0.6 });
    const front = new THREE.MeshBasicMaterial({ map: tex });
    const m = new THREE.Mesh(new THREE.BoxGeometry(width, hgt, depth), [side, side, side, side, front, side]);
    m.userData.width = width;
    return m;
  }

  // ---------------------------------------------------------------- panel + HUD
  const panel = h('div', { class: 'opt-panel ac-panel' });
  AC.root().appendChild(panel);
  const hud = AC.ui.hud();
  hud.section('Forge').row('a', '--', '--').row('b', '--', '--').row('c', '--', '--').row('d', '--', '--').meter('m');
  const graphCanvas = hud.canvas('lossGraph');
  const graph = new AC.Graph(graphCanvas, { xMin: 0, xMax: 400, yMin: 0, yMax: 4, xLabel: 'steps', yLabel: 'loss', xTicks: 4, yTicks: 4 });
  hud.section('Rule').formula('f', '');
  const labels = (arr) => [...hud.el.querySelectorAll('.ac-row .k')].forEach((k, i) => { if (arr[i] != null) k.textContent = arr[i]; });
  const Q = (id) => AC.QUESTIONS.find((q) => q.id === id);
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ---------------------------------------------------------------- mission 1: clean the data
  const GOOD = [
    'A servo motor turns to a set angle and holds it.',
    'def area(r): return 3.14 * r * r',
    'Ohm\'s law: voltage = current × resistance.',
    'The ultrasonic sensor measures distance with sound.',
    'for i in range(5): print(i)',
    'A robot arm has joints, links and an end effector.',
    'Week 3: wire the LED to pin 13 through a resistor.',
    'PWM controls motor speed by switching power on and off.',
    'if distance < 20: stop_motors()',
    'Lesson 2 quiz: what does a capacitor store?',
    'The gateway routes each request to the right model.',
    'Solar panels turn sunlight into electricity.',
    'An H-bridge lets a motor spin both ways.',
    'Line followers use two light sensors under the robot.',
  ];
  const JUNK = [
    ['<div><div><span></span></div></div>', 'leftover web page markup'],
    ['asdfgh jkl qwerty zxcv', 'keyboard mashing'],
    ['BUY CHEAP FOLLOWERS NOW!!! click here', 'spam'],
    ['(empty)', 'an empty sample'],
    ['Lorem ipsum dolor sit amet, consectetur', 'placeholder text'],
    ['Ã©Ã¨ â€™ Ã Â¢â‚¬', 'broken text encoding'],
    ['Cookie settings | Accept all | Privacy | Terms', 'website boilerplate'],
  ];
  const hash = (s) => { let x = 0x811c9dc5; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 0x01000193) >>> 0; } return ('00000' + x.toString(16)).slice(-6); };
  function buildStream() {
    const goods = shuffle(GOOD).map((t) => ({ t, kind: 'good' }));
    const dupSrc = shuffle(GOOD).slice(0, 5);
    const items = goods.concat(JUNK.map(([t, why]) => ({ t, kind: 'junk', why })));
    let s = shuffle(items);
    // each duplicate goes in a few places after its original, so it can be spotted
    for (const d of dupSrc) {
      const at = s.findIndex((x) => x.t === d);
      const pos = Math.min(s.length, at + 3 + ((Math.random() * 6) | 0));
      s.splice(pos, 0, { t: d, kind: 'dup' });
    }
    return s.map((x) => ({ ...x, hash: hash(x.t) }));
  }
  function cleanMission() {
    return {
      id: 'clean', title: 'Clean the Data',
      objective: 'Keep the clean, unique samples; drop junk and duplicates',
      story: 'Stage 1 is data. Your hub\'s notes, code and curriculum are rolling in, mixed with junk scraped from the web and copies of samples you already have. Keep only what should teach your model.',
      learn: [
        { t: 'Remove junk', p: 'Spam, markup, placeholder text, broken encoding and empty samples teach the model nothing useful.', f: 'junk in → junk out' },
        { t: 'Remove duplicates', p: 'A sample seen twice gets learned twice as hard. Compare a hash (a short fingerprint of the text) with the ones you kept.', f: 'same text → same hash' },
        { t: 'Quality beats quantity', p: 'A few hundred excellent examples often beat thousands of poor ones.', f: 'clean > big' },
      ],
      controls: ['<kbd>→</kbd> or <kbd>D</kbd> keep', '<kbd>←</kbd> or <kbd>A</kbd> drop'],
      proved: 'You ran stage 1 by hand: collect, clean, remove duplicates. Real pipelines do the same with filters and hashing at a much bigger scale. A clean dataset from your own docs, code and curriculum is the first thing to build.',
      tip: 'Before you keep a sample, check its hash against the "Kept hashes" list in the HUD. If it is already there, it is a duplicate.',
      quiz: Q('d-dup'),
      start(api) {
        clearWorld();
        const st = api.state;
        st.items = buildStream(); st.i = 0; st.keptGood = 0; st.keptBad = 0; st.dropGood = 0; st.dropBad = 0; st.kept = []; st.cur = null; st.stackH = 0;
        graphCanvas.style.display = 'none';
        labels(['Sample', 'Kept', 'Dropped', 'Kept hashes']);
        hud.set('a', '1 / ' + st.items.length); hud.set('b', '0'); hud.set('c', '0'); hud.set('d', '');
        hud.setFormula('f', 'kept hashes:\n(none yet)');
        oc.target.set(0, 1.4, 0); oc.dist = 15;
        // belt, keep pile, junk bin
        const belt = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 2.4), mat(0x1b2533));
        belt.position.set(0, 0.6, 0);
        const keep = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 0.4, 32), glow(0x4be38a, 0.35));
        keep.position.set(9.2, 0.2, 0);
        const bin = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.2, 1.6, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0xff5a4f, emissive: 0x5a1410, side: THREE.DoubleSide }));
        bin.position.set(-9.2, 0.8, 0);
        const kl = AC.textSprite('DATASET →', { color: '#4be38a', size: 0.5 }); kl.position.set(9.2, 2.6, 0);
        const bl = AC.textSprite('← DROP', { color: '#ff5a4f', size: 0.5 }); bl.position.set(-9.2, 2.6, 0);
        world.add(belt, keep, bin, kl, bl);
        panel.innerHTML = '';
        st.qEl = h('div', { class: 'q' });
        panel.append(st.qEl, h('div', { class: 'opts' },
          h('button', { type: 'button', onclick: () => decide(false) }, h('small', {}, 'key ←'), 'Drop'),
          h('button', { type: 'button', onclick: () => decide(true) }, h('small', {}, 'key →'), 'Keep')));
        function decide(keepIt) {
          const c = st.cur;
          if (!c || c.dec != null || c.phase !== 'wait') return;
          c.dec = keepIt; c.phase = 'out'; c.t = 0; c.from = c.m.position.clone();
          AC.audio.click();
          const it = c.item, good = it.kind === 'good';
          if (keepIt) { st.kept.push(it.hash); if (good) st.keptGood++; else st.keptBad++; }
          else if (good) st.dropGood++; else st.dropBad++;
          if (keepIt && !good) AC.fact(it.kind === 'dup' ? 'Duplicate kept' : 'Junk kept', it.kind === 'dup' ? 'Hash ' + it.hash + ' was already in your dataset: this exact text is in there once already.' : 'That was ' + it.why + '. It would teach the model junk.', { tag: 'Data quality', color: 'var(--amber)' });
          if (!keepIt && good) AC.fact('Good sample dropped', 'That one was clean and unique: real material from your docs or code.', { tag: 'Data quality', color: 'var(--amber)', ms: 6000 });
          hud.set('b', String(st.kept.length)); hud.set('c', String(st.dropGood + st.dropBad));
          hud.setFormula('f', 'kept hashes:\n' + (st.kept.length ? st.kept.map((x, i) => x + ((i + 1) % 4 ? '  ' : '\n')).join('') : '(none yet)'));
        }
        st.decide = decide;
      },
      update(dt, api) {
        const st = api.state, N = st.items.length;
        if (!st.cur) {
          if (st.i >= N) return;
          const it = st.items[st.i];
          const m = tile(it.t.length > 44 ? it.t.slice(0, 43) + '…' : it.t, { hgt: 0.62, fontPx: 30, bg: '#0f1d2e' });
          const hl = AC.textSprite('#' + it.hash, { color: '#ff70d8', bg: null, size: 0.42 });
          hl.position.y = 0.62;
          m.add(hl);
          m.position.set(-7.5, 1.1, 0);
          world.add(m);
          st.cur = { item: it, m, t: 0, phase: 'in', dec: null };
          st.qEl.innerHTML = '';
          st.qEl.append(h('small', {}, 'Sample ' + (st.i + 1) + ' of ' + N + ' · hash ' + it.hash), it.t);
          hud.set('a', st.i + 1 + ' / ' + N);
        }
        const c = st.cur;
        c.t += dt;
        if (c.phase === 'in') {
          c.m.position.x = -7.5 + clamp(c.t / 0.6, 0, 1) * 7.5;
          if (c.t >= 0.6) c.phase = 'wait';
        } else if (c.phase === 'out') {
          const k = clamp(c.t / 0.55, 0, 1);
          const tx = c.dec ? 9.2 : -9.2, ty = c.dec ? 0.5 + st.stackH : 0.6;
          c.m.position.x = c.from.x + (tx - c.from.x) * k;
          c.m.position.y = c.from.y + (ty - c.from.y) * k + Math.sin(k * Math.PI) * 1.4;
          c.m.rotation.x = c.dec ? -k * Math.PI / 2 : k * 2;
          if (k >= 1) {
            if (c.dec) { st.stackH += 0.1; c.m.scale.set(0.5, 0.5, 0.5); } else world.remove(c.m);
            st.cur = null; st.i++;
            api.progress(st.i / N);
            if (st.i >= N) {
              const errs = st.keptBad + st.dropGood;
              const quality = Math.round((100 * st.keptGood) / Math.max(1, st.keptGood + st.keptBad));
              hud.setMeter('m', quality / 100);
              if (st.keptGood >= 12 && st.keptBad <= 1) api.win(errs === 0 ? 3 : errs <= 2 ? 2 : 1, 'Dataset: ' + st.keptGood + ' clean samples, ' + quality + '% quality (' + st.keptBad + ' bad kept, ' + st.dropGood + ' good dropped).');
              else api.fail('Dataset: ' + st.keptGood + ' clean samples and ' + st.keptBad + ' bad ones (' + quality + '% quality). You need at least 12 clean and at most 1 bad.');
            }
          }
        }
      },
    };
  }

  // ---------------------------------------------------------------- mission 2: train a tokenizer (byte-pair merges)
  const WORDS = [['train', 5], ['trainer', 2], ['training', 4], ['token', 4], ['tokens', 3], ['model', 5], ['models', 2]];
  function tokMission() {
    return {
      id: 'tokenize', title: 'Train a Tokenizer',
      objective: 'Make 6 merges, each time picking the most frequent pair of tokens',
      story: 'Stage 2: text is cut into pieces the model can count, called tokens. A tokenizer starts with single letters and learns by merging the pair that appears most often. Count carefully: every word appears as many times as its ×number.',
      learn: [
        { t: 'Tokens', p: 'Models do not read letters or words; they read tokens, pieces of text with an ID number.', f: 'text → tokens → IDs' },
        { t: 'Merge rule', p: 'Count every pair of neighbouring tokens across the corpus, merge the most frequent pair into one token, repeat.', f: 'count = Σ (pair in word) × word count' },
        { t: 'Why', p: 'Common pieces become one token, so the same text needs fewer tokens.', f: 'fewer tokens = cheaper, longer context' },
      ],
      controls: ['<kbd>1</kbd>…<kbd>4</kbd> or tap the pair to merge'],
      proved: 'You trained a byte-pair tokenizer by hand: always merge the most frequent pair. Picking the most frequent pair every time turns 146 single letters into 84 tokens in 6 merges, and new words split into learned pieces. Real tokenizers do the same on your whole dataset, for tens of thousands of merges.',
      tip: 'Count the pair inside each word and multiply by the word\'s count. "in" appears once in train (×5), once in trainer (×2) and twice in training (×4): 5 + 2 + 8 = 15.',
      quiz: Q('d-tok'),
      start(api) {
        clearWorld();
        const st = api.state;
        st.rows = WORDS.map(([w, n]) => ({ w, n, toks: [...w] }));
        st.merges = []; st.right = 0; st.step = 0; st.busy = false;
        graphCanvas.style.display = 'none';
        labels(['Merge', 'Right picks', 'Total tokens', 'Vocabulary']);
        hud.set('b', '0'); hud.setMeter('m', 0);
        oc.target.set(0, 2.6, 0); oc.dist = 15; oc.phi = 1.25;
        const total = () => st.rows.reduce((s, r) => s + r.toks.length * r.n, 0);
        const vocab = () => new Set(st.rows.flatMap((r) => r.toks)).size;
        const pairs = () => { const m = new Map(); for (const r of st.rows) for (let i = 0; i < r.toks.length - 1; i++) { const k = r.toks[i] + '|' + r.toks[i + 1]; m.set(k, (m.get(k) || 0) + r.n); } return [...m.entries()].sort((a, b) => b[1] - a[1]); };
        const meshes = [];
        function draw(pop) {
          meshes.forEach((m) => world.remove(m)); meshes.length = 0;
          st.rows.forEach((r, ri) => {
            const y = 4.6 - ri * 0.82;
            const cnt = tile('×' + r.n, { hgt: 0.55, fontPx: 34, bg: '#2a1a3a', color: '#ff70d8', edge: 0x4a2a5a });
            cnt.position.set(-5.2, y, 0);
            world.add(cnt); meshes.push(cnt);
            let x = -4.4;
            r.toks.forEach((t) => {
              const merged = pop && t === pop;
              const m = tile(t, { hgt: 0.6, fontPx: 38, bg: merged ? '#0f3a36' : t.length > 1 ? '#13304a' : '#15283f', color: merged ? '#2fe0cf' : '#e9f0f7', edge: t.length > 1 ? 0x2fe0cf : 0x2a4a6a, w: 0.34 + t.length * 0.36 });
              m.position.set(x + m.userData.width / 2, y, 0);
              if (merged) m.userData.pop = 0;
              x += m.userData.width + 0.08;
              world.add(m); meshes.push(m);
            });
          });
          hud.set('c', String(total())); hud.set('d', vocab() + ' token types');
        }
        st.meshes = meshes;
        panel.innerHTML = '';
        const qEl = h('div', { class: 'q' });
        const opts = h('div', { class: 'opts' });
        const corpus = h('div', { class: 'dim mono', style: { fontSize: '0.78rem', textAlign: 'center' } }, WORDS.map(([w, n]) => w + ' ×' + n).join(' · '));
        panel.append(qEl, corpus, opts);
        function offer() {
          const ps = pairs();
          const max = ps[0][1];
          const best = ps[0];
          const lower = ps.filter(([, v]) => v < max);
          // distractors: strictly less frequent pairs, different counts first so the choice is about counting
          const picks = [];
          for (const p of lower) { if (picks.length >= 3) break; if (!picks.some((q) => q[1] === p[1])) picks.push(p); }
          for (const p of lower) { if (picks.length >= 3) break; if (!picks.includes(p)) picks.push(p); }
          st.cands = shuffle([best, ...picks.slice(0, 3)]);
          st.max = max;
          qEl.innerHTML = '';
          qEl.append(h('small', {}, 'Merge ' + (st.step + 1) + ' of 6'), 'Which pair appears most often?');
          opts.innerHTML = '';
          st.cands.forEach(([k], i) => { const [a, b] = k.split('|'); opts.appendChild(h('button', { type: 'button', onclick: () => pick(i) }, h('small', {}, 'key ' + (i + 1)), a + ' + ' + b)); });
          hud.set('a', st.step + 1 + ' / 6');
        }
        function pick(i) {
          if (st.busy || st.step >= 6 || !st.cands[i]) return;
          const [k, v] = st.cands[i];
          const right = v === st.max;
          [...opts.children].forEach((b, j) => { b.disabled = true; b.appendChild(h('small', {}, '× ' + st.cands[j][1])); if (st.cands[j][1] === st.max) b.classList.add('right'); else if (j === i) b.classList.add('wrong'); });
          if (right) { st.right++; AC.audio.good(); } else { AC.audio.bad(); const best = st.cands.find((c) => c[1] === st.max); AC.fact('Not the most frequent', k.replace('|', ' + ') + ' appears ' + v + ' times, but ' + best[0].replace('|', ' + ') + ' appears ' + st.max + ' times. Merging it would save ' + st.max + ' tokens instead of ' + v + '.', { tag: 'Count again', color: 'var(--amber)' }); }
          hud.set('b', String(st.right));
          const [a, b] = k.split('|');
          for (const r of st.rows) { const t = []; for (let j = 0; j < r.toks.length; j++) { if (j < r.toks.length - 1 && r.toks[j] === a && r.toks[j + 1] === b) { t.push(a + b); j++; } else t.push(r.toks[j]); } r.toks = t; }
          st.merges.push([a, b]);
          st.step++;
          st.busy = true;
          draw(a + b);
          api.progress(st.step / 6);
          setTimeout(() => {
            if (MR.api.state !== st) return;
            st.busy = false;
            if (st.step < 6) return offer();
            const split = (w) => { let t = [...w]; for (const [x, y] of st.merges) { const o = []; for (let j = 0; j < t.length; j++) { if (j < t.length - 1 && t[j] === x && t[j + 1] === y) { o.push(x + y); j++; } else o.push(t[j]); } t = o; } return t.join(' · '); };
            AC.fact('New words, learned pieces', 'retraining → ' + split('retraining') + '   ·   tokenizer → ' + split('tokenizer'), { tag: 'Inspect the splits', color: 'var(--cyan)', ms: 14000 });
            if (st.right < 4) return api.fail(st.right + ' of 6 merges used the most frequent pair. You need 4.');
            api.win(st.right === 6 ? 3 : st.right === 5 ? 2 : 1, st.right + ' of 6 merges were the most frequent pair. ' + total() + ' tokens, down from 146.');
          }, 1300);
        }
        st.pick = pick;
        hud.setFormula('f', 'pair count = Σ (times in word × word count)\ntokens saved by a merge = its pair count');
        draw();
        offer();
      },
      update(dt, api) {
        for (const m of api.state.meshes || []) if (m.userData.pop != null) { m.userData.pop = Math.min(1, m.userData.pop + dt * 3); const s = 1 + Math.sin(m.userData.pop * Math.PI) * 0.35; m.scale.set(s, s, s); }
      },
    };
  }

  // ---------------------------------------------------------------- mission 3: pre-train a real tiny model
  const CORPUS = 'the brain is a language model. the eyes are a vision model. the hands are a coding agent. the artist is an image model. the voice can listen and speak. the face shows how the model feels. a gateway sends each request to the right model. the model reads the text and predicts the next token. the next token is a small piece of text. the model learns from data. clean data makes a better model. the model learns to predict the next token. then it learns to follow instructions. then it learns which answer is better. test the model on your own questions. change one thing at a time and test again. keep a notebook of every test. the face is not a model, it is animation code. the eyes move with springs. the face never snaps. the agent plans, runs a command, reads the output, and fixes the code. the agent works in a sandbox. you approve every risky command. the model runs on a gpu. a small model fits on one card. a big model needs many cards. shrink the weights to four bits so the model fits. serve the model behind the gateway. the brain thinks, the eyes see, the hands work, the artist draws, the voice speaks, and the face smiles.';
  // 3 previous characters → 8-number embeddings → 48 tanh units → softmax over the next character. Plain SGD.
  function TinyLM(text, seed) {
    const C = 3, E = 8, H = 48;
    let s = seed >>> 0;
    const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const chars = [...new Set(text)].sort();
    const V = chars.length, X = C * E;
    const ix = {}; chars.forEach((c, i) => (ix[c] = i));
    const data = [...text].map((c) => ix[c]);
    const emb = new Float64Array(V * E).map(() => gauss() * 0.5);
    const W1 = new Float64Array(H * X).map(() => gauss() / Math.sqrt(X));
    const b1 = new Float64Array(H);
    const W2 = new Float64Array(V * H).map(() => (gauss() / Math.sqrt(H)) * 0.3);
    const b2 = new Float64Array(V);
    const x = new Float64Array(X), hh = new Float64Array(H), lg = new Float64Array(V), p = new Float64Array(V);
    function forward(ci) {
      for (let c = 0; c < C; c++) for (let e = 0; e < E; e++) x[c * E + e] = emb[ci[c] * E + e];
      for (let j = 0; j < H; j++) { let a = b1[j]; for (let k = 0; k < X; k++) a += W1[j * X + k] * x[k]; hh[j] = Math.tanh(a); }
      let m = -Infinity;
      for (let v = 0; v < V; v++) { let a = b2[v]; for (let j = 0; j < H; j++) a += W2[v * H + j] * hh[j]; lg[v] = a; if (a > m) m = a; }
      let z = 0;
      for (let v = 0; v < V; v++) { p[v] = Math.exp(lg[v] - m); z += p[v]; }
      for (let v = 0; v < V; v++) p[v] /= z;
      return p;
    }
    const ctxAt = (i) => { const c = []; for (let k = C; k >= 1; k--) c.push(i - k >= 0 ? data[i - k] : ix[' ']); return c; };
    const gE = new Float64Array(V * E), gW1 = new Float64Array(H * X), gb1 = new Float64Array(H), gW2 = new Float64Array(V * H), gb2 = new Float64Array(V), dh = new Float64Array(H), dx = new Float64Array(X);
    function step(lr, B = 32) {
      gE.fill(0); gW1.fill(0); gb1.fill(0); gW2.fill(0); gb2.fill(0);
      let loss = 0;
      for (let b = 0; b < B; b++) {
        const i = 1 + Math.floor(rnd() * (data.length - 1));
        const ci = ctxAt(i), y = data[i];
        forward(ci);
        loss += -Math.log(p[y] + 1e-12);
        dh.fill(0);
        for (let v = 0; v < V; v++) { const d = (p[v] - (v === y ? 1 : 0)) / B; gb2[v] += d; for (let j = 0; j < H; j++) { gW2[v * H + j] += d * hh[j]; dh[j] += d * W2[v * H + j]; } }
        dx.fill(0);
        for (let j = 0; j < H; j++) { const da = dh[j] * (1 - hh[j] * hh[j]); gb1[j] += da; for (let k = 0; k < X; k++) { gW1[j * X + k] += da * x[k]; dx[k] += da * W1[j * X + k]; } }
        for (let c = 0; c < C; c++) for (let e = 0; e < E; e++) gE[ci[c] * E + e] += dx[c * E + e];
      }
      const up = (w, g) => { for (let i = 0; i < w.length; i++) w[i] -= lr * g[i]; };
      up(emb, gE); up(W1, gW1); up(b1, gb1); up(W2, gW2); up(b2, gb2);
      return loss / B;
    }
    function evalLoss() { let L = 0; for (let i = 1; i < data.length; i++) { forward(ctxAt(i)); L += -Math.log(p[data[i]] + 1e-12); } return L / (data.length - 1); }
    function probsAfter(str) { const c = []; for (const ch of (' '.repeat(C) + str).slice(-C)) c.push(ix[ch] != null ? ix[ch] : ix[' ']); return Array.from(forward(c)); }
    function sample(prompt, n, temp = 0.7) {
      let out = prompt;
      for (let i = 0; i < n; i++) {
        const w = probsAfter(out).map((q) => Math.pow(q, 1 / temp));
        const z = w.reduce((a, b) => a + b, 0);
        let r = rnd() * z, v = 0;
        for (; v < V - 1; v++) { r -= w[v]; if (r <= 0) break; }
        out += chars[v];
      }
      return out;
    }
    return { chars, V, step, evalLoss, probsAfter, sample, params: emb.length + W1.length + b1.length + W2.length + b2.length };
  }
  const STEPS = 400, PROMPT = 'the mod';
  function trainMission() {
    return {
      id: 'pretrain', title: 'Watch the Loss Fall',
      objective: 'Pick a learning rate so the real model reaches loss ≤ 1.8 in 400 steps',
      story: 'Stage 3, pre-training: a model learns to predict the next token. This one is real and tiny, running in your browser: it reads 3 characters and guesses the next one. The only setting you control is the learning rate: how big each correction step is.',
      learn: [
        { t: 'Next token', p: 'Training shows the model text and nudges it to give the real next character a higher probability.', f: '"the mod" → e ?' },
        { t: 'Loss', p: 'Loss measures how surprised the model is by the right answer. Random guessing over 27 characters gives ln 27 ≈ 3.3.', f: 'loss = −ln P(right answer)' },
        { t: 'Learning rate', p: 'Too small: it barely learns. Too big: every step overshoots and the loss explodes.', f: 'weights −= learning rate × gradient' },
      ],
      controls: ['Drag the learning-rate slider', '<b>Train 400 steps</b>', 'Each run starts from a fresh model'],
      proved: 'You trained a real language model from scratch and watched the loss fall: the nanoGPT-style project from section 6, at toy size. The same loop (predict the next token, measure the loss, step the weights) trains the giant models on huge data. And like the notes say, you changed one setting at a time and kept a record.',
      tip: 'Look at the curve. Flat and high: the learning rate is too small; multiply it by 10. Shooting up: it is too big; divide it by 3.',
      quiz: Q('d-loss'),
      start(api) {
        clearWorld();
        const st = api.state;
        st.lrPos = 25; st.run = 0; st.training = false; st.curve = []; st.notebook = [];
        st.model = TinyLM(CORPUS, 101);
        graphCanvas.style.display = '';
        labels(['Learning rate', 'Step', 'Loss now', 'Best run']);
        hud.set('a', '--'); hud.set('b', '0 / ' + STEPS); hud.set('c', AC.fmt(st.model.evalLoss(), 2)); hud.set('d', '--');
        hud.setFormula('f', 'model: ' + st.model.params.toLocaleString('en-US') + ' parameters, 3 chars → next char\nrandom guessing: ln 27 = 3.30');
        graph.draw({ hlines: [{ y: 1.8, color: AC.css('--magenta'), label: 'target 1.8' }, { y: Math.log(27), color: AC.css('--dim'), label: 'random' }] });
        oc.target.set(0, 2.2, 0); oc.dist = 16; oc.phi = 1.18;
        // 3D bars: probability of each next character after the prompt
        const V = st.model.V;
        st.bars = [];
        const lbl = AC.textSprite('P(next character | "' + PROMPT + '")', { color: '#2fe0cf', size: 0.55 });
        lbl.position.set(0, 5.6, -1);
        world.add(lbl);
        for (let v = 0; v < V; v++) {
          const ch = st.model.chars[v];
          const a = -1.15 + (2.3 * v) / (V - 1);
          const x = Math.sin(a) * 9, z = -Math.cos(a) * 4 + 2;
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1, 0.5), glow(TEAL, 0.5));
          bar.position.set(x, 0.5, z);
          const t = AC.textSprite(ch === ' ' ? '_' : ch, { color: '#e9f0f7', bg: null, size: 0.55 });
          t.position.set(x, 0.05, z + 0.6);
          world.add(bar, t);
          st.bars.push(bar);
        }
        st.setBars = () => {
          const p = st.model.probsAfter(PROMPT);
          const top = p.indexOf(Math.max(...p));
          p.forEach((q, v) => {
            const b = st.bars[v], hgt = 0.05 + q * 5;
            b.scale.y = hgt; b.position.y = hgt / 2;
            const c = v === top ? (st.model.chars[v] === 'e' ? 0x4be38a : ORANGE) : TEAL;
            b.material.color.set(c); b.material.emissive.set(c);
          });
          return { top: st.model.chars[top], pe: p[st.model.chars.indexOf('e')] };
        };
        st.setBars();
        // panel
        panel.innerHTML = '';
        const out = h('output', {});
        const slider = h('input', { type: 'range', min: '0', max: '100', step: '1', value: String(st.lrPos), 'aria-label': 'Learning rate' });
        const lr = () => Math.pow(10, -3 + (4 * st.lrPos) / 100);
        const showLR = () => { out.textContent = lr() < 0.1 ? lr().toFixed(3) : lr() < 1 ? lr().toFixed(2) : lr().toFixed(1); hud.set('a', out.textContent); };
        slider.addEventListener('input', () => { st.lrPos = +slider.value; showLR(); });
        st.sampleEl = h('div', { class: 'term', style: { maxHeight: '64px' } }, 'untrained: ' + st.model.sample('the ', 56));
        st.trainBtn = h('button', { class: 'ac-btn', type: 'button', onclick: () => go() }, 'Train 400 steps');
        panel.append(
          h('div', { class: 'q' }, h('small', {}, 'Real model · fresh start each run'), 'Choose the learning rate'),
          h('div', { class: 'ac-field' }, h('label', {}, 'learning rate (0.001 → 10, log scale)', out), slider),
          st.sampleEl,
          h('div', { class: 'ac-actions' }, st.trainBtn));
        showLR();
        st.lr = lr; st.slider = slider; st.showLR = showLR;
        function go() {
          if (st.training) return;
          st.run++;
          st.model = TinyLM(CORPUS, 100 + st.run);
          st.k = 0; st.curve = []; st.ema = null; st.training = true; st.exploded = false; st.useLR = lr();
          st.trainBtn.disabled = true; slider.disabled = true;
          AC.audio.whoosh();
        }
        st.go = go;
      },
      update(dt, api) {
        const st = api.state;
        if (!st.training) return;
        for (let i = 0; i < 3 && st.k < STEPS; i++) {
          let L = st.model.step(st.useLR);
          if (!isFinite(L)) L = 20;
          st.ema = st.ema == null ? L : st.ema * 0.9 + L * 0.1;
          st.k++;
          if (st.k % 4 === 0 || st.k === 1) st.curve.push([st.k, Math.min(st.ema, 3.98)]);
          if (st.ema > 5) { st.exploded = true; st.k = STEPS; }
        }
        hud.set('b', st.k + ' / ' + STEPS);
        hud.set('c', AC.fmt(st.ema, 2), st.ema > 3 ? 'bad' : st.ema > 1.8 ? 'warn' : '');
        api.progress(st.k / STEPS, 'Training run ' + st.run);
        const bars = st.setBars();
        const hl = [{ y: 1.8, color: AC.css('--magenta'), label: 'target 1.8' }, { y: Math.log(27), color: AC.css('--dim'), label: 'random' }];
        const series = st.notebook.slice(-3).map((n) => ({ pts: n.curve, color: AC.css('--line'), width: 1 }));
        series.push({ pts: st.curve, color: AC.css('--cyan'), width: 2 });
        graph.draw({ series, hlines: hl });
        if (st.k < STEPS) return;
        st.training = false;
        st.trainBtn.disabled = false; st.slider.disabled = false;
        const final = st.exploded ? Infinity : st.model.evalLoss();
        st.notebook.push({ lr: st.useLR, loss: final, curve: st.curve });
        const best = Math.min(...st.notebook.map((n) => n.loss));
        hud.set('d', isFinite(best) ? AC.fmt(best, 2) : 'exploded');
        hud.setFormula('f', 'notebook (learning rate → final loss):\n' + st.notebook.slice(-5).map((n, i) => '#' + (st.notebook.length - Math.min(5, st.notebook.length) + i + 1) + '  lr ' + (n.lr < 0.1 ? n.lr.toFixed(3) : n.lr.toFixed(2)) + '  →  ' + (isFinite(n.loss) ? n.loss.toFixed(2) : 'exploded')).join('\n'));
        st.sampleEl.textContent = 'run ' + st.run + ' writes: ' + (st.exploded ? '(nonsense: the weights blew up)' : st.model.sample('the ', 56));
        api.progress(0, 'Objective');
        if (st.exploded) { AC.audio.boom(); return AC.fact('Loss exploded', 'Learning rate ' + st.useLR.toFixed(2) + ' is too big: each step overshoots, so the loss shoots up instead of down. Try about a third of it.', { tag: 'Run ' + st.run, color: 'var(--red)' }); }
        if (final <= 1.8) return api.win(final <= 1.45 ? 3 : final <= 1.6 ? 2 : 1, 'Run ' + st.run + ': learning rate ' + st.useLR.toFixed(2) + ' took the loss from 3.3 to ' + final.toFixed(2) + ' in 400 steps. After "' + PROMPT + '" it now predicts "' + bars.top + '" (' + Math.round(bars.pe * 100) + '% for "e").');
        AC.fact('Loss ' + final.toFixed(2) + ' (target 1.8)', st.useLR < 0.25 ? 'Learning rate ' + st.useLR.toFixed(3) + ' is too small: the model learns, but too slowly for 400 steps. Try a bigger one.' : 'Close, but the steps are a bit too big to settle. Try a slightly smaller learning rate.', { tag: 'Run ' + st.run, color: 'var(--amber)' });
      },
    };
  }

  const missions = [cleanMission(), tokMission(), trainMission()];
  const MR = AC.missions({ game: 'forge', week: 6, list: missions });
  window.addEventListener('keydown', (e) => {
    if (AC.paused || !MR.current || MR.done || e.repeat) return;
    const st = MR.api.state, id = MR.current.id;
    if (id === 'clean') { if (e.code === 'ArrowRight' || e.code === 'KeyD') st.decide(true); if (e.code === 'ArrowLeft' || e.code === 'KeyA') st.decide(false); }
    if (id === 'tokenize') { const m = /^Digit([1-4])$/.exec(e.code); if (m) st.pick(+m[1] - 1); }
    if (id === 'pretrain' && e.code === 'Enter') st.go();
  });

  AC.ui.tools([{ label: 'Reset view', onclick: () => Object.assign(oc, { theta: 0, phi: 1.12 }) }]);
  function help() {
    AC.ui.card({ eyebrow: 'Model Forge', title: 'How to play', body: [
      'Three stages of building a model: clean the data, train a tokenizer, then pre-train a real tiny model.',
      'In the last mission the bars show the model\'s probability for each possible next character after "the mod". Watch the right one ("e") grow as the loss falls.',
      'Drag to orbit, scroll or pinch to zoom.',
    ] });
  }

  S.onFrame((dt) => {
    MR.update(dt);
    oc.update(dt);
  });
  window.GAME = { MR, TinyLM, CORPUS };
  S.start();
  MR.begin();
})();
