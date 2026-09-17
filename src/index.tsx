import { Hono } from 'hono'
import { cors } from 'hono/cors'

type Bindings = { DB: D1Database }
type Variables = { userId: number; userName: string }

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()
app.use('/api/*', cors())

// ============ AUTH HELPER ============
async function authFromToken(db: D1Database, token: string | undefined | null) {
  if (!token) return null
  try {
    const [id, email] = atob(token).split(':')
    return await db.prepare('SELECT id, name FROM users WHERE id = ? AND email = ?').bind(id, email).first()
  } catch { return null }
}

// ============ AUTH MIDDLEWARE ============
app.use('/api/crm/*', async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')
  const user = await authFromToken(c.env.DB, token)
  if (!user) return c.json({ error: 'Unauthorized' }, 401)
  c.set('userId', user.id as number)
  c.set('userName', user.name as string)
  await next()
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

// ============ OWNER SETTINGS ============
app.get('/api/crm/settings', async (c) => {
  const uid = c.get('userId')
  const s = await c.env.DB.prepare('SELECT * FROM owner_settings WHERE user_id=?').bind(uid).first()
  return c.json(s || {})
})

app.post('/api/crm/settings', async (c) => {
  const uid = c.get('userId')
  const d = await c.req.json()
  const existing = await c.env.DB.prepare('SELECT id FROM owner_settings WHERE user_id=?').bind(uid).first()
  if (existing) {
    await c.env.DB.prepare(`UPDATE owner_settings SET company_name=?,owner_name=?,owner_name_short=?,ogrn=?,inn=?,kpp=?,
      legal_address=?,actual_address=?,phone=?,phone2=?,bank_name=?,bank_bik=?,bank_account=?,bank_corr_account=? WHERE user_id=?`)
      .bind(d.company_name||'',d.owner_name||'',d.owner_name_short||'',d.ogrn||'',d.inn||'',d.kpp||'',
        d.legal_address||'',d.actual_address||'',d.phone||'',d.phone2||'',d.bank_name||'',d.bank_bik||'',
        d.bank_account||'',d.bank_corr_account||'',uid).run()
  } else {
    await c.env.DB.prepare(`INSERT INTO owner_settings (user_id,company_name,owner_name,owner_name_short,ogrn,inn,kpp,
      legal_address,actual_address,phone,phone2,bank_name,bank_bik,bank_account,bank_corr_account)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(uid,d.company_name||'',d.owner_name||'',d.owner_name_short||'',d.ogrn||'',d.inn||'',d.kpp||'',
        d.legal_address||'',d.actual_address||'',d.phone||'',d.phone2||'',d.bank_name||'',d.bank_bik||'',
        d.bank_account||'',d.bank_corr_account||'').run()
  }
  return c.json({ success: true })
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
  return c.json({ clients: clients?.cnt||0, projects: projects?.cnt||0, activeProjects: active?.cnt||0,
    revenue: revenue?.total||0, contracts: contracts?.cnt||0, recentProjects: recentProjects.results })
})

// ============ CLIENTS CRUD (with types) ============
app.get('/api/crm/clients', async (c) => {
  const uid = c.get('userId'); const q = c.req.query('q') || ''
  let sql = 'SELECT * FROM clients WHERE user_id = ?'; const params: any[] = [uid]
  if (q) { sql += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ? OR company_name LIKE ?)'; params.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`) }
  sql += ' ORDER BY created_at DESC'
  return c.json((await c.env.DB.prepare(sql).bind(...params).all()).results)
})

app.get('/api/crm/clients/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  const cl = await c.env.DB.prepare('SELECT * FROM clients WHERE id=? AND user_id=?').bind(id, uid).first()
  return cl ? c.json(cl) : c.json({ error: 'Not found' }, 404)
})

app.post('/api/crm/clients', async (c) => {
  const uid = c.get('userId'); const d = await c.req.json()
  if (!d.name) return c.json({ error: 'Имя обязательно' }, 400)
  const r = await c.env.DB.prepare(
    `INSERT INTO clients (user_id,name,phone,email,address,notes,client_type,
     passport_series,passport_number,passport_date,passport_issued,passport_code,
     company_name,inn,kpp,ogrn,legal_address,contact_person,
     bank_name,bank_bik,bank_account,bank_corr_account) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(uid,d.name,d.phone||'',d.email||'',d.address||'',d.notes||'',d.client_type||'person',
    d.passport_series||'',d.passport_number||'',d.passport_date||'',d.passport_issued||'',d.passport_code||'',
    d.company_name||'',d.inn||'',d.kpp||'',d.ogrn||'',d.legal_address||'',d.contact_person||'',
    d.bank_name||'',d.bank_bik||'',d.bank_account||'',d.bank_corr_account||'').run()
  return c.json({ id: r.meta.last_row_id })
})

app.put('/api/crm/clients/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id'); const d = await c.req.json()
  await c.env.DB.prepare(
    `UPDATE clients SET name=?,phone=?,email=?,address=?,notes=?,client_type=?,
     passport_series=?,passport_number=?,passport_date=?,passport_issued=?,passport_code=?,
     company_name=?,inn=?,kpp=?,ogrn=?,legal_address=?,contact_person=?,
     bank_name=?,bank_bik=?,bank_account=?,bank_corr_account=? WHERE id=? AND user_id=?`
  ).bind(d.name,d.phone||'',d.email||'',d.address||'',d.notes||'',d.client_type||'person',
    d.passport_series||'',d.passport_number||'',d.passport_date||'',d.passport_issued||'',d.passport_code||'',
    d.company_name||'',d.inn||'',d.kpp||'',d.ogrn||'',d.legal_address||'',d.contact_person||'',
    d.bank_name||'',d.bank_bik||'',d.bank_account||'',d.bank_corr_account||'',id,uid).run()
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
  return c.json((await c.env.DB.prepare('SELECT * FROM suppliers WHERE user_id=? ORDER BY name').bind(uid).all()).results)
})
app.post('/api/crm/suppliers', async (c) => {
  const uid = c.get('userId'); const d = await c.req.json()
  if (!d.name) return c.json({ error: 'Название обязательно' }, 400)
  const r = await c.env.DB.prepare('INSERT INTO suppliers (user_id,name,contact,phone,website) VALUES (?,?,?,?,?)')
    .bind(uid,d.name,d.contact||'',d.phone||'',d.website||'').run()
  return c.json({ id: r.meta.last_row_id })
})
app.delete('/api/crm/suppliers/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM suppliers WHERE id=? AND user_id=?').bind(c.req.param('id'),c.get('userId')).run()
  return c.json({ success: true })
})

// ============ FABRICS CRUD ============
app.get('/api/crm/fabrics', async (c) => {
  const uid = c.get('userId'); const q = c.req.query('q')||''; const sid = c.req.query('supplier_id')
  let sql = 'SELECT f.*,s.name as supplier_name FROM fabrics f LEFT JOIN suppliers s ON f.supplier_id=s.id WHERE f.user_id=?'
  const p: any[] = [uid]
  if (sid) { sql += ' AND f.supplier_id=?'; p.push(sid) }
  if (q) { sql += ' AND (f.name LIKE ? OR f.article LIKE ?)'; p.push(`%${q}%`,`%${q}%`) }
  return c.json((await c.env.DB.prepare(sql+' ORDER BY f.name').bind(...p).all()).results)
})
app.post('/api/crm/fabrics', async (c) => {
  const uid = c.get('userId'); const d = await c.req.json()
  if (!d.name||!d.price_per_meter) return c.json({ error: 'Название и цена обязательны' }, 400)
  const r = await c.env.DB.prepare('INSERT INTO fabrics (user_id,supplier_id,name,article,composition,width_cm,price_per_meter,notes) VALUES (?,?,?,?,?,?,?,?)')
    .bind(uid,d.supplier_id||null,d.name,d.article||'',d.composition||'',d.width_cm||0,d.price_per_meter,d.notes||'').run()
  return c.json({ id: r.meta.last_row_id })
})
app.delete('/api/crm/fabrics/:id', async (c) => {
  await c.env.DB.prepare('DELETE FROM fabrics WHERE id=? AND user_id=?').bind(c.req.param('id'),c.get('userId')).run()
  return c.json({ success: true })
})
app.post('/api/crm/fabrics/import', async (c) => {
  const uid = c.get('userId'); const { fabrics: items, supplier_id } = await c.req.json()
  if (!items?.length) return c.json({ error: 'Нет данных' }, 400)
  let imported = 0
  for (const f of items) {
    await c.env.DB.prepare('INSERT INTO fabrics (user_id,supplier_id,name,article,composition,width_cm,price_per_meter,notes) VALUES (?,?,?,?,?,?,?,?)')
      .bind(uid,supplier_id||null,f.name,f.article||'',f.composition||'',f.width_cm||0,f.price_per_meter||0,f.notes||'').run()
    imported++
  }
  return c.json({ imported })
})

// ============ PROJECTS CRUD ============
app.get('/api/crm/projects', async (c) => {
  const uid = c.get('userId'); const st = c.req.query('status')
  let sql = 'SELECT p.*,c.name as client_name FROM projects p JOIN clients c ON p.client_id=c.id WHERE p.user_id=?'
  const p: any[] = [uid]; if (st) { sql += ' AND p.status=?'; p.push(st) }
  return c.json((await c.env.DB.prepare(sql+' ORDER BY p.updated_at DESC').bind(...p).all()).results)
})
app.get('/api/crm/projects/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  const project = await c.env.DB.prepare(
    'SELECT p.*,c.name as client_name,c.phone as client_phone,c.email as client_email,c.address as client_address,c.client_type FROM projects p JOIN clients c ON p.client_id=c.id WHERE p.id=? AND p.user_id=?'
  ).bind(id,uid).first()
  if (!project) return c.json({ error: 'Not found' }, 404)
  const items = await c.env.DB.prepare(
    'SELECT pi.*,f.name as fabric_name,f.article as fabric_article FROM project_items pi LEFT JOIN fabrics f ON pi.fabric_id=f.id WHERE pi.project_id=? ORDER BY pi.id'
  ).bind(id).all()
  return c.json({ ...project, items: items.results })
})
app.post('/api/crm/projects', async (c) => {
  const uid = c.get('userId'); const d = await c.req.json()
  if (!d.client_id||!d.title) return c.json({ error: 'Клиент и название обязательны' }, 400)
  const r = await c.env.DB.prepare('INSERT INTO projects (user_id,client_id,title,room,notes) VALUES (?,?,?,?,?)')
    .bind(uid,d.client_id,d.title,d.room||'',d.notes||'').run()
  return c.json({ id: r.meta.last_row_id })
})
app.put('/api/crm/projects/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id'); const d = await c.req.json()
  await c.env.DB.prepare('UPDATE projects SET title=?,room=?,status=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=?')
    .bind(d.title,d.room||'',d.status||'new',d.notes||'',id,uid).run()
  return c.json({ success: true })
})
app.delete('/api/crm/projects/:id', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM project_items WHERE project_id=?').bind(id).run()
  await c.env.DB.prepare('DELETE FROM projects WHERE id=? AND user_id=?').bind(id,uid).run()
  return c.json({ success: true })
})

// ============ PROJECT ITEMS ============
app.post('/api/crm/projects/:id/items', async (c) => {
  const id = c.req.param('id'); const d = await c.req.json()
  const amount = (d.quantity||1)*(d.price||0)
  await c.env.DB.prepare('INSERT INTO project_items (project_id,fabric_id,description,quantity,unit,price,amount) VALUES (?,?,?,?,?,?,?)')
    .bind(id,d.fabric_id||null,d.description,d.quantity||1,d.unit||'м',d.price||0,amount).run()
  const total = await c.env.DB.prepare('SELECT COALESCE(SUM(amount),0) as t FROM project_items WHERE project_id=?').bind(id).first()
  await c.env.DB.prepare('UPDATE projects SET total_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(total?.t||0,id).run()
  return c.json({ success: true, total: total?.t||0 })
})
app.delete('/api/crm/projects/:pid/items/:iid', async (c) => {
  const pid = c.req.param('pid')
  await c.env.DB.prepare('DELETE FROM project_items WHERE id=? AND project_id=?').bind(c.req.param('iid'),pid).run()
  const total = await c.env.DB.prepare('SELECT COALESCE(SUM(amount),0) as t FROM project_items WHERE project_id=?').bind(pid).first()
  await c.env.DB.prepare('UPDATE projects SET total_amount=?,updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(total?.t||0,pid).run()
  return c.json({ success: true, total: total?.t||0 })
})

// ============ CONTRACTS CRUD ============
app.get('/api/crm/contracts', async (c) => {
  const uid = c.get('userId')
  return c.json((await c.env.DB.prepare(
    'SELECT ct.*,c.name as client_name,p.title as project_title FROM contracts ct JOIN clients c ON ct.client_id=c.id JOIN projects p ON ct.project_id=p.id WHERE ct.user_id=? ORDER BY ct.created_at DESC'
  ).bind(uid).all()).results)
})

app.post('/api/crm/contracts', async (c) => {
  const uid = c.get('userId'); const data = await c.req.json()
  if (!data.project_id) return c.json({ error: 'Укажите проект' }, 400)
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id=? AND user_id=?').bind(data.project_id,uid).first()
  if (!project) return c.json({ error: 'Проект не найден' }, 404)
  const client = await c.env.DB.prepare('SELECT * FROM clients WHERE id=?').bind(project.client_id).first()
  const owner = await c.env.DB.prepare('SELECT * FROM owner_settings WHERE user_id=?').bind(uid).first()
  const now = new Date()
  const num = `Д-${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${data.project_id}`
  const dt = now.toISOString().split('T')[0]
  const r = await c.env.DB.prepare(
    `INSERT INTO contracts (project_id,client_id,user_id,contract_number,contract_date,total_amount,prepayment,
     client_name,client_phone,client_address,client_passport,executor_name,executor_company,executor_phone,notes,status)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(data.project_id,project.client_id,uid,num,dt,project.total_amount,data.prepayment||0,
    client?.name||'',client?.phone||'',client?.address||'',data.client_passport||'',
    owner?.owner_name||'',owner?.company_name||'',owner?.phone||'',data.notes||'','draft').run()
  return c.json({ id: r.meta.last_row_id, contract_number: num })
})

app.put('/api/crm/contracts/:id/sign', async (c) => {
  await c.env.DB.prepare("UPDATE contracts SET status='signed' WHERE id=? AND user_id=?").bind(c.req.param('id'),c.get('userId')).run()
  return c.json({ success: true })
})

// ============ CONTRACT HTML (real DÉCOR BONJOUR template) ============
app.get('/api/crm/contracts/:id/html', async (c) => {
  const uid = c.get('userId'); const id = c.req.param('id')
  const ct = await c.env.DB.prepare('SELECT * FROM contracts WHERE id=? AND user_id=?').bind(id,uid).first()
  if (!ct) return c.text('Not found', 404)
  const client = await c.env.DB.prepare('SELECT * FROM clients WHERE id=?').bind(ct.client_id).first()
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(ct.project_id).first()
  const owner = await c.env.DB.prepare('SELECT * FROM owner_settings WHERE user_id=?').bind(uid).first()
  const items = await c.env.DB.prepare('SELECT pi.*,f.name as fn FROM project_items pi LEFT JOIN fabrics f ON pi.fabric_id=f.id WHERE pi.project_id=?').bind(ct.project_id).all()

  const isCompany = client?.client_type === 'company' || client?.client_type === 'ip'
  const fmt = (n:any) => Number(n||0).toLocaleString('ru-RU')
  const clientLine = isCompany
    ? `${client?.company_name||client?.name}, в лице ${client?.contact_person||client?.name}`
    : `${client?.name}`
  const dt = ct.contract_date as string
  const prepay = Number(ct.prepayment||0)
  const total = Number(ct.total_amount||0)

  let rows = ''
  items.results.forEach((it:any, i:number) => {
    rows += `<tr><td style="text-align:center">${i+1}</td><td>${it.description}${it.fn?' ('+it.fn+')':''}</td><td style="text-align:center">${it.quantity} ${it.unit}</td><td style="text-align:right">${fmt(it.price)} ₽</td><td style="text-align:right">${fmt(it.amount)} ₽</td></tr>`
  })

  return c.html(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Договор ${ct.contract_number}</title>
<style>
body{font-family:Georgia,'Times New Roman',serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333;font-size:13px;line-height:1.6}
h1{text-align:center;font-size:18px;margin-bottom:5px}
.center{text-align:center}.meta{text-align:center;color:#666;margin-bottom:20px}
p{margin:6px 0;text-indent:30px}.no-indent{text-indent:0}
h3{font-size:14px;margin:20px 0 10px;text-align:center}
table.spec{width:100%;border-collapse:collapse;margin:15px 0;font-size:12px}
table.spec th,table.spec td{border:1px solid #999;padding:6px 8px}
table.spec th{background:#f0f0f0}
.total-line{text-align:right;font-size:14px;font-weight:bold;margin:10px 0 20px}
.signatures{display:flex;justify-content:space-between;margin-top:50px;page-break-inside:avoid}
.sig-block{width:45%}.sig-block h4{margin-bottom:15px}
.sig-line{border-bottom:1px solid #333;margin:30px 0 5px;display:flex;justify-content:space-between}
.print-btn{position:fixed;top:15px;right:15px;padding:10px 20px;background:#4263eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;z-index:100}
@media print{.print-btn{display:none!important}body{margin:10mm}}
</style></head><body>
<button class="print-btn" onclick="window.print()">Печать / PDF</button>
<h1>ДОГОВОР № ${ct.contract_number}</h1>
<p class="center no-indent">г. Ростов-на-Дону&emsp;&emsp;&emsp;&emsp;${dt} г.</p>
<p>Индивидуальный Предприниматель ${owner?.owner_name||'Шалыга Виктор Дмитриевич'}, ${owner?.company_name||'«DÉCOR BONJOUR»'}, именуемое в дальнейшем Исполнитель, в лице ${owner?.owner_name_short||'Шалыга В. Д.'}, действующий на основании ОГРН ${owner?.ogrn||'304616235700206'}, с одной стороны, и</p>
<p><strong>${clientLine}</strong>,</p>
<p>именуемый(-ая) в дальнейшем Заказчик, с другой стороны, заключили настоящий договор о нижеследующем:</p>

<h3>1. ПРЕДМЕТ ДОГОВОРА</h3>
<p>1.1. Исполнитель обязуется изготовить и передать продукцию (именуемую в дальнейшем «изделие» или «результат работ»), а также выполнить другие работы, предусмотренные в Спецификации, составленной сторонами и являющейся неотъемлемой частью настоящего договора, а Заказчик обязуется принять продукцию и оплатить ее на условиях, настоящим договором установленных.</p>
<p>1.2. Работы выполняются из материалов Исполнителя, заказанных по каталогам и образцам исключительно для нужд Заказчика.</p>
<p>1.3. Выполнение всего комплекса работ производится в течение 4 (четырёх) недель с момента внесения предоплаты.</p>
<p>1.4. Гарантийный срок — 6 месяцев с момента подписания Акта приёмки-сдачи работ.</p>

<h3>СПЕЦИФИКАЦИЯ</h3>
<table class="spec"><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table>
<p class="total-line">ИТОГО: ${fmt(total)} ₽</p>

<h3>3. СТОИМОСТЬ И ОПЛАТА</h3>
<p>3.1. Стоимость всего комплекса работ составляет <strong>${fmt(total)} ₽</strong>, НДС не облагается.</p>
<p>3.2. Предварительная оплата — 60%: <strong>${fmt(Math.round(total*0.6))} ₽</strong>.</p>
<p>3.3. Остаток — 40%: <strong>${fmt(Math.round(total*0.4))} ₽</strong> — в течение 3 дней с момента уведомления о готовности изделия.</p>
${ct.notes ? `<p><em>Примечание: ${ct.notes}</em></p>` : ''}

<h3>8. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН</h3>
<div class="signatures">
  <div class="sig-block">
    <h4>Исполнитель:</h4>
    <p class="no-indent">${owner?.company_name||''}</p>
    <p class="no-indent">Юр. адрес: ${owner?.legal_address||''}</p>
    <p class="no-indent">Факт. адрес: ${owner?.actual_address||''}</p>
    <p class="no-indent">ИНН ${owner?.inn||''} КПП ${owner?.kpp||''}</p>
    <p class="no-indent">Р/с ${owner?.bank_account||''}</p>
    <p class="no-indent">${owner?.bank_name||''}</p>
    <p class="no-indent">К/с ${owner?.bank_corr_account||''} БИК ${owner?.bank_bik||''}</p>
    <p class="no-indent">Тел. ${owner?.phone||''}</p>
    <div class="sig-line"></div>
    <p class="no-indent">/ ${owner?.owner_name_short||''} /</p>
  </div>
  <div class="sig-block">
    <h4>Заказчик:</h4>
    ${isCompany ? `
    <p class="no-indent">${client?.company_name||''}</p>
    <p class="no-indent">ИНН ${client?.inn||''} ${client?.kpp?'КПП '+client.kpp:''}</p>
    <p class="no-indent">Юр. адрес: ${client?.legal_address||''}</p>
    <p class="no-indent">${client?.bank_name||''}</p>
    <p class="no-indent">Р/с ${client?.bank_account||''}</p>
    <p class="no-indent">К/с ${client?.bank_corr_account||''} БИК ${client?.bank_bik||''}</p>
    <p class="no-indent">Тел. ${client?.phone||''}</p>
    ` : `
    <p class="no-indent">ФИО: ${client?.name||''}</p>
    <p class="no-indent">Паспорт: ${client?.passport_series||''} ${client?.passport_number||''}</p>
    <p class="no-indent">Дата выдачи: ${client?.passport_date||''}</p>
    <p class="no-indent">Кем выдан: ${client?.passport_issued||''}</p>
    <p class="no-indent">Код подразделения: ${client?.passport_code||''}</p>
    <p class="no-indent">Тел. ${client?.phone||''}</p>
    `}
    <div class="sig-line"></div>
    <p class="no-indent">/ ${isCompany?(client?.contact_person||''):client?.name||''} /</p>
  </div>
</div>
</body></html>`)
})

// ============ INVOICE HTML ============
app.get('/api/crm/invoices/:pid/html', async (c) => {
  const uid = c.get('userId'); const pid = c.req.param('pid')
  const project = await c.env.DB.prepare('SELECT p.*,c.* FROM projects p JOIN clients c ON p.client_id=c.id WHERE p.id=? AND p.user_id=?').bind(pid,uid).first()
  if (!project) return c.text('Not found', 404)
  const owner = await c.env.DB.prepare('SELECT * FROM owner_settings WHERE user_id=?').bind(uid).first()
  const items = await c.env.DB.prepare('SELECT pi.*,f.name as fn FROM project_items pi LEFT JOIN fabrics f ON pi.fabric_id=f.id WHERE pi.project_id=?').bind(pid).all()

  const fmt = (n:any) => Number(n||0).toLocaleString('ru-RU')
  const total = Number(project.total_amount||0)
  const now = new Date()
  const invNum = `С-${pid}-${now.getFullYear()}`
  const invDate = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`

  let rows = ''
  items.results.forEach((it:any,i:number) => {
    rows += `<tr><td style="text-align:center">${i+1}</td><td>${it.description}${it.fn?' ('+it.fn+')':''}</td><td style="text-align:center">${it.unit}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">${fmt(it.price)}</td><td style="text-align:right">${fmt(it.amount)}</td></tr>`
  })

  const isCompany = project.client_type === 'company' || project.client_type === 'ip'

  return c.html(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Счёт ${invNum}</title>
<style>
body{font-family:Arial,sans-serif;max-width:800px;margin:30px auto;padding:0 20px;color:#333;font-size:12px;line-height:1.5}
.bank-table{width:100%;border-collapse:collapse;margin-bottom:20px}
.bank-table td{border:1px solid #000;padding:4px 8px;font-size:11px}
h2{text-align:center;font-size:16px;margin:20px 0 5px}
.invoice-meta{text-align:center;margin-bottom:20px;font-size:12px}
table.items{width:100%;border-collapse:collapse;margin:15px 0}
table.items th,table.items td{border:1px solid #000;padding:5px 8px;font-size:11px}
table.items th{background:#f5f5f5}
.total-line{text-align:right;font-size:13px;font-weight:bold;margin:10px 0}
.warn{font-size:10px;color:#666;margin-top:30px;border-top:1px solid #ccc;padding-top:10px}
.signatures{display:flex;justify-content:space-between;margin-top:40px}
.sig-block{width:45%}
.print-btn{position:fixed;top:15px;right:15px;padding:10px 20px;background:#4263eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;z-index:100}
@media print{.print-btn{display:none!important}body{margin:10mm}}
</style></head><body>
<button class="print-btn" onclick="window.print()">Печать / PDF</button>

<table class="bank-table">
<tr><td colspan="2">${owner?.bank_name||''}</td><td>БИК</td><td>${owner?.bank_bik||''}</td></tr>
<tr><td colspan="2">Банк получателя</td><td>Сч. №</td><td>${owner?.bank_corr_account||''}</td></tr>
<tr><td>ИНН ${owner?.inn||''}</td><td>КПП ${owner?.kpp||''}</td><td rowspan="2">Сч. №</td><td rowspan="2">${owner?.bank_account||''}</td></tr>
<tr><td colspan="2">${owner?.company_name||''}<br>Получатель</td></tr>
</table>

<h2>Счёт на оплату № ${invNum} от ${invDate}</h2>
<p>Поставщик: <strong>${owner?.company_name||''}</strong>, ИНН ${owner?.inn||''}, ${owner?.actual_address||owner?.legal_address||''}, тел. ${owner?.phone||''}</p>
<p>Покупатель: <strong>${isCompany?(project.company_name||project.name):project.name}</strong>${isCompany?', ИНН '+(project.inn||''):''}, ${project.address||''}, тел. ${project.phone||''}</p>

<table class="items">
<thead><tr><th>№</th><th>Товар / услуга</th><th>Ед.</th><th>Кол-во</th><th>Цена, ₽</th><th>Сумма, ₽</th></tr></thead>
<tbody>${rows}</tbody>
</table>
<p class="total-line">Итого: ${fmt(total)} ₽</p>
<p class="total-line">В том числе НДС: не облагается</p>
<p class="total-line">Всего к оплате: ${fmt(total)} ₽</p>

<div class="signatures">
  <div class="sig-block">
    <p>Руководитель ______________ / ${owner?.owner_name_short||''} /</p>
  </div>
  <div class="sig-block">
    <p>Бухгалтер ______________ / ${owner?.owner_name_short||''} /</p>
  </div>
</div>

<p class="warn">Внимание! Оплата данного счёта означает согласие с условиями поставки товара. Уведомление об оплате обязательно, в противном случае не гарантируется наличие товара на складе. Товар отпускается по факту прихода денег на р/с Поставщика.</p>
</body></html>`)
})

// ============ PUBLIC DOC ROUTES (token via URL param) ============
app.get('/doc/contract/:id', async (c) => {
  const token = c.req.query('token')
  const user = await authFromToken(c.env.DB, token)
  if (!user) return c.html('<h1>Ошибка авторизации. Войдите в CRM и попробуйте снова.</h1>')
  const uid = user.id as number; const id = c.req.param('id')
  const ct = await c.env.DB.prepare('SELECT * FROM contracts WHERE id=? AND user_id=?').bind(id,uid).first()
  if (!ct) return c.html('<h1>Договор не найден</h1>')
  const client = await c.env.DB.prepare('SELECT * FROM clients WHERE id=?').bind(ct.client_id).first()
  const project = await c.env.DB.prepare('SELECT * FROM projects WHERE id=?').bind(ct.project_id).first()
  const owner = await c.env.DB.prepare('SELECT * FROM owner_settings WHERE user_id=?').bind(uid).first()
  const items = await c.env.DB.prepare('SELECT pi.*,f.name as fn FROM project_items pi LEFT JOIN fabrics f ON pi.fabric_id=f.id WHERE pi.project_id=?').bind(ct.project_id).all()
  const isCompany = client?.client_type === 'company' || client?.client_type === 'ip'
  const fmt = (n:any) => Number(n||0).toLocaleString('ru-RU')
  const clientLine = isCompany ? `${client?.company_name||client?.name}, в лице ${client?.contact_person||client?.name}` : `${client?.name}`
  const total = Number(ct.total_amount||0)
  let rows = ''
  items.results.forEach((it:any, i:number) => {
    rows += `<tr><td style="text-align:center">${i+1}</td><td>${it.description}${it.fn?' ('+it.fn+')':''}</td><td style="text-align:center">${it.quantity} ${it.unit}</td><td style="text-align:right">${fmt(it.price)} ₽</td><td style="text-align:right">${fmt(it.amount)} ₽</td></tr>`
  })
  return c.html(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Договор ${ct.contract_number}</title>
<style>body{font-family:Georgia,'Times New Roman',serif;max-width:800px;margin:40px auto;padding:0 20px;color:#333;font-size:13px;line-height:1.6}h1{text-align:center;font-size:18px;margin-bottom:5px}.center{text-align:center}p{margin:6px 0;text-indent:30px}.no-indent{text-indent:0}h3{font-size:14px;margin:20px 0 10px;text-align:center}table.spec{width:100%;border-collapse:collapse;margin:15px 0;font-size:12px}table.spec th,table.spec td{border:1px solid #999;padding:6px 8px}table.spec th{background:#f0f0f0}.total-line{text-align:right;font-size:14px;font-weight:bold;margin:10px 0 20px}.signatures{display:flex;justify-content:space-between;margin-top:50px;page-break-inside:avoid}.sig-block{width:45%}.sig-line{border-bottom:1px solid #333;margin:30px 0 5px}.print-btn{position:fixed;top:15px;right:15px;padding:10px 20px;background:#4263eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;z-index:100}@media print{.print-btn{display:none!important}body{margin:10mm}}</style></head><body>
<button class="print-btn" onclick="window.print()">Печать / PDF</button>
<h1>ДОГОВОР № ${ct.contract_number}</h1>
<p class="center no-indent">г. Ростов-на-Дону&emsp;&emsp;&emsp;&emsp;${ct.contract_date} г.</p>
<p>Индивидуальный Предприниматель ${owner?.owner_name||''}, ${owner?.company_name||''}, именуемое в дальнейшем Исполнитель, в лице ${owner?.owner_name_short||''}, действующий на основании ОГРН ${owner?.ogrn||''}, с одной стороны, и</p>
<p><strong>${clientLine}</strong>,</p>
<p>именуемый(-ая) в дальнейшем Заказчик, с другой стороны, заключили настоящий договор о нижеследующем:</p>
<h3>1. ПРЕДМЕТ ДОГОВОРА</h3>
<p>1.1. Исполнитель обязуется изготовить и передать продукцию, а также выполнить другие работы, предусмотренные в Спецификации, составленной сторонами и являющейся неотъемлемой частью настоящего договора, а Заказчик обязуется принять продукцию и оплатить ее.</p>
<p>1.2. Работы выполняются из материалов Исполнителя, заказанных по каталогам и образцам исключительно для нужд Заказчика.</p>
<p>1.3. Выполнение всего комплекса работ производится в течение 4 (четырёх) недель с момента внесения предоплаты.</p>
<p>1.4. Гарантийный срок — 6 месяцев с момента подписания Акта приёмки-сдачи работ.</p>
<h3>СПЕЦИФИКАЦИЯ</h3>
<table class="spec"><thead><tr><th>№</th><th>Наименование</th><th>Кол-во</th><th>Цена</th><th>Сумма</th></tr></thead><tbody>${rows}</tbody></table>
<p class="total-line">ИТОГО: ${fmt(total)} ₽</p>
<h3>3. СТОИМОСТЬ И ОПЛАТА</h3>
<p>3.1. Стоимость всего комплекса работ составляет <strong>${fmt(total)} ₽</strong>, НДС не облагается.</p>
<p>3.2. Предварительная оплата — 60%: <strong>${fmt(Math.round(total*0.6))} ₽</strong>.</p>
<p>3.3. Остаток — 40%: <strong>${fmt(Math.round(total*0.4))} ₽</strong> — в течение 3 дней с момента уведомления о готовности.</p>
${ct.notes ? `<p><em>Примечание: ${ct.notes}</em></p>` : ''}
<h3>8. РЕКВИЗИТЫ И ПОДПИСИ СТОРОН</h3>
<div class="signatures"><div class="sig-block"><h4>Исполнитель:</h4><p class="no-indent">${owner?.company_name||''}</p><p class="no-indent">Юр. адрес: ${owner?.legal_address||''}</p><p class="no-indent">Факт. адрес: ${owner?.actual_address||''}</p><p class="no-indent">ИНН ${owner?.inn||''} КПП ${owner?.kpp||''}</p><p class="no-indent">Р/с ${owner?.bank_account||''}</p><p class="no-indent">${owner?.bank_name||''}</p><p class="no-indent">К/с ${owner?.bank_corr_account||''} БИК ${owner?.bank_bik||''}</p><p class="no-indent">Тел. ${owner?.phone||''}</p><div class="sig-line"></div><p class="no-indent">/ ${owner?.owner_name_short||''} /</p></div>
<div class="sig-block"><h4>Заказчик:</h4>${isCompany?`<p class="no-indent">${client?.company_name||''}</p><p class="no-indent">ИНН ${client?.inn||''} ${client?.kpp?'КПП '+client.kpp:''}</p><p class="no-indent">Юр. адрес: ${client?.legal_address||''}</p><p class="no-indent">${client?.bank_name||''}</p><p class="no-indent">Р/с ${client?.bank_account||''}</p><p class="no-indent">К/с ${client?.bank_corr_account||''} БИК ${client?.bank_bik||''}</p>`:`<p class="no-indent">ФИО: ${client?.name||''}</p><p class="no-indent">Паспорт: ${client?.passport_series||''} ${client?.passport_number||''}</p><p class="no-indent">Дата выдачи: ${client?.passport_date||''}</p><p class="no-indent">Кем выдан: ${client?.passport_issued||''}</p><p class="no-indent">Код подразделения: ${client?.passport_code||''}</p>`}<p class="no-indent">Тел. ${client?.phone||''}</p><div class="sig-line"></div><p class="no-indent">/ ${isCompany?(client?.contact_person||''):client?.name||''} /</p></div></div>
</body></html>`)
})

app.get('/doc/invoice/:pid', async (c) => {
  const token = c.req.query('token')
  const user = await authFromToken(c.env.DB, token)
  if (!user) return c.html('<h1>Ошибка авторизации</h1>')
  const uid = user.id as number; const pid = c.req.param('pid')
  const project = await c.env.DB.prepare('SELECT p.*,c.* FROM projects p JOIN clients c ON p.client_id=c.id WHERE p.id=? AND p.user_id=?').bind(pid,uid).first()
  if (!project) return c.html('<h1>Проект не найден</h1>')
  const owner = await c.env.DB.prepare('SELECT * FROM owner_settings WHERE user_id=?').bind(uid).first()
  const items = await c.env.DB.prepare('SELECT pi.*,f.name as fn FROM project_items pi LEFT JOIN fabrics f ON pi.fabric_id=f.id WHERE pi.project_id=?').bind(pid).all()
  const fmt = (n:any) => Number(n||0).toLocaleString('ru-RU')
  const total = Number(project.total_amount||0)
  const now = new Date()
  const invNum = `С-${pid}-${now.getFullYear()}`
  const invDate = `${String(now.getDate()).padStart(2,'0')}.${String(now.getMonth()+1).padStart(2,'0')}.${now.getFullYear()}`
  let rows = ''
  items.results.forEach((it:any,i:number) => {
    rows += `<tr><td style="text-align:center">${i+1}</td><td>${it.description}${it.fn?' ('+it.fn+')':''}</td><td style="text-align:center">${it.unit}</td><td style="text-align:center">${it.quantity}</td><td style="text-align:right">${fmt(it.price)}</td><td style="text-align:right">${fmt(it.amount)}</td></tr>`
  })
  const isCompany = project.client_type === 'company' || project.client_type === 'ip'
  return c.html(`<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<title>Счёт ${invNum}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:30px auto;padding:0 20px;color:#333;font-size:12px;line-height:1.5}.bank-table{width:100%;border-collapse:collapse;margin-bottom:20px}.bank-table td{border:1px solid #000;padding:4px 8px;font-size:11px}h2{text-align:center;font-size:16px;margin:20px 0 5px}table.items{width:100%;border-collapse:collapse;margin:15px 0}table.items th,table.items td{border:1px solid #000;padding:5px 8px;font-size:11px}table.items th{background:#f5f5f5}.total-line{text-align:right;font-size:13px;font-weight:bold;margin:10px 0}.warn{font-size:10px;color:#666;margin-top:30px;border-top:1px solid #ccc;padding-top:10px}.signatures{display:flex;justify-content:space-between;margin-top:40px}.print-btn{position:fixed;top:15px;right:15px;padding:10px 20px;background:#4263eb;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:13px;z-index:100}@media print{.print-btn{display:none!important}body{margin:10mm}}</style></head><body>
<button class="print-btn" onclick="window.print()">Печать / PDF</button>
<table class="bank-table"><tr><td colspan="2">${owner?.bank_name||''}</td><td>БИК</td><td>${owner?.bank_bik||''}</td></tr><tr><td colspan="2">Банк получателя</td><td>Сч. №</td><td>${owner?.bank_corr_account||''}</td></tr><tr><td>ИНН ${owner?.inn||''}</td><td>КПП ${owner?.kpp||''}</td><td rowspan="2">Сч. №</td><td rowspan="2">${owner?.bank_account||''}</td></tr><tr><td colspan="2">${owner?.company_name||''}<br>Получатель</td></tr></table>
<h2>Счёт на оплату № ${invNum} от ${invDate}</h2>
<p>Поставщик: <strong>${owner?.company_name||''}</strong>, ИНН ${owner?.inn||''}, ${owner?.actual_address||owner?.legal_address||''}, тел. ${owner?.phone||''}</p>
<p>Покупатель: <strong>${isCompany?(project.company_name||project.name):project.name}</strong>${isCompany?', ИНН '+(project.inn||''):''}, ${project.address||''}, тел. ${project.phone||''}</p>
<table class="items"><thead><tr><th>№</th><th>Товар / услуга</th><th>Ед.</th><th>Кол-во</th><th>Цена, ₽</th><th>Сумма, ₽</th></tr></thead><tbody>${rows}</tbody></table>
<p class="total-line">Итого: ${fmt(total)} ₽</p>
<p class="total-line">В том числе НДС: не облагается</p>
<p class="total-line">Всего к оплате: ${fmt(total)} ₽</p>
<div class="signatures"><div><p>Руководитель ______________ / ${owner?.owner_name_short||''} /</p></div><div><p>Бухгалтер ______________ / ${owner?.owner_name_short||''} /</p></div></div>
<p class="warn">Внимание! Оплата данного счёта означает согласие с условиями поставки товара. Уведомление об оплате обязательно.</p>
</body></html>`)
})

// ============ PAGES ============
app.get('/', (c) => c.html(LANDING_HTML))
app.get('/crm', (c) => c.html(CRM_HTML))
app.get('/crm/*', (c) => c.html(CRM_HTML))

export default app

// =====================================================
// LANDING PAGE HTML (simplified)
// =====================================================
const LANDING_HTML = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DÉCOR BONJOUR — CRM для салонов штор</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
<script>tailwind.config={theme:{extend:{fontFamily:{sans:['Inter','sans-serif']},colors:{brand:{50:'#f0f4ff',100:'#dbe4ff',200:'#bac8ff',500:'#5c7cfa',600:'#4c6ef5',700:'#4263eb',800:'#3b5bdb'}}}}}</script>
<style>*{scroll-behavior:smooth}body{font-family:'Inter',sans-serif}.hero-gradient{background:linear-gradient(135deg,#4263eb,#748ffc)}.fade-up{opacity:0;transform:translateY(30px);transition:all .7s ease}.fade-up.visible{opacity:1;transform:translateY(0)}.feature-card{transition:all .3s ease}.feature-card:hover{transform:translateY(-4px);box-shadow:0 16px 32px rgba(66,99,235,.12)}</style>
</head><body class="bg-white text-gray-800">
<header class="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-16">
    <a href="/" class="flex items-center gap-2"><div class="w-9 h-9 bg-brand-600 rounded-xl flex items-center justify-center"><i class="fas fa-scissors text-white text-sm"></i></div><span class="text-xl font-bold">DÉCOR <span class="text-brand-600">BONJOUR</span></span></a>
    <nav class="hidden md:flex items-center gap-8">
      <a href="#features" class="text-sm font-medium text-gray-600 hover:text-brand-600">Возможности</a>
      <a href="#pricing" class="text-sm font-medium text-gray-600 hover:text-brand-600">О нас</a>
    </nav>
    <div class="flex items-center gap-3">
      <a href="/crm" class="hidden md:inline-flex px-4 py-2 border border-brand-600 text-brand-600 text-sm font-semibold rounded-xl hover:bg-brand-50">Войти</a>
      <a href="/crm" class="px-5 py-2.5 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700 shadow-md">Начать работу</a>
    </div>
  </div>
</header>

<section class="hero-gradient relative pt-28 pb-20 md:pt-36 md:pb-28">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 text-center">
    <div class="inline-flex items-center gap-2 px-4 py-1.5 bg-white/15 rounded-full text-white/90 text-sm font-medium mb-6"><i class="fas fa-star text-yellow-300"></i>CRM для салонов штор</div>
    <h1 class="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6">DÉCOR BONJOUR<br><span class="text-white/80">Управление бизнесом</span></h1>
    <p class="text-lg text-white/75 max-w-2xl mx-auto mb-8">Клиенты, проекты, ткани, договоры и счета — всё в одном месте. Для физических лиц, ИП и юридических лиц.</p>
    <a href="/crm" class="px-8 py-4 bg-white text-brand-700 font-bold rounded-2xl hover:bg-brand-50 shadow-xl text-lg inline-flex items-center gap-2">Войти в CRM <i class="fas fa-arrow-right text-sm"></i></a>
  </div>
</section>

<section id="features" class="py-20 bg-white">
  <div class="max-w-7xl mx-auto px-4 sm:px-6">
    <div class="text-center mb-16 fade-up"><h2 class="text-3xl md:text-4xl font-extrabold text-gray-900 mb-4">Возможности системы</h2></div>
    <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div class="feature-card bg-gradient-to-br from-brand-50 to-white rounded-2xl p-7 border border-brand-100/50 fade-up"><div class="w-12 h-12 bg-brand-600 rounded-xl flex items-center justify-center mb-4"><i class="fas fa-users text-white"></i></div><h3 class="text-lg font-bold mb-2">Клиенты (Физ/ИП/ООО)</h3><p class="text-sm text-gray-500">База клиентов с паспортными данными, юр.реквизитами и банковскими данными</p></div>
      <div class="feature-card bg-gradient-to-br from-emerald-50 to-white rounded-2xl p-7 border border-emerald-100/50 fade-up"><div class="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center mb-4"><i class="fas fa-folder-open text-white"></i></div><h3 class="text-lg font-bold mb-2">Проекты</h3><p class="text-sm text-gray-500">Создание проектов с выбором тканей из прайсов, статусы от замера до монтажа</p></div>
      <div class="feature-card bg-gradient-to-br from-amber-50 to-white rounded-2xl p-7 border border-amber-100/50 fade-up"><div class="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mb-4"><i class="fas fa-scroll text-white"></i></div><h3 class="text-lg font-bold mb-2">Прайс-листы</h3><p class="text-sm text-gray-500">Загрузка прайсов поставщиков, артикулы, цены, импорт из CSV</p></div>
      <div class="feature-card bg-gradient-to-br from-purple-50 to-white rounded-2xl p-7 border border-purple-100/50 fade-up"><div class="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center mb-4"><i class="fas fa-file-contract text-white"></i></div><h3 class="text-lg font-bold mb-2">Договоры</h3><p class="text-sm text-gray-500">Автоматическое формирование по шаблону DÉCOR BONJOUR. Физ.лица и юр.лица</p></div>
      <div class="feature-card bg-gradient-to-br from-rose-50 to-white rounded-2xl p-7 border border-rose-100/50 fade-up"><div class="w-12 h-12 bg-rose-500 rounded-xl flex items-center justify-center mb-4"><i class="fas fa-file-invoice-dollar text-white"></i></div><h3 class="text-lg font-bold mb-2">Счета</h3><p class="text-sm text-gray-500">Формирование счетов на оплату с банковскими реквизитами для ИП и юрлиц</p></div>
      <div class="feature-card bg-gradient-to-br from-cyan-50 to-white rounded-2xl p-7 border border-cyan-100/50 fade-up"><div class="w-12 h-12 bg-cyan-600 rounded-xl flex items-center justify-center mb-4"><i class="fas fa-chart-pie text-white"></i></div><h3 class="text-lg font-bold mb-2">Дашборд</h3><p class="text-sm text-gray-500">Обзор всех проектов, клиентов, выручки и активных заказов</p></div>
    </div>
  </div>
</section>

<footer class="bg-gray-900 text-gray-400 py-10"><div class="max-w-7xl mx-auto px-4 text-center"><p class="text-sm">&copy; 2024–2026 DÉCOR BONJOUR. г. Ростов-на-Дону. Все права защищены.</p></div></footer>
<script>const obs=new IntersectionObserver(e=>e.forEach(el=>{if(el.isIntersecting)el.target.classList.add('visible')}),{threshold:.1});document.querySelectorAll('.fade-up').forEach(el=>obs.observe(el))</script>
</body></html>`


// =====================================================
// CRM SPA HTML
// =====================================================
const CRM_HTML = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>DÉCOR BONJOUR — CRM</title>
<script src="https://cdn.tailwindcss.com"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.0/css/all.min.css" rel="stylesheet">
<script>tailwind.config={theme:{extend:{fontFamily:{sans:['Inter','sans-serif']},colors:{brand:{50:'#f0f4ff',100:'#dbe4ff',200:'#bac8ff',500:'#5c7cfa',600:'#4c6ef5',700:'#4263eb',800:'#3b5bdb'}}}}}</script>
<style>body{font-family:'Inter',sans-serif;background:#f8fafc}.sidebar-link{transition:all .15s}.sidebar-link:hover,.sidebar-link.active{background:rgba(66,99,235,.1);color:#4263eb}.modal-overlay{animation:fadeIn .2s}.modal-content{animation:slideUp .3s}@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes slideUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}.status-badge{padding:2px 10px;border-radius:9999px;font-size:12px;font-weight:600}.status-new{background:#dbeafe;color:#1e40af}.status-measuring{background:#fef3c7;color:#92400e}.status-design{background:#e0e7ff;color:#3730a3}.status-sewing{background:#fce7f3;color:#9d174d}.status-installation{background:#fed7aa;color:#9a3412}.status-completed{background:#d1fae5;color:#065f46}.status-cancelled{background:#fee2e2;color:#991b1b}.card{background:#fff;border-radius:16px;border:1px solid #e2e8f0;transition:all .2s}.card:hover{box-shadow:0 4px 12px rgba(0,0,0,.05)}.type-badge{font-size:10px;padding:1px 8px;border-radius:9999px;font-weight:600}.type-person{background:#dbeafe;color:#1e40af}.type-ip{background:#fef3c7;color:#92400e}.type-company{background:#d1fae5;color:#065f46}</style>
</head><body>
<div id="app"></div>
<script>
const API='/api';let state={token:localStorage.getItem('db_token')||'',user:JSON.parse(localStorage.getItem('db_user')||'null'),page:'dashboard',data:{}};
function saveAuth(t,u){state.token=t;state.user=u;localStorage.setItem('db_token',t);localStorage.setItem('db_user',JSON.stringify(u))}
function logout(){state.token='';state.user=null;localStorage.removeItem('db_token');localStorage.removeItem('db_user');render()}
async function api(m,p,b){const o={method:m,headers:{'Content-Type':'application/json'}};if(state.token)o.headers['Authorization']='Bearer '+state.token;if(b)o.body=JSON.stringify(b);const r=await fetch(API+p,o);const d=await r.json();if(!r.ok)throw new Error(d.error||'Ошибка');return d}
const mc=()=>document.getElementById('mainContent');const modal=()=>document.getElementById('modalContainer');
const STATUS_LABELS={new:'Новый',measuring:'Замер',design:'Дизайн',sewing:'Пошив',installation:'Монтаж',completed:'Завершён',cancelled:'Отменён'};
const TYPE_LABELS={person:'Физ.лицо',ip:'ИП',company:'Юр.лицо'};
const fmt=n=>Number(n||0).toLocaleString('ru');
function closeModal(){modal().innerHTML=''}

function render(){const app=document.getElementById('app');if(!state.token){app.innerHTML=renderAuth();bindAuth();return}app.innerHTML=renderLayout();bindLayout();navigate(state.page)}

function renderAuth(){return \`<div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-600 to-brand-800 p-4"><div class="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
<div class="text-center mb-8"><div class="w-14 h-14 bg-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-3"><i class="fas fa-scissors text-white text-xl"></i></div><h1 class="text-2xl font-bold">DÉCOR <span class="text-brand-600">BONJOUR</span></h1><p class="text-gray-500 text-sm mt-1">CRM для салонов штор</p></div>
<div class="flex bg-gray-100 rounded-xl p-1 mb-6"><button onclick="showTab('login')" id="tabLogin" class="flex-1 py-2 text-sm font-semibold rounded-lg bg-white shadow text-brand-600">Вход</button><button onclick="showTab('register')" id="tabRegister" class="flex-1 py-2 text-sm font-semibold rounded-lg text-gray-500">Регистрация</button></div>
<div id="loginForm"><div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700 mb-1">Email</label><input id="loginEmail" type="email" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="demo@shtorcrm.ru"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Пароль</label><input id="loginPass" type="password" class="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none" placeholder="demo123"></div><button id="loginBtn" class="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700">Войти</button><p id="loginError" class="text-red-500 text-sm text-center hidden"></p><p class="text-xs text-gray-400 text-center">Демо: demo@shtorcrm.ru / demo123</p></div></div>
<div id="registerForm" class="hidden"><div class="space-y-4"><div><label class="block text-sm font-medium text-gray-700 mb-1">Имя *</label><input id="regName" class="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Email *</label><input id="regEmail" type="email" class="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Пароль *</label><input id="regPass" type="password" class="w-full px-4 py-3 border border-gray-200 rounded-xl outline-none"></div><button id="regBtn" class="w-full py-3 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700">Зарегистрироваться</button><p id="regError" class="text-red-500 text-sm text-center hidden"></p></div></div>
</div></div>\`}

function showTab(t){document.getElementById('loginForm').classList.toggle('hidden',t!=='login');document.getElementById('registerForm').classList.toggle('hidden',t!=='register');document.getElementById('tabLogin').className='flex-1 py-2 text-sm font-semibold rounded-lg '+(t==='login'?'bg-white shadow text-brand-600':'text-gray-500');document.getElementById('tabRegister').className='flex-1 py-2 text-sm font-semibold rounded-lg '+(t==='register'?'bg-white shadow text-brand-600':'text-gray-500')}

function bindAuth(){setTimeout(()=>{const lb=document.getElementById('loginBtn'),rb=document.getElementById('regBtn');if(lb)lb.onclick=async()=>{try{const r=await api('POST','/auth/login',{email:document.getElementById('loginEmail').value,password:document.getElementById('loginPass').value});saveAuth(r.token,r.user);render()}catch(e){const el=document.getElementById('loginError');el.textContent=e.message;el.classList.remove('hidden')}};if(rb)rb.onclick=async()=>{try{const r=await api('POST','/auth/register',{name:document.getElementById('regName').value,email:document.getElementById('regEmail').value,password:document.getElementById('regPass').value});saveAuth(r.token,r.user);render()}catch(e){const el=document.getElementById('regError');el.textContent=e.message;el.classList.remove('hidden')}}},50)}

function renderLayout(){return \`<div class="flex h-screen"><aside class="w-64 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 hidden lg:flex"><div class="p-5 border-b border-gray-100"><a href="/" class="flex items-center gap-2"><div class="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center"><i class="fas fa-scissors text-white text-xs"></i></div><span class="text-lg font-bold">DÉCOR <span class="text-brand-600">BONJOUR</span></span></a></div><nav class="flex-1 p-3 space-y-1" id="sideNav"><a href="#" data-page="dashboard" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-chart-pie w-5 text-center"></i>Дашборд</a><a href="#" data-page="clients" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-users w-5 text-center"></i>Клиенты</a><a href="#" data-page="projects" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-folder-open w-5 text-center"></i>Проекты</a><a href="#" data-page="fabrics" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-scroll w-5 text-center"></i>Ткани</a><a href="#" data-page="suppliers" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-truck w-5 text-center"></i>Поставщики</a><a href="#" data-page="contracts" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-file-contract w-5 text-center"></i>Договоры</a><a href="#" data-page="settings" class="sidebar-link flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700"><i class="fas fa-cog w-5 text-center"></i>Настройки</a></nav><div class="p-4 border-t border-gray-100"><div class="flex items-center gap-3"><div class="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center"><span class="text-brand-700 font-bold text-sm">\${state.user?.name?.[0]||'U'}</span></div><div class="flex-1 min-w-0"><div class="text-sm font-medium truncate">\${state.user?.name||''}</div></div><button onclick="logout()" class="text-gray-400 hover:text-red-500"><i class="fas fa-sign-out-alt"></i></button></div></div></aside>
<div class="flex-1 flex flex-col overflow-hidden"><header class="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between lg:hidden"><span class="font-bold text-sm">DÉCOR BONJOUR</span><div class="flex gap-2"><select id="mobileNav" class="text-xs border rounded-lg px-2 py-1" onchange="navigate(this.value)"><option value="dashboard">Дашборд</option><option value="clients">Клиенты</option><option value="projects">Проекты</option><option value="fabrics">Ткани</option><option value="suppliers">Поставщики</option><option value="contracts">Договоры</option><option value="settings">Настройки</option></select><button onclick="logout()" class="text-gray-400 hover:text-red-500 px-2"><i class="fas fa-sign-out-alt"></i></button></div></header>
<main class="flex-1 overflow-auto p-6" id="mainContent"></main></div></div><div id="modalContainer"></div>\`}

function bindLayout(){setTimeout(()=>{document.querySelectorAll('#sideNav a').forEach(a=>{a.onclick=e=>{e.preventDefault();navigate(a.dataset.page)}})},50)}
function navigate(page){state.page=page;document.querySelectorAll('.sidebar-link').forEach(a=>a.classList.toggle('active',a.dataset.page===page));const m=document.getElementById('mobileNav');if(m)m.value=page;({dashboard:loadDashboard,clients:loadClients,projects:loadProjects,fabrics:loadFabrics,suppliers:loadSuppliers,contracts:loadContracts,settings:loadSettings})[page]?.()}

// === DASHBOARD ===
async function loadDashboard(){mc().innerHTML='<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-brand-500 text-2xl"></i></div>';try{const d=await api('GET','/crm/dashboard');mc().innerHTML=\`<h1 class="text-2xl font-bold mb-6">Дашборд</h1><div class="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8"><div class="card p-5"><div class="flex items-center gap-3"><div class="w-11 h-11 bg-brand-100 rounded-xl flex items-center justify-center"><i class="fas fa-users text-brand-600"></i></div><div><div class="text-2xl font-bold">\${d.clients}</div><div class="text-xs text-gray-500">Клиентов</div></div></div></div><div class="card p-5"><div class="flex items-center gap-3"><div class="w-11 h-11 bg-emerald-100 rounded-xl flex items-center justify-center"><i class="fas fa-folder-open text-emerald-600"></i></div><div><div class="text-2xl font-bold">\${d.projects}</div><div class="text-xs text-gray-500">Проектов</div></div></div></div><div class="card p-5"><div class="flex items-center gap-3"><div class="w-11 h-11 bg-amber-100 rounded-xl flex items-center justify-center"><i class="fas fa-spinner text-amber-600"></i></div><div><div class="text-2xl font-bold">\${d.activeProjects}</div><div class="text-xs text-gray-500">В работе</div></div></div></div><div class="card p-5"><div class="flex items-center gap-3"><div class="w-11 h-11 bg-purple-100 rounded-xl flex items-center justify-center"><i class="fas fa-file-contract text-purple-600"></i></div><div><div class="text-2xl font-bold">\${d.contracts}</div><div class="text-xs text-gray-500">Договоров</div></div></div></div></div><div class="card p-6"><h3 class="font-bold mb-4">Последние проекты</h3>\${d.recentProjects.length?'<div class="space-y-3">'+d.recentProjects.map(p=>'<div class="flex items-center justify-between p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-brand-50" onclick="state.page=\\'projects\\';loadProjectDetail('+p.id+')"><div><div class="font-medium text-sm">'+p.title+'</div><div class="text-xs text-gray-500">'+p.client_name+'</div></div><div class="flex items-center gap-3">'+(p.total_amount>0?'<span class="text-sm font-semibold">'+fmt(p.total_amount)+' ₽</span>':'')+'<span class="status-badge status-'+p.status+'">'+(STATUS_LABELS[p.status]||p.status)+'</span></div></div>').join('')+'</div>':'<p class="text-gray-400 text-sm">Нет проектов</p>'}</div>\`}catch(e){mc().innerHTML='<p class="text-red-500">'+e.message+'</p>'}}

// === CLIENTS ===
async function loadClients(){const cl=await api('GET','/crm/clients');mc().innerHTML=\`<div class="flex items-center justify-between mb-6"><h1 class="text-2xl font-bold">Клиенты</h1><button onclick="showClientModal()" class="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl hover:bg-brand-700"><i class="fas fa-plus mr-1"></i>Добавить</button></div><div class="grid gap-3">\${cl.map(c=>'<div class="card p-5 flex items-center justify-between"><div class="flex-1 min-w-0"><div class="flex items-center gap-2"><span class="font-semibold">'+c.name+'</span><span class="type-badge type-'+(c.client_type||'person')+'">'+(TYPE_LABELS[c.client_type]||'Физ.лицо')+'</span></div><div class="text-sm text-gray-500 mt-0.5">'+[c.phone,c.email].filter(Boolean).join(' · ')+'</div>'+(c.company_name?'<div class="text-xs text-gray-400 mt-0.5">'+c.company_name+'</div>':'')+'</div><div class="flex items-center gap-2 ml-4"><button onclick="editClient('+c.id+')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-brand-600"><i class="fas fa-pen text-xs"></i></button><button onclick="deleteClient('+c.id+')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button></div></div>').join('')}</div>\${!cl.length?'<div class="text-center py-12 text-gray-400"><i class="fas fa-users text-4xl mb-3"></i><p>Нет клиентов</p></div>':''}\`}

async function editClient(id){const c=await api('GET','/crm/clients/'+id);showClientModal(c)}

function showClientModal(c){
  const d=c||{client_type:'person'};const t=d.client_type||'person';
  modal().innerHTML=\`<div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-start justify-center p-4 overflow-auto" onclick="if(event.target===this)closeModal()"><div class="modal-content bg-white rounded-2xl w-full max-w-2xl p-6 my-8">
  <h2 class="text-lg font-bold mb-4">\${d.id?'Редактировать':'Новый'} клиент</h2>
  <div class="mb-4"><label class="block text-sm font-medium text-gray-700 mb-2">Тип клиента</label><div class="flex gap-2"><button onclick="switchClientType('person')" class="cltype-btn px-4 py-2 rounded-xl text-sm font-semibold border \${t==='person'?'bg-brand-600 text-white border-brand-600':'border-gray-200 text-gray-600'}">Физ. лицо</button><button onclick="switchClientType('ip')" class="cltype-btn px-4 py-2 rounded-xl text-sm font-semibold border \${t==='ip'?'bg-brand-600 text-white border-brand-600':'border-gray-200 text-gray-600'}">ИП</button><button onclick="switchClientType('company')" class="cltype-btn px-4 py-2 rounded-xl text-sm font-semibold border \${t==='company'?'bg-brand-600 text-white border-brand-600':'border-gray-200 text-gray-600'}">Юр. лицо</button></div><input type="hidden" id="cType" value="\${t}"></div>
  <div class="space-y-3">
    <div class="grid grid-cols-2 gap-3"><div><label class="block text-xs font-medium text-gray-600 mb-1">ФИО / Название *</label><input id="cName" value="\${d.name||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs font-medium text-gray-600 mb-1">Телефон</label><input id="cPhone" value="\${d.phone||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
    <div class="grid grid-cols-2 gap-3"><div><label class="block text-xs font-medium text-gray-600 mb-1">Email</label><input id="cEmail" value="\${d.email||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs font-medium text-gray-600 mb-1">Адрес</label><input id="cAddr" value="\${d.address||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>

    <div id="personFields" class="\${t==='person'?'':'hidden'}">
      <div class="bg-blue-50 rounded-xl p-4 mt-2"><h4 class="text-xs font-bold text-blue-800 mb-2">ПАСПОРТНЫЕ ДАННЫЕ</h4>
      <div class="grid grid-cols-2 gap-2"><div><label class="block text-xs text-gray-600 mb-1">Серия и номер</label><input id="cPSeries" value="\${d.passport_series||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="60 04"> <input id="cPNumber" value="\${d.passport_number||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm mt-1" placeholder="123456"></div><div><label class="block text-xs text-gray-600 mb-1">Дата выдачи</label><input id="cPDate" value="\${d.passport_date||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="15.03.2005"><label class="block text-xs text-gray-600 mb-1 mt-1">Код подразделения</label><input id="cPCode" value="\${d.passport_code||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="612-005"></div></div>
      <div class="mt-2"><label class="block text-xs text-gray-600 mb-1">Кем выдан</label><input id="cPIssued" value="\${d.passport_issued||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="ОВД Ворошиловского р-на"></div></div>
    </div>

    <div id="companyFields" class="\${t!=='person'?'':'hidden'}">
      <div class="bg-green-50 rounded-xl p-4 mt-2"><h4 class="text-xs font-bold text-green-800 mb-2">ЮРИДИЧЕСКИЕ ДАННЫЕ</h4>
      <div class="grid grid-cols-2 gap-2"><div><label class="block text-xs text-gray-600 mb-1">Название организации</label><input id="cCompName" value="\${d.company_name||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs text-gray-600 mb-1">Контактное лицо</label><input id="cContact" value="\${d.contact_person||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
      <div class="grid grid-cols-3 gap-2 mt-2"><div><label class="block text-xs text-gray-600 mb-1">ИНН</label><input id="cInn" value="\${d.inn||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs text-gray-600 mb-1">КПП</label><input id="cKpp" value="\${d.kpp||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs text-gray-600 mb-1">ОГРН</label><input id="cOgrn" value="\${d.ogrn||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
      <div class="mt-2"><label class="block text-xs text-gray-600 mb-1">Юр. адрес</label><input id="cLegalAddr" value="\${d.legal_address||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div>
      <h4 class="text-xs font-bold text-green-800 mb-2 mt-3">БАНКОВСКИЕ РЕКВИЗИТЫ</h4>
      <div class="grid grid-cols-2 gap-2"><div><label class="block text-xs text-gray-600 mb-1">Банк</label><input id="cBankName" value="\${d.bank_name||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs text-gray-600 mb-1">БИК</label><input id="cBankBik" value="\${d.bank_bik||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
      <div class="grid grid-cols-2 gap-2 mt-2"><div><label class="block text-xs text-gray-600 mb-1">Р/с</label><input id="cBankAcc" value="\${d.bank_account||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs text-gray-600 mb-1">К/с</label><input id="cBankCorr" value="\${d.bank_corr_account||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div></div>
    </div>

    <div><label class="block text-xs font-medium text-gray-600 mb-1">Заметки</label><textarea id="cNotes" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" rows="2">\${d.notes||''}</textarea></div>
  </div>
  <div class="flex gap-3 mt-5"><button onclick="saveClient(\${d.id||0})" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700">Сохранить</button><button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button></div>
</div></div>\`}

function switchClientType(t){document.getElementById('cType').value=t;document.getElementById('personFields').classList.toggle('hidden',t!=='person');document.getElementById('companyFields').classList.toggle('hidden',t==='person');document.querySelectorAll('.cltype-btn').forEach((b,i)=>{const types=['person','ip','company'];b.className='cltype-btn px-4 py-2 rounded-xl text-sm font-semibold border '+(types[i]===t?'bg-brand-600 text-white border-brand-600':'border-gray-200 text-gray-600')})}

async function saveClient(id){const d={name:document.getElementById('cName').value,phone:document.getElementById('cPhone').value,email:document.getElementById('cEmail').value,address:document.getElementById('cAddr').value,notes:document.getElementById('cNotes').value,client_type:document.getElementById('cType').value,passport_series:document.getElementById('cPSeries')?.value||'',passport_number:document.getElementById('cPNumber')?.value||'',passport_date:document.getElementById('cPDate')?.value||'',passport_issued:document.getElementById('cPIssued')?.value||'',passport_code:document.getElementById('cPCode')?.value||'',company_name:document.getElementById('cCompName')?.value||'',inn:document.getElementById('cInn')?.value||'',kpp:document.getElementById('cKpp')?.value||'',ogrn:document.getElementById('cOgrn')?.value||'',legal_address:document.getElementById('cLegalAddr')?.value||'',contact_person:document.getElementById('cContact')?.value||'',bank_name:document.getElementById('cBankName')?.value||'',bank_bik:document.getElementById('cBankBik')?.value||'',bank_account:document.getElementById('cBankAcc')?.value||'',bank_corr_account:document.getElementById('cBankCorr')?.value||''};if(!d.name)return alert('Введите имя');try{if(id)await api('PUT','/crm/clients/'+id,d);else await api('POST','/crm/clients',d);closeModal();loadClients()}catch(e){alert(e.message)}}
async function deleteClient(id){if(!confirm('Удалить клиента?'))return;await api('DELETE','/crm/clients/'+id);loadClients()}

// === SUPPLIERS ===
async function loadSuppliers(){const items=await api('GET','/crm/suppliers');mc().innerHTML=\`<div class="flex items-center justify-between mb-6"><h1 class="text-2xl font-bold">Поставщики</h1><button onclick="showSupplierModal()" class="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl"><i class="fas fa-plus mr-1"></i>Добавить</button></div><div class="grid gap-3">\${items.map(s=>'<div class="card p-5 flex items-center justify-between"><div><div class="font-semibold">'+s.name+'</div><div class="text-sm text-gray-500">'+[s.contact,s.phone].filter(Boolean).join(' · ')+'</div></div><button onclick="deleteSupplier('+s.id+')" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button></div>').join('')}</div>\`}
function showSupplierModal(){modal().innerHTML=\`<div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()"><div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6"><h2 class="text-lg font-bold mb-4">Новый поставщик</h2><div class="space-y-3"><div><label class="block text-sm font-medium text-gray-700 mb-1">Название *</label><input id="sName" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Контакт</label><input id="sContact" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-sm font-medium text-gray-700 mb-1">Телефон</label><input id="sPhone" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div></div><div class="flex gap-3 mt-5"><button onclick="saveSupplier()" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Сохранить</button><button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button></div></div></div>\`}
async function saveSupplier(){try{await api('POST','/crm/suppliers',{name:document.getElementById('sName').value,contact:document.getElementById('sContact').value,phone:document.getElementById('sPhone').value});closeModal();loadSuppliers()}catch(e){alert(e.message)}}
async function deleteSupplier(id){if(!confirm('Удалить?'))return;await api('DELETE','/crm/suppliers/'+id);loadSuppliers()}

// === FABRICS ===
async function loadFabrics(){const[fabrics,suppliers]=await Promise.all([api('GET','/crm/fabrics'),api('GET','/crm/suppliers')]);state.data.suppliers=suppliers;mc().innerHTML=\`<div class="flex items-center justify-between mb-6"><h1 class="text-2xl font-bold">Ткани / Прайсы</h1><div class="flex gap-2"><button onclick="showImportModal()" class="px-4 py-2 border border-brand-600 text-brand-600 text-sm font-semibold rounded-xl"><i class="fas fa-upload mr-1"></i>Импорт</button><button onclick="showFabricModal()" class="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl"><i class="fas fa-plus mr-1"></i>Добавить</button></div></div><div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="border-b border-gray-200"><th class="text-left py-3 px-3 font-semibold text-gray-600">Название</th><th class="text-left py-3 px-3 font-semibold text-gray-600">Артикул</th><th class="text-left py-3 px-3 font-semibold text-gray-600">Поставщик</th><th class="text-left py-3 px-3 font-semibold text-gray-600">Состав</th><th class="text-right py-3 px-3 font-semibold text-gray-600">Шир.</th><th class="text-right py-3 px-3 font-semibold text-gray-600">Цена/м</th><th></th></tr></thead><tbody>\${fabrics.map(f=>'<tr class="border-b border-gray-100 hover:bg-gray-50"><td class="py-3 px-3 font-medium">'+f.name+'</td><td class="py-3 px-3 text-gray-500">'+(f.article||'—')+'</td><td class="py-3 px-3 text-gray-500">'+(f.supplier_name||'—')+'</td><td class="py-3 px-3 text-gray-500">'+(f.composition||'—')+'</td><td class="py-3 px-3 text-right">'+(f.width_cm||'—')+'</td><td class="py-3 px-3 text-right font-semibold">'+fmt(f.price_per_meter)+' ₽</td><td class="py-3 px-3"><button onclick="deleteFabric('+f.id+')" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button></td></tr>').join('')}</tbody></table></div>\`}
function showFabricModal(){const so=(state.data.suppliers||[]).map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');modal().innerHTML=\`<div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()"><div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6"><h2 class="text-lg font-bold mb-4">Новая ткань</h2><div class="space-y-3"><div><label class="block text-sm font-medium mb-1">Название *</label><input id="fName" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div><div class="grid grid-cols-2 gap-3"><div><label class="block text-sm font-medium mb-1">Артикул</label><input id="fArticle" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-sm font-medium mb-1">Поставщик</label><select id="fSupplier" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"><option value="">—</option>\${so}</select></div></div><div><label class="block text-sm font-medium mb-1">Состав</label><input id="fComp" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div><div class="grid grid-cols-2 gap-3"><div><label class="block text-sm font-medium mb-1">Ширина, см</label><input id="fWidth" type="number" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-sm font-medium mb-1">Цена/м, ₽ *</label><input id="fPrice" type="number" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div></div></div><div class="flex gap-3 mt-5"><button onclick="saveFabric()" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Сохранить</button><button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button></div></div></div>\`}
async function saveFabric(){try{await api('POST','/crm/fabrics',{name:document.getElementById('fName').value,article:document.getElementById('fArticle').value,supplier_id:document.getElementById('fSupplier').value||null,composition:document.getElementById('fComp').value,width_cm:parseFloat(document.getElementById('fWidth').value)||0,price_per_meter:parseFloat(document.getElementById('fPrice').value)||0});closeModal();loadFabrics()}catch(e){alert(e.message)}}
async function deleteFabric(id){if(!confirm('Удалить?'))return;await api('DELETE','/crm/fabrics/'+id);loadFabrics()}
function showImportModal(){const so=(state.data.suppliers||[]).map(s=>'<option value="'+s.id+'">'+s.name+'</option>').join('');modal().innerHTML=\`<div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()"><div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6"><h2 class="text-lg font-bold mb-4">Импорт прайса</h2><p class="text-sm text-gray-500 mb-4">CSV: Название;Артикул;Состав;Ширина;Цена</p><div class="space-y-3"><div><label class="block text-sm font-medium mb-1">Поставщик</label><select id="impSup" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"><option value="">—</option>\${so}</select></div><textarea id="impData" rows="6" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-mono" placeholder="Бархат;VRS-001;полиэстер;280;1850"></textarea></div><div class="flex gap-3 mt-5"><button onclick="doImport()" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Импорт</button><button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button></div></div></div>\`}
async function doImport(){const lines=document.getElementById('impData').value.trim().split('\\n').filter(Boolean);const fabrics=lines.map(l=>{const p=l.split(';');return{name:p[0]?.trim(),article:p[1]?.trim(),composition:p[2]?.trim(),width_cm:parseFloat(p[3])||0,price_per_meter:parseFloat(p[4])||0}}).filter(f=>f.name);if(!fabrics.length)return alert('Нет данных');try{const r=await api('POST','/crm/fabrics/import',{fabrics,supplier_id:document.getElementById('impSup').value||null});alert('Импортировано: '+r.imported);closeModal();loadFabrics()}catch(e){alert(e.message)}}

// === PROJECTS ===
async function loadProjects(){const projects=await api('GET','/crm/projects');mc().innerHTML=\`<div class="flex items-center justify-between mb-6"><h1 class="text-2xl font-bold">Проекты</h1><button onclick="showProjectModal()" class="px-4 py-2 bg-brand-600 text-white text-sm font-semibold rounded-xl"><i class="fas fa-plus mr-1"></i>Новый проект</button></div><div class="grid gap-3">\${projects.map(p=>'<div class="card p-5 cursor-pointer hover:border-brand-200" onclick="loadProjectDetail('+p.id+')"><div class="flex items-center justify-between"><div><div class="font-semibold">'+p.title+'</div><div class="text-sm text-gray-500">'+p.client_name+(p.room?' · '+p.room:'')+'</div></div><div class="flex items-center gap-3">'+(p.total_amount>0?'<span class="font-semibold">'+fmt(p.total_amount)+' ₽</span>':'')+'<span class="status-badge status-'+p.status+'">'+(STATUS_LABELS[p.status]||p.status)+'</span></div></div></div>').join('')}</div>\${!projects.length?'<div class="text-center py-12 text-gray-400"><p>Нет проектов</p></div>':''}\`}
async function showProjectModal(){const clients=await api('GET','/crm/clients');if(!clients.length)return alert('Сначала добавьте клиента');const opts=clients.map(c=>'<option value="'+c.id+'">'+c.name+'</option>').join('');modal().innerHTML=\`<div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()"><div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6"><h2 class="text-lg font-bold mb-4">Новый проект</h2><div class="space-y-3"><div><label class="block text-sm font-medium mb-1">Клиент *</label><select id="pClient" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm">\${opts}</select></div><div><label class="block text-sm font-medium mb-1">Название *</label><input id="pTitle" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Шторы в гостиную"></div><div><label class="block text-sm font-medium mb-1">Комната</label><input id="pRoom" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-sm font-medium mb-1">Заметки</label><textarea id="pNotes" rows="2" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></textarea></div></div><div class="flex gap-3 mt-5"><button onclick="saveProject()" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Создать</button><button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button></div></div></div>\`}
async function saveProject(){try{const r=await api('POST','/crm/projects',{client_id:document.getElementById('pClient').value,title:document.getElementById('pTitle').value,room:document.getElementById('pRoom').value,notes:document.getElementById('pNotes').value});closeModal();loadProjectDetail(r.id)}catch(e){alert(e.message)}}
async function loadProjectDetail(id){mc().innerHTML='<div class="flex items-center justify-center h-64"><i class="fas fa-spinner fa-spin text-brand-500 text-2xl"></i></div>';const p=await api('GET','/crm/projects/'+id);const so=Object.entries(STATUS_LABELS).map(([k,v])=>'<option value="'+k+'"'+(p.status===k?' selected':'')+'>'+v+'</option>').join('');mc().innerHTML=\`<div class="mb-6"><button onclick="loadProjects()" class="text-sm text-brand-600 hover:underline mb-3 inline-block"><i class="fas fa-arrow-left mr-1"></i>Все проекты</button><div class="flex items-center justify-between flex-wrap gap-3"><div><h1 class="text-2xl font-bold">\${p.title}</h1><p class="text-sm text-gray-500">\${p.client_name}\${p.room?' · '+p.room:''}</p></div><div class="flex items-center gap-2 flex-wrap"><select onchange="updateProjectStatus(\${p.id},this.value)" class="px-3 py-2 border border-gray-200 rounded-xl text-sm">\${so}</select><button onclick="showContractModal(\${p.id})" class="px-3 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl"><i class="fas fa-file-contract mr-1"></i>Договор</button><a href="/api/crm/doc/invoice/\${p.id}?token='+state.token+'" target="_blank" class="px-3 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl"><i class="fas fa-file-invoice-dollar mr-1"></i>Счёт</a></div></div></div><div class="card p-6 mb-6"><div class="flex items-center justify-between mb-4"><h3 class="font-bold">Позиции проекта</h3><div class="flex gap-2"><button onclick="showAddFabricItem(\${p.id})" class="px-3 py-1.5 bg-brand-50 text-brand-600 text-xs font-semibold rounded-lg"><i class="fas fa-scroll mr-1"></i>Ткань</button><button onclick="showAddServiceItem(\${p.id})" class="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg"><i class="fas fa-plus mr-1"></i>Услуга</button></div></div>\${p.items.length?'<table class="w-full text-sm"><thead><tr class="border-b"><th class="text-left py-2 text-gray-600">Наименование</th><th class="text-right py-2 text-gray-600">Кол-во</th><th class="text-right py-2 text-gray-600">Цена</th><th class="text-right py-2 text-gray-600">Сумма</th><th></th></tr></thead><tbody>'+p.items.map(it=>'<tr class="border-b border-gray-100"><td class="py-2.5">'+it.description+(it.fabric_name?'<br><span class="text-xs text-gray-400">'+it.fabric_name+'</span>':'')+'</td><td class="text-right py-2.5">'+it.quantity+' '+it.unit+'</td><td class="text-right py-2.5">'+fmt(it.price)+' ₽</td><td class="text-right py-2.5 font-semibold">'+fmt(it.amount)+' ₽</td><td class="py-2.5 text-right"><button onclick="deleteItem('+p.id+','+it.id+')" class="text-gray-400 hover:text-red-500"><i class="fas fa-trash text-xs"></i></button></td></tr>').join('')+'</tbody></table><div class="text-right mt-3 text-lg font-bold">Итого: '+fmt(p.total_amount)+' ₽</div>':'<p class="text-gray-400 text-sm text-center py-8">Добавьте позиции</p>'}</div>\`}
async function updateProjectStatus(id,status){const p=await api('GET','/crm/projects/'+id);await api('PUT','/crm/projects/'+id,{title:p.title,room:p.room,status,notes:p.notes})}
async function showAddFabricItem(pid){const fabrics=await api('GET','/crm/fabrics');const opts=fabrics.map(f=>'<option value="'+f.id+'" data-price="'+f.price_per_meter+'">'+f.name+' ('+f.article+') — '+fmt(f.price_per_meter)+' ₽/м</option>').join('');modal().innerHTML=\`<div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()"><div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6"><h2 class="text-lg font-bold mb-4">Ткань из прайса</h2><div class="space-y-3"><div><select id="itFabric" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" onchange="document.getElementById('itPrice').value=this.selectedOptions[0]?.dataset.price||0">\${opts}</select></div><div><input id="itDesc" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Описание"></div><div class="grid grid-cols-3 gap-3"><div><label class="text-xs">Кол-во</label><input id="itQty" type="number" step="0.1" value="1" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="text-xs">Ед.</label><input id="itUnit" value="м" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="text-xs">Цена</label><input id="itPrice" type="number" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value="\${fabrics[0]?.price_per_meter||0}"></div></div></div><div class="flex gap-3 mt-5"><button onclick="saveItem(\${pid},true)" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Добавить</button><button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button></div></div></div>\`}
function showAddServiceItem(pid){modal().innerHTML=\`<div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()"><div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6"><h2 class="text-lg font-bold mb-4">Услуга</h2><div class="space-y-3"><div><input id="itDesc" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm" placeholder="Пошив портьер"></div><div class="grid grid-cols-3 gap-3"><div><label class="text-xs">Кол-во</label><input id="itQty" type="number" step="0.1" value="1" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="text-xs">Ед.</label><input id="itUnit" value="шт" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="text-xs">Цена</label><input id="itPrice" type="number" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" value="0"></div></div></div><div class="flex gap-3 mt-5"><button onclick="saveItem(\${pid},false)" class="flex-1 py-2.5 bg-brand-600 text-white font-semibold rounded-xl">Добавить</button><button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button></div></div></div>\`}
async function saveItem(pid,isFabric){const d={fabric_id:isFabric?document.getElementById('itFabric')?.value:null,description:document.getElementById('itDesc').value||(isFabric?document.getElementById('itFabric')?.selectedOptions[0]?.text?.split(' —')[0]:''),quantity:parseFloat(document.getElementById('itQty').value)||1,unit:document.getElementById('itUnit').value||'м',price:parseFloat(document.getElementById('itPrice').value)||0};if(!d.description)return alert('Описание');try{await api('POST','/crm/projects/'+pid+'/items',d);closeModal();loadProjectDetail(pid)}catch(e){alert(e.message)}}
async function deleteItem(pid,iid){if(!confirm('Удалить?'))return;await api('DELETE','/crm/projects/'+pid+'/items/'+iid);loadProjectDetail(pid)}

// === CONTRACTS ===
async function loadContracts(){const items=await api('GET','/crm/contracts');const cs={draft:'Черновик',signed:'Подписан',completed:'Завершён',cancelled:'Отменён'};mc().innerHTML=\`<div class="flex items-center justify-between mb-6"><h1 class="text-2xl font-bold">Договоры</h1></div><div class="grid gap-3">\${items.map(ct=>'<div class="card p-5"><div class="flex items-center justify-between flex-wrap gap-2"><div><div class="font-semibold">'+ct.contract_number+'</div><div class="text-sm text-gray-500">'+ct.client_name+' · '+ct.project_title+'</div></div><div class="flex items-center gap-2"><span class="font-semibold">'+fmt(ct.total_amount)+' ₽</span><a href="/doc/contract/'+ct.id+'?token='+state.token+'" target="_blank" class="px-3 py-1 bg-gray-100 rounded-lg text-xs font-semibold hover:bg-gray-200"><i class="fas fa-print mr-1"></i>Печать</a>'+(ct.status==='draft'?'<button onclick="signContract('+ct.id+')" class="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold">Подписать</button>':'<span class="status-badge status-completed">'+cs[ct.status]+'</span>')+'</div></div></div>').join('')}</div>\${!items.length?'<div class="text-center py-12 text-gray-400"><p>Нет договоров. Создайте из карточки проекта.</p></div>':''}\`}
async function signContract(id){if(!confirm('Подписать?'))return;await api('PUT','/crm/contracts/'+id+'/sign');loadContracts()}
async function showContractModal(pid){const p=await api('GET','/crm/projects/'+pid);if(!p.items.length)return alert('Сначала добавьте позиции');modal().innerHTML=\`<div class="modal-overlay fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onclick="if(event.target===this)closeModal()"><div class="modal-content bg-white rounded-2xl w-full max-w-lg p-6"><h2 class="text-lg font-bold mb-4">Создать договор</h2><p class="text-sm text-gray-500 mb-4">\${p.title} · Итого: \${fmt(p.total_amount)} ₽</p><div class="space-y-3"><div><label class="text-sm font-medium mb-1">Предоплата, ₽</label><input id="ctPrepay" type="number" value="\${Math.round(p.total_amount*0.6)}" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></div><div><label class="text-sm font-medium mb-1">Примечания</label><textarea id="ctNotes" rows="2" class="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm"></textarea></div></div><div class="flex gap-3 mt-5"><button onclick="createContract(\${pid})" class="flex-1 py-2.5 bg-emerald-600 text-white font-semibold rounded-xl">Создать</button><button onclick="closeModal()" class="px-6 py-2.5 border border-gray-200 rounded-xl">Отмена</button></div></div></div>\`}
async function createContract(pid){try{const r=await api('POST','/crm/contracts',{project_id:pid,prepayment:parseFloat(document.getElementById('ctPrepay').value)||0,notes:document.getElementById('ctNotes').value});closeModal();alert('Договор '+r.contract_number+' создан!');window.open('/doc/contract/'+r.id+'?token='+state.token,'_blank');navigate('contracts')}catch(e){alert(e.message)}}

// === SETTINGS ===
async function loadSettings(){const s=await api('GET','/crm/settings');mc().innerHTML=\`<h1 class="text-2xl font-bold mb-6">Настройки (реквизиты исполнителя)</h1><div class="card p-6"><div class="space-y-3">
<div class="grid grid-cols-2 gap-3"><div><label class="block text-xs font-medium text-gray-600 mb-1">Название компании</label><input id="sCompName" value="\${s.company_name||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs font-medium text-gray-600 mb-1">ФИО владельца</label><input id="sOwnerName" value="\${s.owner_name||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
<div class="grid grid-cols-2 gap-3"><div><label class="block text-xs font-medium text-gray-600 mb-1">ФИО кратко</label><input id="sOwnerShort" value="\${s.owner_name_short||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm" placeholder="Шалыга В. Д."></div><div><label class="block text-xs font-medium text-gray-600 mb-1">ОГРН</label><input id="sOgrn" value="\${s.ogrn||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
<div class="grid grid-cols-3 gap-3"><div><label class="block text-xs font-medium text-gray-600 mb-1">ИНН</label><input id="sInn" value="\${s.inn||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs font-medium text-gray-600 mb-1">КПП</label><input id="sKpp" value="\${s.kpp||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs font-medium text-gray-600 mb-1">Телефон</label><input id="sPhone1" value="\${s.phone||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
<div class="grid grid-cols-2 gap-3"><div><label class="block text-xs font-medium text-gray-600 mb-1">Юр. адрес</label><input id="sLegal" value="\${s.legal_address||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs font-medium text-gray-600 mb-1">Факт. адрес</label><input id="sActual" value="\${s.actual_address||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
<h4 class="text-xs font-bold text-gray-700 pt-2">Банковские реквизиты</h4>
<div class="grid grid-cols-2 gap-3"><div><label class="block text-xs font-medium text-gray-600 mb-1">Банк</label><input id="sBankName" value="\${s.bank_name||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs font-medium text-gray-600 mb-1">БИК</label><input id="sBankBik" value="\${s.bank_bik||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
<div class="grid grid-cols-2 gap-3"><div><label class="block text-xs font-medium text-gray-600 mb-1">Р/с</label><input id="sBankAcc" value="\${s.bank_account||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div><div><label class="block text-xs font-medium text-gray-600 mb-1">К/с</label><input id="sBankCorr" value="\${s.bank_corr_account||''}" class="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm"></div></div>
</div><button onclick="saveSettings()" class="mt-5 px-6 py-2.5 bg-brand-600 text-white font-semibold rounded-xl hover:bg-brand-700">Сохранить</button></div>\`}
async function saveSettings(){try{await api('POST','/crm/settings',{company_name:document.getElementById('sCompName').value,owner_name:document.getElementById('sOwnerName').value,owner_name_short:document.getElementById('sOwnerShort').value,ogrn:document.getElementById('sOgrn').value,inn:document.getElementById('sInn').value,kpp:document.getElementById('sKpp').value,phone:document.getElementById('sPhone1').value,legal_address:document.getElementById('sLegal').value,actual_address:document.getElementById('sActual').value,bank_name:document.getElementById('sBankName').value,bank_bik:document.getElementById('sBankBik').value,bank_account:document.getElementById('sBankAcc').value,bank_corr_account:document.getElementById('sBankCorr').value});alert('Сохранено!')}catch(e){alert(e.message)}}

render();
</script></body></html>`
