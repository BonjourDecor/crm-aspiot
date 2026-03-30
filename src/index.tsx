import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = { DB: D1Database }
type Variables = { userId: number; userName: string }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
app.use('/api/*', cors())

// ============ AUTH MIDDLEWARE ============
app.use('/api/crm/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)
  try {
    const [id, email] = atob(token).split(':')
    const user = await c.env.DB.prepare('SELECT id, name FROM users WHERE id = ? AND email = ?').bind(id, email).first()
    if (!user) return c.json({ error: 'Invalid token' }, 401)
    c.set('userId', user.id as number)
    c.set('userName', user.name as string)
    await next()
  } catch { return c.json({ error: 'Invalid token' }, 401) }
})

// ============ AUTH API ============
app.post('/api/auth/register', async (c) => {
  const { email, password, name, company, phone } = await c.req.json()
  if (!email || !password || !name) return c.json({ error: 'Заполните все обязательные поля' }, 400)
  try {
    const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first()
    if (existing) return c.json({ error: 'Пользователь с таким email уже существует' }, 400)
    const result = await c.env.DB.prepare(
      'INSERT INTO users (email, password_hash, name, company, phone) VALUES (?, ?, ?, ?, ?)'
    ).bind(email, password, name, company || '', phone || '').run()
    const userId = result.meta.last_row_id
    const token = btoa(`${userId}:${email}`)
    return c.json({ token, user: { id: userId, email, name, company, phone } })
  } catch (e: any) { return c.json({ error: e.message }, 500) }
})

app.post('/api/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  const user = await c.env.DB.prepare(
    'SELECT id, email, name, company, phone FROM users WHERE email = ? AND password_hash = ?'
  ).bind(email, password).first()
  if (!user) return c.json({ error: 'Неверный email или пароль' }, 401)
  const token = btoa(`${user.id}:${user.email}`)
  return c.json({ token, user })
})

// ============ DASHBOARD ============
app.get('/api/crm/dashboard', async (c) => {
  const uid = c.get('userId')
  const clients = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM clients WHERE user_id=?').bind(uid).first()
  const projects = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM projects WHERE user_id=?').bind(uid).first()
  const active = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM projects WHERE user_id=? AND status NOT IN ('completed','cancelled')").bind(uid).first()
  const revenue = await c.env.DB.prepare("SELECT COALESCE(SUM(total_amount),0) as total FROM projects WHERE user_id=? AND status='completed'").bind(uid).first()
  const contracts = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM contracts WHERE user_id=?').bind(uid).first()
  const recentProjects = await c.env.DB.prepare(
    'SELECT p.*, c.name as client_name FROM projects p JOIN clients c ON p.client_id=c.id WHERE p.user_id=? ORDER BY p.updated_at DESC LIMIT 5'
  ).bind(uid).all()
  return c.json({
    clients: clients?.cnt || 0, projects: projects?.cnt || 0,
    activeProjects: active?.cnt || 0, revenue: revenue?.total || 0,
    contracts: contracts?.cnt || 0, recentProjects: recentProjects.results
  })
})

// ============ CLIENTS CRUD ============
app.get('/api/crm/clients', async (c) => {
  const uid = c.get('userId')
  const q = c.req.query('q') || ''
  let sql = 'SELECT * FROM clients WHERE user_id = ?'
  const params: any[] = [uid]
  if (q) { sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)'; params.push(`%${q}%`, `%${q}%`, `%${q}%`) }
  sql += ' ORDER BY created_at DESC'
  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(result.results)
})

app.post('/api/crm/clients', async (c) => {
  const uid = c.get('userId')
  const { name, phone, email, address, notes } = await c.req.json()
  if (!name) return c.json({ error: 'Имя обязательно' }, 400)
  const r = await c.env.DB.prepare(
    'INSERT INTO clients (user_id,name,phone,email,address,notes) VALUES (?,?,?,?,?,?)'
  ).bind(uid, name, phone||'', email||'', address||'', notes||'').run()
  return c.json({ id: r.meta.last_row_id, name, phone, email, address, notes })
})

app.put('/api/crm/clients/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  const { name, phone, email, address, notes } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE clients SET name=?,phone=?,email=?,address=?,notes=? WHERE id=? AND user_id=?'
  ).bind(name, phone||'', email||'', address||'', notes||'', id, uid).run()
  return c.json({ success: true })
})

app.delete('/api/crm/clients/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM clients WHERE id=? AND user_id=?').bind(id, uid).run()
  return c.json({ success: true })
})

// ============ SUPPLIERS CRUD ============
app.get('/api/crm/suppliers', async (c) => {
  const uid = c.get('userId')
  const result = await c.env.DB.prepare('SELECT * FROM suppliers WHERE user_id=? ORDER BY name').bind(uid).all()
  return c.json(result.results)
})

app.post('/api/crm/suppliers', async (c) => {
  const uid = c.get('userId')
  const { name, contact, phone, website } = await c.req.json()
  if (!name) return c.json({ error: 'Название обязательно' }, 400)
  const r = await c.env.DB.prepare(
    'INSERT INTO suppliers (user_id,name,contact,phone,website) VALUES (?,?,?,?,?)'
  ).bind(uid, name, contact||'', phone||'', website||'').run()
  return c.json({ id: r.meta.last_row_id, name, contact, phone, website })
})

app.delete('/api/crm/suppliers/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM suppliers WHERE id=? AND user_id=?').bind(id, uid).run()
  return c.json({ success: true })
})

// ============ FABRICS / PRICE LIST ============
app.get('/api/crm/fabrics', async (c) => {
  const uid = c.get('userId')
  const supplierId = c.req.query('supplier_id')
  const q = c.req.query('q') || ''
  let sql = 'SELECT f.*, s.name as supplier_name FROM fabrics f LEFT JOIN suppliers s ON f.supplier_id=s.id WHERE f.user_id=?'
  const params: any[] = [uid]
  if (supplierId) { sql += ' AND f.supplier_id=?'; params.push(supplierId) }
  if (q) { sql += ' AND (f.name LIKE ? OR f.article LIKE ?)'; params.push(`%${q}%`, `%${q}%`) }
  sql += ' ORDER BY f.name'
  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(result.results)
})

app.post('/api/crm/fabrics', async (c) => {
  const uid = c.get('userId')
  const { supplier_id, name, article, composition, width_cm, price_per_meter, notes } = await c.req.json()
  if (!name || !price_per_meter) return c.json({ error: 'Название и цена обязательны' }, 400)
  const r = await c.env.DB.prepare(
    'INSERT INTO fabrics (user_id,supplier_id,name,article,composition,width_cm,price_per_meter,notes) VALUES (?,?,?,?,?,?,?,?)'
  ).bind(uid, supplier_id||null, name, article||'', composition||'', width_cm||0, price_per_meter, notes||'').run()
  return c.json({ id: r.meta.last_row_id })
})

app.put('/api/crm/fabrics/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  const { supplier_id, name, article, composition, width_cm, price_per_meter, in_stock, notes } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE fabrics SET supplier_id=?,name=?,article=?,composition=?,width_cm=?,price_per_meter=?,in_stock=?,notes=? WHERE id=? AND user_id=?'
  ).bind(supplier_id||null, name, article||'', composition||'', width_cm||0, price_per_meter, in_stock??1, notes||'', id, uid).run()
  return c.json({ success: true })
})

app.delete('/api/crm/fabrics/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM fabrics WHERE id=? AND user_id=?').bind(id, uid).run()
  return c.json({ success: true })
})

// Bulk import fabrics (CSV-like)
app.post('/api/crm/fabrics/import', async (c) => {
  const uid = c.get('userId')
  const { fabrics: items, supplier_id } = await c.req.json()
  if (!items?.length) return c.json({ error: 'Нет данных' }, 400)
  let imported = 0
  for (const f of items) {
    await c.env.DB.prepare(
      'INSERT INTO fabrics (user_id,supplier_id,name,article,composition,width_cm,price_per_meter,notes) VALUES (?,?,?,?,?,?,?,?)'
    ).bind(uid, supplier_id||null, f.name, f.article||'', f.composition||'', f.width_cm||0, f.price_per_meter||0, f.notes||'').run()
    imported++
  }
  return c.json({ imported })
})

// ============ PROJECTS CRUD ============
app.get('/api/crm/projects', async (c) => {
  const uid = c.get('userId')
  const status = c.req.query('status')
  let sql = 'SELECT p.*, c.name as client_name FROM projects p JOIN clients c ON p.client_id=c.id WHERE p.user_id=?'
  const params: any[] = [uid]
  if (status) { sql += ' AND p.status=?'; params.push(status) }
  sql += ' ORDER BY p.updated_at DESC'
  const result = await c.env.DB.prepare(sql).bind(...params).all()
  return c.json(result.results)
})

app.get('/api/crm/projects/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  const project = await c.env.DB.prepare(
    'SELECT p.*, c.name as client_name, c.phone as client_phone, c.email as client_email, c.address as client_address FROM projects p JOIN clients c ON p.client_id=c.id WHERE p.id=? AND p.user_id=?'
  ).bind(id, uid).first()
  if (!project) return c.json({ error: 'Not found' }, 404)
  const items = await c.env.DB.prepare(
    'SELECT pi.*, f.name as fabric_name, f.article as fabric_article FROM project_items pi LEFT JOIN fabrics f ON pi.fabric_id=f.id WHERE pi.project_id=? ORDER BY pi.id'
  ).bind(id).all()
  return c.json({ ...project, items: items.results })
})

app.post('/api/crm/projects', async (c) => {
  const uid = c.get('userId')
  const { client_id, title, room, notes } = await c.req.json()
  if (!client_id || !title) return c.json({ error: 'Клиент и название обязательны' }, 400)
  const r = await c.env.DB.prepare(
    'INSERT INTO projects (user_id,client_id,title,room,notes) VALUES (?,?,?,?,?)'
  ).bind(uid, client_id, title, room||'', notes||'').run()
  return c.json({ id: r.meta.last_row_id })
})

app.put('/api/crm/projects/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  const { title, room, status, notes } = await c.req.json()
  await c.env.DB.prepare(
    'UPDATE projects SET title=?,room=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?'
  ).bind(title, room||'', status||'new', notes||'', id, uid).run()
  return c.json({ success: true })
})

app.delete('/api/crm/projects/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM project_items WHERE project_id=?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM projects WHERE id=? AND user_id=?').bind(id, uid).run()
  return c.json({ success: true })
})

// ============ PROJECT ITEMS ============
app.post('/api/crm/projects/:id/items', async (c) => {
  const id = c.req.param('id')
  const { fabric_id, description, quantity, unit, price } = await c.req.json()
  const amount = (quantity || 1) * (price || 0)
  await c.env.DB.prepare(
    'INSERT INTO project_items (project_id,fabric_id,description,quantity,unit,price,amount) VALUES (?,?,?,?,?,?,?)'
  ).bind(id, fabric_id||null, description, quantity||1, unit||'м', price||0, amount).run()
  // Recalc total
  const total = await c.env.DB.prepare('SELECT COALESCE(SUM(amount),0) as t FROM project_items WHERE project_id=?').bind(id).first()
  await c.env.DB.prepare('UPDATE projects SET total_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(total?.t||0, id).run()
  return c.json({ success: true, total: total?.t || 0 })
})

app.delete('/api/crm/projects/:pid/items/:iid', async (c) => {
  const pid = c.req.param('pid'); const iid = c.req.param('iid')
  await c.env.DB.prepare('DELETE FROM project_items WHERE id=? AND project_id=?').bind(iid, pid).run()
  const total = await c.env.DB.prepare('SELECT COALESCE(SUM(amount),0) as t FROM project_items WHERE project_id=?').bind(pid).first()
  await c.env.DB.prepare('UPDATE projects SET total_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(total?.t||0, pid).run()
  return c.json({ success: true, total: total?.t || 0 })
})

// ============ CONTRACTS ============
app.get('/api/crm/contracts', async (c) => {
  const uid = c.get('userId')
  const result = await c.env.DB.prepare(
    'SELECT ct.*, c.name as client_name, p.title as project_title FROM contracts ct JOIN clients c ON ct.client_id=c.id JOIN projects p ON ct.project_id=p.id WHERE ct.user_id=? ORDER BY ct.created_at DESC'
  ).bind(uid).all()
  return c.json(result.results)
})

app.get('/api/crm/contracts/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  const contract = await c.env.DB.prepare(
    'SELECT ct.*, c.name as client_name, p.title as project_title FROM contracts ct JOIN clients c ON ct.client_id=c.id JOIN projects p ON ct.project_id=p.id WHERE ct.id=? AND ct.user_id=?'
  ).bind(id, uid).first()
  if (!contract) return c.json({ error: 'Not found' }, 404)
  const items = await c.env.DB.prepare(
    'SELECT pi.*, f.name as fabric_name FROM project_items pi LEFT JOIN fabrics f ON pi.fabric_id=f.id WHERE pi.project_id=?'
  ).bind(contract.project_id).all()
  return c.json({ ...contract, items: items.results })
})

app.post('/api/crm/contracts', async (c) => {
  const uid = c.get('userId')
  const data = await c.req.json()
  const { project_id, client_name, client_phone, client_address, client_passport, prepayment, notes } = data
  if (!project_id || !client_name) return c.json({ error: 'Заполните обязательные поля' }, 400)

  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id=? AND user_id=?').bind(project_id, uid).first()
  if (!project) return c.json({ error: 'Проект не найден' }, 404)

  const user = await c.env.DB.prepare('SELECT name, company, phone FROM users WHERE id=?').bind(uid).first()
  const now = new Date()
  const contractNumber = `Д-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${project_id}`
  const contractDate = now.toISOString().split('T')[0]

  const r = await c.env.DB.prepare(
    `INSERT INTO contracts (project_id,client_id,user_id,contract_number,contract_date,total_amount,prepayment,
     client_name,client_phone,client_address,client_passport,executor_name,executor_company,executor_phone,notes,status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    project_id, project.client_id, uid, contractNumber, contractDate, project.total_amount, prepayment||0,
    client_name, client_phone||'', client_address||'', client_passport||'',
    user?.name||'', user?.company||'', user?.phone||'', notes||'', 'draft'
  ).run()
  return c.json({ id: r.meta.last_row_id, contract_number: contractNumber })
})

app.put('/api/crm/contracts/:id/sign', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  await c.env.DB.prepare("UPDATE contracts SET status='signed' WHERE id=? AND user_id=?").bind(id, uid).run()
  return c.json({ success: true })
})

// ============ CONTRACT HTML (for print/PDF) ============
app.get('/api/crm/contracts/:id/html', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  const ct = await c.env.DB.prepare(
    'SELECT ct.*, c.name as cn, p.title as pt FROM contracts ct JOIN clients c ON ct.client_id=c.id JOIN projects p ON ct.project_id=p.id WHERE ct.id=? AND ct.user_id=?'
  ).bind(id, uid).first()
  if (!ct) return c.text('Not found', 404)
  const items = await c.env.DB.prepare(
    'SELECT pi.*, f.name as fn FROM project_items pi LEFT JOIN fabrics f ON pi.fabric_id=f.id WHERE pi.project_id=?'
  ).bind(ct.project_id).all()

  let rows = ''
  items.results.forEach((it: any, i: number) => {
    rows += `<tr><td>${i+1}</td><td>${it.description}</td><td>${it.quantity} ${it.unit}</td><td>${Number(it.price).toLocaleString('ru')} ₽</td><td>${Number(it.amount).toLocaleString('ru')} ₽</td></tr>`
  })

  const statusText: Record<string, string> = { draft: 'Черновик', signed: 'Подписан', completed: 'Завершён', cancelled: 'Отменён' }

  return c.html(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><title>Договор ${ct.contract_number}</title>
<style>
  body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333;font-size:14px;line-height:1.6}
  h1{text-align:center;font-size:20px;margin-bottom:5px}
  .meta{text-align:center;color:#666;margin-bottom:30px}
  .section{margin:20px 0}
  .section h3{border-bottom:1px solid #ccc;padding-bottom:5px;color:#444}
  table{width:100%;border-collapse:collapse;margin:15px 0}
  th,td{border:1px solid #ccc;padding:8px 10px;text-align:left}
  th{background:#f5f5f5}
  .total{text-align:right;font-size:16px;font-weight:bold;margin:10px 0}
  .signatures{display:flex;justify-content:space-between;margin-top:60px}
  .sig-block{width:45%;border-top:1px solid #333;padding-top:10px}
  .status{display:inline-block;padding:4px 12px;border-radius:4px;font-size:12px;font-weight:bold}
  .status-draft{background:#fff3cd;color:#856404}
  .status-signed{background:#d4edda;color:#155724}
  @media print{body{margin:20px}button{display:none!important}}
  .print-btn{position:fixed;top:20px;right:20px;padding:10px 20px;background:#4263eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:14px}
</style></head><body>
<button class="print-btn" onclick="window.print()">🖨️ Печать / PDF</button>
<h1>ДОГОВОР № ${ct.contract_number}</h1>
<p class="meta">от ${ct.contract_date} г. <span class="status status-${ct.status}">${statusText[ct.status as string] || ct.status}</span></p>
<div class="section"><h3>1. Стороны договора</h3>
<p><strong>Исполнитель:</strong> ${ct.executor_company || ct.executor_name}, тел. ${ct.executor_phone}</p>
<p><strong>Заказчик:</strong> ${ct.client_name}, тел. ${ct.client_phone}<br>Адрес: ${ct.client_address}${ct.client_passport ? '<br>Паспорт: ' + ct.client_passport : ''}</p></div>
<div class="section"><h3>2. Предмет договора</h3>
<p>Исполнитель обязуется выполнить работы по проекту «${ct.pt}» в соответствии со спецификацией:</p>
<table><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table>
<p class="total">ИТОГО: ${Number(ct.total_amount).toLocaleString('ru')} ₽</p></div>
<div class="section"><h3>3. Порядок оплаты</h3>
<p>Предоплата: <strong>${Number(ct.prepayment).toLocaleString('ru')} ₽</strong></p>
<p>Остаток: <strong>${(Number(ct.total_amount) - Number(ct.prepayment)).toLocaleString('ru')} ₽</strong> — при завершении работ.</p></div>
<div class="section"><h3>4. Сроки и условия</h3>
<p>Срок выполнения работ: согласовывается дополнительно. Гарантия на пошив — 12 месяцев.</p></div>
${ct.notes ? `<div class="section"><h3>5. Примечания</h3><p>${ct.notes}</p></div>` : ''}
<div class="signatures"><div class="sig-block"><strong>Исполнитель:</strong><br><br><br>_________________ / ${ct.executor_name} /</div>
<div class="sig-block"><strong>Заказчик:</strong><br><br><br>_________________ / ${ct.client_name} /</div></div>
</body></html>`)
})

// ============ LANDING PAGE ============
app.get('/', (c) => {
  return c.html(LANDING_HTML)
})

// ============ CRM SPA ============
app.get('/crm', (c) => c.html(CRM_HTML))
app.get('/crm/*', (c) => c.html(CRM_HTML))

export default app

// =====================================================
// LANDING PAGE HTML
// =====================================================
const LANDING_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ШторCRM — CRM и Учёт для салонов штор</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: { extend: { fontFamily: { sans: ['Inter','sans-serif'] },
        colors: { brand: { 50:'#f0f4ff',100:'#dbe4ff',200:'#bac8ff',300:'#91a7ff',400:'#748ffc',500:'#5c7cfa',600:'#4c6ef5',700:'#4263eb',800:'#3b5bdb',900:'#364fc7' }, accent: { 400:'#f59f00',500:'#f08c00',600:'#e67700' } }
      }}
    }
  </script>
  <style>
    *{scroll-behavior:smooth}body{font-family:'Inter',sans-serif}
    .hero-gradient{background:linear-gradient(135deg,#4263eb 0%,#5c7cfa 30%,#748ffc 60%,#91a7ff 100%)}
    .feature-card{transition:all .3s ease}.feature-card:hover{transform:translateY(-6px);box-shadow:0 20px 40px rgba(66,99,235,.15)}
    .fade-up{opacity:0;transform:translateY(30px);transition:all .7s ease}.fade-up.visible{opacity:1;transform:translateY(0)}
    .float-shape{animation:floatUp 6s ease-in-out infinite}.float-shape:nth-child(2){animation-delay:-2s}
    @keyframes floatUp{0%,100%{transform:translateY(0)}50%{transform:translateY(-15px)}}
  </style>
</head>
<body class="bg-white text-gray-800">
  <header class="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
      <a href="/" class="flex items-center gap-2"><div class="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center"><i class="fas fa-scissors text-white text-sm"></i></div><span class="text-xl font-bold text-gray-900">Штор<span class="text-brand-600">CRM</span></span></a>
      <nav class="hidden md:flex items-center gap-8">
        <a href="#features" class="text-sm font-medium text-gray-600 hover:text-brand-600">Возможности</a>
        <a href="#pricing" class="text-sm font-medium text-gray-600 hover:text-brand-600">Тарифы</a>
        <a href="#faq" class="text-sm font-medium text-gray-600 hover:text-brand-600">Вопросы</a>
      </nav>
      <div class="flex items-center gap-3">
        <a href="/crm" class="hidden md:inline-flex items-center px-4 py-2 border border-brand-600 text-brand-600 text-sm font-semibold rounded-xl hover:bg-brand-50">Войти</a>
        <a href="/crm" class="inline-flex items-center px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 shadow-md">Начать бесплатно</a>
      </div>
    </div>
  </header>

  <section class="hero-gradient relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
    <div class="absolute inset-0 pointer-events-none"><div class="float-shape absolute top-20 left-[10%] w-20 h-20 bg-white/5 rounded-2xl rotate-12"></div><div class="float-shape absolute top-40 right-[15%] w-16 h-16 bg-white/5 rounded-full"></div></div>
    <div class="relative max-w-7xl mx-auto px-4 sm:px-6 text-center">
      <div class="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 rounded-full text-white/90 text-sm font-medium mb-6"><i class="fas fa-star text-accent-400"></i>Уже готов к работе</div>
      <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">CRM и Учёт<br><span class="text-white/80">для салонов штор</span></h1>
      <p class="text-lg sm:text-xl text-white/75 max-w-2xl mx-auto mb-8">Ведите клиентов, создавайте проекты с выбором тканей из прайсов, формируйте договоры — всё в одном месте</p>
      <div class="flex flex-col sm:flex-row items-center gap-4 justify-center">
        <a href="/crm" class="w-full sm:w-auto px-8 py-4 bg-white text-brand-700 font-bold rounded-2xl hover:bg-brand-50 shadow-xl text-lg inline-flex items-center justify-center gap-2">Начать бесплатно <i class="fas fa-arrow-right text-sm"></i></a>
      </div>
      <div class="flex items-center justify-center gap-6 mt-8 text-white/60 text-sm">
        <span><i class="fas fa-check text-accent-400 mr-1"></i>14 дней бесплатно</span>
        <span><i class="fas fa-check text-accent-400 mr-1"></i>Без карты</span>
      </div>
    </div>
  </section>

  <section id="features" class="py-20 bg-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6">
      <div class="text-center mb-16 fade-up"><span class="inline-block px-4 py-1.5 bg-brand-50 text-brand-600 rounded-full text-sm font-semibold mb-4">Возможности</span><h2 class="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Всё для вашего бизнеса</h2></div>
      <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        <div class="feature-card bg-gradient-to-br from-brand-50 to-white rounded-3xl p-8 border border-brand-100/50 fade-up">
          <div class="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center mb-6"><i class="fas fa-users text-white text-xl"></i></div>
          <h3 class="text-xl font-bold mb-3">Управление клиентами</h3>
          <p class="text-gray-500">База клиентов с контактами, адресами и историей проектов. Поиск и фильтрация.</p>
        </div>
        <div class="feature-card bg-gradient-to-br from-emerald-50 to-white rounded-3xl p-8 border border-emerald-100/50 fade-up">
          <div class="w-14 h-14 bg-emerald-600 rounded-2xl flex items-center justify-center mb-6"><i class="fas fa-folder-open text-white text-xl"></i></div>
          <h3 class="text-xl font-bold mb-3">Проекты</h3>
          <p class="text-gray-500">Создание проектов с выбором тканей из прайсов, отслеживание статусов от замера до монтажа.</p>
        </div>
        <div class="feature-card bg-gradient-to-br from-amber-50 to-white rounded-3xl p-8 border border-amber-100/50 fade-up">
          <div class="w-14 h-14 bg-amber-500 rounded-2xl flex items-center justify-center mb-6"><i class="fas fa-scroll text-white text-xl"></i></div>
          <h3 class="text-xl font-bold mb-3">Прайс-листы тканей</h3>
          <p class="text-gray-500">Загрузка прайсов поставщиков, артикулы, цены, остатки. Быстрый поиск по каталогу.</p>
        </div>
        <div class="feature-card bg-gradient-to-br from-purple-50 to-white rounded-3xl p-8 border border-purple-100/50 fade-up">
          <div class="w-14 h-14 bg-purple-600 rounded-2xl flex items-center justify-center mb-6"><i class="fas fa-file-contract text-white text-xl"></i></div>
          <h3 class="text-xl font-bold mb-3">Договоры</h3>
          <p class="text-gray-500">Автоматическое формирование договора из данных клиента и проекта. Печать и PDF.</p>
        </div>
        <div class="feature-card bg-gradient-to-br from-rose-50 to-white rounded-3xl p-8 border border-rose-100/50 fade-up">
          <div class="w-14 h-14 bg-rose-500 rounded-2xl flex items-center justify-center mb-6"><i class="fas fa-chart-pie text-white text-xl"></i></div>
          <h3 class="text-xl font-bold mb-3">Дашборд</h3>
          <p class="text-gray-500">Обзор всех проектов, клиентов, выручки и активных заказов на одном экране.</p>
        </div>
        <div class="feature-card bg-gradient-to-br from-cyan-50 to-white rounded-3xl p-8 border border-cyan-100/50 fade-up">
          <div class="w-14 h-14 bg-cyan-600 rounded-2xl flex items-center justify-center mb-6"><i class="fas fa-truck text-white text-xl"></i></div>
          <h3 class="text-xl font-bold mb-3">Поставщики</h3>
          <p class="text-gray-500">Управление поставщиками тканей, их каталогами и контактной информацией.</p>
        </div>
      </div>
    </div>
  </section>

  <section class="py-16 bg-brand-600">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 text-center">
      <h2 class="text-3xl md:text-4xl font-extrabold text-white mb-6">Готовы попробовать?</h2>
      <p class="text-lg text-white/75 mb-8">Зарегистрируйтесь и начните работать прямо сейчас</p>
      <a href="/crm" class="inline-flex items-center gap-2 px-10 py-4 bg-white text-brand-700 font-bold rounded-2xl hover:bg-brand-50 shadow-xl text-lg">Начать бесплатно <i class="fas fa-arrow-right text-sm"></i></a>
    </div>
  </section>

  <footer class="bg-gray-900 text-gray-400 py-12">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 text-center">
      <p class="text-sm">&copy; 2024–2026 ШторCRM. Все права защищены.</p>
    </div>
  </footer>

  <script>
    const obs = new IntersectionObserver(e => e.forEach(el => { if(el.isIntersecting) el.target.classList.add('visible') }), {threshold:.1});
    document.querySelectorAll('.fade-up').forEach(el => obs.observe(el));
  </script>
</body>
</html>`

// =====================================================
// CRM SPA HTML
// =====================================================
const CRM_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ШторCRM — Личный кабинет</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
  <script>
    tailwind.config = {
      theme: { extend: { fontFamily: { sans: ['Inter','sans-serif'] },
        colors: { brand: {50:'#f0f4ff',100:'#dbe4ff',200:'#bac8ff',300:'#91a7ff',400:'#748ffc',500:'#5c7cfa',600:'#4c6ef5',700:'#4263eb',800:'#3b5bdb',900:'#364fc7'} }
      }}
    }
  </script>
  <style>
    body{font-family:'Inter',sans-serif;background:#f8fafc}
    .sidebar-link{transition:all .15s ease}.sidebar-link:hover,.sidebar-link.active{background:rgba(66,99,235,.1);color:#4263eb}
    .modal-overlay{animation:fadeIn .2s ease}.modal-content{animation:slideUp .3s ease}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
    .status-badge{padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600}
    .status-new{background:#dbeafe;color:#1e40af}.status-measuring{background:#fef3c7;color:#92400e}
    .status-design{background:#e0e7ff;color:#3730a3}.status-sewing{background:#fce7f3;color:#9d174d}
    .status-installation{background:#fed7aa;color:#9a3412}.status-completed{background:#d1fae5;color:#065f46}
    .status-cancelled{background:#fee2e2;color:#991b1b}
    .card{background:#fff;border-radius:16px;border:1px solid #e2e8f0;transition:all .2s ease}
    .card:hover{box-shadow:0 4px 12px rgba(0,0,0,.05)}
  </style>
</head>
<body>
<div id="app"></div>
<script>
// ============ STATE ============
const API = '/api';
let state = {
  token: localStorage.getItem('shtorcrm_token') || '',
  user: JSON.parse(localStorage.getItem('shtorcrm_user') || 'null'),
  page: 'dashboard',
  data: {}
};

function saveAuth(token, user) {
  state.token = token; state.user = user;
  localStorage.setItem('shtorcrm_token', token);
  localStorage.setItem('shtorcrm_user', JSON.stringify(user));
}
function logout() {
  state.token = ''; state.user = null;
  localStorage.removeItem('shtorcrm_token');
  localStorage.removeItem('shtorcrm_user');
  render();
}

// ============ API HELPERS ============
async function api(method, path, body) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (state.token) opts.headers['Authorization'] = 'Bearer ' + state.token;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

// ============ RENDER ============
function render() {
  const app = document.getElementById('app');
  if (!state.token) { app.innerHTML = renderAuth(); bindAuth(); return; }
  app.innerHTML = renderLayout();
  bindLayout();
  navigate(state.page);
}

// ============ AUTH PAGES ============
function renderAuth() {
  return \`
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800 p-4">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
      <div class="text-center mb-8">
        <div class="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-3"><i class="fas fa-scissors text-white text-xl"></i></div>
        <h1 class="text-2xl font-bold text-gray-900">Штор<span class="text-brand-600">CRM</span></h1>
        <p class="text-gray-500 text-sm mt-1">CRM и учёт для салонов штор</p>
      </div>
      <div id="authTabs" class="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button onclick="showTab('login')" id="tabLogin" class="flex-1 py-2 text-sm font-semibold rounded-lg bg-white shadow text-brand-600">Вход</button>
        <button onclick="showTab('register')" id="tabRegister" class="flex-1 py-2 text-sm font-semibold rounded-lg text-gray-500">Регистрация</button>
      </div>
      <div id="loginForm">
        <div class="space-y-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input id="loginEmail" type="email" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none" placeholder="demo@shtorcrm.ru"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Пароль</label><input id="loginPass" type="password" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none" placeholder="demo123"></div>
          <button id="loginBtn" class="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700 transition-colors">Войти</button>
          <p id="loginError" class="text-red-500 text-sm text-center hidden"></p>
          <p class="text-xs text-gray-400 text-center">Демо: demo@shtorcrm.ru / demo123</p>
        </div>
      </div>
      <div id="registerForm" class="hidden">
        <div class="space-y-4">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Имя *</label><input id="regName" type="text" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Мария Иванова"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Email *</label><input id="regEmail" type="email" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="mail@example.com"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Пароль *</label><input id="regPass" type="password" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="Минимум 6 символов"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Компания</label><input id="regCompany" type="text" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder='Студия штор "Уют"'></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Телефон</label><input id="regPhone" type="tel" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="+7 (900) 123-45-67"></div>
          <button id="regBtn" class="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700">Зарегистрироваться</button>
          <p id="regError" class="text-red-500 text-sm text-center hidden"></p>
        </div>
      </div>
    </div>
  </div>\`;
}

function showTab(tab) {
  document.getElementById('loginForm').classList.toggle('hidden', tab !== 'login');
  document.getElementById('registerForm').classList.toggle('hidden', tab !== 'register');
  document.getElementById('tabLogin').className = 'flex-1 py-2 text-sm font-semibold rounded-lg ' + (tab === 'login' ? 'bg-white shadow text-brand-600' : 'text-gray-500');
  document.getElementById('tabRegister').className = 'flex-1 py-2 text-sm font-semibold rounded-lg ' + (tab === 'register' ? 'bg-white shadow text-brand-600' : 'text-gray-500');
}

function bindAuth() {
  setTimeout(() => {
    const loginBtn = document.getElementById('loginBtn');
    const regBtn = document.getElementById('regBtn');
    if (loginBtn) loginBtn.onclick = async () => {
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPass').value;
      try {
        const r = await api('POST', '/auth/login', { email, password });
        saveAuth(r.token, r.user); render();
      } catch (e) {
        const el = document.getElementById('loginError'); el.textContent = e.message; el.classList.remove('hidden');
      }
    };
    if (regBtn) regBtn.onclick = async () => {
      const name = document.getElementById('regName').value;
      const email = document.getElementById('regEmail').value;
      const password = document.getElementById('regPass').value;
      const company = document.getElementById('regCompany').value;
      const phone = document.getElementById('regPhone').value;
      try {
        const r = await api('POST', '/auth/register', { name, email, password, company, phone });
        saveAuth(r.token, r.user); render();
      } catch (e) {
        const el = document.getElementById('regError'); el.textContent = e.message; el.classList.remove('hidden');
      }
    };
  }, 50);
}

// ============ LAYOUT ============
function renderLayout() {
  return \`
  <div class="flex h-screen">
    <aside class="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 hidden lg:flex">
      <div class="p-5 border-b border-gray-100">
        <a href="/" class="flex items-center gap-2"><div class="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center"><i class="fas fa-scissors text-white text-xs"></i></div><span class="text-lg font-bold">Штор<span class="text-brand-600">CRM</span></span></a>
      </div>
      <nav class="flex-1 p-3 space-y-1" id="sideNav">
        <a href="#" data-page="dashboard" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-chart-pie w-5 text-center"></i>Дашборд</a>
        <a href="#" data-page="clients" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-users w-5 text-center"></i>Клиенты</a>
        <a href="#" data-page="projects" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-folder-open w-5 text-center"></i>Проекты</a>
        <a href="#" data-page="fabrics" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-scroll w-5 text-center"></i>Ткани / Прайсы</a>
        <a href="#" data-page="suppliers" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-truck w-5 text-center"></i>Поставщики</a>
        <a href="#" data-page="contracts" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-file-contract w-5 text-center"></i>Договоры</a>
      </nav>
      <div class="p-4 border-t border-gray-100">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center"><span class="text-brand-700 font-bold text-sm">\${state.user?.name?.[0] || 'U'}</span></div>
          <div class="flex-1 min-w-0"><div class="text-sm font-medium text-gray-800 truncate">\${state.user?.name || ''}</div><div class="text-xs text-gray-400 truncate">\${state.user?.email || ''}</div></div>
          <button onclick="logout()" class="text-gray-400 hover:text-red-500" title="Выйти"><i class="fas fa-sign-out-alt"></i></button>
        </div>
      </div>
    </aside>
    <div class="flex-1 flex flex-col overflow-hidden">
      <header class="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between lg:hidden">
        <a href="/" class="flex items-center gap-2"><div class="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center"><i class="fas fa-scissors text-white text-xs"></i></div><span class="font-bold">ШторCRM</span></a>
        <div class="flex items-center gap-2">
          <select id="mobileNav" class="text-sm border border-gray-200 rounded-lg px-3 py-2" onchange="navigate(this.value)">
            <option value="dashboard">Дашборд</option>
            <option value="clients">Клиенты</option>
            <option value="projects">Проекты</option>
            <option value="fabrics">Ткани</option>
            <option value="suppliers">Поставщики</option>
            <option value="contracts">Договоры</option>
          </select>
          <button onclick="logout()" class="text-gray-400 hover:text-red-500 px-2"><i class="fas fa-sign-out-alt"></i></button>
        </div>
      </header>
      <main class="flex-1 overflow-auto p-6" id="mainContent"></main>
    </div>
  </div>
  <div id="modalContainer"></div>\`;
}

function bindLayout() {
  setTimeout(() => {
    document.querySelectorAll('#sideNav a').forEach(a => {
      a.onclick = (e) => { e.preventDefault(); navigate(a.dataset.page); };
    });
  }, 50);
}

function navigate(page) {
  state.page = page;
  document.querySelectorAll('.sidebar-link').forEach(a => a.classList.toggle('active', a.dataset.page === page));
  const mob = document.getElementById('mobileNav');
  if (mob) mob.value = page;
  const pages = { dashboard: loadDashboard, clients: loadClients, projects: loadProjects, fabrics: loadFabrics, suppliers: loadSuppliers, contracts: loadContracts };
  if (pages[page]) pages[page]();
}

const mc = () => document.getElementById('mainContent');
const modal = () => document.getElementById('modalContainer');
const STATUS_LABELS = { new:'Новый', measuring:'Замер', design:'Дизайн', sewing:'Пошив', installation:'Монтаж', completed:'Завершён', cancelled:'Отменён' };
const fmt = (n) => Number(n||0).toLocaleString('ru');

// ============ DASHBOARD ============
async function loadDashboard() {
  mc().innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-brand-500 text-2xl"></i></div>';
  try {
    const d = await api('GET', '/crm/dashboard');
    mc().innerHTML = \`
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Дашборд</h1>
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div class="card p-5"><div class="flex items-center gap-3"><div class="w-11 h-11 bg-brand-100 rounded-xl flex items-center justify-center"><i class="fas fa-users text-brand-600"></i></div><div><div class="text-2xl font-bold text-gray-900">\${d.clients}</div><div class="text-xs text-gray-500">Клиентов</div></div></div></div>
      <div class="card p-5"><div class="flex items-center gap-3"><div class="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center"><i class="fas fa-folder-open text-emerald-600"></i></div><div><div class="text-2xl font-bold text-gray-900">\${d.projects}</div><div class="text-xs text-gray-500">Проектов</div></div></div></div>
      <div class="card p-5"><div class="flex items-center gap-3"><div class="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center"><i class="fas fa-spinner text-amber-600"></i></div><div><div class="text-2xl font-bold text-gray-900">\${d.activeProjects}</div><div class="text-xs text-gray-500">В работе</div></div></div></div>
      <div class="card p-5"><div class="flex items-center gap-3"><div class="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center"><i class="fas fa-file-contract text-purple-600"></i></div><div><div class="text-2xl font-bold text-gray-900">\${d.contracts}</div><div class="text-xs text-gray-500">Договоров</div></div></div></div>
    </div>
    <div class="card p-6">
      <h3 class="font-bold text-gray-900 mb-4">Последние проекты</h3>
      \${d.recentProjects.length ? '<div class="space-y-3">' + d.recentProjects.map(p => \`
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-brand-50" onclick="state.page='projects';loadProjectDetail(\${p.id})">
          <div><div class="font-medium text-sm">\${p.title}</div><div class="text-xs text-gray-500">\${p.client_name} — \${p.room || ''}</div></div>
          <div class="flex items-center gap-3"><span class="text-sm font-semibold">\${p.total_amount > 0 ? fmt(p.total_amount) + ' ₽' : '—'}</span><span class="status-badge status-\${p.status}">\${STATUS_LABELS[p.status]||p.status}</span></div>
        </div>\`).join('') + '</div>' : '<p class="text-gray-400 text-sm">Проектов пока нет</p>'}
    </div>\`;
  } catch (e) { mc().innerHTML = '<p class="text-red-500">' + e.message + '</p>'; }
}

// ============ CLIENTS ============
async function loadClients() {
  mc().innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-brand-500 text-2xl"></i></div>';
  const clients = await api('GET', '/crm/clients');
  mc().innerHTML = \`
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Клиенты</h1>
    <button onclick="showClientModal()" class="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700"><i class="fas fa-plus mr-1"></i>Добавить</button>
  </div>
  <div class="mb-4"><input id="clientSearch" type="text" class="w-full md:w-80 px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Поиск по имени, телефону, email..."></div>
  <div class="grid gap-3" id="clientsList">
    \${clients.map(cl => \`<div class="card p-5 flex items-center justify-between">
      <div class="flex-1 min-w-0">
        <div class="font-semibold text-gray-900">\${cl.name}</div>
        <div class="text-sm text-gray-500 mt-0.5">\${[cl.phone,cl.email].filter(Boolean).join(' · ')}</div>
        \${cl.address ? '<div class="text-xs text-gray-400 mt-1"><i class="fas fa-map-marker-alt mr-1"></i>' + cl.address + '</div>' : ''}
      </div>
      <div class="flex items-center gap-2 ml-4">
        <button onclick='showClientModal(\${JSON.stringify(cl).replace(/'/g,"&#39;")})' class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600"><i class="fas fa-pen text-xs"></i></button>
        <button onclick="deleteClient(\${cl.id})" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button>
      </div>
    </div>\`).join('')}
  </div>
  \${!clients.length ? '<div class="text-center py-12 text-gray-400"><i class="fas fa-users text-4xl mb-3"></i><p>Клиентов пока нет</p></div>' : ''}\`;

  document.getElementById('clientSearch').oninput = async function() {
    const list = await api('GET', '/crm/clients?q=' + encodeURIComponent(this.value));
    // Re-render simplified
    navigate('clients');
  };
}

function showClientModal(client) {
  const c = client || {};
  modal().innerHTML = \`
  <div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6">
      <h2 class="text-lg font-bold mb-4">\${c.id ? 'Редактировать клиента' : 'Новый клиент'}</h2>
      <div class="space-y-3">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">ФИО *</label><input id="cName" value="\${c.name||''}" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Иванова Мария Петровна"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Телефон</label><input id="cPhone" value="\${c.phone||''}" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="+7 (900) 123-45-67"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input id="cEmail" value="\${c.email||''}" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="mail@example.com"></div>
        </div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Адрес</label><input id="cAddr" value="\${c.address||''}" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="г. Москва, ул. Ленина, 15"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Заметки</label><textarea id="cNotes" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" rows="2">\${c.notes||''}</textarea></div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="saveClient(\${c.id||0})" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700">Сохранить</button>
        <button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl hover:bg-gray-50">Отмена</button>
      </div>
    </div>
  </div>\`;
}

async function saveClient(id) {
  const data = { name: document.getElementById('cName').value, phone: document.getElementById('cPhone').value, email: document.getElementById('cEmail').value, address: document.getElementById('cAddr').value, notes: document.getElementById('cNotes').value };
  if (!data.name) return alert('Введите имя клиента');
  try {
    if (id) await api('PUT', '/crm/clients/' + id, data);
    else await api('POST', '/crm/clients', data);
    closeModal(); loadClients();
  } catch (e) { alert(e.message); }
}

async function deleteClient(id) {
  if (!confirm('Удалить клиента?')) return;
  await api('DELETE', '/crm/clients/' + id);
  loadClients();
}

function closeModal() { modal().innerHTML = ''; }

// ============ SUPPLIERS ============
async function loadSuppliers() {
  const items = await api('GET', '/crm/suppliers');
  mc().innerHTML = \`
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Поставщики</h1>
    <button onclick="showSupplierModal()" class="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700"><i class="fas fa-plus mr-1"></i>Добавить</button>
  </div>
  <div class="grid gap-3">
    \${items.map(s => \`<div class="card p-5 flex items-center justify-between">
      <div><div class="font-semibold text-gray-900">\${s.name}</div><div class="text-sm text-gray-500">\${[s.contact,s.phone].filter(Boolean).join(' · ')}</div></div>
      <button onclick="deleteSupplier(\${s.id})" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button>
    </div>\`).join('')}
  </div>
  \${!items.length ? '<div class="text-center py-12 text-gray-400"><i class="fas fa-truck text-4xl mb-3"></i><p>Поставщиков пока нет</p></div>' : ''}\`;
}

function showSupplierModal() {
  modal().innerHTML = \`
  <div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6">
      <h2 class="text-lg font-bold mb-4">Новый поставщик</h2>
      <div class="space-y-3">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Название *</label><input id="sName" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Контактное лицо</label><input id="sContact" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Телефон</label><input id="sPhone" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="saveSupplier()" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Сохранить</button>
        <button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button>
      </div>
    </div>
  </div>\`;
}
async function saveSupplier() {
  try { await api('POST', '/crm/suppliers', { name: document.getElementById('sName').value, contact: document.getElementById('sContact').value, phone: document.getElementById('sPhone').value }); closeModal(); loadSuppliers(); } catch(e) { alert(e.message); }
}
async function deleteSupplier(id) { if(!confirm('Удалить?')) return; await api('DELETE','/crm/suppliers/'+id); loadSuppliers(); }

// ============ FABRICS ============
async function loadFabrics() {
  const [fabrics, suppliers] = await Promise.all([api('GET','/crm/fabrics'), api('GET','/crm/suppliers')]);
  state.data.suppliers = suppliers;
  mc().innerHTML = \`
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Ткани / Прайс-листы</h1>
    <div class="flex gap-2">
      <button onclick="showImportModal()" class="px-4 py-2 border border-brand-600 text-brand-600 text-sm font-semibold rounded-xl hover:bg-brand-50"><i class="fas fa-upload mr-1"></i>Импорт</button>
      <button onclick="showFabricModal()" class="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700"><i class="fas fa-plus mr-1"></i>Добавить</button>
    </div>
  </div>
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead><tr class="border-b border-gray-200"><th class="text-left py-3 px-4 font-semibold text-gray-600">Название</th><th class="text-left py-3 px-4 font-semibold text-gray-600">Артикул</th><th class="text-left py-3 px-4 font-semibold text-gray-600">Поставщик</th><th class="text-left py-3 px-4 font-semibold text-gray-600">Состав</th><th class="text-right py-3 px-4 font-semibold text-gray-600">Шир., см</th><th class="text-right py-3 px-4 font-semibold text-gray-600">Цена/м</th><th class="py-3 px-4"></th></tr></thead>
      <tbody>\${fabrics.map(f => \`<tr class="border-b border-gray-100 hover:bg-gray-50">
        <td class="py-3 px-4 font-medium">\${f.name}</td>
        <td class="py-3 px-4 text-gray-500">\${f.article||'—'}</td>
        <td class="py-3 px-4 text-gray-500">\${f.supplier_name||'—'}</td>
        <td class="py-3 px-4 text-gray-500">\${f.composition||'—'}</td>
        <td class="py-3 px-4 text-right">\${f.width_cm||'—'}</td>
        <td class="py-3 px-4 text-right font-semibold">\${fmt(f.price_per_meter)} ₽</td>
        <td class="py-3 px-4"><button onclick="deleteFabric(\${f.id})" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button></td>
      </tr>\`).join('')}</tbody>
    </table>
  </div>
  \${!fabrics.length ? '<div class="text-center py-12 text-gray-400"><i class="fas fa-scroll text-4xl mb-3"></i><p>Тканей пока нет</p></div>' : ''}\`;
}

function showFabricModal() {
  const supOpts = (state.data.suppliers||[]).map(s => '<option value="'+s.id+'">'+s.name+'</option>').join('');
  modal().innerHTML = \`
  <div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6">
      <h2 class="text-lg font-bold mb-4">Новая ткань</h2>
      <div class="space-y-3">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Название *</label><input id="fName" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Артикул</label><input id="fArticle" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Поставщик</label><select id="fSupplier" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"><option value="">—</option>\${supOpts}</select></div>
        </div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Состав</label><input id="fComp" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Ширина, см</label><input id="fWidth" type="number" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Цена за метр, ₽ *</label><input id="fPrice" type="number" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="saveFabric()" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Сохранить</button>
        <button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button>
      </div>
    </div>
  </div>\`;
}

async function saveFabric() {
  try {
    await api('POST', '/crm/fabrics', { name: document.getElementById('fName').value, article: document.getElementById('fArticle').value, supplier_id: document.getElementById('fSupplier').value || null, composition: document.getElementById('fComp').value, width_cm: parseFloat(document.getElementById('fWidth').value)||0, price_per_meter: parseFloat(document.getElementById('fPrice').value)||0 });
    closeModal(); loadFabrics();
  } catch(e) { alert(e.message); }
}
async function deleteFabric(id) { if(!confirm('Удалить?')) return; await api('DELETE','/crm/fabrics/'+id); loadFabrics(); }

function showImportModal() {
  const supOpts = (state.data.suppliers||[]).map(s => '<option value="'+s.id+'">'+s.name+'</option>').join('');
  modal().innerHTML = \`
  <div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6">
      <h2 class="text-lg font-bold mb-4">Импорт прайс-листа</h2>
      <p class="text-sm text-gray-500 mb-4">Вставьте данные в формате CSV: Название;Артикул;Состав;Ширина;Цена</p>
      <div class="space-y-3">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Поставщик</label><select id="impSupplier" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"><option value="">—</option>\${supOpts}</select></div>
        <div><textarea id="impData" rows="8" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono" placeholder="Бархат Версаль;VRS-001;100% полиэстер;280;1850\nЛён натуральный;LN-045;100% лён;150;980"></textarea></div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="doImport()" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Импортировать</button>
        <button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button>
      </div>
    </div>
  </div>\`;
}

async function doImport() {
  const lines = document.getElementById('impData').value.trim().split('\\n').filter(Boolean);
  const fabrics = lines.map(l => { const p = l.split(';'); return { name:p[0]?.trim(), article:p[1]?.trim(), composition:p[2]?.trim(), width_cm:parseFloat(p[3])||0, price_per_meter:parseFloat(p[4])||0 }; }).filter(f=>f.name);
  if(!fabrics.length) return alert('Нет данных');
  try {
    const r = await api('POST','/crm/fabrics/import', { fabrics, supplier_id: document.getElementById('impSupplier').value||null });
    alert('Импортировано: '+r.imported); closeModal(); loadFabrics();
  } catch(e) { alert(e.message); }
}

// ============ PROJECTS ============
async function loadProjects() {
  const projects = await api('GET','/crm/projects');
  mc().innerHTML = \`
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Проекты</h1>
    <button onclick="showProjectModal()" class="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700"><i class="fas fa-plus mr-1"></i>Новый проект</button>
  </div>
  <div class="grid gap-3">
    \${projects.map(p => \`<div class="card p-5 cursor-pointer hover:border-brand-200" onclick="loadProjectDetail(\${p.id})">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-semibold text-gray-900">\${p.title}</div>
          <div class="text-sm text-gray-500 mt-0.5">\${p.client_name}\${p.room ? ' · ' + p.room : ''}</div>
        </div>
        <div class="flex items-center gap-3">
          \${p.total_amount > 0 ? '<span class="font-semibold">' + fmt(p.total_amount) + ' ₽</span>' : ''}
          <span class="status-badge status-\${p.status}">\${STATUS_LABELS[p.status]||p.status}</span>
        </div>
      </div>
    </div>\`).join('')}
  </div>
  \${!projects.length ? '<div class="text-center py-12 text-gray-400"><i class="fas fa-folder-open text-4xl mb-3"></i><p>Проектов пока нет</p></div>' : ''}\`;
}

async function showProjectModal() {
  const clients = await api('GET','/crm/clients');
  if(!clients.length) return alert('Сначала добавьте клиента');
  const opts = clients.map(c => '<option value="'+c.id+'">'+c.name+'</option>').join('');
  modal().innerHTML = \`
  <div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6">
      <h2 class="text-lg font-bold mb-4">Новый проект</h2>
      <div class="space-y-3">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Клиент *</label><select id="pClient" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm">\${opts}</select></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Название проекта *</label><input id="pTitle" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Шторы в гостиную"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Комната</label><input id="pRoom" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Гостиная"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Заметки</label><textarea id="pNotes" rows="2" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></textarea></div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="saveProject()" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Создать</button>
        <button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button>
      </div>
    </div>
  </div>\`;
}

async function saveProject() {
  try {
    const r = await api('POST','/crm/projects', { client_id: document.getElementById('pClient').value, title: document.getElementById('pTitle').value, room: document.getElementById('pRoom').value, notes: document.getElementById('pNotes').value });
    closeModal(); loadProjectDetail(r.id);
  } catch(e) { alert(e.message); }
}

async function loadProjectDetail(id) {
  mc().innerHTML = '<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-brand-500 text-2xl"></i></div>';
  const p = await api('GET','/crm/projects/'+id);
  const statusOpts = Object.entries(STATUS_LABELS).map(([k,v])=> '<option value="'+k+'"'+(p.status===k?' selected':'')+'>'+v+'</option>').join('');

  mc().innerHTML = \`
  <div class="mb-6">
    <button onclick="loadProjects()" class="text-sm text-brand-600 hover:underline mb-3 inline-block"><i class="fas fa-arrow-left mr-1"></i>Все проекты</button>
    <div class="flex items-center justify-between">
      <div><h1 class="text-2xl font-bold text-gray-900">\${p.title}</h1><p class="text-sm text-gray-500">\${p.client_name}\${p.room ? ' · ' + p.room : ''}</p></div>
      <div class="flex items-center gap-3">
        <select onchange="updateProjectStatus(\${p.id},this.value)" class="px-3 py-2 border border-gray-200 rounded-xl text-sm">\${statusOpts}</select>
        <button onclick="showContractModal(\${p.id})" class="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700"><i class="fas fa-file-contract mr-1"></i>Договор</button>
      </div>
    </div>
  </div>

  <div class="card p-6 mb-6">
    <div class="flex items-center justify-between mb-4">
      <h3 class="font-bold text-gray-900">Позиции проекта</h3>
      <div class="flex gap-2">
        <button onclick="showAddFabricItem(\${p.id})" class="px-3 py-1.5 bg-brand-50 text-brand-600 text-xs font-semibold rounded-lg hover:bg-brand-100"><i class="fas fa-scroll mr-1"></i>Ткань из прайса</button>
        <button onclick="showAddServiceItem(\${p.id})" class="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200"><i class="fas fa-plus mr-1"></i>Услуга</button>
      </div>
    </div>
    \${p.items.length ? \`
    <table class="w-full text-sm">
      <thead><tr class="border-b border-gray-200"><th class="text-left py-2 text-gray-600">Наименование</th><th class="text-right py-2 text-gray-600">Кол-во</th><th class="text-right py-2 text-gray-600">Цена</th><th class="text-right py-2 text-gray-600">Сумма</th><th></th></tr></thead>
      <tbody>\${p.items.map(it => \`<tr class="border-b border-gray-100">
        <td class="py-2.5">\${it.description}\${it.fabric_name ? '<br><span class="text-xs text-gray-400">'+it.fabric_name+(it.fabric_article?' ('+it.fabric_article+')':'')+' </span>' : ''}</td>
        <td class="text-right py-2.5">\${it.quantity} \${it.unit}</td>
        <td class="text-right py-2.5">\${fmt(it.price)} ₽</td>
        <td class="text-right py-2.5 font-semibold">\${fmt(it.amount)} ₽</td>
        <td class="py-2.5 text-right"><button onclick="deleteItem(\${p.id},\${it.id})" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button></td>
      </tr>\`).join('')}</tbody>
    </table>
    <div class="text-right mt-3 text-lg font-bold text-gray-900">Итого: \${fmt(p.total_amount)} ₽</div>\`
    : '<p class="text-gray-400 text-sm text-center py-8">Добавьте ткани или услуги в проект</p>'}
  </div>
  \${p.notes ? '<div class="card p-5"><div class="text-sm text-gray-500"><i class="fas fa-sticky-note mr-1"></i>' + p.notes + '</div></div>' : ''}\`;
}

async function updateProjectStatus(id, status) {
  const p = await api('GET','/crm/projects/'+id);
  await api('PUT','/crm/projects/'+id, { title:p.title, room:p.room, status, notes:p.notes });
}

async function showAddFabricItem(projectId) {
  const fabrics = await api('GET','/crm/fabrics');
  const opts = fabrics.map(f => '<option value="'+f.id+'" data-price="'+f.price_per_meter+'">'+f.name+' ('+f.article+') — '+fmt(f.price_per_meter)+' ₽/м</option>').join('');
  modal().innerHTML = \`
  <div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6">
      <h2 class="text-lg font-bold mb-4">Добавить ткань из прайса</h2>
      <div class="space-y-3">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Ткань *</label><select id="itFabric" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" onchange="document.getElementById('itPrice').value=this.selectedOptions[0]?.dataset.price||0">\${opts}</select></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Описание</label><input id="itDesc" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Портьеры в гостиную"></div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Кол-во</label><input id="itQty" type="number" step="0.1" value="1" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Ед.</label><input id="itUnit" value="м" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Цена</label><input id="itPrice" type="number" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" value="\${fabrics[0]?.price_per_meter||0}"></div>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="saveItem(\${projectId},true)" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Добавить</button>
        <button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button>
      </div>
    </div>
  </div>\`;
}

function showAddServiceItem(projectId) {
  modal().innerHTML = \`
  <div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6">
      <h2 class="text-lg font-bold mb-4">Добавить услугу</h2>
      <div class="space-y-3">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Описание *</label><input id="itDesc" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Пошив портьер"></div>
        <div class="grid grid-cols-3 gap-3">
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Кол-во</label><input id="itQty" type="number" step="0.1" value="1" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Ед.</label><input id="itUnit" value="шт" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
          <div><label class="block text-sm font-medium text-gray-700 mb-1">Цена</label><input id="itPrice" type="number" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" value="0"></div>
        </div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="saveItem(\${projectId},false)" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Добавить</button>
        <button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button>
      </div>
    </div>
  </div>\`;
}

async function saveItem(projectId, isFabric) {
  const data = {
    fabric_id: isFabric ? document.getElementById('itFabric')?.value : null,
    description: document.getElementById('itDesc').value || (isFabric ? document.getElementById('itFabric')?.selectedOptions[0]?.text?.split(' —')[0] : ''),
    quantity: parseFloat(document.getElementById('itQty').value)||1,
    unit: document.getElementById('itUnit').value||'м',
    price: parseFloat(document.getElementById('itPrice').value)||0
  };
  if(!data.description) return alert('Укажите описание');
  try { await api('POST','/crm/projects/'+projectId+'/items', data); closeModal(); loadProjectDetail(projectId); } catch(e) { alert(e.message); }
}

async function deleteItem(pid, iid) {
  if(!confirm('Удалить позицию?')) return;
  await api('DELETE','/crm/projects/'+pid+'/items/'+iid);
  loadProjectDetail(pid);
}

// ============ CONTRACTS ============
async function loadContracts() {
  const items = await api('GET','/crm/contracts');
  const cStatus = {draft:'Черновик',signed:'Подписан',completed:'Завершён',cancelled:'Отменён'};
  mc().innerHTML = \`
  <div class="flex items-center justify-between mb-6">
    <h1 class="text-2xl font-bold text-gray-900">Договоры</h1>
  </div>
  <div class="grid gap-3">
    \${items.map(ct => \`<div class="card p-5">
      <div class="flex items-center justify-between">
        <div>
          <div class="font-semibold text-gray-900">Договор \${ct.contract_number}</div>
          <div class="text-sm text-gray-500">\${ct.client_name} · \${ct.project_title} · \${ct.contract_date}</div>
        </div>
        <div class="flex items-center gap-3">
          <span class="font-semibold">\${fmt(ct.total_amount)} ₽</span>
          <span class="status-badge status-\${ct.status === 'signed' ? 'completed' : ct.status === 'draft' ? 'measuring' : 'cancelled'}">\${cStatus[ct.status]||ct.status}</span>
          <a href="/api/crm/contracts/\${ct.id}/html" target="_blank" class="px-3 py-1 bg-gray-100 rounded-lg text-xs font-semibold hover:bg-gray-200"><i class="fas fa-print mr-1"></i>Печать</a>
          \${ct.status === 'draft' ? '<button onclick="signContract('+ct.id+')" class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200">Подписать</button>' : ''}
        </div>
      </div>
    </div>\`).join('')}
  </div>
  \${!items.length ? '<div class="text-center py-12 text-gray-400"><i class="fas fa-file-contract text-4xl mb-3"></i><p>Договоров пока нет. Создайте из карточки проекта.</p></div>' : ''}\`;
}

async function signContract(id) {
  if(!confirm('Подписать договор?')) return;
  await api('PUT','/crm/contracts/'+id+'/sign');
  loadContracts();
}

async function showContractModal(projectId) {
  const p = await api('GET','/crm/projects/'+projectId);
  if(!p.items.length) return alert('Сначала добавьте позиции в проект');
  modal().innerHTML = \`
  <div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()">
    <div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-auto">
      <h2 class="text-lg font-bold mb-4">Создать договор</h2>
      <p class="text-sm text-gray-500 mb-4">Проект: \${p.title} · Итого: \${fmt(p.total_amount)} ₽</p>
      <div class="space-y-3">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">ФИО заказчика *</label><input id="ctName" value="\${p.client_name}" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Телефон заказчика</label><input id="ctPhone" value="\${p.client_phone||''}" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Адрес заказчика</label><input id="ctAddr" value="\${p.client_address||''}" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Паспортные данные</label><input id="ctPassport" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Серия и номер паспорта"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Предоплата, ₽</label><input id="ctPrepay" type="number" value="\${Math.round(p.total_amount*0.5)}" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">Примечания</label><textarea id="ctNotes" rows="2" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></textarea></div>
      </div>
      <div class="flex gap-3 mt-5">
        <button onclick="createContract(\${projectId})" class="flex-1 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl hover:bg-emerald-700">Создать договор</button>
        <button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button>
      </div>
    </div>
  </div>\`;
}

async function createContract(projectId) {
  try {
    const r = await api('POST','/crm/contracts', {
      project_id: projectId,
      client_name: document.getElementById('ctName').value,
      client_phone: document.getElementById('ctPhone').value,
      client_address: document.getElementById('ctAddr').value,
      client_passport: document.getElementById('ctPassport').value,
      prepayment: parseFloat(document.getElementById('ctPrepay').value)||0,
      notes: document.getElementById('ctNotes').value
    });
    closeModal();
    alert('Договор ' + r.contract_number + ' создан!');
    window.open('/api/crm/contracts/' + r.id + '/html', '_blank');
    navigate('contracts');
  } catch(e) { alert(e.message); }
}

// ============ INIT ============
render();
</script>
</body>
</html>`
