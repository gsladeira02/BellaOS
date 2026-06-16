# BellaOS

Pacote final do BellaOS para subir em um GitHub limpo e publicar na Vercel.

## Domínio padrão

```txt
https://bella-os.vercel.app
```

## O que está incluído

- Tela inicial no padrão NavalhaOS, com assinatura e login juntos.
- Plano único BellaOS Completo por R$ 69,90/mês.
- Checkout InfinitePay configurável pelo `.bat`.
- Login limpo.
- Troca obrigatória de senha no primeiro acesso.
- Agenda interna.
- Agenda pública por slug.
- Múltiplos serviços com profissionais diferentes.
- Ordem automática dos serviços, deixando maquiagem, penteado e noiva para o final.
- Horário das profissionais por dia da semana.
- Intervalo/almoço por profissional.
- Exceções de agenda por data específica.
- Clientes, profissionais e serviços com editar/excluir.
- Financeiro, estoque, comissões e relatórios.
- Supabase configurado para sincronização rápida.
- API routes da Vercel para InfinitePay.

## Arquivos principais

```txt
index.html
styles.css
app.js
assets/
api/
vercel.json
supabase_schema.sql
manifest.webmanifest
package.json
package-lock.json
.gitignore
configurar_bellaos.bat
README.md
```

## Configurar antes de subir

No Windows, extraia o ZIP, entre na pasta e execute:

```bat
configurar_bellaos.bat
```

Ele vai pedir:

- Domínio público
- URL do Supabase
- Publishable/anon key do Supabase
- InfiniteTag da InfinitePay, sem `$`

O `.bat` altera automaticamente o `app.js`.

## Supabase

Execute o arquivo abaixo no SQL Editor do Supabase:

```txt
supabase_schema.sql
```

Se você já executou antes, pode executar de novo. O schema usa `create table if not exists` nas tabelas principais.

## Vercel

Para evitar criar projeto duplicado:

```bat
vercel link
```

Escolha o projeto existente:

```txt
bella-os
```

Depois publique:

```bat
vercel --prod
```

## Contas internas de teste

Salão:
```txt
contato@studiobella.com
bella123
```

Primeiro acesso:
```txt
primeiro@studiobella.com
trocar123
```

Demo:
```txt
demo@bellaos.com
demo123
```

Admin:
```txt
admin@bellaos.com
admin123
```


## Correção para Vercel

Esta versão está organizada no padrão que a Vercel está pedindo no seu projeto:

```txt
public/
  index.html
  app.js
  styles.css
  assets/
  manifest.webmanifest

api/
  infinitepay-checkout.js
  infinitepay-webhook.js
```

O `vercel.json` também define:

```json
"outputDirectory": "public"
```

Assim o erro `No Output Directory named "public" found` não deve acontecer.


## Correção do configurador

Nesta versão, o arquivo `configurar_bellaos.bat` altera corretamente:

```txt
public/app.js
```

porque o frontend fica dentro da pasta `public/`.


## Configurador corrigido

O `configurar_bellaos.bat` agora usa automaticamente a pasta onde o próprio arquivo está salvo.  
Ele procura o arquivo em:

```txt
public/app.js
```

Então execute o `.bat` dentro da pasta que contém `public`, `api` e `vercel.json`.


## Atualização do cadastro inicial

A tela de assinatura agora pede:

- Nome completo do administrador
- CPF
- Data de nascimento
- Celular do administrador
- E-mail do administrador
- Nome do salão
- CNPJ do salão, opcional
- Celular do salão

Também foi corrigido o problema de acentuação/fonte no `public/app.js`.  
O arquivo foi salvo em ASCII com escapes Unicode para evitar textos como `salÃ£o`, `mÃªs` e `ServiÃ§os`.


## Atualização dos planos e recorrência

Planos configurados:

- Mensal: R$ 69,90
- Trimestral: 3x de R$ 64,90
- Semestral: 6x de R$ 59,90
- Anual: 12x de R$ 39,90

A recorrência é salva no pedido e no salão:

- Mensal: próximo vencimento em 1 mês
- Trimestral: próximo vencimento em 3 meses
- Semestral: próximo vencimento em 6 meses
- Anual: próximo vencimento em 12 meses

Regra de acesso:

- O login continua liberado até 3 dias após o vencimento.
- Após esse prazo, se a assinatura não estiver ativa/paga, o sistema mostra a tela de regularização e bloqueia o painel.
- A regularização gera novo checkout InfinitePay do plano escolhido.

Observação: a confirmação automática definitiva depende do webhook da InfinitePay atualizar o status de pagamento no backend. Esta versão já prepara metadados, vencimento e tolerância no fluxo de checkout.
