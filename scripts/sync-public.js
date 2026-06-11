const fs = require("fs");
const path = require("path");

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

const files = [
  ["data/resultados-oficiales.json", "public/data/resultados-oficiales.json"],
  ["data/ranking.json", "public/data/ranking.json"],
  ["data/config.json", "public/data/config.json"],
  ["lib/scoring.js", "public/scoring.js"],
];

for (const [source, target] of files) {
  const sourcePath = path.join(root, source);
  if (fs.existsSync(sourcePath)) {
    copyFile(sourcePath, target);
  }
}

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

console.log("Archivos sincronizados a public/");
