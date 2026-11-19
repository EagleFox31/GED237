#!/bin/sh
# Résume c6.tsv par demi-journée (UTC) : relevés, taux de 200, plus grand écart entre deux relevés
# consécutifs (verts ou non), puis liste les trous sans relevé (> C6_GAP_MAX s, 900 par défaut) et
# les relevés KO. Une sonde muette ne passe pas pour verte : un trou n'est jamais compté en succès.
# Usage : sh scripts/c6_summary.sh [c6.tsv]
f="${1:-c6.tsv}"
awk -F'\t' -v gapmax="${C6_GAP_MAX:-900}" '
function ts(s,  d,t){ gsub(/[-:TZ]/," ",s); return mktime(s) }
{
  day=substr($1,1,10); h=substr($1,12,2)+0; half=(h<12)?"matin":"soir"; k=day" "half
  ok=($2=="health=200"); n[k]++; if(ok) g[k]++
  t=ts($1)
  if(prev!=""){
    d=t-prev
    if(d>gap[k]) gap[k]=d
    if(d>gapmax){ nh++; holes[nh]=sprintf("%s -> %s (%d min)",prevraw,$1,d/60) }
  }
  if(!ok){ nk++; kos[nk]=$1 " " $2 }
  prev=t; prevraw=$1
  if(!(k in seen)){seen[k]=1; order[++c]=k}
}
END{ printf "%-16s %8s %8s %8s %12s\n","demi-journée","relevés","200","taux","écart max s"
  for(i=1;i<=c;i++){k=order[i]; printf "%-16s %8d %8d %7.0f%% %12d\n",k,n[k],g[k],100*g[k]/n[k],gap[k]}
  printf "\nTrous sans relevé (> %d s) : %d\n",gapmax,nh
  for(i=1;i<=nh;i++) print "  " holes[i]
  printf "Relevés KO : %d\n",nk
  for(i=1;i<=nk;i++) print "  " kos[i] }' "$f"
