# Monc's Show

Programa de auditório de baixo orçamento em forma de jogo: tabuleiro + quiz para até 8 jogadores. A TV (notebook) mostra o show e cada pessoa joga pelo celular. O apresentador é o **Monc** (com o corvo **Alphie** no ombro), a moeda é o **Moncoin** e quem tiver mais **Moncrofones de Ouro** vence.

## Regras principais

- 10 Moncoins para começar, banco com 5. O Moncrofone custa 20.
- 30 s para cada decisão (rolar, caminho, Moncrofone, loja, duelo), com contagem regressiva nos 10 s finais. Esgotou, o jogo decide sozinho.
- Itens: no máximo 3 na mochila, **um por turno e só antes de rolar o dado**. Nada é usado durante o Monquiz.
- A partir do 2º turno, a ordem segue a classificação do último Monquiz.
- Reta final nos 3 últimos turnos (casas azuis/vermelhas valem o dobro). O Monquiz do último turno é a **Grande Final**: prêmios em dobro.
- 3 Moncrofones bônus sorteados por partida, entre 12 critérios.
- **16 itens em 4 níveis** (baixo 5, médio 7, arriscado 8, alto 12). Loja com 8 itens sorteados e uma compra por visita.
- Casas: Roleta (8 resultados), **Diretor** (10 efeitos absurdos), Duelo (aposta em Moncoins ou Moncrofones), Ladrão (40 Moncoins, passa pelo Escudo), Presente, Loja, Banco e as casas exclusivas de cada mapa.
- **Monquiz**: 11 dinâmicas (Velocidade, Quem Sabe Mais, Tema Fixo, Eliminação, Chute Numérico, Escolha do Competidor, Banca do Apresentador, V ou F Relâmpago, Mais ou Menos, Batata Quente, Contra o Relógio). O anfitrião escolhe no lobby quais ficam ativas (mínimo 3), e a próxima é anunciada logo que a anterior termina.
- As alternativas só aparecem no celular, depois do tempo de leitura (2 s + 0,25 s por palavra, até 7 s). "Continuar" só pula quando todos apertam.
- Todos ganham Moncoins e um item pela colocação no Monquiz (o último leva um item arriscado).
- **Modo 10+** no lobby: tira perguntas impróprias para crianças.

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
py build.py https://SEU-PROJETO.supabase.co SUA_ANON_KEY
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
py -m http.server 8765
py test.py          # modo TV + celular
py test_online.py   # modo online (anfitrião + 2 convidados)
```
