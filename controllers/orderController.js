const db = require("../models");

function eagarLoadOrder(orderId) {
    return db.Order.findOne({where: {id: orderId}, include: { all: true, nested: true }});
}

/**
 * calculate the order total and check against payment amount, then update status accordingly
 * @param {Number} orderId 
 */
async function updateOrderStatus(orderId) {
    const order = await eagarLoadOrder(orderId);

    let billTotal = 0;
    let paidAmount = 0;

    order.OrderItems.forEach(orderItem => {
        if(orderItem.status === "OPEN") {
            billTotal += orderItem.price * (1 + orderItem.tax);
        }
    });
    order.Payments.forEach(payment => {
        if(payment.status === "OPEN") {
            paidAmount += payment.amount;
        }
    });

    if(billTotal > paidAmount) {
        await order.update({status: "OPEN"});
    } else {
        await order.update({status: "SETTLED"});
    }
}

module.exports = {
    getOrder: async function (req, res) {
        const orderId = req.params.orderId;

        const order = await db.Order.findOne({where: {id: orderId}, include: { all: true, nested: true }});

        if(!order) {
            return res.status(404).send("cannot find order");
        }
        
        return res.json(order);
    },

    getAllOrders: async function (req, res) {
        return res.json(await db.Order.findAll({include: { all: true, nested: true }}));
    },


    /**
     * creates a new order, client must submit a creatorId.
     */
    createOrder: async function (req, res) {
        const creatorId = req.body.creatorId;
        
        const t = await db.sequelize.transaction();

        try {
            const orderNumber = await db.AppConfig.findOne({
                where: {itemName:"next order number"}, 
                lock: true, 
                transaction: t
            });

            const order = await db.Order.create({
                orderNumber: "#" + orderNumber.itemValue,
                creatorId: creatorId,
            }, {
                include: ["creator"], 
                transaction: t
            });

            await db.AppConfig.update({
                itemValue: orderNumber.itemValue + 1
            }, {
                where: {itemName:"next order number"}, 
                transaction: t
            });

            t.commit();
            res.json(order);
        } catch (e) {
            t.rollback();
            console.error(e);
            res.status(500).json(e.stack);
        }
    },

    /**
     * Add an item into an order, client must provide the whole item object, the order id, and also the server for this action
     */
    orderItem: async function (req, res) {
        const orderId = req.body.orderId;
        const item = req.body.item;
        const serverId = req.body.serverId;

        item.serverId = serverId;

        try {
            const order = await db.Order.findOne({where: {id: orderId}});

            if(!order) {
                return res.status(404).send("cannot find order");
            }
            
            const server = await db.User.findOne({where: {id: serverId}});

            if(!server) {
                return res.status(404).send("cannot find server");
            }

            if(!item || !item instanceof Object) {
                return res.status(400).send("invalid item");
            }

            await order.createOrderItem({
                serverId,
                itemName: item.itemName,
                price: item.price,
                tax: item.tax,
                ItemId: item.id
            });

            await updateOrderStatus(orderId);

            //success, return the whole order object
            return res.json(await eagarLoadOrder(orderId));
        } catch (err) {
            console.error(err);
            res.status(500).json(err.stack);
        }
    },

    /**
     * mark an item as voided, client must provide the index of item to remove, and also order id, and server id.
     */
    voidItem: async function (req, res) {
        const orderItemId = req.body.orderItemId;
        const serverId = req.body.serverId;

        const t = await db.sequelize.transaction();

        try {
            const server = await db.User.findOne({where: {id: serverId}});

            if(!server) {
                return res.status(404).send("cannot find server");
            }

            const orderItem = await db.OrderItem.findOne({
                where: {id: orderItemId},
                lock: true, 
                transaction: t
            });

            if(!orderItem) {
                t.commit();
                return res.status(404).send("cannot find orderItem");
            }

            //change the status, using transaction to ensure changes and logs sync
            await orderItem.update({status: "VOIDED"}, {transaction: t});
            //log the action
            await orderItem.createLog({
                action: "VOID",
                UserId: serverId
            }, {transaction: t});

            await t.commit();
            await updateOrderStatus(orderItem.OrderId);

            res.json( await db.OrderItem.findOne({ where: {id: orderItemId}}));
        } catch (err) {
            t.rollback();
            console.error(err);
            res.status(500).json(err.stack);
        }
    },

    /**
     * add a new payment into an order, also updates the order's status as the payment is received, 
     * client must provide the orderId, amount and type of the payment, and the serverId
     */
    addPayment: async function (req, res) {
        const orderId = req.body.orderId;
        const amount = parseFloat(req.body.amount);
        const type = req.body.type;
        const serverId = req.body.serverId;

        try {
            const order = await db.Order.findOne({where: {id: orderId}});

            if(!order) {
                return res.status(404).send("cannot find order");
            }
            
            const server = await db.User.findOne({where: {id: serverId}});

            if(!server) {
                return res.status(404).send("cannot find server");
            }

            if(amount <= 0) {
                return res.status(400).send("invalid amount");
            }

            if(!type) {
                return res.status(400).send("missing payment type");
            }

            await order.createPayment({amount, type, cashierId: server.id});

            await updateOrderStatus(orderId);

            //success, return the whole order object
            return res.json(await eagarLoadOrder(orderId));
        } catch (err) {
            console.error(err);
            res.status(500).json(err.stack);
        }
    }

    //TODO: void payment
}