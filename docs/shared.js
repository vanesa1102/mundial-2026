const FASES = [
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

  const teamClass = (team) => (winner && team === winner ? "match__team--winner" : "");

  return `
    <article class="match">
      <div class="match__team match__team--left ${teamClass(partido.equipo1)}">${partido.equipo1}</div>
      <div class="match__center">
        <span class="match__score ${scoreClass}">${scoreText}</span>
        <span class="match__meta">${formatDate(partido.fecha)}${partido.estadio ? ` · ${partido.estadio}` : ""}</span>
      </div>
      <div class="match__team ${teamClass(partido.equipo2)}">${partido.equipo2}</div>
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

function renderScoreboard(resultado, oficial) {
  const etapas = oficial.etapasConfirmadas ?? [];

  if (!etapas.length) {
    return `
      <div class="scoreboard__notice">
        Aún no hay etapas confirmadas en los resultados oficiales.
      </div>
    `;
  }

  const breakdown = resultado.desglose
    .map((fase) => {
      const detail = fase.pendiente
        ? "Pendiente de definir"
        : `${fase.aciertos.length} acierto${fase.aciertos.length === 1 ? "" : "s"} × ${fase.puntosPorEquipo} pt`;

      return `
        <article class="scoreboard__phase">
          <div class="scoreboard__phase-head">
            <h3 class="scoreboard__phase-title">${fase.label}</h3>
            <span class="scoreboard__phase-points">${fase.puntos} pts</span>
          </div>
          <p class="scoreboard__phase-detail">${detail}</p>
          <div class="scoreboard__tags">
            <div>
              <span class="scoreboard__tags-label">Aciertos</span>
              ${renderTeamTags(fase.aciertos, "hit")}
            </div>
            ${
              fase.fallos?.length
                ? `
              <div>
                <span class="scoreboard__tags-label">No acertó</span>
                ${renderTeamTags(fase.fallos, "miss")}
              </div>
            `
                : ""
            }
          </div>
        </article>
      `;
    })
    .join("");

  return `
    <div class="scoreboard__summary">
      <div>
        <p class="scoreboard__label">Puntaje acumulado</p>
        <p class="scoreboard__total">${resultado.total} <span>pts</span></p>
      </div>
      <div class="scoreboard__meta">
        <p>Etapas evaluadas: ${etapas.join(", ")}</p>
        ${
          oficial.meta?.actualizadoEn
            ? `<p>Oficial actualizado: ${formatDate(oficial.meta.actualizadoEn.slice(0, 10))}</p>`
            : ""
        }
      </div>
    </div>
    <div class="scoreboard__grid">${breakdown}</div>
  `;
}

function renderPhases(partidos) {
  return FASES.map((fase) => {
    const filtered = partidos.filter((partido) => partido.faseGrupo === fase.key);
    return renderPhase(fase, filtered);
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
  formatMoney,
  formatDate,
  renderPodium,
  renderScoreboard,
  renderPhases,
  getQueryParam,
  getPlayerId,
  playerUrl,
};
