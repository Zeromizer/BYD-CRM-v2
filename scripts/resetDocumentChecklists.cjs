/**
 * Script to reset document_checklist for all customers
 * This clears the false positive document statuses from old CRM imports
 */

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://vnxcjptdyrzopqzqeuis.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eI-4hVJDCadtGTciIOPGgg_9k4PIuE1';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const DEFAULT_DOCUMENT_CHECKLIST = {
  test_drive: {},
  close_deal: {},
  registration: {},
  delivery: {},
  nps: {},
};

async function resetDocumentChecklists() {
  console.log('Fetching all customers...');

  // Get all customers
  const { data: customers, error: fetchError } = await supabase
    .from('customers')
    .select('id, name, document_checklist');

  if (fetchError) {
    console.error('Error fetching customers:', fetchError);
    return;
  }

  console.log(`Found ${customers.length} customers`);

  // Filter customers that have non-empty document checklists
  const customersToUpdate = customers.filter(c => {
    if (!c.document_checklist) return false;
    const dc = c.document_checklist;
    // Check if any milestone has document entries
    return Object.keys(dc).some(milestone => {
      return dc[milestone] && Object.keys(dc[milestone]).length > 0;
    });
  });

  console.log(`${customersToUpdate.length} customers have document checklists to reset`);

  if (customersToUpdate.length === 0) {
    console.log('No customers need updating.');
    return;
  }

  // Update each customer
  let updated = 0;
  let failed = 0;

  for (const customer of customersToUpdate) {
    console.log(`Resetting document checklist for "${customer.name}" (ID: ${customer.id})...`);

    const { error: updateError } = await supabase
      .from('customers')
      .update({ document_checklist: DEFAULT_DOCUMENT_CHECKLIST })
      .eq('id', customer.id);

    if (updateError) {
      console.error(`  Failed: ${updateError.message}`);
      failed++;
    } else {
      console.log(`  Done`);
      updated++;
    }
  }

  console.log(`\nCompleted: ${updated} updated, ${failed} failed`);
}

resetDocumentChecklists().catch(console.error);
