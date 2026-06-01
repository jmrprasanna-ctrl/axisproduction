const { DataTypes } = require("sequelize");
const db = require("../config/database");
const Product = require("./Product");
const PurchaseOrder = require("./PurchaseOrder");

const PurchaseOrderItem = db.define("PurchaseOrderItem", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    purchase_order_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: PurchaseOrder, key: "id" } },
    product_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: Product, key: "id" } },
    description: { type: DataTypes.STRING(255), allowNull: false },
    measurement: { type: DataTypes.STRING(20), allowNull: true },
    qty: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    unit_price: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    line_total: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, {
    tableName: "purchase_order_items",
    timestamps: true,
    indexes: [
        { fields: ["purchase_order_id"] },
        { fields: ["product_id"] },
    ],
});

PurchaseOrderItem.belongsTo(PurchaseOrder, { foreignKey: "purchase_order_id" });
PurchaseOrder.hasMany(PurchaseOrderItem, { foreignKey: "purchase_order_id" });
PurchaseOrderItem.belongsTo(Product, { foreignKey: "product_id" });

module.exports = PurchaseOrderItem;
