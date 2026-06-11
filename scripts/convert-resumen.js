const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const FASES = {
  DIECISEISAVOS: "dieciseisavos",
  OCTAVOS: "octavos",
  CUARTOS: "cuartos",
  SEMIFINALES: "semifinales",
  FINAL: "final",
};

const RESULTADO_LABELS = {
  "🥇 CAMPEÓN:": "campeon",
  "🥈 SUBCAMPEÓN:": "subcampeon",
  "🥉 TERCER PUESTO:": "tercerPuesto",
  "4️⃣ CUARTO PUESTO:": "cuartoPuesto",
  "⚽ GOLEADOR:": "goleador",
};

function excelDateToIso(value) {
  if (typeof value !== "number") {
    return null;
  }

  const date = XLSX.SSF.parse_date_code(value);
  if (!date) {
    return null;
  }

  const month = String(date.m).padStart(2, "0");
  const day = String(date.d).padStart(2, "0");
  return `${date.y}-${month}-${day}`;
}

function normalizeText(value) {
  return String(value ?? "").trim();
}

function parseResultado(resultado) {
  const text = normalizeText(resultado);

  if (!text || text === "-") {
    return { marcador: null, pendiente: true };
  }

  return { marcador: text, pendiente: false };
}

function getSheetCellValue(sheet, row, col) {
  const cell = sheet[XLSX.utils.encode_cell({ r: row, c: col })];
  const value = cell?.v;

  if (value === undefined || value === null) {
    return "";
  }

  return normalizeText(value);
}

function parseMarcadorScore(marcador) {
  const text = normalizeText(marcador);

  if (!text || text === "-") {
    return null;
  }

  const [a, b] = text.split("-").map(Number);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return null;
  }

  return { a, b };
}

function winnerLoserFromMatch(equipo1, equipo2, marcador) {
  const score = parseMarcadorScore(marcador);

  if (!score) {
    return { ganador: null, perdedor: null };
  }

  if (score.a > score.b) {
    return { ganador: equipo1, perdedor: equipo2 };
  }

  if (score.b > score.a) {
    return { ganador: equipo2, perdedor: equipo1 };
  }

  return { ganador: null, perdedor: null };
}

function findFinalMatchRows(rows) {
  const matches = [];

  for (let i = 0; i < rows.length; i++) {
    const matchId = rows[i]?.[0];
    const equipo1 = normalizeText(rows[i]?.[4]) || normalizeText(rows[i]?.[3]);
    const equipo2 = normalizeText(rows[i]?.[12]) || normalizeText(rows[i]?.[11]);
    const marcador =
      normalizeText(rows[i]?.[8]) ||
      normalizeText(rows[i]?.[9]);

    if (typeof matchId !== "number" || !equipo1 || !equipo2) {
      continue;
    }

    matches.push({ rowIndex: i, equipo1, equipo2, marcador });
  }

  return matches;
}

function parseFinalSheet(workbook) {
  const sheetName = workbook.SheetNames.find((name) => name.toUpperCase() === "FINAL");

  if (!sheetName) {
    return null;
  }

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const matches = findFinalMatchRows(rows);

  if (!matches.length) {
    return null;
  }

  const tercerPuestoMatch = matches[0];
  const finalMatch = matches[matches.length - 1];

  const campeonFormula = getSheetCellValue(sheet, 12, 21);
  const subcampeonFormula = getSheetCellValue(sheet, 13, 17);
  const tercerFormula = getSheetCellValue(sheet, 6, 17);
  const cuartoFormula = getSheetCellValue(sheet, 6, 19);

  const finalResult = winnerLoserFromMatch(
    finalMatch.equipo1,
    finalMatch.equipo2,
    finalMatch.marcador
  );

  const tercerResult = winnerLoserFromMatch(
    tercerPuestoMatch.equipo1,
    tercerPuestoMatch.equipo2,
    tercerPuestoMatch.marcador
  );

  return {
    campeon: campeonFormula || finalResult.ganador || null,
    subcampeon: subcampeonFormula || finalResult.perdedor || null,
    tercerPuesto: tercerFormula || tercerResult.ganador || null,
    cuartoPuesto: cuartoFormula || tercerResult.perdedor || null,
  };
}

function detectFaseGrupo(cell) {
  const text = normalizeText(cell).toUpperCase();

  if (text.includes("DIECISEISAVOS")) return FASES.DIECISEISAVOS;
  if (text.includes("OCTAVOS")) return FASES.OCTAVOS;
  if (text.includes("CUARTOS")) return FASES.CUARTOS;
  if (text.includes("SEMIFINAL")) return FASES.SEMIFINALES;
  if (text.includes("FINAL")) return FASES.FINAL;

  return null;
}

function parseResumenSheet(rows) {
  const titulo = normalizeText(rows[0]?.[0]) || "RESUMEN DE ELIMINATORIAS";
  const partidos = [];
  const resultadosFinales = {
    campeon: null,
    subcampeon: null,
    tercerPuesto: null,
    cuartoPuesto: null,
    goleador: null,
  };

  let faseGrupoActual = null;
  let enResultadosFinales = false;

  for (const row of rows.slice(2)) {
    const firstCell = normalizeText(row[0]);

    if (!firstCell) {
      continue;
    }

    if (firstCell === "RESULTADOS FINALES") {
      enResultadosFinales = true;
      continue;
    }

    if (enResultadosFinales) {
      const key = RESULTADO_LABELS[firstCell];
      if (key && key !== "campeon" && key !== "subcampeon") {
        const value = normalizeText(row[1]) || null;
        resultadosFinales[key] = value;
      }
      continue;
    }

    const faseDetectada = detectFaseGrupo(firstCell);
    if (faseDetectada && !row[1] && !row[2]) {
      faseGrupoActual = faseDetectada;
      continue;
    }

    if (firstCell === "FASE") {
      continue;
    }

    const fase = normalizeText(row[0]);
    const equipo1 = normalizeText(row[2]);
    const equipo2 = normalizeText(row[4]);
    const estadio = normalizeText(row[5]);
    const { marcador, pendiente } = parseResultado(row[3]);

    if (!equipo1 || !equipo2) {
      continue;
    }

    partidos.push({
      fase,
      faseGrupo: faseGrupoActual,
      fecha: excelDateToIso(row[1]),
      equipo1,
      equipo2,
      marcador,
      pendiente,
      estadio: estadio || null,
    });
  }

  return {
    version: 1,
    fuente: "Concurso Mundial 2026",
    hoja: "RESUMEN",
    titulo,
    participante: {
      nombre: null,
    },
    partidos,
    resultadosFinales,
    meta: {
      totalPartidos: partidos.length,
      partidosPendientes: partidos.filter((partido) => partido.pendiente).length,
      generadoEn: new Date().toISOString(),
    },
  };
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function convertResumen(inputPath, outputPath, participantName = null) {
  const workbook = XLSX.readFile(inputPath, { cellDates: false });
  const sheetName =
    workbook.SheetNames.find((name) => name.toUpperCase() === "RESUMEN") ||
    "RESUMEN";

  if (!workbook.Sheets[sheetName]) {
    throw new Error(`No se encontró la hoja RESUMEN en ${inputPath}`);
  }

  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
    header: 1,
    defval: "",
  });

  const data = parseResumenSheet(rows);
  const finalResults = parseFinalSheet(workbook);

  if (finalResults) {
    data.resultadosFinales.campeon = finalResults.campeon;
    data.resultadosFinales.subcampeon = finalResults.subcampeon;

    if (finalResults.tercerPuesto) {
      data.resultadosFinales.tercerPuesto = finalResults.tercerPuesto;
    }

    if (finalResults.cuartoPuesto) {
      data.resultadosFinales.cuartoPuesto = finalResults.cuartoPuesto;
    }
  }

  const nombre = participantName || data.participante?.nombre || null;
  const id = slugify(path.basename(outputPath, ".json")) || slugify(nombre);

  data.participante = {
    id: id || null,
    nombre,
  };

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");

  return data;
}

function main() {
  const inputPath =
    process.argv[2] ||
    "C:/Users/vanet/Downloads/Concurso Mundial 2026  Pruebas IA.xlsx";
  const outputPath =
    process.argv[3] ||
    path.join(__dirname, "..", "data", "ejemplo-resumen.json");

  const data = convertResumen(inputPath, outputPath);

  console.log(`Convertido: ${inputPath}`);
  console.log(`Salida: ${outputPath}`);
  console.log(`Partidos: ${data.meta.totalPartidos}`);
  console.log(`Pendientes: ${data.meta.partidosPendientes}`);
}

if (require.main === module) {
  main();
}

module.exports = { convertResumen, parseResumenSheet, parseFinalSheet };
