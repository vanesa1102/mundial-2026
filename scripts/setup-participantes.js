const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const base = JSON.parse(fs.readFileSync(path.join(root, "data", "ejemplo-resumen.json"), "utf8"));
const dir = path.join(root, "data", "participantes");
fs.mkdirSync(dir, { recursive: true });

function save(id, nombre, mutator) {
  const data = JSON.parse(JSON.stringify(base));
  data.participante = { id, nombre };
  mutator(data);
  fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(data, null, 2), "utf8");
}

save("pepita-perez", "Pepita Perez", () => {});

save("juan-ramirez", "Juan Ramirez", (data) => {
  data.resultadosFinales.campeon = "ARGENTINA";
  data.resultadosFinales.subcampeon = "BRASIL";

  for (const partido of data.partidos) {
    if (!["octavos", "cuartos", "semifinales", "final"].includes(partido.faseGrupo)) {
      continue;
    }

    if (partido.equipo1 === "COLOMBIA") partido.equipo1 = "SENEGAL";
    if (partido.equipo2 === "COLOMBIA") partido.equipo2 = "SENEGAL";
    if (partido.equipo1 === "PAÍSES BAJOS") partido.equipo1 = "ALEMANIA";
    if (partido.equipo2 === "PAÍSES BAJOS") partido.equipo2 = "ALEMANIA";
  }
});

save("ana-torres", "Ana Torres", (data) => {
  data.resultadosFinales.campeon = "BRASIL";

  for (const partido of data.partidos) {
    if (partido.faseGrupo === "cuartos" && partido.equipo2 === "COLOMBIA") {
      partido.equipo2 = "ARGENTINA";
    }

    if (partido.faseGrupo === "semifinales" && partido.equipo2 === "COLOMBIA") {
      partido.equipo2 = "ARGENTINA";
    }
  }
});

console.log("Participantes listos en data/participantes/");
