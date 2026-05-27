const { DataTypes } = require("sequelize");
const db = require("../config/database");

const EmailSetup = db.define(
  "EmailSetup",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    smtp_host: { type: DataTypes.STRING, allowNull: true },
    smtp_port: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 587 },
    smtp_secure: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    smtp_user: { type: DataTypes.STRING, allowNull: true },
    smtp_pass: { type: DataTypes.STRING, allowNull: true },
    from_name: { type: DataTypes.STRING, allowNull: true, defaultValue: "AXIS PRODUCTION" },
    from_email: { type: DataTypes.STRING, allowNull: true },
    subject_template: { type: DataTypes.STRING, allowNull: true, defaultValue: "Invoice {{invoice_no}} - AXIS PRODUCTION" },
    body_template: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: "Dear {{customer_name}},\n\nPlease find attached your invoice {{invoice_no}}.\n\nThank you.\nAXIS PRODUCTION"
    },
    createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
  },
  { tableName: "email_setups", timestamps: true }
);

module.exports = EmailSetup;
