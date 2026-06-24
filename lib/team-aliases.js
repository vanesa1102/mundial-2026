function normalizeKey(value) {
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
    lookup.set(normalizeKey(apiName), localName);
    lookup.set(normalizeKey(localName), localName);
  }

  return lookup;
}

function resolveTeamName(name, lookup) {
  if (!name) {
    return null;
  }

  return lookup.get(normalizeKey(name)) ?? name;
}

function canonicalKey(name, lookup) {
  return normalizeKey(resolveTeamName(name, lookup));
}

module.exports = {
  normalizeKey,
  buildAliasLookup,
  resolveTeamName,
  canonicalKey,
};
