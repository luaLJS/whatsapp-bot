# WhatsApp Bot Receitech

Bot em Node.js com Baileys para envio de campanhas via fila e respostas automáticas prioritárias.

## Como rodar

1. Instale as dependências:

```bash
npm install
```

2. Crie um `.env` com base em `.env.example`.

3. Rode o bot:

```bash
node bot.js
```

## Regras automáticas

As regras ficam em `rules/`, em arquivos JSON separados.

- `rules/cadastrar-receitas-lote.json`
- `rules/opt-out.json`

## Segurança

Não versionar:

- `.env`
- `auth/`
- bancos `.duckdb`
- arquivos com chaves, tokens ou sessão do WhatsApp
