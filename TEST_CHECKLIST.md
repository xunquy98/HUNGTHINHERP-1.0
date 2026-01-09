
# HUNG THINH ERP - MANUAL TEST CHECKLIST

## P0: Critical Flows (Must Pass)

### 1. Sales & Fulfillment
- [ ] **Create Order (Paid)**: POS > Add Items > Pay Cash. Check: Inventory -qty, Transaction +amount, Order Completed.
- [ ] **Create Order (Debt)**: POS > Select Customer > Click "Ghi Nợ". Check: Debt Record created, Inventory -qty, Order Pending.
- [ ] **Fulfillment**: Orders > Select Order > Delivery. Create Note. Check: Order Status -> Shipping.

### 2. Inventory
- [ ] **Import**: Imports > Create > Select Supplier > Add Items > Confirm. Check: Inventory +qty, AVG Cost updates.
- [ ] **Adjust**: Inventory > Select Product > Adjust Stock. Check: Log entry created.

### 3. Finance
- [ ] **Collect Debt**: Debts > Receivable > Select > Payment. Check: Debt decreases, Transaction created.
- [ ] **Batch Payment**: Debts > "Thu nợ gộp" > Select Customer > Pay amount. Check: Oldest debts cleared first.

## P1: Important Flows

### 4. Returns
- [ ] **Sales Return**: Orders > Completed Order > Return. Check: Inventory +qty, Refund transaction or Debt deduction.
- [ ] **Purchase Return**: Imports > Completed Import > Return. Check: Inventory -qty.

### 5. System Health
- [ ] **Health Check**: Settings > Health Tab > Run Check. Should be 0 issues.
- [ ] **Backup**: Settings > Export.
- [ ] **Restore**: Settings > Restore (File from above). Check: Data consistency.

## P2: UX & Edge Cases
- [ ] **Search**: "Cmd+K" to find Order/Product.
- [ ] **Mobile Layout**: Verify Sidebar toggles and tables scroll horizontally.
- [ ] **Offline**: Disconnect Network -> Create Order. Reconnect -> Verify data persisted (Dexie).
