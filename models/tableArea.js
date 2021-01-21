module.exports = function (sequelize, DataTypes) {
    const TableArea = sequelize.define("TableArea", {
        areaName: {
            type: DataTypes.STRING,
            allowNull:false,
            validate: {
                len: {args: [1,160], msg:"tableName length must be between 1 and 160 characters."},
                notEmpty: true,
            }
        }
    });

    return TableArea;
};