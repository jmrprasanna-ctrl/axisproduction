const { DataTypes } = require("sequelize");
const db = require("../config/database");
const Category = require("./Category");
const Vendor = require("./Vendor");

const Product = db.define("Product", {
    id: { type: DataTypes.INTEGER, primaryKey:true, autoIncrement:true },
    product_id: { type: DataTypes.STRING, unique:true },
    description: { type: DataTypes.STRING },
    row_type: { type: DataTypes.STRING, allowNull: false, defaultValue: "Other" },
    category_id: { type: DataTypes.INTEGER, references:{ model:Category, key:"id" } },
    model: { type: DataTypes.STRING },
    serial_no: { type: DataTypes.STRING },
    count: { type: DataTypes.INTEGER, defaultValue:0 },
    measurement: { type: DataTypes.STRING(20), allowNull: true },
    selling_price: { type: DataTypes.FLOAT },
    dealer_price: { type: DataTypes.FLOAT },
    vendor_id: { type: DataTypes.INTEGER, references:{ model:Vendor, key:"id" } },
    createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
},{
    tableName:"products",
    timestamps:true,
    indexes: [
        { fields: ["product_id"] },
        { fields: ["description"] },
        { fields: ["row_type"] },
        { fields: ["measurement"] },
        { fields: ["model"] },
        { fields: ["category_id"] },
        { fields: ["vendor_id"] }
    ]
});

Product.belongsTo(Category,{foreignKey:"category_id"});
Product.belongsTo(Vendor,{foreignKey:"vendor_id"});

module.exports = Product;
