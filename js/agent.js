/* Agent Sandbox — Module 5 · The hands (terminal agent) and the safety rules of the 30-day plan.
   The win condition is the concept: the bug is only fixed by following plan → run → read → fix → run again;
   the sandbox only passes the chaos test when every risky action is contained and safe work still flows;
   the gate only scores when exactly the risky commands (delete, overwrite, network upload, package install, deploy) stop for approval. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  AC.boot({ game: 'agent', week: 5, topic: 'The safe terminal agent', title: 'Agent Sandbox', help: () => help() });
  const S = AC.scene({ fov: 46, near: 0.1, far: 300, background: 0x060b14 });
  const { scene, camera, renderer } = S;
  scene.fog = new THREE.Fog(0x060b14, 30, 80);
  AC.lights(scene, { sky: 0xbfe6ff, ground: 0x0c1626, hemi: 0.7, sun: 0.7, dir: [6, 18, 12] });
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 19, min: 8, max: 40, phi: 1.12, theta: -0.25, minPhi: 0.4, maxPhi: 1.48, target: new THREE.Vector3(-1.5, 1.6, 0) });

  const TEAL = 0x2fe0cf;
  const glow = (c, e = 0.7) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.4 });
  const mat = (c, r = 0.7, m = 0.3) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0x08111d, 1, 0));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.GridHelper(80, 80, 0x16384a, 0x0e2232);
  grid.position.y = 0.01;
  scene.add(grid);

  // sandbox container
  const BOX = { x: 1, w: 7, h: 3.6, d: 4.6 };
  const box = new THREE.Group();
  box.position.x = BOX.x;
  scene.add(box);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d), new THREE.MeshStandardMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.07, roughness: 0.1, depthWrite: false }));
  glass.position.y = BOX.h / 2;
  const edgeMat = new THREE.LineBasicMaterial({ color: TEAL });
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(BOX.w, BOX.h, BOX.d)), edgeMat);
  edges.position.y = BOX.h / 2;
  box.add(glass, edges);
  const boxLbl = AC.textSprite('SANDBOX · copy of the project', { color: '#2fe0cf', size: 0.45 });
  boxLbl.position.set(0, BOX.h + 0.5, 0);
  box.add(boxLbl);
  const desk = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 1.3), mat(0x3a2c22));
  desk.position.set(0.8, 1.0, -0.9);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 1.1), mat(0x1a2230));
  legs.position.set(0.8, 0.5, -0.9);
  box.add(desk, legs);
  // terminal monitor with a live canvas
  const TW = 640, TH = 400;
  const tc = document.createElement('canvas');
  tc.width = TW; tc.height = TH;
  const tg = tc.getContext('2d');
  const ttex = new THREE.CanvasTexture(tc);
  ttex.minFilter = THREE.LinearFilter;
  const mon = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.45, 0.1), mat(0x111821, 0.4, 0.5));
  mon.position.set(0.8, 1.85, -1.3);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(2.16, 1.32), new THREE.MeshBasicMaterial({ map: ttex }));
  scr.position.set(0.8, 1.85, -1.24);
  box.add(mon, scr);
  // the agent: a small bot
  const bot = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.7, 20), mat(0xdfe7ef, 0.4, 0.2));
  body.position.y = 0.35;
  const headB = new THREE.Mesh(new THREE.SphereGeometry(0.33, 20, 14), mat(0xdfe7ef, 0.4, 0.2));
  headB.position.y = 0.95;
  const eye = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.05), glow(TEAL, 1.2));
  eye.position.set(0, 0.98, 0.3);
  bot.add(body, headB, eye);
  bot.position.set(BOX.x - 1.2, 0, 0.6);
  scene.add(bot);
  // the real server, outside — must never be touched
  const server = new THREE.Group();
  server.position.set(BOX.x + 6.2, 0, -1.2);
  scene.add(server);
  const rack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.4, 1.2), mat(0x1d1416));
  rack.position.y = 1.7;
  server.add(rack);
  const leds = [];
  for (let i = 0; i < 8; i++) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.02), glow(0x4be38a, 0.8));
    l.position.set(0, 0.5 + i * 0.37, 0.61);
    server.add(l);
    leds.push(l);
  }
  const srvLbl = AC.textSprite('YOUR REAL SERVER', { color: '#ff5a4f', size: 0.45 });
  srvLbl.position.y = 4.0;
  server.add(srvLbl);
  // conveyor + approval gate on the left
  const GATE_X = BOX.x - BOX.w / 2 - 0.6;
  const beltTex = AC.canvasTex(64, 64, (c, w, hh) => { c.fillStyle = '#1b2533'; c.fillRect(0, 0, w, hh); c.fillStyle = '#2a3a4f'; c.fillRect(0, 0, w / 2, hh); }, [12, 1]);
  const belt = new THREE.Mesh(new THREE.BoxGeometry(12, 0.25, 1.4), new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.9 }));
  belt.position.set(GATE_X - 6, 0.35, 1.4);
  scene.add(belt);
  const gate = new THREE.Group();
  gate.position.set(GATE_X, 0, 1.4);
  scene.add(gate);
  const postM = mat(0x2a3546, 0.5, 0.5);
  for (const z of [-0.9, 0.9]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.4, 0.18), postM); p.position.set(0, 1.2, z); gate.add(p); }
  const armMat = glow(0xffb547, 0.8);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 2.0), armMat);
  arm.position.y = 1.4;
  gate.add(arm);
  const gateLbl = AC.textSprite('APPROVAL GATE', { color: '#ffb547', size: 0.4 });
  gateLbl.position.y = 2.9;
  gate.add(gateLbl);

  // ---------------------------------------------------------------- terminal text (DOM + 3D monitor)
  let termLines = ['$ _'];
  function term(lines, reset) {
    if (reset) termLines = [];
    termLines.push(...lines);
    termLines = termLines.slice(-60);
    if (termEl) { termEl.textContent = termLines.join('\n'); termEl.scrollTop = 1e6; }
    tg.fillStyle = '#03080a';
    tg.fillRect(0, 0, TW, TH);
    tg.font = '22px "B612 Mono", Consolas, monospace';
    const show = termLines.slice(-14);
    show.forEach((l, i) => {
      tg.fillStyle = /^FAIL|error|✗|DENIED/i.test(l) ? '#ff6a5f' : /^PASS|✓/.test(l) ? '#4be38a' : /^\$/.test(l) ? '#2fe0cf' : /^#/.test(l) ? '#ffb547' : '#cfe3d6';
      tg.fillText(l.slice(0, 44), 18, 34 + i * 26);
    });
    ttex.needsUpdate = true;
  }
  let termEl = null;

  // ---------------------------------------------------------------- panel + HUD
  const panel = h('div', { class: 'opt-panel ac-panel' });
  AC.root().appendChild(panel);
  const hud = AC.ui.hud();
  hud.section('Agent').row('a', 'Steps', '0').row('b', 'Mistakes', '0').row('c', '--', '--').row('d', '--', '--').meter('m');
  hud.section('Rule').formula('f', 'plan → run command → read output → fix');
  const labels = (arr) => [...hud.el.querySelectorAll('.ac-row .k')].forEach((k, i) => { if (arr[i] != null) k.textContent = arr[i]; });
  const Q = (id) => AC.QUESTIONS.find((q) => q.id === id);

  // flying "action" orbs used by the chaos test and the gate
  const orbs = [];
  function orb(from, to, color, onArrive, dur = 0.9) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), glow(color, 1.2));
    m.position.copy(from);
    scene.add(m);
    orbs.push({ m, from: from.clone(), to: to.clone(), t: 0, dur, onArrive });
  }
  const flashes = [];
  function burst(pos, color, size = 1) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5 * size, 18, 12), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 }));
    m.position.copy(pos);
    scene.add(m);
    flashes.push({ m, t: 0 });
  }
  let serverHit = 0, wallHit = 0;

  // ---------------------------------------------------------------- mission 1: the agent loop
  const ACTIONS = [
    { id: 'plan', label: 'Plan the steps', small: 'think first' },
    { id: 'test', label: '$ npm test', small: 'run command' },
    { id: 'read', label: '$ cat src/add.js', small: 'read the code' },
    { id: 'fix', label: 'Edit line 3', small: 'return a + b;' },
    { id: 'cheat', label: 'Edit the test', small: 'expect 6 instead of 5' },
    { id: 'delete', label: '$ rm tests/add.test.js', small: 'delete the failing test' },
  ];
  function loopMission() {
    return {
      id: 'loop', title: 'The Agent Loop',
      objective: 'Be the agent: fix the failing test by plan → run → read → fix → run again',
      story: 'Week 2 goal: the AI fixes a small bug through the terminal. A model alone is not enough; the agent loop is what makes it work. You are the agent. One test fails in the project copy inside your sandbox.',
      learn: [
        { t: 'Two pieces', p: 'A model that is good at tool use and code, plus an agent program that lets it run commands.', f: 'model + agent program' },
        { t: 'The loop', p: 'Plan, run a command, read the output, fix, and run again to check.', f: 'plan → run → read → fix' },
        { t: 'Fix the cause', p: 'Read the error to find the real cause. Changing or deleting the test only hides the bug.', f: 'read before you edit' },
      ],
      controls: ['Tap an action to run it', 'Read the terminal output'],
      proved: 'You ran the loop that makes a terminal agent feel like Claude Code: plan, run a command, read its output, fix the real cause, and run again to prove it. Open agents such as OpenCode, Aider, Goose, OpenHands, Cline and Qwen Code all run this loop against your own endpoint.',
      tip: 'Start with a plan, run the tests, read what failed (file and line), open that file, fix the code, then run the tests again.',
      quiz: Q('a-loop'),
      start(api) {
        const st = api.state;
        Object.assign(oc, { theta: -0.08, phi: 1.2, dist: 14 }); oc.target.set(1.4, 1.2, 0);
        st.steps = 0; st.mistakes = 0; st.planned = false; st.ran = false; st.read = false; st.fixed = false;
        labels(['Steps', 'Mistakes', 'Tests', 'Bug']);
        hud.set('a', '0'); hud.set('b', '0'); hud.set('c', '1 failing', 'bad'); hud.set('d', 'in src/add.js', 'warn');
        hud.setFormula('f', 'plan → run command → read output → fix → run again');
        panel.innerHTML = '';
        termEl = h('pre', { class: 'term', 'aria-live': 'polite' });
        const opts = h('div', { class: 'opts' });
        ACTIONS.forEach((a) => opts.appendChild(h('button', { type: 'button', onclick: () => act(a.id) }, a.label, h('small', {}, a.small))));
        panel.append(h('div', { class: 'q' }, h('small', {}, 'Task: one test is failing'), 'What does the agent do next?'), termEl, opts);
        term(['# sandbox: /work/robot-kit (a copy)', '$ _'], true);
        const mistake = (msg) => { st.mistakes++; hud.set('b', String(st.mistakes), 'warn'); AC.audio.bad(); AC.fact('Agent mistake', msg, { tag: 'Loop', color: 'var(--amber)', ms: 8000 }); };
        function act(id) {
          st.steps++;
          hud.set('a', String(st.steps));
          AC.audio.click();
          if (id !== 'plan' && !st.planned) { mistake('Plan first. The loop starts with a plan, so every command has a reason.'); return; }
          if (id === 'plan') {
            if (st.planned) return mistake('You already have a plan. Follow it.');
            st.planned = true;
            term(['# Plan:', '#  1. run the tests', '#  2. read the failure', '#  3. open the file and fix the cause', '#  4. run the tests again']);
          } else if (id === 'test') {
            st.ran = true;
            if (st.fixed) {
              term(['$ npm test', 'PASS tests/add.test.js', 'PASS tests/robot.test.js', '✓ 4 of 4 tests pass']);
              hud.set('c', 'all pass', ''); hud.set('d', 'fixed', '');
              AC.audio.good();
              return api.win(st.mistakes === 0 ? 3 : st.mistakes === 1 ? 2 : 1, 'Fixed and verified in ' + st.steps + ' steps with ' + st.mistakes + (st.mistakes === 1 ? ' mistake.' : ' mistakes.'));
            }
            term(['$ npm test', 'FAIL tests/add.test.js', '  add(2, 3): expected 5, received 6', '  at src/add.js:3', '✗ 1 of 4 tests failed']);
          } else if (id === 'read') {
            if (!st.ran) return mistake('Run the tests first: you do not know which file is broken yet.');
            st.read = true;
            term(['$ cat src/add.js', '1  // add two numbers', '2  function add(a, b) {', '3    return a + b + 1;', '4  }', '5  module.exports = add;']);
          } else if (id === 'fix') {
            if (!st.read) return mistake('You are guessing. Read the output and open the file before you edit.');
            if (st.fixed) return mistake('Already fixed. Now run the tests to check.');
            st.fixed = true;
            term(['# edit src/add.js line 3', '3    return a + b;', '# saved']);
            hud.set('d', 'edited, not checked', 'warn');
          } else if (id === 'cheat') {
            mistake('Changing the test to expect 6 makes it pass, but add(2, 3) still gives 6. The bug is hidden, not fixed. Edit reverted.');
            term(['# edit tests/add.test.js: expect 6', '# reverted: that hides the bug']);
          } else if (id === 'delete') {
            mistake('Deleting needs your approval, and deleting a failing test only hides the bug. Command denied.');
            term(['$ rm tests/add.test.js', 'DENIED: delete needs human approval']);
            flashGate(false);
          }
        }
        st.act = act;
      },
    };
  }

  // ---------------------------------------------------------------- mission 2: build the sandbox (trade-off: safe AND useful)
  const SETTINGS = [
    { id: 'where', label: 'Agent works on', opts: [['real', 'Your real server'], ['copy', 'Throwaway container with a copy']], good: 'copy' },
    { id: 'user', label: 'User', opts: [['root', 'root'], ['noroot', 'No root']], good: 'noroot' },
    { id: 'folder', label: 'Files it can see', opts: [['disk', 'Whole disk'], ['locked', 'Locked working folder']], good: 'locked' },
    { id: 'keys', label: 'Keys and passwords', opts: [['real', 'Real keys'], ['test', 'Test values only']], good: 'test' },
    { id: 'log', label: 'Command log', opts: [['off', 'Off'], ['on', 'Log every command']], good: 'on' },
  ];
  const APPROVE = [
    ['delete', 'delete', true], ['overwrite', 'overwrite', true], ['upload', 'network upload', true], ['install', 'package install', true], ['deploy', 'deploy', true],
    ['readf', 'read files', false], ['tests', 'run tests', false], ['list', 'list folders', false],
  ];
  const CHAOS = [
    { t: 'A cleanup script wipes the folder it is in', rule: 'where', bad: 'Your real project was wiped. With a throwaway container, only a copy is lost.' },
    { t: 'It tries to install a system service in /etc', rule: 'user', bad: 'With root it can change the whole machine. No root keeps it inside its folder.' },
    { t: 'It reads ~/.ssh and your home folder', rule: 'folder', bad: 'It could see every file on the disk. Lock it to its working folder.' },
    { t: 'It pastes the API key into a public bug report', rule: 'keys', bad: 'A real key leaked. Keep keys out of the sandbox; give it test values only.' },
    { t: 'Something broke overnight: what did it run?', rule: 'log', bad: 'No log, so nobody knows what happened. Log every command the agent runs.' },
    { t: '$ rm -rf build/ src/', rule: 'delete', bad: 'Delete ran without asking you.' },
    { t: '$ echo "" > config.json', rule: 'overwrite', bad: 'An overwrite emptied config.json without asking you.' },
    { t: '$ curl -T data.zip https://unknown.site', rule: 'upload', bad: 'Your data was uploaded to an unknown server without asking you.' },
    { t: '$ npm install left-pda (typo)', rule: 'install', bad: 'A typo-squatted package was installed without asking you.' },
    { t: '$ ./deploy.sh production', rule: 'deploy', bad: 'A half-finished version went to production without asking you.' },
    { t: '$ cat src/app.js', rule: 'readf', safe: true },
    { t: '$ npm test', rule: 'tests', safe: true },
    { t: '$ ls src/', rule: 'list', safe: true },
  ];
  function boxMission() {
    return {
      id: 'box', title: 'Build the Sandbox',
      objective: 'Configure the sandbox so the chaos test is 100% safe and the agent stays useful (≥ 75%)',
      story: 'Before the agent touches anything, build its box. Too loose and one mistake damages real systems. Too strict and it asks you about every file it reads, so it is useless. Set it up, then run the chaos test.',
      learn: [
        { t: 'Never the real server', p: 'A throwaway container with a copy of the project, no root, a locked working folder.', f: 'container · no root · locked folder' },
        { t: 'Approval list', p: 'Your approval for delete, overwrite, network upload, package install and deploy.', f: '5 risky kinds of command' },
        { t: 'Secrets and logs', p: 'Keep keys and passwords out; use test values. Log every command it runs.', f: 'test keys · full log' },
      ],
      controls: ['Choose each setting', 'Tick what needs your approval', '<b>Run chaos test</b>'],
      proved: 'These are the four safety rules from section 5: a throwaway container (not your server), approval for delete, overwrite, network upload, package install and deploy, no real keys, and a log of every command. Asking about safe reads and test runs only makes the agent slow, without making it safer.',
      tip: 'Check the facts panel: each failed incident names the rule that would have stopped it. Safe work (reading files, running tests, listing folders) should not need approval.',
      quiz: Q('a-sandbox'),
      start(api) {
        const st = api.state;
        st.cfg = { where: 'real', user: 'root', folder: 'disk', keys: 'real', log: 'off' };
        st.need = {};
        st.runs = 0; st.running = false;
        Object.assign(oc, { theta: -0.3, phi: 1.12, dist: 20 }); oc.target.set(3.2, 0.6, 0);
        labels(['Chaos tests', 'Incidents contained', 'Safety', 'Usefulness']);
        hud.set('a', '0'); hud.set('b', '--'); hud.set('c', '--'); hud.set('d', '--');
        hud.setFormula('f', 'safe = every risky action contained\nuseful = safe work runs without asking');
        termEl = null;
        panel.innerHTML = '';
        const rows = h('div', { class: 'stack' });
        SETTINGS.forEach((s) => {
          const seg = h('div', { class: 'ac-seg' });
          s.opts.forEach(([v, l]) => {
            const b = h('button', { type: 'button', class: st.cfg[s.id] === v ? 'on' : '', onclick: () => { if (st.running) return; st.cfg[s.id] = v; [...seg.children].forEach((c) => c.classList.toggle('on', c === b)); AC.audio.click(); } }, l);
            seg.appendChild(b);
          });
          rows.appendChild(h('div', { class: 'row2' }, h('span', {}, s.label), seg));
        });
        const ap = h('div', { class: 'ac-seg' });
        APPROVE.forEach(([id, l]) => {
          const b = h('button', { type: 'button', onclick: () => { if (st.running) return; st.need[id] = !st.need[id]; b.classList.toggle('on', st.need[id]); AC.audio.click(); } }, l);
          ap.appendChild(b);
        });
        rows.appendChild(h('div', { class: 'row2' }, h('span', {}, 'Needs approval'), ap));
        panel.append(h('div', { class: 'q' }, h('small', {}, 'Sandbox settings'), 'Safe and useful'), rows,
          h('div', { class: 'ac-actions' }, h('button', { class: 'ac-btn', type: 'button', onclick: () => run() }, 'Run chaos test')));
        function run() {
          if (st.running) return;
          st.running = true; st.runs++; st.k = 0; st.t = 0.4; st.contained = 0; st.leaks = []; st.waits = 0;
          hud.set('a', String(st.runs));
          panel.classList.add('min');
          term(['# chaos test #' + st.runs], true);
        }
        st.run = run;
      },
      update(dt, api) {
        const st = api.state;
        if (!st.running) return;
        st.t -= dt;
        if (st.t > 0) return;
        if (st.k >= CHAOS.length) {
          if (orbs.length) return;
          st.running = false;
          panel.classList.remove('min');
          const risky = CHAOS.filter((c) => !c.safe).length;
          const safety = Math.round((100 * st.contained) / risky), useful = Math.max(0, 100 - 25 * st.waits);
          hud.set('c', safety + ' %', safety === 100 ? '' : 'bad');
          hud.set('d', useful + ' %', useful >= 75 ? '' : 'bad');
          hud.setMeter('m', (safety + useful) / 200);
          if (safety === 100 && useful >= 75) return api.win(st.runs === 1 && useful === 100 ? 3 : st.runs <= 2 ? 2 : 1, 'Safety 100%, usefulness ' + useful + '% on chaos test ' + st.runs + '.');
          st.leaks.slice(0, 2).forEach((l) => AC.fact(l.t, l.bad, { tag: 'Not contained', color: 'var(--red)', ms: 11000 }));
          if (useful < 75) AC.fact('The agent keeps asking', 'It stopped ' + st.waits + ' times to ask about safe work (reading, testing, listing). Only risky commands need your approval.', { tag: 'Too strict', color: 'var(--amber)', ms: 11000 });
          AC.ui.toast(st.leaks.length ? st.leaks.length + ' incidents not contained' : 'Too slow to be useful', 'var(--amber)');
          return;
        }
        const c = CHAOS[st.k++];
        st.t = 0.75;
        const from = bot.position.clone().setY(1);
        const isSetting = SETTINGS.some((s) => s.id === c.rule);
        const ok = isSetting ? st.cfg[c.rule] === SETTINGS.find((s) => s.id === c.rule).good : !!st.need[c.rule];
        term([(c.safe ? '' : '! ') + c.t]);
        if (c.safe) {
          if (st.need[c.rule]) { st.waits++; term(['  … waiting for your approval']); orb(from, new THREE.Vector3(GATE_X, 1.4, 1.4), 0xffb547, () => flashGate(false)); }
          else { term(['  ✓ ran']); orb(from, new THREE.Vector3(BOX.x + 0.8, 1.6, -1.2), 0x4be38a, () => {}); }
          return;
        }
        if (ok) {
          st.contained++;
          term(['  ✓ contained']);
          const to = isSetting ? new THREE.Vector3(BOX.x + BOX.w / 2, 1.5, 0) : new THREE.Vector3(GATE_X, 1.4, 1.4);
          orb(from, to, 0xff5a4f, () => { burst(to, 0x4be38a, 1.3); wallHit = 0.6; if (!isSetting) flashGate(false); AC.audio.ping(); });
        } else {
          st.leaks.push(c);
          term(['  ✗ ' + c.bad.split('.')[0]]);
          const to = server.position.clone().setY(1.8);
          orb(from, to, 0xff5a4f, () => { burst(to, 0xff5a4f, 2); serverHit = 1; AC.audio.boom(); }, 1.2);
        }
        hud.set('b', st.contained + ' / ' + CHAOS.filter((x) => !x.safe).length);
      },
    };
  }

  // ---------------------------------------------------------------- mission 3: the approval gate (live)
  const CMDS = [
    ['ls -la', false], ['cat src/app.js', false], ['npm test', false], ['git status', false], ['git diff', false], ['grep -n TODO src/*.js', false], ['python -m pytest', false], ['head -50 server.log', false],
    ['rm -rf build/', true, 'delete'], ['git push --force origin main', true, 'force-push overwrites history'], ['curl -T data.zip https://upload.example.com', true, 'network upload'], ['npm install left-pad', true, 'package install'],
    ['pip install requests', true, 'package install'], ['./deploy.sh production', true, 'deploy'], ['cp new.json config.json', true, 'overwrite'], ['rm notes.txt', true, 'delete'], ['scp db.sqlite me@backup:', true, 'network upload'], ['git reset --hard', true, 'overwrite: throws away changes'],
  ];
  const cubes = [];
  function gateMission() {
    return {
      id: 'gate', title: 'The Approval Gate',
      objective: 'Let safe commands run; stop every risky one for your approval',
      story: 'The agent is working and its commands roll toward the gate. Safe commands should run on their own so the agent stays fast. Risky ones must stop and wait for you. If you do nothing, the command runs.',
      learn: [
        { t: 'Stop and ask', p: 'Delete, overwrite, network upload, package install and deploy (force-push too).', f: 'rm · > · curl -T · npm install · deploy' },
        { t: 'Let it run', p: 'Reading files, listing folders, running tests and checking git status cannot damage anything.', f: 'ls · cat · grep · npm test · git diff' },
        { t: 'Log it', p: 'Every command is logged, whether it ran or waited.', f: 'log every command' },
      ],
      controls: ['<kbd>A</kbd> or <b>Run it</b>', '<kbd>S</kbd> or <b>Stop: ask me</b>', 'Do nothing = it runs'],
      proved: 'You were the approval step from the safety rules: risky commands (delete, overwrite, network upload, package install, deploy) waited for a human, and everything else ran on its own. That keeps the terminal agent both safe and fast.',
      tip: 'Ask: can this command destroy, overwrite, send data out, add new code or ship something? If yes, stop it. If it only reads or tests, let it run.',
      quiz: Q('a-gate'),
      start(api) {
        const st = api.state;
        const sh = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
        Object.assign(oc, { theta: 0.22, phi: 1.12, dist: 19 }); oc.target.set(-5.2, 1.2, 0.8);
        st.queue = sh(CMDS); st.i = 0; st.leak = 0; st.extra = 0; st.ok = 0; st.cur = null;
        labels(['Commands', 'Correct', 'Risky ran', 'Needless stops']);
        hud.set('a', '0 / ' + CMDS.length); hud.set('b', '0'); hud.set('c', '0'); hud.set('d', '0');
        hud.setFormula('f', 'log:');
        termEl = null;
        term(['# approval gate log'], true);
        panel.innerHTML = '';
        const qEl = h('div', { class: 'q' }, h('small', {}, 'Waiting for the first command'), '…');
        const opts = h('div', { class: 'opts' },
          h('button', { type: 'button', onclick: () => decide(false) }, h('small', {}, 'key A'), 'Run it'),
          h('button', { type: 'button', onclick: () => decide(true) }, h('small', {}, 'key S'), 'Stop: ask me'));
        panel.append(qEl, opts);
        st.qEl = qEl;
        function decide(stop) {
          const c = st.cur;
          if (!c || c.decided) return;
          c.decided = true; c.stop = stop;
          AC.audio.click();
        }
        st.decide = decide;
      },
      update(dt, api) {
        const st = api.state, N = st.queue.length;
        if (!st.cur) {
          if (st.i >= N) return;
          const [cmd, risky, why] = st.queue[st.i];
          const g = new THREE.Group();
          const cube = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.8), glow(0x6fb6ff, 0.6));
          const lbl = AC.textSprite('$ ' + cmd, { color: '#e9f0f7', size: 0.36 });
          lbl.position.y = 0.85;
          g.add(cube, lbl);
          g.position.set(GATE_X - 11, 0.9, 1.4);
          scene.add(g);
          st.cur = { cmd, risky, why, g, t: 0, phase: 'roll', decided: false, stop: false, limit: 5 - (1.5 * st.i) / (N - 1) };
          cubes.push(g);
          st.qEl.innerHTML = '';
          st.qEl.append(h('small', {}, 'Command ' + (st.i + 1) + ' of ' + N), '$ ' + cmd);
        }
        const c = st.cur;
        c.t += dt;
        if (c.phase === 'roll') {
          const k = clamp(c.t / c.limit, 0, 1);
          c.g.position.x = GATE_X - 11 + k * 10.2;
          api.progress((st.i + k) / N, 'Time to decide: ' + AC.fmt(Math.max(0, c.limit - c.t), 1) + ' s');
          if (c.decided || k >= 1) { c.phase = 'resolve'; c.t = 0; resolveCmd(api); }
        } else if (c.t > 0.8) {
          scene.remove(c.g);
          st.cur = null;
          st.i++;
          if (st.i >= N) {
            if (st.leak > 1 || st.extra > 3) return api.fail(st.leak + ' risky commands ran and ' + st.extra + ' safe ones were stopped. Pass needs at most 1 and 3.');
            api.win(st.leak === 0 && st.extra === 0 ? 3 : st.leak === 0 && st.extra <= 2 ? 2 : 1, st.ok + ' of ' + N + ' right · ' + st.leak + ' risky ran · ' + st.extra + ' needless stops.');
          }
        } else {
          // after the decision: stopped cubes stay at the gate, run cubes pass into the box
          if (!c.stop) c.g.position.x += dt * 6;
        }
      },
    };
    function resolveCmd(api) {
      const st = api.state, c = st.cur, N = st.queue.length;
      const stop = c.decided && c.stop;
      c.stop = stop;
      flashGate(!stop);
      const cube = c.g.children[0];
      let line;
      if (c.risky && stop) { st.ok++; AC.audio.good(); cube.material.emissive.set(0xffb547); cube.material.color.set(0xffb547); line = '⏸ ' + c.cmd + '  (waiting: ' + c.why + ')'; }
      else if (c.risky && !stop) { st.leak++; AC.audio.boom(); cube.material.emissive.set(0xff5a4f); cube.material.color.set(0xff5a4f); serverHit = 0.7; line = '✗ ' + c.cmd + '  RAN without approval'; AC.fact('$ ' + c.cmd, 'This is a ' + c.why + ' command. It needs your approval before it runs.', { tag: 'Risky command ran', color: 'var(--red)' }); }
      else if (!c.risky && stop) { st.extra++; AC.audio.bad(); line = '⏸ ' + c.cmd + '  (needless wait)'; AC.fact('$ ' + c.cmd, 'This only reads, lists or tests. It cannot damage anything, so stopping it just slows the agent down.', { tag: 'Needless stop', color: 'var(--amber)', ms: 6000 }); }
      else { st.ok++; AC.audio.ping(); cube.material.emissive.set(0x4be38a); cube.material.color.set(0x4be38a); line = '✓ ' + c.cmd; }
      term([line]);
      hud.setFormula('f', 'log:\n' + termLines.slice(-4).join('\n'));
      hud.set('a', st.i + 1 + ' / ' + N); hud.set('b', String(st.ok)); hud.set('c', String(st.leak), st.leak ? 'bad' : ''); hud.set('d', String(st.extra), st.extra ? 'warn' : '');
    }
  }
  let gateFlash = 0, gateOpen = true;
  function flashGate(open) { gateOpen = open; gateFlash = 1; armMat.color.set(open ? 0x4be38a : 0xffb547); armMat.emissive.copy(armMat.color); }

  const missions = [loopMission(), boxMission(), gateMission()];
  const MR = AC.missions({
    game: 'agent', week: 5, list: missions,
    onSelect() {
      cubes.forEach((g) => scene.remove(g)); cubes.length = 0;
      orbs.forEach((o) => scene.remove(o.m)); orbs.length = 0;
      panel.classList.remove('min');
    },
  });
  window.addEventListener('keydown', (e) => {
    if (AC.paused || !MR.current || MR.done || MR.current.id !== 'gate') return;
    if (e.code === 'KeyA') MR.api.state.decide(false);
    if (e.code === 'KeyS') MR.api.state.decide(true);
  });

  AC.ui.tools([{ label: 'Reset view', onclick: () => Object.assign(oc, { theta: -0.25, phi: 1.12, dist: 19 }) }]);
  function help() {
    AC.ui.card({ eyebrow: 'Agent Sandbox', title: 'How to play', body: [
      'The glass box is the sandbox: a throwaway container holding a copy of the project. The red rack outside is your real server, which the agent must never touch.',
      'Commands reach the sandbox through the approval gate on the left. The terminal inside the box (and in the panel) shows what the agent ran.',
      'Drag to orbit, scroll or pinch to zoom.',
    ] });
  }

  // ---------------------------------------------------------------- loop
  term(['$ _'], true);
  S.onFrame((dt, time) => {
    beltTex.offset.x -= dt * 0.8;
    bot.position.y = Math.abs(Math.sin(time * 3)) * 0.04;
    bot.rotation.y = Math.sin(time * 0.7) * 0.4;
    for (let i = orbs.length - 1; i >= 0; i--) {
      const o = orbs[i];
      o.t += dt;
      const k = clamp(o.t / o.dur, 0, 1);
      o.m.position.lerpVectors(o.from, o.to, k);
      o.m.position.y += Math.sin(k * Math.PI) * 1.2;
      if (k >= 1) { scene.remove(o.m); orbs.splice(i, 1); o.onArrive && o.onArrive(); }
    }
    for (let i = flashes.length - 1; i >= 0; i--) {
      const f = flashes[i];
      f.t += dt;
      f.m.scale.setScalar(1 + f.t * 3);
      f.m.material.opacity = Math.max(0, 0.8 - f.t * 1.6);
      if (f.t > 0.5) { scene.remove(f.m); flashes.splice(i, 1); }
    }
    serverHit = Math.max(0, serverHit - dt * 0.6);
    leds.forEach((l, i) => { const bad = serverHit > 0 && Math.sin(time * 20 + i) > 0; l.material.color.set(bad ? 0xff5a4f : 0x4be38a); l.material.emissive.set(bad ? 0xff5a4f : 0x4be38a); });
    wallHit = Math.max(0, wallHit - dt);
    edgeMat.color.set(wallHit > 0 ? 0x4be38a : TEAL);
    gateFlash = Math.max(0, gateFlash - dt * 0.7);
    arm.rotation.x = 0;
    arm.rotation.z = 0;
    arm.position.y = gateOpen && gateFlash > 0 ? 1.4 + gateFlash * 0.9 : 1.4;
    if (gateFlash <= 0) { armMat.color.set(0xffb547); armMat.emissive.set(0xffb547); }
    MR.update(dt);
    oc.update(dt);
  });
  window.GAME = { MR, CHAOS, CMDS, SETTINGS, APPROVE };
  S.start();
  MR.begin();
})();
