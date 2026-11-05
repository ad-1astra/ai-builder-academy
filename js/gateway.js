/* Gateway Control — Module 1 (six parts, one gateway), Module 2 (model stack + licences), Module 5 (30-day plan).
   The win condition is the concept: every request only scores when the player sends it to the part of the system that
   really handles it, the stack only boots when every pick passes the licence and hardware rules from the notes. */
(function () {
  'use strict';
  const { h, clamp } = AC;
  AC.boot({ game: 'gateway', week: 1, topic: 'Six parts, one gateway', title: 'Gateway Control', help: () => help() });
  const S = AC.scene({ fov: 50, near: 0.1, far: 400, background: 0x050b16 });
  const { scene, camera, renderer } = S;
  scene.fog = new THREE.Fog(0x050b16, 34, 90);
  AC.lights(scene, { sky: 0x9fdcff, ground: 0x0a1424, hemi: 0.7, sun: 0.75, dir: [10, 30, 18] });
  const oc = new AC.OrbitCam(camera, renderer.domElement, { dist: 21, min: 10, max: 45, phi: 1.08, theta: 0, minPhi: 0.3, maxPhi: 1.45, target: new THREE.Vector3(0, 2.2, -1.5) });

  // ---------------------------------------------------------------- materials + world
  const TEAL = 0x2fe0cf, ORANGE = 0xff8a3d;
  const glow = (c, e = 0.7) => new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: e, roughness: 0.35, metalness: 0.2 });
  const dark = (c = 0x13233a) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.35 });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 64), new THREE.MeshStandardMaterial({ color: 0x07101c, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const grid = new THREE.PolarGridHelper(16, 16, 8, 64, 0x1b4a58, 0x10283a);
  grid.position.y = 0.01;
  scene.add(grid);

  const GW = new THREE.Vector3(0, 2.4, 2.6);
  const gw = new THREE.Group();
  gw.position.copy(GW);
  scene.add(gw);
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.09, 12, 56), glow(TEAL, 0.9));
  const ringB = ringA.clone();
  ringB.rotation.x = Math.PI / 2;
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.5), glow(ORANGE, 0.85));
  gw.add(ringA, ringB, core);
  const gwPed = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.9, GW.y - 1.2, 6), dark());
  gwPed.position.set(GW.x, (GW.y - 1.2) / 2, GW.z);
  scene.add(gwPed);
  const gwLbl = AC.textSprite('GATEWAY', { color: '#2fe0cf', size: 0.5 });
  gwLbl.position.set(GW.x, GW.y + 1.75, GW.z);
  scene.add(gwLbl);

  // input emitters along the front: where each request enters the system
  const INPUTS = { TEXT: 0x6fb6ff, MIC: 0xff70d8, CAMERA: 0xffb547, SCREENSHOT: 0x9b8cff, FILE: 0x4be38a, TAG: 0xff8a3d, MODEL: 0x2fe0cf, TASK: 0xe9f0f7 };
  const emit = {};
  ['TEXT', 'MIC', 'CAMERA', 'SCREENSHOT', 'FILE', 'TAG'].forEach((k, i) => {
    const x = -8.75 + i * 3.5;
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 20), glow(INPUTS[k], 0.5));
    m.position.set(x, 4.7, -13.5);
    m.rotation.x = Math.PI / 2 - 0.4;
    scene.add(m);
    const l = AC.textSprite(k, { color: '#93a7bf', bg: null, size: 0.5 });
    l.position.set(x, 5.45, -13.5);
    scene.add(l);
    emit[k] = m.position.clone();
  });
  emit.MODEL = emit.TASK = new THREE.Vector3(0, 5.4, -13.5);

  // ---------------------------------------------------------------- stations
  const stationsG = new THREE.Group();
  scene.add(stationsG);
  let stations = [];
  function icon(kind, color) {
    const g = new THREE.Group();
    if (kind === 'brain') {
      g.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.62, 1), new THREE.MeshStandardMaterial({ color: 0xff9ad8, emissive: 0x7a2a5e, emissiveIntensity: 0.5, flatShading: true, roughness: 0.5 })));
    } else if (kind === 'eyes') {
      for (const x of [-0.42, 0.42]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 14), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 }));
        const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 10), glow(TEAL, 1));
        e.position.x = p.position.x = x;
        p.position.z = 0.24;
        g.add(e, p);
      }
    } else if (kind === 'hands') {
      const box = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.85, 0.12), dark(0x22344d));
      const scr = AC.textSprite('>_ run', { color: '#4be38a', bg: '#020a06', size: 0.42 });
      scr.position.z = 0.08;
      g.add(box, scr);
    } else if (kind === 'artist') {
      const tex = AC.canvasTex(128, 96, (c, w, hh) => {
        const gr = c.createLinearGradient(0, 0, w, hh);
        gr.addColorStop(0, '#ff8a3d'); gr.addColorStop(0.5, '#ff70d8'); gr.addColorStop(1, '#2fe0cf');
        c.fillStyle = gr; c.fillRect(0, 0, w, hh);
        c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.arc(42, 40, 16, 0, 7); c.fill();
      });
      const fr = new THREE.Mesh(new THREE.BoxGeometry(1.3, 1.0, 0.08), dark(0x3a2a1a));
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.85), new THREE.MeshBasicMaterial({ map: tex }));
      pic.position.z = 0.05;
      g.add(fr, pic);
    } else if (kind === 'voice') {
      for (let i = 0; i < 3; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.22 + i * 0.2, 0.04, 8, 32, Math.PI * 0.9), glow(0xff70d8, 0.8));
        r.rotation.z = -Math.PI * 0.45;
        g.add(r);
      }
      g.add(new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), glow(0xff70d8, 1)));
    } else if (kind === 'face') {
      const scr = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.9, 0.15), dark(0x0a0f18));
      g.add(scr);
      for (const x of [-0.3, 0.3]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.36, 0.05), glow(TEAL, 1.2));
        e.position.set(x, 0.06, 0.09);
        g.add(e);
      }
      const m = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.03, 6, 16, Math.PI), glow(ORANGE, 1));
      m.position.set(0, -0.2, 0.09);
      m.rotation.z = Math.PI;
      g.add(m);
    } else {
      // generic bin: a glowing crystal in the station colour
      g.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.45, flatShading: true })));
    }
    return g;
  }
  function buildStations(defs) {
    while (stationsG.children.length) stationsG.remove(stationsG.children[0]);
    const n = defs.length, R = 10.5;
    const span = Math.min(Math.PI * 0.8, (n - 1) * 0.46);
    stations = defs.map((d, i) => {
      const a = n === 1 ? 0 : -span / 2 + (span * i) / (n - 1);
      const g = new THREE.Group();
      g.position.set(R * Math.sin(a), 0, GW.z - 3.2 - R * Math.cos(a) * 0.62);
      g.rotation.y = -a * 0.5;
      const col = d.color || TEAL;
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.25, 0.55, 6), dark());
      ped.position.y = 0.28;
      const ringMat = glow(col, 0.6);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.07, 8, 40), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.58;
      const ic = icon(d.kind, col);
      ic.position.y = 1.65;
      const lbl = AC.textSprite((i + 1) + ' · ' + d.name.toUpperCase(), { color: '#e9f0f7', size: 0.62 });
      lbl.position.y = 3.15;
      g.add(ped, ring, ic, lbl);
      if (d.sub) {
        const sub = AC.textSprite(d.sub, { color: '#b9c8da', bg: null, size: 0.46 });
        sub.position.y = 2.55;
        g.add(sub);
      }
      stationsG.add(g);
      // faint beam from the gateway to this station
      const lineGeo = new THREE.BufferGeometry().setFromPoints([GW.clone(), g.position.clone().setY(1.6)]);
      const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: col, transparent: true, opacity: 0.18 }));
      stationsG.add(line);
      return { d, g, ring, ringMat, ic, line, base: col, flash: 0, flashCol: new THREE.Color(col), top: g.position.clone().setY(1.65) };
    });
    panelButtons(defs);
  }
  function flash(st, ok) {
    st.flash = 1;
    st.flashCol.set(ok ? 0x4be38a : 0xff5a4f);
  }

  // ---------------------------------------------------------------- packets
  let pkt = null; // the request currently in flight
  function makePacket(item, input) {
    const g = new THREE.Group();
    const col = INPUTS[input] || 0xffffff;
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), glow(col, 0.9));
    const lbl = AC.textSprite(item.short || input, { color: '#ffffff', size: 0.42 });
    lbl.position.y = 0.75;
    g.add(box, lbl);
    scene.add(g);
    const from = (emit[input] || emit.TEXT).clone();
    g.position.copy(from);
    return { item, g, box, from, phase: 'in', t: 0, choice: -1, outFrom: null };
  }
  function dropPacket() {
    if (pkt) scene.remove(pkt.g);
    pkt = null;
  }
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

  // ---------------------------------------------------------------- bottom panel (current request + one button per station)
  const panel = h('div', { class: 'opt-panel ac-panel' });
  const qEl = h('div', { class: 'q' });
  const optsEl = h('div', { class: 'opts' });
  panel.append(qEl, optsEl);
  AC.root().appendChild(panel);
  let onPick = null;
  function panelButtons(defs) {
    optsEl.innerHTML = '';
    optsEl.className = 'opts';
    defs.forEach((d, i) => optsEl.appendChild(h('button', { type: 'button', onclick: () => onPick && onPick(i) }, h('small', {}, 'key ' + (i + 1)), d.name)));
  }
  function setQuestion(input, text) {
    qEl.innerHTML = '';
    qEl.append(h('small', {}, input), text);
  }
  window.addEventListener('keydown', (e) => {
    if (AC.paused || !onPick) return;
    const m = /^(Digit|Numpad)([1-9])$/.exec(e.code);
    if (m) onPick(+m[2] - 1);
  });

  // ---------------------------------------------------------------- HUD
  const hud = AC.ui.hud();
  hud.section('Gateway').row('n', 'Requests', '--').row('ok', 'Correct', '--').row('bad', 'Misrouted', '--').row('time', 'Time left', '--').meter('m');
  hud.section('Rule').formula('f', '');
  const labels = (arr) => [...hud.el.querySelectorAll('.ac-row .k')].forEach((k, i) => { if (arr[i]) k.textContent = arr[i]; });

  // ---------------------------------------------------------------- data from the notes
  const PARTS = [
    { id: 'brain', name: 'Brain', sub: 'language model', kind: 'brain', color: 0xff9ad8 },
    { id: 'eyes', name: 'Eyes', sub: 'vision model', kind: 'eyes', color: TEAL },
    { id: 'hands', name: 'Hands', sub: 'coding agent + sandbox', kind: 'hands', color: 0x4be38a },
    { id: 'artist', name: 'Artist', sub: 'image model', kind: 'artist', color: 0xffb547 },
    { id: 'voice', name: 'Voice', sub: 'ASR + TTS', kind: 'voice', color: 0xff70d8 },
    { id: 'face', name: 'Face', sub: 'emotion display', kind: 'face', color: ORANGE },
  ];
  const ROUTE = [
    { in: 'TEXT', short: 'chat', t: 'Explain how a for-loop works, in simple words', a: 'brain', x: 'Reasoning and chat is the brain: the language model (prototype pick Qwen3.8-27B).' },
    { in: 'SCREENSHOT', short: 'screenshot', t: 'Screenshot: a red error message in the browser', a: 'eyes', x: 'Screenshots go to the vision model, which answers in text. Then the brain acts on it.' },
    { in: 'TEXT', short: 'fix bug', t: 'Run the tests and fix the one that fails', a: 'hands', x: 'Running terminal commands is the hands: a coding agent working inside a locked sandbox.' },
    { in: 'TEXT', short: 'draw', t: 'Draw a poster that says "HUB AI Robotics Day"', a: 'artist', x: 'Image generation is the artist. Qwen-Image 2.0 is best at readable text inside images.' },
    { in: 'MIC', short: 'mic', t: 'Microphone: "Hey, are you awake?"', a: 'voice', x: 'Speech in is the voice part: speech to text (ASR) such as VibeVoice-ASR or Whisper.' },
    { in: 'TAG', short: 'emotion tag', t: 'Brain reply tag: emotion = happy, intensity = 0.7, look = user', a: 'face', x: 'Emotion tags are an output: the face engine blends its eyes and mouth toward the tag.' },
    { in: 'CAMERA', short: 'camera', t: 'Camera: a photo of a bar chart on the whiteboard', a: 'eyes', x: 'Camera frames go to the vision model. Qwen3.8-27B reads charts, screenshots and documents.' },
    { in: 'FILE', short: 'file', t: 'File meeting-notes.txt: "Summarise this in 5 points"', a: 'brain', x: 'A text file is still language work: the brain reads it and writes the summary.' },
    { in: 'TEXT', short: 'speak', t: 'Read your answer out loud to me', a: 'voice', x: 'Speech out is text to speech (TTS): Kokoro, CosyVoice2 or VibeVoice-Realtime.' },
    { in: 'TEXT', short: 'build', t: 'Install the packages and run the build', a: 'hands', x: 'Terminal work is the hands. Package installs need your approval in the sandbox.' },
    { in: 'FILE', short: 'edit pic', t: 'robot.png: keep the robot, change the background to a beach', a: 'artist', x: 'Editing a picture is the artist. Qwen-Image-Edit-2511 keeps the character consistent.' },
    { in: 'TAG', short: 'thinking', t: 'The model is running: show the thinking dots', a: 'face', x: 'Thinking (model running) is one of the six face expressions. The face is animation code, not a model.' },
  ];
  const RUSH = [
    { in: 'MIC', short: '60 min audio', t: 'Transcribe this 60-minute class recording with speaker names', a: 'voice', x: 'VibeVoice-ASR transcribes up to 60 minutes in one pass with speaker labels and timestamps.' },
    { in: 'FILE', short: 'scan', t: 'Scanned PDF page: read the table in it', a: 'eyes', x: 'Reading documents is vision work. The Qwen3-VL family has strong OCR for heavy document reading.' },
    { in: 'TEXT', short: 'plan', t: 'Plan the steps for adding a login page', a: 'brain', x: 'Planning is reasoning: the brain. The hands only run commands once there is a plan.' },
    { in: 'TEXT', short: 'commit', t: 'Run git status, then commit the fix', a: 'hands', x: 'git commands run in the terminal: the hands, inside the sandbox.' },
    { in: 'CAMERA', short: 'surprise', t: 'Something new just appeared on camera: react!', a: 'face', x: 'The vision model can trigger a face reaction: surprise when something new appears.' },
    { in: 'TEXT', short: '50 stickers', t: 'Make 50 quick sticker ideas for the demo, fast', a: 'artist', x: 'Z-Image Turbo is very fast: good for high volume and a snappy demo.' },
    { in: 'TEXT', short: 'Swahili', t: 'Answer in Swahili: what is a robot?', a: 'brain', x: 'Qwen is the default open family for tool calling and multilingual use.' },
    { in: 'TEXT', short: 'live talk', t: 'Speak the reply fast enough for a live conversation', a: 'voice', x: 'CosyVoice2-0.5B streams with about 150 ms latency: good for live conversation.' },
    { in: 'CAMERA', short: 'what?', t: 'Camera: what is the person holding?', a: 'eyes', x: 'Seeing is the eyes. Gemma 4 12B is fast for an always-on camera loop.' },
    { in: 'CAMERA', short: 'follow', t: 'Find the user\'s face so the eyes follow them', a: 'face', x: 'Eye tracking is part of the face: camera face detection (e.g. MediaPipe) runs on the device, no GPU server.' },
    { in: 'FILE', short: 'log', t: 'Open server.log in the terminal and find the crash', a: 'hands', x: 'Reading files in the terminal and running commands is the hands.' },
    { in: 'FILE', short: 'sketch', t: 'sketch.png: turn this into a clean colour logo', a: 'artist', x: 'Qwen-Image 2.0 does both generation and editing.' },
    { in: 'TEXT', short: 'story', t: 'Write a short story about a friendly robot', a: 'brain', x: 'Writing is the language model: the brain.' },
    { in: 'TAG', short: 'lip sync', t: 'Move the mouth with the voice loudness', a: 'face', x: 'Speaking: the mouth follows the voice loudness while the eyes keep their emotion.' },
    { in: 'MIC', short: 'mic', t: 'Microphone: "Stop! Cancel that."', a: 'voice', x: 'Speech in always goes through speech to text first.' },
    { in: 'SCREENSHOT', short: 'chart', t: 'Screenshot of a sales chart: which month sold the most?', a: 'eyes', x: 'Charts in screenshots are vision work. The brain then answers with what the eyes found.' },
  ];
  const BINS_LIC = [
    { id: 'free', name: 'Free to sell', sub: 'Apache 2.0 or MIT', kind: 'bin', color: 0x4be38a },
    { id: 'terms', name: 'Read the terms', sub: 'custom / community', kind: 'bin', color: 0xffb547 },
    { id: 'paid', name: 'Paid licence', sub: 'non-commercial', kind: 'bin', color: 0xff5a4f },
  ];
  const LIC = [
    ['Qwen3.8-27B', 'free', 'Apache 2.0: free for commercial use.'],
    ['Gemma 4', 'free', 'Apache 2.0: free for commercial use.'],
    ['Qwen-Image 2.0', 'free', 'Apache 2.0: the commercially safe image pick for the prototype.'],
    ['Z-Image Turbo', 'free', 'Apache 2.0: free for commercial use.'],
    ['Kokoro', 'free', 'Apache 2.0: the small, natural text-to-speech pick.'],
    ['GLM-5.3-Flash', 'free', 'MIT: free for commercial use.'],
    ['MiMo-V2.6', 'free', 'MIT: free for commercial use.'],
    ['InternVL3', 'free', 'MIT: free for commercial use.'],
    ['GLM-5.3', 'terms', 'GLM licence (custom): read the terms before selling a product.'],
    ['Kimi K3', 'terms', 'Custom or community licence: read the terms first.'],
    ['Llama 4', 'terms', 'Custom or community licence: read the terms first.'],
    ['Qwen3.8-Max', 'terms', 'Custom or community licence: read the terms first.'],
    ['Qwen-Image-Edit', 'terms', 'Qwen licence: check the card before selling.'],
    ['FLUX.2 [dev]', 'paid', 'Non-commercial: you need a paid licence from Black Forest Labs to sell with it.'],
  ].map(([n, a, x]) => ({ in: 'MODEL', short: n, t: n, a, x: n + ': ' + x }));
  const WEEKS = [
    { id: 1, name: 'Week 1', sub: 'Brain online', kind: 'bin', color: 0xff9ad8 },
    { id: 2, name: 'Week 2', sub: 'Eyes and hands', kind: 'bin', color: TEAL },
    { id: 3, name: 'Week 3', sub: 'Artist, voice, face v1', kind: 'bin', color: 0xffb547 },
    { id: 4, name: 'Week 4', sub: 'Join, test, show', kind: 'bin', color: 0x4be38a },
  ];
  const PLAN = [
    ['Rent a GPU machine', 1], ['Install vLLM and serve Qwen3.8-27B at 4-bit', 1], ['Put the gateway in front and connect Open WebUI', 1], ['Write 30 test questions from your real work', 1],
    ['Add image input: screenshots and camera', 2], ['Install a terminal agent pointed at your endpoint', 2], ['Lock the agent in a Docker sandbox with an approval step', 2],
    ['Install ComfyUI and Qwen-Image 2.0', 3], ['Add VibeVoice-ASR or Whisper, plus Kokoro', 3], ['Build the face: 6 expressions and idle motion', 3],
    ['Add the emotion tag loop', 4], ['Run the test set again and note the failures', 4], ['Record a demo video', 4], ['Run your first small fine-tune', 4],
  ].map(([t, a], i) => ({ in: 'TASK', short: 'task ' + (i + 1), t, a, x: '"' + t + '" is Week ' + a + ': ' + ['', 'brain online, you chat with your own model and the test set has a baseline score.', 'the AI reads a screenshot and fixes a small bug through the terminal.', 'you speak, it answers aloud, draws on request, and the face reacts.', 'a working demo video and a written list of what to improve.'][a] }));

  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const Q = (id) => AC.QUESTIONS.find((q) => q.id === id);

  // ---------------------------------------------------------------- generic sorting mission
  // o: {bins, items, pass, stars:[min for 3★, min for 2★], rule, limit(i, n)?, factEvery?}
  function sorterImpl(o) {
    let resolveFn;
    const obj = {
      controls: ['<kbd>1</kbd>…<kbd>' + o.bins.length + '</kbd> or tap a button to route', 'Drag to look around'],
      start(api) {
        buildStations(o.bins);
        dropPacket();
        panel.classList.remove('min');
        const st = api.state;
        st.queue = o.order ? o.items.slice() : shuffle(o.items);
        st.i = 0; st.ok = 0; st.bad = 0;
        hud.setFormula('f', o.rule);
        labels(o.labels || ['Requests', 'Correct', 'Misrouted', 'Time left']);
        hud.set('time', o.limit ? '--' : 'no limit', 'cyan');
        onPick = (i) => {
          if (pkt && (pkt.phase === 'in' || pkt.phase === 'wait') && i < stations.length && pkt.choice < 0) {
            pkt.choice = i; pkt.outFrom = pkt.g.position.clone(); pkt.phase = 'out'; pkt.t = 0; AC.audio.whoosh(); markButton(i, 'on');
          }
        };
      },
      update(dt, api) {
        const st = api.state, N = st.queue.length;
        if (!pkt) {
          if (st.i >= N) return;
          const item = st.queue[st.i];
          pkt = makePacket(item, item.in);
          setQuestion(item.in === 'MODEL' ? 'Model ' + (st.i + 1) + ' of ' + N + ' · which licence group?' : item.in === 'TASK' ? 'Task ' + (st.i + 1) + ' of ' + N + ' · which week?' : item.in + ' · request ' + (st.i + 1) + ' of ' + N, item.t);
          clearButtons();
        }
        pkt.t += dt;
        pkt.box.rotation.x += dt * 1.3;
        pkt.box.rotation.y += dt * 0.9;
        if (pkt.phase === 'in') {
          pkt.g.position.lerpVectors(pkt.from, GW, ease(clamp(pkt.t / 0.8, 0, 1)));
          if (pkt.t >= 0.8) { pkt.phase = 'wait'; pkt.t = 0; }
        } else if (pkt.phase === 'wait') {
          pkt.g.position.set(GW.x, GW.y + Math.sin(pkt.t * 3) * 0.12, GW.z);
          if (o.limit) {
            const left = o.limit(st.i, N) - pkt.t;
            hud.set('time', AC.fmt(Math.max(0, left), 1) + ' s', left < 2 ? 'bad' : left < 4 ? 'warn' : '');
            if (left <= 0) return resolveFn(api, -1);
          }
        } else if (pkt.phase === 'out') {
          const k = ease(clamp(pkt.t / 0.6, 0, 1));
          const to = stations[pkt.choice].top;
          const mid = pkt.outFrom.clone().lerp(to, 0.5);
          mid.y += 2.2;
          const a = pkt.outFrom.clone().lerp(mid, k), b = mid.clone().lerp(to, k);
          pkt.g.position.lerpVectors(a, b, k);
          pkt.g.scale.setScalar(1 - k * 0.6);
          if (pkt.t >= 0.6) return resolveFn(api, pkt.choice);
        }
        hud.set('n', st.i + ' / ' + N);
        hud.set('ok', String(st.ok));
        hud.set('bad', String(st.bad), st.bad ? 'warn' : '');
        hud.setMeter('m', st.ok / Math.max(1, N), 'var(--green)');
      },
    };
    resolveFn = function (api, choice) {
      const st = api.state, item = pkt.item, N = st.queue.length;
      const right = stations.findIndex((s) => s.d.id === item.a);
      const ok = choice === right;
      if (choice >= 0) flash(stations[choice], ok);
      markButton(right, 'right');
      if (!ok && choice >= 0) markButton(choice, 'wrong');
      if (ok) {
        st.ok++; AC.audio.good();
        if (o.factEvery && st.ok % o.factEvery === 1) AC.fact(item.short || 'Correct', item.x, { tag: 'Correct', color: 'var(--green)', ms: 6000 });
      } else {
        st.bad++; AC.audio.bad();
        flash(stations[right], true);
        AC.fact(choice < 0 ? 'Too slow: request dropped' : 'It belongs to ' + stations[right].d.name, item.x, { tag: 'Why', color: 'var(--amber)', ms: 8000 });
      }
      dropPacket();
      st.i++;
      api.progress(st.i / N);
      hud.set('n', st.i + ' / ' + N);
      hud.set('ok', String(st.ok));
      hud.set('bad', String(st.bad), st.bad ? 'warn' : '');
      if (st.bad > N - o.pass) return api.fail(st.bad + ' wrong out of ' + st.i + '. You need ' + o.pass + ' of ' + N + ' right.');
      if (st.i >= N) api.win(st.ok >= o.stars[0] ? 3 : st.ok >= o.stars[1] ? 2 : 1, st.ok + ' of ' + N + ' right.');
    };
    return obj;
  }
  function markButton(i, cls) { const b = optsEl.children[i]; if (b) b.classList.add(cls); }
  function clearButtons() { [...optsEl.children].forEach((b) => b.classList.remove('on', 'right', 'wrong')); }

  // ---------------------------------------------------------------- stack builder mission (Module 2)
  const SLOTS = [
    { id: 'brain', name: 'Brain', kind: 'brain', color: 0xff9ad8, sub: 'Machine A', opts: [
      { n: 'Qwen3.8-27B', s: '16–19GB at 4-bit · Apache 2.0', ok: true },
      { n: 'Gemma 4 26B A4B', s: 'one 24–48GB card · Apache 2.0', ok: true },
      { n: 'GLM-5.3-Flash', s: '320B · 3–4×80GB · MIT', ok: false, why: 'GLM-5.3-Flash needs 3–4 × 80GB GPUs at 4-bit. It is the scale step, after the prototype proves its value.' },
      { n: 'GLM-5.3', s: '744B · 8×H200 · GLM licence', ok: false, why: 'GLM-5.3 needs an 8 × H200 data-centre node, and its custom licence must be read before you sell.' } ] },
    { id: 'eyes', name: 'Eyes', kind: 'eyes', color: TEAL, sub: 'Machine A', opts: [
      { n: 'Qwen3.8-27B', s: 'same deployment as the brain', ok: true },
      { n: 'Gemma 4 12B', s: '12–16GB · fast · Apache 2.0', ok: true },
      { n: 'InternVL3-78B', s: '78B · large · MIT', ok: false, why: 'InternVL3-78B is frontier quality but large: the notes say "for later". Month one runs on one or two GPUs.' },
      { n: 'Gemini 4 Argon', s: 'closed · no weights', ok: false, why: 'Gemini leads the vision benchmark but is closed: there are no weights to download, so you cannot self-host it.' } ] },
    { id: 'hands', name: 'Hands', kind: 'hands', color: 0x4be38a, sub: 'Machine A', opts: [
      { n: 'OpenCode', s: 'locked Docker sandbox', ok: true },
      { n: 'Qwen Code', s: 'locked Docker sandbox', ok: true },
      { n: 'Aider', s: 'root on your real server', ok: false, why: 'Never give the agent your real server. Give it a throwaway container with a copy of the project.' } ] },
    { id: 'artist', name: 'Artist', kind: 'artist', color: 0xffb547, sub: 'Machine B', opts: [
      { n: 'Qwen-Image 2.0', s: '7B · text in images · Apache 2.0', ok: true },
      { n: 'Z-Image Turbo', s: 'very fast · Apache 2.0', ok: true },
      { n: 'FLUX.2 [dev]', s: 'top quality · non-commercial', ok: false, why: 'FLUX.2 [dev] is non-commercial unless you buy a licence from Black Forest Labs. Not safe for a product.' },
      { n: 'Wan 2.2', s: 'text-to-video', ok: false, why: 'Wan 2.2 makes video. It is on the backlog; the month-one artist draws images.' } ] },
    { id: 'voice', name: 'Voice', kind: 'voice', color: 0xff70d8, sub: 'Machine B', opts: [
      { n: 'VibeVoice-ASR + Kokoro', s: 'hears + speaks', ok: true },
      { n: 'Whisper + Kokoro', s: 'hears + speaks', ok: true },
      { n: 'Kokoro only', s: 'text to speech only', ok: false, why: 'Kokoro only speaks. The voice part needs speech to text too (VibeVoice-ASR or Whisper) so it can hear you.' },
      { n: 'Whisper + cloned voice', s: 'a celebrity, no permission', ok: false, why: 'Only clone voices with the speaker\'s permission.' } ] },
  ];
  const stackMission = {
    id: 'stack', week: 2, title: 'Boot the Prototype Stack',
    objective: 'Pick one model per part, then boot the stack with every part green',
    story: 'Month one, two rented GPUs. Machine A (24–48GB) runs the brain, eyes and hands. Machine B (24GB) runs the artist and voice. The product will be sold, so every licence must allow commercial use.',
    learn: [
      { t: 'Fit the hardware', p: 'Month-one models must run on one or two GPUs. The giant models are the scale step, for later.', f: 'Qwen3.8-27B ≈ 16–19GB at 4-bit → one 24GB card' },
      { t: 'Licence', p: 'Apache 2.0 and MIT are free for commercial use. Non-commercial models need a paid licence.', f: 'FLUX.2 [dev] = non-commercial' },
      { t: 'One deployment', p: 'Qwen3.8-27B does text and vision, so one deployment covers the brain and the eyes.', f: 'brain + eyes = one model' },
    ],
    controls: ['Tap one option per row', 'Press <b>Boot the stack</b>'],
    proved: 'A month-one stack must pass two checks from the notes: it fits one or two rented GPUs, and every licence allows a product. Qwen3.8-27B for brain and eyes, an open agent in a sandbox, Qwen-Image 2.0 and an ASR + Kokoro voice pass both.',
    tip: 'Read the small grey line on each option: GPU size and licence are written there. Red parts tell you which rule they broke.',
    quiz: null,
    start(api) {
      buildStations(SLOTS.map((s) => ({ id: s.id, name: s.name, sub: s.sub, kind: s.kind, color: s.color })));
      dropPacket();
      onPick = null;
      panel.classList.remove('min');
      const st = api.state;
      st.pick = {}; st.attempts = 0; st.boot = -1; st.t = 0;
      hud.setFormula('f', 'Machine A 24–48GB: brain · eyes · hands\nMachine B 24GB: artist · voice\nEvery licence: commercial use OK');
      labels(['Parts picked', 'Passed', 'Failed', 'Boots']);
      hud.set('n', '0 / 5'); hud.set('ok', '0'); hud.set('bad', '0'); hud.set('time', '0', 'cyan');
      qEl.innerHTML = '';
      qEl.append(h('small', {}, 'Build the month-one stack'), 'One pick per part');
      optsEl.innerHTML = '';
      optsEl.className = 'stack';
      SLOTS.forEach((s) => {
        const row = h('div', { class: 'opts' });
        s.opts.forEach((op, j) => {
          const b = h('button', { type: 'button', onclick: () => { if (st.boot >= 0) return; st.pick[s.id] = j; [...row.children].forEach((c, k) => c.classList.toggle('on', k === j)); AC.audio.click(); hud.set('n', Object.keys(st.pick).length + ' / 5'); } }, op.n, h('small', {}, op.s));
          row.appendChild(b);
        });
        optsEl.appendChild(h('div', { class: 'row2' }, h('span', {}, s.name), row));
      });
      const boot = h('button', { class: 'ac-btn', type: 'button', onclick: () => {
        if (st.boot >= 0) return;
        if (Object.keys(st.pick).length < SLOTS.length) return AC.ui.toast('Pick all five parts first', 'var(--amber)');
        st.attempts++; st.boot = 0; st.t = 0; st.fails = 0;
        hud.set('time', String(st.attempts), 'cyan');
        panel.classList.add('min');
        stations.forEach((s) => { s.flash = 0; s.hold = false; });
        AC.audio.whoosh();
      } }, 'Boot the stack');
      optsEl.appendChild(h('div', { class: 'ac-actions' }, boot));
    },
    update(dt, api) {
      const st = api.state;
      if (st.boot < 0) return;
      st.t += dt;
      if (st.t < 0.7) return;
      st.t = 0;
      const s = SLOTS[st.boot], op = s.opts[st.pick[s.id]];
      flash(stations[st.boot], op.ok);
      stations[st.boot].hold = !op.ok;
      if (op.ok) AC.audio.ping(); else { AC.audio.bad(); st.fails++; AC.fact(s.name + ': ' + op.n + ' failed', op.why, { tag: 'Boot check', color: 'var(--red)', ms: 9000 }); }
      api.progress((st.boot + 1) / SLOTS.length, 'Booting');
      hud.set('ok', String(st.boot + 1 - st.fails));
      hud.set('bad', String(st.fails), st.fails ? 'bad' : '');
      st.boot++;
      if (st.boot >= SLOTS.length) {
        st.boot = -1;
        setTimeout(() => panel.classList.remove('min'), 900);
        if (!st.fails) {
          const shared = st.pick.brain === 0 && st.pick.eyes === 0;
          api.win(st.attempts === 1 ? 3 : st.attempts === 2 ? 2 : 1, 'All five parts green on boot ' + st.attempts + '.' + (shared ? ' Brain and eyes share one Qwen3.8-27B deployment, just like the plan.' : ' Tip: the plan runs Qwen3.8-27B as both brain and eyes, so one deployment covers both.'));
        } else {
          api.progress(0, 'Objective');
          AC.ui.toast(st.fails + (st.fails === 1 ? ' part' : ' parts') + ' failed: fix the red ones', 'var(--amber)');
        }
      }
    },
  };

  // ---------------------------------------------------------------- missions
  const missions = [
    Object.assign(sorterImpl({ bins: PARTS, items: ROUTE, pass: 10, stars: [12, 11], factEvery: 3,
      rule: 'INPUTS: text · mic · camera · screenshots · files\n→ GATEWAY routes each request →\nBRAIN · EYES · HANDS · ARTIST · VOICE · FACE' }), {
      id: 'route', week: 1, title: 'Route the Requests',
      objective: 'Send 12 requests to the part that handles them (10 right to pass)',
      story: 'Your AI companion is six separate parts joined by one gateway. Requests arrive from the keyboard, microphone, camera, screenshots and files. You are the gateway: send each one to the part that does that job.',
      learn: [
        { t: 'Six parts', p: 'Brain (language model), eyes (vision), hands (coding agent), artist (images), voice (speech in and out), face (emotion display).', f: '6 parts · 1 gateway' },
        { t: 'Swap any part', p: 'Each part is a separate open-weight model or program, so any part can be swapped for a better model later.', f: 'apps see one endpoint' },
        { t: 'The face is code', p: 'The face is not an AI model. It is animation code driven by emotion tags.', f: 'emotion = happy, intensity = 0.7' },
      ],
      proved: 'This is the architecture diagram from section 3, live: every input goes through one gateway, and the gateway routes it to the right model. Because everything speaks HTTP, any part can be swapped later without rebuilding the product.',
      tip: 'Ask "what kind of work is this?" Words and plans: brain. Pictures in: eyes. Terminal commands: hands. Pictures out: artist. Sound: voice. Emotion tags: face.',
      quiz: Q('g-swap'),
    }),
    Object.assign(sorterImpl({ bins: PARTS, items: RUSH, pass: 13, stars: [15, 14], factEvery: 2, limit: (i, n) => 7 - (3 * i) / (n - 1),
      rule: 'Each request has a timer: 7 s, falling to 4 s.\nA dropped request counts as wrong.' }), {
      id: 'rush', week: 1, title: 'Rush Hour',
      objective: 'Route 16 harder requests before their timers run out (13 right to pass)',
      story: 'Demo day at the hub. Requests come in faster, and some are tricky: long recordings, scanned documents, eye tracking. Every model has a strength; send each request where it fits best.',
      learn: [
        { t: 'Voice strengths', p: 'VibeVoice-ASR: 60 minutes in one pass with speaker labels. CosyVoice2: about 150 ms streaming.', f: 'ASR = hear · TTS = speak' },
        { t: 'Eyes strengths', p: 'Qwen3-VL has strong OCR for documents. Gemma 4 12B is fast for an always-on camera loop.', f: 'documents → eyes' },
        { t: 'Face', p: 'Eye tracking uses camera face detection on the device. No GPU server needed.', f: 'eye tracking → face' },
      ],
      proved: 'You matched each request to the part whose strengths fit it, under time pressure. A real gateway does exactly this: it reads each request and routes it to the right model, with logging, retries and access control.',
      tip: 'Read the request, not the input type: a camera frame can be for the eyes ("what is this?") or for the face ("follow me", "react").',
      quiz: Q('g-gap'),
    }),
    Object.assign(sorterImpl({ bins: BINS_LIC, items: LIC, pass: 11, stars: [14, 13], factEvery: 2,
      labels: ['Models', 'Correct', 'Wrong', 'Time left'], rule: 'Apache 2.0 / MIT → free for commercial use\nCustom or community → read the terms first\nNon-commercial → buy a licence to sell' }), {
      id: 'licence', week: 2, title: 'Licence Check',
      objective: 'Sort 14 models by what their licence lets you do (11 right to pass)',
      story: 'A customer wants to buy your AI companion. Before you sell, every model in the box needs a licence check. Sort each model into the group its licence belongs to.',
      learn: [
        { t: 'Free to sell', p: 'Apache 2.0: Qwen3.8-27B, Gemma 4, Qwen-Image, Z-Image, Kokoro. MIT: GLM-5.3-Flash, MiMo-V2.6, InternVL3.', f: 'Apache 2.0 · MIT' },
        { t: 'Read the terms', p: 'Custom or community licences: GLM-5.3, Kimi K3, Llama 4, Qwen3.8-Max, Qwen-Image-Edit.', f: 'custom = check first' },
        { t: 'Paid licence', p: 'FLUX.2 [dev] is non-commercial unless you buy a licence from Black Forest Labs.', f: 'non-commercial' },
      ],
      proved: 'This is the licence table from section 7. "Open weights" does not always mean "free to sell": GLM-5.3-Flash is MIT, but the bigger GLM-5.3 has its own licence. Always verify on the model card.',
      tip: 'Only one model in the plan is non-commercial (FLUX.2 [dev]). The big flagship models (GLM-5.3, Kimi K3, Llama 4, Qwen3.8-Max) have custom licences.',
      quiz: Q('s-flux'),
    }),
    stackMission,
    Object.assign(sorterImpl({ bins: WEEKS, items: PLAN, pass: 11, stars: [14, 13], factEvery: 2,
      labels: ['Tasks', 'Correct', 'Wrong', 'Time left'], rule: 'W1 done: you chat with your own model; test set has a baseline\nW2 done: AI reads a screenshot, fixes a bug in the terminal\nW3 done: speaks, draws, face reacts\nW4 done: demo video + list of what to improve' }), {
      id: 'plan', week: 5, title: 'Plan the 30 Days',
      objective: 'Put 14 tasks into the right week of the 30-day plan (11 right to pass)',
      story: 'You have 30 days to build the prototype. Each week has one goal and a "done when" test. Put every task in the week it belongs to, so each week ends with something you can show.',
      learn: [
        { t: 'Brain first', p: 'Week 1 gets your own model online behind the gateway, with a 30-question test set and a baseline score.', f: 'W1: brain online' },
        { t: 'Then add parts', p: 'Week 2 adds eyes and hands. Week 3 adds artist, voice and face v1.', f: 'W2 eyes + hands · W3 artist, voice, face' },
        { t: 'Join and test', p: 'Week 4 joins everything, re-runs the test set, records a demo and runs a first small fine-tune.', f: 'W4: join, test, show' },
      ],
      proved: 'This is the 30-day plan from section 5. Each week adds one layer on top of a working base, and each ends with a test you can see pass. The test set from week 1 is re-run in week 4, so you can measure what improved.',
      tip: 'Match each task to the week goals on the stations: brain online → eyes and hands → artist, voice, face → join, test, show.',
      quiz: Q('p-week1'),
    }),
  ];
  const MR = AC.missions({
    game: 'gateway', week: 1, list: missions,
    onSelect(m) {
      const span = document.querySelector('.ac-top .title span');
      if (span) span.textContent = AC.UNIT + ' ' + m.week + ' · ' + ({ 1: 'Six parts, one gateway', 2: 'The model stack', 5: 'The 30-day plan' })[m.week];
    },
  });

  // ---------------------------------------------------------------- controls + help
  AC.ui.tools([{ label: 'Reset view', onclick: () => Object.assign(oc, { theta: 0, phi: 1.08, dist: 21 }) }]);
  function help() {
    AC.ui.card({ eyebrow: 'Gateway Control', title: 'How to play', body: [
      'Requests drop in from the inputs at the front and wait at the gateway. Press the number key, or tap the button, for the part that should handle it.',
      'The packet flies there. Green means right; red means wrong, and the correct station lights up with the reason.',
      'Drag to orbit the camera, scroll or pinch to zoom.',
    ] });
  }

  // ---------------------------------------------------------------- loop
  S.onFrame((dt, time) => {
    ringA.rotation.y += dt * 0.6;
    ringB.rotation.z += dt * 0.4;
    core.rotation.y -= dt * 1.2;
    core.position.y = Math.sin(time * 2) * 0.08;
    for (const st of stations) {
      st.ic.rotation.y = Math.sin(time * 0.8 + st.g.position.x) * 0.5;
      st.ic.position.y = 1.65 + Math.sin(time * 1.6 + st.g.position.x) * 0.06;
      if (st.flash > 0 && !st.hold) st.flash = Math.max(0, st.flash - dt * 0.9);
      const base = new THREE.Color(st.base);
      st.ringMat.emissive.copy(base).lerp(st.flashCol, st.hold ? 1 : st.flash);
      st.ringMat.color.copy(st.ringMat.emissive);
      st.ringMat.emissiveIntensity = 0.6 + (st.hold ? 0.8 : st.flash * 1.2);
      st.line.material.opacity = 0.18 + st.flash * 0.6;
    }
    MR.update(dt);
    oc.update(dt);
  });
  // test hook for automated play-throughs (harmless for players)
  window.GAME = { pkt: () => pkt, stations: () => stations, MR, SLOTS };
  S.start();
  MR.begin();
})();
