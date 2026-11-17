#!/bin/sh
# Résume c6.tsv par demi-journée (UTC) : relevés, taux de 200, plus longue coupure (écart entre relevés verts consécutifs).
# Usage : sh scripts/c6_summary.sh [c6.tsv]
f="${1:-c6.tsv}"
awk -F'\t' '
function ts(s,  d,t){ gsub(/[-:TZ]/," ",s); return mktime(s) }
{
  day=substr($1,1,10); h=substr($1,12,2)+0; half=(h<12)?"matin":"soir"; k=day" "half
  ok=($2=="health=200"); n[k]++; if(ok){g[k]++; t=ts($1); if(last!=""&&t-last>gap[k]&&prevk==k)gap[k]=t-last; last=t} else {last=""}
  prevk=k; if(!(k in seen)){seen[k]=1; order[++c]=k}
}
END{ printf "%-16s %8s %8s %8s %12s\n","demi-journée","relevés","200","taux","écart max s"
  for(i=1;i<=c;i++){k=order[i]; printf "%-16s %8d %8d %7.0f%% %12d\n",k,n[k],g[k],100*g[k]/n[k],gap[k]} }' "$f"
