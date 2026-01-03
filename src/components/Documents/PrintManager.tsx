/**
 * PrintManager Component
 * Preview and print documents with customer data overlay
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowLeft, User, File, CaretLeft, CaretRight, DownloadSimple, Printer, MagnifyingGlass, X, Check, Images, Trash } from '@phosphor-icons/react';
import { Button, Modal } from '@/components/common';
import { jsPDF } from 'jspdf';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { useCustomerStore } from '@/stores/useCustomerStore';
import { getAllCustomerDocuments, type CustomerDocument } from '@/services/customerDocumentService';
import { formatCurrencySGD as formatCurrency } from '@/utils/formatting';
import type { DocumentTemplate, Customer, Guarantor } from '@/types';
import './PrintManager.css';

interface PrintManagerProps {
  template: DocumentTemplate;
  customer?: Customer | null;
  onClose: () => void;
}

export function PrintManager({ template, customer: initialCustomer, onClose }: PrintManagerProps) {
  const { templates, fetchTemplates } = useDocumentStore();
  const { customers, fetchCustomers } = useCustomerStore();

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(initialCustomer || null);
  const [selectedTemplates, setSelectedTemplates] = useState<DocumentTemplate[]>([template]);
  const [currentTemplateIndex, setCurrentTemplateIndex] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [showCustomerSelect, setShowCustomerSelect] = useState(!initialCustomer);
  const [showTemplateSelect, setShowTemplateSelect] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ width: number; height: number } | null>(null);

  // Back page photo attachment state
  const [backPagePhotos, setBackPagePhotos] = useState<CustomerDocument[]>([]);
  const [showPhotoSelect, setShowPhotoSelect] = useState(false);
  const [customerPhotos, setCustomerPhotos] = useState<CustomerDocument[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTemplate = selectedTemplates[currentTemplateIndex];

  useEffect(() => {
    fetchTemplates();
    fetchCustomers();
  }, [fetchTemplates, fetchCustomers]);

  // Load customer photos when customer changes
  const loadCustomerPhotos = useCallback(async () => {
    if (!selectedCustomer) {
      setCustomerPhotos([]);
      return;
    }

    setIsLoadingPhotos(true);
    try {
      const allDocs = await getAllCustomerDocuments(selectedCustomer.name);
      // Flatten all documents from all folders and filter to only images
      const images: CustomerDocument[] = [];
      for (const folder of allDocs) {
        for (const doc of folder.documents) {
          if (
            doc.mimeType.startsWith('image/') ||
            /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(doc.name)
          ) {
            images.push(doc);
          }
        }
      }
      setCustomerPhotos(images);
    } catch (error) {
      console.error('Error loading customer photos:', error);
      setCustomerPhotos([]);
    } finally {
      setIsLoadingPhotos(false);
    }
  }, [selectedCustomer]);

  // Load photos when photo select modal opens
  useEffect(() => {
    if (showPhotoSelect && selectedCustomer) {
      loadCustomerPhotos();
    }
  }, [showPhotoSelect, selectedCustomer, loadCustomerPhotos]);

  // Clear back page photos when customer changes
  useEffect(() => {
    setBackPagePhotos([]);
  }, [selectedCustomer?.id]);

  // Draw canvas with template image and customer data
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !currentTemplate) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;

      // Store canvas size for auto-fit
      setCanvasSize({ width: img.naturalWidth, height: img.naturalHeight });

      // Draw template image
      ctx.drawImage(img, 0, 0);

      // Overlay customer data
      if (selectedCustomer) {
        const customerData = getCustomerDataMapping(selectedCustomer);

        Object.entries(currentTemplate.fields || {}).forEach(([, field]) => {
          const value = field.type === 'custom'
            ? field.customValue
            : customerData[field.type] || '';

          if (value) {
            ctx.font = `${field.fontSize}px ${field.fontFamily}`;
            ctx.fillStyle = field.color;
            ctx.textAlign = field.textAlign as CanvasTextAlign;
            ctx.textBaseline = 'top';

            // Match FormEditor's field-preview padding: 4px 8px
            const paddingX = 8;
            const paddingY = 4;

            let x = field.x + paddingX;
            if (field.textAlign === 'center') {
              x = field.x + field.width / 2;
            } else if (field.textAlign === 'right') {
              x = field.x + field.width - paddingX;
            }

            // Handle text wrapping for long values
            const words = String(value).split(' ');
            let line = '';
            let y = field.y + paddingY;
            const lineHeight = field.fontSize * 1.2;

            for (const word of words) {
              const testLine = line + (line ? ' ' : '') + word;
              const metrics = ctx.measureText(testLine);

              if (metrics.width > field.width && line) {
                ctx.fillText(line, x, y);
                line = word;
                y += lineHeight;
              } else {
                line = testLine;
              }
            }
            ctx.fillText(line, x, y);
          }
        });
      }
    };

    if (currentTemplate.image_url) {
      img.src = currentTemplate.image_url;
    }
  }, [currentTemplate, selectedCustomer]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Fit to screen function
  const fitToScreen = useCallback(() => {
    if (!containerRef.current || !canvasSize) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const padding = 20; // Reduced padding for more space
    const availableWidth = containerRect.width - padding * 2;
    const availableHeight = containerRect.height - padding * 2;

    const scaleX = availableWidth / canvasSize.width;
    const scaleY = availableHeight / canvasSize.height;
    const newZoom = Math.min(scaleX, scaleY, 1.5); // Allow up to 150% for better readability

    setZoom(Math.max(0.1, newZoom));
  }, [canvasSize]);

  // Reset to 100%
  const resetView = useCallback(() => {
    setZoom(1);
  }, []);

  // Auto-fit when canvas size changes (template loads)
  useEffect(() => {
    if (canvasSize) {
      // Small delay to ensure container has proper dimensions
      const timer = setTimeout(fitToScreen, 100);
      return () => clearTimeout(timer);
    }
  }, [canvasSize, fitToScreen]);

  // Get customer data mapping
  const getCustomerDataMapping = (customer: Customer): Record<string, string> => {
    const guarantors = customer.guarantors || [];
    const formatDate = (date: string | null) => {
      if (!date) return '';
      return new Date(date).toLocaleDateString('en-SG', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    };

    const getGuarantorField = (index: number, field: keyof Guarantor): string => {
      const g = guarantors.find((g) => g.position === index + 1);
      return g ? String(g[field] || '') : '';
    };

    return {
      // Basic Info
      name: customer.name || '',
      phone: customer.phone || '',
      email: customer.email || '',
      nric: customer.nric || '',
      occupation: customer.occupation || '',
      dob: formatDate(customer.dob),
      address: customer.address || '',
      addressContinue: customer.address_continue || '',
      fullAddress: [customer.address, customer.address_continue].filter(Boolean).join(' '),
      salesConsultant: customer.sales_consultant || '',
      vsaNo: customer.vsa_no || '',
      date: formatDate(new Date().toISOString()),

      // VSA Vehicle Details
      makeModel: customer.vsa_make_model || '',
      yom: customer.vsa_yom || '',
      bodyColour: customer.vsa_body_colour || '',
      upholstery: customer.vsa_upholstery || '',
      przType: customer.vsa_prz_type || '',

      // VSA Package
      package: customer.vsa_package || '',
      sellingPriceList: formatCurrency(customer.vsa_selling_price_list),
      purchasePriceWithCOE: formatCurrency(customer.vsa_purchase_price_with_coe),
      coeRebateLevel: customer.vsa_coe_rebate_level || '',
      deposit: formatCurrency(customer.vsa_deposit),
      lessOthers: formatCurrency(customer.vsa_less_others),
      addOthers: formatCurrency(customer.vsa_add_others),
      deliveryDate: formatDate(customer.vsa_delivery_date),

      // Trade-In
      tradeInCarNo: customer.vsa_trade_in_car_no || '',
      tradeInCarModel: customer.vsa_trade_in_car_model || '',
      tradeInAmount: formatCurrency(customer.vsa_trade_in_amount),
      tradeInSettlementCost: formatCurrency(customer.vsa_trade_in_settlement_cost),
      numberRetention: customer.vsa_number_retention ? 'Yes' : 'No',
      numberRetentionFee: formatCurrency(customer.vsa_number_retention_fee),
      tradeInOwnerNotCustomer: customer.vsa_trade_in_owner_not_customer ? 'Yes' : 'No',
      tradeInOwnerName: customer.vsa_trade_in_owner_name || '',
      tradeInOwnerNric: customer.vsa_trade_in_owner_nric || '',
      tradeInOwnerMobile: customer.vsa_trade_in_owner_mobile || '',
      tradeInInsuranceCompany: customer.vsa_trade_in_insurance_company || '',
      tradeInPolicyNumber: customer.vsa_trade_in_policy_number || '',
      tradeInNameAuto: (customer.vsa_trade_in_owner_not_customer ? customer.vsa_trade_in_owner_name : customer.name) || '',
      tradeInNricAuto: (customer.vsa_trade_in_owner_not_customer ? customer.vsa_trade_in_owner_nric : customer.nric) || '',
      tradeInMobileAuto: (customer.vsa_trade_in_owner_not_customer ? customer.vsa_trade_in_owner_mobile : customer.phone) || '',

      // Delivery
      dateOfRegistration: formatDate(customer.vsa_date_of_registration),
      registrationNo: customer.vsa_registration_no || '',
      chassisNo: customer.vsa_chassis_no || '',
      engineNo: customer.vsa_engine_no || '',
      motorNo: customer.vsa_motor_no || '',

      // Insurance
      insuranceCompany: customer.vsa_insurance_company || '',
      insuranceFee: formatCurrency(customer.vsa_insurance_fee),
      insuranceFeeNet: formatCurrency(customer.vsa_insurance_subsidy),

      // Loan & Remarks
      remarks1: customer.vsa_remarks1 || '',
      remarks2: customer.vsa_remarks2 || '',
      loanAmount: formatCurrency(customer.vsa_loan_amount),
      interest: customer.vsa_interest ? `${customer.vsa_interest}%` : '',
      tenure: customer.vsa_tenure ? `${customer.vsa_tenure} months` : '',
      adminFee: formatCurrency(customer.vsa_admin_fee),
      insuranceSubsidy: formatCurrency(customer.vsa_insurance_subsidy),
      monthlyRepayment: formatCurrency(customer.vsa_monthly_repayment),
      loanSummary: customer.vsa_loan_amount
        ? `$${customer.vsa_loan_amount?.toLocaleString()} @ ${customer.vsa_interest}% for ${customer.vsa_tenure} months`
        : '',
      invoiceInstallmentConditional: (customer.vsa_interest || 0) > 2.5
        ? formatCurrency(customer.vsa_monthly_repayment)
        : '',

      // Proposal
      proposalModel: customer.proposal_model || '',
      proposalBank: customer.proposal_bank || '',
      proposalSellingPrice: formatCurrency(customer.proposal_selling_price),
      proposalInterestRate: customer.proposal_interest_rate ? `${customer.proposal_interest_rate}%` : '',
      proposalDownpayment: formatCurrency(customer.proposal_downpayment),
      proposalLoanTenure: customer.proposal_loan_tenure ? `${customer.proposal_loan_tenure} months` : '',
      proposalLoanAmount: formatCurrency(customer.proposal_loan_amount),
      proposalAdminFee: formatCurrency(customer.proposal_admin_fee),
      proposalReferralFee: formatCurrency(customer.proposal_referral_fee),
      proposalTradeInModel: customer.proposal_trade_in_model || '',
      proposalLowLoanSurcharge: formatCurrency(customer.proposal_low_loan_surcharge),
      proposalTradeInCarPlate: customer.proposal_trade_in_car_plate || '',
      proposalNoLoanSurcharge: formatCurrency(customer.proposal_no_loan_surcharge),
      proposalQuotedTradeInPrice: formatCurrency(customer.proposal_quoted_trade_in_price),
      proposalBenefit1: customer.proposal_benefit1 || '',
      proposalBenefit2: customer.proposal_benefit2 || '',
      proposalBenefit3: customer.proposal_benefit3 || '',
      proposalBenefit4: customer.proposal_benefit4 || '',
      proposalBenefit5: customer.proposal_benefit5 || '',
      proposalBenefit6: customer.proposal_benefit6 || '',
      proposalBenefit7: customer.proposal_benefit7 || '',
      proposalBenefit8: customer.proposal_benefit8 || '',
      proposalBenefit9: customer.proposal_benefit9 || '',
      proposalBenefitsGiven: [
        customer.proposal_benefit1,
        customer.proposal_benefit2,
        customer.proposal_benefit3,
        customer.proposal_benefit4,
        customer.proposal_benefit5,
      ].filter(Boolean).join(', '),
      proposalRemarks: customer.proposal_remarks || '',

      // Guarantors
      guarantor1Name: getGuarantorField(0, 'name'),
      guarantor1Phone: getGuarantorField(0, 'phone'),
      guarantor1Email: getGuarantorField(0, 'email'),
      guarantor1Nric: getGuarantorField(0, 'nric'),
      guarantor1Occupation: getGuarantorField(0, 'occupation'),
      guarantor1Dob: formatDate(getGuarantorField(0, 'dob') || null),
      guarantor1Address: getGuarantorField(0, 'address'),
      guarantor1AddressContinue: getGuarantorField(0, 'address_continue'),

      guarantor2Name: getGuarantorField(1, 'name'),
      guarantor2Phone: getGuarantorField(1, 'phone'),
      guarantor2Email: getGuarantorField(1, 'email'),
      guarantor2Nric: getGuarantorField(1, 'nric'),
      guarantor2Occupation: getGuarantorField(1, 'occupation'),
      guarantor2Dob: formatDate(getGuarantorField(1, 'dob') || null),
      guarantor2Address: getGuarantorField(1, 'address'),
      guarantor2AddressContinue: getGuarantorField(1, 'address_continue'),

      guarantor3Name: getGuarantorField(2, 'name'),
      guarantor3Phone: getGuarantorField(2, 'phone'),
      guarantor3Email: getGuarantorField(2, 'email'),
      guarantor3Nric: getGuarantorField(2, 'nric'),
      guarantor3Occupation: getGuarantorField(2, 'occupation'),
      guarantor3Dob: formatDate(getGuarantorField(2, 'dob') || null),
      guarantor3Address: getGuarantorField(2, 'address'),
      guarantor3AddressContinue: getGuarantorField(2, 'address_continue'),

      guarantor4Name: getGuarantorField(3, 'name'),
      guarantor4Phone: getGuarantorField(3, 'phone'),
      guarantor4Email: getGuarantorField(3, 'email'),
      guarantor4Nric: getGuarantorField(3, 'nric'),
      guarantor4Occupation: getGuarantorField(3, 'occupation'),
      guarantor4Dob: formatDate(getGuarantorField(3, 'dob') || null),
      guarantor4Address: getGuarantorField(3, 'address'),
      guarantor4AddressContinue: getGuarantorField(3, 'address_continue'),

      guarantor5Name: getGuarantorField(4, 'name'),
      guarantor5Phone: getGuarantorField(4, 'phone'),
      guarantor5Email: getGuarantorField(4, 'email'),
      guarantor5Nric: getGuarantorField(4, 'nric'),
      guarantor5Occupation: getGuarantorField(4, 'occupation'),
      guarantor5Dob: formatDate(getGuarantorField(4, 'dob') || null),
      guarantor5Address: getGuarantorField(4, 'address'),
      guarantor5AddressContinue: getGuarantorField(4, 'address_continue'),
    };
  };

  // Generate PDF
  const generatePdf = async () => {
    if (!selectedCustomer) return;

    setIsGeneratingPdf(true);
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'px',
      });

      for (let i = 0; i < selectedTemplates.length; i++) {
        const template = selectedTemplates[i];

        // Create temporary canvas for each template
        const tempCanvas = document.createElement('canvas');
        const ctx = tempCanvas.getContext('2d');
        if (!ctx) continue;

        await new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = 'anonymous';

          img.onload = () => {
            tempCanvas.width = img.naturalWidth;
            tempCanvas.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);

            // Overlay customer data
            const customerData = getCustomerDataMapping(selectedCustomer);
            Object.entries(template.fields || {}).forEach(([, field]) => {
              const value = field.type === 'custom'
                ? field.customValue
                : customerData[field.type] || '';

              if (value) {
                ctx.font = `${field.fontSize}px ${field.fontFamily}`;
                ctx.fillStyle = field.color;
                ctx.textAlign = field.textAlign as CanvasTextAlign;
                ctx.textBaseline = 'top';

                // Match FormEditor's field-preview padding: 4px 8px
                const paddingX = 8;
                const paddingY = 4;

                let x = field.x + paddingX;
                if (field.textAlign === 'center') {
                  x = field.x + field.width / 2;
                } else if (field.textAlign === 'right') {
                  x = field.x + field.width - paddingX;
                }

                ctx.fillText(String(value), x, field.y + paddingY);
              }
            });

            resolve();
          };

          if (template.image_url) {
            img.src = template.image_url;
          } else {
            resolve();
          }
        });

        // Add page to PDF
        if (i > 0) {
          pdf.addPage();
        }

        const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (tempCanvas.height * pdfWidth) / tempCanvas.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

        // Add back page with photos after each template (for double-sided printing)
        if (backPagePhotos.length > 0) {
          pdf.addPage();
          const pageWidth = pdf.internal.pageSize.getWidth();
          const pageHeight = pdf.internal.pageSize.getHeight();
          const margin = 20;
          const gap = 10;

          // Calculate quadrant dimensions (2x2 grid)
          const quadrantWidth = (pageWidth - margin * 2 - gap) / 2;
          const quadrantHeight = (pageHeight - margin * 2 - gap) / 2;

          // Load and place each photo
          for (let j = 0; j < Math.min(backPagePhotos.length, 4); j++) {
            const photo = backPagePhotos[j];
            const row = Math.floor(j / 2);
            const col = j % 2;

            const x = margin + col * (quadrantWidth + gap);
            const y = margin + row * (quadrantHeight + gap);

            try {
              // Load image
              const photoImg = await new Promise<HTMLImageElement>((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = reject;
                img.src = photo.url;
              });

              // Calculate aspect ratio fit
              const imgAspect = photoImg.width / photoImg.height;
              const quadrantAspect = quadrantWidth / quadrantHeight;

              let drawWidth = quadrantWidth;
              let drawHeight = quadrantHeight;
              let drawX = x;
              let drawY = y;

              if (imgAspect > quadrantAspect) {
                // Image is wider - fit to width
                drawHeight = quadrantWidth / imgAspect;
                drawY = y + (quadrantHeight - drawHeight) / 2;
              } else {
                // Image is taller - fit to height
                drawWidth = quadrantHeight * imgAspect;
                drawX = x + (quadrantWidth - drawWidth) / 2;
              }

              // Create canvas to convert image
              const photoCanvas = document.createElement('canvas');
              photoCanvas.width = photoImg.width;
              photoCanvas.height = photoImg.height;
              const photoCtx = photoCanvas.getContext('2d');
              if (photoCtx) {
                photoCtx.drawImage(photoImg, 0, 0);
                const photoData = photoCanvas.toDataURL('image/jpeg', 0.9);
                pdf.addImage(photoData, 'JPEG', drawX, drawY, drawWidth, drawHeight);
              }
            } catch (err) {
              console.error(`Error loading photo ${j}:`, err);
            }
          }
        }
      }

      // Save PDF
      const fileName = `${selectedCustomer.name}_${selectedTemplates.map((t) => t.name).join('_')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Print
  const handlePrint = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const imgData = canvas.toDataURL('image/png');

    // Build back page HTML with photos in 2x2 grid
    let backPageHtml = '';
    if (backPagePhotos.length > 0) {
      const photoHtml = backPagePhotos
        .slice(0, 4)
        .map((photo) => `<img src="${photo.url}" crossorigin="anonymous" />`)
        .join('');
      backPageHtml = `<div class="back-page"><div class="photo-grid">${photoHtml}</div></div>`;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title></title>
          <style>
            @page {
              size: A4;
              margin: 0;
            }
            * {
              box-sizing: border-box;
            }
            html, body {
              margin: 0;
              padding: 0;
              width: 100%;
              background: #f0f0f0;
            }
            .page {
              width: 210mm;
              min-height: 297mm;
              margin: 10px auto;
              background: white;
              box-shadow: 0 2px 8px rgba(0,0,0,0.15);
              overflow: hidden;
            }
            .front-page img {
              width: 100%;
              height: auto;
              display: block;
            }
            .back-page {
              width: 100%;
              height: 297mm;
              padding: 10mm;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .photo-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              grid-template-rows: 1fr 1fr;
              gap: 5mm;
              width: 100%;
              height: 100%;
            }
            .photo-grid img {
              width: 100%;
              height: 100%;
              object-fit: contain;
              background: #fafafa;
            }
            @media print {
              html, body {
                background: white;
              }
              .page {
                width: 100%;
                min-height: auto;
                height: auto;
                margin: 0;
                box-shadow: none;
                page-break-after: always;
              }
              .page:last-child {
                page-break-after: auto;
              }
              .back-page {
                height: 100vh;
              }
            }
          </style>
        </head>
        <body>
          <div class="page front-page">
            <img src="${imgData}" />
          </div>
          ${backPagePhotos.length > 0 ? `
          <div class="page back-page">
            <div class="photo-grid">
              ${backPagePhotos.slice(0, 4).map((photo) => `<img src="${photo.url}" crossorigin="anonymous" />`).join('')}
            </div>
          </div>
          ` : ''}
          <script>
            // Wait for all images to load before printing
            const images = document.querySelectorAll('img');
            let loaded = 0;
            const total = images.length;
            if (total === 0) {
              window.print();
              window.close();
            }
            images.forEach(img => {
              if (img.complete) {
                loaded++;
                if (loaded === total) { window.print(); window.close(); }
              } else {
                img.onload = () => {
                  loaded++;
                  if (loaded === total) { window.print(); window.close(); }
                };
                img.onerror = () => {
                  loaded++;
                  if (loaded === total) { window.print(); window.close(); }
                };
              }
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Filter customers
  const filteredCustomers = customers.filter(
    (c) =>
      !c.archive_status &&
      (c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone?.includes(searchQuery) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Filter templates for selection
  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTemplateSelection = (template: DocumentTemplate) => {
    setSelectedTemplates((prev) => {
      const exists = prev.find((t) => t.id === template.id);
      if (exists) {
        return prev.filter((t) => t.id !== template.id);
      }
      return [...prev, template];
    });
  };

  return (
    <div className="print-manager">
      {/* Toolbar */}
      <div className="pm-toolbar">
        <div className="pm-toolbar-left">
          <Button variant="ghost" onClick={onClose} leftIcon={<ArrowLeft size={16} />}>
            Back
          </Button>
          <div className="pm-divider" />
          <h3 className="pm-title">Print Preview</h3>
        </div>

        <div className="pm-toolbar-center">
          {/* Customer selector */}
          <div className="pm-customer-selector">
            {selectedCustomer ? (
              <button className="selected-customer" onClick={() => setShowCustomerSelect(true)}>
                <User size={16} className="customer-icon" />
                <span>{selectedCustomer.name}</span>
              </button>
            ) : (
              <Button variant="outline" onClick={() => setShowCustomerSelect(true)}>
                <User size={16} className="customer-icon" />
                Select Customer
              </Button>
            )}
          </div>

          <div className="pm-divider" />

          {/* Template navigation */}
          {selectedTemplates.length > 1 && (
            <div className="template-navigation">
              <button
                onClick={() => setCurrentTemplateIndex((i) => Math.max(0, i - 1))}
                disabled={currentTemplateIndex === 0}
              >
                <CaretLeft size={16} className="nav-icon" />
              </button>
              <span>
                {currentTemplateIndex + 1} / {selectedTemplates.length}
              </span>
              <button
                onClick={() =>
                  setCurrentTemplateIndex((i) => Math.min(selectedTemplates.length - 1, i + 1))
                }
                disabled={currentTemplateIndex === selectedTemplates.length - 1}
              >
                <CaretRight size={16} className="nav-icon" />
              </button>
            </div>
          )}

          <Button variant="ghost" onClick={() => setShowTemplateSelect(true)}>
            <File size={16} className="template-icon" />
            Templates ({selectedTemplates.length})
          </Button>

          {/* Back page photos button */}
          {selectedCustomer && (
            <Button
              variant={backPagePhotos.length > 0 ? 'outline' : 'ghost'}
              onClick={() => setShowPhotoSelect(true)}
              className={backPagePhotos.length > 0 ? 'has-photos' : ''}
            >
              <Images size={16} className="photos-icon" />
              Back ({backPagePhotos.length}/4)
            </Button>
          )}

          <div className="pm-divider" />

          {/* Zoom controls */}
          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}>
              -
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>
              +
            </button>
            <button className="zoom-btn-text" onClick={fitToScreen}>
              Fit
            </button>
            <button className="zoom-btn-text" onClick={resetView}>
              100%
            </button>
          </div>
        </div>

        <div className="pm-toolbar-right">
          <Button
            variant="outline"
            onClick={generatePdf}
            isLoading={isGeneratingPdf}
            disabled={!selectedCustomer}
            leftIcon={<DownloadSimple size={16} />}
          >
            Download PDF
          </Button>
          <Button onClick={handlePrint} disabled={!selectedCustomer} leftIcon={<Printer size={16} />}>
            Print
          </Button>
        </div>
      </div>

      {/* Mobile Bottom Action Bar */}
      <div className="pm-mobile-actions">
        <div className="pm-mobile-zoom">
          <button className="pm-mobile-btn" onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))}>
            -
          </button>
          <span className="pm-mobile-zoom-level">{Math.round(zoom * 100)}%</span>
          <button className="pm-mobile-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.1))}>
            +
          </button>
          <button className="pm-mobile-btn pm-mobile-fit" onClick={fitToScreen}>
            Fit
          </button>
        </div>
        <div className="pm-mobile-main-actions">
          {selectedCustomer && (
            <button
              className={`pm-mobile-action-btn ${backPagePhotos.length > 0 ? 'has-photos' : ''}`}
              onClick={() => setShowPhotoSelect(true)}
            >
              <Images size={20} />
              <span>{backPagePhotos.length}/4</span>
            </button>
          )}
          <button
            className="pm-mobile-action-btn"
            onClick={generatePdf}
            disabled={!selectedCustomer || isGeneratingPdf}
          >
            <DownloadSimple size={20} />
            <span>PDF</span>
          </button>
          <button
            className="pm-mobile-action-btn primary"
            onClick={handlePrint}
            disabled={!selectedCustomer}
          >
            <Printer size={20} />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Preview Area */}
      <div className="pm-preview-container" ref={containerRef}>
        <div
          className="pm-preview"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center' }}
          ref={printRef}
        >
          <canvas ref={canvasRef} className="pm-canvas" />
          {!selectedCustomer && (
            <div className="pm-no-customer">
              <User size={48} className="no-customer-icon" />
              <p>Select a customer to preview</p>
              <Button onClick={() => setShowCustomerSelect(true)}>
                Select Customer
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Customer Select Modal */}
      <Modal
        isOpen={showCustomerSelect}
        onClose={() => setShowCustomerSelect(false)}
        title="Select Customer"
        size="md"
      >
        <div className="pm-customer-modal">
          <div className="pm-search">
            <MagnifyingGlass size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X size={14} className="clear-icon" />
              </button>
            )}
          </div>

          <div className="pm-customer-list">
            {filteredCustomers.length === 0 ? (
              <div className="pm-empty">No customers found</div>
            ) : (
              filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  className={`pm-customer-item ${selectedCustomer?.id === customer.id ? 'selected' : ''}`}
                  onClick={() => {
                    setSelectedCustomer(customer);
                    setShowCustomerSelect(false);
                    setSearchQuery('');
                  }}
                >
                  <div className="customer-avatar">
                    <User size={18} />
                  </div>
                  <div className="customer-info">
                    <span className="customer-name">{customer.name}</span>
                    <span className="customer-details">
                      {customer.phone} {customer.email && `• ${customer.email}`}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </Modal>

      {/* Template Select Modal */}
      <Modal
        isOpen={showTemplateSelect}
        onClose={() => setShowTemplateSelect(false)}
        title="Select Templates"
        size="md"
      >
        <div className="pm-template-modal">
          <div className="pm-search">
            <MagnifyingGlass size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="pm-template-list">
            {filteredTemplates.map((t) => (
              <button
                key={t.id}
                className={`pm-template-item ${selectedTemplates.find((st) => st.id === t.id) ? 'selected' : ''}`}
                onClick={() => toggleTemplateSelection(t)}
              >
                <div className="template-checkbox">
                  {selectedTemplates.find((st) => st.id === t.id) && <Check size={14} weight="bold" />}
                </div>
                <div className="template-preview-thumb">
                  {t.image_url ? (
                    <img src={t.image_url} alt={t.name} />
                  ) : (
                    <File size={24} className="placeholder-icon" />
                  )}
                </div>
                <div className="template-info">
                  <span className="template-name">{t.name}</span>
                  <span className="template-category">{t.category}</span>
                </div>
              </button>
            ))}
          </div>

          <div className="pm-modal-actions">
            <Button onClick={() => setShowTemplateSelect(false)}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Back Page Photo Select Modal */}
      <Modal
        isOpen={showPhotoSelect}
        onClose={() => setShowPhotoSelect(false)}
        title="Select Back Page Photos"
        size="lg"
      >
        <div className="pm-photo-modal">
          <p className="pm-photo-description">
            Select up to 4 photos to print on the back page (2x2 grid)
          </p>

          {/* Selected photos preview */}
          {backPagePhotos.length > 0 && (
            <div className="pm-selected-photos">
              <h4>Selected Photos ({backPagePhotos.length}/4)</h4>
              <div className="pm-selected-grid">
                {backPagePhotos.map((photo, index) => (
                  <div key={photo.id} className="pm-selected-photo">
                    <img src={photo.url} alt={photo.name} />
                    <button
                      className="pm-remove-photo"
                      onClick={() => setBackPagePhotos((prev) => prev.filter((_, i) => i !== index))}
                    >
                      <Trash size={14} />
                    </button>
                    <span className="pm-photo-position">{index + 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Available photos */}
          <div className="pm-available-photos">
            <h4>Customer Photos</h4>
            {isLoadingPhotos ? (
              <div className="pm-loading">Loading photos...</div>
            ) : customerPhotos.length === 0 ? (
              <div className="pm-empty">No photos found in customer documents</div>
            ) : (
              <div className="pm-photo-grid">
                {customerPhotos.map((photo) => {
                  const isSelected = backPagePhotos.some((p) => p.id === photo.id);
                  return (
                    <button
                      key={photo.id}
                      className={`pm-photo-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => {
                        if (isSelected) {
                          setBackPagePhotos((prev) => prev.filter((p) => p.id !== photo.id));
                        } else if (backPagePhotos.length < 4) {
                          setBackPagePhotos((prev) => [...prev, photo]);
                        }
                      }}
                      disabled={!isSelected && backPagePhotos.length >= 4}
                    >
                      <img src={photo.url} alt={photo.name} />
                      {isSelected && (
                        <div className="pm-photo-check">
                          <Check size={16} weight="bold" />
                        </div>
                      )}
                      <span className="pm-photo-name">{photo.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="pm-modal-actions">
            <Button variant="outline" onClick={() => setBackPagePhotos([])}>
              Clear All
            </Button>
            <Button onClick={() => setShowPhotoSelect(false)}>Done</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
