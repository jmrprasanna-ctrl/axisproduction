if(!localStorage.getItem("token")){
    window.location.href = "../login.html";
}

const defaultCategories = [
    "Photocopier",
    "Printer",
    "Plotter",
    "Computer",
    "Laptop",
    "Accessory",
    "Consumable",
    "Machine",
    "CCTV",
    "Duplo",
    "Other",
    "Service"
];

const categoryPrefix = {
    "Photocopier":"PH",
    "Printer":"PR",
    "Plotter":"PL",
    "Computer":"CO",
    "Laptop":"LP",
    "Accessory":"AC",
    "Consumable":"CM",
    "Machine":"MA",
    "CCTV":"CT",
    "Duplo":"DP",
    "Other":"OT",
    "Service":"SV"
};

let allVendors = [];
const modelOptionsByCategory = {};

const defaultModelOptions = {
    "Accessory": ["CANON", "TOSHIBA", "RECOH", "SHARP", "KYOCERA", "SEROX", "SAMSUNG", "HP", "DELL"],
    "Consumable": ["CANON", "TOSHIBA", "RECOH", "SHARP", "KYOCERA", "SEROX", "SAMSUNG", "HP", "DELL"],
    "Machine": ["CANON", "TOSHIBA", "RECOH", "SHARP", "KYOCERA", "SEROX", "SAMSUNG", "HP", "DELL"],
    "Photocopier": ["CANON", "TOSHIBA", "RECOH", "SHARP", "KYOCERA", "SEROX", "SAMSUNG", "HP", "DELL"],
    "Printer": ["CANON", "HP", "EPSON", "BROTHER", "LEXMARK", "OTHER", "SEROX", "SAMSUNG"],
    "Computer": ["HP", "DELL", "ASUS", "SONY", "SINGER", "SAMSUNG", "SPARE PARTS", "OTHER"],
    "Laptop": ["HP", "DELL", "ASUS", "SONY", "SINGER", "SAMSUNG", "SPARE PARTS", "OTHER"],
    "Plotter": ["CANON", "HP", "EPSON", "OTHER"],
    "CCTV": ["HICKVISION", "DAHUA", "OTHER"],
    "Duplo": ["RONGDA", "RISO", "RECOH", "DUPLO"],
    "Other": ["OTHER"],
    "Service": ["OTHER"]
};

function renderVendorsByCategory(){
    const vendorSelect = document.getElementById("vendor");
    const selectedValue = String(vendorSelect.value || "");
    vendorSelect.innerHTML = `<option value="">Select Vendor</option>`;

    const ordered = [...allVendors].sort((a, b) =>
        String(a?.name || "").localeCompare(String(b?.name || ""), undefined, { sensitivity: "base", numeric: true })
    );
    ordered.forEach((v) => {
        const opt = document.createElement("option");
        opt.value = v.id;
        opt.innerText = v.name;
        vendorSelect.appendChild(opt);
    });
    if(selectedValue && Array.from(vendorSelect.options).some((option) => option.value === selectedValue)){
        vendorSelect.value = selectedValue;
    }
}

async function resolveModelsByCategory(categoryName){
    const key = String(categoryName || "").trim();
    if(!key) return [];
    if(Array.isArray(modelOptionsByCategory[key]) && modelOptionsByCategory[key].length){
        return modelOptionsByCategory[key];
    }

    let models = [];
    try{
        const rows = await request(`/category-model-options?category=${encodeURIComponent(key)}`, "GET");
        models = Array.from(new Set(
            (Array.isArray(rows) ? rows : [])
                .map((row) => String(row.model_name || "").trim().toUpperCase())
                .filter(Boolean)
        )).sort((a, b) => a.localeCompare(b));
    }catch(_err){
        models = [];
    }

    if(!models.length){
        models = Array.from(new Set(defaultModelOptions[key] || [])).sort((a, b) => a.localeCompare(b));
    }

    modelOptionsByCategory[key] = models;
    return models;
}

async function renderModelsByCategory(){
    const modelSelect = document.getElementById("model");
    const categorySelect = document.getElementById("category");
    const selectedCategory = categorySelect.selectedOptions[0]?.dataset?.name || "";
    modelSelect.innerHTML = `<option value="">Select Model</option>`;

    if(!selectedCategory) return;

    const list = await resolveModelsByCategory(selectedCategory);
    list.forEach((model) => {
        const opt = document.createElement("option");
        opt.value = model;
        opt.innerText = model;
        modelSelect.appendChild(opt);
    });
}

async function fetchVendors(){
    try{
        allVendors = await request("/vendors","GET");
        renderVendorsByCategory();
    }catch(_err){
        alert("Failed to load vendors");
    }
}

function renderCategories(list){
    const categorySelect = document.getElementById("category");
    categorySelect.innerHTML = `<option value="">Select Category</option>`;
    list.forEach((item) => {
        const name = String(item.name || item || "").trim();
        const opt = document.createElement("option");
        opt.value = item.id ? String(item.id) : item;
        opt.dataset.name = name;
        opt.innerText = name;
        categorySelect.appendChild(opt);
    });
}

async function fetchCategories(){
    try{
        const categories = await request("/categories","GET");
        if(Array.isArray(categories) && categories.length){
            renderCategories(categories);
            return;
        }
        renderCategories(defaultCategories);
    }catch(_err){
        renderCategories(defaultCategories);
    }
}

async function generateProductID(){
    const categorySelect = document.getElementById("category");
    const categoryName = categorySelect.selectedOptions[0]?.dataset?.name || "";
    renderVendorsByCategory();
    await renderModelsByCategory();
    if(!categoryName){
        document.getElementById("productId").value = "";
        return;
    }

    const prefix = categoryPrefix[categoryName] || categoryName.slice(0,2).toUpperCase();
    const cacheKey = `lastProductId:${categoryName}`;
    try{
        const lastProduct = await request(`/products/last/${encodeURIComponent(categoryName)}`,"GET");
        if(lastProduct && lastProduct.product_id){
            localStorage.setItem(cacheKey, lastProduct.product_id);
        }
        const lastIdNum = (lastProduct && lastProduct.product_id)
            ? parseInt(lastProduct.product_id.slice(2), 10)
            : 0;
        const newId = prefix + String((Number.isFinite(lastIdNum) ? lastIdNum : 0) + 1).padStart(4, "0");
        document.getElementById("productId").value = newId;
    }catch(_err){
        const cached = localStorage.getItem(cacheKey);
        const lastIdNum = cached ? parseInt(cached.slice(2), 10) : 0;
        const newId = prefix + String((Number.isFinite(lastIdNum) ? lastIdNum : 0) + 1).padStart(4, "0");
        document.getElementById("productId").value = newId;
    }
}

["description","serialNo"].forEach((id) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.style.textTransform = "uppercase";
    el.addEventListener("input", () => {
        const pos = el.selectionStart;
        el.value = el.value.toUpperCase();
        el.setSelectionRange(pos, pos);
    });
});

document.getElementById("productForm").addEventListener("submit", async function(e){
    e.preventDefault();
    const categorySelect = document.getElementById("category");
    const categoryName = categorySelect.selectedOptions[0]?.dataset?.name || "";

    const data = {
        category: categoryName || categorySelect.value,
        product_id: document.getElementById("productId").value.trim(),
        description: document.getElementById("description").value.trim(),
        model: document.getElementById("model").value.trim(),
        serial_no: document.getElementById("serialNo").value.trim(),
        count: Number(document.getElementById("count").value || 0),
        selling_price: Number(document.getElementById("sellingPrice").value || 0),
        dealer_price: Number(document.getElementById("dealerPrice").value || 0),
        vendor_id: Number(document.getElementById("vendor").value || 0)
    };

    if(!data.category || !data.product_id || !data.description || !data.model || !data.vendor_id){
        alert("Please fill required fields.");
        return;
    }

    try{
        await request("/products","POST",data);
        showMessageBox("Product saved successfully");
        document.getElementById("productForm").reset();
        document.getElementById("productId").value = "";
        await renderModelsByCategory();
        renderVendorsByCategory();
    }catch(err){
        alert(err.message || "Failed to save product");
    }
});

Promise.allSettled([fetchCategories(), fetchVendors()]);

function logout(){
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    window.location.href="../login.html";
}
