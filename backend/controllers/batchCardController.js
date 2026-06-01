const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const db = require("../config/database");
const BatchCard = require("../models/BatchCard");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseOrderItem = require("../models/PurchaseOrderItem");

const STORAGE_ROOT = path.resolve(__dirname, "../storage/batches");
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif"]);

function normalizeIsoDate(raw) {
    const input = String(raw || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return "";
    const t = Date.parse(`${input}T00:00:00Z`);
    if (Number.isNaN(t)) return "";
    return input;
}

function normalizeText(value) {
    const cleaned = String(value || "").trim();
    return cleaned || null;
}

function normalizeBatchNumber(value) {
    const raw = String(value || "").trim().toUpperCase();
    return raw;
}

function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function getDateTokenYYMMDD(isoDate) {
    const safe = normalizeIsoDate(isoDate) || new Date().toISOString().slice(0, 10);
    return safe.slice(2, 4) + safe.slice(5, 7) + safe.slice(8, 10);
}

function toPaddedSequence(sequence) {
    const n = Number(sequence);
    if (!Number.isFinite(n) || n <= 0) return "001";
    return String(Math.floor(n)).padStart(3, "0");
}

function formatBatchNumber(dateToken, sequence) {
    return `BTP-${dateToken}-${toPaddedSequence(sequence)}`;
}

function parseBatchNumberParts(batchNumber) {
    const raw = normalizeBatchNumber(batchNumber);
    const match = raw.match(/^BTP-(\d{6})-(\d{3})$/);
    if (!match) {
        return { batchNumber: raw, dateToken: "", sequence: 1, isoDate: "" };
    }
    const dateToken = String(match[1] || "");
    const yy = Number(dateToken.slice(0, 2));
    const mm = Number(dateToken.slice(2, 4));
    const dd = Number(dateToken.slice(4, 6));
    const yyyy = 2000 + yy;
    const isoDate = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    const safeIso = normalizeIsoDate(isoDate);
    return {
        batchNumber: raw,
        dateToken,
        sequence: Number(match[2] || 1) || 1,
        isoDate: safeIso,
    };
}

function parseBase64Payload(fileDataBase64) {
    const raw = String(fileDataBase64 || "").trim();
    if (!raw) return Buffer.alloc(0);
    const parts = raw.split(",");
    const payload = parts.length > 1 ? parts.slice(1).join(",") : raw;
    return Buffer.from(payload, "base64");
}

function safeNamePart(value, fallback = "batch") {
    const token = String(value || "")
        .trim()
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
    return token || fallback;
}

function extractImageExtension(rawBase64, fileName) {
    const nameExt = path.extname(String(fileName || "").trim().toLowerCase());
    if (IMAGE_EXTENSIONS.has(nameExt)) {
        return nameExt;
    }

    const raw = String(rawBase64 || "").trim();
    const mimeMatch = raw.match(/^data:image\/([a-zA-Z0-9.+-]+);base64,/i);
    if (!mimeMatch) return ".jpg";
    const mimeType = String(mimeMatch[1] || "").toLowerCase();
    if (mimeType.includes("png")) return ".png";
    if (mimeType.includes("webp")) return ".webp";
    if (mimeType.includes("bmp")) return ".bmp";
    if (mimeType.includes("gif")) return ".gif";
    return ".jpg";
}

function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function resolveStorageAbsoluteFromRelative(relPath) {
    const raw = String(relPath || "").trim();
    if (!raw) return "";
    if (path.isAbsolute(raw)) return raw;
    let relative = raw.replace(/\\/g, "/");
    if (relative.startsWith("/storage/")) {
        relative = relative.slice("/storage/".length);
    } else if (relative.startsWith("storage/")) {
        relative = relative.slice("storage/".length);
    }
    return path.resolve(__dirname, "../storage", relative);
}

function toStoragePublicPath(relativePath) {
    const clean = String(relativePath || "").trim().replace(/\\/g, "/").replace(/^\/+/, "");
    if (!clean) return "";
    return clean.startsWith("storage/") ? `/${clean}` : `/storage/${clean}`;
}

function normalizeItemRows(rows) {
    const list = Array.isArray(rows) ? rows : [];
    return list
        .map((row) => ({
            description: String(row?.description || "").trim(),
            qty: toNumber(row?.qty, 0),
            unit: String(row?.unit || "").trim(),
            remarks: String(row?.remarks || "").trim(),
        }))
        .filter((row) => row.description || row.qty > 0 || row.unit || row.remarks);
}

function mapPoItemsToGeneratedItems(items) {
    const rows = Array.isArray(items) ? items : [];
    return rows
        .map((item) => ({
            description: String(item?.description || "").trim(),
            qty: toNumber(item?.qty, 0),
            unit: String(item?.measurement || "").trim(),
            remarks: "",
        }))
        .filter((row) => row.description || row.qty > 0 || row.unit || row.remarks);
}

function normalizeFinalProductOut(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const output = {};
    const allowedKeys = [
        "ltr_25",
        "ltr_10",
        "ltr_5",
        "ltr_4",
        "ltr_1",
        "ml_500",
        "ltr_275",
        "ltr_150",
        "ltr_100",
        "other",
    ];
    for (const key of allowedKeys) {
        output[key] = toNumber(source[key], 0);
    }
    return output;
}

function serializeBatch(row) {
    if (!row) return null;
    const plain = row.toJSON ? row.toJSON() : row;
    const ref1 = String(plain.reference_image_1_path || "").trim();
    const ref2 = String(plain.reference_image_2_path || "").trim();
    return {
        ...plain,
        reference_image_1_url: ref1 ? toStoragePublicPath(ref1) : "",
        reference_image_2_url: ref2 ? toStoragePublicPath(ref2) : "",
    };
}

function toPoViewItem(item) {
    return {
        id: Number(item?.id) || null,
        product_id: Number(item?.product_id) || null,
        description: String(item?.description || "").trim(),
        measurement: String(item?.measurement || "").trim() || null,
        qty: toNumber(item?.qty, 0),
        unit_price: toNumber(item?.unit_price, 0),
        line_total: toNumber(item?.line_total, 0),
    };
}

function buildBatchViewFromPoAndCard(poRow, batchRow) {
    const po = poRow ? (poRow.toJSON ? poRow.toJSON() : poRow) : null;
    const card = batchRow ? serializeBatch(batchRow) : null;
    const poItems = Array.isArray(po?.PurchaseOrderItems) ? po.PurchaseOrderItems : [];
    const generatedFromPo = mapPoItemsToGeneratedItems(poItems);
    const parsed = parseBatchNumberParts(card?.batch_number || po?.batch_number || "");

    const output = {
        id: card?.id || null,
        source: card ? "batch_card" : "purchase_order",
        has_saved_batch_card: Boolean(card),
        po_id: Number(po?.id) || null,
        po_number: card?.po_number || po?.po_number || null,
        batch_number: card?.batch_number || po?.batch_number || parsed.batchNumber || null,
        sequence_no: Number(card?.sequence_no || po?.sequence_no || parsed.sequence || 1),
        company_name: card?.company_name || "AXIS PRODUCTION",
        batch_date: card?.batch_date || po?.po_date || parsed.isoDate || null,
        customer_name: String(po?.customer_name || "").trim() || null,
        delivery_date: po?.delivery_date || null,
        po_notes: String(po?.notes || "").trim() || null,
        po_items: poItems.map(toPoViewItem),
        items_generated: (Array.isArray(card?.items_generated) && card.items_generated.length)
            ? normalizeItemRows(card.items_generated)
            : generatedFromPo,
        items_consumed: normalizeItemRows(card?.items_consumed),
        warehouse_issued_by: card?.warehouse_issued_by || null,
        quality_verified_by: card?.quality_verified_by || null,
        formula_prepared_by: card?.formula_prepared_by || null,
        formula_reviewed_by: card?.formula_reviewed_by || null,
        approving_part_01: card?.approving_part_01 || null,
        approving_part_02: card?.approving_part_02 || null,
        final_bulk_approval: card?.final_bulk_approval || null,
        final_product_out: normalizeFinalProductOut(card?.final_product_out),
        received_production_qty: toNumber(card?.received_production_qty, 0),
        produced_by: card?.produced_by || null,
        final_approval_notes: card?.final_approval_notes || null,
        reference_image_1_path: card?.reference_image_1_path || null,
        reference_image_2_path: card?.reference_image_2_path || null,
        reference_image_1_url: card?.reference_image_1_url || "",
        reference_image_2_url: card?.reference_image_2_url || "",
        created_by: card?.created_by || null,
        updated_by: card?.updated_by || null,
        createdAt: card?.createdAt || null,
        updatedAt: card?.updatedAt || null,
    };

    return output;
}

async function getNextSequenceForDate(batchDate, transaction) {
    const safeDate = normalizeIsoDate(batchDate) || new Date().toISOString().slice(0, 10);
    const maxSequence = await BatchCard.max("sequence_no", {
        where: { batch_date: safeDate },
        transaction: transaction || undefined,
    });
    const nextSequence = (Number.isFinite(Number(maxSequence)) ? Number(maxSequence) : 0) + 1;
    return {
        batchDate: safeDate,
        dateToken: getDateTokenYYMMDD(safeDate),
        sequence: nextSequence,
    };
}

function getCurrentUserId(req) {
    const id = Number(req?.user?.id || req?.user?.userId || 0);
    return Number.isFinite(id) && id > 0 ? id : null;
}

function getCurrentDbName(req) {
    return safeNamePart(req?.databaseName || req?.user?.database_name || "axisproductdb", "axisproductdb");
}

function saveReferenceImage({
    base64Value,
    fileName,
    slot,
    batchNumber,
    databaseName,
    previousPath,
}) {
    const raw = String(base64Value || "").trim();
    if (!raw) {
        return previousPath || null;
    }

    const buffer = parseBase64Payload(raw);
    if (!buffer.length) {
        return previousPath || null;
    }

    const extension = extractImageExtension(raw, fileName);
    const dbDir = path.join(STORAGE_ROOT, safeNamePart(databaseName, "axisproductdb"));
    ensureDir(dbDir);

    const safeBatch = safeNamePart(batchNumber, "batch");
    const safeSlot = slot === 2 ? "ref2" : "ref1";
    const targetFileName = `${safeBatch}-${safeSlot}-${Date.now()}${extension}`;
    const absolutePath = path.join(dbDir, targetFileName);
    fs.writeFileSync(absolutePath, buffer);

    if (previousPath) {
        const oldAbs = resolveStorageAbsoluteFromRelative(previousPath);
        if (oldAbs && fs.existsSync(oldAbs)) {
            try {
                fs.unlinkSync(oldAbs);
            } catch (_err) {
            }
        }
    }

    const relative = path.relative(path.resolve(__dirname, "../storage"), absolutePath).replace(/\\/g, "/");
    return relative;
}

exports.generateBatchNumber = async (req, res) => {
    try {
        const batchDate = normalizeIsoDate(req.query?.date) || new Date().toISOString().slice(0, 10);
        const details = await getNextSequenceForDate(batchDate, null);
        return res.json({
            batch_date: details.batchDate,
            date_token: details.dateToken,
            sequence_no: details.sequence,
            batch_number: formatBatchNumber(details.dateToken, details.sequence),
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to generate batch number." });
    }
};

exports.listBatches = async (req, res) => {
    try {
        const q = String(req.query?.q || "").trim();
        const poWhere = {};
        if (q) {
            poWhere[Op.or] = [
                { batch_number: { [Op.iLike]: `%${q}%` } },
                { po_number: { [Op.iLike]: `%${q}%` } },
                { customer_name: { [Op.iLike]: `%${q}%` } },
            ];
        }
        const poRows = await PurchaseOrder.findAll({
            where: poWhere,
            include: [{ model: PurchaseOrderItem }],
            order: [["po_date", "DESC"], ["id", "DESC"]],
        });
        const poBatchNumbers = Array.from(new Set(
            poRows
                .map((row) => normalizeBatchNumber(row?.batch_number))
                .filter(Boolean)
        ));

        const cardRows = poBatchNumbers.length
            ? await BatchCard.findAll({
                where: { batch_number: { [Op.in]: poBatchNumbers } },
                order: [["batch_date", "DESC"], ["id", "DESC"]],
            })
            : [];

        const cardByBatchNumber = new Map();
        cardRows.forEach((row) => {
            const key = normalizeBatchNumber(row?.batch_number);
            if (key) cardByBatchNumber.set(key, row);
        });

        const merged = poRows.map((poRow) => {
            const key = normalizeBatchNumber(poRow?.batch_number);
            const cardRow = cardByBatchNumber.get(key) || null;
            return buildBatchViewFromPoAndCard(poRow, cardRow);
        });

        return res.json(merged);
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to load batches." });
    }
};

exports.getBatchById = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid batch id." });
        }
        const row = await BatchCard.findByPk(id);
        if (!row) {
            return res.status(404).json({ message: "Batch not found." });
        }
        return res.json(serializeBatch(row));
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to load batch." });
    }
};

exports.getBatchByBatchNumber = async (req, res) => {
    try {
        const batchNumber = normalizeBatchNumber(req.params.batchNumber);
        if (!batchNumber) {
            return res.status(400).json({ message: "Batch number is required." });
        }
        const poRow = await PurchaseOrder.findOne({
            where: { batch_number: batchNumber },
            include: [{ model: PurchaseOrderItem }],
        });
        const batchRow = await BatchCard.findOne({
            where: { batch_number: batchNumber },
        });
        if (!poRow && !batchRow) {
            return res.status(404).json({ message: "Batch not found." });
        }
        return res.json(buildBatchViewFromPoAndCard(poRow, batchRow));
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to load batch." });
    }
};

exports.createBatch = async (req, res) => {
    const batchDateInput = normalizeIsoDate(req.body?.batch_date);
    if (!batchDateInput) {
        return res.status(400).json({ message: "Valid batch date is required." });
    }

    try {
        const userId = getCurrentUserId(req);
        const dbName = getCurrentDbName(req);
        const created = await db.transaction(async (transaction) => {
            await db.query("LOCK TABLE batch_cards IN SHARE ROW EXCLUSIVE MODE;", { transaction });
            const next = await getNextSequenceForDate(batchDateInput, transaction);
            const batchNumber = formatBatchNumber(next.dateToken, next.sequence);

            const row = await BatchCard.create({
                po_number: normalizeText(req.body?.po_number),
                batch_number: batchNumber,
                sequence_no: next.sequence,
                company_name: String(req.body?.company_name || "AXIS PRODUCTION").trim() || "AXIS PRODUCTION",
                batch_date: next.batchDate,
                items_generated: normalizeItemRows(req.body?.items_generated),
                items_consumed: normalizeItemRows(req.body?.items_consumed),
                warehouse_issued_by: normalizeText(req.body?.warehouse_issued_by),
                quality_verified_by: normalizeText(req.body?.quality_verified_by),
                formula_prepared_by: normalizeText(req.body?.formula_prepared_by),
                formula_reviewed_by: normalizeText(req.body?.formula_reviewed_by),
                approving_part_01: normalizeText(req.body?.approving_part_01),
                approving_part_02: normalizeText(req.body?.approving_part_02),
                final_bulk_approval: normalizeText(req.body?.final_bulk_approval),
                final_product_out: normalizeFinalProductOut(req.body?.final_product_out),
                received_production_qty: toNumber(req.body?.received_production_qty, 0),
                produced_by: normalizeText(req.body?.produced_by),
                final_approval_notes: normalizeText(req.body?.final_approval_notes),
                created_by: userId,
                updated_by: userId,
            }, { transaction });

            const ref1 = saveReferenceImage({
                base64Value: req.body?.reference_image_1_base64,
                fileName: req.body?.reference_image_1_name,
                slot: 1,
                batchNumber,
                databaseName: dbName,
                previousPath: null,
            });
            const ref2 = saveReferenceImage({
                base64Value: req.body?.reference_image_2_base64,
                fileName: req.body?.reference_image_2_name,
                slot: 2,
                batchNumber,
                databaseName: dbName,
                previousPath: null,
            });

            if (ref1 || ref2) {
                await row.update({
                    reference_image_1_path: ref1 || null,
                    reference_image_2_path: ref2 || null,
                }, { transaction });
            }

            return row;
        });

        return res.status(201).json(serializeBatch(created));
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to create batch." });
    }
};

exports.updateBatch = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid batch id." });
        }
        const row = await BatchCard.findByPk(id);
        if (!row) {
            return res.status(404).json({ message: "Batch not found." });
        }

        const userId = getCurrentUserId(req);
        const dbName = getCurrentDbName(req);
        const batchDate = normalizeIsoDate(req.body?.batch_date) || row.batch_date;
        const companyName = String(req.body?.company_name || row.company_name || "AXIS PRODUCTION").trim() || "AXIS PRODUCTION";

        const ref1 = saveReferenceImage({
            base64Value: req.body?.reference_image_1_base64,
            fileName: req.body?.reference_image_1_name,
            slot: 1,
            batchNumber: row.batch_number,
            databaseName: dbName,
            previousPath: row.reference_image_1_path,
        });
        const ref2 = saveReferenceImage({
            base64Value: req.body?.reference_image_2_base64,
            fileName: req.body?.reference_image_2_name,
            slot: 2,
            batchNumber: row.batch_number,
            databaseName: dbName,
            previousPath: row.reference_image_2_path,
        });

        await row.update({
            po_number: normalizeText(req.body?.po_number),
            company_name: companyName,
            batch_date: batchDate,
            items_generated: normalizeItemRows(req.body?.items_generated),
            items_consumed: normalizeItemRows(req.body?.items_consumed),
            warehouse_issued_by: normalizeText(req.body?.warehouse_issued_by),
            quality_verified_by: normalizeText(req.body?.quality_verified_by),
            formula_prepared_by: normalizeText(req.body?.formula_prepared_by),
            formula_reviewed_by: normalizeText(req.body?.formula_reviewed_by),
            approving_part_01: normalizeText(req.body?.approving_part_01),
            approving_part_02: normalizeText(req.body?.approving_part_02),
            final_bulk_approval: normalizeText(req.body?.final_bulk_approval),
            final_product_out: normalizeFinalProductOut(req.body?.final_product_out),
            received_production_qty: toNumber(req.body?.received_production_qty, 0),
            produced_by: normalizeText(req.body?.produced_by),
            final_approval_notes: normalizeText(req.body?.final_approval_notes),
            reference_image_1_path: ref1 || null,
            reference_image_2_path: ref2 || null,
            updated_by: userId,
        });

        return res.json(serializeBatch(row));
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to update batch." });
    }
};

exports.updateBatchByBatchNumber = async (req, res) => {
    try {
        const batchNumber = normalizeBatchNumber(req.params.batchNumber);
        if (!batchNumber) {
            return res.status(400).json({ message: "Batch number is required." });
        }

        const poRow = await PurchaseOrder.findOne({
            where: { batch_number: batchNumber },
            include: [{ model: PurchaseOrderItem }],
        });
        if (!poRow) {
            return res.status(404).json({ message: "PO for this batch number was not found." });
        }

        const userId = getCurrentUserId(req);
        const dbName = getCurrentDbName(req);
        const parsed = parseBatchNumberParts(batchNumber);
        const existing = await BatchCard.findOne({ where: { batch_number: batchNumber } });

        const baseBatchDate = normalizeIsoDate(req.body?.batch_date)
            || normalizeIsoDate(poRow?.po_date)
            || parsed.isoDate
            || new Date().toISOString().slice(0, 10);
        const baseSequence = Number(existing?.sequence_no || poRow?.sequence_no || parsed.sequence || 1);
        const companyName = String(req.body?.company_name || existing?.company_name || "AXIS PRODUCTION").trim() || "AXIS PRODUCTION";

        let ref1 = existing?.reference_image_1_path || null;
        let ref2 = existing?.reference_image_2_path || null;
        if (existing) {
            ref1 = saveReferenceImage({
                base64Value: req.body?.reference_image_1_base64,
                fileName: req.body?.reference_image_1_name,
                slot: 1,
                batchNumber,
                databaseName: dbName,
                previousPath: existing.reference_image_1_path,
            });
            ref2 = saveReferenceImage({
                base64Value: req.body?.reference_image_2_base64,
                fileName: req.body?.reference_image_2_name,
                slot: 2,
                batchNumber,
                databaseName: dbName,
                previousPath: existing.reference_image_2_path,
            });
        } else {
            ref1 = saveReferenceImage({
                base64Value: req.body?.reference_image_1_base64,
                fileName: req.body?.reference_image_1_name,
                slot: 1,
                batchNumber,
                databaseName: dbName,
                previousPath: null,
            });
            ref2 = saveReferenceImage({
                base64Value: req.body?.reference_image_2_base64,
                fileName: req.body?.reference_image_2_name,
                slot: 2,
                batchNumber,
                databaseName: dbName,
                previousPath: null,
            });
        }

        const dataToSave = {
            po_number: normalizeText(req.body?.po_number) || poRow.po_number || null,
            batch_number: batchNumber,
            sequence_no: baseSequence,
            company_name: companyName,
            batch_date: baseBatchDate,
            items_generated: normalizeItemRows(req.body?.items_generated),
            items_consumed: normalizeItemRows(req.body?.items_consumed),
            warehouse_issued_by: normalizeText(req.body?.warehouse_issued_by),
            quality_verified_by: normalizeText(req.body?.quality_verified_by),
            formula_prepared_by: normalizeText(req.body?.formula_prepared_by),
            formula_reviewed_by: normalizeText(req.body?.formula_reviewed_by),
            approving_part_01: normalizeText(req.body?.approving_part_01),
            approving_part_02: normalizeText(req.body?.approving_part_02),
            final_bulk_approval: normalizeText(req.body?.final_bulk_approval),
            final_product_out: normalizeFinalProductOut(req.body?.final_product_out),
            received_production_qty: toNumber(req.body?.received_production_qty, 0),
            produced_by: normalizeText(req.body?.produced_by),
            final_approval_notes: normalizeText(req.body?.final_approval_notes),
            reference_image_1_path: ref1 || null,
            reference_image_2_path: ref2 || null,
            updated_by: userId,
        };

        let saved;
        if (existing) {
            await existing.update(dataToSave);
            saved = existing;
        } else {
            saved = await BatchCard.create({
                ...dataToSave,
                created_by: userId,
            });
        }

        const poRefresh = await PurchaseOrder.findOne({
            where: { batch_number: batchNumber },
            include: [{ model: PurchaseOrderItem }],
        });

        return res.json(buildBatchViewFromPoAndCard(poRefresh, saved));
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to update batch." });
    }
};

exports.deleteBatch = async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isFinite(id) || id <= 0) {
            return res.status(400).json({ message: "Invalid batch id." });
        }
        const row = await BatchCard.findByPk(id);
        if (!row) {
            return res.status(404).json({ message: "Batch not found." });
        }

        const imagePaths = [row.reference_image_1_path, row.reference_image_2_path]
            .map((x) => resolveStorageAbsoluteFromRelative(x))
            .filter(Boolean);
        await row.destroy();
        for (const absPath of imagePaths) {
            if (fs.existsSync(absPath)) {
                try {
                    fs.unlinkSync(absPath);
                } catch (_err) {
                }
            }
        }
        return res.json({ message: "Batch deleted successfully." });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to delete batch." });
    }
};
