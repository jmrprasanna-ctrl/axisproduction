if(!localStorage.getItem("token")){
    window.location.href = "../login.html";
}

const rowPrefix = {
    "metirial": "MT",
    "material": "MT",
    "finish good": "FG",
    "other": "OT"
};

let allVendors = [];

const measurementMap = {
    mg: "Mg",
    grm: "Grm",
    kg: "Kg",
    ml: "Ml",
    ltr: "Ltr",
    mm: "MM",
    cm: "CM",
    mtr: "Mtr"
};

function normalizeRowType(value){
    const token = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    if(token === "metirial" || token === "material") return "Metirial";
    if(token === "finish good") return "Finish Good";
    if(token === "other") return "Other";
    return "";
}

function resolveRowPrefix(rowType){
    const key = String(rowType || "").trim().toLowerCase().replace(/\s+/g, " ");
    return rowPrefix[key] || "OT";
}

function normalizeMeasurement(value){
    const token = String(value || "").trim().toLowerCase();
    return measurementMap[token] || "";
}

function renderVendors(){
    const vendorSelect = document.getElementById("vendor");
    const selectedValue = String(vendorSelect.value || "");
    vendorSelect.innerHTML = `<option value="">Select Vendor</option>`;

    const ordered = [...allVendors].sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base", numeric: true })
    );

    ordered.forEach((vendor) => {
        const opt = document.createElement("option");
        opt.value = vendor.id;
        opt.innerText = vendor.name;
        vendorSelect.appendChild(opt);
    });

    if(selectedValue && Array.from(vendorSelect.options).some((option) => option.value === selectedValue)){
        vendorSelect.value = selectedValue;
    }
}

async function fetchVendors(){
    try{
        allVendors = await request("/vendors","GET");
        renderVendors();
    }catch(_err){
        alert("Failed to load vendors");
    }
}

async function generateProductID(){
    const selectedRow = normalizeRowType(document.getElementById("rowType").value);
    const productIdEl = document.getElementById("productId");

    if(!selectedRow){
        productIdEl.value = "";
        return;
    }

    const prefix = resolveRowPrefix(selectedRow);
    const cacheKey = `lastProductIdByRow:${selectedRow}`;

    try{
        const lastProduct = await request(`/products/last/${encodeURIComponent(selectedRow)}`,"GET");
        if(lastProduct && lastProduct.product_id){
            localStorage.setItem(cacheKey, lastProduct.product_id);
        }

        const lastIdText = String(lastProduct?.product_id || "");
        const prefixRegex = new RegExp(`^${prefix}(\\d+)$`, "i");
        const match = lastIdText.match(prefixRegex);
        const lastIdNum = match ? parseInt(match[1], 10) : 0;
        productIdEl.value = prefix + String((Number.isFinite(lastIdNum) ? lastIdNum : 0) + 1).padStart(4, "0");
    }catch(_err){
        const cached = String(localStorage.getItem(cacheKey) || "");
        const prefixRegex = new RegExp(`^${prefix}(\\d+)$`, "i");
        const match = cached.match(prefixRegex);
        const lastIdNum = match ? parseInt(match[1], 10) : 0;
        productIdEl.value = prefix + String((Number.isFinite(lastIdNum) ? lastIdNum : 0) + 1).padStart(4, "0");
    }
}

const descriptionEl = document.getElementById("description");
if(descriptionEl){
    descriptionEl.style.textTransform = "uppercase";
    descriptionEl.addEventListener("input", () => {
        const pos = descriptionEl.selectionStart;
        descriptionEl.value = descriptionEl.value.toUpperCase();
        descriptionEl.setSelectionRange(pos, pos);
    });
}

document.getElementById("productForm").addEventListener("submit", async function(e){
    e.preventDefault();

    const rowType = normalizeRowType(document.getElementById("rowType").value);
    const vendorId = Number(document.getElementById("vendor").value || 0);
    const dealerPrice = Number(document.getElementById("dealerPrice").value || 0);
    const measurement = normalizeMeasurement(document.getElementById("measurement").value);
    const qty = Number(document.getElementById("qty").value || 0);

    const data = {
        row_type: rowType,
        product_id: String(document.getElementById("productId").value || "").trim(),
        description: String(document.getElementById("description").value || "").trim(),
        dealer_price: dealerPrice,
        vendor_id: vendorId,
        measurement,
        category: "",
        model: "",
        serial_no: "",
        count: qty,
        selling_price: 0
    };

    if(!data.row_type || !data.product_id || !data.description || !data.measurement || !Number.isFinite(vendorId) || vendorId <= 0){
        alert("Please fill required fields.");
        return;
    }
    if(!Number.isFinite(dealerPrice) || dealerPrice < 0){
        alert("Dealer price must be 0 or greater.");
        return;
    }
    if(!Number.isFinite(qty) || qty < 0 || !Number.isInteger(qty)){
        alert("QTY must be a whole number (0 or greater).");
        return;
    }

    try{
        await request("/products","POST",data);
        showMessageBox("Product saved successfully");
        document.getElementById("productForm").reset();
        document.getElementById("productId").value = "";
        renderVendors();
    }catch(err){
        alert(err.message || "Failed to save product");
    }
});

Promise.allSettled([fetchVendors()]);

function logout(){
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.href="../login.html";
}
