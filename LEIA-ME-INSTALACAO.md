# Instalação — atualização automática de zonas (INE)

Copia estes ficheiros para o teu repositório GitHub, mantendo os caminhos:

```
(raiz do repositório)
├── simulador-credito-habitacao.html   ← substitui o teu (renomeia para index.html se for esse o nome que usas)
├── zonas.json                          ← ficheiro de dados (a Action atualiza-o)
├── scripts/
│   └── atualizar-zonas.mjs             ← script que consulta o INE
└── .github/
    └── workflows/
        └── atualizar-zonas.yml         ← agendamento mensal
```

Depois de fazeres commit e push, não precisas de fazer mais nada:

- A Action corre automaticamente no dia 5 de cada mês (o INE publica trimestralmente).
- Quando há dados novos, faz commit do zonas.json atualizado; o GitHub Pages e o Cloudflare Pages redeployam sozinhos.
- A app lê o zonas.json ao abrir e mostra "Dados INE atualizados a ...".
- Se quiseres forçar uma atualização: separador Actions → "Atualizar zonas (INE)" → Run workflow.

Notas:
- Fonte: INE, indicador 0012234 (mediana €/m² de transações reais, últimos 12 meses). Difere do idealista (preços pedidos) — os valores absolutos serão mais baixos, mas a variação homóloga é mais fiável para o comparador.
- Para acompanhar mais concelhos, edita a lista MUNICIPIOS no scripts/atualizar-zonas.mjs (basta o nome exato do concelho).
- Se o Cloudflare Pages estiver ligado ao mesmo repositório, herda tudo sem configuração extra.
