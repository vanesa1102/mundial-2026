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

function scorePhase(predictedPartidos, officialPartidos, faseGrupo, puntosPorEquipo) {
  const predictedTeams = getTeamsForPhase(predictedPartidos, faseGrupo);
  const officialTeams = getTeamsForPhase(officialPartidos, faseGrupo);
  const allNames = [...predictedPartidos, ...officialPartidos].flatMap((partido) => [
    partido.equipo1,
    partido.equipo2,
  ]);

  const aciertos = [];
  const fallos = [];

  for (const team of predictedTeams) {
    const displayName = getDisplayName(allNames, team);

    if (officialTeams.has(team)) {
      aciertos.push(displayName);
    } else {
      fallos.push(displayName);
    }
  }

  const puntos = aciertos.length * puntosPorEquipo;

  return {
    fase: faseGrupo,
    label: FASES_LABELS[faseGrupo],
    puntosPorEquipo,
    equiposPronosticados: predictedTeams.size,
    equiposOficiales: officialTeams.size,
    aciertos,
    fallos,
    puntos,
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
      fallos: predictedValue ? [predictedValue] : [],
      puntos: 0,
      pendiente: true,
    };
  }

  const acierto = predicted && predicted === official;

  return {
    fase: label.toLowerCase(),
    label,
    puntosPorEquipo: puntos,
    aciertos: acierto
      ? [getDisplayName(allNames, predicted)]
      : [],
    fallos:
      predictedValue && !acierto
        ? [getDisplayName(allNames, predicted)]
        : [],
    puntos: acierto ? puntos : 0,
    pendiente: false,
  };
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
    if (!etapasConfirmadas.includes(fase)) {
      continue;
    }

    const resultado = scorePhase(
      pronostico.partidos ?? [],
      oficial.partidos ?? [],
      fase,
      PUNTOS_POR_FASE[fase]
    );

    desglose.push(resultado);
    total += resultado.puntos;
  }

  if (etapasConfirmadas.includes("campeon")) {
    const resultado = scoreSpecialField(
      pronostico.resultadosFinales?.campeon,
      oficial.resultadosFinales?.campeon,
      "Campeón",
      PUNTOS_CAMPEON,
      allNames
    );

    desglose.push(resultado);
    total += resultado.puntos;
  }

  if (etapasConfirmadas.includes("goleador")) {
    const resultado = scoreSpecialField(
      pronostico.resultadosFinales?.goleador,
      oficial.resultadosFinales?.goleador,
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
  calcularPuntos,
  calcularRanking,
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = scoringApi;
}

if (typeof window !== "undefined") {
  window.MundialScoring = scoringApi;
}
