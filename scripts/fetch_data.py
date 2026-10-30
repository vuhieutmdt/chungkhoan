"""Lấy nến ngày của các mã bằng vnstock và ghi ra site/data/<MÃ>.json.

Chạy thật:      python scripts/fetch_data.py
Chạy dữ liệu giả để thử giao diện:  python scripts/fetch_data.py --demo
"""
import json
import os
import random
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

SYMBOLS = ["GMD", "ACV", "PLX", "STB", "GVR"]
SOURCE = os.getenv("VNSTOCK_SOURCE", "KBS")  # đổi nếu nguồn lỗi: VCI, ...
LOOKBACK_DAYS = 450                           # ~300 phiên, đủ cho SMA50 + RSI
OUT = Path(__file__).resolve().parent.parent / "site" / "data"


def fetch_real(symbol):
    import pandas as pd
    from vnstock import Quote

    end = date.today()
    start = end - timedelta(days=LOOKBACK_DAYS)
    df = Quote(symbol=symbol, source=SOURCE).history(
        start=start.isoformat(), end=end.isoformat(), interval="1D"
    )
    if df is None or df.empty:
        raise RuntimeError("không có dữ liệu trả về")
    df.columns = [str(c).lower() for c in df.columns]
    df["time"] = pd.to_datetime(df["time"]).dt.strftime("%Y-%m-%d")
    df = df.dropna(subset=["open", "high", "low", "close"])
    df = df.drop_duplicates("time").sort_values("time")
    # Một số nguồn trả giá theo nghìn đồng (vd 60.5) -> đưa về đồng
    scale = 1000 if df["close"].median() < 1000 else 1
    rows = []
    for r in df.itertuples():
        rows.append({
            "time": r.time,
            "open": round(float(r.open) * scale),
            "high": round(float(r.high) * scale),
            "low": round(float(r.low) * scale),
            "close": round(float(r.close) * scale),
            "volume": int(getattr(r, "volume", 0) or 0),
        })
    return rows


def fake(symbol):
    rnd = random.Random(symbol)
    price, d, rows = rnd.uniform(20000, 80000), date.today() - timedelta(days=450), []
    while d <= date.today():
        if d.weekday() < 5:
            o = price
            c = max(1000, o * (1 + rnd.gauss(0.0005, 0.018)))
            h = max(o, c) * (1 + abs(rnd.gauss(0, 0.007)))
            l = min(o, c) * (1 - abs(rnd.gauss(0, 0.007)))
            rows.append({"time": d.isoformat(), "open": round(o), "high": round(h),
                         "low": round(l), "close": round(c),
                         "volume": int(rnd.uniform(5e5, 5e6))})
            price = c
        d += timedelta(days=1)
    return rows


def main():
    demo = "--demo" in sys.argv
    OUT.mkdir(parents=True, exist_ok=True)
    ok = []
    for i, sym in enumerate(SYMBOLS):
        try:
            rows = fake(sym) if demo else fetch_real(sym)
            (OUT / f"{sym}.json").write_text(json.dumps(rows, separators=(",", ":")))
            ok.append(sym)
            print(f"OK   {sym}: {len(rows)} nến, đến {rows[-1]['time']}")
        except Exception as e:  # một mã lỗi không làm hỏng các mã khác
            print(f"LỖI  {sym}: {e}", file=sys.stderr)
        if not demo and i < len(SYMBOLS) - 1:
            time.sleep(4)  # tài khoản khách: 20 request/phút
    if not ok:
        sys.exit("Không lấy được mã nào.")
    meta = {"symbols": ok, "source": "demo" if demo else SOURCE,
            "updated": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    (OUT / "index.json").write_text(json.dumps(meta, ensure_ascii=False))


if __name__ == "__main__":
    main()
