const { DataTypes } = require("sequelize");
const db = require("../config/database");
const User = require("./User");

const UserAccess = db.define("UserAccess", {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: { model: User, key: "id" },
  },
  user_database: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "axisproductdb",
  },
  allowed_pages_json: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: "[]",
  },
  allowed_actions_json: {
    type: DataTypes.TEXT,
    allowNull: false,
    defaultValue: "[]",
  },
  database_name: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  createdAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
  updatedAt: { type: DataTypes.DATE, allowNull: true, defaultValue: DataTypes.NOW },
}, {
  tableName: "user_accesses",
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ["user_id", "user_database"],
      name: "user_accesses_user_db_unique_idx",
    },
  ],
});

UserAccess.belongsTo(User, { foreignKey: "user_id" });
User.hasOne(UserAccess, { foreignKey: "user_id" });

module.exports = UserAccess;
