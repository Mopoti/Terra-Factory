"""Génère docs/arbre-decouvertes-t0-t5.html : arbre vertical des découvertes (données de tools/gen_decouvertes.py).

La page se dessine elle-même (JavaScript) à partir des données : les cases se déplacent à la souris (disposition gardée
dans le navigateur), des bandes P0 à P5 découpent les paliers, et chaque recette se modifie dans le panneau de droite.
Les icônes viennent de l'audit des objets (variable d'environnement ICONES : fichier JSON {objet: {icon: adresse de données}}).
Lancer depuis `navigateur/` : ICONES=<chemin> python3 tools/gen_arbre_decouvertes.py
"""
import sys, os, json
sys.path.insert(0,'tools')
import gen_decouvertes as G   # recalcule aussi docs/decouvertes-t0-t5.md
D,deps,n=G.D,G.deps,G.n
ICONS=json.load(open(os.environ.get('ICONES','/tmp/claude-0/-home-user-Terra-Factory/321d8bf2-7c57-5c8c-af02-ddbd7a8bba29/scratchpad/audit_out.json')))
ids=list(D)
tier=lambda k:D[k][1]
def anc(k,seen=None):
    seen=set() if seen is None else seen
    for d in deps(k):
        if d not in seen: seen.add(d); anc(d,seen)
    return seen
depth={}
def dep(k):
    if k not in depth: depth[k]=1+max((dep(d) for d in deps(k)),default=-1)
    return depth[k]
for k in ids: dep(k)
direct={k:sorted({d for d in deps(k) if not any(d in anc(o) for o in deps(k) if o!=d)},key=lambda z:(-depth[z],ids.index(z))) for k in ids}
parent={k:(direct[k][0] if direct[k] else None) for k in ids}
children={k:[j for j in ids if k in direct[j]] for k in ids}

# --- Disposition de départ : une bande par palier ; dans la bande, rangées par profondeur interne (dépendances du même palier)
lvl={}
def lv(k):
    if k not in lvl: lvl[k]=1+max((lv(d) for d in direct[k] if tier(d)==tier(k)),default=-1)
    return lvl[k]
for k in ids: lv(k)
rows=[]  # (palier, rangée) -> liste
for p in range(6):
    top=max((lvl[k] for k in ids if tier(k)==p),default=-1)
    for r in range(top+1): rows.append([k for k in ids if tier(k)==p and lvl[k]==r])
rows=[r for r in rows if r]
CW,CH,GX,GY,LM,BAND_GAP=112,92,10,38,70,34
STEP=CW+GX
x={}
def place(row): 
    for i,k in enumerate(row): x[k]=(i-(len(row)-1)/2)*STEP
def sweep(rs,neigh):
    for row in rs:
        def bar(k):
            ps=[x[d] for d in neigh(k) if d in x]
            return sum(ps)/len(ps) if ps else x[k]
        row.sort(key=lambda k:(bar(k),ids.index(k))); place(row)
for row in rows: place(row)
for _ in range(10):
    sweep(rows[1:],lambda k:direct[k]); sweep(rows[-2::-1],lambda k:children[k])
shift=LM-min(x.values())
TOP=300   # place des deux rangées de ressources au-dessus du palier 0
y={}; bands=[]; cur=24+TOP; last=None
for row in rows:
    p=tier(row[0])
    if p!=last:
        if last is not None: cur+=BAND_GAP
        bands.append({'p':p,'y':cur-14}); last=p
    for k in row: y[k]=cur
    cur+=CH+GY
VW=max(x.values())+shift+CW+LM; VH=cur+10
node={}
label=lambda k:D[k][0].split(' (')[0]
def costline(k):
    c=D[k][4]; t=tier(k)
    if t==0: return 'ressources'
    s='T1' if t==1 else f'T{t}+T{t-1}'
    cb=c.get('combat_pack'); num=max(v for kk,v in c.items() if kk!='combat_pack')
    return f"{num}×{s}"+(f" +{cb}⚔" if cb else '')
for k in ids:
    ic=[u for u in D[k][2] if ICONS.get(u,{}).get('icon') or u in G.PROPOSED]
    node[k]={'n':label(k),'p':tier(k),'c':G.CAT[k],'cb':'combat_pack' in D[k][4],'ct':costline(k),
             'ic':ic[:3],'more':len(D[k][2])-len(ic[:3]),'g':('I' * (1 + ('2' in k) + ('3' in k)) if not D[k][2] else ''),
             'x':round(x[k]+shift),'y':y[k]}
edges=[[d,k,int(d==parent[k])] for k in ids for d in direct[k]]

# --- Recettes (modifiables dans la page) et noms
items_all,recs=G.items,G.rec
mach_names={}
def paths_of(item):
    out=[]; it=items_all[item]
    if it.get('recipe'): out.append({'m':'','s':0,'i':[[k,v] for k,v in it['recipe'].items()],'o':it.get('yield',1)})
    for r in recs:
        if item in r['out'] and not (r['machine']=='barreler' and item=='barrel_empty'):
            f=r.get('fluid'); mach_names[r['machine']]=n('machine_'+r['machine'])
            out.append({'m':r['machine'],'s':r.get('seconds',0),'i':[[k,v] for k,v in r.get('in',{}).items()],'o':r['out'][item],
                        'mo':r.get('mould',''),'f':(f"{f['kind']} {f['amount']:+d} L" if f else '')})
    return out
need=set(); dd={}
for k in ids:
    its=[]
    for u in D[k][2]:
        ps=paths_of(u)
        for pth in ps:
            for a,_ in pth['i']: need.add(a)
            if pth.get('mo'): need.add(pth['mo'])
        need.add(u); its.append({'id':u,'p':ps,'new':u in G.PROPOSED})
    for kk in D[k][4]: need.add(kk)
    dd[k]={'n':D[k][0],'t':tier(k),'c':[[kk,v] for kk,v in D[k][4].items()],'it':its,'pre':[D[d][0] for d in direct[k]],'up':sorted(anc(k),key=ids.index)}
for r in recs:
    mach_names[r['machine']]=n('machine_'+r['machine'])
icn={u:ICONS[u]['icon'] for u in need|{u for k in ids for u in node[k]['ic']} if ICONS.get(u,{}).get('icon')}
ALL=sorted(([i,n(i)] for i in items_all if not i.startswith('res_')),key=lambda a:a[1].lower())
RAW=['wood','stone','fiber','coal','iron_ore','copper_ore','zinc_ore','bauxite','uraninite','crude_oil','res_water','res_sand','carapace','living_tissue']
OTHER=['iron_ingot','copper_ingot','machine_drill','machine_furnace','machine_chest_wood','tool_stone','vehicle_cart','piece_wall_wood','piece_wall_stone']
for u in RAW+OTHER: need.add(u)
icn.update({u:ICONS[u]['icon'] for u in RAW+OTHER if ICONS.get(u,{}).get('icon')})
NAMES_RES={u:n(u) for u in RAW+OTHER}
START_IDS=sorted(set(RAW)|set(OTHER)|{u for u in G.START if u in items_all})
data={'N':node,'E':edges,'B':bands,'W':round(VW),'H':round(VH),'LM':LM,'CW':CW,'CH':CH,'GY':GY,'DD':dd,'ICN':icn,'ALL':ALL,'MN':mach_names,
      'ORDER':ids,'RES':[{'label':'Ressources','items':RAW},{'label':'Dès le départ','items':OTHER}],'RN':NAMES_RES,'S0':START_IDS,'TOP':TOP}
page=open('tools/arbre_page.html').read().replace('@N@',str(len(ids))).replace('@DATA@',json.dumps(data,ensure_ascii=False))
open('docs/arbre-decouvertes-t0-t5.html','w').write(page)
print(len(page)//1024,'Ko',round(VW),round(VH),'bandes',len(bands))
