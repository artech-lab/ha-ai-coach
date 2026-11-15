/*
 * AI Coach Card for Home Assistant
 * https://github.com/artech-lab/ha-ai-coach
 *
 * Dashboard card bundled with the AI Coach integration, which serves and
 * loads it automatically (no dashboard resource needed). It shows a 0-100
 * score, a short summary, up to five actionable tips with colour-coded themes
 * and a confidence bar; the full layout adds up to three live statistics and
 * a sparkline, the compact layout keeps only the essentials.
 *
 * Three sources, chosen by the configuration:
 * - coach: "entity" is a sensor of an AI Coach entry. The integration runs the
 *   analysis on the server; every value is read from the device of that
 *   sensor and the refresh button presses its "Run analysis" button.
 * - helpers: summary_entity / score_entity / tipN_entity written by your own
 *   automations; refresh triggers update_automation.
 * - built-in: entities / label only. The card asks the AI Task integration
 *   itself while the dashboard is open and keeps the result per user.
 *
 * Copyright (C) 2026 The ha-ai-coach contributors
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version. This program is distributed in the hope that it will be
 * useful, but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General
 * Public License for more details: <https://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 *
 * The source is plain ASCII: non-ASCII characters are written as \u escapes.
 */

/* The integration appends its manifest version to the URL of this module. */
const ACC_VERSION = new URL(import.meta.url).searchParams.get("v") || "dev";
const ACC_TAG = "ai-coach-card";
const ACC_EDITOR_TAG = ACC_TAG + "-editor";
/* Former name of the compact variant: still accepted, rendered with layout "compact". */
const ACC_LEGACY_TAG = "ai-coach-lite-card";
const ACC_REPO_URL = "https://github.com/artech-lab/ha-ai-coach";
const ACC_INTEGRATION = "ai_coach";
/* translation_key of the AI Coach entities -> role in the card */
const ACC_SIBLINGS = { score: "score", confidence: "confidence", summary: "summary", tips: "tips",
  last_analysis: "last", analysing: "running", problem: "problem", run_analysis: "button" };
const ACC_STORE_KEY = "ai_coach_card";
const ACC_STORE_MAX = 50;
const ACC_HOUR = 3600000;
const ACC_RETRY_MS = 15 * 60000;
const ACC_MAX_TIPS = 5;
const ACC_MAX_SOURCES = 60;
const ACC_DOT = "\u00b7";

const ACC_DEFAULTS = {
  layout: "full",
  icon: "mdi:robot",
  color: "red",
  update_interval: 6,
  graph_hours: 24
};

/* ------------------------------------------------------------------ */
/* Translations                                                        */
/* ------------------------------------------------------------------ */

const ACC_I18N = {
  en: {
    picker_name: "AI Coach Card",
    picker_desc: "AI coach for any group of entities: score, summary, actionable tips and confidence, from the AI Coach integration or the card itself. Full or compact layout.",
    default_name: "AI Coach",
    default_tips: "Tips",
    stub_topic: "indoor comfort and air quality at home",
    sub_ai: "AI analysis",
    sub_updated: "updated {ago}",
    sub_running: "analysing\u2026",
    sub_failed: "analysis failed",
    refresh: "Refresh analysis",
    band_excellent: "Excellent",
    band_good: "Good",
    band_fair: "Needs attention",
    band_poor: "Critical",
    confidence: "Confidence",
    msg_no_ai: "No AI Task entity found. Set up an AI integration that supports AI tasks (for example OpenAI, Google Gemini, Anthropic or Ollama), then reload the page.",
    msg_no_data: "Choose the entities to analyse in the card editor.",
    msg_first: "Press refresh to run the first analysis.",
    msg_running: "The AI is analysing the data. It can take up to a minute.",
    msg_waiting: "Waiting for the first analysis.",
    msg_error: "The analysis failed: {error}",
    ai_language: "English",
    ai_example: "Energy",
    ed_name: "Name",
    ed_icon: "Icon",
    ed_color: "Colour",
    ed_layout: "Layout",
    ed_layout_full: "Full: statistics and graph",
    ed_layout_compact: "Compact: score, summary and tips",
    ed_tips_name: "Tips title",
    ed_g_ai: "AI analysis",
    ed_topic: "Topic",
    ed_entities: "Entities to analyse",
    ed_label: "Or every entity with this label",
    ed_instructions: "Extra instructions for the AI",
    ed_ai_task_entity: "AI Task entity",
    ed_update_interval: "Update every",
    ed_g_linked: "Linked helpers",
    ed_summary_entity: "Summary (input_text)",
    ed_score_entity: "Score (input_number)",
    ed_confidence_entity: "Confidence (input_number)",
    ed_tip1_entity: "Tip 1 (input_text)",
    ed_tip2_entity: "Tip 2 (input_text)",
    ed_tip3_entity: "Tip 3 (input_text)",
    ed_tip4_entity: "Tip 4 (input_text)",
    ed_tip5_entity: "Tip 5 (input_text)",
    ed_update_automation: "Automation of the analysis",
    ed_g_stats: "Statistics",
    ed_g_stat1: "Statistic 1",
    ed_g_stat2: "Statistic 2",
    ed_g_stat3: "Statistic 3",
    ed_stat_icon: "Icon",
    ed_stat_name: "Name",
    ed_stat_entity: "Entity",
    ed_stat_template: "Or a template",
    ed_stat_decimals: "Decimals",
    ed_stat_suffix: "Suffix",
    ed_stat_warn_above: "Highlight above",
    ed_g_graph: "Graph",
    ed_graph_entity: "Sensor",
    ed_graph_name: "Label",
    ed_graph_hours: "Period",
    edh_topic: "What the AI should evaluate, in a few words, for example \"energy use of the home\".",
    edh_label: "Entities and devices with this label are added to the list.",
    edh_ai_task_entity: "Empty: the first AI Task entity found.",
    edh_update_interval: "0 = only when you press refresh.",
    edh_stat_template: "Jinja template, for example {{ states('sensor.a') | float + states('sensor.b') | float }}.",
    edh_summary_entity: "When set, the card shows these helpers instead of its own analysis.",
    ed_entity: "AI Coach",
    edh_entity: "Any sensor of an AI Coach entry: the analysis then runs in Home Assistant and the AI analysis and linked helpers settings are not needed.",
    msg_no_coach: "This is not a sensor of the AI Coach integration. Choose one in the card editor.",
  },
  it: {
    picker_name: "AI Coach Card",
    picker_desc: "Coach AI per qualunque gruppo di entit\u00e0: punteggio, sintesi, consigli attuabili e affidabilit\u00e0, dall\u2019integrazione AI Coach o dalla card stessa. Layout completo o compatto.",
    default_name: "Coach AI",
    default_tips: "Consigli",
    stub_topic: "comfort e qualit\u00e0 dell'aria in casa",
    sub_ai: "Analisi AI",
    sub_updated: "aggiornata {ago}",
    sub_running: "analisi in corso\u2026",
    sub_failed: "analisi non riuscita",
    refresh: "Aggiorna analisi",
    band_excellent: "Ottimo",
    band_good: "Buono",
    band_fair: "Attenzione",
    band_poor: "Critico",
    confidence: "Affidabilit\u00e0",
    msg_no_ai: "Nessuna entit\u00e0 AI Task trovata. Configura un'integrazione AI che supporta le attivit\u00e0 AI (per esempio OpenAI, Google Gemini, Anthropic o Ollama), poi ricarica la pagina.",
    msg_no_data: "Scegli le entit\u00e0 da analizzare nell'editor della card.",
    msg_first: "Premi aggiorna per avviare la prima analisi.",
    msg_running: "L'AI sta analizzando i dati. Pu\u00f2 richiedere fino a un minuto.",
    msg_waiting: "In attesa della prima analisi.",
    msg_error: "L'analisi non \u00e8 riuscita: {error}",
    ai_language: "Italian",
    ai_example: "Energia",
    ed_name: "Nome",
    ed_icon: "Icona",
    ed_color: "Colore",
    ed_layout: "Layout",
    ed_layout_full: "Completo: statistiche e grafico",
    ed_layout_compact: "Compatto: punteggio, sintesi e consigli",
    ed_tips_name: "Titolo dei consigli",
    ed_g_ai: "Analisi AI",
    ed_topic: "Argomento",
    ed_entities: "Entit\u00e0 da analizzare",
    ed_label: "Oppure tutte le entit\u00e0 con questa etichetta",
    ed_instructions: "Istruzioni aggiuntive per l'AI",
    ed_ai_task_entity: "Entit\u00e0 AI Task",
    ed_update_interval: "Aggiorna ogni",
    ed_g_linked: "Helper collegati",
    ed_summary_entity: "Sintesi (input_text)",
    ed_score_entity: "Punteggio (input_number)",
    ed_confidence_entity: "Affidabilit\u00e0 (input_number)",
    ed_tip1_entity: "Consiglio 1 (input_text)",
    ed_tip2_entity: "Consiglio 2 (input_text)",
    ed_tip3_entity: "Consiglio 3 (input_text)",
    ed_tip4_entity: "Consiglio 4 (input_text)",
    ed_tip5_entity: "Consiglio 5 (input_text)",
    ed_update_automation: "Automazione dell'analisi",
    ed_g_stats: "Statistiche",
    ed_g_stat1: "Statistica 1",
    ed_g_stat2: "Statistica 2",
    ed_g_stat3: "Statistica 3",
    ed_stat_icon: "Icona",
    ed_stat_name: "Nome",
    ed_stat_entity: "Entit\u00e0",
    ed_stat_template: "Oppure un template",
    ed_stat_decimals: "Decimali",
    ed_stat_suffix: "Suffisso",
    ed_stat_warn_above: "Evidenzia sopra",
    ed_g_graph: "Grafico",
    ed_graph_entity: "Sensore",
    ed_graph_name: "Etichetta",
    ed_graph_hours: "Periodo",
    edh_topic: "Cosa deve valutare l'AI, in poche parole, per esempio \"consumi energetici della casa\".",
    edh_label: "Le entit\u00e0 e i dispositivi con questa etichetta vengono aggiunti all'elenco.",
    edh_ai_task_entity: "Vuoto: la prima entit\u00e0 AI Task trovata.",
    edh_update_interval: "0 = solo quando premi aggiorna.",
    edh_stat_template: "Template Jinja, per esempio {{ states('sensor.a') | float + states('sensor.b') | float }}.",
    edh_summary_entity: "Se impostati, la card mostra questi helper al posto della propria analisi.",
    ed_entity: "AI Coach",
    edh_entity: "Un sensore qualsiasi di una voce AI Coach: l\u2019analisi viene eseguita da Home Assistant e le impostazioni di analisi AI e helper collegati non servono.",
    msg_no_coach: "Questo non \u00e8 un sensore dell\u2019integrazione AI Coach. Scegline uno nell\u2019editor della card.",
  }
};

/* Language of the Home Assistant UI, falling back to the browser and then English. */
function accLang(hass) {
  let raw = "";
  if (hass && hass.locale && hass.locale.language) raw = hass.locale.language;
  else if (hass && hass.language) raw = hass.language;
  else if (typeof navigator !== "undefined" && navigator.language) raw = navigator.language;
  const l = String(raw || "en").toLowerCase().replace("_", "-");
  if (ACC_I18N[l]) return l;
  const base = l.split("-")[0];
  return ACC_I18N[base] ? base : "en";
}
function accHasKey(lang, key) {
  return (ACC_I18N[lang] && ACC_I18N[lang][key] !== undefined) || ACC_I18N.en[key] !== undefined;
}
function accT(lang, key, vars) {
  const dict = ACC_I18N[lang] || ACC_I18N.en;
  let s = dict[key];
  if (s === undefined) s = ACC_I18N.en[key];
  if (s === undefined) s = key;
  return String(s).replace(/\{(\w+)\}/g, function (m, k) {
    return vars && vars[k] !== undefined && vars[k] !== null ? String(vars[k]) : m;
  });
}

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

function accState(hass, id) { return id && hass && hass.states ? hass.states[id] || null : null; }
function accVal(hass, id) {
  const st = accState(hass, id);
  if (!st) return null;
  const s = st.state;
  if (s === null || s === undefined || s === "unknown" || s === "unavailable" || s === "") return null;
  return s;
}
function accNum(hass, id) {
  const s = accVal(hass, id);
  if (s === null) return null;
  const n = Number(s);
  return isNaN(n) ? null : n;
}
function accEsc(t) {
  return String(t === undefined || t === null ? "" : t).replace(/[<>&"]/g, function (c) {
    return { "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" }[c];
  });
}
function accClamp(v, lo, hi) {
  const n = Number(v);
  if (!isFinite(n)) return null;
  return Math.max(lo, Math.min(hi, n));
}
function accFmtNum(lang, v, dec) {
  const n = Number(v);
  if (!isFinite(n)) return String(v);
  const d = Math.max(0, Math.min(3, Number(dec) || 0));
  try {
    return new Intl.NumberFormat(lang, { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  } catch (e) {
    return n.toFixed(d);
  }
}
/* "5 min ago", "2 hr. ago", "yesterday"... in the language of the UI */
function accAgo(lang, ms, now) {
  const s = Math.round(((now === undefined ? Date.now() : now) - ms) / 1000);
  let v, unit;
  if (s < 45) { v = 0; unit = "second"; }
  else if (s < 3600) { v = Math.max(1, Math.round(s / 60)); unit = "minute"; }
  else if (s < 86400) { v = Math.round(s / 3600); unit = "hour"; }
  else { v = Math.round(s / 86400); unit = "day"; }
  try {
    return new Intl.RelativeTimeFormat(lang, { numeric: "auto", style: "short" }).format(-v, unit);
  } catch (e) {
    return v + " " + unit.charAt(0);
  }
}
function accBand(score) {
  if (score >= 80) return { key: "band_excellent", color: "var(--green-color, #4caf50)" };
  if (score >= 60) return { key: "band_good", color: "var(--light-green-color, #8bc34a)" };
  if (score >= 40) return { key: "band_fair", color: "var(--amber-color, #ffc107)" };
  return { key: "band_poor", color: "var(--red-color, #f44336)" };
}
function accConfColor(v) {
  if (v >= 7) return "var(--green-color, #4caf50)";
  if (v >= 4) return "var(--amber-color, #ffc107)";
  return "var(--red-color, #f44336)";
}
/* Theme colour token ("red", "light-blue"...) to a CSS colour. */
function accColor(token) {
  const t = String(token || ACC_DEFAULTS.color).trim();
  if (/^(#|rgb|hsl|var\()/i.test(t)) return t;
  return "var(--" + t.replace(/[^a-z0-9-]/gi, "") + "-color, var(--primary-color))";
}
const ACC_DIACRITICS = new RegExp("[\u0300-\u036f]", "g");
function accNorm(s) { return String(s).toLowerCase().normalize("NFD").replace(ACC_DIACRITICS, ""); }
/* Object id that Home Assistant derives from a helper name (accents are transliterated). */
function accSlug(s) {
  return accNorm(s).replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function accHash(s) {
  let h = 5381;
  const str = String(s);
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
function accErrText(err) {
  if (!err) return "unknown error";
  if (typeof err === "string") return err;
  if (err.body && err.body.message) return String(err.body.message);
  if (err.message) return String(err.message);
  if (err.error) return String(err.error);
  if (typeof err.body === "string" && err.body) return err.body;
  try { return JSON.stringify(err); } catch (e) { return String(err); }
}
function accDelay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ------------------------------------------------------------------ */
/* Tip themes                                                          */
/* ------------------------------------------------------------------ */

/* Known theme labels (English and Italian, accents removed) and their colours. Tips
   written as "Label: text" get a chip; unknown labels get a stable colour from the palette. */
const ACC_THEME_GROUPS = [
  ["var(--green-color, #4caf50)", ["activity", "exercise", "movement", "steps", "attivita", "movimento", "passi", "esercizio"]],
  ["var(--purple-color, #9c27b0)", ["sleep", "rest", "sonno", "riposo"]],
  ["var(--cyan-color, #00bcd4)", ["hydration", "water", "idratazione", "acqua"]],
  ["var(--amber-color, #ffc107)", ["nutrition", "food", "diet", "alimentazione", "cibo", "dieta", "energy", "power", "energia", "consumi"]],
  ["var(--teal-color, #009688)", ["recovery", "stress", "relax", "recupero", "mindfulness"]],
  ["var(--blue-grey-color, #607d8b)", ["data", "sensors", "dati", "sensori"]],
  ["var(--light-blue-color, #03a9f4)", ["air", "ventilation", "co2", "aria", "ventilazione", "ricambio"]],
  ["var(--deep-orange-color, #ff5722)", ["temperature", "heating", "cooling", "climate", "temperatura", "riscaldamento", "raffrescamento", "clima"]],
  ["var(--indigo-color, #3f51b5)", ["humidity", "umidita"]],
  ["var(--light-green-color, #8bc34a)", ["savings", "cost", "solar", "risparmio", "costi", "solare", "fotovoltaico"]],
  ["var(--yellow-color, #ffeb3b)", ["light", "lighting", "luce", "luci", "illuminazione"]],
  ["var(--red-color, #f44336)", ["security", "safety", "alarm", "sicurezza", "allarme"]],
  ["var(--brown-color, #795548)", ["maintenance", "manutenzione", "devices", "dispositivi"]]
];
const ACC_THEMES = {};
for (const g of ACC_THEME_GROUPS) for (const k of g[1]) ACC_THEMES[k] = g[0];
const ACC_PALETTE = ["var(--blue-color, #2196f3)", "var(--orange-color, #ff9800)", "var(--pink-color, #e91e63)",
  "var(--deep-purple-color, #673ab7)", "var(--lime-color, #cddc39)", "var(--teal-color, #009688)"];

/* Splits "Label: text" into a chip and a body. */
function accParseTip(text) {
  const t = String(text || "").trim().replace(/^(?:[-*\u2022]|\d+[.)])\s+/, "");
  const m = t.match(/^([^\s:]{2,20})\s*:\s*([^]+)$/);
  if (m && !/^\d+$/.test(m[1]) && !/^https?$/i.test(m[1])) return { chip: m[1], body: m[2].trim() };
  return { chip: null, body: t };
}
function accThemeColor(chip, index) {
  if (chip) {
    const k = accNorm(chip);
    if (ACC_THEMES[k]) return ACC_THEMES[k];
    return ACC_PALETTE[parseInt(accHash(k), 36) % ACC_PALETTE.length];
  }
  return ACC_PALETTE[(index || 0) % ACC_PALETTE.length];
}

/* ------------------------------------------------------------------ */
/* Data sources and the AI request                                     */
/* ------------------------------------------------------------------ */

function accList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.filter(function (x) { return typeof x === "string" && x; });
  if (typeof v === "string") return v.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
  return [];
}
/* Entity ids analysed by the card: the "entities" list, then every entity with the label
   and the sensors of every device with the label. */
function accSourceIds(hass, cfg) {
  const out = [];
  const add = function (id) { if (id && out.indexOf(id) < 0 && out.length < ACC_MAX_SOURCES) out.push(id); };
  accList(cfg.entities).forEach(add);
  const label = cfg.label;
  if (label && hass) {
    const ents = hass.entities || {}, devs = hass.devices || {};
    const ids = Object.keys(ents).sort();
    for (const id of ids) {
      const e = ents[id];
      if (e && Array.isArray(e.labels) && e.labels.indexOf(label) >= 0) add(id);
    }
    for (const id of ids) {
      const e = ents[id];
      const d = e && e.device_id ? devs[e.device_id] : null;
      if (d && Array.isArray(d.labels) && d.labels.indexOf(label) >= 0 &&
        (id.indexOf("sensor.") === 0 || id.indexOf("binary_sensor.") === 0) && !e.entity_category) add(id);
    }
  }
  return out;
}
function accAreaName(hass, id) {
  if (!hass) return "";
  const e = hass.entities && hass.entities[id];
  let area = e && e.area_id;
  if (!area && e && e.device_id && hass.devices && hass.devices[e.device_id]) area = hass.devices[e.device_id].area_id;
  return area && hass.areas && hass.areas[area] ? hass.areas[area].name || "" : "";
}
/* One line per entity, the same format the automation produces with Jinja. */
function accDataText(hass, ids) {
  const lines = [];
  for (const id of ids) {
    const st = accState(hass, id);
    if (!st) { lines.push("- " + id + ": missing"); continue; }
    const name = (st.attributes && st.attributes.friendly_name) || id;
    const area = accAreaName(hass, id);
    const unit = st.attributes && st.attributes.unit_of_measurement;
    const raw = st.state;
    const val = raw === "unavailable" || raw === "unknown" ? raw : raw + (unit ? " " + unit : "");
    lines.push("- " + name + (area ? " [" + area + "]" : "") + ": " + val);
  }
  return lines.length ? lines.join("\n") : "No data.";
}
function accTopic(lang, cfg) {
  return String(cfg.topic || cfg.name || accT(lang, "default_name")).trim();
}
/* Instructions of the AI task. The prompt is in English (best understood by every model);
   the answer is requested in the language of the UI. */
function accPrompt(lang, cfg, dataText, whenText) {
  const language = accT(lang, "ai_language");
  const extra = String(cfg.instructions || "").trim();
  return [
    "You are an AI coach inside the Home Assistant smart home app. You analyse real data collected automatically and propose practical, concrete actions.",
    "",
    "Topic of the analysis: " + accTopic(lang, cfg) + ".",
    "Date and time: " + whenText + ".",
    "",
    "Data (name [area]: value unit). \"unavailable\" means the sensor is offline and \"unknown\" or \"missing\" that it has no value: never invent those values and do not base advice on them, consider them only for the confidence.",
    dataText,
    extra ? "\nAdditional instructions from the user:\n" + extra + "\n" : "",
    "Write in " + language + ". Provide:",
    "1. summary: the current situation in at most 220 characters, citing the most relevant value with its unit and where it comes from.",
    "2. tips: from 3 to " + ACC_MAX_TIPS + " actionable tips, at most 250 characters each, each about a different theme. Start every tip with a one-word theme label in " + language + " followed by a colon (for example \"" + accT(lang, "ai_example") + ": ...\"). After the label cite the current value and how far it is from a sensible target, then a concrete action with quantity or duration and when to do it. No generic advice.",
    "3. score: overall score from 5 to 100, consistent with the summary: 80-100 excellent, 60-79 good, 40-59 needs attention, 5-39 critical.",
    "4. confidence: from 1 to 10, only about how complete and consistent the data is (10 = every value available and coherent), not about how good the situation is."
  ].join("\n");
}
const ACC_STRUCTURE = {
  summary: { description: "Current situation in at most 220 characters, with the most relevant value", required: true, selector: { text: {} } },
  score: { description: "Overall score from 5 to 100, consistent with the summary", required: true, selector: { number: { min: 5, max: 100 } } },
  tips: { description: "3 to 5 actionable tips, each starting with a one-word theme label and a colon", required: true, selector: { text: { multiple: true } } },
  confidence: { description: "Confidence from 1 to 10 about completeness and consistency of the data", required: true, selector: { number: { min: 1, max: 10 } } }
};
/* Validates the structured output of the AI task. */
function accNormalizeResult(data, now) {
  const d = data && typeof data === "object" ? data : {};
  let tips = d.tips;
  if (typeof tips === "string") tips = tips.split(/\n+/);
  tips = (Array.isArray(tips) ? tips : []).map(function (t) { return String(t || "").trim(); })
    .filter(Boolean).slice(0, ACC_MAX_TIPS);
  const score = accClamp(d.score, 0, 100);
  const conf = accClamp(d.confidence, 0, 10);
  return {
    t: now === undefined ? Date.now() : now,
    summary: String(d.summary || "").trim().slice(0, 500),
    score: score === null ? null : Math.round(score),
    confidence: conf === null ? null : Math.round(conf),
    tips: tips
  };
}
/* The AI Task entity: the configured one, otherwise the first one available. */
function accAiEntity(hass, cfg) {
  if (!hass || !hass.states) return null;
  if (cfg.ai_task_entity && hass.states[cfg.ai_task_entity]) return cfg.ai_task_entity;
  const ids = Object.keys(hass.states).filter(function (id) {
    return id.indexOf("ai_task.") === 0 && hass.states[id].state !== "unavailable";
  }).sort();
  return ids.length ? ids[0] : null;
}
function accWhen(lang, d) {
  try {
    return new Intl.DateTimeFormat("en-GB", { weekday: "long", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
  } catch (e) { return d.toISOString(); }
}
async function accRunAnalysis(hass, cfg, aiEntity) {
  const lang = accLang(hass);
  const ids = accSourceIds(hass, cfg);
  const data = {
    task_name: "ai_coach_" + (accSlug(accTopic(lang, cfg)) || "analysis"),
    instructions: accPrompt(lang, cfg, accDataText(hass, ids), accWhen(lang, new Date())),
    structure: ACC_STRUCTURE
  };
  if (aiEntity) data.entity_id = aiEntity;
  const res = await hass.callWS({ type: "call_service", domain: "ai_task", service: "generate_data",
    service_data: data, return_response: true });
  const payload = res && res.response ? res.response : res;
  if (!payload || !payload.data || typeof payload.data !== "object") throw new Error("no structured data in the AI response");
  return accNormalizeResult(payload.data);
}

/* ------------------------------------------------------------------ */
/* Result store (frontend user data, per Home Assistant user)          */
/* ------------------------------------------------------------------ */

/* Key of a card in the store: changes when what is analysed changes. */
function accCardKey(cfg) {
  if (cfg.storage_key) return String(cfg.storage_key);
  return "k" + accHash(JSON.stringify([String(cfg.topic || ""), accList(cfg.entities), String(cfg.label || "")]));
}
function accStoreNormalize(value) {
  const v = value && typeof value === "object" ? value : {};
  const results = v.results && typeof v.results === "object" ? v.results : {};
  const out = {};
  for (const k of Object.keys(results)) {
    const r = results[k];
    if (r && typeof r === "object" && typeof r.t === "number") out[k] = r;
  }
  return { v: 1, results: out };
}
function accStorePut(store, key, result) {
  const s = accStoreNormalize(store);
  s.results[key] = result;
  const keys = Object.keys(s.results).sort(function (a, b) { return s.results[b].t - s.results[a].t; });
  for (const k of keys.slice(ACC_STORE_MAX)) delete s.results[k];
  return s;
}
let accStoreCache = null;
let accStoreLoading = null;
async function accStoreLoad(hass, force) {
  if (accStoreCache && !force) return accStoreCache;
  if (accStoreLoading && !force) return accStoreLoading;
  accStoreLoading = (async function () {
    try {
      const r = await hass.callWS({ type: "frontend/get_user_data", key: ACC_STORE_KEY });
      accStoreCache = accStoreNormalize(r && r.value);
    } catch (e) {
      accStoreCache = accStoreCache || accStoreNormalize(null);
    }
    accStoreLoading = null;
    return accStoreCache;
  })();
  return accStoreLoading;
}
/* Re-reads before writing, so results saved from other devices are kept. */
async function accStoreSave(hass, key, result) {
  const fresh = await accStoreLoad(hass, true);
  accStoreCache = accStorePut(fresh, key, result);
  try { await hass.callWS({ type: "frontend/set_user_data", key: ACC_STORE_KEY, value: accStoreCache }); } catch (e) { /* keep in memory */ }
  return accStoreCache;
}
/* Content of a result without its time: tells when an automation has written new values. */
function accContentSig(r) {
  return r ? JSON.stringify([r.summary, r.score, r.confidence, r.tips]) : "";
}
/* Cards on the page, to refresh every card that shows the same analysis. */
const accCards = new Set();
const accRunning = {};

/* ------------------------------------------------------------------ */
/* Sparkline                                                           */
/* ------------------------------------------------------------------ */

function accSparkSvg(pts, start, end, color) {
  if (!pts || !pts.length) return "";
  let lo = Infinity, hi = -Infinity;
  for (const p of pts) { if (p[1] < lo) lo = p[1]; if (p[1] > hi) hi = p[1]; }
  if (hi - lo < 0.001) { hi += 1; lo -= 1; }
  const pad = (hi - lo) * 0.1;
  lo -= pad; hi += pad;
  const W = 480, H = 70, span = Math.max(1, end - start);
  const step = Math.max(1, Math.floor(pts.length / 160));
  let line = "", lx = "0", ly = "0";
  const sel = [];
  for (let i = 0; i < pts.length; i += step) sel.push(pts[i]);
  if (sel[sel.length - 1] !== pts[pts.length - 1]) sel.push(pts[pts.length - 1]);
  for (let i = 0; i < sel.length; i++) {
    const p = sel[i];
    lx = Math.max(0, Math.min(W, (p[0] - start) / span * W)).toFixed(1);
    ly = (H - 4 - (p[1] - lo) / (hi - lo) * (H - 8)).toFixed(1);
    if (!line) line = "M0 " + ly + " L" + lx + " " + ly;
    else line += " L" + lx + " " + ly;
  }
  line += " L" + W + " " + ly;
  return '<svg viewBox="0 0 ' + W + " " + H + '" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">' +
    '<path d="' + line + " L" + W + " " + H + " L0 " + H + ' Z" fill="' + color + '" opacity="0.14" stroke="none"/>' +
    '<path d="' + line + '" fill="none" stroke="' + color + '" stroke-width="2" vector-effect="non-scaling-stroke" stroke-linejoin="round"/></svg>';
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

const ACC_CSS =
  ":host{display:block}" +
  "ha-card{padding:12px 16px 14px;height:100%;box-sizing:border-box}" +
  ".head{display:flex;align-items:center;gap:10px;padding:2px 0 10px}" +
  ".hic{width:38px;height:38px;min-width:38px;border-radius:50%;display:flex;align-items:center;justify-content:center;" +
  "color:var(--acc-color);background:color-mix(in srgb, var(--acc-color) 20%, transparent)}" +
  ".hic ha-icon{--mdc-icon-size:21px}" +
  ".ht{flex:1;min-width:0}" +
  ".htitle{font-size:16px;font-weight:600;color:var(--primary-text-color);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  ".hsub{font-size:12px;color:var(--secondary-text-color);line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  ".hsub.err{color:var(--error-color, #db4437)}" +
  ".refresh{width:36px;height:36px;min-width:36px;border-radius:50%;border:none;background:none;padding:0;display:flex;" +
  "align-items:center;justify-content:center;cursor:pointer;color:var(--secondary-text-color)}" +
  ".refresh:hover{background:color-mix(in srgb, var(--primary-text-color) 8%, transparent)}" +
  ".refresh:focus-visible{outline:2px solid var(--primary-color);outline-offset:1px}" +
  ".refresh[hidden]{display:none}" +
  ".refresh.spin ha-icon{animation:accspin 1s linear infinite}" +
  "@keyframes accspin{from{transform:rotate(0)}to{transform:rotate(360deg)}}" +
  "[hidden]{display:none !important}" +
  ".scorerow{display:flex;align-items:baseline;gap:6px}" +
  ".score{font-size:26px;font-weight:700;color:var(--primary-text-color);line-height:1}" +
  ".scoremax{font-size:13px;color:var(--secondary-text-color)}" +
  ".band{margin-left:auto;font-size:13px;font-weight:600}" +
  ".bar{height:8px;border-radius:4px;background:color-mix(in srgb, var(--primary-text-color) 12%, transparent);overflow:hidden}" +
  ".sbar{margin:8px 0 12px}" +
  ".fill{height:100%;border-radius:4px;transition:width .4s ease}" +
  ".box{border-radius:14px;background:color-mix(in srgb, var(--primary-text-color) 7%, transparent);padding:10px 12px;" +
  "display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}" +
  ".box ha-icon{--mdc-icon-size:18px;color:var(--secondary-text-color);margin-top:1px;flex:none}" +
  ".summary{font-size:13.5px;font-style:italic;color:var(--primary-text-color);line-height:1.45;min-width:0}" +
  ".msg{font-size:13px;color:var(--secondary-text-color);line-height:1.45;min-width:0}" +
  ".msg.err{color:var(--error-color, #db4437)}" +
  ".stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}" +
  ".stat{display:flex;align-items:center;gap:6px;border:1px solid var(--divider-color);border-radius:12px;padding:6px 10px;min-width:0}" +
  ".stat ha-icon{--mdc-icon-size:16px;color:var(--acc-color)}" +
  ".statv{font-size:13px;font-weight:700;color:var(--primary-text-color);white-space:nowrap}" +
  ".statv.warn{color:var(--warning-color, #ff9800)}" +
  ".statn{font-size:11.5px;color:var(--secondary-text-color);white-space:nowrap}" +
  ".tipshead{font-size:12px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--secondary-text-color);margin:2px 0 8px}" +
  ".tipshead b{color:var(--acc-color)}" +
  ".tip{border-radius:12px;background:color-mix(in srgb, var(--primary-text-color) 6%, transparent);" +
  "border-left:4px solid var(--tipc);padding:8px 12px 9px;margin-bottom:8px}" +
  ".chip{display:inline-block;font-size:10.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--tipc);" +
  "background:color-mix(in srgb, var(--tipc) 16%, transparent);border-radius:9px;padding:2px 8px;margin-bottom:4px}" +
  ".tiptext{font-size:13px;color:var(--primary-text-color);line-height:1.45}" +
  ".conf{display:flex;align-items:center;gap:10px;margin-top:12px}" +
  ".conflab{font-size:12px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;color:var(--secondary-text-color)}" +
  ".conf .bar{flex:1;height:7px}" +
  ".confval{font-size:12px;font-weight:600;color:var(--primary-text-color);white-space:nowrap}" +
  ".graph{margin-top:12px;padding-top:10px;border-top:1px solid var(--divider-color);cursor:pointer}" +
  ".ghead{display:flex;align-items:baseline;gap:8px;margin-bottom:4px}" +
  ".gval{font-size:16px;font-weight:700;color:var(--primary-text-color);white-space:nowrap}" +
  ".gname{font-size:12px;color:var(--secondary-text-color);flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
  ".ghead ha-icon{--mdc-icon-size:16px;color:var(--secondary-text-color)}" +
  ".gplot svg{display:block;width:100%;height:56px}";

class AiCoachCard extends HTMLElement {
  static getConfigElement() { return document.createElement(ACC_EDITOR_TAG); }
  /* A working card for the picker: environmental sensors of the instance, if any. */
  static getStubConfig(hass) {
    const lang = accLang(hass);
    const coach = accFirstCoach(hass);
    if (coach) return { entity: coach };
    const states = (hass && hass.states) || {};
    const wanted = ["temperature", "humidity", "carbon_dioxide", "pm25", "volatile_organic_compounds"];
    const ids = Object.keys(states).filter(function (id) {
      return id.indexOf("sensor.") === 0 && wanted.indexOf(states[id].attributes && states[id].attributes.device_class) >= 0;
    }).sort().slice(0, 8);
    const cfg = { name: "Comfort", icon: "mdi:home-thermometer", color: "light-blue", topic: accT(lang, "stub_topic") };
    if (ids.length) cfg.entities = ids;
    return cfg;
  }

  constructor() {
    super();
    this._legacy = false;
    this._tpl = {};
    this._unsubs = [];
  }

  setConfig(config) {
    if (!config || typeof config !== "object") throw new Error("Invalid configuration");
    const base = Object.assign({}, ACC_DEFAULTS, this._legacy ? { layout: "compact" } : {});
    this._c = Object.assign(base, config);
    if (this._c.layout !== "compact") this._c.layout = "full";
    this._key = accCardKey(this._c);
    this._built = false;
    this._sig = null;
    this._graph = null;
    this._lastGraph = 0;
    this._error = null;
    this._lastAttempt = 0;
    this._unsubscribe();
    if (this.isConnected) { this._build(); this._subscribe(); }
  }

  getCardSize() { return this._c && this._c.layout === "compact" ? 5 : 7; }
  getGridOptions() { return { columns: 12, rows: "auto", min_columns: 6 }; }

  connectedCallback() {
    accCards.add(this);
    if (!this._built && this._c) this._build();
    this._subscribe();
    const self = this;
    if (!this._timer) this._timer = setInterval(function () { self._tick(); }, 60000);
  }
  disconnectedCallback() {
    accCards.delete(this);
    if (this._timer) { clearInterval(this._timer); this._timer = null; }
    this._unsubscribe();
  }

  /* Analysis mode: "entities" when helpers are linked, "builtin" otherwise. */
  _mode() {
    const c = this._c;
    if (c.entity) return "coach";
    if (c.summary_entity || c.score_entity || c.tip1_entity) return "entities";
    return "builtin";
  }
  _full() { return this._c.layout !== "compact"; }
  _sib() { return this._c.entity ? accSiblings(this._h, this._c.entity) : {}; }
  _lang() { return accLang(this._h); }

  _stats() {
    const c = this._c, out = [];
    if (!this._full()) return out;
    for (let i = 1; i <= 3; i++) {
      const p = "stat" + i + "_";
      if (c[p + "entity"] || c[p + "template"]) {
        out.push({ i: i, icon: c[p + "icon"] || "mdi:chart-box-outline", name: c[p + "name"] || "",
          entity: c[p + "entity"], template: c[p + "template"], decimals: c[p + "decimals"],
          suffix: c[p + "suffix"] || "", warn: c[p + "warn_above"] });
      }
    }
    return out;
  }
  _tipIds() {
    const c = this._c, out = [];
    for (let i = 1; i <= ACC_MAX_TIPS; i++) if (c["tip" + i + "_entity"]) out.push(c["tip" + i + "_entity"]);
    return out;
  }

  _build() {
    if (!this._c) return;
    if (!this.shadowRoot) this.attachShadow({ mode: "open" });
    const c = this._c, lang = this._lang();
    let statsHtml = "";
    for (const s of this._stats()) {
      statsHtml += '<div class="stat"><ha-icon icon="' + accEsc(s.icon) + '"></ha-icon>' +
        '<span class="statv" id="sv' + s.i + '">--</span><span class="statn">' + accEsc(s.name) + "</span></div>";
    }
    const graph = this._full() && c.graph_entity;
    this.shadowRoot.innerHTML = "<style>" + ACC_CSS + "</style>" +
      '<ha-card style="--acc-color:' + accEsc(accColor(c.color)) + '">' +
      '<div class="head"><div class="hic"><ha-icon icon="' + accEsc(c.icon || ACC_DEFAULTS.icon) + '"></ha-icon></div>' +
      '<div class="ht"><div class="htitle">' + accEsc(c.name || accT(lang, "default_name")) + "</div>" +
      '<div class="hsub" id="sub"></div></div>' +
      '<button class="refresh" id="refresh" type="button"><ha-icon icon="mdi:refresh"></ha-icon></button></div>' +
      '<div class="scorerow" id="scorerow" hidden><span class="score" id="score">--</span>' +
      '<span class="scoremax">/100</span><span class="band" id="band"></span></div>' +
      '<div class="bar sbar" id="sbar" hidden><div class="fill" id="sfill"></div></div>' +
      '<div class="box" id="sumbox" hidden><ha-icon icon="mdi:robot-outline"></ha-icon><div class="summary" id="summary"></div></div>' +
      '<div class="box" id="msgbox" hidden><ha-icon id="msgicon" icon="mdi:information-outline"></ha-icon><div class="msg" id="msg"></div></div>' +
      (statsHtml ? '<div class="stats">' + statsHtml + "</div>" : "") +
      '<div class="tipshead" id="tipshead" hidden></div><div id="tips"></div>' +
      '<div class="conf" id="conf" hidden><span class="conflab">' + accEsc(accT(lang, "confidence")) + "</span>" +
      '<div class="bar"><div class="fill" id="cfill"></div></div><span class="confval" id="cval"></span></div>' +
      (graph ? '<div class="graph" id="graph" role="button" tabindex="0"><div class="ghead"><span class="gval" id="gval">--</span>' +
        '<span class="gname">' + accEsc(c.graph_name || "") + '</span><ha-icon icon="mdi:chevron-right"></ha-icon></div>' +
        '<div class="gplot" id="gplot"></div></div>' : "") +
      "</ha-card>";
    const self = this, root = this.shadowRoot;
    root.getElementById("refresh").addEventListener("click", function () { self._refresh(); });
    const gr = root.getElementById("graph");
    if (gr) {
      const open = function () {
        self.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId: self._c.graph_entity }, bubbles: true, composed: true }));
      };
      gr.addEventListener("click", open);
      gr.addEventListener("keydown", function (ev) { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); open(); } });
    }
    this._built = true;
    this._builtLang = lang;
    this._sig = null;
    if (this._h) { this._update(); this._renderGraph(); }
  }

  set hass(h) {
    const first = !this._h;
    this._h = h;
    if (!this._c) return;
    /* the static texts follow the language of the user profile */
    if (!this._built || this._builtLang !== accLang(h)) this._build();
    if (first) {
      this._subscribe();
      this._fetchGraph();
      if (this._mode() === "builtin") {
        const self = this;
        accStoreLoad(h).then(function () { self._sig = null; self._update(); self._maybeAuto(); });
      }
    }
    this._update();
  }
  get hass() { return this._h; }

  _tick() {
    this._sig = null;
    this._update();
    if (this._full() && this._c.graph_entity && Date.now() - this._lastGraph > 15 * 60000) this._fetchGraph();
    this._maybeAuto();
  }

  /* Statistics from templates: live through the render_template subscription. */
  _subscribe() {
    const h = this._h;
    if (!h || !h.connection || !this._c || this._unsubs.length || !this.isConnected) return;
    const self = this;
    for (const s of this._stats()) {
      if (!s.template || s.entity) continue;
      const p = h.connection.subscribeMessage(function (msg) {
        if (msg && msg.result !== undefined) { self._tpl[s.i] = msg.result; self._setStat(s, msg.result); }
      }, { type: "render_template", template: s.template, report_errors: false });
      this._unsubs.push(p);
    }
  }
  _unsubscribe() {
    for (const p of this._unsubs) Promise.resolve(p).then(function (u) { if (typeof u === "function") u(); }).catch(function () {});
    this._unsubs = [];
    this._tpl = {};
  }

  _setStat(s, raw) {
    const el = this.shadowRoot && this.shadowRoot.getElementById("sv" + s.i);
    if (!el) return;
    if (raw === null || raw === undefined || raw === "" || raw === "unknown" || raw === "unavailable") {
      el.textContent = "--"; el.className = "statv"; return;
    }
    const n = Number(raw);
    el.textContent = (isFinite(n) ? accFmtNum(this._lang(), n, s.decimals) : String(raw)) + (s.suffix || "");
    el.className = "statv" + (s.warn !== undefined && s.warn !== null && s.warn !== "" && isFinite(n) && n > Number(s.warn) ? " warn" : "");
  }

  async _fetchGraph() {
    const c = this._c, h = this._h;
    if (!h || !c || !this._full() || !c.graph_entity || !h.callWS) return;
    this._lastGraph = Date.now();
    try {
      const hours = Math.max(1, Number(c.graph_hours) || ACC_DEFAULTS.graph_hours);
      const end = Date.now(), start = end - hours * ACC_HOUR;
      const resp = await h.callWS({ type: "history/history_during_period", start_time: new Date(start).toISOString(),
        end_time: new Date(end).toISOString(), entity_ids: [c.graph_entity], significant_changes_only: false,
        minimal_response: true, no_attributes: true });
      const rows = (resp && resp[c.graph_entity]) || [];
      const pts = [];
      for (const r of rows) {
        const sv = r.s !== undefined ? r.s : r.state;
        const lu = r.lu !== undefined ? r.lu * 1000 : (r.last_updated ? Date.parse(r.last_updated) : (r.last_changed ? Date.parse(r.last_changed) : null));
        const v = Number(sv);
        if (lu === null || !isFinite(v) || sv === "" || sv === null) continue;
        pts.push([Math.max(start, lu), v]);
      }
      this._graph = { pts: pts, start: start, end: end };
      this._renderGraph();
    } catch (e) { /* graph is optional */ }
  }
  _renderGraph() {
    const plot = this.shadowRoot && this.shadowRoot.getElementById("gplot");
    if (!plot || !this._graph) return;
    plot.innerHTML = accSparkSvg(this._graph.pts, this._graph.start, this._graph.end, accColor(this._c.color));
  }

  /* The result to show: helpers in "entities" mode, the stored analysis otherwise. */
  _result() {
    const c = this._c, h = this._h;
    if (this._mode() === "coach") {
      const sib = this._sib();
      const sm = accState(h, sib.summary), tp = accState(h, sib.tips);
      const summary = (sm && sm.attributes && sm.attributes.text) || accVal(h, sib.summary) || "";
      const tips = tp && tp.attributes && Array.isArray(tp.attributes.tips) ? tp.attributes.tips : [];
      const score = accNum(h, sib.score), conf = accNum(h, sib.confidence);
      const last = accVal(h, sib.last);
      if (!summary && !tips.length && score === null) return null;
      return { t: last ? Date.parse(last) : 0, summary: summary, score: score, confidence: conf, tips: tips };
    }
    if (this._mode() === "entities") {
      const sm = accState(h, c.summary_entity);
      const au = accState(h, c.update_automation);
      const t = au && au.attributes && au.attributes.last_triggered ? Date.parse(au.attributes.last_triggered)
        : (sm && sm.last_updated ? Date.parse(sm.last_updated) : 0);
      const tips = [];
      for (const id of this._tipIds()) { const v = accVal(h, id); if (v && v.trim()) tips.push(v.trim()); }
      const summary = accVal(h, c.summary_entity) || "";
      const score = accNum(h, c.score_entity), conf = accNum(h, c.confidence_entity);
      if (!summary && !tips.length && score === null) return null;
      return { t: t, summary: summary, score: score, confidence: conf, tips: tips };
    }
    const store = accStoreCache;
    return store && store.results[this._key] ? store.results[this._key] : null;
  }

  /* What prevents the built-in analysis from running, if anything. */
  _blocker() {
    if (this._mode() === "coach") return !this._h ? "wait" : (this._sib().score ? null : "msg_no_coach");
    if (this._mode() !== "builtin") return null;
    if (!this._h) return "wait";
    if (!accAiEntity(this._h, this._c)) return "msg_no_ai";
    if (!accSourceIds(this._h, this._c).length) return "msg_no_data";
    return null;
  }

  _maybeAuto() {
    if (this.preview || this._mode() !== "builtin" || !this._h || !accStoreCache) return;
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
    const hours = Number(this._c.update_interval);
    if (!isFinite(hours) || hours <= 0 || this._blocker()) return;
    const r = this._result();
    const now = Date.now();
    if (r && now - r.t < hours * ACC_HOUR) return;
    if (accRunning[this._key] || now - this._lastAttempt < ACC_RETRY_MS) return;
    this._run();
  }

  _refresh() {
    const h = this._h;
    if (!h) return;
    if (this._mode() === "coach") {
      const btn = this._sib().button;
      if (!btn) return;
      this._spinUntil = Date.now() + 5000;
      this._spinSig = accContentSig(this._result());
      this._update(true);
      h.callService("button", "press", { entity_id: btn });
      return;
    }
    if (this._mode() === "entities") {
      if (!this._c.update_automation) return;
      this._spinUntil = Date.now() + 90000;
      this._spinSig = accContentSig(this._result());
      this._update(true);
      h.callService("automation", "trigger", { entity_id: this._c.update_automation });
      return;
    }
    if (!this._blocker()) this._run();
  }

  async _run() {
    const key = this._key, h = this._h, cfg = this._c;
    this._lastAttempt = Date.now();
    this._error = null;
    if (!accRunning[key]) {
      accRunning[key] = (async function () {
        try {
          const result = await accRunAnalysis(h, cfg, accAiEntity(h, cfg));
          await accStoreSave(h, key, result);
          return null;
        } catch (e) {
          return accErrText(e);
        } finally {
          delete accRunning[key];
        }
      })();
    }
    const p = accRunning[key];
    for (const card of accCards) if (card._key === key) { card._sig = null; card._update(); }
    const err = await p;
    for (const card of accCards) {
      if (card._key !== key) continue;
      card._error = err;
      card._lastAttempt = Date.now();
      card._sig = null;
      card._update();
    }
    if (!accCards.has(this)) { this._error = err; this._sig = null; this._update(); }
  }

  _update(force) {
    const h = this._h, c = this._c, root = this.shadowRoot;
    if (!h || !c || !root || !this._built) return;
    const lang = this._lang();
    const mode = this._mode();
    const r = this._result();
    const sib = mode === "coach" ? this._sib() : {};
    const spinning = !!(this._spinUntil && Date.now() < this._spinUntil && accContentSig(r) === this._spinSig);
    const running = mode === "builtin" ? !!accRunning[this._key]
      : (mode === "coach" ? accVal(h, sib.running) === "on" || spinning : spinning);
    if (!running) this._spinUntil = 0;
    let error = this._error;
    if (mode === "coach") {
      const last = accState(h, sib.last);
      error = !running && last && last.attributes && last.attributes.error ? String(last.attributes.error) : null;
    }
    const blocker = this._blocker();
    let sig = JSON.stringify([r, running, error, blocker, lang, r ? Math.floor((Date.now() - r.t) / 60000) : 0]);
    for (const s of this._stats()) if (s.entity) sig += "|" + accVal(h, s.entity);
    if (c.graph_entity) sig += "|" + accVal(h, c.graph_entity);
    if (!force && sig === this._sig) return;
    this._sig = sig;

    /* header: in coach mode the default title is the name of the AI Coach device */
    const title = root.querySelector(".htitle");
    if (title) {
      let devName = null;
      if (mode === "coach" && h.entities && h.devices) {
        const own = h.entities[c.entity];
        const dev = own && own.device_id ? h.devices[own.device_id] : null;
        devName = dev ? dev.name_by_user || dev.name : null;
      }
      title.textContent = c.name || devName || accT(lang, "default_name");
    }
    const sub = root.getElementById("sub");
    let subText = accT(lang, "sub_ai"), subErr = false;
    if (running) subText += " " + ACC_DOT + " " + accT(lang, "sub_running");
    else if (error) { subText += " " + ACC_DOT + " " + accT(lang, "sub_failed"); subErr = true; }
    else if (r && r.t) subText += " " + ACC_DOT + " " + accT(lang, "sub_updated", { ago: accAgo(lang, r.t) });
    sub.textContent = subText;
    sub.className = "hsub" + (subErr ? " err" : "");
    const rb = root.getElementById("refresh");
    rb.hidden = mode === "coach" ? !sib.button : (mode === "entities" ? !c.update_automation : (blocker === "msg_no_ai" || blocker === "msg_no_data"));
    rb.disabled = running;
    rb.className = "refresh" + (running ? " spin" : "");
    rb.title = accT(lang, "refresh");
    rb.setAttribute("aria-label", accT(lang, "refresh"));

    /* score */
    const score = r && r.score !== null && r.score !== undefined ? Number(r.score) : null;
    const showScore = score !== null && isFinite(score);
    root.getElementById("scorerow").hidden = !showScore;
    root.getElementById("sbar").hidden = !showScore;
    if (showScore) {
      const b = accBand(score);
      root.getElementById("score").textContent = String(Math.round(score));
      const band = root.getElementById("band");
      band.textContent = accT(lang, b.key);
      band.style.color = b.color;
      const f = root.getElementById("sfill");
      f.style.width = Math.max(2, Math.min(100, score)) + "%";
      f.style.background = b.color;
    }

    /* summary or message */
    const summary = r && r.summary ? r.summary : "";
    root.getElementById("sumbox").hidden = !summary;
    root.getElementById("summary").textContent = summary;
    let msg = null, msgErr = false;
    if (error) { msg = accT(lang, "msg_error", { error: error }); msgErr = true; }
    else if (blocker && blocker !== "wait") msg = accT(lang, blocker);
    else if (!r) {
      const auto = mode === "builtin" && Number(c.update_interval) > 0 && !this.preview;
      msg = accT(lang, running ? "msg_running" : (mode !== "builtin" || auto ? "msg_waiting" : "msg_first"));
    }
    root.getElementById("msgbox").hidden = !msg;
    const me = root.getElementById("msg");
    me.textContent = msg || "";
    me.className = "msg" + (msgErr ? " err" : "");
    root.getElementById("msgicon").setAttribute("icon", msgErr ? "mdi:alert-circle-outline" : (running ? "mdi:progress-clock" : "mdi:information-outline"));

    /* statistics */
    for (const s of this._stats()) {
      if (s.entity) this._setStat(s, accVal(h, s.entity));
      else if (this._tpl[s.i] !== undefined) this._setStat(s, this._tpl[s.i]);
    }

    /* tips */
    const tips = r && Array.isArray(r.tips) ? r.tips : [];
    const th = root.getElementById("tipshead");
    th.hidden = !tips.length;
    th.innerHTML = accEsc(c.tips_name || accT(lang, "default_tips")) + " " + ACC_DOT + " <b>" + tips.length + "</b>";
    let html = "", plain = 0;
    for (const t of tips) {
      const p = accParseTip(t);
      const color = accThemeColor(p.chip, plain);
      if (!p.chip) plain += 1;
      html += '<div class="tip" style="--tipc:' + color + '">' +
        (p.chip ? '<span class="chip">' + accEsc(p.chip) + "</span>" : "") +
        '<div class="tiptext">' + accEsc(p.body) + "</div></div>";
    }
    root.getElementById("tips").innerHTML = html;

    /* confidence */
    const cv = r && r.confidence !== null && r.confidence !== undefined ? Number(r.confidence) : null;
    const showConf = cv !== null && isFinite(cv);
    root.getElementById("conf").hidden = !showConf;
    if (showConf) {
      const cf = root.getElementById("cfill");
      cf.style.width = Math.max(0, Math.min(100, cv * 10)) + "%";
      cf.style.background = accConfColor(cv);
      root.getElementById("cval").textContent = Math.round(cv) + "/10";
    }

    /* graph value */
    const gval = root.getElementById("gval");
    if (gval) {
      const st = accState(h, c.graph_entity);
      const gv = accNum(h, c.graph_entity);
      const unit = st && st.attributes ? st.attributes.unit_of_measurement || "" : "";
      gval.textContent = gv === null ? "--" : accFmtNum(lang, gv, Math.abs(gv) < 100 ? 1 : 0) + (unit ? " " + unit : "");
    }
  }
}

/* Former compact card: same element, compact layout by default. */
class AiCoachLiteCard extends AiCoachCard {
  constructor() { super(); this._legacy = true; }
}

/* ------------------------------------------------------------------ */
/* AI Coach integration                                                */
/* ------------------------------------------------------------------ */

/* Entities of the AI Coach device that ``entityId`` belongs to, by role. */
function accSiblings(hass, entityId) {
  const out = {};
  const ents = (hass && hass.entities) || {};
  const own = ents[entityId];
  if (!own || own.platform !== ACC_INTEGRATION) return out;
  for (const id of Object.keys(ents)) {
    const e = ents[id];
    if (!e || e.platform !== ACC_INTEGRATION) continue;
    if (own.device_id ? e.device_id !== own.device_id : id !== entityId) continue;
    const role = ACC_SIBLINGS[e.translation_key];
    if (role && !out[role]) out[role] = id;
  }
  return out;
}
/* First score sensor of the integration, for the card picker. */
function accFirstCoach(hass) {
  const ents = (hass && hass.entities) || {};
  const ids = Object.keys(ents).filter(function (id) {
    return ents[id].platform === ACC_INTEGRATION && ents[id].translation_key === "score";
  }).sort();
  return ids.length ? ids[0] : null;
}

/* ------------------------------------------------------------------ */
/* Visual editor                                                       */
/* ------------------------------------------------------------------ */

function accEditorSchema(lang, cfg) {
  const t = function (k) { return accT(lang, "ed_" + k); };
  const ent = function (name, domain) { return { name: name, selector: { entity: domain ? { domain: domain } : {} } }; };
  const full = !cfg || cfg.layout !== "compact";
  const coach = !!(cfg && cfg.entity);
  const schema = [
    { name: "entity", selector: { entity: { filter: { integration: ACC_INTEGRATION, domain: "sensor" } } } },
    { name: "name", selector: { text: {} } },
    { type: "grid", name: "", schema: [
      { name: "icon", selector: { icon: {} } },
      { name: "color", selector: { ui_color: { default_color: ACC_DEFAULTS.color } } }
    ] },
    { name: "layout", selector: { select: { mode: "box", options: [
      { value: "full", label: t("layout_full") },
      { value: "compact", label: t("layout_compact") }
    ] } } },
    { name: "tips_name", selector: { text: {} } }
  ];
  if (!coach) {
    schema.push(
      { type: "expandable", name: "g_ai", flatten: true, title: t("g_ai"), icon: "mdi:creation-outline", schema: [
        { name: "topic", selector: { text: {} } },
        { name: "entities", selector: { entity: { multiple: true } } },
        { name: "label", selector: { label: {} } },
        { name: "instructions", selector: { text: { multiline: true } } },
        ent("ai_task_entity", "ai_task"),
        { name: "update_interval", selector: { number: { min: 0, max: 24, step: 1, mode: "box", unit_of_measurement: "h" } } }
      ] },
      { type: "expandable", name: "g_linked", flatten: true, title: t("g_linked"), icon: "mdi:link-variant", schema: [
        ent("summary_entity", "input_text"),
        ent("score_entity", "input_number"),
        ent("confidence_entity", "input_number"),
        ent("tip1_entity", "input_text"),
        ent("tip2_entity", "input_text"),
        ent("tip3_entity", "input_text"),
        ent("tip4_entity", "input_text"),
        ent("tip5_entity", "input_text"),
        ent("update_automation", "automation")
      ] }
    );
  }
  if (full) {
    const stat = function (i) {
      const p = "stat" + i + "_";
      return { type: "expandable", name: "g_stat" + i, flatten: true, title: t("g_stat" + i), schema: [
        { type: "grid", name: "", schema: [
          { name: p + "icon", selector: { icon: {} } },
          { name: p + "name", selector: { text: {} } }
        ] },
        ent(p + "entity"),
        { name: p + "template", selector: { template: {} } },
        { type: "grid", name: "", schema: [
          { name: p + "decimals", selector: { number: { min: 0, max: 3, step: 1, mode: "box" } } },
          { name: p + "suffix", selector: { text: {} } },
          { name: p + "warn_above", selector: { number: { mode: "box", step: "any" } } }
        ] }
      ] };
    };
    schema.push({ type: "expandable", name: "g_stats", flatten: true, title: t("g_stats"), icon: "mdi:chart-box-outline",
      schema: [stat(1), stat(2), stat(3)] });
    schema.push({ type: "expandable", name: "g_graph", flatten: true, title: t("g_graph"), icon: "mdi:chart-line", schema: [
      ent("graph_entity", "sensor"),
      { name: "graph_name", selector: { text: {} } },
      { name: "graph_hours", selector: { number: { min: 1, max: 168, step: 1, mode: "box", unit_of_measurement: "h" } } }
    ] });
  }
  return schema;
}
/* Label of a schema field: stat fields share one translation. */
function accEditorLabel(lang, name) {
  const m = /^stat\d_(.+)$/.exec(name);
  return accT(lang, "ed_" + (m ? "stat_" + m[1] : name));
}
function accEditorHelper(lang, name) {
  const m = /^stat\d_(.+)$/.exec(name);
  const k = "edh_" + (m ? "stat_" + m[1] : name);
  return accHasKey(lang, k) ? accT(lang, k) : undefined;
}

/* ha-form is lazy-loaded by Home Assistant: load it through a built-in card editor. */
async function accEnsureHaForm() {
  if (customElements.get("ha-form")) return;
  try {
    const helpers = await window.loadCardHelpers();
    const card = await helpers.createCardElement({ type: "entities", entities: [] });
    if (card && card.constructor && card.constructor.getConfigElement) await card.constructor.getConfigElement();
  } catch (e) { /* ignore */ }
  await Promise.race([customElements.whenDefined("ha-form"), new Promise(function (r) { setTimeout(r, 2000); })]);
}

class AiCoachCardEditor extends HTMLElement {
  setConfig(config) { this._config = Object.assign({}, config); this._render(); }
  set hass(h) {
    const changed = !this._hass || accLang(h) !== accLang(this._hass);
    this._hass = h;
    if (this._form) {
      this._form.hass = h;
      if (changed) this._form.schema = accEditorSchema(accLang(h), this._config);
    }
  }
  connectedCallback() { this._render(); }
  async _render() {
    if (!this._config) return;
    if (!this._form) {
      await accEnsureHaForm();
      if (this._form) return;
      const form = document.createElement("ha-form");
      const self = this;
      form.computeLabel = function (s) { return s.title || accEditorLabel(accLang(self._hass), s.name); };
      form.computeHelper = function (s) { return accEditorHelper(accLang(self._hass), s.name); };
      form.addEventListener("value-changed", function (ev) {
        const cfg = Object.assign({}, self._config, ev.detail.value);
        for (const k of Object.keys(cfg)) {
          const v = cfg[k];
          /* keep the YAML minimal: drop empty values and values equal to the defaults */
          if (v === "" || v === undefined || v === null || (Array.isArray(v) && !v.length) || v === ACC_DEFAULTS[k]) delete cfg[k];
        }
        const relayout = (cfg.layout || "full") !== (self._config.layout || "full") || !cfg.entity !== !self._config.entity;
        self._config = cfg;
        if (relayout) self._form.schema = accEditorSchema(accLang(self._hass), cfg);
        self.dispatchEvent(new CustomEvent("config-changed", { detail: { config: cfg }, bubbles: true, composed: true }));
      });
      this._form = form;
      this.appendChild(form);
    }
    this._form.hass = this._hass;
    this._form.schema = accEditorSchema(accLang(this._hass), this._config);
    this._form.data = Object.assign({}, ACC_DEFAULTS, this._config);
  }
}

/* ------------------------------------------------------------------ */
/* Registration                                                        */
/* ------------------------------------------------------------------ */

if (customElements.get(ACC_TAG)) {
  console.warn("AI-COACH-CARD: another copy of the card is already loaded. Remove the dashboard resource of the standalone AI Coach Card (HACS Dashboard or an old inline copy): the AI Coach integration loads the card by itself.");
} else {
  customElements.define(ACC_TAG, AiCoachCard);
}
if (!customElements.get(ACC_LEGACY_TAG)) customElements.define(ACC_LEGACY_TAG, AiCoachLiteCard);
if (!customElements.get(ACC_EDITOR_TAG)) customElements.define(ACC_EDITOR_TAG, AiCoachCardEditor);
window.customCards = window.customCards || [];
if (!window.customCards.some(function (c) { return c.type === ACC_TAG; })) {
  const navLang = accLang(null);
  window.customCards.push({
    type: ACC_TAG,
    name: accT(navLang, "picker_name"),
    description: accT(navLang, "picker_desc"),
    preview: true,
    documentationURL: ACC_REPO_URL
  });
}
console.info("%c AI-COACH-CARD %c v" + ACC_VERSION + " ",
  "background:#e53935;color:#fff;padding:2px 6px;border-radius:3px 0 0 3px;",
  "background:#424242;color:#fff;padding:2px 6px;border-radius:0 3px 3px 0;");
