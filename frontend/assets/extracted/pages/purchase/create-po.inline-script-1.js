const poFormEl = document.getElementById("createPoForm");
const poDateEl = document.getElementById("poDate");
const deliveryDateEl = document.getElementById("deliveryDate");
const vendorEl = document.getElementById("poVendor");
const poNumberEl = document.getElementById("poNumber");
const batchNumberEl = document.getElementById("batchNumber");
const generatePoBtn = document.getElementById("generatePoBtn");
const generateBatchBtn = document.getElementById("generateBatchBtn");
const addPoRowBtn = document.getElementById("addPoRowBtn");
const poItemsBodyEl = document.getElementById("poItemsBody");
const poGrandTotalEl = document.getElementById("poGrandTotal");
const savePoBtn = document.getElementById("savePoBtn");

if (!localStorage.getItem("token")) {
    window.location.href = "../login.html";
}

const rawRole = String(localStorage.getItem("role") || "").toLowerCase();
const role = ["coordinator", "cordinator", "co-ordinator", "co ordinator", "co_ordinator"].includes(rawRole) ? "user" : rawRole;
const selectedDb = String(localStorage.getItem("selectedDatabaseName") || "").toLowerCase();
const isTrainingUser = role === "user" && selectedDb === "demo";
const canManage = role === "admin" || role === "manager" || isTrainingUser;
const canViewPo = canManage
    ? true
    : (role === "user"
        ? (typeof hasUserActionPermission === "function"
            ? (hasUserActionPermission("/purchase/create-po.html", "view") || hasUserActionPermission("/purchase/create-po.html", "add"))
            : false)
        : false);
const canCreatePo = canManage
    ? true
    : (role === "user"
        ? (typeof hasUserActionPermission === "function"
            ? hasUserActionPermission("/purchase/create-po.html", "add")
            : false)
        : false);

if (!canViewPo) {
    alert("You don't have access to Create PO.");
    window.location.href = "../dashboard.html";
}

if (savePoBtn && !canCreatePo) {
    savePoBtn.disabled = true;
    savePoBtn.style.opacity = "0.5";
    savePoBtn.style.cursor = "not-allowed";
    savePoBtn.title = "No permission to create PO";
}

const MEASUREMENT_OPTIONS = ["Mg", "Grm", "Kg", "Ml", "Ltr", "MM", "CM", "Mtr"];

function todayIsoDate() {
    return new Date().toISOString().slice(0, 10);
}

function compactDateToken(dateValue) {
    const safe = /^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || "").trim()) ? String(dateValue).trim() : todayIsoDate();
    return safe.replace(/-/g, "");
}

function nextSequence(seriesName, dateToken) {
    const key = `seq:${seriesName}:${dateToken}`;
    const prev = Number(localStorage.getItem(key) || 0);
    const next = Number.isFinite(prev) && prev > 0 ? prev + 1 : 1;
    localStorage.setItem(key, String(next));
    return next;
}

function formatCode(prefix, dateToken, sequence) {
    return `${prefix}-${dateToken}-${String(sequence).padStart(4, "0")}`;
}

function generatePoNumber() {
    const dateToken = compactDateToken(poDateEl.value);
    const sequence = nextSequence("po", dateToken);
    poNumberEl.value = formatCode("PO", dateToken, sequence);
}

function generateBatchNumber() {
    const dateToken = compactDateToken(poDateEl.value);
    const sequence = nextSequence("batch", dateToken);
    batchNumberEl.value = formatCode("BATCH", dateToken, sequence);
}

function toMoney(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n : 0;
}

function updateRowTotal(rowEl) {
    const qtyEl = rowEl.querySelector(".po-qty");
    const unitPriceEl = rowEl.querySelector(".po-unit-price");
    const lineTotalEl = rowEl.querySelector(".po-line-total");

    const qty = toMoney(qtyEl.value);
    const unitPrice = toMoney(unitPriceEl.value);
    const total = qty * unitPrice;
    lineTotalEl.value = total.toFixed(2);
    lineTotalEl.dataset.numeric = String(total);
}

function updateGrandTotal() {
    const totals = Array.from(poItemsBodyEl.querySelectorAll(".po-line-total"))
        .map((el) => toMoney(el.dataset.numeric));
    const sum = totals.reduce((acc, val) => acc + val, 0);
    poGrandTotalEl.textContent = sum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function buildMeasurementOptionsHtml(selectedValue) {
    const selected = String(selectedValue || "");
    const rows = [`<option value="">Select</option>`];
    MEASUREMENT_OPTIONS.forEach((unit) => {
        const isSelected = unit === selected ? " selected" : "";
        rows.push(`<option value="${unit}"${isSelected}>${unit}</option>`);
    });
    return rows.join("");
}

function addPoRow(seed = {}) {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td><input type="text" class="po-description" placeholder="Chemical / material name" value="${String(seed.description || "").replace(/"/g, "&quot;")}"></td>
        <td><select class="po-measurement">${buildMeasurementOptionsHtml(seed.measurement)}</select></td>
        <td><input type="number" class="po-qty" min="0" step="0.01" value="${toMoney(seed.qty).toFixed(2)}"></td>
        <td><input type="number" class="po-unit-price" min="0" step="0.01" value="${toMoney(seed.unit_price).toFixed(2)}"></td>
        <td><input type="text" class="po-line-total line-total" readonly value="0.00" data-numeric="0"></td>
        <td>
            <button type="button" class="icon-btn btn-danger row-remove-btn" title="Remove row" aria-label="Remove row">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                </svg>
            </button>
        </td>
    `;

    const qtyEl = row.querySelector(".po-qty");
    const unitPriceEl = row.querySelector(".po-unit-price");
    const removeBtn = row.querySelector(".row-remove-btn");

    qtyEl.addEventListener("input", () => {
        updateRowTotal(row);
        updateGrandTotal();
    });
    unitPriceEl.addEventListener("input", () => {
        updateRowTotal(row);
        updateGrandTotal();
    });
    removeBtn.addEventListener("click", () => {
        row.remove();
        if (!poItemsBodyEl.querySelector("tr")) {
            addPoRow();
        } else {
            updateGrandTotal();
        }
    });

    poItemsBodyEl.appendChild(row);
    updateRowTotal(row);
    updateGrandTotal();
}

function collectPoItems() {
    const rows = Array.from(poItemsBodyEl.querySelectorAll("tr"));
    return rows.map((row) => {
        const description = String(row.querySelector(".po-description").value || "").trim();
        const measurement = String(row.querySelector(".po-measurement").value || "").trim();
        const qty = toMoney(row.querySelector(".po-qty").value);
        const unitPrice = toMoney(row.querySelector(".po-unit-price").value);
        const lineTotal = qty * unitPrice;
        return {
            description,
            measurement,
            qty,
            unit_price: unitPrice,
            line_total: Number(lineTotal.toFixed(2))
        };
    }).filter((item) => item.description && item.measurement && item.qty > 0);
}

async function loadVendors() {
    try {
        const vendors = await request("/vendors", "GET");
        const ordered = [...(Array.isArray(vendors) ? vendors : [])]
            .sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base", numeric: true }));
        vendorEl.innerHTML = `<option value="">Select Vendor</option>`;
        ordered.forEach((vendor) => {
            const option = document.createElement("option");
            option.value = vendor.id;
            option.textContent = vendor.name;
            vendorEl.appendChild(option);
        });
    } catch (_err) {
        alert("Failed to load vendors.");
    }
}

function resetFormForNextPo() {
    poFormEl.reset();
    poDateEl.value = todayIsoDate();
    deliveryDateEl.value = poDateEl.value;
    poItemsBodyEl.innerHTML = "";
    addPoRow();
    generatePoNumber();
    generateBatchNumber();
}

generatePoBtn.addEventListener("click", generatePoNumber);
generateBatchBtn.addEventListener("click", generateBatchNumber);
addPoRowBtn.addEventListener("click", () => addPoRow());

poDateEl.addEventListener("change", () => {
    if (!poDateEl.value) {
        poDateEl.value = todayIsoDate();
    }
});

poFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canCreatePo) {
        alert("You don't have permission to create PO.");
        return;
    }

    const vendorId = Number(vendorEl.value || 0);
    const poDate = String(poDateEl.value || "").trim();
    const poNumber = String(poNumberEl.value || "").trim();
    const batchNumber = String(batchNumberEl.value || "").trim();
    const items = collectPoItems();

    if (!vendorId || !poDate) {
        alert("Please fill Vendor and PO Date.");
        return;
    }
    if (!poNumber || !batchNumber) {
        alert("Please create PO Number and Batch No.");
        return;
    }
    if (!items.length) {
        alert("Add at least one valid PO item.");
        return;
    }

    const payload = {
        po_number: poNumber,
        batch_number: batchNumber,
        po_date: poDate,
        delivery_date: String(deliveryDateEl.value || "").trim() || null,
        vendor_id: vendorId,
        notes: String(document.getElementById("poNotes").value || "").trim(),
        items,
        grand_total: Number(items.reduce((sum, item) => sum + Number(item.line_total || 0), 0).toFixed(2))
    };

    localStorage.setItem("poDraft:last", JSON.stringify(payload));
    showMessageBox("PO draft created successfully.");
    resetFormForNextPo();
});

(async function init() {
    poDateEl.value = todayIsoDate();
    deliveryDateEl.value = poDateEl.value;
    addPoRow();
    generatePoNumber();
    generateBatchNumber();
    await loadVendors();
})();

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.href = "../login.html";
}
