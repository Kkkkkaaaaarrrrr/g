// ==================== جيم غويزي - تطبيق ديسكتوب ====================
const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

let mainWindow;
let db;

// ==================== إنشاء قاعدة البيانات ====================
function initDatabase() {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'gym_data.db');
  
  db = new sqlite3.Database(dbPath);
  
  // إنشاء جدول المستخدمين
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    fullname TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // إنشاء جدول الأعضاء
  db.run(`CREATE TABLE IF NOT EXISTS members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    price INTEGER NOT NULL,
    daysDuration INTEGER NOT NULL,
    startDate TEXT NOT NULL,
    endDate TEXT NOT NULL,
    reminder3DaysSent INTEGER DEFAULT 0,
    reminderExpiredSent INTEGER DEFAULT 0,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // إنشاء جدول المصاريف
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rent INTEGER DEFAULT 2000,
    salaries INTEGER DEFAULT 3000,
    utilities INTEGER DEFAULT 1000,
    maintenance INTEGER DEFAULT 500
  )`);
  
  // إنشاء جدول المصاريف الإضافية
  db.run(`CREATE TABLE IF NOT EXISTS extra_expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    description TEXT NOT NULL,
    amount INTEGER NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // إنشاء جدول الإعدادات
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  )`);
  
  // إضافة مستخدم مدير افتراضي إذا لم يوجد
  db.get("SELECT * FROM users WHERE username = 'admin'", (err, row) => {
    if (!row) {
      const hashedPassword = bcrypt.hashSync('admin123', 10);
      db.run("INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)", 
        ['admin', hashedPassword, 'مدير النظام', 'admin']);
    }
  });
  
  // إضافة مصاريف افتراضية إذا لم توجد
  db.get("SELECT * FROM expenses LIMIT 1", (err, row) => {
    if (!row) {
      db.run("INSERT INTO expenses (rent, salaries, utilities, maintenance) VALUES (2000, 3000, 1000, 500)");
    }
  });
  
  console.log('✅ قاعدة البيانات جاهزة:', dbPath);
}

// ==================== إنشاء النافذة الرئيسية ====================
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    title: 'جيم غويزي - نظام إدارة النادي الرياضي',
    backgroundColor: '#0f172a'
  });

  mainWindow.loadFile('index.html');
  
  // قائمة التطبيق
  const menuTemplate = [
    {
      label: 'الملف',
      submenu: [
        { label: 'نسخ احتياطي', click: () => { mainWindow.webContents.send('menu-backup'); } },
        { label: 'استعادة نسخة', click: () => { mainWindow.webContents.send('menu-restore'); } },
        { type: 'separator' },
        { label: 'خروج', role: 'quit' }
      ]
    },
    {
      label: 'عرض',
      submenu: [
        { label: 'تكبير', role: 'zoomIn' },
        { label: 'تصغير', role: 'zoomOut' },
        { label: 'إعادة تعيين التكبير', role: 'resetZoom' },
        { type: 'separator' },
        { label: 'ملء الشاشة', role: 'togglefullscreen' }
      ]
    },
    {
      label: 'مساعدة',
      submenu: [
        { label: 'عن التطبيق', click: () => { dialog.showMessageBox(mainWindow, { message: 'جيم غويزي - نظام إدارة النادي الرياضي\nالإصدار 3.0\nجميع الحقوق محفوظة', title: 'عن التطبيق' }); } }
      ]
    }
  ];
  
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
  
  mainWindow.on('closed', () => { mainWindow = null; });
}

// ==================== API للإتصال مع الواجهة ====================

// تسجيل الدخول
ipcMain.handle('login', async (event, { username, password }) => {
  return new Promise((resolve) => {
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
      if (err || !user) {
        resolve({ success: false, message: 'اسم المستخدم غير موجود' });
      } else {
        const isValid = bcrypt.compareSync(password, user.password);
        if (isValid) {
          resolve({ success: true, user: { id: user.id, username: user.username, fullname: user.fullname, role: user.role } });
        } else {
          resolve({ success: false, message: 'كلمة المرور غير صحيحة' });
        }
      }
    });
  });
});

// تسجيل مستخدم جديد
ipcMain.handle('register', async (event, { username, password, fullname }) => {
  return new Promise((resolve) => {
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run("INSERT INTO users (username, password, fullname, role) VALUES (?, ?, ?, ?)", 
      [username, hashedPassword, fullname, 'user'], function(err) {
      if (err) {
        resolve({ success: false, message: 'اسم المستخدم موجود مسبقاً' });
      } else {
        resolve({ success: true, message: 'تم التسجيل بنجاح' });
      }
    });
  });
});

// جلب جميع الأعضاء
ipcMain.handle('get-members', async () => {
  return new Promise((resolve) => {
    db.all("SELECT * FROM members ORDER BY createdAt DESC", (err, rows) => {
      resolve(rows || []);
    });
  });
});

// إضافة عضو
ipcMain.handle('add-member', async (event, member) => {
  return new Promise((resolve) => {
    db.run("INSERT INTO members (name, phone, price, daysDuration, startDate, endDate) VALUES (?, ?, ?, ?, ?, ?)",
      [member.name, member.phone, member.price, member.daysDuration, member.startDate, member.endDate], function(err) {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, id: this.lastID });
      }
    });
  });
});

// تحديث عضو
ipcMain.handle('update-member', async (event, { id, data }) => {
  return new Promise((resolve) => {
    const fields = [];
    const values = [];
    for (const [key, value] of Object.entries(data)) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
    values.push(id);
    db.run(`UPDATE members SET ${fields.join(', ')} WHERE id = ?`, values, function(err) {
      resolve({ success: !err, error: err?.message });
    });
  });
});

// حذف عضو
ipcMain.handle('delete-member', async (event, id) => {
  return new Promise((resolve) => {
    db.run("DELETE FROM members WHERE id = ?", [id], function(err) {
      resolve({ success: !err });
    });
  });
});

// جلب المصاريف
ipcMain.handle('get-expenses', async () => {
  return new Promise((resolve) => {
    db.get("SELECT * FROM expenses LIMIT 1", (err, row) => {
      resolve(row || { rent: 2000, salaries: 3000, utilities: 1000, maintenance: 500 });
    });
  });
});

// تحديث المصاريف
ipcMain.handle('update-expenses', async (event, expenses) => {
  return new Promise((resolve) => {
    db.run("UPDATE expenses SET rent = ?, salaries = ?, utilities = ?, maintenance = ?", 
      [expenses.rent, expenses.salaries, expenses.utilities, expenses.maintenance], function(err) {
      resolve({ success: !err });
    });
  });
});

// جلب المصاريف الإضافية
ipcMain.handle('get-extra-expenses', async () => {
  return new Promise((resolve) => {
    db.all("SELECT * FROM extra_expenses ORDER BY date DESC", (err, rows) => {
      resolve(rows || []);
    });
  });
});

// إضافة مصروف إضافي
ipcMain.handle('add-extra-expense', async (event, { description, amount }) => {
  return new Promise((resolve) => {
    db.run("INSERT INTO extra_expenses (description, amount) VALUES (?, ?)", [description, amount], function(err) {
      resolve({ success: !err, id: this?.lastID });
    });
  });
});

// حذف مصروف إضافي
ipcMain.handle('delete-extra-expense', async (event, id) => {
  return new Promise((resolve) => {
    db.run("DELETE FROM extra_expenses WHERE id = ?", [id], function(err) {
      resolve({ success: !err });
    });
  });
});

// جلب الإعدادات
ipcMain.handle('get-settings', async () => {
  return new Promise((resolve) => {
    db.all("SELECT * FROM settings", (err, rows) => {
      const settings = {};
      rows?.forEach(row => { settings[row.key] = row.value; });
      resolve(settings);
    });
  });
});

// حفظ الإعدادات
ipcMain.handle('save-settings', async (event, settings) => {
  return new Promise((resolve) => {
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, value);
    }
    stmt.finalize();
    resolve({ success: true });
  });
});

// تصدير البيانات
ipcMain.handle('export-data', async () => {
  return new Promise((resolve) => {
    const data = {};
    db.all("SELECT * FROM members", (err, members) => {
      data.members = members;
      db.get("SELECT * FROM expenses LIMIT 1", (err, expenses) => {
        data.expenses = expenses;
        db.all("SELECT * FROM extra_expenses", (err, extra) => {
          data.extraExpenses = extra;
          const filePath = dialog.showSaveDialogSync(mainWindow, {
            title: 'حفظ نسخة احتياطية',
            defaultPath: `gym_backup_${new Date().toISOString().slice(0,19).replace(/:/g, '-')}.json`,
            filters: [{ name: 'JSON Files', extensions: ['json'] }]
          });
          if (filePath) {
            fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
            resolve({ success: true, path: filePath });
          } else {
            resolve({ success: false });
          }
        });
      });
    });
  });
});

// استيراد البيانات
ipcMain.handle('import-data', async () => {
  return new Promise((resolve) => {
    const filePath = dialog.showOpenDialogSync(mainWindow, {
      title: 'اختر ملف النسخة الاحتياطية',
      filters: [{ name: 'JSON Files', extensions: ['json'] }]
    });
    if (filePath && filePath[0]) {
      try {
        const data = JSON.parse(fs.readFileSync(filePath[0], 'utf8'));
        
        // حذف البيانات القديمة
        db.run("DELETE FROM members");
        db.run("DELETE FROM extra_expenses");
        
        // إضافة الأعضاء
        if (data.members) {
          const stmt = db.prepare("INSERT INTO members (name, phone, price, daysDuration, startDate, endDate, reminder3DaysSent, reminderExpiredSent, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)");
          data.members.forEach(m => {
            stmt.run(m.name, m.phone, m.price, m.daysDuration, m.startDate, m.endDate, m.reminder3DaysSent || 0, m.reminderExpiredSent || 0, m.createdAt || new Date().toISOString());
          });
          stmt.finalize();
        }
        
        // إضافة المصاريف الإضافية
        if (data.extraExpenses) {
          const stmt = db.prepare("INSERT INTO extra_expenses (description, amount, date) VALUES (?, ?, ?)");
          data.extraExpenses.forEach(e => {
            stmt.run(e.description, e.amount, e.date || new Date().toISOString());
          });
          stmt.finalize();
        }
        
        resolve({ success: true });
      } catch(e) {
        resolve({ success: false, error: e.message });
      }
    } else {
      resolve({ success: false });
    }
  });
});

// تغيير كلمة المرور
ipcMain.handle('change-password', async (event, { userId, oldPassword, newPassword }) => {
  return new Promise((resolve) => {
    db.get("SELECT * FROM users WHERE id = ?", [userId], (err, user) => {
      if (err || !user) {
        resolve({ success: false, message: 'المستخدم غير موجود' });
      } else {
        const isValid = bcrypt.compareSync(oldPassword, user.password);
        if (isValid) {
          const hashedPassword = bcrypt.hashSync(newPassword, 10);
          db.run("UPDATE users SET password = ? WHERE id = ?", [hashedPassword, userId], function(err) {
            resolve({ success: !err, message: err ? 'حدث خطأ' : 'تم تغيير كلمة المرور بنجاح' });
          });
        } else {
          resolve({ success: false, message: 'كلمة المرور الحالية غير صحيحة' });
        }
      }
    });
  });
});

// جلب المستخدمين (للمدير فقط)
ipcMain.handle('get-users', async () => {
  return new Promise((resolve) => {
    db.all("SELECT id, username, fullname, role, createdAt FROM users", (err, rows) => {
      resolve(rows || []);
    });
  });
});

// حذف مستخدم
ipcMain.handle('delete-user', async (event, id) => {
  return new Promise((resolve) => {
    db.run("DELETE FROM users WHERE id = ? AND role != 'admin'", [id], function(err) {
      resolve({ success: !err });
    });
  });
});

// ==================== تشغيل التطبيق ====================
app.whenReady().then(() => {
  initDatabase();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});