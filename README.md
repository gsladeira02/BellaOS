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
- Agendamento com múltiplos serviços em sequência.
- Cada serviço pode ter uma profissional diferente.
- No agendamento, a cliente escolhe a profissional e vê apenas os serviços dentro do escopo daquela profissional.
- Serviços filtrados automaticamente conforme a profissional escolhida.
- Ordem automática dos serviços: maquiagem, penteado e noiva são encaixados ao final do atendimento.
- Horários disponíveis calculados considerando a agenda de todas as profissionais do atendimento.
- Cálculo automático de duração e valor total.
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


## Atualização de agendamento

- O novo agendamento interno agora mostra horários disponíveis para seleção, em vez de deixar digitar qualquer horário.
- Horários que já passaram não aparecem e também são bloqueados na confirmação.
- A agenda pública agora começa pela escolha da profissional e mostra apenas os serviços vinculados ao escopo dela.
- A agenda interna também filtra os serviços conforme a profissional escolhida.
- A pessoa escolhe o horário de início; o BellaOS define a sequência do atendimento automaticamente.


## Atualização de múltiplos serviços com profissionais diferentes

- A agenda pública permite montar um atendimento como carrinho: escolha uma profissional, selecione apenas um serviço do escopo dela e clique em **Adicionar serviço**.
- Depois é possível escolher outra profissional e adicionar outro serviço no mesmo atendimento.
- O sistema agenda os serviços em sequência e cria um bloco na agenda de cada profissional.
- Exemplo: Escova com Ana às 14:00 e Manicure com Beatriz logo em seguida, dentro do mesmo atendimento da cliente.
- O horário inicial só aparece se todos os blocos couberem nas agendas das profissionais escolhidas.
- Horários passados continuam bloqueados.


## Atualização de ordem automática dos serviços

- A cliente seleciona a profissional e adiciona os serviços disponíveis para ela.
- Para cada profissional, o sistema mostra apenas os serviços cadastrados no escopo daquela profissional.
- Depois de montar o atendimento, a cliente escolhe apenas o horário de início.
- O BellaOS organiza a ordem dos serviços automaticamente.
- Serviços de maquiagem, penteado e noiva são sempre encaixados no final do atendimento.
- O cálculo dos horários disponíveis já considera essa ordem automática e a agenda de cada profissional.


## Correção de escopo profissional

- O seletor de serviços agora é filtrado diretamente pela profissional selecionada.
- Serviços que não foram marcados no cadastro da profissional não aparecem no agendamento público nem no agendamento interno.
- Ao trocar a profissional, o sistema redefine automaticamente o serviço para o primeiro item válido do escopo dela.
- A validação ao adicionar o serviço continua bloqueando qualquer combinação inválida.

## Atualização de horários por dia da semana

- Cada profissional agora pode ter horários diferentes em cada dia da semana.
- Em **Profissionais > Editar**, é possível ativar ou desativar cada dia individualmente.
- Para cada dia, é possível definir entrada, saída, início do intervalo e fim do intervalo.
- A agenda pública e a agenda interna consideram esses horários na hora de mostrar os horários disponíveis.
- Horários dentro do intervalo da profissional não aparecem para agendamento.
- A compatibilidade com os horários antigos foi mantida: profissionais antigas são convertidas automaticamente para a nova grade semanal.

## Atualização: encaixe inteligente de múltiplos serviços

O agendamento com múltiplos serviços agora procura automaticamente a melhor sequência de atendimento para o horário inicial escolhido, respeitando:

- horário de trabalho de cada profissional por dia da semana;
- intervalo/almoço de cada profissional;
- serviços vinculados ao escopo de cada profissional;
- bloqueio de horários passados;
- maquiagem, penteado e noiva sempre no final da sequência.

A cliente escolhe os serviços e o horário de início. O BellaOS só mostra horários em que todos os serviços conseguem ser encaixados corretamente na agenda das profissionais responsáveis.

## Atualização: exceções de agenda por data

Agora o BellaOS permite alterar a agenda em um dia específico, sem mexer na rotina semanal da profissional.

Em **Configurações > Exceções de agenda**, é possível cadastrar:

- fechamento do salão inteiro em uma data específica;
- funcionamento especial do salão, por exemplo apenas de manhã;
- fechamento de uma profissional específica em um dia;
- horário especial de uma profissional em uma data;
- intervalo especial para esse dia.

Exemplos de uso:

- feriado: salão fechado;
- véspera de feriado: salão abre de 09:00 às 13:00;
- profissional com compromisso: atende apenas de 14:00 às 18:00;
- manutenção: bloquear uma data inteira.

A agenda pública e a agenda interna respeitam essas exceções automaticamente no cálculo dos horários disponíveis, inclusive em atendimentos com múltiplos serviços e profissionais diferentes.

## Atualização: InfinitePay e fluidez

Esta versão inclui:

- Tela **Assinatura** dentro do menu **Mais**.
- Geração de checkout InfinitePay pela rota `/api/infinitepay-checkout`.
- Webhook preparado em `/api/infinitepay-webhook`.
- Página de retorno `/pagamento-concluido`.
- Campo **InfiniteTag InfinitePay** em **Configurações**.
- Ajustes de fluidez visual, redução de animações desnecessárias e melhoria de navegação mobile.

### Como configurar o InfinitePay

1. Acesse o BellaOS.
2. Vá em **Mais > Configurações**.
3. Preencha o campo **InfiniteTag InfinitePay** sem o símbolo `$`.
4. Vá em **Mais > Assinatura**.
5. Clique em **Assinar por R$ 69,90/mês**.

A integração cria um link de pagamento na InfinitePay. Para uma assinatura totalmente automática com bloqueio/desbloqueio de salões, o próximo passo é gravar o webhook em uma tabela no Supabase e atualizar o status do salão pelo `order_nsu`.
