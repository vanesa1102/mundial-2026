const { normalizeKey, buildAliasLookup } = require("./team-aliases");

const STAGE_MAP = {
  LAST_32: { fase: "Dieciseisavos", faseGrupo: "dieciseisavos" },
  LAST_16: { fase: "Octavos", faseGrupo: "octavos" },
  QUARTER_FINALS: { fase: "Cuartos", faseGrupo: "cuartos" },
  SEMI_FINALS: { fase: "Semifinales", faseGrupo: "semifinales" },
  THIRD_PLACE: { fase: "TERCER PUESTO", faseGrupo: "final" },
  FINAL: { fase: "FINAL", faseGrupo: "final" },
};

const KNOCKOUT_STAGES = Object.keys(STAGE_MAP);

const STAGE_ORDER = ["dieciseisavos", "octavos", "cuartos", "semifinales", "final"];

const EXPECTED_MATCHES = {
  dieciseisavos: 16,
  octavos: 8,
  cuartos: 4,
  semifinales: 2,
  final: 2,
};

function mapTeamName(team, lookup) {
  if (!team) {
    return null;
  }

  const candidates = [team.name, team.shortName, team.tla].filter(Boolean);

  for (const candidate of candidates) {
    const mapped = lookup.get(normalizeKey(candidate));
    if (mapped) {
      return mapped;
    }
  }

  return team.shortName || team.name || null;
}

function getMatchScore(match) {
  const score = match.score?.regularTime ?? match.score?.fullTime;
  if (!score || score.home == null || score.away == null) {
    return null;
  }

  return `${score.home}-${score.away}`;
}

function getWinnerTeam(match, lookup) {
  const score = match.score?.regularTime ?? match.score?.fullTime;
  if (!score || score.home == null || score.away == null) {
    return null;
  }

  if (score.home > score.away) {
    return mapTeamName(match.homeTeam, lookup);
  }

  if (score.away > score.home) {
    return mapTeamName(match.awayTeam, lookup);
  }

  if (match.score?.penalties) {
    const penalties = match.score.penalties;
    if (penalties.home > penalties.away) {
      return mapTeamName(match.homeTeam, lookup);
    }
    if (penalties.away > penalties.home) {
      return mapTeamName(match.awayTeam, lookup);
    }
  }

  return null;
}

function matchToPartido(match, lookup) {
  const stage = STAGE_MAP[match.stage];
  if (!stage) {
    return null;
  }

  const finished = match.status === "FINISHED";

  return {
    fase: stage.fase,
    faseGrupo: stage.faseGrupo,
    fecha: match.utcDate?.slice(0, 10) ?? null,
    equipo1: mapTeamName(match.homeTeam, lookup),
    equipo2: mapTeamName(match.awayTeam, lookup),
    marcador: finished ? getMatchScore(match) : null,
    pendiente: !finished,
    estadio: match.venue ?? null,
  };
}

function groupMatchToPartido(match, lookup) {
  if (match.stage !== "GROUP_STAGE" || !match.group) {
    return null;
  }

  const groupId = match.group.replace(/^GROUP_/i, "");
  const finished = match.status === "FINISHED";

  return {
    fase: `Grupo ${groupId}`,
    faseGrupo: "grupos",
    grupo: groupId,
    fecha: match.utcDate?.slice(0, 10) ?? null,
    equipo1: mapTeamName(match.homeTeam, lookup),
    equipo2: mapTeamName(match.awayTeam, lookup),
    marcador: finished ? getMatchScore(match) : null,
    pendiente: !finished,
    estadio: match.venue ?? null,
  };
}

function transformStandings(standings, lookup) {
  return (standings ?? [])
    .filter((entry) => entry.stage === "GROUP_STAGE" && entry.group)
    .map((entry) => {
      const id = entry.group.replace(/^GROUP_/i, "");

      return {
        id,
        nombre: `Grupo ${id}`,
        equipos: (entry.table ?? []).map((row) => ({
          posicion: row.position,
          equipo: mapTeamName(row.team, lookup),
          pj: row.playedGames ?? 0,
          g: row.won ?? 0,
          e: row.draw ?? 0,
          p: row.lost ?? 0,
          gf: row.goalsFor ?? 0,
          gc: row.goalsAgainst ?? 0,
          dg: row.goalDifference ?? 0,
          pts: row.points ?? 0,
        })),
      };
    })
    .sort((a, b) => a.id.localeCompare(b.id));
}

function computeGroupStandingsFromMatches(matches, lookup) {
  const groups = new Map();

  for (const match of matches) {
    if (match.stage !== "GROUP_STAGE" || !match.group || match.status !== "FINISHED") {
      continue;
    }

    const score = match.score?.regularTime ?? match.score?.fullTime;
    if (!score || score.home == null || score.away == null) {
      continue;
    }

    const groupId = match.group.replace(/^GROUP_/i, "");
    const home = mapTeamName(match.homeTeam, lookup);
    const away = mapTeamName(match.awayTeam, lookup);

    if (!home || !away) {
      continue;
    }

    if (!groups.has(groupId)) {
      groups.set(groupId, new Map());
    }

    const table = groups.get(groupId);

    for (const team of [home, away]) {
      if (!table.has(team)) {
        table.set(team, {
          equipo: team,
          pj: 0,
          g: 0,
          e: 0,
          p: 0,
          gf: 0,
          gc: 0,
          pts: 0,
        });
      }
    }

    const homeRow = table.get(home);
    const awayRow = table.get(away);

    homeRow.pj += 1;
    awayRow.pj += 1;
    homeRow.gf += score.home;
    homeRow.gc += score.away;
    awayRow.gf += score.away;
    awayRow.gc += score.home;

    if (score.home > score.away) {
      homeRow.g += 1;
      homeRow.pts += 3;
      awayRow.p += 1;
    } else if (score.home < score.away) {
      awayRow.g += 1;
      awayRow.pts += 3;
      homeRow.p += 1;
    } else {
      homeRow.e += 1;
      awayRow.e += 1;
      homeRow.pts += 1;
      awayRow.pts += 1;
    }
  }

  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, tableMap]) => ({
      id,
      nombre: `Grupo ${id}`,
      equipos: [...tableMap.values()]
        .map((row) => ({
          ...row,
          dg: row.gf - row.gc,
        }))
        .sort((a, b) => b.pts - a.pts || b.dg - a.dg || b.gf - a.gf)
        .map((row, index) => ({
          posicion: index + 1,
          equipo: row.equipo,
          pj: row.pj,
          g: row.g,
          e: row.e,
          p: row.p,
          gf: row.gf,
          gc: row.gc,
          dg: row.dg,
          pts: row.pts,
        })),
    }));
}

function computeEtapasConfirmadas(partidos) {
  const finishedByStage = {};

  for (const partido of partidos) {
    if (partido.pendiente) {
      continue;
    }

    finishedByStage[partido.faseGrupo] = (finishedByStage[partido.faseGrupo] ?? 0) + 1;
  }

  const etapas = STAGE_ORDER.filter((stage) => {
    const expected = EXPECTED_MATCHES[stage];
    return (finishedByStage[stage] ?? 0) >= expected;
  });

  if (etapas.includes("final")) {
    etapas.push("campeon");
  }

  return etapas;
}

function buildResultadosFinales(matches, scorers, lookup, etapasConfirmadas) {
  const resultadosFinales = {
    campeon: null,
    subcampeon: null,
    tercerPuesto: null,
    cuartoPuesto: null,
    goleador: null,
  };

  const finalMatch = matches.find(
    (match) => match.stage === "FINAL" && match.status === "FINISHED"
  );
  const thirdMatch = matches.find(
    (match) => match.stage === "THIRD_PLACE" && match.status === "FINISHED"
  );

  if (finalMatch && etapasConfirmadas.includes("campeon")) {
    resultadosFinales.campeon = getWinnerTeam(finalMatch, lookup);
    const loser =
      resultadosFinales.campeon === mapTeamName(finalMatch.homeTeam, lookup)
        ? mapTeamName(finalMatch.awayTeam, lookup)
        : mapTeamName(finalMatch.homeTeam, lookup);
    resultadosFinales.subcampeon = loser;
  }

  if (thirdMatch && etapasConfirmadas.includes("final")) {
    resultadosFinales.tercerPuesto = getWinnerTeam(thirdMatch, lookup);
    const fourth =
      resultadosFinales.tercerPuesto === mapTeamName(thirdMatch.homeTeam, lookup)
        ? mapTeamName(thirdMatch.awayTeam, lookup)
        : mapTeamName(thirdMatch.homeTeam, lookup);
    resultadosFinales.cuartoPuesto = fourth;
  }

  const topScorer = scorers?.[0];
  if (topScorer?.player?.name) {
    resultadosFinales.goleador = topScorer.player.name;
  }

  return resultadosFinales;
}

function transformFootballDataResponse({ matches, scorers, standings, aliases }) {
  const lookup = buildAliasLookup(aliases);
  const knockoutMatches = matches.filter((match) => KNOCKOUT_STAGES.includes(match.stage));
  const partidos = knockoutMatches
    .map((match) => matchToPartido(match, lookup))
    .filter(Boolean)
    .sort((a, b) => {
      const stageDiff =
        STAGE_ORDER.indexOf(a.faseGrupo) - STAGE_ORDER.indexOf(b.faseGrupo);
      if (stageDiff !== 0) {
        return stageDiff;
      }

      return String(a.fecha).localeCompare(String(b.fecha));
    });

  const partidosGrupos = matches
    .map((match) => groupMatchToPartido(match, lookup))
    .filter(Boolean)
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));

  const gruposFromApi = transformStandings(standings, lookup);
  const grupos = gruposFromApi.length
    ? gruposFromApi
    : computeGroupStandingsFromMatches(matches, lookup);
  const etapasConfirmadas = computeEtapasConfirmadas(partidos);
  const resultadosFinales = buildResultadosFinales(
    knockoutMatches,
    scorers,
    lookup,
    etapasConfirmadas
  );

  if (resultadosFinales.goleador && etapasConfirmadas.includes("campeon")) {
    etapasConfirmadas.push("goleador");
  }

  return {
    version: 1,
    titulo: "Resultados oficiales Mundial 2026",
    etapasConfirmadas: [...new Set(etapasConfirmadas)],
    grupos,
    partidosGrupos,
    partidos,
    resultadosFinales,
    meta: {
      actualizadoEn: new Date().toISOString(),
      fuente: "football-data.org",
      notas: "Generado automáticamente desde la API WC.",
    },
  };
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: {
      "X-Auth-Token": token,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`football-data.org respondió ${response.status}: ${body}`);
  }

  return response.json();
}

async function fetchOfficialFromApi({ token, competition = "WC", season = 2026, aliases = {} }) {
  if (!token) {
    throw new Error("Falta footballData.token en data/config.json");
  }

  const matchesUrl = `https://api.football-data.org/v4/competitions/${competition}/matches?season=${season}`;
  const scorersUrl = `https://api.football-data.org/v4/competitions/${competition}/scorers?season=${season}`;
  const standingsUrl = `https://api.football-data.org/v4/competitions/${competition}/standings?season=${season}`;

  const [matchesPayload, scorersPayload, standingsPayload] = await Promise.all([
    fetchJson(matchesUrl, token),
    fetchJson(scorersUrl, token).catch(() => ({ scorers: [] })),
    fetchJson(standingsUrl, token).catch(() => ({ standings: [] })),
  ]);

  return transformFootballDataResponse({
    matches: matchesPayload.matches ?? [],
    scorers: scorersPayload.scorers ?? [],
    standings: standingsPayload.standings ?? [],
    aliases,
  });
}

module.exports = {
  transformFootballDataResponse,
  fetchOfficialFromApi,
};
