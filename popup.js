// popup.js
const imagesContainer = document.getElementById('images');
const refreshBtn = document.getElementById('refresh');

function updateUI() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = chrome.i18n.getMessage(key);
  });
}

async function scanImages() {
  imagesContainer.innerHTML = `<div class="empty">${chrome.i18n.getMessage('loadingText')}</div>`;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  if (!tab) return;

  try {
    const injection = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        const results = [];
        const seen = new Set();
        
        // 1. Quét thẻ <img>
        document.querySelectorAll('img').forEach(img => {
          const src = img.currentSrc || img.src;
          if (src && !seen.has(src)) {
            seen.add(src);
            results.push({ src, alt: img.alt || 'Image' });
          }
        });

        // 2. Quét tất cả phần tử có style background-image (Logic xịn của cậu đây)
        // Dùng '*' để quét toàn bộ DOM cho chắc cú
        document.querySelectorAll('*').forEach(el => {
          const style = window.getComputedStyle(el);
          const bg = style.backgroundImage;
          
          if (bg && bg !== 'none') {
            const match = bg.match(/url\(['"]?(.*?)['"]?\)/);
            if (match && match[1]) {
              let url = match[1];
              
              // Xử lý link tương đối thành tuyệt đối ngay tại tab
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
      return;
    }

    results.forEach(img => {
      const wrapper = document.createElement('div');
      wrapper.className = 'image-item';

      const thumb = document.createElement('img');
      thumb.className = 'thumb';
      thumb.src = "placeholder.gif"; // Placeholder

      // gửi ảnh để fetch qua background script
      chrome.runtime.sendMessage(
        { action: "proxyFetch", url: img.src },
        (response) => {
          if (response && response.success) {
            thumb.src = response.data;
          } else {
            thumb.src = img.src; // Fallback
          }
        }
      );

      thumb.addEventListener('click', () => chrome.tabs.create({ url: img.src }));
      
      const tiny = document.createElement('div');
      tiny.className = 'small-src';
      tiny.textContent = img.src;

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