const poFormEl = document.getElementById("createPoForm");
const poDateEl = document.getElementById("poDate");
const deliveryDateEl = document.getElementById("deliveryDate");
const poNumberEl = document.getElementById("poNumber");
const batchNumberEl = document.getElementById("batchNumber");
const poNotesEl = document.getElementById("poNotes");
const poCustomerNameEl = document.getElementById("poCustomerName");
const poCustomerOptionsEl = document.getElementById("poCustomerOptions");
const poProductOptionsEl = document.getElementById("poProductOptions");
const addPoRowBtn = document.getElementById("addPoRowBtn");
const poItemsBodyEl = document.getElementById("poItemsBody");
const poGrandTotalEl = document.getElementById("poGrandTotal");
const savePoBtn = document.getElementById("savePoBtn");

const customerDetailsCardEl = document.getElementById("customerDetailsCard");
const updateCustomerBtn = document.getElementById("updateCustomerBtn");
const customerDetailCodeEl = document.getElementById("customerDetailCode");
const customerDetailNameEl = document.getElementById("customerDetailName");
const customerDetailAddressEl = document.getElementById("customerDetailAddress");
const customerDetailQuotationAddressEl = document.getElementById("customerDetailQuotationAddress");
const customerDetailTelEl = document.getElementById("customerDetailTel");
const customerDetailContactPersonEl = document.getElementById("customerDetailContactPerson");
const customerDetailTypeEl = document.getElementById("customerDetailType");
const customerDetailModeEl = document.getElementById("customerDetailMode");
const customerDetailVatEl = document.getElementById("customerDetailVat");
const customerDetailEmailEl = document.getElementById("customerDetailEmail");

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
const MEASUREMENT_CANONICAL_MAP = {
    mg: "Mg",
    grm: "Grm",
    kg: "Kg",
    ml: "Ml",
    ltr: "Ltr",
    mm: "MM",
    cm: "CM",
    mtr: "Mtr"
};
const CUSTOMER_TYPE_DEFAULT = "Silver";
const CUSTOMER_MODE_DEFAULT = "General";

let customerCache = [];
let productCache = [];
let selectedCustomer = null;
let activeDescriptionInput = null;
let productSearchTimer = null;

function todayIsoDateLocal() {
    const date = new Date();
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const dd = String(date.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
}

function normalizeIsoDate(value) {
    const safe = String(value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(safe) ? safe : "";
}

function normalizeKey(value) {
    return String(value || "").trim().toLowerCase();
}

function toMoney(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function setCustomerDetailsVisibility(visible) {
    customerDetailsCardEl.hidden = !visible;
}

function buildCustomerFallbackEmail(nameValue) {
    const raw = String(nameValue || "").trim().toLowerCase();
    const slug = raw.replace(/[^a-z0-9]+/g, "").slice(0, 18) || "customer";
    return `${slug}.${Date.now()}@po.local`;
}

function fillCustomerDetails(customer) {
    const safe = customer && typeof customer === "object" ? customer : {};
    customerDetailCodeEl.value = safe.customer_id || "";
    customerDetailNameEl.value = safe.name || "";
    customerDetailAddressEl.value = safe.address || "";
    customerDetailQuotationAddressEl.value = safe.quotation2_address || safe.address || "";
    customerDetailTelEl.value = safe.tel || "";
    customerDetailContactPersonEl.value = safe.contact_person || "";
    customerDetailTypeEl.value = safe.customer_type || CUSTOMER_TYPE_DEFAULT;
    customerDetailModeEl.value = safe.customer_mode || CUSTOMER_MODE_DEFAULT;
    customerDetailVatEl.value = safe.vat_number || "";
    customerDetailEmailEl.value = safe.email || "";
}

function mergeCustomerIntoCache(customer) {
    if (!customer || !Number.isFinite(Number(customer.id))) return;
    const id = Number(customer.id);
    const idx = customerCache.findIndex((row) => Number(row.id) === id);
    if (idx >= 0) {
        customerCache[idx] = { ...customerCache[idx], ...customer };
    } else {
        customerCache.push(customer);
    }
    customerCache.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base", numeric: true }));
}

function renderCustomerOptions(query = "") {
    const token = normalizeKey(query);
    const rows = !token
        ? customerCache.slice(0, 200)
        : customerCache.filter((row) => {
            const name = normalizeKey(row?.name);
            const code = normalizeKey(row?.customer_id);
            const tel = normalizeKey(row?.tel);
            return name.includes(token) || code.includes(token) || tel.includes(token);
        }).slice(0, 200);

    poCustomerOptionsEl.innerHTML = rows.map((row) => {
        const name = escapeHtml(row?.name || "");
        const code = escapeHtml(row?.customer_id || "");
        const tel = escapeHtml(row?.tel || "");
        return `<option value="${name}" label="${code}${tel ? ` | ${tel}` : ""}"></option>`;
    }).join("");
}

function findCustomerByName(nameValue) {
    const key = normalizeKey(nameValue);
    if (!key) return null;
    return customerCache.find((row) => normalizeKey(row?.name) === key) || null;
}

function syncCustomerSelectionFromInput() {
    const typedName = String(poCustomerNameEl.value || "").trim();
    const matched = findCustomerByName(typedName);
    if (matched) {
        selectedCustomer = matched;
        fillCustomerDetails(matched);
        setCustomerDetailsVisibility(true);
    } else {
        selectedCustomer = null;
        setCustomerDetailsVisibility(false);
    }
}

function buildMeasurementOptionsHtml(selectedValue) {
    const selected = normalizeMeasurementUnit(selectedValue);
    const rows = [`<option value="">Select</option>`];
    MEASUREMENT_OPTIONS.forEach((unit) => {
        const isSelected = unit === selected ? " selected" : "";
        rows.push(`<option value="${unit}"${isSelected}>${unit}</option>`);
    });
    return rows.join("");
}

function normalizeMeasurementUnit(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const mapped = MEASUREMENT_CANONICAL_MAP[raw.toLowerCase()];
    return mapped || raw;
}

function ensureMeasurementOption(selectEl, measurementValue) {
    if (!selectEl) return;
    const unit = normalizeMeasurementUnit(measurementValue);
    if (!unit) return;
    const exists = Array.from(selectEl.options).some((option) => String(option.value || "") === unit);
    if (!exists) {
        const option = document.createElement("option");
        option.value = unit;
        option.textContent = unit;
        selectEl.appendChild(option);
    }
}

function updateRowTotal(rowEl) {
    const qtyEl = rowEl.querySelector(".po-qty");
    const unitPriceEl = rowEl.querySelector(".po-unit-price");
    const lineTotalEl = rowEl.querySelector(".po-line-total");

    const qty = toMoney(qtyEl.value, 0);
    const unitPrice = toMoney(unitPriceEl.value, 0);
    const total = qty * unitPrice;
    lineTotalEl.value = total.toFixed(2);
    lineTotalEl.dataset.numeric = String(total);
}

function updateGrandTotal() {
    const totals = Array.from(poItemsBodyEl.querySelectorAll(".po-line-total")).map((el) => toMoney(el.dataset.numeric, 0));
    const sum = totals.reduce((acc, val) => acc + val, 0);
    poGrandTotalEl.textContent = sum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toProductListRow(row) {
    return {
        id: Number(row?.id) || null,
        product_id: String(row?.product_id || "").trim(),
        description: String(row?.description || "").trim(),
        measurement: String(row?.measurement || "").trim() || "",
        row_type: String(row?.row_type || "").trim()
    };
}

function mergeProductsIntoCache(rows) {
    const items = Array.isArray(rows) ? rows : [];
    for (const raw of items) {
        const row = toProductListRow(raw);
        if (!row.description) continue;
        const id = Number(row.id);
        if (Number.isFinite(id) && id > 0) {
            const idx = productCache.findIndex((item) => Number(item.id) === id);
            if (idx >= 0) {
                productCache[idx] = { ...productCache[idx], ...row };
            } else {
                productCache.push(row);
            }
            continue;
        }
        const key = normalizeKey(row.description);
        if (!productCache.some((item) => normalizeKey(item.description) === key)) {
            productCache.push(row);
        }
    }
}

function findProductByDescription(value) {
    const key = normalizeKey(value);
    if (!key) return null;
    return productCache.find((row) => normalizeKey(row?.description) === key) || null;
}

function renderProductOptions(rows) {
    const items = Array.isArray(rows) ? rows : [];
    poProductOptionsEl.innerHTML = items.map((row) => {
        const description = escapeHtml(row?.description || "");
        const productCode = escapeHtml(row?.product_id || "");
        const measurement = escapeHtml(row?.measurement || "");
        const labelParts = [productCode, measurement].filter(Boolean);
        const label = labelParts.join(" | ");
        return `<option value="${description}" label="${label}"></option>`;
    }).join("");
}

function applyProductSelectionToRow(rowEl, product) {
    if (!rowEl || !product) return;
    const productIdEl = rowEl.querySelector(".po-product-id");
    const measurementEl = rowEl.querySelector(".po-measurement");
    if (productIdEl) {
        productIdEl.value = Number.isFinite(Number(product.id)) ? String(Number(product.id)) : "";
    }
    const measurement = normalizeMeasurementUnit(product.measurement);
    if (measurementEl && measurement) {
        ensureMeasurementOption(measurementEl, measurement);
        measurementEl.value = measurement;
    }
}

async function searchProductRows(query) {
    const token = String(query || "").trim();
    if (!token) {
        const top = [...productCache]
            .sort((a, b) => String(a?.description || "").localeCompare(String(b?.description || ""), undefined, { sensitivity: "base", numeric: true }))
            .slice(0, 80);
        renderProductOptions(top);
        return top;
    }

    try {
        const result = await request(`/products/search?q=${encodeURIComponent(token)}&limit=50`, "GET");
        const rows = (Array.isArray(result) ? result : []).map(toProductListRow).filter((row) => row.description);
        if (rows.length) {
            mergeProductsIntoCache(rows);
            renderProductOptions(rows);
            return rows;
        }
    } catch (_err) {
    }

    const filtered = productCache.filter((row) => {
        const desc = normalizeKey(row?.description);
        const code = normalizeKey(row?.product_id);
        return desc.includes(normalizeKey(token)) || code.includes(normalizeKey(token));
    }).slice(0, 80);
    renderProductOptions(filtered);
    return filtered;
}

function attachDescriptionLookup(inputEl, rowEl) {
    inputEl.addEventListener("focus", async () => {
        activeDescriptionInput = inputEl;
        await searchProductRows(inputEl.value);
    });

    inputEl.addEventListener("click", async () => {
        activeDescriptionInput = inputEl;
        await searchProductRows(inputEl.value);
    });

    inputEl.addEventListener("input", () => {
        activeDescriptionInput = inputEl;
        const productIdEl = rowEl.querySelector(".po-product-id");
        if (productIdEl) productIdEl.value = "";
        if (productSearchTimer) clearTimeout(productSearchTimer);
        productSearchTimer = setTimeout(async () => {
            await searchProductRows(inputEl.value);
            const exact = findProductByDescription(inputEl.value);
            if (exact) {
                applyProductSelectionToRow(rowEl, exact);
            }
        }, 180);
    });

    inputEl.addEventListener("change", () => {
        const exact = findProductByDescription(inputEl.value);
        if (exact) {
            inputEl.value = exact.description;
            applyProductSelectionToRow(rowEl, exact);
        }
    });

    inputEl.addEventListener("blur", () => {
        const exact = findProductByDescription(inputEl.value);
        if (exact) {
            inputEl.value = exact.description;
            applyProductSelectionToRow(rowEl, exact);
        }
    });
}

function addPoRow(seed = {}) {
    const row = document.createElement("tr");
    const safeDesc = escapeHtml(seed.description || "");
    row.innerHTML = `
        <td>
            <input type="text" class="po-description" list="poProductOptions" placeholder="Search product description" value="${safeDesc}" autocomplete="off">
            <input type="hidden" class="po-product-id" value="${Number.isFinite(Number(seed.product_id)) ? String(Number(seed.product_id)) : ""}">
        </td>
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
    const descEl = row.querySelector(".po-description");

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

    attachDescriptionLookup(descEl, row);
    poItemsBodyEl.appendChild(row);
    updateRowTotal(row);
    updateGrandTotal();
}

function collectPoItems() {
    const rows = Array.from(poItemsBodyEl.querySelectorAll("tr"));
    return rows.map((row) => {
        const description = String(row.querySelector(".po-description").value || "").trim();
        const measurement = String(row.querySelector(".po-measurement").value || "").trim();
        const qty = toMoney(row.querySelector(".po-qty").value, 0);
        const unitPrice = toMoney(row.querySelector(".po-unit-price").value, 0);
        const lineTotal = qty * unitPrice;
        const productId = Number(row.querySelector(".po-product-id").value || 0);
        return {
            product_id: Number.isFinite(productId) && productId > 0 ? productId : null,
            description,
            measurement: measurement || null,
            qty,
            unit_price: unitPrice,
            line_total: Number(lineTotal.toFixed(2))
        };
    }).filter((item) => item.description && item.qty > 0);
}

async function refreshPoBatchNumbers() {
    const poDate = normalizeIsoDate(poDateEl.value) || todayIsoDateLocal();
    poDateEl.value = poDate;
    try {
        const response = await request(`/purchase-orders/next-code?date=${encodeURIComponent(poDate)}`, "GET");
        poNumberEl.value = String(response?.po_number || "").trim();
        batchNumberEl.value = String(response?.batch_number || "").trim();
    } catch (err) {
        console.error("Failed to load PO code:", err);
        poNumberEl.value = "";
        batchNumberEl.value = "";
    }
}

async function loadCustomers() {
    const rows = await request("/customers", "GET");
    customerCache = Array.isArray(rows) ? rows : [];
    customerCache.sort((a, b) => String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base", numeric: true }));
    renderCustomerOptions("");
}

async function loadProducts() {
    const rows = await request("/products", "GET");
    productCache = (Array.isArray(rows) ? rows : [])
        .map(toProductListRow)
        .filter((row) => row.description);
    await searchProductRows("");
}

function buildCustomerPayloadForCreate() {
    const customerName = String(poCustomerNameEl.value || "").trim();
    if (!customerName) return null;

    if (selectedCustomer && Number.isFinite(Number(selectedCustomer.id))) {
        return {
            customer_id: Number(selectedCustomer.id),
            customer_name: String(selectedCustomer.name || customerName).trim()
        };
    }

    return {
        customer_name: customerName,
        customer: {
            name: customerName,
            address: String(customerDetailAddressEl.value || "").trim(),
            quotation2_address: String(customerDetailQuotationAddressEl.value || "").trim(),
            tel: String(customerDetailTelEl.value || "").trim(),
            contact_person: String(customerDetailContactPersonEl.value || "").trim(),
            customer_type: String(customerDetailTypeEl.value || "").trim() || CUSTOMER_TYPE_DEFAULT,
            customer_mode: String(customerDetailModeEl.value || "").trim() || CUSTOMER_MODE_DEFAULT,
            vat_number: String(customerDetailVatEl.value || "").trim(),
            email: String(customerDetailEmailEl.value || "").trim().toLowerCase() || buildCustomerFallbackEmail(customerName)
        }
    };
}

function normalizeCustomerResponse(customer) {
    if (!customer || typeof customer !== "object") return null;
    return {
        id: Number(customer.id) || null,
        customer_id: customer.customer_id || "",
        name: customer.name || "",
        address: customer.address || "",
        quotation2_address: customer.quotation2_address || customer.address || "",
        tel: customer.tel || "",
        contact_person: customer.contact_person || "",
        customer_type: customer.customer_type || CUSTOMER_TYPE_DEFAULT,
        customer_mode: customer.customer_mode || CUSTOMER_MODE_DEFAULT,
        vat_number: customer.vat_number || "",
        email: customer.email || ""
    };
}

async function updateSelectedCustomerDetails() {
    if (!selectedCustomer || !Number.isFinite(Number(selectedCustomer.id))) {
        alert("Select or create a customer first.");
        return;
    }

    const name = String(customerDetailNameEl.value || "").trim();
    if (!name) {
        alert("Customer name is required.");
        return;
    }

    const payload = {
        name,
        address: String(customerDetailAddressEl.value || "").trim(),
        quotation2_address: String(customerDetailQuotationAddressEl.value || "").trim(),
        tel: String(customerDetailTelEl.value || "").trim(),
        contact_person: String(customerDetailContactPersonEl.value || "").trim(),
        customer_type: String(customerDetailTypeEl.value || "").trim() || CUSTOMER_TYPE_DEFAULT,
        customer_mode: String(customerDetailModeEl.value || "").trim() || CUSTOMER_MODE_DEFAULT,
        vat_number: String(customerDetailVatEl.value || "").trim(),
        email: String(customerDetailEmailEl.value || "").trim().toLowerCase() || selectedCustomer.email || buildCustomerFallbackEmail(name)
    };

    try {
        const updated = await request(`/customers/${Number(selectedCustomer.id)}`, "PUT", payload);
        const normalized = normalizeCustomerResponse(updated);
        if (normalized) {
            selectedCustomer = normalized;
            poCustomerNameEl.value = normalized.name;
            mergeCustomerIntoCache(normalized);
            renderCustomerOptions(poCustomerNameEl.value);
            fillCustomerDetails(normalized);
        }
        showMessageBox("Customer updated successfully.");
    } catch (err) {
        alert(err.message || "Failed to update customer.");
    }
}

function resetPoItemSection() {
    poItemsBodyEl.innerHTML = "";
    addPoRow();
    updateGrandTotal();
    poNotesEl.value = "";
}

poCustomerNameEl.addEventListener("focus", () => {
    renderCustomerOptions("");
});

poCustomerNameEl.addEventListener("click", () => {
    renderCustomerOptions(poCustomerNameEl.value);
});

poCustomerNameEl.addEventListener("input", () => {
    renderCustomerOptions(poCustomerNameEl.value);
    syncCustomerSelectionFromInput();
});

poCustomerNameEl.addEventListener("change", () => {
    syncCustomerSelectionFromInput();
});

poDateEl.addEventListener("change", async () => {
    if (!normalizeIsoDate(poDateEl.value)) {
        poDateEl.value = todayIsoDateLocal();
    }
    await refreshPoBatchNumbers();
});

addPoRowBtn.addEventListener("click", () => addPoRow());
updateCustomerBtn.addEventListener("click", updateSelectedCustomerDetails);

poFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canCreatePo) {
        alert("You don't have permission to create PO.");
        return;
    }

    const poDate = normalizeIsoDate(poDateEl.value);
    const items = collectPoItems();
    if (!poDate) {
        alert("PO Date is required.");
        return;
    }
    if (!items.length) {
        alert("Add at least one valid PO item.");
        return;
    }

    const customerPayload = buildCustomerPayloadForCreate();
    if (!customerPayload) {
        alert("Customer name is required.");
        return;
    }

    const payload = {
        po_date: poDate,
        delivery_date: normalizeIsoDate(deliveryDateEl.value) || null,
        notes: String(poNotesEl.value || "").trim(),
        items,
        ...customerPayload
    };

    try {
        const created = await request("/purchase-orders", "POST", payload);
        if (created?.po_number) poNumberEl.value = created.po_number;
        if (created?.batch_number) batchNumberEl.value = created.batch_number;

        const customerFromResponse = normalizeCustomerResponse(created?.Customer || created?.customer);
        if (customerFromResponse) {
            selectedCustomer = customerFromResponse;
            poCustomerNameEl.value = customerFromResponse.name;
            mergeCustomerIntoCache(customerFromResponse);
            renderCustomerOptions(poCustomerNameEl.value);
            fillCustomerDetails(customerFromResponse);
            setCustomerDetailsVisibility(true);
        }

        showMessageBox("PO saved successfully.");
        resetPoItemSection();
        await refreshPoBatchNumbers();
    } catch (err) {
        alert(err.message || "Failed to save PO.");
    }
});

(async function init() {
    poDateEl.value = todayIsoDateLocal();
    deliveryDateEl.value = poDateEl.value;
    setCustomerDetailsVisibility(false);
    addPoRow();

    try {
        await Promise.all([
            loadCustomers(),
            loadProducts(),
            refreshPoBatchNumbers()
        ]);
    } catch (err) {
        console.error(err);
        alert(err.message || "Failed to load Create PO page data.");
    }
})();

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.href = "../login.html";
}
