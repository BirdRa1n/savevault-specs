# Contribuindo com o saveforge-specs

Este repositório é **normativo**: o que está escrito aqui é o contrato que o Desktop, o Registry, a Community e a API precisam cumprir. Por isso, uma mudança aqui pesa mais do que em um repositório de código.

## Idioma

- As specs, os schemas, os exemplos e as mensagens de commit são escritos em **inglês**, porque são consumidos por código e por contribuidores de qualquer país.
- Este guia e as discussões com os mantenedores podem ser em pt-BR.

## Como propor uma mudança

1. Abra uma issue descrevendo o problema e quais componentes são afetados.
2. Classifique a mudança como **aditiva** (compatível) ou **incompatível**, seguindo o [VERSIONING.md](VERSIONING.md). Uma mudança incompatível cria uma nova versão do schema (`vN+1`) e nunca altera a anterior.
3. No mesmo PR, atualize:
   - o `SPEC.md` da área;
   - o schema;
   - os exemplos válidos e inválidos que cobrem a mudança;
   - os vetores de teste, se a mudança afetar regras de validação;
   - o `CHANGELOG.md`.
4. Rode `npm run check` antes de abrir o PR.

## Regras para schemas

- Use JSON Schema **draft 2020-12**, que precisa compilar no modo `strict` do Ajv.
- O `$id` segue o formato `https://saveforge.github.io/saveforge-specs/schemas/<área>/<nome>.vN.schema.json`.
- Objetos usam `additionalProperties: false`, a menos que a spec diga explicitamente que o objeto é extensível.
- Todo campo tem `description`.
- Definições reutilizáveis ficam em `common/schema/defs.v1.schema.json`.

## Regras para exemplos e vetores

- Cada caso inválido testa **um** problema. O nome do arquivo descreve esse problema (`path-traversal.json`, `missing-id.json`).
- Os vetores de teste são agnósticos de linguagem: as implementações em C++, TypeScript e SQL usam os mesmos arquivos.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) em inglês, com o assunto no imperativo e com até 72 caracteres. Use a área como escopo. Exemplo:

```
feat(profile): add store filter to save rules
```

Não adicione trailers de coautoria de ferramentas de IA.
