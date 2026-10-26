"""Génère docs/arbre-decouvertes-t0-t3.html : schéma de l'arbre des découvertes (données de tools/gen_decouvertes.py).
Lancer depuis `navigateur/` : python3 tools/gen_arbre_decouvertes.py
"""
import sys, json, html
sys.path.insert(0,'tools')
import gen_decouvertes as G   # recalcule aussi docs/decouvertes-t0-t2.md
D,deps,n=G.D,G.deps,G.n
ids=list(D)
# réduction transitive : on ne dessine que les prérequis directs utiles
def anc(k,seen=None):
    seen=set() if seen is None else seen
    for d in deps(k):
        if d not in seen: seen.add(d); anc(d,seen)
    return seen
direct={k:{d for d in deps(k) if not any(d in anc(o) for o in deps(k) if o!=d)} for k in ids}
tier=lambda k:D[k][1]
cols=[[k for k in ids if tier(k)==t] for t in (0,1,2,3)]
# ordre dans chaque colonne : barycentre des prérequis (2 passes)
pos={}
for c in cols:
    for i,k in enumerate(c): pos[k]=i
for _ in range(4):
    for ci in (1,2,3):
        def bary(k):
            ps=[pos[d] for d in direct[k] if tier(d)<=ci]
            return sum(ps)/len(ps) if ps else pos[k]
        cols[ci].sort(key=bary)
        for i,k in enumerate(cols[ci]): pos[k]=i
W,H,GAPX,GAPY,PADX,PADY=206,40,120,12,52,64
x={k:PADX+tier(k)*(W+GAPX) for k in ids}
y={k:PADY+i*(H+GAPY) for c in cols for i,k in enumerate(c)}
rows=max(len(c) for c in cols)
VW=PADX+16+4*W+3*GAPX; VH=PADY+rows*(H+GAPY)
label=lambda k:D[k][0].split(' (')[0]
def costline(k):
    c=D[k][4]; t=tier(k)
    if t==0: return 'ressources'
    s='T1' if t==1 else f'T{t} + T{t-1}'
    cb=c.get('combat_pack')
    num=max(v for kk,v in c.items() if kk!='combat_pack')
    return f"{num} × {s}"+(f" · {cb} combat" if cb else '')
combat=lambda k:'combat_pack' in D[k][4]
svg=[f'<svg id="arbre" viewBox="0 0 {VW} {VH}" role="img" aria-label="Arbre des découvertes des paliers 0 à 3 : {len(ids)} découvertes, les flèches vont du prérequis vers la découverte qu\'il débloque." xmlns="http://www.w3.org/2000/svg">',
 '<defs><marker id="fl" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 1 L9 5 L0 9 z" fill="currentColor"/></marker></defs>']
heads={0:('Palier 0','payé en ressources'),1:('Palier 1','paquets T1'),2:('Palier 2','paquets T2 + T1'),3:('Palier 3','paquets T3 + T2')}
for t,(a,b) in heads.items():
    svg.append(f'<text class="head" x="{PADX+t*(W+GAPX)}" y="24">{a}</text><text class="sub" x="{PADX+t*(W+GAPX)}" y="42">{b}</text>')
edges=[]
for k in ids:
    for d in sorted(direct[k],key=lambda z:ids.index(z)):
        x1,y1=x[d]+W,y[d]+H/2; x2,y2=x[k],y[k]+H/2
        if tier(d)==tier(k):   # même colonne : arc par la gauche
            x1,x2=x[d],x[k]
            c=34+8*abs(pos[d]-pos[k])
            path=f'M{x1} {y1} C{x1-c} {y1} {x2-c} {y2} {x2-4} {y2}'
        else:
            mx=(x1+x2)/2
            path=f'M{x1} {y1} C{mx} {y1} {mx} {y2} {x2-4} {y2}'
        edges.append(f'<path class="e" data-from="{d}" data-to="{k}" d="{path}" marker-end="url(#fl)"/>')
svg+=edges
for k in ids:
    cls=f'n t{tier(k)}'+(' cb' if combat(k) else '')
    svg.append(f'<g class="{cls}" data-id="{k}" tabindex="0"><title>{html.escape(D[k][0])} — débloque : {html.escape(", ".join(n(u) for u in D[k][2]) or "paquets plus rapides")}</title>'
      f'<rect x="{x[k]}" y="{y[k]}" width="{W}" height="{H}" rx="4"/>'
      f'<text class="nm" x="{x[k]+10}" y="{y[k]+17}">{html.escape(label(k))}</text>'
      f'<text class="ct" x="{x[k]+10}" y="{y[k]+32}">{html.escape(costline(k))}</text></g>')
svg.append('</svg>')
up={k:sorted(anc(k)) for k in ids}
down={k:sorted(j for j in ids if k in anc(j)) for k in ids}
info={k:{'n':D[k][0],'u':[n(u) for u in D[k][2]],'c':costline(k)} for k in ids}
page='''<title>Arbre des découvertes</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans:wght@400;600&display=swap">
<style>
/* Lecture de gauche à droite : le palier monte, les flèches vont du prérequis vers la découverte. Couleurs = couleur des paquets du jeu. */
:root{--bg:#f3f1ec;--panel:#fbfaf7;--fg:#22211e;--mut:#6c6860;--line:#8f8a80;--rule:#d9d5cc;--t0:#9a958a;--t1:#b8a233;--t2:#2f9e82;--t3:#3a7bd5;--cb:#d4572a;--hl:#1f5fbf;--fade:.16;
--sans:"IBM Plex Sans",system-ui,sans-serif;--mono:"IBM Plex Mono",ui-monospace,monospace}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#171815;--panel:#1f201c;--fg:#ebe8e0;--mut:#a29d92;--line:#7c776d;--rule:#34352f;--t0:#8a867b;--t1:#d6c15a;--t2:#4fc3a1;--t3:#6aa3ff;--cb:#ee7a4e;--hl:#6aa3ff;color-scheme:dark}}
:root[data-theme="dark"]{--bg:#171815;--panel:#1f201c;--fg:#ebe8e0;--mut:#a29d92;--line:#7c776d;--rule:#34352f;--t0:#8a867b;--t1:#d6c15a;--t2:#4fc3a1;--t3:#6aa3ff;--cb:#ee7a4e;--hl:#6aa3ff;color-scheme:dark}
body{background:var(--bg);color:var(--fg);font-family:var(--sans);padding-block:20px 40px;padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px))}
main{max-width:1200px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
.wide{max-width:none}
h1{font-size:1.5rem;margin:0;text-wrap:balance;font-weight:600}
p{margin:0;color:var(--mut);line-height:1.5;max-width:70ch}
.box{background:var(--panel);border:1px solid var(--rule);border-radius:6px;padding:12px}
.scroll{overflow-x:auto}
svg{display:block;min-width:1100px;width:100%;height:auto;color:var(--line)}
.head{font:600 15px var(--sans);fill:var(--fg)} .sub{font:400 11.5px var(--mono);fill:var(--mut)}
.n rect{fill:var(--panel);stroke:var(--t0);stroke-width:1.5}
.n.t1 rect{stroke:var(--t1)} .n.t2 rect{stroke:var(--t2)} .n.t3 rect{stroke:var(--t3)}
.n.cb rect{stroke-dasharray:none;fill:color-mix(in srgb,var(--cb) 10%,var(--panel))}
.n .nm{font:600 13px var(--sans);fill:var(--fg)} .n .ct{font:400 11px var(--mono);fill:var(--mut)}
.n{cursor:pointer;outline:none} .n:focus-visible rect{stroke:var(--hl);stroke-width:3}
.e{fill:none;stroke:currentColor;stroke-width:1.3;opacity:.7}
.dim .n,.dim .e{opacity:var(--fade)} .dim .n.on,.dim .e.on{opacity:1} .dim .n.sel rect{stroke:var(--hl);stroke-width:3}
.dim .e.on{stroke:var(--hl);color:var(--hl)}
.leg{display:flex;flex-wrap:wrap;gap:6px 18px;font:400 12px var(--mono);color:var(--mut)} .leg i{display:inline-block;width:12px;height:12px;border:2px solid;border-radius:3px;margin-right:6px;vertical-align:-2px}
#det{min-height:3.2em;font-size:.95rem;line-height:1.5;max-width:none} #det b{color:var(--fg)}
</style>
<main>
<h1>Arbre des découvertes</h1>
<p>Paliers 0 à 3, proposition : @N@ découvertes. Une flèche va d'un prérequis vers la découverte qu'il débloque (seuls les prérequis directs sont tracés). Touchez une découverte : son amont (tout ce qu'il faut avoir découvert avant) et son aval restent en couleur.</p>
<div class="leg"><span><i style="border-color:var(--t0)"></i>palier 0 : ressources</span><span><i style="border-color:var(--t1)"></i>palier 1 : paquets T1</span><span><i style="border-color:var(--t2)"></i>palier 2 : paquets T2 + T1</span><span><i style="border-color:var(--t3)"></i>palier 3 : paquets T3 + T2</span><span><i style="border-color:var(--cb);background:color-mix(in srgb,var(--cb) 25%,transparent)"></i>demande aussi des paquets de combat</span></div>
<p id="det">Touchez une découverte pour voir ce qu'elle débloque et ce qu'il faut découvrir avant.</p>
<figure class="box scroll" style="margin:0">@SVG@<figcaption style="color:var(--mut);font-size:.85rem;margin-top:8px">Chaque case indique le coût d'une découverte : « 150 × T2 + T1 » = 150 paquets T2 et 150 paquets T1.</figcaption></figure>
</main>
<script>
const UP=@UP@,DOWN=@DOWN@,INFO=@INFO@;
const svg=document.getElementById('arbre'),det=document.getElementById('det');
const nodes=[...svg.querySelectorAll('.n')],edges=[...svg.querySelectorAll('.e')];
function clear(){svg.classList.remove('dim');nodes.forEach(n=>n.classList.remove('on','sel'));edges.forEach(e=>e.classList.remove('on'));det.innerHTML="Touchez une découverte pour voir ce qu'elle débloque et ce qu'il faut découvrir avant."}
function pick(id){
 const up=new Set(UP[id]),down=new Set(DOWN[id]),all=new Set([id,...up,...down]);
 svg.classList.add('dim');
 nodes.forEach(n=>{const k=n.dataset.id;n.classList.toggle('on',all.has(k));n.classList.toggle('sel',k===id)});
 edges.forEach(e=>e.classList.toggle('on',all.has(e.dataset.from)&&all.has(e.dataset.to)));
 const i=INFO[id],names=UP[id].map(k=>INFO[k].n);
 det.innerHTML='<b>'+i.n+'</b> ('+i.c+') débloque : '+(i.u.join(', ')||'paquets plus rapides')+'.<br>À découvrir avant : '+(names.length?names.join(', '):'rien')+'.';
}
let cur=null;
nodes.forEach(n=>{n.addEventListener('click',ev=>{ev.stopPropagation();const id=n.dataset.id;if(cur===id){cur=null;clear()}else{cur=id;pick(id)}});
 n.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();n.dispatchEvent(new Event('click',{bubbles:true}))}})});
document.addEventListener('click',()=>{cur=null;clear()});
</script>
''' 
page=page.replace('@N@',str(len(ids))).replace('@SVG@','\n'.join(svg)).replace('@UP@',json.dumps(up)).replace('@DOWN@',json.dumps(down)).replace('@INFO@',json.dumps(info,ensure_ascii=False))
open('docs/arbre-decouvertes-t0-t3.html','w').write(page)
print(len(page)//1024,'Ko',VW,VH)
