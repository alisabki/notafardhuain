const FILE_PATH = 'data/notes.json';
let currentSha = null;
let notesData = [];

// Elemen DOM
const ownerInput = document.getElementById('gh-owner');
const repoInput = document.getElementById('gh-repo');
const tokenInput = document.getElementById('gh-token');
const authSection = document.getElementById('auth-section');
const editorSection = document.getElementById('editor-section');
const listSection = document.getElementById('list-section');

// Muat tetapan dari SessionStorage
window.addEventListener('DOMContentLoaded', () => {
  const savedToken = sessionStorage.getItem('gh_token');
  const savedOwner = sessionStorage.getItem('gh_owner');
  const savedRepo = sessionStorage.getItem('gh_repo');

  if (savedToken && savedOwner && savedRepo) {
    ownerInput.value = savedOwner;
    repoInput.value = savedRepo;
    tokenInput.value = savedToken;
    fetchRepoData();
  }
});

document.getElementById('btn-save-config').addEventListener('click', () => {
  sessionStorage.setItem('gh_owner', ownerInput.value.trim());
  sessionStorage.setItem('gh_repo', repoInput.value.trim());
  sessionStorage.setItem('gh_token', tokenInput.value.trim());
  fetchRepoData();
});

// 1. Ambil fail data/notes.json terkini beserta SHA hash
async function fetchRepoData() {
  const owner = sessionStorage.getItem('gh_owner');
  const repo = sessionStorage.getItem('gh_repo');
  const token = sessionStorage.getItem('gh_token');

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}`;

  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!res.ok) throw new Error('Gagal menghubungi GitHub. Sila semak token atau nama repo.');

    const file = await res.json();
    currentSha = file.sha; // Diperlukan oleh GitHub untuk overwrite fail

    // Decode base64 UTF-8
    const contentStr = decodeURIComponent(escape(atob(file.content)));
    notesData = JSON.parse(contentStr);

    // Paparkan UI
    authSection.classList.add('hidden');
    editorSection.classList.remove('hidden');
    listSection.classList.remove('hidden');

    renderAdminList();
  } catch (err) {
    alert(err.message);
  }
}

// 2. Papar senarai nota untuk diedit atau dipadam
function renderAdminList() {
  const container = document.getElementById('admin-notes-list');
  container.innerHTML = '';

  notesData.forEach(note => {
    const row = document.createElement('div');
    row.className = 'admin-item';
    row.innerHTML = `
      <div>
        <strong>${note.title}</strong>
        <span class="badge">${note.category}</span>
      </div>
      <div class="row-btns">
        <button class="btn-sm btn-edit" data-id="${note.id}">Edit</button>
        <button class="btn-sm btn-del" data-id="${note.id}">Padam</button>
      </div>
    `;
    container.appendChild(row);
  });

  // Pasang butang fungsi
  container.querySelectorAll('.btn-edit').forEach(btn => {
    btn.onclick = () => loadIntoForm(btn.dataset.id);
  });
  container.querySelectorAll('.btn-del').forEach(btn => {
    btn.onclick = () => deleteNote(btn.dataset.id);
  });
}

function loadIntoForm(id) {
  const note = notesData.find(n => n.id === id);
  if (!note) return;

  document.getElementById('edit-note-id').value = note.id;
  document.getElementById('note-title').value = note.title;
  document.getElementById('note-category').value = note.category;
  document.getElementById('note-pinned').checked = note.pinned || false;
  document.getElementById('note-content').value = note.content;

  document.getElementById('form-title').innerText = 'Sunting Nota';
  document.getElementById('btn-cancel').classList.remove('hidden');
  window.scrollTo({ top: editorSection.offsetTop - 20, behavior: 'smooth' });
}

document.getElementById('btn-cancel').addEventListener('click', resetForm);

function resetForm() {
  document.getElementById('edit-note-id').value = '';
  document.getElementById('note-title').value = '';
  document.getElementById('note-category').value = '';
  document.getElementById('note-pinned').checked = false;
  document.getElementById('note-content').value = '';
  document.getElementById('form-title').innerText = 'Tambah Nota Baharu';
  document.getElementById('btn-cancel').classList.add('hidden');
}

// 3. Simpan (Tambah/Edit) dan Push ke GitHub
document.getElementById('btn-save-note').addEventListener('click', async () => {
  const id = document.getElementById('edit-note-id').value;
  const title = document.getElementById('note-title').value.trim();
  const category = document.getElementById('note-category').value.trim() || 'Umum';
  const pinned = document.getElementById('note-pinned').checked;
  const content = document.getElementById('note-content').value;

  if (!title) return alert('Sila masukkan tajuk nota.');

  const today = new Date().toISOString().split('T')[0];

  if (id) {
    // Kemaskini sedia ada
    const index = notesData.findIndex(n => n.id === id);
    if (index !== -1) {
      notesData[index] = { ...notesData[index], title, category, pinned, content, date: today };
    }
  } else {
    // Nota baharu
    const newNote = {
      id: 'nota-' + Date.now(),
      title,
      category,
      pinned,
      content,
      date: today
    };
    notesData.unshift(newNote);
  }

  await commitToGitHub(id ? `Kemas kini nota: ${title}` : `Tambah nota: ${title}`);
  resetForm();
});

async function deleteNote(id) {
  if (!confirm('Pasti ingin padamkan nota ini?')) return;
  notesData = notesData.filter(n => n.id !== id);
  await commitToGitHub(`Padam nota id: ${id}`);
}

// 4. Buat Commit ke GitHub Repository
async function commitToGitHub(commitMessage) {
  const owner = sessionStorage.getItem('gh_owner');
  const repo = sessionStorage.getItem('gh_repo');
  const token = sessionStorage.getItem('gh_token');
  const saveBtn = document.getElementById('btn-save-note');

  saveBtn.disabled = true;
  saveBtn.innerText = 'Menyimpan ke GitHub...';

  const updatedJsonStr = JSON.stringify(notesData, null, 2);
  // Encode base64 selamat untuk UTF-8
  const base64Content = btoa(unescape(encodeURIComponent(updatedJsonStr)));

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${FILE_PATH}`;

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: commitMessage,
        content: base64Content,
        sha: currentSha
      })
    });

    if (!res.ok) throw new Error('Gagal commit fail ke GitHub.');

    const resData = await res.json();
    currentSha = resData.content.sha; // Kemaskini SHA terkini

    alert('Berjaya disimpan ke GitHub!');
    renderAdminList();
  } catch (err) {
    alert('Ralat menyimpan: ' + err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerText = 'Simpan ke GitHub';
  }
}