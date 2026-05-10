const config = window.SHOP_CONFIG;
const catalog = window.CATALOG;
const cart = new Map();
let activeCategory = 'All';

const $ = id => document.getElementById(id);
const rupee = n => '₹' + Math.round(n || 0);
const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[c]);

function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

function newOrderId() {
  const d = new Date();
  const pad = n => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ORD-${stamp}-${rand}`;
}

function waLink(text) {
  return `https://wa.me/${config.ownerWhatsApp}?text=${encodeURIComponent(text)}`;
}

function findProduct(id) {
  for (const [cat, items] of Object.entries(catalog)) {
    const p = items.find(x => x.id === id);
    if (p) return { cat, p };
  }
  return null;
}

function priceLabel(p) {
  if (p.variants) {
    return `${rupee(p.variants[0].price)}–${rupee(p.variants[p.variants.length - 1].price)}/${p.unit || 'kg'}`;
  }
  return `${rupee(p.price)}/${p.unit || 'kg'}`;
}

function selectedPrice(id) {
  const sel = $('var_' + id);
  if (sel) return Number(sel.value);
  const fix = $('price_' + id);
  return fix ? Number(fix.value) : 0;
}

function selectedVariant(id) {
  const sel = $('var_' + id);
  return sel ? sel.options[sel.selectedIndex].text : 'Standard';
}

function renderTabs() {
  const cats = ['All', ...Object.keys(catalog)];
  $('categoryTabs').innerHTML = cats.map(c =>
    `<button class="tab ${c === activeCategory ? 'active' : ''}" data-cat="${escapeHtml(c)}">${escapeHtml(c)}</button>`
  ).join('');
}

function productCard(cat, p) {
  const id = p.id;
  const q = cart.get(id)?.qty || 0;
  const variant = p.variants
    ? `<select class="variant-select" id="var_${id}" data-id="${id}" aria-label="Variant for ${escapeHtml(p.name)}">${
        p.variants.map(v => `<option value="${v.price}">${escapeHtml(v.label)}</option>`).join('')
      }</select>`
    : `<input type="hidden" id="price_${id}" value="${p.price}"><div class="variant-fixed">Standard</div>`;
  return `<div class="product">
    <div class="p-name">${escapeHtml(p.name)}</div>
    <div class="p-price">${priceLabel(p)}</div>
    ${variant}
    <div class="qty" role="group" aria-label="Quantity for ${escapeHtml(p.name)}">
      <button data-action="qty" data-id="${id}" data-delta="-0.5" aria-label="Decrease ${escapeHtml(p.name)}">−</button>
      <input class="qty-input" id="qty_${id}" data-id="${id}" value="${q}" inputmode="decimal" aria-label="Quantity for ${escapeHtml(p.name)}">
      <button data-action="qty" data-id="${id}" data-delta="0.5" aria-label="Increase ${escapeHtml(p.name)}">+</button>
    </div>
  </div>`;
}

function renderProducts() {
  const term = $('search').value.trim().toLowerCase();
  let html = '';
  Object.entries(catalog).forEach(([cat, items]) => {
    if (activeCategory !== 'All' && activeCategory !== cat) return;
    const filtered = items.filter(p => !term || p.name.toLowerCase().includes(term) || cat.toLowerCase().includes(term));
    if (!filtered.length) return;
    html += `<div class="category"><h3>• ${escapeHtml(cat)}</h3><div class="product-grid">${filtered.map(p => productCard(cat, p)).join('')}</div></div>`;
  });
  $('productList').innerHTML = html || '<p class="muted">No products found.</p>';
}

function setQty(id, val) {
  const qty = Math.max(0, +(Number(val) || 0).toFixed(2));
  const input = $('qty_' + id);
  if (input) input.value = qty;
  if (qty > 0) {
    const found = findProduct(id);
    if (!found) return;
    cart.set(id, {
      id,
      category: found.cat,
      name: found.p.name,
      unit: found.p.unit || 'kg',
      qty,
      price: selectedPrice(id),
      variant: selectedVariant(id)
    });
  } else {
    cart.delete(id);
  }
  renderCart();
}

function renderCart() {
  const items = [...cart.values()];
  $('cartCountTop').textContent = items.length;
  if (!items.length) {
    $('cartItems').className = 'cart-items empty';
    $('cartItems').innerHTML = 'Add products above to see your order summary.';
    $('total').textContent = '₹0';
    return;
  }
  $('cartItems').className = 'cart-items';
  let total = 0;
  $('cartItems').innerHTML = items.map(i => {
    const amt = i.qty * i.price;
    total += amt;
    return `<div class="cart-row">
      <div><strong>${escapeHtml(i.name)}</strong>
        <div class="small muted">${escapeHtml(i.variant)} · ${i.qty} ${i.unit} × ${rupee(i.price)}</div>
      </div>
      <strong>${rupee(amt)}</strong>
    </div>`;
  }).join('');
  $('total').textContent = rupee(total);
}

function validate() {
  if (!$('name').value.trim()) return 'Please enter full name.';
  const ph = $('phone').value.replace(/\D/g, '');
  if (ph.length < 10) return 'Please enter a valid 10-digit mobile number.';
  if (!$('address').value.trim()) return 'Please enter delivery address.';
  if (cart.size === 0) return 'Please add at least one product.';
  return '';
}

function buildOrder() {
  const items = [...cart.values()];
  const total = items.reduce((s, i) => s + i.qty * i.price, 0);
  return {
    orderId: newOrderId(),
    createdAt: new Date().toISOString(),
    name: $('name').value.trim(),
    phone: $('phone').value.trim(),
    address: $('address').value.trim(),
    deliveryTime: $('deliveryTime').value,
    payment: $('payment').value,
    notes: $('notes').value.trim(),
    items,
    total
  };
}

function whatsAppText(order) {
  let msg = `🌾 *New Order – ${config.shopName}*\n`;
  msg += `🆔 *Order ID:* ${order.orderId}\n\n`;
  msg += `👤 *Name:* ${order.name}\n📞 *Phone:* ${order.phone}\n📍 *Address:* ${order.address}\n🕐 *Delivery:* ${order.deliveryTime}\n💳 *Payment:* ${order.payment}\n\n`;
  msg += `📦 *ORDER ITEMS:*\n`;
  order.items.forEach(i =>
    msg += `• ${i.name} (${i.variant}): ${i.qty} ${i.unit} × ${rupee(i.price)} = ${rupee(i.qty * i.price)}\n`
  );
  msg += `\n💰 *Estimated Total:* ${rupee(order.total)}`;
  if (order.notes) msg += `\n\n📝 *Notes:* ${order.notes}`;
  return msg;
}

async function saveToSheet(order) {
  if (!config.appsScriptUrl || config.appsScriptUrl.includes('PASTE_YOUR')) return false;
  try {
    await fetch(config.appsScriptUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(order)
    });
    return true;
  } catch (e) {
    return false;
  }
}

async function submitOrder() {
  const err = validate();
  if (err) { showToast(err); return; }
  const order = buildOrder();
  const btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = 'Submitting...';
  try {
    const saved = await saveToSheet(order);
    showToast(saved ? 'Order saved. Opening WhatsApp...' : 'Opening WhatsApp...');
    setTimeout(() => {
      window.open(waLink(whatsAppText(order)), '_blank');
    }, 500);
  } catch (e) {
    showToast('Could not save order. Opening WhatsApp...');
    window.open(waLink(whatsAppText(order)), '_blank');
  } finally {
    btn.disabled = false;
    btn.textContent = '📦 Place My Order';
  }
}

function init() {
  $('waTop').href = waLink('Hello, I want to place an order from Mangal Provision Super Shop.');
  renderTabs();
  renderProducts();
  renderCart();

  $('search').addEventListener('input', renderProducts);
  $('submitBtn').addEventListener('click', submitOrder);

  $('categoryTabs').addEventListener('click', e => {
    const t = e.target.closest('.tab');
    if (!t) return;
    activeCategory = t.dataset.cat;
    renderTabs();
    renderProducts();
  });

  $('productList').addEventListener('click', e => {
    const btn = e.target.closest('button[data-action="qty"]');
    if (!btn) return;
    const id = btn.dataset.id;
    const delta = Number(btn.dataset.delta);
    const cur = Number($('qty_' + id)?.value || 0);
    setQty(id, Math.max(0, cur + delta));
  });

  $('productList').addEventListener('change', e => {
    const id = e.target.dataset.id;
    if (!id) return;
    if (e.target.classList.contains('qty-input')) {
      setQty(id, Number(e.target.value) || 0);
    } else if (e.target.classList.contains('variant-select')) {
      const cur = cart.get(id);
      if (cur) setQty(id, cur.qty);
    }
  });
}

init();
