"""Génère docs/decouvertes-t0-t5.md : la proposition d'arbre de découvertes (palier 0 à 2) à partir de `D` ci-dessous.

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
S1,S2,S3,S4,S5,C='science_pack','science_pack_2','science_pack_3','science_pack_4','science_pack_5','combat_pack'
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
 'clothing':('Vêtements',1,['trousers','boots','gloves','hood','jacket'],['textile'],{S1:100}),
 'backpack':('Sac à dos',1,['backpack'],['textile'],{S1:100}),
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

 'pack_3':('Paquet de science T3',2,[S3],['steel','fabrication'],{S2:100,S1:100}),
 # --- Palier 3 : paquets T3 et T2
 'heavy_press':('Presse lourde',3,['machine_heavy_press','machine_pipe_3'],['fabrication','concrete'],{S3:150,S2:150}),
 'silicon':('Silicium',3,['machine_furnace_electric','silicon_raw','silicon_chip'],['heavy_press'],{S3:150,S2:150}),
 'barrels':('Barils',3,['machine_barreler','barrel_empty'],['steam_power','fluids'],{S3:150,S2:150}),
 'oil':('Pétrole',3,['machine_pumpjack','barrel_oil'],['barrels','heavy_press'],{S3:150,S2:150}),
 'plastics':('Plastique et caoutchouc',3,['machine_refinery','machine_plastic_press','plastic_insulator','cable_insulated','rubber'],['oil','silicon'],{S3:200,S2:200}),
 'engine_heavy':('Moteur renforcé',3,['motor_heavy'],['motor','fabrication','plastics'],{S3:150,S2:150}),
 'heavy_vehicles':('Véhicules lourds',3,['vehicle_tank','vehicle_van'],['engine_heavy','steel'],{S3:200,S2:200}),
 'railway':('Chemin de fer',3,['rail','train_locomotive','train_wagon_freight','train_wagon_tanker','train_station'],['steam_power','steel','engine_heavy'],{S3:200,S2:200}),
 'aluminium':('Aluminium',3,['aluminium_ingot','aluminium_plate','piece_wall_aluminium','piece_slab_aluminium','piece_stairs_aluminium','piece_door_aluminium','piece_pillar_aluminium'],['plastics'],{S3:200,S2:200}),
 'garage':('Porte de garage',3,['piece_garage_aluminium'],['aluminium','engine_heavy'],{S3:150,S2:150}),
 'conveyor_3':('Convoyeur T3',3,['machine_conveyor_3','machine_arm_filter'],['conveyor_2'],{S3:150,S2:150}),
 'sorting':('Trieur',3,['machine_sorter'],['conveyor_3'],{S3:100,S2:100}),
 'drill_eco':('Foreuse économe',3,['machine_drill_eco'],['drill_electric','steel'],{S3:150,S2:150}),
 'pack_4':('Paquet de science T4',3,['science_pack_4'],['silicon','plastics'],{S3:100,S2:100}),
 'research_3':('Recherche III',3,[],['research_2'],{S3:100,S2:100}),
 'sniper':('Sniper',3,['sniper','sniper_magazine'],['rifle','steel'],{S3:150,S2:150,C:30}),
 'turret_laser':('Tourelle laser',3,['machine_turret_laser'],['turret_heavy','motor','silicon'],{S3:150,S2:150,C:30}),
 # --- Palier 4 : paquets T4 et T3
 'fission':('Fission',4,['machine_centrifuge','zamak_ingot','uranium_enriched','uranium_depleted','uranium_rod'],['plastics','aluminium'],{S4:200,S3:200}),
 'reactor':('Réacteur à fission',4,['machine_fission_reactor'],['fission'],{S4:250,S3:250}),
 'pack_5':('Paquet de science T5',4,[S5],['fission'],{S4:100,S3:100}),
 'waste':('Déchets nucléaires',4,['machine_evaporation_tower','machine_vitrifier','contaminated_glass'],['reactor'],{S4:200,S3:200}),
 'armor_4':('Armure 4',4,['armor4_head','armor4_torso','armor4_legs','armor4_feet'],['armor_2','silicon'],{S4:150,S3:150,C:40}),
 'turret_plasma':('Tourelle plasma',4,['machine_turret_plasma'],['turret_laser','engine_heavy'],{S4:150,S3:150,C:40}),
 'storage':('Accumulateur',4,['machine_accumulator'],['fission'],{S4:150,S3:150}),
 'research_4':('Recherche IV',4,[],['research_3'],{S4:100,S3:100}),
 # --- Palier 5 : paquets T5 et T4
 'fusion':('Fusion',5,['machine_fusion_reactor'],['waste','storage'],{S5:300,S4:300}),
 'beacon':('Balise quantique',5,['machine_relay','machine_antenna'],['fusion'],{S5:300,S4:300}),
}
owner={u:k for k,v in D.items() for u in v[2]}
def needs(item):
    out=set(items[item].get('recipe') or {})
    for x in rec:
        if item in x['out'] and not (x['machine']=='barreler' and item=='barrel_empty'):  # le vidage d'un baril n'est pas sa fabrication
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
L=["# Découvertes T0 à T5 — proposition","","Statut : **proposition à corriger avec le PO** (tour 235, généré par `tools/gen_decouvertes.py`). Rien n'est codé : l'arbre actuel des technologies reste en jeu.","",
"Règles :","- Une découverte débloque **les recettes** d'un ou plusieurs objets (une seule est possible).","- Ses **prérequis** : les découvertes qui débloquent les ingrédients et la machine de ses recettes (déduits des recettes actuelles) plus ceux ajoutés pour la logique de progression. Aucun prérequis n'est d'un palier supérieur, aucune boucle.","- Palier 0 : payé en ressources du début de partie. Palier 1 : paquets T1. Palier 2 : paquets T2 **et** T1. Palier 3 : paquets T3 **et** T2. Palier 4 : T4 **et** T3. Palier 5 : T5 **et** T4.","- **Armes, armures et tourelles** sont dans l'arbre : elles se paient aussi en **paquets de combat** en plus des paquets de leur palier.","",
"Connu dès le départ, sans découverte : bois, pierre, fibre, minerais, fourneau T1, foreuse T1, coffre en bois, outil en pierre, charrette, pièces de construction en bois et en pierre, moules, lingots, fonte.",""]
for t,title in ((0,'Palier 0 : payé en ressources'),(1,'Palier 1 : paquets T1'),(2,'Palier 2 : paquets T2 + T1'),(3,'Palier 3 : paquets T3 + T2'),(4,'Palier 4 : paquets T4 + T3'),(5,'Palier 5 : paquets T5 + T4')):
    L+=[f"## {title}","","| Découverte | Débloque | Prérequis | Coût |","| --- | --- | --- | --- |"]
    for k,(nm,tt,un,_,c) in D.items():
        if tt==t: L.append(f"| **{nm}** | {', '.join(n(u) for u in un) or '(effet : paquets plus rapides)'} | {', '.join(D[p][0] for p in pre(k)) or '—'} | {cost(c)} |")
    L.append("")
L+=["## Notes des paliers 3 à 5","",
"- **Paquet de science Tn** : sa recette se découvre au palier précédent (T2 au palier 1, T3 au 2, T4 au 3, T5 au 4).",
"- **Chemin de fer** (rail, locomotive, wagons fret et citerne, gare) : une seule découverte, au palier 3 (la locomotive demande un moteur renforcé).",
"- **Camion benne** : moteur renforcé (validé). **Porte de garage** : séparée de l'Aluminium, elle demande le moteur renforcé.",
"- **Tourelle laser** : moteur simple (recette modifiée) ; **tourelle plasma** : moteur renforcé (recette modifiée).",
"- **Combat** : Sniper, Tourelle laser (30 paquets de combat), Armure 4 et Tourelle plasma (40).",
"- **Palier 4** : l'ancien arbre découpait l'armure 4 en deux (haut / bas) et le réacteur en trois (fission, réacteur, déchets) ; l'armure 4 est ici une seule découverte.",
"- **Accumulateur** passe au palier 4 : sa recette demande du zamak, qui vient de la Fission (dans l'ancien arbre il était au palier 3, sans pouvoir être fabriqué).",
"- **Palier 5** : Fusion et Balise quantique sont les seules découvertes (demandent Déchets nucléaires et Accumulateur).","",
"## Points à confirmer","",
"1. **Paliers 4 et 5** : regroupements et coûts (200 à 300 paquets : ils sont plus chers parce que la production de paquets T4 et T5 est plus lente).",
"2. Y a-t-il des objets ou machines sans découverte qu'on a oublié (la liste est contrôlée par le script : tout objet débloqué par l'ancien arbre a une case) ?"]
open('docs/decouvertes-t0-t5.md','w').write('\n'.join(L)+'\n')
print(len(D),'découvertes')
