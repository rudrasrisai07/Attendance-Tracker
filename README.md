# 📚 Attendance Manager

A modern Attendance Management Web Application built using **HTML, CSS, and JavaScript**. The application helps students manage subject attendance efficiently with an interactive interface, attendance statistics, and data persistence using Local Storage.

---

## ✨ Features

- 📅 Weekly Attendance Management
- 📖 Separate tabs for **Classes** and **Labs**
- ➕ Add or remove subjects dynamically
- ➕ Add or remove weeks as required
- ✅ Mark attendance for **multiple lectures (L1, L2, L3, L4)** per day
- ✔ Single Click → Mark Absent
- ✔ Double Click → Mark Present
- 📊 Live attendance percentage for every subject
- 📈 Circular attendance charts
- 💾 Automatic Local Storage saving
- 📤 Export attendance data as JSON
- 📥 Import attendance backup
- 🔄 Reset application data
- 🔍 Search subjects
- 📱 Responsive Glassmorphism UI
- ⌨ Keyboard shortcuts for quick operations

---

# 🛠 Tech Stack

- **HTML5** – Application structure
- **CSS3** – Glassmorphism UI and responsive design
- **JavaScript (ES6)** – Complete application logic
- **Local Storage API** – Data persistence
- **Canvas API** – Attendance charts

---

# 📂 Project Structure

```
Attendance-Manager/
│
├── index.html          # Main application
├── style.css           # Complete styling
├── script.js           # Application logic
├── assets/
│   └── background.jpeg
├── README.md
```

---

# 🚀 Getting Started

## Prerequisites

No installation is required.

All you need is a modern web browser such as:

- Google Chrome
- Microsoft Edge
- Mozilla Firefox

---

## Installation

Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/Attendance-Manager.git
```

Open the project folder

```bash
cd Attendance-Manager
```

Launch the application by opening

```
index.html
```

No additional setup or dependencies are required.

---

# 📖 How to Use

### 1. Select Start Date

Choose the starting date for the semester.

---

### 2. Add Subjects

Click **Add Subject** to create new subjects.

Enter

- Subject Code
- Subject Name

---

### 3. Manage Weeks

Use **Add Week** to increase the attendance duration.

Weeks can also be removed while in Edit Mode.

---

### 4. Mark Attendance

Each day supports **up to four lectures**.

### Main Lecture (L1)

- Single Click → Mark Absent
- Double Click → Mark Present

### Additional Lectures

Click the ▼ button to expand L2, L3 and L4.

Attendance can be marked independently for each lecture.

---

### 5. View Statistics

Every subject displays

- Total Present
- Total Absent
- Attendance Percentage
- Circular Progress Chart

---

### 6. Backup & Restore

Export all attendance records as a JSON file.

Import the backup file anytime to restore the data.

---

# ⌨ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl + S | Save |
| Ctrl + E | Export Backup |
| Ctrl + R | Reset Application |
| Ctrl + F | Search Subject |
| Ctrl + A | Add Subject |
| Ctrl + W | Add Week |
| Ctrl + C | Switch to Classes |
| Ctrl + L | Switch to Labs |

---

# 💾 Data Storage

The application stores all attendance data using the browser's **Local Storage**.

No server or database is required.

Your data remains available even after closing the browser unless Local Storage is cleared.

---

# 📊 Features in Detail

## Multiple Lecture Attendance

Each day supports:

- Lecture 1
- Lecture 2
- Lecture 3
- Lecture 4

Every lecture can be marked independently.

---

## Attendance Analytics

The application automatically calculates

- Present Lectures
- Absent Lectures
- Overall Attendance Percentage

A live circular chart is generated for each subject.

---

## Responsive Interface

The UI adapts to desktops, tablets, and mobile devices while maintaining a clean Glassmorphism design.

---

## Data Backup

Attendance records can be exported as JSON and imported later without losing data.

---

# 🎯 Future Improvements

- Cloud Synchronization
- User Authentication
- Attendance Reports in PDF
- Monthly Analytics Dashboard
- Subject-wise Attendance Goals
- Dark / Light Theme
- Calendar View
- Notifications for Low Attendance

---

# 👨‍💻 Author

**Sri Sai Nagendra Rudra**

B.Tech Computer Science and Engineering

---

This project is developed for educational and portfolio purposes.

---

⭐ If you found this project useful, consider giving it a star!