const MEDAL = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

function showError(message) {
  const poolRoot = document.getElementById("pool");
  const rankingRoot = document.getElementById("ranking");
  const html = `<div class="error">${message}</div>`;

  if (poolRoot) {
    poolRoot.innerHTML = html;
  }

  if (rankingRoot) {
    rankingRoot.innerHTML = html;
  }
}

function renderPool(data, formatMoney) {
  const currency = data.config?.moneda ?? "COP";
  const inscripcion = data.config?.inscripcion ?? 0;
  const distribucion = data.config?.distribucionPremios ?? {};

  const cards = [1, 2, 3]
    .map((place) => {
      const pct = Math.round((distribucion[String(place)] ?? 0) * 100);
      const amount = Math.round(data.pozoTotal * (distribucion[String(place)] ?? 0));

      return `
        <article class="pool__card pool__card--${place}">
          <span class="pool__medal">${MEDAL[place]}</span>
          <p class="pool__place">${place}.º lugar</p>
          <p class="pool__amount">${formatMoney(amount, currency)}</p>
          <p class="pool__pct">${pct}% del pozo</p>
        </article>
      `;
    })
    .join("");

  return `
    <div class="pool__summary">
      <div>
        <p class="pool__label">Pozo total</p>
        <p class="pool__total">${formatMoney(data.pozoTotal, currency)}</p>
      </div>
      <div class="pool__meta">
        <p>${data.totalJugadores} jugadores × ${formatMoney(inscripcion, currency)}</p>
        <p>Inscripción por persona</p>
      </div>
    </div>
    <div class="pool__cards">${cards}</div>
  `;
}

function renderRankingTable(data, formatMoney, playerUrl) {
  if (!data.ranking?.length) {
    return `<div class="error">No hay jugadores registrados. Ejecuta <code>npm run build</code>.</div>`;
  }

  const currency = data.config?.moneda ?? "COP";
  const rows = data.ranking
    .map((entry) => {
      const medal = MEDAL[entry.posicion] ?? "";
      const premio =
        entry.premio > 0
          ? formatMoney(entry.premio, currency)
          : "—";

      const url = playerUrl(entry.id);

      return `
        <tr class="ranking-row" data-href="${url}" tabindex="0" role="link" aria-label="Ver apuesta de ${entry.participante}">
          <td class="ranking-row__pos">
            <span class="ranking-row__medal">${medal}</span>
            <span class="ranking-row__num">${entry.posicion}</span>
          </td>
          <td>
            <a class="ranking-row__link" href="${url}">
              ${entry.participante}
            </a>
          </td>
          <td class="ranking-row__pts">${entry.total}</td>
          <td class="ranking-row__prize">${premio}</td>
          <td class="ranking-row__action">
            <a class="ranking-row__btn" href="${url}">Ver detalle →</a>
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="ranking-section">
      <div class="ranking-section__head">
        <h2 class="ranking-section__title">Tabla de posiciones</h2>
        <p class="ranking-section__hint">Toca un jugador o usa <strong>Ver detalle</strong> para ver su apuesta, puntos por fase y resultados.</p>
      </div>
      <table class="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Jugador</th>
            <th>Puntos</th>
            <th>Premio</th>
            <th>Apuesta</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function bindRankingRows(root) {
  root.querySelectorAll(".ranking-row[data-href]").forEach((row) => {
    const go = () => {
      window.location.href = row.dataset.href;
    };

    row.addEventListener("click", (event) => {
      if (event.target.closest("a")) {
        return;
      }

      go();
    });

    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        go();
      }
    });
  });
}

async function loadRankingData() {
  if (window.RANKING_DATA) {
    return window.RANKING_DATA;
  }

  const response = await fetch("data/ranking.json");
  if (!response.ok) {
    throw new Error("No se pudo cargar el ranking.");
  }

  return response.json();
}

async function loadRanking() {
  const poolRoot = document.getElementById("pool");
  const rankingRoot = document.getElementById("ranking");
  const ui = window.MundialUI;

  if (!ui?.formatMoney || !ui?.playerUrl) {
    showError("No se cargó la aplicación. Recarga la página con Ctrl+F5.");
    return;
  }

  const { formatMoney, playerUrl } = ui;

  try {
    poolRoot.innerHTML = `<p class="loading">Cargando ranking…</p>`;
    rankingRoot.innerHTML = "";

    const data = await loadRankingData();
    poolRoot.innerHTML = renderPool(data, formatMoney);
    rankingRoot.innerHTML = renderRankingTable(data, formatMoney, playerUrl);
    bindRankingRows(rankingRoot);
  } catch (error) {
    showError(
      `${error.message} Abre la app con <code>npm run dev</code> y visita <code>http://localhost:3000</code>.`
    );
  }
}

loadRanking();
