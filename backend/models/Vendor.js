const { DataTypes } = require("sequelize");
const db = require("../config/database");

const Vendor = db.define("Vendor",{
    id:{ type: DataTypes.INTEGER, primaryKey:true, autoIncrement:true },
    name:{ type: DataTypes.STRING, allowNull:false },
    address:{ type: DataTypes.STRING },
    createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
    updatedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW }
},{tableName:"vendors",timestamps:true});

module.exports = Vendor;
