# AI Builder Academy

Learn how a self-hosted AI companion is built, and how AI models are made, by playing 3D simulation games in the browser.

The games follow the handout **"Self-Hosted AI Prototype: model stack, 30-day plan, and a path to learn how AI systems are made"** (November 2026).

**Play:** https://ad-1astra.github.io/ai-builder-academy/

| Module | Game | Missions |
|---|---|---|
| 1 · Six parts, one gateway | Gateway Control | Route the Requests · Rush Hour |
| 2 · The model stack | Gateway Control | Licence Check · Boot the Prototype Stack |
| 3 · Hosting on GPUs | GPU Rack | Fit the Brain on One Card · Rent the Right GPU · The Scale Step |
| 4 · The animated face | Face Lab | Never Snap · Life When Idle · Emotion Tags |
| 5 · The 30-day plan and the safe agent | Gateway Control, Agent Sandbox | Plan the 30 Days · The Agent Loop · Build the Sandbox · The Approval Gate |
| 6 · Data, tokens, pre-training | Model Forge | Clean the Data · Train a Tokenizer · Watch the Loss Fall (a real tiny language model, trained in your browser) |
| 7 · Fine-tuning and beyond | Fine-Tune Lab | Teach the Emotion Tag (SFT) · One Change at a Time · Prefer the Better Answer (DPO) |

Every module ends with a test played as a game (Streak Run or a 2-player Quiz Duel) in the Test Arena. The teacher guide (`teacher.html`) lists what each mission teaches, questions to ask, answers, and the real-world next step.

## Run it locally

Plain static HTML and JavaScript, no build step. Open `index.html`, or serve the folder:

```
python -m http.server 8000
```

Three.js r128 loads from cdnjs, with an offline copy in `lib/three.min.js`. Progress is saved in the browser (localStorage), per device.

## Where the code lives

- `js/core.js`: shared engine (UI, missions, progress, 3D helpers)
- `js/gateway.js`, `gpu.js`, `face.js`, `agent.js`, `forge.js`, `tune.js`: one file per game
- `js/forge.js` contains `TinyLM`: a small character-level neural network (3 characters → 8-number embeddings → 48 tanh units → softmax), trained with plain SGD. Read it to see a full forward and backward pass in about 60 lines.
- `js/face.js`: the animated face, drawn with Canvas and spring physics
- `js/questions.js`: 80 test questions, tagged by module
