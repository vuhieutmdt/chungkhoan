# Tín hiệu nến - GMD, ACV, PLX, STB, GVR

1. Đẩy repo lên GitHub, nối với Netlify (publish = `site`, không cần build command).
2. GitHub → Actions → "Cập nhật dữ liệu" → Run workflow (lần đầu chạy tay để có dữ liệu).
3. Thử cục bộ: `pip install -r requirements.txt && python scripts/fetch_data.py`
   (hoặc `--demo` để dùng dữ liệu giả), rồi `npx serve site`.
4. Thêm mã: sửa `SYMBOLS` trong `scripts/fetch_data.py`.
