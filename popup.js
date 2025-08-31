// popup.js - dùng chrome.scripting.executeScript để lấy ảnh từ tab hiện tại
const imagesContainer = document.getElementById('images');
const refreshBtn = document.getElementById('refresh');

// Hàm để cập nhật tất cả các chuỗi đa ngôn ngữ
function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = chrome.i18n.getMessage(key);
  });
}

// Cập nhật giao diện khi popup được mở
updateUI();

refreshBtn.addEventListener('click', scanImages);

async function scanImages() {
  imagesContainer.innerHTML = `<div class="empty">${chrome.i18n.getMessage('loadingText')}</div>`;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    imagesContainer.innerHTML = `<div class="empty">${chrome.i18n.getMessage('emptyTab')}</div>`;
    return;
  }

  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Hàm chạy trong context của trang web
        // Lấy tất cả thẻ <img>
        const imgs = Array.from(document.images || []);
        // Lấy tất cả thẻ có background-image
        const backgroundImages = Array.from(document.querySelectorAll('[style*="background-image"]')).map(el => {
          const match = el.style.backgroundImage.match(/url\(['"]?(.*?)['"]?\)/);
          return { src: match ? match[1] : '', alt: '', w: 0, h: 0 };
        });

        // Kết hợp cả hai loại ảnh
        const allImages = [...imgs.map(i => ({ src: i.currentSrc || i.src || '', alt: i.alt || '', w: i.naturalWidth || 0, h: i.naturalHeight || 0 })), ...backgroundImages];

        const seen = new Set();
        const filtered = [];
        for (const it of allImages) {
          if (!it.src) continue;
          // Loại bỏ các ảnh trùng lặp
          if (seen.has(it.src)) continue;
          seen.add(it.src);
          filtered.push(it);
        }
        return filtered;
      }
    });

    const results = (injection && injection[0] && injection[0].result) || [];

    if (!results.length) {
      imagesContainer.innerHTML = `<div class="empty">${chrome.i18n.getMessage('noImages')}</div>`;
      return;
    }

    imagesContainer.innerHTML = '';
    for (const img of results) {
      const wrapper = document.createElement('div');
      wrapper.className = 'image-item';

      const thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = img.src;
      thumb.title = img.alt || img.src;
      thumb.loading = 'lazy';

      // Mở ảnh ở tab mới khi click
      thumb.addEventListener('click', () => {
        chrome.tabs.create({ url: img.src });
      });

      const tiny = document.createElement('div');
      tiny.className = 'small-src';
      tiny.textContent = img.src;

      wrapper.appendChild(thumb);
      wrapper.appendChild(tiny);
      imagesContainer.appendChild(wrapper);
    }

  } catch (err) {
    console.error(err);
    imagesContainer.innerHTML = `<div class="empty">${chrome.i18n.getMessage('scanError')}</div>`;
  }
}


// Quét ngay khi mở popup
scanImages();