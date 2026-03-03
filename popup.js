// popup.js
const imagesContainer = document.getElementById('images');
const refreshBtn = document.getElementById('refresh');
const downloadAllBtn = document.getElementById('downloadAll');

function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = chrome.i18n.getMessage(key);
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
    chrome.runtime.sendMessage({ 
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
  
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
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

    // HIỆN NÚT TẢI KHI CÓ KẾT QUẢ
    downloadAllBtn.style.opacity = '100%';

    results.forEach(img => {
      const wrapper = document.createElement('div');
      wrapper.className = 'image-item';
      const thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = "placeholder.gif";
      thumb.title = img.src;

      chrome.runtime.sendMessage(
        { action: "proxyFetch", url: img.src },
        (response) => {
          if (response && response.success) {
            thumb.src = response.data;
          } else {
            thumb.src = "none.png"; // Set a default image if proxy fails
          }
        }
      );

      thumb.addEventListener('click', () => chrome.tabs.create({ url: img.src }));
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

updateUI();
refreshBtn.addEventListener('click', scanImages);
scanImages();