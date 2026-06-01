const rawRole = String(localStorage.getItem("role") || "").toLowerCase();
const role = ["coordinator", "cordinator", "co-ordinator", "co ordinator", "co_ordinator"].includes(rawRole) ? "user" : rawRole;
const selectedDb = String(localStorage.getItem("selectedDatabaseName") || "").toLowerCase();
const isTrainingUser = role === "user" && selectedDb === "demo";
const canManage = role === "admin" || role === "manager" || isTrainingUser;

const canViewBatchList = canManage
    ? true
    : (role === "user" && typeof hasUserActionPermission === "function"
        ? hasUserActionPermission("/production/batch-list.html", "view")
        : false);
const canAddBatch = canManage
    ? true
    : (role === "user" && typeof hasUserActionPermission === "function"
        ? (hasUserActionPermission("/production/create-batch.html", "add") || hasUserActionPermission("/production/batch-list.html", "add"))
        : false);
const canEditBatch = canManage
    ? true
    : (role === "user" && typeof hasUserActionPermission === "function"
        ? (hasUserActionPermission("/production/edit-batch.html", "edit") || hasUserActionPermission("/production/batch-list.html", "edit"))
        : false);
const canDeleteBatch = canManage
    ? true
    : (role === "user" && typeof hasUserActionPermission === "function"
        ? hasUserActionPermission("/production/batch-list.html", "delete")
        : false);

if (!localStorage.getItem("token")) {
    window.location.href = "../login.html";
}
if (!canViewBatchList) {
    alert("You don't have access to Batch List.");
    window.location.href = "../dashboard.html";
}

const addBatchBtn = document.getElementById("addBatchBtn");
const batchSearchEl = document.getElementById("batchSearch");
const batchTableBodyEl = document.querySelector("#batchTable tbody");
let allBatches = [];

if (!canAddBatch && addBatchBtn) {
    addBatchBtn.style.display = "none";
}

function renderRows(rows) {
    const list = Array.isArray(rows) ? rows : [];
    batchTableBodyEl.innerHTML = "";
    list.forEach((row) => {
        const generatedCount = Array.isArray(row.items_generated) ? row.items_generated.length : 0;
        const consumedCount = Array.isArray(row.items_consumed) ? row.items_consumed.length : 0;

        const tr = document.createElement("tr");
        if (canEditBatch) tr.classList.add("batch-row-clickable");
        tr.innerHTML = `
            <td>${row.batch_number || ""}</td>
            <td>${row.po_number || ""}</td>
            <td>${window.batchUi ? window.batchUi.formatDate(row.batch_date) : (row.batch_date || "")}</td>
            <td>${row.company_name || ""}</td>
            <td>${generatedCount}</td>
            <td>${consumedCount}</td>
            <td>
                <div class="batch-action-row">
                    <button class="icon-btn batch-view-btn" type="button" title="View batch" aria-label="View batch">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" fill="none" stroke="currentColor" stroke-width="1.6"/>
                            <circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="1.6"/>
                        </svg>
                    </button>
                    <button class="icon-btn batch-pdf-btn" type="button" title="Export PDF" aria-label="Export PDF">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7.5 3.5Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                            <path d="M14 3.5V8h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                            <path d="M12 10.5v6M9.5 14l2.5 2.5L14.5 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    ${canDeleteBatch ? `
                    <button class="icon-btn batch-delete-btn" type="button" title="Delete batch" aria-label="Delete batch">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                            <path d="M7 6h10M9 6v-1.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V6M8 6v13h8V6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                            <path d="M10.5 10v5M13.5 10v5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
                        </svg>
                    </button>` : ""}
                </div>
            </td>
        `;

        const viewBtn = tr.querySelector(".batch-view-btn");
        const pdfBtn = tr.querySelector(".batch-pdf-btn");
        const deleteBtn = tr.querySelector(".batch-delete-btn");

        viewBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            window.location.href = `view-batch.html?id=${row.id}`;
        });
        pdfBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            try {
                if (window.batchUi) window.batchUi.buildBatchPdf(row);
            } catch (err) {
                alert(err.message || "Failed to export PDF.");
            }
        });

        if (deleteBtn) {
            deleteBtn.addEventListener("click", async (event) => {
                event.stopPropagation();
                if (!confirm(`Delete ${row.batch_number || "this batch"}?`)) return;
                try {
                    await request(`/batches/${row.id}`, "DELETE");
                    showMessageBox("Batch deleted successfully.");
                    await loadBatches();
                } catch (err) {
                    alert(err.message || "Failed to delete batch.");
                }
            });
        }

        if (canEditBatch) {
            tr.addEventListener("click", (event) => {
                if (event.target.closest("button,a,input,select,textarea,.batch-action-row")) return;
                window.location.href = `edit-batch.html?id=${row.id}`;
            });
        }

        batchTableBodyEl.appendChild(tr);
    });
}

function applySearch() {
    const token = String(batchSearchEl.value || "").trim().toLowerCase();
    if (!token) {
        renderRows(allBatches);
        return;
    }
    const filtered = allBatches.filter((row) => {
        const fields = [row.batch_number, row.po_number, row.company_name, row.batch_date];
        return fields.some((field) => String(field || "").toLowerCase().includes(token));
    });
    renderRows(filtered);
}

async function loadBatches() {
    try {
        allBatches = await request("/batches", "GET");
        applySearch();
    } catch (err) {
        alert(err.message || "Failed to load batches.");
    }
}

batchSearchEl.addEventListener("input", applySearch);
loadBatches();
