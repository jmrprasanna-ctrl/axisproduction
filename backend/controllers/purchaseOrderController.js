const { Op } = require("sequelize");
const db = require("../config/database");
const Customer = require("../models/Customer");
const Product = require("../models/Product");
const PurchaseOrder = require("../models/PurchaseOrder");
const PurchaseOrderItem = require("../models/PurchaseOrderItem");
const { generateNextCustomerCode } = require("../utils/customerCodeGenerator");

const CUSTOMER_MODE_DEFAULT = "General";
const CUSTOMER_TYPE_DEFAULT = "Silver";

function toUpper(value) {
    return String(value || "").trim().toUpperCase();
}

function toMoney(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeIsoDate(raw) {
    const input = String(raw || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) {
        return "";
    }
    const t = Date.parse(`${input}T00:00:00Z`);
    if (Number.isNaN(t)) return "";
    return input;
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

function formatPoNumber(dateToken, sequence) {
    return `POB-${dateToken}-${toPaddedSequence(sequence)}`;
}

function formatBatchNumber(dateToken, sequence) {
    return `BTP-${dateToken}-${toPaddedSequence(sequence)}`;
}

async function createCustomerFromPo(customerDraft, transaction) {
    const name = toUpper(customerDraft?.name);
    if (!name) {
        throw new Error("Customer name is required.");
    }
    const address = toUpper(customerDraft?.address);
    const quotation2Address = toUpper(customerDraft?.quotation2_address || customerDraft?.address);
    const tel = String(customerDraft?.tel || "").trim() || null;
    const contactPerson = String(customerDraft?.contact_person || "").trim() || null;
    const vatNumber = String(customerDraft?.vat_number || "").trim() || null;
    const customerType = String(customerDraft?.customer_type || CUSTOMER_TYPE_DEFAULT).trim() || CUSTOMER_TYPE_DEFAULT;
    const customerMode = String(customerDraft?.customer_mode || CUSTOMER_MODE_DEFAULT).trim() || CUSTOMER_MODE_DEFAULT;

    let email = String(customerDraft?.email || "").trim().toLowerCase();
    if (!email) {
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 18) || "customer";
        email = `${slug}.${Date.now()}@po.local`;
    }

    const created = await Customer.create({
        customer_id: await generateNextCustomerCode({
            customerName: name,
            CustomerModel: Customer,
            transaction,
        }),
        name,
        address: address || null,
        quotation2_address: quotation2Address || null,
        tel,
        contact_person: contactPerson,
        customer_type: customerType,
        customer_mode: customerMode,
        vat_number: vatNumber,
        email,
    }, { transaction });

    return created;
}

async function resolvePoCustomer({ customer_id, customer_name, customer }, transaction) {
    const customerId = Number(customer_id);
    if (Number.isFinite(customerId) && customerId > 0) {
        const existingById = await Customer.findByPk(customerId, { transaction });
        if (existingById) {
            return existingById;
        }
    }

    const nameFromPayload = toUpper(customer_name || customer?.name);
    if (nameFromPayload) {
        const existingByName = await Customer.findOne({
            where: { name: { [Op.iLike]: nameFromPayload } },
            transaction,
        });
        if (existingByName) {
            return existingByName;
        }
    }

    return createCustomerFromPo({
        ...(customer && typeof customer === "object" ? customer : {}),
        name: nameFromPayload || customer?.name || customer_name,
    }, transaction);
}

async function getNextSequenceForDate(poDate, transaction) {
    const safeDate = normalizeIsoDate(poDate) || new Date().toISOString().slice(0, 10);
    const maxSequence = await PurchaseOrder.max("sequence_no", {
        where: { po_date: safeDate },
        transaction,
    });
    const nextSequence = (Number.isFinite(Number(maxSequence)) ? Number(maxSequence) : 0) + 1;
    return {
        poDate: safeDate,
        dateToken: getDateTokenYYMMDD(safeDate),
        sequence: nextSequence,
    };
}

function normalizePoItems(rawItems) {
    const rows = Array.isArray(rawItems) ? rawItems : [];
    return rows
        .map((item) => {
            const description = String(item?.description || "").trim();
            const measurement = String(item?.measurement || "").trim();
            const qty = toMoney(item?.qty, 0);
            const unitPrice = toMoney(item?.unit_price, 0);
            const lineTotal = Number((qty * unitPrice).toFixed(2));
            const productId = Number(item?.product_id);
            return {
                product_id: Number.isFinite(productId) && productId > 0 ? productId : null,
                description,
                measurement: measurement || null,
                qty,
                unit_price: unitPrice,
                line_total: lineTotal,
            };
        })
        .filter((item) => item.description && item.qty > 0);
}

exports.getNextCode = async (req, res) => {
    try {
        const poDate = normalizeIsoDate(req.query?.date) || new Date().toISOString().slice(0, 10);
        const details = await getNextSequenceForDate(poDate, null);
        return res.json({
            po_date: details.poDate,
            date_token: details.dateToken,
            sequence_no: details.sequence,
            po_number: formatPoNumber(details.dateToken, details.sequence),
            batch_number: formatBatchNumber(details.dateToken, details.sequence),
        });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to build PO code." });
    }
};

exports.createPurchaseOrder = async (req, res) => {
    const poDateInput = normalizeIsoDate(req.body?.po_date);
    const deliveryDateInput = normalizeIsoDate(req.body?.delivery_date) || null;
    const notes = String(req.body?.notes || "").trim() || null;
    const items = normalizePoItems(req.body?.items);

    if (!poDateInput) {
        return res.status(400).json({ message: "PO date is required." });
    }
    if (!items.length) {
        return res.status(400).json({ message: "At least one valid PO item is required." });
    }

    try {
        const created = await db.transaction(async (transaction) => {
            const customer = await resolvePoCustomer({
                customer_id: req.body?.customer_id,
                customer_name: req.body?.customer_name,
                customer: req.body?.customer,
            }, transaction);

            await db.query("LOCK TABLE purchase_orders IN SHARE ROW EXCLUSIVE MODE;", { transaction });
            const nextCode = await getNextSequenceForDate(poDateInput, transaction);
            const poNumber = formatPoNumber(nextCode.dateToken, nextCode.sequence);
            const batchNumber = formatBatchNumber(nextCode.dateToken, nextCode.sequence);

            const grandTotal = Number(items.reduce((sum, item) => sum + Number(item.line_total || 0), 0).toFixed(2));
            const po = await PurchaseOrder.create({
                po_number: poNumber,
                batch_number: batchNumber,
                sequence_no: nextCode.sequence,
                po_date: nextCode.poDate,
                delivery_date: deliveryDateInput,
                customer_id: Number(customer.id),
                customer_name: String(customer.name || "").trim(),
                notes,
                grand_total: grandTotal,
            }, { transaction });

            for (const item of items) {
                let productId = item.product_id;
                let measurement = item.measurement;
                if (!productId && item.description) {
                    const existingProduct = await Product.findOne({
                        where: { description: { [Op.iLike]: item.description } },
                        attributes: ["id", "measurement"],
                        transaction,
                    });
                    if (existingProduct) {
                        productId = Number(existingProduct.id);
                        if (!measurement) {
                            measurement = String(existingProduct.measurement || "").trim() || null;
                        }
                    }
                }

                await PurchaseOrderItem.create({
                    purchase_order_id: Number(po.id),
                    product_id: Number.isFinite(Number(productId)) && Number(productId) > 0 ? Number(productId) : null,
                    description: item.description,
                    measurement: measurement || null,
                    qty: Number(item.qty || 0),
                    unit_price: Number(item.unit_price || 0),
                    line_total: Number(item.line_total || 0),
                }, { transaction });
            }

            return { po, customer };
        });

        const poWithItems = await PurchaseOrder.findByPk(created.po.id, {
            include: [
                { model: Customer, attributes: ["id", "customer_id", "name", "address", "tel", "contact_person", "customer_type", "customer_mode", "vat_number", "email"] },
                { model: PurchaseOrderItem, include: [{ model: Product, attributes: ["id", "product_id", "description", "measurement"] }] },
            ],
        });

        return res.status(201).json(poWithItems);
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to create purchase order." });
    }
};

exports.listPurchaseOrders = async (req, res) => {
    try {
        const q = String(req.query?.q || "").trim();
        const where = {};
        if (q) {
            where[Op.or] = [
                { po_number: { [Op.iLike]: `%${q}%` } },
                { batch_number: { [Op.iLike]: `%${q}%` } },
                { customer_name: { [Op.iLike]: `%${q}%` } },
            ];
        }

        const rows = await PurchaseOrder.findAll({
            where,
            include: [
                { model: Customer, attributes: ["id", "customer_id", "name"] },
                { model: PurchaseOrderItem, include: [{ model: Product, attributes: ["id", "product_id", "description", "measurement"] }] },
            ],
            order: [["po_date", "DESC"], ["id", "DESC"]],
        });

        return res.json(rows);
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to load purchase orders." });
    }
};
