const METHOD_LABEL = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  transfer: 'Transferencia',
  qr: 'QR',
}

export function openReceiptWindow() {
  return window.open('', 'lapinta-ticket', 'width=360,height=640')
}

export function printReceipt({ order, items = [], method, tip = 0, targetWindow = null }) {
  const total = Number(order.total || 0)
  const tipAmount = Number(tip || 0)
  const paidTotal = total + tipAmount
  const date = new Date().toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const rows = items.map(item => `
    <tr>
      <td>${item.quantity}x</td>
      <td>${item.product_name}</td>
      <td class="right">$${Number(item.subtotal || 0).toLocaleString('es-AR')}</td>
    </tr>
  `).join('')

  const win = targetWindow || openReceiptWindow()
  if (!win) return
  win.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Comprobante La Pinta</title>
  <style>
    @page { size: 80mm auto; margin: 4mm; }
    * { box-sizing: border-box; }
    body { margin: 0; color: #111; font-family: Consolas, "Courier New", monospace; font-size: 11px; }
    .ticket { width: 72mm; padding: 4mm 2mm; }
    .center { text-align: center; }
    .brand { font-size: 16px; font-weight: 700; letter-spacing: .04em; }
    .muted { color: #444; }
    .line { border-top: 1px dashed #111; margin: 8px 0; }
    table { width: 100%; border-collapse: collapse; }
    td { padding: 2px 0; vertical-align: top; }
    td:first-child { width: 24px; }
    .right { text-align: right; white-space: nowrap; }
    .total { font-size: 15px; font-weight: 700; }
    .small { font-size: 10px; }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center">
      <div class="brand">LA PINTA</div>
      <div>BURGER CLUB</div>
      <div class="muted">Comprobante no fiscal</div>
    </div>
    <div class="line"></div>
    <div>Fecha: ${date}</div>
    <div>Pedido: #${String(order.id || '').slice(-4).toUpperCase()}</div>
    <div>${order.table_number ? `Mesa: ${order.table_number}` : 'Delivery'}</div>
    ${order.customer_name ? `<div>Cliente: ${order.customer_name}</div>` : ''}
    <div class="line"></div>
    <table>${rows}</table>
    <div class="line"></div>
    <table>
      <tr><td>Subtotal</td><td class="right">$${total.toLocaleString('es-AR')}</td></tr>
      ${tipAmount > 0 ? `<tr><td>Propina</td><td class="right">$${tipAmount.toLocaleString('es-AR')}</td></tr>` : ''}
      <tr class="total"><td>Total</td><td class="right">$${paidTotal.toLocaleString('es-AR')}</td></tr>
      <tr><td>Pago</td><td class="right">${METHOD_LABEL[method] || method}</td></tr>
    </table>
    <div class="line"></div>
    <div class="center small">Gracias por su compra</div>
  </div>
  <script>
    window.onload = function () {
      window.print();
      setTimeout(function () { window.close(); }, 500);
    };
  </script>
</body>
</html>`)
  win.document.close()
}
