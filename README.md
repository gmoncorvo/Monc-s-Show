# Monc's Show

Jogo de tabuleiro + quiz para até 8 jogadores. A TV (notebook) mostra o show e cada pessoa joga pelo celular.

## Arquivos

- `index.html`: o jogo pronto, em arquivo único. É ele que vai para a hospedagem.
- `game.js`: lógica da TV (estado, tabuleiro, quiz, itens) e do celular (controle).
- `game.css`: visual da TV e do celular.
- `questions.js`: banco de perguntas (7 temas × fácil/médio/difícil) e perguntas de chute numérico.
- `template.html`: esqueleto HTML que recebe o CSS e o JS no build.
- `build.py`: junta tudo em `index.html` e insere URL e chave do Supabase.
- `test.py`: simula uma partida completa com 3 celulares (Playwright).

## Build

```
python build.py https://SEU-PROJETO.supabase.co SUA_ANON_KEY
```

## Como funciona

- `index.html?tv`: abre a TV (cria a sala, mostra o QR code).
- `index.html?sala=ABCD`: abre o controle do celular.
- O multiplayer usa Supabase Realtime (broadcast) no canal `qp-<SALA>`. Nenhuma tabela é usada.
- A TV é a autoridade: guarda o estado do jogo, sorteia os dados e manda para cada celular só a tela que ele deve mostrar.

## Parâmetros de teste

- `&local`: troca o Supabase por BroadcastChannel (abas do mesmo navegador).
- `&fast`: acelera todos os tempos.
- `&p=N`: separa o armazenamento de vários "celulares" no mesmo navegador.

Para rodar o teste:

```
python -m http.server 8765
python test.py
```
