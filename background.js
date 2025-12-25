// background.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "proxyFetch") {
    fetch(request.url)
      .then(response => response.blob())
      .then(blob => {
        // Chuyển blob thành Base64 để gửi về popup
        return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
      })
      .then(base64Data => {
        sendResponse({ success: true, data: base64Data });
      })
      .catch(error => {
        sendResponse({ success: false, error: error.message });
      });
    return true; // Giữ kết nối để đợi xử lý bất đồng bộ
  }
});