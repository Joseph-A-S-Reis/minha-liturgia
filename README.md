# Minha Liturgia

Aplicação web para devotos católicos com foco em:

- Bíblia (multi-versão, começando por Ave Maria)
- Diário espiritual pessoal
- Calendário católico com destaque para o dia atual

## Stack inicial

- Next.js (App Router) + TypeScript
- Tailwind CSS v4
- NeonDB (PostgreSQL serverless)
- Drizzle ORM
- Auth.js (credenciais + sessão em banco)

## Executar localmente

```bash
npm install
npm run dev
```

Abra a URL local exibida no terminal após iniciar o servidor.

## PWA (instalação e atualização)

O app suporta instalação como PWA com foco em experiência **standalone mobile**.

### Como instalar

- **Android / Desktop (Chrome, Edge):** use o botão **Instalar** exibido no topo quando disponível.
- **iPhone / iPad (Safari):** use **Compartilhar → Adicionar à Tela de Início**.

### Comportamento offline e cache

- O app mantém cache de shell e assets estáticos para carregamento resiliente.
- Rotas sensíveis/autenticadas possuem regras de cache mais restritas.
- APIs (`/api/*`) e fluxos de autenticação não são cacheados pelo service worker.
- Em indisponibilidade de rede, o fallback é `public/offline.html`.

### Atualização do app instalado

- Quando uma nova versão do service worker é detectada, o app exibe um aviso de atualização.
- Toque em **Atualizar** para ativar a versão mais recente sem limpar dados do usuário.

### Notas de versão (changelog em pop-up)

- Após tocar em **Atualizar** e recarregar com a nova versão, o app exibe um pop-up com as notas da versão.
- O pop-up é exibido apenas **uma vez por versão** para cada instalação/navegador.

Fonte de verdade do changelog:

- Arquivo: `data/releases/releases.json`
- Endpoints:
  - `GET /api/version/current` (versão mais recente + resumo)
  - `GET /api/version/changelog?version=x.y.z` (notas completas da versão)

Categorias aceitas em `changes[].category`:

- `feature`
- `fix`
- `improvement`
- `security`
- `breaking`

### Checklist de release (PWA + changelog)

Antes de publicar uma nova versão:

1. Atualize `data/releases/releases.json` com a nova entrada de release.
2. Ajuste `latest` para a nova versão (SemVer, ex.: `0.2.0`).
3. Faça bump de cache no `public/sw.js` (`SHELL_CACHE` e `RUNTIME_CACHE`) para invalidar o shell antigo.
4. Faça deploy.
5. Smoke test no app instalado:
   - aparece aviso de nova versão;
   - botão **Atualizar** ativa a nova versão;
   - pop-up de notas da versão abre após recarregar.

## Banco de dados (Neon + Drizzle)

1. Configure `DATABASE_URL` no arquivo `.env`.
2. Gere e aplique schema:

```bash
npm run db:generate
npm run db:push
```

> Se você já tinha criado o schema anteriormente, rode novamente `db:push` para aplicar novas colunas de segurança (`users.password_hash`, `users.failed_login_attempts`, `users.locked_until`).

## Autenticação

- Rotas: `/entrar` e `/cadastro`
- Sessões persistidas no Neon
- Diário (`/diario`) protegido por autenticação
- Logout disponível em `/inicio`
- Fluxos de segurança adicionais:
  - Verificação de e-mail: `/verificar-email`
  - Reenvio de verificação: `/reenviar-verificacao`
  - Recuperação de senha: `/esqueci-senha` e `/redefinir-senha`
  - Lockout progressivo após tentativas falhas de login

> Importante: `AUTH_URL` deve apontar para a URL da **aplicação** (ex.: `https://SEU-DOMINIO-DA-APP`), e **não** para a URL do Neon Auth/JWKS. Se `AUTH_URL` apontar para o domínio do Neon Auth, os redirecionamentos de login irão para lá e retornarão `404`.

Para e-mails reais (verificação/redefinição), configure também no `.env`:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `REMINDER_CRON_SECRET` (para proteger o endpoint interno de tick dos lembretes)

Ordem de envio do app:

1. SMTP (se configurado)
2. Resend (se configurado)
3. Fallback em log no console

## Scheduler de lembretes (calendário)

O sistema de lembretes usa fila (`pg-boss`) e um endpoint interno para processar jobs pendentes.

- Endpoint: `POST /api/internal/reminders/tick`
- Header obrigatório: `x-reminder-secret: <REMINDER_CRON_SECRET>`

Exemplo de chamada (cron externo / Netlify Scheduled Function):

```bash
curl -X POST "https://SEU-DOMINIO/api/internal/reminders/tick" \
  -H "x-reminder-secret: SEU_SEGREDO"
```

Recomendação: execute a cada 1-5 minutos para boa precisão dos lembretes.

Comportamento atual dos lembretes:

- Respeita preferências por usuário (`push` / `email` habilitado ou não).
- Respeita horário silencioso (`quiet hours`) e reagenda automaticamente para a próxima janela permitida.
- Se um lembrete push não tiver assinatura ativa, faz fallback para e-mail (quando e-mail estiver habilitado e disponível).

Checklist de produção (quando houver 404 no tick):

1. Confirme que o deploy em produção inclui a rota `app/api/internal/reminders/tick/route.ts`.
2. Verifique se `REMINDER_CRON_SECRET` está configurado no ambiente de produção.
3. Teste o endpoint com o header `x-reminder-secret`.
4. Esperado: JSON com `401` (segredo inválido) ou `200` (segredo válido), nunca HTML de página `not found`.

Se usar Gmail SMTP, prefira senha de app em `SMTP_PASS` (não a senha normal da conta).

## Migração do diário local

Ao acessar `/diario` autenticado, o app detecta entradas antigas no `localStorage` e oferece um botão para migrar tudo para o Neon.

## Persistência imediata e segurança de escrita (CRUD)

O app agora opera em modo **DB-first** para mutações:

- Criação/edição/exclusão tentam persistir **imediatamente no banco**.
- Ações críticas usam **idempotência** para evitar duplicidade por clique duplo, retry de rede ou reenvio acidental.
- Fluxos de token de conta (verificação/redefinição) usam operações **atômicas em transação**.

### Fallback local (contingência)

Quando a escrita no banco falha temporariamente (rede/indisponibilidade):

- Diário e notas salvam a operação em fila local (`localStorage`) apenas como contingência.
- O app tenta sincronizar automaticamente ao recuperar foco/visibilidade e permite sincronização manual.
- Após sucesso no banco, a pendência local é removida.

> O banco continua sendo a fonte canônica de verdade; o `localStorage` é apenas uma fila temporária de recuperação.

### Aplicar migração de idempotência

Após atualizar o código, rode:

```bash
npm run db:push
```

Essa etapa cria a tabela `mutation_idempotency`, usada para deduplicar mutações repetidas em janelas curtas.

## MarIA (assistente IA via OpenRouter)

A MarIA está disponível na página `/inicio` **somente para usuários autenticados**.

Modos disponíveis:

- `Conselheira`: aconselhamento amigável com apoio bíblico
- `Teóloga`: foco em teologia católica e contexto histórico
- `Educadora`: planos/guias de estudo com base catequética

### Variáveis de ambiente

Configure no `.env` (local) e no provedor de deploy (Netlify):

- `OPENROUTER_API_KEY`
- `OPENROUTER_MODEL` (ex.: `liquid/lfm-2.5-1.2b-thinking:free`)

## Biblioteca Católica (base inicial)

O módulo `/biblioteca` já possui fundação de banco para:

- publicações (artigos, livros, vídeos, áudio, documentos)
- categorias e vínculo publicação-categoria
- assets de mídia (URL externa ou chave de objeto no Google Cloud Storage)
- chunks textuais para RAG
- fila de ingestão editorial (ex.: Santa Igreja)

### Variáveis para Google Cloud Storage

Para usar uploads e assets hospedados no Cloud Storage, configure:

- `GCS_BUCKET_NAME`
- `GCS_RESOURCES_PREFIX` (opcional; default: `recursos`)
- `GCS_PUBLIC_BASE_URL` (opcional; default: `https://storage.googleapis.com/<bucket>`)
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- `GOOGLE_CLOUD_PROJECT_ID` (opcional, recomendado)
- `LIBRARY_CRON_SECRET` (para proteger endpoints internos da Biblioteca)

Prioridade de autenticação:

1. Service Account explícita (`GOOGLE_SERVICE_ACCOUNT_EMAIL/PRIVATE_KEY`)
2. Credenciais padrão da aplicação (ADC), quando disponíveis no ambiente

> Observação: os fluxos legados de `sign-upload` e `confirm-upload` foram removidos. O upload oficial é `POST /api/biblioteca/assets/direct-upload`, com confirmação direta no Cloud Storage + NeonDB.

Endpoint interno para healthcheck do Cloud Storage:

- `GET /api/internal/library/storage-health`
- Header obrigatório: `x-library-secret: <LIBRARY_CRON_SECRET>`

Exemplo:

```bash
curl -X GET "https://SEU-DOMINIO/api/internal/library/storage-health" \
  -H "x-library-secret: SEU_SEGREDO"
```

### MarIA com contexto da Biblioteca

O endpoint `POST /api/maria/chat` agora busca trechos relevantes em `library_resource_chunks` (apenas conteúdos publicados) e envia esse contexto para o modelo quando houver correspondência.

Quando apropriado, a MarIA tende a citar esses trechos com marcação `[1]`, `[2]`, etc.

Melhorias do nível atual:

- Ranking híbrido de recuperação (frase + tokens no título e conteúdo), em vez de filtro textual simples.
- Diversificação de trechos por recurso para reduzir redundância de contexto.
- Payload da API inclui `sources` com links internos (`/biblioteca/[slug]`) e, quando existir, link externo da fonte original.
- A resposta da MarIA renderiza marcadores `[n]` clicáveis, apontando para o conteúdo usado como apoio.
- Filtro de confiança configurável por score (`MARIA_CITATION_MIN_SCORE`) para reduzir citações fracas.
- Telemetria de citações efetivamente usadas na resposta em `maria_citation_events`.

### Como funciona

- Endpoint server-side: `POST /api/maria/chat`
- A chave da OpenRouter fica apenas no servidor.
- O usuário pode salvar a resposta da MarIA:
  - no **Diário privado**;
  - como **nota de versículo** (com detecção de referência bíblica, como `João 3:16`).

### Políticas de uso da MarIA

- A MarIA atende **somente** no contexto católico dos modos:
  - `Conselheira`
  - `Teóloga`
  - `Educadora`
- Solicitações fora do escopo (ex.: programação, apostas, marketing, etc.) são recusadas com redirecionamento para tema católico.
- Conteúdo adulto/sexual explícito é bloqueado.

### Limite de uso

- Há um limite básico por usuário para evitar abuso/custos excessivos:
  - 20 requisições por hora (memória do processo).

## Destaque do Dia (internet + fontes oficiais)

Na `/inicio`, o bloco **Destaque do dia** passa a buscar novidades/curiosidades da Igreja em feeds oficiais católicos (ex.: Vatican News e CNBB), com cache e fallback para o calendário litúrgico local quando necessário.

## Estrutura atual

- `app/`: páginas principais (onboarding, início, bíblia, calendário, diário)
- `lib/`: utilitários de domínio
- `db/`: cliente e schema do banco

## Módulo Bíblia (arquitetura de leitura)

O módulo da Bíblia agora está preparado para leitura canônica com App Router:

- Hub: `/biblia`
- Livro: `/biblia/[version]/[book]`
- Capítulo e versículos: `/biblia/[version]/[book]/[chapter]`
- Busca textual: `/biblia/[version]/buscar?q=...`

Camadas principais:

- `lib/bible-repository.ts`: consultas de versões, livros, capítulos, versículos e busca textual.
- `lib/bible-canon.ts`: metadados canônicos católicos (ordem de livros e capítulos).
- `db/schema.ts`: tabelas `bible_versions`, `bible_books`, `bible_verses`.

### Próximo passo obrigatório para leitura completa

Para exibir os versículos reais da Ave Maria, é necessário importar o texto para `bible_verses`.
Sem essa importação, as rotas já funcionam, mas os capítulos podem aparecer como indisponíveis.

#### Comandos de importação

```bash
npm run bible:seed:meta
npm run bible:import:ave-maria
```

Para usar um arquivo customizado:

```bash
npm run bible:import:ave-maria -- ./caminho/para/arquivo.json
```

Formato de entrada detalhado: `data/bible/README.md`.

## Próximas evoluções sugeridas

- Importar texto completo da Bíblia (Ave Maria e outras versões)
- Usar `romcal` para calendário litúrgico completo (móveis + fixas)
