"""Génère docs/decouvertes-t0-t5.md : la proposition d'arbre de découvertes (palier 0 à 2) à partir de `D` ci-dessous.

Les prérequis affichés = ceux choisis dans `D` + ceux déduits des recettes (ingrédients et machine de chaque objet
débloqué, s'ils sont débloqués par une autre découverte). Contrôle : aucun prérequis de palier supérieur, pas de boucle.
Lancer depuis `navigateur/` : python3 tools/gen_decouvertes.py
"""
import json, sys
JEU='--jeu' in sys.argv   # mode « jeu » : seulement les objets qui existent dans content/ (pas les intermédiaires proposés)
fr=json.load(open('src/i18n/fr.json'))
items={i['id']:i for i in json.load(open('content/items.json'))['items']}
rec=json.load(open('content/recipes.json'))['recipes']
# --- Propositions non implémentées : produits intermédiaires (règle : 3 types d'ingrédients au plus, 4 pour les recettes avancées)
PROPOSED_NAMES={'kit_circuit':'Kit circuit','chassis_simple':'Châssis simple','glass':'Vitre','chassis_steel':'Châssis renforcé','aluminium_rod':'Tige d\'aluminium','chassis_alu':'Châssis léger','circuit_advanced':'Circuit avancé','microcontroller':'Microcontrôleur',
 'machine_pole_hv':'Poteau haute tension','machine_pole_uhv':'Poteau très haute tension','machine_transformer':'Transformateur','machine_breaker':'Disjoncteur','machine_lamp':'Lampadaire électrique',
 'machine_wind_turbine':'Éolienne','machine_thermometer':'Thermomètre','machine_vane':'Girouette','solar_cell':'Cellule photovoltaïque','machine_solar_panel':'Panneau solaire','machine_accumulator_basic':'Accumulateur','graphite':'Graphite','lithium_salt':'Sel de lithium',
 'battery_lithium':'Batterie lithium','machine_charger':'Borne de recharge','vehicle_quad_electric':'Quad électrique'}
PROPOSED_HAND={'kit_circuit':{'copper_plate':1,'copper_wire':4},'chassis_simple':{'iron_plate':2,'iron_rod':1},'chassis_steel':{'steel_plate':2,'steel_rod':1},
 'chassis_alu':{'aluminium_plate':2,'aluminium_rod':1},'circuit_advanced':{'kit_circuit':1,'silicon_chip':1},'microcontroller':{'plastic_insulator':1,'silicon_chip':1,'kit_circuit':1},
 'machine_pole_hv':{'chassis_steel':1,'glass':4,'kit_circuit':1},'machine_pole_uhv':{'chassis_alu':2,'plastic_insulator':4,'microcontroller':1},
 'machine_transformer':{'chassis_steel':2,'copper_wire':24,'glass':4},'machine_breaker':{'chassis_steel':1,'kit_circuit':1,'glass':1},
 'repair_kit':{'iron_plate':4,'copper_wire':4,'iron_gear':1},'machine_lamp':{'chassis_simple':1,'glass':2,'kit_circuit':1},'machine_thermometer':{'glass':1,'copper_wire':2,'iron_plate':1},'machine_vane':{'iron_rod':3,'iron_gear':1},'machine_wind_turbine':{'chassis_steel':2,'motor':2,'kit_circuit':1},
 'solar_cell':{'silicon_raw':1,'glass':1,'copper_wire':2},'machine_solar_panel':{'solar_cell':4,'chassis_alu':1,'glass':1},
 'machine_accumulator_basic':{'chassis_steel':1,'plastic_insulator':2,'microcontroller':1},'battery_lithium':{'lithium_salt':1,'graphite':1,'plastic_insulator':1},
 'machine_charger':{'chassis_steel':1,'microcontroller':1,'plastic_insulator':2},'vehicle_quad_electric':{'chassis_alu':1,'motor':1,'battery_lithium':2}}
PROPOSED_MACHINE=[{'id':'glass','machine':'furnace','in':{'silica_sand':1},'out':{'glass':1},'seconds':2},{'id':'aluminium_rod','machine':'stamper','in':{'aluminium_ingot':1},'out':{'aluminium_rod':2},'seconds':3},
 {'id':'graphite','machine':'furnace_electric','in':{'coal':2},'out':{'graphite':2},'seconds':4,'fluid':{'kind':'polymère','amount':-10}},
 {'id':'lithium_salt','machine':'evaporation_tower','in':{},'out':{'lithium_salt':1},'seconds':10,'fluid':{'kind':'eau','amount':-500}}]
PROPOSED_RECIPE_CHANGES={'machine_lab':{'kit_circuit':3,'chassis_simple':3,'glass':4},'machine_accumulator':{'chassis_steel':2,'battery_lithium':4,'microcontroller':1}}   # le laboratoire : 2 ingrédients + des vitres
# --- Réponses du PO (page réponse paliers 4 et 5) : propositions retenues
PROPOSED_NAMES.update({'train_locomotive_electric':'Locomotive électrique','carbon_fiber':'Fibre de carbone','chassis_composite':'Châssis composite','machine_electrolyzer':'Électrolyseur','machine_fuel_cell':'Pile à combustible',
 'graphite_filter':'Filtre en graphite','machine_air_purifier':'Purificateur d\'air','machine_drill_plasma':'Foreuse à plasma','machine_arm_industrial':'Bras industriel',
 'armor3_head':'Casque composite','armor3_torso':'Plastron composite','armor3_legs':'Jambières composites','armor3_feet':'Bottes composites','machine_hologram_projector':'Projecteur de mur holographique',
 'piece_fence_wood':'Clôture en bois','piece_barrier_concrete':'Barrière en béton','piece_barrier_reinforced':'Barrière en béton armé','exoskeleton':'Exosquelette','jetpack':'Propulseur dorsal',
 'armored_glass':'Vitre blindée','piece_wall_armored':'Mur blindé','piece_door_armored':'Porte blindée','train_wagon_flat':'Wagon plateforme',
 'deuterium':'Deutérium','tritium':'Tritium','fusion_capsule':'Capsule de fusion','liquid_nitrogen':'Azote liquide','machine_air_compressor':'Compresseur d\'air','supra_magnet':'Aimant supraconducteur',
 'quantum_crystal':'Cristal quantique','machine_quantum_chest':'Coffre quantique','machine_fabricator':'Fabricateur universel','armor5_head':'Casque nano','armor5_torso':'Plastron nano','armor5_legs':'Jambières nano','armor5_feet':'Bottes nano','machine_turret_rail':'Tourelle à rail'})
PROPOSED_HAND.update({'train_locomotive_electric':{'motor_heavy':2,'battery_lithium':4,'microcontroller':1},'chassis_composite':{'carbon_fiber':2,'aluminium_rod':1},
 'machine_electrolyzer':{'chassis_steel':2,'microcontroller':1,'graphite':4},'machine_fuel_cell':{'chassis_composite':1,'graphite':4,'microcontroller':1},
 'graphite_filter':{'graphite':3,'plastic_insulator':1},'machine_air_purifier':{'graphite_filter':2,'chassis_steel':1,'microcontroller':1},
 'machine_drill_plasma':{'motor_heavy':2,'chassis_composite':1,'microcontroller':1},'machine_arm_industrial':{'chassis_composite':1,'motor_heavy':1,'circuit_advanced':1},
 'armor3_head':{'aluminium_plate':2,'cloth':3,'plastic_insulator':1},'armor3_torso':{'aluminium_plate':5,'cloth':6,'plastic_insulator':2},'armor3_legs':{'aluminium_plate':4,'cloth':5,'plastic_insulator':2},'armor3_feet':{'aluminium_plate':2,'cloth':3,'plastic_insulator':1},
 'machine_hologram_projector':{'microcontroller':1,'glass':4,'battery_lithium':1},'piece_fence_wood':{'wood':3,'fiber':1},'piece_barrier_concrete':{'concrete_block':4,'iron_rod':2},'piece_barrier_reinforced':{'concrete_block':4,'steel_rod':4},
 'exoskeleton':{'chassis_alu':2,'motor':2,'microcontroller':1},'jetpack':{'chassis_composite':1,'motor':1,'battery_lithium':1},
 'armored_glass':{'glass':2,'plastic_insulator':1},'piece_wall_armored':{'steel_plate':4,'concrete_block':4},'piece_door_armored':{'steel_plate':8,'motor':1,'armored_glass':2},
 'train_wagon_flat':{'chassis_steel':2,'steel_plate':6,'iron_gear':4},'fusion_capsule':{'deuterium':1,'tritium':1,'chassis_composite':1},
 'machine_air_compressor':{'chassis_steel':2,'motor_heavy':1,'microcontroller':1},'supra_magnet':{'copper_wire':8,'liquid_nitrogen':1,'microcontroller':1},
 'quantum_crystal':{'silicon_chip':2,'glass':2,'supra_magnet':1},'machine_quantum_chest':{'quantum_crystal':1,'microcontroller':1,'chassis_composite':1},
 'machine_fabricator':{'microcontroller':4,'supra_magnet':1,'chassis_composite':1},'armor5_head':{'carbon_fiber':3,'aluminium_plate':2,'microcontroller':1},'armor5_torso':{'carbon_fiber':6,'aluminium_plate':4,'microcontroller':1},
 'armor5_legs':{'carbon_fiber':5,'aluminium_plate':3,'microcontroller':1},'armor5_feet':{'carbon_fiber':3,'aluminium_plate':2,'microcontroller':1},'machine_turret_rail':{'supra_magnet':1,'chassis_composite':1,'battery_lithium':1}})
PROPOSED_MACHINE+=[{'id':'carbon_fiber','machine':'furnace_electric','in':{'graphite':2},'out':{'carbon_fiber':1},'seconds':6,'fluid':{'kind':'polymère','amount':-20}},
 {'id':'deuterium','machine':'centrifuge','in':{},'out':{'deuterium':1},'seconds':20,'fluid':{'kind':'eau','amount':-1000}},
 {'id':'tritium','machine':'fission_reactor','in':{'lithium_salt':2},'out':{'tritium':1},'seconds':30},
 {'id':'liquid_nitrogen','machine':'air_compressor','in':{},'out':{'liquid_nitrogen':1},'seconds':8,'fluid':{'kind':'air','amount':-200}}]
NEW_HAND={k:r for k,r in PROPOSED_HAND.items() if k not in items}   # ce qui est déjà dans content/ n'est plus une proposition
NEW_MACHINE=[r for r in PROPOSED_MACHINE if next(iter(r['out'])) not in items]
NEW_CHANGES={k:r for k,r in PROPOSED_RECIPE_CHANGES.items() if items[k].get('recipe')!=r}
if not JEU:
    for k,r in NEW_HAND.items(): items[k]={'id':k,'recipe':r,'category':'proposed'}
    for r in NEW_MACHINE: items[next(iter(r['out']))]={'id':next(iter(r['out'])),'recipe':{},'category':'proposed'}; rec.append(r)
    for k,r in NEW_CHANGES.items(): items[k]['recipe_old']=items[k].get('recipe'); items[k]['recipe']=r
PROPOSED=set() if JEU else set(NEW_HAND)|{next(iter(r['out'])) for r in NEW_MACHINE}|set(NEW_CHANGES)
n=lambda i: PROPOSED_NAMES.get(i) or fr.get('item.'+i,i)
# id: (nom, palier, [objets débloqués], [prérequis choisis], coût)
S1,S2,S3,S4,S5,C='science_pack','science_pack_2','science_pack_3','science_pack_4','science_pack_5','combat_pack'
def P(t,n,c=0):
    """Coût en paquets d'un palier t (T1 : paquets T1 seuls ; au-delà : Tt et T(t-1)), plus c paquets de combat."""
    pk={1:S1,2:S2,3:S3,4:S4,5:S5}
    out={pk[t]:n}
    if t>=2: out[pk[t-1]]=n
    if c: out[C]=c
    return out
# Chaque recette (ou petit groupe de recettes proche) est une découverte : le moule et son produit, la machine et ses variantes…
D={
 # --- Palier 0 : payé en ressources du début de partie
 'cast_iron':('Fonte',0,['cast_iron_ingot'],[],{'iron_ingot':10}),
 'stamper':('Estampeuse',0,['machine_stamper'],[],{'iron_ingot':10,'stone':10}),
 'mould_plate':('Moule de plaque',0,['mould_plate'],['cast_iron'],{'cast_iron_ingot':4}),
 'plates':('Plaques de fer et de cuivre',0,['iron_plate','copper_plate'],['stamper','mould_plate'],{'iron_ingot':10,'copper_ingot':10}),
 'mould_gear':('Moule d\'engrenage',0,['mould_gear'],['cast_iron'],{'cast_iron_ingot':6}),
 'gears':('Engrenage',0,['iron_gear'],['stamper','mould_gear'],{'iron_ingot':10}),
 'mould_wire':('Moule de fil',0,['mould_wire'],['cast_iron'],{'cast_iron_ingot':4}),
 'wires':('Fil de cuivre',0,['copper_wire'],['stamper','mould_wire'],{'copper_ingot':10}),
 'rods':('Tige de fer',0,['iron_rod'],['stamper'],{'iron_ingot':10}),
 'crusher':('Concasseur',0,['machine_crusher','crushed_stone','silica_sand'],[],{'iron_ingot':10,'stone':10}),
 'glass':('Vitre',0,['glass'],['crusher'],{'stone':10}),
 'kit_circuit':('Kit circuit',0,['kit_circuit'],['plates','wires'],{'copper_ingot':10}),
 'chassis_simple':('Châssis simple',0,['chassis_simple'],['plates','rods'],{'iron_ingot':10}),
 'electricity':('Électricité',0,['machine_pole'],[],{'iron_ingot':15,'copper_ingot':10}),
 'crank':('Manivelle de réamorçage',0,['machine_crank'],['electricity'],{'iron_ingot':10}),
 'laboratory':('Laboratoire',0,['machine_lab'],['electricity','pack_1'],{'iron_ingot':10,'copper_ingot':10}),
 'pack_1':('Paquet de science T1',0,[S1],[],{'stone':5,'fiber':5}),
 'iron_tool':('Outil en fer',0,['tool_iron'],[],{'iron_ingot':10}),
 'waterwheel':('Roue à aubes',0,['machine_waterwheel'],['wires'],{'copper_plate':10}),
 'pistol':('Pistolet',0,['pistol'],['plates','gears','rods'],{'iron_plate':10}),
 'magazine':('Chargeur de pistolet',0,['magazine'],['pistol'],{'iron_ingot':10}),
 'research_1':('Recherche I (paquets plus vite)',0,[],['laboratory'],{'iron_ingot':20,'copper_ingot':20}),
 # --- Palier 1 : paquets T1
 'conveyor':('Tapis roulant',1,['machine_conveyor'],[],P(1,50)),
 'arm':('Bras robotique',1,['machine_arm'],['conveyor'],P(1,100)),
 'splitter':('Séparateur',1,['machine_splitter'],['conveyor'],P(1,100)),
 'merger':('Groupeur',1,['machine_merger'],['conveyor'],P(1,100)),
 'chest_iron':('Coffre en fer',1,['machine_chest_iron'],[],P(1,50)),
 'waypoint':('Balise',1,['waypoint'],[],P(1,100)),
 'textile':('Textile',1,['cloth'],[],P(1,100)),
 'clothing':('Vêtements',1,['trousers','boots','gloves','hood','jacket'],['textile'],P(1,100)),
 'backpack':('Sac à dos',1,['backpack'],['textile'],P(1,100)),
 'bedding_1':('Couchage de survie',1,['sleeping_bag'],['textile'],P(1,100)),
 'navigation':('Navigation',1,['compass'],[],P(1,100)),
 'pipe':('Tuyau',1,['machine_pipe'],[],P(1,50)),
 'motor':('Moteur simple',1,['motor'],[],P(1,150)),
 'pump':('Pompe à eau',1,['machine_pump'],['pipe','motor'],P(1,100)),
 'buggy':('Buggy',1,['vehicle_buggy'],['motor'],P(1,100)),
 'quad':('Quad',1,['vehicle_quad'],['motor'],P(1,100)),
 'boiler':('Chaudière',1,['machine_boiler'],['pipe'],P(1,100)),
 'turbine':('Turbine à vapeur',1,['machine_turbine'],['boiler'],P(1,100)),
 'fence':('Clôtures et portails de bois',1,['machine_fence_wood','machine_gate_wood'],['rods','gears'],P(1,100)),
 'barrier':('Barrières et portails en béton',2,['machine_barrier_concrete','machine_gate_concrete'],['concrete','rods'],P(2,100)),
 'barrier_reinforced':('Béton armé et portail motorisé',3,['machine_barrier_reinforced','machine_gate_reinforced'],['barrier','steel_rod','motor'],P(3,150)),
 'repair':('Kit de réparation',1,['repair_kit'],['plates','wires','gears'],P(1,100)),
 'weather':('Station météo',1,['machine_thermometer','machine_vane'],['glass','electricity'],P(1,100)),
 'lamp':('Lampadaire électrique',1,['machine_lamp'],['electricity'],P(1,100)),
 'pack_2':('Paquet de science T2',1,[S2],['gears','wires'],P(1,100)),
 'armor_1':('Armure 1',1,['armor1_head','armor1_torso','armor1_legs','armor1_feet'],['pistol','clothing'],P(1,100,10)),
 'turret':('Tourelle',1,['machine_turret'],['conveyor','magazine'],P(1,100,10)),
 # --- Palier 2 : paquets T2 et T1
 'bessemer':('Convertisseur Bessemer',2,['machine_bessemer','steel_ingot','slag'],['pack_2'],P(2,100)),
 'steel_plate':('Plaque d\'acier',2,['steel_plate'],['bessemer'],P(2,100)),
 'steel_rod':('Tige d\'acier',2,['steel_rod'],['bessemer'],P(2,100)),
 'chassis_steel':('Châssis renforcé',2,['chassis_steel'],['steel_plate','steel_rod'],P(2,100)),
 'mixer':('Bétonnière',2,['machine_mixer','concrete_block'],['steel_plate'],P(2,100)),
 'concrete':('Constructions en béton',2,['piece_wall_concrete','piece_slab_concrete','piece_stairs_concrete','piece_pillar_concrete'],['mixer'],P(2,100)),
 'washer':('Station de lavage',2,['machine_washer'],['steel_plate'],P(2,100)),
 'washed_ores':('Minerais lavés',2,['iron_ore_washed','copper_ore_washed','zinc_ore_washed'],['washer'],P(2,100)),
 'zinc':('Lingot de zinc',2,['zinc_ingot'],['washed_ores'],P(2,100)),
 'builder':('Constructeur',2,['machine_builder'],['steel_plate'],P(2,150)),
 'pipe_2':('Tuyau de laiton',2,['machine_pipe_2'],['zinc'],P(2,100)),
 'booster':('Surpresseur',2,['machine_booster'],['pipe_2'],P(2,100)),
 'cooling':('Tour de refroidissement',2,['machine_cooling_tower'],['pipe_2'],P(2,100)),
 'conveyor_2':('Tapis rapide',2,['machine_conveyor_2'],['conveyor','bessemer'],P(2,100)),
 'arm_electric':('Bras robotique électrique',2,['machine_arm_electric'],['arm','steel_plate'],P(2,100)),
 'assembler':('Assembleur',2,['machine_assembler'],['arm_electric'],P(2,150)),
 'assembler_advanced':('Assembleur avancé',3,['machine_assembler_advanced'],['assembler'],P(3,150)),
 'generator':('Générateur à combustible',2,['machine_generator'],['electricity','turbine'],P(2,100)),
 'drill_electric':('Foreuse électrique',2,['machine_drill_electric'],['generator'],P(2,150)),
 'pole_hv':('Poteau haute tension',2,['machine_pole_hv'],['chassis_steel'],P(2,100)),
 'breaker':('Disjoncteur',2,['machine_breaker'],['pole_hv'],P(2,100)),
 'wind':('Éolienne',2,['machine_wind_turbine'],['motor','chassis_steel','kit_circuit'],P(2,150)),
 'bedding_2':('Couchage de confort',2,['bed'],['bedding_1'],P(2,100)),
 'research_2':('Recherche II',2,[],['research_1'],P(2,100)),
 'rifle':('Fusil',2,['rifle'],['pistol','steel_plate'],P(2,100,20)),
 'rifle_magazine':('Chargeur de fusil',2,['rifle_magazine'],['rifle'],P(2,100,10)),
 'armor_2':('Armure 2',2,['armor2_head','armor2_torso','armor2_legs','armor2_feet'],['armor_1','steel_plate'],P(2,150,20)),
 'turret_heavy':('Tourelle lourde',2,['machine_turret_heavy'],['turret','steel_plate'],P(2,150,20)),
 'pack_3':('Paquet de science T3',2,[S3],['steel_plate','pipe_2'],P(2,100)),
 # --- Palier 3 : paquets T3 et T2
 'heavy_press':('Presse lourde',3,['machine_heavy_press'],['builder','concrete'],P(3,150)),
 'pipe_3':('Tuyau T3',3,['machine_pipe_3'],['heavy_press'],P(3,100)),
 'electric_furnace':('Four électrique',3,['machine_furnace_electric'],['heavy_press'],P(3,100)),
 'silicon_raw':('Silicium brut',3,['silicon_raw'],['electric_furnace'],P(3,100)),
 'silicon_chip':('Puce de silicium',3,['silicon_chip'],['silicon_raw'],P(3,100)),
 'barreler':('Remplisseuse de barils',3,['machine_barreler','barrel_empty','barrel_water'],['pipe_2','booster'],P(3,100)),
 'pumpjack':('Chevalet de pompage',3,['machine_pumpjack'],['heavy_press'],P(3,150)),
 'barrel_oil':('Baril de pétrole',3,['barrel_oil'],['pumpjack'],P(3,100)),
 'refinery':('Raffinerie',3,['machine_refinery'],['pumpjack','concrete'],P(3,150)),
 'plastic_press':('Presse à plastique',3,['machine_plastic_press'],['refinery'],P(3,150)),
 'plastic':('Isolant plastique',3,['plastic_insulator'],['plastic_press'],P(3,100)),
 'circuit_advanced':('Circuit avancé',3,['circuit_advanced'],['kit_circuit','silicon_chip'],P(3,100)),
 'microcontroller':('Microcontrôleur',3,['microcontroller'],['plastic','silicon_chip','kit_circuit'],P(3,100)),
 'insulated_cable':('Câble isolé',3,['cable_insulated'],['plastic'],P(3,100)),
 'rubber':('Caoutchouc',3,['rubber'],['plastic_press'],P(3,100)),
 'engine_heavy':('Moteur renforcé',3,['motor_heavy'],['motor','builder','rubber'],P(3,150)),
 'tank':('Char',3,['vehicle_tank'],['engine_heavy','steel_plate'],P(3,150)),
 'van':('Camion benne',3,['vehicle_van'],['engine_heavy','steel_plate'],P(3,150)),
 'railway':('Chemin de fer',3,['rail','train_locomotive','train_wagon_freight','train_wagon_tanker','train_station'],['turbine','steel_plate','engine_heavy'],P(3,200)),
 'aluminium_ingot':('Lingot d\'aluminium',3,['aluminium_ingot'],[],P(3,150)),
 'aluminium_plate':('Plaque d\'aluminium',3,['aluminium_plate'],['aluminium_ingot'],P(3,100)),
 'aluminium_rod':('Tige d\'aluminium',3,['aluminium_rod'],['aluminium_ingot'],P(3,100)),
 'chassis_alu':('Châssis léger',3,['chassis_alu'],['aluminium_plate','aluminium_rod'],P(3,100)),
 'aluminium':('Constructions en aluminium',3,['piece_wall_aluminium','piece_slab_aluminium','piece_stairs_aluminium','piece_door_aluminium','piece_pillar_aluminium'],['aluminium_plate'],P(3,150)),
 'pole_uhv':('Poteau très haute tension',3,['machine_pole_uhv'],['pole_hv','chassis_alu','microcontroller'],P(3,150)),
 'transformer':('Transformateur',2,['machine_transformer'],['pole_hv'],P(2,100)),
 'accumulator_basic':('Accumulateur',3,['machine_accumulator_basic'],['chassis_steel','plastic','microcontroller'],P(3,150)),
 'solar_cell':('Cellule photovoltaïque',3,['solar_cell'],['silicon_raw'],P(3,100)),
 'solar_panel':('Panneau solaire',3,['machine_solar_panel'],['solar_cell','chassis_alu'],P(3,150)),
 'graphite':('Graphite',3,['graphite'],['refinery','electric_furnace'],P(3,100)),
 'armor_3':('Armure 3',3,['armor3_head','armor3_torso','armor3_legs','armor3_feet'],['armor_2','aluminium_plate','plastic'],P(3,150,30)),
 'exoskeleton':('Exosquelette',3,['exoskeleton'],['chassis_alu','motor','microcontroller'],P(3,150)),
 'garage':('Porte de garage',3,['piece_garage_aluminium'],['aluminium','engine_heavy'],P(3,150)),
 'conveyor_3':('Tapis T3',3,['machine_conveyor_3'],['conveyor_2'],P(3,150)),
 'arm_filter':('Bras filtrant',3,['machine_arm_filter'],['conveyor_3'],P(3,100)),
 'sorting':('Trieur',3,['machine_sorter'],['arm_filter'],P(3,100)),
 'drill_eco':('Foreuse économe',3,['machine_drill_eco'],['drill_electric','steel_plate'],P(3,150)),
 'pack_4':('Paquet de science T4',3,[S4],['silicon_chip','insulated_cable'],P(3,100)),
 'research_3':('Recherche III',3,[],['research_2'],P(3,100)),
 'sniper':('Sniper',3,['sniper'],['rifle','steel_plate'],P(3,150,30)),
 'sniper_magazine':('Chargeur de sniper',3,['sniper_magazine'],['sniper'],P(3,100,15)),
 'turret_laser':('Tourelle laser',3,['machine_turret_laser'],['turret_heavy','motor','silicon_chip'],P(3,150,30)),
 # --- Palier 4 : paquets T4 et T3
 'centrifuge':('Centrifugeuse',4,['machine_centrifuge'],['aluminium_plate','insulated_cable'],P(4,200)),
 'zamak':('Zamak',4,['zamak_ingot'],['aluminium_ingot','zinc'],P(4,150)),
 'uranium_enriched':('Uranium enrichi',4,['uranium_enriched'],['centrifuge'],P(4,200)),
 'uranium_depleted':('Uranium appauvri',4,['uranium_depleted'],['centrifuge'],P(4,100)),
 'uranium_rod':('Barre d\'uranium',4,['uranium_rod'],['uranium_enriched'],P(4,150)),
 'reactor':('Réacteur à fission',4,['machine_fission_reactor'],['uranium_rod'],P(4,250)),
 'pack_5':('Paquet de science T5',4,[S5],['uranium_depleted'],P(4,100)),
 'evaporation':('Tour d\'évaporation',4,['machine_evaporation_tower'],['reactor'],P(4,150)),
 'vitrifier':('Vitrificateur',4,['machine_vitrifier','contaminated_glass'],['reactor'],P(4,200)),
 'armor_4':('Armure 4',4,['armor4_head','armor4_torso','armor4_legs','armor4_feet'],['armor_3','silicon_chip'],P(4,150,40)),
 'turret_plasma':('Tourelle plasma',4,['machine_turret_plasma'],['turret_laser','engine_heavy'],P(4,150,40)),
 'lithium_salt':('Sel de lithium',4,['lithium_salt'],['evaporation'],P(4,150)),
 'battery':('Batterie lithium',4,['battery_lithium'],['lithium_salt','graphite'],P(4,150)),
 'battery_portable':('Batterie portable',4,['battery_portable'],['battery','chassis_composite'],P(4,100)),
 'charger':('Borne de recharge',4,['machine_charger'],['battery'],P(4,100)),
 'quad_electric':('Quad électrique',4,['vehicle_quad_electric'],['quad','battery','chassis_alu'],P(4,150)),
 'storage':('Accumulateur lithium',4,['machine_accumulator'],['battery','accumulator_basic'],P(4,150)),
 'loco_elec':('Locomotive électrique',4,['train_locomotive_electric'],['railway','battery','engine_heavy','microcontroller','charger'],P(4,200)),
 'carbon_fiber':('Fibre de carbone',4,['carbon_fiber'],['graphite','electric_furnace'],P(4,150)),
 'chassis_composite':('Châssis composite',4,['chassis_composite'],['carbon_fiber','aluminium_rod'],P(4,150)),
 'electrolyzer':('Électrolyseur',4,['machine_electrolyzer'],['graphite','chassis_steel','microcontroller'],P(4,200)),
 'fuel_cell':('Pile à combustible',4,['machine_fuel_cell'],['electrolyzer','chassis_composite'],P(4,200)),
 'graphite_filter':('Filtre en graphite',4,['graphite_filter'],['graphite','plastic'],P(4,100)),
 'air_purifier':('Purificateur d\'air',4,['machine_air_purifier'],['graphite_filter','chassis_steel','microcontroller'],P(4,150)),
 'drill_plasma':('Foreuse à plasma',4,['machine_drill_plasma'],['chassis_composite','engine_heavy','drill_eco'],P(4,200)),
 'arm_industrial':('Bras industriel',4,['machine_arm_industrial'],['chassis_composite','engine_heavy','circuit_advanced','arm_electric'],P(4,150)),
 'hologram':('Projecteur de mur holographique',4,['machine_hologram_projector','machine_hologram_gate'],['battery','microcontroller','glass'],P(4,150)),
 'jetpack':('Propulseur dorsal',4,['jetpack'],['chassis_composite','battery','motor'],P(4,150)),
 'armored_glass':('Vitre blindée',4,['armored_glass'],['glass','plastic'],P(4,100)),
 'armored_buildings':('Constructions blindées',4,['piece_wall_armored','piece_door_armored'],['armored_glass','steel_plate','concrete','engine_heavy'],P(4,150)),
 'flatcar':('Wagon plateforme',4,['train_wagon_flat'],['railway','chassis_steel'],P(4,100)),
 'research_4':('Recherche IV',4,[],['research_3'],P(4,100)),
 # --- Palier 5 : paquets T5 et T4
 'deuterium':('Deutérium',5,['deuterium'],['centrifuge'],P(5,200)),
 'tritium':('Tritium',5,['tritium'],['reactor','lithium_salt'],P(5,200)),
 'air_compressor':('Compresseur d\'air',5,['machine_air_compressor','liquid_nitrogen'],['chassis_steel','engine_heavy','microcontroller'],P(5,200)),
 'supra_magnet':('Aimant supraconducteur',5,['supra_magnet'],['air_compressor','wires','microcontroller'],P(5,250)),
 'fusion_capsule':('Capsule de fusion',5,['fusion_capsule'],['deuterium','tritium','chassis_composite'],P(5,250)),
 'quantum_crystal':('Cristal quantique',5,['quantum_crystal'],['silicon_chip','glass','supra_magnet'],P(5,250)),
 'quantum_chest':('Coffre quantique',5,['machine_quantum_chest'],['quantum_crystal','microcontroller','chassis_composite'],P(5,300)),
 'fabricator':('Fabricateur universel',5,['machine_fabricator'],['supra_magnet','microcontroller','chassis_composite','assembler'],P(5,300)),
 'armor_5':('Armure 5',5,['armor5_head','armor5_torso','armor5_legs','armor5_feet'],['armor_4','carbon_fiber','aluminium_plate','microcontroller'],P(5,250,60)),
 'rail_turret':('Tourelle à rail',5,['machine_turret_rail'],['supra_magnet','chassis_composite','battery','turret_plasma','flatcar'],P(5,300,60)),
 'fusion':('Fusion',5,['machine_fusion_reactor'],['vitrifier','storage'],P(5,300)),
 'beacon':('Balise quantique',5,['machine_relay','machine_antenna'],['fusion'],P(5,300)),
}
if JEU:
    for k,(nm,t,un,pre,cost) in list(D.items()): D[k]=(nm,t,[u for u in un if u in items],pre,cost)
    for k in [k for k,v in D.items() if not v[2] and not k.startswith('research_')]: del D[k]
    for k,(nm,t,un,pre,cost) in list(D.items()): D[k]=(nm,t,un,[x for x in pre if x in D],cost)
    D['storage']=('Accumulateur',)+D['storage'][1:]
owner={u:k for k,v in D.items() for u in v[2]}
PACK_DISCOVERY={S1:'pack_1',S2:'pack_2',S3:'pack_3',S4:'pack_4',S5:'pack_5'}
def needs(item):
    """Ce qu'il faut connaître pour fabriquer `item` par la voie la plus simple (recette à la main, sinon la première recette de machine)."""
    r=items[item].get('recipe')
    if r: return set(r)
    for x in rec:
        if item in x['out'] and not (x['machine']=='barreler' and item=='barrel_empty'):  # le vidage d'un baril n'est pas sa fabrication
            out=set(x.get('in',{})); out.add('machine_'+x['machine'])
            if x.get('mould'): out.add(x['mould'])
            return out
    return set()
START={'wood','stone','fiber','coal','iron_ore','copper_ore','zinc_ore','bauxite','crude_oil','uraninite','iron_ingot','copper_ingot','machine_drill','machine_furnace','machine_chest_wood','tool_stone','vehicle_cart','carapace','living_tissue','combat_pack','nuclear_waste','piece_wall_wood','piece_door_wood','piece_door_stone','piece_wall_stone','piece_stairs_wood','piece_stairs_stone','piece_slab_wood','piece_slab_stone','piece_pillar_wood','piece_pillar_stone'}
uncovered=[i for i in items if i not in owner and i not in START and not i.startswith('res_')]
if uncovered: print('sans découverte :',uncovered)
BASE={'carbon_fiber','liquid_nitrogen','deuterium','tritium','graphite','lithium_salt','cast_iron_ingot','mould_plate','mould_gear','mould_wire','iron_plate','copper_plate','iron_gear','copper_wire','iron_rod','crushed_stone','silica_sand','cloth','steel_ingot','slag','steel_plate','steel_rod','iron_ore_washed','copper_ore_washed','zinc_ore_washed','zinc_ingot','aluminium_ingot','aluminium_plate','aluminium_rod','zamak_ingot','silicon_raw','glass'}
INTER={'chassis_composite','graphite_filter','armored_glass','supra_magnet','quantum_crystal','fusion_capsule','solar_cell','battery_lithium','kit_circuit','chassis_simple','chassis_steel','chassis_alu','circuit_advanced','microcontroller','motor','motor_heavy','silicon_chip','plastic_insulator','cable_insulated','rubber','concrete_block','barrel_empty','barrel_water','barrel_oil','uranium_enriched','uranium_depleted','uranium_rod','contaminated_glass'}
def category(k):
    """machine > intermédiaire > base > autre (équipement, armes, véhicules, pièces de construction, paquets…)."""
    un=D[k][2]
    if any(u.startswith('machine_') or u=='waypoint' for u in un): return 'machine'
    if any(u in INTER for u in un): return 'inter'
    if any(u in BASE for u in un): return 'base'
    return 'autre'
CAT={k:category(k) for k in D}
bad_rule=[(k,len(items[k]['recipe'])) for k in PROPOSED if items[k].get('recipe') and len(items[k]['recipe'])>4]
if bad_rule: sys.exit(f'recette proposée à plus de 4 types : {bad_rule}')
derived={}
for k,(nm,t,un,pre,cost) in D.items():
    derived[k]={owner[need] for u in un for need in needs(u) if need in owner and owner[need]!=k}
    # payer en paquets Tk suppose de savoir les fabriquer : la découverte du paquet Tk est un prérequis
    for pack in cost:
        if pack in PACK_DISCOVERY and PACK_DISCOVERY[pack]!=k: derived[k].add(PACK_DISCOVERY[pack])
        if pack in PACK_DISCOVERY and k not in ('laboratory','pack_1'): derived[k].add('laboratory')   # étudier des paquets se fait au laboratoire
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
"Règles :","- Une découverte débloque **la recette** d'un objet ou d'un petit groupe d'objets proches. Le moule et son produit sont deux découvertes, comme la machine et ses variantes.","- Ses **prérequis** : les découvertes qui débloquent les ingrédients et la machine de ses recettes (déduits des recettes actuelles) plus ceux ajoutés pour la logique de progression. Aucun prérequis n'est d'un palier supérieur, aucune boucle.","- Palier 0 : payé en ressources du début de partie. Palier 1 : paquets T1. Palier 2 : paquets T2 **et** T1. Palier 3 : paquets T3 **et** T2. Palier 4 : T4 **et** T3. Palier 5 : T5 **et** T4.","- **Armes, armures et tourelles** sont dans l'arbre : elles se paient aussi en **paquets de combat** en plus des paquets de leur palier.","",
"Connu dès le départ, sans découverte : bois, pierre, fibre, minerais, charbon, lingots de fer et de cuivre, fourneau T1, foreuse T1, coffre en bois, outil en pierre, charrette, pièces de construction en bois et en pierre, butin des créatures.",""]
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
"## Énergie : règles proposées (pas encore dans le jeu)","",
"- **Trois poteaux** : bois (3 prises, 8 m, 500 kW), haute tension (4 prises, 20 m, 10 MW), très haute tension (5 prises, 40 m, 600 MW). Valeurs de départ à ajuster.",
"- **Prises** : un câble entre deux poteaux prend une prise à chaque bout ; **chaque machine raccordée prend aussi une prise** (validé). Un poteau en bois alimente donc 3 machines au plus, ou 2 machines et un câble vers le poteau suivant.",
"- **Réseau mixte** (validé) : un même réseau peut mélanger les trois poteaux ; chacun a son rôle (bois : distribution locale, haute tension : lignes moyennes, très haute tension : longues lignes et grosses centrales). Une surcharge ralentit les machines au lieu de détruire quoi que ce soit.",
"- **Transformateur** : relie un poteau très haute tension à un poteau d'un niveau inférieur, avec sa propre limite de puissance.",
"- **Compteur** (au clic sur un poteau) : graphique de production par machine productrice, graphique de consommation par machine ; un clic sur une machine de la liste en détaille la consommation. Pas d'objet à fabriquer.",
"- **Disjoncteur** : coupe un réseau en surcharge, se réarme avec la touche d'activation ; il prend deux prises. **Lampadaire électrique** : consomme peu, éclaire la nuit. **Quad électrique** : roule avec des batteries lithium, rechargées à la borne de recharge.",
"- **Éolienne** (palier 2, 2 moteurs) : puissance variable selon le vent. **Panneau solaire** (palier 3) : suit le jour et la nuit, d'où le besoin d'accumulateurs ; l'**accumulateur** passe au palier 3 (sans zamak) et la version à batteries lithium au palier 4.","",
"## Points à confirmer","",
"0. **Règle des recettes** (validée) : 3 types d'ingrédients au plus, 4 pour les recettes avancées. Les intermédiaires proposés (Kit circuit, Châssis simple/renforcé/léger, Vitre, Circuit avancé, Microcontrôleur) sont dans l'arbre mais **pas dans le jeu** ; seule la recette du laboratoire est montrée avec sa version proposée (3 kits circuit + 3 châssis simples + 4 vitres).",
"1. **Paliers 4 et 5** : regroupements et coûts (200 à 300 paquets : ils sont plus chers parce que la production de paquets T4 et T5 est plus lente).",
"2. Y a-t-il des objets ou machines sans découverte qu'on a oublié (la liste est contrôlée par le script : tout objet débloqué par l'ancien arbre a une case) ?"]
open('docs/decouvertes-t0-t5.md' if not JEU else '/dev/null','w').write('\n'.join(L)+'\n')
print(len(D),'découvertes')

# ---------------------------------------------------------------------------------------------------------------------
# Mode jeu : écrit content/techs.json (les découvertes, au format des technologies) et les textes fr/en.
EN={'cast_iron':'Cast iron','stamper':'Stamper','mould_plate':'Plate mould','plates':'Iron and copper plates','mould_gear':'Gear mould','gears':'Gear','mould_wire':'Wire mould','wires':'Copper wire','rods':'Iron rod','crusher':'Crusher','electricity':'Electricity','crank':'Priming crank','laboratory':'Laboratory','pack_1':'Science pack T1','iron_tool':'Iron tool','waterwheel':'Water wheel','pistol':'Pistol','magazine':'Pistol magazine','research_1':'Research I (faster packs)','conveyor':'Conveyor belt','arm':'Robotic arm','splitter':'Splitter','merger':'Merger','chest_iron':'Iron chest','waypoint':'Waypoint','textile':'Textile','clothing':'Clothing','backpack':'Backpack','bedding_1':'Survival bedding','navigation':'Navigation','pipe':'Pipe','motor':'Simple motor','pump':'Water pump','buggy':'Buggy','quad':'Quad','boiler':'Boiler','turbine':'Steam turbine','pack_2':'Science pack T2','armor_1':'Armor 1','turret':'Turret','bessemer':'Bessemer converter','steel_plate':'Steel plate','steel_rod':'Steel rod','mixer':'Concrete mixer','concrete':'Concrete buildings','washer':'Washing station','washed_ores':'Washed ores','zinc':'Zinc ingot','builder':'Builder','pipe_2':'Brass pipe','booster':'Booster pump','cooling':'Cooling tower','conveyor_2':'Fast conveyor','arm_electric':'Electric robotic arm','assembler':'Assembler','generator':'Fuel generator','drill_electric':'Electric drill','bedding_2':'Comfort bedding','research_2':'Research II','rifle':'Rifle','rifle_magazine':'Rifle magazine','armor_2':'Armor 2','turret_heavy':'Heavy turret','pack_3':'Science pack T3','heavy_press':'Heavy press','pipe_3':'T3 pipe','electric_furnace':'Electric furnace','silicon_raw':'Raw silicon','silicon_chip':'Silicon chip','barreler':'Barrel filler','pumpjack':'Pumpjack','barrel_oil':'Oil barrel','refinery':'Refinery','plastic_press':'Plastic press','plastic':'Plastic insulator','insulated_cable':'Insulated cable','rubber':'Rubber','engine_heavy':'Reinforced motor','tank':'Tank','van':'Dump truck','railway':'Railway','aluminium_ingot':'Aluminium ingot','aluminium_plate':'Aluminium plate','aluminium':'Aluminium buildings','garage':'Garage door','conveyor_3':'T3 conveyor','arm_filter':'Filter arm','sorting':'Sorter','drill_eco':'Eco drill','pack_4':'Science pack T4','research_3':'Research III','sniper':'Sniper','sniper_magazine':'Sniper magazine','turret_laser':'Laser turret','centrifuge':'Centrifuge','zamak':'Zamak','uranium_enriched':'Enriched uranium','uranium_depleted':'Depleted uranium','uranium_rod':'Uranium rod','reactor':'Fission reactor','pack_5':'Science pack T5','evaporation':'Evaporation tower','vitrifier':'Vitrifier','armor_4':'Armor 4','turret_plasma':'Plasma turret','storage':'Accumulator','research_4':'Research IV','fusion':'Fusion','beacon':'Quantum beacon'}
EN.update({'assembler_advanced':'Advanced assembler','jetpack':'Jetpack','glass':'Glass pane','kit_circuit':'Circuit kit','chassis_simple':'Simple frame','chassis_steel':'Reinforced frame','circuit_advanced':'Advanced circuit','microcontroller':'Microcontroller','aluminium_rod':'Aluminium rod','chassis_alu':'Light frame','solar_cell':'Solar cell','graphite':'Graphite','lithium_salt':'Lithium salt','battery':'Lithium battery','carbon_fiber':'Carbon fibre','chassis_composite':'Composite frame','graphite_filter':'Graphite filter','armored_glass':'Armoured glass','deuterium':'Deuterium','tritium':'Tritium','air_compressor':'Air compressor','supra_magnet':'Superconducting magnet','fusion_capsule':'Fusion capsule','quantum_crystal':'Quantum crystal'})
EN.update({'armored_buildings':'Armoured buildings','armor_3':'Armor 3','armor_5':'Armor 5','exoskeleton':'Exoskeleton'})
EN.update({'weather':'Weather station','machine_thermometer':'Thermometer','machine_vane':'Wind vane','electrolyzer':'Electrolyzer','fuel_cell':'Fuel cell','air_purifier':'Air purifier','drill_plasma':'Plasma drill','arm_industrial':'Industrial arm','hologram':'Holographic wall projector','air_compressor':'Air compressor','quantum_chest':'Quantum chest','fabricator':'Universal fabricator','rail_turret':'Rail turret','loco_elec':'Electric locomotive','flatcar':'Flat wagon','battery_portable':'Portable battery','charger':'Charging station','quad_electric':'Electric quad','fence':'Wooden fences and gates','barrier':'Concrete barriers and gates','barrier_reinforced':'Reinforced concrete and motor gate','repair':'Repair kit','wind':'Wind turbine','solar_cell':'Photovoltaic cell','solar_panel':'Solar panel','accumulator_basic':'Accumulator','breaker':'Circuit breaker','lamp':'Electric lamp post','pole_hv':'High-voltage pole','pole_uhv':'Ultra-high-voltage pole','transformer':'Transformer'})
if JEU:
    import re
    def direct_of(k):
        dd=deps(k); anc=lambda x: set().union(*([deps(y)|anc(y) for y in deps(x)] or [set()]))
        return [d for d in sorted(dd,key=order.index) if not any(d in anc(o) for o in dd if o!=d)]
    techs=[]
    for k,(nm,t,un,pre,cost) in D.items():
        e={'id':k,'tier':t,'cost':cost,'requires':direct_of(k),'unlocks':un}
        techs.append(e)
    # une ligne par champ court : lisible dans Git
    def fmt(e): return '    '+json.dumps(e,ensure_ascii=False)
    out='{\n  "_comment": "Découvertes (ex-technologies), générées par tools/gen_decouvertes.py --jeu : une case de l\'arbre débloque la fabrication d\'un objet ou d\'un petit groupe d\'objets. « tier » : palier 0 (payé en ressources) à 5 ; un palier n coûte des paquets Tn et T(n-1). Les découvertes de palier 2 et plus sont cachées tant que leurs prérequis ne sont pas connus ; en mode Créatif tout est visible. Un objet qui n\'est dans aucune découverte est disponible dès le départ.",\n  "techs": [\n'+',\n'.join(fmt(e) for e in techs)+'\n  ]\n}\n'
    open('content/techs.json','w').write(out)
    old_ids=[t['id'] for t in json.load(open('content/techs_legacy.json'))['techs']]
    for lang in ('fr','en'):
        path=f'src/i18n/{lang}.json'
        txt=open(path).read()
        for oid in set(old_ids)|set(D): txt=re.sub(rf'^  "tech\.{re.escape(oid)}": "[^"]*",\n','',txt,flags=re.M)
        lines=''.join(f'  "tech.{k}": {json.dumps(D[k][0] if lang=="fr" else EN[k],ensure_ascii=False)},\n' for k in D)
        txt=re.sub(r'^(  "tech\.title": )"[^"]*",\n',lambda m: m.group(1)+('"Découvertes"' if lang=='fr' else '"Discoveries"')+',\n'+lines,txt,count=1,flags=re.M)
        open(path,'w').write(txt)
    print('techs.json et textes écrits :',len(techs))
