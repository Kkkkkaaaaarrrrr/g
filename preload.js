const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // المصادقة
  login: (data) => ipcRenderer.invoke('login', data),
  register: (data) => ipcRenderer.invoke('register', data),
  changePassword: (data) => ipcRenderer.invoke('change-password', data),
  getUsers: () => ipcRenderer.invoke('get-users'),
  deleteUser: (id) => ipcRenderer.invoke('delete-user', id),
  
  // الأعضاء
  getMembers: () => ipcRenderer.invoke('get-members'),
  addMember: (member) => ipcRenderer.invoke('add-member', member),
  updateMember: (id, data) => ipcRenderer.invoke('update-member', { id, data }),
  deleteMember: (id) => ipcRenderer.invoke('delete-member', id),
  
  // المصاريف
  getExpenses: () => ipcRenderer.invoke('get-expenses'),
  updateExpenses: (expenses) => ipcRenderer.invoke('update-expenses', expenses),
  getExtraExpenses: () => ipcRenderer.invoke('get-extra-expenses'),
  addExtraExpense: (data) => ipcRenderer.invoke('add-extra-expense', data),
  deleteExtraExpense: (id) => ipcRenderer.invoke('delete-extra-expense', id),
  
  // الإعدادات
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
  
  // النسخ الاحتياطي
  exportData: () => ipcRenderer.invoke('export-data'),
  importData: () => ipcRenderer.invoke('import-data'),
  
  // أحداث القائمة
  onMenuBackup: (callback) => ipcRenderer.on('menu-backup', callback),
  onMenuRestore: (callback) => ipcRenderer.on('menu-restore', callback)
});