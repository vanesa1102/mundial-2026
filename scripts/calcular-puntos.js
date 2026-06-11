const fs = require("fs");
const path = require("path");
const { calcularRanking } = require("../lib/scoring");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listParticipantFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".json"))
    .map((file) => path.join(dir, file));
}

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function ensureParticipantId(pronostico, filePath) {
  const nombre = pronostico.participante?.nombre ?? "Participante";
  const id =
    pronostico.participante?.id ||
    slugify(path.basename(filePath, ".json")) ||
    slugify(nombre);

  return {
    ...pronostico,
    participante: {
      ...pronostico.participante,
      id,
      nombre,
    },
  };
}

function calcularPremios(ranking, config) {
  const inscripcion = config.inscripcion ?? 0;
  const distribucion = config.distribucionPremios ?? { 1: 0.5, 2: 0.3, 3: 0.2 };
  const pozoTotal = ranking.length * inscripcion;

  return ranking.map((entry, index) => {
    const posicion = index + 1;
    const porcentaje = distribucion[String(posicion)] ?? 0;
    const premio = Math.round(pozoTotal * porcentaje);

    return {
      ...entry,
      posicion,
      premio,
      premioPorcentaje: porcentaje,
    };
  });
}

function main() {
  const root = path.join(__dirname, "..");
  const oficialPath = process.argv[2] || path.join(root, "data", "resultados-oficiales.json");
  const participantesDir = process.argv[3] || path.join(root, "data", "participantes");
  const outputPath = process.argv[4] || path.join(root, "data", "ranking.json");
  const configPath = path.join(root, "data", "config.json");

  const oficial = readJson(oficialPath);
  const config = fs.existsSync(configPath) ? readJson(configPath) : {};
  const participantFiles = listParticipantFiles(participantesDir);

  if (participantFiles.length === 0) {
    throw new Error(
      `No hay participantes en ${participantesDir}. Agrega archivos JSON con id y nombre.`
    );
  }

  const pronosticos = participantFiles.map((filePath) =>
    ensureParticipantId(readJson(filePath), filePath)
  );

  const rankingBase = calcularRanking(pronosticos, oficial);
  const ranking = calcularPremios(rankingBase, config);
  const pozoTotal = ranking.length * (config.inscripcion ?? 0);

  const payload = {
    generadoEn: new Date().toISOString(),
    config,
    pozoTotal,
    totalJugadores: ranking.length,
    etapasConfirmadas: oficial.etapasConfirmadas ?? [],
    ultimaActualizacionOficial: oficial.meta?.actualizadoEn ?? null,
    ranking,
  };

  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8");

  console.log(`Ranking generado: ${outputPath}`);
  console.log(`Jugadores: ${ranking.length} | Pozo total: $${pozoTotal.toLocaleString("es-CO")}`);
  console.log(`Etapas confirmadas: ${payload.etapasConfirmadas.join(", ") || "ninguna"}`);
  console.log("");

  ranking.forEach((entry) => {
    const premio =
      entry.premio > 0
        ? `$${entry.premio.toLocaleString("es-CO")} (${Math.round(entry.premioPorcentaje * 100)}%)`
        : "—";

    console.log(`${entry.posicion}. [${entry.id}] ${entry.participante}: ${entry.total} pts | ${premio}`);
  });
}

main();
