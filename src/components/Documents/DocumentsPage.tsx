/**
 * DocumentsPage Component
 * Main page that integrates DocumentManager, FormEditor, and PrintManager
 */

import { useState } from 'react';
import { DocumentManager } from './DocumentManager';
import { FormEditor } from './FormEditor';
import { PrintManager } from './PrintManager';
import type { DocumentTemplate } from '@/types';
import './DocumentsPage.css';

type ViewMode = 'manager' | 'editor' | 'print';

export function DocumentsPage() {
  const [viewMode, setViewMode] = useState<ViewMode>('manager');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);

  const handleEditTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setViewMode('editor');
  };

  const handlePrintTemplate = (template: DocumentTemplate) => {
    setSelectedTemplate(template);
    setViewMode('print');
  };

  const handleBackToManager = () => {
    setViewMode('manager');
    setSelectedTemplate(null);
  };

  // Render based on current view mode
  if (viewMode === 'editor' && selectedTemplate) {
    return (
      <FormEditor
        template={selectedTemplate}
        onClose={handleBackToManager}
        onSave={handleBackToManager}
      />
    );
  }

  if (viewMode === 'print' && selectedTemplate) {
    return (
      <PrintManager
        template={selectedTemplate}
        onClose={handleBackToManager}
      />
    );
  }

  return (
    <DocumentManager
      onEditTemplate={handleEditTemplate}
      onPrintTemplate={handlePrintTemplate}
    />
  );
}
