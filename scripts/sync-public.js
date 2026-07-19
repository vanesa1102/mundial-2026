const fs = require("fs");
const path = require("path");
const { buildAliasLookup, resolveTeamName } = require("../lib/team-aliases");

const root = path.join(__dirname, "..");

function copyFile(source, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function copyDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.mkdirSync(targetDir, { recursive: true });

  for (const file of fs.readdirSync(sourceDir)) {
    if (!file.endsWith(".json")) {
      continue;
    }

    copyFile(path.join(sourceDir, file), path.join(targetDir, file));
  }
}

function mirrorDirectory(sourceDir, targetDir) {
  if (!fs.existsSync(sourceDir)) {
    return;
  }

  fs.rmSync(targetDir, { recursive: true, force: true });
  fs.mkdirSync(targetDir, { recursive: true });

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      mirrorDirectory(sourcePath, targetPath);
      continue;
    }

    copyFile(sourcePath, targetPath);
  }
}

function remapTeamName(name, lookup) {
  if (!name) {
    return name;
  }

  return resolveTeamName(name, lookup) ?? name;
}

function remapPartido(partido, lookup) {
  return {
    ...partido,
    equipo1: remapTeamName(partido.equipo1, lookup),
    equipo2: remapTeamName(partido.equipo2, lookup),
  };
}

function remapResultadosOficiales(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const aliasesPath = path.join(root, "data", "team-aliases.json");
  if (!fs.existsSync(aliasesPath)) {
    return;
  }

  const lookup = buildAliasLookup(JSON.parse(fs.readFileSync(aliasesPath, "utf8")));
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));

  data.grupos = (data.grupos ?? []).map((grupo) => ({
    ...grupo,
    equipos: (grupo.equipos ?? []).map((row) => ({
      ...row,
      equipo: remapTeamName(row.equipo, lookup),
    })),
  }));

  data.partidosGrupos = (data.partidosGrupos ?? []).map((partido) =>
    remapPartido(partido, lookup)
  );
  data.partidos = (data.partidos ?? []).map((partido) => remapPartido(partido, lookup));

  if (data.resultadosFinales) {
    for (const key of Object.keys(data.resultadosFinales)) {
      data.resultadosFinales[key] = remapTeamName(data.resultadosFinales[key], lookup);
    }
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function injectTeamAliasesIntoScoring() {
  const aliasesPath = path.join(root, "data", "team-aliases.json");
  const playerAliasesPath = path.join(root, "data", "player-aliases.json");
  const scoringPath = path.join(root, "public", "scoring.js");

  if (!fs.existsSync(scoringPath)) {
    return;
  }

  const aliases = fs.existsSync(aliasesPath)
    ? JSON.parse(fs.readFileSync(aliasesPath, "utf8"))
    : {};
  const playerAliases = fs.existsSync(playerAliasesPath)
    ? JSON.parse(fs.readFileSync(playerAliasesPath, "utf8"))
    : {};

  let scoring = fs.readFileSync(scoringPath, "utf8");
  scoring = scoring.replace(
    /^if \(typeof window !== "undefined"\) \{\n  window\.TEAM_ALIASES[\s\S]*?\n\}\n*/m,
    ""
  );
  scoring = scoring.replace(
    /\nif \(typeof window !== "undefined"\) \{\n  window\.TEAM_ALIASES[\s\S]*?\n\}\n?$/m,
    ""
  );
  scoring = scoring.replace(
    /^if \(typeof window !== "undefined"\) \{\n  window\.PLAYER_ALIASES[\s\S]*?\n\}\n*/m,
    ""
  );
  scoring = scoring.replace(
    /\nif \(typeof window !== "undefined"\) \{\n  window\.PLAYER_ALIASES[\s\S]*?\n\}\n?$/m,
    ""
  );

  const prefix = `if (typeof window !== "undefined") {\n  window.TEAM_ALIASES = ${JSON.stringify(aliases)};\n  window.PLAYER_ALIASES = ${JSON.stringify(playerAliases)};\n}\n\n`;
  fs.writeFileSync(scoringPath, prefix + scoring.trimEnd() + "\n", "utf8");
}

const files = [
  ["data/resultados-oficiales.json", "public/data/resultados-oficiales.json"],
  ["data/ranking.json", "public/data/ranking.json"],
  ["data/config.json", "public/data/config.json"],
  ["data/team-aliases.json", "public/data/team-aliases.json"],
  ["data/player-aliases.json", "public/data/player-aliases.json"],
  ["lib/scoring.js", "public/scoring.js"],
];

for (const [source, target] of files) {
  const sourcePath = path.join(root, source);
  if (fs.existsSync(sourcePath)) {
    copyFile(sourcePath, target);
  }
}

remapResultadosOficiales(path.join(root, "data", "resultados-oficiales.json"));
remapResultadosOficiales(path.join(root, "public", "data", "resultados-oficiales.json"));
injectTeamAliasesIntoScoring();

const rankingPath = path.join(root, "data", "ranking.json");
if (fs.existsSync(rankingPath)) {
  const ranking = JSON.parse(fs.readFileSync(rankingPath, "utf8"));
  const bundlePath = path.join(root, "public", "data", "ranking.bundle.js");
  fs.writeFileSync(
    bundlePath,
    `window.RANKING_DATA = ${JSON.stringify(ranking)};\n`,
    "utf8"
  );
}

copyDirectory(
  path.join(root, "data", "participantes"),
  path.join(root, "public", "data", "participantes")
);

const docsDir = path.join(root, "docs");
mirrorDirectory(path.join(root, "public"), docsDir);
fs.writeFileSync(path.join(docsDir, ".nojekyll"), "", "utf8");

console.log("Archivos sincronizados a public/ y docs/");
