const router = require('express').Router()
const PDFDocument = require('pdfkit')
const db = require('../config/database')

const categories = {
  burger:   { label:'Burgers', note:'Incluyen papas fritas' },
  sandwich: { label:'Sandwiches', note:'' },
  pizza:    { label:'Pizzas y otras cosas', note:'' },
  papas:    { label:'Papas Fritas', note:'Toppings a eleccion' },
  bebida:   { label:'Bebidas', note:'' },
  trago:    { label:'Tragos de barra', note:'' },
  postre:   { label:'Postres', note:'' },
  extra:    { label:'Extras', note:'' },
  otro:     { label:'Otras opciones', note:'' },
}

const titleFor = (type) => type === 'tragos' ? 'Carta de tragos' : type === 'bebidas' ? 'Carta de bebidas' : 'Carta'
const fmt = (n) => '$' + Number(n).toLocaleString('es-AR')

const loadProducts = async (type) => {
  const drinksOnly = type === 'bebidas'
  const cocktailsOnly = type === 'tragos'
  const { rows } = await db.query(`
    SELECT * FROM products WHERE is_available = true
    ${drinksOnly ? "AND category = 'bebida'" : ''}
    ${cocktailsOnly ? "AND category = 'trago'" : ''}
    ORDER BY category, sort_order, name
  `)
  return rows
}

const groupProducts = (products) => {
  const grouped = {}
  for (const p of products) {
    if (!grouped[p.category]) grouped[p.category] = []
    grouped[p.category].push(p)
  }
  return grouped
}

router.get('/html', async (req, res) => {
  try {
    const title = titleFor(req.query.type)
    const grouped = groupProducts(await loadProducts(req.query.type))
    const now = new Date().toLocaleDateString('es-AR', { day:'numeric', month:'long', year:'numeric' })
    let sectionsHTML = ''

    for (const [cat, info] of Object.entries(categories)) {
      const prods = grouped[cat]
      if (!prods?.length) continue
      const mid = Math.ceil(prods.length / 2)
      const renderProduct = (p) => `
        <div class="product">
          <div class="product-top">
            <span class="product-name">${p.name}${p.is_featured ? ' <span class="star">*</span>' : ''}</span>
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
            <div class="col">${prods.slice(0, mid).map(renderProduct).join('')}</div>
            <div class="col">${prods.slice(mid).map(renderProduct).join('')}</div>
          </div>
        </div>`
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8"/>
  <title>La Pinta - ${title}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:Georgia,serif;background:#1a2535;color:#f0e8d8}
    .page{max-width:900px;margin:0 auto;padding:40px 32px}
    .no-print-bar{background:#2a3d5c;padding:12px 24px;display:flex;align-items:center;gap:16px}
    .print-btn{background:#c8a96a;color:#1a2535;border:0;padding:9px 24px;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer}
    .print-hint{font-size:12px;color:#8faec7}
    .header{text-align:center;padding:32px 0 24px;border-bottom:2px solid #c8a96a;margin-bottom:28px}
    .logo-circle{width:72px;height:72px;border-radius:50%;border:3px solid #c8a96a;display:flex;align-items:center;justify-content:center;margin:0 auto 10px;font-size:20px;font-weight:700;color:#c8a96a}
    .bar-name{font-size:34px;font-weight:700}
    .bar-sub{font-size:11px;letter-spacing:3px;color:#8faec7;text-transform:uppercase;margin-top:4px}
    .updated{font-size:11px;color:#5a7a96;margin-top:8px}
    .section{margin-bottom:24px;background:#22304a;border-radius:10px;overflow:hidden}
    .section-header{background:#2a3d5c;padding:11px 18px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #3a5070}
    .section-title{font-size:20px;font-weight:700;flex:1}
    .section-note{font-size:10px;color:#c8a96a;text-transform:uppercase;letter-spacing:1px;background:rgba(200,169,106,.12);padding:2px 9px;border-radius:20px;border:1px solid rgba(200,169,106,.3)}
    .section-columns{display:grid;grid-template-columns:1fr 1fr;padding:14px 18px}
    .col:first-child{border-right:1px solid #2a3d5c;padding-right:18px}
    .col:last-child{padding-left:18px}
    .product{padding:8px 0;border-bottom:1px solid #1a2535}
    .product-top{display:flex;justify-content:space-between;gap:8px}
    .product-name{font-size:13px;font-weight:600}
    .star,.product-price{color:#c8a96a}
    .product-price{font-size:13px;font-weight:700;white-space:nowrap}
    .product-desc{font-size:10px;color:#8faec7;margin-top:2px;font-style:italic;font-family:sans-serif}
    .footer{text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #2a3d5c;color:#5a7a96;font-size:10px;letter-spacing:1px;font-family:sans-serif}
    @media print{body{background:#1a2535!important;-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print-bar{display:none}}
  </style>
</head>
<body>
  <div class="no-print-bar">
    <button class="print-btn" onclick="window.print()">Imprimir / Guardar PDF</button>
    <span class="print-hint">Ctrl+P - Destino: Guardar como PDF - Graficos de fondo activado</span>
  </div>
  <div class="page">
    <div class="header">
      <div class="logo-circle">LP</div>
      <div class="bar-name">La Pinta</div>
      <div class="bar-sub">${title}</div>
      <div class="updated">Carta actualizada al ${now}</div>
    </div>
    ${sectionsHTML}
    <div class="footer">LA PINTA BURGER CLUB - PRECIOS EN PESOS ARGENTINOS - IVA INCLUIDO</div>
  </div>
</body>
</html>`)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al generar carta' })
  }
})

router.get('/pdf', async (req, res) => {
  try {
    const title = titleFor(req.query.type)
    const grouped = groupProducts(await loadProducts(req.query.type))
    const doc = new PDFDocument({ size: 'A4', margin: 42 })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `inline; filename="la-pinta-${title.toLowerCase().replaceAll(' ', '-')}.pdf"`)
    doc.pipe(res)

    const paintBg = () => doc.rect(0, 0, doc.page.width, doc.page.height).fill('#1a2535')
    paintBg()
    doc.fillColor('#f0e8d8').fontSize(28).font('Helvetica-Bold').text('La Pinta', { align: 'center' })
    doc.moveDown(0.2)
    doc.fillColor('#c8a96a').fontSize(12).font('Helvetica').text(title.toUpperCase(), { align: 'center' })
    doc.moveDown(1)

    for (const [cat, info] of Object.entries(categories)) {
      const prods = grouped[cat]
      if (!prods?.length) continue
      if (doc.y > 710) { doc.addPage(); paintBg() }
      doc.fillColor('#c8a96a').fontSize(16).font('Helvetica-Bold').text(info.label)
      if (info.note) doc.fillColor('#8faec7').fontSize(9).font('Helvetica').text(info.note.toUpperCase())
      doc.moveDown(0.35)

      for (const p of prods) {
        if (doc.y > 760) { doc.addPage(); paintBg() }
        const y = doc.y
        doc.fillColor('#f0e8d8').fontSize(11).font('Helvetica-Bold').text(p.name, 48, y, { width: 350 })
        doc.fillColor('#c8a96a').fontSize(11).font('Helvetica-Bold').text(fmt(p.current_price), 440, y, { width: 80, align: 'right' })
        if (p.description) {
          doc.fillColor('#8faec7').fontSize(8).font('Helvetica').text(p.description, 48, y + 14, { width: 410 })
          doc.y = y + 30
        } else {
          doc.y = y + 20
        }
        doc.strokeColor('#2a3d5c').moveTo(48, doc.y).lineTo(520, doc.y).stroke()
        doc.moveDown(0.25)
      }
      doc.moveDown(0.7)
    }

    doc.fillColor('#5a7a96').fontSize(8).text('PRECIOS EN PESOS ARGENTINOS - IVA INCLUIDO', 42, 790, { align: 'center' })
    doc.end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Error al generar PDF' })
  }
})

module.exports = router
