import json, html
R='/home/user/Terra-Factory/'
S='/tmp/claude-0/-home-user-Terra-Factory/321d8bf2-7c57-5c8c-af02-ddbd7a8bba29/scratchpad/'
items=json.load(open(R+'content/items.json'))['items']
fr=json.load(open(R+'src/i18n/fr.json'))
techs=json.load(open(R+'content/techs.json'))['techs']
rec=json.load(open(R+'content/recipes.json'))['recipes']
mach=json.load(open(R+'content/machines.json'))['machines']
from collections import defaultdict
_img=json.load(open(S+'audit_out.json'))
img=defaultdict(lambda:{'icon':'data:image/gif;base64,R0lGODlhAQABAAAAACw=','big':None,'model':'aucun'},_img)
e=html.escape
name=lambda i: fr.get('item.'+i,i)
tname=lambda t: fr.get('tech.'+t,t)
byid={i['id']:i for i in items}
tby={t['id']:t for t in techs}
machine_item={m['id']:m['item'] for m in mach}
CAT={c:fr.get('craft.cat.'+c,c) for c in ['extraction','smelting','machining','logistics','fluids','energy','science','buildings','equipment','armor','tools','rail','resources']}
unl={}  # item -> [tech ids]
for t in techs:
    for u in t.get('unlocks',[]): unl.setdefault(u,[]).append(t['id'])
def closure(tid, seen=None):
    seen=set() if seen is None else seen
    if tid in seen: return seen
    seen.add(tid)
    for r in tby[tid].get('requires',[]): closure(r,seen)
    return seen
base_items={i['id'] for i in items if i['id'] not in unl}
def avail_after(techset):
    a=set(base_items)
    for t in techset: a|=set(tby[t].get('unlocks',[]))
    return a
# recipes per item
paths={}
for it in items:
    i=it['id']; p=[]
    if it.get('recipe'): p.append({'kind':'hand','machine':None,'in':it['recipe'],'out':{i:1},'seconds':None})
    for r in rec:
        if i in r['out']:
            p.append({'kind':'machine','machine':machine_item.get(r['machine'],'machine_'+r['machine']),'in':r.get('in',{}),'out':r['out'],'seconds':r.get('seconds'),'fluid':r.get('fluid'),'rid':r['id']})
    paths[i]=p
used={}
for i,ps in paths.items():
    for p in ps:
        for k in p['in']: used.setdefault(k,set()).add(i)
for t in techs:
    for k in t.get('cost',{}): used.setdefault(k,set()).add('tech:'+t['id'])
SPECIAL={'carapace':'Butin des créatures','living_tissue':'Butin des créatures','nuclear_waste':'Produit par les réacteurs'}
# issues
issues={}; pathok={}
for it in items:
    i=it['id']; ts=unl.get(i,[])
    # un objet peut être débloqué par plusieurs techs : la moins exigeante compte
    best=None
    for tid in (ts or [None]):
        cl=closure(tid) if tid else set()
        av=avail_after(cl)
        bad=[]; implicit=[]
        for p in paths[i]:
            miss=[k for k in p['in'] if k not in av]
            if p['machine'] and p['machine'] not in av and tid is not None: miss.append(p['machine'])
            elif p['machine'] and p['machine'] not in av: implicit.append(p['machine'])
            bad.append(miss)
        if best is None or sum(1 for b in bad if not b)>sum(1 for b in best[1] if not b): best=(tid,bad); impl_best=list(implicit)
    tid,bad=best
    pathok[i]=bad
    msgs=[]
    for mk in dict.fromkeys(impl_best):
        msgs.append(('info',f"Débloqué en pratique par sa machine « {name(mk)} » (technologie « {tname(unl[mk][0])} »), pas par une technologie à son nom"))
    if paths[i] and all(bad):
        # aucune voie complète
        for p,miss in zip(paths[i],bad):
            for k in miss:
                t2=unl.get(k)
                msgs.append(('warn',f"{'Machine' if k==p['machine'] else 'Ingrédient'} « {name(k)} » n'est pas encore disponible : débloqué par « {tname(t2[0])} »" + ('' if tid else " (cet objet n'a pas de technologie : il est disponible dès le départ)") if t2 else f"« {name(k)} » indisponible"))
    if not paths[i] and not it.get('creative') and i not in SPECIAL:
        msgs.append(('bad','Aucune recette : impossible à obtenir'))
    if tid is None and paths[i] and i not in base_items: pass
    if tid is None and (paths[i]) and (it.get('category') in ('rail','equipment','armor') or i.startswith(('machine_','piece_'))) :
        msgs.append(('info',"Disponible dès le départ (aucune technologie)"))
    uses=used.get(i,set())
    if not uses and not it.get('category') and i not in ('nuclear_waste',) and not it.get('creative'):
        msgs.append(('info',"Ne sert d'ingrédient à rien"))
    m=img[i]['model']
    if m.startswith('aucun') and not i.startswith('res_'): msgs.append(('info','Pas de modèle 3D propre'))
    issues[i]=msgs
def node(i,qty=None,cls='',tag=''):
    ic=img.get(i,{}).get('icon')
    im=f'<img src="{ic}" alt="" width="32" height="32">' if ic else '<span class="ph"></span>'
    q=f'<em>{qty}×</em>' if qty else ''
    t=f'<small>{e(tag)}</small>' if tag else ''
    return f'<a class="n {cls}" href="#{e(i)}">{im}<span>{q}{e(name(i))}{t}</span></a>'
def tnode(tid):
    t=tby[tid]; req=[tname(r) for r in t.get('requires',[])]
    cost=' · '.join(f"{v}× {name(k)}" for k,v in t.get('cost',{}).items())
    after=f"après {', '.join(req)}" if req else 'sans prérequis'
    return f'<div class="n tech"><span class="tg">T{t["tier"]}</span><span><b>{e(tname(tid))}</b><small>{e(after)} · coûte {e(cost)}</small></span></div>'
def tree(i,p,idx):
    parts=[]
    for k,v in p['in'].items(): parts.append(node(k,v))
    if p['machine']: parts.append(node(p['machine'],None,'mach','machine'))
    for tid in unl.get(i,[]): parts.append(tnode(tid))
    if not parts: parts=['<div class="n raw"><span>rien</span></div>']
    lab=('À la main' if p['kind']=='hand' else f"{name(p['machine'])}"+(f" · {p['seconds']} s" if p['seconds'] else ''))
    if p.get('fluid'): lab+=f" · fluide {p['fluid']['kind']} {p['fluid']['amount']:+d} L"
    bad=pathok[i][idx]
    flag='<span class="pill warn">incomplet</span>' if bad else ''
    outs=' '.join(f"{v}× {name(k)}" for k,v in p['out'].items() if k!=i or v!=1)
    prod=node(i,p['out'].get(i) if p['out'].get(i,1)!=1 else None,'prod')
    return f'<div class="path"><div class="lab">{e(lab)} {flag}</div><div class="tree"><div class="inputs">{"".join(f"<div class=in>{x}</div>" for x in parts)}</div><div class="stem"></div>{prod}</div></div>'
cards=[]; stats={'warn':0,'bad':0,'info':0}
for it in items:
    i=it['id']; ps=paths[i]
    body=''.join(tree(i,p,k) for k,p in enumerate(ps))
    if not ps:
        t=''.join(f'<div class="in">{tnode(t)}</div>' for t in unl.get(i,[]))
        why=SPECIAL.get(i,'Ressource du monde / mode Créatif' if it.get('creative') else '')
        body=f'<div class="path"><div class="lab">{e(why) or "Aucune recette"}</div><div class="tree"><div class="inputs">{t}</div>{"<div class=stem></div>" if t else ""}{node(i,None,"prod")}</div></div>'
    u=sorted(x for x in used.get(i,[]) )
    uh=''.join((f'<a class="u" href="#{e(x)}">{e(name(x))}</a>' if not x.startswith('tech:') else f'<span class="u t">Techno : {e(tname(x[5:]))}</span>') for x in u[:14])
    if len(u)>14: uh+=f'<span class="u more">+{len(u)-14}</span>'
    msgs=issues[i]
    for s,_ in msgs: stats[s]+=1
    mh=''.join(f'<li class="{s}">{e(m)}</li>' for s,m in msgs)
    sev='bad' if any(s=='bad' for s,_ in msgs) else 'warn' if any(s=='warn' for s,_ in msgs) else 'info' if msgs else 'ok'
    cat=CAT.get(it.get('category'),'—')
    ic=img[i]['icon']
    cards.append(f'<article class="card {sev}" id="{e(i)}" data-q="{e((name(i)+" "+i+" "+cat).lower())}" data-sev="{sev}" data-cat="{e(it.get("category") or "")}"><header><img src="{ic}" alt="" width="40" height="40"><div><h3>{e(name(i))}</h3><code>{e(i)}</code></div><span class="cat">{e(cat)}</span></header>{body}{f"<div class=usedin><span class=lab>Utilisé dans</span>{uh}</div>" if uh else "<div class=usedin><span class=lab>Utilisé dans</span><span class=muted>rien</span></div>"}{f"<ul class=iss>{mh}</ul>" if mh else ""}</article>')
# json graph
graph={'items':{i['id']:{'name':name(i['id']),'category':i.get('category'),'tech':unl.get(i['id'],[]),'paths':[{k:v for k,v in p.items() if k in('kind','machine','in','out','seconds')} for p in paths[i['id']]],'usedIn':sorted(used.get(i['id'],[])),'issues':[m for _,m in issues[i['id']]]} for i in items},
 'techs':{t['id']:{'name':tname(t['id']),'tier':t['tier'],'cost':t.get('cost',{}),'requires':t.get('requires',[]),'unlocks':t.get('unlocks',[])} for t in techs}}
json.dump(graph,open(R+'docs/arbre-objets.json','w'),ensure_ascii=False,indent=1)
nbad=sum(1 for i in items if any(s=='bad' for s,_ in issues[i['id']])); nwarn=sum(1 for i in items if any(s=='warn' for s,_ in issues[i['id']]) and not any(s=='bad' for s,_ in issues[i['id']]))
css=open(S+'fiches.css').read()
js='''
const q=document.getElementById("q"),s=document.getElementById("fs"),c=document.getElementById("fc"),cards=[...document.querySelectorAll(".card")],n=document.getElementById("n");
function f(){const t=q.value.toLowerCase().trim();let k=0;for(const a of cards){const ok=(!t||a.dataset.q.includes(t))&&(!s.value||a.dataset.sev===s.value||(s.value==="pb"&&(a.dataset.sev==="bad"||a.dataset.sev==="warn")))&&(!c.value||a.dataset.cat===c.value);a.hidden=!ok;if(ok)k++}n.textContent=k+" fiches"}
q.oninput=s.onchange=c.onchange=f;f();
addEventListener("hashchange",()=>{const a=document.getElementById(decodeURIComponent(location.hash.slice(1)));if(a){a.hidden=false;a.scrollIntoView({block:"start"});a.classList.add("flash");setTimeout(()=>a.classList.remove("flash"),1600)}});
'''
cats=''.join(f'<option value="{c}">{e(v)}</option>' for c,v in CAT.items())
body=f'''<title>Fiches objets</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono&family=IBM+Plex+Sans:wght@400;600&display=swap">
<style>{css}</style>
<h1>Fiches objets</h1>
<p class="sub">Une mini-arbre par objet : ce qu'il faut pour le fabriquer (ingrédients, machine) et la technologie à connaître. Les fiches se recoupent : cliquer un nom ouvre sa fiche, « Utilisé dans » montre ce que touche un changement. Données : <code>docs/arbre-objets.json</code>. Légende : trait plein = objet, <span class="lg mach">machine</span>, <span class="lg tech">technologie</span>.</p>
<div class="sum"><span><b>{len(items)}</b> objets</span><span class="bad"><b>{nbad}</b> sans moyen d'obtention</span><span class="warn"><b>{nwarn}</b> avec contrainte techno incohérente</span><span class="muted">{stats['info']} remarques</span></div>
<div class="tools"><input id="q" type="search" placeholder="Rechercher un objet" aria-label="Rechercher"><select id="fs" aria-label="État"><option value="">Toutes les fiches</option><option value="pb">À corriger</option><option value="bad">Impossible à obtenir</option><option value="warn">Contrainte techno</option><option value="info">Remarques</option><option value="ok">Conformes</option></select><select id="fc" aria-label="Onglet"><option value="">Tous les onglets</option>{cats}</select><span id="n" class="muted"></span></div>
<main class="grid">{''.join(cards)}</main>
<script>{js}</script>
'''
open(S+'fiches.html','w').write(body)
open(R+'docs/fiches-objets.html','w').write('<!doctype html>\n<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>\n'+body+'</body></html>')
print(len(body)/1e6,'Mo',nbad,nwarn,stats)
for i in items:
    for s,m in issues[i['id']]:
        if s in('bad','warn'): print(s,i['id'],m[:110])
