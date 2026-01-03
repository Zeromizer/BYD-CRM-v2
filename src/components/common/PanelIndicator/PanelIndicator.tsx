import './PanelIndicator.css';

interface Panel {
  id: string;
  label: string;
}

interface PanelIndicatorProps {
  panels: Panel[];
  activePanel: number;
  onPanelChange: (index: number) => void;
  visible?: boolean;
}

export function PanelIndicator({ panels, activePanel, onPanelChange, visible = true }: PanelIndicatorProps) {
  return (
    <div className={`panel-indicator safe-area-bottom ${visible ? 'visible' : 'hidden'}`}>
      <div className="panel-indicator-dots">
        {panels.map((panel, index) => (
          <button
            key={panel.id}
            type="button"
            className={`panel-dot ${index === activePanel ? 'active' : ''}`}
            onClick={() => onPanelChange(index)}
            aria-label={`Go to ${panel.label}`}
            aria-current={index === activePanel ? 'true' : undefined}
          >
            <span className="panel-dot-inner" />
          </button>
        ))}
      </div>
      <span className="panel-indicator-label">{panels[activePanel]?.label}</span>
    </div>
  );
}

export default PanelIndicator;
