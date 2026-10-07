// 页面只展示后端返回的值，不在本地保存计数。
const valueEl = document.getElementById('value');
const errorEl = document.getElementById('error');
const buttons = [document.getElementById('inc'), document.getElementById('dec')];

async function request(method, path) {
  const res = await fetch(path, { method, headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`请求失败（HTTP ${res.status}）`);
  const data = await res.json();
  if (typeof data.value !== 'number') throw new Error('响应格式错误');
  return data.value;
}

async function run(method, path) {
  buttons.forEach((b) => (b.disabled = true));
  try {
    valueEl.textContent = await request(method, path);
    errorEl.textContent = '';
  } catch (err) {
    errorEl.textContent = `${err.message}，请稍后重试。`;
  } finally {
    buttons.forEach((b) => (b.disabled = false));
  }
}

document.getElementById('inc').addEventListener('click', () => run('POST', '/api/counter/increment'));
document.getElementById('dec').addEventListener('click', () => run('POST', '/api/counter/decrement'));

run('GET', '/api/counter');
