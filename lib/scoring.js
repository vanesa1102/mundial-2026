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
      teams.add(normalizeTeam(partido.equipo1));
    }

    if (partido.equipo2) {
      teams.add(normalizeTeam(partido.equipo2));
    }
  }

  return teams;
}

function getDisplayName(originalNames, normalizedName) {
  for (const name of originalNames) {
    if (normalizeTeam(name) === normalizedName) {
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
      teams.add(normalizeTeam(partido.equipo1));
    }

    if (partido.equipo2) {
      teams.add(normalizeTeam(partido.equipo2));
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
    return normalizeTeam(partido.equipo1);
  }

  if (b > a) {
    return normalizeTeam(partido.equipo2);
  }

  return null;
}

function getKnockoutMatchStatus(teamNorm, partidos, faseGrupo) {
  for (const partido of partidos) {
    if (partido.faseGrupo !== faseGrupo) {
      continue;
    }

    if (faseGrupo === "final" && partido.fase !== "FINAL") {
      continue;
    }

    const team1 = partido.equipo1 ? normalizeTeam(partido.equipo1) : null;
    const team2 = partido.equipo2 ? normalizeTeam(partido.equipo2) : null;

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
    const officialTeams = getOfficialTeamsInPhase(partidos, faseGrupo);

    if (officialTeams.has(teamNorm)) {
      return "hit";
    }

    if (isKnockoutBracketComplete("dieciseisavos", partidos)) {
      return "miss";
    }

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

  const officialTeams = getOfficialTeamsInPhase(partidos, faseGrupo);
  if (officialTeams.has(teamNorm)) {
    return "hit";
  }

  if (isKnockoutPhaseComplete(previousPhase, partidos)) {
    if (previousResult === "not_found") {
      return "miss";
    }
  }

  if (isKnockoutBracketComplete(faseGrupo, partidos) && !officialTeams.has(teamNorm)) {
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
  const partidos = oficial.partidos ?? [];

  if (faseGrupo === "dieciseisavos") {
    return isKnockoutPhaseComplete("dieciseisavos", partidos);
  }

  const previousPhase = PREVIOUS_KNOCKOUT_PHASE[faseGrupo];
  return isKnockoutPhaseComplete(previousPhase, partidos);
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
  const predicted = normalizeTeam(predictedValue);
  const official = normalizeTeam(officialValue);

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
