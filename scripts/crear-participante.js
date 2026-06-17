const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const templatePath = path.join(root, "data", "plantilla-participante.json");
const pendientesPath = path.join(root, "data", "participantes-pendientes.json");
const participantesDir = path.join(root, "data", "participantes");

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function createBlankParticipant(id, nombre) {
  const template = readJson(templatePath);
  const data = JSON.parse(JSON.stringify(template));

  data.participante = { id, nombre };
  data.meta = {
    ...data.meta,
    pendienteExcel: true,
    generadoEn: new Date().toISOString(),
  };

  return data;
}

function saveParticipant(id, nombre, { force = false } = {}) {
  const outputPath = path.join(participantesDir, `${id}.json`);

  if (fs.existsSync(outputPath) && !force) {
    throw new Error(`Ya existe ${outputPath}. Usa --force para sobrescribir.`);
  }

  fs.mkdirSync(participantesDir, { recursive: true });
  const data = createBlankParticipant(id, nombre);
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf8");

  return outputPath;
}

function printHelp() {
  console.log(`
Uso:
  npm run add:participante -- "Nombre Completo" [id-opcional]
  npm run add:participante -- --all
  npm run add:participante -- --all --force

Ejemplos:
  npm run add:participante -- "Carlos Ruiz"
  npm run add:participante -- "Maria Lopez" "maria-lopez"
  npm run add:participante -- --all

Qué hace:
  Crea data/participantes/<id>.json sin pronósticos (pendiente de Excel).
  Edita data/participantes-pendientes.json y usa --all para crear varios a la vez.

Después, cuando llegue el Excel:
  npm run update:jugador -- "archivo.xlsx" "Nombre Completo"
`);
}

function runBuild() {
  execSync("npm run build", { stdio: "inherit", cwd: root });
}

function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const all = args.includes("--all");
  const help = args.includes("--help") || args.includes("-h");
  const positional = args.filter((arg) => !arg.startsWith("--"));

  if (help) {
    printHelp();
    process.exit(0);
  }

  if (all) {
    if (!fs.existsSync(pendientesPath)) {
      console.error(`No se encontró ${pendientesPath}`);
      process.exit(1);
    }

    const { participantes } = readJson(pendientesPath);
    if (!participantes?.length) {
      console.error("No hay participantes en data/participantes-pendientes.json");
      process.exit(1);
    }

    const created = [];

    for (const entry of participantes) {
      const nombre = entry.nombre?.trim();
      if (!nombre) {
        continue;
      }

      const id = entry.id ? slugify(entry.id) : slugify(nombre);
      const outputPath = saveParticipant(id, nombre, { force });
      created.push({ id, nombre, outputPath });
      console.log(`Creado: ${nombre} (${id})`);
    }

    if (!created.length) {
      console.error("No se creó ningún participante.");
      process.exit(1);
    }

    console.log("");
    runBuild();
    console.log(`\nListo. ${created.length} participante(s) registrados sin apuesta.`);
    return;
  }

  const nombre = positional[0];
  const idArg = positional[1];

  if (!nombre) {
    printHelp();
    process.exit(1);
  }

  const id = idArg ? slugify(idArg) : slugify(nombre);
  if (!id) {
    console.error("No se pudo generar un id válido.");
    process.exit(1);
  }

  try {
    const outputPath = saveParticipant(id, nombre, { force });
    console.log(`Participante inicial creado: ${nombre} (${id})`);
    console.log(`Archivo: ${outputPath}`);
    console.log("Sin pronósticos — pendiente de Excel.");
    console.log("");
    runBuild();
    console.log(`Ver en la web: http://localhost:3000/jugador.html#${id}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

main();
