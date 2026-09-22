/* ==========================================================
   ATTENDANCE MANAGER 2.0
   Full-Stack REST & PostgreSQL Integration
=============================================================*/

// Current application state
let currentTab = "classes";
let editMode = false;
let currentUser = null;
let syncTimeout = null;

// Primary in-memory store matching the legacy structure for seamless compatibility
let store = {
    startDate: new Date().toISOString().split("T")[0],
    classes: {
        weeksVisible: 1,
        subjects: []
    },
    labs: {
        weeksVisible: 1,
        subjects: []
    }
};

/* ==========================================================
   AUTHENTICATION CHECK & USER PROFILE
========================================================== */

async function verifyAuth() {
    if (!API.isAuthenticated()) {
        window.location.href = "login.html";
        return false;
    }

    try {
        const profile = await API.get("/api/auth/me");
        if (profile.success && profile.user) {
            currentUser = profile.user;
            renderUserNavigation(currentUser);
            return true;
        } else {
            API.clearSession();
            window.location.href = "login.html";
            return false;
        }
    } catch (err) {
        console.warn("Auth check failed:", err.message);
        API.clearSession();
        window.location.href = "login.html";
        return false;
    }
}

function renderUserNavigation(user) {
    const nameEl = document.getElementById("nav-user-name");
    const rolePill = document.getElementById("nav-user-role");
    const adminLink = document.getElementById("nav-admin-link");

    if (nameEl) nameEl.textContent = user.name;
    if (rolePill) {
        rolePill.textContent = user.role.toUpperCase();
        if (user.role === "admin") {
            rolePill.classList.add("admin");
        }
    }

    if (adminLink) {
        if (user.role === "admin") {
            adminLink.classList.remove("hidden");
        } else {
            adminLink.classList.add("hidden");
        }
    }
}

/* ==========================================================
   LOAD DATA FROM BACKEND / DATABASE
========================================================== */

async function loadUserData() {
    setSyncStatus("loading", "Syncing with cloud...");
    try {
        // 1. Fetch user settings
        const settingsRes = await API.get("/api/attendance/settings");
        if (settingsRes.success && settingsRes.settings) {
            store.startDate = settingsRes.settings.startDate;
            store.classes.weeksVisible = settingsRes.settings.classesWeeksVisible || 1;
            store.labs.weeksVisible = settingsRes.settings.labsWeeksVisible || 1;
            document.getElementById("start-date").value = store.startDate;
        }

        // 2. Fetch subjects for classes and labs
        const [classesRes, labsRes] = await Promise.all([
            API.get("/api/subjects?type=classes"),
            API.get("/api/subjects?type=labs")
        ]);

        const formatSubjects = (subs) => subs.map(s => ({
            id: s.id,
            code: s.subject_code || "",
            name: s.subject_name || "",
            attendance: {}
        }));

        store.classes.subjects = classesRes.success ? formatSubjects(classesRes.subjects) : [];
        store.labs.subjects = labsRes.success ? formatSubjects(labsRes.subjects) : [];

        // 3. Fetch attendance records
        const attRes = await API.get("/api/attendance");
        if (attRes.success && Array.isArray(attRes.attendance)) {
            attRes.attendance.forEach(rec => {
                // Find matching subject across classes and labs
                const subject = store.classes.subjects.find(s => s.id === rec.subjectId)
                             || store.labs.subjects.find(s => s.id === rec.subjectId);

                if (subject) {
                    if (!subject.attendance[rec.date]) {
                        subject.attendance[rec.date] = { l1: 0, l2: 0, l3: 0, l4: 0, open: false };
                    }
                    subject.attendance[rec.date][rec.lecture] = rec.status;
                    if (rec.open) {
                        subject.attendance[rec.date].open = true;
                    }
                }
            });
        }

        setSyncStatus("synced", "Cloud Synced");
        render();
    } catch (err) {
        console.error("Error loading user data:", err);
        setSyncStatus("error", "Sync Error");
        showMessage("Failed to sync with cloud server.");
    }
}

/* ==========================================================
   SYNC STATUS INDICATOR
========================================================== */

function setSyncStatus(status, text) {
    const dot = document.getElementById("sync-dot");
    const label = document.getElementById("sync-label");

    if (!dot || !label) return;

    dot.className = "sync-dot";
    if (status === "saving" || status === "loading") {
        dot.classList.add("saving");
    }

    label.textContent = text;
}

/* ==========================================================
   CURRENT TAB DATA & DATE HELPERS
========================================================== */

function getActiveData() {
    return store[currentTab];
}

function getDateKey(date) {
    return date.toISOString().split("T")[0];
}

function generateDateList() {
    const dates = [];
    const activeData = getActiveData();
    const startDate = new Date(store.startDate);

    for (let week = 0; week < activeData.weeksVisible; week++) {
        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (week * 7) + day);
            dates.push(getDateKey(currentDate));
        }
    }

    return dates;
}

/* ==========================================================
   SWITCH TAB
========================================================== */

function switchTab(tab) {
    currentTab = tab;

    document.querySelectorAll(".toggle-container .glow-btn").forEach(button => {
        button.classList.remove("active");
    });

    const activeBtn = document.getElementById(`btn-${tab}`);
    if (activeBtn) activeBtn.classList.add("active");

    render();
}

/* ==========================================================
   TOGGLE EDIT MODE
========================================================== */

function toggleEditMode() {
    editMode = !editMode;

    const btnEdit = document.getElementById("btn-edit");
    if (btnEdit) {
        btnEdit.textContent = `EDIT MODE : ${editMode ? "ON" : "OFF"}`;
        btnEdit.classList.toggle("active", editMode);
    }

    const editControls = document.getElementById("edit-controls");
    if (editControls) {
        editControls.classList.toggle("hidden", !editMode);
    }

    render();
}

/* ==========================================================
   UPDATE START DATE
========================================================== */

async function updateStartDate(value) {
    store.startDate = value;
    render();

    try {
        setSyncStatus("saving", "Saving...");
        await API.put("/api/attendance/settings", {
            startDate: value,
            classesWeeksVisible: store.classes.weeksVisible,
            labsWeeksVisible: store.labs.weeksVisible
        });
        setSyncStatus("synced", "Cloud Synced");
    } catch (e) {
        setSyncStatus("error", "Sync Error");
    }
}

/* ==========================================================
   ADD SUBJECT
========================================================== */

async function addNewSubject() {
    try {
        setSyncStatus("saving", "Adding subject...");
        const res = await API.post("/api/subjects", {
            subject_code: "",
            subject_name: "",
            subject_type: currentTab
        });

        if (res.success && res.subject) {
            getActiveData().subjects.push({
                id: res.subject.id,
                code: res.subject.subject_code,
                name: res.subject.subject_name,
                attendance: {}
            });
            setSyncStatus("synced", "Cloud Synced");
            render();
            showMessage("Subject added");
        }
    } catch (err) {
        console.error("Add subject error:", err);
        showMessage("Failed to add subject");
    }
}

/* ==========================================================
   UPDATE SUBJECT CODE / NAME
========================================================== */

function updateSubject(index, field, value) {
    const subject = getActiveData().subjects[index];
    if (!subject) return;

    subject[field] = value;

    // Debounced API sync
    clearTimeout(subject._syncTimer);
    subject._syncTimer = setTimeout(async () => {
        if (!subject.id) return;
        try {
            setSyncStatus("saving", "Saving subject...");
            await API.put(`/api/subjects/${subject.id}`, {
                subject_code: subject.code,
                subject_name: subject.name
            });
            setSyncStatus("synced", "Cloud Synced");
        } catch (e) {
            setSyncStatus("error", "Sync Error");
        }
    }, 500);
}

/* ==========================================================
   DELETE SUBJECT
========================================================== */

async function deleteSubject(index) {
    const subject = getActiveData().subjects[index];
    if (!subject) return;

    const displayName = subject.name || subject.code || "this subject";
    if (!confirm(`Delete ${displayName}? All associated attendance records will be removed.`)) {
        return;
    }

    try {
        setSyncStatus("saving", "Deleting subject...");
        if (subject.id) {
            await API.delete(`/api/subjects/${subject.id}`);
        }
        getActiveData().subjects.splice(index, 1);
        setSyncStatus("synced", "Cloud Synced");
        render();
        showMessage("Subject deleted");
    } catch (err) {
        console.error("Delete subject error:", err);
        showMessage("Failed to delete subject");
    }
}

/* ==========================================================
   ADD / REMOVE WEEK
========================================================== */

async function addWeek() {
    getActiveData().weeksVisible++;
    render();
    await syncSettings();
}

async function removeWeek(index) {
    const activeData = getActiveData();

    if (activeData.weeksVisible <= 1) {
        alert("At least one week is required.");
        return;
    }

    if (!confirm(`Delete Week ${index + 1}?`)) {
        return;
    }

    activeData.weeksVisible--;
    render();
    await syncSettings();
}

async function syncSettings() {
    try {
        setSyncStatus("saving", "Saving...");
        await API.put("/api/attendance/settings", {
            startDate: store.startDate,
            classesWeeksVisible: store.classes.weeksVisible,
            labsWeeksVisible: store.labs.weeksVisible
        });
        setSyncStatus("synced", "Cloud Synced");
    } catch (e) {
        setSyncStatus("error", "Sync Error");
    }
}

/* ==========================================================
   MAIN RENDER
========================================================== */

function render() {
    renderTable();
    renderCharts();
}

/* ==========================================================
   RENDER TABLE
========================================================== */

function renderTable() {
    const tableBody = document.getElementById("table-body");
    const rowWeeks = document.getElementById("row-weeks");
    const rowDates = document.getElementById("row-dates");
    const rowDays = document.getElementById("row-days");
    const activeData = getActiveData();

    if (!tableBody || !rowWeeks || !rowDates || !rowDays) return;

    tableBody.innerHTML = "";
    rowWeeks.innerHTML = "";
    rowDates.innerHTML = "";
    rowDays.innerHTML = "";

    renderHeaders(rowWeeks, rowDates, rowDays, activeData);
    renderSubjectRows(tableBody, activeData);
}

/* ==========================================================
   RENDER TABLE HEADERS
========================================================== */

function renderHeaders(rowWeeks, rowDates, rowDays, activeData) {
    rowWeeks.innerHTML = `
        <th rowspan="3">SI</th>
        <th rowspan="3">CODE</th>
        <th rowspan="3">NAME</th>
    `;

    const startDate = new Date(store.startDate);

    for (let week = 0; week < activeData.weeksVisible; week++) {
        rowWeeks.innerHTML += `
            <th colspan="7" class="week-header">
                WEEK ${week + 1}
                ${
                    editMode
                    ? `<button class="del-btn" onclick="removeWeek(${week})">×</button>`
                    : ""
                }
            </th>
        `;

        for (let day = 0; day < 7; day++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + (week * 7) + day);

            rowDates.innerHTML += `
                <th>
                    ${currentDate.toLocaleDateString("en-US", { month: "short" })}
                </th>
            `;

            rowDays.innerHTML += `
                <th>
                    ${currentDate.toLocaleDateString("en-US", { weekday: "short" })}
                    <br>
                    ${currentDate.getDate()}
                </th>
            `;
        }
    }
}

/* ==========================================================
   RENDER SUBJECT ROWS
========================================================== */

function renderSubjectRows(tableBody, activeData) {
    const datesList = generateDateList();

    if (activeData.subjects.length === 0) {
        const emptyRow = document.createElement("tr");
        emptyRow.innerHTML = `
            <td colspan="${datesList.length + 3}" style="padding: 30px; text-align: center; color: var(--text-muted);">
                No subjects added yet. Click <strong>+ ADD SUBJECT</strong> above to create your first subject!
            </td>
        `;
        tableBody.appendChild(emptyRow);
        return;
    }

    activeData.subjects.forEach((subject, index) => {
        const row = document.createElement("tr");

        row.innerHTML = `
            <td>
                ${
                    editMode
                    ? `<button class="del-btn" onclick="deleteSubject(${index})">×</button>`
                    : index + 1
                }
            </td>
            <td>
                <input
                    class="glow-text"
                    value="${escapeHtml(subject.code)}"
                    placeholder="CODE"
                    ${editMode ? "" : "readonly"}
                    onchange="updateSubject(${index}, 'code', this.value)"
                >
            </td>
            <td>
                <input
                    class="glow-text"
                    value="${escapeHtml(subject.name)}"
                    placeholder="Subject Name"
                    ${editMode ? "" : "readonly"}
                    onchange="updateSubject(${index}, 'name', this.value)"
                >
            </td>
        `;

        datesList.forEach(dateKey => {
            initializeAttendanceDay(subject, dateKey);
            row.appendChild(createAttendanceCell(index, dateKey, subject));
        });

        tableBody.appendChild(row);
    });
}

function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/* ==========================================================
   CREATE ATTENDANCE CELL
========================================================== */

function createAttendanceCell(subjectIndex, dateKey, subject) {
    initializeAttendanceDay(subject, dateKey);
    const attendance = subject.attendance[dateKey];

    const td = document.createElement("td");
    const container = document.createElement("div");
    container.className = "attendance-container";

    // Main Lecture (L1)
    const mainRow = document.createElement("div");
    mainRow.className = "main-attendance";

    const box = document.createElement("div");
    box.className = "att-box";
    updateAttendanceBox(box, attendance.l1);

    let clickTimer;

    // Single Click -> Mark Absent (1)
    box.onclick = () => {
        clearTimeout(clickTimer);
        clickTimer = setTimeout(() => {
            handleAttendanceClick(subjectIndex, dateKey, "l1", false);
        }, 250);
    };

    // Double Click -> Mark Present (2)
    box.ondblclick = () => {
        clearTimeout(clickTimer);
        handleAttendanceClick(subjectIndex, dateKey, "l1", true);
    };

    const toggle = document.createElement("button");
    toggle.className = "lecture-toggle";
    toggle.innerHTML = attendance.open ? "▲" : "▼";
    toggle.title = "Toggle L2-L4 Lectures";
    toggle.onclick = function () {
        toggleLecturePanel(this, subjectIndex, dateKey);
    };

    mainRow.appendChild(box);
    mainRow.appendChild(toggle);
    container.appendChild(mainRow);

    // Extra Lectures Panel (L2-L4)
    const panel = document.createElement("div");
    panel.className = "lecture-panel";
    if (attendance.open) {
        panel.classList.add("show");
    }

    renderLectureBoxes(panel, subjectIndex, dateKey, attendance);
    container.appendChild(panel);

    td.appendChild(container);
    return td;
}

/* ==========================================================
   ATTENDANCE CLICK HANDLER
   - Single Click: Unmarked (0) -> Absent (1) -> Unmarked (0)
   - Double Click: Unmarked/Absent -> Present (2) -> Unmarked (0)
========================================================== */

async function handleAttendanceClick(subjectIndex, dateKey, lecture, doubleClick) {
    const subject = getActiveData().subjects[subjectIndex];
    if (!subject) return;

    initializeAttendanceDay(subject, dateKey);
    let current = subject.attendance[dateKey][lecture];
    let newStatus = 0;

    if (doubleClick) {
        newStatus = current === 2 ? 0 : 2;
    } else {
        if (current === 0) {
            newStatus = 1;
        } else if (current === 1) {
            newStatus = 0;
        } else if (current === 2) {
            newStatus = 0;
        }
    }

    // Optimistic UI update
    subject.attendance[dateKey][lecture] = newStatus;
    render();

    // Backend database persistence
    try {
        setSyncStatus("saving", "Saving attendance...");
        await API.post("/api/attendance/mark", {
            subject_id: subject.id,
            date: dateKey,
            lecture_number: lecture,
            attendance_status: newStatus
        });
        setSyncStatus("synced", "Cloud Synced");
    } catch (err) {
        console.error("Failed to persist attendance:", err);
        setSyncStatus("error", "Sync Error");
        showMessage("Failed to save attendance change.");
    }
}

/* ==========================================================
   UPDATE ATTENDANCE BOX ICON & STYLING
========================================================== */

function updateAttendanceBox(box, state) {
    box.classList.remove("present", "absent");
    box.innerHTML = "";

    if (box.classList.contains("att-box")) {
        if (state === 1) {
            box.classList.add("absent");
            box.innerHTML = "❌";
        } else if (state === 2) {
            box.classList.add("present");
            box.innerHTML = "✔";
        }
    } else if (box.classList.contains("extra-box")) {
        if (state === 1) {
            box.classList.add("absent");
            box.innerHTML = "✖";
        } else if (state === 2) {
            box.classList.add("present");
            box.innerHTML = "✓";
        }
    }
}

/* ==========================================================
   TOGGLE LECTURE PANEL (L2-L4)
========================================================== */

async function toggleLecturePanel(button, subjectIndex, dateKey) {
    const subject = getActiveData().subjects[subjectIndex];
    if (!subject) return;

    initializeAttendanceDay(subject, dateKey);
    const isOpen = !subject.attendance[dateKey].open;
    subject.attendance[dateKey].open = isOpen;

    const container = button.closest(".attendance-container");
    if (container) {
        const panel = container.querySelector(".lecture-panel");
        if (panel) {
            panel.classList.toggle("show", isOpen);
        }
    }

    button.innerHTML = isOpen ? "▲" : "▼";

    // Sync panel state with backend
    try {
        if (subject.id) {
            await API.post("/api/attendance/panel-state", {
                subject_id: subject.id,
                date: dateKey,
                open: isOpen
            });
        }
    } catch (e) {
        // silent
    }
}

/* ==========================================================
   RENDER EXTRA LECTURE BOXES (L2, L3, L4)
========================================================== */

function renderLectureBoxes(panel, subjectIndex, dateKey, attendance) {
    const lectures = ["l2", "l3", "l4"];

    lectures.forEach((lecture, index) => {
        const row = document.createElement("div");
        row.className = "lecture-row";

        const label = document.createElement("span");
        label.className = "lecture-label";
        label.textContent = `L${index + 2}`;

        const box = document.createElement("div");
        box.className = "extra-box";
        updateAttendanceBox(box, attendance[lecture]);

        let clickTimer;

        box.onclick = () => {
            clearTimeout(clickTimer);
            clickTimer = setTimeout(() => {
                handleAttendanceClick(subjectIndex, dateKey, lecture, false);
            }, 250);
        };

        box.ondblclick = () => {
            clearTimeout(clickTimer);
            handleAttendanceClick(subjectIndex, dateKey, lecture, true);
        };

        row.appendChild(label);
        row.appendChild(box);
        panel.appendChild(row);
    });
}

/* ==========================================================
   INITIALIZE ATTENDANCE DAY OBJECT
========================================================== */

function initializeAttendanceDay(subject, dateKey) {
    if (!subject.attendance) {
        subject.attendance = {};
    }

    if (!subject.attendance[dateKey]) {
        subject.attendance[dateKey] = {
            l1: 0,
            l2: 0,
            l3: 0,
            l4: 0,
            open: false
        };
    } else if (typeof subject.attendance[dateKey] === "number") {
        subject.attendance[dateKey] = {
            l1: subject.attendance[dateKey],
            l2: 0,
            l3: 0,
            l4: 0,
            open: false
        };
    }

    ["l1", "l2", "l3", "l4"].forEach(lec => {
        if (subject.attendance[dateKey][lec] === undefined) {
            subject.attendance[dateKey][lec] = 0;
        }
    });

    if (subject.attendance[dateKey].open === undefined) {
        subject.attendance[dateKey].open = false;
    }

    return subject.attendance[dateKey];
}

/* ==========================================================
   STATISTICS & PERCENTAGES
========================================================== */

function countLectureAttendance(subject) {
    let present = 0;
    let absent = 0;

    if (!subject.attendance) return { present: 0, absent: 0, total: 0 };

    Object.values(subject.attendance).forEach(day => {
        if (typeof day === "number") {
            if (day === 2) present++;
            else if (day === 1) absent++;
            return;
        }

        ["l1", "l2", "l3", "l4"].forEach(lecture => {
            const state = day[lecture] ?? 0;
            if (state === 2) present++;
            else if (state === 1) absent++;
        });
    });

    return {
        present,
        absent,
        total: present + absent
    };
}

function getAttendanceStats(subject) {
    const stats = countLectureAttendance(subject);
    return {
        present: stats.present,
        absent: stats.absent,
        total: stats.total,
        percentage: stats.total === 0
            ? 0
            : Number(((stats.present * 100) / stats.total).toFixed(1))
    };
}

function getOverallAttendance() {
    let totalPresent = 0;
    let totalAbsent = 0;

    getActiveData().subjects.forEach(subject => {
        const stats = getAttendanceStats(subject);
        totalPresent += stats.present;
        totalAbsent += stats.absent;
    });

    const total = totalPresent + totalAbsent;
    return {
        present: totalPresent,
        absent: totalAbsent,
        total: total,
        percentage: total === 0 ? 0 : Number(((totalPresent * 100) / total).toFixed(1))
    };
}

/* ==========================================================
   RENDER CIRCULAR DONUT CHARTS
========================================================== */

function renderCharts() {
    const chartContainer = document.getElementById("charts-container");
    if (!chartContainer) return;

    chartContainer.innerHTML = "";
    const subjects = getActiveData().subjects;

    if (subjects.length === 0) {
        chartContainer.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 25px; color: var(--text-muted);">
                Charts will appear once subjects are added.
            </div>
        `;
        return;
    }

    subjects.forEach((subject, index) => {
        const stats = getAttendanceStats(subject);

        const card = document.createElement("div");
        card.className = "chart-card";
        card.innerHTML = `
            <canvas id="chart-${index}" width="170" height="170"></canvas>
            <p>
                <strong>${escapeHtml(subject.code || "UNTITLED")}</strong><br>
                ${escapeHtml(subject.name || "Subject " + (index + 1))}<br><br>
                Present: <strong class="stat-present">${stats.present}</strong> &nbsp;&nbsp;
                Absent: <strong class="stat-absent">${stats.absent}</strong><br><br>
                Attendance: <strong>${stats.percentage}%</strong>
            </p>
        `;

        chartContainer.appendChild(card);

        setTimeout(() => {
            drawChart(`chart-${index}`, stats.percentage);
        }, 30);
    });

    highlightLowAttendance();
}

// Read a colour token from the active theme (falls back if the CSS variable is missing)
function themeColor(name, fallback) {
    const value = getComputedStyle(document.body).getPropertyValue(name).trim();
    return value || fallback;
}

function drawChart(id, percentage) {
    const canvas = document.getElementById(id);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const cx = 85;
    const cy = 85;
    const radius = 60;
    const isLightTheme = document.body.classList.contains("light-theme");
    const trackColor = themeColor("--chart-track", isLightTheme ? "#E2E8F0" : "#2A3956");
    const okColor = themeColor("--chart-ok", isLightTheme ? "#0284C7" : "#38BDF8");
    const lowColor = themeColor("--chart-low", isLightTheme ? "#DC2626" : "#F87171");
    const textColor = themeColor("--text", isLightTheme ? "#0F172A" : "#F1F5F9");

    ctx.clearRect(0, 0, 170, 170);

    // Background circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = trackColor;
    ctx.stroke();

    // Progress Arc
    ctx.beginPath();
    ctx.arc(
        cx,
        cy,
        radius,
        -Math.PI / 2,
        (-Math.PI / 2) + (Math.PI * 2 * percentage / 100)
    );
    ctx.lineWidth = 14;
    ctx.lineCap = "round";

    // Dynamic color depending on percentage threshold (75% criterion)
    if (percentage >= 75) {
        try {
            const grad = ctx.createLinearGradient(0, 0, 170, 170);
            grad.addColorStop(0, isLightTheme ? "#7C3AED" : "#8B5CF6");
            grad.addColorStop(0.5, isLightTheme ? "#DB2777" : "#C026D3");
            grad.addColorStop(1, isLightTheme ? "#0284C7" : "#06B6D4");
            ctx.strokeStyle = grad;
        } catch (e) {
            ctx.strokeStyle = okColor;
        }
    } else {
        ctx.strokeStyle = lowColor;
    }
    ctx.stroke();

    // Percentage Text
    ctx.fillStyle = textColor;
    ctx.font = "bold 22px Poppins";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${percentage}%`, cx, cy);
}

// Redraw charts when theme is toggled
window.onThemeChanged = function () {
    renderCharts();
};

/* ==========================================================
   HIGHLIGHT LOW ATTENDANCE (< 75%)
========================================================== */

function highlightLowAttendance() {
    const rows = document.querySelectorAll("#table-body tr");
    getActiveData().subjects.forEach((subject, index) => {
        const stats = getAttendanceStats(subject);
        if (rows[index]) {
            if (stats.total > 0 && stats.percentage < 75) {
                rows[index].classList.add("low-attendance");
            } else {
                rows[index].classList.remove("low-attendance");
            }
        }
    });
}

/* ==========================================================
   SEARCH SUBJECTS
========================================================== */

function searchSubjects(keyword) {
    keyword = (keyword || "").toLowerCase().trim();
    const rows = document.querySelectorAll("#table-body tr");
    const subjects = getActiveData().subjects;

    rows.forEach((row, index) => {
        if (!subjects[index]) return;
        const code = (subjects[index].code || "").toLowerCase();
        const name = (subjects[index].name || "").toLowerCase();

        if (code.includes(keyword) || name.includes(keyword)) {
            row.style.display = "";
        } else {
            row.style.display = "none";
        }
    });
}

/* ==========================================================
   RESET APPLICATION
========================================================== */

async function resetApplication() {
    if (!confirm("Are you sure you want to delete ALL subjects and attendance records from your account? This action cannot be undone.")) {
        return;
    }

    try {
        setSyncStatus("saving", "Resetting...");
        const activeData = getActiveData();
        for (const sub of [...activeData.subjects]) {
            if (sub.id) {
                await API.delete(`/api/subjects/${sub.id}`);
            }
        }
        activeData.subjects = [];
        activeData.weeksVisible = 1;
        await syncSettings();
        setSyncStatus("synced", "Cloud Synced");
        render();
        showMessage("Attendance data cleared.");
    } catch (err) {
        console.error("Reset error:", err);
        showMessage("Failed to reset application data.");
    }
}

/* ==========================================================
   EXPORT DATA (JSON)
========================================================== */

async function exportData() {
    try {
        showMessage("Preparing export...");
        const res = await API.get("/api/attendance/export");
        if (res.success && res.data) {
            const dataStr = JSON.stringify(res.data, null, 4);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `Attendance_Backup_${currentUser ? currentUser.name.replace(/\s+/g, '_') : 'User'}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            showMessage("Backup downloaded successfully.");
        } else {
            showMessage("Failed to export data.");
        }
    } catch (err) {
        console.error("Export error:", err);
        showMessage("Export error: " + err.message);
    }
}

/* ==========================================================
   IMPORT DATA (JSON)
========================================================== */

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (!confirm("Import attendance data into your account? Existing records will be updated.")) {
                return;
            }

            setSyncStatus("saving", "Importing data...");
            const res = await API.post("/api/attendance/migrate", data);
            if (res.success) {
                showMessage(res.message || "Backup imported successfully!");
                await loadUserData();
            } else {
                alert("Import failed: " + (res.message || "Invalid file format"));
            }
        } catch (err) {
            alert("Invalid JSON backup file.");
        } finally {
            event.target.value = "";
        }
    };
    reader.readAsText(file);
}

/* ==========================================================
   TOAST MESSAGE HELPER
========================================================== */

function showMessage(message) {
    const oldToast = document.getElementById("toast");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.id = "toast";
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 2800);
}

/* ==========================================================
   KEYBOARD SHORTCUTS
========================================================== */

document.addEventListener("keydown", (e) => {
    // Check if user is typing in an input
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
        if (e.key === "Escape") {
            document.activeElement.blur();
        }
        return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        loadUserData();
        showMessage("Synced with cloud");
    } else if (e.ctrlKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        exportData();
    } else if (e.ctrlKey && e.key.toLowerCase() === "r") {
        e.preventDefault();
        resetApplication();
    } else if (e.ctrlKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        const searchInput = document.getElementById("search-input");
        if (searchInput) {
            searchInput.focus();
        } else {
            const kw = prompt("Search Subject Code or Name:");
            if (kw) searchSubjects(kw);
        }
    } else if (e.ctrlKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        addNewSubject();
    } else if (e.ctrlKey && e.key.toLowerCase() === "w") {
        e.preventDefault();
        addWeek();
    } else if (e.ctrlKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        switchTab("labs");
    } else if (e.ctrlKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        switchTab("classes");
    }
});

/* ==========================================================
   INITIALIZE APPLICATION
========================================================== */

function attachEvents() {
    document.getElementById("btn-classes")?.addEventListener("click", () => switchTab("classes"));
    document.getElementById("btn-labs")?.addEventListener("click", () => switchTab("labs"));
    document.getElementById("btn-edit")?.addEventListener("click", toggleEditMode);
    document.getElementById("btn-add-subject")?.addEventListener("click", addNewSubject);
    document.getElementById("btn-add-week")?.addEventListener("click", addWeek);
    document.getElementById("btn-export")?.addEventListener("click", exportData);
    document.getElementById("btn-reset")?.addEventListener("click", resetApplication);
    document.getElementById("btn-import-trigger")?.addEventListener("click", () => {
        document.getElementById("file-import")?.click();
    });
    document.getElementById("file-import")?.addEventListener("change", importData);

    const dateInput = document.getElementById("start-date");
    dateInput?.addEventListener("change", e => updateStartDate(e.target.value));

    const searchInput = document.getElementById("search-input");
    searchInput?.addEventListener("input", e => searchSubjects(e.target.value));
}

window.addEventListener("DOMContentLoaded", async () => {
    const authenticated = await verifyAuth();
    if (authenticated) {
        attachEvents();
        await loadUserData();
        MigrationManager.checkAndShowBanner();
    }
});

// Expose globals
window.updateSubject = updateSubject;
window.deleteSubject = deleteSubject;
window.removeWeek = removeWeek;
window.loadUserData = loadUserData;
window.showMessage = showMessage;
