// Tiny demo shop with planted bugs. Add ?fixed to the URL to turn the fixes on.
// (window.BUG2TEST_FIXED is set by the e2e test server to check the generated test passes once fixed.)
const FIXED = window.BUG2TEST_FIXED === true || new URLSearchParams(location.search).has('fixed');

const products = [
  { id: 1, name: 'Chai mug', price: 499 },
  { id: 2, name: 'Notebook', price: 499 },
  { id: 3, name: 'Desk lamp', price: 1299 },
];
let cart = [
  { ...products[0], qty: 1 },
  { ...products[1], qty: 1 },
];
let discount = 0;

const rupees = (n) => '₹' + n.toLocaleString('en-IN');
const $ = (id) => document.getElementById(id);

function total() {
  return cart.reduce((sum, i) => sum + i.price * i.qty, 0) * (1 - discount);
}

function renderProducts() {
  $('products').innerHTML = products
    .map(
      (p) => `<div class="card"><div>${p.name}</div><div>${rupees(p.price)}</div>
      <button data-testid="add-item-${p.id}" data-id="${p.id}">Add to cart</button></div>`,
    )
    .join('');
}

function renderCart({ updateTotal = true } = {}) {
  $('cart').innerHTML = cart.length
    ? cart
        .map(
          (i) => `<li class="item"><span>${i.name} × ${i.qty}</span><span>${rupees(i.price * i.qty)}</span>
          <button data-testid="remove-item-${i.id}" data-id="${i.id}" aria-label="Remove ${i.name}">Remove</button></li>`,
        )
        .join('')
    : '<li class="item">Cart is empty</li>';
  if (updateTotal) $('total').textContent = rupees(total());
}

$('products').addEventListener('click', (e) => {
  const id = Number(e.target.dataset?.id);
  if (!id) return;
  const found = cart.find((i) => i.id === id);
  if (found) found.qty++;
  else cart.push({ ...products.find((p) => p.id === id), qty: 1 });
  renderCart();
  // Planted: the API does not exist on this static site, so this request fails (404).
  fetch('./api/cart', { method: 'POST', body: JSON.stringify({ id }) }).catch(() => {});
});

$('cart').addEventListener('click', (e) => {
  const id = Number(e.target.dataset?.id);
  if (!id) return;
  cart = cart.filter((i) => i.id !== id);
  // BUG 1: the total is not updated after removing an item.
  renderCart({ updateTotal: FIXED });
});

$('coupon').addEventListener('input', (e) => {
  const code = e.target.value.trim();
  // BUG 2: coupon codes are case sensitive, so "save10" is rejected.
  const ok = FIXED ? code.toUpperCase() === 'SAVE10' : code === 'SAVE10';
  discount = ok ? 0.1 : 0;
  $('coupon-msg').textContent = code ? (ok ? '10% off applied' : 'Invalid coupon') : '';
  $('total').textContent = rupees(total());
});

$('checkout').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!FIXED && !$('email').value) {
    // BUG 3: crashes instead of showing a message when email is empty.
    console.error(new TypeError("Cannot read properties of undefined (reading 'trim')"));
    return;
  }
  location.hash = 'order-placed';
  $('coupon-msg').textContent = $('email').value ? 'Order placed!' : 'Please enter your email';
});

renderProducts();
renderCart();
