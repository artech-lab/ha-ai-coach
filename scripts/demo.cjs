// Demo Home Assistant shared by the screenshots and the browser tests.
// Every value is invented: no real measurements, names or places.
const path = require("path");
const mdi = require("@mdi/js");

const ROOT = path.join(__dirname, "..");
const CARD = path.join(ROOT, "custom_components", "ai_coach", "frontend", "ai-coach-card.js");

const ICON_NAMES = ["mdiRobot", "mdiRobotOutline", "mdiRefresh", "mdiHomeThermometer", "mdiHeartPulse", "mdiThermometer",
  "mdiMoleculeCo2", "mdiWaterPercent", "mdiChevronRight", "mdiInformationOutline", "mdiAlertCircleOutline",
  "mdiProgressClock", "mdiLightningBolt", "mdiChartBoxOutline", "mdiSolarPower", "mdiCounter"];
const ICONS = {};
for (const n of ICON_NAMES) ICONS["mdi:" + n.slice(3).replace(/[A-Z]/g, (c, i) => (i ? "-" : "") + c.toLowerCase())] = mdi[n];

const THEMES = {
  dark: "--primary-color:#03a9f4;--primary-text-color:#e1e1e1;--secondary-text-color:#9b9b9b;--card-background-color:#1c1c1c;--divider-color:rgba(225,225,225,.12);--warning-color:#ffa600;--error-color:#db4437;background:#111111;",
  light: "--primary-color:#03a9f4;--primary-text-color:#212121;--secondary-text-color:#727272;--card-background-color:#ffffff;--divider-color:rgba(0,0,0,.12);--warning-color:#ffa600;--error-color:#db4437;background:#fafafa;"
};

const page = (theme, width) => `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:20px;font-family:Roboto,Inter,"DejaVu Sans",sans-serif;-webkit-font-smoothing:antialiased;${THEMES[theme]}}
#host{width:${width || 430}px}</style></head><body><div id="host"></div><script>
const ICONS = ${JSON.stringify(ICONS)};
customElements.define("ha-card", class extends HTMLElement { constructor(){ super(); this.attachShadow({mode:"open"}).innerHTML =
 '<style>:host{display:block;background:var(--card-background-color);border-radius:12px;border:1px solid var(--divider-color);color:var(--primary-text-color);box-sizing:border-box}</style><slot></slot>'; } });
customElements.define("ha-icon", class extends HTMLElement {
  static get observedAttributes(){ return ["icon"]; }
  connectedCallback(){ this.render(); } attributeChangedCallback(){ this.render(); }
  render(){ if(!this.shadowRoot) this.attachShadow({mode:"open"}); const p = ICONS[this.getAttribute("icon")] || "";
    this.shadowRoot.innerHTML = '<style>:host{display:inline-flex;width:var(--mdc-icon-size,24px);height:var(--mdc-icon-size,24px)}svg{width:100%;height:100%;fill:currentColor}</style><svg viewBox="0 0 24 24"><path d="'+p+'"/></svg>'; }
});
</script></body></html>`;

/* Fake entities of a demo home. */
function demoStates() {
  const s = (state, name, unit, dc) => ({ state: String(state), attributes: Object.assign({ friendly_name: name },
    unit ? { unit_of_measurement: unit } : {}, dc ? { device_class: dc } : {}) });
  return {
    "ai_task.demo_ai": { state: "unknown", attributes: { friendly_name: "Demo AI" } },
    "sensor.home_temperature": s(24.6, "Home temperature", "°C", "temperature"),
    "sensor.home_humidity": s(58, "Home humidity", "%", "humidity"),
    "sensor.living_room_co2": s(1180, "Living room CO2", "ppm", "carbon_dioxide"),
    "sensor.daily_steps": s(6850, "Daily steps", "steps"),
    "sensor.sleep_duration": s(7.3, "Sleep duration", "h"),
    "sensor.water_today": s(1.1, "Water today", "L")
  };
}
/* A smooth day of indoor temperature for the sparkline. */
function demoHistory(now) {
  const rows = [];
  for (let i = 0; i <= 96; i++) {
    const t = now - (96 - i) * 15 * 60000;
    const h = new Date(t).getHours() + new Date(t).getMinutes() / 60;
    const v = 23.4 + 1.5 * Math.sin((h - 9) / 24 * 2 * Math.PI) + 0.15 * Math.sin(i * 1.7);
    rows.push({ s: v.toFixed(1), lu: t / 1000 });
  }
  return rows;
}

const CARDS = {
  comfort: {
    type: "custom:ai-coach-card", name: "Comfort", icon: "mdi:home-thermometer", color: "light-blue",
    topic: "indoor comfort and air quality", entities: ["sensor.home_temperature", "sensor.home_humidity", "sensor.living_room_co2"],
    tips_name: "Comfort tips",
    stat1_icon: "mdi:thermometer", stat1_name: "average", stat1_entity: "sensor.home_temperature", stat1_decimals: 1, stat1_suffix: " °C",
    stat2_icon: "mdi:molecule-co2", stat2_name: "CO₂", stat2_entity: "sensor.living_room_co2", stat2_suffix: " ppm", stat2_warn_above: 1000,
    stat3_icon: "mdi:water-percent", stat3_name: "RH", stat3_entity: "sensor.home_humidity", stat3_suffix: " %",
    graph_entity: "sensor.home_temperature", graph_name: "Average temperature · 24 h", graph_hours: 24
  },
  wellbeing: {
    type: "custom:ai-coach-card", layout: "compact", name: "Wellbeing", icon: "mdi:heart-pulse", color: "red",
    topic: "daily wellbeing and lifestyle (not medical advice)", entities: ["sensor.daily_steps", "sensor.sleep_duration", "sensor.water_today"],
    tips_name: "Wellbeing tips"
  }
};
const RESULTS = {
  en: {
    comfort: { ago: 18, score: 64, confidence: 8,
      summary: "CO₂ at 1,180 ppm in the living room is above the 1,000 ppm limit; temperature 24.6 °C and humidity 58 % are in range.",
      tips: [
        "Air: CO₂ 1,180 ppm in the living room. Open two windows for 10 min now and again at 21:00 to get back below 800 ppm.",
        "Temperature: 24.6 °C inside, 29 °C outside. Keep the windows closed from 13:00 to 18:00 and lower the south blinds.",
        "Humidity: 58 % is close to the 60 % limit. Run the air conditioner in dry mode at 26 °C for an hour before bedtime."
      ] },
    wellbeing: { ago: 42, score: 78, confidence: 7,
      summary: "6,850 steps by 17:00, 1,150 short of the 8,000 goal; 7 h 20 min of sleep last night.",
      tips: [
        "Activity: 6,850 steps at 17:00. A brisk 15-minute walk after dinner (about 1,500 steps) reaches the 8,000 goal.",
        "Hydration: 1.1 L logged so far. Drink a glass of water every hour until 21:00 to get close to 2 L.",
        "Sleep: 7 h 20 min last night. Keep the same bedtime, 23:00, and put screens away 30 min earlier."
      ] }
  },
  it: {
    comfort: { ago: 18, score: 64, confidence: 8,
      summary: "CO₂ a 1.180 ppm in soggiorno, sopra il limite di 1.000 ppm; temperatura 24,6 °C e umidità 58 % nella norma.",
      tips: [
        "Aria: CO₂ a 1.180 ppm in soggiorno. Apri due finestre per 10 min adesso e di nuovo alle 21:00 per tornare sotto 800 ppm.",
        "Temperatura: 24,6 °C dentro e 29 °C fuori. Tieni chiuse le finestre dalle 13:00 alle 18:00 e abbassa le tapparelle a sud.",
        "Umidità: 58 %, vicina al limite del 60 %. Condizionatore in deumidificazione a 26 °C per un'ora prima di dormire."
      ] },
    wellbeing: { ago: 42, score: 78, confidence: 7,
      summary: "6.850 passi alle 17:00, 1.150 dall'obiettivo di 8.000; 7 h 20 min di sonno la notte scorsa.",
      tips: [
        "Attività: 6.850 passi alle 17:00. Una camminata veloce di 15 min dopo cena (circa 1.500 passi) raggiunge gli 8.000.",
        "Idratazione: 1,1 L registrati finora. Un bicchiere d'acqua ogni ora fino alle 21:00 per avvicinarti ai 2 L.",
        "Sonno: 7 h 20 min la notte scorsa. Mantieni lo stesso orario, le 23:00, e spegni gli schermi 30 min prima."
      ] }
  }
};

/* Texts of the card configuration for the Italian screenshots. */
const CARDS_IT = {
  comfort: Object.assign({}, CARDS.comfort, { tips_name: "Consigli per il comfort", stat1_name: "media", stat3_name: "UR",
    graph_name: "Temperatura media \u00b7 24 h" }),
  wellbeing: Object.assign({}, CARDS.wellbeing, { name: "Benessere", tips_name: "Consigli di benessere" })
};

module.exports = { ROOT, CARD, page, demoStates, demoHistory, CARDS, CARDS_IT, RESULTS };
