// Fill Proposal Form using CDP
const CDP = require('chrome-remote-interface');

async function fillProposalForm() {
  let client;
  try {
    client = await CDP();
    const { Runtime } = client;

    // Fill Model dropdown
    await Runtime.evaluate({
      expression: `
        document.querySelector('select[name="proposal_model"]').value = 'BYD Atto3 Extended Range 100kw';
        document.querySelector('select[name="proposal_model"]').dispatchEvent(new Event('change', { bubbles: true }));
      `
    });

    // Fill Bank dropdown
    await Runtime.evaluate({
      expression: `
        document.querySelector('select[name="proposal_bank"]').value = 'DBS';
        document.querySelector('select[name="proposal_bank"]').dispatchEvent(new Event('change', { bubbles: true }));
      `
    });

    // Fill numeric fields
    const fields = {
      'proposal_selling_price': '195888',
      'proposal_interest_rate': '2.88',
      'proposal_downpayment': '25000',
      'proposal_loan_tenure': '72',
      'proposal_loan_amount': '170888',
      'proposal_admin_fee': '800',
      'proposal_referral_fee': '600',
      'proposal_trade_in_model': 'Honda Civic 2018',
      'proposal_trade_in_car_plate': 'SJX5678B',
      'proposal_quoted_trade_in_price': '18000',
      'proposal_low_loan_surcharge': '1500',
      'proposal_no_loan_surcharge': '2500'
    };

    for (const [name, value] of Object.entries(fields)) {
      await Runtime.evaluate({
        expression: `
          const el = document.querySelector('[name="${name}"]');
          if (el) {
            el.value = '${value}';
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }
        `
      });
    }

    // Fill benefit dropdowns
    await Runtime.evaluate({
      expression: `
        document.querySelector('select[name="proposal_benefit1"]').value = '$500 Service Credits';
        document.querySelector('select[name="proposal_benefit1"]').dispatchEvent(new Event('change', { bubbles: true }));
      `
    });

    await Runtime.evaluate({
      expression: `
        document.querySelector('select[name="proposal_benefit2"]').value = '1x Ceramic Coating';
        document.querySelector('select[name="proposal_benefit2"]').dispatchEvent(new Event('change', { bubbles: true }));
      `
    });

    await Runtime.evaluate({
      expression: `
        document.querySelector('select[name="proposal_benefit3"]').value = '3M Solar Film (Premium Plus)';
        document.querySelector('select[name="proposal_benefit3"]').dispatchEvent(new Event('change', { bubbles: true }));
      `
    });

    // Fill textareas
    await Runtime.evaluate({
      expression: `
        const benefitsEl = document.querySelector('textarea[name="proposal_benefits_given"]');
        if (benefitsEl) {
          benefitsEl.value = 'Customer receives $500 service credits, 1x ceramic coating, and premium 3M solar film installation included in purchase price.';
          benefitsEl.dispatchEvent(new Event('input', { bubbles: true }));
          benefitsEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      `
    });

    await Runtime.evaluate({
      expression: `
        const remarksEl = document.querySelector('textarea[name="proposal_remarks"]');
        if (remarksEl) {
          remarksEl.value = 'Customer is trading in Honda Civic 2018. Prefers blue color if available. Financing approved through DBS with 72-month tenure at 2.88% interest rate.';
          remarksEl.dispatchEvent(new Event('input', { bubbles: true }));
          remarksEl.dispatchEvent(new Event('change', { bubbles: true }));
        }
      `
    });

    console.log('✓ Proposal form filled successfully');

  } catch (error) {
    console.error('Error filling form:', error);
  } finally {
    if (client) {
      await client.close();
    }
  }
}

fillProposalForm();
