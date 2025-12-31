/**
 * FormEditor Component
 * Visual canvas-based field mapping editor for document templates
 */

import { useState, useRef, useEffect } from 'react';
import { Button, Modal } from '@/components/common';
import {
  Save,
  Trash2,
  Type,
  ArrowLeft,
  Upload,
} from 'lucide-react';
import { useDocumentStore } from '@/stores/useDocumentStore';
import {
  FONT_SIZES,
  FONT_FAMILIES,
  TEXT_ALIGNMENTS,
  getFieldTypesByCategory,
  getFieldLabel,
  getFieldExampleData,
} from '@/constants/fieldTypes';
import type { DocumentTemplate, FieldConfig, FieldMappings, TextAlign } from '@/types';
import './FormEditor.css';

interface FormEditorProps {
  template: DocumentTemplate;
  onClose: () => void;
  onSave?: () => void;
}

interface DragState {
  isDragging: boolean;
  fieldId: string | null;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
}

interface ResizeState {
  isResizing: boolean;
  fieldId: string | null;
  handle: 'e' | 'w' | 's' | 'n' | 'se' | 'sw' | 'ne' | 'nw' | null;
  startX: number;
  startY: number;
  originalWidth: number;
  originalHeight: number;
  originalX: number;
  originalY: number;
}

type ToolMode = 'select' | 'pan' | 'add';

const DEFAULT_FIELD: Omit<FieldConfig, 'type'> = {
  x: 100,
  y: 100,
  width: 300,
  height: 40,
  fontSize: 14,
  fontFamily: 'Arial',
  textAlign: 'left',
  color: '#000000',
};

export function FormEditor({ template, onClose, onSave }: FormEditorProps) {
  const { updateFieldMappings, uploadTemplateImage, updateTemplate, isSaving } = useDocumentStore();

  // Field state
  const [fields, setFields] = useState<FieldMappings>(template.fields || {});
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Canvas state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [toolMode, setToolMode] = useState<ToolMode>('select');

  // Drag & resize state
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    fieldId: null,
    startX: 0,
    startY: 0,
    originalX: 0,
    originalY: 0,
  });
  const [resizeState, setResizeState] = useState<ResizeState>({
    isResizing: false,
    fieldId: null,
    handle: null,
    startX: 0,
    startY: 0,
    originalWidth: 0,
    originalHeight: 0,
    originalX: 0,
    originalY: 0,
  });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });

  // Modal state
  const [showAddFieldModal, setShowAddFieldModal] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);

  // Image dimensions for fit-to-screen
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null);

  // Refs
  const canvasRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedField = selectedFieldId ? fields[selectedFieldId] : null;

  // Handle image load - auto fit to screen
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageDimensions({ width: img.naturalWidth, height: img.naturalHeight });

    // Auto fit to container on first load
    if (containerRef.current && zoom === 1) {
      const containerWidth = containerRef.current.clientWidth - 40;
      const containerHeight = containerRef.current.clientHeight - 40;
      const scaleX = containerWidth / img.naturalWidth;
      const scaleY = containerHeight / img.naturalHeight;
      const fitZoom = Math.min(scaleX, scaleY, 1);
      setZoom(Math.max(0.1, fitZoom));
    }
  };

  // Fit image to screen
  const fitToScreen = () => {
    if (!imageDimensions || !containerRef.current) return;
    const containerWidth = containerRef.current.clientWidth - 40;
    const containerHeight = containerRef.current.clientHeight - 40;
    const scaleX = containerWidth / imageDimensions.width;
    const scaleY = containerHeight / imageDimensions.height;
    const fitZoom = Math.min(scaleX, scaleY, 1);
    setZoom(Math.max(0.1, fitZoom));
    setPan({ x: 0, y: 0 });
  };

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedFieldId) {
        deleteField(selectedFieldId);
      } else if (e.key === 'Escape') {
        setSelectedFieldId(null);
      } else if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFieldId]);

  // Handle mouse wheel zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((z) => Math.max(0.1, Math.min(3, z + delta)));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  // Mouse move handler for drag and resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState.isDragging && dragState.fieldId) {
        const dx = (e.clientX - dragState.startX) / zoom;
        const dy = (e.clientY - dragState.startY) / zoom;

        setFields((prev) => ({
          ...prev,
          [dragState.fieldId!]: {
            ...prev[dragState.fieldId!],
            x: Math.max(0, dragState.originalX + dx),
            y: Math.max(0, dragState.originalY + dy),
          },
        }));
        setHasUnsavedChanges(true);
      } else if (resizeState.isResizing && resizeState.fieldId) {
        const dx = (e.clientX - resizeState.startX) / zoom;
        const dy = (e.clientY - resizeState.startY) / zoom;

        setFields((prev) => {
          const field = prev[resizeState.fieldId!];
          let newWidth = resizeState.originalWidth;
          let newHeight = resizeState.originalHeight;
          let newX = resizeState.originalX;
          let newY = resizeState.originalY;

          switch (resizeState.handle) {
            case 'e':
              newWidth = Math.max(50, resizeState.originalWidth + dx);
              break;
            case 'w':
              newWidth = Math.max(50, resizeState.originalWidth - dx);
              newX = resizeState.originalX + dx;
              break;
            case 's':
              newHeight = Math.max(20, resizeState.originalHeight + dy);
              break;
            case 'n':
              newHeight = Math.max(20, resizeState.originalHeight - dy);
              newY = resizeState.originalY + dy;
              break;
            case 'se':
              newWidth = Math.max(50, resizeState.originalWidth + dx);
              newHeight = Math.max(20, resizeState.originalHeight + dy);
              break;
            case 'sw':
              newWidth = Math.max(50, resizeState.originalWidth - dx);
              newX = resizeState.originalX + dx;
              newHeight = Math.max(20, resizeState.originalHeight + dy);
              break;
            case 'ne':
              newWidth = Math.max(50, resizeState.originalWidth + dx);
              newHeight = Math.max(20, resizeState.originalHeight - dy);
              newY = resizeState.originalY + dy;
              break;
            case 'nw':
              newWidth = Math.max(50, resizeState.originalWidth - dx);
              newX = resizeState.originalX + dx;
              newHeight = Math.max(20, resizeState.originalHeight - dy);
              newY = resizeState.originalY + dy;
              break;
          }

          return {
            ...prev,
            [resizeState.fieldId!]: {
              ...field,
              width: newWidth,
              height: newHeight,
              x: newX,
              y: newY,
            },
          };
        });
        setHasUnsavedChanges(true);
      } else if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
        setPanStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setDragState((prev) => ({ ...prev, isDragging: false, fieldId: null }));
      setResizeState((prev) => ({ ...prev, isResizing: false, fieldId: null, handle: null }));
      setIsPanning(false);
    };

    if (dragState.isDragging || resizeState.isResizing || isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, resizeState, isPanning, panStart, zoom]);

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (toolMode === 'pan' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    } else if (toolMode === 'select') {
      // Deselect when clicking empty canvas
      if (e.target === canvasRef.current || e.target === imageRef.current) {
        setSelectedFieldId(null);
      }
    }
  };

  const handleFieldMouseDown = (e: React.MouseEvent, fieldId: string) => {
    e.stopPropagation();

    // Always allow selecting and dragging fields, auto-switch to select mode
    if (toolMode !== 'select') {
      setToolMode('select');
    }

    setSelectedFieldId(fieldId);
    const field = fields[fieldId];

    setDragState({
      isDragging: true,
      fieldId,
      startX: e.clientX,
      startY: e.clientY,
      originalX: field.x,
      originalY: field.y,
    });
  };

  const handleResizeMouseDown = (
    e: React.MouseEvent,
    fieldId: string,
    handle: ResizeState['handle']
  ) => {
    e.stopPropagation();
    const field = fields[fieldId];

    setResizeState({
      isResizing: true,
      fieldId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      originalWidth: field.width,
      originalHeight: field.height,
      originalX: field.x,
      originalY: field.y,
    });
  };

  const addField = (fieldType: string) => {
    const fieldId = `field_${Date.now()}`;
    const newField: FieldConfig = {
      ...DEFAULT_FIELD,
      type: fieldType,
    };

    setFields((prev) => ({
      ...prev,
      [fieldId]: newField,
    }));
    setSelectedFieldId(fieldId);
    setHasUnsavedChanges(true);
    setShowAddFieldModal(false);
  };

  const deleteField = (fieldId: string) => {
    setFields((prev) => {
      const newFields = { ...prev };
      delete newFields[fieldId];
      return newFields;
    });
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
    setHasUnsavedChanges(true);
  };

  const updateField = (fieldId: string, updates: Partial<FieldConfig>) => {
    setFields((prev) => ({
      ...prev,
      [fieldId]: {
        ...prev[fieldId],
        ...updates,
      },
    }));
    setHasUnsavedChanges(true);
  };

  const handleSave = async () => {
    try {
      await updateFieldMappings(template.id, fields);
      setHasUnsavedChanges(false);
      onSave?.();
    } catch (err) {
      console.error('Error saving fields:', err);
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      const result = await uploadTemplateImage(file);
      await updateTemplate(template.id, {
        image_path: result.path,
        image_url: result.url,
      });
      setShowImageUpload(false);
    } catch (err) {
      console.error('Error uploading image:', err);
    }
  };

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const fieldsByCategory = getFieldTypesByCategory();

  return (
    <div className="form-editor">
      {/* Toolbar */}
      <div className="fe-toolbar">
        <div className="fe-toolbar-left">
          <Button variant="ghost" onClick={onClose} leftIcon={<ArrowLeft size={16} />}>
            Back
          </Button>
          <div className="fe-divider" />
          <h3 className="fe-title">{template.name}</h3>
          {hasUnsavedChanges && <span className="unsaved-indicator">Unsaved changes</span>}
        </div>

        <div className="fe-toolbar-center">
          <div className="tool-group">
            <button
              className={`tool-btn-labeled ${toolMode === 'select' ? 'active' : ''}`}
              onClick={() => setToolMode('select')}
              title="Select tool"
            >
              Select
            </button>
            <button
              className={`tool-btn-labeled ${toolMode === 'pan' ? 'active' : ''}`}
              onClick={() => setToolMode('pan')}
              title="Pan/drag the canvas"
            >
              Pan
            </button>
            <button
              className="tool-btn-labeled add-field-btn"
              onClick={() => setShowAddFieldModal(true)}
              title="Add a new field"
            >
              + Add Field
            </button>
          </div>

          <div className="fe-divider" />

          <div className="zoom-controls">
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.max(0.1, z - 0.1))} title="Zoom Out">
              -
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button className="zoom-btn" onClick={() => setZoom((z) => Math.min(3, z + 0.1))} title="Zoom In">
              +
            </button>
            <button className="zoom-btn-text" onClick={fitToScreen} title="Fit to Screen">
              Fit
            </button>
            <button className="zoom-btn-text" onClick={resetView} title="Reset to 100%">
              100%
            </button>
          </div>
        </div>

        <div className="fe-toolbar-right">
          <Button variant="outline" onClick={() => setShowImageUpload(true)} leftIcon={<Upload size={14} />}>
            Upload Image
          </Button>
          <Button onClick={handleSave} isLoading={isSaving} leftIcon={<Save size={14} />}>
            Save
          </Button>
        </div>
      </div>

      <div className="fe-content">
        {/* Canvas */}
        <div
          className="fe-canvas-container"
          ref={containerRef}
          onMouseDown={handleCanvasMouseDown}
          style={{ cursor: toolMode === 'pan' ? 'grab' : 'default' }}
        >
          <div
            className="fe-canvas"
            ref={canvasRef}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
            }}
          >
            {template.image_url ? (
              <img
                ref={imageRef}
                src={template.image_url}
                alt={template.name}
                className="fe-template-image"
                draggable={false}
                onLoad={handleImageLoad}
              />
            ) : (
              <div
                className="fe-no-image"
                style={{ width: 800, height: 1000 }}
                onClick={() => setShowImageUpload(true)}
              >
                <Upload size={48} strokeWidth={1} />
                <p>Click to upload template image</p>
              </div>
            )}

            {/* Help tip when no fields */}
            {Object.keys(fields).length === 0 && template.image_url && (
              <div className="fe-help-tip">
                Click the <kbd>+</kbd> button in the toolbar to add fields • <kbd>Ctrl</kbd>+<kbd>Scroll</kbd> to zoom
              </div>
            )}

            {/* Field overlays */}
            {Object.entries(fields).map(([fieldId, field]) => (
              <div
                key={fieldId}
                className={`fe-field ${selectedFieldId === fieldId ? 'selected' : ''}`}
                style={{
                  left: field.x,
                  top: field.y,
                  width: field.width,
                  height: field.height,
                }}
                onMouseDown={(e) => handleFieldMouseDown(e, fieldId)}
              >
                {/* Field type label */}
                <span className="field-type-label">{getFieldLabel(field.type)}</span>
                {/* Example data preview */}
                <span
                  className="field-preview"
                  style={{
                    fontSize: field.fontSize,
                    fontFamily: field.fontFamily,
                    textAlign: field.textAlign,
                    color: field.color,
                  }}
                >
                  {getFieldExampleData(field.type)}
                </span>

                {selectedFieldId === fieldId && (
                  <>
                    {/* Resize handles */}
                    <div
                      className="resize-handle n"
                      onMouseDown={(e) => handleResizeMouseDown(e, fieldId, 'n')}
                    />
                    <div
                      className="resize-handle s"
                      onMouseDown={(e) => handleResizeMouseDown(e, fieldId, 's')}
                    />
                    <div
                      className="resize-handle e"
                      onMouseDown={(e) => handleResizeMouseDown(e, fieldId, 'e')}
                    />
                    <div
                      className="resize-handle w"
                      onMouseDown={(e) => handleResizeMouseDown(e, fieldId, 'w')}
                    />
                    <div
                      className="resize-handle ne"
                      onMouseDown={(e) => handleResizeMouseDown(e, fieldId, 'ne')}
                    />
                    <div
                      className="resize-handle nw"
                      onMouseDown={(e) => handleResizeMouseDown(e, fieldId, 'nw')}
                    />
                    <div
                      className="resize-handle se"
                      onMouseDown={(e) => handleResizeMouseDown(e, fieldId, 'se')}
                    />
                    <div
                      className="resize-handle sw"
                      onMouseDown={(e) => handleResizeMouseDown(e, fieldId, 'sw')}
                    />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Properties Panel */}
        {selectedField && (
          <div className="fe-properties">
            <div className="fe-properties-header">
              <h4>Field Properties</h4>
              <button
                className="delete-field-btn"
                onClick={() => deleteField(selectedFieldId!)}
                title="Delete Field"
              >
                <Trash2 size={16} />
              </button>
            </div>

            <div className="property-group">
              <label>Field Type</label>
              <select
                value={selectedField.type}
                onChange={(e) => updateField(selectedFieldId!, { type: e.target.value })}
              >
                {Object.entries(fieldsByCategory).map(([category, categoryFields]) => (
                  <optgroup key={category} label={category}>
                    {categoryFields.map((f) => (
                      <option key={f.key} value={f.key}>
                        {f.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {selectedField.type === 'custom' && (
              <div className="property-group">
                <label>Custom Value</label>
                <input
                  type="text"
                  value={selectedField.customValue || ''}
                  onChange={(e) => updateField(selectedFieldId!, { customValue: e.target.value })}
                  placeholder="Enter custom text..."
                />
              </div>
            )}

            <div className="property-row">
              <div className="property-group half">
                <label>X Position</label>
                <input
                  type="number"
                  value={Math.round(selectedField.x)}
                  onChange={(e) => updateField(selectedFieldId!, { x: Number(e.target.value) })}
                />
              </div>
              <div className="property-group half">
                <label>Y Position</label>
                <input
                  type="number"
                  value={Math.round(selectedField.y)}
                  onChange={(e) => updateField(selectedFieldId!, { y: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="property-row">
              <div className="property-group half">
                <label>Width</label>
                <input
                  type="number"
                  value={Math.round(selectedField.width)}
                  onChange={(e) => updateField(selectedFieldId!, { width: Number(e.target.value) })}
                />
              </div>
              <div className="property-group half">
                <label>Height</label>
                <input
                  type="number"
                  value={Math.round(selectedField.height)}
                  onChange={(e) => updateField(selectedFieldId!, { height: Number(e.target.value) })}
                />
              </div>
            </div>

            <div className="property-group">
              <label>Font Family</label>
              <select
                value={selectedField.fontFamily}
                onChange={(e) => updateField(selectedFieldId!, { fontFamily: e.target.value })}
              >
                {FONT_FAMILIES.map((font) => (
                  <option key={font.value} value={font.value}>
                    {font.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="property-row">
              <div className="property-group half">
                <label>Font Size</label>
                <select
                  value={selectedField.fontSize}
                  onChange={(e) => updateField(selectedFieldId!, { fontSize: Number(e.target.value) })}
                >
                  {FONT_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}pt
                    </option>
                  ))}
                </select>
              </div>
              <div className="property-group half">
                <label>Alignment</label>
                <select
                  value={selectedField.textAlign}
                  onChange={(e) => updateField(selectedFieldId!, { textAlign: e.target.value as TextAlign })}
                >
                  {TEXT_ALIGNMENTS.map((align) => (
                    <option key={align.value} value={align.value}>
                      {align.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="property-group">
              <label>Text Color</label>
              <div className="color-input">
                <input
                  type="color"
                  value={selectedField.color}
                  onChange={(e) => updateField(selectedFieldId!, { color: e.target.value })}
                />
                <input
                  type="text"
                  value={selectedField.color}
                  onChange={(e) => updateField(selectedFieldId!, { color: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Add Field Modal */}
      <Modal
        isOpen={showAddFieldModal}
        onClose={() => setShowAddFieldModal(false)}
        title="Add Field"
        size="md"
      >
        <div className="add-field-modal">
          {Object.entries(fieldsByCategory).map(([category, categoryFields]) => (
            <div key={category} className="field-category">
              <h5>{category}</h5>
              <div className="field-options">
                {categoryFields.map((field) => (
                  <button
                    key={field.key}
                    className="field-option"
                    onClick={() => addField(field.key)}
                  >
                    <Type size={14} />
                    {field.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {/* Image Upload Modal */}
      <Modal
        isOpen={showImageUpload}
        onClose={() => setShowImageUpload(false)}
        title="Upload Template Image"
        size="sm"
      >
        <div className="image-upload-modal">
          <div
            className="upload-dropzone"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={32} />
            <p>Click to select an image</p>
            <small>PNG, JPG up to 10MB</small>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleImageUpload(file);
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
