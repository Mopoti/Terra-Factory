"""Génère docs/decouvertes-t0-t2.md : la proposition d'arbre de découvertes (palier 0 à 2) à partir de `D` ci-dessous.

Les prérequis affichés = ceux choisis dans `D` + ceux déduits des recettes (ingrédients et machine de chaque objet
débloqué, s'ils sont débloqués par une autre découverte). Contrôle : aucun prérequis de palier supérieur, pas de boucle.
Lancer depuis `navigateur/` : python3 tools/gen_decouvertes.py
"""
import json, sys
fr=json.load(open('src/i18n/fr.json'))
items={i['id']:i for i in json.load(open('content/items.json'))['items']}
rec=json.load(open('content/recipes.json'))['recipes']
n=lambda i: fr.get('item.'+i,i)
# id: (nom, palier, [objets débloqués], [prérequis choisis], coût)
S1,S2,C='science_pack','science_pack_2','combat_pack'
D={
 # --- Palier 0 : payé en ressources du début de partie
 'metallurgy':('Métallurgie',0,['machine_stamper','machine_crusher','iron_plate','copper_plate','iron_gear','copper_wire','iron_rod'],[],{'iron_ingot':20,'stone':10}),
 'electricity':('Électricité',0,['machine_pole','machine_crank'],['metallurgy'],{'iron_ingot':15,'copper_ingot':10}),
 'laboratory':('Laboratoire',0,['machine_lab',S1],['electricity'],{'iron_ingot':10,'copper_ingot':10}),
 'iron_tool':('Outil en fer',0,['tool_iron'],[],{'iron_ingot':10}),
 'waterwheel':('Roue à aubes',0,['machine_waterwheel'],['metallurgy'],{'copper_plate':10}),
 'pistol':('Pistolet',0,['pistol','magazine'],['metallurgy'],{'iron_plate':10}),
 'research_1':('Recherche I (paquets plus vite)',0,[],['laboratory'],{'iron_ingot':20,'copper_ingot':20}),
 # --- Palier 1 : paquets T1
 'conveyor':('Convoyeur',1,['machine_conveyor','machine_arm'],['laboratory'],{S1:100}),
 'routing':('Aiguillage',1,['machine_splitter','machine_merger'],['conveyor'],{S1:100}),
 'handling':('Manutention',1,['machine_chest_iron','waypoint'],['conveyor'],{S1:100}),
 'textile':('Textile',1,['cloth'],['laboratory'],{S1:100}),
 'clothing':('Vêtements',1,['trousers','boots','gloves','hood','backpack'],['textile'],{S1:100}),
 'bedding_1':('Couchage de survie',1,['sleeping_bag'],['textile'],{S1:100}),
 'navigation':('Navigation',1,['compass'],['laboratory'],{S1:100}),
 'water':('Eau',1,['machine_pipe','machine_pump'],['laboratory'],{S1:150}),
 'motor':('Moteur simple',1,['motor'],['laboratory'],{S1:150}),
 'light_vehicles':('Véhicules légers',1,['vehicle_buggy','vehicle_quad'],['motor'],{S1:150}),
 'steam_power':('Chaudière et turbine',1,['machine_boiler','machine_turbine'],['water'],{S1:150}),
 'pack_2':('Paquet de science T2',1,[S2],['metallurgy'],{S1:100}),
 'armor_1':('Armure 1',1,['armor1_head','armor1_torso','armor1_legs','armor1_feet'],['pistol','clothing'],{S1:100,C:10}),
 'turret':('Tourelle',1,['machine_turret'],['conveyor','pistol'],{S1:100,C:10}),
 # --- Palier 2 : paquets T2 et T1
 'steel':('Acier',2,['machine_bessemer','steel_plate'],['pack_2'],{S2:100,S1:100}),
 'concrete':('Béton',2,['machine_mixer','concrete_block','piece_wall_concrete','piece_slab_concrete','piece_stairs_concrete','piece_pillar_concrete'],['steel'],{S2:150,S1:150}),
 'washing':('Lavage',2,['machine_washer','iron_ore_washed','copper_ore_washed','zinc_ore_washed','zinc_ingot'],['steel'],{S2:150,S1:150}),
 'fabrication':('Fabrication',2,['machine_builder','machine_pipe_2'],['steel'],{S2:150,S1:150}),
 'fluids':('Fluides',2,['machine_booster','machine_cooling_tower'],['fabrication'],{S2:150,S1:150}),
 'conveyor_2':('Convoyeur rapide',2,['machine_conveyor_2'],['conveyor','steel'],{S2:100,S1:100}),
 'automation':('Automatisation',2,['machine_arm_electric','machine_assembler'],['conveyor','steel'],{S2:200,S1:200}),
 'generator':('Générateur à combustible',2,['machine_generator'],['electricity','steam_power'],{S2:100,S1:100}),
 'drill_electric':('Foreuse électrique',2,['machine_drill_electric'],['generator'],{S2:150,S1:150}),
 'bedding_2':('Couchage de confort',2,['bed'],['bedding_1'],{S2:100,S1:100}),
 'research_2':('Recherche II',2,[],['research_1'],{S2:100,S1:100}),
 'rifle':('Fusil',2,['rifle','rifle_magazine'],['pistol','steel'],{S2:100,S1:100,C:20}),
 'armor_2':('Armure 2',2,['armor2_head','armor2_torso','armor2_legs','armor2_feet'],['armor_1','steel'],{S2:150,S1:150,C:20}),
 'turret_heavy':('Tourelle lourde',2,['machine_turret_heavy'],['turret','steel'],{S2:150,S1:150,C:20}),
}
owner={u:k for k,v in D.items() for u in v[2]}
def needs(item):
    out=set(items[item].get('recipe') or {})
    for x in rec:
        if item in x['out']:
            out|=set(x.get('in',{})); out.add('machine_'+x['machine'])
            if x.get('mould'): out.add(x['mould'])
    return out
derived={}
for k,(nm,t,un,pre,cost) in D.items():
    derived[k]={owner[need] for u in un for need in needs(u) if need in owner and owner[need]!=k}
deps=lambda k: set(D[k][3])|derived[k]
errors=[k for k in D if any(D[d][1]>D[k][1] for d in deps(k))]
def cyc():
    for k in D:
        seen=set(); st=[k]
        while st:
            x=st.pop()
            for d in deps(x):
                if d==k: return k
                if d not in seen: seen.add(d); st.append(d)
if errors or cyc(): sys.exit(f'erreur : palier supérieur {errors}, boucle {cyc()}')
cost=lambda c: ' + '.join(f'{v} × {n(k)}' for k,v in c.items())
order=list(D)
pre=lambda k: sorted(deps(k), key=lambda x:(D[x][1],order.index(x)))
L=["# Découvertes T0, T1 et T2 — proposition","","Statut : **proposition à corriger avec le PO** (tour 235, généré par `tools/gen_decouvertes.py`). Rien n'est codé : l'arbre actuel des technologies reste en jeu.","",
"Règles :","- Une découverte débloque **les recettes** d'un ou plusieurs objets (une seule est possible).","- Ses **prérequis** : les découvertes qui débloquent les ingrédients et la machine de ses recettes (déduits des recettes actuelles) plus ceux ajoutés pour la logique de progression. Aucun prérequis n'est d'un palier supérieur, aucune boucle.","- Palier 0 : payé en ressources du début de partie. Palier 1 : paquets T1. Palier 2 : paquets T2 **et** T1.","- **Armes, armures et tourelles** sont dans l'arbre : elles se paient aussi en **paquets de combat** en plus des paquets de leur palier.","",
"Connu dès le départ, sans découverte : bois, pierre, fibre, minerais, fourneau T1, foreuse T1, coffre en bois, outil en pierre, charrette, pièces de construction en bois et en pierre, moules, lingots, fonte.",""]
for t,title in ((0,'Palier 0 : payé en ressources'),(1,'Palier 1 : paquets T1'),(2,'Palier 2 : paquets T2 + T1')):
    L+=[f"## {title}","","| Découverte | Débloque | Prérequis | Coût |","| --- | --- | --- | --- |"]
    for k,(nm,tt,un,_,c) in D.items():
        if tt==t: L.append(f"| **{nm}** | {', '.join(n(u) for u in un) or '(effet : paquets plus rapides)'} | {', '.join(D[p][0] for p in pre(k)) or '—'} | {cost(c)} |")
    L.append("")
L+=["## Annoncé pour le palier 3 (à voir ensuite)","",
"- **Moteur renforcé** : il se fabrique avec du caoutchouc (presse à plastique, palier 3) ; la **locomotive** en a besoin. Le **chemin de fer** (rail, locomotive, wagons, gare) passe donc au palier 3, et non 2.",
"- **Tourelle laser** : demandera le moteur simple ; **tourelle plasma** : le moteur renforcé (recettes à modifier : elles n'en demandent pas aujourd'hui).","",
"## Points à confirmer","",
"1. **Moteur simple** laissé au palier 1 (il sert à la pompe, au buggy, au quad ; sinon la vapeur passerait au palier 2). Dites-moi si vous préférez le palier 2.",
"2. **Vêtements** = pantalon, bottes, gants, capuche et sac à dos (je lis « torse » comme le sac à dos : il n'y a pas de vêtement de torse) ; **Textile** = le tissu seul.",
"3. **Paquets de combat** : 10 au palier 1, 20 au palier 2 (valeurs de départ ; ils viennent des dépouilles des ennemis).",
"4. **Coûts** (100 à 200 paquets) : pas de réponse au point 5, je les garde tels quels."]
open('docs/decouvertes-t0-t2.md','w').write('\n'.join(L)+'\n')
print(len(D),'découvertes')
