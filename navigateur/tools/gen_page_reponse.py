"""Génère une « page réponse » (tableau de propositions + colonne de réponse) depuis un fichier JSON de propositions.

Usage, depuis `navigateur/` : python3 tools/gen_page_reponse.py docs/propositions/palier4-5.json
Écrit le HTML à côté du JSON. Format du JSON : {key, title, intro, tabs:[{id,label}], rows:[{id,tab,name,recipe,role,effort}]}.
`effort` : « objet » (simple objet avec recette) ou « mécanique » (demande de nouveaux systèmes).
"""
import sys, json
src=sys.argv[1]
data=json.load(open(src))
page=open('tools/reponse_page.html').read().replace('@DATA@',json.dumps(data,ensure_ascii=False))
out=src.replace('.json','.html')
open(out,'w').write(page)
print(out,len(data['rows']),'lignes',len(page)//1024,'Ko')
