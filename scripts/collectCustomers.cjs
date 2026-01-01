/**
 * Script to collect all customer.json files from old CRM data
 * and generate a combined JSON file for import
 */

const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'BYD CRM', 'BYD Customers Data');
const outputFile = path.join(__dirname, '..', 'BYD CRM', 'combined-customers.json');

// Skip non-customer folders
const skipFolders = ['MasterFile - Forms'];

async function collectCustomers() {
  const customers = [];

  // Read all folders in the data directory
  const folders = fs.readdirSync(dataDir);

  for (const folder of folders) {
    if (skipFolders.includes(folder)) {
      console.log(`Skipping: ${folder}`);
      continue;
    }

    const folderPath = path.join(dataDir, folder);
    const stat = fs.statSync(folderPath);

    if (!stat.isDirectory()) {
      continue;
    }

    const customerJsonPath = path.join(folderPath, 'customer.json');

    if (fs.existsSync(customerJsonPath)) {
      try {
        const data = fs.readFileSync(customerJsonPath, 'utf8');
        const customer = JSON.parse(data);
        customers.push(customer);
        console.log(`✓ Loaded: ${customer.name || folder}`);
      } catch (err) {
        console.error(`✗ Error reading ${folder}/customer.json:`, err.message);
      }
    } else {
      console.log(`⚠ No customer.json found in: ${folder}`);
    }
  }

  // Write combined file
  const output = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    source: 'BYD-CRM-Old',
    customers: customers
  };

  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));

  console.log(`\n========================================`);
  console.log(`Collected ${customers.length} customers`);
  console.log(`Output file: ${outputFile}`);
  console.log(`========================================`);
}

collectCustomers().catch(console.error);
