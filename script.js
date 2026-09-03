/* ==========================================================
   ATTENDANCE MANAGER
=============================================================*/

/* ==========================================================
   GLOBAL VARIABLES
========================================================== */

let currentTab = "classes";
let editMode = false;

const STORAGE_KEY = "attendanceManagerData";

/* ==========================================================
   DEFAULT STORE
========================================================== */

function createDefaultStore() {

    return {

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

}

/* ==========================================================
   LOAD STORE
========================================================== */

function loadStore() {

    try {

        const data = localStorage.getItem(STORAGE_KEY);

        if (!data) {

            return createDefaultStore();

        }

        const store = JSON.parse(data);

        /* ---------- Automatic Migration ---------- */

        ["classes","labs"].forEach(type=>{

            if(!store[type]){

                return;

            }

            if(!Array.isArray(store[type].subjects)){

                store[type].subjects = [];

            }

            store[type].subjects.forEach(subject=>{

                if(!subject.attendance){

                    subject.attendance = {};

                }

                Object.keys(subject.attendance).forEach(date=>{

                    const value = subject.attendance[date];

                    /* Old format */

                    if(typeof value === "number"){

                        subject.attendance[date] = {

                            l1 : value,

                            l2 : 0,

                            l3 : 0,

                            l4 : 0

                        };

                    }

                });

            });

        });

        return store;

    }

    catch(error){

        console.error("Unable to load Local Storage.");

        return createDefaultStore();

    }

}

/* ==========================================================
   STORE
========================================================== */

let store = loadStore();

/* ==========================================================
   SAVE STORE
========================================================== */

function saveStore() {

    localStorage.setItem(

        STORAGE_KEY,

        JSON.stringify(store)

    );

}
/* ==========================================================
   CURRENT TAB DATA
========================================================== */

function getActiveData() {

    return store[currentTab];

}

/* ==========================================================
   DATE KEY
========================================================== */

function getDateKey(date) {

    return date.toISOString().split("T")[0];

}

/* ==========================================================
   INITIALIZE
========================================================== */

function initializeApp() {

    document.getElementById("start-date").value =
        store.startDate;

    attachEvents();

    render();

}

/* ==========================================================
   PAGE LOAD
========================================================== */

window.addEventListener(

    "DOMContentLoaded",

    initializeApp

);

/* ==========================================================
   SAVE BEFORE CLOSE
========================================================== */

window.addEventListener(

    "beforeunload",

    saveStore

);
/* ==========================================================
   ATTACH EVENTS
========================================================== */

function attachEvents() {

    document
        .getElementById("btn-classes")
        .addEventListener(
            "click",
            () => switchTab("classes")
        );

    document
        .getElementById("btn-labs")
        .addEventListener(
            "click",
            () => switchTab("labs")
        );

    document
        .getElementById("btn-edit")
        .addEventListener(
            "click",
            toggleEditMode
        );

    document
        .getElementById("btn-add-subject")
        .addEventListener(
            "click",
            addNewSubject
        );

    document
        .getElementById("btn-add-week")
        .addEventListener(
            "click",
            addWeek
        );

    document
        .getElementById("start-date")
        .addEventListener(
            "change",
            e => updateStartDate(e.target.value)
        );

}

/* ==========================================================
   SWITCH TAB
========================================================== */

function switchTab(tab) {

    currentTab = tab;

    document
        .querySelectorAll(".toggle-container .glow-btn")
        .forEach(button => {

            button.classList.remove("active");

        });

    document
        .getElementById(`btn-${tab}`)
        .classList.add("active");

    render();

}

/* ==========================================================
   TOGGLE EDIT MODE
========================================================== */

function toggleEditMode() {

    editMode = !editMode;

    document
        .getElementById("btn-edit")
        .textContent =
        `EDIT MODE : ${editMode ? "ON" : "OFF"}`;

    document
        .getElementById("edit-controls")
        .classList.toggle(
            "hidden",
            !editMode
        );

    render();

}

/* ==========================================================
   UPDATE START DATE
========================================================== */

function updateStartDate(value) {

    store.startDate = value;

    save();

}

/* ==========================================================
   ADD SUBJECT
========================================================== */

function addNewSubject() {

    getActiveData().subjects.push({

        code: "",

        name: "",

        attendance: {}

    });

    save();

}

/* ==========================================================
   ADD WEEK
========================================================== */

function addWeek() {

    getActiveData().weeksVisible++;

    save();

}

/* ==========================================================
   REMOVE WEEK
========================================================== */

function removeWeek(index) {

    const activeData = getActiveData();

    if (activeData.weeksVisible <= 1) {

        alert("At least one week is required.");

        return;

    }

    if (!confirm(`Delete Week ${index + 1}?`)) {

        return;

    }

    activeData.weeksVisible--;

    save();

}

/* ==========================================================
   DELETE SUBJECT
========================================================== */

function deleteSubject(index) {

    if (!confirm("Delete this subject?")) {

        return;

    }

    getActiveData().subjects.splice(index, 1);

    save();

}

/* ==========================================================
   UPDATE SUBJECT DETAILS
========================================================== */

function updateSubject(index, field, value) {

    getActiveData().subjects[index][field] = value;

    save();

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

    tableBody.innerHTML = "";

    rowWeeks.innerHTML = "";

    rowDates.innerHTML = "";

    rowDays.innerHTML = "";

    renderHeaders(

        rowWeeks,

        rowDates,

        rowDays,

        activeData

    );

    renderSubjectRows(

        tableBody,

        activeData

    );

}

/* ==========================================================
   TABLE HEADERS
========================================================== */

function renderHeaders(

    rowWeeks,

    rowDates,

    rowDays,

    activeData

) {

    rowWeeks.innerHTML = `

        <th rowspan="3">SI</th>

        <th rowspan="3">CODE</th>

        <th rowspan="3">NAME</th>

    `;

    const startDate = new Date(store.startDate);

    for (

        let week = 0;

        week < activeData.weeksVisible;

        week++

    ) {

        rowWeeks.innerHTML += `

            <th
                colspan="7"
                class="week-header">

                WEEK ${week + 1}

                ${

                    editMode

                    ?

                    `<button
                        class="del-btn"
                        onclick="removeWeek(${week})">

                        ×

                    </button>`

                    :

                    ""

                }

            </th>

        `;

        for (

            let day = 0;

            day < 7;

            day++

        ) {

            const currentDate = new Date(startDate);

            currentDate.setDate(

                startDate.getDate()

                +

                week * 7

                +

                day

            );

            rowDates.innerHTML += `

                <th>

                    ${currentDate.toLocaleDateString(

                        "en-US",

                        {

                            month: "short"

                        }

                    )}

                </th>

            `;

            rowDays.innerHTML += `

                <th>

                    ${currentDate.toLocaleDateString(

                        "en-US",

                        {

                            weekday: "short"

                        }

                    )}

                    <br>

                    ${currentDate.getDate()}

                </th>

            `;

        }

    }

}

/* ==========================================================
   GENERATE DATE LIST
========================================================== */

function generateDateList() {

    const dates = [];

    const activeData = getActiveData();

    const startDate = new Date(store.startDate);

    for (

        let week = 0;

        week < activeData.weeksVisible;

        week++

    ) {

        for (

            let day = 0;

            day < 7;

            day++

        ) {

            const currentDate = new Date(startDate);

            currentDate.setDate(

                startDate.getDate()

                +

                week * 7

                +

                day

            );

            dates.push(

                getDateKey(currentDate)

            );

        }

    }

    return dates;

}

/* ==========================================================
   PLACEHOLDER
========================================================== */

function renderSubjectRows(

    tableBody,

    activeData

) {
}

/* ==========================================================
   RENDER SUBJECT ROWS
========================================================== */

function renderSubjectRows(tableBody, activeData){

    const datesList = generateDateList();

    activeData.subjects.forEach((subject,index)=>{

        const row = document.createElement("tr");

        row.innerHTML = `

            <td>

                ${
                    editMode
                    ?
                    `<button
                        class="del-btn"
                        onclick="deleteSubject(${index})">
                        ×
                    </button>`
                    :
                    index + 1
                }

            </td>

            <td>

                <input
                    class="glow-text"
                    value="${subject.code}"
                    ${editMode ? "" : "readonly"}
                    onchange="updateSubject(${index},'code',this.value)"
                >

            </td>

            <td>

                <input
                    class="glow-text"
                    value="${subject.name}"
                    ${editMode ? "" : "readonly"}
                    onchange="updateSubject(${index},'name',this.value)"
                >

            </td>

        `;

        datesList.forEach(dateKey=>{

            initializeAttendanceDay(subject,dateKey);

            row.appendChild(

                createAttendanceCell(

                    index,

                    dateKey,

                    subject

                )
          
            );

        });

        tableBody.appendChild(row);

    });

}
/* ==========================================================
   CREATE ATTENDANCE CELL
========================================================== */

function createAttendanceCell(subjectIndex, dateKey, subject){

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

    box.onclick = () => {

        clearTimeout(clickTimer);

        clickTimer = setTimeout(() => {

            handleAttendanceClick(
                subjectIndex,
                dateKey,
                "l1",
                false
            );

        }, 250);

    };

    box.ondblclick = () => {

        clearTimeout(clickTimer);

        handleAttendanceClick(
            subjectIndex,
            dateKey,
            "l1",
            true
        );

    };

    const toggle = document.createElement("button");

    toggle.className = "lecture-toggle";

    toggle.innerHTML = "▼";

    toggle.title = "Show More Lectures";

    toggle.onclick = function(){

        toggleLecturePanel(this);

    };

    mainRow.appendChild(box);

    mainRow.appendChild(toggle);

    container.appendChild(mainRow);

    const panel = document.createElement("div");

    panel.className = "lecture-panel";

    // Keep panel open if it was previously opened
    if (attendance.open) {
        panel.classList.add("show");
    }

    renderLectureBoxes(
        panel,
        subjectIndex,
        dateKey,
        attendance
    );

    container.appendChild(panel);

    td.appendChild(container);

    return td;

}
/* ==========================================================
   HANDLE ATTENDANCE CLICK
========================================================== */

function handleAttendanceClick(

    subjectIndex,

    dateKey,

    lecture,

    doubleClick

){

    const subject =

        getActiveData()

        .subjects[subjectIndex];

    initializeAttendanceDay(

        subject,

        dateKey

    );

    let current =

        subject.attendance[dateKey][lecture];

    if(doubleClick){

        subject.attendance[dateKey][lecture] = 2;

    }

    else{

        if(current === 0){

            subject.attendance[dateKey][lecture] = 1;

        }

        else if(current === 1){

            subject.attendance[dateKey][lecture] = 0;

        }

        else if(current === 2){

            subject.attendance[dateKey][lecture] = 0;

        }

    }

    save();

}

/* ==========================================================
   UPDATE ATTENDANCE BOX
========================================================== */

function updateAttendanceBox(box, state){

    // Remove previous styles
    box.classList.remove(

        "present",

        "absent"

    );

    // Default appearance
    box.innerHTML = "";

    // Main attendance box
    if(box.classList.contains("att-box")){

        if(state === 1){

            box.classList.add("absent");

            box.innerHTML = "❌";

        }

        else if(state === 2){

            box.classList.add("present");

            box.innerHTML = "✔";

        }

    }

    // Extra lecture boxes
    else if(box.classList.contains("extra-box")){

        if(state === 1){

            box.classList.add("absent");

            box.innerHTML = "✖";

        }

        else if(state === 2){

            box.classList.add("present");

            box.innerHTML = "✓";

        }

    }

}

/* ==========================================================
   MARK PRESENT
========================================================== */

function markPresent(subjectIndex, dateKey) {

    getActiveData()

        .subjects[subjectIndex]

        .attendance[dateKey] = 2;

    save();

}

/* ==========================================================
   MARK ABSENT
========================================================== */

function markAbsent(subjectIndex, dateKey) {

    getActiveData()

        .subjects[subjectIndex]

        .attendance[dateKey] = 1;

    save();

}

/* ==========================================================
   CLEAR ATTENDANCE
========================================================== */

function clearAttendance(subjectIndex, dateKey) {

    delete getActiveData()

        .subjects[subjectIndex]

        .attendance[dateKey];

    save();

}

/* ==========================================================
   TOGGLE ATTENDANCE
========================================================== */

function toggleAttendance(subjectIndex, dateKey) {

    const subject =

        getActiveData()

        .subjects[subjectIndex];

    const state =

        subject.attendance[dateKey] || 0;

    if (state === 0) {

        subject.attendance[dateKey] = 1;

    }

    else if (state === 1) {

        subject.attendance[dateKey] = 2;

    }

    else {

        delete subject.attendance[dateKey];

    }

    save();

}
/* ==========================================================
   RENDER CHARTS
========================================================== */

function renderCharts(){

    const chartContainer =
        document.getElementById("charts-container");

    chartContainer.innerHTML = "";

    const subjects =
        getActiveData().subjects;

    subjects.forEach((subject,index)=>{

        const stats =
            getAttendanceStats(subject);

        chartContainer.innerHTML += `

            <div class="chart-card">

                <canvas
                    id="chart-${index}"
                    width="170"
                    height="170">
                </canvas>

                <p>

                    <strong>${subject.code}</strong>

                    <br>

                    ${subject.name}

                    <br><br>

                    Present :
                    <strong>${stats.present}</strong>

                    &nbsp;&nbsp;

                    Absent :
                    <strong>${stats.absent}</strong>

                    <br><br>

                    Attendance

                    <strong>${stats.percentage}%</strong>

                </p>

            </div>

        `;

        setTimeout(()=>{

            drawChart(

                `chart-${index}`,

                stats.percentage

            );

        },20);

    });

}
/* ==========================================================
   DRAW DONUT CHART
========================================================== */

function drawChart(id, percentage) {

    const canvas = document.getElementById(id);

    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    const cx = 85;
    const cy = 85;
    const radius = 60;

    ctx.clearRect(0, 0, 170, 170);

    /* Background Circle */

    ctx.beginPath();

    ctx.arc(cx, cy, radius, 0, Math.PI * 2);

    ctx.lineWidth = 14;

    ctx.strokeStyle = "rgba(255,255,255,.15)";

    ctx.stroke();

    /* Progress Arc */

    ctx.beginPath();

    ctx.arc(

        cx,

        cy,

        radius,

        -Math.PI / 2,

        (-Math.PI / 2) +

        (Math.PI * 2 * percentage / 100)

    );

    ctx.lineWidth = 14;

    ctx.lineCap = "round";

    ctx.strokeStyle = "#00E5FF";

    ctx.stroke();

    /* Percentage Text */

    ctx.fillStyle = "#ffffff";

    ctx.font = "bold 22px Poppins";

    ctx.textAlign = "center";

    ctx.textBaseline = "middle";

    ctx.fillText(

        percentage + "%",

        cx,

        cy

    );

}

/* ==========================================================
   SUBJECT STATISTICS
========================================================== */

function countLectureAttendance(subject){

    let present = 0;

    let absent = 0;

    Object.values(subject.attendance).forEach(day=>{

        // Backward compatibility
        if(typeof day === "number"){

            if(day === 2){

                present++;

            }

            else if(day === 1){

                absent++;

            }

            return;

        }

        ["l1","l2","l3","l4"].forEach(lecture=>{

            const state = day[lecture] ?? 0;

            if(state === 2){

                present++;

            }

            else if(state === 1){

                absent++;

            }

        });

    });

    return{

        present,

        absent,

        total : present + absent

    };

}


/* ==========================================================
   GET ATTENDANCE STATISTICS
========================================================== */

function getAttendanceStats(subject){

    const stats = countLectureAttendance(subject);

    return{

        present : stats.present,

        absent : stats.absent,

        total : stats.total,

        percentage :

            stats.total === 0

            ? 0

            : Number(

                (

                    (stats.present * 100)

                    /

                    stats.total

                ).toFixed(1)

            )

    };

}

/* ==========================================================
   OVERALL ATTENDANCE
========================================================== */

function getOverallAttendance(){

    let totalPresent = 0;

    let totalAbsent = 0;

    getActiveData().subjects.forEach(subject=>{

        const stats = getAttendanceStats(subject);

        totalPresent += stats.present;

        totalAbsent += stats.absent;

    });

    const total = totalPresent + totalAbsent;

    return{

        present : totalPresent,

        absent : totalAbsent,

        total : total,

        percentage :

            total === 0

            ? 0

            : Number(

                (

                    totalPresent * 100

                    /

                    total

                ).toFixed(1)

            )

    };

}

/* ==========================================================
   AUTO SAVE
========================================================== */

setInterval(() => {

    saveStore();

}, 30000);
/* ==========================================================
   EXPORT DATA
========================================================== */

function exportData() {

    const data = JSON.stringify(store, null, 4);

    const blob = new Blob(
        [data],
        {
            type: "application/json"
        }
    );

    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");

    link.href = url;

    link.download = "Attendance_Backup.json";

    document.body.appendChild(link);

    link.click();

    document.body.removeChild(link);

    URL.revokeObjectURL(url);

    showMessage("Backup Downloaded");

}

/* ==========================================================
   IMPORT DATA
========================================================== */

function importData(event) {

    const file = event.target.files[0];

    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {

        try {

            store = JSON.parse(e.target.result);

            save();

            showMessage("Backup Imported");

        }

        catch {

            alert("Invalid Backup File");

        }

    };

    reader.readAsText(file);

}

/* ==========================================================
   RESET APPLICATION
========================================================== */

function resetApplication() {

    if (!confirm("Delete all attendance data?")) {

        return;

    }

    store = createDefaultStore();

    save();

    showMessage("Application Reset");

}

/* ==========================================================
   CLEAR STORAGE
========================================================== */

function clearStorage() {

    localStorage.removeItem(STORAGE_KEY);

}

/* ==========================================================
   STORAGE SIZE
========================================================== */

function storageSize() {

    const data = localStorage.getItem(STORAGE_KEY);

    if (!data) return "0 KB";

    return (data.length / 1024).toFixed(2) + " KB";

}

/* ==========================================================
   AUTO SAVE
========================================================== */

function autoSave() {

    saveStore();

}

/* ==========================================================
   TOAST MESSAGE
========================================================== */

function showMessage(message) {

    const oldToast = document.getElementById("toast");

    if (oldToast) {

        oldToast.remove();

    }

    const toast = document.createElement("div");

    toast.id = "toast";

    toast.textContent = message;

    toast.style.position = "fixed";
    toast.style.bottom = "25px";
    toast.style.right = "25px";

    toast.style.padding = "12px 22px";

    toast.style.background = "rgba(0,0,0,.8)";

    toast.style.color = "#fff";

    toast.style.borderRadius = "10px";

    toast.style.backdropFilter = "blur(10px)";

    toast.style.fontWeight = "600";

    toast.style.zIndex = "99999";

    toast.style.boxShadow = "0 8px 20px rgba(0,0,0,.35)";

    document.body.appendChild(toast);

    setTimeout(() => {

        toast.remove();

    }, 2500);

}

/* ==========================================================
   AUTO SAVE EVERY 30 SECONDS
========================================================== */

setInterval(autoSave, 30000);



/* ==========================================================
   KEYBOARD SHORTCUTS
========================================================== */

document.addEventListener("keydown", (e) => {

    if (e.ctrlKey && e.key === "s") {

        e.preventDefault();

        save();

        showMessage("Saved");

    }

    if (e.ctrlKey && e.key === "e") {

        e.preventDefault();

        exportData();

    }

    if (e.ctrlKey && e.key === "r") {

        e.preventDefault();

        resetApplication();

    }

});

/* ==========================================================
   APP INFO
========================================================== */

function appInfo() {

    console.log("Attendance Manager");

    console.log("Current Tab :", currentTab);

    console.log("Storage Used :", storageSize());

}
/* ==========================================================
   SEARCH SUBJECTS
========================================================== */

function searchSubjects(keyword) {

    keyword = keyword.toLowerCase().trim();

    const rows = document.querySelectorAll("#table-body tr");

    const subjects = getActiveData().subjects;

    rows.forEach((row, index) => {

        const code = subjects[index].code.toLowerCase();

        const name = subjects[index].name.toLowerCase();

        if (code.includes(keyword) || name.includes(keyword)) {

            row.style.display = "";

        }

        else {

            row.style.display = "none";

        }

    });

}

/* ==========================================================
   SORT SUBJECTS
========================================================== */

function sortSubjects() {

    getActiveData().subjects.sort((a, b) => {

        return a.code.localeCompare(b.code);

    });

    save();

}

/* ==========================================================
   OVERALL STATISTICS
========================================================== */

function updateOverallStatistics() {

    const stats = getOverallAttendance();

    console.log("========== Attendance ==========");

    console.log("Present :", stats.present);

    console.log("Absent :", stats.absent);

    console.log("Attendance :", stats.percentage + "%");

    console.log("===============================");

}

/* ==========================================================
   HIGHLIGHT LOW ATTENDANCE
========================================================== */

function highlightLowAttendance() {

    const rows = document.querySelectorAll("#table-body tr");

    getActiveData().subjects.forEach((subject, index) => {

        const stats = getAttendanceStats(subject);

        if (rows[index]) {

            if (stats.percentage < 75) {

                rows[index].style.background =
                    "rgba(255,80,80,.08)";

            }

            else {

                rows[index].style.background = "";

            }

        }

    });

}

/* ==========================================================
   ROW ANIMATION
========================================================== */

function animateRows() {

    const rows = document.querySelectorAll("#table-body tr");

    rows.forEach((row, index) => {

        row.style.opacity = "0";

        row.style.transform = "translateY(20px)";

        setTimeout(() => {

            row.style.transition = ".35s";

            row.style.opacity = "1";

            row.style.transform = "translateY(0)";

        }, index * 60);

    });

}

/* ==========================================================
   TABLE SUMMARY
========================================================== */

function printSummary() {

    const active = getActiveData();

    console.log("Subjects :", active.subjects.length);

    console.log("Weeks :", active.weeksVisible);

    console.log("Storage :", storageSize());

}

/* ==========================================================
   FIND SUBJECT
========================================================== */

function findSubject(code) {

    return getActiveData().subjects.find(subject => {

        return subject.code === code;

    });

}

/* ==========================================================
   REFRESH UI
========================================================== */

function refreshUI() {

    render();

    highlightLowAttendance();

    animateRows();

    updateOverallStatistics();

}

/* ==========================================================
   SAVE (OVERRIDE)
========================================================== */

function save() {

    saveStore();

    refreshUI();

}

/* ==========================================================
   EXTRA SHORTCUTS
========================================================== */

document.addEventListener("keydown", function (e) {

    if (e.ctrlKey && e.key === "f") {

        e.preventDefault();

        const keyword = prompt("Search Subject");

        if (keyword) {

            searchSubjects(keyword);

        }

    }

    if (e.ctrlKey && e.key === "a") {

        e.preventDefault();

        addNewSubject();

    }

    if (e.ctrlKey && e.key === "w") {

        e.preventDefault();

        addWeek();

    }

    if (e.ctrlKey && e.key === "l") {

        e.preventDefault();

        switchTab("labs");

    }

    if (e.ctrlKey && e.key === "c") {

        e.preventDefault();

        switchTab("classes");

    }

});

/* ==========================================================
   IDLE CALLBACK
========================================================== */

if ("requestIdleCallback" in window) {

    requestIdleCallback(() => {

        console.log("Attendance Manager Ready");

    });

}

/* ==========================================================
   STARTUP
========================================================== */

window.addEventListener("load", () => {

    animateRows();

    highlightLowAttendance();

    updateOverallStatistics();

    printSummary();

});
/* ==========================================================
   APPLICATION INFO
========================================================== */

const APP_INFO = {

    name: "Attendance Manager",

    version: "2.0",

    developer: "Rudra",

    storage: "LocalStorage"

};

/* ==========================================================
   SHOW APPLICATION INFO
========================================================== */

function showAppInfo() {

    console.log("================================");

    console.log(APP_INFO.name);

    console.log("Version :", APP_INFO.version);

    console.log("Developer :", APP_INFO.developer);

    console.log("Storage :", APP_INFO.storage);

    console.log("================================");

}

/* ==========================================================
   TOTAL SUBJECTS
========================================================== */

function totalSubjects() {

    return getActiveData().subjects.length;

}
/* ==========================================================
   TOTAL PRESENT
========================================================== */

function totalPresent(){

    let count = 0;

    getActiveData().subjects.forEach(subject=>{

        const stats = countLectureAttendance(subject);

        count += stats.present;

    });

    return count;

}
/* ==========================================================
   TOTAL ABSENT
========================================================== */

function totalAbsent(){

    let count = 0;

    getActiveData().subjects.forEach(subject=>{

        const stats = countLectureAttendance(subject);

        count += stats.absent;

    });

    return count;

}

/* ==========================================================
   DASHBOARD
========================================================== */

function showDashboard() {

    console.clear();

    console.log("========== DASHBOARD ==========");

    console.log("Subjects :", totalSubjects());

    console.log("Weeks :", getActiveData().weeksVisible);

    console.log("Present :", totalPresent());

    console.log("Absent :", totalAbsent());

    console.log("Overall Attendance :", getOverallAttendance().percentage + "%");

    console.log("Storage :", storageSize());

    console.log("===============================");

}

/* ==========================================================
   LOW ATTENDANCE SUBJECTS
========================================================== */

function lowAttendanceSubjects() {

    let list = [];

    getActiveData().subjects.forEach(subject => {

        const stats = getAttendanceStats(subject);

        if (stats.percentage < 75) {

            list.push({

                code: subject.code,

                name: subject.name,

                percentage: stats.percentage

            });

        }

    });

    return list;

}

/* ==========================================================
   BEST SUBJECT
========================================================== */

function bestSubject() {

    let best = null;

    let highest = -1;

    getActiveData().subjects.forEach(subject => {

        const stats = getAttendanceStats(subject);

        if (stats.percentage > highest) {

            highest = stats.percentage;

            best = subject;

        }

    });

    return best;

}

/* ==========================================================
   WORST SUBJECT
========================================================== */

function worstSubject() {

    let worst = null;

    let lowest = 101;

    getActiveData().subjects.forEach(subject => {

        const stats = getAttendanceStats(subject);

        if (stats.percentage < lowest) {

            lowest = stats.percentage;

            worst = subject;

        }

    });

    return worst;

}

/* ==========================================================
   EXPORT SUMMARY
========================================================== */

function exportSummary() {

    const summary = {

        generated: new Date().toLocaleString(),

        totalSubjects: totalSubjects(),

        totalPresent: totalPresent(),

        totalAbsent: totalAbsent(),

        overallAttendance: getOverallAttendance(),

        lowAttendance: lowAttendanceSubjects()

    };

    console.table(summary);

}

/* ==========================================================
   HEALTH CHECK
========================================================== */

function healthCheck() {

    if (!store) {

        console.error("Store Missing");

        return false;

    }

    if (!store.classes) {

        console.error("Classes Data Missing");

        return false;

    }

    if (!store.labs) {

        console.error("Labs Data Missing");

        return false;

    }

    return true;

}
/* ==========================================================
   START APPLICATION
========================================================== */

window.addEventListener("load", () => {

    if (healthCheck()) {

        showAppInfo();

        showDashboard();

    }

});

/* ==========================================================
   AUTO DASHBOARD REFRESH
========================================================== */

setInterval(() => {

    showDashboard();

}, 60000);

/* ==========================================================
   PROJECT LOADED
========================================================== */

console.log("Attendance Manager Loaded Successfully.");

/* ==========================================================
   TOGGLE LECTURE PANEL
========================================================== */

function toggleLecturePanel(button){

    const attendanceContainer = button.closest(".attendance-container");

    if(!attendanceContainer){
        return;
    }

    const panel = attendanceContainer.querySelector(".lecture-panel");

    if(!panel){
        return;
    }

    panel.classList.toggle("show");

    // Save panel state
    const td = attendanceContainer.closest("td");
    const row = td.parentElement;

    const subjectIndex = row.rowIndex - 3; // skip header rows

    const cellIndex = td.cellIndex - 3;

    const dates = generateDateList();

    if(
        subjectIndex >= 0 &&
        subjectIndex < getActiveData().subjects.length &&
        dates[cellIndex]
    ){

        const subject = getActiveData().subjects[subjectIndex];

        initializeAttendanceDay(subject, dates[cellIndex]);

        subject.attendance[dates[cellIndex]].open =
            panel.classList.contains("show");
    }

    button.textContent =
        panel.classList.contains("show")
        ? "▲"
        : "▼";
}
/* ==========================================================
   RENDER LECTURE BOXES
========================================================== */

function renderLectureBoxes(

    panel,

    subjectIndex,

    dateKey,

    attendance

){

    const lectures = ["l2","l3","l4"];

    lectures.forEach((lecture,index)=>{

        const row = document.createElement("div");

        row.className = "lecture-row";

        const label = document.createElement("span");

        label.className = "lecture-label";

        label.textContent = `L${index + 2}`;

        const box = document.createElement("div");

        box.className = "extra-box";

        updateAttendanceBox(

            box,

            attendance[lecture]

        );

        let clickTimer;

        box.onclick = ()=>{

            clearTimeout(clickTimer);

            clickTimer = setTimeout(()=>{

                handleAttendanceClick(

                    subjectIndex,

                    dateKey,

                    lecture,

                    false

                );

            },250);

        };

        box.ondblclick = ()=>{

            clearTimeout(clickTimer);

            handleAttendanceClick(

                subjectIndex,

                dateKey,

                lecture,

                true

            );

        };

        row.appendChild(label);

        row.appendChild(box);

        panel.appendChild(row);

    });

}
/* ==========================================================
   INITIALIZE ATTENDANCE DAY
========================================================== */

function initializeAttendanceDay(subject, dateKey){

    // Day does not exist
    if(!subject.attendance[dateKey]){

        subject.attendance[dateKey]={

            l1:0,

            l2:0,

            l3:0,

            l4:0,

            open:false

        };

    }

    // Backward compatibility
    else if(typeof subject.attendance[dateKey] === "number"){

        subject.attendance[dateKey]={

            l1:subject.attendance[dateKey],

            l2:0,

            l3:0,

            l4:0

        };

    }

    // Ensure all lecture keys exist
    ["l1","l2","l3","l4"].forEach(lecture=>{

        if(subject.attendance[dateKey][lecture] === undefined){

            subject.attendance[dateKey][lecture]=0;

        }

    });
    if(subject.attendance[dateKey].open === undefined){

        subject.attendance[dateKey].open = false;

    }

    return subject.attendance[dateKey];

}