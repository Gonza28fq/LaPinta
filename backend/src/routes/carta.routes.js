const router = require('express').Router()
const db = require('../config/database')

// Ruta PÚBLICA — no requiere autenticación
// GET /api/carta/html
router.get('/html', async (req, res) => {
  try {
    const drinksOnly = req.query.type === 'bebidas'
    const cocktailsOnly = req.query.type === 'tragos'
    const { rows: products } = await db.query(`
      SELECT * FROM products WHERE is_available = true
      ${drinksOnly ? "AND category = 'bebida'" : ''}
      ${cocktailsOnly ? "AND category = 'trago'" : ''}
      ORDER BY category, sort_order, name
    `)

    const categories = {
      burger:   { label:'Burgers',              note:'Incluyen papas fritas' },
      sandwich: { label:'Sandwiches',            note:'' },
      pizza:    { label:'Pizzas y otras cosas...', note:'' },
      papas:    { label:'Papas Fritas',          note:'Toppings a elección' },
      bebida:   { label:'Bebidas',               note:'' },
      trago:    { label:'Tragos de barra',       note:'' },
      postre:   { label:'Postres',               note:'' },
      extra:    { label:'Extras',                note:'' },
      otro:     { label:'Otras opciones',        note:'' },
    }

    const grouped = {}
    for (const p of products) {
      if (!grouped[p.category]) grouped[p.category] = []
      grouped[p.category].push(p)
    }

    const fmt = (n) => '$' + Number(n).toLocaleString('es-AR')
    const now = new Date().toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' })

    let sectionsHTML = ''
    for (const [cat, info] of Object.entries(categories)) {
      const prods = grouped[cat]
      if (!prods || prods.length === 0) continue
      const mid   = Math.ceil(prods.length / 2)
      const left  = prods.slice(0, mid)
      const right = prods.slice(mid)
      const renderProduct = (p) => `
        <div class="product">
          <div class="product-top">
            <span class="product-name">${p.name}${p.is_featured ? ' <span class="star">★</span>' : ''}</span>
            <span class="product-price">${fmt(p.current_price)}</span>
          </div>
          ${p.description ? `<div class="product-desc">${p.description}</div>` : ''}
        </div>`
      sectionsHTML += `
        <div class="section">
          <div class="section-header">
            <h2 class="section-title">${info.label}</h2>
            ${info.note ? `<span class="section-note">${info.note}</span>` : ''}
          </div>
          <div class="section-columns">
            <div class="col">${left.map(renderProduct).join('')}</div>
            <div class="col">${right.map(renderProduct).join('')}</div>
          </div>
        </div>`
    }

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>La Pinta Burger Club — ${cocktailsOnly ? 'Carta de tragos' : drinksOnly ? 'Carta de bebidas' : 'Carta'}</title>
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:Georgia,serif; background:#1a2535; color:#f0e8d8; padding:0; }
    .page { max-width:900px; margin:0 auto; padding:40px 32px; }
    .no-print-bar { background:#2a3d5c; padding:12px 24px; display:flex; align-items:center; gap:16px; margin-bottom:0; }
    .print-btn { background:#C8A96A; color:#1a2535; border:none; padding:9px 24px; border-radius:6px; font-size:14px; font-weight:700; cursor:pointer; }
    .print-hint { font-size:12px; color:#8faec7; }
    .header { text-align:center; padding:32px 0 24px; border-bottom:2px solid #C8A96A; margin-bottom:28px; }
    .logo-circle { width:72px; height:72px; border-radius:50%; border:3px solid #C8A96A; display:flex; align-items:center; justify-content:center; margin:0 auto 10px; font-size:20px; font-weight:700; color:#C8A96A; }
    .bar-name { font-size:34px; font-weight:700; color:#f0e8d8; }
    .bar-sub  { font-size:11px; letter-spacing:3px; color:#8faec7; text-transform:uppercase; margin-top:4px; }
    .updated  { font-size:11px; color:#5a7a96; margin-top:8px; }
    .section  { margin-bottom:24px; background:#22304a; border-radius:10px; overflow:hidden; }
    .section-header { background:#2a3d5c; padding:11px 18px; display:flex; align-items:center; gap:12px; border-bottom:1px solid #3a5070; }
    .section-title  { font-size:20px; font-weight:700; color:#f0e8d8; flex:1; font-family:Georgia,serif; }
    .section-note   { font-size:10px; color:#C8A96A; text-transform:uppercase; letter-spacing:1px; background:rgba(200,169,106,.12); padding:2px 9px; border-radius:20px; border:1px solid rgba(200,169,106,.3); }
    .section-columns { display:grid; grid-template-columns:1fr 1fr; padding:14px 18px; gap:0; }
    .col { display:flex; flex-direction:column; gap:0; }
    .col:first-child { border-right:1px solid #2a3d5c; padding-right:18px; }
    .col:last-child  { padding-left:18px; }
    .product { padding:8px 0; border-bottom:1px solid #1a2535; }
    .product:last-child { border-bottom:none; }
    .product-top { display:flex; justify-content:space-between; align-items:baseline; gap:8px; }
    .product-name  { font-size:13px; font-weight:600; color:#f0e8d8; font-family:Georgia,serif; }
    .star          { color:#C8A96A; font-size:11px; }
    .product-price { font-size:13px; font-weight:700; color:#C8A96A; white-space:nowrap; }
    .product-desc  { font-size:10px; color:#8faec7; margin-top:2px; font-style:italic; font-family:sans-serif; }
    .footer { text-align:center; margin-top:24px; padding-top:16px; border-top:1px solid #2a3d5c; color:#5a7a96; font-size:10px; letter-spacing:1px; font-family:sans-serif; }
    @media print {
      body { background:#1a2535 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .no-print-bar { display:none; }
    }
  </style>
</head>
<body>
  <div class="no-print-bar">
    <button class="print-btn" onclick="window.print()">🖨 Imprimir / Guardar PDF</button>
    <span class="print-hint">Ctrl+P → Destino: Guardar como PDF → Más ajustes → Gráficos de fondo: activado</span>
  </div>
  <div class="page">
    <div class="header">
      <div class="logo-circle">LP</div>
      <div class="bar-name">La Pinta</div>
      <div class="bar-sub">${cocktailsOnly ? 'Carta de tragos' : drinksOnly ? 'Carta de bebidas' : 'Burger Club'}</div>
      <div class="updated">Carta actualizada al ${now}</div>
    </div>
    ${sectionsHTML}
    <div class="footer">LA PINTA BURGER CLUB · PRECIOS EN PESOS ARGENTINOS · IVA INCLUIDO</div>
  </div>
</body>
</html>`

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(html)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al generar carta' })
  }
})

module.exports = router
