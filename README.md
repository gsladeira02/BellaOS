# BellaOS — versão completa e vendável

Sistema mobile-first para salões de beleza femininos, inspirado nos padrões do NavalhaOS.

## O que está incluído

- Logo BellaOS em SVG no estilo premium usado na arte de divulgação.
- Login limpo, sem credenciais ou mensagens internas na tela.
- Troca obrigatória de senha no primeiro login.
- Conta de demonstração liberada para testes.
- Agenda interna.
- Link público de agendamento por slug: `/agenda/nomedosalão`.
- Link de compartilhamento já ajustado para `https://os-bella.vercel.app/agenda/...`.
- Antecedência mínima global e por serviço.
- Agendamento com múltiplos serviços.
- Escolha de profissional ou qualquer profissional disponível.
- Cálculo automático de duração e valor.
- Clientes com ficha completa, edição e exclusão.
- Histórico capilar e fórmula de coloração.
- Serviços, categorias e pacotes com edição, ativação/inativação e exclusão.
- Profissionais com especialidade, horários, comissão, edição e exclusão.
- Financeiro com receitas, despesas, ticket médio e lucro estimado.
- Comissões por profissional.
- Estoque com alertas de baixa.
- Baixa de produtos ao concluir atendimento.
- Botões de WhatsApp.
- Configurações completas do salão.
- Painel administrativo `/admin`.


## Atualização desta versão

- Adicionados botões de **Editar** e **Excluir** em Clientes.
- Adicionados botões de **Editar** e **Excluir** em Serviços.
- Adicionados botões de **Editar** e **Excluir** em Profissionais.
- A ficha da cliente também permite editar ou excluir diretamente pelo modal.
- A logo voltou para o estilo premium da primeira arte, com símbolo feminino circular e tipografia BellaOS.

## Supabase

As chaves públicas foram configuradas no início do `app.js`:

```js
const PUBLIC_BASE_URL = 'https://os-bella.vercel.app';
const SUPABASE_PROJECT_URL = 'https://omhrigszheellguyyihz.supabase.co';
const SUPABASE_REST_URL = `${SUPABASE_PROJECT_URL}/rest/v1`;
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_Urza4wG2be2xxgMzxJrCEQ_ya_uV0z-';
```

Observação: o endpoint enviado foi `https://omhrigszheellguyyihz.supabase.co/rest/v1/`. Para o app, a base correta do projeto é `https://omhrigszheellguyyihz.supabase.co`, e o `/rest/v1` é usado internamente.

Para ativar a sincronização remota rápida, execute o arquivo `supabase_schema.sql` no SQL Editor do Supabase. Ele cria também a tabela `bellaos_state`, usada por esta versão estática para salvar o estado do app no Supabase com fallback local.

## Contas internas de teste

Essas credenciais não aparecem mais na tela de login. Use apenas para validação interna.

### Salão completo
E-mail: `contato@studiobella.com`  
Senha: `bella123`

### Primeiro login obrigatório
E-mail: `primeiro@studiobella.com`  
Senha: `trocar123`  
Ao entrar, o sistema exige a criação de uma nova senha.

### Conta de demonstração liberada
E-mail: `demo@bellaos.com`  
Senha: `demo123`  
Pode navegar, criar, editar, cancelar e testar os módulos normalmente.

### Admin BellaOS
E-mail: `admin@bellaos.com`  
Senha: `admin123`

## Link público de agendamento

Depois de publicar na Vercel, acesse:

`https://os-bella.vercel.app/agenda/studio-bella`

Os botões de copiar e compartilhar já usam esse domínio.

## Como publicar na Vercel

1. Suba estes arquivos para um repositório no GitHub.
2. Importe o repositório na Vercel.
3. Não precisa configurar build command.
4. O arquivo `vercel.json` já redireciona `/agenda/:slug` e `/admin` para o app.

## Estrutura

```txt
bellaos-completo/
├── index.html
├── styles.css
├── app.js
├── manifest.webmanifest
├── vercel.json
├── supabase_schema.sql
└── assets/
    ├── logo.svg
    └── logo-mark.svg
```

## Personalização rápida

- Nome do sistema: procure por `BellaOS`.
- Domínio público: edite `PUBLIC_BASE_URL` no início do `app.js`.
- Supabase: edite `SUPABASE_PROJECT_URL` e `SUPABASE_PUBLISHABLE_KEY` no início do `app.js`.
- Cores: edite as variáveis no início do `styles.css`.
- Dados iniciais: edite a função `seedDb()` no `app.js`.
- Logo: edite os SVGs em `/assets`.


## Observação sobre demonstração
A conta de demonstração não possui bloqueio de ações. Ela pode criar, editar, cancelar e testar os módulos normalmente.
