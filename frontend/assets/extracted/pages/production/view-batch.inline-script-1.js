const rawRole = String(localStorage.getItem("role") || "").toLowerCase();
const role = ["coordinator", "cordinator", "co-ordinator", "co ordinator", "co_ordinator"].includes(rawRole) ? "user" : rawRole;
const selectedDb = String(localStorage.getItem("selectedDatabaseName") || "").toLowerCase();
const isTrainingUser = role === "user" && selectedDb === "demo";
const canManage = role === "admin" || role === "manager" || isTrainingUser;

const canViewBatch = canManage
    ? true
    : (role === "user" && typeof hasUserActionPermission === "function"
        ? hasUserActionPermission("/production/view-batch.html", "view")
        : false);
const canEditBatch = canManage
    ? true
    : (role === "user" && typeof hasUserActionPermission === "function"
        ? hasUserActionPermission("/production/edit-batch.html", "edit")
        : false);

if (!localStorage.getItem("token")) {
    window.location.href = "../login.html";
}
if (!canViewBatch) {
    alert("You don't have access to View Batch.");
    window.location.href = "../dashboard.html";
}

const params = new URLSearchParams(window.location.search);
const batchNumberParam = String(params.get("batch") || "").trim();
const legacyBatchId = Number(params.get("id") || 0);
if (!batchNumberParam && (!Number.isFinite(legacyBatchId) || legacyBatchId <= 0)) {
    alert("Invalid batch reference.");
    window.location.href = "batch-list.html";
}

const companyNameTextEl = document.getElementById("companyNameText");
const batchNoTextEl = document.getElementById("batchNoText");
const poNoTextEl = document.getElementById("poNoText");
const sequenceNoTextEl = document.getElementById("sequenceNoText");
const batchDateTextEl = document.getElementById("batchDateText");
const generatedBodyEl = document.getElementById("generatedBody");
const consumedBodyEl = document.getElementById("consumedBody");
const formulaPreparedByTextEl = document.getElementById("formulaPreparedByText");
const formulaReviewedByTextEl = document.getElementById("formulaReviewedByText");
const warehouseIssuedByTextEl = document.getElementById("warehouseIssuedByText");
const qualityVerifiedByTextEl = document.getElementById("qualityVerifiedByText");
const approvingPart01TextEl = document.getElementById("approvingPart01Text");
const approvingPart02TextEl = document.getElementById("approvingPart02Text");
const out25TextEl = document.getElementById("out25Text");
const out10TextEl = document.getElementById("out10Text");
const out5TextEl = document.getElementById("out5Text");
const out4TextEl = document.getElementById("out4Text");
const out1TextEl = document.getElementById("out1Text");
const out500TextEl = document.getElementById("out500Text");
const out275TextEl = document.getElementById("out275Text");
const out150TextEl = document.getElementById("out150Text");
const out100TextEl = document.getElementById("out100Text");
const outOtherTextEl = document.getElementById("outOtherText");
const receivedQtyTextEl = document.getElementById("receivedQtyText");
const producedByTextEl = document.getElementById("producedByText");
const finalBulkApprovalTextEl = document.getElementById("finalBulkApprovalText");
const finalApprovalNotesTextEl = document.getElementById("finalApprovalNotesText");
const refImage1El = document.getElementById("refImage1");
const refImage2El = document.getElementById("refImage2");
const editBatchBtnEl = document.getElementById("editBatchBtn");
const exportBatchPdfBtnEl = document.getElementById("exportBatchPdfBtn");

refImage1El.style.display = "none";
refImage2El.style.display = "none";

if (!canEditBatch && editBatchBtnEl) {
    editBatchBtnEl.disabled = true;
    editBatchBtnEl.style.opacity = "0.5";
    editBatchBtnEl.style.cursor = "not-allowed";
    editBatchBtnEl.title = "No permission to edit batch";
}

let loadedBatch = null;

function toNumber(value, fallback = 0) {
    return window.batchUi ? window.batchUi.toNumber(value, fallback) : fallback;
}

function setText(el, value, fallback = "-") {
    if (!el) return;
    const text = String(value || "").trim();
    el.textContent = text || fallback;
}

function fillItemsTable(tbodyEl, rows) {
    const list = window.batchUi ? window.batchUi.normalizeItems(rows) : (Array.isArray(rows) ? rows : []);
    const safeRows = list.length ? list : [{ description: "", qty: "", unit: "", remarks: "" }];
    tbodyEl.innerHTML = "";
    safeRows.forEach((row, idx) => {
        const tr = document.createElement("tr");
        const qtyText = Number.isFinite(Number(row.qty)) ? String(Number(row.qty)) : "";
        const values = [
            String(idx + 1),
            String(row.description || ""),
            qtyText,
            String(row.unit || ""),
            String(row.remarks || ""),
        ];
        values.forEach((value) => {
            const td = document.createElement("td");
            td.textContent = value;
            tr.appendChild(td);
        });
        tbodyEl.appendChild(tr);
    });
}

function fillBatch(data) {
    loadedBatch = data;
    const formattedDate = window.batchUi ? window.batchUi.formatDate(data.batch_date || "") : (data.batch_date || "");
    const finalOut = window.batchUi ? window.batchUi.normalizeFinalProductOut(data.final_product_out) : {};

    companyNameTextEl.textContent = `< ${String(data.company_name || "AXIS PRODUCTION").trim() || "AXIS PRODUCTION"} >`;
    setText(batchNoTextEl, data.batch_number);
    setText(poNoTextEl, data.po_number);
    setText(sequenceNoTextEl, data.sequence_no);
    setText(batchDateTextEl, formattedDate);

    fillItemsTable(generatedBodyEl, data.items_generated);
    fillItemsTable(consumedBodyEl, data.items_consumed);

    setText(formulaPreparedByTextEl, data.formula_prepared_by);
    setText(formulaReviewedByTextEl, data.formula_reviewed_by);
    setText(warehouseIssuedByTextEl, data.warehouse_issued_by);
    setText(qualityVerifiedByTextEl, data.quality_verified_by);
    setText(approvingPart01TextEl, data.approving_part_01);
    setText(approvingPart02TextEl, data.approving_part_02);

    setText(out25TextEl, toNumber(finalOut.ltr_25, 0), "0");
    setText(out10TextEl, toNumber(finalOut.ltr_10, 0), "0");
    setText(out5TextEl, toNumber(finalOut.ltr_5, 0), "0");
    setText(out4TextEl, toNumber(finalOut.ltr_4, 0), "0");
    setText(out1TextEl, toNumber(finalOut.ltr_1, 0), "0");
    setText(out500TextEl, toNumber(finalOut.ml_500, 0), "0");
    setText(out275TextEl, toNumber(finalOut.ltr_275, 0), "0");
    setText(out150TextEl, toNumber(finalOut.ltr_150, 0), "0");
    setText(out100TextEl, toNumber(finalOut.ltr_100, 0), "0");
    setText(outOtherTextEl, toNumber(finalOut.other, 0), "0");

    setText(receivedQtyTextEl, toNumber(data.received_production_qty, 0), "0");
    setText(producedByTextEl, data.produced_by);
    setText(finalBulkApprovalTextEl, data.final_bulk_approval);
    setText(finalApprovalNotesTextEl, data.final_approval_notes);

    refImage1El.src = data.reference_image_1_url || "";
    refImage2El.src = data.reference_image_2_url || "";
    refImage1El.style.display = data.reference_image_1_url ? "block" : "none";
    refImage2El.style.display = data.reference_image_2_url ? "block" : "none";
}

async function loadBatch() {
    const endpoint = batchNumberParam
        ? `/batches/by-batch/${encodeURIComponent(batchNumberParam)}`
        : `/batches/${legacyBatchId}`;
    const row = await request(endpoint, "GET");
    fillBatch(row);
}

editBatchBtnEl.addEventListener("click", () => {
    if (!canEditBatch) return;
    const batchNumber = String(loadedBatch?.batch_number || batchNumberParam || "").trim();
    if (!batchNumber) {
        alert("Batch number is missing.");
        return;
    }
    window.location.href = `edit-batch.html?batch=${encodeURIComponent(batchNumber)}`;
});

exportBatchPdfBtnEl.addEventListener("click", () => {
    try {
        if (!window.batchUi || !loadedBatch) return;
        window.batchUi.buildBatchPdf(loadedBatch);
    } catch (err) {
        alert(err.message || "Failed to export PDF.");
    }
});

(async function init() {
    try {
        await loadBatch();
    } catch (err) {
        alert(err.message || "Failed to load batch.");
        window.location.href = "batch-list.html";
    }
})();
