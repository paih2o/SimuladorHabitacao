// Atualiza zonas.json com dados do INE
// Indicador 0012234 — Mediana do valor das vendas por m² de alojamentos
// familiares nos últimos 12 meses (€/m²), trimestral, por município.
// Fonte aberta e gratuita: https://www.ine.pt (API JSON oficial)
//
// Corre no GitHub Actions (Node 20, fetch nativo). Zero dependências.

import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const VARCD = '0012234';
const URL = `https://www.ine.pt/ine/json_indicador/pindica.jsp?op=1&varcd=${VARCD}&lang=PT`;

// Municípios a acompanhar — corresponder por NOME (robusto a mudanças NUTS).
// Acrescenta/remove linhas à vontade; o id liga à tabela de zonas da app.
const MUNICIPIOS = [
  { id: 'mafra',        match: 'Mafra',         nome: 'Mafra (concelho · INE)' },
  { id: 'torresvedras', match: 'Torres Vedras', nome: 'Torres Vedras (concelho · INE)' },
  { id: 'lisboa',       match: 'Lisboa',        nome: 'Lisboa (concelho · INE)' },
  { id: 'sintra',       match: 'Sintra',        nome: 'Sintra (concelho · INE)' },
];

// Converte uma chave de período do INE em {ano, trimestre}.
// Aceita formatos como "2025T3", "T3 2025", "3.º Trimestre de 2025", "202503"…
function parsePeriodo(key) {
  let m = key.match(/(\d{4}).*?T\s*(\d)/i) || key.match(/T\s*(\d).*?(\d{4})/i);
  if (m) {
    const a = m[1].length === 4 ? +m[1] : +m[2];
    const t = m[1].length === 4 ? +m[2] : +m[1];
    if (t >= 1 && t <= 4) return { ano: a, tri: t, key };
  }
  m = key.match(/(\d)\s*\.?\s*[ºo]?\s*Trimestre\D*(\d{4})/i);
  if (m) return { ano: +m[2], tri: +m[1], key };
  m = key.match(/^(\d{4})(0[1-4])$/); // ex: 202503
  if (m) return { ano: +m[1], tri: +m[2], key };
  return null;
}

function indicePeriodo(p) { return p.ano * 4 + p.tri; }

// Procura o valor de um município numa lista de registos do INE
function valorMunicipio(registos, nomeMatch) {
  if (!Array.isArray(registos)) return null;
  // Match exato do nome (geodsg) para evitar "Lisboa" apanhar "AM Lisboa"
  const r = registos.find(x => (x.geodsg || '').trim() === nomeMatch);
  if (!r) return null;
  const v = parseFloat(String(r.valor).replace(',', '.'));
  return Number.isFinite(v) ? v : null;
}

async function main() {
  console.log('A obter dados do INE…');
  const res = await fetch(URL, { headers: { 'Accept': 'application/json' } });
  if (!res.ok) throw new Error(`INE respondeu ${res.status}`);
  const data = await res.json();
  const ind = Array.isArray(data) ? data[0] : data;
  const pref = ind && ind.Pref;
  if (!pref || typeof pref !== 'object') throw new Error('Estrutura inesperada da resposta do INE');

  // Ordenar períodos e escolher o mais recente + homólogo (4 trimestres antes)
  const periodos = Object.keys(pref)
    .map(parsePeriodo)
    .filter(Boolean)
    .sort((a, b) => indicePeriodo(a) - indicePeriodo(b));
  if (periodos.length < 5) throw new Error(`Só ${periodos.length} períodos — insuficiente para variação homóloga`);

  const ultimo = periodos[periodos.length - 1];
  const homologo = periodos.find(p => indicePeriodo(p) === indicePeriodo(ultimo) - 4);
  if (!homologo) throw new Error('Período homólogo (T-4) não encontrado');
  console.log(`Último período: ${ultimo.key} · Homólogo: ${homologo.key}`);

  const zonas = [];
  for (const m of MUNICIPIOS) {
    const vNow = valorMunicipio(pref[ultimo.key], m.match);
    const vAgo = valorMunicipio(pref[homologo.key], m.match);
    if (vNow == null || vAgo == null || vAgo === 0) {
      console.warn(`⚠ ${m.match}: sem dados completos (agora=${vNow}, homólogo=${vAgo}) — ignorado`);
      continue;
    }
    const variacao = (vNow / vAgo - 1) * 100;
    zonas.push({
      id: m.id,
      nome: m.nome,
      m2: Math.round(vNow),
      var: Math.round(variacao * 10) / 10,
      ref: `${ultimo.ano}T${ultimo.tri}`,
    });
    console.log(`  ${m.match}: ${Math.round(vNow)} €/m² · ${variacao.toFixed(1)}% homóloga`);
  }
  if (zonas.length === 0) throw new Error('Nenhum município com dados — não vou escrever ficheiro vazio');

  const out = {
    atualizado: new Date().toISOString().slice(0, 10),
    fonte: 'INE, indicador 0012234 — mediana €/m² das vendas de alojamentos familiares (últimos 12 meses, transações reais)',
    nota: 'Variação homóloga (vs mesmo trimestre do ano anterior). Difere do idealista: o INE usa preços de transação, o idealista preços pedidos.',
    zonas,
  };

  // Só escrever se mudou (evita commits vazios)
  const novo = JSON.stringify(out, null, 2) + '\n';
  if (existsSync('zonas.json')) {
    const antigo = readFileSync('zonas.json', 'utf8');
    const sameData = (() => {
      try {
        const a = JSON.parse(antigo);
        return JSON.stringify(a.zonas) === JSON.stringify(out.zonas);
      } catch { return false; }
    })();
    if (sameData) { console.log('Dados iguais aos existentes — sem alterações.'); return; }
  }
  writeFileSync('zonas.json', novo);
  console.log('zonas.json atualizado ✓');
}

main().catch(err => { console.error('ERRO:', err.message); process.exit(1); });
