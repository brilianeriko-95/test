// Konfigurasi
const CONFIG = {
  GAS_WEBAPP_URL: 'https://script.google.com/macros/s/AKfycbyGmI3ZRvOCnW8118jy6op2OeaOPTGJOHNxx6thXsY2FnZrMPDRgvhIDPjEsSUmkzbG/exec',
  GITHUB_TOKEN: localStorage.getItem('github_token') || '',
  GITHUB_REPO: 'owner/repo-name'
};

class GitHubSheetsSync {
  constructor() {
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.loadStoredData();
  }

  setupEventListeners() {
    document.getElementById('sync-btn').addEventListener('click', () => this.syncIssues());
    document.getElementById('fetch-sheets-btn').addEventListener('click', () => this.fetchFromSheets());
    document.getElementById('save-token-btn').addEventListener('click', () => this.saveGitHubToken());
  }

  /**
   * Simpan GitHub Personal Access Token
   */
  saveGitHubToken() {
    const token = document.getElementById('github-token').value;
    localStorage.setItem('github_token', token);
    CONFIG.GITHUB_TOKEN = token;
    alert('Token berhasil disimpan!');
  }

  /**
   * Ambil issues dari GitHub API
   */
  async fetchGitHubIssues() {
    if (!CONFIG.GITHUB_TOKEN) {
      throw new Error('GitHub token belum diatur');
    }

    const response = await fetch(`https://api.github.com/repos/${CONFIG.GITHUB_REPO}/issues?state=all&per_page=100`, {
      headers: {
        'Authorization': `token ${CONFIG.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Kirim data ke Google Sheets via GAS
   */
  async sendToSheets(issues) {
    const response = await fetch(`${CONFIG.GAS_WEBAPP_URL}?action=batchUpdate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issues)
    });

    return await response.json();
  }

  /**
   * Ambil data dari Google Sheets via GAS
   */
  async fetchFromSheets() {
    try {
      this.showLoading(true);
      
      const response = await fetch(`${CONFIG.GAS_WEBAPP_URL}?action=getData&sheet=GitHub Issues`);
      const result = await response.json();
      
      if (result.success) {
        this.displaySheetData(result.data);
        this.showStatus(`Berhasil memuat ${result.total} issues dari Sheets`);
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      this.showStatus(`Error: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Sync lengkap: GitHub → Sheets
   */
  async syncIssues() {
    try {
      this.showLoading(true);
      this.showStatus('Mengambil data dari GitHub...');
      
      // 1. Ambil dari GitHub
      const issues = await this.fetchGitHubIssues();
      this.showStatus(`Ditemukan ${issues.length} issues, mengirim ke Sheets...`);
      
      // 2. Kirim ke Sheets via GAS
      const result = await this.sendToSheets(issues);
      
      if (result.success) {
        this.showStatus(`✅ ${result.message}`);
        this.displaySheetData(issues.map(this.formatIssue));
      } else {
        throw new Error(result.error);
      }
      
    } catch (error) {
      this.showStatus(`❌ Error: ${error.message}`, 'error');
    } finally {
      this.showLoading(false);
    }
  }

  /**
   * Format issue untuk display
   */
  formatIssue(issue) {
    return {
      ID: issue.id,
      Number: issue.number,
      Title: issue.title,
      State: issue.state,
      'Created At': issue.created_at,
      'Updated At': issue.updated_at,
      URL: issue.html_url,
      User: issue.user.login,
      Labels: issue.labels.map(l => l.name).join(', '),
      Body: issue.body ? issue.body.substring(0, 100) + '...' : ''
    };
  }

  /**
   * Tampilkan data di UI
   */
  displaySheetData(data) {
    const container = document.getElementById('data-container');
    
    if (!data || data.length === 0) {
      container.innerHTML = '<p>Tidak ada data</p>';
      return;
    }

    const headers = Object.keys(data[0]);
    
    let html = '<table class="data-table"><thead><tr>';
    headers.forEach(h => html += `<th>${h}</th>`);
    html += '</tr></thead><tbody>';
    
    data.forEach(row => {
      html += '<tr>';
      headers.forEach(h => {
        const cell = row[h] || '';
        html += `<td>${cell}</td>`;
      });
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    container.innerHTML = html;
  }

  showLoading(show) {
    document.getElementById('loading').style.display = show ? 'block' : 'none';
  }

  showStatus(message, type = 'info') {
    const statusEl = document.getElementById('status');
    statusEl.textContent = message;
    statusEl.className = `status ${type}`;
  }

  loadStoredData() {
    const token = localStorage.getItem('github_token');
    if (token) {
      document.getElementById('github-token').value = token;
    }
  }
}

// Inisialisasi
const app = new GitHubSheetsSync();
