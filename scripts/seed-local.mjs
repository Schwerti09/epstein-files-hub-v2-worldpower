const url = 'http://localhost:8888/api/seed';
const token = process.env.ADMIN_SEED_TOKEN || '';
if (!token) {
  console.error('ADMIN_SEED_TOKEN missing in env');
  process.exit(1);
}
const res = await fetch(url, {
  method: 'POST',
  headers: {'Content-Type':'application/json','Authorization':`Bearer ${token}`},
  body: JSON.stringify({ mode: 'demo' })
});
const data = await res.json();
console.log(res.status, data);
