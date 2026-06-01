const rawRole = String(localStorage.getItem("role") || "").toLowerCase();
const role = ["coordinator", "cordinator", "co-ordinator", "co ordinator", "co_ordinator"].includes(rawRole) ? "user" : rawRole;
const selectedDb = String(localStorage.getItem("selectedDatabaseName") || "").toLowerCase();
const isTrainingUser = role === "user" && selectedDb === "demo";
const canManage = role === "admin" || role === "manager" || isTrainingUser;

const canViewBatchEdit = canManage
    ? true
    : (role === "user"
        ? (typeof hasUserActionPermission === "function"
            ? (hasUserActionPermission("/production/edit-batch.html", "view") || hasUserActionPermission("/production/edit-batch.html", "edit"))
            : false)
        : false);
const canUpdateBatch = canManage
    ? true
    : (role === "user"
        ? (typeof hasUserActionPermission === "function"
            ? hasUserActionPermission("/production/edit-batch.html", "edit")
            : false)
        : false);

if (!localStorage.getItem("token")) {
    window.location.href = "../login.html";
}
if (!canViewBatchEdit) {
    alert("You don't have access to Edit Batch.");
    window.location.href = "../dashboard.html";
}

const params = new URLSearchParams(window.location.search);
const batchId = Number(params.get("id") || 0);
if (!Number.isFinite(batchId) || batchId <= 0) {
    alert("Invalid batch id.");
    window.location.href = "batch-list.html";
}

const batchFormEl = document.getElementById("batchForm");
const saveBatchBtn = document.getElementById("saveBatchBtn");
const openBatchViewBtn = document.getElementById("openBatchViewBtn");
const exportBatchPdfBtn = document.getElementById("exportBatchPdfBtn");
const companyNameEl = document.getElementById("companyName");
const poNumberEl = document.getElementById("poNumber");
const poNumberOptionsEl = document.getElementById("poNumberOptions");
const batchNumberEl = document.getElementById("batchNumber");
const batchDateEl = document.getElementById("batchDate");
const formulaPreparedByEl = document.getElementById("formulaPreparedBy");
const formulaReviewedByEl = document.getElementById("formulaReviewedBy");
const generatedItemsBodyEl = document.getElementById("generatedItemsBody");
const consumedItemsBodyEl = document.getElementById("consumedItemsBody");
const addGeneratedRowBtn = document.getElementById("addGeneratedRowBtn");
const addConsumedRowBtn = document.getElementById("addConsumedRowBtn");
const warehouseIssuedByEl = document.getElementById("warehouseIssuedBy");
const qualityVerifiedByEl = document.getElementById("qualityVerifiedBy");
const approvingPart01El = document.getElementById("approvingPart01");
const approvingPart02El = document.getElementById("approvingPart02");
const finalBulkApprovalEl = document.getElementById("finalBulkApproval");
const producedByEl = document.getElementById("producedBy");
const receivedProductionQtyEl = document.getElementById("receivedProductionQty");
const finalApprovalNotesEl = document.getElementById("finalApprovalNotes");

const out25El = document.getElementById("out25");
const out10El = document.getElementById("out10");
const out5El = document.getElementById("out5");
const out4El = document.getElementById("out4");
const out1El = document.getElementById("out1");
const out500El = document.getElementById("out500");
const out275El = document.getElementById("out275");
const out150El = document.getElementById("out150");
const out100El = document.getElementById("out100");
const outOtherEl = document.getElementById("outOther");

const referenceImage1El = document.getElementById("referenceImage1");
const referenceImage2El = document.getElementById("referenceImage2");
const referenceImage1PreviewEl = document.getElementById("referenceImage1Preview");
const referenceImage2PreviewEl = document.getElementById("referenceImage2Preview");

if (!canUpdateBatch && saveBatchBtn) {
    saveBatchBtn.disabled = true;
    saveBatchBtn.style.opacity = "0.5";
    saveBatchBtn.style.cursor = "not-allowed";
    saveBatchBtn.title = "No permission to update batch";
}

let loadedBatch = null;
const imageState = {
    ref1: { base64: "", fileName: "" },
    ref2: { base64: "", fileName: "" },
};

function toNumber(value, fallback = 0) {
    return window.batchUi ? window.batchUi.toNumber(value, fallback) : fallback;
}

function buildUnitOptionsHtml(selectedValue) {
    const selected = String(selectedValue || "");
    const units = window.batchUi?.UNIT_OPTIONS || ["", "LT", "KG", "Ml", "Grm"];
    return units.map((unit) => {
        const label = unit || "Select";
        const isSelected = unit === selected ? " selected" : "";
        return `<option value="${unit}"${isSelected}>${label}</option>`;
    }).join("");
}

function renumberRows(tbodyEl) {
    Array.from(tbodyEl.querySelectorAll("tr")).forEach((row, index) => {
        const snEl = row.querySelector(".batch-sn");
        if (snEl) snEl.textContent = String(index + 1);
    });
}

function addItemRow(tbodyEl, seed = {}) {
    const row = document.createElement("tr");
    row.innerHTML = `
        <td class="batch-sn"></td>
        <td><input type="text" class="item-desc" value="${String(seed.description || "").replace(/"/g, "&quot;")}"></td>
        <td><input type="number" class="item-qty" min="0" step="0.01" value="${toNumber(seed.qty, 0)}"></td>
        <td><select class="item-unit">${buildUnitOptionsHtml(seed.unit)}</select></td>
        <td><input type="text" class="item-remarks" value="${String(seed.remarks || "").replace(/"/g, "&quot;")}"></td>
        <td>
            <button type="button" class="icon-btn row-remove-btn" aria-label="Remove row" title="Remove row">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>
                </svg>
            </button>
        </td>
    `;
    row.querySelector(".row-remove-btn").addEventListener("click", () => {
        row.remove();
        if (!tbodyEl.querySelector("tr")) addItemRow(tbodyEl);
        renumberRows(tbodyEl);
    });
    tbodyEl.appendChild(row);
    renumberRows(tbodyEl);
}

function collectItems(tbodyEl) {
    const rows = Array.from(tbodyEl.querySelectorAll("tr"));
    const mapped = rows.map((row) => ({
        description: String(row.querySelector(".item-desc")?.value || "").trim(),
        qty: toNumber(row.querySelector(".item-qty")?.value, 0),
        unit: String(row.querySelector(".item-unit")?.value || "").trim(),
        remarks: String(row.querySelector(".item-remarks")?.value || "").trim(),
    }));
    return window.batchUi ? window.batchUi.normalizeItems(mapped) : mapped;
}

async function loadPoNumbers() {
    try {
        const rows = await request("/purchase-orders", "GET");
        const numbers = Array.isArray(rows)
            ? rows.map((row) => String(row?.po_number || "").trim()).filter(Boolean)
            : [];
        const unique = Array.from(new Set(numbers)).sort((a, b) => b.localeCompare(a));
        poNumberOptionsEl.innerHTML = unique.map((value) => `<option value="${value}"></option>`).join("");
    } catch (_err) {
    }
}

async function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsDataURL(file);
    });
}

async function handleImageSelect(fileInputEl, previewEl, stateKey) {
    const file = fileInputEl?.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    imageState[stateKey] = {
        base64: dataUrl,
        fileName: file.name || "",
    };
    previewEl.src = dataUrl;
}

function getFinalProductOutPayload() {
    return {
        ltr_25: toNumber(out25El.value, 0),
        ltr_10: toNumber(out10El.value, 0),
        ltr_5: toNumber(out5El.value, 0),
        ltr_4: toNumber(out4El.value, 0),
        ltr_1: toNumber(out1El.value, 0),
        ml_500: toNumber(out500El.value, 0),
        ltr_275: toNumber(out275El.value, 0),
        ltr_150: toNumber(out150El.value, 0),
        ltr_100: toNumber(out100El.value, 0),
        other: toNumber(outOtherEl.value, 0),
    };
}

function collectBatchPayload() {
    const finalProductOut = window.batchUi
        ? window.batchUi.normalizeFinalProductOut(getFinalProductOutPayload())
        : getFinalProductOutPayload();

    return {
        company_name: String(companyNameEl.value || "").trim() || "AXIS PRODUCTION",
        po_number: String(poNumberEl.value || "").trim() || null,
        batch_date: String(batchDateEl.value || "").trim() || null,
        formula_prepared_by: String(formulaPreparedByEl.value || "").trim() || null,
        formula_reviewed_by: String(formulaReviewedByEl.value || "").trim() || null,
        items_generated: collectItems(generatedItemsBodyEl),
        items_consumed: collectItems(consumedItemsBodyEl),
        warehouse_issued_by: String(warehouseIssuedByEl.value || "").trim() || null,
        quality_verified_by: String(qualityVerifiedByEl.value || "").trim() || null,
        approving_part_01: String(approvingPart01El.value || "").trim() || null,
        approving_part_02: String(approvingPart02El.value || "").trim() || null,
        final_bulk_approval: String(finalBulkApprovalEl.value || "").trim() || null,
        final_product_out: finalProductOut,
        received_production_qty: toNumber(receivedProductionQtyEl.value, 0),
        produced_by: String(producedByEl.value || "").trim() || null,
        final_approval_notes: String(finalApprovalNotesEl.value || "").trim() || null,
        reference_image_1_base64: imageState.ref1.base64 || null,
        reference_image_1_name: imageState.ref1.fileName || null,
        reference_image_2_base64: imageState.ref2.base64 || null,
        reference_image_2_name: imageState.ref2.fileName || null,
    };
}

function fillForm(data) {
    loadedBatch = data;
    companyNameEl.value = data.company_name || "AXIS PRODUCTION";
    poNumberEl.value = data.po_number || "";
    batchNumberEl.value = data.batch_number || "";
    batchDateEl.value = data.batch_date || "";
    formulaPreparedByEl.value = data.formula_prepared_by || "";
    formulaReviewedByEl.value = data.formula_reviewed_by || "";
    warehouseIssuedByEl.value = data.warehouse_issued_by || "";
    qualityVerifiedByEl.value = data.quality_verified_by || "";
    approvingPart01El.value = data.approving_part_01 || "";
    approvingPart02El.value = data.approving_part_02 || "";
    finalBulkApprovalEl.value = data.final_bulk_approval || "";
    receivedProductionQtyEl.value = toNumber(data.received_production_qty, 0);
    producedByEl.value = data.produced_by || "";
    finalApprovalNotesEl.value = data.final_approval_notes || "";

    const finalOut = window.batchUi ? window.batchUi.normalizeFinalProductOut(data.final_product_out) : {};
    out25El.value = toNumber(finalOut.ltr_25, 0);
    out10El.value = toNumber(finalOut.ltr_10, 0);
    out5El.value = toNumber(finalOut.ltr_5, 0);
    out4El.value = toNumber(finalOut.ltr_4, 0);
    out1El.value = toNumber(finalOut.ltr_1, 0);
    out500El.value = toNumber(finalOut.ml_500, 0);
    out275El.value = toNumber(finalOut.ltr_275, 0);
    out150El.value = toNumber(finalOut.ltr_150, 0);
    out100El.value = toNumber(finalOut.ltr_100, 0);
    outOtherEl.value = toNumber(finalOut.other, 0);

    generatedItemsBodyEl.innerHTML = "";
    consumedItemsBodyEl.innerHTML = "";
    const generated = Array.isArray(data.items_generated) && data.items_generated.length ? data.items_generated : [{}];
    const consumed = Array.isArray(data.items_consumed) && data.items_consumed.length ? data.items_consumed : [{}];
    generated.forEach((row) => addItemRow(generatedItemsBodyEl, row));
    consumed.forEach((row) => addItemRow(consumedItemsBodyEl, row));

    referenceImage1PreviewEl.src = data.reference_image_1_url || "";
    referenceImage2PreviewEl.src = data.reference_image_2_url || "";
}

async function loadBatch() {
    const row = await request(`/batches/${batchId}`, "GET");
    fillForm(row);
}

batchFormEl.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!canUpdateBatch) {
        alert("You don't have permission to update batch.");
        return;
    }
    const payload = collectBatchPayload();
    if (!payload.batch_date) {
        alert("Batch date is required.");
        return;
    }
    try {
        const updated = await request(`/batches/${batchId}`, "PUT", payload);
        fillForm(updated);
        imageState.ref1 = { base64: "", fileName: "" };
        imageState.ref2 = { base64: "", fileName: "" };
        referenceImage1El.value = "";
        referenceImage2El.value = "";
        showMessageBox("Batch updated successfully.");
    } catch (err) {
        alert(err.message || "Failed to update batch.");
    }
});

openBatchViewBtn.addEventListener("click", () => {
    window.location.href = `view-batch.html?id=${batchId}`;
});

exportBatchPdfBtn.addEventListener("click", () => {
    try {
        const payload = collectBatchPayload();
        payload.batch_number = String(batchNumberEl.value || "").trim() || loadedBatch?.batch_number || "";
        if (window.batchUi) window.batchUi.buildBatchPdf(payload);
    } catch (err) {
        alert(err.message || "Failed to export PDF.");
    }
});

addGeneratedRowBtn.addEventListener("click", () => addItemRow(generatedItemsBodyEl));
addConsumedRowBtn.addEventListener("click", () => addItemRow(consumedItemsBodyEl));

referenceImage1El.addEventListener("change", async () => {
    try {
        await handleImageSelect(referenceImage1El, referenceImage1PreviewEl, "ref1");
    } catch (err) {
        alert(err.message || "Failed to load image.");
    }
});
referenceImage2El.addEventListener("change", async () => {
    try {
        await handleImageSelect(referenceImage2El, referenceImage2PreviewEl, "ref2");
    } catch (err) {
        alert(err.message || "Failed to load image.");
    }
});

(async function init() {
    try {
        await Promise.all([
            loadPoNumbers(),
            loadBatch(),
        ]);
    } catch (err) {
        alert(err.message || "Failed to load batch.");
        window.location.href = "batch-list.html";
    }
})();
