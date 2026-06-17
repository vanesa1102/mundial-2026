async function loadMundial() {
  const ui = window.MundialUI;
  const meta = document.getElementById("mundial-meta");
  const standingsBody = document.getElementById("standings-body");
  const groupMatchesBody = document.getElementById("group-matches-body");
  const knockoutBody = document.getElementById("knockout-body");
  const groupMatchesSection = document.getElementById("group-matches");

  if (!ui) {
    standingsBody.innerHTML = `<div class="error">No se cargó la aplicación.</div>`;
    return;
  }

  try {
    const response = await fetch("data/resultados-oficiales.json");
    if (!response.ok) {
      throw new Error("No se pudieron cargar los resultados oficiales.");
    }

    const oficial = await response.json();
    const updated = oficial.meta?.actualizadoEn
      ? ui.formatDate(oficial.meta.actualizadoEn.slice(0, 10))
      : null;

    meta.textContent = updated
      ? `Actualizado el ${updated} · Fuente: ${oficial.meta?.fuente ?? "oficial"}`
      : "Resultados oficiales del Mundial 2026";

    standingsBody.innerHTML = ui.renderGroupStandings(oficial.grupos ?? []);

    const groupMatches = ui.renderGroupMatches(oficial.partidosGrupos ?? []);
    if (groupMatches) {
      groupMatchesBody.innerHTML = groupMatches;
    } else {
      groupMatchesSection.hidden = true;
    }

    knockoutBody.innerHTML = ui.renderOfficialKnockout(oficial.partidos ?? []);
  } catch (error) {
    standingsBody.innerHTML = `<div class="error">${error.message}</div>`;
    groupMatchesSection.hidden = true;
    knockoutBody.innerHTML = "";
    meta.textContent = "No se pudieron cargar los datos";
  }
}

loadMundial();
