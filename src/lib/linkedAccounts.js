const STORAGE_KEY = 'ok_linked_accounts_v1';

export function loadLinkedAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const arr = JSON.parse(raw || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter((a) => a && a.userId && a.refresh_token);
  } catch {
    return [];
  }
}

export function saveLinkedAccounts(list) {
  try {
    const arr = Array.isArray(list) ? list : [];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    return true;
  } catch {
    return false;
  }
}
