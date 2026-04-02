// popup.js
const imagesContainer = document.getElementById('images');
const refreshBtn = document.getElementById('refresh');
const downloadAllBtn = document.getElementById('downloadAll');

function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = browser.i18n.getMessage(key);
  });
}

// FIX LỖI SCOPE: Đảm bảo urlsToDownload nằm đúng trong hàm click
downloadAllBtn.addEventListener('click', () => {
  const images = document.querySelectorAll('.image-item img');
  const urlsToDownload = []; // Khai báo ở đây

  images.forEach((img) => {
    const url = img.src;
    // Loại bỏ cái placeholder xoay xoay của cậu ra
    if (url && !url.includes('placeholder.gif')) {
      urlsToDownload.push(url);
    }
  });

  if (urlsToDownload.length > 0) {
    // Gửi sang background.js để tải ngầm, chấp cả việc đóng popup
    browser.runtime.sendMessage({ 
      action: "downloadAllImages", 
      urls: urlsToDownload 
    }, (response) => {
      if (response && response.success) {
        console.log("Đã gửi lệnh tải cho background!");
      }
    });
  }
});

async function scanImages() {
  imagesContainer.innerHTML = `<div class="empty">${chrome.i18n.getMessage('loadingText')}</div>`;
  downloadAllBtn.style.opacity = '50%'; 
  
  let targetTabId;
  const params = new URLSearchParams(window.location.search);
  
  if (params.has('tabId')) {
    targetTabId = parseInt(params.get('tabId'));
  } else {
    // Đổi tên biến thành activeTab cho đỡ đụng hàng với code cũ
    const [activeTab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      targetTabId = activeTab.id;
    }
  }

  // Chặn ngay lập tức nếu không có ID
  if (!targetTabId) {
    imagesContainer.innerHTML = `<div class="empty">Không tìm thấy tab để quét!</div>`;
    return;
  }

  try {
    const injection = await browser.scripting.executeScript({
      target: { tabId: targetTabId }, // Vẫn dùng cơ chế cũ, chỉ thay ID chuẩn vào đây
      func: () => {
        const results = [];
        const seen = new Set();
        
        document.querySelectorAll('img').forEach(img => {
          const src = img.currentSrc || img.src;
          if (src && !seen.has(src)) {
            seen.add(src);
            results.push({ src, alt: img.alt || 'Image' });
          }
        });

        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundImage;
          if (bg && bg !== 'none') {
            const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1]) {
              let url = match[1];
              if (url.startsWith('//')) url = window.location.protocol + url;
              else if (url.startsWith('/')) url = window.location.origin + url;
              else if (!url.startsWith('http') && !url.startsWith('data:') && !url.startsWith('blob:')) {
                 url = new URL(url, window.location.href).href;
              }
              if (!seen.has(url)) {
                seen.add(url);
                results.push({ src: url, alt: 'CSS Background' });
              }
            }
          }
        });
        return results;
      }
    });

    const results = (injection && injection[0] && injection[0].result) || [];
    imagesContainer.innerHTML = '';

    if (results.length === 0) {
      imagesContainer.innerHTML = `<div class="empty">${chrome.i18n.getMessage('noImages')}</div>`;
      downloadAllBtn.style.opacity = '50%';
      return;
    }

    downloadAllBtn.style.opacity = '100%';

    results.forEach(img => {
      const wrapper = document.createElement('div');
      wrapper.className = 'image-item';
      const thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = "placeholder.gif";
      thumb.title = img.src;

      browser.runtime.sendMessage(
        { action: "proxyFetch", url: img.src },
        (response) => {
          if (response && response.success) {
            thumb.src = response.data;
          } else {
            thumb.src = "placeholder.gif"; 
          }
        }
      );

      thumb.addEventListener('click', () => browser.tabs.create({ url: img.src }));
      const tiny = document.createElement('div');
      tiny.className = 'small-src';
      tiny.textContent = img.src;
      tiny.title = img.src;

      wrapper.appendChild(thumb);
      wrapper.appendChild(tiny);
      imagesContainer.appendChild(wrapper);
    });

  } catch (err) {
    imagesContainer.innerHTML = `<div class="empty">Error: ${err.message}</div>`;
  }
}

const pinBtn = document.getElementById('pinBtn');
const params = new URLSearchParams(window.location.search);

// Kiểm tra xem có đang ở cửa sổ Pin không
if (params.has('tabId')) {
  pinBtn.textContent = '✖'; // Đổi icon thành nút Đóng
  pinBtn.title = browser.i18n.getMessage("unpinButton"); // Tooltip thay đổi
  pinBtn.addEventListener('click', () => {
    window.close(); // Đang là cửa sổ nổi thì click là đóng luôn
  });
} else {
  pinBtn.title = browser.i18n.getMessage("pinButton"); // Tooltip thay đổi
  // Đang ở popup thường thì giữ nguyên logic Pin
  pinBtn.addEventListener('click', async () => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      browser.windows.create({
        url: `popup.html?tabId=${tab.id}`,
        type: "popup",
        width: 440,
        height: 650
      }, () => {
        window.close();
      });
    }
  });
}
updateUI();
refreshBtn.addEventListener('click', scanImages);
scanImages();