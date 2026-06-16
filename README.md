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
