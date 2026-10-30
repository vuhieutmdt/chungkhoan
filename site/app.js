const $ = (s) => document.querySelector(s);
const vnd = (n) => (n == null ? "–" : Math.round(n).toLocaleString("vi-VN"));
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
let chart, current;

async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function init() {
  try {
    const meta = await getJSON("data/index.json");
    const d = new Date(meta.updated);
    $("#updated").textContent = `Dữ liệu cập nhật ${d.toLocaleString("vi-VN")} · nguồn: ${meta.source}`;
    $("#tabs").innerHTML = meta.symbols
      .map((s) => `<button role="tab" data-s="${s}" aria-selected="false">${s}</button>`).join("");
    $("#tabs").addEventListener("click", (e) => e.target.dataset.s && select(e.target.dataset.s));
    const start = meta.symbols.includes(location.hash.slice(1)) ? location.hash.slice(1) : meta.symbols[0];
    select(start);
  } catch (e) {
    $("#panel").innerHTML = `<div class="err">Chưa có dữ liệu. Chạy <code>python scripts/fetch_data.py</code> hoặc kích hoạt workflow trên GitHub rồi tải lại trang.<br><small>${e.message}</small></div>`;
  }
}

async function select(sym) {
  document.querySelectorAll("#tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.s === sym));
  history.replaceState(null, "", "#" + sym);
  try {
    const candles = await getJSON(`data/${sym}.json`);
    current = { sym, candles, a: Analysis.analyze(candles) };
    renderPanel();
    renderChart();
  } catch (e) {
    $("#panel").innerHTML = `<div class="err">Không tải được dữ liệu ${sym}.<br><small>${e.message}</small></div>`;
  }
}

function renderPanel() {
  const { sym, a } = current;
  const up = a.changePct >= 0;
  const pats = a.latestPatterns.length
    ? a.latestPatterns.map((p) => `<li>${p.name}</li>`).join("")
    : "<li>Không có mẫu nào ở phiên gần nhất</li>";
  $("#panel").innerHTML = `
    <div class="head"><span class="sym">${sym}</span><span class="price">${vnd(a.last.close)}</span>
      <span class="chg ${up ? "up" : "down"}">${up ? "+" : ""}${a.changePct.toFixed(2)}%</span></div>
    <div class="sub">Phiên ${a.last.time}</div>
    <div class="badge ${a.tone}">${a.label}</div>
    <div class="sub">Điểm tổng hợp: ${a.score > 0 ? "+" : ""}${a.score} (thang −5 đến +5)</div>
    <h2>Mẫu nến phiên gần nhất</h2><ul>${pats}</ul>
    <h2>Lý do</h2><ul>${a.reasons.map((r) => `<li>${r}</li>`).join("")}</ul>
    <h2>Chỉ báo</h2>
    <dl>
      <dt>SMA20</dt><dd>${vnd(a.sma20)}</dd>
      <dt>SMA50</dt><dd>${vnd(a.sma50)}</dd>
      <dt>RSI(14)</dt><dd>${a.rsi == null ? "–" : a.rsi.toFixed(0)}</dd>
      <dt>Khối lượng / TB20</dt><dd>${a.volRatio == null ? "–" : a.volRatio.toFixed(1) + "x"}</dd>
    </dl>
    <h2>Vùng tham khảo (20 phiên)</h2>
    <dl><dt>Hỗ trợ</dt><dd>${vnd(a.support)}</dd><dt>Kháng cự</dt><dd>${vnd(a.resistance)}</dd></dl>`;
}

function renderChart() {
  const { candles, a } = current;
  if (chart) chart.remove();
  const up = css("--up"), down = css("--down"), ink = css("--muted"), grid = css("--chart-grid");
  chart = LightweightCharts.createChart($("#chart"), {
    autoSize: true,
    layout: { background: { color: "transparent" }, textColor: ink, fontFamily: "Be Vietnam Pro, sans-serif" },
    grid: { vertLines: { color: grid }, horzLines: { color: grid } },
    rightPriceScale: { borderColor: grid }, timeScale: { borderColor: grid },
    localization: { priceFormatter: vnd },
  });
  const cs = chart.addCandlestickSeries({
    upColor: up, downColor: down, borderUpColor: up, borderDownColor: down, wickUpColor: up, wickDownColor: down,
  });
  cs.setData(candles.map(({ time, open, high, low, close }) => ({ time, open, high, low, close })));
  cs.setMarkers(a.markers.map((m) => ({
    time: m.time, position: m.bias === "bull" ? "belowBar" : "aboveBar",
    color: m.bias === "bull" ? up : down, shape: m.bias === "bull" ? "arrowUp" : "arrowDown",
  })));

  const line = (vals, color) => {
    const s = chart.addLineSeries({ color, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false });
    s.setData(candles.map((c, i) => ({ time: c.time, value: vals[i] })).filter((p) => p.value != null));
  };
  line(a.series.sma20, "#2f80ed"); line(a.series.sma50, "#f2994a");

  const vol = chart.addHistogramSeries({ priceFormat: { type: "volume" }, priceScaleId: "" });
  vol.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  vol.setData(candles.map((c) => ({ time: c.time, value: c.volume, color: (c.close >= c.open ? up : down) + "66" })));

  const n = candles.length;
  chart.timeScale().setVisibleLogicalRange({ from: Math.max(0, n - 120), to: n + 3 });
}

matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => current && renderChart());
init();
