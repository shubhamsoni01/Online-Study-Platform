/**
 * ChatManager - Online Study Platform
 * Manages 2-Box Chat System (Common Community Chat & Staff Private Chat)
 */

class ChatManager {
  constructor(options = {}) {
    this.containerId = options.containerId || 'chatMessagesBox';
    this.inputId = options.inputId || 'chatMessageInput';
    this.sendBtnId = options.sendBtnId || 'chatSendBtn';
    this.tabsContainerId = options.tabsContainerId || 'chatRoomTabs';
    this.roomTitleId = options.roomTitleId || 'chatRoomTitle';
    this.roomSubtitleId = options.roomSubtitleId || 'chatRoomSubtitle';
    this.currentUser = options.currentUser || null;
    this.currentRole = options.currentRole || 'student';
    this.activeRoom = options.defaultRoom || 'common';
    this.allowedRooms = options.allowedRooms || ['common'];
    this.pollIntervalMs = options.pollIntervalMs || 2500;
    this.pollTimer = null;
    this.isFetching = false;
    this.isSending = false;
    this.lastMessageCount = 0;
    this.cachedMessages = [];
  }

  init() {
    this.bindEvents();
    this.setRoom(this.activeRoom);
    this.startPolling();

    // Re-fetch when browser window/tab gains focus
    window.addEventListener('focus', () => {
      this.fetchMessages(false);
    });
  }

  setRoleAndUser(role, user) {
    this.currentRole = role;
    this.currentUser = user;
    this.renderTabs();
    this.fetchMessages(false);
  }

  bindEvents() {
    const input = document.getElementById(this.inputId);
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      });
    }

    const sendBtn = document.getElementById(this.sendBtnId);
    if (sendBtn) {
      sendBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.sendMessage();
      });
    }
  }

  renderTabs() {
    const tabsCont = document.getElementById(this.tabsContainerId);
    if (!tabsCont) return;

    if (this.currentRole === 'student') {
      tabsCont.style.display = 'none';
      return;
    }

    tabsCont.style.display = 'inline-flex';
    tabsCont.innerHTML = `
      <button class="chat-room-tab ${this.activeRoom === 'common' ? 'active' : ''}" onclick="window.platformChat.setRoom('common')">
        <span>💬</span> Common Chat
      </button>
      <button class="chat-room-tab ${this.activeRoom === 'staff' ? 'active' : ''}" onclick="window.platformChat.setRoom('staff')">
        <span>🔒</span> Admin & Teachers
      </button>
    `;
  }

  setRoom(room) {
    if (room === 'staff' && this.currentRole === 'student') {
      console.warn('Staff room not accessible for students');
      return;
    }
    this.activeRoom = room;
    this.renderTabs();
    this.updateHeader();
    this.fetchMessages(true);
  }

  updateHeader() {
    const titleEl = document.getElementById(this.roomTitleId);
    const subtitleEl = document.getElementById(this.roomSubtitleId);

    if (this.activeRoom === 'common') {
      if (titleEl) titleEl.textContent = '💬 Common Chat';
      if (subtitleEl) subtitleEl.textContent = 'Public discussion room for Admin, Teachers & Students';
    } else {
      if (titleEl) titleEl.textContent = '🔒 Admin & Teachers';
      if (subtitleEl) subtitleEl.textContent = 'Private staff conversation (Faculty & Administrators only)';
    }
  }

  async fetchMessages(forceScroll = false) {
    if (this.isFetching) return;
    this.isFetching = true;
    try {
      const res = await LiveAPI.getChatRoomMessages(this.activeRoom);
      const messages = (res && res.data && Array.isArray(res.data)) ? res.data : [];
      this.cachedMessages = messages;
      this.renderMessages(messages, forceScroll);
    } catch (err) {
      console.warn(`[Chat ${this.activeRoom}] fetch note:`, err.message);
    } finally {
      this.isFetching = false;
    }
  }

  renderMessages(messages, forceScroll = false) {
    const box = document.getElementById(this.containerId);
    if (!box) return;

    const currentUserId = this.currentUser ? (this.currentUser._id || this.currentUser.id || '').toString() : '';
    const currentUserName = this.currentUser ? (this.currentUser.name || '').trim().toLowerCase() : '';
    const currentUserEmail = this.currentUser ? (this.currentUser.email || '').trim().toLowerCase() : '';
    const userRole = this.currentRole;

    if (!messages || messages.length === 0) {
      box.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-secondary);text-align:center;padding:40px;">
          <div style="font-size:32px;margin-bottom:8px;">${this.activeRoom === 'common' ? '💬' : '🔒'}</div>
          <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:4px;">No messages yet. Start the conversation!</div>
          <div style="font-size:12px;">Type your message below and press Enter to send.</div>
        </div>
      `;
      this.lastMessageCount = 0;
      return;
    }

    const wasNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight) < 90;
    const shouldScroll = forceScroll || (messages.length !== this.lastMessageCount) || wasNearBottom;
    this.lastMessageCount = messages.length;

    let html = '';
    messages.forEach(m => {
      const senderIdStr = (m.senderId || '').toString();
      const senderNameNorm = (m.senderName || '').trim().toLowerCase();
      const role = (m.senderRole || 'student').toLowerCase();

      // Check ownership
      const isOwner = (currentUserId && senderIdStr === currentUserId) ||
                      (currentUserName && senderNameNorm === currentUserName && (role === userRole || userRole === 'admin')) ||
                      (userRole === 'admin' && (role === 'admin' || role === 'super_admin'));

      // Role badge formatting
      let roleLabel = 'Student';
      let roleClass = 'chat-role-student';
      if (role === 'admin' || role === 'super_admin') {
        roleLabel = 'Admin';
        roleClass = 'chat-role-admin';
      } else if (role === 'teacher') {
        roleLabel = 'Teacher';
        roleClass = 'chat-role-teacher';
      }

      // Delete permission:
      // Admin/Super Admin -> Can delete ANY message
      // Teacher -> Can delete ANY message in common or staff chat
      // Student -> Can delete ONLY their OWN message
      const canDelete = (userRole === 'admin' || userRole === 'super_admin' || userRole === 'teacher') || isOwner;

      const deleteBtnHtml = canDelete
        ? `<button class="chat-msg-delete-btn" onclick="window.platformChat.deleteMessage('${m._id}')" title="Delete message">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px;"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            Delete
          </button>`
        : '';

      const avatarHtml = typeof Store !== 'undefined' && Store.formatAvatarHtml
        ? Store.formatAvatarHtml(m.senderPhoto, m.senderName, roleLabel.slice(0, 2))
        : `<div class="avatar avatar-sm">${(m.senderName || 'U').slice(0, 2).toUpperCase()}</div>`;

      const timeStr = m.createdAt
        ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'Just now';

      const dateStr = m.createdAt
        ? new Date(m.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })
        : '';

      html += `
        <div class="message-row ${isOwner ? 'sent' : ''}" style="display:flex;gap:10px;margin-bottom:12px;max-width:85%;${isOwner ? 'align-self:flex-end;flex-direction:row-reverse;' : 'align-self:flex-start;'}">
          <div style="flex-shrink:0;">
            <div class="avatar avatar-sm">${avatarHtml}</div>
          </div>
          <div style="display:flex;flex-direction:column;${isOwner ? 'align-items:flex-end;' : 'align-items:flex-start;'}">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:12px;">
              <span style="font-weight:700;color:var(--text-primary);">${m.senderName || 'Anonymous'} ${isOwner ? '<span style="color:var(--accent);font-size:11px;">(You)</span>' : ''}</span>
              <span class="chat-role-badge ${roleClass}">${roleLabel}</span>
              <span style="color:var(--text-secondary);font-size:11px;">${dateStr} ${timeStr}</span>
              ${isOwner ? deleteBtnHtml : ''}
            </div>
            <div class="message-bubble" style="${isOwner ? 'background:#1c2438;border-color:rgba(245,197,66,0.35);color:var(--text-primary);' : 'background:var(--bg-secondary);border-color:var(--border);color:var(--text-primary);'}">
              ${this.escapeHtml(m.message)}
            </div>
            ${!isOwner ? `<div style="margin-top:2px;">${deleteBtnHtml}</div>` : ''}
          </div>
        </div>
      `;
    });

    box.innerHTML = html;

    if (shouldScroll) {
      box.scrollTop = box.scrollHeight;
    }
  }

  async sendMessage() {
    if (this.isSending) return;
    const input = document.getElementById(this.inputId);
    const sendBtn = document.getElementById(this.sendBtnId);
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    this.isSending = true;
    if (sendBtn) {
      sendBtn.disabled = true;
      sendBtn.style.opacity = '0.5';
    }

    try {
      const res = await LiveAPI.sendChatRoomMessage(this.activeRoom, text);
      if (res && res.success) {
        // Clear input ONLY after database confirmation
        input.value = '';

        // Immediately update cache and render
        if (res.data) {
          this.cachedMessages.push(res.data);
          this.renderMessages(this.cachedMessages, true);
        }

        // Re-fetch to ensure synchronization with other messages
        await this.fetchMessages(true);
        input.focus();
      } else {
        throw new Error(res.message || 'Server did not acknowledge message save.');
      }
    } catch (err) {
      console.error('[Chat Send Error]', err);
      if (typeof showToast === 'function') {
        showToast(`Failed to send message: ${err.message}`);
      } else {
        alert(`Failed to send message: ${err.message}`);
      }
      // DO NOT clear input so user does not lose text!
    } finally {
      this.isSending = false;
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.style.opacity = '1';
      }
    }
  }

  async deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      await LiveAPI.deleteChatMessage(messageId);
      if (typeof showToast === 'function') {
        showToast('Message deleted');
      }
      // Remove from cache immediately
      this.cachedMessages = this.cachedMessages.filter(m => (m._id || m.id) !== messageId);
      this.renderMessages(this.cachedMessages, false);
      await this.fetchMessages(false);
    } catch (err) {
      if (typeof showToast === 'function') {
        showToast(`Delete failed: ${err.message}`);
      } else {
        alert(`Delete failed: ${err.message}`);
      }
    }
  }

  startPolling() {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      this.fetchMessages(false);
    }, this.pollIntervalMs);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  }
}

window.ChatManager = ChatManager;
