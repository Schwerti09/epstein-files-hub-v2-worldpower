(function(){
  const $ = (q, el=document) => el.querySelector(q);
  const storeKey = 'efh_token_v1';
  const consentKey = 'efh_cookie_consent_v1';

  // Cookie banner
  const banner = $('#cookie');
  const accept = $('#cookie-accept');
  const decline = $('#cookie-decline');
  const consent = localStorage.getItem(consentKey);
  if (!consent && banner) banner.style.display = 'block';
  function setConsent(val){ localStorage.setItem(consentKey, val); if (banner) banner.style.display = 'none'; }
  if (accept) accept.addEventListener('click', () => setConsent('accepted'));
  if (decline) decline.addEventListener('click', () => setConsent('declined'));

  // Auth token
  function getToken(){ return localStorage.getItem(storeKey) || ''; }
  function setToken(t){ localStorage.setItem(storeKey, t); updateAuthUI(); }
  function clearToken(){ localStorage.removeItem(storeKey); updateAuthUI(); }

  function authHeaders(){
    const t = getToken();
    return t ? { 'Authorization': 'Bearer ' + t } : {};
  }

  function domainFromUrl(u){
    try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; }
  }
  function faviconUrl(u){
    const d = domainFromUrl(u);
    return d ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64` : '';
  }
  function escapeHtml(str){
    return String(str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
  }
  function highlightHtml(text, term){
    if(!term) return escapeHtml(text);
    const safe = escapeHtml(text);
    const re = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    return safe.replace(re, m => `<mark>${m}</mark>`);
  }

  function updateAuthUI(){
    const pill = $('#auth-pill');
    const btn = $('#auth-logout');
    const t = getToken();
    if (!pill) return;
    if (t){
      pill.textContent = 'Premium: aktiv (Token)';
      pill.style.borderColor = 'rgba(103,232,249,.35)';
      if (btn) btn.style.display = 'inline-flex';
    } else {
      pill.textContent = 'Premium: aus';
      pill.style.borderColor = 'rgba(255,255,255,.08)';
      if (btn) btn.style.display = 'none';
    }
  }
  const logoutBtn = $('#auth-logout');
  if (logoutBtn) logoutBtn.addEventListener('click', () => clearToken());
  updateAuthUI();

  // Archive page
  async function loadArchive(){
    const tableBody = $('#docs-body');
    if (!tableBody) return;

    const q = ($('#q')?.value || '').trim();
    const tag = ($('#tag')?.value || '').trim();

    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (tag) params.set('tag', tag);

    tableBody.innerHTML = '<tr><td colspan="4"><small>Lade…</small></td></tr>';

    try{
      const res = await fetch('/api/documents?' + params.toString(), { headers: { ...authHeaders() } });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Fehler');

      const rows = data.data || [];
      if (!rows.length){
        tableBody.innerHTML = '<tr><td colspan="4"><small>Keine Treffer.</small></td></tr>';
        return;
      }

      tableBody.innerHTML = rows.map(r => {
        const date = r.doc_date ? new Date(r.doc_date).toISOString().slice(0,10) : '';
        const tags = (r.tags || []).slice(0,3).map(t => `<span class="tag" style="background:rgba(103,232,249,.95)">${escapeHtml(t)}</span>`).join(' ');
        const premium = r.premium_enabled && r.summary_premium
          ? `<div class="small"><b>Premium:</b> ${highlightHtml(r.summary_premium, q)}</div>`
          : '';
        const lockTease = (!r.premium_enabled && r.premium_match && q)
          ? `<div class="small" style="margin-top:6px"><b>Premium Match:</b> Inhalte zu <mark>${escapeHtml(q)}</mark> vorhanden → <a href="/subscribe/">freischalten</a></div>`
          : '';

        const docHref = `/doc/?slug=${encodeURIComponent(r.slug)}${q ? ('&q=' + encodeURIComponent(q)) : ''}`;

        return `
          <tr>
            <td>
              <a href="${docHref}">
                <b><img class="fav" src="${faviconUrl(r.source_url)}" alt="" loading="lazy" onerror="this.style.display='none'"/>${highlightHtml(r.title, q)}</b>
              </a>
              <br/><small>${escapeHtml(r.source_label || '')}</small>
            </td>
            <td><small>${escapeHtml(date)}</small></td>
            <td>${tags}</td>
            <td>
              <div class="small">${highlightHtml(r.summary_public || '', q)}</div>
              ${premium}
              ${lockTease}
              <div class="small" style="margin-top:6px"><a href="${escapeHtml(r.source_url)}" target="_blank" rel="noreferrer">Quelle öffnen →</a></div>
            </td>
          </tr>
        `;
      }).join('');
    }catch(e){
      tableBody.innerHTML = `<tr><td colspan="4"><small>${escapeHtml(e.message || 'Fehler')}</small></td></tr>`;
    }
  }

  const searchForm = $('#search-form');
  if (searchForm) searchForm.addEventListener('submit', (e)=>{ e.preventDefault(); loadArchive(); });
  if ($('#docs-body')) loadArchive();

  // Doc page
  async function loadDoc(){
    const out = $('#doc-out');
    if (!out) return;
    const url = new URL(location.href);
    const slug = url.searchParams.get('slug');
    const q = url.searchParams.get('q') || '';
    if (!slug){
      out.innerHTML = '<div class="notice"><b>Fehlt:</b> slug</div>';
      return;
    }
    out.innerHTML = '<div class="notice">Lade…</div>';
    try{
      const res = await fetch('/api/document?slug=' + encodeURIComponent(slug) + (q ? ('&q=' + encodeURIComponent(q)) : ''), { headers: { ...authHeaders() } });
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Fehler');

      const d = data.data;
      const date = d.doc_date ? new Date(d.doc_date).toISOString().slice(0,10) : '';
      const tags = (d.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join(' ');

      const premium = d.summary_premium
        ? `<div class="card p" style="margin-top:12px"><div class="tag">Premium</div><h3 style="margin:10px 0 6px">Kuratierte Highlights</h3><p class="small">${highlightHtml(d.summary_premium, q)}</p></div>`
        : (d.premium_match && q
            ? `<div class="notice" style="margin-top:12px"><b>Premium Match:</b> Es gibt kuratierte Inhalte zu <mark>${escapeHtml(q)}</mark>. <a href="/subscribe/">4,99€/Monat</a>.</div>`
            : `<div class="notice" style="margin-top:12px"><b>Premium:</b> Aktivierbar via <a href="/subscribe/">4,99€/Monat</a>.</div>`);

      out.innerHTML = `
        <div class="card hcard">
          <div class="tag">Dokument</div>
          <h1 class="h1" style="margin-top:10px">${highlightHtml(d.title, q)}</h1>
          <div class="small">Datum: <b>${escapeHtml(date)}</b> • Quelle: <a href="${escapeHtml(d.source_url)}" target="_blank" rel="noreferrer">${escapeHtml(d.source_label || 'Quelle')}</a></div>
          <div class="meta" style="margin-top:10px">${tags}</div>
          <hr class="sep"/>
          <h2 style="margin:0 0 8px; font-size:18px">Öffentliche Zusammenfassung</h2>
          <p class="sub">${highlightHtml(d.summary_public || '', q)}</p>
          <div class="actions">
            <a class="btn primary" href="${escapeHtml(d.source_url)}" target="_blank" rel="noreferrer">Primärquelle öffnen →</a>
            <a class="btn" href="/archive/">Zurück ins Archiv</a>
          </div>
        </div>
        ${premium}
      `;
    }catch(e){
      out.innerHTML = `<div class="notice"><b>Fehler:</b> ${escapeHtml(e.message || 'Unbekannt')}</div>`;
    }
  }
  if ($('#doc-out')) loadDoc();

  // Subscribe page
  async function startCheckout(){
    const email = ($('#email')?.value || '').trim();
    const out = $('#sub-out');
    if (!email){ out && (out.textContent='Bitte E-Mail eingeben'); return; }
    out && (out.textContent='Öffne Checkout…');
    try{
      const res = await fetch('/api/create-checkout', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Fehler');
      location.href = data.url;
    }catch(e){
      out && (out.textContent = e.message || 'Fehler');
    }
  }
  const subBtn = $('#start-checkout');
  if (subBtn) subBtn.addEventListener('click', (e)=>{ e.preventDefault(); startCheckout(); });

  // Success page verification
  async function verifySession(){
    const out = $('#success-out');
    if (!out) return;
    const url = new URL(location.href);
    const sessionId = url.searchParams.get('session_id');
    if (!sessionId){
      out.textContent = 'Fehlt: session_id';
      return;
    }
    out.textContent = 'Verifiziere…';
    try{
      const res = await fetch('/api/verify-session', {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ session_id: sessionId })
      });
      const data = await res.json();
      if(!res.ok || !data.ok) throw new Error(data.error || 'Fehler');
      setToken(data.token);
      out.innerHTML = '✅ Premium aktiviert. <a href="/archive/">Zum Archiv →</a>';
    }catch(e){
      out.textContent = e.message || 'Fehler';
    }
  }
  if ($('#success-out')) verifySession();

})();
