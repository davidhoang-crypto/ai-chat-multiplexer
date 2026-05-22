# AI Chat Multiplexer

Desktop app để chạy nhiều phiên chat AI song song trong một cửa sổ duy nhất, với hệ thống profile độc lập (giống Chrome profile) cho phép đăng nhập nhiều tài khoản cùng lúc.

![Status](https://img.shields.io/badge/status-active-success) ![Tauri](https://img.shields.io/badge/Tauri-2-orange) ![React](https://img.shields.io/badge/React-19-blue) ![License](https://img.shields.io/badge/license-MIT-green)

---

## Vấn đề

Khi làm việc với nhiều dịch vụ AI (Claude, ChatGPT, Gemini, Perplexity, DeepSeek...), người dùng thường phải chờ AI phản hồi nên mở thêm nhiều tab — dẫn đến hàng chục tab lộn xộn, liên tục chuyển qua lại và mất tập trung. Ngoài ra, không có cách nào dễ dàng để tách biệt session đăng nhập (vd: tài khoản Work vs Personal).

## Giải pháp

Một ứng dụng desktop chia một cửa sổ thành nhiều ô chat AI cùng lúc — giống cách lập trình viên chia terminal thành nhiều cửa sổ nhỏ để làm song song. Mỗi pane là một native webview thật, có thể đặt URL bất kỳ và gắn với một profile để cô lập cookie/storage.

---

## Tính năng

### Workspace
- Tạo nhiều **workspace** (ví dụ: "Work", "Personal", "Research"), mỗi workspace có panes và layout riêng
- Switcher dropdown để chuyển qua lại nhanh
- Đổi tên / xóa workspace bằng modal trong app
- Dữ liệu lưu vào `localStorage`, khôi phục đúng trạng thái khi mở lại

### Layout linh hoạt
- 4 chế độ: Focus (1 cột), 2 cột, 3 cột, 4 cột
- Tự động cap số cột theo số panes (không bao giờ chừa cột trống)
- Phóng to (focus mode) một pane để chiếm toàn bộ màn hình
- Drag-and-drop để hoán đổi vị trí panes

### Profile system (Chrome-style)
- Mỗi profile chứa **một bộ cookie/storage cho mọi site** — không gắn với 1 AI cụ thể
- Tạo profile "Work", "Personal" — đăng nhập 1 lần dùng cho mọi site (ChatGPT, Claude, Google...)
- Dùng cùng profile trong nhiều pane để chia sẻ session
- Đóng pane KHÔNG xóa profile → mở pane mới với profile cũ → vào thẳng không cần login lại
- Chip `@ProfileName` hiển thị trước URL trong mỗi pane

### Tab trong pane
- Mỗi pane có thanh tab nhỏ phía trên
- Mở nhiều cuộc chat song song trong cùng tài khoản
- Ô URL có thể nhập trực tiếp đường dẫn tùy ý

### Native webview thật (Tauri)
- Dùng `tauri::WebviewBuilder` thay vì `<iframe>` → không bị chặn bởi `X-Frame-Options`/CSP
- Mỗi profile có `data_directory` riêng → cookie/storage cô lập hoàn toàn
- React layer điều khiển vị trí webview qua tọa độ DOM (`getBoundingClientRect`)

### Khác
- Dark / light theme với palette gold (cream + bronze)
- Modal đẹp thay cho `prompt`/`confirm` mặc định trình duyệt
- Auto migration giữa các phiên bản state (v2 → v3 → v4 → v5)

---

## Stack kỹ thuật

| Layer | Công nghệ |
|---|---|
| Frontend | React 19 + TypeScript + Vite 7 |
| Backend | Tauri 2 (Rust) |
| Storage | `localStorage` (state) + filesystem (`pane-sessions/<profile_id>/` cho cookie) |
| Style | Plain CSS (không Tailwind/component lib) |
| Icons | Custom SVG inline (Lucide-style) |

---

## Cấu trúc project

```
.
├── src/                    # React frontend
│   ├── App.tsx             # Toàn bộ UI + state logic
│   ├── App.css             # Styling (light + dark theme)
│   ├── Icons.tsx           # SVG icon components
│   ├── main.tsx            # React entry point
│   └── vite-env.d.ts
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs          # Tauri commands (webview management)
│   │   └── main.rs
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   └── icons/
├── public/                 # Static assets
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
└── README.md
```

---

## Yêu cầu hệ thống

- **Node.js** 18+ và npm
- **Rust** stable (cài qua https://rustup.rs/)
- **Windows / macOS / Linux** (Tauri đa nền tảng)

Trên Windows cần thêm Microsoft Edge WebView2 Runtime (thường đã có sẵn trên Windows 10/11).

---

## Cài đặt và chạy

### Lần đầu

```bash
# Cài dependencies frontend
npm install

# Tauri CLI sẽ tự cài Rust dependencies lần đầu chạy
```

### Chạy dev mode (desktop app)

```bash
npm run tauri dev
```

Lệnh này khởi động Vite dev server (`http://localhost:1420`) và mở cửa sổ Tauri tự động.

### Chạy chỉ web preview (không có native webview)

```bash
npm run dev
```

Mở trình duyệt tại `http://localhost:1420`. Lưu ý: trên web mode, các AI sites sẽ bị chặn iframe — chỉ thấy fallback view. Để test thật phải chạy Tauri.

### Build production

```bash
npm run tauri build
```

Output nằm ở `src-tauri/target/release/bundle/`.

---

## Cách hoạt động (kiến trúc)

### Native webview overlay

App không dùng `<iframe>` cho các AI sites (vì hầu hết chặn bằng `X-Frame-Options: DENY`). Thay vào đó:

1. React render một `<div className="webview-shell">` rỗng làm "khung"
2. Mỗi animation frame, React đọc `getBoundingClientRect()` của khung
3. Gọi Tauri command `native_webview_upsert(profile_id, x, y, width, height, url)` để định vị/tạo webview thật của hệ điều hành
4. Webview overlay chính xác lên khung React
5. Khi mở menu / drag pane → tự động `native_webview_hide` để menu không bị che

### Profile session isolation

Mỗi profile có một thư mục độc lập trong app data directory:

```
%APPDATA%/com.an.aichatmultiplexer/pane-sessions/
├── prof-default/         # Profile "Default"
└── prof-work-<id>/       # Profile "Work"
```

Khi tạo webview, Tauri set `data_directory` về thư mục tương ứng → cookie, localStorage, IndexedDB, cache đều cô lập theo profile.

### State persistence

- `ai-chat-multiplexer-state-v5` — toàn bộ workspaces, panes, profiles
- `ai-chat-multiplexer-theme` — dark / light
- Migration tự động khi user nâng cấp từ v2/v3/v4

---

## Lưu ý bảo mật

- CSP để `null` trong `tauri.conf.json` để load được nhiều domain bên ngoài → đây là tradeoff cần thiết cho ứng dụng kiểu này
- Mỗi profile cô lập hoàn toàn → không có cookie cross-contamination
- Không gửi data ra ngoài (app hoàn toàn local-first)

---

## Tác giả

Made by **An** với sự hỗ trợ của AI coding assistant.

## License

MIT — xem `LICENSE` để biết chi tiết.
