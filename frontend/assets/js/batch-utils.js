(function(){
    const UNIT_OPTIONS = ["", "LT", "Ltr", "Ml", "KG", "Kg", "Grm", "MM", "CM", "Mtr", "QTY", "Other"];

    function toNumber(value, fallback = 0){
        const n = Number(value);
        return Number.isFinite(n) ? n : fallback;
    }

    function normalizeText(value){
        return String(value || "").trim();
    }

    function normalizeItems(rows){
        const list = Array.isArray(rows) ? rows : [];
        return list
            .map((row) => ({
                description: normalizeText(row?.description),
                qty: toNumber(row?.qty, 0),
                unit: normalizeText(row?.unit),
                remarks: normalizeText(row?.remarks)
            }))
            .filter((row) => row.description || row.qty > 0 || row.unit || row.remarks);
    }

    function normalizeFinalProductOut(raw){
        const source = raw && typeof raw === "object" ? raw : {};
        return {
            ltr_25: toNumber(source.ltr_25, 0),
            ltr_10: toNumber(source.ltr_10, 0),
            ltr_5: toNumber(source.ltr_5, 0),
            ltr_4: toNumber(source.ltr_4, 0),
            ltr_1: toNumber(source.ltr_1, 0),
            ml_500: toNumber(source.ml_500, 0),
            ltr_275: toNumber(source.ltr_275, 0),
            ltr_150: toNumber(source.ltr_150, 0),
            ltr_100: toNumber(source.ltr_100, 0),
            other: toNumber(source.other, 0),
        };
    }

    function resolveStorageUrl(rawPath){
        const value = String(rawPath || "").trim();
        if(!value) return "";
        if(/^https?:\/\//i.test(value)) return value;
        if(value.startsWith("/storage/")) return value;
        const clean = value.replace(/^\/+/, "").replace(/^storage\//i, "");
        return `/storage/${clean}`;
    }

    function formatDate(value){
        const raw = String(value || "").trim();
        if(!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
        const [y, m, d] = raw.split("-");
        return `${d}-${m}-${y}`;
    }

    function buildBatchPdf(batch){
        const jspdfRef = window.jspdf;
        if(!jspdfRef || !jspdfRef.jsPDF){
            throw new Error("jsPDF library is not loaded.");
        }
        const { jsPDF } = jspdfRef;
        const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
        const pageW = doc.internal.pageSize.getWidth();
        let y = 42;

        const line = (text, x = 40, size = 11, style = "normal") => {
            doc.setFont("helvetica", style);
            doc.setFontSize(size);
            doc.text(String(text || ""), x, y);
            y += size + 6;
        };

        const title = "BATCH CARD";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        doc.text(title, pageW - 40, 36, { align: "right" });

        line(`< ${batch.company_name || "AXIS PRODUCTION"} >`, 40, 14, "bold");
        line(`Batch No: ${batch.batch_number || ""}      PO No: ${batch.po_number || ""}      Date: ${formatDate(batch.batch_date || "")}`, 40, 11, "normal");
        y += 4;

        function drawItemsTable(sectionTitle, rows){
            doc.setFont("helvetica", "bold");
            doc.setFontSize(12);
            doc.text(sectionTitle, 40, y);
            y += 12;

            const startY = y;
            const cols = [
                { x: 40, w: 38, title: "S.N." },
                { x: 78, w: 300, title: "Description of Goods" },
                { x: 378, w: 82, title: "Qty." },
                { x: 460, w: 62, title: "Unit" },
                { x: 522, w: 50, title: "Remarks" },
            ];
            const rowHeight = 20;
            const safeRows = normalizeItems(rows);
            const tableRows = safeRows.length ? safeRows : [{ description: "", qty: "", unit: "", remarks: "" }];
            const totalRows = tableRows.length + 1;
            const bottomY = startY + rowHeight * totalRows;

            doc.setDrawColor(90, 90, 90);
            cols.forEach((col) => {
                doc.rect(col.x, startY, col.w, rowHeight);
                doc.setFont("helvetica", "bold");
                doc.setFontSize(10);
                doc.text(col.title, col.x + 4, startY + 14);
            });

            tableRows.forEach((row, index) => {
                const rowY = startY + rowHeight * (index + 1);
                cols.forEach((col) => doc.rect(col.x, rowY, col.w, rowHeight));
                doc.setFont("helvetica", "normal");
                doc.setFontSize(10);
                doc.text(String(index + 1), cols[0].x + 4, rowY + 14);
                doc.text(String(row.description || ""), cols[1].x + 4, rowY + 14, { maxWidth: cols[1].w - 8 });
                doc.text(String(Number(row.qty || 0) || ""), cols[2].x + 4, rowY + 14);
                doc.text(String(row.unit || ""), cols[3].x + 4, rowY + 14);
                doc.text(String(row.remarks || ""), cols[4].x + 4, rowY + 14);
            });

            y = bottomY + 18;
        }

        drawItemsTable("Items Generated", batch.items_generated);
        drawItemsTable("Items Consumed", batch.items_consumed);

        line(`Formula Prepared by: ${batch.formula_prepared_by || ""}       Formula Reviewed by: ${batch.formula_reviewed_by || ""}`, 40, 11, "normal");
        line(`Warehouse Issued By: ${batch.warehouse_issued_by || ""}       Quality Verified By: ${batch.quality_verified_by || ""}`, 40, 11, "normal");
        line(`Approving Part 01: ${batch.approving_part_01 || ""}`, 40, 11, "normal");
        line(`Approving Part 02: ${batch.approving_part_02 || ""}`, 40, 11, "normal");
        line(`Final Bulk Approval: ${batch.final_bulk_approval || ""}       System Entered By: ${batch.updated_by || batch.created_by || ""}`, 40, 11, "normal");
        y += 2;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Final Product Out", 40, y);
        y += 14;
        const out = normalizeFinalProductOut(batch.final_product_out);
        line(`25L:${out.ltr_25}   10L:${out.ltr_10}   5L:${out.ltr_5}   4L:${out.ltr_4}   1L:${out.ltr_1}   500ML:${out.ml_500}   275L:${out.ltr_275}   150L:${out.ltr_150}   100L:${out.ltr_100}   Other:${out.other}`, 40, 10, "normal");
        line(`Received Production Qty: ${toNumber(batch.received_production_qty, 0)} L`, 40, 11, "normal");
        line(`Produced By: ${batch.produced_by || ""}`, 40, 11, "normal");
        line(`Final Approval Notes: ${batch.final_approval_notes || ""}`, 40, 11, "normal");

        const safeBatchNo = String(batch.batch_number || "batch").replace(/[\\/:*?"<>|]/g, "_");
        doc.save(`${safeBatchNo}.pdf`);
    }

    window.batchUi = {
        UNIT_OPTIONS,
        normalizeItems,
        normalizeFinalProductOut,
        resolveStorageUrl,
        formatDate,
        buildBatchPdf,
        toNumber,
        normalizeText
    };
})();
