const { DataTypes } = require("sequelize");
const db = require("../config/database");
const Customer = require("./Customer");

const PurchaseOrder = db.define("PurchaseOrder", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    po_number: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    batch_number: { type: DataTypes.STRING(30), allowNull: false, unique: true },
    sequence_no: { type: DataTypes.INTEGER, allowNull: false },
    po_date: { type: DataTypes.DATEONLY, allowNull: false },
    delivery_date: { type: DataTypes.DATEONLY, allowNull: true },
    customer_id: { type: DataTypes.INTEGER, allowNull: true, references: { model: Customer, key: "id" } },
    customer_name: { type: DataTypes.STRING(150), allowNull: false },
    notes: { type: DataTypes.TEXT, allowNull: true },
    grand_total: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, {
    tableName: "purchase_orders",
    timestamps: true,
    indexes: [
        { fields: ["po_date"] },
        { fields: ["customer_id"] },
        { fields: ["sequence_no"] },
        { unique: true, fields: ["po_date", "sequence_no"] },
    ],
});

PurchaseOrder.belongsTo(Customer, { foreignKey: "customer_id" });

module.exports = PurchaseOrder;
