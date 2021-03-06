const db = require("../models");

async function resetDB() {
    //reset the database
    await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await db.sequelize.sync({ force: true });
    await db.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    //setting up the app
    const orderNumber = await db.AppConfig.create({ itemName: "next order number", itemValue: 2 });

    //create user John Doe
    const john = await db.User.create({
        fullName: "John Doe",
        accessCode: 0,
        isManager: true,
        username: "username",
        password: "password"
    });

    const steve = await db.Customer.create({
        fullName: "Steve Lee",
        phone: "123-456-7890",
        address: "12345 someStree st",
        city: "someCity",
        state: "someState",
        zip: "12345",
        note: "He runs"
    });

    await db.Customer.create({
        fullName: "Jason Smith",
        phone: "123-456-7890",
        address: "22432 someStree st",
        city: "someCity",
        state: "someState",
        zip: "54211",
        note: "Hates rice"
    });

    const mainMenu = await db.Menu.create({
        menuName: "Main Menu",
        Items: [
            {
                itemName: "Cheeseburger",
                price: 3.25,
                tax: 0.0825
            },
            {
                itemName: "Spicy Chicken Burger",
                price: 4.00,
                tax: 0.0825
            },
            {
                itemName: "Bacon Cheeseburger",
                price: 4.75,
                tax: 0.0825
            }
        ]
    }, {
        include: [db.Item]
    });

    await db.Menu.create({
        menuName: "Sidebar",
        Items: [
            {
                itemName: "Green Beans",
                price: 1.25,
                tax: 0.0825
            },
            {
                itemName: "Mashed Potato",
                price: 1.75,
                tax: 0.0825
            }
        ]
    }, {
        include: [db.Item]
    });

    const tableArea = await db.TableArea.create({
        areaName: "Main Area"
    });

    const table = await db.Table.create({
        tableName: "T1",
        x: 25,
        y: 25,
        TableAreaId: tableArea.id
    });

    await db.Table.create({
        tableName: "T2",
        x: 100,
        y: 25,
        TableAreaId: tableArea.id
    });


    const order = await db.Order.create({
        orderNumber: "#1",
        creatorId: john.id
    });

    await order.createOrderItem({
        itemName:"cheese burger",
        price: 5.25,
        tax: 0.0825,
        serverId: john.id
    });

    order.addCustomer(steve);

    table.addOrder(order);

    await order.createPayment({
        amount: 5,
        type: "CASH",
        cashierId: john.id
    });
}

resetDB();
