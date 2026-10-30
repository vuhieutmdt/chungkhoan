/* Nhận diện mẫu nến + chấm điểm tín hiệu kỹ thuật. Không phụ thuộc thư viện. */
(function (root) {
  const geo = (c) => {
    const top = Math.max(c.open, c.close), bot = Math.min(c.open, c.close);
    return { range: c.high - c.low, body: top - bot, upper: c.high - top, lower: bot - c.low,
             bull: c.close > c.open, bear: c.close < c.open };
  };

  // Xu hướng trước nến i: so giá đóng cửa nến i-1 với 5 phiên trước đó
  function trendBefore(cs, i) {
    if (i < 6) return 0;
    const ch = (cs[i - 1].close - cs[i - 6].close) / cs[i - 6].close;
    return ch > 0.03 ? 1 : ch < -0.03 ? -1 : 0;
  }

  // Trả về các mẫu kết thúc tại nến i
  function detectAt(cs, i) {
    const out = [], c = cs[i], g = geo(c);
    if (g.range <= 0) return out;
    const add = (name, bias, marker) => out.push({ index: i, time: c.time, name, bias, marker });
    const t = trendBefore(cs, i);

    // --- 1 nến ---
    if (g.lower >= 2 * g.body && g.upper <= 0.15 * g.range && g.body >= 0.05 * g.range && t === -1)
      add("Hammer (búa)", "bull", true);
    else if (g.upper >= 2 * g.body && g.lower <= 0.15 * g.range && g.body >= 0.05 * g.range && t === 1)
      add("Shooting Star (sao băng)", "bear", true);
    else if (g.body <= 0.1 * g.range) add("Doji (lưỡng lự)", "neutral", false);

    if (g.body >= 0.9 * g.range) add(g.bull ? "Marubozu tăng" : "Marubozu giảm", g.bull ? "bull" : "bear", false);

    // --- 2 nến ---
    if (i >= 1) {
      const p = cs[i - 1], pg = geo(p), tp = trendBefore(cs, i - 1);
      if (pg.bear && g.bull && c.open <= p.close && c.close >= p.open && g.body > pg.body && tp === -1)
        add("Bullish Engulfing (nhấn chìm tăng)", "bull", true);
      if (pg.bull && g.bear && c.open >= p.close && c.close <= p.open && g.body > pg.body && tp === 1)
        add("Bearish Engulfing (nhấn chìm giảm)", "bear", true);
    }

    // --- 3 nến ---
    if (i >= 2) {
      const a = cs[i - 2], b = cs[i - 1], ag = geo(a), bg = geo(b), ta = trendBefore(cs, i - 2);
      const mid = (a.open + a.close) / 2;
      if (ag.bear && ag.body >= 0.5 * ag.range && bg.body <= 0.3 * ag.body && g.bull && c.close > mid && ta === -1)
        add("Morning Star (sao mai)", "bull", true);
      if (ag.bull && ag.body >= 0.5 * ag.range && bg.body <= 0.3 * ag.body && g.bear && c.close < mid && ta === 1)
        add("Evening Star (sao hôm)", "bear", true);
    }
    return out;
  }

  function sma(arr, n) {
    return arr.map((_, i) => {
      if (i < n - 1) return null;
      let s = 0; for (let k = i - n + 1; k <= i; k++) s += arr[k];
      return s / n;
    });
  }

  function rsi(closes, n = 14) {
    const out = new Array(closes.length).fill(null);
    if (closes.length <= n) return out;
    let gain = 0, loss = 0;
    for (let i = 1; i <= n; i++) {
      const d = closes[i] - closes[i - 1];
      d >= 0 ? (gain += d) : (loss -= d);
    }
    gain /= n; loss /= n;
    out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    for (let i = n + 1; i < closes.length; i++) {
      const d = closes[i] - closes[i - 1];
      gain = (gain * (n - 1) + Math.max(d, 0)) / n;
      loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
    return out;
  }

  function analyze(cs) {
    const n = cs.length, last = cs[n - 1], prev = cs[n - 2];
    const closes = cs.map((c) => c.close);
    const s20 = sma(closes, 20), s50 = sma(closes, 50), r = rsi(closes);
    const vol = cs.map((c) => c.volume);
    const volAvg = sma(vol, 20)[n - 2] || sma(vol, 20)[n - 1]; // TB 20 phiên trước phiên cuối

    // Tất cả mẫu nến (cho đánh dấu trên biểu đồ)
    const all = [];
    for (let i = 0; i < n; i++) all.push(...detectAt(cs, i));

    // Mẫu trong 3 phiên gần nhất
    const recent = all.filter((p) => p.index >= n - 3);
    const reasons = [];
    let score = 0;

    // 1) Mẫu nến (mạnh nhất = gần nhất)
    const dirPatterns = recent.filter((p) => p.bias !== "neutral").sort((a, b) => b.index - a.index);
    let patScore = 0;
    if (dirPatterns.length) {
      const p = dirPatterns[0], age = n - 1 - p.index;
      const w = age === 0 ? 2 : 1;
      patScore = (p.bias === "bull" ? 1 : -1) * w;
      score += patScore;
      reasons.push(`${p.name} ${age === 0 ? "xuất hiện ở phiên gần nhất" : `xuất hiện cách đây ${age} phiên`} (${p.bias === "bull" ? "nghiêng về tăng" : "nghiêng về giảm"}).`);
    } else {
      reasons.push("Không có mẫu nến đảo chiều rõ ràng trong 3 phiên gần nhất.");
    }

    // 2) Xu hướng theo SMA
    if (s50[n - 1] != null) {
      if (last.close > s20[n - 1] && s20[n - 1] > s50[n - 1]) {
        score += 1; reasons.push("Giá nằm trên SMA20 và SMA20 trên SMA50: xu hướng tăng.");
      } else if (last.close < s20[n - 1] && s20[n - 1] < s50[n - 1]) {
        score -= 1; reasons.push("Giá nằm dưới SMA20 và SMA20 dưới SMA50: xu hướng giảm.");
      } else reasons.push("Giá và các đường SMA chưa cho xu hướng rõ ràng.");
    }

    // 3) RSI
    const rv = r[n - 1];
    if (rv != null) {
      if (rv < 30) { score += 1; reasons.push(`RSI ${rv.toFixed(0)} ở vùng quá bán, có thể xuất hiện nhịp hồi.`); }
      else if (rv > 70) { score -= 1; reasons.push(`RSI ${rv.toFixed(0)} ở vùng quá mua, rủi ro điều chỉnh tăng.`); }
      else reasons.push(`RSI ${rv.toFixed(0)} ở vùng trung tính.`);
    }

    // 4) Khối lượng xác nhận mẫu nến
    const volRatio = volAvg ? last.volume / volAvg : null;
    if (patScore !== 0 && volRatio != null) {
      if (volRatio >= 1.3) { score += Math.sign(patScore); reasons.push(`Khối lượng gấp ${volRatio.toFixed(1)} lần trung bình 20 phiên, xác nhận tín hiệu.`); }
      else if (volRatio < 0.7) reasons.push("Khối lượng thấp hơn trung bình, tín hiệu thiếu xác nhận.");
    }

    const label = score >= 2 ? "Tích cực" : score <= -2 ? "Thận trọng" : "Trung lập";
    const tone = score >= 2 ? "up" : score <= -2 ? "down" : "flat";

    const w20 = cs.slice(-20);
    return {
      last, prev, score, label, tone, reasons, volRatio,
      changePct: ((last.close - prev.close) / prev.close) * 100,
      sma20: s20[n - 1], sma50: s50[n - 1], rsi: rv,
      support: Math.min(...w20.map((c) => c.low)),
      resistance: Math.max(...w20.map((c) => c.high)),
      latestPatterns: all.filter((p) => p.index === n - 1),
      markers: all.filter((p) => p.marker),
      series: { sma20: s20, sma50: s50 },
    };
  }

  root.Analysis = { analyze, detectAt, sma, rsi };
  if (typeof module !== "undefined") module.exports = root.Analysis;
})(typeof window !== "undefined" ? window : globalThis);
