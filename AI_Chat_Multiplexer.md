# AI Chat Multiplexer — Mô tả dự án

## Tổng quan

**Tên dự án:** AI Chat Multiplexer  
**Loại app:** Desktop app (Tauri + React)  
**Đối tượng:** Người dùng làm việc nhiều với AI chat, cần xử lý song song nhiều cuộc hội thoại cùng lúc.

---

## Vấn đề

Khi làm việc với các dịch vụ AI chat (Claude, ChatGPT, Gemini, Perplexity...), người dùng phải chờ AI phản hồi. Để tận dụng thời gian chờ, họ mở thêm nhiều tab — dẫn đến hàng chục tab lộn xộn, liên tục chuyển qua lại và mất tập trung.

---

## Giải pháp

Một ứng dụng desktop chia một cửa sổ thành nhiều ô chat AI cùng lúc — giống như cách lập trình viên chia terminal thành nhiều cửa sổ nhỏ để làm song song.

---

## Tính năng cần có

### 1. Chia màn hình thành nhiều ô
- Mặc định hiển thị dạng lưới (ví dụ: 2x2)
- Người dùng có thể thêm / xóa ô tùy ý
- Kéo thả để thay đổi kích thước từng ô

### 2. Mỗi ô là một webview độc lập
- Nhúng URL do người dùng tự đặt (claude.ai, chatgpt.com, gemini.google.com...)
- Mỗi ô có session / cookie riêng biệt → đăng nhập tài khoản khác nhau không bị trộn lẫn

### 3. Tab chat bên trong mỗi ô
- Mỗi ô có thể chia thêm thành nhiều tab chat nhỏ bên trong
- Ví dụ: 1 ô Claude có thể mở 3 đoạn chat song song trong cùng 1 tài khoản
- Chuyển qua lại giữa các tab bằng thanh tab nhỏ phía trên ô

### 4. Lưu trạng thái
- Lưu lại cấu hình layout (số ô, kích thước, vị trí)
- Lưu danh sách URL và các tab chat bên trong
- Khôi phục đúng trạng thái khi mở lại app

---

## Hình dung giao diện

```
┌──────────────────────┬──────────────────────┐
│ [Chat 1] [Chat 2]    │ ChatGPT — Tài khoản 1│
│ Claude — Tài khoản 1 │                      │
│                      ├──────────────────────┤
│                      │ Gemini               │
└──────────────────────┴──────────────────────┘
```

> Ô trái: 1 tài khoản Claude, đang mở 2 đoạn chat song song qua tab nhỏ bên trong.  
> Ô trên phải: ChatGPT tài khoản 1.  
> Ô dưới phải: Gemini.

---

## Ưu tiên kỹ thuật

- **Nhẹ** — không chiếm nhiều RAM, khởi động nhanh
- **Độc lập session** — mỗi ô / tab phải tách biệt hoàn toàn về cookie và storage
- **Ổn định** — không bị crash khi mở nhiều webview cùng lúc

---

## Team thực hiện

**Full-stack Web App Team** (4 terminal members + Director)

| Thành viên | Vai trò |
|------------|---------|
| UX Product Designer | Thiết kế layout chia ô, trải nghiệm người dùng |
| React Frontend | Build giao diện split-panel, tab chat, kéo thả |
| API Backend | Xử lý Tauri commands, quản lý session độc lập |
| Data Modeler | Cấu trúc lưu config layout và danh sách URL |
| Director | Điều phối tiến độ, đảm bảo QA |
