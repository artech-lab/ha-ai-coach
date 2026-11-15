// Regenerates the README images with demo data (no real measurements).
// Needs the dev dependencies:  npm install && npx playwright install chromium
// Run with:  npm run screenshots   (CHROME_PATH=/path/to/chrome to use an installed browser)
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs"), os = require("os");
const { ROOT, CARD, page: html, demoStates, demoHistory, CARDS, CARDS_IT, RESULTS } = require("./demo.cjs");
const OUT = path.join(ROOT, "images");

(async () => {
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const shot = async (dir, theme, lang, card, file) => {
    const p = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 470, height: 1200 } });
    p.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
    await p.setContent(html(theme));
    await p.addScriptTag({ content: fs.readFileSync(CARD, "utf8"), type: "module" });
    await p.waitForFunction(() => customElements.get("ai-coach-card"));
    await p.evaluate(([lang, cfg, res, states, history, key]) => {
      const now = Date.now();
      /* the entities of an AI Coach device, as the integration creates them */
      const ents = {}, all = Object.assign({}, states);
      const add = (domain, role, state, attrs) => {
        const id = domain + ".ai_coach_" + key + "_" + role;
        ents[id] = { entity_id: id, platform: "ai_coach", device_id: "dev_" + key, translation_key: role };
        all[id] = { state: String(state), attributes: attrs || {} };
        return id;
      };
      const score = add("sensor", "score", res.score);
      add("sensor", "confidence", res.confidence);
      add("sensor", "summary", res.summary.slice(0, 255), { text: res.summary });
      add("sensor", "tips", res.tips.length, { tips: res.tips });
      add("sensor", "last_analysis", new Date(now - res.ago * 60000).toISOString(), { error: null });
      add("binary_sensor", "analysing", "off");
      add("button", "run_analysis", "unknown");
      const hass = { language: lang, locale: { language: lang }, states: all, entities: ents,
        devices: { ["dev_" + key]: { name: cfg.name } }, areas: {}, user: { is_admin: true },
        callWS: async (m) => {
          if (m.type === "history/history_during_period") { const o = {}; o[m.entity_ids[0]] = history; return o; }
          return null;
        },
        callService: async () => {} };
      const conf = Object.assign({}, cfg, { entity: score });
      delete conf.entities; delete conf.topic;
      const el = document.createElement("ai-coach-card");
      el.setConfig(conf);
      document.getElementById("host").appendChild(el);
      el.hass = hass;
      window.card = el;
    }, [lang, (lang === "it" ? CARDS_IT : CARDS)[card], RESULTS[lang][card], demoStates(), demoHistory(Date.now()), card]);
    await p.waitForFunction(() => window.card.shadowRoot && window.card.shadowRoot.querySelectorAll(".tip").length > 0);
    await p.waitForTimeout(600);
    const target = path.join(dir, file);
    await p.locator("#host").screenshot({ path: target });
    await p.close();
    console.log("wrote", path.relative(ROOT, target));
    return target;
  };
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "acc-shots-"));
  const full = await shot(tmp, "dark", "en", "comfort", "full-dark.png");
  const compact = await shot(tmp, "dark", "en", "wellbeing", "compact-dark.png");
  await shot(OUT, "light", "it", "wellbeing", "compact-light-it.png");

  /* composite preview: the two layouts side by side */
  const b64 = (f) => "data:image/png;base64," + fs.readFileSync(f).toString("base64");
  const fig = (f, t) => `<figure><img src="${b64(f)}"><figcaption>${t}</figcaption></figure>`;
  const p = await browser.newPage({ deviceScaleFactor: 2, viewport: { width: 1100, height: 1200 } });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:Roboto,Inter,"DejaVu Sans",sans-serif;-webkit-font-smoothing:antialiased}
    #c{display:inline-flex;gap:28px;align-items:flex-start;padding:30px 32px 26px;background:#111111;}
    figure{margin:0;display:flex;flex-direction:column;align-items:center;gap:10px}
    img{width:430px;display:block}
    figcaption{color:#9b9b9b;font-size:15px;letter-spacing:.2px}
  </style></head><body><div id="c">${fig(full, "Full layout")}${fig(compact, "Compact layout")}</div></body></html>`);
  await p.waitForTimeout(300);
  await p.locator("#c").screenshot({ path: path.join(OUT, "preview.png") });
  await p.close();
  console.log("wrote images/preview.png");
  fs.rmSync(tmp, { recursive: true, force: true });
  await browser.close();
})();
