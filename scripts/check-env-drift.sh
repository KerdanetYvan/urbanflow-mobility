#!/usr/bin/env bash
#
# Detection de derive du .env de production (issue #293).
#
# Le .env de prod est maintenu a la main sur le VPS (pas de templating par la
# CI). A chaque nouvelle variable ajoutee au code + .env.example mais oubliee
# sur le serveur, une fonctionnalite casse EN SILENCE : c'est deja arrive avec
# GEOLOCATION_ENCRYPTION_KEY (#281) et les 3 VAPID_* (#277).
#
# Ce script compare les NOMS de cles (jamais les valeurs, rien de secret ne
# transite) entre le .env reel et .env.example, en tenant compte d'une
# allowlist versionnee des absences legitimes.
#
# Usage :
#   check-env-drift.sh --env <.env> --example <.env.example> --allowlist <fichier>
#
# Sortie :
#   - un rapport lisible sur stdout, derniere ligne "RESULT: OK" ou
#     "RESULT: DRIFT (<n> manquante(s), <m> inattendue(s))"
#   - code retour 0 par defaut (mode alerte) ; 1 si STRICT_ENV_DRIFT=1 ET
#     au moins une cle attendue manque (mode bloquant, a activer une fois la
#     liste d'exceptions eprouvee)
#
set -euo pipefail

ENV_FILE=""
EXAMPLE_FILE=""
ALLOWLIST_FILE=""

while [ $# -gt 0 ]; do
  case "$1" in
    --env) ENV_FILE="$2"; shift 2 ;;
    --example) EXAMPLE_FILE="$2"; shift 2 ;;
    --allowlist) ALLOWLIST_FILE="$2"; shift 2 ;;
    *) echo "Argument inconnu : $1" >&2; exit 64 ;;
  esac
done

if [ -z "$ENV_FILE" ] || [ -z "$EXAMPLE_FILE" ]; then
  echo "Usage : $0 --env <.env> --example <.env.example> [--allowlist <fichier>]" >&2
  exit 64
fi
for f in "$ENV_FILE" "$EXAMPLE_FILE"; do
  [ -f "$f" ] || { echo "Fichier introuvable : $f" >&2; exit 66; }
done

# Extrait les noms de cles (lignes "CLE=..."), ignore commentaires et lignes
# vides, dedoublonne et trie.
keys_of() {
  grep -oE '^[A-Za-z_][A-Za-z_0-9]*=' "$1" | sed 's/=$//' | sort -u
}

ENV_KEYS="$(keys_of "$ENV_FILE")"
EXAMPLE_KEYS="$(keys_of "$EXAMPLE_FILE")"

# Allowlist : cles de .env.example dont l'absence en prod est normale
# (valeurs a defaut cote code, ou fournies autrement). Une cle par ligne,
# commentaires "#" et lignes vides ignores.
if [ -n "$ALLOWLIST_FILE" ] && [ -f "$ALLOWLIST_FILE" ]; then
  ALLOWED="$(grep -oE '^[A-Za-z_][A-Za-z_0-9]*' "$ALLOWLIST_FILE" | sort -u)"
else
  ALLOWED=""
fi

# Cles attendues (dans .env.example) mais absentes du .env reel, hors allowlist.
MISSING="$(comm -23 <(printf '%s\n' "$EXAMPLE_KEYS") <(printf '%s\n' "$ENV_KEYS") \
  | { [ -n "$ALLOWED" ] && comm -23 - <(printf '%s\n' "$ALLOWED") || cat; })"

# Cles presentes dans le .env reel mais absentes de .env.example (cruft,
# faute de frappe type "NOMATIM_URL", ou var prod-only non documentee).
UNEXPECTED="$(comm -13 <(printf '%s\n' "$EXAMPLE_KEYS") <(printf '%s\n' "$ENV_KEYS"))"

# Rappel des absences tolerees effectivement constatees (informatif).
ALLOWED_ABSENT=""
if [ -n "$ALLOWED" ]; then
  ALLOWED_ABSENT="$(comm -23 <(printf '%s\n' "$EXAMPLE_KEYS") <(printf '%s\n' "$ENV_KEYS") \
    | comm -12 - <(printf '%s\n' "$ALLOWED"))"
fi

n_missing=$( [ -n "$MISSING" ] && printf '%s\n' "$MISSING" | grep -c . || echo 0 )
n_unexpected=$( [ -n "$UNEXPECTED" ] && printf '%s\n' "$UNEXPECTED" | grep -c . || echo 0 )

echo "=== Derive du .env de production (issue #293) ==="
echo "  .env         : $ENV_FILE ($(printf '%s\n' "$ENV_KEYS" | grep -c .) cles)"
echo "  .env.example : $EXAMPLE_FILE ($(printf '%s\n' "$EXAMPLE_KEYS" | grep -c .) cles)"
echo

if [ -n "$ALLOWED_ABSENT" ]; then
  echo "Absences tolerees (allowlist) :"
  printf '  - %s\n' $ALLOWED_ABSENT
  echo
fi

if [ "$n_missing" -gt 0 ]; then
  echo "!! CLES ATTENDUES ABSENTES DE LA PROD ($n_missing) :"
  printf '  - %s\n' $MISSING
  echo "   -> a ajouter au .env du VPS (le code les lit, une fonctionnalite est probablement cassee en silence)."
  echo
fi

if [ "$n_unexpected" -gt 0 ]; then
  echo "?? CLES EN PROD MAIS ABSENTES DE .env.example ($n_unexpected) :"
  printf '  - %s\n' $UNEXPECTED
  echo "   -> faute de frappe (cf. NOMATIM_URL) / var obsolete a retirer, ou var prod-only a documenter dans .env.example."
  echo
fi

if [ "$n_missing" -eq 0 ] && [ "$n_unexpected" -eq 0 ]; then
  echo "RESULT: OK"
  exit 0
fi

echo "RESULT: DRIFT ($n_missing manquante(s), $n_unexpected inattendue(s))"

if [ "${STRICT_ENV_DRIFT:-0}" = "1" ] && [ "$n_missing" -gt 0 ]; then
  exit 1
fi
exit 0
