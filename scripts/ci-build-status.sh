#!/usr/bin/env bash
# Prüft den GitHub-Actions-Image-Build für einen Commit (Default: HEAD): findet
# den Workflow-Lauf, wartet bis er fertig ist und gibt bei Fehler die betroffenen
# Jobs/Schritte (und, falls verfügbar, Fehler-Annotationen) aus.
#
# Nutzt `gh`, falls installiert & authentifiziert (volle Fehlerlogs), sonst die
# öffentliche GitHub-REST-API via curl (Repo ist public; optional GH_TOKEN/GITHUB_TOKEN).
#
# Aufruf: npm run ci:build-status            (prüft HEAD)
#         npm run ci:build-status -- <sha>   (prüft bestimmten Commit)
set -euo pipefail

REPO="jaithn/NuolaSolarDashboard"
WORKFLOW="docker-publish.yml"
SHA="${1:-$(git rev-parse HEAD)}"
TIMEOUT="${CI_TIMEOUT:-1500}" # max. Wartezeit in Sekunden
API="https://api.github.com/repos/$REPO"
RUN_URL_BASE="https://github.com/$REPO/actions/runs"

echo "Prüfe Image-Build für $REPO @ ${SHA:0:8} …"

# --- Bevorzugt gh (falls vorhanden & eingeloggt) --------------------------------
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  echo "(verwende gh)"
  deadline=$(( $(date +%s) + TIMEOUT ))
  RID=""
  while :; do
    RID="$(gh run list --repo "$REPO" --workflow "$WORKFLOW" --commit "$SHA" \
            --limit 1 --json databaseId --jq '.[0].databaseId' 2>/dev/null || true)"
    [ -n "$RID" ] && break
    [ "$(date +%s)" -ge "$deadline" ] && { echo "Kein Lauf gefunden (Timeout)."; exit 2; }
    sleep 10
  done
  echo "Lauf: $RUN_URL_BASE/$RID"
  gh run watch "$RID" --repo "$REPO" --exit-status && { echo "✅ Image-Build erfolgreich."; exit 0; }
  echo "❌ Image-Build fehlgeschlagen – Fehler-Logs:"
  gh run view "$RID" --repo "$REPO" --log-failed || true
  exit 1
fi

# --- Fallback: REST-API via curl ------------------------------------------------
AUTH=()
TOKEN="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
[ -n "$TOKEN" ] && AUTH=(-H "Authorization: Bearer $TOKEN")
api() { curl -sSL -H "Accept: application/vnd.github+json" "${AUTH[@]}" "$@"; }

# "id status conclusion" des neuesten Laufs für diesen Commit (leer, falls keiner)
run_line() {
  api "$API/actions/workflows/$WORKFLOW/runs?head_sha=$SHA&per_page=1" \
    | jq -r '.workflow_runs[0]? // empty | "\(.id) \(.status) \(.conclusion // "")"'
}

deadline=$(( $(date +%s) + TIMEOUT ))
LINE=""
while :; do
  LINE="$(run_line || true)"
  [ -n "$LINE" ] && break
  [ "$(date +%s)" -ge "$deadline" ] && { echo "Kein Workflow-Lauf für diesen Commit gefunden (Timeout)."; exit 2; }
  sleep 10
done
RUN_ID="${LINE%% *}"
echo "Lauf: $RUN_URL_BASE/$RUN_ID"

STATUS=""; CONCLUSION=""
while :; do
  LINE="$(run_line || true)"
  STATUS="$(echo "$LINE" | awk '{print $2}')"
  CONCLUSION="$(echo "$LINE" | awk '{print $3}')"
  [ "$STATUS" = "completed" ] && break
  echo "  … Status: ${STATUS:-unbekannt}"
  [ "$(date +%s)" -ge "$deadline" ] && { echo "Build nicht rechtzeitig fertig (Timeout)."; exit 2; }
  sleep 15
done

if [ "$CONCLUSION" = "success" ]; then
  echo "✅ Image-Build erfolgreich. $RUN_URL_BASE/$RUN_ID"
  exit 0
fi

echo "❌ Image-Build: ${CONCLUSION:-fehlgeschlagen}. $RUN_URL_BASE/$RUN_ID"
echo "Fehlgeschlagene Jobs/Schritte:"
api "$API/actions/runs/$RUN_ID/jobs" | jq -r '
  .jobs[]? | select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out")
  | "  • Job: \(.name) [\(.conclusion)]",
    ( .steps[]? | select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out")
      | "      - Schritt: \(.name) [\(.conclusion)]" )'

# Fehler-Annotationen (Compiler-/Build-Meldungen), falls die API sie liefert
for cid in $(api "$API/commits/$SHA/check-runs" | jq -r '.check_runs[]? | select(.conclusion=="failure") | .id' 2>/dev/null || true); do
  api "$API/check-runs/$cid/annotations" 2>/dev/null \
    | jq -r '.[]? | "      ⚠ \(.path // ""):\(.start_line // 0) \(.annotation_level): \(.message)"' 2>/dev/null || true
done

echo "Volle Logs: $RUN_URL_BASE/$RUN_ID   (mit gh: gh run view $RUN_ID --log-failed)"
exit 1
