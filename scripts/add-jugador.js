const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { convertResumen } = require("./convert-resumen");

const root = path.join(__dirname, "..");

function slugify(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseArgs(argv) {
  const flags = { update: false, help: false };
  const positional = [];

  for (const arg of argv.slice(2)) {
    if (arg === "--help" || arg === "-h") {
      flags.help = true;
    } else if (arg === "--update" || arg === "-u") {
      flags.update = true;
    } else {
      positional.push(arg);
    }
  }

  return {
    flags,
    excelPath: positional[0],
    nombre: positional[1],
    idArg: positional[2],
  };
}

function printHelp() {
  console.log(`
Uso:
  npm run add:jugador -- "<excel.xlsx>" "<Nombre Completo>" [id-opcional]
  npm run add:jugador -- --update "<excel.xlsx>" "<Nombre Completo>" [id-opcional]
  npm run update:jugador -- "<excel.xlsx>" "<Nombre Completo>" [id-opcional]

Ejemplos:
  npm run add:jugador -- "C:\\Descargas\\Maria.xlsx" "Maria Lopez"
  npm run add:jugador -- "C:\\Descargas\\Maria.xlsx" "Maria Lopez" "maria-lopez"
  npm run update:jugador -- "C:\\Descargas\\Pepita-v2.xlsx" "Pepita Perez"

Qué hace:
  1. Convierte la pestaña RESUMEN del Excel a JSON
  2. Guarda en data/participantes/<id>.json
  3. Recalcula el ranking y actualiza la web (npm run build)

Actualizar:
  Si el jugador ya existe, usa --update o el comando update:jugador para sobrescribir su apuesta.
`);
}

function runBuild() {
  console.log("Actualizando ranking y web...");
  execSync("npm run build", { stdio: "inherit", cwd: root });
}

function main() {
  const { flags, excelPath, nombre, idArg } = parseArgs(process.argv);

  if (flags.help || (!excelPath && !nombre)) {
    printHelp();
    process.exit(flags.help ? 0 : 1);
  }

  if (!excelPath || !nombre) {
    console.error("Faltan argumentos: se requiere ruta del Excel y nombre del jugador.");
    printHelp();
    process.exit(1);
  }

  const resolvedExcel = path.resolve(excelPath);
  if (!fs.existsSync(resolvedExcel)) {
    console.error(`No se encontró el archivo: ${resolvedExcel}`);
    process.exit(1);
  }

  const id = idArg ? slugify(idArg) : slugify(nombre);
  if (!id) {
    console.error("No se pudo generar un id válido. Indica uno manualmente como tercer argumento.");
    process.exit(1);
  }

  const outputPath = path.join(root, "data", "participantes", `${id}.json`);
  const exists = fs.existsSync(outputPath);

  if (exists && !flags.update) {
    console.error(`Ya existe un jugador con id "${id}": ${outputPath}`);
    console.error("");
    console.error("Para actualizar su apuesta con un nuevo Excel:");
    console.error(`  npm run update:jugador -- "${resolvedExcel}" "${nombre}"`);
    console.error("o:");
    console.error(`  npm run add:jugador -- --update "${resolvedExcel}" "${nombre}"`);
    process.exit(1);
  }

  const action = exists ? "Actualizando" : "Agregando";
  console.log(`${action} jugador: ${nombre} (${id})`);
  console.log(`Excel: ${resolvedExcel}`);

  const data = convertResumen(resolvedExcel, outputPath, nombre);

  console.log(`JSON ${exists ? "actualizado" : "creado"}: ${outputPath}`);
  console.log(`Partidos: ${data.meta.totalPartidos} | Pendientes: ${data.meta.partidosPendientes}`);
  console.log("");
  runBuild();

  console.log("");
  console.log("Listo.");
  console.log(`Ver en la web: http://localhost:3000`);
  console.log(`Detalle del jugador: http://localhost:3000/jugador.html#${id}`);
}

main();
