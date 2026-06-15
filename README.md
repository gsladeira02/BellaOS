# BellaOS — versão completa e vendável

Sistema mobile-first para salões de beleza femininos, inspirado nos padrões do NavalhaOS.

## O que está incluído

- Logo própria BellaOS em SVG.
- Login limpo.
- Troca obrigatória de senha no primeiro login.
- Conta demo bloqueada.
- Agenda interna.
- Link público de agendamento por slug: `/agenda/nomedoslão`.
- Antecedência mínima global e por serviço.
- Agendamento com múltiplos serviços.
- Escolha de profissional ou qualquer profissional disponível.
- Cálculo automático de duração e valor.
- Clientes com ficha completa.
- Histórico capilar e fórmula de coloração.
- Serviços, categorias e pacotes.
- Profissionais com especialidade, horários e comissão.
- Financeiro com receitas, despesas, ticket médio e lucro estimado.
- Comissões por profissional.
- Estoque com alertas de baixa.
- Baixa de produtos ao concluir atendimento.
- Botões de WhatsApp.
- Configurações completas do salão.
- Painel administrativo `/admin`.
- Dados demonstrativos prontos para apresentação comercial.

## Contas de teste

### Salão completo
E-mail: `contato@studiobella.com`  
Senha: `bella123`

### Primeiro login obrigatório
E-mail: `primeiro@studiobella.com`  
Senha: `trocar123`  
Ao entrar, o sistema exige a criação de uma nova senha.

### Conta demo bloqueada
E-mail: `demo@bellaos.com`  
Senha: `demo123`  
Pode navegar, mas não pode criar, editar ou excluir dados.

### Admin BellaOS
E-mail: `admin@bellaos.com`  
Senha: `admin123`

## Link público de agendamento

Depois de rodar o app, acesse:

`/agenda/studio-bella`

Exemplo em produção:

`https://seu-dominio.vercel.app/agenda/studio-bella`

## Como publicar na Vercel

1. Suba estes arquivos para um repositório no GitHub.
2. Importe o repositório na Vercel.
3. Não precisa configurar build command.
4. O arquivo `vercel.json` já redireciona `/agenda/:slug` e `/admin` para o app.

## Observação importante

Esta versão é um app estático completo com persistência local via `localStorage`, ideal para apresentação comercial, validação, demonstração e venda inicial.

Para produção real com múltiplos salões e dados seguros, use o arquivo `supabase_schema.sql` como base para criar o backend no Supabase. Depois, substitua a camada de `localStorage` do `app.js` por chamadas ao Supabase.

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
- Cores: edite as variáveis no início do `styles.css`.
- Dados iniciais: edite a função `seedDb()` no `app.js`.
- Logo: edite os SVGs em `/assets`.
