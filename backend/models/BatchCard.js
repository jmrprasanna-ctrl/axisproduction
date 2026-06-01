const { DataTypes } = require("sequelize");
const db = require("../config/database");

const BatchCard = db.define("BatchCard", {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    po_number: { type: DataTypes.STRING(40), allowNull: true, defaultValue: null },
    batch_number: { type: DataTypes.STRING(40), allowNull: false, unique: true },
    sequence_no: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    company_name: { type: DataTypes.STRING(200), allowNull: false, defaultValue: "AXIS PRODUCTION" },
    batch_date: { type: DataTypes.DATEONLY, allowNull: false },
    items_generated: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    items_consumed: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    warehouse_issued_by: { type: DataTypes.STRING(150), allowNull: true, defaultValue: null },
    quality_verified_by: { type: DataTypes.STRING(150), allowNull: true, defaultValue: null },
    formula_prepared_by: { type: DataTypes.STRING(150), allowNull: true, defaultValue: null },
    formula_reviewed_by: { type: DataTypes.STRING(150), allowNull: true, defaultValue: null },
    approving_part_01: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    approving_part_02: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    final_bulk_approval: { type: DataTypes.STRING(40), allowNull: true, defaultValue: null },
    final_product_out: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    received_production_qty: { type: DataTypes.FLOAT, allowNull: false, defaultValue: 0 },
    produced_by: { type: DataTypes.STRING(150), allowNull: true, defaultValue: null },
    final_approval_notes: { type: DataTypes.TEXT, allowNull: true, defaultValue: null },
    reference_image_1_path: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    reference_image_2_path: { type: DataTypes.STRING(500), allowNull: true, defaultValue: null },
    created_by: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    updated_by: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, {
    tableName: "batch_cards",
    timestamps: true,
    indexes: [
        { fields: ["batch_date"] },
        { fields: ["batch_number"] },
        { fields: ["sequence_no"] },
        { unique: true, fields: ["batch_date", "sequence_no"] },
    ],
});

module.exports = BatchCard;
