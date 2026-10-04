/**
 * LifeOS — core/ui.js
 * Shared UI utilities used by all modules.
 * No module should redefine these.
 */
'use strict';

/* ─── STATUS / PRIORITY MAPS ─── */
const STATUS_LABEL = {
  idea: '💡 Idea', planned: '📋 Planned', not_started: '⏳ Not Started',
  in_progress: '🔄 In Progress', paused: '⏸ Paused',
  completed: '✅ Done', archived: '📦 Archived',
  bought: '✅ Bought', cancelled: '❌ Cancelled',
  wish: '⭐ Wish', ordered: '📦 Ordered', in_stock: '✅ In Stock',
};
const STATUS_CLASS = {
  idea: 'b-idea', planned: 'b-planned', not_started: 'b-planned',
  in_progress: 'b-active', paused: 'b-paused',
  completed: 'b-done', archived: 'b-archived',
  bought: 'b-done', cancelled: 'b-archived',
  wish: 'b-idea', ordered: 'b-planned', in_stock: 'b-done',
};
const PRIORITY_CLASS = {
  high: 'b-high', medium: 'b-med', low: '',
};

/* ─── BADGE HELPERS ─── */
const UI = {

  statusBadge(s) {
    const cls = STATUS_CLASS[s] || 'b-def';
    const lbl = STATUS_LABEL[s] || s;
    return `<span class="badge ${cls}">${lbl}</span>`;
  },

  priorityBadge(p) {
    if (p === 'high' || p === 2) return '<span class="badge b-high">↑ High</span>';
    if (p === 'medium' || p === 1) return '<span class="badge b-med">→ Med</span>';
    if (p === 'low' || p === 0) return '';
    return '';
  },

  tagBadge(t) {
    return `<span class="badge b-tag">${t}</span>`;
  },

  /* ─── FORMATTERS ─── */
  money(n, currency = '₽') {
    if (n == null || n === '') return '';
    return new Intl.NumberFormat('ru-RU').format(n) + ' ' + currency;
  },

  date(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  },

  dateTime(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  },

  relativeDate(d) {
    if (!d) return '';
    const diff = Math.round((new Date(d) - new Date()) / 86400000);
    if (diff === 0)  return 'today';
    if (diff === 1)  return 'tomorrow';
    if (diff === -1) return 'yesterday';
    if (diff < 0)    return `${Math.abs(diff)}d overdue`;
    return `in ${diff}d`;
  },

  isOverdue(d, status) {
    if (!d || status === 'completed' || status === 'archived') return false;
    return new Date(d) < new Date();
  },

  /* ─── TOAST ─── */
  toast(msg, type = 'ok', duration = 3000) {
    let container = document.getElementById('_toasts');
    if (!container) {
      container = document.createElement('div');
      container.id = '_toasts';
      container.style.cssText = 'position:fixed;top:calc(16px + env(safe-area-inset-top));right:16px;z-index:9999;display:flex;flex-direction:column;gap:8px;pointer-events:none';
      document.body.appendChild(container);
    }
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.innerHTML = `<span>${type === 'ok' ? '✓' : type === 'err' ? '✗' : 'ℹ'}</span> ${msg}`;
    container.appendChild(el);
    setTimeout(() => el.remove(), duration);
  },

  /* ─── MODAL ─── */
  openModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  },

  closeModal(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.remove('open');
    document.body.style.overflow = '';
  },

  closeModalOnBackdrop(event, id) {
    if (event.target.classList.contains('modal-overlay')) UI.closeModal(id);
  },

  /* ─── IMAGE PREVIEW ─── */
  previewImage(src) {
    let ov = document.getElementById('_img-preview');
    if (!ov) {
      ov = document.createElement('div');
      ov.id = '_img-preview';
      ov.innerHTML = `
        <button id="_img-preview-close" onclick="UI.closeImagePreview()">&times;</button>
        <img id="_img-preview-src" src="" alt="">`;
      document.body.appendChild(ov);
      ov.addEventListener('click', e => { if (e.target === ov) UI.closeImagePreview(); });
    }
    document.getElementById('_img-preview-src').src = src;
    ov.style.display = 'flex';
  },

  closeImagePreview() {
    const ov = document.getElementById('_img-preview');
    if (ov) ov.style.display = 'none';
  },

  /* ─── TAG MULTISELECT ─── */
  async renderTagGrid(containerId, selectedTags = [], onToggle) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const allTags = await DB.getTags();
    el.innerHTML = allTags.map(t => {
      const sel = selectedTags.includes(t.name);
      return `<span class="tag-chip ${sel ? 'selected' : ''}" data-tag="${t.name}">${t.name}</span>`;
    }).join('') + `<span class="tag-chip tag-chip-add" id="${containerId}-add">＋</span>`;

    el.querySelectorAll('.tag-chip:not(.tag-chip-add)').forEach(chip => {
      chip.addEventListener('click', () => {
        const name = chip.dataset.tag;
        const idx = selectedTags.indexOf(name);
        if (idx === -1) selectedTags.push(name);
        else selectedTags.splice(idx, 1);
        if (onToggle) onToggle(selectedTags);
        UI.renderTagGrid(containerId, selectedTags, onToggle);
      });
    });

    document.getElementById(`${containerId}-add`)?.addEventListener('click', async () => {
      const name = prompt('New tag name:');
      if (!name?.trim()) return;
      await DB.createTag(name.trim());
      selectedTags.push(name.trim());
      if (onToggle) onToggle(selectedTags);
      UI.renderTagGrid(containerId, selectedTags, onToggle);
    });
  },

  /* ─── IMAGE UPLOAD GRID ─── */
  async renderImageGrid(containerId, fileInputId, savedIds = [], buffer = []) {
    const el = document.getElementById(containerId);
    if (!el) return;
    let html = '';
    for (const id of savedIds) {
      const img = await DB.getImage(id);
      if (img) html += `<img class="img-thumb" src="${img.data}" onclick="UI.previewImage('${img.data}')">`;
    }
    for (const b of buffer) {
      html += `<img class="img-thumb" src="${b.data}" onclick="UI.previewImage('${b.data}')">`;
    }
    html += `<div class="img-add" onclick="document.getElementById('${fileInputId}').click()">＋</div>`;
    el.innerHTML = html;
  },

  handleImageFiles(files, buffer, containerId, fileInputId, savedIds = []) {
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        buffer.push({ data: e.target.result, name: file.name });
        UI.renderImageGrid(containerId, fileInputId, savedIds, buffer);
      };
      reader.readAsDataURL(file);
    });
  },

  async flushImageBuffer(buffer, existingIds = []) {
    const newIds = [];
    for (const b of buffer) {
      const id = await DB.saveImage(b.data, { name: b.name });
      newIds.push(id);
    }
    buffer.length = 0;
    return [...existingIds, ...newIds];
  },

  /* ─── EMPTY STATE ─── */
  emptyState(icon, title, desc) {
    return `<div class="empty-state">
      <div class="empty-icon">${icon}</div>
      <div class="empty-title">${title}</div>
      <div class="empty-desc">${desc}</div>
    </div>`;
  },

  /* ─── COST DISPLAY ─── */
  async taskCostRow(task, allTasks) {
    const total = await calcTaskTotalCost(task.id, allTasks);
    if (!total) return '';
    const own  = task.selfBudget || task.cost || 0;
    const sub  = total - own;
    if (sub > 0) return `${UI.money(own)} + sub ${UI.money(sub)} = <b>${UI.money(total)}</b>`;
    return UI.money(total);
  },
};

window.UI          = UI;
window.STATUS_LABEL = STATUS_LABEL;
