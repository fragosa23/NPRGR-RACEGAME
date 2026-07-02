# NPRGR RACEGAME · Circunvalação

Jogo de corrida 3D no browser, inspirado no visual e na física do
[racing-game-cljs](https://ertugrulcetin.github.io/racing-game-cljs)
(por sua vez baseado no [pmndrs/racing-game](https://github.com/pmndrs/racing-game)),
mas passado no Porto, na **Estrada da Circunvalação**.

## Percurso (contrarrelógio, 9 checkpoints)

1. Partida no parque de estacionamento da fábrica **Monteiro Ribas**
2. Circunvalação para poente (2 faixas por sentido, separador central)
3. Volta completa à **Rotunda da AEP**
4. Regresso para nascente, passagem pela fábrica
5. **Cruzamento do Amial** — inversão de marcha
6. Meta de volta ao parque da fábrica

## Como jogar

É preciso um servidor estático (por causa dos módulos ES e dos modelos):

```bash
npx serve            # ou: python3 -m http.server 8000
```

e abrir `http://localhost:8000` no browser. Funciona também no GitHub Pages
sem qualquer build — todas as dependências estão incluídas no repositório.

### Controlos

| Tecla | Ação |
| --- | --- |
| ↑ / W | Acelerar |
| ↓ / S | Travar / marcha-atrás |
| ← → / A D | Direção |
| ESPAÇO | Travão de mão |
| R | Repor no último checkpoint |
| ENTER | Começar / correr outra vez |

Em ecrãs táteis aparecem botões no fundo do ecrã.

## Tecnologia

- **Three.js** (r160) — gráficos low-poly, sombras suaves, tudo incluído em `assets/vendor/`
- **cannon-es** — física real de veículo (`RaycastVehicle`: suspensão, derrapagem, travão de mão)
- **Carro** — modelos `chassis-draco.glb` e `wheel-draco.glb` do
  [pmndrs/racing-game](https://github.com/pmndrs/racing-game) (MIT), o mesmo carro do jogo de referência
- Melhor tempo guardado em `localStorage`

## Estrutura

```
index.html          entrada + HUD (velocímetro, cronómetro, checkpoints, minimapa)
style.css           estilos do HUD e dos ecrãs
js/main.js          loop do jogo, câmara, checkpoints, minimapa
js/Car.js           veículo (RaycastVehicle + modelos GLB)
js/World.js         mundo: circunvalação, rotunda AEP, Amial, fábrica, parque, cidade
assets/models/      modelos do carro (draco)
assets/vendor/      three.js, cannon-es e descodificador draco (offline)
```
