"""Génère docs/arbre-decouvertes-t0-t5.html : arbre vertical des découvertes (données de tools/gen_decouvertes.py).

Les icônes viennent de l'audit des objets (variable d'environnement ICONES : fichier JSON {objet: {icon: adresse de données}}).
Lancer depuis `navigateur/` : ICONES=<chemin> python3 tools/gen_arbre_decouvertes.py
"""
import sys, os, json, html
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
# prérequis directs (réduction transitive) et parent principal : le plus profond (celui qui tient la branche)
direct={k:sorted({d for d in deps(k) if not any(d in anc(o) for o in deps(k) if o!=d)},key=lambda z:(-depth[z],ids.index(z))) for k in ids}
parent={k:(direct[k][0] if direct[k] else None) for k in ids}
rows=[[k for k in ids if depth[k]==r] for r in range(max(depth.values())+1)]
CW,CH,GX,GY,PAD=112,92,10,40,20
# Mise en page compacte : chaque rangée est tassée sans trous et centrée ; l'ordre dans la rangée suit la position moyenne
# des parents (descente) puis des enfants (remontée), plusieurs fois, pour limiter les croisements.
children={k:[j for j in ids if k in direct[j]] for k in ids}
STEP=CW+GX
x={}
def sweep(order_rows,neigh):
    for row in order_rows:
        def bar(k):
            ps=[x[d] for d in neigh(k) if d in x]
            return sum(ps)/len(ps) if ps else x[k]
        row.sort(key=lambda k:(bar(k),ids.index(k)))
        for i,k in enumerate(row): x[k]=(i-(len(row)-1)/2)*STEP
for ri,row in enumerate(rows):
    for i,k in enumerate(row): x[k]=(i-(len(row)-1)/2)*STEP
for _ in range(10):
    sweep(rows[1:],lambda k:direct[k])
    sweep(rows[-2::-1],lambda k:children[k])
W=max(x.values())+CW+PAD*2
shift=PAD-min(x.values())
for k in x: x[k]+=shift
VW=max(x.values())+CW+PAD
y={k:PAD+36+depth[k]*(CH+GY) for k in ids}
VH=max(y.values())+CH+PAD
def wrap(s,w=15):
    out=[];cur=''
    for word in s.split(' '):
        if cur and len(cur)+1+len(word)>w: out.append(cur); cur=word
        else: cur=(cur+' '+word).strip()
    out.append(cur); return out[:3]
label=lambda k:D[k][0].split(' (')[0]
def costline(k):
    c=D[k][4]; t=tier(k)
    if t==0: return 'ressources'
    s='T1' if t==1 else f'T{t}+T{t-1}'
    cb=c.get('combat_pack')
    num=max(v for kk,v in c.items() if kk!='combat_pack')
    return f"{num}×{s}"+(f" +{cb}⚔" if cb else '')
costline_plain=lambda k:costline(k).replace('⚔',' combat')
svg=[f'<svg id="arbre" viewBox="0 0 {VW:.0f} {VH:.0f}" width="{VW:.0f}" height="{VH:.0f}" role="img" aria-label="Arbre vertical des découvertes des paliers 0 à 5 : {len(ids)} découvertes, du haut (premières découvertes) vers le bas." xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">']
used_icons=sorted({u for k in ids for u in D[k][2][:3] if ICONS.get(u,{}).get('icon')})
svg.append('<defs>'+''.join(f'<image id="i_{u}" width="30" height="30" href="{ICONS[u]["icon"]}"/>' for u in used_icons)+'</defs>')
edges=[]
for k in ids:
    for d in direct[k]:
        x1,y1=x[d]+CW/2,y[d]+CH; x2,y2=x[k]+CW/2,y[k]
        main= d==parent[k]
        bus=y1+8+(ids.index(d)%5)*7   # chaque parent a sa hauteur de barre : deux familles ne se confondent pas
        edges.append(f'<path class="e{" main" if main else ""}" data-from="{d}" data-to="{k}" d="M{x1:.0f} {y1} V{bus:.0f} H{x2:.0f} V{y2-2}"/>')
svg+=edges
for k in ids:
    t=tier(k); cls=f'n t{t} c-{G.CAT[k]}'+(' cb' if 'combat_pack' in D[k][4] else '')
    ic=[u for u in D[k][2] if ICONS.get(u,{}).get('icon') or u in G.PROPOSED][:3]
    g=[f'<g class="{cls}" data-id="{k}" tabindex="0"><title>{html.escape(D[k][0])} : {html.escape(", ".join(n(u) for u in D[k][2]) or "paquets plus rapides")}</title>',
       f'<rect class="box" x="{x[k]:.0f}" y="{y[k]}" width="{CW}" height="{CH}" rx="6"/>',
       f'<path class="tab" d="M{x[k]+1:.0f} {y[k]+22} V{y[k]+7} Q{x[k]+1:.0f} {y[k]+1} {x[k]+7:.0f} {y[k]+1} H{x[k]+26:.0f} Z"/><text class="tt" x="{x[k]+5:.0f}" y="{y[k]+11}">T{t}</text>']
    if not D[k][2]:
        g.append(f'<text class="gl" x="{x[k]+CW/2:.0f}" y="{y[k]+27}" text-anchor="middle">I{"I" if "2" in k else ""}{"I" if "3" in k else ""}</text>')
    tot=len(ic)*32; sx=x[k]+(CW-tot)/2+1
    for i,u in enumerate(ic):
        if ICONS.get(u,{}).get('icon'): g.append(f'<use href="#i_{u}" x="{sx+i*32:.0f}" y="{y[k]+6}"/>')
        else: g.append(f'<rect class="ph" x="{sx+i*32+2:.0f}" y="{y[k]+8}" width="26" height="26" rx="5"/><text class="phl" x="{sx+i*32+15:.0f}" y="{y[k]+26}" text-anchor="middle">{html.escape(n(u)[0])}</text>')
    more=len(D[k][2])-len(ic)
    if more>0: g.append(f'<text class="mo" x="{x[k]+CW-8}" y="{y[k]+16}" text-anchor="end">+{more}</text>')
    for i,line in enumerate(wrap(label(k))): g.append(f'<text class="nm" x="{x[k]+CW/2:.0f}" y="{y[k]+50+i*12}" text-anchor="middle">{html.escape(line)}</text>')
    g.append(f'<text class="ct" x="{x[k]+CW/2:.0f}" y="{y[k]+CH-6}" text-anchor="middle">{html.escape(costline(k))}</text></g>')
    svg.append(''.join(g))
svg.append('</svg>')
items_all=G.items
recs=G.rec
def paths_of(item):
    out=[]
    it=items_all[item]
    if it.get('recipe'):
        out.append({'m':'','s':0,'i':[[k,v] for k,v in it['recipe'].items()],'o':it.get('yield',1),'new':item in G.PROPOSED})
    for r in recs:
        if item in r['out'] and not (r['machine']=='barreler' and item=='barrel_empty'):
            f=r.get('fluid')
            out.append({'m':n('machine_'+r['machine']),'s':r.get('seconds',0),'i':[[k,v] for k,v in r.get('in',{}).items()],'o':r['out'][item],
                        'mo':n(r['mould']) if r.get('mould') else '', 'f':(f"{f['kind']} {f['amount']:+d} L" if f else '')})
    return out
need_icons=set()
dd={}
for k in ids:
    its=[]
    for u in D[k][2]:
        ps=paths_of(u)
        for pth in ps:
            for a,_ in pth['i']: need_icons.add(a)
        need_icons.add(u); its.append({'id':u,'n':n(u),'p':ps,'new':u in G.PROPOSED})
    cost=[[kk,v] for kk,v in D[k][4].items()]
    for kk,_ in cost: need_icons.add(kk)
    dd[k]={'n':D[k][0],'t':tier(k),'c':cost,'it':its,'pre':[D[d][0] for d in direct[k]]}
icn={u:ICONS[u]['icon'] for u in need_icons if ICONS.get(u,{}).get('icon')}
names={u:n(u) for u in need_icons}
up={k:sorted(anc(k)) for k in ids}
down={k:sorted(j for j in ids if k in anc(j)) for k in ids}
info={k:{'n':D[k][0],'u':[n(u) for u in D[k][2]],'c':costline_plain(k).replace('×',' × ')} for k in ids}
page='''<title>Arbre des découvertes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600&display=swap">
<style>
/* Arbre vertical : on lit de haut en bas, une découverte débloque un groupe de recettes quand ses parents sont connus. Bordure = type de recette ; onglet = palier. */
:root{--bg:#f3f1ec;--panel:#fbfaf7;--fg:#22211e;--mut:#6c6860;--line:#a29d92;--rule:#d9d5cc;--t0:#9a958a;--t1:#b8a233;--t2:#2f9e82;--t3:#3a7bd5;--t4:#8a5cc4;--t5:#c4527a;--cb:#d4572a;--hl:#c0392b;--fade:.18;--c-base:#7a8d3a;--c-inter:#d98a1f;--c-machine:#3b6fb6;--c-autre:#8c8478;
--sans:"IBM Plex Sans",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#171815;--panel:#22231f;--fg:#ebe8e0;--mut:#a29d92;--line:#6f6a60;--rule:#34352f;--t0:#8a867b;--t1:#d6c15a;--t2:#4fc3a1;--t3:#6aa3ff;--t4:#b48be8;--t5:#ee7fa3;--cb:#ee7a4e;--hl:#ff7a68;--c-base:#a6c25a;--c-inter:#f0a840;--c-machine:#6fa0ea;--c-autre:#a39d92;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#171815;--panel:#22231f;--fg:#ebe8e0;--mut:#a29d92;--line:#6f6a60;--rule:#34352f;--t0:#8a867b;--t1:#d6c15a;--t2:#4fc3a1;--t3:#6aa3ff;--t4:#b48be8;--t5:#ee7fa3;--cb:#ee7a4e;--hl:#ff7a68;--c-base:#a6c25a;--c-inter:#f0a840;--c-machine:#6fa0ea;--c-autre:#a39d92;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--sans);padding-block:20px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{display:flex;flex-direction:column;gap:14px}
.layout{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:14px;align-items:start}
@media (max-width:900px){.layout{grid-template-columns:1fr}.panel{order:-1;position:static!important}}
.top{max-width:760px;display:flex;flex-direction:column;gap:12px}
h1{font-size:1.5rem;margin:0;font-weight:600}
p{margin:0;color:var(--mut);line-height:1.5}
.leg{display:flex;flex-wrap:wrap;gap:6px 18px;font:400 12px var(--mono);color:var(--mut)} .sw{display:inline-block;color:#fff;font:700 10px var(--mono);padding:1px 5px;border-radius:3px;margin-right:6px}.leg i{display:inline-block;width:12px;height:12px;border:2px solid;border-radius:3px;margin-right:6px;vertical-align:-2px}
#det{display:none}
.panel{position:sticky;top:12px;background:var(--panel);border:1px solid var(--rule);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:12px;max-height:calc(100vh - 24px);overflow:auto}
.panel h2{margin:0;font-size:1.1rem;font-weight:600} .panel h3{margin:0 0 6px;font:600 11px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mut)}
.chip{display:inline-block;font:600 11px var(--mono);padding:1px 7px;border-radius:10px;border:1.5px solid var(--t0);margin-left:6px;vertical-align:2px}
.row{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center}
.ing{display:inline-flex;align-items:center;gap:4px;font-size:.85rem} .ing img{width:26px;height:26px}
.rc{border-top:1px solid var(--rule);padding-top:8px;display:flex;flex-direction:column;gap:5px} .rc .it{display:flex;align-items:center;gap:8px;font-weight:600;font-size:.95rem} .rc .it img{width:34px;height:34px}
.rc .how{font:400 11.5px var(--mono);color:var(--mut)} .pre{font-size:.85rem;color:var(--mut);line-height:1.5}
.bar{display:flex;gap:8px;align-items:center;font:400 12px var(--mono);color:var(--mut)}
.bar button{font:600 14px var(--sans);width:32px;height:32px;border-radius:6px;border:1px solid var(--rule);background:var(--panel);color:var(--fg);cursor:pointer}
.scroll{overflow:auto;border:1px solid var(--rule);border-radius:8px;background:var(--panel);max-height:80vh}
#zoom{transform-origin:0 0;display:block}
.n .box{fill:var(--bg);stroke:var(--c-autre);stroke-width:3}
.n.c-base .box{stroke:var(--c-base)} .n.c-inter .box{stroke:var(--c-inter)} .n.c-machine .box{stroke:var(--c-machine)} .n.c-autre .box{stroke:var(--c-autre)}
.n.cb .box{fill:color-mix(in srgb,var(--cb) 12%,var(--bg))}
.tab{fill:var(--t0)} .t1 .tab{fill:var(--t1)} .t2 .tab{fill:var(--t2)} .t3 .tab{fill:var(--t3)} .t4 .tab{fill:var(--t4)} .t5 .tab{fill:var(--t5)}
.tt{font:700 8.5px var(--mono);fill:#fff;pointer-events:none} .ph{fill:var(--rule)} .phl{font:700 14px var(--sans);fill:var(--mut)}
.nm{font:600 10.5px var(--sans);fill:var(--fg)} .ct{font:500 10px var(--mono);fill:var(--mut)} .mo{font:600 10px var(--mono);fill:var(--mut)} .gl{font:600 17px var(--mono);fill:var(--mut)}
.n{cursor:pointer;outline:none} .n:focus-visible .box{stroke:var(--hl)}
.e{fill:none;stroke:var(--line);stroke-width:1.4;opacity:.75;stroke-dasharray:5 4} .e.main{stroke-dasharray:none;opacity:.95;stroke-width:1.7}
.dim .n{opacity:var(--fade)} .dim .n.on{opacity:1} .dim .e{opacity:.08} .dim .e.on{opacity:1;stroke:var(--hl);stroke-width:2.2} .dim .n.sel .box{stroke:var(--hl);stroke-width:4}
</style>
<main>
<div class="top">
<h1>Arbre des découvertes</h1>
<p>Paliers 0 à 5 : @N@ découvertes, du haut (les premières) vers le bas. Chaque case débloque un groupe de recettes ; on la découvre quand ses parents sont connus. Une case a un trait plein vers son parent principal et des traits pointillés vers ses autres parents. Touchez une case pour mettre en évidence tout ce qu'il faut avant et tout ce qu'elle ouvre.</p>
<div class="leg"><span><i style="border-color:var(--c-base)"></i>recette de base (plaque, fil, engrenage, tissu…)</span><span><i style="border-color:var(--c-inter)"></i>intermédiaire (kit circuit, puce, moteur…)</span><span><i style="border-color:var(--c-machine)"></i>machine</span><span><i style="border-color:var(--c-autre)"></i>équipement, véhicule, construction, paquet</span></div>
<div class="leg"><span><b style="background:var(--t0)" class="sw">T0</b>ressources</span><span><b style="background:var(--t1)" class="sw">T1</b>paquets T1</span><span><b style="background:var(--t2)" class="sw">T2</b>T2 + T1</span><span><b style="background:var(--t3)" class="sw">T3</b>T3 + T2</span><span><b style="background:var(--t4)" class="sw">T4</b>T4 + T3</span><span><b style="background:var(--t5)" class="sw">T5</b>T5 + T4</span><span><i style="border-color:var(--cb);background:color-mix(in srgb,var(--cb) 25%,transparent)"></i>+ paquets de combat (⚔)</span></div>
<div class="bar"><button id="zo" aria-label="Dézoomer">−</button><button id="zi" aria-label="Zoomer">+</button><span id="zl">100 %</span></div>
</div>
<div class="layout"><div class="scroll"><div id="zoom">@SVG@</div></div><aside class="panel" id="panel"><p>Touchez une case de l'arbre : son coût de découverte et le coût de fabrication de ses recettes s'affichent ici.</p></aside></div>
</main>
<script>
const UP=@UP@,DOWN=@DOWN@,INFO=@INFO@,DD=@DD@,ICN=@ICN@,NM=@NM@;
const svg=document.getElementById('arbre'),det=document.getElementById('panel'),zoom=document.getElementById('zoom');
const nodes=[...svg.querySelectorAll('.n')],edges=[...svg.querySelectorAll('.e')];
const IDLE="<p>Touchez une case de l'arbre : son coût de découverte et le coût de fabrication de ses recettes s'affichent ici.</p>";
const esc=t=>String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const ing=(id,q)=>'<span class="ing">'+(ICN[id]?'<img alt="" src="'+ICN[id]+'">':'')+'<span>'+q+' × '+esc(NM[id]||id)+'</span></span>';
function panel(id){
 const d=DD[id];let h='<h2>'+esc(d.n)+'<span class="chip" style="border-color:var(--t'+d.t+')">palier '+d.t+'</span></h2>';
 h+='<div><h3>Coût de la découverte</h3><div class="row">'+d.c.map(c=>ing(c[0],c[1])).join('')+'</div></div>';
 if(d.pre.length)h+='<div><h3>Découvertes requises</h3><div class="pre">'+d.pre.map(esc).join(', ')+'</div></div>';
 h+='<div><h3>Débloque et coût de fabrication</h3>';
 if(!d.it.length)h+='<div class="pre">Effet : les paquets de science sont consommés plus vite.</div>';
 d.it.forEach(it=>{
  h+='<div class="rc"><div class="it">'+(ICN[it.id]?'<img alt="" src="'+ICN[it.id]+'">':'')+'<span>'+esc(it.n)+'</span></div>';
  if(!it.p.length)h+='<div class="how">Pas de recette (butin ou ressource).</div>';
  it.p.forEach(p=>{h+='<div class="how">'+(it.new||p.new?'<b>(proposé, pas encore dans le jeu)</b> ':'')+(p.m?esc(p.m)+(p.s?' · '+p.s+' s':''):'À la main')+(p.mo?' · moule : '+esc(p.mo):'')+(p.o>1?' · donne '+p.o:'')+(p.f?' · '+esc(p.f):'')+'</div><div class="row">'+p.i.map(a=>ing(a[0],a[1])).join('')+'</div>'});
  h+='</div>'});
 return h+'</div>';
}
function clear(){svg.classList.remove('dim');nodes.forEach(n=>n.classList.remove('on','sel'));edges.forEach(e=>e.classList.remove('on'));det.innerHTML=IDLE}
function pick(id){
 const all=new Set([id,...UP[id],...DOWN[id]]);
 svg.classList.add('dim');
 nodes.forEach(n=>{const k=n.dataset.id;n.classList.toggle('on',all.has(k));n.classList.toggle('sel',k===id)});
 edges.forEach(e=>e.classList.toggle('on',all.has(e.dataset.from)&&all.has(e.dataset.to)));
 const i=INFO[id],names=UP[id].map(k=>INFO[k].n);
 det.innerHTML=panel(id)+(names.length?'<div><h3>Tout l\\'amont ('+names.length+')</h3><div class="pre">'+names.map(esc).join(', ')+'</div></div>':'');
}
let cur=null;
nodes.forEach(n=>{n.addEventListener('click',ev=>{ev.stopPropagation();const id=n.dataset.id;if(cur===id){cur=null;clear()}else{cur=id;pick(id)}});
 n.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();n.dispatchEvent(new Event('click',{bubbles:true}))}})});
document.addEventListener('click',e=>{if(!e.target.closest('.bar')){cur=null;clear()}});
let z=1;const zl=document.getElementById('zl');
function setZ(v){z=Math.max(.4,Math.min(1.6,v));svg.style.transformOrigin='0 0';svg.style.transform='scale('+z+')';zoom.style.width=(svg.viewBox.baseVal.width*z)+'px';zoom.style.height=(svg.viewBox.baseVal.height*z)+'px';zl.textContent=Math.round(z*100)+' %'}
document.getElementById('zi').onclick=()=>setZ(z+.15);document.getElementById('zo').onclick=()=>setZ(z-.15);
setZ(window.innerWidth<700?.6:.9);
</script>
'''
page=page.replace('@N@',str(len(ids))).replace('@SVG@','\n'.join(svg)).replace('@UP@',json.dumps(up)).replace('@DOWN@',json.dumps(down)).replace('@INFO@',json.dumps(info,ensure_ascii=False)).replace('@DD@',json.dumps(dd,ensure_ascii=False)).replace('@ICN@',json.dumps(icn)).replace('@NM@',json.dumps(names,ensure_ascii=False))
open('docs/arbre-decouvertes-t0-t5.html','w').write(page)
print(len(page)//1024,'Ko',round(VW),round(VH),'rangées',len(rows),'plus large',max(len(r) for r in rows))
