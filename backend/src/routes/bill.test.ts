import { describe, it, expect } from 'vitest';

function buildBill(order: Record<string, any>) {
  const products = Array.isArray(order.products) ? order.products : [];
  const lineItems = products.map((p: any) => {
    const quantity = Number(p.quantity ?? 1);
    const unitPrice = Number(p.unit_price ?? p.price ?? 0);
    const lineTotal = Number(p.total_price ?? p.total ?? unitPrice * quantity);
    return { product_id: p.product_id ?? p.id ?? null, name: p.name ?? p.product?.name ?? 'Item', quantity, unit_price: unitPrice, line_total: lineTotal };
  });
  const subtotal = Number(order.subtotal_price ?? lineItems.reduce((s: number, i: any) => s + i.line_total, 0));
  const taxes = Number(order.total_tax ?? order.tax ?? 0);
  const charges = Number(order.total_charges ?? order.charge ?? 0);
  const discount = Number(order.total_discount ?? 0);
  const total = Number(order.total_price ?? subtotal + taxes + charges - discount);
  const payments = Array.isArray(order.payments) ? order.payments : [];
  const amountPaid = payments.reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const balanceDue = Math.max(0, Number((total - amountPaid).toFixed(2)));
  return {
    order_id: order.id ?? null, reference: order.reference ?? order.number ?? null,
    table_id: order.table_id ?? order.table?.id ?? null, currency: 'EGP',
    items: lineItems, subtotal: Number(subtotal.toFixed(2)), taxes: Number(taxes.toFixed(2)),
    charges: Number(charges.toFixed(2)), discount: Number(discount.toFixed(2)),
    total: Number(total.toFixed(2)), amount_paid: Number(amountPaid.toFixed(2)),
    balance_due: balanceDue, is_paid: balanceDue <= 0,
  };
}

describe('buildBill', () => {
  it('handles empty order', () => {
    const bill = buildBill({});
    expect(bill.items).toEqual([]);
    expect(bill.subtotal).toBe(0);
    expect(bill.total).toBe(0);
    expect(bill.is_paid).toBe(true);
  });

  it('computes line items from products', () => {
    const bill = buildBill({ id: 'ord-1', products: [
      { product_id: 'p1', name: 'Greek Salad', quantity: 2, unit_price: 8.5, total_price: 17.0 },
      { product_id: 'p2', name: 'Moussaka', quantity: 1, unit_price: 12.0, total_price: 12.0 },
    ]});
    expect(bill.items).toHaveLength(2);
    expect(bill.items[0].line_total).toBe(17.0);
    expect(bill.subtotal).toBe(29.0);
  });

  it('uses total_price when provided', () => {
    const bill = buildBill({ id: 'ord-2', total_price: 100.0, subtotal_price: 85.0, total_tax: 10.0, total_charges: 5.0, total_discount: 0 });
    expect(bill.total).toBe(100.0);
    expect(bill.subtotal).toBe(85.0);
    expect(bill.taxes).toBe(10.0);
  });

  it('computes total from components when total_price missing', () => {
    const bill = buildBill({ products: [{ name: 'Item', quantity: 1, unit_price: 50, total_price: 50 }], total_tax: 5, total_charges: 2.5, total_discount: 0 });
    expect(bill.total).toBe(57.5);
  });

  it('deducts discount from total', () => {
    const bill = buildBill({ products: [{ name: 'Item', quantity: 1, unit_price: 100, total_price: 100 }], total_discount: 20, total_tax: 0, total_charges: 0 });
    expect(bill.total).toBe(80);
  });

  it('calculates balance due from payments', () => {
    const bill = buildBill({ id: 'ord-3', total_price: 100.0, payments: [{ amount: 60.0 }, { amount: 30.0 }] });
    expect(bill.amount_paid).toBe(90.0);
    expect(bill.balance_due).toBe(10.0);
    expect(bill.is_paid).toBe(false);
  });

  it('marks as paid when balance is zero', () => {
    const bill = buildBill({ id: 'ord-4', total_price: 50.0, payments: [{ amount: 50.0 }] });
    expect(bill.is_paid).toBe(true);
  });

  it('marks as paid when overpaid', () => {
    const bill = buildBill({ id: 'ord-5', total_price: 50.0, payments: [{ amount: 60.0 }] });
    expect(bill.balance_due).toBe(0);
    expect(bill.is_paid).toBe(true);
  });

  it('handles missing quantities (defaults to 1)', () => {
    const bill = buildBill({ products: [{ name: 'Item', unit_price: 10 }] });
    expect(bill.items[0].quantity).toBe(1);
    expect(bill.items[0].line_total).toBe(10);
  });

  it('handles products with price instead of unit_price', () => {
    const bill = buildBill({ products: [{ name: 'Item', price: 15, quantity: 2, total: 30 }] });
    expect(bill.items[0].unit_price).toBe(15);
    expect(bill.items[0].line_total).toBe(30);
  });
});
