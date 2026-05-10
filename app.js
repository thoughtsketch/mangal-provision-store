const config = window.SHOP_CONFIG;
const catalog = window.CATALOG;
const cart = new Map();
let activeCategory = 'All';

const rupee = n => '₹' + Math.round(n || 0);
const qs = id => document.getElementById(id);
function productKey(cat, p){ return p.id; }
function selectedPrice(id){ const el = qs('var_'+id); return el ? Number(el.value) : Number(qs('price_'+id).value); }
function selectedVariant(id){ const el = qs('var_'+id); return el ? el.options[el.selectedIndex].text : 'Standard'; }
function showToast(msg){ const t=qs('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2600); }

function init(){
  qs('waTop').href = `https://wa.me/${config.ownerWhatsApp}?text=${encodeURIComponent('Hello, I want to place an order from Mangal Provision Super Shop.')}`;
  renderTabs(); renderProducts(); renderCart();
  qs('search').addEventListener('input', renderProducts);
  qs('submitBtn').addEventListener('click', submitOrder);
}
function renderTabs(){
  const cats = ['All', ...Object.keys(catalog)];
  qs('categoryTabs').innerHTML = cats.map(c=>`<button class="tab ${c===activeCategory?'active':''}" data-cat="${c}">${c}</button>`).join('');
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{ activeCategory=b.dataset.cat; renderTabs(); renderProducts(); });
}
function priceLabel(p){
  if(p.variants) return `${rupee(p.variants[0].price)}–${rupee(p.variants[p.variants.length-1].price)}/${p.unit||'kg'}`;
  return `${rupee(p.price)}/${p.unit||'kg'}`;
}
function productCard(cat,p){
  const id = productKey(cat,p);
  const variant = p.variants ? `<select id="var_${id}" onchange="onVariant('${id}','${cat}',${JSON.stringify(p).replaceAll('"','&quot;')})">${p.variants.map(v=>`<option value="${v.price}">${v.label}</option>`).join('')}</select>` : `<input type="hidden" id="price_${id}" value="${p.price}"><select disabled><option>Standard</option></select>`;
  const q = cart.get(id)?.qty || 0;
  return `<div class="product">
    <div class="p-name">${p.name}</div>
    <div class="p-price">${priceLabel(p)}</div>
    ${variant}
    <div class="qty"><button onclick="changeQty('${id}','${cat}',${JSON.stringify(p).replaceAll('"','&quot;')},-0.5)">−</button><input id="qty_${id}" value="${q}" inputmode="decimal" onchange="setQty('${id}','${cat}',${JSON.stringify(p).replaceAll('"','&quot;')},this.value)"><button onclick="changeQty('${id}','${cat}',${JSON.stringify(p).replaceAll('"','&quot;')},0.5)">+</button></div>
  </div>`;
}
function renderProducts(){
  const term = qs('search').value.trim().toLowerCase();
  let html='';
  Object.entries(catalog).forEach(([cat,items])=>{
    if(activeCategory !== 'All' && activeCategory !== cat) return;
    const filtered = items.filter(p => !term || p.name.toLowerCase().includes(term) || cat.toLowerCase().includes(term));
    if(!filtered.length) return;
    html += `<div class="category"><h3>• ${cat}</h3><div class="product-grid">${filtered.map(p=>productCard(cat,p)).join('')}</div></div>`;
  });
  qs('productList').innerHTML = html || '<p class="muted">No products found.</p>';
}
window.changeQty = function(id,cat,p,delta){ const cur=Number(qs('qty_'+id)?.value || 0); setQty(id,cat,p,Math.max(0,cur+delta)); }
window.setQty = function(id,cat,p,val){
  let qty = Math.max(0, Number(val)||0);
  const input=qs('qty_'+id); if(input) input.value=qty;
  if(qty>0){ cart.set(id,{id,category:cat,name:p.name,unit:p.unit||'kg',qty,price:selectedPrice(id),variant:selectedVariant(id)}); } else { cart.delete(id); }
  renderCart();
}
window.onVariant = function(id,cat,p){ if(cart.has(id)){ const qty=cart.get(id).qty; setQty(id,cat,p,qty); } renderCart(); }
function renderCart(){
  const items=[...cart.values()]; qs('cartCountTop').textContent=items.length;
  if(!items.length){ qs('cartItems').className='cart-items empty'; qs('cartItems').innerHTML='Add products above to see your order summary.'; qs('total').textContent='₹0'; return; }
  qs('cartItems').className='cart-items';
  let total=0;
  qs('cartItems').innerHTML = items.map(i=>{ const amt=i.qty*i.price; total+=amt; return `<div class="cart-row"><div><strong>${i.name}</strong><div class="small muted">${i.variant} · ${i.qty} ${i.unit} × ${rupee(i.price)}</div></div><strong>${rupee(amt)}</strong></div>`;}).join('');
  qs('total').textContent = rupee(total);
}
function validate(){
  if(!qs('name').value.trim()) return 'Please enter full name.';
  const ph = qs('phone').value.replace(/\D/g,''); if(ph.length < 10) return 'Please enter a valid mobile number.';
  if(!qs('address').value.trim()) return 'Please enter delivery address.';
  if(cart.size===0) return 'Please add at least one product.';
  return '';
}
function buildOrder(){
  const items=[...cart.values()]; const total=items.reduce((s,i)=>s+i.qty*i.price,0);
  return { createdAt:new Date().toISOString(), name:qs('name').value.trim(), phone:qs('phone').value.trim(), address:qs('address').value.trim(), deliveryTime:qs('deliveryTime').value, payment:qs('payment').value, notes:qs('notes').value.trim(), items, total };
}
function whatsAppText(order){
  let msg = `🌾 *New Order - ${config.shopName}*\n\n👤 *Name:* ${order.name}\n📞 *Phone:* ${order.phone}\n📍 *Address:* ${order.address}\n🕐 *Delivery:* ${order.deliveryTime}\n💳 *Payment:* ${order.payment}\n\n📦 *ORDER ITEMS:*\n`;
  order.items.forEach(i=> msg += `• ${i.name} (${i.variant}): ${i.qty} ${i.unit} × ${rupee(i.price)} = ${rupee(i.qty*i.price)}\n`);
  msg += `\n💰 *Estimated Total:* ${rupee(order.total)}`;
  if(order.notes) msg += `\n\n📝 *Notes:* ${order.notes}`;
  return msg;
}
async function submitOrder(){
  const err=validate(); if(err){ showToast(err); return; }
  const order=buildOrder();
  const btn=qs('submitBtn'); btn.disabled=true; btn.textContent='Submitting...';
  try{
    if(config.appsScriptUrl && !config.appsScriptUrl.includes('PASTE_YOUR')){
      await fetch(config.appsScriptUrl, { method:'POST', mode:'no-cors', headers:{'Content-Type':'text/plain;charset=utf-8'}, body:JSON.stringify(order) });
    }
    showToast('Order prepared. Opening WhatsApp...');
    setTimeout(()=>{ window.open(`https://wa.me/${config.ownerWhatsApp}?text=${encodeURIComponent(whatsAppText(order))}`,'_blank'); },600);
  }catch(e){ showToast('Could not save to Sheet. WhatsApp order will open.'); window.open(`https://wa.me/${config.ownerWhatsApp}?text=${encodeURIComponent(whatsAppText(order))}`,'_blank'); }
  finally{ btn.disabled=false; btn.textContent='📦 Place My Order'; }
}
init();
