/**
 * UPLB AMIS Course Extractor (runs in browser on https://amis.uplb.edu.ph)
 *
 * Auth (important): Captured HAR shows api-amis calls use header `x-session-id`, not Bearer.
 * Chrome may omit cookies from HAR exports, so this script sets `x-session-id` when we can
 * find it in storage, and still sends credentials for cookie-based sessions if present.
 *
 * INSTRUCTIONS:
 * 1. Log in at https://amis.uplb.edu.ph/
 * 2. DevTools → Console, paste this file, Enter
 * 3. If prompted, copy `x-session-id` from Network → any request to api-amis.uplb.edu.ph → Headers
 */

(async function extractUplbAmisClasses() {
  console.log('Starting UPLB AMIS course extraction...');

  try {
    const API_BASE = 'https://api-amis.uplb.edu.ph';

    let sessionId = null;
    try {
      for (const k of Object.keys(localStorage)) {
        if (!/session/i.test(k)) continue;
        const v = localStorage.getItem(k);
        if (v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.replace(/"/g, ''))) {
          sessionId = v.replace(/"/g, '');
          break;
        }
      }
    } catch (_) {}

    if (!sessionId) {
      sessionId = window.prompt(
        'Paste x-session-id from DevTools → Network → request to api-amis.uplb.edu.ph → Request headers'
      );
    }
    if (!sessionId || !sessionId.trim()) {
      throw new Error('No x-session-id: open Network tab while using AMIS, copy header from any API call.');
    }

    const authHeaders = {
      'x-session-id': sessionId.trim(),
    };

    const fetchOptions = {
      credentials: 'include',
      headers: {
        ...authHeaders,
        Accept: 'application/json, text/plain, */*',
      },
    };

    // 1. Active term (HAR used ?role=student)
    console.log('Fetching active term...');
    const termsReq = await fetch(
      `${API_BASE}/api/scheduled-features/student_enlistment?role=student`,
      fetchOptions
    );
    if (!termsReq.ok) throw new Error('Failed to fetch terms. Are you logged in?');
    
    const termsData = await termsReq.json();
    const activeTermId = termsData?.activeTerm?.term_id;
    
    if (!activeTermId) {
      console.error('Could not determine active term_id from scheduled-features response.');
      return;
    }
    console.log(`Active term: ${activeTermId} (${termsData.activeTerm.term} ${termsData.activeTerm.ay})`);

    let allData = [];
    let page = 1;
    let hasMore = true;
    const itemsPerPage = 500; // Large chunking

    console.log('Fetching class schedules (paginated)...');

    // 2. Paginate classes (by_term_type matches docs/amis HAR; omit course_code_like for full catalog)
    while (hasMore) {
      console.log(`Page ${page}...`);
      const q = new URLSearchParams({
        page: String(page),
        items: String(itemsPerPage),
        status: 'Active',
        by_term_type: 'true',
        term_id: String(activeTermId),
      });
      const url = `${API_BASE}/api/students/classes?${q}`;
      const classReq = await fetch(url, fetchOptions);
      
      if (!classReq.ok) {
        throw new Error(`Failed to fetch classes at page ${page} (Status: ${classReq.status})`);
      }
      
      const classRawData = await classReq.json();
      const classes = classRawData?.classes?.data || [];
      
      if (classes.length === 0) {
        hasMore = false;
        break;
      }
      
      allData = allData.concat(classes);
      
      // Safety or logic check
      if (classes.length < itemsPerPage) {
        hasMore = false; // Last page reached
      } else {
        page++;
      }
      
      // Be polite to their API
      await new Promise(r => setTimeout(r, 500)); 
    }
    
    console.log(`✅ Extracted ${allData.length} active classes!`);

    // 3. Save as JSON
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href",     dataStr);
    downloadAnchorNode.setAttribute("download", `uplb-amis-classes-${activeTermId}.json`);
    document.body.appendChild(downloadAnchorNode); // required for firefox
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
    
    console.log('Done. Download started.');

  } catch (err) {
    console.error('Extraction error:', err);
  }
})();
