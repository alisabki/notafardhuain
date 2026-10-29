let allNotes = [];

async function loadNotes() {
  try {
    const res = await fetch('./data/notes.json');
    if (!res.ok) throw new Error('Gagal memuat turun nota.');
    allNotes = await res.json();
    renderCategories(allNotes);
    renderNotes(allNotes);
  } catch (err) {
    document.getElementById('notes-grid').innerHTML = `<p class="error">Ralat: ${err.message}</p>`;
  }
}

function renderNotes(notes) {
  const grid = document.getElementById('notes-grid');
  if (notes.length === 0) {
    grid.innerHTML = '<p class="empty">Tiada nota dijumpai.</p>';
    return;
  }

  grid.innerHTML = notes.map(note => `
    <article class="note-card ${note.pinned ? 'pinned' : ''}">
      <div class="card-meta">
        <span class="badge">${note.category || 'Umum'}</span>
        <span class="date">${note.date || ''}</span>
      </div>
      <h3>${note.title}</h3>
      <p class="card-content">${escapeHtml(note.content)}</p>
    </article>
  `).join('');
}

function renderCategories(notes) {
  const categories = ['Semua', ...new Set(notes.map(n => n.category || 'Umum'))];
  const container = document.getElementById('category-filters');
  
  container.innerHTML = categories.map((cat, idx) => `
    <button class="filter-btn ${idx === 0 ? 'active' : ''}" data-cat="${cat}">${cat}</button>
  `).join('');

  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = (e) => {
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      const cat = e.target.dataset.cat;
      if (cat === 'Semua') {
        renderNotes(allNotes);
      } else {
        renderNotes(allNotes.filter(n => (n.category || 'Umum') === cat));
      }
    };
  });
}

// Carian langsung
document.getElementById('search-box').addEventListener('input', (e) => {
  const term = e.target.value.toLowerCase();
  const filtered = allNotes.filter(n => 
    n.title.toLowerCase().includes(term) || n.content.toLowerCase().includes(term)
  );
  renderNotes(filtered);
});

function escapeHtml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

document.addEventListener('DOMContentLoaded', loadNotes);