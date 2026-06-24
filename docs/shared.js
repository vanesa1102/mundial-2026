const FASES = [
  { key: "dieciseisavos", label: "Dieciseisavos de final" },
  { key: "octavos", label: "Octavos de final" },
  { key: "cuartos", label: "Cuartos de final" },
  { key: "semifinales", label: "Semifinales" },
  { key: "final", label: "Final y tercer puesto" },
];

const FASES_OFICIALES = [
  { key: "dieciseisavos", label: "Dieciseisavos de final" },
  { key: "octavos", label: "Octavos de final" },
  { key: "cuartos", label: "Cuartos de final" },
  { key: "semifinales", label: "Semifinales" },
  { key: "final", label: "Final y tercer puesto" },
];

const PODIUM = [
  { key: "campeon", label: "Campeón", highlight: true },
  { key: "subcampeon", label: "Subcampeón" },
  { key: "tercerPuesto", label: "3er puesto" },
  { key: "cuartoPuesto", label: "4to puesto" },
  { key: "goleador", label: "Goleador", highlight: true },
];

function formatMoney(value, currency = "COP") {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(isoDate) {
  if (!isoDate) {
    return "";
  }

  return new Date(`${isoDate}T12:00:00`).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

function parseScore(marcador) {
  if (!marcador) {
    return null;
  }

  const [a, b] = marcador.split("-").map(Number);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return null;
  }

  return { a, b };
}

function getWinner(partido) {
  const score = parseScore(partido.marcador);
  if (!score) {
    return null;
  }

  if (score.a > score.b) {
    return partido.equipo1;
  }

  if (score.b > score.a) {
    return partido.equipo2;
  }

  return null;
}

function renderMatch(partido) {
  const winner = getWinner(partido);
  const scoreClass = partido.pendiente ? "match__score--pending" : "";
  const scoreText = partido.pendiente ? "Por jugar" : partido.marcador;
  const team1 = partido.equipo1 ?? "Por definir";
  const team2 = partido.equipo2 ?? "Por definir";

  const teamClass = (team) => (winner && team === winner ? "match__team--winner" : "");

  return `
    <article class="match">
      <div class="match__team match__team--left ${teamClass(partido.equipo1)}">${team1}</div>
      <div class="match__center">
        <span class="match__score ${scoreClass}">${scoreText}</span>
        <span class="match__meta">${formatDate(partido.fecha)}${partido.estadio ? ` · ${partido.estadio}` : ""}</span>
      </div>
      <div class="match__team ${teamClass(partido.equipo2)}">${team2}</div>
    </article>
  `;
}

function renderPhase(fase, partidos) {
  return `
    <section class="phase">
      <div class="phase__header">
        <h2 class="phase__title">${fase.label}</h2>
        <span class="phase__count">${partidos.length} partido${partidos.length === 1 ? "" : "s"}</span>
      </div>
      <div class="matches">
        ${partidos.map(renderMatch).join("")}
      </div>
    </section>
  `;
}

function renderPodium(resultadosFinales) {
  return PODIUM.map(({ key, label, highlight }) => {
    const value = resultadosFinales[key];
    const empty = !value;
    const valueClass = empty ? "podium__value--empty" : "";
    const itemClass = highlight ? "podium__item podium__item--highlight" : "podium__item";

    return `
      <div class="${itemClass}">
        <span class="podium__label">${label}</span>
        <span class="podium__value ${valueClass}">${empty ? "Sin pronóstico" : value}</span>
      </div>
    `;
  }).join("");
}

function renderTeamTags(teams, type) {
  if (!teams.length) {
    return `<span class="scoreboard__empty">Ninguno</span>`;
  }

  return teams
    .map((team) => `<span class="scoreboard__tag scoreboard__tag--${type}">${team}</span>`)
    .join("");
}

function renderAllPredictedTeams(fase) {
  const items = [
    ...(fase.aciertos ?? []).map((name) => ({ name, type: "hit" })),
    ...(fase.fallos ?? []).map((name) => ({ name, type: "miss" })),
    ...(fase.pendientes ?? []).map((name) => ({ name, type: "pending" })),
  ];

  if (!items.length) {
    return `<span class="scoreboard__empty">Sin equipos en esta fase.</span>`;
  }

  return items
    .map(
      ({ name, type }) =>
        `<span class="scoreboard__tag scoreboard__tag--${type}">${name}</span>`
    )
    .join("");
}

function renderPhaseBreakdown(fase) {
  if (!fase) {
    return "";
  }

  const totalTeams =
    (fase.aciertos?.length ?? 0) +
    (fase.fallos?.length ?? 0) +
    (fase.pendientes?.length ?? 0);

  let detail;
  if (fase.pendiente && fase.parcial) {
    detail = `${fase.aciertos.length} acierto${fase.aciertos.length === 1 ? "" : "s"} · ${fase.fallos.length} fallo${fase.fallos.length === 1 ? "" : "s"} · ${fase.pendientes?.length ?? 0} pendiente${(fase.pendientes?.length ?? 0) === 1 ? "" : "s"}`;
  } else if (fase.pendiente) {
    detail = `${totalTeams} equipo${totalTeams === 1 ? "" : "s"} pronosticado${totalTeams === 1 ? "" : "s"} · esperando resultados oficiales`;
  } else {
    detail = `${fase.aciertos.length} acierto${fase.aciertos.length === 1 ? "" : "s"} × ${fase.puntosPorEquipo} pt`;
  }

  return `
    <div class="phase__stats scoreboard__phase">
      <div class="scoreboard__phase-head">
        <h3 class="scoreboard__phase-title">Estadísticas · ${fase.label}</h3>
        <span class="scoreboard__phase-points">${fase.puntos} pts</span>
      </div>
      <p class="scoreboard__phase-detail">${detail}</p>
      <div class="scoreboard__tags">
        <span class="scoreboard__tags-label">Equipos seleccionados</span>
        <div class="scoreboard__tags-grid">
          ${renderAllPredictedTeams(fase)}
        </div>
      </div>
    </div>
  `;
}

function buildPlayerDesglose(pronostico, oficial) {
  const evaluarTodasLasFases = window.MundialScoring?.evaluarTodasLasFases;
  if (!evaluarTodasLasFases) {
    return [];
  }

  return evaluarTodasLasFases(pronostico, oficial);
}

function renderScoreboard(resultado, oficial, pronostico) {
  const desglose = pronostico ? buildPlayerDesglose(pronostico, oficial) : resultado.desglose ?? [];
  const breakdown = desglose.map((fase) => renderPhaseBreakdown(fase)).join("");

  const etapas = oficial.etapasConfirmadas ?? [];

  return `
    <div class="scoreboard__summary">
      <div>
        <p class="scoreboard__label">Puntaje acumulado</p>
        <p class="scoreboard__total">${resultado.total} <span>pts</span></p>
      </div>
      <div class="scoreboard__meta">
        <p>Resultados según eliminatorias oficiales${etapas.length ? ` · etapas cerradas: ${etapas.join(", ")}` : ""}</p>
        ${
          oficial.meta?.actualizadoEn
            ? `<p>Oficial actualizado: ${formatDate(oficial.meta.actualizadoEn.slice(0, 10))}</p>`
            : ""
        }
      </div>
    </div>
    ${
      breakdown
        ? `<div class="scoreboard__grid">${breakdown}</div>`
        : ""
    }
  `;
}

function renderPhases(partidos) {
  return FASES.map((fase) => {
    const filtered = partidos.filter((partido) => partido.faseGrupo === fase.key);
    return renderPhase(fase, filtered);
  }).join("");
}

function findOfficialMatch(partido, officialPartidos) {
  const normalize = window.MundialScoring?.teamKey ?? window.MundialScoring?.normalizeTeam ?? ((value) => String(value ?? "").toUpperCase());
  const team1 = partido.equipo1 ? normalize(partido.equipo1) : null;
  const team2 = partido.equipo2 ? normalize(partido.equipo2) : null;

  if (team1 && team2) {
    const direct = officialPartidos.find((entry) => {
      const a = entry.equipo1 ? normalize(entry.equipo1) : null;
      const b = entry.equipo2 ? normalize(entry.equipo2) : null;
      return (a === team1 && b === team2) || (a === team2 && b === team1);
    });

    if (direct) {
      return direct;
    }
  }

  return null;
}

function alignOfficialMatches(predictedPartidos, officialPartidos) {
  const predicted = sortByDate(predictedPartidos);
  const official = sortByDate(officialPartidos);
  const used = new Set();

  return predicted.map((partido, index) => {
    const matched = findOfficialMatch(partido, official);
    if (matched) {
      used.add(matched);
      return matched;
    }

    const fallback = official[index];
    if (fallback && !used.has(fallback)) {
      used.add(fallback);
      return fallback;
    }

    return null;
  });
}

function sortByDate(partidos) {
  return [...partidos].sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

function getPhaseBreakdown(desglose, faseKey) {
  return desglose?.find((entry) => entry.fase === faseKey) ?? null;
}

function getTeamPhaseClass(team, phaseEntry) {
  if (!team || !phaseEntry) {
    return "";
  }

  const normalize = window.MundialScoring?.teamKey ?? window.MundialScoring?.normalizeTeam ?? ((value) => String(value ?? "").toUpperCase());
  const normalized = normalize(team);

  if (phaseEntry.aciertos?.some((entry) => normalize(entry) === normalized)) {
    return "match__team--hit";
  }

  if (phaseEntry.fallos?.some((entry) => normalize(entry) === normalized)) {
    return "match__team--miss";
  }

  if (phaseEntry.pendientes?.some((entry) => normalize(entry) === normalized)) {
    return "match__team--pending";
  }

  return "";
}

function renderPlayerMatch(partido, officialPartido, phaseEntry) {
  const winner = getWinner(partido);
  const scoreClass = partido.pendiente ? "match__score--pending" : "";
  const scoreText = partido.pendiente ? "Por jugar" : partido.marcador;
  const team1 = partido.equipo1 ?? "Por definir";
  const team2 = partido.equipo2 ?? "Por definir";
  const teamClass = (team) => {
    const statusClass = getTeamPhaseClass(team, phaseEntry);
    if (statusClass) {
      return statusClass;
    }

    return winner && team === winner ? "match__team--winner" : "";
  };

  const officialScore =
    officialPartido && !officialPartido.pendiente && officialPartido.marcador
      ? `<span class="match__official">Real: ${officialPartido.marcador}</span>`
      : "";

  return `
    <article class="match">
      <div class="match__team match__team--left ${teamClass(partido.equipo1)}">${team1}</div>
      <div class="match__center">
        <span class="match__score ${scoreClass}">${scoreText}</span>
        ${officialScore}
        <span class="match__meta">${formatDate(partido.fecha)}${partido.estadio ? ` · ${partido.estadio}` : ""}</span>
      </div>
      <div class="match__team ${teamClass(partido.equipo2)}">${team2}</div>
    </article>
  `;
}

function renderPlayerPhase(fase, predictedPartidos, officialPartidos, phaseEntry) {
  const predicted = sortByDate(predictedPartidos);
  const alignedOfficial = alignOfficialMatches(predicted, officialPartidos);
  const matches = predicted
    .map((partido, index) => renderPlayerMatch(partido, alignedOfficial[index] ?? null, phaseEntry))
    .join("");

  return `
    <section class="phase">
      <div class="phase__header">
        <h2 class="phase__title">${fase.label}</h2>
        <span class="phase__count">${predicted.length} partido${predicted.length === 1 ? "" : "s"}</span>
      </div>
      ${renderPhaseBreakdown(phaseEntry)}
      <div class="matches">
        ${matches}
      </div>
    </section>
  `;
}

function renderPlayerPhases(pronostico, oficial) {
  const officialPartidos = oficial?.partidos ?? [];
  const partidos = pronostico?.partidos ?? [];
  const desglose = buildPlayerDesglose(pronostico, oficial);
  const desgloseByFase = new Map(desglose.map((entry) => [entry.fase, entry]));

  return FASES.map((fase) => {
    const predicted = partidos.filter((partido) => partido.faseGrupo === fase.key);
    const official = officialPartidos.filter((partido) => partido.faseGrupo === fase.key);
    const phaseEntry = desgloseByFase.get(fase.key) ?? null;

    return renderPlayerPhase(fase, predicted, official, phaseEntry);
  }).join("");
}

function renderGroupStandings(grupos) {
  if (!grupos?.length) {
    return `<p class="section-empty">Aún no hay tablas de grupos disponibles.</p>`;
  }

  return `
    <div class="groups-grid">
      ${grupos
        .map(
          (grupo) => `
        <article class="group-card">
          <h3 class="group-card__title">${grupo.nombre}</h3>
          <table class="standings-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Equipo</th>
                <th>PJ</th>
                <th>G</th>
                <th>E</th>
                <th>P</th>
                <th>DG</th>
                <th>Pts</th>
              </tr>
            </thead>
            <tbody>
              ${grupo.equipos
                .map(
                  (row) => `
                <tr class="${row.posicion <= 2 ? "standings-row--qualified" : ""}">
                  <td>${row.posicion}</td>
                  <td>${row.equipo ?? "—"}</td>
                  <td>${row.pj}</td>
                  <td>${row.g}</td>
                  <td>${row.e}</td>
                  <td>${row.p}</td>
                  <td>${row.dg > 0 ? `+${row.dg}` : row.dg}</td>
                  <td class="standings-row__pts">${row.pts}</td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>
        </article>
      `
        )
        .join("")}
    </div>
  `;
}

function renderGroupMatches(partidosGrupos) {
  if (!partidosGrupos?.length) {
    return "";
  }

  const byGroup = new Map();
  for (const partido of partidosGrupos) {
    const key = partido.grupo ?? "?";
    if (!byGroup.has(key)) {
      byGroup.set(key, []);
    }
    byGroup.get(key).push(partido);
  }

  return [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([grupo, partidos]) => {
      const fase = { key: `grupo-${grupo}`, label: `Grupo ${grupo}` };
      return renderPhase(fase, partidos);
    })
    .join("");
}

function renderOfficialKnockout(partidos) {
  if (!partidos?.length) {
    return `<p class="section-empty">Aún no hay partidos de eliminatorias.</p>`;
  }

  return FASES_OFICIALES.map((fase) => {
    const filtered = partidos.filter((partido) => partido.faseGrupo === fase.key);
    if (!filtered.length) {
      return "";
    }

    const finished = filtered.filter((partido) => !partido.pendiente).length;
    const pending = filtered.length - finished;

    return `
      <section class="phase phase--official">
        <div class="phase__header">
          <h2 class="phase__title">${fase.label}</h2>
          <span class="phase__count">${finished} jugados · ${pending} por jugar</span>
        </div>
        <div class="matches">
          ${filtered.map(renderMatch).join("")}
        </div>
      </section>
    `;
  }).join("");
}

function getQueryParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function getPlayerId() {
  const fromQuery = getQueryParam("id");
  if (fromQuery) {
    return fromQuery;
  }

  const hash = window.location.hash.replace(/^#/, "").trim();
  if (!hash) {
    return null;
  }

  if (hash.startsWith("id=")) {
    return decodeURIComponent(hash.slice(3));
  }

  return decodeURIComponent(hash);
}

function playerUrl(id) {
  return `jugador.html#${encodeURIComponent(id)}`;
}

window.MundialUI = {
  FASES,
  FASES_OFICIALES,
  formatMoney,
  formatDate,
  renderPodium,
  renderScoreboard,
  renderPhases,
  renderPlayerPhases,
  renderGroupStandings,
  renderGroupMatches,
  renderOfficialKnockout,
  getQueryParam,
  getPlayerId,
  playerUrl,
};
