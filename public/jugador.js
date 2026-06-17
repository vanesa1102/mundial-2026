async function loadPlayer() {
  const ui = window.MundialUI;

  if (!ui) {
    document.getElementById("phases").innerHTML =
      `<div class="error">No se cargó la aplicación. Recarga la página.</div>`;
    return;
  }

  const { getPlayerId, renderPodium, renderScoreboard, renderPlayerPhases, formatMoney } = ui;

  const playerId = getPlayerId();
  const participantName = document.getElementById("participant-name");
  const participantMeta = document.getElementById("participant-meta");
  const phasesRoot = document.getElementById("phases");
  const podiumRoot = document.getElementById("podium");
  const scoreboardRoot = document.getElementById("scoreboard");

  if (!playerId) {
    phasesRoot.innerHTML = `<div class="error">Falta el id del jugador en la URL.</div>`;
    return;
  }

  try {
    const [pronosticoRes, oficialRes, rankingRes] = await Promise.all([
      fetch(`data/participantes/${playerId}.json`),
      fetch("data/resultados-oficiales.json"),
      fetch("data/ranking.json"),
    ]);

    if (!pronosticoRes.ok) {
      throw new Error("No se encontró la apuesta de este jugador.");
    }

    if (!oficialRes.ok) {
      throw new Error("No se pudieron cargar los resultados oficiales.");
    }

    const pronostico = await pronosticoRes.json();
    const oficial = await oficialRes.json();
    const rankingData = rankingRes.ok ? await rankingRes.json() : null;
    const resultado = window.MundialScoring.calcularPuntos(pronostico, oficial);

    const nombre = pronostico.participante?.nombre || "Participante";
    const rankingEntry = rankingData?.ranking?.find((entry) => entry.id === playerId);

    participantName.textContent = nombre;
    document.title = `Mundial 2026 — ${nombre}`;

    if (rankingEntry) {
      const currency = rankingData.config?.moneda ?? "COP";
      const premio =
        rankingEntry.premio > 0
          ? formatMoney(rankingEntry.premio, currency)
          : "Sin premio";

      participantMeta.textContent = `#${rankingEntry.posicion} · ${rankingEntry.total} pts · Premio proyectado: ${premio}`;
    } else {
      participantMeta.textContent = `${resultado.total} pts acumulados`;
    }

    scoreboardRoot.innerHTML = renderScoreboard(resultado, oficial, pronostico);
    podiumRoot.innerHTML = renderPodium(pronostico.resultadosFinales);
    phasesRoot.innerHTML = renderPlayerPhases(pronostico, oficial);
  } catch (error) {
    phasesRoot.innerHTML = `<div class="error">${error.message}</div>`;
  }
}

loadPlayer();
