const Product = require("../models/Product");
const Vendor = require("../models/Vendor");
const Category = require("../models/Category");
const InvoiceItem = require("../models/InvoiceItem");
const Stock = require("../models/Stock");
const { Op } = require("sequelize");

const toNum = (value, fallback = 0) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};

const cleanUpper = (value) => String(value || "").trim().toUpperCase();

const normalizeRowType = (value, fallback = "") => {
    const token = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    if(token === "metirial" || token === "material") return "Metirial";
    if(token === "finish good" || token === "finishgood") return "Finish Good";
    if(token === "other") return "Other";
    return fallback;
};

const resolveLegacyRowType = (categoryValue) => {
    const token = String(categoryValue || "").trim().toLowerCase().replace(/\s+/g, " ");
    if(!token) return "";
    if(token.includes("consumable") || token.includes("accessory") || token.includes("spare")){
        return "Metirial";
    }
    if(token === "other"){
        return "Other";
    }
    return "Finish Good";
};

exports.getProducts = async (req,res)=>{
    const { category } = req.query;
    const where = {};
    if(category) where.category_id = category;
    const products = await Product.findAll({ where, include:[Vendor, Category] });
    res.json(products);
}

exports.searchProducts = async (req,res)=>{
    try{
        const q = String(req.query.q || "").trim();
        const parsedLimit = Number(req.query.limit);
        const limit = Number.isFinite(parsedLimit)
            ? Math.min(Math.max(parsedLimit, 1), 100)
            : 25;

        if(!q){
            return res.json([]);
        }

        const where = {
            [Op.or]: [
                { product_id: { [Op.iLike]: `%${q}%` } },
                { description: { [Op.iLike]: `%${q}%` } },
                { model: { [Op.iLike]: `%${q}%` } },
                { row_type: { [Op.iLike]: `%${q}%` } },
                { "$Vendor.name$": { [Op.iLike]: `%${q}%` } }
            ]
        };

        const rows = await Product.findAll({
            where,
            attributes: ["id","product_id","description","row_type","model","selling_price","count"],
            include: [{ model: Vendor, attributes: ["id", "name"] }],
            order: [["product_id","ASC"]],
            limit: Math.max(limit, 50)
        });

        const lowerQ = q.toLowerCase();
        const rank = (row) => {
            const code = String(row.product_id || "").toLowerCase();
            const desc = String(row.description || "").toLowerCase();
            const rowType = String(row.row_type || "").toLowerCase();
            const model = String(row.model || "").toLowerCase();
            if(code === lowerQ) return 0;
            if(code.startsWith(lowerQ)) return 1;
            if(desc.startsWith(lowerQ)) return 2;
            if(rowType.startsWith(lowerQ)) return 3;
            if(model.startsWith(lowerQ)) return 4;
            if(code.includes(lowerQ)) return 5;
            if(desc.includes(lowerQ)) return 6;
            if(rowType.includes(lowerQ)) return 7;
            if(model.includes(lowerQ)) return 8;
            return 9;
        };

        const ranked = rows
            .sort((a, b) => {
                const ra = rank(a);
                const rb = rank(b);
                if(ra !== rb) return ra - rb;
                return String(a.product_id || "").localeCompare(String(b.product_id || ""));
            })
            .slice(0, limit)
            .map((row) => {
                const plain = row.toJSON();
                return {
                    id: plain.id,
                    product_id: plain.product_id,
                    description: plain.description,
                    row_type: plain.row_type,
                    model: plain.model,
                    selling_price: plain.selling_price,
                    count: plain.count,
                    vendor_id: plain.Vendor ? plain.Vendor.id : null,
                    vendor_name: plain.Vendor ? plain.Vendor.name : ""
                };
            });

        res.json(ranked);
    }catch(err){
        res.status(500).json({ message: err.message || "Failed to search products." });
    }
};

exports.getProductById = async (req,res)=>{
    const { id } = req.params;
    const product = await Product.findByPk(id, { include:[Vendor, Category] });
    if(!product){
        return res.status(404).json({ message: "Product not found." });
    }
    res.json(product);
};

exports.createProduct = async (req,res)=>{
    try{
        let {
            row_type,
            category,
            product_id,
            description,
            model,
            serial_no,
            count,
            selling_price,
            dealer_price,
            vendor_id
        } = req.body;

        const normalizedRowType = normalizeRowType(row_type, resolveLegacyRowType(category));
        const rawCategory = category;
        category = typeof category === "string" ? category.trim() : "";
        const parsedVendorId = Number(vendor_id);
        const parsedCount = toNum(count, 0);
        const parsedSelling = toNum(selling_price, 0);
        const parsedDealer = toNum(dealer_price, 0);

        product_id = String(product_id || "").trim();
        description = cleanUpper(description);
        model = cleanUpper(model);
        serial_no = cleanUpper(serial_no);

        if(!normalizedRowType || !product_id || !description || !Number.isFinite(parsedVendorId) || parsedVendorId <= 0){
            return res.status(400).json({ message: "Missing required fields." });
        }
        if(parsedCount < 0 || parsedSelling < 0 || parsedDealer < 0){
            return res.status(400).json({ message: "Count and prices cannot be negative." });
        }

        let categoryRecord = null;
        const categoryId = Number(rawCategory);
        if(Number.isFinite(categoryId) && categoryId > 0){
            categoryRecord = await Category.findByPk(categoryId);
        }
        if(!categoryRecord && category){
            categoryRecord = await Category.findOne({ where: { name: category } });
        }
        if(!categoryRecord && category){
            categoryRecord = await Category.create({ name: category || `Category ${Date.now()}` });
        }

        const created = await Product.create({
            product_id,
            description,
            row_type: normalizedRowType,
            category_id: categoryRecord ? categoryRecord.id : null,
            model: model || null,
            serial_no: serial_no || null,
            count: parsedCount,
            selling_price: parsedSelling,
            dealer_price: parsedDealer,
            vendor_id: parsedVendorId
        });

        res.status(201).json(created);
    }catch(err){
        res.status(500).json({ message: err.message || "Failed to save product." });
    }
};

exports.getLastProductByCategoryName = async (req,res)=>{
    const { categoryName } = req.params;
    if(!categoryName){
        return res.json(null);
    }

    const normalizedRowType = normalizeRowType(categoryName);
    if(normalizedRowType){
        const lastByRow = await Product.findOne({
            where: { row_type: normalizedRowType },
            order: [["createdAt","DESC"], ["id","DESC"]],
        });
        if(lastByRow){
            return res.json(lastByRow);
        }
    }

    const category = await Category.findOne({ where: { name: categoryName } });
    if(!category){
        return res.json(null);
    }

    const lastProduct = await Product.findOne({
        where: { category_id: category.id },
        order: [["createdAt","DESC"], ["id","DESC"]],
    });

    res.json(lastProduct || null);
};

exports.updateProduct = async (req,res)=>{
    try{
        const { id } = req.params;
        let {
            row_type,
            category,
            product_id,
            description,
            model,
            serial_no,
            count,
            selling_price,
            dealer_price,
            vendor_id
        } = req.body;

        const product = await Product.findByPk(id);
        if(!product){
            return res.status(404).json({ message: "Product not found." });
        }

        const fallbackRowType = product.row_type || resolveLegacyRowType(category) || "Other";
        const normalizedRowType = normalizeRowType(row_type || category, fallbackRowType);
        const rawCategory = category;
        category = typeof category === "string" ? category.trim() : "";
        const vendorCandidate = Number(vendor_id);
        const parsedVendorId = Number.isFinite(vendorCandidate) && vendorCandidate > 0
            ? vendorCandidate
            : Number(product.vendor_id);
        const parsedCount = toNum(count, Number(product.count || 0));
        const parsedSelling = toNum(selling_price, Number(product.selling_price || 0));
        const parsedDealer = toNum(dealer_price, Number(product.dealer_price || 0));

        product_id = String(product_id || product.product_id || "").trim();
        description = cleanUpper(description || product.description);
        model = cleanUpper(model);
        serial_no = cleanUpper(serial_no);

        if(!normalizedRowType || !description || !Number.isFinite(parsedVendorId) || parsedVendorId <= 0){
            return res.status(400).json({ message: "Missing required fields." });
        }
        if(parsedCount < 0 || parsedSelling < 0 || parsedDealer < 0){
            return res.status(400).json({ message: "Count and prices cannot be negative." });
        }

        let categoryRecord = null;
        const categoryId = Number(rawCategory);
        if(Number.isFinite(categoryId) && categoryId > 0){
            categoryRecord = await Category.findByPk(categoryId);
        }
        if(!categoryRecord && category){
            categoryRecord = await Category.findOne({ where: { name: category } });
        }
        if(!categoryRecord){
            categoryRecord = category
                ? await Category.create({ name: category || `Category ${Date.now()}` })
                : null;
        }

        await product.update({
            product_id: product_id || product.product_id,
            description,
            row_type: normalizedRowType,
            category_id: categoryRecord ? categoryRecord.id : product.category_id,
            model: model || product.model || null,
            serial_no: serial_no || null,
            count: parsedCount,
            selling_price: parsedSelling,
            dealer_price: parsedDealer,
            vendor_id: parsedVendorId
        });

        res.json(product);
    }catch(err){
        res.status(500).json({ message: err.message || "Failed to update product." });
    }
};

exports.deleteProduct = async (req,res)=>{
    try{
        const { id } = req.params;
        const product = await Product.findByPk(id);
        if(!product){
            return res.status(404).json({ message: "Product not found." });
        }
        const currentCount = Number(product.count) || 0;
        if(currentCount !== 0){
            return res.status(400).json({
                message: "Only products with quantity 0 can be deleted."
            });
        }
        const invoiceCount = await InvoiceItem.count({ where: { product_id: id } });
        if(invoiceCount > 0){
            return res.status(400).json({
                message: "Cannot delete product. Invoices are linked to this product."
            });
        }
                                                                                           
        await Stock.destroy({ where: { product_id: id } });
        await product.destroy();
        res.json({ message: "Product deleted successfully." });
    }catch(err){
        res.status(500).json({ message: err.message || "Failed to delete product." });
    }
};
