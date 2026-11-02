# Monc's Show

Jogo de tabuleiro + quiz para até 8 jogadores. A TV (notebook) mostra o show e cada pessoa joga pelo celular.

## Arquivos

- `index.html`: o jogo pronto, em arquivo único. É ele que vai para a hospedagem.
- `game.js`: lógica da TV (estado, tabuleiro, quiz, itens) e do celular (controle).
- `game.css`: visual da TV e do celular.
- `questions.js`: banco de perguntas original (7 temas × fácil/médio/difícil) e perguntas de chute numérico.
- `questions_more.js`: expansão do banco (cerca de 770 perguntas no total e 76 de chute numérico).
- `template.html`: esqueleto HTML que recebe o CSS e o JS no build.
- `build.py`: junta tudo em `index.html` e insere URL e chave do Supabase.
- `online.js`: modo online (espelhamento da tela do anfitrião e telas de entrada).
- `test.py`: simula uma partida completa com 3 celulares (Playwright).

## Build

```
python build.py https://SEU-PROJETO.supabase.co SUA_ANON_KEY
```

## Mapas

- 🌳 **Floresta**, ❄️ **Picos Gelados** e 🌋 **Ilha Vulcânica**, escolhidos no lobby. Ficam no objeto `MAPS` do `game.js`: junções (bifurcações), trechos com os tipos de casa e o tema visual.

## Modo online (cada um no seu computador)

- Tela inicial → **💻 Jogar online**. Um jogador cria a sala (é o **anfitrião**) e manda o link para os outros.
- `index.html?online` abre a entrada do modo online, `?online&host` abre o anfitrião e `?online&sala=ABCD` abre um convidado.
- O anfitrião roda o jogo (como a TV) e também joga. As partes da tela que mudam vão para os convidados como HTML, e cada computador aplica só a diferença. Sons, voz e animações vão como eventos, agrupados na mesma mensagem.
- Cada computador mostra o tabuleiro à esquerda e o painel de controles (o mesmo do celular) à direita.
- O tempo de resposta do quiz é medido no computador de cada jogador, para não penalizar quem tem internet mais lenta.
- O código fica em `online.js`. O modo TV + celular continua igual.

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
