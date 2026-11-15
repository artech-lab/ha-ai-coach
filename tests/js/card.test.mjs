// Unit tests for the pure logic of the card. Run with: npm test
// The card file is loaded in a sandbox with minimal DOM stubs, then its
// top-level functions are exercised directly.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

process.env.TZ = "UTC";

const src = readFileSync(new URL("../../custom_components/ai_coach/frontend/ai-coach-card.js", import.meta.url), "utf8");
// The card is an ES module: emulate the URL the integration loads it from.
const script = src.replace("new URL(import.meta.url)", "new URL(\"http://ha.local/ai_coach/ai-coach-card.js?v=9.9.9\")");
const defined = {};
const ctx = {
  console: { info() {}, warn() {}, log() {} },
  HTMLElement: class {},
  customElements: { get: (t) => defined[t], define(t, c) { defined[t] = c; } },
  window: {},
  navigator: { language: "en-US" },
  document: {},
  Intl,
  URL,
  setTimeout
};
vm.createContext(ctx);
vm.runInContext(
  script + "\n;globalThis.__api = { ACC_I18N, ACC_DEFAULTS, ACC_STRUCTURE, ACC_MAX_TIPS, ACC_VERSION, accSiblings, accFirstCoach," +
  " accLang, accT, accBand, accColor, accSlug, accParseTip, accThemeColor, accNormalizeResult, accSourceIds," +
  " accDataText, accPrompt, accCardKey, accStoreNormalize, accStorePut, accAiEntity," +
  " accRunAnalysis, accEditorSchema, accEditorLabel," +
  " accSparkSvg, accAgo, accFmtNum };",
  ctx
);
const api = ctx.__api;
const LANGS = ["en", "it"];

/* Fake Home Assistant used by several tests (demo data only). */
function demoHass(extra) {
  return Object.assign({
    language: "en", locale: { language: "en" }, user: { is_admin: true },
    states: {
      "sensor.living_room_temperature": { state: "24.6", attributes: { friendly_name: "Living room temperature", unit_of_measurement: "°C", device_class: "temperature" } },
      "sensor.living_room_co2": { state: "1180", attributes: { friendly_name: "Living room CO2", unit_of_measurement: "ppm", device_class: "carbon_dioxide" } },
      "sensor.bedroom_humidity": { state: "unavailable", attributes: { friendly_name: "Bedroom humidity", unit_of_measurement: "%" } },
      "sensor.kitchen_pm25": { state: "8.1", attributes: { friendly_name: "Kitchen PM2.5", unit_of_measurement: "µg/m³" } },
      "ai_task.zeta": { state: "unknown", attributes: {} },
      "ai_task.alpha": { state: "unknown", attributes: {} }
    },
    entities: {
      "sensor.living_room_temperature": { entity_id: "sensor.living_room_temperature", area_id: "living", labels: [] },
      "sensor.living_room_co2": { entity_id: "sensor.living_room_co2", device_id: "d1", labels: [] },
      "sensor.bedroom_humidity": { entity_id: "sensor.bedroom_humidity", device_id: "d2", labels: ["comfort"] },
      "sensor.kitchen_pm25": { entity_id: "sensor.kitchen_pm25", device_id: "d1", labels: [] }
    },
    devices: { d1: { id: "d1", area_id: "kitchen", labels: ["comfort"] }, d2: { id: "d2", area_id: null, labels: [] } },
    areas: { living: { area_id: "living", name: "Living room" }, kitchen: { area_id: "kitchen", name: "Kitchen" } }
  }, extra || {});
}

test("the card registers itself in the card picker, with the former compact tag as an alias", () => {
  assert.equal(ctx.window.customCards.length, 1);
  assert.equal(ctx.window.customCards[0].type, "ai-coach-card");
  assert.ok(defined["ai-coach-card"] && defined["ai-coach-card-editor"] && defined["ai-coach-lite-card"]);
  assert.equal(api.ACC_VERSION, "9.9.9", "version comes from the URL the integration serves");
  assert.ok(Object.getPrototypeOf(defined["ai-coach-lite-card"]) === defined["ai-coach-card"]);
});

test("source file is plain ASCII and has no hard-coded version", () => {
  assert.ok(/^[\x00-\x7F]*$/.test(src));
  assert.ok(!/\d+\.\d+\.\d+/.test(src.replace(/https?:\/\/\S+/g, "")), "version only in manifest.json");
});

test("every language has exactly the keys of the English dictionary", () => {
  const en = Object.keys(api.ACC_I18N.en).sort();
  assert.ok(Object.keys(api.ACC_I18N).includes("it"));
  for (const lang of Object.keys(api.ACC_I18N)) {
    assert.deepEqual(Object.keys(api.ACC_I18N[lang]).sort(), en, "keys of '" + lang + "' differ from 'en'");
    for (const k of en) {
      const ph = (s) => (String(s).match(/\{\w+\}/g) || []).filter((p) => p !== "{{").sort().join();
      assert.equal(ph(api.ACC_I18N[lang][k]), ph(api.ACC_I18N.en[k]), "placeholders of '" + lang + "." + k + "'");
    }
  }
});

test("language follows Home Assistant, then the browser, then English", () => {
  assert.equal(api.accLang({ locale: { language: "it" } }), "it");
  assert.equal(api.accLang({ locale: { language: "it-IT" } }), "it");
  assert.equal(api.accLang({ language: "it_CH" }), "it");
  assert.equal(api.accLang({ locale: { language: "de" } }), "en");
  assert.equal(api.accLang(null), "en");
  assert.equal(api.accT("it", "msg_error", { error: "x" }), "L'analisi non \u00e8 riuscita: x");
  assert.equal(api.accT("de", "band_good"), "Good");
});

test("score bands and colours", () => {
  assert.equal(api.accBand(92).key, "band_excellent");
  assert.equal(api.accBand(60).key, "band_good");
  assert.equal(api.accBand(45).key, "band_fair");
  assert.equal(api.accBand(12).key, "band_poor");
  assert.equal(api.accColor("light-blue"), "var(--light-blue-color, var(--primary-color))");
  assert.equal(api.accColor("#ff0000"), "#ff0000");
  assert.equal(api.accColor(undefined), "var(--red-color, var(--primary-color))");
});

test("tips: theme chips in English and Italian, plain tips without chip", () => {
  assert.deepEqual({ ...api.accParseTip("Sleep: go to bed by 23:00") }, { chip: "Sleep", body: "go to bed by 23:00" });
  assert.deepEqual({ ...api.accParseTip("Attività: 20 min di camminata") }, { chip: "Attività", body: "20 min di camminata" });
  assert.equal(api.accParseTip("CO2 at 1180 ppm: open the windows").chip, null);
  assert.equal(api.accParseTip("1. Energy: shift the dishwasher").chip, "Energy");
  assert.equal(api.accParseTip("12: nothing").chip, null);
  assert.equal(api.accParseTip("https://example.org").chip, null);
  assert.equal(api.accThemeColor("Attività"), api.accThemeColor("activity"));
  assert.equal(api.accThemeColor("Aria"), api.accThemeColor("Air"));
  assert.equal(api.accThemeColor("Sonno"), "var(--purple-color, #9c27b0)");
  assert.equal(api.accThemeColor("Whatever"), api.accThemeColor("whatever"), "unknown labels get a stable colour");
});

test("AI result: clamped numbers, tips as list, at most five", () => {
  const r = api.accNormalizeResult({ summary: "  ok  ", score: 104.6, confidence: -3,
    tips: ["a", "", "b", "c", "d", "e", "f"] }, 1000);
  assert.equal(r.summary, "ok");
  assert.equal(r.score, 100);
  assert.equal(r.confidence, 0);
  assert.equal(r.tips.length, 5);
  assert.equal(r.t, 1000);
  assert.deepEqual([...api.accNormalizeResult({ tips: "one\n\ntwo" }).tips], ["one", "two"]);
  assert.equal(api.accNormalizeResult({ score: "n/a" }).score, null);
  assert.equal(api.accNormalizeResult(null).summary, "");
});

test("data sources: entities list, then label on entities and devices", () => {
  const h = demoHass();
  assert.deepEqual([...api.accSourceIds(h, { entities: ["sensor.living_room_temperature"] })], ["sensor.living_room_temperature"]);
  assert.deepEqual([...api.accSourceIds(h, { entities: ["sensor.living_room_temperature"], label: "comfort" })],
    ["sensor.living_room_temperature", "sensor.bedroom_humidity", "sensor.kitchen_pm25", "sensor.living_room_co2"]);
  assert.deepEqual([...api.accSourceIds(h, { entities: "sensor.a, sensor.b" })], ["sensor.a", "sensor.b"]);
  assert.equal(api.accSourceIds(h, {}).length, 0);
});

test("data text: name, area, value with unit, offline and missing entities", () => {
  const h = demoHass();
  const txt = api.accDataText(h, ["sensor.living_room_temperature", "sensor.living_room_co2", "sensor.bedroom_humidity", "sensor.nope"]);
  assert.equal(txt, [
    "- Living room temperature [Living room]: 24.6 °C",
    "- Living room CO2 [Kitchen]: 1180 ppm",
    "- Bedroom humidity: unavailable",
    "- sensor.nope: missing"
  ].join("\n"));
  assert.equal(api.accDataText(h, []), "No data.");
});

test("prompt: topic, data, language of the UI and extra instructions", () => {
  const p = api.accPrompt("it", { topic: "home energy", instructions: "Night tariff from 23:00." }, "- Power: 300 W", "Monday");
  assert.ok(p.includes("Topic of the analysis: home energy."));
  assert.ok(p.includes("- Power: 300 W"));
  assert.ok(p.includes("Write in Italian."));
  assert.ok(p.includes("\"Energia: ...\""));
  assert.ok(p.includes("Night tariff from 23:00."));
  assert.ok(api.accPrompt("en", { name: "Comfort" }, "x", "y").includes("Topic of the analysis: Comfort."));
  assert.deepEqual(Object.keys(api.ACC_STRUCTURE).sort(), ["confidence", "score", "summary", "tips"]);
});

test("store: key per analysed data, normalization and cap", () => {
  const a = api.accCardKey({ topic: "x", entities: ["sensor.a"], name: "One" });
  assert.equal(a, api.accCardKey({ topic: "x", entities: ["sensor.a"], name: "Two" }), "renaming keeps the result");
  assert.notEqual(a, api.accCardKey({ topic: "x", entities: ["sensor.b"] }));
  assert.equal(api.accCardKey({ storage_key: "mine" }), "mine");
  assert.deepEqual(Object.keys(api.accStoreNormalize({ results: { a: { t: 1 }, b: "bad", c: {} } }).results), ["a"]);
  let s = null;
  for (let i = 0; i < 60; i++) s = api.accStorePut(s, "k" + i, { t: i });
  assert.equal(Object.keys(s.results).length, 50);
  assert.ok(s.results.k59 && !s.results.k0, "the oldest results are dropped");
});

test("AI Task entity: configured one, otherwise the first available", () => {
  const h = demoHass();
  assert.equal(api.accAiEntity(h, {}), "ai_task.alpha");
  assert.equal(api.accAiEntity(h, { ai_task_entity: "ai_task.zeta" }), "ai_task.zeta");
  assert.equal(api.accAiEntity(h, { ai_task_entity: "ai_task.gone" }), "ai_task.alpha");
  assert.equal(api.accAiEntity({ states: {} }, {}), null);
});

test("built-in analysis calls ai_task.generate_data with a structured output", async () => {
  const calls = [];
  const h = demoHass({
    callWS: async (msg) => {
      calls.push(msg);
      return { response: { conversation_id: "x", data: { summary: "CO2 1180 ppm in the kitchen.", score: 58, confidence: 8,
        tips: ["Air: open the windows for 10 min now", "Sleep: 19 °C in the bedroom"] } } };
    }
  });
  const r = await api.accRunAnalysis(h, { topic: "indoor comfort", label: "comfort" }, "ai_task.alpha");
  assert.equal(calls.length, 1);
  const m = calls[0];
  assert.equal(m.type, "call_service");
  assert.equal(m.domain + "." + m.service, "ai_task.generate_data");
  assert.equal(m.return_response, true);
  assert.equal(m.service_data.entity_id, "ai_task.alpha");
  assert.equal(m.service_data.task_name, "ai_coach_indoor_comfort");
  assert.ok(m.service_data.instructions.includes("- Kitchen PM2.5 [Kitchen]: 8.1"));
  assert.equal(r.score, 58);
  assert.equal(r.tips.length, 2);
  await assert.rejects(api.accRunAnalysis(demoHass({ callWS: async () => ({ response: {} }) }), { entities: ["sensor.a"] }, null));
});

test("editor schema is localized, covers every option and follows the layout", () => {
  const leaves = (schema, out = []) => {
    for (const s of schema) {
      if (s.schema) leaves(s.schema, out);
      else out.push(s.name);
    }
    return out;
  };
  for (const lang of LANGS) {
    const names = leaves(api.accEditorSchema(lang, {}));
    for (const n of names) {
      const label = api.accEditorLabel(lang, n);
      assert.ok(label && !label.startsWith("ed_"), "label of " + n + " in " + lang);
    }
    for (const k of ["entities", "label", "topic", "ai_task_entity", "update_interval", "summary_entity", "update_automation",
      "stat1_template", "stat3_warn_above", "graph_entity", "layout", "tips_name"]) {
      assert.ok(names.includes(k), k + " is in the editor");
    }
    const compact = leaves(api.accEditorSchema(lang, { layout: "compact" }));
    assert.ok(!compact.includes("graph_entity") && !compact.includes("stat1_entity"), "compact hides stats and graph");
  }
});

test("sparkline, relative time and numbers", () => {
  assert.equal(api.accSparkSvg([], 0, 1, "red"), "");
  const svg = api.accSparkSvg([[0, 1], [50, 3], [100, 2]], 0, 100, "red");
  assert.ok(svg.startsWith("<svg") && svg.includes("stroke=\"red\""));
  assert.equal(api.accAgo("en", 1000, 1000 + 5 * 60000), "5 min. ago");
  assert.equal(api.accFmtNum("it", 1234.5, 1), "1234,5");
  assert.equal(api.accFmtNum("en", 3, 0), "3");
});

test("coach mode: entities are found on the device of the configured sensor", () => {
  const ents = {
    "sensor.ai_coach_energy_score": { platform: "ai_coach", device_id: "d1", translation_key: "score" },
    "sensor.ai_coach_energy_summary": { platform: "ai_coach", device_id: "d1", translation_key: "summary" },
    "sensor.ai_coach_energy_tips": { platform: "ai_coach", device_id: "d1", translation_key: "tips" },
    "button.ai_coach_energy_run_analysis": { platform: "ai_coach", device_id: "d1", translation_key: "run_analysis" },
    "binary_sensor.ai_coach_energy_analysing": { platform: "ai_coach", device_id: "d1", translation_key: "analysing" },
    "sensor.ai_coach_comfort_score": { platform: "ai_coach", device_id: "d2", translation_key: "score" },
    "sensor.other": { platform: "template", device_id: "d1", translation_key: "score" }
  };
  const sib = api.accSiblings({ entities: ents }, "sensor.ai_coach_energy_summary");
  assert.equal(sib.score, "sensor.ai_coach_energy_score");
  assert.equal(sib.tips, "sensor.ai_coach_energy_tips");
  assert.equal(sib.button, "button.ai_coach_energy_run_analysis");
  assert.equal(sib.running, "binary_sensor.ai_coach_energy_analysing");
  assert.deepEqual({ ...api.accSiblings({ entities: ents }, "sensor.other") }, {});
  assert.equal(api.accFirstCoach({ entities: ents }), "sensor.ai_coach_comfort_score");
  assert.equal(api.accFirstCoach({ entities: {} }), null);
});

test("editor: choosing an AI Coach entity hides the settings of the other sources", () => {
  const leaves = (schema, out = []) => { for (const s of schema) { if (s.schema) leaves(s.schema, out); else out.push(s.name); } return out; };
  const withCoach = leaves(api.accEditorSchema("en", { entity: "sensor.ai_coach_energy_score" }));
  assert.ok(withCoach.includes("entity") && withCoach.includes("stat1_entity"));
  assert.ok(!withCoach.includes("topic") && !withCoach.includes("summary_entity"));
  assert.equal(leaves(api.accEditorSchema("en", {}))[0], "entity");
});
