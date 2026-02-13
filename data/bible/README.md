# Importação da Bíblia Ave Maria

Este diretório é usado para armazenar o arquivo de entrada da importação de versículos.

## Caminho padrão esperado

- `data/bible/bibliaAveMaria.json`

Você também pode informar um caminho personalizado ao comando.

## Formatos aceitos

### 0) Estrutura hierárquica (como `bibliaAveMaria.json`)

```json
{
  "antigoTestamento": [
    {
      "nome": "Gênesis",
      "capitulos": [
        {
          "capitulo": 1,
          "versiculos": [
            { "versiculo": 1, "texto": "No princípio..." }
          ]
        }
      ]
    }
  ],
  "novoTestamento": []
}
```

### 1) JSON array

```json
[
  {
    "bookId": "genesis",
    "chapter": 1,
    "verse": 1,
    "text": "No princípio, Deus criou o céu e a terra."
  }
]
```

### 2) JSON object com `verses`

```json
{
  "verses": [
    {
      "book": "Gênesis",
      "chapter": 1,
      "verse": 1,
      "text": "No princípio, Deus criou o céu e a terra."
    }
  ]
}
```

### 3) JSONL / NDJSON (uma linha por versículo)

```json
{"book":"Gênesis","chapter":1,"verse":1,"text":"No princípio, Deus criou o céu e a terra."}
{"book":"Gênesis","chapter":1,"verse":2,"text":"A terra estava informe e vazia..."}
```

## Campos aceitos por versículo

- `bookId` (ex.: `genesis`, `mateus`) **ou**
- `book` (nome, ex.: `Gênesis`) **ou**
- `abbreviation` (ex.: `Gn`)
- `chapter` (número inteiro > 0)
- `verse` (número inteiro > 0)
- `text` (texto do versículo)
- `versionId` (opcional; padrão: `ave-maria`)

## Importante

- A importação é **idempotente**: reexecutar o script atualiza versículos existentes pelo ID canônico (`version:book:chapter:verse`).
- Antes de importar, o script executa seed de versões e livros canônicos católicos.
