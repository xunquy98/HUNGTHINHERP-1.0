
# UI/UX Quality Assurance Checklist

## P0: Critical Functionality & Layout (Must Pass)

### 1. Responsive Shell
- [ ] **Sidebar**: Collapses correctly on desktop (Icon-only mode). Toggles completely on mobile (Drawer mode).
- [ ] **Topbar**: User profile and actions align correctly. "Quick Actions" dropdown works.
- [ ] **Scroll**: Main content area scrolls independently of Sidebar/Topbar. No double scrollbars.

### 2. Data Tables (Orders, Inventory, Partners)
- [ ] **Rendering**: Columns align with headers. Text truncation works for long names/IDs.
- [ ] **Empty States**: Shows friendly icon and message when no data/results found.
- [ ] **Selection**: Checkbox select-all and single-row select work. Highlights row on click.
- [ ] **Sorting**: Clicking headers sorts data (ASC/DESC). Active sort column indicated.

### 3. Critical Actions
- [ ] **Creation**: "Thêm mới" modals open, validate required fields (red border/text), and close on success.
- [ ] **Destructive**: Delete actions trigger a `ConfirmModal` (Red warning style). Cancel dismisses it.
- [ ] **POS Checkout**: Cart calculates totals, discount, VAT correctly. "Thanh toán" clears cart and creates Order.

### 4. Overlays
- [ ] **Drawers**: Slide in from right. content scrolls internally. Clicking backdrop closes.
- [ ] **Modals**: Centered. Background blurred. `Esc` key closes them. Focus trapped (optional but good).

## P1: Visual Polish & Feedback

### 1. Feedback
- [ ] **Toasts**: Success/Error messages appear top-right (or designated area) and auto-dismiss.
- [ ] **Loading**: Buttons show spinner (`loading` prop) during async actions. Tables show Skeleton rows.

### 2. Consistency
- [ ] **Padding**: Page content has uniform padding (standard `p-6` or `24px`).
- [ ] **Colors**: Primary blue (`blue-600`) used for main actions. Red (`red-600`) for destructive.
- [ ] **Typography**: Headings use `Be Vietnam Pro`. Monospace used for Codes (SKU, Order ID).

### 3. Features
- [ ] **Search**: Global search (Cmd+K) opens palette. Typing filters results. Navigation works.
- [ ] **Export**: "Export Excel/CSV" buttons trigger a file download.
- [ ] **Print**: Print preview modals render a clean, printable layout (A4 ratio).

## P2: Edge Cases

- [ ] **Long Text**: Extremely long product names do not break layout (should truncate or wrap).
- [ ] **Zero State**: Dashboard charts handle 0 data gracefully.
- [ ] **Input Types**: Number inputs prevent invalid characters where possible.
