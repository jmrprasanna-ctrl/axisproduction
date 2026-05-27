const db = require("../config/database");

const BUSINESS_DBS = ["axisproductdb", "demo"];

const SAMPLE_CONDITIONS = [
  "Payment within 30 days",
  "Goods once sold cannot be returned",
  "Warranty as per manufacturer terms",
  "All disputes subject to local jurisdiction",
];

const SAMPLE_CUSTOMER_EMAILS = ["cust1@example.com", "cust2@example.com"];
const SAMPLE_CUSTOMER_CODES = ["CS01", "CS02"];
const SAMPLE_PRODUCT_IDS = ["PH0001", "PR0001", "LP0001"];
const SAMPLE_VENDOR_NAMES = ["Vendor A", "Vendor B", "Vendor C"];

async function deleteReturningCount(sql, replacements = {}) {
  const [rows] = await db.query(sql, { replacements });
  return Array.isArray(rows) ? rows.length : 0;
}

async function cleanupOneDatabase(databaseName) {
  const report = {
    conditions: 0,
    expenses: 0,
    rentalMachineConsumables: 0,
    rentalMachineCounts: 0,
    rentalMachines: 0,
    invoiceItems: 0,
    invoices: 0,
    customers: 0,
    products: 0,
    vendors: 0,
    users: 0,
  };

  await db.withDatabase(databaseName, async () => {
    await db.transaction(async () => {
      report.conditions += await deleteReturningCount(
        `DELETE FROM conditions
         WHERE condition IN (:conditions)
         RETURNING id`,
        { conditions: SAMPLE_CONDITIONS }
      );

      report.expenses += await deleteReturningCount(
        `DELETE FROM expenses
         WHERE (title = 'Office Rent' AND amount = 50000)
            OR (title = 'Electricity Bill' AND amount = 15000)
         RETURNING id`
      );

      report.invoiceItems += await deleteReturningCount(
        `DELETE FROM invoice_items
         WHERE invoice_id IN (
           SELECT i.id
           FROM invoices i
           JOIN customers c ON c.id = i.customer_id
           WHERE c.email IN (:emails) OR c.customer_id IN (:codes)
         )
         RETURNING id`,
        {
          emails: SAMPLE_CUSTOMER_EMAILS,
          codes: SAMPLE_CUSTOMER_CODES,
        }
      );

      report.invoices += await deleteReturningCount(
        `DELETE FROM invoices
         WHERE customer_id IN (
           SELECT id FROM customers
           WHERE email IN (:emails) OR customer_id IN (:codes)
         )
         RETURNING id`
        ,
        {
          emails: SAMPLE_CUSTOMER_EMAILS,
          codes: SAMPLE_CUSTOMER_CODES,
        }
      );

      report.rentalMachineConsumables += await deleteReturningCount(
        `DELETE FROM rental_machine_consumables
         WHERE customer_id IN (
           SELECT id FROM customers
           WHERE email IN (:emails) OR customer_id IN (:codes)
         )
         RETURNING id`,
        {
          emails: SAMPLE_CUSTOMER_EMAILS,
          codes: SAMPLE_CUSTOMER_CODES,
        }
      );

      report.rentalMachineCounts += await deleteReturningCount(
        `DELETE FROM rental_machine_counts
         WHERE customer_id IN (
           SELECT id FROM customers
           WHERE email IN (:emails) OR customer_id IN (:codes)
         )
         RETURNING id`,
        {
          emails: SAMPLE_CUSTOMER_EMAILS,
          codes: SAMPLE_CUSTOMER_CODES,
        }
      );

      report.rentalMachines += await deleteReturningCount(
        `DELETE FROM rental_machines
         WHERE customer_id IN (
           SELECT id FROM customers
           WHERE email IN (:emails) OR customer_id IN (:codes)
         )
         RETURNING id`,
        {
          emails: SAMPLE_CUSTOMER_EMAILS,
          codes: SAMPLE_CUSTOMER_CODES,
        }
      );

      report.customers += await deleteReturningCount(
        `DELETE FROM customers
         WHERE email IN (:emails)
            OR customer_id IN (:codes)
         RETURNING id`,
        {
          emails: SAMPLE_CUSTOMER_EMAILS,
          codes: SAMPLE_CUSTOMER_CODES,
        }
      );

      report.rentalMachineConsumables += await deleteReturningCount(
        `DELETE FROM rental_machine_consumables
         WHERE product_id IN (
           SELECT id FROM products WHERE product_id IN (:productIds)
         )
         RETURNING id`,
        { productIds: SAMPLE_PRODUCT_IDS }
      );

      report.products += await deleteReturningCount(
        `DELETE FROM products
         WHERE product_id IN (:productIds)
         RETURNING id`,
        { productIds: SAMPLE_PRODUCT_IDS }
      );

      report.vendors += await deleteReturningCount(
        `DELETE FROM vendors
         WHERE name IN (:vendorNames)
         RETURNING id`,
        { vendorNames: SAMPLE_VENDOR_NAMES }
      );

      report.users += await deleteReturningCount(
        `DELETE FROM users
         WHERE email = 'manager@example.com'
           AND username = 'manager'
           AND role = 'manager'
         RETURNING id`
      );
    });
  });

  return report;
}

async function main() {
  try {
    await db.authenticate();
    console.log("Database connection: OK");

    for (const databaseName of BUSINESS_DBS) {
      const report = await cleanupOneDatabase(databaseName);
      console.log(`\n[${databaseName}] Removed system test data:`);
      Object.entries(report).forEach(([name, count]) => {
        console.log(`- ${name}: ${count}`);
      });
    }

    console.log("\nCleanup complete.");
    process.exit(0);
  } catch (err) {
    console.error("Cleanup failed:", err.message || err);
    process.exit(1);
  }
}

main();
