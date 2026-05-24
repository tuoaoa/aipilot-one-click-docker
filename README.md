# aipilot-one-click-docker 🐳

> **Bilingual:** [Tiếng Việt](#tiếng-việt) | [English](#english)

---

## Tiếng Việt

**aipilot-one-click-docker** cung cấp giải pháp triển khai tự lưu trữ (self-hosting) nhanh chóng hệ thống đồng bộ hóa và lưu trữ context cục bộ cho AIPILOT.VN.

### 💡 Tính năng nổi bật
* **Kích hoạt trong 1 Click:** Khởi động toàn bộ hạ tầng với Docker Compose.
* **Cơ sở dữ liệu cục bộ siêu tốc:** Chạy bộ nhớ đệm SQLite và Redis để lưu trữ mã băm MD5 và cấu trúc tệp cục bộ nhằm tối đa hóa tốc độ phản hồi.
* **Đồng bộ ngầm:** Tự động kết nối, tối ưu hóa và đẩy dữ liệu cấu trúc cần thiết lên Global Pool an toàn.

### 🛠️ Hướng dẫn khởi động nhanh

Yêu cầu máy tính của bạn đã được cài đặt sẵn Docker và Docker Compose.

1. **Khởi chạy container:**
   ```bash
   docker-compose up -d
   ```
2. **Kiểm tra trạng thái hệ thống:**
   ```bash
   docker-compose ps
   ```

Toàn bộ dịch vụ đồng bộ hóa sẽ chạy ngầm tại cổng mặc định của bạn. Hãy truy cập bảng điều khiển [AIPILOT.VN](https://aipilot.vn) để theo dõi các số liệu nén trực quan.

---

## English

**aipilot-one-click-docker** provides an instant, self-hosted deployment of the localized caching and syncing stack for the AIPILOT.VN environment.

### 💡 Key Features
* **1-Click Spin-Up:** Instantly run the entire pruning infrastructure with standard Docker Compose.
* **High-Speed Local Storage:** Employs ultra-fast local memory cache substrates to catalog MD5 structural fingerprints.
* **Background Synchronization:** Seamlessly streams high-level code metadata to the Global Pool for maximum context savings.

### 🛠️ Quick Start Guide

Ensure that you have Docker and Docker Compose installed.

1. **Spin up the stack:**
   ```bash
   docker-compose up -d
   ```
2. **Verify running containers:**
   ```bash
   docker-compose ps
   ```

The synchronization engine will now run silently in the background. Visit [AIPILOT.VN](https://aipilot.vn) to view your token compression metrics in real-time.

---

⚡ Engineered for next-gen contextual prunings. Powered by **[AIPILOT.VN](https://aipilot.vn)**.
