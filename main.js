import { validateSAWInput, calculateScores } from "./saw.js";

const els = {
  criteriaRows: document.getElementById("criteriaRows"),
  alternativeHead: document.getElementById("alternativeHead"),
  alternativeRows: document.getElementById("alternativeRows"),
  normalizationSection: document.getElementById("normalizationSection"),
  normalizationHead: document.getElementById("normalizationHead"),
  normalizationBody: document.getElementById("normalizationBody"),
  rankingBody: document.getElementById("rankingBody"),
  manualCalcBody: document.getElementById("manualCalcBody"),
  statusMessage: document.getElementById("statusMessage"),
  addCriterionBtn: document.getElementById("addCriterionBtn"),
  removeCriterionBtn: document.getElementById("removeCriterionBtn"),
  addAlternativeBtn: document.getElementById("addAlternativeBtn"),
  removeAlternativeBtn: document.getElementById("removeAlternativeBtn"),
  runBtn: document.getElementById("runBtn"),
  resetBtn: document.getElementById("resetBtn"),
  demoBtn: document.getElementById("demoBtn"),
  exportBtn: document.getElementById("exportBtn"),
  toggleDetailsBtn: document.getElementById("toggleDetailsBtn")
};

let criteria = [];
let alternatives = [];
let lastRankingResult = [];
let showNormalization = true;

function createEmptyCriterion(index = 1) {
  return {
    code: `C${index}`,
    name: "",
    type: "benefit",
    weight: ""
  };
}

function createEmptyAlternative(index = 1) {
  return {
    code: `A${index}`,
    name: "",
    values: {}
  };
}

function initEmptyState() {
  criteria = [createEmptyCriterion(1), createEmptyCriterion(2)];
  alternatives = [createEmptyAlternative(1), createEmptyAlternative(2)];
  syncAlternativeValues();
}

// Menjaga agar setiap alternatif selalu punya nilai untuk semua kode kriteria aktif.
function syncAlternativeValues() {
  const activeCodes = criteria.map((c) => c.code);

  alternatives.forEach((alt) => {
    if (!alt.values) alt.values = {};

    activeCodes.forEach((code) => {
      if (!(code in alt.values)) {
        alt.values[code] = "";
      }
    });

    Object.keys(alt.values).forEach((existing) => {
      if (!activeCodes.includes(existing)) {
        delete alt.values[existing];
      }
    });
  });
}

function renderCriteriaTable() {
  els.criteriaRows.innerHTML = criteria.map((c, index) => `
    <tr>
      <td><input data-kind="criteria" data-field="code" data-index="${index}" value="${escapeHtml(c.code)}"></td>
      <td><input data-kind="criteria" data-field="name" data-index="${index}" value="${escapeHtml(c.name)}"></td>
      <td>
        <select data-kind="criteria" data-field="type" data-index="${index}">
          <option value="benefit" ${c.type === "benefit" ? "selected" : ""}>benefit</option>
          <option value="cost" ${c.type === "cost" ? "selected" : ""}>cost</option>
        </select>
      </td>
      <td><input type="number" step="0.0001" min="0" data-kind="criteria" data-field="weight" data-index="${index}" value="${escapeHtml(c.weight)}"></td>
    </tr>
  `).join("");
}

function renderAlternativeTable() {
  const headCells = criteria.map((c) => `<th>${escapeHtml(c.code || "-")}</th>`).join("");
  els.alternativeHead.innerHTML = `
    <tr>
      <th style="width: 90px;">Code</th>
      <th>Name</th>
      ${headCells}
    </tr>
  `;

  els.alternativeRows.innerHTML = alternatives.map((alt, altIndex) => {
    const valueInputs = criteria.map((c) => {
      const value = alt.values[c.code] ?? "";
      return `
        <td>
          <input
            type="number"
            step="any"
            data-kind="alternative-value"
            data-alt-index="${altIndex}"
            data-criterion-code="${escapeHtml(c.code)}"
            value="${escapeHtml(value)}"
          >
        </td>
      `;
    }).join("");

    return `
      <tr>
        <td><input data-kind="alternative" data-field="code" data-index="${altIndex}" value="${escapeHtml(alt.code)}"></td>
        <td><input data-kind="alternative" data-field="name" data-index="${altIndex}" value="${escapeHtml(alt.name)}"></td>
        ${valueInputs}
      </tr>
    `;
  }).join("");
}

function renderAllInputTables() {
  syncAlternativeValues();
  renderCriteriaTable();
  renderAlternativeTable();
}

function setStatus(message, type = "") {
  els.statusMessage.textContent = message;
  els.statusMessage.className = `status ${type}`.trim();
}

function formatScore(value) {
  return Number(value).toFixed(6);
}

function renderNormalizationTable(normalizedAlternatives) {
  const headCells = criteria.map((c) => `<th>${escapeHtml(c.code)}</th>`).join("");
  els.normalizationHead.innerHTML = `
    <tr>
      <th style="width: 90px;">Code</th>
      <th>Name</th>
      ${headCells}
    </tr>
  `;

  els.normalizationBody.innerHTML = normalizedAlternatives.map((alt) => {
    const cells = criteria.map((c) => `<td>${formatScore(alt.normalized[c.code])}</td>`).join("");
    return `
      <tr>
        <td>${escapeHtml(alt.code)}</td>
        <td>${escapeHtml(alt.name)}</td>
        ${cells}
      </tr>
    `;
  }).join("");
}

function renderRankingTable(ranking) {
  els.rankingBody.innerHTML = ranking.map((alt, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(alt.code)}</td>
      <td>${escapeHtml(alt.name)}</td>
      <td>${formatScore(alt.score)}</td>
    </tr>
  `).join("");
}

// Menampilkan detail Vi agar user paham kontribusi setiap kriteria.
function renderManualCalculation(ranking) {
  if (!els.manualCalcBody) return;

  if (ranking.length === 0) {
    els.manualCalcBody.innerHTML = "";
    return;
  }

  const rows = ranking.map((alt) => {
    const pieces = criteria.map((c) => {
      const w = Number(c.weight);
      const r = Number(alt.normalized[c.code]);
      return `(${w.toFixed(4)} x ${r.toFixed(4)})`;
    });

    const expression = pieces.join(" + ");
    return `
      <p class="manual-item">
        ${escapeHtml(alt.code)} - ${escapeHtml(alt.name)}:
        V = ${expression} = <strong>${formatScore(alt.score)}</strong>
      </p>
    `;
  }).join("");

  els.manualCalcBody.innerHTML = rows;
}

function clearResultTables() {
  els.normalizationHead.innerHTML = "";
  els.normalizationBody.innerHTML = "";
  els.rankingBody.innerHTML = "";
  if (els.manualCalcBody) els.manualCalcBody.innerHTML = "";
  lastRankingResult = [];
}

function runSAW() {
  const preparedCriteria = criteria.map((c) => ({
    code: String(c.code || "").trim(),
    name: String(c.name || "").trim(),
    type: c.type,
    weight: Number(c.weight)
  }));

  const preparedAlternatives = alternatives.map((alt) => {
    const cleanValues = {};
    preparedCriteria.forEach((c) => {
      cleanValues[c.code] = Number(alt.values[c.code]);
    });

    return {
      code: String(alt.code || "").trim(),
      name: String(alt.name || "").trim(),
      values: cleanValues
    };
  });

  const validation = validateSAWInput(preparedCriteria, preparedAlternatives);
  if (!validation.valid) {
    setStatus(validation.errors.join(" "), "error");
    return;
  }

  const { normalizedAlternatives, ranking } = calculateScores(preparedCriteria, preparedAlternatives);
  renderNormalizationTable(normalizedAlternatives);
  renderRankingTable(ranking);
  renderManualCalculation(ranking);
  lastRankingResult = ranking;

  if (ranking.length > 0) {
    setStatus(`Perhitungan selesai. Rekomendasi utama: ${ranking[0].code} - ${ranking[0].name}.`, "success");
  } else {
    setStatus("Perhitungan selesai, tetapi tidak ada data ranking.", "success");
  }
}

function exportRankingCsv() {
  if (lastRankingResult.length === 0) {
    setStatus("Belum ada hasil ranking. Jalankan SAW terlebih dahulu.", "error");
    return;
  }

  const lines = ["Rank,Code,Name,SAW_Score"];
  lastRankingResult.forEach((alt, index) => {
    lines.push([
      index + 1,
      csvEscape(alt.code),
      csvEscape(alt.name),
      formatScore(alt.score)
    ].join(","));
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "saw-ranking.csv";
  link.click();
  URL.revokeObjectURL(url);

  setStatus("CSV berhasil di-export: saw-ranking.csv", "success");
}

function loadDemo() {
  criteria = [
    { code: "C1", name: "Harga", type: "cost", weight: 0.25 },
    { code: "C2", name: "RAM (GB)", type: "benefit", weight: 0.2 },
    { code: "C3", name: "Kamera (MP)", type: "benefit", weight: 0.3 },
    { code: "C4", name: "Baterai (mAh)", type: "benefit", weight: 0.25 }
  ];

  alternatives = [
    { code: "A1", name: "Infinix Note 12", values: { C1: 2500000, C2: 6, C3: 50, C4: 5000 } },
    { code: "A2", name: "POCO M4 Pro", values: { C1: 2700000, C2: 8, C3: 64, C4: 5000 } },
    { code: "A3", name: "Samsung Galaxy A15", values: { C1: 2999000, C2: 8, C3: 50, C4: 5000 } },
    { code: "A4", name: "Redmi Note 13", values: { C1: 2899000, C2: 8, C3: 108, C4: 5000 } }
  ];

  renderAllInputTables();
  clearResultTables();
  setStatus("Demo smartphone berhasil dimuat. Klik Run SAW / Calculate.", "success");
}

function resetAll() {
  initEmptyState();
  renderAllInputTables();
  clearResultTables();
  setStatus("Semua input dan hasil telah direset.", "success");
}

function toggleNormalizationDetails() {
  showNormalization = !showNormalization;
  els.normalizationSection.classList.toggle("hidden", !showNormalization);
  setStatus(showNormalization ? "Tabel normalisasi ditampilkan." : "Tabel normalisasi disembunyikan.", "success");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function csvEscape(value) {
  const str = String(value ?? "");
  return `"${str.replaceAll("\"", "\"\"")}"`;
}

function attachEvents() {
  els.criteriaRows.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.dataset.kind !== "criteria") return;

    const index = Number(target.dataset.index);
    const field = target.dataset.field;
    if (!criteria[index] || !field) return;

    criteria[index][field] = target.value;

    if (field === "code") {
      syncAlternativeValues();
      renderAlternativeTable();
    }
  });

  els.criteriaRows.addEventListener("change", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.dataset.kind !== "criteria") return;

    const index = Number(target.dataset.index);
    const field = target.dataset.field;
    if (!criteria[index] || !field) return;
    criteria[index][field] = target.value;
  });

  els.alternativeRows.addEventListener("input", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.dataset.kind === "alternative") {
      const index = Number(target.dataset.index);
      const field = target.dataset.field;
      if (!alternatives[index] || !field) return;
      alternatives[index][field] = target.value;
      return;
    }

    if (target.dataset.kind === "alternative-value") {
      const altIndex = Number(target.dataset.altIndex);
      const criterionCode = target.dataset.criterionCode;
      if (!alternatives[altIndex] || !criterionCode) return;
      alternatives[altIndex].values[criterionCode] = target.value;
    }
  });

  els.addCriterionBtn.addEventListener("click", () => {
    criteria.push(createEmptyCriterion(criteria.length + 1));
    syncAlternativeValues();
    renderAllInputTables();
  });

  els.removeCriterionBtn.addEventListener("click", () => {
    if (criteria.length <= 1) {
      setStatus("Minimal harus ada 1 kriteria.", "error");
      return;
    }
    criteria.pop();
    syncAlternativeValues();
    renderAllInputTables();
  });

  els.addAlternativeBtn.addEventListener("click", () => {
    const alt = createEmptyAlternative(alternatives.length + 1);
    criteria.forEach((c) => {
      alt.values[c.code] = "";
    });
    alternatives.push(alt);
    renderAlternativeTable();
  });

  els.removeAlternativeBtn.addEventListener("click", () => {
    if (alternatives.length <= 1) {
      setStatus("Minimal harus ada 1 baris alternatif di form.", "error");
      return;
    }
    alternatives.pop();
    renderAlternativeTable();
  });

  els.runBtn.addEventListener("click", runSAW);
  els.resetBtn.addEventListener("click", resetAll);
  els.demoBtn.addEventListener("click", loadDemo);
  els.exportBtn.addEventListener("click", exportRankingCsv);
  els.toggleDetailsBtn.addEventListener("click", toggleNormalizationDetails);
}

function bootstrap() {
  initEmptyState();
  renderAllInputTables();
  attachEvents();
}

bootstrap();
