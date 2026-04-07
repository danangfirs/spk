/**
 * Validasi awal mengikuti aturan dokumen:
 * - minimal 1 kriteria dan 2 alternatif
 * - type hanya benefit/cost
 * - bobot > 0 dan total bobot = 1 (dengan toleransi kecil)
 * - semua nilai alternatif harus numerik
 */
export function validateSAWInput(criteria, alternatives) {
  const errors = [];

  if (!Array.isArray(criteria) || criteria.length < 1) {
    errors.push("Minimal harus ada 1 kriteria.");
  }

  if (!Array.isArray(alternatives) || alternatives.length < 2) {
    errors.push("Minimal harus ada 2 alternatif.");
  }

  let totalWeight = 0;
  const criterionCodes = new Set();

  criteria.forEach((c, index) => {
    if (!c.code || !String(c.code).trim()) {
      errors.push(`Kode kriteria pada baris ${index + 1} wajib diisi.`);
    }

    if (!["benefit", "cost"].includes(c.type)) {
      errors.push(`Tipe kriteria ${c.code || index + 1} harus benefit/cost.`);
    }

    const weight = Number(c.weight);
    if (!Number.isFinite(weight) || weight <= 0) {
      errors.push(`Bobot kriteria ${c.code || index + 1} harus angka > 0.`);
    } else {
      totalWeight += weight;
    }

    if (criterionCodes.has(c.code)) {
      errors.push(`Kode kriteria duplikat: ${c.code}.`);
    }
    criterionCodes.add(c.code);
  });

  if (criteria.length > 0 && Math.abs(totalWeight - 1) > 1e-6) {
    errors.push(`Total bobot harus = 1. Saat ini: ${totalWeight.toFixed(6)}.`);
  }

  alternatives.forEach((alt, altIndex) => {
    if (!alt.code || !String(alt.code).trim()) {
      errors.push(`Kode alternatif pada baris ${altIndex + 1} wajib diisi.`);
    }

    criteria.forEach((c) => {
      const raw = alt.values?.[c.code];
      const num = Number(raw);
      if (!Number.isFinite(num)) {
        errors.push(`Nilai ${c.code} untuk alternatif ${alt.code || altIndex + 1} harus numerik.`);
      }
    });
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Menghitung matrix normalisasi r_ij:
 * - benefit: x_ij / max_j
 * - cost:    min_j / x_ij
 */
export function normalizeSAW(criteria, alternatives) {
  const maxValues = {};
  const minValues = {};

  criteria.forEach((c) => {
    const values = alternatives.map((a) => Number(a.values[c.code]));
    maxValues[c.code] = Math.max(...values);
    minValues[c.code] = Math.min(...values);
  });

  const normalizedAlternatives = alternatives.map((a) => {
    const normalized = {};

    criteria.forEach((c) => {
      const x = Number(a.values[c.code]);
      if (c.type === "benefit") {
        normalized[c.code] = maxValues[c.code] === 0 ? 0 : x / maxValues[c.code];
      } else {
        normalized[c.code] = x === 0 ? 0 : minValues[c.code] / x;
      }
    });

    return {
      code: a.code,
      name: a.name,
      normalized
    };
  });

  return { maxValues, minValues, normalizedAlternatives };
}

/**
 * Menghitung nilai preferensi:
 * V_i = sum(w_j * r_ij), lalu ranking desc.
 */
export function calculateScores(criteria, alternatives) {
  const { normalizedAlternatives } = normalizeSAW(criteria, alternatives);

  const scored = normalizedAlternatives.map((a) => {
    const score = criteria.reduce((total, c) => {
      const weight = Number(c.weight);
      return total + weight * a.normalized[c.code];
    }, 0);

    return {
      code: a.code,
      name: a.name,
      normalized: a.normalized,
      score
    };
  });

  const ranking = [...scored].sort((a, b) => b.score - a.score);
  return { normalizedAlternatives, ranking };
}
