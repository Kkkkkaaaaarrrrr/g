// ==================== المتغيرات العامة ====================
let currentUser = null;
let allMembers = [];
let allExtraExpenses = [];

// ==================== تسجيل الدخول ====================
async function checkLogin() {
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  if (!username || !password) { showLoginMessage('املأ جميع الحقول', 'error'); return; }
  
  const result = await window.electronAPI.login({ username, password });
  if (result.success) {
    currentUser = result.user;
    document.getElementById('userNameDisplay').innerText = currentUser.fullname;
    document.getElementById('userRoleDisplay').innerText = currentUser.role === 'admin' ? 'مدير' : 'مستخدم';
    document.getElementById('gymNameDisplay').innerText = 'جيم غويزي';
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    
    // إظهار تبويب المستخدمين للمدير فقط
    if (currentUser.role === 'admin') {
      document.querySelectorAll('.admin-only').forEach(el => el.style.display = 'inline-block');
    }
    
    loadAllData();
  } else {
    showLoginMessage(result.message, 'error');
  }
}

async function doRegister() {
  const fullname = document.getElementById('regFullname').value;
  const username = document.getElementById('regUsername').value;
  const password = document.getElementById('regPassword').value;
  const confirm = document.getElementById('regConfirmPassword').value;
  
  if (!fullname || !username || !password) { showRegisterMessage('املأ جميع الحقول', 'error'); return; }
  if (password !== confirm) { showRegisterMessage('كلمتا المرور غير متطابقتين', 'error'); return; }
  
  const result = await window.electronAPI.register({ username, password, fullname });
  if (result.success) {
    showRegisterMessage('تم التسجيل بنجاح! يمكنك تسجيل الدخول', 'success');
    document.querySelector('.login-tab[data-tab="login"]').click();
  } else {
    showRegisterMessage(result.message, 'error');
  }
}

function showLoginMessage(msg, type) {
  const div = document.getElementById('loginMessage');
  div.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  div.className = `message ${type}`;
  setTimeout(() => div.style.display = 'none', 3000);
}

function showRegisterMessage(msg, type) {
  const div = document.getElementById('registerMessage');
  div.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  div.className = `message ${type}`;
  setTimeout(() => div.style.display = 'none', 3000);
}

// ==================== تحميل البيانات ====================
async function loadAllData() {
  allMembers = await window.electronAPI.getMembers();
  allExtraExpenses = await window.electronAPI.getExtraExpenses();
  await loadExpensesToUI();
  refreshStats();
  renderMembers();
  renderReminders();
  renderExtraExpenses();
  renderMonthlyReport();
  if (currentUser?.role === 'admin') renderUsers();
}

async function loadExpensesToUI() {
  const expenses = await window.electronAPI.getExpenses();
  document.getElementById('rentExpense').value = expenses.rent || 2000;
  document.getElementById('salariesExpense').value = expenses.salaries || 3000;
  document.getElementById('utilitiesExpense').value = expenses.utilities || 1000;
  document.getElementById('maintenanceExpense').value = expenses.maintenance || 500;
}

// ==================== الإحصائيات ====================
function refreshStats() {
  const today = new Date(); today.setHours(0,0,0,0);
  let active = 0, needReminder = 0, expired = 0;
  allMembers.forEach(m => {
    const end = new Date(m.endDate); end.setHours(0,0,0,0);
    const days = Math.ceil((end - today) / 86400000);
    if (days < 0) expired++;
    else if (days <= 3) needReminder++;
    else active++;
  });
  
  document.getElementById('totalCount').innerText = allMembers.length;
  document.getElementById('activeCount').innerText = active;
  document.getElementById('needReminderCount').innerText = needReminder;
  document.getElementById('expiredCount').innerText = expired;
  
  updateProfitDisplay();
}

async function updateProfitDisplay() {
  const expenses = await window.electronAPI.getExpenses();
  const extra = allExtraExpenses;
  const totalExpenses = (expenses.rent || 0) + (expenses.salaries || 0) + (expenses.utilities || 0) + 
                        (expenses.maintenance || 0) + extra.reduce((s, e) => s + e.amount, 0);
  const revenue = allMembers.filter(m => new Date(m.endDate) >= new Date()).reduce((s, m) => s + m.price, 0);
  const profit = revenue - totalExpenses;
  
  document.getElementById('totalRevenue').innerHTML = formatCurrency(revenue);
  document.getElementById('totalExpenses').innerHTML = formatCurrency(totalExpenses);
  document.getElementById('finalProfit').innerHTML = formatCurrency(profit);
  document.getElementById('netProfit').innerHTML = formatCurrency(profit);
}

// ==================== عرض الأعضاء ====================
function renderMembers() {
  const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
  const container = document.getElementById('membersList');
  const today = new Date(); today.setHours(0,0,0,0);
  
  let filtered = allMembers.filter(m => m.name.toLowerCase().includes(searchTerm) || m.phone.includes(searchTerm));
  if (filtered.length === 0) { container.innerHTML = '<p style="text-align:center;padding:20px;">لا يوجد أعضاء</p>'; return; }
  
  container.innerHTML = filtered.map(m => {
    const end = new Date(m.endDate); end.setHours(0,0,0,0);
    const days = Math.ceil((end - today) / 86400000);
    let cls = '', badge = '', text = '';
    if (days < 0) { cls = 'expired'; badge = 'expired'; text = 'منتهي ❌'; }
    else if (days <= 3) { cls = 'need-reminder'; badge = 'need-reminder'; text = `ينتهي بعد ${days} يوم`; }
    else { badge = 'active'; text = 'نشط ✅'; }
    
    return `
      <div class="member-item ${cls}">
        <div class="member-header"><div class="member-name"><i class="fas fa-user"></i> ${escapeHtml(m.name)}</div><div class="member-price">💰 ${m.price} ج.م</div></div>
        <div class="member-details"><span><i class="fab fa-whatsapp"></i> ${m.phone}</span><span><i class="fas fa-calendar-alt"></i> البداية: ${formatDate(m.startDate)}</span><span><i class="fas fa-calendar-times"></i> النهاية: ${formatDate(m.endDate)}</span></div>
        <div><span class="badge ${badge}">${text}</span></div>
        <div class="actions">
          <button class="btn-whatsapp" onclick="sendSingleReminder(${m.id}, '${escapeHtml(m.name)}', '${m.phone}')"><i class="fab fa-whatsapp"></i> إرسال</button>
          <button class="btn-renew" onclick="renewMember(${m.id}, ${m.daysDuration}, ${m.price})"><i class="fas fa-sync-alt"></i> تجديد</button>
          <button class="btn-delete" onclick="deleteMember(${m.id})"><i class="fas fa-trash"></i> حذف</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderReminders() {
  const today = new Date(); today.setHours(0,0,0,0);
  const needMembers = allMembers.filter(m => {
    const end = new Date(m.endDate); end.setHours(0,0,0,0);
    const days = Math.ceil((end - today) / 86400000);
    return (days === 3 && !m.reminder3DaysSent) || (days < 0 && !m.reminderExpiredSent);
  });
  
  const container = document.getElementById('remindersList');
  if (needMembers.length === 0) { container.innerHTML = '<p style="text-align:center;padding:20px;">✅ لا يوجد أعضاء يحتاجون تذكير</p>'; return; }
  
  container.innerHTML = needMembers.map(m => {
    const end = new Date(m.endDate); end.setHours(0,0,0,0);
    const days = Math.ceil((end - today) / 86400000);
    let type = '', text = '';
    if (days === 3 && !m.reminder3DaysSent) { type = 'before_3days'; text = '⏰ ينتهي بعد 3 أيام'; }
    else if (days < 0 && !m.reminderExpiredSent) { type = 'expired'; text = `📢 انتهى منذ ${Math.abs(days)} أيام`; }
    else { type = 'manual'; text = '📢 يحتاج تذكير'; }
    
    return `
      <div class="delinquent-item">
        <div><strong><i class="fas fa-user"></i> ${escapeHtml(m.name)}</strong></div>
        <div><i class="fab fa-whatsapp"></i> ${m.phone}</div>
        <div><i class="fas fa-calendar"></i> ينتهي: ${formatDate(m.endDate)}</div>
        <div class="actions"><button class="btn-whatsapp" onclick="sendReminderWithType(${m.id}, '${escapeHtml(m.name)}', '${m.phone}', '${type}', ${days === 3 ? 3 : 0})"><i class="fab fa-whatsapp"></i> إرسال تذكير</button><button class="btn-renew" onclick="renewMember(${m.id}, ${m.daysDuration}, ${m.price})"><i class="fas fa-sync-alt"></i> تجديد</button></div>
      </div>
    `;
  }).join('');
}

function renderExtraExpenses() {
  const container = document.getElementById('extraExpensesList');
  if (allExtraExpenses.length === 0) { container.innerHTML = '<p>لا توجد مصاريف إضافية</p>'; return; }
  container.innerHTML = `<div style="background:#f1f5f9; padding:10px; border-radius:12px;"><h4>المصاريف الإضافية:</h4>${allExtraExpenses.map(e => `<div style="padding:5px; border-bottom:1px solid #ddd;"><span>${escapeHtml(e.description)}</span><span style="float:left;">${e.amount} ج.م</span><button onclick="deleteExtraExpense(${e.id})" style="float:left; margin-left:10px; background:#ef4444; color:white; border:none; padding:2px 8px; border-radius:5px; cursor:pointer;">حذف</button></div>`).join('')}</div>`;
}

function renderMonthlyReport() {
  const today = new Date();
  const currentMonth = today.getMonth(), currentYear = today.getFullYear();
  let subscribed = 0, expired = 0, notRenewed = 0;
  allMembers.forEach(m => {
    const start = new Date(m.startDate), end = new Date(m.endDate);
    if (start.getMonth() === currentMonth && start.getFullYear() === currentYear) subscribed++;
    if (end.getMonth() === currentMonth && end.getFullYear() === currentYear) expired++;
    if (end < today && end.getMonth() === currentMonth && end.getFullYear() === currentYear) notRenewed++;
  });
  
  document.getElementById('monthlyReportContainer').innerHTML = `
    <div class="stats-grid">
      <div class="stat-card"><i class="fas fa-user-plus"></i><h3>جددوا هذا الشهر</h3><div class="value">${subscribed}</div></div>
      <div class="stat-card"><i class="fas fa-hourglass-end"></i><h3>انتهى هذا الشهر</h3><div class="value">${expired}</div></div>
      <div class="stat-card"><i class="fas fa-ban"></i><h3>لم يجددوا</h3><div class="value">${notRenewed}</div></div>
      <div class="stat-card"><i class="fas fa-check-circle"></i><h3>نشطاء حالياً</h3><div class="value">${allMembers.filter(m => new Date(m.endDate) >= today).length}</div></div>
    </div>
  `;
}

async function renderUsers() {
  const users = await window.electronAPI.getUsers();
  const container = document.getElementById('usersList');
  if (!users || users.length === 0) { container.innerHTML = '<p>لا يوجد مستخدمين</p>'; return; }
  container.innerHTML = users.filter(u => u.id !== currentUser.id).map(u => `
    <div class="user-item"><div><strong>${escapeHtml(u.fullname)}</strong><br><small>@${u.username} | ${u.role === 'admin' ? 'مدير' : 'مستخدم'}</small></div><button onclick="deleteUser(${u.id})" class="btn-danger" style="padding:5px 10px;"><i class="fas fa-trash"></i> حذف</button></div>
  `).join('');
}

// ==================== إدارة الأعضاء ====================
async function addMember(name, phone, price, days) {
  const startDate = new Date();
  const endDate = new Date(); endDate.setDate(endDate.getDate() + days);
  const result = await window.electronAPI.addMember({ name, phone, price: parseInt(price), daysDuration: parseInt(days), startDate: startDate.toISOString(), endDate: endDate.toISOString() });
  if (result.success) { await loadAllData(); return { success: true }; }
  return { success: false, error: result.error };
}

async function deleteMember(id) {
  if (confirm('حذف العضو؟')) { await window.electronAPI.deleteMember(id); await loadAllData(); showMessage('تم الحذف', 'success'); }
}

async function renewMember(id, days, price) {
  if (confirm('تجديد الاشتراك؟')) {
    const startDate = new Date();
    const endDate = new Date(); endDate.setDate(endDate.getDate() + days);
    await window.electronAPI.updateMember(id, { startDate: startDate.toISOString(), endDate: endDate.toISOString(), reminder3DaysSent: 0, reminderExpiredSent: 0 });
    await loadAllData();
    showMessage('تم التجديد', 'success');
  }
}

// ==================== إرسال الرسائل ====================
function formatPhoneForWhatsApp(phone) {
  let clean = phone.toString().replace(/[^0-9]/g, '');
  if (clean.startsWith('0')) clean = '20' + clean.substring(1);
  return clean;
}

function getReminderMessage(name, type, daysLeft = null) {
  const gymName = 'جيم غويزي';
  if (type === 'before_3days') return `🏋️ *${gymName}*\n\nمرحباً ${name}،\n\n⏰ تذكير: متبقي ${daysLeft} أيام على انتهاء اشتراكك.\n\nيرجى تجديد اشتراكك قبل انتهاء المدة.\n\nشكراً لانتمائك لنا 💪`;
  if (type === 'expired') return `🏋️ *${gymName}*\n\nمرحباً ${name}،\n\n⚠️ اشتراكك في النادي *انتهى*.\n\nيرجى التوجه للإدارة لتجديد الاشتراك.\n\nنحن في انتظارك 💪`;
  return `🏋️ *${gymName}*\n\nمرحباً ${name}،\n\n${type}\n\nمع خالص التحية، الإدارة 💪`;
}

function sendWhatsApp(phone, message) {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`, '_blank');
}

function sendSingleReminder(id, name, phone) {
  sendWhatsApp(phone, getReminderMessage(name, 'تذكير بانتهاء الاشتراك'));
  showMessage(`تم فتح واتساب لـ ${name}`, 'success');
}

async function sendReminderWithType(id, name, phone, type, daysLeft) {
  sendWhatsApp(phone, getReminderMessage(name, type, daysLeft));
  if (type === 'before_3days') await window.electronAPI.updateMember(id, { reminder3DaysSent: 1 });
  if (type === 'expired') await window.electronAPI.updateMember(id, { reminderExpiredSent: 1 });
  await loadAllData();
  showMessage(`تم فتح واتساب لـ ${name}`, 'success');
}

async function sendBulkReminders(type, customMessage = null) {
  let target = [];
  const today = new Date(); today.setHours(0,0,0,0);
  if (type === 'before_3days') target = allMembers.filter(m => { const days = Math.ceil((new Date(m.endDate) - today) / 86400000); return days === 3 && !m.reminder3DaysSent; });
  else if (type === 'expired') target = allMembers.filter(m => new Date(m.endDate) < today && !m.reminderExpiredSent);
  else target = allMembers;
  
  if (target.length === 0) { showMessage('لا يوجد أعضاء', 'info', 'broadcastMsg'); return; }
  
  const progress = document.getElementById('broadcastProgress');
  progress.style.display = 'block';
  
  for (let i = 0; i < target.length; i++) {
    const m = target[i];
    let message = '';
    if (customMessage) message = getReminderMessage(m.name, customMessage);
    else if (type === 'before_3days') message = getReminderMessage(m.name, 'before_3days', 3);
    else if (type === 'expired') message = getReminderMessage(m.name, 'expired');
    else message = getReminderMessage(m.name, 'تذكير بانتهاء الاشتراك');
    
    sendWhatsApp(m.phone, message);
    if (type === 'before_3days') await window.electronAPI.updateMember(m.id, { reminder3DaysSent: 1 });
    if (type === 'expired') await window.electronAPI.updateMember(m.id, { reminderExpiredSent: 1 });
    progress.innerHTML = `جاري الإرسال... ${i+1} / ${target.length}`;
    await new Promise(r => setTimeout(r, 1000));
  }
  progress.innerHTML = `✅ تم الإرسال بنجاح`;
  setTimeout(() => progress.style.display = 'none', 2000);
  await loadAllData();
  showMessage(`تم إرسال ${target.length} رسالة`, 'success', 'broadcastMsg');
}

// ==================== المصاريف ====================
async function saveExpenses() {
  await window.electronAPI.updateExpenses({
    rent: parseInt(document.getElementById('rentExpense').value) || 0,
    salaries: parseInt(document.getElementById('salariesExpense').value) || 0,
    utilities: parseInt(document.getElementById('utilitiesExpense').value) || 0,
    maintenance: parseInt(document.getElementById('maintenanceExpense').value) || 0
  });
  await loadAllData();
  showMessage('تم تحديث المصاريف', 'success', 'formMsg');
}

async function addExtraExpense() {
  const desc = document.getElementById('extraExpenseDesc').value.trim();
  const amount = parseInt(document.getElementById('extraExpenseAmount').value);
  if (!desc || !amount) { showMessage('أدخل الوصف والمبلغ', 'error', 'formMsg'); return; }
  await window.electronAPI.addExtraExpense({ description: desc, amount });
  document.getElementById('extraExpenseDesc').value = '';
  document.getElementById('extraExpenseAmount').value = '';
  await loadAllData();
  showMessage('تم إضافة المصروف', 'success', 'formMsg');
}

async function deleteExtraExpense(id) {
  if (confirm('حذف المصروف؟')) { await window.electronAPI.deleteExtraExpense(id); await loadAllData(); showMessage('تم الحذف', 'success'); }
}

// ==================== تصدير واستيراد ====================
async function exportToExcel() {
  const data = allMembers.map(m => ({ 'الاسم': m.name, 'رقم الهاتف': m.phone, 'السعر': m.price, 'تاريخ البداية': formatDate(m.startDate), 'تاريخ النهاية': formatDate(m.endDate) }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'الأعضاء');
  XLSX.writeFile(wb, `جيم_غويزي_${formatDate(new Date())}.xlsx`);
  showMessage('تم التصدير', 'success', 'backupMsg');
}

async function exportBackup() {
  const result = await window.electronAPI.exportData();
  if (result.success) showMessage('تم التصدير', 'success', 'backupMsg');
}

async function importBackup() {
  const result = await window.electronAPI.importData();
  if (result.success) { await loadAllData(); showMessage('تم الاستيراد', 'success', 'backupMsg'); }
  else showMessage('فشل الاستيراد', 'error', 'backupMsg');
}

async function resetData() {
  if (confirm('مسح جميع البيانات؟')) {
    for (const m of allMembers) await window.electronAPI.deleteMember(m.id);
    await loadAllData();
    showMessage('تم المسح', 'success', 'backupMsg');
  }
}

async function deleteUser(id) {
  if (confirm('حذف المستخدم؟')) { await window.electronAPI.deleteUser(id); await renderUsers(); }
}

// ==================== تغيير كلمة المرور ====================
function showChangePasswordModal() {
  document.getElementById('changePasswordModal').style.display = 'flex';
}

async function changePassword() {
  const oldPass = document.getElementById('oldPassword').value;
  const newPass = document.getElementById('newPassword').value;
  const confirmPass = document.getElementById('confirmNewPassword').value;
  if (!oldPass || !newPass) { showChangePassMessage('املأ جميع الحقول', 'error'); return; }
  if (newPass !== confirmPass) { showChangePassMessage('كلمتا المرور غير متطابقتين', 'error'); return; }
  
  const result = await window.electronAPI.changePassword({ userId: currentUser.id, oldPassword: oldPass, newPassword: newPass });
  if (result.success) {
    showChangePassMessage(result.message, 'success');
    setTimeout(() => { document.getElementById('changePasswordModal').style.display = 'none'; document.getElementById('oldPassword').value = ''; document.getElementById('newPassword').value = ''; document.getElementById('confirmNewPassword').value = ''; }, 1500);
  } else {
    showChangePassMessage(result.message, 'error');
  }
}

function showChangePassMessage(msg, type) {
  const div = document.getElementById('changePassMsg');
  div.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  div.className = `message ${type}`;
  setTimeout(() => div.style.display = 'none', 3000);
}

// ==================== دوال مساعدة ====================
function formatDate(date) { return new Date(date).toLocaleDateString('ar-EG'); }
function formatCurrency(amount) { return amount.toLocaleString() + ' ج.م'; }
function escapeHtml(str) { return str.replace(/[&<>]/g, m => m === '&' ? '&amp;' : (m === '<' ? '&lt;' : '&gt;')); }
function showMessage(msg, type, elementId = 'formMsg') {
  const div = document.getElementById(elementId);
  if (div) { div.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`; div.className = `message ${type}`; setTimeout(() => div.style.display = 'none', 3000); }
}

// ==================== التهيئة ====================
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(t + 'Tab').classList.add('active');
      if (t === 'members') renderMembers();
      if (t === 'reminders') renderReminders();
      if (t === 'expenses') { renderExtraExpenses(); updateProfitDisplay(); }
      if (t === 'monthly') renderMonthlyReport();
      if (t === 'users' && currentUser?.role === 'admin') renderUsers();
    });
  });
}

function init() {
  initTabs();
  
  document.getElementById('doLoginBtn').onclick = checkLogin;
  document.getElementById('doRegisterBtn').onclick = doRegister;
  document.getElementById('logoutBtn').onclick = () => { location.reload(); };
  document.getElementById('settingsBtn').onclick = showChangePasswordModal;
  document.getElementById('confirmChangePassword').onclick = changePassword;
  document.getElementById('closeModalBtn').onclick = () => { document.getElementById('changePasswordModal').style.display = 'none'; };
  
  document.querySelectorAll('.login-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.login-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab + 'Form').classList.add('active');
    };
  });
  
  const daysInput = document.getElementById('daysDuration');
  document.getElementById('decDays').onclick = () => { let v = parseInt(daysInput.value); if (v > 1) daysInput.value = v - 1; };
  document.getElementById('incDays').onclick = () => { let v = parseInt(daysInput.value); if (v < 365) daysInput.value = v + 1; };
  
  document.getElementById('memberForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    const phone = document.getElementById('phone').value.trim();
    const price = document.getElementById('price').value;
    const days = parseInt(daysInput.value);
    if (!name || !phone) { showMessage('املأ البيانات', 'error', 'formMsg'); return; }
    const clean = phone.replace(/[^0-9]/g, '');
    const result = await addMember(name, clean, price, days);
    if (result.success) { showMessage(`✅ تم تسجيل ${name}`, 'success', 'formMsg'); document.getElementById('memberForm').reset(); daysInput.value = 30; }
    else showMessage(result.error, 'error', 'formMsg');
  };
  
  document.getElementById('sendAllRemindersBtn').onclick = () => sendBulkReminders('all');
  document.getElementById('searchInput').oninput = () => renderMembers();
  document.getElementById('exportExcelBtn').onclick = exportToExcel;
  document.getElementById('exportBackupBtn').onclick = exportBackup;
  document.getElementById('importBackupBtn').onclick = importBackup;
  document.getElementById('resetDataBtn').onclick = resetData;
  document.getElementById('updateExpensesBtn').onclick = saveExpenses;
  document.getElementById('addExtraExpenseBtn').onclick = addExtraExpense;
  document.getElementById('broadcastBefore3Btn').onclick = () => sendBulkReminders('before_3days');
  document.getElementById('broadcastExpiredBtn').onclick = () => sendBulkReminders('expired');
  document.getElementById('broadcastAllBtn').onclick = () => sendBulkReminders('all');
  document.getElementById('sendCustomBroadcastBtn').onclick = () => {
    const msg = document.getElementById('customMessage').value.trim();
    if (!msg) { showMessage('اكتب رسالتك', 'error', 'broadcastMsg'); return; }
    sendBulkReminders('custom', msg);
  };
}

document.addEventListener('DOMContentLoaded', init);