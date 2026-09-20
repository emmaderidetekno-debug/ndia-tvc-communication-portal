/* ========================================
   NDIA TVC COMMUNICATION PORTAL
   VERSION 3 — FULL STACK FRONTEND
======================================== */

const API = '/api';
let token = localStorage.getItem('ndiaToken') || '';
let currentUser = JSON.parse(localStorage.getItem('ndiaCurrentUser') || 'null');
let announcements = [];
let students = [];
let staff = [];
let messages = [];
let accounts = [];
let reportSummary = null;

const $ = id => document.getElementById(id);
const loginScreen = $('loginScreen');
const app = $('app');
const loginForm = $('loginForm');
const loginError = $('loginError');
const navItems = document.querySelectorAll('.nav-item');
const pageSections = document.querySelectorAll('.page-section');
const pageTitle = $('pageTitle');
const currentDate = $('currentDate');

const pageNames = {
  dashboard: 'Dashboard',
  announcements: 'Announcements',
  students: 'Students',
  staff: 'Staff',
  messages: 'Messages',
  reports: 'Reports',
  accounts: 'Accounts & Roles'
};

function escapeHTML(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function initials(name = 'User') {
  return name.split(' ').filter(Boolean).map(word => word[0]).join('').substring(0, 2).toUpperCase();
}

function canManageContent() {
  return currentUser && ['Administrator', 'Communication Officer'].includes(currentUser.role);
}

function isAdministrator() {
  return currentUser && currentUser.role === 'Administrator';
}

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';

  const response = await fetch(`${API}${path}`, { ...options, headers });
  let payload = {};
  try { payload = await response.json(); } catch {}

  if (response.status === 401 && path !== '/auth/login') {
    logout(false);
    throw new Error(payload.error || 'Your session expired. Please sign in again.');
  }
  if (!response.ok) throw new Error(payload.error || 'Request failed.');
  return payload;
}

function showToast(message, icon = '✓') {
  $('toastIcon').textContent = icon;
  $('toastMessage').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => $('toast').classList.remove('show'), 3200);
}

function openModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.add('show');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const modal = $(id);
  if (!modal) return;
  modal.classList.remove('show');
  document.body.style.overflow = '';
}

document.querySelectorAll('.modal-overlay').forEach(modal => {
  modal.addEventListener('click', event => {
    if (event.target === modal) closeModal(modal.id);
  });
});

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') document.querySelectorAll('.modal-overlay.show').forEach(modal => closeModal(modal.id));
});

function displayDate() {
  currentDate.textContent = new Date().toLocaleDateString('en-KE', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
  });
}

displayDate();

function setSystemStatus(online, text) {
  const status = $('systemStatus');
  if (!status) return;
  status.classList.toggle('backend-offline', !online);
  status.innerHTML = `<span class="status-dot"></span>${escapeHTML(text)}`;
}

async function checkHealth() {
  try {
    const response = await fetch(`${API}/health`);
    const data = await response.json();
    setSystemStatus(true, data.emailMode === 'smtp' ? 'Online · Live email' : 'Online · Preview email');
  } catch {
    setSystemStatus(false, 'Backend offline');
  }
}

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.textContent = '';
  const username = $('loginUsername').value.trim();
  const password = $('loginPassword').value;

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('ndiaToken', token);
    localStorage.setItem('ndiaCurrentUser', JSON.stringify(currentUser));
    loginForm.reset();
    await showApplication();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

async function showApplication() {
  loginScreen.classList.add('hidden');
  app.classList.remove('hidden');
  updateUserInterface();
  applyRolePermissions();
  await loadAll();
  showSection('dashboard');
}

function logout(showMessage = true) {
  token = '';
  currentUser = null;
  localStorage.removeItem('ndiaToken');
  localStorage.removeItem('ndiaCurrentUser');
  app.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  loginForm.reset();
  if (showMessage) showToast('Signed out successfully.');
}

$('logoutBtn').addEventListener('click', () => logout(true));

function updateUserInterface() {
  if (!currentUser) return;
  const name = currentUser.name;
  $('sidebarUserName').textContent = name;
  $('sidebarUserRole').textContent = currentUser.role;
  $('dashboardUserName').textContent = name;
  $('sidebarAvatar').textContent = initials(name);
  $('topAvatar').textContent = initials(name);
}

function applyRolePermissions() {
  const manage = canManageContent();
  const admin = isAdministrator();

  ['newAnnouncementBtn', 'dashboardAnnouncementBtn', 'quickAnnouncement', 'addStudentBtn', 'addStaffBtn', 'newMessageBtn']
    .forEach(id => { if ($(id)) $(id).style.display = manage ? '' : 'none'; });

  if ($('addAccountBtn')) $('addAccountBtn').style.display = admin ? '' : 'none';
  const accountNav = document.querySelector('.nav-item[data-section="accounts"]');
  if (accountNav) accountNav.style.display = admin ? '' : 'none';
}

function showSection(sectionName) {
  if (sectionName === 'accounts' && !isAdministrator()) sectionName = 'dashboard';
  pageSections.forEach(section => section.classList.remove('active-section'));
  const target = $(sectionName);
  if (target) target.classList.add('active-section');

  navItems.forEach(item => {
    item.classList.toggle('active', item.dataset.section === sectionName);
  });
  pageTitle.textContent = pageNames[sectionName] || 'Dashboard';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

navItems.forEach(item => item.addEventListener('click', () => showSection(item.dataset.section)));
document.querySelectorAll('[data-section-link]').forEach(item => item.addEventListener('click', () => showSection(item.dataset.sectionLink)));

async function loadAll() {
  try {
    const requests = [
      api('/announcements'),
      api('/users/students'),
      api('/users/staff'),
      api('/messages'),
      api('/reports/summary')
    ];
    if (isAdministrator()) requests.push(api('/users/accounts'));

    const results = await Promise.all(requests);
    [announcements, students, staff, messages, reportSummary] = results;
    accounts = isAdministrator() ? results[5] : [];
    renderAll();
    await checkHealth();
  } catch (error) {
    showToast(error.message, '!');
    await checkHealth();
  }
}

/* ANNOUNCEMENTS */
$('newAnnouncementBtn').addEventListener('click', () => openModal('announcementModal'));
$('dashboardAnnouncementBtn').addEventListener('click', () => openModal('announcementModal'));
$('quickAnnouncement').addEventListener('click', () => openModal('announcementModal'));
$('closeAnnouncementModal').addEventListener('click', () => closeModal('announcementModal'));
$('cancelAnnouncement').addEventListener('click', () => closeModal('announcementModal'));

$('announcementForm').addEventListener('submit', async event => {
  event.preventDefault();
  if (!canManageContent()) return showToast('Your account cannot publish announcements.', '!');

  const formData = new FormData();
  formData.append('title', $('announcementTitle').value.trim());
  formData.append('category', $('announcementCategory').value);
  formData.append('audience', $('announcementAudience').value);
  formData.append('message', $('announcementMessage').value.trim());
  if ($('announcementAttachment').files[0]) formData.append('attachment', $('announcementAttachment').files[0]);

  try {
    const result = await api('/announcements', { method: 'POST', body: formData });
    $('announcementForm').reset();
    closeModal('announcementModal');
    await loadAll();
    showSection('announcements');
    showToast(`Published · ${result.successful}/${result.recipients} deliveries successful.`);
  } catch (error) {
    showToast(error.message, '!');
  }
});

function renderAnnouncements() {
  const search = $('announcementSearch').value.toLowerCase().trim();
  const category = $('announcementFilter').value;
  const filtered = announcements.filter(item => {
    const matchesSearch = item.title.toLowerCase().includes(search) || item.message.toLowerCase().includes(search);
    const matchesCategory = category === 'all' || item.category === category;
    return matchesSearch && matchesCategory;
  });

  const empty = `<div class="empty-state"><div>📭</div><h3>No announcements found</h3><p>Published announcements will appear here.</p></div>`;
  $('dashboardAnnouncements').innerHTML = filtered.length ? filtered.slice(0, 3).map(createAnnouncementHTML).join('') : empty;
  $('fullAnnouncementList').innerHTML = filtered.length ? filtered.map(createAnnouncementHTML).join('') : empty;
}

function createAnnouncementHTML(item) {
  const date = new Date(item.created_at).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' });
  const audience = { all: 'Students & Staff', students: 'Students', staff: 'Staff' };
  const deliveryText = Number(item.delivery_count || 0)
    ? `<div class="delivery-summary"><strong>${item.delivered_count || 0}</strong> of ${item.delivery_count} deliveries successful</div>` : '';
  const attachment = item.attachment_name
    ? `<div class="announcement-meta">📎 <button class="text-btn" type="button" onclick="downloadAttachment(${item.id})">${escapeHTML(item.attachment_name)}</button></div>` : '';
  const actions = canManageContent() ? `<div class="announcement-actions"><button class="delete-btn" onclick="deleteAnnouncement(${item.id})">Delete</button></div>` : '';

  return `<article class="announcement-card">
    <div class="announcement-top"><div><div class="announcement-title">${escapeHTML(item.title)}</div>
    <div class="announcement-meta">${date} · ${escapeHTML(audience[item.audience] || item.audience)}${item.author_name ? ` · ${escapeHTML(item.author_name)}` : ''}</div></div>
    <span class="category-badge">${escapeHTML(item.category)}</span></div>
    <div class="announcement-message">${escapeHTML(item.message)}</div>${attachment}${deliveryText}${actions}</article>`;
}

async function downloadAttachment(id) {
  const item = announcements.find(entry => entry.id === id);
  try {
    const response = await fetch(`${API}/announcements/${id}/attachment`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
      let data = {};
      try { data = await response.json(); } catch {}
      throw new Error(data.error || 'Unable to download attachment.');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = item?.attachment_name || 'attachment';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    showToast(error.message, '!');
  }
}
window.downloadAttachment = downloadAttachment;

async function deleteAnnouncement(id) {
  if (!confirm('Delete this announcement?')) return;
  try {
    await api(`/announcements/${id}`, { method: 'DELETE' });
    await loadAll();
    showToast('Announcement deleted.');
  } catch (error) { showToast(error.message, '!'); }
}
window.deleteAnnouncement = deleteAnnouncement;
$('announcementSearch').addEventListener('input', renderAnnouncements);
$('announcementFilter').addEventListener('change', renderAnnouncements);

/* STUDENTS */
$('addStudentBtn').addEventListener('click', openAddStudent);
$('closeStudentModal').addEventListener('click', () => closeModal('studentModal'));
$('cancelStudent').addEventListener('click', () => closeModal('studentModal'));

function openAddStudent() {
  $('studentForm').reset();
  $('studentId').value = '';
  $('studentModalTitle').textContent = 'Add Student';
  openModal('studentModal');
}

$('studentForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = $('studentId').value;
  const data = {
    name: $('studentName').value.trim(), admission: $('studentAdmission').value.trim(),
    department: $('studentDepartment').value, email: $('studentEmail').value.trim(), status: $('studentStatus').value
  };
  try {
    await api(id ? `/users/students/${id}` : '/users/students', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    closeModal('studentModal');
    await loadAll();
    showToast(id ? 'Student updated.' : 'Student added.');
  } catch (error) { showToast(error.message, '!'); }
});

function renderStudents() {
  const search = $('studentSearch').value.toLowerCase().trim();
  const department = $('studentDepartmentFilter').value;
  const filtered = students.filter(student => `${student.name}${student.admission}${student.email}`.toLowerCase().includes(search) && (department === 'all' || student.department === department));
  $('studentTableBody').innerHTML = filtered.length ? filtered.map(student => `<tr>
    <td>${escapeHTML(student.name)}</td><td>${escapeHTML(student.admission)}</td><td>${escapeHTML(student.department)}</td><td>${escapeHTML(student.email)}</td>
    <td><span class="badge ${student.status === 'Active' ? 'success' : 'inactive'}">${escapeHTML(student.status)}</span></td>
    <td>${canManageContent() ? `<button class="edit-btn" onclick="editStudent(${student.id})">Edit</button> <button class="delete-btn" onclick="deleteStudent(${student.id})">Delete</button>` : '—'}</td></tr>`).join('')
    : `<tr><td colspan="6"><div class="empty-state">No students found.</div></td></tr>`;
}

function editStudent(id) {
  const student = students.find(item => item.id === id); if (!student) return;
  $('studentId').value = student.id; $('studentName').value = student.name; $('studentAdmission').value = student.admission;
  $('studentDepartment').value = student.department; $('studentEmail').value = student.email; $('studentStatus').value = student.status;
  $('studentModalTitle').textContent = 'Edit Student'; openModal('studentModal');
}
async function deleteStudent(id) {
  if (!confirm('Delete this student record?')) return;
  try { await api(`/users/students/${id}`, { method: 'DELETE' }); await loadAll(); showToast('Student deleted.'); }
  catch (error) { showToast(error.message, '!'); }
}
window.editStudent = editStudent; window.deleteStudent = deleteStudent;
$('studentSearch').addEventListener('input', renderStudents);
$('studentDepartmentFilter').addEventListener('change', renderStudents);

/* STAFF */
$('addStaffBtn').addEventListener('click', openAddStaff);
$('closeStaffModal').addEventListener('click', () => closeModal('staffModal'));
$('cancelStaff').addEventListener('click', () => closeModal('staffModal'));
function openAddStaff() { $('staffForm').reset(); $('staffId').value = ''; $('staffModalTitle').textContent = 'Add Staff'; openModal('staffModal'); }

$('staffForm').addEventListener('submit', async event => {
  event.preventDefault();
  const id = $('staffId').value;
  const data = { name: $('staffName').value.trim(), position: $('staffPosition').value.trim(), department: $('staffDepartment').value, email: $('staffEmail').value.trim(), status: $('staffStatus').value };
  try {
    await api(id ? `/users/staff/${id}` : '/users/staff', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) });
    closeModal('staffModal'); await loadAll(); showToast(id ? 'Staff record updated.' : 'Staff member added.');
  } catch (error) { showToast(error.message, '!'); }
});

function renderStaff() {
  const search = $('staffSearch').value.toLowerCase().trim();
  const department = $('staffDepartmentFilter').value;
  const filtered = staff.filter(member => `${member.name}${member.position}${member.email}`.toLowerCase().includes(search) && (department === 'all' || member.department === department));
  $('staffTableBody').innerHTML = filtered.length ? filtered.map(member => `<tr>
    <td>${escapeHTML(member.name)}</td><td>${escapeHTML(member.position)}</td><td>${escapeHTML(member.department)}</td><td>${escapeHTML(member.email)}</td>
    <td><span class="badge ${member.status === 'Active' ? 'success' : 'inactive'}">${escapeHTML(member.status)}</span></td>
    <td>${canManageContent() ? `<button class="edit-btn" onclick="editStaff(${member.id})">Edit</button> <button class="delete-btn" onclick="deleteStaff(${member.id})">Delete</button>` : '—'}</td></tr>`).join('')
    : `<tr><td colspan="6"><div class="empty-state">No staff found.</div></td></tr>`;
}
function editStaff(id) {
  const member = staff.find(item => item.id === id); if (!member) return;
  $('staffId').value = member.id; $('staffName').value = member.name; $('staffPosition').value = member.position;
  $('staffDepartment').value = member.department; $('staffEmail').value = member.email; $('staffStatus').value = member.status;
  $('staffModalTitle').textContent = 'Edit Staff'; openModal('staffModal');
}
async function deleteStaff(id) {
  if (!confirm('Delete this staff record?')) return;
  try { await api(`/users/staff/${id}`, { method: 'DELETE' }); await loadAll(); showToast('Staff record deleted.'); }
  catch (error) { showToast(error.message, '!'); }
}
window.editStaff = editStaff; window.deleteStaff = deleteStaff;
$('staffSearch').addEventListener('input', renderStaff);
$('staffDepartmentFilter').addEventListener('change', renderStaff);

/* MESSAGES */
$('newMessageBtn').addEventListener('click', () => openModal('messageModal'));
$('closeMessageModal').addEventListener('click', () => closeModal('messageModal'));
$('cancelMessage').addEventListener('click', () => closeModal('messageModal'));
$('messageForm').addEventListener('submit', async event => {
  event.preventDefault();
  const data = { recipient: $('messageRecipient').value, subject: $('messageSubject').value.trim(), body: $('messageBody').value.trim() };
  try {
    const result = await api('/messages', { method: 'POST', body: JSON.stringify(data) });
    $('messageForm').reset(); closeModal('messageModal'); await loadAll();
    showToast(`Message recorded · ${result.recipients} recipient(s).`);
  } catch (error) { showToast(error.message, '!'); }
});

function renderMessages() {
  $('messageList').innerHTML = messages.length ? messages.map(message => `<div class="message-item" onclick="showMessage(${message.id})">
    <strong>${escapeHTML(message.subject)}</strong><span>To: ${escapeHTML(message.recipient)}</span><span>${new Date(message.created_at).toLocaleString('en-KE')}</span></div>`).join('')
    : `<div class="empty-state"><div>✉</div><h3>No messages</h3><p>Messages will appear here.</p></div>`;
}
function showMessage(id) {
  const message = messages.find(item => item.id === id); if (!message) return;
  $('messageInfo').innerHTML = `<div class="panel-header"><div><h3>${escapeHTML(message.subject)}</h3><p>${new Date(message.created_at).toLocaleString('en-KE')}</p></div></div>
  <div style="padding:25px"><p style="font-size:11px;color:#718096;margin-bottom:18px">To: ${escapeHTML(message.recipient)}</p>
  <p style="font-size:13px;line-height:1.8;white-space:pre-wrap">${escapeHTML(message.body)}</p></div>`;
}
window.showMessage = showMessage;

/* ACCOUNTS */
$('addAccountBtn').addEventListener('click', () => openModal('accountModal'));
$('closeAccountModal').addEventListener('click', () => closeModal('accountModal'));
$('cancelAccount').addEventListener('click', () => closeModal('accountModal'));
$('accountForm').addEventListener('submit', async event => {
  event.preventDefault();
  const data = { name: $('accountName').value.trim(), username: $('accountUsername').value.trim(), password: $('accountPassword').value, role: $('accountRole').value };
  try {
    await api('/users/accounts', { method: 'POST', body: JSON.stringify(data) });
    $('accountForm').reset(); closeModal('accountModal'); await loadAll(); showToast('Account created.');
  } catch (error) { showToast(error.message, '!'); }
});
function renderAccounts() {
  if (!isAdministrator()) return;
  $('accountTableBody').innerHTML = accounts.map(account => `<tr><td>${escapeHTML(account.name)}</td><td>${escapeHTML(account.username)}</td><td>${escapeHTML(account.role)}</td>
  <td><span class="badge ${account.status === 'Active' ? 'success' : 'inactive'}">${escapeHTML(account.status)}</span></td><td>
  <button class="edit-btn" onclick="toggleAccount(${account.id})">${account.status === 'Active' ? 'Disable' : 'Activate'}</button>
  ${account.username !== 'admin' ? `<button class="delete-btn" onclick="deleteAccount(${account.id})">Delete</button>` : ''}</td></tr>`).join('');
}
async function toggleAccount(id) { try { await api(`/users/accounts/${id}/status`, { method: 'PATCH' }); await loadAll(); showToast('Account status updated.'); } catch (error) { showToast(error.message, '!'); } }
async function deleteAccount(id) { if (!confirm('Delete this account?')) return; try { await api(`/users/accounts/${id}`, { method: 'DELETE' }); await loadAll(); showToast('Account deleted.'); } catch (error) { showToast(error.message, '!'); } }
window.toggleAccount = toggleAccount; window.deleteAccount = deleteAccount;

/* REPORTS + DASHBOARD */
function updateStatistics() {
  const summary = reportSummary || {};
  $('announcementCount').textContent = summary.announcements ?? announcements.length;
  $('studentCount').textContent = summary.students ?? students.length;
  $('staffCount').textContent = summary.staff ?? staff.length;
  $('messageCount').textContent = summary.messages ?? messages.length;
  $('studentTotal').textContent = summary.students ?? students.length;
  $('activeStudentCount').textContent = summary.activeStudents ?? students.filter(x => x.status === 'Active').length;
  $('staffTotal').textContent = summary.staff ?? staff.length;
  $('activeStaffCount').textContent = summary.activeStaff ?? staff.filter(x => x.status === 'Active').length;
  $('reportAnnouncementCount').textContent = summary.announcements ?? announcements.length;
  $('reportStudentCount').textContent = summary.students ?? students.length;
  $('reportStaffCount').textContent = summary.staff ?? staff.length;
  $('reportMessageCount').textContent = summary.messages ?? messages.length;

  const reach = summary.deliveryRate ?? 0;
  $('studentReach').textContent = `${reach}%`;
  $('announcementBarValue').textContent = summary.announcements ?? announcements.length;
  $('announcementBar').style.width = `${Math.min((summary.announcements ?? announcements.length) * 10, 100)}%`;
  if ($('studentReachBar')) $('studentReachBar').style.width = `${reach}%`;
  if ($('staffReachBar')) $('staffReachBar').style.width = `${reach}%`;
  if ($('reportStudentReach')) $('reportStudentReach').textContent = `${reach}%`;
  if ($('reportStaffReach')) $('reportStaffReach').textContent = `${reach}%`;
  $('notificationBadge').textContent = (summary.failedDeliveries || 0) || announcements.length;
}

$('generateReportBtn').addEventListener('click', () => {
  const s = reportSummary || {};
  const rows = [
    ['Metric', 'Value'], ['Announcements', s.announcements ?? 0], ['Students', s.students ?? 0], ['Active Students', s.activeStudents ?? 0],
    ['Staff', s.staff ?? 0], ['Active Staff', s.activeStaff ?? 0], ['Messages', s.messages ?? 0], ['Deliveries', s.deliveries ?? 0],
    ['Successful Deliveries', s.successfulDeliveries ?? 0], ['Failed Deliveries', s.failedDeliveries ?? 0], ['Delivery Rate', `${s.deliveryRate ?? 0}%`]
  ];
  const csv = rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `ndia-communication-report-${new Date().toISOString().slice(0,10)}.csv`; link.click();
  URL.revokeObjectURL(url); showToast('Communication report downloaded.');
});

function renderAll() { renderAnnouncements(); renderStudents(); renderStaff(); renderMessages(); renderAccounts(); updateStatistics(); }

(async function start() {
  await checkHealth();
  if (!token || !currentUser) { loginScreen.classList.remove('hidden'); app.classList.add('hidden'); return; }
  try {
    const data = await api('/auth/me'); currentUser = data.user; localStorage.setItem('ndiaCurrentUser', JSON.stringify(currentUser)); await showApplication();
  } catch { logout(false); }
})();

console.log('Ndia TVC Communication Portal V3 full-stack frontend loaded.');
