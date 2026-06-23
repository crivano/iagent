# iAgente — Slides

Apresentação técnica da arquitetura do iAgente (POC) para público de TI.

## Como abrir

```bash
# Opção 1: abrir diretamente no navegador
start slides/index.html       # Windows
open   slides/index.html      # macOS
xdg-open slides/index.html    # Linux

# Opção 2: servir localmente (necessário para algumas políticas de CSP)
npx serve slides              # ou: python -m http.server -d slides 8000
# → http://localhost:8000/
```

> Os slides usam reveal.js e Mermaid via CDN (jsdelivr).
> Primeira abertura precisa de internet; depois o navegador faz cache.
> Para uso 100% offline, baixe `reveal.js`, `reveal.js-plugins` e `mermaid`
> para `slides/vendor/` e troque as tags `<script src="https://...">`.

## Estrutura

```
slides/
├── index.html              # Reveal.js com 23 slides + 4 diagramas Mermaid
├── README.md               # este arquivo
└── diagrams/
    ├── 01-layers.dot       # visão geral de 3 zonas
    ├── 02-monorepo.dot     # 11 pacotes e dependências
    ├── 03-bus-vs-registry.dot
    ├── 04-sequence.dot     # sessão interativa
    └── 05-jsonrpc-envelope.dot
```

## Diagramas

Os slides 4, 5 e 13 usam **Mermaid** (via CDN jsdelivr) — o código fonte
fica inline em `<div class="mermaid">…</div>` dentro do `index.html`.
A inicialização usa `htmlLabels: true` para preservar as quebras `<br/>`
dentro dos rótulos dos nós.

### Render alternativo offline (opcional)

Em `diagrams/*.dot` há versões Graphviz de cada diagrama. Para quem
precisa abrir os slides **sem internet** (sem CDN), os SVGs pré-renderizados
estão em `diagrams/*.svg` e o `index.html` pode ser ajustado para usar
`<object data="diagrams/01-layers.svg">` no lugar do Mermaid.

Regenerar os SVGs a partir dos `.dot`:

```bash
pnpm slides:render    # usa @hpcc-js/wasm (sem instalar Graphviz)
```

## Roteiro dos slides

| #  | Título                                  | Foco                                   |
|----|-----------------------------------------|----------------------------------------|
| 1  | Capa                                    | Apresentação                           |
| 2  | O problema                              | Dor N×M                                |
| 3  | A ideia-núcleo                          | Acoplar por interface                  |
| 4  | Visão geral · 3 zonas                   | Diagrama de camadas                    |
| 5  | Monorepo · 11 pacotes                   | Dependências                           |
| 6  | `CapabilityBus` — implementações        | API do bus                             |
| 7  | `AppRegistry` — metadados + UI          | Descritor de app                       |
| 8  | Bus ≠ Registry                          | Tabela comparativa                     |
| 9  | Transporte · JSON-RPC 2.0               | Envelope                               |
| 10 | `ITransport` — canal que muda           | `postMessage` / in-process            |
| 11 | Interfaces de domínio                   | Vocabulário                            |
| 12 | De RPC para sessão interativa           | `IInteractiveAssistant<T>`             |
| 13 | Fluxo de uma sessão interativa          | Sequence diagram                       |
| 14 | UI shell                                | Floating button / split-pane / app     |
| 15 | Isolamento × Coexistência               | Shadow DOM + host squeeze              |
| 16 | `@iagente/storage`                      | Persistência                           |
| 17 | Adaptador de host · exemplo             | `HostAdapter`                          |
| 18 | Adaptador de app · iframe vs react      | `AppDescriptor`                        |
| 19 | Runtime · do `<script>` à UI            | `entry.tsx`                            |
| 20 | Por que isto escala                     | N+M vs N×M                             |
| 21 | O que está pronto                       | Status                                 |
| 22 | Como ver funcionando                    | `pnpm dev:demo`                        |
| 23 | Encerramento                            | —                                      |

## Atalhos do Reveal.js

- `←` / `→` ou `Espaço` — navegar
- `S` — speaker notes (se habilitado)
- `F` — fullscreen
- `O` — overview
- `Esc` — sair do overview
- `?` — ajuda
