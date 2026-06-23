# iAgente

Um framework de orquestração injetável que **desacopla sistemas hospedeiros** (eproc, PJe, SEI, Siga-Doc…) de **aplicações web externas** (Apoia, Assis, NPS…). O iAgente é carregado na página do hospedeiro (via `<script>` tag hoje; extensão de navegador no futuro) e conecta hosts a apps por um **barramento de capacidades** sobre **JSON-RPC 2.0** via `postMessage`.

## Estado atual

Implementadas 7 fases do plano de arquitetura, com **55 testes passando** em 8 pacotes. Estágio: esqueleto arquitetural completo + sandbox E2E validando o desacoplamento.

## Arquitetura

1. **Capability Bus** (`@iagente/core`) — o botão "Resumir" não pede "a Apoia"; pede *alguém que implementa `IAICollaborator`*. N hospedeiros × M apps = **N+M** adaptadores (não N×M classes).
2. **Proxy RPC** (`@iagente/rpc`) — `createRpcProxy<T>()` transforma métodos de interface em `method` JSON-RPC, roteados por `postMessage`.
3. **Transporte unificado** (`ITransport`) — abstrai o canal (`postMessage` para iframe/popup, in-process para adaptadores host).
4. **Auto-detecção de host** (`@iagente/core`) — cada adaptador declara padrões de URL/DOM; maior score vence.

## Fluxo canônico (sandbox)

```
[demo-host]                    [iAgente kernel]                 [app externo]
provides 'case'    ──────▶    CapabilityBus                  provides 'ai'
 ICMS                          ┌──── getActive('ai')          IAICollaborator
                               │       │                       (via in-proc
   botão "Resumir"  ──────────▶└────── summarize(text) ──▶      transport ou
                                                       ◀── result  postMessage)
   textarea atualizado  ◀──────────── writeEditorText ────────── (via SDK)
```

## Monorepo (pnpm)

```
packages/
├── protocol/            contratos: 4 interfaces de domínio + JSON-RPC 2.0
├── rpc/                 proxy/stub RPC + transports (postMessage, in-process)
├── core/                kernel: capability bus, host detector, orchestrator
├── sdk/                 @iagente/app-sdk — SDK para apps externos (Apoia, NPS)
├── ui/                  React overlay em Shadow DOM
├── hosts/
│   └── demo-host/       adaptador sandbox ICaseManagementSystem
├── apps/
│   └── demo-app/        adaptador sandbox IAICollaborator
└── runtime/
    └── script-tag/      bundle IIFE injetável + testes E2E
```

## Interfaces de domínio (`@iagente/protocol`)

| Interface | Tipo | Implementado por |
|---|---|---|
| `ICaseManagementSystem` | hospedeiro | eproc, PJe, demo-host |
| `IDocumentManagementSystem` | hospedeiro | SEI, Siga-Doc |
| `IAICollaborator` | aplicativo externo | Apoia, Assis, demo-app |
| `IFeedbackCollector` | aplicativo externo | NPS, apps de avaliação |

## Desenvolvimento

```bash
pnpm install
pnpm -r run build         # builda todos os pacotes (topológico)
pnpm -r run test          # roda todos os testes
pnpm --filter @iagente/runtime-script-tag build   # gera o bundle injetável
```

## Modo visual

### Painel de testes (Vitest UI)

Dashboard interativo no navegador com árvore de testes, filtros, re-run ao
salvar, detalhe de cada asserção e tempo gasto.

```bash
pnpm test:ui
# → abre http://localhost:51204/__vitest__/
```

Clique em qualquer arquivo da lista para expandir os testes individuais;
use o botão "Run current test" para isolar a execução. Salvar um arquivo
`.test.ts` dispara re-run automático com hot reload.

### Demo no navegador (ver o overlay de verdade)

Sobe um servidor com uma página hospedeira **mock** (Processo Administrativo
demo) e injeta o bundle do iAgente — para você *ver* o overlay/sidebar/Shadow
DOM renderizando visualmente e clicar no botão **Resumir**.

```bash
pnpm dev:demo
# → abre http://localhost:5174/demo/
```

Abra o **Console do navegador** (DevTools) e clique em **Resumir** na sidebar
do iAgente para ver o resultado retornado pelo colaborador de IA (in-process).

## Como adicionar um novo hospedeiro

1. Criar `packages/hosts/meu-host/` que exporta um `HostAdapter` (descriptor URL/DOM + factory `activate()` retornando as capacidades implementadas).
2. Adicionar o adaptador em `HOST_ADAPTERS` em `packages/runtime/script-tag/src/entry.tsx`.
3. Reconstruir o bundle. A integração com apps existentes (Apoia, NPS) **não exige mudanças**.

## Como adicionar um novo app externo

1. Criar `packages/apps/meu-app/` que exporta um adaptador seguindo o padrão de `app-demo`.
2. Em runtime, o iAgente abre o app (iframe/popup) e troca dados via `postMessage`/JSON-RPC.
3. Hooks do host (`Resumir`, etc.) chamam o app por interface (`IAICollaborator`), não por nome. A integração com hosts existentes (eproc, PJe, SEI) **não exige mudanças**.

## Licença

MIT.

