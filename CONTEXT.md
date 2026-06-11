# Contexto do Projeto: NPRGR RACEGAME

## Resumo da Sessão (11/06/2026)

Este documento serve para dar continuidade ao desenvolvimento do minijogo de corrida estilo *Burnout Takedown* integrado num RPG.

### Decisões Técnicas
- **Engine:** Three.js (WebGL) para correr no navegador.
- **Linguagem:** JavaScript (ES Modules).
- **Física:** Implementação personalizada de inércia, drift e colisões (preparado para Rapier.js).
- **Cenário:** Integração de panoramas 360º do Google Street View.

### Veículos Definidos
1.  **Jogador:** BMW 320d (E90) 2007, Cor: Preta.
2.  **Rival:** Opel Corsa B Tuning, Cor: Laranja/Personalizado.
3.  **Tráfego:** Carros comuns em Portugal (Renault Clio, VW Golf, Autocarros STCP).

### Percurso (Porto, Portugal)
1.  **Partida:** Parque de estacionamento de funcionários da Monteiro Ribas (Circunvalação).
2.  **Direção Oeste:** Reta da Circunvalação até à **Rotunda da AEP** (Volta completa).
3.  **Retorno Este:** Passagem pela fábrica em direção ao **Cruzamento do Amial**.
4.  **U-Turn:** Inversão de marcha no Amial.
5.  **Chegada:** Regresso e entrada final no parque da Monteiro Ribas.

### Estado Atual do Protótipo
- [x] HUD/UI Estilo Burnout (Velocímetro, Boost, Vida do Rival).
- [x] Física básica de condução e Nitro.
- [x] IA do Rival com modo "Ramming" (Ataque).
- [x] Sistema de aviso de 2 segundos para contra-ataque.
- [x] Estrutura de pastas para assets (`models` e `textures`).

### Próximos Passos (Em Casa)
1.  **Assets 3D:** Substituir os cubos (placeholders) por modelos `.glb` reais do BMW e Corsa.
2.  **Texturas:** Capturar e inserir os panoramas 360º da Circunvalação na pasta `assets/textures/`.
3.  **Refinamento:** Ajustar a iluminação PBR para maior realismo.
4.  **Servidor Local:** Lembrar de rodar um servidor (ex: `npx serve` ou `python3 -m http.server`) para evitar erros de CORS no navegador.

---
*Documento gerado pelo Gemini CLI para fragosa23.*
