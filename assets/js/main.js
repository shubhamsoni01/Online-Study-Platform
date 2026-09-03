// ============================================================
// ONLINE STUDY PLATFORM — SHARED JAVASCRIPT
// ============================================================

// --- Sidebar Toggle ---
function initSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const hamburger = document.querySelector('.hamburger-btn');

  if (!sidebar) return;

  hamburger?.addEventListener('click', () => {
    sidebar.classList.toggle('mobile-open');
    overlay?.classList.toggle('open');
  });

  overlay?.addEventListener('click', () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('open');
  });
}

// --- Navigation ---
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-page]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      const page = item.dataset.page;
      showPage(page);
      // Close mobile sidebar
      document.querySelector('.sidebar')?.classList.remove('mobile-open');
      document.querySelector('.sidebar-overlay')?.classList.remove('open');
    });
  });
}

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + pageId);
  if (target) {
    target.classList.add('active');
    const topbarTitle = document.querySelector('.topbar-title');
    if (topbarTitle) topbarTitle.textContent = target.dataset.title || pageId;

    if (pageId === 'chat' && window.platformChat && typeof window.platformChat.fetchMessages === 'function') {
      window.platformChat.fetchMessages(true);
    }
    if (pageId === 'comments' && typeof window.loadTeacherStudentComments === 'function') {
      window.loadTeacherStudentComments();
    }
  }
}

// --- Module Accordion ---
function initModules() {
  document.querySelectorAll('.module-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.module-item');
      item.classList.toggle('open');
    });
  });
}

// --- Modal ---
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('open');
}
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('open');
}
function initModals() {
  document.querySelectorAll('[data-modal]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.modal));
  });
  document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.modal-overlay')?.classList.remove('open');
    });
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
}

// --- Tabs ---
function initTabs() {
  document.querySelectorAll('.tab-item').forEach(tab => {
    tab.addEventListener('click', () => {
      const group = tab.closest('.tabs');
      group?.querySelectorAll('.tab-item').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      if (target) {
        const container = tab.closest('[data-tab-container]') || document;
        container.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById(target);
        if (panel) panel.classList.add('active');
      }
    });
  });
}

// --- Toast Notifications ---
function showToast(message, type = 'success') {
  const container = document.querySelector('.toast-container') || createToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : '⚠'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(30px)'; setTimeout(() => toast.remove(), 300); }, 3000);
}
function createToastContainer() {
  const el = document.createElement('div');
  el.className = 'toast-container';
  document.body.appendChild(el);
  return el;
}

// --- Quiz Interaction ---
function initQuiz() {
  document.querySelectorAll('.quiz-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const question = opt.closest('.quiz-options');
      question?.querySelectorAll('.quiz-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
}

// --- AI Quiz Generator ---
function initAIQuiz() {
  const generateBtn = document.getElementById('generateQuizBtn');
  const resultsSection = document.getElementById('aiQuizResults');
  if (!generateBtn || !resultsSection) return;

  generateBtn.addEventListener('click', () => {
    generateBtn.innerHTML = `<span class="spinner"></span> Generating...`;
    generateBtn.disabled = true;
    setTimeout(() => {
      generateBtn.innerHTML = `✦ Generate Quiz`;
      generateBtn.disabled = false;
      resultsSection.style.display = 'block';
      resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Quiz generated successfully!');
    }, 2000);
  });
}

// --- Schedule Interaction ---
function initSchedule() {
  document.querySelectorAll('.class-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      openModal('scheduleDetailModal');
    });
  });
}

// --- Chat Interaction ---
function initChat() {
  const chatInput = document.querySelector('.chat-input');
  const sendBtn = document.querySelector('.chat-send-btn');
  const messages = document.querySelector('.chat-messages');
  if (!chatInput || !sendBtn || !messages) return;

  function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;
    const row = document.createElement('div');
    row.className = 'message-row sent';
    row.innerHTML = `<div><div class="message-bubble">${text}</div><div class="message-time">Just now</div></div>`;
    messages.appendChild(row);
    chatInput.value = '';
    messages.scrollTop = messages.scrollHeight;
  }

  sendBtn.addEventListener('click', sendMessage);
  chatInput.addEventListener('keypress', e => { if (e.key === 'Enter') sendMessage(); });

  document.querySelectorAll('.chat-list-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.chat-list-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

// --- Upload Area ---
function initUploadAreas() {
  document.querySelectorAll('.upload-area').forEach(area => {
    area.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = area.dataset.accept || '*';
      input.click();
      input.onchange = () => {
        if (input.files[0]) {
          const p = area.querySelector('p');
          if (p) p.innerHTML = `<strong>${input.files[0].name}</strong> selected`;
          showToast('File selected: ' + input.files[0].name);
        }
      };
    });
  });
}

// --- Subject Detail Navigation ---
function initSubjectCards() {
  document.querySelectorAll('.subject-card[data-goto]').forEach(card => {
    card.addEventListener('click', () => {
      const target = card.dataset.goto;
      showPage(target);
      document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    });
  });
}

// --- Init All ---
document.addEventListener('DOMContentLoaded', () => {
  initSidebar();
  initNavigation();
  initModules();
  initModals();
  initTabs();
  initQuiz();
  initAIQuiz();
  initSchedule();
  initChat();
  initUploadAreas();
  initSubjectCards();

  // Open first module by default
  document.querySelector('.module-item')?.classList.add('open');
});
