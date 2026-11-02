import sys,re
url,key = (sys.argv[1], sys.argv[2]) if len(sys.argv)>2 else ('','')
t=open('template.html').read()
g=open('game.js').read().replace('__SUPA_URL__',url).replace('__SUPA_KEY__',key)
t=t.replace('/*CSS*/',open('game.css').read()).replace('/*QUESTIONS*/',open('questions.js').read()).replace('/*QUESTIONS_MORE*/',open('questions_more.js').read()).replace('/*GAME*/',g)
open('index.html','w').write(t)
print(len(t))
