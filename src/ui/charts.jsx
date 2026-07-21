import React from 'react';

// ----------------------------------------------------------------------------
// Lightweight SVG charts — no dependencies. accent via CSS var --accent-hex.
// ----------------------------------------------------------------------------
const { useState: useStateC } = React;

function useAccent() {
  // read computed accent hex from CSS var, fallback blue
  if (typeof window === 'undefined') return '#2A6FDB';
  const v = getComputedStyle(document.documentElement).getPropertyValue('--accent-hex').trim();
  return v || '#2A6FDB';
}

// Smooth area + line chart
function AreaChart({ data, height = 180, valueKey = 'v', labelKey = 'm', format = (n) => n, yAxis = false, refLine = null, refColor = '#1F8A5B', refLabel = '' }) {
  const accent = useAccent();
  const [hover, setHover] = useStateC(null);
  const w = 560, h = height, pad = { t: 16, r: 12, b: 28, l: yAxis ? 38 : 12 };
  const vals = data.map((d) => d[valueKey]);
  const domain = refLine != null ? [...vals, refLine] : vals;
  const max = Math.max(...domain) * 1.15, min = Math.min(...domain) * 0.85;
  const span = (max - min) || 1;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const x = (i) => (data.length === 1 ? pad.l + iw / 2 : pad.l + (iw * i) / (data.length - 1));
  const y = (v) => pad.t + ih - (ih * (v - min)) / span;
  const pts = data.map((d, i) => [x(i), y(d[valueKey])]);
  const line = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ');
  const area = `${line} L${pts[pts.length - 1][0]},${pad.t + ih} L${pts[0][0]},${pad.t + ih} Z`;
  const gid = 'ag' + valueKey;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((g, i) => (
        <line key={i} x1={pad.l} x2={w - pad.r} y1={pad.t + ih * g} y2={pad.t + ih * g} className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="1" />
      ))}
      {yAxis && [0, 0.25, 0.5, 0.75, 1].map((g, i) => (
        <text key={i} x={pad.l - 6} y={pad.t + ih * g + 3} textAnchor="end" className="fill-zinc-400 text-[10px]">{Math.round(min + (max - min) * (1 - g))}</text>
      ))}
      <path d={area} fill={`url(#${gid})`} />
      <path d={line} fill="none" stroke={accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {refLine != null && (
        <g>
          <line x1={pad.l} x2={w - pad.r} y1={y(refLine)} y2={y(refLine)} stroke={refColor} strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={w - pad.r} y={y(refLine) - 5} textAnchor="end" className="text-[10px] font-medium" fill={refColor}>{refLabel ? `${refLabel} ` : ''}{refLine} kg</text>
        </g>
      )}
      {pts.map((p, i) => (
        <g key={i}>
          <rect x={x(i) - iw / data.length / 2} y={pad.t} width={iw / data.length} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
          {hover === i && <line x1={p[0]} x2={p[0]} y1={pad.t} y2={pad.t + ih} className="stroke-zinc-300 dark:stroke-zinc-600" strokeDasharray="3 3" />}
          <circle cx={p[0]} cy={p[1]} r={hover === i ? 5 : 0} fill={accent} stroke="white" strokeWidth="2" />
          <text x={x(i)} y={h - 8} textAnchor="middle" className="fill-zinc-400 text-[11px]">{data[i][labelKey]}</text>
        </g>
      ))}
      {hover !== null && (
        <g>
          <rect x={Math.min(Math.max(pts[hover][0] - 34, 0), w - 68)} y={pts[hover][1] - 30} width="68" height="22" rx="6" className="fill-zinc-900 dark:fill-white" />
          <text x={Math.min(Math.max(pts[hover][0], 34), w - 34)} y={pts[hover][1] - 15} textAnchor="middle" className="fill-white dark:fill-zinc-900 text-[11px] font-semibold">{format(data[hover][valueKey])}</text>
        </g>
      )}
    </svg>
  );
}

// Multi-series line chart (one line per série). `series`: [{ name, color, values:(number|null)[] }].
// `values` alinhado com `labels` (x). Cada linha tem área preenchida (cor da série) para
// ser legível. Com 1 só treino o ponto fica na ponta esquerda e o nível estende-se em
// banda; com mais treinos os pontos dividem-se ao longo da largura.
function LineChart({ labels, series, height = 220, format = (n) => n, refLine = null, refColor = '#1F8A5B', refLabel = '', label = 'Gráfico de linhas' }) {
  const accent = useAccent();
  const [hover, setHover] = useStateC(null);
  const w = 560, h = height, pad = { t: 16, r: 12, b: 28, l: 40 };
  const all = series.flatMap((s) => s.values).filter((v) => v != null);
  if (all.length === 0) return null;
  const domain = refLine != null ? [...all, refLine] : all;
  const max = Math.max(...domain) * 1.12, min = Math.min(...domain) * 0.9;
  const span = (max - min) || 1;
  const n = labels.length;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const single = n <= 1;
  // 1 treino → à esquerda (ponta); vários → divididos ao longo da largura.
  const x = (i) => (single ? pad.l : pad.l + (iw * i) / (n - 1));
  const y = (v) => pad.t + ih - (ih * (v - min)) / span;
  const baseline = pad.t + ih, rightX = w - pad.r;
  // Linha + área (ignora nulls, ligando os pontos presentes). Com 1 ponto, estende
  // uma banda plana até à direita para se ver o nível.
  const buildPaths = (values) => {
    const pts = [];
    values.forEach((v, i) => { if (v != null) pts.push([x(i), y(v)]); });
    if (pts.length === 0) return null;
    if (pts.length === 1) {
      const [px, py] = pts[0];
      const line = `M${px},${py} L${rightX},${py}`;
      return { line, area: `${line} L${rightX},${baseline} L${px},${baseline} Z`, dots: pts };
    }
    let line = '';
    pts.forEach((p, i) => { line += `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]} `; });
    return { line: line.trim(), area: `${line} L${pts[pts.length - 1][0]},${baseline} L${pts[0][0]},${baseline} Z`, dots: pts };
  };
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)} role="img" aria-label={label}>
      {[0.25, 0.5, 0.75, 1].map((g, i) => (
        <line key={i} x1={pad.l} x2={w - pad.r} y1={pad.t + ih * g} y2={pad.t + ih * g} className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="1" />
      ))}
      {[0, 0.25, 0.5, 0.75, 1].map((g, i) => (
        <text key={i} x={pad.l - 6} y={pad.t + ih * g + 3} textAnchor="end" className="fill-zinc-400 text-[10px]">{Math.round(min + (max - min) * (1 - g))}</text>
      ))}
      {refLine != null && (
        <g>
          <line x1={pad.l} x2={w - pad.r} y1={y(refLine)} y2={y(refLine)} stroke={refColor} strokeWidth="1.5" strokeDasharray="5 4" />
          <text x={w - pad.r} y={y(refLine) - 5} textAnchor="end" className="text-[10px] font-medium" fill={refColor}>{refLabel ? `${refLabel} ` : ''}{refLine} kg</text>
        </g>
      )}
      {series.map((s, si) => {
        const p = buildPaths(s.values);
        if (!p) return null;
        const col = s.color || accent;
        const dim = hover !== null && hover !== si;
        return (
          <g key={si} opacity={dim ? 0.25 : 1} style={{ transition: 'opacity .15s' }}>
            <path d={p.area} fill={col} fillOpacity={dim ? 0.06 : 0.16} />
            <path d={p.line} fill="none" stroke={col} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            {p.dots.map((d, i) => (
              <circle key={i} cx={d[0]} cy={d[1]} r={hover === si ? 4 : 2.5} fill={col} stroke="white" strokeWidth="1.5" />
            ))}
          </g>
        );
      })}
      {labels.map((lab, i) => (
        <text key={i} x={x(i)} y={h - 8} textAnchor={single ? 'start' : 'middle'} className="fill-zinc-400 text-[11px]">{lab}</text>
      ))}
      {/* faixas invisíveis: hover destaca a série */}
      {series.map((s, si) => (
        <rect key={'h' + si} x={pad.l} y={pad.t + (ih / series.length) * si} width={iw} height={ih / series.length} fill="transparent" onMouseEnter={() => setHover(si)} />
      ))}
    </svg>
  );
}

// Vertical bar chart
function BarChart({ data, height = 180, valueKey = 'v', labelKey = 'd', format = (n) => n }) {
  const accent = useAccent();
  const [hover, setHover] = useStateC(null);
  const w = 560, h = height, pad = { t: 16, r: 8, b: 28, l: 8 };
  const max = Math.max(...data.map((d) => d[valueKey])) * 1.15;
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b;
  const bw = (iw / data.length) * 0.55;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} onMouseLeave={() => setHover(null)}>
      {[0.25, 0.5, 0.75, 1].map((g, i) => (
        <line key={i} x1={pad.l} x2={w - pad.r} y1={pad.t + ih * g} y2={pad.t + ih * g} className="stroke-zinc-100 dark:stroke-zinc-800" strokeWidth="1" />
      ))}
      {data.map((d, i) => {
        const bh = (ih * d[valueKey]) / max;
        const bx = pad.l + (iw / data.length) * i + (iw / data.length - bw) / 2;
        const by = pad.t + ih - bh;
        return (
          <g key={i} onMouseEnter={() => setHover(i)}>
            <rect x={bx} y={by} width={bw} height={bh} rx="5" fill={accent} opacity={hover === null || hover === i ? 1 : 0.35} style={{ transition: 'opacity .15s' }} />
            <text x={bx + bw / 2} y={h - 8} textAnchor="middle" className="fill-zinc-400 text-[11px]">{d[labelKey]}</text>
            {hover === i && <text x={bx + bw / 2} y={by - 6} textAnchor="middle" className="fill-zinc-700 dark:fill-zinc-200 text-[11px] font-semibold">{format(d[valueKey])}</text>}
          </g>
        );
      })}
    </svg>
  );
}

// Donut chart with legend
function DonutChart({ data, size = 150, label = 'Gráfico em donut' }) {
  const total = data.reduce((s, d) => s + d.v, 0);
  const r = size / 2 - 12, cx = size / 2, cy = size / 2, sw = 18;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <div className="flex items-center gap-5">
      <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }} className="-rotate-90" role="img" aria-label={label}>
        <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} className="stroke-zinc-100 dark:stroke-zinc-800" />
        {data.map((d, i) => {
          const len = (d.v / total) * C;
          const seg = <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={d.cor} strokeWidth={sw} strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} strokeLinecap="round" />;
          acc += len;
          return seg;
        })}
      </svg>
      <div className="flex flex-col gap-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.cor }} />
            <span className="text-zinc-600 dark:text-zinc-300">{d.nome}</span>
            <span className="ml-auto font-semibold tabular-nums text-zinc-900 dark:text-white">{d.v}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tiny sparkline for KPI cards
function Sparkline({ data, color, width = 90, height = 32, up = true }) {
  const accent = useAccent();
  const c = color || accent;
  const max = Math.max(...data), min = Math.min(...data);
  const x = (i) => (width * i) / (data.length - 1);
  const y = (v) => height - 2 - ((height - 4) * (v - min)) / (max - min || 1);
  const line = data.map((v, i) => (i === 0 ? `M${x(i)},${y(v)}` : `L${x(i)},${y(v)}`)).join(' ');
  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width, height }} className="overflow-visible">
      <path d={line} fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity={up ? 1 : 0.5} />
    </svg>
  );
}

// Heatmap dia × hora (ocupação). data: [{ dayOfWeek, hour, count }]. Cor = intensidade (accent).
function Heatmap({ data }) {
  const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const order = [1, 2, 3, 4, 5, 6, 0];
  const hours = [...new Set(data.map((d) => d.hour))].sort((a, b) => a - b);
  const map = new Map();
  let max = 0;
  data.forEach((d) => { map.set(`${d.dayOfWeek}-${d.hour}`, d.count); if (d.count > max) max = d.count; });
  if (!hours.length) return <p className="text-sm text-zinc-400">Sem marcações no período.</p>;
  return (
    <div className="overflow-x-auto" role="img" aria-label="Mapa de ocupação por dia da semana e hora">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `auto repeat(${hours.length}, minmax(18px, 1fr))` }}>
        <div />
        {hours.map((h) => <div key={h} className="text-[10px] text-zinc-400 text-center">{h}h</div>)}
        {order.map((dow, ri) => (
          <React.Fragment key={dow}>
            <div className="text-[11px] text-zinc-500 pr-2 flex items-center">{dayNames[ri]}</div>
            {hours.map((h) => {
              const c = map.get(`${dow}-${h}`) ?? 0;
              const op = max > 0 ? 0.15 + 0.85 * (c / max) : 0;
              return (
                <div
                  key={h}
                  title={`${dayNames[ri]} ${h}h — ${c} marcaç${c === 1 ? 'ão' : 'ões'}`}
                  className={`aspect-square rounded-sm ${c ? '' : 'bg-zinc-100 dark:bg-zinc-800'}`}
                  style={c ? { backgroundColor: `rgb(var(--accent) / ${op})` } : undefined}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// MRR waterfall. data: [{ period, novo, expansao, contracao, perdido, liquido }].
// Barra verde = ganho (novo+expansão), vermelha = perda (contração+perdido), net por baixo.
function Waterfall({ data, format = (n) => n }) {
  const ups = data.map((d) => (d.novo || 0) + (d.expansao || 0));
  const downs = data.map((d) => Math.abs((d.contracao || 0) + (d.perdido || 0)));
  const max = Math.max(1, ...ups, ...downs);
  return (
    <div className="flex items-end gap-2 h-48" role="img" aria-label="Movimento mensal do MRR: ganhos (novo e expansão) versus perdas">
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-[24px]">
          <div className="w-full flex items-end justify-center gap-0.5 h-36">
            <div className="w-1/2 rounded-t bg-emerald-500/90" title={`Ganho ${format(ups[i])}`} style={{ height: `${Math.max(2, (ups[i] / max) * 100)}%` }} />
            <div className="w-1/2 rounded-t bg-red-400/90" title={`Perda ${format(downs[i])}`} style={{ height: `${Math.max(2, (downs[i] / max) * 100)}%` }} />
          </div>
          <span className="text-[9px] text-zinc-400">{String(d.period).slice(5)}</span>
          <span className={`text-[10px] font-semibold tabular-nums ${d.liquido >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
            {d.liquido >= 0 ? '+' : ''}{format(d.liquido)}
          </span>
        </div>
      ))}
    </div>
  );
}

export { AreaChart, LineChart, BarChart, DonutChart, Sparkline, Heatmap, Waterfall };
