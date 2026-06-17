const fs = require("fs");
const path = require("path");
const { fetchOfficialFromApi } = require("../lib/football-data");

const root = path.join(__dirname, "..");
const configPath = path.join(root, "data", "config.json");
const aliasesPath = path.join(root, "data", "team-aliases.json");
const outputPath = path.join(root, "data", "resultados-oficiales.json");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

async function main() {
  const config = readJson(configPath);
  const aliases = fs.existsSync(aliasesPath) ? readJson(aliasesPath) : {};
  const footballData = config.footballData ?? {};
  const token = process.env.FOOTBALL_DATA_TOKEN || footballData.token;

  if (footballData.enabled === false) {
    throw new Error("Activa footballData.enabled en data/config.json");
  }

  if (!token) {
    throw new Error(
      "Falta el token. Usa footballData.token en config o la variable FOOTBALL_DATA_TOKEN."
    );
  }

  console.log("Consultando football-data.org…");

  const oficial = await fetchOfficialFromApi({
    token,
    competition: footballData.competition ?? "WC",
    season: footballData.season ?? 2026,
    aliases,
  });

  fs.writeFileSync(outputPath, JSON.stringify(oficial, null, 2), "utf8");

  console.log(`Resultados guardados en ${outputPath}`);
  console.log(`Partidos: ${oficial.partidos.length}`);
  console.log(
    `Etapas confirmadas: ${oficial.etapasConfirmadas.join(", ") || "ninguna"}`
  );

  if (oficial.resultadosFinales?.campeon) {
    console.log(`Campeón: ${oficial.resultadosFinales.campeon}`);
  }

  if (oficial.resultadosFinales?.goleador) {
    console.log(`Goleador: ${oficial.resultadosFinales.goleador}`);
  }

  console.log("\nEjecuta npm run build y sube los cambios para actualizar la web.");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
