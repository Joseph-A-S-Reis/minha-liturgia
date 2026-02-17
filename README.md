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

Ordem de envio do app:

1. SMTP (se configurado)
2. Resend (se configurado)
3. Fallback em log no console

Se usar Gmail SMTP, prefira senha de app em `SMTP_PASS` (não a senha normal da conta).

## Migração do diário local

Ao acessar `/diario` autenticado, o app detecta entradas antigas no `localStorage` e oferece um botão para migrar tudo para o Neon.

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
