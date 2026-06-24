const PUNTOS_POR_FASE = {
  dieciseisavos: 1,
  octavos: 2,
  cuartos: 3,
  semifinales: 5,
  final: 8,
};

const PUNTOS_CAMPEON = 13;
const PUNTOS_GOLEADOR = 9;

const FASES_ORDEN = [
  "dieciseisavos",
  "octavos",
  "cuartos",
  "semifinales",
  "final",
];

const FASES_LABELS = {
  dieciseisavos: "Dieciseisavos",
  octavos: "Octavos",
  cuartos: "Cuartos",
  semifinales: "Semifinales",
  final: "Final",
  campeon: "Campeón",
  goleador: "Goleador",
};

const PREVIOUS_KNOCKOUT_PHASE = {
  octavos: "dieciseisavos",
  cuartos: "octavos",
  semifinales: "cuartos",
  final: "semifinales",
};

const EXPECTED_KNOCKOUT_MATCHES = {
  dieciseisavos: 16,
  octavos: 8,
  cuartos: 4,
  semifinales: 2,
  final: 2,
};

const BEST_THIRD_PLACES = 8;

let aliasLookup = null;

function normalizeAliasKey(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function buildAliasLookup(aliases) {
  const lookup = new Map();

  for (const [apiName, localName] of Object.entries(aliases ?? {})) {
    lookup.set(normalizeAliasKey(apiName), localName);
    lookup.set(normalizeAliasKey(localName), localName);
  }

  return lookup;
}

function resolveTeamName(name, lookup) {
  if (!name) {
    return null;
  }

  return lookup.get(normalizeAliasKey(name)) ?? name;
}

function canonicalKey(name, lookup) {
  return normalizeAliasKey(resolveTeamName(name, lookup));
}

function loadAliasesFromDisk() {
  if (typeof require === "undefined") {
    return {};
  }

  try {
    const fs = require("fs");
    const path = require("path");
    const candidates = [
      path.join(__dirname, "data", "team-aliases.json"),
      path.join(__dirname, "..", "data", "team-aliases.json"),
    ];

    for (const aliasesPath of candidates) {
      if (fs.existsSync(aliasesPath)) {
        return JSON.parse(fs.readFileSync(aliasesPath, "utf8"));
      }
    }
  } catch {
    return {};
  }

  return {};
}

function getAliasLookup() {
  if (aliasLookup) {
    return aliasLookup;
  }

  let aliases = {};
  if (typeof window !== "undefined" && window.TEAM_ALIASES) {
    aliases = window.TEAM_ALIASES;
  } else {
    aliases = loadAliasesFromDisk();
  }

  aliasLookup = buildAliasLookup(aliases);
  return aliasLookup;
}

function teamKey(name) {
  return canonicalKey(name, getAliasLookup());
}

function normalizeTeam(name) {
  return String(name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function getTeamsForPhase(partidos, faseGrupo) {
  const teams = new Set();

  for (const partido of partidos) {
    if (partido.faseGrupo !== faseGrupo) {
      continue;
    }

    if (faseGrupo === "final" && partido.fase !== "FINAL") {
      continue;
    }

    if (partido.equipo1) {
      teams.add(teamKey(partido.equipo1));
    }

    if (partido.equipo2) {
      teams.add(teamKey(partido.equipo2));
    }
  }

  return teams;
}

function getDisplayName(originalNames, normalizedName) {
  for (const name of originalNames) {
    if (teamKey(name) === normalizedName) {
      return name;
    }
  }

  return normalizedName;
}

function collectOriginalNames(partidos, resultadosFinales = {}) {
  const names = [];

  for (const partido of partidos) {
    if (partido.equipo1) {
      names.push(partido.equipo1);
    }

    if (partido.equipo2) {
      names.push(partido.equipo2);
    }
  }

  for (const value of Object.values(resultadosFinales)) {
    if (value) {
      names.push(value);
    }
  }

  return names;
}

function getOfficialTeamsInPhase(partidos, faseGrupo) {
  const teams = new Set();

  for (const partido of partidos) {
    if (partido.faseGrupo !== faseGrupo) {
      continue;
    }

    if (faseGrupo === "final" && partido.fase !== "FINAL") {
      continue;
    }

    if (partido.equipo1) {
      teams.add(teamKey(partido.equipo1));
    }

    if (partido.equipo2) {
      teams.add(teamKey(partido.equipo2));
    }
  }

  return teams;
}

function getKnockoutPhaseMatches(partidos, faseGrupo) {
  return partidos.filter((partido) => {
    if (partido.faseGrupo !== faseGrupo) {
      return false;
    }

    if (faseGrupo === "final" && partido.fase !== "FINAL") {
      return false;
    }

    return true;
  });
}

function isKnockoutBracketComplete(faseGrupo, partidos) {
  const expected = EXPECTED_KNOCKOUT_MATCHES[faseGrupo];
  const phaseMatches = getKnockoutPhaseMatches(partidos, faseGrupo);

  if (phaseMatches.length < expected) {
    return false;
  }

  return phaseMatches.every((partido) => partido.equipo1 && partido.equipo2);
}

function getWinnerFromPartido(partido) {
  if (partido.pendiente || !partido.marcador) {
    return null;
  }

  const [a, b] = partido.marcador.split("-").map(Number);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return null;
  }

  if (a > b) {
    return teamKey(partido.equipo1);
  }

  if (b > a) {
    return teamKey(partido.equipo2);
  }

  return null;
}

function isGroupComplete(grupoId, partidosGrupos) {
  const groupMatches = partidosGrupos.filter((partido) => partido.grupo === grupoId);
  if (!groupMatches.length) {
    return false;
  }

  return groupMatches.every((partido) => !partido.pendiente);
}

function getFinishedThirdPlaceTeams(oficial) {
  const grupos = oficial.grupos ?? [];
  const partidosGrupos = oficial.partidosGrupos ?? [];
  const candidates = [];

  for (const grupo of grupos) {
    if (!isGroupComplete(grupo.id, partidosGrupos)) {
      continue;
    }

    const row = grupo.equipos?.find((entry) => entry.posicion === 3);
    if (!row?.equipo) {
      continue;
    }

    candidates.push({
      teamKey: teamKey(row.equipo),
      pts: row.pts ?? 0,
      dg: row.dg ?? 0,
      gf: row.gf ?? 0,
    });
  }

  return candidates.sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf);
}

function getQualifiedThirdPlaceKeys(oficial) {
  const grupos = oficial.grupos ?? [];
  const partidosGrupos = oficial.partidosGrupos ?? [];

  if (!grupos.length) {
    return null;
  }

  const allGroupsFinished = grupos.every((grupo) => isGroupComplete(grupo.id, partidosGrupos));
  if (!allGroupsFinished) {
    return null;
  }

  const thirdPlaceTeams = getFinishedThirdPlaceTeams(oficial);
  if (thirdPlaceTeams.length < grupos.length) {
    return null;
  }

  return new Set(thirdPlaceTeams.slice(0, BEST_THIRD_PLACES).map((entry) => entry.teamKey));
}

function getGroupQualificationStatus(teamNorm, oficial) {
  const grupos = oficial.grupos ?? [];
  const partidosGrupos = oficial.partidosGrupos ?? [];

  for (const grupo of grupos) {
    const row = grupo.equipos?.find((entry) => teamKey(entry.equipo) === teamNorm);
    if (!row) {
      continue;
    }

    if (!isGroupComplete(grupo.id, partidosGrupos)) {
      return "pending";
    }

    if (row.posicion <= 2) {
      return "qualified";
    }

    if (row.posicion >= 4) {
      return "eliminated";
    }

    const qualifiedThirds = getQualifiedThirdPlaceKeys(oficial);
    if (!qualifiedThirds) {
      return "pending";
    }

    return qualifiedThirds.has(teamNorm) ? "qualified" : "eliminated";
  }

  return "unknown";
}

function isGroupStageComplete(oficial) {
  const grupos = oficial.grupos ?? [];
  const partidosGrupos = oficial.partidosGrupos ?? [];

  if (!grupos.length || !partidosGrupos.length) {
    return false;
  }

  return grupos.every((grupo) => isGroupComplete(grupo.id, partidosGrupos));
}

function getKnockoutMatchStatus(teamNorm, partidos, faseGrupo) {
  for (const partido of partidos) {
    if (partido.faseGrupo !== faseGrupo) {
      continue;
    }

    if (faseGrupo === "final" && partido.fase !== "FINAL") {
      continue;
    }

    const team1 = partido.equipo1 ? teamKey(partido.equipo1) : null;
    const team2 = partido.equipo2 ? teamKey(partido.equipo2) : null;

    if (team1 !== teamNorm && team2 !== teamNorm) {
      continue;
    }

    if (!team1 || !team2 || partido.pendiente) {
      return "pending";
    }

    const winner = getWinnerFromPartido(partido);
    return winner === teamNorm ? "won" : "lost";
  }

  return "not_found";
}

function getTeamProgressStatus(teamNorm, faseGrupo, oficial) {
  const partidos = oficial.partidos ?? [];

  if (faseGrupo === "dieciseisavos") {
    const groupStatus = getGroupQualificationStatus(teamNorm, oficial);
    if (groupStatus === "qualified") {
      return "hit";
    }
    if (groupStatus === "eliminated") {
      return "miss";
    }
    return "pending";
  }

  const groupStatus = getGroupQualificationStatus(teamNorm, oficial);
  if (groupStatus === "eliminated") {
    return "miss";
  }
  if (groupStatus === "pending") {
    return "pending";
  }

  const previousPhase = PREVIOUS_KNOCKOUT_PHASE[faseGrupo];
  const previousResult = getKnockoutMatchStatus(teamNorm, partidos, previousPhase);

  if (previousResult === "won") {
    return "hit";
  }

  if (previousResult === "lost") {
    return "miss";
  }

  if (isKnockoutPhaseComplete(previousPhase, partidos) && previousResult === "not_found") {
    return "miss";
  }

  return "pending";
}

function isKnockoutPhaseComplete(faseGrupo, partidos) {
  const expected = EXPECTED_KNOCKOUT_MATCHES[faseGrupo];
  if (!expected) {
    return false;
  }

  const finished = partidos.filter(
    (partido) => partido.faseGrupo === faseGrupo && !partido.pendiente
  ).length;

  return finished >= expected;
}

function isPhaseFullyResolved(faseGrupo, oficial) {
  if (faseGrupo === "dieciseisavos") {
    return isGroupStageComplete(oficial);
  }

  const previousPhase = PREVIOUS_KNOCKOUT_PHASE[faseGrupo];
  return isKnockoutPhaseComplete(previousPhase, oficial.partidos ?? []);
}

function scorePhaseProgressive(predictedPartidos, oficial, faseGrupo, puntosPorEquipo, allNames) {
  const predictedTeams = getTeamsForPhase(predictedPartidos, faseGrupo);
  const aciertos = [];
  const fallos = [];
  const pendientes = [];

  for (const team of predictedTeams) {
    const displayName = getDisplayName(allNames, team);
    const status = getTeamProgressStatus(team, faseGrupo, oficial);

    if (status === "hit") {
      aciertos.push(displayName);
    } else if (status === "miss") {
      fallos.push(displayName);
    } else {
      pendientes.push(displayName);
    }
  }

  const puntos = aciertos.length * puntosPorEquipo;
  const phaseComplete = isPhaseFullyResolved(faseGrupo, oficial);

  return {
    fase: faseGrupo,
    label: FASES_LABELS[faseGrupo],
    puntosPorEquipo,
    equiposPronosticados: predictedTeams.size,
    aciertos,
    fallos,
    pendientes,
    puntos,
    pendiente: !phaseComplete,
    parcial: !phaseComplete && (aciertos.length > 0 || fallos.length > 0),
  };
}

function scoreSpecialField(
  predictedValue,
  officialValue,
  label,
  puntos,
  allNames
) {
  const predicted = teamKey(predictedValue);
  const official = teamKey(officialValue);

  if (!official) {
    return {
      fase: label.toLowerCase(),
      label,
      puntosPorEquipo: puntos,
      aciertos: [],
      fallos: [],
      pendientes: predictedValue ? [predictedValue] : [],
      puntos: 0,
      pendiente: true,
    };
  }

  const acierto = predicted && predicted === official;

  return {
    fase: label.toLowerCase(),
    label,
    puntosPorEquipo: puntos,
    aciertos: acierto ? [getDisplayName(allNames, predicted)] : [],
    fallos:
      predictedValue && !acierto ? [getDisplayName(allNames, predicted)] : [],
    pendientes: [],
    puntos: acierto ? puntos : 0,
    pendiente: false,
  };
}

function evaluarFase(pronosticoPartidos, resultadosFinales, oficial, faseGrupo) {
  const allNames = collectOriginalNames(pronosticoPartidos, resultadosFinales);

  return scorePhaseProgressive(
    pronosticoPartidos,
    oficial,
    faseGrupo,
    PUNTOS_POR_FASE[faseGrupo],
    allNames
  );
}

function evaluarTodasLasFases(pronostico, oficial) {
  const partidos = pronostico.partidos ?? [];
  const resultadosFinales = pronostico.resultadosFinales ?? {};

  return FASES_ORDEN.map((fase) => evaluarFase(partidos, resultadosFinales, oficial, fase));
}

function calcularPuntos(pronostico, oficial) {
  const etapasConfirmadas = oficial.etapasConfirmadas ?? [];
  const desglose = [];
  let total = 0;

  const allNames = [
    ...collectOriginalNames(pronostico.partidos ?? [], pronostico.resultadosFinales ?? {}),
    ...collectOriginalNames(oficial.partidos ?? [], oficial.resultadosFinales ?? {}),
  ];

  for (const fase of FASES_ORDEN) {
    const resultado = scorePhaseProgressive(
      pronostico.partidos ?? [],
      oficial,
      fase,
      PUNTOS_POR_FASE[fase],
      allNames
    );

    if (
      resultado.puntos > 0 ||
      resultado.aciertos.length > 0 ||
      resultado.fallos.length > 0 ||
      resultado.parcial
    ) {
      desglose.push(resultado);
      total += resultado.puntos;
    }
  }

  const campeonOficial = oficial.resultadosFinales?.campeon;
  if (campeonOficial && etapasConfirmadas.includes("campeon")) {
    const resultado = scoreSpecialField(
      pronostico.resultadosFinales?.campeon,
      campeonOficial,
      "Campeón",
      PUNTOS_CAMPEON,
      allNames
    );

    desglose.push(resultado);
    total += resultado.puntos;
  }

  const goleadorOficial = oficial.resultadosFinales?.goleador;
  if (goleadorOficial && etapasConfirmadas.includes("goleador")) {
    const resultado = scoreSpecialField(
      pronostico.resultadosFinales?.goleador,
      goleadorOficial,
      "Goleador",
      PUNTOS_GOLEADOR,
      allNames
    );

    desglose.push(resultado);
    total += resultado.puntos;
  }

  return {
    id: pronostico.participante?.id ?? null,
    participante: pronostico.participante?.nombre ?? "Participante",
    total,
    desglose,
    etapasConfirmadas,
    ultimaActualizacionOficial: oficial.meta?.actualizadoEn ?? null,
  };
}

function calcularRanking(pronosticos, oficial) {
  return pronosticos
    .map((pronostico) => calcularPuntos(pronostico, oficial))
    .sort((a, b) => b.total - a.total);
}

const scoringApi = {
  PUNTOS_POR_FASE,
  PUNTOS_CAMPEON,
  PUNTOS_GOLEADOR,
  FASES_LABELS,
  normalizeTeam,
  teamKey,
  evaluarFase,
  evaluarTodasLasFases,
  calcularPuntos,
  calcularRanking,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = scoringApi;
}

if (typeof window !== "undefined") {
  window.MundialScoring = scoringApi;
}
