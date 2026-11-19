#!/usr/bin/env bash
# Tableau charge / capacité / écart à partir d'un fichier de lignes chiffrées.
#
# Usage : gestion-projet/outils/charges.sh FICHIER.csv
#
# Format (séparateur « ; », virgule ou point décimal, « # » = commentaire) :
#   cap;PORTEUR;CAPACITE
#   ch;LIGNE;PORTEUR;MIN[;MAX]      (MAX absent = MIN)
# Les colonnes suivent l'ordre des lignes « cap ». Un porteur cité dans une
# ligne « ch » sans ligne « cap » est une erreur (code 2).
# Sortie : tableau Markdown prêt à coller. Lecture seule, aucune écriture.
set -euo pipefail

[ $# -eq 1 ] && [ -r "$1" ] || { echo "usage : $0 FICHIER.csv" >&2; exit 2; }

awk -F';' '
function num(s) { gsub(/[[:space:]]/, "", s); sub(/,/, ".", s); return s + 0 }
function fmt(x,   s) {
  s = sprintf("%.2f", (x < 0 ? -x : x)); sub(/0+$/, "", s); sub(/\.$/, "", s); sub(/\./, ",", s)
  return (x < -0.0001 ? "−" : (x > 0.0001 ? "+" : "")) s
}
function plain(x,   s) { s = fmt(x); sub(/^[+]/, "", s); return s }
function rng(a, b) { return (a == b) ? plain(a) : plain(a) " à " plain(b) }
function erng(a, b) { return (a == b) ? fmt(a) : fmt(a) " à " fmt(b) }
/^[[:space:]]*(#|$)/ { next }
$1 == "cap" { p = $2; order[++n] = p; cap[p] = num($3); next }
$1 == "ch"  { p = $3; lo[p] += num($4); hi[p] += ($5 == "" ? num($4) : num($5)); used[p] = 1; next }
{ printf "ligne %d ignorée (type inconnu) : %s\n", NR, $0 > "/dev/stderr" }
END {
  for (p in used) if (!(p in cap)) { printf "porteur sans capacité : %s\n", p > "/dev/stderr"; bad = 1 }
  if (bad) exit 2
  h = "| |"; s = "|---|"; c = "| **Charge** |"; k = "| Capacité |"; e = "| **Écart** |"
  for (i = 1; i <= n; i++) {
    p = order[i]; h = h " " p " |"; s = s "---|"
    c = c " " rng(lo[p], hi[p]) " |"; k = k " " plain(cap[p]) " |"
    e = e " " erng(lo[p] - cap[p], hi[p] - cap[p]) " |"
    tl += lo[p]; th += hi[p]; tc += cap[p]
    if (hi[p] - cap[p] > 0.0001) over = over " " p
  }
  print h " Équipe |"; print s "---|"
  print c " " rng(tl, th) " |"; print k " " plain(tc) " |"; print e " " erng(tl - tc, th - tc) " |"
  if (over != "") print "\nAu-dessus de la capacité :" over
}' "$1"
