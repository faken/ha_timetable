/**
 * Ha Timetable Card - Lovelace Custom Card
 * Displays a school timetable in a grid layout with inline editing.
 */

const CARD_VERSION = "1.0.9";

// i18n translations
const TRANSLATIONS = {
  de: {
    days: { monday: "Mo", tuesday: "Di", wednesday: "Mi", thursday: "Do", friday: "Fr" },
    daysFull: { monday: "Montag", tuesday: "Dienstag", wednesday: "Mittwoch", thursday: "Donnerstag", friday: "Freitag" },
    slot: "Std.",
    time: "Zeit",
    free: "Frei",
    edit: "Bearbeiten",
    done: "Fertig",
    addLesson: "Stunde hinzufügen",
    editLesson: "Stunde bearbeiten",
    deleteLesson: "Löschen",
    cancel: "Abbrechen",
    save: "Speichern",
    subject: "Fach",
    teacher: "Lehrer",
    room: "Raum",
    color: "Farbe",
    timeSlots: "Zeitraster",
    editTimeSlots: "Zeitraster bearbeiten",
    slotNumber: "Stunde",
    start: "Beginn",
    end: "Ende",
    addSlot: "Zeitslot hinzufügen",
    removeSlot: "Entfernen",
    currentLesson: "Aktuelle Stunde",
    noLessons: "Keine Stunden eingetragen",
  },
  en: {
    days: { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri" },
    daysFull: { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday" },
    slot: "Period",
    time: "Time",
    free: "Free",
    edit: "Edit",
    done: "Done",
    addLesson: "Add lesson",
    editLesson: "Edit lesson",
    deleteLesson: "Delete",
    cancel: "Cancel",
    save: "Save",
    subject: "Subject",
    teacher: "Teacher",
    room: "Room",
    color: "Color",
    timeSlots: "Time slots",
    editTimeSlots: "Edit time slots",
    slotNumber: "Period",
    start: "Start",
    end: "End",
    addSlot: "Add time slot",
    removeSlot: "Remove",
    currentLesson: "Current lesson",
    noLessons: "No lessons configured",
  },
};

const DAYS_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday"];

const DEFAULT_COLORS = [
  "#4CAF50", "#2196F3", "#FF9800", "#9C27B0", "#F44336",
  "#00BCD4", "#FFEB3B", "#795548", "#607D8B", "#E91E63",
  "#3F51B5", "#8BC34A", "#FF5722", "#009688", "#673AB7",
];

// ── Registration ──────────────────────────────────────────────────────────
window.customCards = window.customCards || [];
window.customCards.push({
  type: "ha-timetable-card",
  name: "Timetable",
  preview: true,
  description: "Displays a school timetable with inline editing",
  documentationURL: "https://github.com/faken/ha_timetable",
});

// ── Helper ────────────────────────────────────────────────────────────────
function fireEvent(node, type, detail) {
  node.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

function getTranslations(hass) {
  const lang = hass?.language || "en";
  return TRANSLATIONS[lang] || TRANSLATIONS.en;
}

function contrastColor(hex) {
  if (!hex) return "#ffffff";
  const c = hex.replace("#", "");
  const r = parseInt(c.substr(0, 2), 16);
  const g = parseInt(c.substr(2, 2), 16);
  const b = parseInt(c.substr(4, 2), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#333333" : "#ffffff";
}

// ── Main Card ─────────────────────────────────────────────────────────────
class HaTimetableCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("ha-timetable-card-editor");
  }

  static getStubConfig() {
    return { entity: "", title: "", show_teacher: true, show_room: true, compact: false };
  }

  getLayoutOptions() {
    return { grid_columns: "full", grid_min_columns: 3, grid_rows: "auto" };
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._editMode = false;
    this._dialogOpen = false;

    // Create persistent DOM structure — dialogs live in _dialogRoot
    // and are never destroyed by grid re-renders
    this._styleEl = document.createElement("style");
    this._cardEl = document.createElement("ha-card");
    this._dialogRoot = document.createElement("div");
    this.shadowRoot.append(this._styleEl, this._cardEl, this._dialogRoot);
  }

  setConfig(config) {
    if (!config.entity) throw new Error("Entity is required");
    this._config = {
      show_teacher: true,
      show_room: true,
      compact: false,
      ...config,
    };
    if (!this._dialogOpen) this._renderGrid();
  }

  set hass(hass) {
    const oldHass = this._hass;
    this._hass = hass;
    // Never re-render grid while a dialog is open
    if (this._dialogOpen) return;
    // Skip if entity state hasn't changed
    if (oldHass && this._config) {
      const eid = this._config.entity;
      if (oldHass.states[eid] === hass.states[eid]) return;
    }
    this._renderGrid();
  }

  getCardSize() {
    return 6;
  }

  _getT() {
    return getTranslations(this._hass);
  }

  _getTimetableData() {
    if (!this._hass || !this._config) return null;
    const stateObj = this._hass.states[this._config.entity];
    if (!stateObj) return null;
    return stateObj.attributes.timetable_data || null;
  }

  _getCurrentSlotInfo() {
    if (!this._hass || !this._config) return {};
    const stateObj = this._hass.states[this._config.entity];
    if (!stateObj) return {};
    const now = new Date();
    const dayIndex = now.getDay();
    const dayMap = { 1: "monday", 2: "tuesday", 3: "wednesday", 4: "thursday", 5: "friday" };
    return {
      currentDay: dayMap[dayIndex] || null,
      currentSlot: stateObj.attributes.slot || null,
    };
  }

  // ── Grid rendering (only touches _cardEl, never _dialogRoot) ──────────
  _renderGrid() {
    if (!this._hass || !this._config) return;

    this._styleEl.textContent = this._getStyles();

    const t = this._getT();
    const data = this._getTimetableData();
    const title = this._config.title || this._hass.states[this._config.entity]?.attributes?.timetable_name || "Timetable";
    const { currentDay, currentSlot } = this._getCurrentSlotInfo();

    if (!data) {
      this._cardEl.innerHTML = `
        <div class="card-header">
          <span class="title">${title}</span>
        </div>
        <div style="padding:16px;color:var(--secondary-text-color);">
          Entity not found: ${this._config.entity}
        </div>`;
      return;
    }

    const timeSlots = (data.time_slots || []).sort((a, b) => a.slot - b.slot);
    const lessons = data.lessons || {};

    this._cardEl.innerHTML = `
      <div class="card-header">
        <span class="title">${title}</span>
        <ha-icon-button class="edit-btn" id="toggle-edit">
          <ha-icon icon="${this._editMode ? "mdi:check" : "mdi:pencil"}"></ha-icon>
        </ha-icon-button>
      </div>
      <div class="card-content">
        ${this._editMode ? `
          <button class="time-slots-btn" id="edit-time-slots">
            <ha-icon icon="mdi:clock-edit-outline" style="--mdc-icon-size:18px;margin-right:4px;"></ha-icon>
            ${t.editTimeSlots}
          </button>
        ` : ""}
        ${timeSlots.length === 0 ? `
          <div class="empty-state">${t.noLessons}</div>
        ` : `
          <div class="timetable-grid ${this._config.compact ? "compact" : ""}">
            <div class="grid-header">
              <div class="grid-cell time-header">${t.time}</div>
              ${DAYS_ORDER.map(day => `
                <div class="grid-cell day-header ${day === currentDay ? "current-day" : ""}">${t.days[day]}</div>
              `).join("")}
            </div>
            ${timeSlots.map(slot => this._renderSlotRow(slot, lessons, t, currentDay, currentSlot)).join("")}
          </div>
        `}
      </div>
    `;

    this._attachGridListeners(timeSlots);
  }

  _renderSlotRow(slot, lessons, t, currentDay, currentSlot) {
    return `
      <div class="grid-row">
        <div class="grid-cell time-cell">
          <span class="slot-number">${slot.slot}.</span>
          <span class="slot-time">${slot.start}<br>${slot.end}</span>
        </div>
        ${DAYS_ORDER.map(day => {
          const lesson = (lessons[day] || []).find(l => l.slot === slot.slot);
          const isCurrent = day === currentDay && slot.slot === currentSlot;
          return this._renderLessonCell(lesson, day, slot.slot, isCurrent);
        }).join("")}
      </div>
    `;
  }

  _renderLessonCell(lesson, day, slotNum, isCurrent) {
    const bgColor = lesson?.color || "";
    const textColor = bgColor ? contrastColor(bgColor) : "";
    const style = bgColor ? `background-color:${bgColor};color:${textColor};` : "";

    if (lesson) {
      return `
        <div class="grid-cell lesson-cell ${isCurrent ? "current" : ""} ${this._editMode ? "editable" : ""}"
             style="${style}" data-day="${day}" data-slot="${slotNum}">
          <span class="subject">${lesson.subject}</span>
          ${this._config.show_teacher && lesson.teacher ? `<span class="detail teacher">${lesson.teacher}</span>` : ""}
          ${this._config.show_room && lesson.room ? `<span class="detail room">${lesson.room}</span>` : ""}
        </div>
      `;
    }
    return `
      <div class="grid-cell lesson-cell empty ${isCurrent ? "current" : ""} ${this._editMode ? "editable" : ""}"
           data-day="${day}" data-slot="${slotNum}">
        ${this._editMode ? '<ha-icon icon="mdi:plus" style="--mdc-icon-size:16px;opacity:0.3;"></ha-icon>' : ""}
      </div>
    `;
  }

  _attachGridListeners() {
    const card = this._cardEl;

    card.querySelector("#toggle-edit")?.addEventListener("click", () => {
      this._editMode = !this._editMode;
      this._renderGrid();
    });

    card.querySelectorAll(".lesson-cell.editable").forEach(cell => {
      cell.addEventListener("click", () => {
        const day = cell.dataset.day;
        const slot = parseInt(cell.dataset.slot);
        const data = this._getTimetableData();
        const lesson = (data?.lessons?.[day] || []).find(l => l.slot === slot);
        this._openLessonDialog({
          day,
          slot,
          subject: lesson?.subject || "",
          teacher: lesson?.teacher || "",
          room: lesson?.room || "",
          color: lesson?.color || "",
        });
      });
    });

    card.querySelector("#edit-time-slots")?.addEventListener("click", () => {
      this._openTimeSlotsDialog();
    });
  }

  // ── Lesson Dialog (uses _dialogRoot, completely independent of grid) ───
  _openLessonDialog(data) {
    this._dialogOpen = true;
    this._dialogData = data;
    const t = this._getT();
    const isEdit = !!data.subject;

    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.innerHTML = `
      <div class="dialog">
        <div class="dialog-title">${isEdit ? t.editLesson : t.addLesson}</div>
        <div class="dialog-subtitle">${t.daysFull[data.day]} - ${t.slot} ${data.slot}</div>
        <div class="dialog-form">
          <label>${t.subject} *</label>
          <input type="text" id="dlg-subject" placeholder="${t.subject}">
          <label>${t.teacher}</label>
          <input type="text" id="dlg-teacher" placeholder="${t.teacher}">
          <label>${t.room}</label>
          <input type="text" id="dlg-room" placeholder="${t.room}">
          <label>${t.color}</label>
          <div class="color-picker">
            <input type="color" id="dlg-color" value="${data.color || "#4CAF50"}">
            <div class="color-presets">
              ${DEFAULT_COLORS.map(c => `
                <span class="color-dot ${c === data.color ? "selected" : ""}" data-color="${c}" style="background:${c}"></span>
              `).join("")}
            </div>
          </div>
        </div>
        <div class="dialog-actions">
          ${isEdit ? `<button class="btn btn-danger" id="dlg-delete">${t.deleteLesson}</button>` : ""}
          <span class="spacer"></span>
          <button class="btn btn-secondary" id="dlg-cancel">${t.cancel}</button>
          <button class="btn btn-primary" id="dlg-save">${t.save}</button>
        </div>
      </div>
    `;

    this._dialogRoot.appendChild(overlay);

    // Set input values after DOM insertion (avoids HTML encoding issues)
    const subjectInput = overlay.querySelector("#dlg-subject");
    const teacherInput = overlay.querySelector("#dlg-teacher");
    const roomInput = overlay.querySelector("#dlg-room");
    subjectInput.value = data.subject || "";
    teacherInput.value = data.teacher || "";
    roomInput.value = data.room || "";

    // Focus the subject field
    requestAnimationFrame(() => subjectInput.focus());

    // Stop all events from propagating outside the dialog
    overlay.querySelector(".dialog").addEventListener("mousedown", (e) => e.stopPropagation());
    overlay.querySelector(".dialog").addEventListener("pointerdown", (e) => e.stopPropagation());

    // Event listeners
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this._closeLessonDialog();
    });
    overlay.querySelector("#dlg-cancel").addEventListener("click", () => this._closeLessonDialog());
    overlay.querySelector("#dlg-save").addEventListener("click", () => this._saveLesson(overlay));
    overlay.querySelector("#dlg-delete")?.addEventListener("click", () => this._deleteLesson());

    // Enter key saves
    overlay.querySelectorAll("input[type=text]").forEach(input => {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") this._saveLesson(overlay);
      });
    });

    // Color presets
    overlay.querySelectorAll(".color-dot").forEach(dot => {
      dot.addEventListener("click", () => {
        overlay.querySelector("#dlg-color").value = dot.dataset.color;
        overlay.querySelectorAll(".color-dot").forEach(d => d.classList.remove("selected"));
        dot.classList.add("selected");
      });
    });
  }

  _closeLessonDialog() {
    this._dialogOpen = false;
    this._dialogData = null;
    this._dialogRoot.innerHTML = "";
    this._renderGrid();
  }

  async _saveLesson(overlay) {
    const subject = overlay.querySelector("#dlg-subject").value.trim();
    if (!subject) {
      overlay.querySelector("#dlg-subject").focus();
      return;
    }

    const teacher = overlay.querySelector("#dlg-teacher").value.trim() || null;
    const room = overlay.querySelector("#dlg-room").value.trim() || null;
    const color = overlay.querySelector("#dlg-color").value || null;

    await this._hass.callService("ha_timetable", "set_lesson", {
      entity_id: this._config.entity,
      day: this._dialogData.day,
      slot: this._dialogData.slot,
      subject,
      teacher,
      room,
      color,
    });

    this._closeLessonDialog();
  }

  async _deleteLesson() {
    await this._hass.callService("ha_timetable", "remove_lesson", {
      entity_id: this._config.entity,
      day: this._dialogData.day,
      slot: this._dialogData.slot,
    });
    this._closeLessonDialog();
  }

  // ── Time Slots Dialog ─────────────────────────────────────────────────
  _openTimeSlotsDialog() {
    this._dialogOpen = true;
    const t = this._getT();
    const data = this._getTimetableData();
    const timeSlots = (data?.time_slots || []).sort((a, b) => a.slot - b.slot);

    const overlay = document.createElement("div");
    overlay.className = "dialog-overlay";
    overlay.innerHTML = `
      <div class="dialog dialog-wide">
        <div class="dialog-title">${t.editTimeSlots}</div>
        <div class="dialog-form">
          <div class="ts-grid" id="ts-grid">
            <div class="ts-header">
              <span>${t.slotNumber}</span>
              <span>${t.start}</span>
              <span>${t.end}</span>
              <span></span>
            </div>
            ${timeSlots.map((s, i) => `
              <div class="ts-row">
                <span class="ts-slot-num">${s.slot}</span>
                <input type="time" class="ts-start" value="${s.start}">
                <input type="time" class="ts-end" value="${s.end}">
                <button class="btn btn-icon btn-danger ts-remove">
                  <ha-icon icon="mdi:delete" style="--mdc-icon-size:18px;"></ha-icon>
                </button>
              </div>
            `).join("")}
          </div>
          <button class="btn btn-secondary" id="ts-add" style="margin-top:8px;">
            <ha-icon icon="mdi:plus" style="--mdc-icon-size:18px;margin-right:4px;"></ha-icon>
            ${t.addSlot}
          </button>
        </div>
        <div class="dialog-actions">
          <span class="spacer"></span>
          <button class="btn btn-secondary" id="ts-cancel">${t.cancel}</button>
          <button class="btn btn-primary" id="ts-save">${t.save}</button>
        </div>
      </div>
    `;

    this._dialogRoot.appendChild(overlay);

    // Stop events from propagating
    overlay.querySelector(".dialog").addEventListener("mousedown", (e) => e.stopPropagation());
    overlay.querySelector(".dialog").addEventListener("pointerdown", (e) => e.stopPropagation());

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) this._closeTimeSlotsDialog();
    });
    overlay.querySelector("#ts-cancel").addEventListener("click", () => this._closeTimeSlotsDialog());
    overlay.querySelector("#ts-save").addEventListener("click", () => this._saveTimeSlots(overlay));

    // Remove buttons
    overlay.querySelectorAll(".ts-remove").forEach(btn => {
      btn.addEventListener("click", () => btn.closest(".ts-row").remove());
    });

    // Add slot button
    overlay.querySelector("#ts-add").addEventListener("click", () => {
      const grid = overlay.querySelector("#ts-grid");
      const rows = grid.querySelectorAll(".ts-row");
      const lastSlot = rows.length > 0
        ? parseInt(rows[rows.length - 1].querySelector(".ts-slot-num").textContent)
        : 0;

      const newRow = document.createElement("div");
      newRow.className = "ts-row";
      newRow.innerHTML = `
        <span class="ts-slot-num">${lastSlot + 1}</span>
        <input type="time" class="ts-start" value="">
        <input type="time" class="ts-end" value="">
        <button class="btn btn-icon btn-danger ts-remove">
          <ha-icon icon="mdi:delete" style="--mdc-icon-size:18px;"></ha-icon>
        </button>
      `;
      grid.appendChild(newRow);
      newRow.querySelector(".ts-remove").addEventListener("click", () => newRow.remove());
    });
  }

  _closeTimeSlotsDialog() {
    this._dialogOpen = false;
    this._dialogRoot.innerHTML = "";
    this._renderGrid();
  }

  async _saveTimeSlots(overlay) {
    const rows = overlay.querySelectorAll(".ts-row");
    const slots = [];
    let slotNum = 1;
    rows.forEach(row => {
      const start = row.querySelector(".ts-start")?.value;
      const end = row.querySelector(".ts-end")?.value;
      if (start && end) {
        slots.push({ slot: slotNum++, start, end });
      }
    });

    if (slots.length > 0) {
      await this._hass.callService("ha_timetable", "set_time_slots", {
        entity_id: this._config.entity,
        time_slots: slots,
      });
    }

    this._closeTimeSlotsDialog();
  }

  _getStyles() {
    return `
      :host {
        --tt-border: var(--divider-color, #e0e0e0);
        --tt-bg: var(--card-background-color, #fff);
        --tt-header-bg: var(--primary-color, #03a9f4);
        --tt-header-text: var(--text-primary-color, #fff);
        --tt-cell-hover: var(--secondary-background-color, #f5f5f5);
        --tt-current-border: var(--accent-color, #ff9800);
      }
      :host {
        display: block;
      }
      ha-card {
        overflow: hidden;
      }
      .card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        font-size: 1.1em;
        font-weight: 500;
      }
      .title {
        color: var(--primary-text-color);
      }
      .edit-btn {
        --mdc-icon-button-size: 36px;
        color: var(--secondary-text-color);
      }
      .card-content {
        padding: 0 8px 12px;
        overflow-x: auto;
      }
      .time-slots-btn {
        display: flex;
        align-items: center;
        background: none;
        border: 1px dashed var(--tt-border);
        border-radius: 8px;
        padding: 6px 12px;
        margin-bottom: 8px;
        cursor: pointer;
        color: var(--primary-color);
        font-size: 0.85em;
      }
      .time-slots-btn:hover {
        background: var(--tt-cell-hover);
      }
      .empty-state {
        padding: 32px 16px;
        text-align: center;
        color: var(--secondary-text-color);
      }
      .timetable-grid {
        display: table;
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85em;
      }
      .timetable-grid.compact {
        font-size: 0.75em;
      }
      .grid-header, .grid-row {
        display: table-row;
      }
      .grid-cell {
        display: table-cell;
        border: 1px solid var(--tt-border);
        padding: 6px 4px;
        text-align: center;
        vertical-align: middle;
        min-width: 60px;
      }
      .time-header {
        background: var(--tt-header-bg);
        color: var(--tt-header-text);
        font-weight: 600;
        font-size: 0.85em;
        min-width: 55px;
      }
      .day-header {
        background: var(--tt-header-bg);
        color: var(--tt-header-text);
        font-weight: 600;
        padding: 8px 4px;
      }
      .day-header.current-day {
        background: var(--tt-current-border);
      }
      .time-cell {
        background: var(--secondary-background-color, #f9f9f9);
        font-size: 0.8em;
        line-height: 1.3;
        padding: 4px;
        white-space: nowrap;
      }
      .slot-number {
        font-weight: 600;
        display: block;
        margin-bottom: 2px;
      }
      .slot-time {
        color: var(--secondary-text-color);
        font-size: 0.85em;
      }
      .lesson-cell {
        transition: all 0.15s ease;
        padding: 4px 3px;
        position: relative;
      }
      .lesson-cell.editable {
        cursor: pointer;
      }
      .lesson-cell.editable:hover {
        background: var(--tt-cell-hover) !important;
        opacity: 0.85;
      }
      .lesson-cell.empty.editable:hover {
        background: var(--tt-cell-hover) !important;
        opacity: 1;
      }
      .lesson-cell.current {
        box-shadow: inset 0 0 0 2px var(--tt-current-border);
      }
      .subject {
        font-weight: 600;
        display: block;
        line-height: 1.2;
      }
      .detail {
        display: block;
        font-size: 0.8em;
        opacity: 0.85;
        line-height: 1.2;
      }
      .dialog-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999;
      }
      .dialog {
        background: var(--card-background-color, #fff);
        border-radius: 12px;
        padding: 20px;
        width: 320px;
        max-width: 90vw;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
      }
      .dialog-wide {
        width: 420px;
      }
      .dialog-title {
        font-size: 1.2em;
        font-weight: 600;
        margin-bottom: 4px;
        color: var(--primary-text-color);
      }
      .dialog-subtitle {
        font-size: 0.9em;
        color: var(--secondary-text-color);
        margin-bottom: 16px;
      }
      .dialog-form label {
        display: block;
        font-size: 0.85em;
        font-weight: 500;
        margin-bottom: 4px;
        margin-top: 10px;
        color: var(--primary-text-color);
      }
      .dialog-form label:first-child {
        margin-top: 0;
      }
      .dialog-form input[type="text"],
      .dialog-form input[type="time"] {
        width: 100%;
        padding: 8px;
        border: 1px solid var(--tt-border);
        border-radius: 6px;
        font-size: 0.95em;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
        box-sizing: border-box;
      }
      .dialog-form input:focus {
        outline: none;
        border-color: var(--primary-color);
      }
      .color-picker {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .color-picker input[type="color"] {
        width: 36px;
        height: 36px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        padding: 0;
      }
      .color-presets {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
      }
      .color-dot {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        cursor: pointer;
        border: 2px solid transparent;
        transition: border-color 0.15s;
      }
      .color-dot:hover, .color-dot.selected {
        border-color: var(--primary-text-color);
      }
      .dialog-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-top: 18px;
      }
      .spacer { flex: 1; }
      .btn {
        padding: 8px 16px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-size: 0.9em;
        font-weight: 500;
        display: inline-flex;
        align-items: center;
      }
      .btn-primary {
        background: var(--primary-color);
        color: var(--text-primary-color, #fff);
      }
      .btn-secondary {
        background: var(--secondary-background-color, #e0e0e0);
        color: var(--primary-text-color);
      }
      .btn-danger {
        background: #f44336;
        color: #fff;
      }
      .btn-icon {
        padding: 4px;
        min-width: 0;
        background: none;
        color: #f44336;
      }
      .btn:hover {
        opacity: 0.85;
      }
      .ts-grid {
        display: grid;
        gap: 6px;
      }
      .ts-header, .ts-row {
        display: grid;
        grid-template-columns: 50px 1fr 1fr 36px;
        gap: 6px;
        align-items: center;
      }
      .ts-header span {
        font-size: 0.8em;
        font-weight: 600;
        color: var(--secondary-text-color);
      }
      .ts-slot-num {
        text-align: center;
        font-weight: 600;
      }
      .ts-row input[type="time"] {
        padding: 6px;
        border: 1px solid var(--tt-border);
        border-radius: 6px;
        font-size: 0.9em;
        background: var(--card-background-color, #fff);
        color: var(--primary-text-color);
      }
    `;
  }
}

customElements.define("ha-timetable-card", HaTimetableCard);


// ── Card Config Editor ────────────────────────────────────────────────────
class HaTimetableCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._rendered = false;
  }

  setConfig(config) {
    this._config = { ...config };
    if (!this._rendered) this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._rendered) this._render();
  }

  _render() {
    if (!this._hass || !this._config) return;
    this._rendered = true;
    const t = getTranslations(this._hass);

    this.shadowRoot.innerHTML = `
      <style>
        .editor { padding: 8px 0; }
        .row { display: flex; flex-direction: column; margin-bottom: 12px; }
        label { font-size: 0.85em; font-weight: 500; margin-bottom: 4px; color: var(--primary-text-color); }
        select, input { padding: 8px; border: 1px solid var(--divider-color, #e0e0e0); border-radius: 6px; background: var(--card-background-color, #fff); color: var(--primary-text-color); font-size: 0.95em; }
        .checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .checkbox-row label { margin: 0; }
      </style>
      <div class="editor">
        <div class="row">
          <label>Entity</label>
          <select id="entity">
            <option value="">-- Select --</option>
            ${Object.keys(this._hass.states)
              .filter(e => e.startsWith("sensor.") && this._hass.states[e]?.attributes?.timetable_data)
              .map(e => `<option value="${e}" ${e === this._config.entity ? "selected" : ""}>${this._hass.states[e].attributes.friendly_name || e}</option>`)
              .join("")}
          </select>
        </div>
        <div class="row">
          <label>Title</label>
          <input type="text" id="title" value="${this._config.title || ""}" placeholder="Optional title">
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="show_teacher" ${this._config.show_teacher !== false ? "checked" : ""}>
          <label>${t.teacher}</label>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="show_room" ${this._config.show_room !== false ? "checked" : ""}>
          <label>${t.room}</label>
        </div>
        <div class="checkbox-row">
          <input type="checkbox" id="compact" ${this._config.compact ? "checked" : ""}>
          <label>Compact</label>
        </div>
      </div>
    `;

    this.shadowRoot.getElementById("entity")?.addEventListener("change", (e) => this._updateConfig("entity", e.target.value));
    this.shadowRoot.getElementById("title")?.addEventListener("input", (e) => this._updateConfig("title", e.target.value));
    this.shadowRoot.getElementById("show_teacher")?.addEventListener("change", (e) => this._updateConfig("show_teacher", e.target.checked));
    this.shadowRoot.getElementById("show_room")?.addEventListener("change", (e) => this._updateConfig("show_room", e.target.checked));
    this.shadowRoot.getElementById("compact")?.addEventListener("change", (e) => this._updateConfig("compact", e.target.checked));
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    fireEvent(this, "config-changed", { config: this._config });
  }
}

customElements.define("ha-timetable-card-editor", HaTimetableCardEditor);

console.info(`%c HA-TIMETABLE-CARD %c v${CARD_VERSION} `, "background:#4CAF50;color:#fff;font-weight:bold;", "background:#333;color:#fff;");
